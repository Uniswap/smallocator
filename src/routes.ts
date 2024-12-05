import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAddress } from 'viem/utils';
import { randomUUID } from 'crypto';
import {
  validateAndCreateSession,
  verifySession,
  type SessionPayload,
} from './session';
import {
  submitCompact,
  getCompactsByAddress,
  getCompactByHash,
  type CompactSubmission,
} from './compact';
import { getCompactDetails, getAllResourceLocks } from './graphql';
import { getAllocatedBalance } from './balance';

// Declare db property on FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    db: import('@electric-sql/pglite').PGlite;
  }
  interface FastifyRequest {
    session?: {
      id: string;
      address: string;
    };
  }
}

// Type for serialized response
interface SerializedCompactMessage {
  id: string;
  arbiter: string;
  sponsor: string;
  nonce: string;
  expires: string;
  amount: string;
  witnessTypeString: string | null;
  witnessHash: string | null;
}

interface SerializedCompactRecord {
  chainId: string;
  compact: SerializedCompactMessage;
  hash: string;
  signature: string;
  createdAt: string;
}

// Authentication middleware
function createAuthMiddleware(server: FastifyInstance) {
  return async function authenticateRequest(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const sessionId = request.headers['x-session-id'];
    if (!sessionId || Array.isArray(sessionId)) {
      reply.code(401).send({ error: 'Session ID required' });
      return;
    }

    try {
      const isValid = await verifySession(server, sessionId);
      if (!isValid) {
        reply.code(401).send({ error: 'Invalid session' });
        return;
      }

      // Get the session data
      const result = await server.db.query<{ address: string }>(
        'SELECT address FROM sessions WHERE id = $1',
        [sessionId]
      );

      if (result.rows.length === 0) {
        reply.code(401).send({ error: 'Session not found' });
        return;
      }

      // Store the session in the request object
      request.session = {
        id: sessionId,
        address: result.rows[0].address,
      };
    } catch (err) {
      server.log.error({
        msg: 'Session verification failed',
        err: err instanceof Error ? err.message : String(err),
        sessionId,
        path: request.url,
      });
      reply.code(401).send({ error: 'Invalid session' });
      return;
    }
  };
}

export async function setupRoutes(server: FastifyInstance): Promise<void> {
  const authenticateRequest = createAuthMiddleware(server);

  // Health check endpoint
  server.get(
    '/health',
    async (): Promise<{
      status: string;
      allocatorAddress: string;
      signingAddress: string;
      timestamp: string;
    }> => {
      if (!process.env.ALLOCATOR_ADDRESS || !process.env.SIGNING_ADDRESS) {
        throw new Error('Required environment variables are not set');
      }
      return {
        status: 'healthy',
        allocatorAddress: process.env.ALLOCATOR_ADDRESS,
        signingAddress: process.env.SIGNING_ADDRESS,
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Get session payload
  server.get(
    '/session/:chainId/:address',
    async (
      request: FastifyRequest<{
        Params: {
          address: string;
          chainId: string;
        };
      }>,
      reply: FastifyReply
    ): Promise<{ session: SessionPayload } | { error: string }> => {
      try {
        const { address, chainId } = request.params;
        const chainIdNum = parseInt(chainId, 10);

        if (isNaN(chainIdNum)) {
          return reply.code(400).send({
            error: 'Invalid chain ID format',
          });
        }

        let normalizedAddress: string;
        try {
          normalizedAddress = getAddress(address);
        } catch (error) {
          return reply.code(400).send({
            error: `Invalid Ethereum address format: ${error instanceof Error ? error.message : String(error)}`,
          });
        }

        const nonce = randomUUID();
        if (!process.env.BASE_URL) {
          throw new Error('BASE_URL environment variable must be set');
        }
        const baseUrl = process.env.BASE_URL;
        const domain = new URL(baseUrl).host;
        const issuedAt = new Date();
        const expirationTime = new Date(issuedAt.getTime() + 30 * 60 * 1000); // 30 minutes

        const payload = {
          domain,
          address: normalizedAddress,
          uri: baseUrl,
          statement: 'Sign in to Smallocator',
          version: '1',
          chainId: chainIdNum,
          nonce,
          issuedAt: issuedAt.toISOString(),
          expirationTime: expirationTime.toISOString(),
        };

        // Store session request
        const requestId = randomUUID();
        await server.db.query(
          `INSERT INTO session_requests (
            id, address, nonce, domain, chain_id, issued_at, expiration_time
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            requestId,
            normalizedAddress,
            nonce,
            domain,
            chainIdNum,
            issuedAt.toISOString(),
            expirationTime.toISOString(),
          ]
        );

        return reply.code(200).send({ session: payload });
      } catch (error) {
        server.log.error('Failed to create session request:', error);
        return reply.code(500).send({
          error: 'Failed to create session request',
        });
      }
    }
  );

  // Create new session
  server.post<{
    Body: {
      signature: string;
      payload: SessionPayload;
    };
  }>(
    '/session',
    async (
      request: FastifyRequest<{
        Body: { signature: string; payload: SessionPayload };
      }>,
      reply: FastifyReply
    ): Promise<
      | { session: { id: string; address: string; expiresAt: string } }
      | { error: string }
    > => {
      try {
        const { signature, payload } = request.body;

        // Validate and create session
        const session = await validateAndCreateSession(
          server,
          signature,
          payload
        );

        return reply.code(200).send({ session });
      } catch (error) {
        server.log.error('Session creation failed:', error);
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : 'Invalid session request',
        });
      }
    }
  );

  // Verify session
  server.get(
    '/session/verify',
    async (
      request: FastifyRequest<{ Headers: { 'x-session-id'?: string } }>,
      reply: FastifyReply
    ): Promise<{ address: string } | { error: string }> => {
      const sessionId = request.headers['x-session-id'];
      if (!sessionId || Array.isArray(sessionId)) {
        reply.code(401);
        return { error: 'Session ID required' };
      }

      try {
        await verifySession(server, sessionId);
        const result = await server.db.query<{ address: string }>(
          'SELECT address FROM sessions WHERE id = $1',
          [sessionId]
        );
        return { address: result.rows[0].address };
      } catch (err) {
        server.log.error({
          msg: 'Session verification failed',
          err: err instanceof Error ? err.message : String(err),
          sessionId,
          path: request.url,
        });
        reply.code(401);
        return {
          error: err instanceof Error ? err.message : 'Invalid session',
        };
      }
    }
  );

  // Get balance for all resource locks
  server.get(
    '/balances',
    {
      preHandler: authenticateRequest,
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<
      | {
          balances: Array<{
            chainId: string;
            lockId: string;
            allocatableBalance: string;
            allocatedBalance: string;
            balanceAvailableToAllocate: string;
            withdrawalStatus: number;
          }>;
        }
      | { error: string }
    > => {
      try {
        const sponsor = request.session!.address;

        // Get all resource locks for the sponsor
        const response = await getAllResourceLocks(sponsor);

        // Add defensive checks
        if (!response?.account?.resourceLocks?.items) {
          return { balances: [] };
        }

        // Filter locks to only include those managed by this allocator
        const ourLocks = response.account.resourceLocks.items.filter(
          (item) =>
            item?.resourceLock?.allocatorAddress?.toLowerCase() ===
            process.env.ALLOCATOR_ADDRESS!.toLowerCase()
        );

        // Get balance details for each lock
        const balances = (
          await Promise.all(
            ourLocks.map(async (lock) => {
              // Get details from GraphQL
              const lockDetails = await getCompactDetails({
                allocator: process.env.ALLOCATOR_ADDRESS!,
                sponsor,
                lockId: lock.resourceLock.lockId,
                chainId: lock.chainId,
              });

              // Add defensive check for lockDetails
              if (!lockDetails?.account?.resourceLocks?.items?.[0]) {
                return null; // This lock will be filtered out
              }

              const resourceLock = lockDetails.account.resourceLocks.items[0];
              if (!resourceLock) {
                return null; // Skip if lock no longer exists
              }

              // Calculate pending balance
              const pendingBalance = lockDetails.accountDeltas.items.reduce(
                (sum, delta) => sum + BigInt(delta.delta),
                BigInt(0)
              );

              // Calculate allocatable balance
              const allocatableBalance =
                BigInt(resourceLock.balance) + pendingBalance;

              // Get allocated balance
              const allocatedBalance = await getAllocatedBalance(
                server.db,
                sponsor,
                lock.chainId,
                lock.resourceLock.lockId,
                lockDetails.account.claims.items.map((claim) => claim.claimHash)
              );

              // Calculate available balance
              let balanceAvailableToAllocate = BigInt(0);
              if (resourceLock.withdrawalStatus === 0) {
                if (allocatedBalance < allocatableBalance) {
                  balanceAvailableToAllocate =
                    allocatableBalance - allocatedBalance;
                }
              }

              return {
                chainId: lock.chainId,
                lockId: lock.resourceLock.lockId,
                allocatableBalance: allocatableBalance.toString(),
                allocatedBalance: allocatedBalance.toString(),
                balanceAvailableToAllocate:
                  balanceAvailableToAllocate.toString(),
                withdrawalStatus: resourceLock.withdrawalStatus,
              };
            })
          )
        ).filter(
          (balance): balance is NonNullable<typeof balance> => balance !== null
        );

        // Filter out any null results and return
        return {
          balances,
        };
      } catch (error) {
        console.error('Error fetching balances:', error);
        reply.code(500);
        return {
          error: `Failed to fetch balances: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    }
  );

  // Protected routes
  server.register(async function (protectedRoutes) {
    // Add authentication to all routes in this context
    protectedRoutes.addHook('preHandler', authenticateRequest);

    // Get available balance for a specific lock
    protectedRoutes.get<{
      Params: { chainId: string; lockId: string };
    }>(
      '/balance/:chainId/:lockId',
      async (
        request: FastifyRequest<{
          Params: { chainId: string; lockId: string };
        }>,
        reply: FastifyReply
      ) => {
        if (!request.session) {
          reply.code(401);
          return { error: 'Unauthorized' };
        }

        try {
          const { chainId, lockId } = request.params;
          const sponsor = request.session.address;

          // Get details from GraphQL
          const response = await getCompactDetails({
            allocator: process.env.ALLOCATOR_ADDRESS!,
            sponsor,
            lockId,
            chainId,
          });

          // Verify the resource lock exists
          const resourceLock = response.account.resourceLocks.items[0];
          if (!resourceLock) {
            reply.code(404);
            return { error: 'Resource lock not found' };
          }

          // Extract allocatorId from the lockId
          const lockIdBigInt = BigInt(lockId);
          const allocatorId =
            (lockIdBigInt >> BigInt(160)) &
            ((BigInt(1) << BigInt(92)) - BigInt(1));

          // Verify allocatorId matches
          const graphqlAllocatorId =
            response.allocator.supportedChains.items[0]?.allocatorId;
          if (
            !graphqlAllocatorId ||
            BigInt(graphqlAllocatorId) !== allocatorId
          ) {
            reply.code(400);
            return { error: 'Invalid allocator ID' };
          }

          // Calculate pending balance
          const pendingBalance = response.accountDeltas.items.reduce(
            (sum, delta) => sum + BigInt(delta.delta),
            BigInt(0)
          );

          // Calculate allocatable balance
          const resourceLockBalance = BigInt(resourceLock.balance);
          const allocatableBalance =
            resourceLockBalance > pendingBalance
              ? resourceLockBalance - pendingBalance
              : BigInt(0);

          // Get allocated balance from database
          const allocatedBalance = await getAllocatedBalance(
            server.db,
            sponsor,
            chainId,
            lockId,
            response.account.claims.items.map((claim) => claim.claimHash)
          );

          // Calculate balance available to allocate
          let balanceAvailableToAllocate = BigInt(0);
          if (resourceLock.withdrawalStatus === 0) {
            if (allocatedBalance < allocatableBalance) {
              balanceAvailableToAllocate =
                allocatableBalance - allocatedBalance;
            }
          }

          return {
            allocatableBalance: allocatableBalance.toString(),
            allocatedBalance: allocatedBalance.toString(),
            balanceAvailableToAllocate: balanceAvailableToAllocate.toString(),
            withdrawalStatus: resourceLock.withdrawalStatus,
          };
        } catch (error) {
          server.log.error('Failed to get balance:', error);
          reply.code(500);
          return {
            error:
              error instanceof Error ? error.message : 'Failed to get balance',
          };
        }
      }
    );

    // Submit a new compact
    protectedRoutes.post<{
      Body: CompactSubmission;
    }>('/compact', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      try {
        const result = await submitCompact(
          server,
          request.body as CompactSubmission,
          request.session.address
        );
        return { result };
      } catch (error) {
        server.log.error('Failed to submit compact:', error);
        if (
          error instanceof Error &&
          error.message.includes('Sponsor address does not match')
        ) {
          reply.code(403);
        } else {
          reply.code(400);
        }
        return {
          error:
            error instanceof Error ? error.message : 'Failed to submit compact',
        };
      }
    });

    // Get compacts for authenticated user
    protectedRoutes.get(
      '/compacts',
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.session) {
          reply.code(401);
          return { error: 'Unauthorized' };
        }

        try {
          return await getCompactsByAddress(server, request.session.address);
        } catch (error) {
          server.log.error('Failed to get compacts:', error);
          if (
            error instanceof Error &&
            error.message.includes('No compacts found')
          ) {
            reply.code(404);
          } else {
            reply.code(400);
          }
          return {
            error:
              error instanceof Error ? error.message : 'Failed to get compacts',
          };
        }
      }
    );

    // Get specific compact
    protectedRoutes.get(
      '/compact/:chainId/:claimHash',
      async (
        request: FastifyRequest<{
          Params: { chainId: string; claimHash: string };
        }>,
        reply: FastifyReply
      ): Promise<SerializedCompactRecord | { error: string }> => {
        try {
          const { chainId, claimHash } = request.params;
          const compact = await getCompactByHash(server, chainId, claimHash);

          if (!compact) {
            reply.code(404);
            return { error: 'Compact not found' };
          }

          // Convert BigInt values to strings for JSON serialization
          const serializedCompact: SerializedCompactRecord = {
            ...compact,
            compact: {
              ...compact.compact,
              id: compact.compact.id.toString(),
              nonce: compact.compact.nonce.toString(),
              expires: compact.compact.expires.toString(),
            },
          };

          return serializedCompact;
        } catch (error) {
          server.log.error('Failed to get compact:', error);
          reply.code(500);
          return {
            error:
              error instanceof Error ? error.message : 'Failed to get compact',
          };
        }
      }
    );
  });
}

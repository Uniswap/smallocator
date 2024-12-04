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

// Extend FastifyRequest to include session
declare module 'fastify' {
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
      server.log.error('Session verification failed:', err);
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
    }> => {
      if (!process.env.ALLOCATOR_ADDRESS || !process.env.SIGNING_ADDRESS) {
        throw new Error('Required environment variables are not set');
      }
      return {
        status: 'healthy',
        allocatorAddress: process.env.ALLOCATOR_ADDRESS,
        signingAddress: process.env.SIGNING_ADDRESS,
      };
    }
  );

  // Get session payload
  server.get(
    '/session/:address',
    async (
      request: FastifyRequest<{ Params: { address: string } }>,
      reply: FastifyReply
    ): Promise<{ session: SessionPayload } | { error: string }> => {
      try {
        const { address } = request.params as { address: string };

        let normalizedAddress: string;
        try {
          normalizedAddress = getAddress(address);
        } catch (error) {
          return reply.code(400).send({
            error: `Invalid Ethereum address format: ${error instanceof Error ? error.message : String(error)}`,
          });
        }

        const nonce = Date.now().toString();
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const payload = {
          domain: new URL(baseUrl).host,
          address: normalizedAddress,
          uri: baseUrl,
          statement: 'Sign in to Smallocator',
          version: '1',
          chainId: 1,
          nonce,
          issuedAt: new Date().toISOString(),
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          resources: [`${baseUrl}/resources`],
        };

        // Store nonce
        await server.db.query(
          'INSERT INTO nonces (id, chain_id, nonce) VALUES ($1, $2, $3)',
          [randomUUID(), '1', nonce]
        );

        return reply.code(200).send({ session: payload });
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : 'Invalid address',
        });
      }
    }
  );

  // Create session
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
        server.log.info('Creating session with payload:', payload);
        const session = await validateAndCreateSession(
          server,
          signature,
          payload
        );
        return { session };
      } catch (err) {
        server.log.error('Session creation failed:', {
          error: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined,
          payload: request.body.payload,
        });
        reply.code(400);
        return {
          error:
            err instanceof Error ? err.message : 'Failed to create session',
        };
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
        server.log.error('Session verification failed:', err);
        reply.code(401);
        return {
          error: err instanceof Error ? err.message : 'Invalid session',
        };
      }
    }
  );

  // Protected routes
  server.register(async function (protectedRoutes) {
    // Add authentication to all routes in this context
    protectedRoutes.addHook('preHandler', authenticateRequest);

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

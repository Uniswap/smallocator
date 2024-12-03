import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAddress } from 'viem';
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
  type CompactRecord,
} from './compact';

// Authentication middleware
function createAuthMiddleware(server: FastifyInstance) {
  return async function authenticateRequest(
    request: FastifyRequest<{ Headers: { 'x-session-id'?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const sessionId = request.headers['x-session-id'];
    if (!sessionId) {
      reply.code(401).send({ error: 'Session ID required' });
      return;
    }

    try {
      const session = await verifySession(server, sessionId);
      if (!session) {
        reply.code(401).send({ error: 'Invalid session' });
        return;
      }
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
      _reply: FastifyReply
    ): Promise<{ payload: SessionPayload } | { error: string }> => {
      const { address } = request.params as { address: string };

      try {
        const normalizedAddress = getAddress(address);
        const nonce = Date.now().toString();
        const payload = {
          domain: 'smallocator.example',
          address: normalizedAddress,
          uri: 'https://smallocator.example',
          statement: 'Sign in to Smallocator',
          version: '1',
          chainId: 1,
          nonce,
          issuedAt: new Date().toISOString(),
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          resources: ['https://smallocator.example/resources'],
        };

        // Store nonce
        await server.db.query(
          'INSERT INTO nonces (domain, nonce) VALUES ($1, $2)',
          ['smallocator.example', nonce]
        );

        return { payload };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Invalid address',
        };
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
      _reply: FastifyReply
    ): Promise<
      | { session: { id: string; address: string; expiresAt: string } }
      | { error: string }
    > => {
      try {
        const { signature, payload } = request.body;
        const session = await validateAndCreateSession(
          server,
          signature,
          payload
        );
        return { session };
      } catch (err) {
        server.log.error('Session creation failed:', err);
        return {
          error:
            err instanceof Error ? err.message : 'Failed to create session',
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
    }>(
      '/compact',
      async (
        request: FastifyRequest<{ Body: CompactSubmission }>,
        _reply: FastifyReply
      ): Promise<
        { result: { hash: string; signature: string } } | { error: string }
      > => {
        try {
          const session = await server.db.query<{ address: string }>(
            'SELECT address FROM sessions WHERE id = $1',
            [request.headers['x-session-id']]
          );

          if (!session.rows.length) {
            return { error: 'Session not found' };
          }

          const result = await submitCompact(
            server,
            request.body,
            session.rows[0].address
          );
          return { result };
        } catch (err) {
          server.log.error('Error submitting compact:', err);
          return { error: 'Internal server error' };
        }
      }
    );

    // Get all compacts for the authenticated user
    protectedRoutes.get(
      '/compacts',
      async (
        request: FastifyRequest<{ Headers: { 'x-session-id'?: string } }>,
        _reply: FastifyReply
      ): Promise<{ compacts: CompactRecord[] } | { error: string }> => {
        try {
          const session = await server.db.query<{ address: string }>(
            'SELECT address FROM sessions WHERE id = $1',
            [request.headers['x-session-id']]
          );

          if (!session.rows.length) {
            return { error: 'Session not found' };
          }

          const compacts = await getCompactsByAddress(
            server,
            session.rows[0].address
          );
          return { compacts };
        } catch (err) {
          server.log.error('Error retrieving compacts:', err);
          return { error: 'Internal server error' };
        }
      }
    );

    // Get a specific compact by hash
    protectedRoutes.get<{
      Params: {
        chainId: string;
        claimHash: string;
      };
    }>(
      '/compact/:chainId/:claimHash',
      async (
        request: FastifyRequest<{
          Params: { chainId: string; claimHash: string };
        }>,
        _reply: FastifyReply
      ): Promise<{ compact: CompactRecord | null } | { error: string }> => {
        try {
          const { chainId, claimHash } = request.params;
          const compact = await getCompactByHash(server, chainId, claimHash);

          if (!compact) {
            return { error: 'Compact not found' };
          }

          return { compact };
        } catch (err) {
          server.log.error('Error retrieving compact:', err);
          return { error: 'Internal server error' };
        }
      }
    );
  });
}

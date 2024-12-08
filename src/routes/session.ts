import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAddress } from 'viem/utils';
import { randomUUID } from 'crypto';
import {
  validateAndCreateSession,
  verifySession,
  type SessionPayload,
} from '../session';
import { addressToBytes } from '../utils/encoding';

// Authentication middleware
export function createAuthMiddleware(server: FastifyInstance) {
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
      const result = await server.db.query<{ address: Uint8Array }>(
        'SELECT address FROM sessions WHERE id = $1',
        [sessionId]
      );

      if (result.rows.length === 0) {
        reply.code(401).send({ error: 'Session not found' });
        return;
      }

      // Store the session in the request object with checksummed address
      request.session = {
        id: sessionId,
        address: getAddress(
          '0x' + Buffer.from(result.rows[0].address).toString('hex')
        ),
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

export async function setupSessionRoutes(
  server: FastifyInstance
): Promise<void> {
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
            error: `Invalid Ethereum address format: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }

        const nonce = randomUUID();
        if (!process.env.BASE_URL) {
          throw new Error('BASE_URL environment variable must be set');
        }
        const baseUrl = process.env.BASE_URL;
        const domain = new URL(baseUrl).host;
        const issuedAt = new Date();
        const expirationTime = new Date(
          issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000
        ); // 1 week

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

        // Store session request with address as bytea
        const requestId = randomUUID();
        await server.db.query(
          `INSERT INTO session_requests (
            id, address, nonce, domain, chain_id, issued_at, expiration_time
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            requestId,
            addressToBytes(normalizedAddress),
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

  // Get session status
  server.get(
    '/session',
    async (
      request: FastifyRequest<{ Headers: { 'x-session-id'?: string } }>,
      reply: FastifyReply
    ): Promise<
      | { session: { id: string; address: string; expiresAt: string } }
      | { error: string }
    > => {
      try {
        const sessionId = request.headers['x-session-id'];
        if (!sessionId || Array.isArray(sessionId)) {
          return reply.code(401).send({ error: 'Session ID required' });
        }

        // Verify and get session
        await verifySession(server, sessionId);

        // Get full session details
        const result = await server.db.query<{
          id: string;
          address: Uint8Array;
          expires_at: string;
        }>('SELECT id, address, expires_at FROM sessions WHERE id = $1', [
          sessionId,
        ]);

        // This should never happen since verifySession would throw, but TypeScript doesn't know that
        if (!result.rows || result.rows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'Session not found or expired' });
        }

        const session = result.rows[0];
        return {
          session: {
            id: session.id,
            address: getAddress(
              '0x' + Buffer.from(session.address).toString('hex')
            ),
            expiresAt: session.expires_at,
          },
        };
      } catch (error) {
        server.log.error({
          msg: 'Session verification failed',
          err: error instanceof Error ? error.message : String(error),
          sessionId: request.headers['x-session-id'],
          path: request.url,
        });
        return reply.code(401).send({
          error: error instanceof Error ? error.message : 'Invalid session',
        });
      }
    }
  );

  // Delete session (sign out)
  server.delete(
    '/session',
    {
      preHandler: createAuthMiddleware(server),
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<{ success: true } | { error: string }> => {
      try {
        const sessionId = request.headers['x-session-id'];
        if (!sessionId || Array.isArray(sessionId)) {
          return reply.code(401).send({ error: 'Session ID required' });
        }

        // Delete the session
        await server.db.query('DELETE FROM sessions WHERE id = $1', [
          sessionId,
        ]);

        return { success: true };
      } catch (error) {
        server.log.error('Failed to delete session:', error);
        return reply.code(500).send({
          error: 'Failed to delete session',
        });
      }
    }
  );
}

import { FastifyInstance } from 'fastify';
import { getAddress } from 'viem';
import { validateAndCreateSession, verifySession, type SessionPayload } from './session';
import { submitCompact, getCompactsByAddress, getCompactByHash, type CompactSubmission } from './compact';

// Authentication middleware
async function authenticate(request: any, reply: any) {
  const sessionId = request.headers['x-session-id'];
  if (!sessionId) {
    reply.code(401).send({ error: 'Session ID required' });
    return;
  }

  const isValid = await verifySession(request.server, sessionId);
  if (!isValid) {
    reply.code(401).send({ error: 'Invalid or expired session' });
    return;
  }
}

export async function setupRoutes(server: FastifyInstance) {
  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'healthy',
      allocatorAddress: process.env.ALLOCATOR_ADDRESS,
      signingAddress: process.env.SIGNING_ADDRESS
    };
  });

  // Get session payload
  server.get('/session/:address', async (request, reply) => {
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
        resources: ['https://smallocator.example/resources']
      };

      // Store nonce
      await server.db.query(
        'INSERT INTO nonces (domain, nonce) VALUES ($1, $2)',
        ['smallocator.example', nonce]
      );

      return { payload };
    } catch (error) {
      reply.code(400).send({ error: 'Invalid address' });
    }
  });

  // Create session
  server.post<{
    Body: {
      signature: string;
      payload: SessionPayload;
    };
  }>('/session', async (request, reply) => {
    try {
      const { signature, payload } = request.body;
      const session = await validateAndCreateSession(server, signature, payload);
      return session;
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Invalid session request'
      });
    }
  });

  // Protected routes
  server.register(async function (protectedRoutes) {
    // Add authentication to all routes in this context
    protectedRoutes.addHook('preHandler', authenticate);

    // Submit a new compact
    protectedRoutes.post<{
      Body: CompactSubmission;
    }>('/compact', async (request, reply) => {
      try {
        const session = await server.db.query(
          'SELECT address FROM sessions WHERE id = $1',
          [request.headers['x-session-id']]
        );
        
        const sponsorAddress = session.rows[0].address;
        const result = await submitCompact(server, request.body, sponsorAddress);
        return result;
      } catch (error) {
        reply.code(400).send({
          error: error instanceof Error ? error.message : 'Failed to submit compact'
        });
      }
    });

    // Get all compacts for the authenticated user
    protectedRoutes.get('/compacts', async (request, reply) => {
      try {
        const session = await server.db.query(
          'SELECT address FROM sessions WHERE id = $1',
          [request.headers['x-session-id']]
        );
        
        const compacts = await getCompactsByAddress(server, session.rows[0].address);
        return { compacts };
      } catch (error) {
        reply.code(400).send({
          error: error instanceof Error ? error.message : 'Failed to retrieve compacts'
        });
      }
    });

    // Get a specific compact by chain ID and claim hash
    protectedRoutes.get<{
      Params: {
        chainId: string;
        claimHash: string;
      };
    }>('/compact/:chainId/:claimHash', async (request, reply) => {
      try {
        const { chainId, claimHash } = request.params;
        const compact = await getCompactByHash(server, chainId, claimHash);
        
        if (!compact) {
          reply.code(404).send({ error: 'Compact not found' });
          return;
        }

        return compact;
      } catch (error) {
        reply.code(400).send({
          error: error instanceof Error ? error.message : 'Failed to retrieve compact'
        });
      }
    });
  });
}

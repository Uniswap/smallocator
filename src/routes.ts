import { FastifyInstance } from 'fastify';
import { getAddress, verifyMessage } from 'viem';

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

  // More endpoints to be implemented:
  // POST /session
  // POST /compact
  // GET /compacts
  // GET /compact/:chainId/:claimHash
}

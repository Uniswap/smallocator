import { FastifyInstance } from 'fastify';

export async function setupHealthRoutes(
  server: FastifyInstance
): Promise<void> {
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
}

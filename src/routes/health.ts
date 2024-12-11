import { FastifyInstance } from 'fastify';
import { getCachedSupportedChains } from '../graphql';

interface HealthResponse {
  status: string;
  allocatorAddress: string;
  signingAddress: string;
  timestamp: string;
  supportedChains: Array<{
    chainId: string;
    allocatorId: string;
    finalizationThresholdSeconds: number;
  }>;
}

export async function setupHealthRoutes(
  server: FastifyInstance
): Promise<void> {
  // Health check endpoint
  server.get('/health', async (): Promise<HealthResponse> => {
    if (!process.env.ALLOCATOR_ADDRESS || !process.env.SIGNING_ADDRESS) {
      throw new Error('Required environment variables are not set');
    }

    const supportedChains = getCachedSupportedChains();
    if (!supportedChains) {
      throw new Error('Supported chains data not initialized');
    }

    return {
      status: 'healthy',
      allocatorAddress: process.env.ALLOCATOR_ADDRESS,
      signingAddress: process.env.SIGNING_ADDRESS,
      timestamp: new Date().toISOString(),
      supportedChains,
    };
  });
}

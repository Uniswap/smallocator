import { FastifyInstance } from 'fastify';
import { chainConfig } from '../chain-config';

interface ChainConfigResponse {
  defaultFinalizationThresholdSeconds: number;
  supportedChains: Array<{
    chainId: string;
    finalizationThresholdSeconds: number;
  }>;
}

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
      chainConfig: ChainConfigResponse;
    }> => {
      if (!process.env.ALLOCATOR_ADDRESS || !process.env.SIGNING_ADDRESS) {
        throw new Error('Required environment variables are not set');
      }

      // Transform chain config into the desired format
      const chainConfigResponse: ChainConfigResponse = {
        defaultFinalizationThresholdSeconds:
          chainConfig.defaultFinalizationThreshold,
        supportedChains: Object.entries(chainConfig.finalizationThresholds).map(
          ([chainId, threshold]) => ({
            chainId,
            finalizationThresholdSeconds: threshold,
          })
        ),
      };

      return {
        status: 'healthy',
        allocatorAddress: process.env.ALLOCATOR_ADDRESS,
        signingAddress: process.env.SIGNING_ADDRESS,
        timestamp: new Date().toISOString(),
        chainConfig: chainConfigResponse,
      };
    }
  );
}

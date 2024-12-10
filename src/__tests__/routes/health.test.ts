import { FastifyInstance } from 'fastify';
import { createTestServer, cleanupTestServer } from '../utils/test-server';

describe('Health Routes', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTestServer();
  });

  afterEach(async () => {
    await cleanupTestServer();
  });

  describe('GET /health', () => {
    it('should return health status and addresses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('allocatorAddress');
      expect(body).toHaveProperty('signingAddress');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('chainConfig');

      // Verify chain config structure and values
      expect(body.chainConfig).toHaveProperty(
        'defaultFinalizationThresholdSeconds',
        3
      );
      expect(body.chainConfig).toHaveProperty('supportedChains');
      expect(Array.isArray(body.chainConfig.supportedChains)).toBe(true);

      // Verify specific chain configurations
      const chainConfigs = new Map(
        body.chainConfig.supportedChains.map(
          (chain: {
            chainId: string;
            finalizationThresholdSeconds: number;
          }) => [chain.chainId, chain.finalizationThresholdSeconds]
        )
      );

      expect(chainConfigs.get('1')).toBe(25); // Ethereum Mainnet
      expect(chainConfigs.get('10')).toBe(10); // Optimism
      expect(chainConfigs.get('8453')).toBe(2); // Base
      expect(chainConfigs.size).toBe(3); // Ensure no unexpected chains

      // Verify timestamp is a valid ISO 8601 date
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('should fail if environment variables are not set', async () => {
      // Store original env vars
      const originalAllocator = process.env.ALLOCATOR_ADDRESS;
      const originalSigning = process.env.SIGNING_ADDRESS;

      // Unset env vars
      delete process.env.ALLOCATOR_ADDRESS;
      delete process.env.SIGNING_ADDRESS;

      try {
        const response = await server.inject({
          method: 'GET',
          url: '/health',
        });

        expect(response.statusCode).toBe(500);
      } finally {
        // Restore env vars
        process.env.ALLOCATOR_ADDRESS = originalAllocator;
        process.env.SIGNING_ADDRESS = originalSigning;
      }
    });
  });
});

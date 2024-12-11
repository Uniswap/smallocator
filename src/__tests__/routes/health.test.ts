import { FastifyInstance } from 'fastify';
import { createTestServer, cleanupTestServer } from '../utils/test-server';
import { mockSupportedChainsResponse } from '../utils/graphql-mock';
import { getFinalizationThreshold } from '../../chain-config';

describe('Health Check Endpoint', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  it('should return health status and supported chains', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.payload);

    // Check basic health response properties
    expect(result.status).toBe('healthy');
    expect(result.allocatorAddress).toBe(process.env.ALLOCATOR_ADDRESS);
    expect(result.signingAddress).toBe(process.env.SIGNING_ADDRESS);
    expect(result.timestamp).toBeDefined();

    // Check supported chains data
    expect(result.supportedChains).toBeDefined();
    expect(Array.isArray(result.supportedChains)).toBe(true);

    // Verify each chain from the mock data is present with correct finalization threshold
    const mockChains =
      mockSupportedChainsResponse.allocator.supportedChains.items;
    expect(result.supportedChains).toHaveLength(mockChains.length);

    mockChains.forEach((mockChain) => {
      const resultChain = result.supportedChains.find(
        (chain: any) => chain.chainId === mockChain.chainId
      );
      expect(resultChain).toBeDefined();
      expect(resultChain?.allocatorId).toBe(mockChain.allocatorId);
      expect(resultChain?.finalizationThresholdSeconds).toBe(
        getFinalizationThreshold(mockChain.chainId)
      );
    });
  });

  it('should fail if environment variables are not set', async () => {
    // Temporarily unset required environment variables
    const originalAllocatorAddress = process.env.ALLOCATOR_ADDRESS;
    const originalSigningAddress = process.env.SIGNING_ADDRESS;
    delete process.env.ALLOCATOR_ADDRESS;
    delete process.env.SIGNING_ADDRESS;

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    // Restore environment variables
    process.env.ALLOCATOR_ADDRESS = originalAllocatorAddress;
    process.env.SIGNING_ADDRESS = originalSigningAddress;

    expect(response.statusCode).toBe(500);
    const result = JSON.parse(response.payload);
    expect(result.message).toBe('Required environment variables are not set');
  });
});

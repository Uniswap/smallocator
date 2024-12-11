import {
  graphqlClient,
  fetchAndCacheSupportedChains,
  getCachedSupportedChains,
  startSupportedChainsRefresh,
  stopSupportedChainsRefresh,
} from '../graphql';
import {
  setupGraphQLMocks,
  mockSupportedChainsResponse,
} from './utils/graphql-mock';
import { getFinalizationThreshold } from '../chain-config';

describe('GraphQL Client', () => {
  beforeEach(() => {
    // Reset mocks and cache before each test
    setupGraphQLMocks();
    // Clear any existing intervals
    stopSupportedChainsRefresh();
  });

  describe('Supported Chains Cache', () => {
    const testAllocatorAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

    it('should fetch and cache supported chains data', async () => {
      await fetchAndCacheSupportedChains(testAllocatorAddress);
      const cachedData = getCachedSupportedChains();

      expect(cachedData).toBeDefined();
      expect(Array.isArray(cachedData)).toBe(true);

      const mockChains =
        mockSupportedChainsResponse.allocator.supportedChains.items;
      expect(cachedData).toHaveLength(mockChains.length);

      mockChains.forEach((mockChain, index) => {
        expect(cachedData![index]).toEqual({
          chainId: mockChain.chainId,
          allocatorId: mockChain.allocatorId,
          finalizationThresholdSeconds: getFinalizationThreshold(
            mockChain.chainId
          ),
        });
      });
    });

    it('should refresh supported chains data on interval', async () => {
      // Setup spy on graphqlClient.request
      const requestSpy = jest.spyOn(graphqlClient, 'request');

      // Initial fetch
      await fetchAndCacheSupportedChains(testAllocatorAddress);
      expect(requestSpy).toHaveBeenCalledTimes(1);

      // Start refresh with 100ms interval
      startSupportedChainsRefresh(testAllocatorAddress, 0.1); // 100ms

      // Wait for two refresh cycles
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Should have been called at least 2 more times
      expect(requestSpy.mock.calls.length).toBeGreaterThanOrEqual(3);

      // Cleanup
      stopSupportedChainsRefresh();
      requestSpy.mockRestore();
    });

    it('should preserve cache on failed refresh', async () => {
      // Initial fetch
      await fetchAndCacheSupportedChains(testAllocatorAddress);
      const initialCache = getCachedSupportedChains();

      // Mock a failed request
      (graphqlClient as any).request = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'));

      // Attempt refresh
      await fetchAndCacheSupportedChains(testAllocatorAddress);

      // Cache should remain unchanged
      expect(getCachedSupportedChains()).toEqual(initialCache);
    });

    it('should handle stopping refresh when no interval is running', () => {
      // Should not throw error
      expect(() => stopSupportedChainsRefresh()).not.toThrow();
    });

    it('should handle multiple start/stop cycles', async () => {
      const requestSpy = jest.spyOn(graphqlClient, 'request');

      // First cycle
      startSupportedChainsRefresh(testAllocatorAddress, 0.1);
      await new Promise((resolve) => setTimeout(resolve, 150));
      stopSupportedChainsRefresh();

      const firstCount = requestSpy.mock.calls.length;

      // Second cycle
      startSupportedChainsRefresh(testAllocatorAddress, 0.1);
      await new Promise((resolve) => setTimeout(resolve, 150));
      stopSupportedChainsRefresh();

      const secondCount = requestSpy.mock.calls.length;

      // Should have more calls in second count
      expect(secondCount).toBeGreaterThan(firstCount);

      requestSpy.mockRestore();
    });
  });
});

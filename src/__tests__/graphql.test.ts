import {
  fetchAndCacheSupportedChains,
  getCachedSupportedChains,
  startSupportedChainsRefresh,
  stopSupportedChainsRefresh,
} from '../graphql';
import {
  setupGraphQLMocks,
  mockSupportedChainsResponse,
  getRequestCallCount,
  setMockToFail,
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
      // Initial fetch
      await fetchAndCacheSupportedChains(testAllocatorAddress);
      const initialCallCount = getRequestCallCount();
      expect(initialCallCount).toBe(1);

      // Start refresh with 100ms interval
      startSupportedChainsRefresh(testAllocatorAddress, 0.1); // 100ms

      // Wait for two refresh cycles
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Should have been called at least 2 more times
      const finalCallCount = getRequestCallCount();
      expect(finalCallCount).toBeGreaterThanOrEqual(3);

      // Cleanup
      stopSupportedChainsRefresh();
    });

    it('should preserve cache on failed refresh', async () => {
      // Initial fetch
      await fetchAndCacheSupportedChains(testAllocatorAddress);
      const initialCache = getCachedSupportedChains();

      // Set mock to fail on next request
      setMockToFail(true);

      // Attempt refresh
      await fetchAndCacheSupportedChains(testAllocatorAddress);

      // Cache should remain unchanged
      expect(getCachedSupportedChains()).toEqual(initialCache);

      // Reset mock
      setMockToFail(false);
    });

    it('should handle stopping refresh when no interval is running', () => {
      // Should not throw error
      expect(() => stopSupportedChainsRefresh()).not.toThrow();
    });

    it('should handle multiple start/stop cycles', async () => {
      // First cycle
      startSupportedChainsRefresh(testAllocatorAddress, 0.1);
      await new Promise((resolve) => setTimeout(resolve, 150));
      stopSupportedChainsRefresh();

      const firstCount = getRequestCallCount();

      // Second cycle
      startSupportedChainsRefresh(testAllocatorAddress, 0.1);
      await new Promise((resolve) => setTimeout(resolve, 150));
      stopSupportedChainsRefresh();

      const secondCount = getRequestCallCount();

      // Should have more calls in second count
      expect(secondCount).toBeGreaterThan(firstCount);
    });
  });
});

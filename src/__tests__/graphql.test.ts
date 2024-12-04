import {
  graphqlClient,
  getCompactDetails,
  calculateQueryTimestamps,
} from '../graphql.js';
import { getFinalizationThreshold } from '../chain-config.js';

const mockTimestampMs = 1700000000000; // Some fixed timestamp in milliseconds
const mockTimestampSec = Math.ceil(mockTimestampMs / 1000);

describe('GraphQL Functions', () => {
  let originalNow: () => number;
  let originalRequest: typeof graphqlClient.request;

  beforeEach((): void => {
    // Store original functions
    originalNow = Date.now;
    originalRequest = graphqlClient.request;

    // Mock Date.now
    Date.now = (): number => mockTimestampMs;

    // Mock request
    graphqlClient.request = async (): Promise<Record<string, unknown>> => ({
      allocator: {
        supportedChains: {
          items: [{ allocatorId: '55765469257802026776384764' }],
        },
      },
    });
  });

  afterEach((): void => {
    // Restore original functions
    Date.now = originalNow;
    graphqlClient.request = originalRequest;
  });

  it('should fetch and process compact details correctly', async (): Promise<void> => {
    const variables = {
      allocator: '0x123',
      sponsor: '0x456',
      lockId: '789',
      chainId: '10',
    };

    const result = await getCompactDetails(variables);
    expect(result).toBeDefined();
    expect(result.allocator).toBeDefined();
  });

  it('should handle missing data gracefully', async (): Promise<void> => {
    // Override mock for this test to throw an error
    graphqlClient.request = async (): Promise<never> => {
      throw new Error('GraphQL query failed');
    };

    const variables = {
      allocator: '0x123',
      sponsor: '0x456',
      lockId: '789',
      chainId: '10',
    };

    await expect(getCompactDetails(variables)).rejects.toThrow(
      'GraphQL query failed'
    );
  });

  describe('calculateQueryTimestamps', () => {
    it('should calculate correct timestamps for Optimism', (): void => {
      const chainId = '10'; // Optimism
      const { finalizationTimestamp, thresholdTimestamp } =
        calculateQueryTimestamps(chainId);

      const expectedFinalization =
        mockTimestampSec - getFinalizationThreshold(chainId);
      const expectedThreshold = mockTimestampSec - 3 * 60 * 60; // 3 hours in seconds

      expect(finalizationTimestamp).toBe(expectedFinalization);
      expect(thresholdTimestamp).toBe(expectedThreshold);
    });

    it('should calculate correct timestamps for Ethereum mainnet', (): void => {
      const chainId = '1'; // Ethereum mainnet
      const { finalizationTimestamp, thresholdTimestamp } =
        calculateQueryTimestamps(chainId);

      const expectedFinalization =
        mockTimestampSec - getFinalizationThreshold(chainId);
      const expectedThreshold = mockTimestampSec - 3 * 60 * 60; // 3 hours in seconds

      expect(finalizationTimestamp).toBe(expectedFinalization);
      expect(thresholdTimestamp).toBe(expectedThreshold);
    });
  });
});

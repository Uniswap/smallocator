import {
  graphqlClient,
  getCompactDetails,
  processCompactDetails,
} from '../graphql';
import type {
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../graphql';

describe('GraphQL Functions', () => {
  // Store original request method
  const originalRequest = graphqlClient.request;

  beforeEach(() => {
    // Replace request method with a spy
    (graphqlClient as { request: unknown }).request = async (
      _query: string,
      _variables: unknown
    ): Promise<AllocatorResponse & AccountDeltasResponse & AccountResponse> => {
      return Promise.resolve(mockResponse);
    };
  });

  afterEach(() => {
    // Restore original request method
    (graphqlClient as { request: unknown }).request = originalRequest;
  });

  const mockVariables = {
    allocator: '0x0734d56da60852a03e2aafae8a36ffd8c12b32f1',
    sponsor: '0x899ee89dbe7e74dae12e20cc255cec0d59b5d4fc',
    lockId:
      '21792518056623590435587568419860581671612179420134533156813620419438053425152',
    chainId: '10',
  };

  const mockResponse = {
    allocator: {
      supportedChains: {
        items: [
          {
            allocatorId: '55765469257802026776384764',
          },
        ],
      },
    },
    accountDeltas: {
      items: [
        {
          delta: '700000000000',
        },
        {
          delta: '400000000000',
        },
      ],
    },
    account: {
      resourceLocks: {
        items: [
          {
            withdrawalStatus: 0,
            balance: '8000000000000',
          },
        ],
      },
      claims: {
        items: [
          {
            claimHash:
              '0x2fcfd671637371ee10057d03662323b457ebd6eb38c09231cc7dd6c65ac50761',
          },
          {
            claimHash:
              '0xfa156004548126208463b1212a2bacb2a10357d211b15ea9419a41acfbabf4b7',
          },
        ],
      },
    },
  };

  it('should fetch and process compact details correctly', async () => {
    // Fetch and process the data
    const response = await getCompactDetails(mockVariables);
    const processed = processCompactDetails(response);

    // Verify the processed data
    expect(processed.allocatorId).toBe('55765469257802026776384764');
    expect(processed.totalDelta.toString()).toBe('1100000000000'); // 700000000000 + 400000000000
    expect(processed.withdrawalStatus).toBe(0);
    expect(processed.balance).toBe('8000000000000');
    expect(processed.claimHashes).toEqual([
      '0x2fcfd671637371ee10057d03662323b457ebd6eb38c09231cc7dd6c65ac50761',
      '0xfa156004548126208463b1212a2bacb2a10357d211b15ea9419a41acfbabf4b7',
    ]);
  });

  it('should handle missing data gracefully', async () => {
    const emptyResponse = {
      allocator: {
        supportedChains: {
          items: [],
        },
      },
      accountDeltas: {
        items: [],
      },
      account: {
        resourceLocks: {
          items: [],
        },
        claims: {
          items: [],
        },
      },
    };

    // Override mock response for this test
    (graphqlClient as { request: unknown }).request = async (
      _query: string,
      _variables: unknown
    ): Promise<AllocatorResponse & AccountDeltasResponse & AccountResponse> => {
      return Promise.resolve(emptyResponse);
    };

    // Fetch and process the data
    const response = await getCompactDetails(mockVariables);
    const processed = processCompactDetails(response);

    // Verify the processed data handles missing values
    expect(processed.allocatorId).toBeNull();
    expect(processed.totalDelta.toString()).toBe('0');
    expect(processed.withdrawalStatus).toBeNull();
    expect(processed.balance).toBeNull();
    expect(processed.claimHashes).toEqual([]);
  });
});

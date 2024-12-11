import { graphqlClient } from '../../graphql';

// Extract allocator ID from lockId (matches the calculation in balance.ts)
const TEST_LOCK_ID = BigInt('0x7000000000000000000000010000000000000000000000000000000000000000');
const ALLOCATOR_ID = ((TEST_LOCK_ID >> BigInt(160)) & ((BigInt(1) << BigInt(92)) - BigInt(1))).toString();

// Mock response for supported chains query
const mockSupportedChainsResponse = {
  allocator: {
    supportedChains: {
      items: [
        {
          chainId: '1',
          allocatorId: ALLOCATOR_ID,
        },
        {
          chainId: '10',
          allocatorId: ALLOCATOR_ID,
        },
        {
          chainId: '8453',
          allocatorId: ALLOCATOR_ID,
        },
      ],
    },
  },
};

// Mock response for account deltas query
const mockAccountDeltasResponse = {
  accountDeltas: {
    items: [
      {
        delta: '1000000000000000000',
      },
    ],
  },
  account: {
    resourceLocks: {
      items: [
        {
          withdrawalStatus: 0,
          balance: '2000000000000000000',
        },
      ],
    },
    claims: {
      items: [
        {
          claimHash:
            '0x1234567890123456789012345678901234567890123456789012345678901234',
        },
      ],
    },
  },
};

// Track request calls
let requestCallCount = 0;
let shouldFail = false;

// Setup GraphQL mocks
export function setupGraphQLMocks(): void {
  requestCallCount = 0;
  shouldFail = false;
  
  // Override the request method of the GraphQL client
  (graphqlClient as any).request = async (
    query: string,
    variables: Record<string, any>
  ) => {
    requestCallCount++;
    
    if (shouldFail) {
      throw new Error('Network error');
    }

    // Return appropriate mock based on the query
    if (query.includes('GetSupportedChains')) {
      return mockSupportedChainsResponse;
    }
    if (query.includes('GetDetails')) {
      return mockAccountDeltasResponse;
    }
    if (query.includes('GetAllResourceLocks')) {
      return {
        account: {
          resourceLocks: {
            items: [],
          },
        },
      };
    }
    throw new Error(`Unhandled GraphQL query: ${query}`);
  };
}

// Get the number of times request was called
export function getRequestCallCount(): number {
  return requestCallCount;
}

// Set the mock to fail on next request
export function setMockToFail(fail: boolean = true): void {
  shouldFail = fail;
}

// Export mock responses for assertions
export { mockSupportedChainsResponse, mockAccountDeltasResponse };

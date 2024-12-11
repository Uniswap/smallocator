import { graphqlClient } from '../../graphql';

// Mock response for supported chains query
const mockSupportedChainsResponse = {
  allocator: {
    supportedChains: {
      items: [
        {
          chainId: '1',
          allocatorId: '0x1234567890123456789012345678901234567890',
        },
        {
          chainId: '10',
          allocatorId: '0x2345678901234567890123456789012345678901',
        },
        {
          chainId: '8453',
          allocatorId: '0x3456789012345678901234567890123456789012',
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

// Setup GraphQL mocks
export function setupGraphQLMocks(): void {
  // Override the request method of the GraphQL client
  (graphqlClient as any).request = async (
    query: string,
    variables: Record<string, any>
  ) => {
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

// Export mock responses for assertions
export { mockSupportedChainsResponse, mockAccountDeltasResponse };

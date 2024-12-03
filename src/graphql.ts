import { GraphQLClient } from 'graphql-request';

// GraphQL endpoint from the architecture document
const INDEXER_ENDPOINT = 'https://the-compact-indexer-2.ponder-dev.com/';

// Create a singleton GraphQL client
export const graphqlClient = new GraphQLClient(INDEXER_ENDPOINT);

// Define the types for our GraphQL responses
export interface AllocatorResponse {
  allocator: {
    supportedChains: {
      items: Array<{
        allocatorId: string;
      }>;
    };
  };
}

export interface AccountDeltasResponse {
  accountDeltas: {
    items: Array<{
      delta: string;
    }>;
  };
}

export interface AccountResponse {
  account: {
    resourceLocks: {
      items: Array<{
        withdrawalStatus: number;
        balance: string;
      }>;
    };
    claims: {
      items: Array<{
        claimHash: string;
      }>;
    };
  };
}

// The main query from the architecture document
export const GET_COMPACT_DETAILS = `
  query GetDetails($allocator: String!, $sponsor: String!, $lockId: BigInt!, $chainId: BigInt!) {
    allocator(address: $allocator) {
      supportedChains(where: {chainId: $chainId}) {
        items {
          allocatorId
        }
      }
    }
    accountDeltas(where: {address: $sponsor, resourceLock: $lockId, chainId: $chainId, delta_gt: "0"}, orderBy: "blockTimestamp", orderDirection: "DESC") {
      items {
        delta
      }
    }
    account(address: $sponsor) {
      resourceLocks(where: {resourceLock: $lockId, chainId: $chainId}) {
        items {
          withdrawalStatus
          balance
        }
      }
      claims(where: {allocator: $allocator, chainId: $chainId}, orderBy: "timestamp", orderDirection: "DESC") {
        items {
          claimHash
        }
      }
    }
  }
`;

export interface CompactDetailsVariables {
  allocator: string;
  sponsor: string;
  lockId: string;
  chainId: string;
}

// Function to fetch compact details
export async function getCompactDetails(variables: CompactDetailsVariables) {
  try {
    const response = await graphqlClient.request<
      AllocatorResponse & AccountDeltasResponse & AccountResponse
    >(GET_COMPACT_DETAILS, variables);

    return response;
  } catch (error) {
    console.error('Error fetching compact details:', error);
    throw error;
  }
}

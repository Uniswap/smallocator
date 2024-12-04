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
  [key: string]: string;
}

// Function to fetch compact details
export async function getCompactDetails(
  variables: CompactDetailsVariables
): Promise<AllocatorResponse & AccountDeltasResponse & AccountResponse> {
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

export interface ProcessedCompactDetails {
  totalDelta: bigint;
  allocatorId: string | null;
  withdrawalStatus: number | null;
  balance: string | null;
  claimHashes: string[];
}

export function processCompactDetails(
  response: AllocatorResponse & AccountDeltasResponse & AccountResponse
): ProcessedCompactDetails {
  // Extract allocatorId (may not be present if no supported chains found)
  const allocatorId =
    response.allocator.supportedChains.items[0]?.allocatorId ?? null;

  // Sum up all deltas
  const totalDelta = response.accountDeltas.items.reduce(
    (sum, item) => sum + BigInt(item.delta),
    BigInt(0)
  );

  // Extract withdrawal status and balance (may not be present if no resource locks found)
  const resourceLock = response.account.resourceLocks.items[0];
  const withdrawalStatus = resourceLock?.withdrawalStatus ?? null;
  const balance = resourceLock?.balance ?? null;

  // Extract all claim hashes
  const claimHashes = response.account.claims.items.map(
    (item) => item.claimHash
  );

  return {
    totalDelta,
    allocatorId,
    withdrawalStatus,
    balance,
    claimHashes,
  };
}

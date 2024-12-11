import { GraphQLClient } from 'graphql-request';
import { getFinalizationThreshold } from './chain-config';

// GraphQL endpoint from environment
const INDEXER_ENDPOINT = process.env.INDEXER_URL
  ? `${process.env.INDEXER_URL.replace(/\/$/, '')}/graphql`
  : 'http://localhost:4000/graphql';

// Create a singleton GraphQL client
export const graphqlClient = new GraphQLClient(INDEXER_ENDPOINT);

// Store supported chains data in memory
let supportedChainsCache: Array<{
  chainId: string;
  allocatorId: string;
  finalizationThresholdSeconds: number;
}> | null = null;

// Define the types for our GraphQL responses
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

export interface SupportedChainsResponse {
  allocator: {
    supportedChains: {
      items: Array<{
        chainId: string;
        allocatorId: string;
      }>;
    };
  };
}

export interface AllResourceLocksResponse {
  account: {
    resourceLocks: {
      items: Array<{
        chainId: string;
        resourceLock: {
          lockId: string;
          allocatorAddress: string;
        };
      }>;
    };
  };
}

// Query to get all supported chains
export const GET_SUPPORTED_CHAINS = `
  query GetSupportedChains($allocator: String!) {
    allocator(address: $allocator) {
      supportedChains {
        items {
          chainId
          allocatorId
        }
      }
    }
  }
`;

// Function to fetch and cache supported chains
export async function fetchAndCacheSupportedChains(
  allocatorAddress: string
): Promise<void> {
  const response = await graphqlClient.request<SupportedChainsResponse>(
    GET_SUPPORTED_CHAINS,
    { allocator: allocatorAddress.toLowerCase() }
  );

  supportedChainsCache = response.allocator.supportedChains.items.map(
    (item) => ({
      chainId: item.chainId,
      allocatorId: item.allocatorId,
      finalizationThresholdSeconds: getFinalizationThreshold(item.chainId),
    })
  );
}

// Function to get cached supported chains
export function getCachedSupportedChains(): Array<{
  chainId: string;
  allocatorId: string;
  finalizationThresholdSeconds: number;
}> | null {
  return supportedChainsCache;
}

// Calculate timestamps for GraphQL query
export function calculateQueryTimestamps(chainId: string): {
  finalizationTimestamp: number;
  thresholdTimestamp: number;
} {
  const currentTimeSeconds = Math.ceil(Date.now() / 1000);
  const finalizationThreshold = getFinalizationThreshold(chainId);

  return {
    // Current time minus finalization threshold
    finalizationTimestamp: currentTimeSeconds - finalizationThreshold,
    // Current time minus 3 hours (in seconds)
    thresholdTimestamp: currentTimeSeconds - 3 * 60 * 60,
  };
}

// The main query from the architecture document
export const GET_COMPACT_DETAILS = `
  query GetDetails(
    $allocator: String!,
    $sponsor: String!,
    $lockId: BigInt!,
    $chainId: BigInt!,
    $finalizationTimestamp: BigInt!,
    $thresholdTimestamp: BigInt!
  ) {
    accountDeltas(
      where: {
        address: $sponsor,
        resourceLock: $lockId,
        chainId: $chainId,
        delta_gt: "0",
        blockTimestamp_gt: $finalizationTimestamp
      },
      orderBy: "blockTimestamp",
      orderDirection: "DESC"
    ) {
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
      claims(
        where: {
          allocator: $allocator,
          chainId: $chainId,
          timestamp_gt: $thresholdTimestamp
        },
        orderBy: "timestamp",
        orderDirection: "DESC"
      ) {
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
  finalizationTimestamp: string;
  thresholdTimestamp: string;
  [key: string]: string; // Add index signature for GraphQL client
}

// Base variables without timestamps
export type CompactDetailsBaseVariables = Omit<
  CompactDetailsVariables,
  'finalizationTimestamp' | 'thresholdTimestamp'
>;

// Function to fetch compact details
export async function getCompactDetails({
  allocator,
  sponsor,
  lockId,
  chainId,
}: {
  allocator: string;
  sponsor: string;
  lockId: string;
  chainId: string;
}): Promise<AccountDeltasResponse & AccountResponse> {
  const { finalizationTimestamp, thresholdTimestamp } =
    calculateQueryTimestamps(chainId);

  return graphqlClient.request(GET_COMPACT_DETAILS, {
    allocator: allocator.toLowerCase(),
    sponsor: sponsor.toLowerCase(),
    lockId,
    chainId,
    finalizationTimestamp: finalizationTimestamp.toString(),
    thresholdTimestamp: thresholdTimestamp.toString(),
  });
}

export async function getAllResourceLocks(
  sponsor: string
): Promise<AllResourceLocksResponse> {
  return graphqlClient.request(
    `
    query GetAllResourceLocks($sponsor: String!) {
      account(address: $sponsor) {
        resourceLocks {
          items {
            chainId
            resourceLock {
              lockId
              allocatorAddress
            }
          }
        }
      }
    }
    `,
    { sponsor: sponsor.toLowerCase() }
  );
}

export interface ProcessedCompactDetails {
  totalDelta: bigint;
  allocatorId: string | null;
  withdrawalStatus: number | null;
  balance: string | null;
  claimHashes: string[];
}

export function processCompactDetails(
  response: AccountDeltasResponse & AccountResponse,
  chainId: string
): ProcessedCompactDetails {
  // Get allocatorId from cache
  const chainConfig = supportedChainsCache?.find(
    (chain) => chain.chainId === chainId
  );
  const allocatorId = chainConfig?.allocatorId ?? null;

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

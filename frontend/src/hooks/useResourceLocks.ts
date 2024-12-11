import { useAccount } from 'wagmi';
import { useGraphQLQuery } from './useGraphQL';

const RESOURCE_LOCKS_QUERY = `
  query GetResourceLocks(
    $address: String!
  ) {
    account(address: $address) {
      resourceLocks(
        orderBy: "balance"
        orderDirection: "DESC"
      ) {
        items {
          chainId
          resourceLock {
            lockId
            allocator {
              account: allocatorAddress
            }
            token {
              tokenAddress
              name
              symbol
              decimals
            }
            resetPeriod
            isMultichain
            totalSupply
          }
          balance
          withdrawalStatus
          withdrawableAt
        }
      }
    }
  }
`;

export interface Token {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface ResourceLock {
  lockId: string;
  allocator: {
    account: string;
  };
  token: Token;
  resetPeriod: number;
  isMultichain: boolean;
  totalSupply: string;
}

export interface ResourceLockBalance {
  chainId: string;
  resourceLock: ResourceLock;
  balance: string;
  withdrawalStatus: number;
  withdrawableAt: string;
}

interface ResourceLockConnection {
  items: ResourceLockBalance[];
}

interface Account {
  resourceLocks: ResourceLockConnection;
}

interface ResourceLocksResponse {
  account: Account | null;
}

interface UseResourceLocksResult {
  data: Account;
  isLoading: boolean;
  error: Error | null;
}

export function useResourceLocks(): UseResourceLocksResult {
  const { address } = useAccount();

  const { data, isLoading, error } = useGraphQLQuery<ResourceLocksResponse>(
    ['resourceLocks', address ?? ''],
    RESOURCE_LOCKS_QUERY,
    {
      address: address?.toLowerCase() ?? '',
    },
    {
      enabled: !!address,
      pollInterval: 1010, // Poll every ~1 second like in the-compact-ui
    }
  );

  return {
    data: data?.account ?? { resourceLocks: { items: [] } },
    isLoading,
    error,
  };
}

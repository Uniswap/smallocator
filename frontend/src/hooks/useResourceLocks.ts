import { useAccount } from 'wagmi'
import { useGraphQLQuery } from './useGraphQL'

const RESOURCE_LOCKS_QUERY = `
  query GetResourceLocks(
    $address: String!, 
    $chainId: BigInt!
  ) {
    account(address: $address) {
      resourceLocks(
        where: {chainId: $chainId}
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
        }
      }
    }
  }
`

interface Token {
  tokenAddress: string
  name: string
  symbol: string
  decimals: number
}

interface ResourceLock {
  lockId: string
  allocator: {
    account: string
  }
  token: Token
  resetPeriod: number
  isMultichain: boolean
  totalSupply: string
}

interface ResourceLockBalance {
  chainId: string
  resourceLock: ResourceLock
  balance: string
}

interface ResourceLockConnection {
  items: ResourceLockBalance[]
}

interface Account {
  resourceLocks: ResourceLockConnection
}

interface ResourceLocksResponse {
  account: Account | null
}

interface UseResourceLocksResult {
  data: Account
  isLoading: boolean
  error: Error | null
}

export function useResourceLocks(): UseResourceLocksResult {
  const { address, chain } = useAccount()

  // Convert chain ID to numeric string for GraphQL BigInt
  const chainId = (chain?.id ?? 1).toString()

  const { data, isLoading, error } = useGraphQLQuery<ResourceLocksResponse>(
    ['resourceLocks', address ?? '', chainId],
    RESOURCE_LOCKS_QUERY,
    { 
      address: address?.toLowerCase() ?? '',
      chainId: chainId,
    },
    {
      enabled: !!address,
    }
  )

  return {
    data: data?.account ?? { resourceLocks: { items: [] } },
    isLoading,
    error,
  }
}

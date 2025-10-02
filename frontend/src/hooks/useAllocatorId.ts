import { useGraphQLQuery } from './useGraphQL';
import { useChainId } from 'wagmi';

interface AllocatorIdResponse {
  allocator: {
    supportedChains: {
      items: Array<{
        allocatorId: string;
      }>;
    };
  };
}

const ALLOCATOR_ID_QUERY = `
  query GetAllocatorId($allocatorAddress: String!, $chainId: BigInt!) {
    allocator(address: $allocatorAddress) {
      supportedChains(where: {chainId: $chainId}) {
        items {
          allocatorId
        }
      }
    }
  }
`;

export function useAllocatorId(allocatorAddress?: string) {
  const chainId = useChainId();

  const { data, isLoading, error } = useGraphQLQuery<AllocatorIdResponse>(
    ['allocatorId', allocatorAddress || '', chainId.toString()],
    ALLOCATOR_ID_QUERY,
    {
      allocatorAddress: allocatorAddress || '',
      chainId: chainId.toString(),
    },
    {
      enabled: !!allocatorAddress,
      pollInterval: 10000, // Poll every 10 seconds since this doesn't change often
      staleTime: 60000, // Consider data stale after 1 minute
    }
  );

  const allocatorId = data?.allocator?.supportedChains?.items?.[0]?.allocatorId;

  return {
    allocatorId,
    isLoading,
    error,
  };
}

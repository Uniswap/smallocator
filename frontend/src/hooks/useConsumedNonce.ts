import { useGraphQLQuery } from './useGraphQL';

interface ConsumedNonceResponse {
  consumedNonce: {
    blockNumber: string | null;
  } | null;
}

const CONSUMED_NONCE_QUERY = `
  query GetConsumedNonce($allocatorAddress: String!, $chainId: BigInt!, $nonce: BigInt!) {
    consumedNonce(allocator: $allocatorAddress, chainId: $chainId, nonce: $nonce) {
      blockNumber
    }
  }
`;

export function useConsumedNonce(
  allocatorAddress?: string,
  chainId?: string,
  nonce?: string
) {
  const { data, isLoading, error } = useGraphQLQuery<ConsumedNonceResponse>(
    ['consumedNonce', allocatorAddress || '', chainId || '', nonce || ''],
    CONSUMED_NONCE_QUERY,
    {
      allocatorAddress: allocatorAddress || '',
      chainId: chainId || '0',
      nonce: nonce || '0',
    },
    {
      enabled: !!allocatorAddress && !!chainId && !!nonce,
      pollInterval: 5000, // Poll every 5 seconds to check for updates
      staleTime: 3000, // Consider data stale after 3 seconds
    }
  );

  // Nonce is consumed if blockNumber is not null
  const isConsumed =
    data?.consumedNonce?.blockNumber !== null &&
    data?.consumedNonce?.blockNumber !== undefined;

  return {
    isConsumed,
    blockNumber: data?.consumedNonce?.blockNumber,
    isLoading,
    error,
  };
}

import { useCallback } from 'react';
import { useNotification } from './useNotification';
import { useAllocatorAPI } from './useAllocatorAPI';

interface RequestAllocationParams {
  chainId: string;
  compact: {
    arbiter: string;
    sponsor: string;
    expires: string;
    id: string;
    amount: string;
    nonce?: string | null;
    witnessTypeString?: string | null;
    witnessHash?: string | null;
  };
}

interface AllocationResponse {
  hash: string;
  signature: string;
  nonce: string;
}

export function useRequestAllocation() {
  const { showNotification } = useNotification();
  const { createAllocation } = useAllocatorAPI();

  const requestAllocation = useCallback(
    async (
      params: RequestAllocationParams,
      sessionToken: string
    ): Promise<AllocationResponse> => {
      try {
        // Create API params, preserving any witness fields if present
        const apiParams = {
          chainId: params.chainId,
          compact: {
            arbiter: params.compact.arbiter,
            sponsor: params.compact.sponsor,
            expires: params.compact.expires,
            id: params.compact.id,
            amount: params.compact.amount,
            // If nonce is undefined, use null
            nonce:
              params.compact.nonce === undefined ? null : params.compact.nonce,
            ...(params.compact.witnessTypeString && {
              witnessTypeString: params.compact.witnessTypeString,
            }),
            ...(params.compact.witnessHash && {
              witnessHash: params.compact.witnessHash,
            }),
          },
        };

        const response = await createAllocation(sessionToken, apiParams);

        // The API response should include the nonce in the response
        // If not, we'll throw an error since we need it
        if (!('nonce' in response)) {
          throw new Error('Server response missing required nonce field');
        }

        return response as AllocationResponse;
      } catch (error) {
        console.error('Request allocation error:', error);
        showNotification({
          type: 'error',
          title: 'Allocation Request Failed',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to request allocation',
        });
        throw error;
      }
    },
    [createAllocation, showNotification]
  );

  return {
    requestAllocation,
  };
}

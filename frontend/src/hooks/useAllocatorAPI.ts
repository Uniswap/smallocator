import { useState, useEffect } from 'react';

interface HealthCheckResponse {
  status: string;
  allocatorAddress: string;
  signingAddress: string;
  timestamp: string;
  chainConfig: {
    defaultFinalizationThresholdSeconds: number;
    supportedChains: Array<{
      chainId: string;
      finalizationThresholdSeconds: number;
    }>;
  };
}

interface CompactRequest {
  chainId: string;
  compact: {
    arbiter: string;
    sponsor: string;
    nonce: string | null;
    expires: string;
    id: string;
    amount: string;
    witnessTypeString?: string;
    witnessHash?: string;
  };
}

interface CompactResponse {
  hash: string;
  signature: string;
}

export function useAllocatorAPI() {
  const [allocatorAddress, setAllocatorAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealthCheck = async () => {
      try {
        const response = await fetch('/health');
        if (!response.ok) {
          throw new Error('Health check failed');
        }
        const data: HealthCheckResponse = await response.json();
        setAllocatorAddress(data.allocatorAddress);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch allocator address'
        );
        setAllocatorAddress(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealthCheck();
  }, []);

  const createAllocation = async (
    sessionToken: string,
    request: CompactRequest
  ): Promise<CompactResponse> => {
    const response = await fetch('/compact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionToken,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        errorData.error || `Failed to create allocation: ${response.statusText}`
      );
    }

    return response.json();
  };

  const getResourceLockDecimals = async (
    chainId: string,
    lockId: string
  ): Promise<number> => {
    try {
      // Query the indexer for resource lock details including token decimals
      const response = await fetch(`/resourceLock/${chainId}/${lockId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch resource lock details');
      }
      const data = await response.json();
      return data.token?.decimals || 18; // Default to 18 if not found
    } catch (err) {
      console.error('Error fetching resource lock decimals:', err);
      return 18; // Default to 18 decimals on error
    }
  };

  return {
    allocatorAddress,
    isLoading,
    error,
    createAllocation,
    getResourceLockDecimals,
  };
}

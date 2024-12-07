import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useResourceLocks } from './useResourceLocks';
import { formatUnits } from 'viem';

interface Token {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface ResourceLock {
  resetPeriod: number;
  isMultichain: boolean;
}

interface Balance {
  chainId: string;
  lockId: string;
  allocatableBalance: string;
  allocatedBalance: string;
  balanceAvailableToAllocate: string;
  withdrawalStatus: number;
  withdrawableAt: string;
  // Token details from indexer
  token?: Token;
  // Resource lock details from indexer
  resourceLock?: ResourceLock;
  // Formatted balances using token decimals
  formattedAllocatableBalance?: string;
  formattedAllocatedBalance?: string;
  formattedAvailableBalance?: string;
}

interface UseBalancesResult {
  balances: Balance[];
  error: string | null;
  isLoading: boolean;
}

interface ResourceLockItem {
  chainId: string;
  resourceLock: {
    lockId: string;
    token: Token;
    resetPeriod: number;
    isMultichain: boolean;
  };
}

export function useBalances(): UseBalancesResult {
  const { address, isConnected } = useAccount();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isFetchingRef = useRef(false);

  // Get resource lock details from indexer
  const {
    data: resourceLocksData,
    error: resourceLocksError,
    isLoading: resourceLocksLoading,
  } = useResourceLocks();

  const fetchBalances = useCallback(async (): Promise<void> => {
    if (!isConnected || !address || isFetchingRef.current) return;

    isFetchingRef.current = true;

    try {
      const sessionId = localStorage.getItem(`session-${address}`);
      if (!sessionId) {
        throw new Error('No session ID found');
      }

      const response = await fetch('/balances', {
        headers: {
          'x-session-id': sessionId,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch balances.');

      const data = await response.json();

      // Only update state if data has actually changed
      setBalances((prevBalances) => {
        const newBalances = data.balances.map((balance: Balance) => {
          // Find matching resource lock from indexer data
          const resourceLock = resourceLocksData?.resourceLocks.items.find(
            (item: ResourceLockItem) =>
              item.resourceLock.lockId === balance.lockId &&
              item.chainId === balance.chainId
          );

          if (resourceLock) {
            const token = resourceLock.resourceLock.token;
            const decimals = token.decimals;

            return {
              ...balance,
              token,
              resourceLock: {
                resetPeriod: resourceLock.resourceLock.resetPeriod,
                isMultichain: resourceLock.resourceLock.isMultichain,
              },
              formattedAllocatableBalance: formatUnits(
                BigInt(balance.allocatableBalance),
                decimals
              ),
              formattedAllocatedBalance: formatUnits(
                BigInt(balance.allocatedBalance),
                decimals
              ),
              formattedAvailableBalance: formatUnits(
                BigInt(balance.balanceAvailableToAllocate),
                decimals
              ),
            };
          }

          return balance;
        });

        const hasChanged =
          JSON.stringify(prevBalances) !== JSON.stringify(newBalances);
        return hasChanged ? newBalances : prevBalances;
      });

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      isFetchingRef.current = false;
    }
  }, [isConnected, address, resourceLocksData]);

  useEffect(() => {
    // Initial load should show loading state
    if (isConnected && address) {
      setIsLoading(true);
      void fetchBalances().finally(() => setIsLoading(false));
    }

    // Set up polling interval
    const intervalId = setInterval(() => void fetchBalances(), 1000); // Poll every second

    // Cleanup on unmount or address change
    return () => {
      clearInterval(intervalId);
      isFetchingRef.current = false;
    };
  }, [fetchBalances, isConnected, address]);

  // Set error from resource locks if present
  useEffect(() => {
    if (resourceLocksError) {
      setError(
        resourceLocksError instanceof Error
          ? resourceLocksError.message
          : 'Failed to fetch resource locks'
      );
    }
  }, [resourceLocksError]);

  return {
    balances,
    error,
    isLoading: isLoading || resourceLocksLoading,
  };
}

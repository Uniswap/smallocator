import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  token?: Token;
  resourceLock?: ResourceLock;
  formattedAllocatableBalance?: string;
  formattedAllocatedBalance?: string;
  formattedAvailableBalance?: string;
}

interface UseBalancesResult {
  balances: Balance[];
  error: string | null;
  isLoading: boolean;
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
    const shouldSetLoading = !balances.length; // Only show loading on initial fetch

    try {
      if (shouldSetLoading) setIsLoading(true);

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
            (item) =>
              item.resourceLock.lockId === balance.lockId &&
              item.chainId === balance.chainId
          );

          if (!resourceLock) return balance;

          const token = resourceLock.resourceLock.token;
          const decimals = token.decimals;

          // Create new balance object with all fields
          const newBalance = {
            ...balance,
            withdrawalStatus: resourceLock.withdrawalStatus,
            withdrawableAt: resourceLock.withdrawableAt,
            token: {
              tokenAddress: token.tokenAddress,
              name: token.name,
              symbol: token.symbol,
              decimals: decimals,
            },
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

          // Find matching previous balance for comparison
          const prevBalance = prevBalances.find(
            (prev) =>
              prev.lockId === balance.lockId && prev.chainId === balance.chainId
          );

          if (!prevBalance) return newBalance;

          // Check if any important fields have changed
          const hasChanged =
            newBalance.allocatableBalance !== prevBalance.allocatableBalance ||
            newBalance.allocatedBalance !== prevBalance.allocatedBalance ||
            newBalance.balanceAvailableToAllocate !==
              prevBalance.balanceAvailableToAllocate ||
            newBalance.withdrawalStatus !== prevBalance.withdrawalStatus ||
            newBalance.withdrawableAt !== prevBalance.withdrawableAt;

          return hasChanged ? newBalance : prevBalance;
        });

        // If array lengths are different, definitely update
        if (prevBalances.length !== newBalances.length) return newBalances;

        // Check if any balances have changed
        const hasAnyBalanceChanged = newBalances.some(
          (newBalance: Balance, index: number) =>
            newBalance !== prevBalances[index]
        );

        return hasAnyBalanceChanged ? newBalances : prevBalances;
      });

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      if (shouldSetLoading) setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isConnected, address, resourceLocksData, balances.length]);

  useEffect(() => {
    // Initial fetch
    if (isConnected && address) {
      void fetchBalances();
    }

    // Set up polling interval
    const intervalId = setInterval(() => void fetchBalances(), 1000); // Poll every second for quick updates

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

  return useMemo(
    () => ({
      balances,
      error,
      isLoading: isLoading || resourceLocksLoading,
    }),
    [balances, error, isLoading, resourceLocksLoading]
  );
}

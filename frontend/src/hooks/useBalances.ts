import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';

interface Balance {
  chainId: string;
  lockId: string;
  allocatableBalance: string;
  allocatedBalance: string;
  balanceAvailableToAllocate: string;
  withdrawalStatus: number;
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

  const fetchBalances = useCallback(async () => {
    if (!isConnected || !address || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    try {
      const sessionId = localStorage.getItem(`session-${address}`);
      if (!sessionId) {
        throw new Error('No session ID found');
      }
      
      const response = await fetch('/balances', {
        headers: {
          'x-session-id': sessionId
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch balances.');
      
      const data = await response.json();
      
      // Only update state if data has actually changed
      setBalances(prevBalances => {
        const newBalances = data.balances;
        const hasChanged = JSON.stringify(prevBalances) !== JSON.stringify(newBalances);
        return hasChanged ? newBalances : prevBalances;
      });
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      isFetchingRef.current = false;
    }
  }, [isConnected, address]);

  useEffect(() => {
    // Initial load should show loading state
    if (isConnected && address) {
      setIsLoading(true);
      fetchBalances().finally(() => setIsLoading(false));
    }

    // Set up polling interval
    const intervalId = setInterval(fetchBalances, 5000);

    // Cleanup on unmount or address change
    return () => {
      clearInterval(intervalId);
      isFetchingRef.current = false;
    };
  }, [fetchBalances, isConnected, address]);

  return { balances, error, isLoading };
}

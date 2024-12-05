import { useState, useEffect } from 'react';

interface Balance {
  chainId: string;
  lockId: string;
  allocatableBalance: string;
  allocatedBalance: string;
  balanceAvailableToAllocate: string;
  withdrawalStatus: number;
}

export function BalanceDisplay() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalances() {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/balances');
        if (!response.ok) throw new Error('Failed to fetch balances');
        
        const data = await response.json();
        setBalances(data.balances);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balances');
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
  }, []);

  return (
    <div>
      {loading && <p>Loading balances...</p>}
      {error && <p>Error: {error}</p>}
      {balances.length === 0 && !loading && <p>No balances found</p>}
      {balances.map((balance) => (
        <div key={`${balance.chainId}-${balance.lockId}`}>
          <h2>Chain {balance.chainId} - Lock {balance.lockId}</h2>
          <p>Allocatable Balance: {balance.allocatableBalance}</p>
          <p>Allocated Balance: {balance.allocatedBalance}</p>
          <p>Available to Allocate: {balance.balanceAvailableToAllocate}</p>
          <p>Withdrawal Status: {balance.withdrawalStatus}</p>
        </div>
      ))}
    </div>
  );
}

import { useAccount } from 'wagmi';
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
  const { isConnected } = useAccount();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalances() {
      if (!isConnected) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
          throw new Error('No session ID found');
        }
        
        const response = await fetch('/balances', {
          headers: {
            'x-session-id': sessionId
          }
        });
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
  }, [isConnected]);

  if (!isConnected) return null;
  
  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm">
        <p className="text-gray-600">Loading balances...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm">
        <p className="text-gray-600">No balances found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {balances.map((balance) => (
        <div key={`${balance.chainId}-${balance.lockId}`} className="p-6 bg-white rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            Chain {balance.chainId} - Lock {balance.lockId}
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Allocatable Balance</p>
              <p className="text-lg font-medium">{balance.allocatableBalance}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Allocated Balance</p>
              <p className="text-lg font-medium">{balance.allocatedBalance}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Available to Allocate</p>
              <p className="text-lg font-medium">{balance.balanceAvailableToAllocate}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Withdrawal Status</p>
              <p className="text-lg font-medium">{balance.withdrawalStatus}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

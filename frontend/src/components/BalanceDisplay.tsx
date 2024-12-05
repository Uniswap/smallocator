import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';

interface Balance {
  allocatableBalance: string;
  allocatedBalance: string;
  withdrawalStatus: number;
}

interface BalanceDisplayProps {
  chainId: string;
  lockId: string;
}

export function BalanceDisplay({ chainId, lockId }: BalanceDisplayProps) {
  const { isConnected } = useAccount();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      if (!isConnected) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/balance/${chainId}/${lockId}`);
        if (!response.ok) throw new Error('Failed to fetch balance');
        
        const data = await response.json();
        setBalance(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, [chainId, lockId, isConnected]);

  if (!isConnected) return null;
  
  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm">
        <p className="text-gray-600">Loading balance...</p>
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

  if (!balance) return null;

  const balanceAvailable = balance.withdrawalStatus === 0 && 
    BigInt(balance.allocatableBalance) > BigInt(balance.allocatedBalance)
    ? (BigInt(balance.allocatableBalance) - BigInt(balance.allocatedBalance)).toString()
    : "0";

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Balance Information</h2>
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
          <p className="text-lg font-medium">{balanceAvailable}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Withdrawal Status</p>
          <p className="text-lg font-medium">{balance.withdrawalStatus}</p>
        </div>
      </div>
    </div>
  );
}

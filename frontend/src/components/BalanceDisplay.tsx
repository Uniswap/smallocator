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
  const { address, isConnected } = useAccount();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalances() {
      if (!isConnected || !address) return;
      
      setLoading(true);
      setError(null);
      
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
        setBalances(data.balances);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balances');
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();

    // Set up polling interval
    const intervalId = setInterval(fetchBalances, 5000);

    // Cleanup on unmount or address change
    return () => clearInterval(intervalId);
  }, [isConnected, address]);

  if (!isConnected) return null;
  
  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff00]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-400">Error Loading Balances</h3>
            <div className="mt-2 text-sm text-red-400/80">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-sm">No balances found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-800 pb-4">
        <h2 className="text-xl font-semibold text-gray-100">Your Balances</h2>
        <p className="mt-1 text-sm text-gray-400">
          View your resource lock balances across different chains.
        </p>
      </div>

      <div className="space-y-4">
        {balances.map((balance) => (
          <div 
            key={`${balance.chainId}-${balance.lockId}`} 
            className="p-4 bg-gray-800 rounded-lg"
          >
            <div className="flex justify-between items-baseline mb-4">
              <div className="text-sm font-medium text-gray-300">Chain {balance.chainId}</div>
              <div className="text-xs text-gray-400">Lock ID: {balance.lockId}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400">Allocatable Balance</div>
                <div className="mt-1 text-[#00ff00] font-mono">
                  {balance.allocatableBalance}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Allocated Balance</div>
                <div className="mt-1 text-[#00ff00] font-mono">
                  {balance.allocatedBalance}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Available to Allocate</div>
                <div className="mt-1 text-[#00ff00] font-mono">
                  {balance.balanceAvailableToAllocate}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Withdrawal Status</div>
                <div className="mt-1">
                  <span className={`px-2 py-1 text-xs rounded ${
                    balance.withdrawalStatus === 0
                      ? 'bg-[#00ff00]/10 text-[#00ff00]'
                      : 'bg-orange-500/10 text-orange-500'
                  }`}>
                    {balance.withdrawalStatus === 0 ? 'Active' : 'Withdrawal Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

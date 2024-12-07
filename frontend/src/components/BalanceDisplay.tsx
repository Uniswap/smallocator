import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useBalances } from '../hooks/useBalances';
import { useResourceLocks } from '../hooks/useResourceLocks';
import { formatUnits } from 'viem';
import { Transfer } from './Transfer';
import { InitiateForcedWithdrawalDialog } from './InitiateForcedWithdrawalDialog';
import { ForcedWithdrawalDialog } from './ForcedWithdrawalDialog';

// Interface for the selected lock data needed by ForcedWithdrawalDialog
interface SelectedLockData {
  chainId: string;
  lockId: string;
  balance: string;
  tokenName: string;
  decimals: number;
  symbol: string;
}

// Helper function to format time remaining
function formatTimeRemaining(expiryTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiryTimestamp - now;

  if (diff <= 0) return 'Ready';

  const days = Math.floor(diff / (24 * 60 * 60));
  const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((diff % (60 * 60)) / 60);
  const seconds = diff % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Utility function to format reset period
const formatResetPeriod = (seconds: number): string => {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  return `${Math.floor(seconds / 86400)} days`;
};

export function BalanceDisplay(): JSX.Element | null {
  const { isConnected } = useAccount();
  const { balances, error, isLoading } = useBalances();
  const { data: resourceLocksData, isLoading: resourceLocksLoading } =
    useResourceLocks();
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [selectedLockId, setSelectedLockId] = useState<string>('');
  const [selectedLock, setSelectedLock] = useState<SelectedLockData | null>(
    null
  );
  const [, setUpdateTrigger] = useState(0);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setUpdateTrigger((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isConnected) return null;

  if (isLoading || resourceLocksLoading) {
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
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-400">
              Error Loading Balances
            </h3>
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
        {balances.map((balance) => {
          // Find matching resource lock from indexer data
          const resourceLock = resourceLocksData?.resourceLocks.items.find(
            (item) =>
              item.resourceLock.lockId === balance.lockId &&
              item.chainId === balance.chainId
          );

          const now = Math.floor(Date.now() / 1000);
          const withdrawableAt = parseInt(balance.withdrawableAt || '0');
          const canExecuteWithdrawal =
            balance.withdrawalStatus === 2 && withdrawableAt <= now;
          const withdrawalTimeRemaining = formatTimeRemaining(withdrawableAt);

          return (
            <div
              key={`${balance.chainId}-${balance.lockId}`}
              className="p-4 bg-gray-800 rounded-lg"
            >
              {/* Header with Chain, Token Info, and Lock ID */}
              <div className="flex justify-between items-baseline mb-4">
                <div className="text-sm font-medium text-gray-300">
                  Chain {balance.chainId}
                  {balance.token && (
                    <span className="ml-2 text-gray-400">
                      {balance.token.name} ({balance.token.symbol})
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  Lock ID: {balance.lockId}
                </div>
              </div>

              {/* Resource Lock Properties */}
              <div className="flex gap-2 mb-4">
                {balance.resourceLock?.resetPeriod &&
                  balance.resourceLock.resetPeriod > 0 && (
                    <span className="px-2 py-1 text-xs bg-[#00ff00]/10 text-[#00ff00] rounded">
                      Reset Period:{' '}
                      {formatResetPeriod(balance.resourceLock.resetPeriod)}
                    </span>
                  )}
                {balance.resourceLock?.isMultichain && (
                  <span className="px-2 py-1 text-xs bg-[#00ff00]/10 text-[#00ff00] rounded">
                    Multichain
                  </span>
                )}
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    balance.withdrawalStatus === 0
                      ? 'bg-[#00ff00]/10 text-[#00ff00]'
                      : 'bg-orange-500/10 text-orange-500'
                  }`}
                >
                  {balance.withdrawalStatus === 0
                    ? 'Active'
                    : withdrawableAt <= now
                      ? 'Withdrawal Ready'
                      : `Withdrawal Pending (${withdrawalTimeRemaining})`}
                </span>
              </div>

              {/* Balances Grid */}
              <div className="grid grid-cols-12 gap-4">
                {/* Left side - Current, Allocatable, and Allocated */}
                <div className="col-span-8 grid grid-cols-3 gap-4 pr-4 border-r border-gray-700">
                  <div>
                    <div className="text-xs text-gray-400">Current</div>
                    <div className="mt-1 text-sm text-[#00ff00] font-mono">
                      {resourceLock &&
                        formatUnits(
                          BigInt(resourceLock.balance),
                          resourceLock.resourceLock.token.decimals
                        )}
                      {balance.token?.symbol && (
                        <span className="ml-1 text-gray-400">
                          {balance.token.symbol}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400">Allocatable</div>
                    <div className="mt-1 text-sm text-[#00ff00] font-mono">
                      {balance.formattedAllocatableBalance ||
                        balance.allocatableBalance}
                      {balance.token?.symbol && (
                        <span className="ml-1 text-gray-400">
                          {balance.token.symbol}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400">Allocated</div>
                    <div className="mt-1 text-sm text-[#00ff00] font-mono">
                      {balance.formattedAllocatedBalance ||
                        balance.allocatedBalance}
                      {balance.token?.symbol && (
                        <span className="ml-1 text-gray-400">
                          {balance.token.symbol}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side - Emphasized available to allocate */}
                <div className="col-span-4 flex flex-col justify-center">
                  <div className="text-xs text-gray-400">
                    Available to Allocate
                  </div>
                  <div className="mt-1 text-lg font-bold text-[#00ff00] font-mono">
                    {balance.formattedAvailableBalance ||
                      balance.balanceAvailableToAllocate}
                    {balance.token?.symbol && (
                      <span className="ml-1 text-gray-400 text-sm">
                        {balance.token.symbol}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Transfer and Withdrawal Actions */}
              {resourceLock && (
                <div className="mt-4 border-t border-gray-700 pt-4">
                  <div className="flex gap-2">
                    <Transfer
                      key={`${balance.chainId}-${balance.lockId}`}
                      chainId={balance.chainId}
                      withdrawalStatus={balance.withdrawalStatus}
                      onForceWithdraw={() => {
                        setSelectedLockId(balance.lockId);
                        setIsWithdrawalDialogOpen(true);
                      }}
                      onDisableForceWithdraw={() => {
                        setSelectedLockId(balance.lockId);
                        setSelectedLock(null);
                      }}
                    />
                    {canExecuteWithdrawal && (
                      <button
                        onClick={() => {
                          setSelectedLockId(balance.lockId);
                          setSelectedLock({
                            chainId: balance.chainId,
                            lockId: balance.lockId,
                            balance: resourceLock?.balance || '0',
                            tokenName: balance.token?.name || 'Token',
                            decimals: balance.token?.decimals || 18,
                            symbol: balance.token?.symbol || '',
                          });
                          setIsExecuteDialogOpen(true);
                        }}
                        className="mt-2 py-2 px-4 bg-[#DC2626] text-white rounded-lg font-medium hover:opacity-90 transition-colors"
                      >
                        Execute Withdrawal
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Withdrawal Dialogs */}
      <InitiateForcedWithdrawalDialog
        isOpen={isWithdrawalDialogOpen}
        onClose={() => setIsWithdrawalDialogOpen(false)}
        lockId={selectedLockId}
        resetPeriod={parseInt(
          balances
            .find((b) => b.lockId === selectedLockId)
            ?.resourceLock?.resetPeriod?.toString() || '0'
        )}
      />

      <ForcedWithdrawalDialog
        isOpen={isExecuteDialogOpen}
        onClose={() => setIsExecuteDialogOpen(false)}
        lockId={selectedLockId}
        maxAmount={selectedLock?.balance || '0'}
        decimals={selectedLock?.decimals || 18}
        symbol={selectedLock?.symbol || ''}
        tokenName={selectedLock?.tokenName || ''}
        chainId={parseInt(selectedLock?.chainId || '1')}
      />
    </div>
  );
}

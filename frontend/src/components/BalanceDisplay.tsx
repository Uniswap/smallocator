import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useBalances } from '../hooks/useBalances';
import { useResourceLocks } from '../hooks/useResourceLocks';
import { formatUnits } from 'viem';
import { Transfer } from './Transfer';
import { InitiateForcedWithdrawalDialog } from './InitiateForcedWithdrawalDialog';
import { ForcedWithdrawalDialog } from './ForcedWithdrawalDialog';
import { useCompact } from '../hooks/useCompact';
import { useNotification } from '../hooks/useNotification';
import { FinalizationThreshold } from './FinalizationThreshold';
import { formatTimeRemaining, formatResetPeriod } from '../utils/formatting';

interface BalanceDisplayProps {
  sessionToken: string | null;
}

interface SelectedLockData {
  chainId: string;
  lockId: string;
  balance: string;
  tokenName: string;
  decimals: number;
  symbol: string;
}

interface WalletError extends Error {
  code: number;
}

interface EthereumProvider {
  request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
}

const chainNames: Record<string, string> = {
  '1': 'Ethereum',
  '10': 'Optimism',
  '8453': 'Base',
};

function getChainName(chainId: string): string {
  return chainNames[chainId] || `Chain ${chainId}`;
}

function formatLockId(lockId: string): string {
  const id = BigInt(lockId);
  const hex = id.toString(16);
  return '0x' + hex.padStart(64, '0');
}

export function BalanceDisplay({
  sessionToken,
}: BalanceDisplayProps): JSX.Element | null {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { balances, error, isLoading } = useBalances();
  const { data: resourceLocksData, isLoading: resourceLocksLoading } =
    useResourceLocks();
  const { disableForcedWithdrawal } = useCompact();
  const { showNotification } = useNotification();
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [selectedLockId, setSelectedLockId] = useState<string>('');
  const [selectedLock, setSelectedLock] = useState<SelectedLockData | null>(
    null
  );
  const [currentTime, setCurrentTime] = useState(() =>
    Math.floor(Date.now() / 1000)
  );
  const [isSessionIdDialogOpen, setIsSessionIdDialogOpen] = useState(false);

  const handleDisableWithdrawal = useCallback(
    async (chainId: string, lockId: string) => {
      if (!lockId) return;

      const targetChainId = parseInt(chainId);
      if (targetChainId !== currentChainId) {
        const tempTxId = `network-switch-${Date.now()}`;
        try {
          showNotification({
            type: 'info',
            title: 'Switching Network',
            message: `Please confirm the network switch in your wallet...`,
            txHash: tempTxId,
            autoHide: false,
          });

          const ethereum = window.ethereum as EthereumProvider | undefined;
          if (!ethereum) {
            throw new Error('No wallet detected');
          }

          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }],
          });

          // Wait a bit for the network switch to complete
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Replace the switching notification with switched
          showNotification({
            type: 'success',
            title: 'Network Switched',
            message: `Successfully switched to ${chainNames[chainId] || `Chain ${chainId}`}`,
            txHash: tempTxId,
            autoHide: true,
          });
        } catch (switchError) {
          if ((switchError as WalletError).code === 4902) {
            showNotification({
              type: 'error',
              title: 'Network Not Found',
              message: 'Please add this network to your wallet first.',
              txHash: tempTxId,
              autoHide: true,
            });
          } else {
            console.error('Error switching network:', switchError);
            showNotification({
              type: 'error',
              title: 'Network Switch Failed',
              message:
                switchError instanceof Error
                  ? switchError.message
                  : 'Failed to switch network. Please switch manually.',
              txHash: tempTxId,
              autoHide: true,
            });
          }
          return;
        }
      }

      try {
        await disableForcedWithdrawal({
          args: [BigInt(lockId)],
        });
      } catch (error) {
        console.error('Error disabling forced withdrawal:', error);
        if (
          !(
            error instanceof Error &&
            error.message.toLowerCase().includes('user rejected')
          )
        ) {
          showNotification({
            type: 'error',
            title: 'Error',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to disable forced withdrawal',
          });
        }
      }
    },
    [currentChainId, disableForcedWithdrawal, showNotification]
  );

  const handleInitiateWithdrawal = useCallback(
    async (chainId: string, lockId: string) => {
      const targetChainId = parseInt(chainId);
      if (targetChainId !== currentChainId) {
        const tempTxId = `network-switch-${Date.now()}`;
        try {
          showNotification({
            type: 'info',
            title: 'Switching Network',
            message: `Please confirm the network switch in your wallet...`,
            txHash: tempTxId,
            autoHide: false,
          });

          const ethereum = window.ethereum as EthereumProvider | undefined;
          if (!ethereum) {
            throw new Error('No wallet detected');
          }

          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }],
          });

          // Wait a bit for the network switch to complete
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Replace the switching notification with switched
          showNotification({
            type: 'success',
            title: 'Network Switched',
            message: `Successfully switched to ${chainNames[chainId] || `Chain ${chainId}`}`,
            txHash: tempTxId,
            autoHide: true,
          });
        } catch (switchError) {
          if ((switchError as WalletError).code === 4902) {
            showNotification({
              type: 'error',
              title: 'Network Not Found',
              message: 'Please add this network to your wallet first.',
              txHash: tempTxId,
              autoHide: true,
            });
          } else {
            console.error('Error switching network:', switchError);
            showNotification({
              type: 'error',
              title: 'Network Switch Failed',
              message:
                switchError instanceof Error
                  ? switchError.message
                  : 'Failed to switch network. Please switch manually.',
              txHash: tempTxId,
              autoHide: true,
            });
          }
          return;
        }
      }

      setSelectedLockId(lockId);
      setIsWithdrawalDialogOpen(true);
    },
    [currentChainId, showNotification]
  );

  const handleExecuteWithdrawal = useCallback(
    async (
      chainId: string,
      lockId: string,
      balance: string,
      tokenName: string,
      decimals: number,
      symbol: string
    ) => {
      const targetChainId = parseInt(chainId);
      if (targetChainId !== currentChainId) {
        const tempTxId = `network-switch-${Date.now()}`;
        try {
          showNotification({
            type: 'info',
            title: 'Switching Network',
            message: `Please confirm the network switch in your wallet...`,
            txHash: tempTxId,
            autoHide: false,
          });

          const ethereum = window.ethereum as EthereumProvider | undefined;
          if (!ethereum) {
            throw new Error('No wallet detected');
          }

          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }],
          });

          // Wait a bit for the network switch to complete
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Replace the switching notification with switched
          showNotification({
            type: 'success',
            title: 'Network Switched',
            message: `Successfully switched to ${chainNames[chainId] || `Chain ${chainId}`}`,
            txHash: tempTxId,
            autoHide: true,
          });
        } catch (switchError) {
          if ((switchError as WalletError).code === 4902) {
            showNotification({
              type: 'error',
              title: 'Network Not Found',
              message: 'Please add this network to your wallet first.',
              txHash: tempTxId,
              autoHide: true,
            });
          } else {
            console.error('Error switching network:', switchError);
            showNotification({
              type: 'error',
              title: 'Network Switch Failed',
              message:
                switchError instanceof Error
                  ? switchError.message
                  : 'Failed to switch network. Please switch manually.',
              txHash: tempTxId,
              autoHide: true,
            });
          }
          return;
        }
      }

      setSelectedLockId(lockId);
      setSelectedLock({
        chainId,
        lockId,
        balance,
        tokenName,
        decimals,
        symbol,
      });
      setIsExecuteDialogOpen(true);
    },
    [currentChainId, showNotification]
  );

  const handleCopySessionId = useCallback(async () => {
    const sessionId = localStorage.getItem(`session-${address}`);
    if (!sessionId) return;

    try {
      await navigator.clipboard.writeText(sessionId);
      showNotification({
        type: 'success',
        title: 'Copied',
        message: 'Session ID copied to clipboard',
      });
    } catch {
      showNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to copy session ID',
      });
    }
  }, [address, showNotification]);

  // Update time every second for countdown display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Memoize the formatted balances to prevent unnecessary recalculations
  const formattedBalances = useMemo(() => {
    if (!balances) return [];

    return balances.map((balance) => ({
      ...balance,
      timeRemaining: balance.withdrawableAt
        ? formatTimeRemaining(parseInt(balance.withdrawableAt), currentTime)
        : '',
      resetPeriodFormatted: balance.resourceLock?.resetPeriod
        ? formatResetPeriod(balance.resourceLock.resetPeriod)
        : '',
    }));
  }, [balances, currentTime]);

  if (!isConnected) return null;

  if (isLoading || resourceLocksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00ff00]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 rounded-lg border border-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Allocations</h2>
        <button
          onClick={() => setIsSessionIdDialogOpen(true)}
          className="px-3 py-1 text-sm bg-[#00ff00]/10 text-[#00ff00] rounded hover:bg-[#00ff00]/20 transition-colors"
        >
          Show Session ID
        </button>
      </div>

      <div className="space-y-4">
        {formattedBalances.map((balance) => {
          // Find matching resource lock from indexer data
          const resourceLock = resourceLocksData?.resourceLocks.items.find(
            (item) =>
              item.resourceLock.lockId === balance.lockId &&
              item.chainId === balance.chainId
          );

          const withdrawableAt = parseInt(balance.withdrawableAt || '0');
          const canExecuteWithdrawal =
            parseInt(balance.withdrawalStatus.toString()) !== 0 &&
            withdrawableAt <= currentTime;

          return (
            <div
              key={`${balance.chainId}-${balance.lockId}`}
              className="p-4 bg-gray-800 rounded-lg"
            >
              {/* Header with Token Info and Chain Name */}
              <div className="flex justify-between items-baseline mb-4">
                <div className="text-base font-medium text-gray-300">
                  {balance.token?.name} ({balance.token?.symbol})
                </div>
                <div className="flex items-baseline gap-6 text-xs text-gray-400 ml-8">
                  <div>Chain: {getChainName(balance.chainId)}</div>
                  <div>
                    Lock ID:{' '}
                    <span className="font-mono">
                      {formatLockId(balance.lockId)}
                    </span>
                  </div>
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
                <FinalizationThreshold chainId={parseInt(balance.chainId)} />
                {balance.resourceLock?.isMultichain && (
                  <span className="px-2 py-1 text-xs bg-[#00ff00]/10 text-[#00ff00] rounded">
                    Multichain
                  </span>
                )}
                {balance.withdrawalStatus === 0 && (
                  <span className="px-2 py-1 text-xs rounded bg-[#00ff00]/10 text-[#00ff00]">
                    Active
                  </span>
                )}
              </div>

              {/* Balances Grid */}
              <div className="grid grid-cols-12 gap-4">
                {/* Left side - Current, Allocatable, and Allocated */}
                <div className="col-span-8 grid grid-cols-3 gap-4 pr-4 border-r border-gray-700">
                  <div>
                    <div className="text-xs text-gray-400">Current Balance</div>
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
                    <div className="text-xs text-gray-400">
                      Finalized Balance
                    </div>
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
                    <div className="text-xs text-gray-400">
                      Currently Allocated
                    </div>
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
                      chainId={balance.chainId}
                      resourceLockBalance={resourceLock.balance}
                      lockId={BigInt(balance.lockId)}
                      decimals={resourceLock.resourceLock.token.decimals}
                      tokenName={{
                        resourceLockName: resourceLock.resourceLock.token.name,
                        resourceLockSymbol:
                          resourceLock.resourceLock.token.symbol,
                        tokenName: balance.token?.name || '',
                      }}
                      tokenSymbol={balance.token?.symbol || ''}
                      withdrawalStatus={balance.withdrawalStatus}
                      sessionToken={sessionToken}
                      resetPeriod={resourceLock.resourceLock.resetPeriod}
                      onForceWithdraw={() => {
                        handleInitiateWithdrawal(
                          balance.chainId,
                          balance.lockId
                        );
                      }}
                      onDisableForceWithdraw={() => {
                        handleDisableWithdrawal(
                          balance.chainId,
                          balance.lockId
                        );
                      }}
                      balanceAvailableToAllocate={
                        balance.balanceAvailableToAllocate
                      }
                    />
                    {canExecuteWithdrawal && (
                      <button
                        onClick={() =>
                          handleExecuteWithdrawal(
                            balance.chainId,
                            balance.lockId,
                            resourceLock?.balance || '0',
                            balance.token?.name || 'Token',
                            balance.token?.decimals || 18,
                            balance.token?.symbol || ''
                          )
                        }
                        className="mt-2 py-2 px-4 bg-[#F97316] text-white rounded-lg font-medium hover:opacity-90 transition-colors"
                      >
                        Execute Forced Withdrawal
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Session ID Dialog */}
      {isSessionIdDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 space-y-4 border border-gray-800">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Session ID</h3>
              <button
                onClick={() => setIsSessionIdDialogOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              Supply this value as a{' '}
              <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm">
                x-session-id
              </code>{' '}
              header to make authenticated requests to the API.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black/50 p-3 rounded font-mono text-sm break-all">
                {localStorage.getItem(`session-${address}`) ||
                  'No session found'}
              </div>
              <button
                onClick={handleCopySessionId}
                className="px-3 py-2 text-sm bg-[#00ff00]/10 text-[#00ff00] rounded hover:bg-[#00ff00]/20 transition-colors whitespace-nowrap"
              >
                Copy
              </button>
            </div>
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded text-sm text-yellow-200/80">
              <strong className="block mb-1 text-yellow-200">
                ⚠️ Warning:
              </strong>
              Do not share your session key with third parties you do not trust!
              Anyone in possession of your session key will be able to request
              allocations on your behalf and view your allocation statuses and
              partial information on submitted compacts. However, they will not
              be able to transfer or withdraw your tokens without a
              corresponding signature from you.
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Dialogs */}
      <InitiateForcedWithdrawalDialog
        isOpen={isWithdrawalDialogOpen}
        onClose={() => setIsWithdrawalDialogOpen(false)}
        lockId={selectedLockId}
        resetPeriod={parseInt(
          formattedBalances
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

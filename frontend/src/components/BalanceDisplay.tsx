import { formatUnits } from 'viem';
import { memo, useMemo, useCallback } from 'react';
import { Transfer } from './Transfer';
import { InitiateForcedWithdrawalDialog } from './InitiateForcedWithdrawalDialog';
import { ForcedWithdrawalDialog } from './ForcedWithdrawalDialog';
import { FinalizationThreshold } from './FinalizationThreshold';
import { WithdrawalCountdown } from './WithdrawalCountdown';
import { formatResetPeriod } from '../utils/formatting';
import {
  useBalanceDisplay,
  type BalanceDisplayProps,
  formatLockId,
  getChainName,
} from '../hooks/useBalanceDisplay';
import type { Balance } from '../hooks/useBalances';
import type { ResourceLockBalance } from '../hooks/useResourceLocks';

interface BalanceItemProps {
  balance: Balance;
  resourceLock: ResourceLockBalance | undefined;
  onInitiateWithdrawal: (lockId: string) => void;
  onDisableWithdrawal: (chainId: string, lockId: string) => void;
  onExecuteWithdrawal: (
    chainId: string,
    lockId: string,
    balance: string,
    tokenName: string,
    decimals: number,
    symbol: string
  ) => void;
  sessionToken: string | null;
}

// Memoized balance value component
const BalanceValue = memo(
  function BalanceValue({
    balance,
    decimals,
  }: {
    balance: string;
    decimals: number;
  }) {
    const formattedValue = useMemo(() => {
      return formatUnits(BigInt(balance), decimals);
    }, [balance, decimals]);

    return formattedValue;
  },
  (prev, next) =>
    prev.balance === next.balance && prev.decimals === next.decimals
);

// Helper function to compare resourceLock objects
const areResourceLocksEqual = (
  prev: ResourceLockBalance | undefined,
  next: ResourceLockBalance | undefined
) => {
  if (!prev || !next) return prev === next;

  // Compare critical fields that affect rendering
  const tokenEqual =
    prev.resourceLock.token.name === next.resourceLock.token.name &&
    prev.resourceLock.token.symbol === next.resourceLock.token.symbol &&
    prev.resourceLock.token.decimals === next.resourceLock.token.decimals &&
    prev.resourceLock.token.tokenAddress ===
      next.resourceLock.token.tokenAddress;

  const resourceLockEqual =
    prev.balance === next.balance &&
    prev.withdrawalStatus === next.withdrawalStatus &&
    prev.withdrawableAt === next.withdrawableAt &&
    prev.resourceLock.resetPeriod === next.resourceLock.resetPeriod &&
    prev.resourceLock.isMultichain === next.resourceLock.isMultichain &&
    prev.resourceLock.token.tokenAddress ===
      next.resourceLock.token.tokenAddress &&
    prev.chainId === next.chainId;

  return tokenEqual && resourceLockEqual;
};

const BalanceItem = memo(
  function BalanceItem({
    balance,
    resourceLock,
    onInitiateWithdrawal,
    onDisableWithdrawal,
    onExecuteWithdrawal,
    sessionToken,
  }: BalanceItemProps) {
    const withdrawableAt = parseInt(balance.withdrawableAt || '0');
    const canExecuteWithdrawal = useMemo(() => {
      const currentTime = Math.floor(Date.now() / 1000);
      return (
        parseInt(balance.withdrawalStatus.toString()) !== 0 &&
        withdrawableAt <= currentTime
      );
    }, [balance.withdrawalStatus, withdrawableAt]);

    // Memoize handlers
    const handleForceWithdraw = useCallback(() => {
      onInitiateWithdrawal(balance.lockId);
    }, [balance.lockId, onInitiateWithdrawal]);

    const handleDisableForceWithdraw = useCallback(() => {
      onDisableWithdrawal(balance.chainId, balance.lockId);
    }, [balance.chainId, balance.lockId, onDisableWithdrawal]);

    const handleExecuteWithdrawal = useCallback(() => {
      onExecuteWithdrawal(
        balance.chainId,
        balance.lockId,
        resourceLock?.balance || '0',
        balance.token?.name || 'Token',
        balance.token?.decimals || 18,
        balance.token?.symbol || ''
      );
    }, [
      balance.chainId,
      balance.lockId,
      balance.token?.decimals,
      balance.token?.name,
      balance.token?.symbol,
      onExecuteWithdrawal,
      resourceLock?.balance,
    ]);

    return (
      <div className="p-4 bg-gray-800 rounded-lg">
        {/* Header with Token Info and Chain Name */}
        <div className="flex justify-between items-baseline mb-4">
          <div className="text-base font-medium text-gray-300">
            {balance.token?.name} ({balance.token?.symbol})
          </div>
          <div className="flex items-baseline gap-6 text-xs text-gray-400 ml-8">
            <div>Chain: {getChainName(balance.chainId)}</div>
            <div>
              Lock ID:{' '}
              <span className="font-mono">{formatLockId(balance.lockId)}</span>
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
          {balance.withdrawalStatus !== 0 && (
            <WithdrawalCountdown
              withdrawableAt={balance.withdrawableAt}
              canExecute={canExecuteWithdrawal}
            />
          )}
        </div>

        {/* Balances Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left side - Current, Allocatable, and Allocated */}
          <div className="col-span-8 grid grid-cols-3 gap-4 pr-4 border-r border-gray-700">
            <div>
              <div className="text-xs text-gray-400">Current Balance</div>
              <div className="mt-1 text-sm text-[#00ff00] font-mono">
                {resourceLock && (
                  <BalanceValue
                    balance={resourceLock.balance}
                    decimals={resourceLock.resourceLock.token.decimals}
                  />
                )}
                {balance.token?.symbol && (
                  <span className="ml-1 text-gray-400">
                    {balance.token.symbol}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400">Finalized Balance</div>
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
              <div className="text-xs text-gray-400">Currently Allocated</div>
              <div className="mt-1 text-sm text-[#00ff00] font-mono">
                {balance.formattedAllocatedBalance || balance.allocatedBalance}
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
            <div className="text-xs text-gray-400">Available to Allocate</div>
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
                  resourceLockSymbol: resourceLock.resourceLock.token.symbol,
                  tokenName: balance.token?.name || '',
                }}
                tokenSymbol={balance.token?.symbol || ''}
                withdrawalStatus={balance.withdrawalStatus}
                sessionToken={sessionToken}
                resetPeriod={resourceLock.resourceLock.resetPeriod}
                onForceWithdraw={handleForceWithdraw}
                onDisableForceWithdraw={handleDisableForceWithdraw}
                balanceAvailableToAllocate={balance.balanceAvailableToAllocate}
              />
              {canExecuteWithdrawal && (
                <button
                  onClick={handleExecuteWithdrawal}
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
  },
  (prevProps, nextProps) => {
    // Enhanced comparison function for memo
    const balanceEqual =
      prevProps.balance.lockId === nextProps.balance.lockId &&
      prevProps.balance.chainId === nextProps.balance.chainId &&
      prevProps.balance.withdrawalStatus ===
        nextProps.balance.withdrawalStatus &&
      prevProps.balance.withdrawableAt === nextProps.balance.withdrawableAt &&
      prevProps.balance.formattedAllocatableBalance ===
        nextProps.balance.formattedAllocatableBalance &&
      prevProps.balance.formattedAllocatedBalance ===
        nextProps.balance.formattedAllocatedBalance &&
      prevProps.balance.formattedAvailableBalance ===
        nextProps.balance.formattedAvailableBalance;

    // Use the helper function to deeply compare resourceLocks
    const resourceLockEqual = areResourceLocksEqual(
      prevProps.resourceLock,
      nextProps.resourceLock
    );

    return (
      balanceEqual &&
      resourceLockEqual &&
      prevProps.sessionToken === nextProps.sessionToken
    );
  }
);

export function BalanceDisplay({
  sessionToken,
}: BalanceDisplayProps): JSX.Element | null {
  const {
    isConnected,
    isLoading,
    resourceLocksLoading,
    error,
    formattedBalances,
    resourceLocksData,
    isWithdrawalDialogOpen,
    setIsWithdrawalDialogOpen,
    isExecuteDialogOpen,
    setIsExecuteDialogOpen,
    selectedLockId,
    selectedLock,
    isSessionIdDialogOpen,
    setIsSessionIdDialogOpen,
    handleDisableWithdrawal,
    handleInitiateWithdrawal,
    handleExecuteWithdrawal,
    handleCopySessionId,
    address,
  } = useBalanceDisplay();

  if (!isConnected) return null;

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

      {isLoading || resourceLocksLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00ff00]"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 p-4 rounded-lg border border-red-500">
          Error: {error}
        </div>
      ) : !formattedBalances.length ? (
        <div className="p-6 text-center bg-gray-800 rounded-lg">
          <p className="text-gray-300">
            Unable to locate any resource locks that use this allocator. Deposit
            ETH or ERC20 tokens to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {formattedBalances.map((balance) => {
            const resourceLock = resourceLocksData.resourceLocks.items.find(
              (item) =>
                item.resourceLock.lockId === balance.lockId &&
                item.chainId === balance.chainId
            );

            return (
              <BalanceItem
                key={`${balance.chainId}-${balance.lockId}`}
                balance={balance}
                resourceLock={resourceLock}
                onInitiateWithdrawal={handleInitiateWithdrawal}
                onDisableWithdrawal={handleDisableWithdrawal}
                onExecuteWithdrawal={handleExecuteWithdrawal}
                sessionToken={sessionToken}
              />
            );
          })}
        </div>
      )}

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

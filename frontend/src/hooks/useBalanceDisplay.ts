import { useState, useCallback, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useBalances } from './useBalances';
import { useResourceLocks } from './useResourceLocks';
import { useCompact } from './useCompact';
import { useNotification } from './useNotification';
import { getChainName } from '../utils/chains';

export interface BalanceDisplayProps {
  sessionToken: string | null;
}

export interface SelectedLockData {
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

type TransactionResponse = {
  hash: `0x${string}`;
} | `0x${string}`;

export { getChainName };

export function formatLockId(lockId: string): string {
  const id = BigInt(lockId);
  const hex = id.toString(16);
  return '0x' + hex.padStart(64, '0');
}

export function useBalanceDisplay() {
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
  const [isSessionIdDialogOpen, setIsSessionIdDialogOpen] = useState(false);

  // Memoize the network switching logic
  const switchNetwork = useCallback(
    async (targetChainId: number, chainId: string) => {
      const tempTxId = `network-switch-${Date.now()}`;
      try {
        showNotification({
          type: 'info',
          title: 'Switching Network',
          message: `Please confirm the network switch in your wallet...`,
          txHash: tempTxId,
          chainId: targetChainId,
          stage: 'initiated',
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

        await new Promise((resolve) => setTimeout(resolve, 1000));

        showNotification({
          type: 'success',
          title: 'Network Switched',
          message: `Successfully switched to ${getChainName(chainId)}`,
          txHash: tempTxId,
          chainId: targetChainId,
          stage: 'confirmed',
          autoHide: true,
        });
        return true;
      } catch (switchError) {
        if ((switchError as WalletError).code === 4902) {
          showNotification({
            type: 'error',
            title: 'Network Not Found',
            message: 'Please add this network to your wallet first.',
            txHash: tempTxId,
            chainId: targetChainId,
            stage: 'confirmed',
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
            chainId: targetChainId,
            stage: 'confirmed',
            autoHide: true,
          });
        }
        return false;
      }
    },
    [showNotification]
  );

  const handleDisableWithdrawal = useCallback(
    async (chainId: string, lockId: string) => {
      if (!lockId) return;

      const targetChainId = parseInt(chainId);
      if (targetChainId !== currentChainId) {
        const success = await switchNetwork(targetChainId, chainId);
        if (!success) return;
      }

      try {
        const result = await disableForcedWithdrawal({
          args: [BigInt(lockId)],
        }) as TransactionResponse;
        
        // Get the transaction hash whether it's returned directly or as part of an object
        const txHash = typeof result === 'object' ? result.hash : result;
        
        if (txHash) {
          showNotification({
            type: 'success',
            title: 'Withdrawal Disabled',
            message: 'Successfully disabled forced withdrawal',
            txHash,
            chainId: targetChainId,
          });
        }
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
            chainId: targetChainId,
          });
        }
      }
    },
    [currentChainId, disableForcedWithdrawal, showNotification, switchNetwork]
  );

  const handleInitiateWithdrawal = useCallback((lockId: string) => {
    setSelectedLockId(lockId);
    setIsWithdrawalDialogOpen(true);
  }, []);

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
        const success = await switchNetwork(targetChainId, chainId);
        if (!success) return;
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
    [currentChainId, switchNetwork]
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

  // Memoize the return value to prevent unnecessary rerenders
  const returnValue = useMemo(
    () => ({
      isConnected,
      isLoading,
      resourceLocksLoading,
      error,
      formattedBalances: balances,
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
    }),
    [
      isConnected,
      isLoading,
      resourceLocksLoading,
      error,
      balances,
      resourceLocksData,
      isWithdrawalDialogOpen,
      isExecuteDialogOpen,
      selectedLockId,
      selectedLock,
      isSessionIdDialogOpen,
      handleDisableWithdrawal,
      handleInitiateWithdrawal,
      handleExecuteWithdrawal,
      handleCopySessionId,
      address,
    ]
  );

  return returnValue;
}

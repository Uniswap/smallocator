import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useBalances } from './useBalances';
import { useResourceLocks } from './useResourceLocks';
import { useCompact } from './useCompact';
import { useNotification } from './useNotification';
import { formatTimeRemaining, formatResetPeriod } from '../utils/formatting';

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

const chainNames: Record<string, string> = {
  '1': 'Ethereum',
  '10': 'Optimism',
  '8453': 'Base',
};

export function getChainName(chainId: string): string {
  return chainNames[chainId] || `Chain ${chainId}`;
}

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

          await new Promise((resolve) => setTimeout(resolve, 1000));

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

          await new Promise((resolve) => setTimeout(resolve, 1000));

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

          await new Promise((resolve) => setTimeout(resolve, 1000));

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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  return {
    isConnected,
    isLoading,
    resourceLocksLoading,
    error,
    formattedBalances,
    resourceLocksData,
    currentTime,
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
  };
}

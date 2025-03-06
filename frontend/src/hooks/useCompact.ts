import React from 'react';
import {
  useWriteContract,
  useChainId,
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { type Chain, type Hash } from 'viem';
import {
  COMPACT_ABI,
  COMPACT_ADDRESS,
  isSupportedChain,
} from '../../src/constants/contracts';
import { useNotification } from './useNotification';
import {
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
} from 'viem/chains';
import { unichain } from '../config/wagmi';

const chains: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [optimism.id]: optimism,
  [optimismGoerli.id]: optimismGoerli,
  [sepolia.id]: sepolia,
  [goerli.id]: goerli,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [unichain.id]: unichain,
};

interface NativeDeposit {
  allocator: `0x${string}`;
  value: bigint;
  displayValue: string;
  isNative: true;
}

interface TokenDeposit {
  token: `0x${string}`;
  allocator: `0x${string}`;
  amount: bigint;
  displayAmount: string;
  symbol: string;
  isNative: false;
}

type DepositParams = NativeDeposit | TokenDeposit;

interface WithdrawalParams {
  args: readonly [bigint] | readonly [bigint, `0x${string}`, bigint];
  amount?: bigint;
  displayAmount?: string;
  symbol?: string;
}

export function useCompact() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { showNotification } = useNotification();
  const [hash, setHash] = React.useState<Hash | undefined>();

  const { writeContractAsync } = useWriteContract({
    mutation: {
      onError: (error) => {
        // Only show transaction-related errors, not network or user rejection errors
        if (
          error instanceof Error &&
          !error.message.toLowerCase().includes('user rejected') &&
          !error.message.toLowerCase().includes('network') &&
          !error.message.toLowerCase().includes('chain') &&
          !error.message.toLowerCase().includes('invalid network') &&
          !error.message.toLowerCase().includes('wrong network') &&
          !error.message.toLowerCase().includes('unsupported network') &&
          error.message !== 'Unsupported chain' &&
          error.message !== 'Chain configuration not found'
        ) {
          showNotification({
            type: 'error',
            title: 'Transaction Failed',
            message: error.message,
            autoHide: true,
          });
        }
      },
    },
  });

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
      onReplaced: (replacement) => {
        showNotification({
          type: 'info',
          title: 'Transaction Replaced',
          message: `Transaction was ${replacement.reason}. Waiting for new transaction...`,
          txHash: replacement.transaction.hash,
          chainId,
          autoHide: false,
        });
      },
    });

  const getContractAddress = () => {
    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain');
    }

    const chain = chains[chainId];
    if (!chain) {
      throw new Error('Chain configuration not found');
    }

    return COMPACT_ADDRESS as `0x${string}`;
  };

  const deposit = async (params: DepositParams) => {
    if (!publicClient) throw new Error('Public client not available');

    const contractAddress = getContractAddress();
    if (!contractAddress)
      throw new Error('Contract address not found for current network');

    // Generate a temporary transaction ID for linking notifications
    const tempTxId = `pending-${Date.now()}`;

    showNotification({
      type: 'info',
      title: 'Initiating Deposit',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
      txHash: tempTxId,
      chainId,
      autoHide: false,
    });

    try {
      const newHash = await writeContractAsync({
        address: contractAddress,
        abi: [params.isNative ? COMPACT_ABI[0] : COMPACT_ABI[1]],
        functionName: 'deposit',
        args: params.isNative
          ? [params.allocator]
          : [params.token, params.allocator, params.amount],
        value: params.isNative ? params.value : 0n,
      });

      showNotification({
        type: 'success',
        title: 'Transaction Submitted',
        message: 'Waiting for confirmation...',
        stage: 'submitted',
        txHash: newHash,
        chainId,
        autoHide: true,
      });

      setHash(newHash);

      // Start watching for confirmation but don't wait for it
      void publicClient
        .waitForTransactionReceipt({
          hash: newHash,
        })
        .then((receipt) => {
          if (receipt.status === 'success') {
            showNotification({
              type: 'success',
              title: 'Deposit Confirmed',
              message: params.isNative
                ? `Successfully deposited ${params.displayValue} ETH`
                : `Successfully deposited ${params.displayAmount} ${params.symbol}`,
              stage: 'confirmed',
              txHash: newHash,
              chainId,
              autoHide: false,
            });
          }
        });

      return newHash;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('user rejected')
      ) {
        showNotification({
          type: 'error',
          title: 'Transaction Rejected',
          message: 'You rejected the transaction',
          txHash: tempTxId,
          chainId,
          autoHide: true,
        });
      }
      throw error;
    }
  };

  const enableForcedWithdrawal = async ({ args }: { args: [bigint] }) => {
    if (!publicClient) throw new Error('Public client not available');

    const tempTxId = `pending-${Date.now()}`;

    showNotification({
      type: 'info',
      title: 'Initiating Forced Withdrawal',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
      txHash: tempTxId,
      chainId,
      autoHide: false,
    });

    try {
      const newHash = await writeContractAsync({
        abi: COMPACT_ABI,
        address: getContractAddress(),
        functionName: 'enableForcedWithdrawal',
        args,
      });

      showNotification({
        type: 'success',
        title: 'Transaction Submitted',
        message: 'Waiting for confirmation...',
        stage: 'submitted',
        txHash: newHash,
        chainId,
        autoHide: true,
      });

      setHash(newHash);

      // Start watching for confirmation but don't wait for it
      void publicClient
        .waitForTransactionReceipt({
          hash: newHash,
        })
        .then((receipt) => {
          if (receipt.status === 'success') {
            showNotification({
              type: 'success',
              title: 'Forced Withdrawal Initiated',
              message: 'The timelock period has started',
              stage: 'confirmed',
              txHash: newHash,
              chainId,
              autoHide: false,
            });
          }
        });

      return newHash;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('user rejected')
      ) {
        showNotification({
          type: 'error',
          title: 'Transaction Rejected',
          message: 'You rejected the transaction',
          txHash: tempTxId,
          chainId,
          autoHide: true,
        });
      }
      throw error;
    }
  };

  const disableForcedWithdrawal = async ({ args }: { args: [bigint] }) => {
    if (!publicClient) throw new Error('Public client not available');

    const tempTxId = `pending-${Date.now()}`;

    showNotification({
      type: 'info',
      title: 'Initiating Reactivation',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
      txHash: tempTxId,
      chainId,
      autoHide: false,
    });

    try {
      const newHash = await writeContractAsync({
        abi: COMPACT_ABI,
        address: getContractAddress(),
        functionName: 'disableForcedWithdrawal',
        args,
      });

      showNotification({
        type: 'success',
        title: 'Transaction Submitted',
        message: 'Waiting for confirmation...',
        stage: 'submitted',
        txHash: newHash,
        chainId,
        autoHide: true,
      });

      setHash(newHash);

      // Start watching for confirmation but don't wait for it
      void publicClient
        .waitForTransactionReceipt({
          hash: newHash,
        })
        .then((receipt) => {
          if (receipt.status === 'success') {
            showNotification({
              type: 'success',
              title: 'Resource Lock Reactivated',
              message: 'Your resource lock has been reactivated',
              stage: 'confirmed',
              txHash: newHash,
              chainId,
              autoHide: false,
            });
          }
        });

      return newHash;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('user rejected')
      ) {
        showNotification({
          type: 'error',
          title: 'Transaction Rejected',
          message: 'You rejected the transaction',
          txHash: tempTxId,
          chainId,
          autoHide: true,
        });
      }
      throw error;
    }
  };

  const forcedWithdrawal = async ({
    args,
    displayAmount,
    symbol,
  }: WithdrawalParams) => {
    if (!publicClient) throw new Error('Public client not available');

    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain');
    }

    const chain = chains[chainId];
    if (!chain) {
      throw new Error('Chain configuration not found');
    }

    const tempTxId = `pending-${Date.now()}`;

    showNotification({
      type: 'info',
      title: `Initiating Forced Withdrawal of ${displayAmount} ${symbol}`,
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
      txHash: tempTxId,
      chainId,
      autoHide: false,
    });

    try {
      const newHash = await writeContractAsync({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: [COMPACT_ABI.find((x) => x.name === 'forcedWithdrawal')] as const,
        functionName: 'forcedWithdrawal',
        args,
        account: address,
        chain,
      });

      showNotification({
        type: 'success',
        title: 'Transaction Submitted',
        message: 'Waiting for confirmation...',
        stage: 'submitted',
        txHash: newHash,
        chainId,
        autoHide: true,
      });

      setHash(newHash);

      // Start watching for confirmation but don't wait for it
      void publicClient
        .waitForTransactionReceipt({
          hash: newHash,
        })
        .then((receipt) => {
          if (receipt.status === 'success') {
            showNotification({
              type: 'success',
              title: 'Withdrawal Confirmed',
              message: `Successfully withdrew ${displayAmount} ${symbol}`,
              stage: 'confirmed',
              txHash: newHash,
              chainId,
              autoHide: false,
            });
          }
        });

      return newHash;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('user rejected')
      ) {
        showNotification({
          type: 'error',
          title: 'Transaction Rejected',
          message: 'You rejected the transaction',
          txHash: tempTxId,
          chainId,
          autoHide: true,
        });
      }
      throw error;
    }
  };

  return {
    deposit,
    enableForcedWithdrawal,
    disableForcedWithdrawal,
    forcedWithdrawal,
    isSupported: isSupportedChain(chainId),
    isConfirming,
    isConfirmed,
  };
}

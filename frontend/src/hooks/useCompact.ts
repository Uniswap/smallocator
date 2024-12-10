import React from 'react';
import { useWriteContract, useChainId, useAccount, usePublicClient, useWaitForTransactionReceipt } from 'wagmi';
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

const chains: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [optimism.id]: optimism,
  [optimismGoerli.id]: optimismGoerli,
  [sepolia.id]: sepolia,
  [goerli.id]: goerli,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
};

interface NativeDeposit {
  allocator: `0x${string}`;
  value: bigint;
  isNative: true;
}

interface TokenDeposit {
  token: `0x${string}`;
  allocator: `0x${string}`;
  amount: bigint;
  isNative: false;
}

type DepositParams = NativeDeposit | TokenDeposit;

interface WithdrawalParams {
  args: readonly [bigint] | readonly [bigint, `0x${string}`, bigint];
}

export function useCompact() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [hash, setHash] = React.useState<Hash | undefined>();
  const { writeContractAsync } = useWriteContract({
    mutation: {
      onError: (error) => {
        if (error instanceof Error && !error.message.toLowerCase().includes('user rejected')) {
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
  const { showNotification } = useNotification();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    onReplaced: (replacement) => {
      showNotification({
        type: 'info',
        title: 'Transaction Replaced',
        message: `Transaction was ${replacement.reason}. Waiting for new transaction...`,
        txHash: replacement.transaction.hash,
        autoHide: false,
      });
    },
  });

  // Show confirmation notification when transaction is confirmed
  React.useEffect(() => {
    if (isConfirmed && hash) {
      showNotification({
        type: 'success',
        title: 'Transaction Confirmed',
        message: 'Your transaction has been confirmed',
        stage: 'confirmed',
        txHash: hash,
        autoHide: true,
      });
      setHash(undefined); // Reset hash after confirmation
    }
  }, [isConfirmed, hash, showNotification]);

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
    const contractAddress = getContractAddress();
    if (!contractAddress) throw new Error('Contract address not found for current network');

    showNotification({
      type: 'info',
      title: 'Transaction Initiated',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
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
        message: 'Waiting for block inclusion...',
        stage: 'submitted',
        txHash: newHash,
        autoHide: false,
      });

      setHash(newHash);
      return newHash;
    } catch (error) {
      // Error handling is in the writeContract config
      throw error;
    }
  };

  const enableForcedWithdrawal = async ({ args }: { args: [bigint] }) => {
    showNotification({
      type: 'info',
      title: 'Transaction Initiated',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
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
        message: 'Waiting for block inclusion...',
        stage: 'submitted',
        txHash: newHash,
        autoHide: false,
      });

      setHash(newHash);
      return newHash;
    } catch (error) {
      // Only show error notification if it's not a user rejection
      if (error instanceof Error && !error.message.includes('User rejected')) {
        showNotification({
          type: 'error',
          title: 'Transaction Failed',
          message: error.message,
          autoHide: true,
        });
      }
      throw error; // Re-throw to be handled by the form
    }
  };

  const disableForcedWithdrawal = async ({ args }: { args: [bigint] }) => {
    showNotification({
      type: 'info',
      title: 'Transaction Initiated',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
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
        message: 'Waiting for block inclusion...',
        stage: 'submitted',
        txHash: newHash,
        autoHide: false,
      });

      setHash(newHash);
      return newHash;
    } catch (error) {
      // Only show error notification if it's not a user rejection
      if (error instanceof Error && !error.message.includes('User rejected')) {
        showNotification({
          type: 'error',
          title: 'Transaction Failed',
          message: error.message,
          autoHide: true,
        });
      }
      throw error; // Re-throw to be handled by the form
    }
  };

  const forcedWithdrawal = async ({ args }: WithdrawalParams) => {
    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain');
    }

    const chain = chains[chainId];
    if (!chain) {
      throw new Error('Chain configuration not found');
    }

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
        message: 'Your forced withdrawal transaction has been submitted.',
      });

      setHash(newHash);
      return newHash;
    } catch (error) {
      console.error('Forced withdrawal error:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to execute forced withdrawal',
      });
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

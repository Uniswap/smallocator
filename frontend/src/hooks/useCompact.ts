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
  const [hash, setHash] = React.useState<Hash | undefined>();
  const { writeContractAsync } = useWriteContract({
    mutation: {
      onError: (error) => {
        if (
          error instanceof Error &&
          !error.message.toLowerCase().includes('user rejected')
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
  const { showNotification } = useNotification();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
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
      setHash(undefined); // Reset hash after confirmation
    }
  }, [isConfirmed, hash]);

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
        autoHide: false,
      });

      setHash(newHash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: newHash,
      });
      if (receipt.status === 'success') {
        showNotification({
          type: 'success',
          title: 'Deposit Confirmed',
          message: params.isNative
            ? `Successfully deposited ${params.displayValue} ETH`
            : `Successfully deposited ${params.displayAmount} ${params.symbol}`,
          stage: 'confirmed',
          txHash: newHash,
          autoHide: true,
        });
      }

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
        autoHide: false,
      });

      setHash(newHash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: newHash,
      });
      if (receipt.status === 'success') {
        showNotification({
          type: 'success',
          title: 'Forced Withdrawal Initiated',
          message: 'The timelock period has started',
          stage: 'confirmed',
          txHash: newHash,
          autoHide: true,
        });
      }

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
        autoHide: false,
      });

      setHash(newHash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: newHash,
      });
      if (receipt.status === 'success') {
        showNotification({
          type: 'success',
          title: 'Resource Lock Reactivated',
          message: 'Your resource lock has been reactivated',
          stage: 'confirmed',
          txHash: newHash,
          autoHide: true,
        });
      }

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
        autoHide: false,
      });

      setHash(newHash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: newHash,
      });
      if (receipt.status === 'success') {
        showNotification({
          type: 'success',
          title: 'Withdrawal Confirmed',
          message: `Successfully withdrew ${displayAmount} ${symbol}`,
          stage: 'confirmed',
          txHash: newHash,
          autoHide: true,
        });
      }

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

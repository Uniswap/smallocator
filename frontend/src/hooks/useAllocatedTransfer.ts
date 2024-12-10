import {
  useWriteContract,
  useChainId,
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { type Chain } from 'viem';
import {
  COMPACT_ABI,
  COMPACT_ADDRESS,
  isSupportedChain,
  type BasicTransfer,
} from '../constants/contracts';
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
import { useState } from 'react';

const chains: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [optimism.id]: optimism,
  [optimismGoerli.id]: optimismGoerli,
  [sepolia.id]: sepolia,
  [goerli.id]: goerli,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
};

export function useAllocatedTransfer() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
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

  const allocatedTransfer = async (transferPayload: BasicTransfer) => {
    if (!publicClient) throw new Error('Public client not available');

    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain');
    }

    const chain = chains[chainId];
    if (!chain) {
      throw new Error('Chain configuration not found');
    }

    // Generate a temporary transaction ID for linking notifications
    const tempTxId = `pending-${Date.now()}`;

    // Format the amount for display
    const displayAmount = transferPayload.amount
      ? `${Number(transferPayload.amount) / 10 ** 18} ETH`
      : 'tokens';

    showNotification({
      type: 'info',
      title: 'Initiating Transfer',
      message: `Waiting for transaction submission of ${displayAmount}...`,
      stage: 'initiated',
      txHash: tempTxId,
      autoHide: false,
    });

    try {
      const newHash = await writeContractAsync({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: [COMPACT_ABI.find((x) => x.name === 'allocatedTransfer')] as const,
        functionName: 'allocatedTransfer',
        args: [transferPayload],
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
          title: 'Transfer Confirmed',
          message: `Successfully transferred ${displayAmount}`,
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
    allocatedTransfer,
    isConfirming,
    isConfirmed,
  };
}

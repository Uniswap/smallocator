import { useWriteContract, useChainId, useAccount } from 'wagmi';
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
  const { writeContract, isPending } = useWriteContract();
  const { showNotification } = useNotification();

  const allocatedTransfer = async (transferPayload: BasicTransfer) => {
    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain');
    }

    const chain = chains[chainId];
    if (!chain) {
      throw new Error('Chain configuration not found');
    }

    try {
      const hash = await writeContract({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: [COMPACT_ABI.find((x) => x.name === 'allocatedTransfer')] as const,
        functionName: 'allocatedTransfer',
        args: [transferPayload],
        account: address,
        chain,
      });

      showNotification({
        type: 'success',
        title: 'Transaction Submitted',
        message: 'Your transfer transaction has been submitted.',
      });

      return hash;
    } catch (error) {
      console.error('Transfer error:', error);
      showNotification({
        type: 'error',
        title: 'Transaction Failed',
        message:
          error instanceof Error ? error.message : 'Failed to submit transfer',
      });
      throw error;
    }
  };

  return {
    allocatedTransfer,
    isPending,
  };
}

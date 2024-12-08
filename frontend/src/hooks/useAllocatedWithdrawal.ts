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

export function useAllocatedWithdrawal() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const { showNotification } = useNotification();

  const allocatedWithdrawal = async (transferPayload: BasicTransfer) => {
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
        abi: [COMPACT_ABI.find((x) => x.name === 'allocatedWithdrawal')] as const,
        functionName: 'allocatedWithdrawal',
        args: [transferPayload],
        account: address,
        chain,
      });

      showNotification({
        type: 'success',
        title: 'Transaction Submitted',
        message: 'Your withdrawal transaction has been submitted.',
      });

      return hash;
    } catch (error) {
      console.error('Withdrawal error:', error);
      showNotification({
        type: 'error',
        title: 'Transaction Failed',
        message:
          error instanceof Error ? error.message : 'Failed to submit withdrawal',
      });
      throw error;
    }
  };

  return {
    allocatedWithdrawal,
    isPending,
  };
}

import { useWriteContract, useChainId, useAccount } from 'wagmi';
import { type Chain } from 'viem';
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
  const { writeContract } = useWriteContract();
  const { showNotification } = useNotification();

  const deposit = async (params: DepositParams) => {
    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain');
    }

    const chain = chains[chainId];
    if (!chain) {
      throw new Error('Chain configuration not found');
    }

    try {
      if (params.isNative) {
        const hash = await writeContract({
          address: COMPACT_ADDRESS as `0x${string}`,
          abi: [COMPACT_ABI[0]] as const,
          functionName: 'deposit',
          args: [params.allocator],
          value: params.value,
          account: address,
          chain,
        });
        showNotification({
          type: 'success',
          title: 'Transaction Submitted',
          message: 'Your deposit transaction has been submitted.',
        });
        return hash;
      } else {
        // TypeScript now knows this is TokenDeposit
        const tokenParams = params as TokenDeposit;
        const hash = await writeContract({
          address: COMPACT_ADDRESS as `0x${string}`,
          abi: [COMPACT_ABI[1]] as const,
          functionName: 'deposit',
          args: [tokenParams.token, tokenParams.allocator, tokenParams.amount],
          account: address,
          chain,
        });
        showNotification({
          type: 'success',
          title: 'Transaction Submitted',
          message: 'Your deposit transaction has been submitted.',
        });
        return hash;
      }
    } catch (error) {
      console.error('Deposit error:', error);
      showNotification({
        type: 'error',
        title: 'Transaction Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to submit transaction',
      });
      throw error;
    }
  };

  const enableForcedWithdrawal = async (params: WithdrawalParams) => {
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
        abi: [COMPACT_ABI[2]] as const,
        functionName: 'enableForcedWithdrawal',
        args: params.args as [bigint],
        account: address,
        chain,
      });

      return hash;
    } catch (error) {
      console.error('Enable forced withdrawal error:', error);
      throw error;
    }
  };

  const disableForcedWithdrawal = async (params: WithdrawalParams) => {
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
        abi: [COMPACT_ABI[3]] as const,
        functionName: 'disableForcedWithdrawal',
        args: params.args as [bigint],
        account: address,
        chain,
      });

      return hash;
    } catch (error) {
      console.error('Disable forced withdrawal error:', error);
      throw error;
    }
  };

  const forcedWithdrawal = async (params: WithdrawalParams) => {
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
        abi: [COMPACT_ABI[4]] as const,
        functionName: 'forcedWithdrawal',
        args: params.args as [bigint, `0x${string}`, bigint],
        account: address,
        chain,
      });

      return hash;
    } catch (error) {
      console.error('Forced withdrawal error:', error);
      throw error;
    }
  };

  return {
    deposit,
    enableForcedWithdrawal,
    disableForcedWithdrawal,
    forcedWithdrawal,
    isSupported: isSupportedChain(chainId),
  };
}

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

  const deposit = async ({
    args,
    value,
    isNative = false,
  }: {
    args: [string] | [string, string, bigint];
    value: bigint;
    isNative?: boolean;
  }) => {
    const contractAddress = getContractAddress();
    if (!contractAddress) throw new Error('Contract address not found for current network');

    showNotification({
      type: 'info',
      title: 'Transaction Initiated',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
      autoHide: false,
    });

    // Select the appropriate ABI fragment based on whether it's a native deposit or not
    const abiFragment = COMPACT_ABI.find(entry => 
      entry.name === 'deposit' && 
      (isNative ? entry.stateMutability === 'payable' : entry.stateMutability === 'nonpayable')
    );
    
    if (!abiFragment) {
      throw new Error('ABI fragment not found for deposit function');
    }

    const { data } = await writeContract({
      address: contractAddress,
      abi: [abiFragment],
      functionName: 'deposit',
      args: isNative ? [args[0]] : [args[0], args[1], args[2]],
      value,
    });

    const hash = data.hash;

    showNotification({
      type: 'success',
      title: 'Transaction Submitted',
      message: 'Waiting for block inclusion...',
      stage: 'submitted',
      txHash: hash,
      autoHide: false,
    });

    // Wait for the transaction receipt
    // await waitForTransaction(config, { hash })

    showNotification({
      type: 'success',
      title: 'Transaction Confirmed',
      message: 'Your deposit has been confirmed',
      stage: 'confirmed',
      txHash: hash,
      autoHide: true,
    });

    // Trigger a balance refetch after the transaction
    // await refetchBalance()
    return hash;
  };


  const enableForcedWithdrawal = async ({ args }: { args: [bigint] }) => {
    showNotification({
      type: 'info',
      title: 'Transaction Initiated',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
      autoHide: false,
    });

    const { data } = await writeContract({
      abi: COMPACT_ABI,
      address: getContractAddress(),
      functionName: 'enableForcedWithdrawal',
      args,
    });

    const hash = data.hash;

    showNotification({
      type: 'success',
      title: 'Transaction Submitted',
      message: 'Waiting for block inclusion...',
      stage: 'submitted',
      txHash: hash,
      autoHide: false,
    });

    // Wait for the transaction receipt
    // await waitForTransaction(config, { hash })

    showNotification({
      type: 'success',
      title: 'Transaction Confirmed',
      message: 'Forced withdrawal has been enabled',
      stage: 'confirmed',
      txHash: hash,
      autoHide: true,
    });

    // Trigger a balance refetch after the transaction
    // await refetchBalance()
    return hash;
  };

  const disableForcedWithdrawal = async ({ args }: { args: [bigint] }) => {
    showNotification({
      type: 'info',
      title: 'Transaction Initiated',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
      autoHide: false,
    });

    const { data } = await writeContract({
      abi: COMPACT_ABI,
      address: getContractAddress(),
      functionName: 'disableForcedWithdrawal',
      args,
    });

    const hash = data.hash;

    showNotification({
      type: 'success',
      title: 'Transaction Submitted',
      message: 'Waiting for block inclusion...',
      stage: 'submitted',
      txHash: hash,
      autoHide: false,
    });

    // Wait for the transaction receipt
    // await waitForTransaction(config, { hash })

    showNotification({
      type: 'success',
      title: 'Transaction Confirmed',
      message: 'Forced withdrawal has been disabled',
      stage: 'confirmed',
      txHash: hash,
      autoHide: true,
    });

    // Trigger a balance refetch after the transaction
    // await refetchBalance()
    return hash;
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
      const { data } = await writeContract({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: [COMPACT_ABI.find((x) => x.name === 'forcedWithdrawal')] as const,
        functionName: 'forcedWithdrawal',
        args,
        account: address,
        chain,
      });

      const hash = data.hash;

      showNotification({
        type: 'success',
        title: 'Transaction Submitted',
        message: 'Your forced withdrawal transaction has been submitted.',
      });
      return hash;
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
  };
}

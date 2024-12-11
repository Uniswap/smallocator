import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useAccount, useChainId, usePublicClient } from 'wagmi';
import { formatUnits, isAddress, type Hash } from 'viem';
import { ERC20_ABI, COMPACT_ADDRESS } from '../constants/contracts';
import { useNotification } from './useNotification';

// Max uint256 value for infinite approval
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export function useERC20(tokenAddress?: `0x${string}`) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { showNotification } = useNotification();
  const [isValid, setIsValid] = useState(false);
  const [decimals, setDecimals] = useState<number>();
  const [symbol, setSymbol] = useState<string>();
  const [name, setName] = useState<string>();
  const [balance, setBalance] = useState<string>();
  const [allowance, setAllowance] = useState<string>();
  const [rawBalance, setRawBalance] = useState<bigint>();
  const [rawAllowance, setRawAllowance] = useState<bigint>();
  const [isLoading, setIsLoading] = useState(false);
  const [, setHash] = useState<Hash | undefined>();

  const shouldLoad = Boolean(tokenAddress && isAddress(tokenAddress));
  const compactAddress = COMPACT_ADDRESS as `0x${string}`;

  // Read token info
  const { data: decimalsData, isLoading: isLoadingDecimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: shouldLoad,
    },
  });

  const { data: symbolData, isLoading: isLoadingSymbol } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: shouldLoad,
    },
  });

  const { data: nameData, isLoading: isLoadingName } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'name',
    query: {
      enabled: shouldLoad,
    },
  });

  const { data: balanceData, isLoading: isLoadingBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: shouldLoad && Boolean(address),
    },
  });

  const { data: allowanceData, isLoading: isLoadingAllowance } =
    useReadContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address!, compactAddress],
      query: {
        enabled: shouldLoad && Boolean(address),
      },
    });

  // Update loading state
  useEffect(() => {
    if (!shouldLoad) {
      setIsLoading(false);
      return;
    }
    setIsLoading(
      isLoadingDecimals ||
        isLoadingSymbol ||
        isLoadingName ||
        isLoadingBalance ||
        isLoadingAllowance
    );
  }, [
    shouldLoad,
    isLoadingDecimals,
    isLoadingSymbol,
    isLoadingName,
    isLoadingBalance,
    isLoadingAllowance,
  ]);

  // Update state when data changes
  useEffect(() => {
    if (decimalsData !== undefined && symbolData && nameData) {
      setIsValid(true);
      setDecimals(Number(decimalsData));
      setSymbol(symbolData as string);
      setName(nameData as string);
    } else if (shouldLoad) {
      setIsValid(false);
    }
  }, [decimalsData, symbolData, nameData, shouldLoad]);

  // Update balance
  useEffect(() => {
    if (balanceData !== undefined && decimals !== undefined) {
      setRawBalance(balanceData as bigint);
      setBalance(formatUnits(balanceData as bigint, decimals));
    }
  }, [balanceData, decimals]);

  // Update allowance
  useEffect(() => {
    if (allowanceData !== undefined && decimals !== undefined) {
      setRawAllowance(allowanceData as bigint);
      setAllowance(formatUnits(allowanceData as bigint, decimals));
    }
  }, [allowanceData, decimals]);

  const { writeContractAsync } = useWriteContract();

  const approve = async (): Promise<Hash> => {
    if (!tokenAddress || !address) throw new Error('Not ready');
    if (!publicClient) throw new Error('Public client not available');

    // Generate a temporary transaction ID for linking notifications
    const tempTxId = `pending-${Date.now()}`;

    showNotification({
      type: 'info',
      title: 'Initiating Approval',
      message: 'Please confirm the transaction in your wallet...',
      stage: 'initiated',
      txHash: tempTxId,
      chainId,
      autoHide: false,
    });

    try {
      const newHash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [compactAddress, MAX_UINT256 as `0x${string}`],
      });

      showNotification({
        type: 'success',
        title: 'Approval Submitted',
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
              title: 'Approval Confirmed',
              message: `Successfully approved ${symbol || 'token'} for The Compact`,
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
    isValid,
    decimals,
    symbol,
    name,
    balance,
    allowance,
    rawBalance,
    rawAllowance,
    approve,
    isLoading,
  };
}

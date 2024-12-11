import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useAccount, useChainId, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, isAddress, type Hash } from 'viem';
import { ERC20_ABI, COMPACT_ADDRESS } from '../constants/contracts';
import { useNotification } from './useNotification';

// Max uint256 value for infinite approval
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export function useERC20(tokenAddress?: `0x${string}`) {
  const { address } = useAccount();
  const chainId = useChainId();
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
  const [hash, setHash] = useState<Hash>();

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

  // Watch for transaction confirmation
  useWaitForTransactionReceipt({
    hash,
    onSuccess(data) {
      if (data.status === 'success') {
        showNotification({
          type: 'success',
          title: 'Approval Confirmed',
          message: `Successfully approved ${symbol || 'token'} for The Compact`,
          txHash: hash,
          chainId,
          autoHide: false,
        });
      }
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

    const newHash = await writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [compactAddress, MAX_UINT256 as `0x${string}`],
    });

    setHash(newHash);
    return newHash;
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

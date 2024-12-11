import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { formatUnits, parseUnits, isAddress, type Hash } from 'viem';
import { ERC20_ABI } from '../constants/contracts';

export function useERC20(tokenAddress?: `0x${string}`) {
  const { address } = useAccount();
  const [isValid, setIsValid] = useState(false);
  const [decimals, setDecimals] = useState<number>();
  const [symbol, setSymbol] = useState<string>();
  const [name, setName] = useState<string>();
  const [balance, setBalance] = useState<string>();
  const [allowance, setAllowance] = useState<string>();
  const [rawBalance, setRawBalance] = useState<bigint>();
  const [rawAllowance, setRawAllowance] = useState<bigint>();
  const [isLoading, setIsLoading] = useState(false);

  const shouldLoad = Boolean(tokenAddress && isAddress(tokenAddress));

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
      args: [address!, tokenAddress!],
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

    return writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [tokenAddress, parseUnits('1000000', decimals || 18)],
    });
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

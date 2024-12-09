import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
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

  // Read token info
  const { data: decimalsData } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: Boolean(tokenAddress),
    },
  });

  const { data: symbolData } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: Boolean(tokenAddress),
    },
  });

  const { data: nameData } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'name',
    query: {
      enabled: Boolean(tokenAddress),
    },
  });

  const { data: balanceData } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: Boolean(tokenAddress && address),
    },
  });

  const { data: allowanceData } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, tokenAddress!],
    query: {
      enabled: Boolean(tokenAddress && address),
    },
  });

  const { writeContract } = useWriteContract();

  // Update state when data changes
  useEffect(() => {
    if (decimalsData !== undefined && symbolData && nameData) {
      setIsValid(true);
      setDecimals(Number(decimalsData));
      setSymbol(symbolData as string);
      setName(nameData as string);
    } else {
      setIsValid(false);
    }
  }, [decimalsData, symbolData, nameData]);

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

  const approve = async () => {
    if (!tokenAddress || !address) throw new Error('Not ready');

    const hash = await writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [tokenAddress, parseUnits('1000000', decimals || 18)],
    });

    return hash;
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
    isLoading: !decimalsData || !symbolData || !nameData,
  };
}

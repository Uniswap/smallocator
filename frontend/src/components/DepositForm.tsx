import { useState } from 'react';
import { useAccount, useBalance, useChainId } from 'wagmi';
import { formatEther, parseEther, parseUnits, isAddress } from 'viem';
import { useCompact } from '../hooks/useCompact';
import { useNotification } from '../hooks/useNotification';
import { useERC20 } from '../hooks/useERC20';
import { useAllocatorAPI } from '../hooks/useAllocatorAPI';

// Chain name mapping
const chainNames: Record<string, string> = {
  '1': 'Ethereum',
  '10': 'Optimism',
  '8453': 'Base',
};
type TokenType = 'native' | 'erc20';

export function DepositForm() {
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const chainId = useChainId();
  const [amount, setAmount] = useState('');
  const [tokenType, setTokenType] = useState<TokenType>('native');
  const [tokenAddress, setTokenAddress] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const { deposit, isConfirming, isConfirmed } = useCompact();
  const { showNotification } = useNotification();
  const { allocatorAddress } = useAllocatorAPI();
  const {
    balance,
    allowance,
    decimals,
    rawBalance,
    rawAllowance,
    approve,
    name,
    symbol,
    isValid,
    isLoading: isLoadingToken,
  } = useERC20(
    tokenType === 'erc20' && tokenAddress
      ? (tokenAddress as `0x${string}`)
      : undefined
  );

  const validateAmount = () => {
    if (!amount) return null;

    // Check if amount is zero or negative for both token types
    try {
      const numAmount = parseFloat(amount);
      if (numAmount <= 0) {
        return { type: 'error', message: 'Amount must be greater than zero' };
      }
    } catch {
      return { type: 'error', message: 'Invalid amount format' };
    }

    // For ERC20 tokens
    if (tokenType === 'erc20') {
      if (!tokenAddress || decimals === undefined) return null;

      // Check decimal places
      const decimalParts = amount.split('.');
      if (decimalParts.length > 1 && decimalParts[1].length > decimals) {
        return {
          type: 'error',
          message: `Invalid amount (greater than ${decimals} decimals)`,
        };
      }

      try {
        const parsedAmount = parseUnits(amount, decimals);
        const allowanceBigInt = rawAllowance
          ? BigInt(rawAllowance.toString())
          : BigInt(0);
        const balanceBigInt = rawBalance
          ? BigInt(rawBalance.toString())
          : BigInt(0);

        if (rawBalance && parsedAmount > balanceBigInt) {
          const chainName = chainNames[chainId] || `Chain ${chainId}`;
          return {
            type: 'error',
            message: `Insufficient ${symbol || 'token'} balance on ${chainName}`,
          };
        }
        if (parsedAmount > allowanceBigInt) {
          return { type: 'warning', message: 'Insufficient Allowance' };
        }
        return null;
      } catch {
        return { type: 'error', message: 'Invalid amount format' };
      }
    }

    // For native ETH
    if (tokenType === 'native' && ethBalance) {
      try {
        const parsedAmount = parseEther(amount);
        if (parsedAmount > ethBalance.value) {
          const chainName = chainNames[chainId] || `Chain ${chainId}`;
          return {
            type: 'error',
            message: `Insufficient native token balance on ${chainName}`,
          };
        }
        return null;
      } catch {
        return { type: 'error', message: 'Invalid amount format' };
      }
    }

    return null;
  };

  const amountValidation = validateAmount();

  const handleDeposit = async () => {
    if (!amount || isNaN(Number(amount))) {
      showNotification({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Please enter a valid amount',
      });
      return;
    }

    if (!allocatorAddress) {
      showNotification({
        type: 'error',
        title: 'No Allocator Available',
        message: 'Unable to get allocator address',
      });
      return;
    }

    if (!address) {
      showNotification({
        type: 'error',
        title: 'Wallet Not Connected',
        message: 'Please connect your wallet',
      });
      return;
    }

    const sessionId = localStorage.getItem(`session-${address}`);
    if (!sessionId) {
      showNotification({
        type: 'error',
        title: 'Not Signed In',
        message: 'Please sign in with your Ethereum account',
      });
      return;
    }

    try {
      const hexAllocatorAddress = allocatorAddress as `0x${string}`;

      if (tokenType === 'native') {
        const parsedAmount = parseEther(amount);
        await deposit({
          allocator: hexAllocatorAddress,
          value: parsedAmount,
          displayValue: amount,
          isNative: true,
        });
      } else {
        const parsedAmount = parseUnits(amount, decimals!);
        await deposit({
          token: tokenAddress as `0x${string}`,
          allocator: hexAllocatorAddress,
          amount: parsedAmount,
          displayAmount: amount,
          symbol: symbol || 'tokens',
          isNative: false,
        });
      }

      // Reset form after confirmed
      if (isConfirmed) {
        setAmount('');
        if (tokenType === 'erc20') {
          setTokenAddress('');
        }
      }
    } catch (error) {
      console.error('Error depositing:', error);
      // Only show notification if it's not a user rejection
      if (
        !(
          error instanceof Error &&
          error.message.toLowerCase().includes('user rejected')
        )
      ) {
        showNotification({
          type: 'error',
          title: 'Deposit Failed',
          message: error instanceof Error ? error.message : 'Failed to deposit',
        });
      }
    }
  };

  const handleApprove = async () => {
    if (!tokenAddress) return;

    try {
      setIsApproving(true);
      await approve();

      showNotification({
        type: 'success',
        title: 'Approval Submitted',
        message:
          'Please wait while the approval transaction is being confirmed...',
      });
    } catch (error) {
      console.error('Error approving:', error);
      showNotification({
        type: 'error',
        title: 'Approval Failed',
        message:
          error instanceof Error
            ? `Approval failed: ${error.message}`
            : 'Failed to approve token',
      });
    } finally {
      setIsApproving(false);
    }
  };

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="mx-auto p-6 bg-[#0a0a0a] rounded-lg shadow-xl border border-gray-800">
      <div className="border-b border-gray-800 pb-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-100">Deposit</h2>
        <p className="mt-1 text-sm text-gray-400">
          Deposit Ether or ERC20 tokens into a reusable resource lock.
        </p>
      </div>

      <div className="space-y-6">
        {/* Token Type Selection */}
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setTokenType('native')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              tokenType === 'native'
                ? 'bg-[#00ff00] text-gray-900'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            ETH
          </button>
          <button
            type="button"
            onClick={() => setTokenType('erc20')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              tokenType === 'erc20'
                ? 'bg-[#00ff00] text-gray-900'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            ERC20
          </button>
        </div>

        {/* Token Address Input (for ERC20) */}
        {tokenType === 'erc20' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Token Address
            </label>
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x..."
              className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-gray-300 focus:outline-none transition-colors ${
                !isValid && tokenAddress && !isLoadingToken
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-700 focus:border-[#00ff00]'
              }`}
            />
            {tokenAddress && !isValid && !isLoadingToken && (
              <p className="mt-1 text-sm text-red-500">Invalid token address</p>
            )}
            {isLoadingToken && isAddress(tokenAddress) && (
              <p className="mt-1 text-sm text-yellow-500">
                Loading token info...
              </p>
            )}
            {isValid && name && symbol && (
              <div className="mt-1">
                <div className="flex justify-between items-center text-sm text-gray-400">
                  <span>
                    {name} ({symbol})
                  </span>
                  <span>
                    Allowance on The Compact:{' '}
                    {Number(allowance || '0').toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                      minimumFractionDigits: 0,
                    })}{' '}
                    {symbol}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Amount Input */}
        {(tokenType === 'native' || (tokenType === 'erc20' && isValid)) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Amount
              {tokenType === 'native' && ethBalance && (
                <span className="float-right text-gray-400">
                  Balance: {formatEther(ethBalance.value)} ETH
                </span>
              )}
              {tokenType === 'erc20' && balance && (
                <span className="float-right text-gray-400">
                  Balance: {balance} {symbol}
                </span>
              )}
            </label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-gray-300 focus:outline-none transition-colors ${
                amountValidation?.type === 'error'
                  ? 'border-red-500 focus:border-red-500'
                  : amountValidation?.type === 'warning'
                    ? 'border-yellow-500 focus:border-yellow-500'
                    : 'border-gray-700 focus:border-[#00ff00]'
              }`}
            />
            {amountValidation && (
              <p
                className={`mt-1 text-sm ${
                  amountValidation.type === 'error'
                    ? 'text-red-500'
                    : 'text-yellow-500'
                }`}
              >
                {amountValidation.message}
              </p>
            )}
          </div>
        )}

        {/* Submit Buttons */}
        {amountValidation?.type === 'warning' && (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full py-2 px-4 mb-2 bg-yellow-500 text-gray-900 rounded-lg font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </button>
        )}
        <button
          onClick={handleDeposit}
          disabled={
            isConfirming ||
            !amount ||
            !allocatorAddress ||
            amountValidation?.type === 'error' ||
            amountValidation?.type === 'warning' ||
            (tokenType === 'erc20' && (!tokenAddress || !isValid))
          }
          className="w-full py-2 px-4 bg-[#00ff00] text-gray-900 rounded-lg font-medium hover:bg-[#00dd00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConfirming ? 'Depositing...' : 'Deposit'}
        </button>
      </div>
    </div>
  );
}

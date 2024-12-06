import { useState, useEffect } from 'react';
import { formatUnits, parseUnits, isAddress } from 'viem';
import { useAccount, useChainId } from 'wagmi';
import { switchNetwork } from '@wagmi/core';
import { useCompact } from '../hooks/useCompact';
import { useNotification } from '../context/NotificationContext';
import { config } from '../config/wagmi';

interface ForcedWithdrawalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lockId: string;
  maxAmount: string;
  decimals: number;
  symbol: string;
  tokenName: string;
  chainId: number;
}

export function ForcedWithdrawalDialog({
  isOpen,
  onClose,
  lockId,
  maxAmount,
  decimals,
  symbol,
  tokenName,
  chainId: targetChainId,
}: ForcedWithdrawalDialogProps) {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const [amountType, setAmountType] = useState<'max' | 'custom'>('max');
  const [recipientType, setRecipientType] = useState<'self' | 'custom'>('self');
  const [customAmount, setCustomAmount] = useState('');
  const [customRecipient, setCustomRecipient] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { forcedWithdrawal } = useCompact();
  const { showNotification } = useNotification();

  // Switch network when dialog opens
  useEffect(() => {
    if (isOpen && targetChainId !== currentChainId) {
      const switchToNetwork = async () => {
        try {
          showNotification({
            type: 'success',
            title: 'Switching Network',
            message: `Switching to chain ID ${targetChainId}...`,
          });

          await switchNetwork(config, { chainId: targetChainId });
          // Wait a bit for the network switch to complete
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('Error switching network:', error);
          showNotification({
            type: 'error',
            title: 'Network Switch Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to switch network',
          });
          onClose();
        }
      };

      switchToNetwork();
    }
  }, [isOpen, targetChainId, currentChainId, showNotification, onClose]);

  const formattedMaxAmount = formatUnits(BigInt(maxAmount), decimals);

  const validateAmount = () => {
    if (!customAmount) return null;

    try {
      // Check if amount is zero or negative
      const numAmount = parseFloat(customAmount);
      if (numAmount <= 0) {
        return { type: 'error', message: 'Amount must be greater than zero' };
      }

      // Check decimal places
      const decimalParts = customAmount.split('.');
      if (decimalParts.length > 1 && decimalParts[1].length > decimals) {
        return {
          type: 'error',
          message: `Invalid amount (greater than ${decimals} decimals)`,
        };
      }

      // Check against max amount
      const parsedAmount = parseUnits(customAmount, decimals);
      const maxAmountBigInt = BigInt(maxAmount);
      if (parsedAmount > maxAmountBigInt) {
        return { type: 'error', message: 'Amount exceeds available balance' };
      }

      return null;
    } catch {
      return { type: 'error', message: 'Invalid amount format' };
    }
  };

  const amountValidation = validateAmount();

  // Validate recipient
  const getRecipientError = () => {
    if (recipientType !== 'custom' || !customRecipient) return '';
    if (!isAddress(customRecipient)) return 'Invalid address format';
    return '';
  };

  const recipientError = getRecipientError();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (amountValidation || recipientError) return;

    try {
      setIsLoading(true);
      const amount =
        amountType === 'max'
          ? BigInt(maxAmount)
          : parseUnits(customAmount, decimals);
      const recipient =
        recipientType === 'self' ? address : (customRecipient as `0x${string}`);

      await forcedWithdrawal({
        args: [BigInt(lockId), recipient, amount],
      });

      showNotification({
        type: 'success',
        title: 'Forced Withdrawal Executed',
        message: `Successfully withdrew ${amountType === 'max' ? formattedMaxAmount : customAmount} ${symbol}`,
      });

      // Reset form and close
      setAmountType('max');
      setRecipientType('self');
      setCustomAmount('');
      setCustomRecipient('');
      onClose();
    } catch (error) {
      console.error('Error executing forced withdrawal:', error);
      showNotification({
        type: 'error',
        title: 'Withdrawal Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to execute withdrawal',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0a0a0a] rounded-lg shadow-xl border border-gray-800 p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold text-gray-100 mb-2">
          Execute Forced Withdrawal
        </h2>
        <div className="text-sm text-gray-400 mb-6">
          <div>
            {tokenName} ({symbol})
          </div>
          <div>Chain ID {targetChainId}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount ({symbol})
            </label>
            <div className="space-y-2">
              <select
                value={amountType}
                onChange={(e) =>
                  setAmountType(e.target.value as 'max' | 'custom')
                }
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors appearance-none pr-8"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156 163 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem',
                }}
                disabled={isLoading}
              >
                <option value="max">
                  Max ({formattedMaxAmount} {symbol})
                </option>
                <option value="custom">Custom Amount</option>
              </select>
              {amountType === 'custom' && (
                <div>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="0.0"
                    className={`w-full px-3 py-2 bg-gray-800 border ${
                      amountValidation?.type === 'error'
                        ? 'border-red-500'
                        : 'border-gray-700'
                    } rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors`}
                    disabled={isLoading}
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
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recipient Address
            </label>
            <div className="space-y-2">
              <select
                value={recipientType}
                onChange={(e) =>
                  setRecipientType(e.target.value as 'self' | 'custom')
                }
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors appearance-none pr-8"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156 163 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem',
                }}
                disabled={isLoading}
              >
                <option value="self">Self ({address})</option>
                <option value="custom">Custom Address</option>
              </select>
              {recipientType === 'custom' && (
                <div>
                  <input
                    type="text"
                    value={customRecipient}
                    onChange={(e) => setCustomRecipient(e.target.value)}
                    placeholder="0x..."
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-gray-300 focus:outline-none transition-colors ${recipientError ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-[#00ff00]'}`}
                    disabled={isLoading}
                  />
                  {recipientError && (
                    <div className="mt-1 text-sm text-red-500">
                      {recipientError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                isLoading ||
                (amountType === 'custom' &&
                  (!customAmount || !!amountValidation)) ||
                (recipientType === 'custom' &&
                  (!customRecipient || !!recipientError))
              }
            >
              {isLoading ? 'Withdrawing...' : 'Execute Forced Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

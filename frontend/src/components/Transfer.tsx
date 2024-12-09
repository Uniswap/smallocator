import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useNotification } from '../hooks/useNotification';
import { useAllocatedTransfer } from '../hooks/useAllocatedTransfer';
import { useAllocatedWithdrawal } from '../hooks/useAllocatedWithdrawal';
import { useRequestAllocation } from '../hooks/useRequestAllocation';
import { COMPACT_ADDRESS, COMPACT_ABI } from '../constants/contracts';

interface TransferProps {
  chainId: string;
  resourceLockBalance: string;
  lockId: bigint;
  decimals: number;
  tokenName: {
    resourceLockName: string;
    resourceLockSymbol: string;
    tokenName: string;
  };
  tokenSymbol: string;
  withdrawalStatus: number;
  sessionToken: string | null;
  onForceWithdraw: () => void;
  onDisableForceWithdraw: () => void;
}

interface FormData {
  expires: string;
  recipient: string;
  amount: string;
  allocatorSignature?: string;
  nonce?: string;
}

interface WalletError extends Error {
  code: number;
}

interface EthereumProvider {
  request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
}

export function Transfer({
  chainId: targetChainId,
  resourceLockBalance,
  lockId,
  decimals,
  tokenName,
  tokenSymbol,
  withdrawalStatus,
  sessionToken,
  onForceWithdraw,
  onDisableForceWithdraw,
}: TransferProps) {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const [isOpen, setIsOpen] = useState(false);
  const [isWithdrawal, setIsWithdrawal] = useState(false);
  const [isWithdrawalLoading, setIsWithdrawalLoading] = useState(false);
  const [isRequestingAllocation, setIsRequestingAllocation] = useState(false);
  const [hasAllocation, setHasAllocation] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    expires: '',
    recipient: '',
    amount: '',
  });

  const { allocatedTransfer, isPending: isTransferLoading } = useAllocatedTransfer();
  const { allocatedWithdrawal, isPending: isWithdrawalPending } = useAllocatedWithdrawal();
  const { requestAllocation } = useRequestAllocation();
  const { showNotification } = useNotification();
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string | undefined }>({});

  // Check if nonce has been consumed
  const { data: isNonceConsumed } = useReadContract({
    address: COMPACT_ADDRESS[parseInt(targetChainId)] as `0x${string}`,
    abi: COMPACT_ABI,
    functionName: 'hasConsumedAllocatorNonce',
    args: formData.nonce && address ? [BigInt(formData.nonce), address as `0x${string}`] : undefined,
  });

  // Validate amount
  const validateAmount = useCallback(() => {
    if (!formData.amount) return null;

    try {
      // Check if amount is zero or negative
      const numAmount = parseFloat(formData.amount);
      if (numAmount <= 0) {
        return { type: 'error', message: 'Amount must be greater than zero' };
      }

      // Check decimal places
      const decimalParts = formData.amount.split('.');
      if (decimalParts.length > 1 && decimalParts[1].length > decimals) {
        return { type: 'error', message: `Invalid amount (greater than ${decimals} decimals)` };
      }

      // Check against resource lock balance
      const parsedAmount = parseUnits(formData.amount, decimals);
      const balanceBigInt = BigInt(resourceLockBalance);
      if (parsedAmount > balanceBigInt) {
        return { type: 'error', message: 'Amount exceeds available balance' };
      }

      return null;
    } catch {
      return { type: 'error', message: 'Invalid amount format' };
    }
  }, [formData.amount, decimals, resourceLockBalance]);

  // Update error message when nonce consumption status changes
  const nonceError = useMemo(() => {
    if (!formData.nonce) return undefined;
    if (isNonceConsumed) {
      return 'This nonce has already been consumed';
    }
    return undefined;
  }, [isNonceConsumed, formData.nonce]);

  // Update field errors when nonce error changes
  useEffect(() => {
    setFieldErrors(prev => ({
      ...prev,
      nonce: nonceError,
    }));
  }, [nonceError]);

  // Validate expiry
  const validateExpiry = (value: string) => {
    if (!value) return { type: 'error', message: 'Expiry is required' };
    
    const expiryTime = parseInt(value);
    const now = Math.floor(Date.now() / 1000);
    
    if (isNaN(expiryTime)) {
      return { type: 'error', message: 'Invalid expiry time' };
    }
    
    if (expiryTime <= now) {
      return { type: 'error', message: 'Expiry time must be in the future' };
    }
    
    return null;
  };

  // Update field errors when expiry changes
  useEffect(() => {
    const expiryValidation = validateExpiry(formData.expires);
    setFieldErrors(prev => ({
      ...prev,
      expires: expiryValidation?.message,
    }));
  }, [formData.expires]);

  const isFormValid = useMemo(() => {
    // Basic form validation
    if (!formData.expires || !formData.recipient || !formData.amount) {
      return false;
    }

    // Check for any field errors
    if (Object.values(fieldErrors).some(error => error !== undefined)) {
      return false;
    }

    // Check amount validation
    const amountValidation = validateAmount();
    if (amountValidation?.type === 'error') {
      return false;
    }

    return true;
  }, [formData, fieldErrors, validateAmount]);

  const handleAction = async (action: 'transfer' | 'withdraw' | 'force' | 'disable') => {
    // Check if we need to switch networks
    const targetChainIdNumber = parseInt(targetChainId);
    if (targetChainIdNumber !== currentChainId) {
      try {
        showNotification({
          type: 'success',
          title: 'Switching Network',
          message: `Please confirm the network switch in your wallet...`,
        });

        // Request network switch through the wallet
        const ethereum = window.ethereum as EthereumProvider | undefined;
        if (!ethereum) {
          throw new Error('No wallet detected');
        }

        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainIdNumber.toString(16)}` }],
        });

        // Wait a bit for the network switch to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if ((switchError as WalletError).code === 4902) {
          showNotification({
            type: 'error',
            title: 'Network Not Found',
            message: 'Please add this network to your wallet first.',
          });
        } else {
          showNotification({
            type: 'error',
            title: 'Network Switch Failed',
            message:
              switchError instanceof Error
                ? switchError.message
                : 'Failed to switch network. Please switch manually.',
          });
        }
        return;
      }
    }

    // Check if we have a valid address before proceeding
    if (!address) {
      showNotification({
        type: 'error',
        title: 'Error',
        message: 'Please connect your wallet first',
      });
      return;
    }

    if (action === 'force') {
      onForceWithdraw();
    } else if (action === 'disable') {
      setIsWithdrawalLoading(true);
      onDisableForceWithdraw();
      setIsWithdrawalLoading(false);
    } else {
      setIsWithdrawal(action === 'withdraw');
      setIsOpen(true);
    }
  };

  const handleRequestAllocation = async () => {
    if (!isFormValid || !sessionToken || !address) {
      if (!sessionToken) {
        showNotification({
          type: 'error',
          title: 'Session Required',
          message: 'Please sign in to request allocation',
        });
      }
      if (!address) {
        showNotification({
          type: 'error',
          title: 'Wallet Required',
          message: 'Please connect your wallet first',
        });
      }
      return;
    }

    try {
      setIsRequestingAllocation(true);

      const params = {
        chainId: targetChainId,
        compact: {
          // Set arbiter equal to sponsor (user's address)
          arbiter: address,
          sponsor: address,
          nonce: null,
          expires: formData.expires,
          id: lockId.toString(),
          amount: parseUnits(formData.amount, decimals).toString(),
          witnessTypeString: null,
          witnessHash: null,
        },
      };

      const response = await requestAllocation(params, sessionToken);

      setFormData(prev => ({
        ...prev,
        allocatorSignature: response.signature,
        nonce: response.nonce,
      }));

      setHasAllocation(true);
      showNotification({
        type: 'success',
        title: 'Allocation Requested',
        message: 'Successfully received allocation. You can now submit the transfer.',
      });
    } catch (error) {
      console.error('Error requesting allocation:', error);
      showNotification({
        type: 'error',
        title: 'Allocation Request Failed',
        message: error instanceof Error ? error.message : 'Failed to request allocation',
      });
    } finally {
      setIsRequestingAllocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !formData.allocatorSignature || !formData.nonce) return;

    try {
      // Validate recipient
      if (!formData.recipient?.startsWith('0x')) {
        throw new Error('Recipient must be a valid address starting with 0x');
      }
      
      try {
        // Convert values and prepare transfer struct
        const transfer = {
          allocatorSignature: formData.allocatorSignature as `0x${string}`,
          nonce: BigInt(formData.nonce),
          expires: BigInt(formData.expires),
          id: lockId,
          amount: parseUnits(formData.amount, decimals),
          recipient: formData.recipient as `0x${string}`,
        };

        // Submit transfer or withdrawal
        if (isWithdrawal) {
          await allocatedWithdrawal(transfer);
        } else {
          await allocatedTransfer(transfer);
        }

        showNotification({
          type: 'success',
          title: isWithdrawal ? 'Withdrawal Submitted' : 'Transfer Submitted',
          message: `Successfully submitted ${isWithdrawal ? 'withdrawal' : 'transfer'} of ${
            formData.amount
          } ${isWithdrawal ? tokenSymbol : tokenName.resourceLockSymbol}`,
        });

        // Reset form and close
        setFormData({
          expires: '',
          recipient: '',
          amount: '',
        });
        setHasAllocation(false);
        setIsOpen(false);
      } catch (conversionError) {
        console.error('Error converting values:', conversionError);
        throw new Error('Failed to convert input values. Please check all fields are valid.');
      }
    } catch (error) {
      console.error('Error submitting transfer:', error);
      showNotification({
        type: 'error',
        title: isWithdrawal ? 'Withdrawal Failed' : 'Transfer Failed',
        message: error instanceof Error ? error.message : `Failed to submit ${isWithdrawal ? 'withdrawal' : 'transfer'}`,
      });
    }
  };

  const [customExpiry, setCustomExpiry] = useState(false);
  const [expiryOption, setExpiryOption] = useState('10min');

  // Initialize default expiry on mount
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setFormData(prev => ({ ...prev, expires: (now + 600).toString() })); // 10 minutes default
  }, []);

  const handleExpiryChange = (value: string) => {
    setExpiryOption(value);
    const now = Math.floor(Date.now() / 1000);
    let newExpiry: string = '';

    if (value === 'custom') {
      setCustomExpiry(true);
      return;
    }

    setCustomExpiry(false);
    switch (value) {
      case '1min':
        newExpiry = (now + 60).toString();
        break;
      case '10min':
        newExpiry = (now + 600).toString();
        break;
      case '1hour':
        newExpiry = (now + 3600).toString();
        break;
    }

    if (newExpiry) {
      setFormData(prev => ({ ...prev, expires: newExpiry }));
      setFieldErrors(prev => ({ ...prev, expires: undefined }));
    }
  };

  return (
    <div className="inline-block">
      <div className="flex gap-2">
        <button
          onClick={() => handleAction('transfer')}
          className="mt-2 py-2 px-4 bg-[#00ff00] text-gray-900 rounded-lg font-medium hover:bg-[#00dd00] transition-colors"
        >
          Transfer
        </button>
        <button
          onClick={() => handleAction('withdraw')}
          className="mt-2 py-2 px-4 bg-[#00ff00] text-gray-900 rounded-lg font-medium hover:bg-[#00dd00] transition-colors"
        >
          Withdraw
        </button>
        {withdrawalStatus === 0 && (
          <button
            onClick={() => handleAction('force')}
            className="mt-2 py-2 px-4 bg-[#DC2626] text-white rounded-lg font-medium hover:opacity-90 transition-colors"
          >
            Initiate Forced Withdrawal
          </button>
        )}
        {withdrawalStatus !== 0 && (
          <button
            onClick={() => handleAction('disable')}
            disabled={isWithdrawalLoading}
            className="mt-2 py-2 px-4 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isWithdrawalLoading ? 'Disabling...' : 'Disable Forced Withdrawal'}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-100">
                {isWithdrawal ? (
                  <>
                    Submit Withdrawal
                    {tokenName.tokenName && ` - ${tokenName.tokenName}`}
                  </>
                ) : (
                  <>
                    Submit Transfer
                    {tokenName.resourceLockName && ` - ${tokenName.resourceLockName}`}
                  </>
                )}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-400"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expires
                </label>
                <div className="flex gap-2">
                  <select
                    value={expiryOption}
                    onChange={(e) => handleExpiryChange(e.target.value)}
                    className="w-full px-3 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
                  >
                    <option value="1min">1 minute</option>
                    <option value="10min">10 minutes</option>
                    <option value="1hour">1 hour</option>
                    <option value="custom">Custom</option>
                  </select>
                  {customExpiry && (
                    <input
                      type="text"
                      value={formData.expires}
                      onChange={(e) => {
                        const validation = validateExpiry(e.target.value);
                        setFieldErrors((prev) => ({
                          ...prev,
                          expires: validation?.message,
                        }));
                        setFormData((prev) => ({ ...prev, expires: e.target.value }));
                      }}
                      placeholder="Unix timestamp"
                      className={`w-full px-3 py-2 bg-gray-800 border ${
                        fieldErrors.expires ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors`}
                    />
                  )}
                </div>
                {fieldErrors.expires && (
                  <p className="mt-1 text-sm text-red-500">{fieldErrors.expires}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={formData.recipient}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, recipient: e.target.value }))
                  }
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount
                  <span className="float-right text-gray-400">
                    Balance: {formatUnits(BigInt(resourceLockBalance), decimals)}{' '}
                    {isWithdrawal ? tokenSymbol : tokenName.resourceLockSymbol}
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="0.0"
                  className={`w-full px-3 py-2 bg-gray-800 border ${
                    validateAmount()?.type === 'error' ? 'border-red-500' : 'border-gray-700'
                  } rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors`}
                />
                {validateAmount() && (
                  <p
                    className={`mt-1 text-sm ${
                      validateAmount()?.type === 'error' ? 'text-red-500' : 'text-yellow-500'
                    }`}
                  >
                    {validateAmount()?.message}
                  </p>
                )}
              </div>

              {!hasAllocation ? (
                <button
                  type="button"
                  onClick={handleRequestAllocation}
                  disabled={!isFormValid || isRequestingAllocation}
                  className="w-full py-2 px-4 bg-[#00ff00] text-gray-900 rounded-lg font-medium hover:bg-[#00dd00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequestingAllocation ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Requesting Allocation...
                    </span>
                  ) : (
                    'Request Allocation'
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!isFormValid || isTransferLoading || isWithdrawalPending}
                  className="w-full py-2 px-4 bg-[#00ff00] text-gray-900 rounded-lg font-medium hover:bg-[#00dd00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTransferLoading || isWithdrawalPending ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {isWithdrawal ? 'Submitting Withdrawal...' : 'Submitting Transfer...'}
                    </span>
                  ) : (
                    <>{isWithdrawal ? 'Submit Withdrawal' : 'Submit Transfer'}</>
                  )}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

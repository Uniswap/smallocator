import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { parseUnits, isAddress } from 'viem';
import { useNotification } from '../hooks/useNotification';
import { useAllocatedTransfer } from '../hooks/useAllocatedTransfer';
import { useAllocatedWithdrawal } from '../hooks/useAllocatedWithdrawal';
import { useRequestAllocation } from '../hooks/useRequestAllocation';
import { COMPACT_ADDRESS, COMPACT_ABI } from '../constants/contracts';

interface FormData {
  expires: string;
  recipient: string;
  amount: string;
  allocatorSignature?: string;
  nonce?: string;
  hash?: string;
}

interface WalletError extends Error {
  code: number;
}

interface EthereumProvider {
  request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

// Chain name mapping
const chainNames: Record<string, string> = {
  '1': 'Ethereum',
  '10': 'Optimism',
  '8453': 'Base',
};

// Constants for time limits
const TWO_HOURS_SECONDS = 7200; // 2 hours in seconds

export function useTransfer(
  targetChainId: string,
  resourceLockBalance: string,
  lockId: bigint,
  decimals: number,
  _tokenName: {
    resourceLockName: string;
    resourceLockSymbol: string;
    tokenName: string;
  },
  tokenSymbol: string,
  _withdrawalStatus: number,
  sessionToken: string | null,
  onForceWithdraw: () => void,
  onDisableForceWithdraw: () => void,
  balanceAvailableToAllocate: string,
  resetPeriod: number
) {
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

  const { allocatedTransfer, isConfirming: isTransferLoading } =
    useAllocatedTransfer();
  const { allocatedWithdrawal, isConfirming: isWithdrawalConfirming } =
    useAllocatedWithdrawal();
  const { requestAllocation } = useRequestAllocation();
  const { showNotification } = useNotification();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [customExpiry, setCustomExpiry] = useState(false);
  const [expiryOption, setExpiryOption] = useState('10min');

  // Check if nonce has been consumed
  const { data: isNonceConsumed } = useReadContract({
    address: COMPACT_ADDRESS[parseInt(targetChainId)] as `0x${string}`,
    abi: COMPACT_ABI,
    functionName: 'hasConsumedAllocatorNonce',
    args:
      formData.nonce && address
        ? [BigInt(formData.nonce), address as `0x${string}`]
        : undefined,
  });

  // Reset form state
  const resetForm = useCallback(() => {
    setFormData({
      expires: '',
      recipient: '',
      amount: '',
    });
    setHasAllocation(false);
    setCustomExpiry(false);
    setExpiryOption('10min');
    setFieldErrors({});
    setIsOpen(false);
  }, []);

  // Initialize default expiry on mount
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setFormData((prev: FormData) => ({
      ...prev,
      expires: (now + 600).toString(),
    })); // 10 minutes default
  }, []);

  // Validation functions
  const validateAmount = useCallback(() => {
    if (!formData.amount || hasAllocation) return null;

    try {
      // Check if amount is zero or negative
      const numAmount = parseFloat(formData.amount);
      if (numAmount <= 0) {
        return { type: 'error', message: 'Amount must be greater than zero.' };
      }

      // Check decimal places
      const decimalParts = formData.amount.split('.');
      if (decimalParts.length > 1 && decimalParts[1].length > decimals) {
        return {
          type: 'error',
          message: `Invalid amount (greater than ${decimals} decimals).`,
        };
      }

      // Parse amounts for comparison
      const parsedAmount = parseUnits(formData.amount, decimals);
      const balanceBigInt = BigInt(resourceLockBalance || '0');
      const availableToAllocateBigInt = BigInt(
        balanceAvailableToAllocate || '0'
      );

      // First check if amount exceeds total balance
      if (parsedAmount > balanceBigInt) {
        return { type: 'error', message: 'Amount exceeds available balance.' };
      }

      // Then check if amount exceeds available to allocate
      if (parsedAmount > availableToAllocateBigInt) {
        return {
          type: 'error',
          message:
            'Amount exceeds balance currently available to allocate. Wait for pending allocations to clear or initiate a forced withdrawal.',
        };
      }

      return null;
    } catch {
      return { type: 'error', message: 'Invalid amount format.' };
    }
  }, [
    formData.amount,
    decimals,
    resourceLockBalance,
    balanceAvailableToAllocate,
    hasAllocation,
  ]);

  const validateRecipient = useCallback(() => {
    if (!formData.recipient || hasAllocation) return null;
    if (!isAddress(formData.recipient)) {
      return { type: 'error', message: 'Invalid address format.' };
    }
    return null;
  }, [formData.recipient, hasAllocation]);

  const validateExpiry = useCallback(
    (value: string) => {
      if (!value || hasAllocation) return null;

      const expiryTime = parseInt(value);
      const now = Math.floor(Date.now() / 1000);

      if (isNaN(expiryTime)) {
        return { type: 'error', message: 'Invalid expiry time.' };
      }

      if (expiryTime <= now) {
        return { type: 'error', message: 'Expiry time must be in the future.' };
      }

      const duration = expiryTime - now;

      // Check if duration exceeds 2 hours
      if (duration > TWO_HOURS_SECONDS) {
        return {
          type: 'error',
          message: 'Expiry cannot be more than 2 hours in the future.',
        };
      }

      // Check if expiry would exceed when tokens could be withdrawn
      // Ensure expiry is within reset period
      const resetPeriodSeconds = resetPeriod
        ? parseInt(String(resetPeriod))
        : undefined;
      const maxExpiryTime = resetPeriodSeconds
        ? Math.min(now + resetPeriodSeconds, now + TWO_HOURS_SECONDS)
        : now + TWO_HOURS_SECONDS;

      if (expiryTime > maxExpiryTime) {
        const timeLimit = resetPeriodSeconds
          ? Math.min(resetPeriodSeconds, TWO_HOURS_SECONDS)
          : TWO_HOURS_SECONDS;
        return {
          type: 'error',
          message: `Expiry cannot exceed ${Math.floor(timeLimit / 60)} minutes from now.`,
        };
      }

      return null;
    },
    [resetPeriod, hasAllocation]
  );

  // Update field errors when recipient changes
  useEffect(() => {
    if (!hasAllocation) {
      const recipientValidation = validateRecipient();
      setFieldErrors((prev: FieldErrors) => ({
        ...prev,
        recipient: recipientValidation?.message,
      }));
    }
  }, [formData.recipient, validateRecipient, hasAllocation]);

  // Update error message when nonce consumption status changes
  const nonceError = useMemo(() => {
    if (!formData.nonce) return undefined;
    if (isNonceConsumed) {
      return 'This nonce has already been consumed.';
    }
    return undefined;
  }, [isNonceConsumed, formData.nonce]);

  // Update field errors when nonce error changes
  useEffect(() => {
    setFieldErrors((prev: FieldErrors) => ({
      ...prev,
      nonce: nonceError,
    }));
  }, [nonceError]);

  // Update field errors when expiry changes
  useEffect(() => {
    if (!hasAllocation) {
      const expiryValidation = validateExpiry(formData.expires);
      setFieldErrors((prev: FieldErrors) => ({
        ...prev,
        expires: expiryValidation?.message,
      }));
    }
  }, [formData.expires, validateExpiry, hasAllocation]);

  const isFormValid = useMemo(() => {
    if (hasAllocation) return true;

    // Basic form validation
    if (!formData.expires || !formData.recipient || !formData.amount) {
      return false;
    }

    // Check for any field errors
    if (Object.values(fieldErrors).some((error) => error !== undefined)) {
      return false;
    }

    // Check amount validation
    const amountValidation = validateAmount();
    if (amountValidation?.type === 'error') {
      return false;
    }

    return true;
  }, [formData, fieldErrors, validateAmount, hasAllocation]);

  const handleAction = async (
    action: 'transfer' | 'withdraw' | 'force' | 'disable'
  ) => {
    // Check if we need to switch networks
    const targetChainIdNumber = parseInt(targetChainId);
    if (targetChainIdNumber !== currentChainId) {
      const tempTxId = `network-switch-${Date.now()}`;
      try {
        showNotification({
          type: 'info',
          title: 'Switching Network',
          message: `Please confirm the network switch in your wallet...`,
          txHash: tempTxId,
          autoHide: false,
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

        // Replace the switching notification with switched
        showNotification({
          type: 'success',
          title: 'Network Switched',
          message: `Successfully switched to ${chainNames[targetChainId] || `Chain ${targetChainId}`}`,
          txHash: tempTxId,
          autoHide: true,
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if ((switchError as WalletError).code === 4902) {
          showNotification({
            type: 'error',
            title: 'Network Not Found',
            message: 'Please add this network to your wallet first.',
            txHash: tempTxId,
            autoHide: true,
          });
        } else {
          console.error('Error switching network:', switchError);
          showNotification({
            type: 'error',
            title: 'Network Switch Failed',
            message:
              switchError instanceof Error
                ? switchError.message
                : 'Failed to switch network. Please switch manually.',
            txHash: tempTxId,
            autoHide: true,
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

      setFormData((prev: FormData) => ({
        ...prev,
        allocatorSignature: response.signature,
        nonce: response.nonce,
        hash: response.hash,
      }));

      setHasAllocation(true);
      showNotification({
        type: 'success',
        title: 'Allocation Requested',
        message:
          'Successfully received allocation. You can now submit the transfer.',
      });
    } catch (error) {
      console.error('Error requesting allocation:', error);
      showNotification({
        type: 'error',
        title: 'Allocation Request Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to request allocation',
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

        // Pass token information along with the transfer
        const tokenInfo = {
          decimals,
          symbol: tokenSymbol,
        };

        // Submit transfer or withdrawal
        if (isWithdrawal) {
          const hash = await allocatedWithdrawal(transfer, tokenInfo);
          if (hash) resetForm(); // Reset form immediately after getting transaction hash
        } else {
          const hash = await allocatedTransfer(transfer, tokenInfo);
          if (hash) resetForm(); // Reset form immediately after getting transaction hash
        }
      } catch (conversionError) {
        console.error('Error converting values:', conversionError);
        throw new Error(
          'Failed to convert input values. Please check all fields are valid.'
        );
      }
    } catch (error) {
      console.error('Error submitting transfer:', error);
      showNotification({
        type: 'error',
        title: isWithdrawal ? 'Withdrawal Failed' : 'Transfer Failed',
        message:
          error instanceof Error
            ? error.message
            : `Failed to submit ${isWithdrawal ? 'withdrawal' : 'transfer'}`,
      });
    }
  };

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
      case '5min':
        newExpiry = (now + 300).toString();
        break;
      case '10min':
        newExpiry = (now + 600).toString();
        break;
      case '1hour':
        newExpiry = (now + 3600).toString();
        break;
    }

    if (newExpiry) {
      setFormData((prev: FormData) => ({ ...prev, expires: newExpiry }));
      setFieldErrors((prev: FieldErrors) => ({ ...prev, expires: undefined }));
    }
  };

  const handleExpiryInputChange = (value: string) => {
    const validation = validateExpiry(value);
    setFieldErrors((prev: FieldErrors) => ({
      ...prev,
      expires: validation?.message,
    }));
    setFormData((prev: FormData) => ({
      ...prev,
      expires: value,
    }));
  };

  const handleRecipientChange = (value: string) => {
    setFormData((prev: FormData) => ({
      ...prev,
      recipient: value,
    }));
  };

  const handleAmountChange = (value: string) => {
    setFormData((prev: FormData) => ({
      ...prev,
      amount: value,
    }));
  };

  return {
    isOpen,
    setIsOpen,
    isWithdrawal,
    isWithdrawalLoading,
    isRequestingAllocation,
    hasAllocation,
    formData,
    fieldErrors,
    customExpiry,
    expiryOption,
    isTransferLoading,
    isWithdrawalConfirming,
    isFormValid,
    validateAmount,
    handleAction,
    handleRequestAllocation,
    handleSubmit,
    handleExpiryChange,
    handleExpiryInputChange,
    handleRecipientChange,
    handleAmountChange,
  };
}

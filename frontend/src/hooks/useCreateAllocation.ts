import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useBalances } from './useBalances';
import { useNotification } from './useNotification';
import { useAllocatorAPI } from './useAllocatorAPI';
import { parseUnits } from 'viem';

interface Token {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface ResourceLock {
  resetPeriod: number;
  isMultichain: boolean;
}

interface Balance {
  chainId: string;
  lockId: string;
  allocatableBalance: string;
  allocatedBalance: string;
  balanceAvailableToAllocate: string;
  withdrawalStatus: number;
  withdrawableAt: string;
  balance: string;
  tokenName: string;
  token?: Token;
  resourceLock?: ResourceLock;
  formattedAllocatableBalance?: string;
  decimals: number;
  symbol: string;
}

export const EXPIRY_OPTIONS = [
  { label: '1 minute', value: '1min', seconds: 60 },
  { label: '10 minutes', value: '10min', seconds: 600 },
  { label: '1 hour', value: '1hour', seconds: 3600 },
  { label: 'Custom', value: 'custom', seconds: 0 },
];

export function useCreateAllocation(sessionToken: string) {
  const { address, isConnected } = useAccount();
  const { balances, isLoading: isLoadingBalances } = useBalances();
  const { showNotification } = useNotification();
  const { createAllocation, getResourceLockDecimals } = useAllocatorAPI();

  const [formData, setFormData] = useState({
    lockId: '',
    amount: '',
    arbiterAddress: '',
    nonce: '',
    expiration: '',
    witnessHash: '',
    witnessTypestring: '',
  });

  const [errors, setErrors] = useState({
    lockId: '',
    amount: '',
    arbiterAddress: '',
    nonce: '',
    expiration: '',
  });

  const [showWitnessFields, setShowWitnessFields] = useState(false);
  const [selectedLock, setSelectedLock] = useState<Balance | null>(null);
  const [lockDecimals, setLockDecimals] = useState<number>(18);
  const [expiryOption, setExpiryOption] = useState('10min');
  const [customExpiry, setCustomExpiry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateNewNonce = useCallback(() => {
    if (address) {
      const addressBytes = address.slice(2);
      const randomBytes = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      const nonce = `0x${addressBytes}${randomBytes}`;
      setFormData((prev) => ({ ...prev, nonce }));
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      generateNewNonce();
    }
  }, [address, generateNewNonce]);

  useEffect(() => {
    const tenMinutesFromNow = Math.floor(Date.now() / 1000) + 600;
    setFormData((prev) => ({
      ...prev,
      expiration: tenMinutesFromNow.toString(),
    }));
  }, []);

  useEffect(() => {
    if (selectedLock) {
      getResourceLockDecimals(selectedLock.chainId, selectedLock.lockId)
        .then((decimals) => setLockDecimals(decimals))
        .catch(console.error);
    }
  }, [selectedLock, getResourceLockDecimals]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));

    if (name === 'lockId') {
      const lock = balances.find((b) => b.lockId === value);
      if (lock) {
        setSelectedLock({
          ...lock,
          balance: lock.allocatableBalance,
          tokenName: lock.token?.name || '',
          decimals: lock.token?.decimals || 18,
          symbol: lock.token?.symbol || '',
        });
      } else {
        setSelectedLock(null);
      }
    }
  };

  const handleExpiryChange = (value: string) => {
    setExpiryOption(value);
    const now = Math.floor(Date.now() / 1000);

    if (value === 'custom') {
      setCustomExpiry(true);
      return;
    }

    setCustomExpiry(false);
    const option = EXPIRY_OPTIONS.find((opt) => opt.value === value);
    if (option) {
      setFormData((prev) => ({
        ...prev,
        expiration: (now + option.seconds).toString(),
      }));
      setErrors((prev) => ({ ...prev, expiration: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {
      lockId: '',
      amount: '',
      arbiterAddress: '',
      nonce: '',
      expiration: '',
    };

    if (!formData.lockId) {
      newErrors.lockId = 'Resource lock is required';
    }

    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (selectedLock) {
      try {
        const amountBigInt = parseUnits(formData.amount, lockDecimals);
        const availableBigInt = BigInt(selectedLock.balanceAvailableToAllocate);
        if (amountBigInt > availableBigInt) {
          newErrors.amount = 'Amount exceeds available balance';
        }
      } catch {
        newErrors.amount = 'Invalid amount';
      }
    }

    if (!formData.arbiterAddress) {
      newErrors.arbiterAddress = 'Arbiter address is required';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.arbiterAddress)) {
      newErrors.arbiterAddress = 'Invalid address format';
    }

    if (!formData.nonce) {
      newErrors.nonce = 'Nonce is required';
    }

    if (!formData.expiration) {
      newErrors.expiration = 'Expiration is required';
    } else {
      const expirationTime = parseInt(formData.expiration);
      const now = Math.floor(Date.now() / 1000);
      if (isNaN(expirationTime) || expirationTime <= now) {
        newErrors.expiration = 'Expiration must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.values(newErrors).every((error) => !error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedLock || !address) return;

    try {
      setIsSubmitting(true);

      const request = {
        chainId: selectedLock.chainId.toString(),
        compact: {
          arbiter: formData.arbiterAddress as `0x${string}`,
          sponsor: address,
          nonce: formData.nonce,
          expires: formData.expiration,
          id: selectedLock.lockId,
          amount: parseUnits(formData.amount, lockDecimals).toString(),
          ...(showWitnessFields && {
            witnessTypeString: formData.witnessTypestring,
            witnessHash: formData.witnessHash,
          }),
        },
      };

      const result = await createAllocation(sessionToken, request);

      showNotification({
        type: 'success',
        title: 'Allocation Created',
        message: `Successfully created allocation with hash: ${result.hash}`,
      });

      setFormData({
        lockId: '',
        amount: '',
        arbiterAddress: '',
        nonce: '',
        expiration: '',
        witnessHash: '',
        witnessTypestring: '',
      });
      setShowWitnessFields(false);
      generateNewNonce();
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create allocation',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    errors,
    showWitnessFields,
    selectedLock,
    lockDecimals,
    expiryOption,
    customExpiry,
    isSubmitting,
    isConnected,
    isLoadingBalances,
    balances,
    handleInputChange,
    handleExpiryChange,
    handleSubmit,
    generateNewNonce,
    setShowWitnessFields,
  };
}

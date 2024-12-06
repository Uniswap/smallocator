import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useBalances } from '../hooks/useBalances'
import { useNotification } from '../context/NotificationContext'
import { useAllocatorAPI } from '../hooks/useAllocatorAPI'
import { parseUnits, formatUnits } from 'viem'

const EXPIRY_OPTIONS = [
  { label: '1 minute', value: '1min', seconds: 60 },
  { label: '10 minutes', value: '10min', seconds: 600 },
  { label: '1 hour', value: '1hour', seconds: 3600 },
  { label: 'Custom', value: 'custom', seconds: 0 }
]

interface CreateAllocationProps {
  sessionToken: string
}

export function CreateAllocation({ sessionToken }: CreateAllocationProps) {
  const { address, isConnected } = useAccount()
  const { balances, isLoading: isLoadingBalances } = useBalances()
  const { showNotification } = useNotification()
  const { createAllocation, getResourceLockDecimals } = useAllocatorAPI()

  const [formData, setFormData] = useState({
    lockId: '',
    amount: '',
    arbiterAddress: '',
    nonce: '',
    expiration: '',
    witnessHash: '',
    witnessTypestring: '',
  })

  const [errors, setErrors] = useState({
    lockId: '',
    amount: '',
    arbiterAddress: '',
    nonce: '',
    expiration: '',
  })

  const [showWitnessFields, setShowWitnessFields] = useState(false)
  const [selectedLock, setSelectedLock] = useState<any>(null)
  const [lockDecimals, setLockDecimals] = useState<number>(18)
  const [expiryOption, setExpiryOption] = useState('10min')
  const [customExpiry, setCustomExpiry] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Generate random nonce on mount
  useEffect(() => {
    if (address) {
      generateNewNonce()
    }
  }, [address])

  // Set default expiration (10 minutes from now)
  useEffect(() => {
    const tenMinutesFromNow = Math.floor(Date.now() / 1000) + 600
    setFormData(prev => ({
      ...prev,
      expiration: tenMinutesFromNow.toString()
    }))
  }, [])

  // Fetch decimals when lock changes
  useEffect(() => {
    if (selectedLock) {
      getResourceLockDecimals(selectedLock.chainId, selectedLock.lockId)
        .then(decimals => setLockDecimals(decimals))
        .catch(console.error)
    }
  }, [selectedLock])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))

    if (name === 'lockId') {
      const lock = balances.find(b => b.lockId === value)
      setSelectedLock(lock)
    }
  }

  const generateNewNonce = () => {
    if (address) {
      const addressBytes = address.slice(2)
      const randomBytes = Array.from({ length: 24 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('')
      setFormData(prev => ({
        ...prev,
        nonce: '0x' + addressBytes + randomBytes
      }))
    }
  }

  const handleExpiryChange = (value: string) => {
    setExpiryOption(value)
    const now = Math.floor(Date.now() / 1000)

    if (value === 'custom') {
      setCustomExpiry(true)
      return
    }

    setCustomExpiry(false)
    const option = EXPIRY_OPTIONS.find(opt => opt.value === value)
    if (option) {
      setFormData(prev => ({
        ...prev,
        expiration: (now + option.seconds).toString()
      }))
      setErrors(prev => ({ ...prev, expiration: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {
      lockId: '',
      amount: '',
      arbiterAddress: '',
      nonce: '',
      expiration: '',
    }

    if (!formData.lockId) {
      newErrors.lockId = 'Resource lock is required'
    }

    if (!formData.amount) {
      newErrors.amount = 'Amount is required'
    } else if (selectedLock) {
      try {
        const amountBigInt = parseUnits(formData.amount, lockDecimals)
        const availableBigInt = BigInt(selectedLock.balanceAvailableToAllocate)
        if (amountBigInt > availableBigInt) {
          newErrors.amount = 'Amount exceeds available balance'
        }
      } catch (err) {
        newErrors.amount = 'Invalid amount'
      }
    }

    if (!formData.arbiterAddress) {
      newErrors.arbiterAddress = 'Arbiter address is required'
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.arbiterAddress)) {
      newErrors.arbiterAddress = 'Invalid address format'
    }

    if (!formData.nonce) {
      newErrors.nonce = 'Nonce is required'
    }

    if (!formData.expiration) {
      newErrors.expiration = 'Expiration is required'
    } else {
      const expirationTime = parseInt(formData.expiration)
      const now = Math.floor(Date.now() / 1000)
      if (isNaN(expirationTime) || expirationTime <= now) {
        newErrors.expiration = 'Expiration must be in the future'
      }
    }

    setErrors(newErrors)
    return Object.values(newErrors).every(error => !error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm() || !selectedLock || !address) return

    try {
      setIsSubmitting(true)

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
            witnessHash: formData.witnessHash
          })
        }
      }

      const result = await createAllocation(sessionToken, request)

      showNotification({
        type: 'success',
        title: 'Allocation Created',
        message: `Successfully created allocation with hash: ${result.hash}`,
      })

      // Reset form
      setFormData({
        lockId: '',
        amount: '',
        arbiterAddress: '',
        nonce: '',
        expiration: '',
        witnessHash: '',
        witnessTypestring: '',
      })
      setShowWitnessFields(false)
      generateNewNonce()

    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create allocation',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isConnected) return null

  if (isLoadingBalances) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff00]"></div>
      </div>
    )
  }

  return (
    <div className="mx-auto p-6 bg-[#0a0a0a] rounded-lg shadow-xl border border-gray-800">
      <div className="border-b border-gray-800 pb-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-100">Create Allocation</h2>
        <p className="mt-1 text-sm text-gray-400">
          Create a new allocation from your available resource locks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Resource Lock Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Resource Lock
          </label>
          <select
            name="lockId"
            value={formData.lockId}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
          >
            <option value="">Select a resource lock</option>
            {balances.map((balance) => (
              <option key={balance.lockId} value={balance.lockId}>
                {`Lock ${balance.lockId} - Available: ${formatUnits(BigInt(balance.balanceAvailableToAllocate), lockDecimals)}`}
              </option>
            ))}
          </select>
          {errors.lockId && (
            <p className="mt-1 text-sm text-red-500">{errors.lockId}</p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount
          </label>
          <input
            type="text"
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            placeholder="0.0"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
          />
          {errors.amount && (
            <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
          )}
        </div>

        {/* Arbiter Address */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Arbiter Address
          </label>
          <input
            type="text"
            name="arbiterAddress"
            value={formData.arbiterAddress}
            onChange={handleInputChange}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
          />
          {errors.arbiterAddress && (
            <p className="mt-1 text-sm text-red-500">{errors.arbiterAddress}</p>
          )}
        </div>

        {/* Nonce with Reroll Button */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nonce
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="nonce"
              value={formData.nonce}
              onChange={handleInputChange}
              placeholder="0x..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
              readOnly
            />
            <button
              type="button"
              onClick={generateNewNonce}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Reroll
            </button>
          </div>
          {errors.nonce && (
            <p className="mt-1 text-sm text-red-500">{errors.nonce}</p>
          )}
        </div>

        {/* Expiration */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Expiration
          </label>
          <div className="flex gap-2">
            <select
              value={expiryOption}
              onChange={(e) => handleExpiryChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
            >
              {EXPIRY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {customExpiry && (
              <input
                type="text"
                name="expiration"
                value={formData.expiration}
                onChange={handleInputChange}
                placeholder="Unix timestamp"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
              />
            )}
          </div>
          {errors.expiration && (
            <p className="mt-1 text-sm text-red-500">{errors.expiration}</p>
          )}
        </div>

        {/* Witness Data Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="witnessToggle"
            checked={showWitnessFields}
            onChange={(e) => setShowWitnessFields(e.target.checked)}
            className="w-4 h-4 bg-gray-800 border-gray-700 rounded focus:ring-[#00ff00]"
          />
          <label htmlFor="witnessToggle" className="text-sm font-medium text-gray-300">
            Include Witness Data
          </label>
        </div>

        {/* Witness Fields */}
        {showWitnessFields && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Witness Hash
              </label>
              <input
                type="text"
                name="witnessHash"
                value={formData.witnessHash}
                onChange={handleInputChange}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Witness Typestring
              </label>
              <input
                type="text"
                name="witnessTypestring"
                value={formData.witnessTypestring}
                onChange={handleInputChange}
                placeholder="Enter typestring"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors"
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full px-4 py-2 ${
            isSubmitting
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-[#00ff00] hover:bg-[#00dd00]'
          } text-black font-medium rounded-lg transition-colors`}
        >
          {isSubmitting ? 'Creating Allocation...' : 'Create Allocation'}
        </button>
      </form>
    </div>
  )
}

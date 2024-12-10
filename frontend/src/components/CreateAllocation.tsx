import { formatUnits } from 'viem';
import {
  useCreateAllocation,
  EXPIRY_OPTIONS,
} from '../hooks/useCreateAllocation';

interface CreateAllocationProps {
  sessionToken: string;
}

export function CreateAllocation({ sessionToken }: CreateAllocationProps) {
  const {
    formData,
    errors,
    showWitnessFields,
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
  } = useCreateAllocation(sessionToken);

  if (!isConnected) return null;

  if (isLoadingBalances) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff00]"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto p-6 bg-[#0a0a0a] rounded-lg shadow-xl border border-gray-800">
      <div className="border-b border-gray-800 pb-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-100">
          Create Allocation
        </h2>
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
              <option
                key={`${balance.chainId}-${balance.lockId}`}
                value={balance.lockId}
              >
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
              {EXPIRY_OPTIONS.map((option) => (
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
          <label
            htmlFor="witnessToggle"
            className="text-sm font-medium text-gray-300"
          >
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
  );
}

import { useTransfer } from '../hooks/useTransfer';
import { formatUnits } from 'viem';

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
  balanceAvailableToAllocate: string;
  resetPeriod: number;
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
  balanceAvailableToAllocate,
  resetPeriod,
}: TransferProps) {
  const {
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
  } = useTransfer(
    targetChainId,
    resourceLockBalance,
    lockId,
    decimals,
    tokenName,
    tokenSymbol,
    withdrawalStatus,
    sessionToken,
    onForceWithdraw,
    onDisableForceWithdraw,
    balanceAvailableToAllocate,
    resetPeriod
  );

  const renderAllocationDetails = () => {
    if (!hasAllocation) return null;

    const expiryDate = new Date(parseInt(formData.expires) * 1000);
    const formattedExpiry = expiryDate.toLocaleString();

    return (
      <div className="space-y-4 mb-6">
        <div className="bg-gray-800 p-6 rounded-lg space-y-4">
          <div className="flex items-start">
            <span className="text-gray-400 text-sm w-[100px] shrink-0">
              Nonce:
            </span>
            <span className="text-gray-200 font-mono text-sm break-all">
              {formData.nonce}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-gray-400 text-sm w-[100px] shrink-0">
              Expires:
            </span>
            <span className="text-gray-200 text-sm">{formattedExpiry}</span>
          </div>
          <div className="flex items-start">
            <span className="text-gray-400 text-sm w-[100px] shrink-0">
              Amount:
            </span>
            <span className="text-gray-200 text-sm">
              {formData.amount}{' '}
              {isWithdrawal ? tokenSymbol : tokenName.resourceLockSymbol}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-gray-400 text-sm w-[100px] shrink-0">
              Recipient:
            </span>
            <span className="text-gray-200 font-mono text-sm break-all">
              {formData.recipient}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-gray-400 text-sm w-[100px] shrink-0">
              Claim Hash:
            </span>
            <span className="text-gray-200 font-mono text-sm break-all">
              {formData.hash}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-gray-400 text-sm w-[100px] shrink-0">
              Signature:
            </span>
            <span className="text-gray-200 font-mono text-sm break-all">
              {formData.allocatorSignature}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="inline-block">
      <div className="flex gap-2">
        <button
          onClick={() => handleAction('transfer')}
          disabled={BigInt(balanceAvailableToAllocate || '0') === BigInt(0)}
          className={`mt-2 py-2 px-4 rounded-lg font-medium transition-colors ${
            BigInt(balanceAvailableToAllocate || '0') === BigInt(0)
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-[#00ff00] text-gray-900 hover:bg-[#00dd00]'
          }`}
        >
          Transfer
        </button>
        <button
          onClick={() => handleAction('withdraw')}
          disabled={BigInt(balanceAvailableToAllocate || '0') === BigInt(0)}
          className={`mt-2 py-2 px-4 rounded-lg font-medium transition-colors ${
            BigInt(balanceAvailableToAllocate || '0') === BigInt(0)
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-[#00ff00] text-gray-900 hover:bg-[#00dd00]'
          }`}
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
            className="mt-2 py-2 px-4 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            onClick={() => handleAction('disable')}
            disabled={isWithdrawalLoading}
          >
            {isWithdrawalLoading
              ? 'Reactivating...'
              : 'Reactivate Resource Lock'}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg shadow-xl max-w-3xl w-full mx-4">
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
                    {tokenName.resourceLockName &&
                      ` - ${tokenName.resourceLockName}`}
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
              {renderAllocationDetails()}

              {!hasAllocation && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Expires
                    </label>
                    <div className="relative flex-1">
                      <select
                        value={expiryOption}
                        onChange={(e) => handleExpiryChange(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors appearance-none pr-10"
                      >
                        <option value="1min">1 minute</option>
                        <option value="5min">5 minutes</option>
                        <option value="10min">10 minutes</option>
                        {resetPeriod >= 3600 && 7200 >= 3600 && (
                          <option value="1hour">1 hour</option>
                        )}
                        <option value="custom">Custom</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                        <svg
                          className="h-4 w-4 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                    {customExpiry && (
                      <input
                        type="text"
                        value={formData.expires}
                        onChange={(e) =>
                          handleExpiryInputChange(e.target.value)
                        }
                        placeholder="Unix timestamp"
                        className={`w-full px-3 py-2 bg-gray-800 border ${
                          fieldErrors.expires
                            ? 'border-red-500'
                            : 'border-gray-700'
                        } rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors`}
                      />
                    )}
                    {fieldErrors.expires && (
                      <p className="mt-1 text-sm text-red-500">
                        {fieldErrors.expires}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Recipient Address
                    </label>
                    <input
                      type="text"
                      value={formData.recipient}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      placeholder="0x..."
                      className={`w-full px-3 py-2 bg-gray-800 border ${
                        fieldErrors.recipient
                          ? 'border-red-500'
                          : 'border-gray-700'
                      } rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors`}
                    />
                    {fieldErrors.recipient && (
                      <p className="mt-1 text-sm text-red-500">
                        {fieldErrors.recipient}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Amount
                      <span className="float-right text-gray-400">
                        Balance:{' '}
                        {formatUnits(
                          BigInt(resourceLockBalance || '0'),
                          decimals
                        )}{' '}
                        {isWithdrawal
                          ? tokenSymbol
                          : tokenName.resourceLockSymbol}{' '}
                        (Available:{' '}
                        {formatUnits(
                          BigInt(balanceAvailableToAllocate || '0'),
                          decimals
                        )}
                        )
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0.0"
                      className={`w-full px-3 py-2 bg-gray-800 border ${
                        validateAmount()?.type === 'error'
                          ? 'border-red-500'
                          : 'border-gray-700'
                      } rounded-lg text-gray-300 focus:outline-none focus:border-[#00ff00] transition-colors`}
                    />
                    {validateAmount() && (
                      <p
                        className={`mt-1 text-sm ${
                          validateAmount()?.type === 'error'
                            ? 'text-red-500'
                            : 'text-yellow-500'
                        }`}
                      >
                        {validateAmount()?.message}
                      </p>
                    )}
                  </div>
                </>
              )}

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
                  disabled={
                    !isFormValid || isTransferLoading || isWithdrawalConfirming
                  }
                  className="w-full py-2 px-4 bg-[#00ff00] text-gray-900 rounded-lg font-medium hover:bg-[#00dd00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTransferLoading || isWithdrawalConfirming ? (
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
                      {isWithdrawal
                        ? 'Submitting Withdrawal...'
                        : 'Submitting Transfer...'}
                    </span>
                  ) : (
                    <>
                      {isWithdrawal ? 'Submit Withdrawal' : 'Submit Transfer'}
                    </>
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

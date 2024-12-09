import { useState } from 'react';
import { useCompact } from '../hooks/useCompact';
import { useNotification } from '../hooks/useNotification';

interface InitiateForcedWithdrawalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lockId: string;
  resetPeriod: number;
}

export function InitiateForcedWithdrawalDialog({
  isOpen,
  onClose,
  lockId,
  resetPeriod,
}: InitiateForcedWithdrawalDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { enableForcedWithdrawal } = useCompact();
  const { showNotification } = useNotification();

  const handleInitiateWithdrawal = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      await enableForcedWithdrawal({
        args: [BigInt(lockId)],
      });

      showNotification({
        type: 'success',
        title: 'Forced Withdrawal Initiated',
        message: 'The timelock period has started',
      });

      onClose();
    } catch (error: unknown) {
      console.error('Error initiating forced withdrawal:', error);
      showNotification({
        type: 'error',
        title: 'Transaction Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to initiate forced withdrawal',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Format reset period
  const formatResetPeriod = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">
          Initiate Forced Withdrawal
        </h2>
        <p className="text-gray-400 mb-6">
          Are you sure you want to initiate a forced withdrawal? This will start
          a timelock period.
        </p>

        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-400">
                Warning: Timelock Period
              </h3>
              <div className="mt-2 text-sm text-yellow-400/80">
                <p>
                  Initiating a forced withdrawal from this resource lock will
                  start a timelock period lasting{' '}
                  {formatResetPeriod(resetPeriod)}. You will need to wait for
                  this period to end, then submit another transaction to perform
                  the forced withdrawal from this resource lock. To begin using
                  this resource lock again, you must submit another transaction
                  to disable forced withdrawals.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleInitiateWithdrawal}
            className="flex-1 py-2 px-4 bg-[#00ff00] text-gray-900 rounded-lg font-medium hover:bg-[#00dd00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Initiating...' : 'Initiate'}
          </button>
        </div>
      </div>
    </div>
  );
}

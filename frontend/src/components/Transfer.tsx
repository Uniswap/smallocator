import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { switchNetwork } from '@wagmi/core';
import { useNotification } from '../hooks/useNotification';
import { config } from '../config/wagmi';

interface TransferProps {
  chainId: string;
  withdrawalStatus: number;
  onForceWithdraw: () => void;
  onDisableForceWithdraw: () => void;
}

export function Transfer({
  chainId: targetChainId,
  withdrawalStatus,
  onForceWithdraw,
  onDisableForceWithdraw,
}: TransferProps) {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const { showNotification } = useNotification();
  const [isWithdrawalLoading, setIsWithdrawalLoading] = useState(false);

  const handleAction = async (
    action: 'transfer' | 'withdraw' | 'force' | 'disable'
  ) => {
    // Check if we need to switch networks
    const targetChainIdNumber = parseInt(targetChainId);
    if (targetChainIdNumber !== currentChainId) {
      try {
        showNotification({
          type: 'success',
          title: 'Switching Network',
          message: `Switching to chain ID ${targetChainIdNumber}...`,
        });

        await switchNetwork(config, { chainId: targetChainIdNumber });
        // Wait a bit for the network switch to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (switchError) {
        showNotification({
          type: 'error',
          title: 'Network Switch Failed',
          message:
            switchError instanceof Error
              ? switchError.message
              : 'Failed to switch network',
        });
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
    </div>
  );
}

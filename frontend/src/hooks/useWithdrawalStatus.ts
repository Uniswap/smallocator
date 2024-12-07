import { useState, useEffect, useCallback } from 'react';

interface Balance {
  chainId: string;
  lockId: string;
  withdrawalStatus: number;
  withdrawableAt: string;
}

interface WithdrawalStatus {
  canExecute: boolean;
  timeRemaining: string | null;
  status: 'active' | 'ready' | 'pending';
}

type WithdrawalStatuses = Record<string, WithdrawalStatus>;

// Helper to create a unique key for each balance
function getStatusKey(chainId: string, lockId: string): string {
  return `${chainId}-${lockId}`;
}

// Format time remaining helper
function formatTimeRemaining(expiryTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiryTimestamp - now;

  if (diff <= 0) return 'Ready';

  const days = Math.floor(diff / (24 * 60 * 60));
  const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((diff % (60 * 60)) / 60);
  const seconds = diff % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function useWithdrawalStatus(balances: Balance[]): WithdrawalStatuses {
  const [statuses, setStatuses] = useState<WithdrawalStatuses>({});

  // Update all statuses
  const updateStatuses = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const newStatuses: WithdrawalStatuses = {};

    balances.forEach((balance) => {
      const statusKey = getStatusKey(balance.chainId, balance.lockId);

      console.log(
        `[Chain ${balance.chainId}, Lock ${balance.lockId}] Status Check:`,
        {
          withdrawalStatus: balance.withdrawalStatus,
          withdrawableAt: balance.withdrawableAt,
          now,
        }
      );

      if (balance.withdrawalStatus === 0) {
        console.log(`[${statusKey}] -> ACTIVE (status=0)`);
        newStatuses[statusKey] = {
          canExecute: false,
          timeRemaining: null,
          status: 'active',
        };
      } else if (balance.withdrawalStatus === 1) {
        // If withdrawableAt is undefined or invalid, treat it as pending with default time
        const timestamp = balance.withdrawableAt
          ? parseInt(balance.withdrawableAt)
          : now + 600; // default to 10 minutes if not set

        if (timestamp <= now) {
          console.log(`[${statusKey}] -> READY (status=1, time elapsed)`);
          newStatuses[statusKey] = {
            canExecute: true,
            timeRemaining: 'Ready',
            status: 'ready',
          };
        } else {
          const remaining = formatTimeRemaining(timestamp);
          console.log(
            `[${statusKey}] -> PENDING (status=1, ${remaining} remaining)`
          );
          newStatuses[statusKey] = {
            canExecute: false,
            timeRemaining: remaining,
            status: 'pending',
          };
        }
      } else {
        console.log(`[${statusKey}] -> DEFAULT to ACTIVE (unexpected state)`);
        newStatuses[statusKey] = {
          canExecute: false,
          timeRemaining: null,
          status: 'active',
        };
      }
    });

    console.log('Final Statuses:', newStatuses);
    setStatuses(newStatuses);
  }, [balances]);

  // Update status every second if there are any pending withdrawals
  useEffect(() => {
    const hasPendingWithdrawals = balances.some(
      (balance) =>
        balance.withdrawalStatus === 1 &&
        parseInt(balance.withdrawableAt || '0') > Math.floor(Date.now() / 1000)
    );

    updateStatuses();

    if (!hasPendingWithdrawals) {
      return;
    }

    const timer = setInterval(updateStatuses, 1000);
    return () => clearInterval(timer);
  }, [balances, updateStatuses]);

  return statuses;
}

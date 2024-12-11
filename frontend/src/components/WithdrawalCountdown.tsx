import { useState, useEffect, memo } from 'react';
import { formatTimeRemaining } from '../utils/formatting';

interface WithdrawalCountdownProps {
  withdrawableAt: string;
  canExecute: boolean;
}

export const WithdrawalCountdown = memo(function WithdrawalCountdown({ 
  withdrawableAt, 
  canExecute 
}: WithdrawalCountdownProps) {
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeRemaining = withdrawableAt
    ? formatTimeRemaining(parseInt(withdrawableAt), currentTime)
    : '';

  return (
    <span
      className={`px-2 py-1 text-xs rounded ${
        canExecute
          ? 'bg-[#F97316]/10 text-[#F97316]'
          : 'bg-yellow-500/10 text-yellow-500'
      }`}
    >
      {canExecute
        ? 'Forced Withdrawal Ready'
        : `Forced Withdrawal Ready in ${timeRemaining}`}
    </span>
  );
}, (prev, next) => 
  prev.withdrawableAt === next.withdrawableAt && 
  prev.canExecute === next.canExecute
);

import { useFinalizationThreshold } from '../hooks/useFinalizationThreshold';
import { formatResetPeriod } from './BalanceDisplay';

interface FinalizationThresholdProps {
  chainId: number;
}

export function FinalizationThreshold({ chainId }: FinalizationThresholdProps) {
  const { finalizationThreshold } = useFinalizationThreshold(chainId);

  if (finalizationThreshold === null) return null;

  return (
    <span className="px-2 py-1 text-xs bg-[#00ff00]/10 text-[#00ff00] rounded">
      Finalization: {formatResetPeriod(finalizationThreshold)}
    </span>
  );
}

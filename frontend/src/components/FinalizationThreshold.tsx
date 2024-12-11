import { memo } from 'react';
import { useChainConfig } from '../hooks/useChainConfig';
import { formatResetPeriod } from '../utils/formatting';
import { SupportedChain } from '../types/chain';

interface FinalizationThresholdProps {
  chainId: number;
}

function FinalizationThresholdComponent({ chainId }: FinalizationThresholdProps) {
  const { supportedChains } = useChainConfig();

  if (!supportedChains) return null;

  const chainSpecific = supportedChains.find(
    (chain: SupportedChain) => chain.chainId === chainId.toString()
  );

  if (!chainSpecific) return null;

  return (
    <span className="px-2 py-1 text-xs bg-[#00ff00]/10 text-[#00ff00] rounded">
      Finalization:{' '}
      {formatResetPeriod(chainSpecific.finalizationThresholdSeconds)}
    </span>
  );
}

// Memoize the component to prevent unnecessary rerenders
export const FinalizationThreshold = memo(FinalizationThresholdComponent);

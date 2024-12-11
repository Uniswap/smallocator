import { useChainConfig } from '../hooks/use-chain-config';
import { formatResetPeriod } from '../utils/formatting';
import { SupportedChain } from '../types/chain';

interface FinalizationThresholdProps {
  chainId: number;
}

export function FinalizationThreshold({ chainId }: FinalizationThresholdProps) {
  const { supportedChains } = useChainConfig();

  console.log('FinalizationThreshold - chainId:', chainId);
  console.log('FinalizationThreshold - supportedChains:', supportedChains);

  if (!supportedChains) return null;

  const chainSpecific = supportedChains.find(
    (chain: SupportedChain) => chain.chainId === chainId.toString()
  );

  console.log('FinalizationThreshold - chainSpecific:', chainSpecific);

  if (!chainSpecific) return null;

  return (
    <span className="px-2 py-1 text-xs bg-[#00ff00]/10 text-[#00ff00] rounded">
      Finalization: {formatResetPeriod(chainSpecific.finalizationThresholdSeconds)}
    </span>
  );
}

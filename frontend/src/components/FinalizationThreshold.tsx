import { useChainConfig } from '../hooks/use-chain-config';
import { formatResetPeriod } from '../utils/formatting';
import { ChainConfig } from '../types/chain';

interface FinalizationThresholdProps {
  chainId: number;
}

export function FinalizationThreshold({ chainId }: FinalizationThresholdProps) {
  const { chainConfig } = useChainConfig();

  if (!chainConfig) return null;

  const chainSpecific = chainConfig.supportedChains.find(
    (chain: ChainConfig['supportedChains'][0]) =>
      chain.chainId === chainId.toString()
  );

  const threshold =
    chainSpecific?.finalizationThresholdSeconds ??
    chainConfig.defaultFinalizationThresholdSeconds;

  return (
    <span className="px-2 py-1 text-xs bg-[#00ff00]/10 text-[#00ff00] rounded">
      Finalization: {formatResetPeriod(threshold)}
    </span>
  );
}

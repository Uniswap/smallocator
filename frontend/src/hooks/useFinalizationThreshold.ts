import { useState, useEffect } from 'react';

interface ChainConfig {
  defaultFinalizationThresholdSeconds: number;
  supportedChains: Array<{
    chainId: string;
    finalizationThresholdSeconds: number;
  }>;
}

export function useFinalizationThreshold(chainId: number) {
  const [finalizationThreshold, setFinalizationThreshold] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFinalizationThreshold = async () => {
      try {
        const response = await fetch('/health');
        if (!response.ok) {
          throw new Error('Failed to fetch chain configuration');
        }
        const data = await response.json();
        const chainConfig: ChainConfig = data.chainConfig;
        
        // Find the chain-specific threshold or use default
        const chainSpecific = chainConfig.supportedChains.find(
          chain => chain.chainId === chainId.toString()
        );
        
        setFinalizationThreshold(
          chainSpecific?.finalizationThresholdSeconds ?? 
          chainConfig.defaultFinalizationThresholdSeconds
        );
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch finalization threshold'
        );
        setFinalizationThreshold(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinalizationThreshold();
  }, [chainId]);

  return { finalizationThreshold, isLoading, error };
}

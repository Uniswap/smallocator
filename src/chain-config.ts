/**
 * Configuration for chain-specific settings
 */

export interface ChainConfig {
  defaultFinalizationThreshold: number;
  finalizationThresholds: Record<string, number>;
}

export const chainConfig: ChainConfig = {
  // Default finalization threshold in seconds
  defaultFinalizationThreshold: 3,

  // Chain-specific finalization thresholds in seconds
  finalizationThresholds: {
    // Ethereum Mainnet
    '1': 25,
    // Optimism
    '10': 2,
    // Base
    '8453': 2,
  },
};

/**
 * Get the finalization threshold for a specific chain ID
 * @param chainId - The chain ID to get the threshold for
 * @returns The finalization threshold in seconds
 */
export function getFinalizationThreshold(chainId: string): number {
  return (
    chainConfig.finalizationThresholds[chainId] ??
    chainConfig.defaultFinalizationThreshold
  );
}

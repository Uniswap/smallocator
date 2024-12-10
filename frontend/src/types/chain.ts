export interface ChainConfig {
  defaultFinalizationThresholdSeconds: number;
  supportedChains: Array<{
    chainId: string;
    finalizationThresholdSeconds: number;
  }>;
}

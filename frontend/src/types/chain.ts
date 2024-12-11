export type SupportedChain = {
  chainId: string;
  allocatorId: string;
  finalizationThresholdSeconds: number;
};

export type SupportedChains = Array<SupportedChain>;

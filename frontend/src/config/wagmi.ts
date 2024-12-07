import { http } from 'wagmi';
import {
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
} from 'viem/chains';
import { SUPPORTED_CHAINS } from '../constants/contracts';
import { createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';

const chains = [
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
] as const;

// Create wagmi config with explicit connector configuration
export const config = createConfig({
  chains,
  connectors: [
    injected({
      target: 'metaMask',
    }),
  ],
  transports: {
    [mainnet.id]: http(SUPPORTED_CHAINS[mainnet.id].rpcUrl),
    [optimism.id]: http(SUPPORTED_CHAINS[optimism.id].rpcUrl),
    [optimismGoerli.id]: http(SUPPORTED_CHAINS[optimismGoerli.id].rpcUrl),
    [sepolia.id]: http(SUPPORTED_CHAINS[sepolia.id].rpcUrl),
    [goerli.id]: http(SUPPORTED_CHAINS[goerli.id].rpcUrl),
    [base.id]: http(SUPPORTED_CHAINS[base.id].rpcUrl),
    [baseSepolia.id]: http(SUPPORTED_CHAINS[baseSepolia.id].rpcUrl),
  },
});

// Export chain IDs for type safety
export const CHAIN_IDS = {
  MAINNET: mainnet.id,
  OPTIMISM: optimism.id,
  OPTIMISM_GOERLI: optimismGoerli.id,
  SEPOLIA: sepolia.id,
  GOERLI: goerli.id,
  BASE: base.id,
  BASE_SEPOLIA: baseSepolia.id,
} as const;

import { http } from 'wagmi';
import {
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
  Chain,
} from 'viem/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Define Unichain configuration
export const unichain = {
  id: 130,
  name: 'Unichain',
  nativeCurrency: {
    decimals: 18,
    name: 'UNI',
    symbol: 'UNI',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.unichain.org'],
    },
    public: {
      http: ['https://mainnet.unichain.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Uniscan',
      url: 'https://uniscan.xyz',
    },
  },
} as const satisfies Chain;

// Configure supported chains
const projectId = 'YOUR_PROJECT_ID'; // Get from WalletConnect Cloud

export const chains = [
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
  unichain,
] as const;

// Create wagmi config using RainbowKit's getDefaultConfig
export const config = getDefaultConfig({
  appName: 'Smallocator',
  projectId,
  chains,
  transports: {
    // Use a single transport configuration for all chains
    ...Object.fromEntries(
      chains.map((chain) => [chain.id, http(chain.rpcUrls.default.http[0])])
    ),
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
  UNICHAIN: unichain.id,
} as const;

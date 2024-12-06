import { mainnet, optimism, optimismGoerli, sepolia, goerli } from 'viem/chains'

// The Compact is deployed at the same address on all networks
export const COMPACT_ADDRESS = '0x00000000000018df021ff2467df97ff846e09f48' as const

// Chain configurations
export const SUPPORTED_CHAINS = {
  [mainnet.id]: {
    name: 'Ethereum',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/',
    compactAddress: COMPACT_ADDRESS as `0x${string}`,
    blockExplorer: 'https://etherscan.io',
  },
  [optimism.id]: {
    name: 'Optimism',
    rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/',
    compactAddress: COMPACT_ADDRESS as `0x${string}`,
    blockExplorer: 'https://optimistic.etherscan.io',
  },
  [optimismGoerli.id]: {
    name: 'Optimism Goerli',
    rpcUrl: 'https://opt-goerli.g.alchemy.com/v2/',
    compactAddress: COMPACT_ADDRESS as `0x${string}`,
    blockExplorer: 'https://goerli-optimism.etherscan.io',
  },
  [sepolia.id]: {
    name: 'Sepolia',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/',
    compactAddress: COMPACT_ADDRESS as `0x${string}`,
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  [goerli.id]: {
    name: 'Goerli',
    rpcUrl: 'https://eth-goerli.g.alchemy.com/v2/',
    compactAddress: COMPACT_ADDRESS as `0x${string}`,
    blockExplorer: 'https://goerli.etherscan.io',
  },
} as const

export const COMPACT_ABI = [
  // Native ETH deposit
  {
    inputs: [{ name: 'allocator', type: 'address' }],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  // ERC20 deposit
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'allocator', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const

// Helper function to get chain configuration
export function getChainConfig(chainId: number) {
  return SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS]
}

// Helper function to check if chain is supported
export function isSupportedChain(chainId: number): boolean {
  return chainId in SUPPORTED_CHAINS
}

// Type for deposit function arguments
export type NativeDepositArgs = readonly [`0x${string}`]
export type TokenDepositArgs = readonly [`0x${string}`, `0x${string}`, bigint]

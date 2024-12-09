import {
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
} from 'viem/chains';

// The Compact is deployed at the same address on all networks
export const COMPACT_ADDRESS =
  '0x00000000000018df021ff2467df97ff846e09f48' as const;

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
  [base.id]: {
    name: 'Base',
    rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/',
    compactAddress: COMPACT_ADDRESS as `0x${string}`,
    blockExplorer: 'https://basescan.org',
  },
  [baseSepolia.id]: {
    name: 'Base Sepolia',
    rpcUrl: 'https://base-sepolia.g.alchemy.com/v2/',
    compactAddress: COMPACT_ADDRESS as `0x${string}`,
    blockExplorer: 'https://sepolia.basescan.org',
  },
} as const;

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
  // Forced withdrawal functions
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'enableForcedWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'disableForcedWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'id', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'forcedWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Nonce consumption check
  {
    inputs: [
      { name: 'nonce', type: 'uint256' },
      { name: 'allocator', type: 'address' },
    ],
    name: 'hasConsumedAllocatorNonce',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Allocated Transfer
  {
    inputs: [
      {
        components: [
          {
            internalType: 'bytes',
            name: 'allocatorSignature',
            type: 'bytes',
          },
          {
            internalType: 'uint256',
            name: 'nonce',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'expires',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'recipient',
            type: 'address',
          },
        ],
        internalType: 'struct BasicTransfer',
        name: 'transferPayload',
        type: 'tuple',
      },
    ],
    name: 'allocatedTransfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Allocated Withdrawal
  {
    inputs: [
      {
        components: [
          {
            internalType: 'bytes',
            name: 'allocatorSignature',
            type: 'bytes',
          },
          {
            internalType: 'uint256',
            name: 'nonce',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'expires',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'recipient',
            type: 'address',
          },
        ],
        internalType: 'struct BasicTransfer',
        name: 'transferPayload',
        type: 'tuple',
      },
    ],
    name: 'allocatedWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

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
] as const;

// Helper function to get chain configuration
export function getChainConfig(chainId: number) {
  return SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
}

// Helper function to check if chain is supported
export function isSupportedChain(chainId: number): boolean {
  return chainId in SUPPORTED_CHAINS;
}

// Type for deposit function arguments
export type NativeDepositArgs = readonly [`0x${string}`];
export type TokenDepositArgs = readonly [`0x${string}`, `0x${string}`, bigint];

// Type for transfer payload
export interface BasicTransfer {
  allocatorSignature: `0x${string}`;
  nonce: bigint;
  expires: bigint;
  id: bigint;
  amount: bigint;
  recipient: `0x${string}`;
}

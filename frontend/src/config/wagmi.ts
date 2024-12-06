import { http, createConfig } from 'wagmi'
import { type Chain } from 'viem'
import { mainnet, optimism, optimismGoerli, sepolia, goerli, base, baseSepolia } from 'viem/chains'
import { SUPPORTED_CHAINS } from '../constants/contracts'

const chains: readonly [Chain, ...Chain[]] = [
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
] as const

// Create wagmi config with supported chains
export const config = createConfig({
  chains,
  transports: {
    [mainnet.id]: http(SUPPORTED_CHAINS[mainnet.id].rpcUrl),
    [optimism.id]: http(SUPPORTED_CHAINS[optimism.id].rpcUrl),
    [optimismGoerli.id]: http(SUPPORTED_CHAINS[optimismGoerli.id].rpcUrl),
    [sepolia.id]: http(SUPPORTED_CHAINS[sepolia.id].rpcUrl),
    [goerli.id]: http(SUPPORTED_CHAINS[goerli.id].rpcUrl),
    [base.id]: http(SUPPORTED_CHAINS[base.id].rpcUrl),
    [baseSepolia.id]: http(SUPPORTED_CHAINS[baseSepolia.id].rpcUrl),
  } as const
})

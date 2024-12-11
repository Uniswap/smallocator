import { chains } from '../config/wagmi';

/**
 * Get the name of a chain by its ID
 * @param chainId The chain ID as a string or number
 * @returns The chain name from wagmi config, or a fallback if not found
 */
export function getChainName(chainId: string | number): string {
  // Convert chainId to number if it's a string
  const id = typeof chainId === 'string' ? parseInt(chainId) : chainId;
  
  // Find the chain in wagmi config
  const chain = chains.find(chain => chain.id === id);
  
  // Return the chain name if found, otherwise return a generic name
  return chain?.name || `Chain ${chainId}`;
}

import { useQuery } from '@tanstack/react-query';
import { SupportedChains } from '../types/chain';

async function fetchChainConfig(): Promise<SupportedChains> {
  const response = await fetch('/health');
  if (!response.ok) throw new Error('Failed to fetch chain config');
  const data = await response.json();
  return data.supportedChains;
}

// One hour in milliseconds
const ONE_HOUR = 60 * 60 * 1000;

export function useChainConfig() {
  const { data: supportedChains } = useQuery({
    queryKey: ['chainConfig'],
    queryFn: fetchChainConfig,
    staleTime: ONE_HOUR, // Consider data fresh for 1 hour
    gcTime: ONE_HOUR, // Keep unused data in cache for 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  return { supportedChains };
}

import { createContext } from 'react';
import { SupportedChains } from '../types/chain';

export interface ChainConfigContextType {
  supportedChains: SupportedChains | null;
}

export const ChainConfigContext = createContext<ChainConfigContextType>({
  supportedChains: null,
});

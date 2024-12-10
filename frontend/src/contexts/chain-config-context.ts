import { createContext } from 'react';
import { ChainConfig } from '../types/chain';

export interface ChainConfigContextType {
  chainConfig: ChainConfig | null;
}

export const ChainConfigContext = createContext<ChainConfigContextType>({
  chainConfig: null,
});

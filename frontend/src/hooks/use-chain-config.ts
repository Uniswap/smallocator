import { useContext } from 'react';
import {
  ChainConfigContext,
  ChainConfigContextType,
} from '../contexts/chain-config-context';

export const useChainConfig = (): ChainConfigContextType =>
  useContext(ChainConfigContext);

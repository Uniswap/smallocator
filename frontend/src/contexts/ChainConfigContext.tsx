import React from 'react';
import {
  ChainConfigContext,
  ChainConfigContextType,
} from './chain-config-context';

interface ChainConfigProviderProps {
  children: React.ReactNode;
  value: ChainConfigContextType;
}

export const ChainConfigProvider: React.FC<ChainConfigProviderProps> = ({
  children,
  value,
}) => {
  return (
    <ChainConfigContext.Provider value={value}>
      {children}
    </ChainConfigContext.Provider>
  );
};

// Re-export the types and context for convenience
export type { ChainConfigContextType };
export { ChainConfigContext };

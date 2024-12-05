import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { mainnet } from 'viem/chains';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import { useState, useMemo } from 'react';

import { WalletConnect } from './components/WalletConnect';
import { SessionManager } from './components/SessionManager';
import { BalanceDisplay } from './components/BalanceDisplay';

const config = getDefaultConfig({
  appName: 'Smallocator',
  projectId: 'YOUR_PROJECT_ID', // Get from WalletConnect Cloud
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
      },
    },
  }), []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen p-4 max-w-4xl mx-auto">
            <header className="mb-8">
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Smallocator</h1>
                <WalletConnect hasSession={!!sessionToken} />
              </div>
            </header>
            <main>
              <SessionManager 
                sessionToken={sessionToken}
                onSessionUpdate={setSessionToken}
              />
              {sessionToken && (
                <div className="mt-8">
                  <BalanceDisplay />
                </div>
              )}
            </main>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

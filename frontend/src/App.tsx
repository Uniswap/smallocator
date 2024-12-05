import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { mainnet } from 'viem/chains';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import { useState } from 'react';

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

const queryClient = new QueryClient();

function App() {
  const [hasSession, setHasSession] = useState(false);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen p-4 max-w-4xl mx-auto">
            <header className="mb-8">
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Smallocator</h1>
                <WalletConnect />
              </div>
            </header>
            <main>
              <SessionManager onSessionCreated={() => setHasSession(true)} />
              {hasSession && (
                <div className="mt-8">
                  <BalanceDisplay chainId="1" lockId="0x1234" />
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

import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { mainnet } from 'viem/chains';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import { useState, useMemo } from 'react';

import { WalletConnect } from './components/WalletConnect';
import { SessionManager } from './components/SessionManager';
import { BalanceDisplay } from './components/BalanceDisplay';
import HealthCheck from './components/HealthCheck';

const config = getDefaultConfig({
  appName: 'Smallocator',
  projectId: 'YOUR_PROJECT_ID', // Get from WalletConnect Cloud
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

const customTheme = darkTheme({
  accentColor: '#00ff00',
  accentColorForeground: '#0a0a0a',
  borderRadius: 'small',
  fontStack: 'system',
  overlayBlur: 'small',
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
        <RainbowKitProvider theme={customTheme}>
          <div className="min-h-screen w-full">
            <header className="mb-8 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-monaco">
                  <span className="underlined-text">
                    <span className="text-white">Sm</span><span className="text-[#00ff00]">all</span>
                  </span><span className="text-[#00ff00]">ocator</span><span className="text-white"> 🤏</span>
                </h1>
                <div className="flex items-center gap-4">
                  <a
                    href="https://github.com/Uniswap/smallocator"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-[#00ff00] transition-colors"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                  </a>
                  <div className="flex items-center space-x-4">
                    <WalletConnect hasSession={!!sessionToken} />
                  </div>
                </div>
              </div>
            </header>
            <main className="flex flex-col justify-center items-center w-full px-4 sm:px-6 lg:px-8">
              <SessionManager 
                sessionToken={sessionToken}
                onSessionUpdate={setSessionToken}
              />
              {sessionToken && (
                <div className="mt-8">
                  <BalanceDisplay />
                </div>
              )}
              <HealthCheck />
            </main>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

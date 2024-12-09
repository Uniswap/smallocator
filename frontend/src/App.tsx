import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import {
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
} from 'viem/chains';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';
import { useState, useMemo } from 'react';

import { WalletConnect } from './components/WalletConnect';
import { SessionManager } from './components/SessionManager';
import { BalanceDisplay } from './components/BalanceDisplay';
import HealthCheck from './components/HealthCheck';
import { DepositForm } from './components/DepositForm';
import { NotificationProvider } from './context/NotificationProvider';

// Configure supported chains
const projectId = 'YOUR_PROJECT_ID'; // Get from WalletConnect Cloud

const chains = [
  mainnet,
  optimism,
  optimismGoerli,
  sepolia,
  goerli,
  base,
  baseSepolia,
] as const;

const config = getDefaultConfig({
  appName: 'Smallocator',
  projectId,
  chains,
  transports: Object.fromEntries(chains.map((chain) => [chain.id, http()])),
  ssr: true,
});

const customTheme = darkTheme({
  accentColor: '#00ff00',
  accentColorForeground: '#000000',
  borderRadius: 'medium',
  overlayBlur: 'small',
});

function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isHealthy, setIsHealthy] = useState(true);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme}>
          <NotificationProvider>
            <div className="h-screen flex flex-col bg-[#0a0a0a]">
              <header className="flex-none bg-[#0a0a0a] border-b border-gray-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                  <h1 className="text-3xl font-black font-monaco">
                    <span className="text-white">Sm</span>
                    <span className="text-[#00ff00]">all</span>
                    <span className="text-[#00ff00]">ocator</span>
                    <span className="text-white"> 🤏</span>
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
                    <WalletConnect hasSession={!!sessionToken} />
                    <SessionManager
                      sessionToken={sessionToken}
                      onSessionUpdate={setSessionToken}
                      isServerHealthy={isHealthy}
                    />
                  </div>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <div className="space-y-6">
                    {/* Health Check Status */}
                    <div className="mx-auto p-4 bg-[#0a0a0a] rounded-lg shadow-xl border border-gray-800">
                      <HealthCheck onHealthStatusChange={setIsHealthy} />
                    </div>

                    {/* Only show these components if the server is healthy */}
                    {isHealthy && (
                      <>
                        {/* Deposit Form */}
                        {sessionToken && <DepositForm />}

                        {/* Balance Display */}
                        {sessionToken && (
                          <div className="mx-auto p-6 bg-[#0a0a0a] rounded-lg shadow-xl border border-gray-800">
                            <BalanceDisplay sessionToken={sessionToken} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </main>
            </div>
          </NotificationProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

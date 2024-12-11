import React, { useEffect, useState } from 'react';
import { ChainConfigProvider } from '../contexts/ChainConfigContext';
import { SupportedChains } from '../types/chain';

interface HealthStatus {
  status: string;
  allocatorAddress: string;
  signingAddress: string;
  timestamp: string;
  supportedChains: SupportedChains;
}

interface HealthCheckProps {
  onHealthStatusChange?: (isHealthy: boolean) => void;
  onChainConfigUpdate?: (supportedChains: SupportedChains) => void;
}

const HealthCheck: React.FC<HealthCheckProps> = ({
  onHealthStatusChange,
  onChainConfigUpdate,
}) => {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const response = await fetch('/health');
        if (!response.ok) throw new Error('Allocator server unavailable');
        const data: HealthStatus = await response.json();
        setHealthData(data);
        setError(null);
        onHealthStatusChange?.(data.status === 'healthy');
        onChainConfigUpdate?.(data.supportedChains);
      } catch (error) {
        console.error('Error fetching health status:', error);
        setError('Allocator server unavailable');
        onHealthStatusChange?.(false);
      }
    };

    // Fetch health data every second
    const intervalId = setInterval(fetchHealthData, 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [onHealthStatusChange, onChainConfigUpdate]);

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff00]"></div>
      </div>
    );
  }

  return (
    <ChainConfigProvider
      value={{ supportedChains: healthData?.supportedChains || null }}
    >
      <div className="space-y-2">
        {/* Allocator Address and Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Allocator:</span>
            <span className="text-lg font-mono text-[#00ff00]">
              {healthData.allocatorAddress}
            </span>
          </div>
          <div className="flex items-center gap-2 w-[180px] justify-end">
            <span className="text-gray-400 text-sm pr-2">Status:</span>
            <span
              className={`px-2 py-0.5 text-xs rounded ${
                healthData.status === 'healthy'
                  ? 'bg-[#00ff00]/10 text-[#00ff00]'
                  : 'bg-red-500/10 text-red-500'
              }`}
            >
              {healthData.status.charAt(0).toUpperCase() +
                healthData.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Signer and Last Checked */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Signer:</span>
            <span className="font-mono text-[#00ff00]">
              {healthData.signingAddress}
            </span>
          </div>
          <div className="flex items-center gap-2 w-[180px] justify-end whitespace-nowrap">
            <span className="text-gray-400">Last Checked:</span>
            <span className="font-mono text-[#00ff00]">
              {new Date(healthData.timestamp).toLocaleTimeString(undefined, {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>
    </ChainConfigProvider>
  );
};

export default HealthCheck;

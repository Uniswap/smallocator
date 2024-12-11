import React from 'react';

interface APIEndpoint {
  method: string;
  path: string;
  args?: string[];
  request?: string;
  response: string;
}

const APISection: React.FC = () => {
  const typeDefinitions = {
    EIP4361Payload:
      '{domain, address, uri, statement, version, chainId: number, nonce, issuedAt, expirationTime}',
    Compact:
      '{arbiter, sponsor, nonce?, expires, id, amount, witnessTypeString?, witnessHash?}',
    ChainConfig:
      '{defaultFinalizationThresholdSeconds: number, supportedChains: [{chainId, finalizationThresholdSeconds: number}]}',
  };

  const endpoints: Record<string, APIEndpoint[]> = {
    Public: [
      {
        method: 'GET',
        path: '/health',
        response:
          '{status, timestamp, allocatorAddress, signingAddress, chainConfig: ChainConfig}',
      },
      {
        method: 'GET',
        path: '/session/:chainId/:address',
        response: '{payload: EIP4361Payload}',
      },
    ],
    Authenticated: [
      {
        method: 'POST',
        path: '/session',
        request: '{signature, payload: EIP4361Payload}',
        response: '{sessionId}',
      },
      {
        method: 'GET',
        path: '/session',
        response: '{session: {id, address, expiresAt}}',
      },
      {
        method: 'DELETE',
        path: '/session',
        response: '{success: boolean}',
      },
      {
        method: 'POST',
        path: '/compact',
        request: '{chainId, compact: Compact}',
        response: '{hash, signature, nonce}',
      },
      {
        method: 'GET',
        path: '/compact/:chainId/:claimHash',
        response: '{chainId, hash, compact: Compact, signature, createdAt}',
      },
      {
        method: 'GET',
        path: '/compacts',
        response: '[{chainId, hash, compact: Compact, signature, createdAt}]',
      },
      {
        method: 'GET',
        path: '/suggested-nonce/:chainId',
        response: '{nonce}',
      },
      {
        method: 'GET',
        path: '/balance/:chainId/:lockId',
        response:
          '{allocatableBalance, allocatedBalance, balanceAvailableToAllocate, withdrawalStatus: number}',
      },
      {
        method: 'GET',
        path: '/balances',
        response:
          '{balances: [{chainId, lockId, allocatableBalance, allocatedBalance, balanceAvailableToAllocate, withdrawalStatus: number}]}',
      },
    ],
  };

  return (
    <div className="mx-auto p-4 bg-[#0a0a0a] rounded-lg shadow-xl border border-gray-800">
      <h2 className="text-lg font-bold text-white mb-0.5">API Reference</h2>
      <div className="text-gray-400 mb-3 text-xs">
        All fields are of type `string` unless indicated otherwise. Arguments
        ending in ? are optional.
      </div>

      {/* Type Definitions */}
      <div className="mb-4 space-y-1">
        <h3 className="text-[0.95rem] font-semibold text-[#00ff00] mb-1">
          Type Definitions
        </h3>
        {Object.entries(typeDefinitions).map(([name, definition]) => (
          <div key={name} className="font-mono text-xs">
            <div className="flex items-baseline gap-1">
              <span className="text-purple-400 font-semibold">{name}</span>
              <span className="text-gray-500">=</span>
              <span className="text-gray-400">{definition}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Endpoints */}
      <div className="space-y-4">
        {Object.entries(endpoints).map(([category, endpoints]) => (
          <div key={category}>
            <h3 className="text-[0.95rem] font-semibold text-[#00ff00] mb-0.5">
              {category} Endpoints
              {category === 'Authenticated' && (
                <span className="text-xs font-normal text-gray-400 ml-2">
                  (requires{' '}
                  <code className="bg-gray-800 px-1 rounded">
                    x-session-id: session
                  </code>{' '}
                  header)
                </span>
              )}
            </h3>
            <div className="space-y-1.5">
              {endpoints.map((endpoint, index) => (
                <div
                  key={index}
                  className="font-mono text-xs hover:bg-gray-900 rounded"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`
                      ${endpoint.method === 'GET' ? 'text-blue-400' : ''}
                      ${endpoint.method === 'POST' ? 'text-green-400' : ''}
                      ${endpoint.method === 'DELETE' ? 'text-red-400' : ''}
                      font-semibold min-w-[3.5rem] w-[3.5rem]
                    `}
                    >
                      {endpoint.method}
                    </span>
                    <span className="text-gray-300">{endpoint.path}</span>
                    {endpoint.request && (
                      <>
                        <span className="text-gray-500">→</span>
                        <span className="text-gray-400">
                          {endpoint.request}
                        </span>
                      </>
                    )}
                    <span className="text-gray-500">⇒</span>
                    <span className="text-gray-400">{endpoint.response}</span>
                  </div>
                  {endpoint.args && (
                    <div className="pl-16 text-[0.7rem] space-y-0.5">
                      {endpoint.args.map((arg, i) => (
                        <div key={i} className="text-gray-500">
                          {arg}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default APISection;

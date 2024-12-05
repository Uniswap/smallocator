import { useAccount, useSignMessage, useChainId } from 'wagmi';
import { useState, useEffect } from 'react';

interface SessionManagerProps {
  onSessionCreated: () => void;
}

export function SessionManager({ onSessionCreated }: SessionManagerProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const createSession = async () => {
    if (!address || !chainId) return;

    const nonce = crypto.randomUUID();
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    try {
      const signature = await signMessageAsync({
        message: [
          'Smallocator wants you to sign in with your Ethereum account:',
          address,
          '',
          'Sign in to Smallocator',
          '',
          `URI: ${baseUrl}`,
          `Version: 1`,
          `Chain ID: ${chainId}`,
          `Nonce: ${nonce}`,
          `Issued At: ${new Date().toISOString()}`,
          `Expiration Time: ${new Date(Date.now() + 30 * 60 * 1000).toISOString()}`,
        ].join('\n'),
      });

      const response = await fetch('/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          payload: {
            domain: new URL(baseUrl).host,
            address,
            uri: baseUrl,
            statement: 'Sign in to Smallocator',
            version: '1',
            chainId,
            nonce,
            issuedAt: new Date().toISOString(),
            expirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            resources: [],
          },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionToken(data.token);
        onSessionCreated();
      } else {
        console.error('Failed to create session:', await response.text());
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  useEffect(() => {
    if (isConnected && address && !sessionToken && chainId) {
      createSession();
    }
  }, [isConnected, address, sessionToken, chainId]);

  if (!isConnected) {
    return (
      <div>
        <p>Please connect your wallet to continue.</p>
      </div>
    );
  }

  return null;
}

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

    try {
      // First, get the payload from server
      const payloadResponse = await fetch(`/session/${address}`);
      if (!payloadResponse.ok) {
        throw new Error('Failed to get session payload');
      }
      
      const { payload } = await payloadResponse.json();
      
      // Format the message according to EIP-4361
      const message = [
        `${payload.domain} wants you to sign in with your Ethereum account:`,
        payload.address,
        '',
        payload.statement,
        '',
        `URI: ${payload.uri}`,
        `Version: ${payload.version}`,
        `Chain ID: ${payload.chainId}`,
        `Nonce: ${payload.nonce}`,
        `Issued At: ${payload.issuedAt}`,
        `Expiration Time: ${payload.expirationTime}`,
      ].join('\n');

      // Get signature from wallet
      const signature = await signMessageAsync({
        message,
      });

      // Submit signature and payload to create session
      const response = await fetch('/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          payload,
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

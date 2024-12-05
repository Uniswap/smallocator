import { useAccount, useSignMessage, useChainId } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';

interface SessionManagerProps {
  onSessionCreated: () => void;
}

export function SessionManager({ onSessionCreated }: SessionManagerProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const existingSession = localStorage.getItem('sessionId');
    if (existingSession) {
      setSessionToken(existingSession);
      onSessionCreated();
    }
  }, [onSessionCreated]);

  const createSession = useCallback(async () => {
    if (!address || !chainId || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      // First, get the payload from server
      const payloadResponse = await fetch(`/session/${chainId}/${address}`);
      if (!payloadResponse.ok) {
        throw new Error('Failed to get session payload');
      }
      
      const { session } = await payloadResponse.json();
      
      // Format the message according to EIP-4361
      const message = [
        `${session.domain} wants you to sign in with your Ethereum account:`,
        session.address,
        '',
        session.statement,
        '',
        `URI: ${session.uri}`,
        `Version: ${session.version}`,
        `Chain ID: ${session.chainId}`,
        `Nonce: ${session.nonce}`,
        `Issued At: ${session.issuedAt}`,
        `Expiration Time: ${session.expirationTime}`,
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
          payload: {
            ...session,
            chainId: parseInt(session.chainId.toString(), 10), // Ensure chainId is a number
          },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const sessionId = data.session.id;
        localStorage.setItem('sessionId', sessionId);
        setSessionToken(sessionId);
        onSessionCreated();
      } else {
        const errorText = await response.text();
        console.error('Failed to create session:', errorText);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessageAsync, onSessionCreated]);

  if (!isConnected) {
    return (
      <div className="text-center">
        <p className="text-gray-600">Please connect your wallet to continue.</p>
      </div>
    );
  }

  if (sessionToken) {
    return null;
  }

  const canLogin = isConnected && address && chainId && !isLoading;

  return (
    <div className="text-center">
      <button
        onClick={createSession}
        disabled={!canLogin}
        className={`px-4 py-2 rounded-lg font-medium ${
          canLogin
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? 'Signing in...' : 'Sign in with Ethereum'}
      </button>
    </div>
  );
}

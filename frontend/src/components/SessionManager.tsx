import { useAccount, useSignMessage, useChainId } from 'wagmi';
import { useState, useCallback } from 'react';
import { useSessionPoller } from '../hooks/useSessionPoller';

interface SessionManagerProps {
  sessionToken: string | null;
  onSessionUpdate: (token: string | null) => void;
  isServerHealthy?: boolean;
}

export function SessionManager({
  sessionToken,
  onSessionUpdate,
  isServerHealthy = true,
}: SessionManagerProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const [isLoading, setIsLoading] = useState(false);
  const { storeSession, clearSession } = useSessionPoller(onSessionUpdate);

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
            chainId: parseInt(session.chainId.toString(), 10),
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        storeSession(data.session.id);
      } else {
        const errorText = await response.text();
        console.error('Failed to create session:', errorText);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessageAsync, storeSession, isLoading]);

  const signOut = useCallback(async () => {
    if (!sessionToken || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/session', {
        method: 'DELETE',
        headers: {
          'x-session-id': sessionToken,
        },
      });

      if (response.ok) {
        clearSession();
      } else {
        console.error('Failed to sign out:', await response.text());
      }
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, clearSession, isLoading]);

  // Always render a container, even if not connected
  return (
    <div className="flex items-center">
      {isConnected &&
        (sessionToken ? (
          <button
            onClick={signOut}
            disabled={isLoading || !isServerHealthy}
            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
              isLoading || !isServerHealthy
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isLoading ? 'Signing out...' : 'Sign out'}
          </button>
        ) : (
          <button
            onClick={createSession}
            disabled={!address || !chainId || isLoading || !isServerHealthy}
            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
              !address || !chainId || isLoading || !isServerHealthy
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-[#00ff00] text-gray-900 hover:bg-[#00dd00]'
            }`}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        ))}
    </div>
  );
}

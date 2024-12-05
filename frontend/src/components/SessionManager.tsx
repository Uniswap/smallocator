import { useAccount, useSignMessage } from 'wagmi';
import { useState, useEffect } from 'react';

interface SessionManagerProps {
  onSessionCreated: () => void;
}

export function SessionManager({ onSessionCreated }: SessionManagerProps) {
  const { address, isConnected } = useAccount();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const { signMessage } = useSignMessage({
    mutation: {
      onSuccess: async (signature: string) => {
        try {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              address,
              signature,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setSessionToken(data.token);
            onSessionCreated();
          }
        } catch (error) {
          console.error('Failed to create session:', error);
        }
      },
    },
  });

  useEffect(() => {
    if (isConnected && address && !sessionToken) {
      const message = `Sign this message to create a session for Smallocator\n\nAddress: ${address}\nNonce: ${Date.now()}`;
      signMessage({ message });
    }
  }, [isConnected, address, sessionToken, signMessage]);

  if (!isConnected) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600">Connect your wallet to continue</p>
      </div>
    );
  }

  if (sessionToken) {
    return (
      <div className="text-center py-4">
        <p className="text-green-600">✓ Session active</p>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <p className="text-gray-600">Creating session...</p>
    </div>
  );
}

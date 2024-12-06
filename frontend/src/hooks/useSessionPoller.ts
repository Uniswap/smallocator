import { useEffect } from 'react';
import { useAccount } from 'wagmi';

const POLLING_INTERVAL = 60000; // 60 seconds

interface SessionResponse {
  session?: {
    id: string;
    address: string;
    expiresAt: string;
  };
  error?: string;
}

export function useSessionPoller(
  onSessionUpdate: (sessionId: string | null) => void
) {
  const { address } = useAccount();

  useEffect(() => {
    // Clear session if no address
    if (!address) {
      localStorage.removeItem(`session-${address}`);
      onSessionUpdate(null);
      return;
    }

    // Get session for current address
    const sessionId = localStorage.getItem(`session-${address}`);
    if (!sessionId) {
      onSessionUpdate(null);
      return;
    }

    // Set initial session
    onSessionUpdate(sessionId);

    // Start polling
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch('/session', {
          headers: {
            'x-session-id': sessionId,
          },
        });

        const data: SessionResponse = await response.json();

        // Check for invalid session error
        if (data.error === 'Invalid session' || !response.ok) {
          // Clear the session and update state
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }

        // Verify session belongs to current address
        if (data.session?.address.toLowerCase() !== address.toLowerCase()) {
          throw new Error('Session address mismatch');
        }

        // Check if session has expired
        const expiryTime = new Date(data.session.expiresAt).getTime();
        if (expiryTime < Date.now()) {
          throw new Error('Session expired');
        }
      } catch (error) {
        // On any error, clear the session
        localStorage.removeItem(`session-${address}`);
        onSessionUpdate(null);
      }
    }, POLLING_INTERVAL);

    // Cleanup on unmount or address change
    return () => {
      clearInterval(intervalId);
    };
  }, [address, onSessionUpdate]);

  // Helper function to store new session
  const storeSession = (sessionId: string) => {
    if (address) {
      localStorage.setItem(`session-${address}`, sessionId);
      onSessionUpdate(sessionId);
    }
  };

  // Helper function to clear session
  const clearSession = () => {
    if (address) {
      localStorage.removeItem(`session-${address}`);
      onSessionUpdate(null);
    }
  };

  return {
    storeSession,
    clearSession,
  };
}

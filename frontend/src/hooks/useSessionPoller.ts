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

    // Immediately validate session on mount
    const validateSession = async () => {
      try {
        const response = await fetch('/session', {
          headers: {
            'x-session-id': sessionId,
          },
        });

        // Handle 401 Unauthorized explicitly
        if (response.status === 401) {
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }

        const data: SessionResponse = await response.json();

        // Check for invalid session error
        if (data.error === 'Invalid session' || !response.ok) {
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }

        // Verify session belongs to current address
        if (data.session?.address.toLowerCase() !== address.toLowerCase()) {
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }

        // Check if session has expired
        const expiryTime = new Date(data.session.expiresAt).getTime();
        if (expiryTime < Date.now()) {
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }

        // Session is valid, set it
        onSessionUpdate(sessionId);
      } catch {
        // On any error, clear the session
        localStorage.removeItem(`session-${address}`);
        onSessionUpdate(null);
      }
    };

    // Run initial validation
    validateSession();

    // Start polling
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch('/session', {
          headers: {
            'x-session-id': sessionId,
          },
        });

        // Handle 401 Unauthorized explicitly
        if (response.status === 401) {
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }

        const data: SessionResponse = await response.json();

        // Check for invalid session error
        if (data.error === 'Invalid session' || !response.ok) {
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }

        // Verify session belongs to current address
        if (data.session?.address.toLowerCase() !== address.toLowerCase()) {
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }

        // Check if session has expired
        const expiryTime = new Date(data.session.expiresAt).getTime();
        if (expiryTime < Date.now()) {
          localStorage.removeItem(`session-${address}`);
          onSessionUpdate(null);
          return;
        }
      } catch {
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

import React, { useEffect, useState } from 'react';

interface HealthStatus {
  status: string;
  allocatorAddress: string;
  signingAddress: string;
  timestamp: string;
}

const HealthCheck: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const response = await fetch('/health');
        if (!response.ok) throw new Error('Failed to fetch health status.');
        const data: HealthStatus = await response.json();
        setHealthData(data);
      } catch (error) {
        console.error('Error fetching health status:', error);
      }
    };

    // Fetch health data every 2 seconds
    const intervalId = setInterval(fetchHealthData, 2000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div>
      {healthData ? (
        <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#1a1a2e', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9em', color: '#ffffff' }}>
          {healthData.status !== 'healthy' && <span>Status: {healthData.status}</span>}
          <span style={{ margin: '0 10px' }}>Allocator: {healthData.allocatorAddress}</span>
          <span style={{ margin: '0 10px' }}>Signer: {healthData.signingAddress}</span>
          <span style={{ margin: '0 10px' }}>Health Check: {new Date(healthData.timestamp).toLocaleString()}</span>
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default HealthCheck;

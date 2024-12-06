import { useState, useEffect } from 'react'

interface HealthCheckResponse {
  status: string
  allocatorAddress: string
  signingAddress: string
  timestamp: string
}

export function useAllocatorAPI() {
  const [allocatorAddress, setAllocatorAddress] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealthCheck = async () => {
      try {
        const response = await fetch('/health')
        if (!response.ok) {
          throw new Error('Health check failed')
        }
        const data: HealthCheckResponse = await response.json()
        setAllocatorAddress(data.allocatorAddress)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch allocator address')
        setAllocatorAddress(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchHealthCheck()
  }, [])

  return { allocatorAddress, isLoading, error }
}

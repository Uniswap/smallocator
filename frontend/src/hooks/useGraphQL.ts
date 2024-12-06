import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { config } from '../config/api'

// Poll every second
const DEFAULT_POLL_INTERVAL = 1000

// Cache to store ETags
const etagCache = new Map<string, string>()
// Cache to store last response data
const responseCache = new Map<string, unknown>()

interface GraphQLResponse<T> {
  data: T
  errors?: Array<{ message: string }>
}

export class GraphQLError extends Error {
  constructor(
    message: string,
    public errors?: Array<{ message: string }>,
    public status?: number,
    public statusText?: string
  ) {
    super(message)
    this.name = 'GraphQLError'
  }
}

export async function fetchGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  try {
    // Create a cache key from the query and variables
    const cacheKey = JSON.stringify({ query, variables })
    const etag = etagCache.get(cacheKey)
    const cachedResponse = responseCache.get(cacheKey)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add If-None-Match header if we have an ETag
    if (etag) {
      headers['If-None-Match'] = etag
    }

    const response = await fetch(config.graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    // Handle 304 Not Modified
    if (response.status === 304 && cachedResponse) {
      return cachedResponse as T
    }

    if (!response.ok) {
      console.error('GraphQL Response not OK:', {
        status: response.status,
        statusText: response.statusText,
      })
      throw new GraphQLError(
        'Network response was not ok',
        undefined,
        response.status,
        response.statusText
      )
    }

    // Get the new ETag if present
    const newEtag = response.headers.get('etag')
    if (newEtag) {
      etagCache.set(cacheKey, newEtag)
    }

    const result = (await response.json()) as GraphQLResponse<T>

    if (result.errors) {
      throw new GraphQLError(
        'GraphQL query failed',
        result.errors
      )
    }

    // Update the response cache
    responseCache.set(cacheKey, result.data)

    return result.data
  } catch (error) {
    console.error('GraphQL request failed:', {
      error,
      query,
      variables,
      endpoint: config.graphqlUrl,
    })
    throw error
  }
}

interface UseGraphQLQueryOptions {
  pollInterval?: number
  enabled?: boolean
  staleTime?: number
  gcTime?: number
}

export function useGraphQLQuery<T>(
  queryKey: string[],
  query: string,
  variables?: Record<string, unknown>,
  options: UseGraphQLQueryOptions = {}
): UseQueryResult<T, Error> {
  const { 
    pollInterval = DEFAULT_POLL_INTERVAL, 
    enabled = true,
    // Data considered fresh for 500ms
    staleTime = 500,
    // Keep unused data in cache for 5 minutes
    gcTime = 5 * 60 * 1000,
  } = options

  return useQuery({
    queryKey,
    queryFn: () => fetchGraphQL<T>(query, variables),
    retry: (failureCount, error) => {
      // Don't retry on specific error conditions
      if (error instanceof GraphQLError) {
        if (error.status === 404 || error.status === 400) {
          return false
        }
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    refetchInterval: pollInterval,
    staleTime,
    gcTime,
    // Use cached data as placeholder while fetching
    placeholderData: (previousData) => previousData,
    enabled,
  })
}

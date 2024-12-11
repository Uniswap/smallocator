import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { config } from '../config/api';

// Poll every second
const DEFAULT_POLL_INTERVAL = 1000;

// Cache to store ETags
const etagCache = new Map<string, string>();
// Cache to store last response data
const responseCache = new Map<string, unknown>();

// Simple deep equality check
function isDeepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;

  if (
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object' ||
    obj1 === null ||
    obj2 === null
  ) {
    return obj1 === obj2;
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  return keys1.every((key) =>
    isDeepEqual(
      (obj1 as Record<string, unknown>)[key],
      (obj2 as Record<string, unknown>)[key]
    )
  );
}

interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

export class GraphQLError extends Error {
  constructor(
    message: string,
    public errors?: Array<{ message: string }>,
    public status?: number,
    public statusText?: string
  ) {
    super(message);
    this.name = 'GraphQLError';
  }
}

export async function fetchGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  try {
    // Create a cache key from the query and variables
    const cacheKey = JSON.stringify({ query, variables });
    const etag = etagCache.get(cacheKey);
    const cachedResponse = responseCache.get(cacheKey);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add If-None-Match header if we have an ETag
    if (etag) {
      headers['If-None-Match'] = etag;
    }

    const response = await fetch(config.graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    // Handle 304 Not Modified
    if (response.status === 304 && cachedResponse) {
      return cachedResponse as T;
    }

    if (!response.ok) {
      console.error('GraphQL Response not OK:', {
        status: response.status,
        statusText: response.statusText,
      });
      throw new GraphQLError(
        'Network response was not ok',
        undefined,
        response.status,
        response.statusText
      );
    }

    // Get the new ETag if present
    const newEtag = response.headers.get('etag');
    if (newEtag) {
      etagCache.set(cacheKey, newEtag);
    }

    const result = (await response.json()) as GraphQLResponse<T>;

    if (result.errors) {
      throw new GraphQLError('GraphQL query failed', result.errors);
    }

    // Only update cache if data has actually changed
    if (!isDeepEqual(result.data, cachedResponse)) {
      responseCache.set(cacheKey, result.data);
    }

    return result.data;
  } catch (error) {
    console.error('GraphQL request failed:', {
      error,
      query,
      variables,
      endpoint: config.graphqlUrl,
    });
    throw error;
  }
}

interface UseGraphQLQueryOptions {
  pollInterval?: number;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
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
    // Increase staleTime to 2 seconds to reduce unnecessary refetches
    staleTime = 2000,
    // Keep unused data in cache for 5 minutes
    gcTime = 5 * 60 * 1000,
  } = options;

  return useQuery({
    queryKey,
    queryFn: () => fetchGraphQL<T>(query, variables),
    retry: (failureCount, error) => {
      // Don't retry on specific error conditions
      if (error instanceof GraphQLError) {
        if (error.status === 404 || error.status === 400) {
          return false;
        }
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    refetchInterval: pollInterval,
    staleTime,
    gcTime,
    // Use cached data and only trigger rerender if data actually changed
    placeholderData: (previousData) => previousData,
    select: (data) => {
      const previousData = responseCache.get(
        JSON.stringify({ query, variables })
      ) as T;
      return isDeepEqual(data, previousData) ? previousData : data;
    },
    enabled,
  });
}

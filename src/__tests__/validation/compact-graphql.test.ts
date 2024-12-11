import { validateCompact } from '../../validation/compact';
import { getFreshCompact, compactToAPI } from '../utils/test-server';
import { PGlite } from '@electric-sql/pglite';
import {
  graphqlClient,
  AccountDeltasResponse,
  AccountResponse,
  fetchAndCacheSupportedChains,
  SupportedChainsResponse,
} from '../../graphql';
import {
  setupCompactTestDb,
  cleanupCompactTestDb,
  setupGraphQLMocks,
} from './utils/compact-test-setup';

interface GraphQLDocument {
  source: string;
}

type GraphQLRequestFn = (
  query: string | GraphQLDocument,
  variables?: Record<string, unknown>
) => Promise<
  SupportedChainsResponse | (AccountDeltasResponse & AccountResponse)
>;

describe('Compact GraphQL Validation', () => {
  let db: PGlite;
  let originalRequest: typeof graphqlClient.request;

  beforeAll(async (): Promise<void> => {
    db = await setupCompactTestDb();
  });

  afterAll(async (): Promise<void> => {
    await cleanupCompactTestDb(db);
  });

  beforeEach(async (): Promise<void> => {
    originalRequest = graphqlClient.request;
    setupGraphQLMocks();
    // Initialize chain config cache
    await fetchAndCacheSupportedChains(process.env.ALLOCATOR_ADDRESS!);
  });

  afterEach((): void => {
    graphqlClient.request = originalRequest;
  });

  it('should validate with sufficient balance', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<
      AccountDeltasResponse & AccountResponse
    > => ({
      accountDeltas: {
        items: [],
      },
      account: {
        resourceLocks: {
          items: [
            {
              withdrawalStatus: 0,
              balance: '1000000000000000000000', // 1000 ETH
            },
          ],
        },
        claims: {
          items: [],
        },
      },
    });

    const result = await validateCompact(
      compactToAPI(getFreshCompact()),
      '1',
      db
    );
    expect(result.isValid).toBe(true);
  });

  it('should reject with insufficient balance', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<
      AccountDeltasResponse & AccountResponse
    > => ({
      accountDeltas: {
        items: [],
      },
      account: {
        resourceLocks: {
          items: [
            {
              withdrawalStatus: 0,
              balance: '1', // Very small balance
            },
          ],
        },
        claims: {
          items: [],
        },
      },
    });

    const result = await validateCompact(
      compactToAPI(getFreshCompact()),
      '1',
      db
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Insufficient');
  });

  it('should reject when withdrawal is enabled', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<
      AccountDeltasResponse & AccountResponse
    > => ({
      accountDeltas: {
        items: [],
      },
      account: {
        resourceLocks: {
          items: [
            {
              withdrawalStatus: 1, // Withdrawal enabled
              balance: '1000000000000000000000',
            },
          ],
        },
        claims: {
          items: [],
        },
      },
    });

    const result = await validateCompact(
      compactToAPI(getFreshCompact()),
      '1',
      db
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('withdrawals enabled');
  });

  it('should reject when allocator ID does not match', async (): Promise<void> => {
    // Mock a different allocator ID in the chain config cache
    (graphqlClient as { request: GraphQLRequestFn }).request = async (
      document: string | GraphQLDocument,
      _variables?: Record<string, unknown>
    ): Promise<
      SupportedChainsResponse | (AccountDeltasResponse & AccountResponse)
    > => {
      const query = typeof document === 'string' ? document : document.source;
      if (query.includes('GetSupportedChains')) {
        return {
          allocator: {
            supportedChains: {
              items: [
                {
                  chainId: '1',
                  allocatorId: '999', // Different allocator ID
                },
              ],
            },
          },
        };
      }
      // Return mock account data for other queries
      return {
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: '1000000000000000000000',
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      };
    };

    // Refresh chain config with new mock
    await fetchAndCacheSupportedChains(process.env.ALLOCATOR_ADDRESS!);

    const result = await validateCompact(
      compactToAPI(getFreshCompact()),
      '1',
      db
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid allocator ID');
  });

  it('should reject when allocatorId is missing from chain config', async (): Promise<void> => {
    // Mock empty supported chains in the chain config cache
    (graphqlClient as { request: GraphQLRequestFn }).request = async (
      document: string | GraphQLDocument,
      _variables?: Record<string, unknown>
    ): Promise<
      SupportedChainsResponse | (AccountDeltasResponse & AccountResponse)
    > => {
      const query = typeof document === 'string' ? document : document.source;
      if (query.includes('GetSupportedChains')) {
        return {
          allocator: {
            supportedChains: {
              items: [], // No supported chains
            },
          },
        };
      }
      // Return mock account data for other queries
      return {
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: '1000000000000000000000',
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      };
    };

    // Refresh chain config with new mock
    await fetchAndCacheSupportedChains(process.env.ALLOCATOR_ADDRESS!);

    const result = await validateCompact(
      compactToAPI(getFreshCompact()),
      '1',
      db
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid allocator ID');
  });

  it('should handle GraphQL request errors', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<never> => {
      throw new Error('GraphQL request failed');
    };

    const result = await validateCompact(
      compactToAPI(getFreshCompact()),
      '1',
      db
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('GraphQL request failed');
  });
});

import { validateCompact } from '../../validation/compact';
import { getFreshCompact } from '../utils/test-server';
import { PGlite } from '@electric-sql/pglite';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../../graphql';
import {
  setupCompactTestDb,
  cleanupCompactTestDb,
} from './utils/compact-test-setup';

describe('Compact GraphQL Validation', () => {
  let db: PGlite;
  let originalRequest: typeof graphqlClient.request;

  beforeAll(async (): Promise<void> => {
    db = await setupCompactTestDb();
  });

  afterAll(async (): Promise<void> => {
    await cleanupCompactTestDb(db);
  });

  beforeEach((): void => {
    originalRequest = graphqlClient.request;
  });

  afterEach((): void => {
    graphqlClient.request = originalRequest;
  });

  it('should validate with sufficient balance', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<
      AllocatorResponse & AccountDeltasResponse & AccountResponse
    > => ({
      allocator: {
        supportedChains: {
          items: [{ allocatorId: '1' }],
        },
      },
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

    const result = await validateCompact(getFreshCompact(), '1', db);
    expect(result.isValid).toBe(true);
  });

  it('should reject with insufficient balance', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<
      AllocatorResponse & AccountDeltasResponse & AccountResponse
    > => ({
      allocator: {
        supportedChains: {
          items: [{ allocatorId: '1' }],
        },
      },
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

    const result = await validateCompact(getFreshCompact(), '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Insufficient');
  });

  it('should reject when withdrawal is enabled', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<
      AllocatorResponse & AccountDeltasResponse & AccountResponse
    > => ({
      allocator: {
        supportedChains: {
          items: [{ allocatorId: '1' }],
        },
      },
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

    const result = await validateCompact(getFreshCompact(), '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('withdrawals enabled');
  });

  it('should reject when allocator ID does not match', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<
      AllocatorResponse & AccountDeltasResponse & AccountResponse
    > => ({
      allocator: {
        supportedChains: {
          items: [{ allocatorId: '999' }], // Different allocator ID
        },
      },
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
    });

    const result = await validateCompact(getFreshCompact(), '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid allocator ID');
  });

  it('should reject when no supported chains are found', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<
      AllocatorResponse & AccountDeltasResponse & AccountResponse
    > => ({
      allocator: {
        supportedChains: {
          items: [], // Empty supported chains
        },
      },
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
    });

    const result = await validateCompact(getFreshCompact(), '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid allocator ID');
  });

  it('should handle GraphQL request errors', async (): Promise<void> => {
    graphqlClient.request = async (): Promise<never> => {
      throw new Error('GraphQL request failed');
    };

    const result = await validateCompact(getFreshCompact(), '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('GraphQL request failed');
  });
});

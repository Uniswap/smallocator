import { FastifyInstance } from 'fastify';
import {
  createTestServer,
  cleanupTestServer,
  createTestSession,
} from '../utils/test-server';
import {
  graphqlClient,
  AccountDeltasResponse,
  AccountResponse,
  AllResourceLocksResponse,
  fetchAndCacheSupportedChains,
} from '../../graphql';
import { RequestDocument, Variables, RequestOptions } from 'graphql-request';
import { dbManager } from '../setup';
import { hexToBytes } from 'viem/utils';

describe('Deposit Balance Routes', () => {
  let server: FastifyInstance;
  let sessionId: string;
  let originalRequest: typeof graphqlClient.request;
  const realDateNow = Date.now;

  beforeEach(async () => {
    // Set up test server and session
    server = await createTestServer();
    sessionId = await createTestSession(server);

    // Store original function
    originalRequest = graphqlClient.request;

    // Mock current time
    Date.now = () => 1702152079000; // 2024-12-09T12:01:19-08:00

    // Initialize chain config cache
    await fetchAndCacheSupportedChains(process.env.ALLOCATOR_ADDRESS!);
  });

  afterEach(async () => {
    // Clean up
    await cleanupTestServer();
    Date.now = realDateNow;
    // Restore original function
    graphqlClient.request = originalRequest;
  });

  it('should reflect deposit in allocatable balance', async () => {
    const chainId = '10'; // Optimism
    const lockId =
      '0x1234567890123456789012345678901234567890123456789012345678901234';
    const currentBalance = '1000000000000000000'; // 1 ETH
    const pendingBalance = '500000000000000000'; // 0.5 ETH

    // Mock GraphQL responses
    graphqlClient.request = async <
      V extends Variables = Variables,
      T = (AccountDeltasResponse & AccountResponse) | AllResourceLocksResponse,
    >(
      documentOrOptions: RequestDocument | RequestOptions<V, T>,
      ..._variablesAndRequestHeaders: unknown[]
    ): Promise<T> => {
      const query = documentOrOptions.toString();

      if (query.includes('GetAllResourceLocks')) {
        return {
          account: {
            resourceLocks: {
              items: [
                {
                  chainId,
                  resourceLock: {
                    lockId,
                    allocatorAddress: process.env.ALLOCATOR_ADDRESS,
                  },
                },
              ],
            },
          },
        } as T;
      }

      if (query.includes('GetDetails')) {
        return {
          accountDeltas: {
            items: [
              {
                delta: pendingBalance,
              },
            ],
          },
          account: {
            resourceLocks: {
              items: [
                {
                  withdrawalStatus: 0,
                  balance: currentBalance,
                },
              ],
            },
            claims: {
              items: [],
            },
          },
        } as T;
      }

      return {} as T;
    };

    // Get balances
    const response = await server.inject({
      method: 'GET',
      url: '/balances',
      headers: {
        'x-session-id': sessionId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body).toHaveProperty('balances');
    expect(Array.isArray(body.balances)).toBe(true);
    expect(body.balances.length).toBe(1);

    const balance = body.balances[0];
    expect(balance).toMatchObject({
      chainId,
      lockId,
      allocatableBalance: '500000000000000000', // Should be currentBalance - pendingBalance = 0.5 ETH
      allocatedBalance: '0',
      balanceAvailableToAllocate: '500000000000000000',
      withdrawalStatus: 0,
    });
  });

  it('should set allocatable balance to 0 when pending balance exceeds current balance', async () => {
    const chainId = '10'; // Optimism
    const lockId =
      '0x1234567890123456789012345678901234567890123456789012345678901234';
    const currentBalance = '1000000000000000000'; // 1 ETH
    const pendingBalance = '2000000000000000000'; // 2 ETH (exceeds current balance)

    // Mock GraphQL responses
    graphqlClient.request = async <
      V extends Variables = Variables,
      T = (AccountDeltasResponse & AccountResponse) | AllResourceLocksResponse,
    >(
      documentOrOptions: RequestDocument | RequestOptions<V, T>,
      ..._variablesAndRequestHeaders: unknown[]
    ): Promise<T> => {
      const query = documentOrOptions.toString();

      if (query.includes('GetAllResourceLocks')) {
        return {
          account: {
            resourceLocks: {
              items: [
                {
                  chainId,
                  resourceLock: {
                    lockId,
                    allocatorAddress: process.env.ALLOCATOR_ADDRESS,
                  },
                },
              ],
            },
          },
        } as T;
      }

      if (query.includes('GetDetails')) {
        return {
          accountDeltas: {
            items: [
              {
                delta: pendingBalance, // Unfinalized deposit exceeds current balance
              },
            ],
          },
          account: {
            resourceLocks: {
              items: [
                {
                  withdrawalStatus: 0,
                  balance: currentBalance,
                },
              ],
            },
            claims: {
              items: [],
            },
          },
        } as T;
      }

      return {} as T;
    };

    // Get balances
    const response = await server.inject({
      method: 'GET',
      url: '/balances',
      headers: {
        'x-session-id': sessionId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body).toHaveProperty('balances');
    expect(Array.isArray(body.balances)).toBe(true);
    expect(body.balances.length).toBe(1);

    const balance = body.balances[0];
    expect(balance).toMatchObject({
      chainId,
      lockId,
      allocatableBalance: '0', // Should be 0 since pending balance exceeds current balance
      allocatedBalance: '0',
      balanceAvailableToAllocate: '0',
      withdrawalStatus: 0,
    });
  });

  it('should reflect finalized claims in allocated balance', async () => {
    const chainId = '10'; // Optimism
    const lockId =
      '0x1234567890123456789012345678901234567890123456789012345678901234';
    const currentBalance = '1000000000000000000'; // 1 ETH
    const pendingBalance = '0'; // No pending deposits
    const claimAmount = '300000000000000000'; // 0.3 ETH claimed

    // Mock GraphQL responses
    graphqlClient.request = async <
      V extends Variables = Variables,
      T = (AccountDeltasResponse & AccountResponse) | AllResourceLocksResponse,
    >(
      documentOrOptions: RequestDocument | RequestOptions<V, T>,
      ..._variablesAndRequestHeaders: unknown[]
    ): Promise<T> => {
      const query = documentOrOptions.toString();

      if (query.includes('GetAllResourceLocks')) {
        return {
          account: {
            resourceLocks: {
              items: [
                {
                  chainId,
                  resourceLock: {
                    lockId,
                    allocatorAddress: process.env.ALLOCATOR_ADDRESS,
                  },
                },
              ],
            },
          },
        } as T;
      }

      if (query.includes('GetDetails')) {
        return {
          accountDeltas: {
            items: [
              {
                delta: pendingBalance,
              },
            ],
          },
          account: {
            resourceLocks: {
              items: [
                {
                  withdrawalStatus: 0,
                  balance: currentBalance,
                },
              ],
            },
            claims: {
              items: [
                {
                  // Add a finalized claim
                  claimHash:
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                  amount: claimAmount,
                  isFinalized: true,
                },
              ],
            },
          },
        } as T;
      }

      return {} as T;
    };

    // Get balances
    const response = await server.inject({
      method: 'GET',
      url: '/balances',
      headers: {
        'x-session-id': sessionId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body).toHaveProperty('balances');
    expect(Array.isArray(body.balances)).toBe(true);
    expect(body.balances.length).toBe(1);

    const balance = body.balances[0];
    expect(balance).toMatchObject({
      chainId,
      lockId,
      allocatableBalance: '1000000000000000000', // Full 1 ETH since no pending deposits
      allocatedBalance: '0', // 0 ETH since the claim is finalized (already processed)
      balanceAvailableToAllocate: '1000000000000000000', // 1 ETH (currentBalance since no allocated balance)
      withdrawalStatus: 0,
    });
  });

  it('should reduce allocatable balance by finalized claims', async () => {
    const chainId = '10'; // Optimism
    const lockId =
      '0x1234567890123456789012345678901234567890123456789012345678901234';
    const currentBalance = '1000000000000000000'; // 1 ETH
    const pendingBalance = '0';

    // Define our test amounts
    const finalizedAmount = '300000000000000000'; // 0.3 ETH (processed)
    const unprocessedAmount = '200000000000000000'; // 0.2 ETH (not expired)
    const expiredAmount = '100000000000000000'; // 0.1 ETH (expired)

    // Current time in seconds
    const currentTime = Math.floor(Date.now() / 1000);

    // Insert test compacts into database
    const db = await dbManager.getDb();

    // 1. Insert finalized compact (already processed)
    await db.query(
      `
      INSERT INTO compacts (
        id, chain_id, claim_hash, arbiter, sponsor, nonce, expires, lock_id, amount, signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        '123e4567-e89b-12d3-a456-426614174002',
        chainId,
        hexToBytes(
          '0x1234567890123456789012345678901234567890123456789012345678901234'
        ), // Same as finalized claim hash
        hexToBytes('0x1230000000000000000000000000000000000123'),
        hexToBytes('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        hexToBytes(
          '0x0000000000000000000000000000000000000000000000000000000000000003'
        ),
        currentTime + 3600, // Not expired, but finalized via claim
        hexToBytes(lockId),
        hexToBytes(
          ('0x' +
            BigInt(finalizedAmount)
              .toString(16)
              .padStart(64, '0')) as `0x${string}`
        ),
        hexToBytes(
          '0x1234000000000000000000000000000000000000000000000000000000001236'
        ),
      ]
    );

    // 2. Insert unprocessed compact (not expired)
    await db.query(
      `
      INSERT INTO compacts (
        id, chain_id, claim_hash, arbiter, sponsor, nonce, expires, lock_id, amount, signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        '123e4567-e89b-12d3-a456-426614174000',
        chainId,
        hexToBytes(
          '0x2000000000000000000000000000000000000000000000000000000000000001'
        ),
        hexToBytes('0x1230000000000000000000000000000000000123'),
        hexToBytes('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        hexToBytes(
          '0x0000000000000000000000000000000000000000000000000000000000000001'
        ),
        currentTime + 3600, // Expires in 1 hour
        hexToBytes(lockId),
        hexToBytes(
          ('0x' +
            BigInt(unprocessedAmount)
              .toString(16)
              .padStart(64, '0')) as `0x${string}`
        ),
        hexToBytes(
          '0x1234000000000000000000000000000000000000000000000000000000001234'
        ),
      ]
    );

    // 3. Insert expired compact
    await db.query(
      `
      INSERT INTO compacts (
        id, chain_id, claim_hash, arbiter, sponsor, nonce, expires, lock_id, amount, signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        '123e4567-e89b-12d3-a456-426614174001',
        chainId,
        hexToBytes(
          '0x3000000000000000000000000000000000000000000000000000000000000001'
        ),
        hexToBytes('0x1230000000000000000000000000000000000123'),
        hexToBytes('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        hexToBytes(
          '0x0000000000000000000000000000000000000000000000000000000000000002'
        ),
        currentTime - 3600, // Expired 1 hour ago
        hexToBytes(lockId),
        hexToBytes(
          ('0x' +
            BigInt(expiredAmount)
              .toString(16)
              .padStart(64, '0')) as `0x${string}`
        ),
        hexToBytes(
          '0x1234000000000000000000000000000000000000000000000000000000001235'
        ),
      ]
    );

    // Mock GraphQL responses
    graphqlClient.request = async <
      V extends Variables = Variables,
      T = (AccountDeltasResponse & AccountResponse) | AllResourceLocksResponse,
    >(
      documentOrOptions: RequestDocument | RequestOptions<V, T>,
      ..._variablesAndRequestHeaders: unknown[]
    ): Promise<T> => {
      const query = documentOrOptions.toString();

      if (query.includes('GetAllResourceLocks')) {
        return {
          account: {
            resourceLocks: {
              items: [
                {
                  chainId,
                  resourceLock: {
                    lockId,
                    allocatorAddress: process.env.ALLOCATOR_ADDRESS,
                  },
                },
              ],
            },
          },
        } as T;
      }

      if (query.includes('GetDetails')) {
        return {
          accountDeltas: {
            items: [
              {
                delta: pendingBalance,
              },
            ],
          },
          account: {
            resourceLocks: {
              items: [
                {
                  withdrawalStatus: 0,
                  balance: currentBalance,
                },
              ],
            },
            claims: {
              items: [
                {
                  // Add a finalized claim
                  claimHash:
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                  amount: finalizedAmount,
                  isFinalized: true,
                },
              ],
            },
          },
        } as T;
      }

      return {} as T;
    };

    // Get balances
    const response = await server.inject({
      method: 'GET',
      url: '/balances',
      headers: {
        'x-session-id': sessionId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body).toHaveProperty('balances');
    expect(Array.isArray(body.balances)).toBe(true);
    expect(body.balances.length).toBe(1);

    const balance = body.balances[0];
    expect(balance).toMatchObject({
      chainId,
      lockId,
      allocatableBalance: '1000000000000000000', // Full 1 ETH since no pending deposits
      allocatedBalance: '200000000000000000', // 0.2 ETH (only the unprocessed, non-expired compact)
      balanceAvailableToAllocate: '800000000000000000', // 0.8 ETH (currentBalance - allocatedBalance)
      withdrawalStatus: 0,
    });
  });
});

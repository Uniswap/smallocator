import { FastifyInstance } from 'fastify';
import {
  createTestServer,
  cleanupTestServer,
  generateSignature,
} from '../utils/test-server';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
  AllResourceLocksResponse,
} from '../../graphql';
import { RequestDocument, Variables, RequestOptions } from 'graphql-request';

describe('Deposit Balance Routes', () => {
  let server: FastifyInstance;
  let sessionId: string;
  let originalRequest: typeof graphqlClient.request;

  beforeEach(async () => {
    server = await createTestServer();

    // Store original function
    originalRequest = graphqlClient.request;

    // First get a session request
    const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Test address that matches TEST_PRIVATE_KEY
    const sessionResponse = await server.inject({
      method: 'GET',
      url: `/session/1/${address}`,
    });

    expect(sessionResponse.statusCode).toBe(200);
    const sessionRequest = JSON.parse(sessionResponse.payload);

    // Create a valid session using the session request data
    const signature = await generateSignature(sessionRequest.session);
    const response = await server.inject({
      method: 'POST',
      url: '/session',
      payload: {
        payload: sessionRequest.session,
        signature,
      },
    });

    const result = JSON.parse(response.payload);
    if (!result.session?.id) {
      throw new Error('Failed to create session: ' + JSON.stringify(result));
    }
    sessionId = result.session.id;
  });

  afterEach(async () => {
    await cleanupTestServer();
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
      T =
        | (AllocatorResponse & AccountDeltasResponse & AccountResponse)
        | AllResourceLocksResponse,
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
          allocator: {
            supportedChains: {
              items: [{ allocatorId: '1' }],
            },
          },
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
      T =
        | (AllocatorResponse & AccountDeltasResponse & AccountResponse)
        | AllResourceLocksResponse,
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
          allocator: {
            supportedChains: {
              items: [{ allocatorId: '1' }],
            },
          },
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
});

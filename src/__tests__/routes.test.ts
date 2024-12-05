import { FastifyInstance } from 'fastify';
import {
  createTestServer,
  validPayload,
  getFreshCompact,
  cleanupTestServer,
  compactToAPI,
  generateSignature,
} from './utils/test-server';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
  AllResourceLocksResponse,
} from '../graphql';
import { RequestDocument, Variables, RequestOptions } from 'graphql-request';

describe('API Routes', () => {
  let server: FastifyInstance;
  let originalRequest: typeof graphqlClient.request;

  beforeEach(async () => {
    server = await createTestServer();

    // Store original function
    originalRequest = graphqlClient.request;

    // Mock GraphQL response
    graphqlClient.request = async <
      V extends Variables = Variables,
      T = AllocatorResponse & AccountDeltasResponse & AccountResponse,
    >(
      _documentOrOptions: RequestDocument | RequestOptions<V, T>,
      ..._variablesAndRequestHeaders: unknown[]
    ): Promise<
      AllocatorResponse & AccountDeltasResponse & AccountResponse
    > => ({
      allocator: {
        supportedChains: {
          items: [{ allocatorId: '1' }], // Match the allocatorId in test compact
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
  });

  afterEach(async () => {
    await cleanupTestServer();
    // Restore original function
    graphqlClient.request = originalRequest;
  });

  describe('GET /health', () => {
    it('should return health status and addresses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('allocatorAddress');
      expect(body).toHaveProperty('signingAddress');
      expect(body).toHaveProperty('timestamp');

      // Verify timestamp is a valid ISO 8601 date
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('should fail if environment variables are not set', async () => {
      // Store original env vars
      const originalAllocator = process.env.ALLOCATOR_ADDRESS;
      const originalSigning = process.env.SIGNING_ADDRESS;

      // Unset env vars
      delete process.env.ALLOCATOR_ADDRESS;
      delete process.env.SIGNING_ADDRESS;

      try {
        const response = await server.inject({
          method: 'GET',
          url: '/health',
        });

        expect(response.statusCode).toBe(500);
      } finally {
        // Restore env vars
        process.env.ALLOCATOR_ADDRESS = originalAllocator;
        process.env.SIGNING_ADDRESS = originalSigning;
      }
    });
  });

  describe('GET /session/:chainId/:address', () => {
    it('should return a session payload for valid address', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/session/1/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('session');
      expect(result.session).toHaveProperty('address');
      expect(result.session).toHaveProperty('nonce');
      expect(result.session).toHaveProperty('expirationTime');
      expect(result.session).toHaveProperty('domain');
    });

    it('should reject invalid ethereum address', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/session/1/invalid-address',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /session', () => {
    it('should create session with valid signature', async () => {
      // First get a session request
      const sessionResponse = await server.inject({
        method: 'GET',
        url: `/session/1/${validPayload.address}`,
      });

      expect(sessionResponse.statusCode).toBe(200);
      const sessionRequest = JSON.parse(sessionResponse.payload);

      const signature = await generateSignature(sessionRequest.session);
      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload: sessionRequest.session,
          signature,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('session');
      expect(result.session).toHaveProperty('id');
      expect(result.session).toHaveProperty('address');
      expect(result.session).toHaveProperty('expiresAt');
    });

    it('should reject invalid signature', async () => {
      // First get a session request
      const sessionResponse = await server.inject({
        method: 'GET',
        url: `/session/1/${validPayload.address}`,
      });

      expect(sessionResponse.statusCode).toBe(200);
      const sessionRequest = JSON.parse(sessionResponse.payload);

      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload: sessionRequest.session,
          signature: 'invalid-signature',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Session Management', () => {
    let sessionId: string;
    let address: string;

    beforeEach(async () => {
      address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      // First get a session request
      const sessionResponse = await server.inject({
        method: 'GET',
        url: `/session/1/${address}`,
      });

      expect(sessionResponse.statusCode).toBe(200);
      const sessionRequest = JSON.parse(sessionResponse.payload);

      // Normalize timestamps to match database precision
      const payload = {
        ...sessionRequest.session,
        issuedAt: new Date(sessionRequest.session.issuedAt).toISOString(),
        expirationTime: new Date(
          sessionRequest.session.expirationTime
        ).toISOString(),
      };

      // Create a valid session
      const signature = await generateSignature(payload);
      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload,
          signature,
        },
      });

      const result = JSON.parse(response.payload);
      expect(response.statusCode).toBe(200);
      expect(result.session?.id).toBeDefined();
      sessionId = result.session.id;
    });

    describe('GET /session', () => {
      it('should verify valid session', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/session',
          headers: {
            'x-session-id': sessionId,
          },
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(result.session).toBeDefined();
        expect(result.session.id).toBe(sessionId);
        expect(result.session.address).toBe(address);
        expect(result.session.expiresAt).toBeDefined();
      });

      it('should reject invalid session ID', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/session',
          headers: {
            'x-session-id': 'invalid-session-id',
          },
        });

        expect(response.statusCode).toBe(401);
        const result = JSON.parse(response.payload);
        expect(result.error).toBeDefined();
      });

      it('should reject missing session ID', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/session',
        });

        expect(response.statusCode).toBe(401);
        const result = JSON.parse(response.payload);
        expect(result.error).toBe('Session ID required');
      });
    });

    describe('DELETE /session', () => {
      it('should delete valid session', async () => {
        // First verify session exists
        const verifyResponse = await server.inject({
          method: 'GET',
          url: '/session',
          headers: {
            'x-session-id': sessionId,
          },
        });
        expect(verifyResponse.statusCode).toBe(200);

        // Delete session
        const deleteResponse = await server.inject({
          method: 'DELETE',
          url: '/session',
          headers: {
            'x-session-id': sessionId,
          },
        });
        expect(deleteResponse.statusCode).toBe(200);

        // Verify session is gone
        const finalResponse = await server.inject({
          method: 'GET',
          url: '/session',
          headers: {
            'x-session-id': sessionId,
          },
        });
        expect(finalResponse.statusCode).toBe(401);
      });

      it('should reject deleting invalid session', async () => {
        const response = await server.inject({
          method: 'DELETE',
          url: '/session',
          headers: {
            'x-session-id': 'invalid-session-id',
          },
        });

        expect(response.statusCode).toBe(401);
        const result = JSON.parse(response.payload);
        expect(result.error).toBeDefined();
      });

      it('should reject deleting without session ID', async () => {
        const response = await server.inject({
          method: 'DELETE',
          url: '/session',
        });

        expect(response.statusCode).toBe(401);
        const result = JSON.parse(response.payload);
        expect(result.error).toBe('Session ID required');
      });
    });
  });

  describe('Protected Routes', () => {
    let sessionId: string;

    beforeEach(async () => {
      // First get a session request
      const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      const sessionResponse = await server.inject({
        method: 'GET',
        url: `/session/1/${address}`,
      });

      expect(sessionResponse.statusCode).toBe(200);
      const sessionRequest = JSON.parse(sessionResponse.payload);

      // Normalize timestamps to match database precision
      const payload = {
        ...sessionRequest.session,
        issuedAt: new Date(sessionRequest.session.issuedAt).toISOString(),
        expirationTime: new Date(
          sessionRequest.session.expirationTime
        ).toISOString(),
      };

      // Create a valid session to use in tests
      const signature = await generateSignature(payload);
      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload,
          signature,
        },
      });

      const result = JSON.parse(response.payload);
      if (!result.session?.id) {
        throw new Error('Failed to create session: ' + JSON.stringify(result));
      }
      sessionId = result.session.id;
    });

    describe('POST /compact', () => {
      it('should submit valid compact', async () => {
        const freshCompact = getFreshCompact();
        const compactPayload = {
          chainId: '1',
          compact: compactToAPI(freshCompact),
        };

        const response = await server.inject({
          method: 'POST',
          url: '/compact',
          headers: {
            'x-session-id': sessionId,
          },
          payload: compactPayload,
        });

        if (response.statusCode !== 200) {
          console.error('Error submitting compact:', response.payload);
        }

        expect(response.statusCode).toBe(200);
      });

      it('should reject request without session', async () => {
        const freshCompact = getFreshCompact();
        const compactPayload = {
          chainId: '1',
          compact: compactToAPI(freshCompact),
        };

        const response = await server.inject({
          method: 'POST',
          url: '/compact',
          payload: compactPayload,
        });

        expect(response.statusCode).toBe(401);
      });

      it('should store nonce after successful submission', async (): Promise<void> => {
        const freshCompact = getFreshCompact();
        const chainId = '1';

        // Store original function
        const originalRequest = graphqlClient.request;

        // Mock GraphQL response
        graphqlClient.request = async <
          V extends Variables = Variables,
          T = AllocatorResponse & AccountDeltasResponse & AccountResponse,
        >(
          _documentOrOptions: RequestDocument | RequestOptions<V, T>,
          ..._variablesAndRequestHeaders: unknown[]
        ): Promise<
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
                  balance: '1000000000000000000000',
                },
              ],
            },
            claims: {
              items: [],
            },
          },
        });

        try {
          // Submit compact
          const response = await server.inject({
            method: 'POST',
            url: '/compact',
            headers: {
              'x-session-id': sessionId,
            },
            payload: { chainId, compact: compactToAPI(freshCompact) },
          });

          expect(response.statusCode).toBe(200);

          // Verify nonce was stored
          const result = await server.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM nonces WHERE chain_id = $1 AND nonce = $2',
            [chainId, freshCompact.nonce.toString()]
          );
          expect(result.rows[0].count).toBe(1);
        } finally {
          // Restore original function
          graphqlClient.request = originalRequest;
        }
      });
    });

    describe('GET /compacts', () => {
      it('should return compacts for authenticated user', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/compacts',
          headers: {
            'x-session-id': sessionId,
          },
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(Array.isArray(result)).toBe(true);
      });

      it('should reject request without session', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/compacts',
        });

        expect(response.statusCode).toBe(401);
      });
    });

    describe('GET /compact/:chainId/:claimHash', () => {
      it('should return specific compact', async () => {
        const freshCompact = getFreshCompact();
        const compactPayload = {
          chainId: '1',
          compact: compactToAPI(freshCompact),
        };

        // First submit a compact
        const submitResponse = await server.inject({
          method: 'POST',
          url: '/compact',
          headers: {
            'x-session-id': sessionId,
          },
          payload: compactPayload,
        });

        const submitResponseData = JSON.parse(submitResponse.payload);
        if (
          submitResponse.statusCode !== 200 ||
          !submitResponseData.result?.hash
        ) {
          console.error('Failed to submit compact:', submitResponse.payload);
          throw new Error('Failed to submit compact');
        }

        const { hash } = submitResponseData.result;

        const response = await server.inject({
          method: 'GET',
          url: `/compact/1/${hash}`,
          headers: {
            'x-session-id': sessionId,
          },
        });

        if (response.statusCode === 500) {
          console.error('Got 500 error:', {
            payload: response.payload,
            hash,
            sessionId,
          });
        }

        expect(response.statusCode).toBe(200);
      });

      it('should return error for non-existent compact', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/compact/1/0x0000000000000000000000000000000000000000000000000000000000000000',
          headers: {
            'x-session-id': sessionId,
          },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('GET /balance/:chainId/:lockId', () => {
      it('should return balance information for valid lock', async () => {
        const freshCompact = getFreshCompact();
        const lockId = freshCompact.id.toString();

        const response = await server.inject({
          method: 'GET',
          url: `/balance/1/${lockId}`,
          headers: {
            'x-session-id': sessionId,
          },
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(result).toHaveProperty('allocatableBalance');
        expect(result).toHaveProperty('allocatedBalance');
        expect(result).toHaveProperty('balanceAvailableToAllocate');
        expect(result).toHaveProperty('withdrawalStatus');

        // Verify numeric string formats
        expect(/^\d+$/.test(result.allocatableBalance)).toBe(true);
        expect(/^\d+$/.test(result.allocatedBalance)).toBe(true);
        expect(/^\d+$/.test(result.balanceAvailableToAllocate)).toBe(true);
        expect(typeof result.withdrawalStatus).toBe('number');
      });

      it('should return 401 without session', async () => {
        const freshCompact = getFreshCompact();
        const lockId = freshCompact.id.toString();

        const response = await server.inject({
          method: 'GET',
          url: `/balance/1/${lockId}`,
        });

        expect(response.statusCode).toBe(401);
      });

      it('should return 404 for non-existent lock', async () => {
        // Store original function
        const originalRequest = graphqlClient.request;

        // Mock GraphQL response with no resource lock
        graphqlClient.request = async <
          V extends Variables = Variables,
          T = AllocatorResponse & AccountDeltasResponse & AccountResponse,
        >(
          _documentOrOptions: RequestDocument | RequestOptions<V, T>,
          ..._variablesAndRequestHeaders: unknown[]
        ): Promise<
          AllocatorResponse & AccountDeltasResponse & AccountResponse
        > => ({
          allocator: {
            supportedChains: {
              items: [],
            },
          },
          accountDeltas: {
            items: [],
          },
          account: {
            resourceLocks: {
              items: [], // Empty array indicates no resource lock found
            },
            claims: {
              items: [],
            },
          },
        });

        try {
          const response = await server.inject({
            method: 'GET',
            url: '/balance/1/0x0000000000000000000000000000000000000000000000000000000000000000',
            headers: {
              'x-session-id': sessionId,
            },
          });

          expect(response.statusCode).toBe(404);
        } finally {
          // Restore original function
          graphqlClient.request = originalRequest;
        }
      });

      it('should return zero balanceAvailableToAllocate when withdrawal enabled', async () => {
        // Store original function
        const originalRequest = graphqlClient.request;

        // Mock GraphQL response with withdrawal status = 1
        graphqlClient.request = async <
          V extends Variables = Variables,
          T = AllocatorResponse & AccountDeltasResponse & AccountResponse,
        >(
          _documentOrOptions: RequestDocument | RequestOptions<V, T>,
          ..._variablesAndRequestHeaders: unknown[]
        ): Promise<
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
                  withdrawalStatus: 1,
                  balance: '1000000000000000000000',
                },
              ],
            },
            claims: {
              items: [],
            },
          },
        });

        try {
          const freshCompact = getFreshCompact();
          const lockId = freshCompact.id.toString();

          const response = await server.inject({
            method: 'GET',
            url: `/balance/1/${lockId}`,
            headers: {
              'x-session-id': sessionId,
            },
          });

          expect(response.statusCode).toBe(200);
          const result = JSON.parse(response.payload);
          expect(result.balanceAvailableToAllocate).toBe('0');
          expect(result.withdrawalStatus).toBe(1);
        } finally {
          // Restore original function
          graphqlClient.request = originalRequest;
        }
      });
    });

    describe('GET /balances', () => {
      it('should return balances for all resource locks', async () => {
        // Store original function
        const originalRequest = graphqlClient.request;

        // Mock GraphQL response for getAllResourceLocks
        let requestCount = 0;
        graphqlClient.request = async <
          V extends Variables = Variables,
          T =
            | AllResourceLocksResponse
            | (AllocatorResponse & AccountDeltasResponse & AccountResponse),
        >(
          _documentOrOptions: RequestDocument | RequestOptions<V, T>,
          ..._variablesAndRequestHeaders: unknown[]
        ): Promise<
          | AllResourceLocksResponse
          | (AllocatorResponse & AccountDeltasResponse & AccountResponse)
        > => {
          requestCount++;
          if (requestCount === 1) {
            // First request - getAllResourceLocks
            return {
              account: {
                resourceLocks: {
                  items: [
                    {
                      chainId: '1',
                      resourceLock: {
                        lockId: '0x1234',
                        allocatorAddress: process.env.ALLOCATOR_ADDRESS!, // Add non-null assertion
                      },
                    },
                    {
                      chainId: '2',
                      resourceLock: {
                        lockId: '0x5678',
                        allocatorAddress: 'different_address',
                      },
                    },
                  ],
                },
              },
            };
          } else {
            // Subsequent requests - getCompactDetails
            return {
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
                      balance: '1000000000000000000000',
                    },
                  ],
                },
                claims: {
                  items: [],
                },
              },
            };
          }
        };

        try {
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
          expect(body.balances.length).toBe(1); // Only our allocator's locks

          const balance = body.balances[0];
          expect(balance).toHaveProperty('chainId', '1');
          expect(balance).toHaveProperty('lockId', '0x1234');
          expect(balance).toHaveProperty('allocatableBalance');
          expect(balance).toHaveProperty('allocatedBalance');
          expect(balance).toHaveProperty('balanceAvailableToAllocate');
          expect(balance).toHaveProperty('withdrawalStatus', 0);
        } finally {
          // Restore original function
          graphqlClient.request = originalRequest;
        }
      });

      it('should return 401 without session', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/balances',
        });

        expect(response.statusCode).toBe(401);
      });

      it('should handle case when no resource locks exist', async () => {
        // Store original function
        const originalRequest = graphqlClient.request;

        // Mock GraphQL response with no locks
        graphqlClient.request = async <
          V extends Variables = Variables,
          T = AllResourceLocksResponse,
        >(
          _documentOrOptions: RequestDocument | RequestOptions<V, T>,
          ..._variablesAndRequestHeaders: unknown[]
        ): Promise<AllResourceLocksResponse> => ({
          account: {
            resourceLocks: {
              items: [],
            },
          },
        });

        try {
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
          expect(body.balances.length).toBe(0);
        } finally {
          // Restore original function
          graphqlClient.request = originalRequest;
        }
      });
    });
  });
});

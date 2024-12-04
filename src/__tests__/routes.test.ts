import { FastifyInstance } from 'fastify';
import {
  createTestServer,
  validPayload,
  getFreshValidPayload,
  getFreshCompact,
  cleanupTestServer,
  compactToAPI,
} from './utils/test-server';
import { generateSignature } from '../crypto';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../graphql';

describe('API Routes', () => {
  let server: FastifyInstance;
  let originalRequest: typeof graphqlClient.request;

  beforeEach(async () => {
    server = await createTestServer();

    // Store original function
    originalRequest = graphqlClient.request;

    // Mock GraphQL response
    graphqlClient.request = async (): Promise<
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
    it('should return server health status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.status).toBe('healthy');
      expect(result.signingAddress).toBe(process.env.SIGNING_ADDRESS);
      expect(result.allocatorAddress).toBe(process.env.ALLOCATOR_ADDRESS);
    });
  });

  describe('GET /session/:address', () => {
    it('should return a session payload for valid address', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/session/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
        url: '/session/invalid-address',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /session', () => {
    it('should create session with valid signature', async () => {
      const payload = getFreshValidPayload();
      const signature = await generateSignature(payload);
      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload,
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
      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload: validPayload,
          signature: 'invalid-signature',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Protected Routes', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a valid session to use in tests
      const payload = getFreshValidPayload();
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
  });
});

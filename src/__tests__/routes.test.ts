import { FastifyInstance } from 'fastify';
import {
  createTestServer,
  validPayload,
  validCompact,
} from './utils/test-server';
import { generateSignature } from '../crypto';

describe('API Routes', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTestServer();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    // Add a small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
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
      const signature = await generateSignature(validPayload);
      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload: validPayload,
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
      const signature = await generateSignature(validPayload);
      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload: validPayload,
          signature,
        },
      });

      const result = JSON.parse(response.payload);
      sessionId = result.session.id;
    });

    describe('POST /compact', () => {
      it('should submit valid compact', async () => {
        const compactPayload = {
          ...validCompact,
          expires: Number(validCompact.expires),
          id: Number(validCompact.id),
        };

        const response = await server.inject({
          method: 'POST',
          url: '/compact',
          headers: {
            'x-session-id': sessionId,
          },
          payload: compactPayload,
        });

        expect(response.statusCode).toBe(200);
      });

      it('should reject request without session', async () => {
        const compactPayload = {
          ...validCompact,
          expires: Number(validCompact.expires),
          id: Number(validCompact.id),
        };

        const response = await server.inject({
          method: 'POST',
          url: '/compact',
          payload: compactPayload,
        });

        expect(response.statusCode).toBe(401);
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
    });

    describe('GET /compact/:chainId/:claimHash', () => {
      it('should return specific compact', async () => {
        // First create a compact
        const compactPayload = {
          ...validCompact,
          expires: Number(validCompact.expires),
          id: Number(validCompact.id),
        };

        await server.inject({
          method: 'POST',
          url: '/compact',
          headers: {
            'x-session-id': sessionId,
          },
          payload: compactPayload,
        });

        const response = await server.inject({
          method: 'GET',
          url: `/compact/1/${compactPayload.id}`,
          headers: {
            'x-session-id': sessionId,
          },
        });

        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(result).toHaveProperty('id', compactPayload.id.toString());
      });

      it('should return error for non-existent compact', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/compact/1/999999',
          headers: {
            'x-session-id': sessionId,
          },
        });

        expect(response.statusCode).toBe(404);
      });
    });
  });
});

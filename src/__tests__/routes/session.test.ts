import { FastifyInstance } from 'fastify';
import {
  createTestServer,
  validPayload,
  cleanupTestServer,
  generateSignature,
} from '../utils/test-server';

describe('Session Routes', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTestServer();
  });

  afterEach(async () => {
    await cleanupTestServer();
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
});

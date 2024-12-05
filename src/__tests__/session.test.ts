import {
  createTestServer,
  getFreshValidPayload,
  cleanupTestServer,
  generateSignature,
} from './utils/test-server';
import type { FastifyInstance } from 'fastify';

describe('Session Management', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTestServer();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    await cleanupTestServer();
  });

  describe('Session Creation', () => {
    it('should create a new session with valid payload', async () => {
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

      // Then create the session
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
      expect(typeof result.session.id).toBe('string');
      expect(result.session.id.length).toBeGreaterThan(0);
    });

    it('should reject invalid signature', async () => {
      const payload = getFreshValidPayload();
      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload,
          signature: 'invalid-signature',
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('error');
    });

    it('should reject when message format does not match payload', async () => {
      const payload = getFreshValidPayload();
      const invalidPayload = {
        ...payload,
        statement: 'Invalid statement',
      };
      const signature = await generateSignature(invalidPayload);

      const response = await server.inject({
        method: 'POST',
        url: '/session',
        payload: {
          payload,
          signature,
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('error');
    });
  });

  describe('Session Verification', () => {
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

      // Then create the session
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
      sessionId = result.session.id;
    });

    it('should verify valid session', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/session/verify',
        headers: {
          'x-session-id': sessionId,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('address', getFreshValidPayload().address);
    });

    it('should reject invalid session ID', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/session/verify',
        headers: {
          'x-session-id': 'invalid-session-id',
        },
      });

      expect(response.statusCode).toBe(401);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('error');
    });

    it('should reject expired session', async () => {
      // Set session to expired in database
      const expiredTimestamp = new Date(Date.now() - 3600000); // 1 hour ago
      await server.db.query(
        'UPDATE sessions SET expires_at = $1 WHERE id = $2',
        [expiredTimestamp.toISOString(), sessionId]
      );

      const response = await server.inject({
        method: 'GET',
        url: '/session/verify',
        headers: {
          'x-session-id': sessionId,
        },
      });

      expect(response.statusCode).toBe(401);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('expired');
    });
  });
});

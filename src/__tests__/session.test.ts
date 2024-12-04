import { createTestServer, validPayload, cleanupTestServer } from './utils/test-server';
import type { FastifyInstance } from 'fastify';
import { generateSignature } from '../crypto';

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
      expect(typeof result.session.id).toBe('string');
      expect(result.session.id.length).toBeGreaterThan(0);
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
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('error');
    });
  });

  describe('Session Verification', () => {
    let sessionId: string;

    beforeEach(async () => {
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
      expect(result).toHaveProperty('address', validPayload.address);
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
      await server.db.query(
        'UPDATE sessions SET expires_at = $1 WHERE id = $2',
        [Math.floor(Date.now() / 1000) - 3600, sessionId]
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

import { FastifyInstance } from 'fastify';
import { createTestServer, validPayload } from './utils/test-server';
import { generateSignature } from '../crypto';

describe('Session Management', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTestServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
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
      expect(result).toHaveProperty('sessionId');
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
      sessionId = result.sessionId;
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
    });
  });
});

import fastify, { FastifyInstance } from 'fastify';
import env from '@fastify/env';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { setupRoutes } from '../../routes';
import { dbManager } from '../setup';

// Helper to generate test data
export const validPayload = {
  domain: 'smallocator.example',
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  uri: 'https://smallocator.example',
  statement: 'Sign in to Smallocator',
  version: '1',
  chainId: 1,
  nonce: randomUUID(), // Use UUID for session nonce
  issuedAt: new Date().toISOString(),
  expirationTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  resources: ['https://smallocator.example/resources'],
};

// Helper to get fresh valid payload with current timestamps
export function getFreshValidPayload(): typeof validPayload {
  return {
    ...validPayload,
    nonce: randomUUID(), // Use UUID for session nonce
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 3600000).toISOString(),
  };
}

// Create a test server instance
export async function createTestServer(): Promise<FastifyInstance> {
  const server = fastify({
    logger: false,
  });

  try {
    // Register plugins
    await server.register(env, {
      schema: {
        type: 'object',
        required: [
          'SIGNING_ADDRESS',
          'ALLOCATOR_ADDRESS',
          'PRIVATE_KEY',
          'DOMAIN',
          'BASE_URL',
        ],
        properties: {
          SIGNING_ADDRESS: { type: 'string' },
          ALLOCATOR_ADDRESS: { type: 'string' },
          PRIVATE_KEY: { type: 'string' },
          DOMAIN: { type: 'string', default: 'smallocator.example' },
          BASE_URL: { type: 'string', default: 'https://smallocator.example' },
        },
      },
      dotenv: false,
    });

    await server.register(cors, {
      origin: '*',
    });

    const db = await dbManager.getDb();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Decorate fastify instance with db
    server.decorate('db', db);

    // Register routes
    await setupRoutes(server);

    await server.ready();
    return server;
  } catch (err) {
    console.error('Error setting up test server:', err);
    throw err;
  }
}

// Helper to create a test session
export async function createTestSession(
  server: FastifyInstance,
  address: string = validPayload.address
): Promise<string> {
  const response = await server.inject({
    method: 'POST',
    url: '/session',
    payload: {
      ...validPayload,
      address,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Failed to create test session: ${response.payload}`);
  }

  const result = JSON.parse(response.payload);
  return result.session.id;
}

export const validCompact = {
  id: 1n,
  arbiter: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  sponsor: validPayload.address,
  // Create nonce where first 20 bytes match sponsor address
  nonce: BigInt(
    '0x' + validPayload.address.toLowerCase().slice(2) + '0'.repeat(24)
  ),
  expires: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
  amount: '1000000000000000000',
  witnessTypeString: 'witness-type',
  witnessHash:
    '0x1234567890123456789012345678901234567890123456789012345678901234',
  chainId: 1,
};

// Helper to get fresh compact with current expiration
let compactCounter = 0n;
export function getFreshCompact(): typeof validCompact {
  const counter = compactCounter++;
  // Create nonce as 32-byte hex where first 20 bytes are sponsor address
  const sponsorAddress = validCompact.sponsor.toLowerCase().replace('0x', '');
  const counterHex = counter.toString(16).padStart(24, '0'); // 12 bytes for counter
  const nonceHex = '0x' + sponsorAddress + counterHex;
  const nonce = BigInt(nonceHex);

  return {
    ...validCompact,
    nonce,
    expires: BigInt(Math.floor(Date.now() / 1000) + 3600),
  };
}

// Helper to convert BigInt values to strings for API requests
export function compactToAPI(
  compact: typeof validCompact
): Record<string, string | number> {
  return {
    ...compact,
    id: compact.id.toString(),
    expires: compact.expires.toString(),
    nonce: '0x' + compact.nonce.toString(16).padStart(64, '0'),
    chainId: compact.chainId.toString(), // Convert chainId to string
  };
}

export async function cleanupTestServer(): Promise<void> {
  await dbManager.cleanup();
}

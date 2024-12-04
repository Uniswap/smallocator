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
export function getFreshValidPayload() {
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
        required: ['SIGNING_ADDRESS', 'ALLOCATOR_ADDRESS', 'PRIVATE_KEY', 'DOMAIN', 'BASE_URL'],
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

    // Initialize test database schema
    await db.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS nonces (
        domain TEXT PRIMARY KEY,
        nonce TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS compacts (
        chain_id INTEGER NOT NULL,
        hash TEXT NOT NULL,
        arbiter TEXT NOT NULL,
        sponsor TEXT NOT NULL,
        nonce TEXT NOT NULL,
        expires BIGINT NOT NULL,
        id TEXT NOT NULL,
        amount TEXT NOT NULL,
        witness_type_string TEXT,
        witness_hash TEXT,
        signature TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chain_id, hash)
      );
    `);

    server.decorate('db', db);

    // Set up routes
    await setupRoutes(server);
    await server.ready();
    
    return server;
  } catch (error) {
    await server.close();
    throw error;
  }
}

// Helper to create a test session
export async function createTestSession(server: FastifyInstance, address: string = validPayload.address): Promise<string> {
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
  sponsor: '0x2345678901234567890123456789012345678901',
  nonce: '0x2345678901234567890123456789012345678901-0', // Sponsor address + counter
  expires: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
  amount: '1000000000000000000',
  witnessTypeString: 'witness-type',
  witnessHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
  chainId: 1,
};

// Helper to get fresh compact with current expiration
let compactCounter = 0;
export function getFreshCompact() {
  return {
    ...validCompact,
    nonce: `${validCompact.sponsor}-${compactCounter++}`, // Sponsor address + unique counter
    expires: BigInt(Math.floor(Date.now() / 1000) + 3600),
  };
}

export async function cleanupTestServer() {
  await dbManager.cleanup();
}

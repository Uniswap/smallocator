import fastify, { FastifyInstance } from 'fastify';
import env from '@fastify/env';
import cors from '@fastify/cors';
import { PGlite } from '@electric-sql/pglite';
import { setupRoutes } from '../../routes';

// Create a test server instance with in-memory database
export async function createTestServer(): Promise<FastifyInstance> {
  const server = fastify({
    logger: false, // Disable logging in tests
  });

  // Register plugins
  await server.register(env, {
    schema: {
      type: 'object',
      required: ['SIGNING_ADDRESS', 'ALLOCATOR_ADDRESS', 'PRIVATE_KEY'],
      properties: {
        SIGNING_ADDRESS: { type: 'string' },
        ALLOCATOR_ADDRESS: { type: 'string' },
        PRIVATE_KEY: { type: 'string' },
      },
    },
    dotenv: false, // Don't load from .env file in tests
  });

  // Enable CORS
  await server.register(cors, {
    origin: '*',
  });

  // Set up in-memory database
  const db = new PGlite('memory://');
  await db.ready;

  // Initialize test database schema - split into separate queries
  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      expires BIGINT NOT NULL,
      nonce TEXT NOT NULL,
      domain TEXT NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS nonces (
      nonce TEXT PRIMARY KEY,
      domain TEXT NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS compacts (
      id BIGINT PRIMARY KEY,
      arbiter TEXT NOT NULL,
      sponsor TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires BIGINT NOT NULL,
      amount TEXT NOT NULL,
      witness_type_string TEXT,
      witness_hash TEXT,
      chain_id INTEGER NOT NULL
    );
  `);

  server.decorate('db', db);

  // Register routes
  await setupRoutes(server);

  return server;
}

// Helper to generate test data
export const validPayload = {
  domain: 'smallocator.example',
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  uri: 'https://smallocator.example',
  statement: 'Sign in to Smallocator',
  version: '1',
  chainId: 1,
  nonce: Date.now().toString(),
  issuedAt: new Date().toISOString(),
  expirationTime: new Date(Date.now() + 3600000).toISOString(),
  resources: ['https://smallocator.example/resources'],
};

export const validCompact = {
  arbiter: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  sponsor: '0x2345678901234567890123456789012345678901',
  nonce: '1',
  expires: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
  id: BigInt(1),
  amount: '1000000000000000000',
  witnessTypeString: null,
  witnessHash: null,
  chainId: 1,
};

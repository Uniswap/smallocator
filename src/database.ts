import { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';

export async function setupDatabase(server: FastifyInstance) {
  const db = new PGlite();
  
  // Create tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS nonces (
      domain TEXT PRIMARY KEY,
      nonce TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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

  // Attach database instance to fastify
  server.decorate('db', db);
}

// Add TypeScript declaration
declare module 'fastify' {
  interface FastifyInstance {
    db: PGlite;
  }
}

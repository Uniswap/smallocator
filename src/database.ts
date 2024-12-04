import { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';

export async function setupDatabase(server: FastifyInstance): Promise<void> {
  const db = new PGlite();

  // Create sessions table
  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      nonce TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      domain TEXT NOT NULL
    )
  `);

  // Create compacts table
  await db.query(`
    CREATE TABLE IF NOT EXISTS compacts (
      id TEXT PRIMARY KEY,
      chain_id TEXT NOT NULL,
      claim_hash TEXT NOT NULL,
      arbiter TEXT NOT NULL,
      sponsor TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires BIGINT NOT NULL,
      compact_id TEXT NOT NULL,
      amount TEXT NOT NULL,
      witness_type_string TEXT,
      witness_hash TEXT,
      signature TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chain_id, claim_hash)
    )
  `);

  // Create nonces table
  await db.query(`
    CREATE TABLE IF NOT EXISTS nonces (
      id TEXT PRIMARY KEY,
      chain_id TEXT NOT NULL,
      nonce TEXT NOT NULL,
      consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chain_id, nonce)
    )
  `);

  // Create indexes
  await db.query('CREATE INDEX IF NOT EXISTS idx_sessions_address ON sessions(address)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_compacts_sponsor ON compacts(sponsor)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_compacts_chain_claim ON compacts(chain_id, claim_hash)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_nonces_chain_nonce ON nonces(chain_id, nonce)');

  // Attach database instance to fastify
  server.decorate('db', db);
}

// Add TypeScript declaration
declare module 'fastify' {
  interface FastifyInstance {
    db: PGlite;
  }
}

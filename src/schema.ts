import { PGlite } from '@electric-sql/pglite';

export const schemas = {
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      nonce TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      domain TEXT NOT NULL
    )
  `,
  nonces: `
    CREATE TABLE IF NOT EXISTS nonces (
      id TEXT PRIMARY KEY,
      chain_id TEXT NOT NULL,
      nonce TEXT NOT NULL,
      consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chain_id, nonce)
    )
  `,
  compacts: `
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
  `,
};

export const indexes = {
  sessions: [
    'CREATE INDEX IF NOT EXISTS idx_sessions_address ON sessions(address)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)',
  ],
  compacts: [
    'CREATE INDEX IF NOT EXISTS idx_compacts_sponsor ON compacts(sponsor)',
    'CREATE INDEX IF NOT EXISTS idx_compacts_chain_claim ON compacts(chain_id, claim_hash)',
  ],
  nonces: [
    'CREATE INDEX IF NOT EXISTS idx_nonces_chain_nonce ON nonces(chain_id, nonce)',
  ],
};

export async function initializeDatabase(db: PGlite): Promise<void> {
  await db.query('BEGIN');
  try {
    // Create tables
    await Promise.all(Object.values(schemas).map((schema) => db.query(schema)));

    // Create indexes
    await Promise.all(
      Object.values(indexes)
        .flat()
        .map((index) => db.query(index))
    );

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function dropTables(db: PGlite): Promise<void> {
  await db.query('BEGIN');
  try {
    for (const table of Object.keys(schemas)) {
      await db.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

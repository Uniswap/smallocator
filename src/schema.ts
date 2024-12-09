import { PGlite } from '@electric-sql/pglite';

export const schemas = {
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      address bytea NOT NULL CHECK (length(address) = 20),
      nonce TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      domain TEXT NOT NULL
    )
  `,
  session_requests: `
    CREATE TABLE IF NOT EXISTS session_requests (
      id UUID PRIMARY KEY,
      address bytea NOT NULL CHECK (length(address) = 20),
      nonce TEXT NOT NULL,
      domain TEXT NOT NULL,
      chain_id bigint NOT NULL,
      issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
      expiration_time TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      used BOOLEAN DEFAULT FALSE
    )
  `,
  compacts: `
    CREATE TABLE IF NOT EXISTS compacts (
      id UUID PRIMARY KEY,
      chain_id bigint NOT NULL,
      claim_hash bytea NOT NULL CHECK (length(claim_hash) = 32),
      arbiter bytea NOT NULL CHECK (length(arbiter) = 20),
      sponsor bytea NOT NULL CHECK (length(sponsor) = 20),
      nonce bytea NOT NULL CHECK (length(nonce) = 32),
      expires BIGINT NOT NULL,
      lock_id bytea NOT NULL CHECK (length(lock_id) = 32),
      amount bytea NOT NULL CHECK (length(amount) = 32),
      witness_type_string TEXT,
      witness_hash bytea CHECK (witness_hash IS NULL OR length(witness_hash) = 32),
      signature bytea NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chain_id, claim_hash)
    )
  `,
  nonces: `
    CREATE TABLE IF NOT EXISTS nonces (
      id UUID PRIMARY KEY,
      chain_id bigint NOT NULL,
      sponsor bytea NOT NULL CHECK (length(sponsor) = 20),
      nonce_high bigint NOT NULL,
      nonce_low integer NOT NULL,
      consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chain_id, sponsor, nonce_high, nonce_low)
    )
  `,
};

export const indexes = {
  sessions: [
    'CREATE INDEX IF NOT EXISTS idx_sessions_address ON sessions(address)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)',
  ],
  session_requests: [
    'CREATE INDEX IF NOT EXISTS idx_session_requests_address ON session_requests(address)',
    'CREATE INDEX IF NOT EXISTS idx_session_requests_expiration_time ON session_requests(expiration_time)',
  ],
  compacts: [
    'CREATE INDEX IF NOT EXISTS idx_compacts_sponsor ON compacts(sponsor)',
    'CREATE INDEX IF NOT EXISTS idx_compacts_chain_claim ON compacts(chain_id, claim_hash)',
  ],
  nonces: [
    'CREATE INDEX IF NOT EXISTS idx_nonces_chain_sponsor ON nonces(chain_id, sponsor)',
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

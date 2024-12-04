import { PGlite } from '@electric-sql/pglite';

// Set up test environment variables before any tests run
process.env.SKIP_SIGNING_VERIFICATION = 'true';
process.env.NODE_ENV = 'test';
process.env.SIGNING_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
process.env.ALLOCATOR_ADDRESS = '0x2345678901234567890123456789012345678901';
process.env.PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
process.env.CORS_ORIGIN = '*';
process.env.PORT = '3001';
process.env.DOMAIN = 'smallocator.example';
process.env.BASE_URL = 'https://smallocator.example';

class DatabaseManager {
  private db: PGlite | null = null;
  private static instance: DatabaseManager;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(): Promise<void> {
    if (!this.db) {
      this.db = new PGlite('memory://');
      await this.db.ready;

      // Create sessions table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          address TEXT NOT NULL,
          nonce TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          domain TEXT NOT NULL
        )
      `);

      // Create nonces table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS nonces (
          id TEXT PRIMARY KEY,
          chain_id TEXT NOT NULL,
          nonce TEXT NOT NULL,
          consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(chain_id, nonce)
        )
      `);

      // Create compacts table
      await this.db.query(`
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

      // Create indexes
      await this.db.query('CREATE INDEX IF NOT EXISTS idx_sessions_address ON sessions(address)');
      await this.db.query('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)');
      await this.db.query('CREATE INDEX IF NOT EXISTS idx_compacts_sponsor ON compacts(sponsor)');
      await this.db.query('CREATE INDEX IF NOT EXISTS idx_compacts_chain_claim ON compacts(chain_id, claim_hash)');
      await this.db.query('CREATE INDEX IF NOT EXISTS idx_nonces_chain_nonce ON nonces(chain_id, nonce)');
    }
    return;
  }

  async getDb(): Promise<PGlite> {
    if (!this.db) {
      return this.initialize().then(() => this.db as PGlite);
    }
    return this.db as PGlite;
  }

  async cleanup(): Promise<void> {
    if (this.db) {
      // Drop all tables
      await this.db.query('DROP TABLE IF EXISTS sessions CASCADE');
      await this.db.query('DROP TABLE IF EXISTS nonces CASCADE');
      await this.db.query('DROP TABLE IF EXISTS compacts CASCADE');

      // Reset the database connection
      this.db = null;
    }
  }
}

export const dbManager = DatabaseManager.getInstance();

// Global test setup
beforeEach(async () => {
  await dbManager.initialize();
});

// Global test cleanup
afterAll(async () => {
  // Wait for any pending operations to complete
  await new Promise((resolve) => setTimeout(resolve, 500));
  await dbManager.cleanup();
}, 10000);

// Reset database between tests
afterEach(async () => {
  // Wait for any pending operations to complete
  await new Promise((resolve) => setTimeout(resolve, 500));
  await dbManager.cleanup();
});

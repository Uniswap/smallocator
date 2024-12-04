import { PGlite } from '@electric-sql/pglite';

// Set up test environment variables before any tests run
process.env.SKIP_SIGNING_VERIFICATION = 'true';
process.env.NODE_ENV = 'test';
process.env.SIGNING_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
process.env.ALLOCATOR_ADDRESS = '0x2345678901234567890123456789012345678901';
process.env.PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
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

  async initialize() {
    if (!this.db) {
      this.db = new PGlite('memory://');
      await this.db.ready;
    }
    return this.db;
  }

  async getDb() {
    if (!this.db) {
      return this.initialize();
    }
    return this.db;
  }

  async cleanup() {
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

// Before all tests
beforeAll(async () => {
  await dbManager.initialize();
});

// After all tests
afterAll(async () => {
  await dbManager.cleanup();
});

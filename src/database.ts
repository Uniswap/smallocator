import { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';
import { initializeDatabase } from './schema';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Get database directory from environment or use default
const DATA_DIR = join(
  process.cwd(),
  process.env.DATABASE_DIR || '.smallocator-data'
);
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export async function setupDatabase(server: FastifyInstance): Promise<void> {
  // Initialize PGlite with the data directory
  const db = new PGlite(DATA_DIR);

  await initializeDatabase(db);

  // Add the database instance to the server
  server.decorate('db', db);

  // Handle cleanup on server close
  server.addHook('onClose', async () => {
    await db.close();
  });
}

// Add TypeScript declaration
declare module 'fastify' {
  interface FastifyInstance {
    db: PGlite;
  }
}

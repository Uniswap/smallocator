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
      address TEXT NOT NULL,
      nonce TEXT NOT NULL,
      signature TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      domain TEXT NOT NULL
    )
  `);

  // Add the database instance to the server
  server.decorate('db', db);
}

// Add TypeScript declaration
declare module 'fastify' {
  interface FastifyInstance {
    db: PGlite;
  }
}

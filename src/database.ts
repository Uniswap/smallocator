import { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';
import { initializeDatabase } from './schema';

export async function setupDatabase(server: FastifyInstance): Promise<void> {
  const db = new PGlite();
  await initializeDatabase(db);

  // Create session_requests table
  await db.query(`
    CREATE TABLE IF NOT EXISTS session_requests (
      id UUID PRIMARY KEY,
      address TEXT NOT NULL,
      nonce UUID NOT NULL,
      domain TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
      expiration_time TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

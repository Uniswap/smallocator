import { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';
import { initializeDatabase } from './schema';

export async function setupDatabase(server: FastifyInstance): Promise<void> {
  const db = new PGlite();
  await initializeDatabase(db);

  // Add the database instance to the server
  server.decorate('db', db);
}

// Add TypeScript declaration
declare module 'fastify' {
  interface FastifyInstance {
    db: PGlite;
  }
}

import { FastifyInstance } from 'fastify';
import { setupHealthRoutes } from './health';
import { setupSessionRoutes } from './session';
import { setupBalanceRoutes } from './balance';
import { setupCompactRoutes } from './compact';

// Declare db property on FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    db: import('@electric-sql/pglite').PGlite;
  }
  interface FastifyRequest {
    session?: {
      id: string;
      address: string;
    };
  }
}

export async function setupRoutes(server: FastifyInstance): Promise<void> {
  // Setup all route modules
  await setupHealthRoutes(server);
  await setupSessionRoutes(server);
  await setupBalanceRoutes(server);
  await setupCompactRoutes(server);
}

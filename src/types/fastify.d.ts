import { FastifyInstance as BaseFastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';

declare module 'fastify' {
  interface FastifyInstance {
    db: PGlite;
  }
}

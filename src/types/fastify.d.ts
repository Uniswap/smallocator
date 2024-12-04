import { FastifyInstance as BaseFastifyInstance } from 'fastify'
import { Database } from '../database'

declare module 'fastify' {
  export interface FastifyInstance extends BaseFastifyInstance {
    db: Database
  }
}

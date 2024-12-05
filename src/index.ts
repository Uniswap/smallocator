import './env';
import './types';
import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
import fastifyStatic from '@fastify/static';
import * as path from 'path';
import { config } from './config';
import { setupRoutes } from './routes';
import { setupDatabase } from './database';
import { verifySigningAddress } from './crypto';

const server = fastify({
  logger: true,
});

// Register plugins and configure server
async function build(): Promise<FastifyInstance> {
  // Register environment variables
  await server.register(env, {
    schema: config.envSchema,
    dotenv: true,
  });

  // Verify signing address matches configuration
  verifySigningAddress(process.env.SIGNING_ADDRESS as string);

  // Enable CORS
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
  });

  // Initialize database
  await setupDatabase(server);

  // API routes should be handled first
  await setupRoutes(server);

  // Handle HEAD requests for root explicitly
  server.head('/', async (request, reply) => {
    return reply.code(200).send();
  });

  // Add hook to prevent non-GET requests to static files
  server.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/assets/') && request.method !== 'GET') {
      return reply.code(405).send({ error: 'Method not allowed' });
    }
  });

  // Serve static files from frontend/dist
  await server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'frontend/dist'),
    prefix: '/',
    decorateReply: false,
  });

  // Catch-all route to serve index.html for client-side routing
  server.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.code(404).send({
        message: 'API route not found',
        error: 'Not Found',
        statusCode: 404,
      });
    }

    try {
      await reply.sendFile('index.html');
    } catch (err) {
      reply.code(404).send({
        message: 'File not found',
        error: err instanceof Error ? err.message : 'Unknown error',
        statusCode: 404,
      });
    }
  });

  return server;
}

// Start the server
async function start(): Promise<void> {
  try {
    const app = await build();
    await app.listen({
      port: parseInt(process.env.PORT || '3000'),
      host: '0.0.0.0',
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Handle floating promise with void operator
void start();

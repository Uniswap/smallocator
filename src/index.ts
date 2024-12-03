import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
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
  verifySigningAddress();

  // Enable CORS
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
  });

  // Initialize database
  await setupDatabase(server);

  // Register routes
  await setupRoutes(server);

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

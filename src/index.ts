import fastify from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
import { config } from './config';
import { setupRoutes } from './routes';
import { setupDatabase } from './database';

const server = fastify({
  logger: true,
});

// Register plugins and configure server
async function build() {
  // Register environment variables
  await server.register(env, {
    schema: config.envSchema,
    dotenv: true,
  });

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
async function start() {
  try {
    const app = await build();
    await app.listen({ 
      port: parseInt(process.env.PORT || '3000'), 
      host: '0.0.0.0' 
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();

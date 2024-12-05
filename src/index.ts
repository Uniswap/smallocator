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
  logger: {
    level: 'error', // Only log errors by default
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// List of API endpoints we want to log
const API_ENDPOINTS = [
  '/health',
  '/session',
  '/compact',
  '/compacts',
  '/balance',
  '/balances',
  '/session/',
  '/compact/',
  '/balance/',
];

// Helper to check if a URL is an API endpoint
function isApiEndpoint(url: string): boolean {
  return API_ENDPOINTS.some(
    (endpoint) => url === endpoint || url.startsWith(`${endpoint}/`)
  );
}

server.addHook('onRequest', async (request) => {
  if (isApiEndpoint(request.url)) {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        id: request.id,
      },
      'API Request'
    );
  }
});

server.addHook('onResponse', async (request, reply) => {
  if (isApiEndpoint(request.url)) {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        id: request.id,
        duration: reply.elapsedTime,
      },
      'API Response'
    );
  }
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
    logLevel: 'error', // Only log errors for static files
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

// Start server if this is the main module
const isMainModule =
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js');
if (isMainModule) {
  // Use void to explicitly mark the promise as handled
  void (async (): Promise<void> => {
    try {
      const server = await build();
      server.log.level = 'info'; // Temporarily increase log level for startup
      await server.listen({ port: 3000, host: '0.0.0.0' });
      server.log.level = 'error'; // Reset back to error-only after startup
    } catch (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
  })();
}

export { build };

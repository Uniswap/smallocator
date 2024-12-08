import fastify, { FastifyInstance } from 'fastify';
import env from '@fastify/env';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { setupRoutes } from '../../routes';
import { dbManager } from '../setup';
import { signMessage } from 'viem/accounts';
import { getAddress, hexToBytes, bytesToHex, numberToHex } from 'viem/utils';

// Helper to generate test data
const defaultBaseUrl = 'https://smallocator.example';
export const validPayload = {
  domain: new URL(process.env.BASE_URL || defaultBaseUrl).host,
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  uri: process.env.BASE_URL || defaultBaseUrl,
  statement: 'Sign in to Smallocator',
  version: '1',
  chainId: 1,
  nonce: randomUUID(),
  issuedAt: new Date().toISOString(),
  expirationTime: new Date(Date.now() + 3600000).toISOString(),
};

// Helper to get fresh valid payload with current timestamps
export function getFreshValidPayload(): typeof validPayload {
  const now = new Date();
  const expirationTime = new Date(now.getTime() + 3600000);
  return {
    ...validPayload,
    nonce: randomUUID(),
    issuedAt: now.toISOString(),
    expirationTime: expirationTime.toISOString(),
  };
}

// Helper to format message according to EIP-4361
export function formatTestMessage(payload: typeof validPayload): string {
  return [
    `${payload.domain} wants you to sign in with your Ethereum account:`,
    payload.address,
    '',
    payload.statement,
    '',
    `URI: ${payload.uri}`,
    `Version: ${payload.version}`,
    `Chain ID: ${payload.chainId}`,
    `Nonce: ${payload.nonce}`,
    `Issued At: ${payload.issuedAt}`,
    `Expiration Time: ${payload.expirationTime}`,
  ].join('\n');
}

// Test private key (do not use in production)
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Helper to generate signature
export async function generateSignature(
  payload: typeof validPayload
): Promise<string> {
  const message = formatTestMessage(payload);
  const signature = await signMessage({
    message,
    privateKey: TEST_PRIVATE_KEY as `0x${string}`,
  });
  return signature;
}

// Create a test server instance
export async function createTestServer(): Promise<FastifyInstance> {
  const server = fastify({
    logger: false,
  });

  try {
    // Register plugins
    await server.register(env, {
      schema: {
        type: 'object',
        required: [
          'SIGNING_ADDRESS',
          'ALLOCATOR_ADDRESS',
          'PRIVATE_KEY',
          'DOMAIN',
          'BASE_URL',
        ],
        properties: {
          SIGNING_ADDRESS: {
            type: 'string',
            default: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Address corresponding to TEST_PRIVATE_KEY
          },
          ALLOCATOR_ADDRESS: {
            type: 'string',
            default: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          },
          PRIVATE_KEY: {
            type: 'string',
            default: TEST_PRIVATE_KEY,
          },
          DOMAIN: {
            type: 'string',
            default: 'smallocator.example',
          },
          BASE_URL: {
            type: 'string',
            default: 'https://smallocator.example',
          },
        },
      },
      dotenv: false,
    });

    await server.register(cors, {
      origin: '*',
    });

    const db = await dbManager.getDb();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Decorate fastify instance with db
    server.decorate('db', db);

    // Register routes
    await setupRoutes(server);

    await server.ready();
    return server;
  } catch (err) {
    console.error('Error setting up test server:', err);
    throw err;
  }
}

// Helper to create a test session
export async function createTestSession(
  server: FastifyInstance,
  address: string = validPayload.address
): Promise<string> {
  // First create a session request
  const payload = getFreshValidPayload();
  const sessionResponse = await server.inject({
    method: 'GET',
    url: `/session/1/${address}`,
  });

  if (sessionResponse.statusCode !== 200) {
    throw new Error(
      `Failed to create session request: ${sessionResponse.payload}`
    );
  }

  const sessionRequest = JSON.parse(sessionResponse.payload);

  // Then create the session
  const signature = await generateSignature(payload);
  const response = await server.inject({
    method: 'POST',
    url: '/session',
    payload: {
      payload: sessionRequest.session,
      signature,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Failed to create session: ${response.payload}`);
  }

  const result = JSON.parse(response.payload);
  return result.session.id;
}

// Helper to pad hex string to specific byte length
function padToBytes(hex: string, byteLength: number): string {
  return hex.slice(2).padStart(byteLength * 2, '0');
}

// Helper to ensure hex string has 0x prefix
function ensure0x(hex: string): `0x${string}` {
  return hex.startsWith('0x')
    ? (hex as `0x${string}`)
    : (`0x${hex}` as `0x${string}`);
}

export const validCompact = {
  // Set allocatorId to 1 in bits 160-251 (92 bits) and reset period index 7 in bits 252-254
  id: (BigInt(1) << BigInt(160)) | (BigInt(7) << BigInt(252)), // Reset period index 7 = 2592000 seconds (30 days)
  arbiter: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  sponsor: validPayload.address,
  // Create nonce where first 20 bytes match sponsor address
  nonce: BigInt(
    '0x' + validPayload.address.toLowerCase().slice(2) + '0'.repeat(24)
  ),
  expires: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
  amount: '1000000000000000000',
  witnessTypeString: 'witness-type',
  witnessHash:
    '0x1234567890123456789012345678901234567890123456789012345678901234',
  chainId: 1,
};

// Helper to get fresh compact with current expiration
let compactCounter = BigInt(0);
export function getFreshCompact(): typeof validCompact {
  const counter = compactCounter++;
  
  // Get normalized sponsor address
  const sponsorAddress = getAddress(validCompact.sponsor).toLowerCase();
  
  // Create nonce with sponsor in first 20 bytes and counter in last 12 bytes
  // First convert the sponsor address to a BigInt (removing 0x prefix)
  const sponsorBigInt = BigInt('0x' + sponsorAddress.slice(2));
  
  // Shift sponsor left by 96 bits (12 bytes) to make room for counter
  const nonce = (sponsorBigInt << BigInt(96)) | counter;

  return {
    ...validCompact,
    nonce,
    expires: BigInt(Math.floor(Date.now() / 1000) + 3600),
  };
}

// Helper to convert BigInt values to strings for API requests
export function compactToAPI(
  compact: typeof validCompact,
  options: { nullNonce?: boolean } = {}
): Record<string, string | number | null> {
  const nonce = options.nullNonce ? null : compact.nonce;

  return {
    id: ensure0x(padToBytes(compact.id.toString(16), 32)),
    arbiter: ensure0x(padToBytes(getAddress(compact.arbiter), 20)),
    sponsor: ensure0x(padToBytes(getAddress(compact.sponsor), 20)),
    nonce: nonce === null ? null : ensure0x(nonce.toString(16).padStart(64, '0')), // Pad to 32 bytes
    expires: compact.expires.toString(),
    amount: compact.amount, // Keep amount as decimal string
    witnessTypeString: compact.witnessTypeString,
    witnessHash: compact.witnessHash
      ? ensure0x(padToBytes(compact.witnessHash, 32))
      : null,
    chainId: compact.chainId.toString(),
  };
}

export async function cleanupTestServer(): Promise<void> {
  await dbManager.cleanup();
}

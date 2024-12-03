import { FastifyInstance } from 'fastify';
import { getAddress, verifyMessage } from 'viem';
import { randomUUID } from 'crypto';

export interface SessionPayload {
  domain: string;
  address: string;
  uri: string;
  statement: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  resources: string[];
}

export interface Session {
  id: string;
  address: string;
  expiresAt: string;
}

export async function validateAndCreateSession(
  server: FastifyInstance,
  signature: string,
  payload: SessionPayload
): Promise<Session> {
  // Validate payload structure
  if (!isValidPayload(payload)) {
    throw new Error('Invalid session payload structure');
  }

  // Verify the nonce exists and hasn't been used
  const nonceExists = await verifyNonce(server, payload.domain, payload.nonce);
  if (!nonceExists) {
    throw new Error('Invalid or expired nonce');
  }

  // Verify the signature
  const message = formatMessage(payload);
  if (!signature.startsWith('0x')) {
    throw new Error('Invalid signature format: must start with 0x');
  }
  const isValid = await verifyMessage({
    address: getAddress(payload.address),
    message,
    signature: signature as `0x${string}`,
  });

  if (!isValid) {
    throw new Error('Invalid signature');
  }

  // Create session
  const session: Session = {
    id: randomUUID(),
    address: getAddress(payload.address),
    expiresAt: payload.expirationTime
  };

  // Store session in database
  await server.db.query(
    'INSERT INTO sessions (id, address, expires_at) VALUES ($1, $2, $3)',
    [session.id, session.address, session.expiresAt]
  );

  // Mark nonce as used
  await server.db.query(
    'DELETE FROM nonces WHERE domain = $1 AND nonce = $2',
    [payload.domain, payload.nonce]
  );

  return session;
}

export async function verifySession(
  server: FastifyInstance,
  sessionId: string,
  address?: string
): Promise<boolean> {
  const result = await server.db.query<{ address: string; expires_at: string }>(
    'SELECT address, expires_at FROM sessions WHERE id = $1',
    [sessionId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const session = result.rows[0];
  const now = new Date();
  const expiresAt = new Date(session.expires_at);

  // Check if session has expired
  if (now > expiresAt) {
    // Clean up expired session
    await server.db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    return false;
  }

  // If address is provided, verify it matches the session
  if (address && getAddress(address) !== getAddress(session.address)) {
    return false;
  }

  return true;
}

function isValidPayload(payload: SessionPayload): boolean {
  return (
    typeof payload.domain === 'string' &&
    typeof payload.address === 'string' &&
    typeof payload.uri === 'string' &&
    typeof payload.statement === 'string' &&
    typeof payload.version === 'string' &&
    typeof payload.chainId === 'number' &&
    typeof payload.nonce === 'string' &&
    typeof payload.issuedAt === 'string' &&
    typeof payload.expirationTime === 'string' &&
    Array.isArray(payload.resources) &&
    payload.resources.every(r => typeof r === 'string') &&
    new Date(payload.expirationTime) > new Date() &&
    new Date(payload.issuedAt) <= new Date()
  );
}

async function verifyNonce(
  server: FastifyInstance,
  domain: string,
  nonce: string
): Promise<boolean> {
  const result = await server.db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM nonces WHERE domain = $1 AND nonce = $2',
    [domain, nonce]
  );

  // Return true if nonce doesn't exist (hasn't been used)
  return result.rows[0].count === 0;
}

function formatMessage(payload: SessionPayload): string {
  return `${payload.domain} wants you to sign in with your Ethereum account:
${getAddress(payload.address)}

${payload.statement}

URI: ${payload.uri}
Version: ${payload.version}
Chain ID: ${payload.chainId}
Nonce: ${payload.nonce}
Issued At: ${payload.issuedAt}
Expiration Time: ${payload.expirationTime}
Resources:
${payload.resources.join('\n')}`
}

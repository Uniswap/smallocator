import { FastifyInstance } from 'fastify';
import { getAddress, verifyMessage } from 'viem/utils';
import { randomUUID } from 'crypto';

// Import the FastifyInstance augmentation
import './database';

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
}

export interface Session {
  id: string;
  address: string;
  expiresAt: string;
  nonce: string;
  domain: string;
}

export async function validateAndCreateSession(
  server: FastifyInstance,
  signature: string,
  payload: SessionPayload
): Promise<Session> {
  try {
    // Validate payload structure
    if (!isValidPayload(payload)) {
      server.log.error({ payload }, 'Invalid payload structure');
      throw new Error('Invalid session payload structure');
    }

    // Get the original session request
    const requests = await server.db.query<{
      issued_at: string;
      expiration_time: string;
      rows: Array<{
        issued_at: string;
        expiration_time: string;
      }>;
    }>(
      `SELECT * FROM session_requests 
       WHERE nonce = $1 
       AND domain = $2 
       AND chain_id = $3 
       AND address = $4
       AND used = FALSE
       AND expiration_time > CURRENT_TIMESTAMP`,
      [payload.nonce, payload.domain, payload.chainId, payload.address]
    );

    if (!requests.rows || requests.rows.length === 0) {
      throw new Error('No matching session request found or request expired');
    }

    const request = requests.rows[0];

    // Verify timestamps match
    const requestIssuedAt = new Date(request.issued_at).toISOString();
    const requestExpirationTime = new Date(
      request.expiration_time
    ).toISOString();
    const payloadIssuedAt = new Date(payload.issuedAt).toISOString();
    const payloadExpirationTime = new Date(
      payload.expirationTime
    ).toISOString();

    if (
      requestIssuedAt !== payloadIssuedAt ||
      requestExpirationTime !== payloadExpirationTime
    ) {
      throw new Error('Session request timestamps do not match');
    }

    // Format message and verify signature
    const message = formatMessage(payload);

    if (!signature.startsWith('0x')) {
      throw new Error('Invalid signature format: must start with 0x');
    }

    try {
      const addressRecovered = await verifyMessage({
        address: getAddress(payload.address),
        message,
        signature: signature as `0x${string}`,
      });

      if (!addressRecovered) {
        throw new Error('Invalid signature');
      }
    } catch (error) {
      throw new Error(
        `Invalid signature: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Create session
    const session: Session = {
      id: randomUUID(),
      address: payload.address,
      expiresAt: payload.expirationTime,
      nonce: payload.nonce,
      domain: payload.domain,
    };

    // Mark session request as used
    await server.db.query(
      `UPDATE session_requests 
       SET used = TRUE 
       WHERE nonce = $1 
       AND domain = $2 
       AND chain_id = $3 
       AND address = $4`,
      [payload.nonce, payload.domain, payload.chainId, payload.address]
    );

    // Store session in database
    await server.db.query(
      'INSERT INTO sessions (id, address, expires_at, nonce, domain) VALUES ($1, $2, $3, $4, $5)',
      [
        session.id,
        session.address,
        session.expiresAt,
        session.nonce,
        session.domain,
      ]
    );

    return session;
  } catch (error) {
    server.log.error('Session validation failed:', error);
    throw error;
  }
}

export async function verifySession(
  server: FastifyInstance,
  sessionId: string,
  address?: string
): Promise<boolean> {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  const result = await server.db.query<{ address: string; expires_at: string }>(
    'SELECT address, expires_at FROM sessions WHERE id = $1',
    [sessionId]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid session ID');
  }

  const session = result.rows[0];
  const now = new Date();
  const expiresAt = new Date(session.expires_at);

  // Check if session has expired
  if (now > expiresAt) {
    // Clean up expired session
    await server.db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    throw new Error('Session has expired');
  }

  // If an address is provided, verify it matches the session
  if (address && getAddress(address) !== getAddress(session.address)) {
    throw new Error('Session address mismatch');
  }

  return true;
}

function isValidPayload(payload: SessionPayload): boolean {
  try {
    if (!payload) {
      throw new Error('Payload is required');
    }

    // Check all required fields are present and have correct types
    if (
      typeof payload.domain !== 'string' ||
      typeof payload.address !== 'string' ||
      typeof payload.uri !== 'string' ||
      typeof payload.statement !== 'string' ||
      typeof payload.version !== 'string' ||
      typeof payload.chainId !== 'number' ||
      typeof payload.nonce !== 'string' ||
      typeof payload.issuedAt !== 'string' ||
      typeof payload.expirationTime !== 'string'
    ) {
      throw new Error('Invalid payload field types');
    }

    // Validate address format
    try {
      getAddress(payload.address);
    } catch {
      throw new Error('Invalid Ethereum address');
    }

    // Validate URI format
    try {
      const uri = new URL(payload.uri);
      if (!process.env.BASE_URL) {
        throw new Error('BASE_URL environment variable not set');
      }
      if (!uri.href.startsWith(process.env.BASE_URL)) {
        throw new Error(
          `Invalid URI base: expected ${process.env.BASE_URL}, got ${uri.href}`
        );
      }
    } catch (error) {
      const e = error as Error;
      throw new Error(`Invalid URI format: ${e.message}`);
    }

    // Validate timestamp fields
    const now = Date.now();
    const issuedAtTime = new Date(payload.issuedAt).getTime();
    const expirationTime = new Date(payload.expirationTime).getTime();

    if (isNaN(issuedAtTime) || isNaN(expirationTime)) {
      throw new Error('Invalid timestamp format');
    }

    if (issuedAtTime > now) {
      throw new Error('Session issued in the future');
    }

    if (expirationTime <= now) {
      throw new Error('Session has expired');
    }

    // Validate domain matches server's domain
    if (!process.env.BASE_URL) {
      throw new Error('BASE_URL environment variable not set');
    }

    const serverDomain = new URL(process.env.BASE_URL).host;
    if (payload.domain !== serverDomain) {
      throw new Error(
        `Invalid domain: expected ${serverDomain}, got ${payload.domain}`
      );
    }

    // Validate statement confirms sponsor is signing in
    if (payload.statement !== 'Sign in to Smallocator') {
      throw new Error('Invalid statement');
    }

    // Validate chain ID
    if (payload.chainId < 1) {
      throw new Error('Invalid chain ID');
    }

    return true;
  } catch (error) {
    console.error('Payload validation failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      payload,
    });
    return false;
  }
}

function formatMessage(payload: SessionPayload): string {
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

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
  resources: string[];
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

    // Verify the nonce exists and hasn't been used
    const nonceIsValid = await verifyNonce(
      server,
      payload.domain,
      payload.nonce,
      payload.chainId
    );
    if (!nonceIsValid) {
      server.log.error(
        {
          domain: payload.domain,
          nonce: payload.nonce,
          chainId: payload.chainId,
        },
        'Invalid nonce'
      );
      throw new Error('Invalid or expired nonce');
    }

    // Format and verify the signature
    const message = formatMessage(payload);
    server.log.info(
      {
        formattedMessage: message,
        address: payload.address,
        signatureStart: signature.slice(0, 10),
      },
      'Verifying signature'
    );

    if (!signature.startsWith('0x')) {
      server.log.error(
        { signatureStart: signature.slice(0, 10) },
        'Invalid signature format'
      );
      throw new Error('Invalid signature format: must start with 0x');
    }

    // Recover the address from the signature and verify it matches
    try {
      const recoveredAddress = await verifyMessage({
        address: getAddress(payload.address),
        message,
        signature: signature as `0x${string}`,
      });

      if (!recoveredAddress) {
        server.log.error(
          {
            expectedAddress: getAddress(payload.address),
            recoveredAddress,
            messageLength: message.length,
            messagePreview: message.slice(0, 100),
          },
          'Signature verification failed - no address recovered'
        );
        throw new Error(
          'Signature verification failed: recovered address does not match'
        );
      }

      server.log.info(
        {
          address: payload.address,
          recoveredAddress,
        },
        'Signature verified successfully'
      );
    } catch (error) {
      server.log.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          address: payload.address,
          messageLength: message.length,
          messagePreview: message.slice(0, 100),
        },
        'Signature verification error'
      );
      throw new Error(
        `Signature verification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Create session
    const session: Session = {
      id: randomUUID(),
      address: getAddress(payload.address),
      expiresAt: payload.expirationTime,
      nonce: payload.nonce,
      domain: payload.domain,
    };

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

    // Mark nonce as used
    await server.db.query(
      'INSERT INTO nonces (id, chain_id, nonce) VALUES ($1, $2, $3)',
      [randomUUID(), payload.chainId.toString(), payload.nonce]
    );

    return session;
  } catch (error) {
    server.log.error(
      {
        error: error instanceof Error ? error.message : String(error),
        payload,
        signature,
      },
      'Session validation failed'
    );
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
      typeof payload.expirationTime !== 'string' ||
      !Array.isArray(payload.resources)
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

    // Validate resources URIs if present
    for (const resource of payload.resources) {
      if (typeof resource !== 'string') {
        throw new Error('Invalid resource type');
      }
      try {
        new URL(resource);
      } catch {
        throw new Error('Invalid resource URI');
      }
    }

    return true;
  } catch (error) {
    console.error('Payload validation failed:', {
      error: error instanceof Error ? error.message : String(error),
      payload: {
        ...payload,
        // Exclude sensitive fields if needed
        signature: undefined,
      },
      env: {
        BASE_URL: process.env.BASE_URL,
      },
    });
    throw error;
  }
}

export async function verifyNonce(
  server: FastifyInstance,
  domain: string,
  nonce: string,
  chainId: number
): Promise<boolean> {
  // Check if nonce has been used
  const result = await server.db.query(
    'SELECT id FROM nonces WHERE chain_id = $1 AND nonce = $2',
    [chainId.toString(), nonce]
  );

  return result.rows.length === 0;
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
    payload.resources ? `Resources:\n${payload.resources.join('\n')}` : '',
  ].join('\n');
}

import { FastifyInstance } from 'fastify';
import { type Hex } from 'viem';
import { getAddress, hexToBytes, toHex, numberToHex } from 'viem/utils';
import {
  validateCompact,
  type CompactMessage,
  type ValidatedCompactMessage,
  storeNonce,
  generateNonce,
} from './validation';
import { generateClaimHash, signCompact } from './crypto';
import { randomUUID } from 'crypto';
import { PGlite } from '@electric-sql/pglite';

export interface CompactSubmission {
  chainId: string;
  compact: CompactMessage;
}

// Separate interface for stored compacts where nonce is always present
export interface StoredCompactMessage {
  id: bigint;
  arbiter: string;
  sponsor: string;
  nonce: bigint; // This is non-null
  expires: bigint;
  amount: string;
  witnessTypeString: string | null;
  witnessHash: string | null;
}

export interface CompactRecord {
  chainId: string;
  compact: StoredCompactMessage;
  hash: string;
  signature: string;
  createdAt: string;
}

// Helper to convert address to bytea
function addressToBytes(address: string): Uint8Array {
  return hexToBytes(address as `0x${string}`);
}

// Helper to convert bytea to checksummed address
function byteaToAddress(bytes: Uint8Array): string {
  return getAddress('0x' + Buffer.from(bytes).toString('hex'));
}

// Helper to convert hex string to bytea
function hexToBuffer(hex: string): Uint8Array {
  return hexToBytes((hex.startsWith('0x') ? hex : `0x${hex}`) as `0x${string}`);
}

// Helper to convert bytea to hex string
function bufferToHex(bytes: Uint8Array): string {
  return '0x' + Buffer.from(bytes).toString('hex');
}

// Helper to convert BigInt amount to 32-byte array
function amountToBytes(amount: string | bigint): Uint8Array {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
  const hex = numberToHex(amountBigInt, { size: 32 });
  return hexToBytes(hex);
}

// Helper to convert 32-byte array to amount string
function bytesToAmount(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  return BigInt(hex).toString();
}

// Helper to convert ValidatedCompactMessage to StoredCompactMessage
function toStoredCompact(
  compact: ValidatedCompactMessage & { nonce: bigint }
): StoredCompactMessage {
  return {
    id: compact.id,
    arbiter: compact.arbiter,
    sponsor: compact.sponsor,
    nonce: compact.nonce,
    expires: compact.expires,
    amount: compact.amount,
    witnessTypeString: compact.witnessTypeString,
    witnessHash: compact.witnessHash,
  };
}

export async function submitCompact(
  server: FastifyInstance,
  submission: CompactSubmission,
  sponsorAddress: string
): Promise<{ hash: string; signature: string; nonce: string }> {
  try {
    // Start a transaction
    await server.db.query('BEGIN');

    // Lock the sponsor's row to prevent concurrent updates
    await server.db.query(
      'SELECT id FROM sessions WHERE address = $1 FOR UPDATE',
      [addressToBytes(sponsorAddress)]
    );

    // Validate sponsor matches the session
    if (getAddress(submission.compact.sponsor) !== getAddress(sponsorAddress)) {
      throw new Error('Sponsor address does not match session');
    }

    // Generate nonce if not provided (do this before validation)
    const generatedNonce =
      submission.compact.nonce === null
        ? await generateNonce(sponsorAddress, submission.chainId, server.db)
        : null;

    // Update compact with final nonce
    const compactWithNonce: CompactMessage = {
      ...submission.compact,
      nonce: generatedNonce
        ? generatedNonce.toString()
        : submission.compact.nonce,
    };

    // Validate the compact (including nonce validation)
    const validationResult = await validateCompact(
      compactWithNonce,
      submission.chainId,
      server.db
    );
    if (!validationResult.isValid || !validationResult.validatedCompact) {
      throw new Error(validationResult.error || 'Invalid compact');
    }

    // Get the validated compact with proper types
    const validatedCompact = validationResult.validatedCompact;

    // Ensure nonce is present for storage
    if (validatedCompact.nonce === null) {
      throw new Error('Nonce is required for storage');
    }

    // Convert to StoredCompactMessage for crypto operations
    const storedCompact = toStoredCompact({
      ...validatedCompact,
      nonce: validatedCompact.nonce,
    });

    // Generate the claim hash
    const hash = await generateClaimHash(
      storedCompact,
      BigInt(submission.chainId)
    );

    // Sign the compact
    const signature = await signCompact(hash, BigInt(submission.chainId));

    // Store the compact first
    await storeCompact(
      server.db,
      storedCompact,
      submission.chainId,
      hash,
      signature
    );

    // Store the nonce as used (within the same transaction)
    await storeNonce(storedCompact.nonce, submission.chainId, server.db);

    // Commit the transaction
    await server.db.query('COMMIT');

    return {
      hash,
      signature,
      nonce: '0x' + storedCompact.nonce.toString(16).padStart(64, '0'),
    };
  } catch (error) {
    // Rollback on any error
    await server.db.query('ROLLBACK');
    throw error;
  }
}

export async function getCompactsByAddress(
  server: FastifyInstance,
  address: string
): Promise<CompactRecord[]> {
  const result = await server.db.query<{
    chainId: string;
    arbiter: Uint8Array;
    sponsor: Uint8Array;
    nonce: Uint8Array;
    expires: string;
    amount: Uint8Array;
    lock_id: Uint8Array;
    hash: Uint8Array;
    signature: Uint8Array;
    createdAt: string;
  }>(
    `SELECT 
      chain_id as "chainId",
      arbiter,
      sponsor,
      nonce,
      expires,
      amount,
      lock_id,
      claim_hash as hash,
      signature,
      created_at as "createdAt"
    FROM compacts 
    WHERE sponsor = $1 
    ORDER BY created_at DESC`,
    [addressToBytes(address)]
  );

  return result.rows.map((row) => ({
    chainId: row.chainId,
    compact: {
      id: BigInt(bufferToHex(row.lock_id)),
      arbiter: byteaToAddress(row.arbiter),
      sponsor: byteaToAddress(row.sponsor),
      nonce: BigInt(bufferToHex(row.nonce)),
      expires: BigInt(row.expires),
      amount: bytesToAmount(row.amount),
      witnessTypeString: null,
      witnessHash: null,
    },
    hash: bufferToHex(row.hash),
    signature: bufferToHex(row.signature),
    createdAt: row.createdAt,
  }));
}

export async function getCompactByHash(
  server: FastifyInstance,
  chainId: string,
  claimHash: string
): Promise<CompactRecord | null> {
  const result = await server.db.query<{
    chainId: string;
    arbiter: Uint8Array;
    sponsor: Uint8Array;
    nonce: Uint8Array;
    expires: string;
    amount: Uint8Array;
    lock_id: Uint8Array;
    hash: Uint8Array;
    signature: Uint8Array;
    createdAt: string;
  }>(
    `SELECT 
      chain_id as "chainId",
      arbiter,
      sponsor,
      nonce,
      expires,
      amount,
      lock_id,
      claim_hash as hash,
      signature,
      created_at as "createdAt"
    FROM compacts 
    WHERE chain_id = $1 AND claim_hash = $2`,
    [chainId, hexToBuffer(claimHash)]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    chainId: row.chainId,
    compact: {
      id: BigInt(bufferToHex(row.lock_id)),
      arbiter: byteaToAddress(row.arbiter),
      sponsor: byteaToAddress(row.sponsor),
      nonce: BigInt(bufferToHex(row.nonce)),
      expires: BigInt(row.expires),
      amount: bytesToAmount(row.amount),
      witnessTypeString: null,
      witnessHash: null,
    },
    hash: bufferToHex(row.hash),
    signature: bufferToHex(row.signature),
    createdAt: row.createdAt,
  };
}

async function storeCompact(
  db: PGlite,
  compact: StoredCompactMessage,
  chainId: string,
  hash: Hex,
  signature: Hex
): Promise<void> {
  const id = randomUUID();

  // Convert nonce to hex string preserving all 32 bytes
  const nonceHex = compact.nonce.toString(16).padStart(64, '0');
  const nonceBytes = hexToBuffer(nonceHex);

  await db.query(
    `INSERT INTO compacts (
      id,
      chain_id,
      claim_hash,
      arbiter,
      sponsor,
      nonce,
      expires,
      lock_id,
      amount,
      signature,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
    [
      id,
      chainId,
      hexToBuffer(hash),
      addressToBytes(compact.arbiter),
      addressToBytes(compact.sponsor),
      nonceBytes,
      compact.expires.toString(),
      hexToBuffer(numberToHex(compact.id, { size: 32 })),
      amountToBytes(compact.amount),
      hexToBuffer(signature),
    ]
  );
}

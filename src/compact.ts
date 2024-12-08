import { FastifyInstance } from 'fastify';
import { type Hex } from 'viem';
import { getAddress, hexToBytes, toHex, numberToHex } from 'viem/utils';
import {
  validateCompact,
  type CompactMessage,
  storeNonce,
  generateNonce,
} from './validation';
import { generateClaimHash, signCompact } from './crypto';
import { randomUUID } from 'crypto';

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

// Helper to convert CompactMessage to StoredCompactMessage
function toStoredCompact(
  compact: CompactMessage & { nonce: bigint }
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
  // Validate sponsor matches the session
  if (getAddress(submission.compact.sponsor) !== getAddress(sponsorAddress)) {
    throw new Error('Sponsor address does not match session');
  }

  // Convert string values to BigInt for validation
  const compactForValidation = {
    ...submission.compact,
    id:
      typeof submission.compact.id === 'string'
        ? BigInt(submission.compact.id)
        : submission.compact.id,
    expires:
      typeof submission.compact.expires === 'string'
        ? BigInt(submission.compact.expires)
        : submission.compact.expires,
  };

  // Generate nonce if not provided (do this before validation)
  const nonce =
    submission.compact.nonce === null
      ? await generateNonce(sponsorAddress, submission.chainId, server.db)
      : submission.compact.nonce;

  // Update compact with final nonce
  const finalCompact = {
    ...compactForValidation,
    nonce,
  };

  // Validate the compact (including nonce validation)
  const validationResult = await validateCompact(
    finalCompact,
    submission.chainId,
    server.db
  );
  if (!validationResult.isValid) {
    throw new Error(validationResult.error || 'Invalid compact');
  }

  // Convert to StoredCompactMessage for crypto operations
  const storedCompact = toStoredCompact(finalCompact);

  // Generate the claim hash
  const hash = await generateClaimHash(
    storedCompact,
    BigInt(submission.chainId)
  );

  // Sign the compact
  const signature = await signCompact(hash, BigInt(submission.chainId));

  // Store the nonce as used
  await storeNonce(nonce, submission.chainId, server.db);

  // Store the compact
  await storeCompact(
    server,
    storedCompact,
    submission.chainId,
    hash,
    signature
  );

  return { hash, signature, nonce: nonce.toString() };
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
    compact_id: Uint8Array;
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
      compact_id,
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
      id: BigInt(bufferToHex(row.compact_id)),
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
    compact_id: Uint8Array;
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
      compact_id,
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
      id: BigInt(bufferToHex(row.compact_id)),
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
  server: FastifyInstance,
  compact: StoredCompactMessage,
  chainId: string,
  hash: Hex,
  signature: Hex
): Promise<void> {
  const id = randomUUID();
  await server.db.query(
    `INSERT INTO compacts (
      id,
      chain_id,
      claim_hash,
      arbiter,
      sponsor,
      nonce,
      expires,
      compact_id,
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
      numberToHex(compact.nonce, { size: 32 }),
      compact.expires.toString(),
      numberToHex(compact.id, { size: 32 }),
      amountToBytes(compact.amount),
      hexToBuffer(signature),
    ]
  );
}

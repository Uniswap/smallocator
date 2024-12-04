import { FastifyInstance } from 'fastify';
import { getAddress, type Hex } from 'viem';
import { validateCompact, type CompactMessage } from './validation';
import { generateClaimHash, signCompact } from './crypto';
import { randomUUID } from 'crypto';

export interface CompactSubmission {
  chainId: string;
  compact: CompactMessage;
}

export interface CompactRecord extends CompactSubmission {
  hash: string;
  signature: string;
  createdAt: string;
}

export async function submitCompact(
  server: FastifyInstance,
  submission: CompactSubmission,
  sponsorAddress: string
): Promise<{ hash: string; signature: string }> {
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
    nonce:
      typeof submission.compact.nonce === 'string'
        ? BigInt(submission.compact.nonce)
        : submission.compact.nonce,
    expires:
      typeof submission.compact.expires === 'string'
        ? BigInt(submission.compact.expires)
        : submission.compact.expires,
  };

  // Validate the compact
  const validationResult = await validateCompact(
    compactForValidation,
    submission.chainId,
    server.db
  );
  if (!validationResult.isValid) {
    throw new Error(validationResult.error || 'Invalid compact');
  }

  // Generate the claim hash
  const hash = await generateClaimHash(
    compactForValidation,
    BigInt(submission.chainId)
  );

  // Sign the compact
  const signature = await signCompact(hash, BigInt(submission.chainId));

  // Store the compact
  await storeCompact(server, submission, hash, signature);

  return { hash, signature };
}

export async function getCompactsByAddress(
  server: FastifyInstance,
  address: string
): Promise<CompactRecord[]> {
  const result = await server.db.query<{
    chainId: string;
    arbiter: string;
    sponsor: string;
    nonce: string;
    expires: string;
    amount: string;
    compact_id: string;
    hash: string;
    signature: string;
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
    [getAddress(address)]
  );

  return result.rows.map((row) => ({
    chainId: row.chainId,
    compact: {
      id: BigInt(row.compact_id),
      arbiter: row.arbiter,
      sponsor: row.sponsor,
      nonce: BigInt(row.nonce),
      expires: BigInt(row.expires),
      amount: row.amount,
      witnessTypeString: null,
      witnessHash: null,
    },
    hash: row.hash,
    signature: row.signature,
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
    arbiter: string;
    sponsor: string;
    nonce: string;
    expires: string;
    amount: string;
    compact_id: string;
    hash: string;
    signature: string;
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
    WHERE chain_id = $1 AND LOWER(claim_hash) = LOWER($2)`,
    [chainId, claimHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    chainId: row.chainId,
    compact: {
      id: BigInt(row.compact_id),
      arbiter: row.arbiter,
      sponsor: row.sponsor,
      nonce: BigInt(row.nonce),
      expires: BigInt(row.expires),
      amount: row.amount,
      witnessTypeString: null,
      witnessHash: null,
    },
    hash: row.hash,
    signature: row.signature,
    createdAt: row.createdAt,
  };
}

async function storeCompact(
  server: FastifyInstance,
  submission: CompactSubmission,
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
      submission.chainId,
      hash,
      submission.compact.arbiter,
      submission.compact.sponsor,
      submission.compact.nonce.toString(),
      submission.compact.expires.toString(),
      submission.compact.id.toString(),
      submission.compact.amount,
      signature,
    ]
  );
}

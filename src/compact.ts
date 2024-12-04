import { FastifyInstance } from 'fastify';
import { getAddress, type Hex } from 'viem';
import { validateCompact, type CompactMessage } from './validation';
import { generateClaimHash, signCompact } from './crypto';

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
    id: typeof submission.compact.id === 'string' ? BigInt(submission.compact.id) : submission.compact.id,
    nonce: typeof submission.compact.nonce === 'string' ? BigInt(submission.compact.nonce) : submission.compact.nonce,
    expires: typeof submission.compact.expires === 'string' ? BigInt(submission.compact.expires) : submission.compact.expires,
  };

  // Validate the compact
  const validationResult = await validateCompact(
    compactForValidation,
    submission.chainId
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
  const result = await server.db.query<CompactRecord>(
    `SELECT chain_id as "chainId", 
            compact, 
            hash, 
            signature, 
            created_at as "createdAt"
     FROM compacts 
     WHERE compact->>'sponsor' = $1 
     ORDER BY created_at DESC`,
    [getAddress(address)]
  );

  return result.rows;
}

export async function getCompactByHash(
  server: FastifyInstance,
  chainId: string,
  claimHash: string
): Promise<CompactRecord | null> {
  const result = await server.db.query<CompactRecord>(
    `SELECT chain_id as "chainId", 
            compact, 
            hash, 
            signature, 
            created_at as "createdAt"
     FROM compacts 
     WHERE chain_id = $1 AND hash = $2`,
    [chainId, claimHash]
  );

  return result.rows[0] || null;
}

async function storeCompact(
  server: FastifyInstance,
  submission: CompactSubmission,
  hash: Hex,
  signature: Hex
): Promise<void> {
  // Convert BigInt values to strings for JSON storage
  const compactForStorage = {
    ...submission.compact,
    id: submission.compact.id.toString(),
    nonce: submission.compact.nonce.toString(),
    expires: submission.compact.expires.toString()
  };

  await server.db.query(
    `INSERT INTO compacts (
      chain_id,
      compact,
      hash,
      signature,
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())`,
    [submission.chainId, JSON.stringify(compactForStorage), hash, signature]
  );
}

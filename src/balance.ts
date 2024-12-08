import { PGlite } from '@electric-sql/pglite';
import { getFinalizationThreshold } from './chain-config.js';
import { hexToBytes } from 'viem/utils';

interface CompactRow {
  amount: string;
}

/**
 * Calculate the total allocated balance for a given sponsor, chain, and resource lock
 * that hasn't been processed yet. This accounts for:
 * 1. Compacts that match the sponsor, chain ID, and lock ID
 * 2. Compacts that haven't been finalized yet (currentTime < expires + finalizationThreshold)
 * 3. Compacts that aren't in the processed claims list
 */
export async function getAllocatedBalance(
  db: PGlite,
  sponsor: string,
  chainId: string,
  lockId: string,
  processedClaimHashes: string[]
): Promise<bigint> {
  const currentTimeSeconds = BigInt(Math.floor(Date.now() / 1000));
  const finalizationThreshold = BigInt(getFinalizationThreshold(chainId));

  // Convert inputs to bytea format
  const sponsorBytes = hexToBytes(sponsor.startsWith('0x') ? sponsor as `0x${string}` : `0x${sponsor}` as `0x${string}`);
  const lockIdBytes = hexToBytes(lockId.startsWith('0x') ? lockId as `0x${string}` : `0x${lockId}` as `0x${string}`);
  const processedClaimBytea = processedClaimHashes.map(hash => 
    hexToBytes(hash.startsWith('0x') ? hash as `0x${string}` : `0x${hash}` as `0x${string}`)
  );

  // Handle empty processed claims list case
  if (processedClaimHashes.length === 0) {
    const query = `
      SELECT amount 
      FROM compacts 
      WHERE sponsor = $1 
      AND chain_id = $2 
      AND compact_id = $3
      AND $4 < CAST(expires AS BIGINT) + $5
    `;

    const result = await db.query<CompactRow>(query, [
      sponsorBytes,
      chainId,
      lockIdBytes,
      currentTimeSeconds.toString(),
      finalizationThreshold.toString(),
    ]);

    return result.rows.reduce(
      (sum, row) => sum + BigInt(row.amount),
      BigInt(0)
    );
  }

  // Query with processed claims filter
  const query = `
    SELECT amount 
    FROM compacts 
    WHERE sponsor = $1 
    AND chain_id = $2 
    AND compact_id = $3
    AND $4 < CAST(expires AS BIGINT) + $5
    AND claim_hash NOT IN (${processedClaimBytea.map((_, i) => `$${i + 6}`).join(',')})
  `;

  const params = [
    sponsorBytes,
    chainId,
    lockIdBytes,
    currentTimeSeconds.toString(),
    finalizationThreshold.toString(),
    ...processedClaimBytea,
  ];

  const result = await db.query<CompactRow>(query, params);

  return result.rows.reduce(
    (sum, row) => sum + BigInt(row.amount),
    BigInt(0)
  );
}

import { PGlite } from '@electric-sql/pglite';
import { getFinalizationThreshold } from './chain-config.js';
import { toHex, numberToHex, hexToBytes } from 'viem/utils';

interface CompactRow {
  amount: Uint8Array;
}

// Helper to convert 32-byte array to BigInt
function bytesToBigInt(bytes: Uint8Array): bigint {
  const hex = toHex(bytes);
  return BigInt(hex);
}

// Helper to convert string/bigint to 32-byte array
function toBytea(value: string | bigint): Uint8Array {
  const bigIntValue = typeof value === 'string' ? BigInt(value) : value;
  const hex = numberToHex(bigIntValue, { size: 32 });
  return Buffer.from(hex.slice(2), 'hex');
}

// Helper to convert address to bytea
function addressToBytes(address: string): Uint8Array {
  return hexToBytes(address.toLowerCase() as `0x${string}`);
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

  // Convert sponsor address and lockId to bytea
  const sponsorBytes = addressToBytes(sponsor);
  const lockIdBytes = toBytea(lockId);

  // Convert processed claim hashes to bytea
  const processedClaimByteas = processedClaimHashes.map((hash) =>
    hexToBytes(hash as `0x${string}`)
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
      (sum, row) => sum + bytesToBigInt(row.amount),
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
    AND claim_hash NOT IN (${processedClaimByteas.map((_, i) => `$${i + 6}`).join(',')})
  `;

  const params = [
    sponsorBytes,
    chainId,
    lockIdBytes,
    currentTimeSeconds.toString(),
    finalizationThreshold.toString(),
    ...processedClaimByteas,
  ];

  const result = await db.query<CompactRow>(query, params);

  return result.rows.reduce(
    (sum, row) => sum + bytesToBigInt(row.amount),
    BigInt(0)
  );
}

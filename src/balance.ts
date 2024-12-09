import { PGlite } from '@electric-sql/pglite';
import { getFinalizationThreshold } from './chain-config.js';
import { hexToBytes } from 'viem/utils';
import { toBigInt } from './utils/encoding.js';

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
  try {
    const currentTimeSeconds = BigInt(Math.floor(Date.now() / 1000));
    const finalizationThreshold = BigInt(getFinalizationThreshold(chainId));

    // Convert inputs to bytea format
    const sponsorBytes = hexToBytes(
      sponsor.startsWith('0x')
        ? (sponsor as `0x${string}`)
        : (`0x${sponsor}` as `0x${string}`)
    );

    // Convert lockId to BigInt first (handles both decimal and hex formats)
    const lockIdBigInt = toBigInt(lockId, 'lockId');
    if (lockIdBigInt === null) {
      throw new Error('Invalid lockId');
    }
    // Convert BigInt to proper hex string with 0x prefix and padding
    const lockIdHex = '0x' + lockIdBigInt.toString(16).padStart(64, '0');
    const lockIdBytes = hexToBytes(lockIdHex as `0x${string}`);

    const processedClaimBytea = processedClaimHashes.map((hash) =>
      hexToBytes(
        hash.startsWith('0x')
          ? (hash as `0x${string}`)
          : (`0x${hash}` as `0x${string}`)
      )
    );

    // Handle empty processed claims list case
    if (processedClaimHashes.length === 0) {
      const query = `
        SELECT amount 
        FROM compacts 
        WHERE sponsor = $1 
        AND chain_id = $2 
        AND lock_id = $3
        AND $4 < CAST(expires AS BIGINT) + $5
      `;

      const params = [
        sponsorBytes,
        chainId,
        lockIdBytes,
        currentTimeSeconds.toString(),
        finalizationThreshold.toString(),
      ];

      const result = await db.query<{ amount: Buffer }>(query, params);

      return result.rows.reduce((sum, row) => {
        // Convert bytea amount to decimal string
        const amountBigInt = BigInt(
          '0x' + Buffer.from(row.amount).toString('hex')
        );
        return sum + amountBigInt;
      }, BigInt(0));
    }

    // Query with processed claims filter
    const query = `
      SELECT amount 
      FROM compacts 
      WHERE sponsor = $1 
      AND chain_id = $2 
      AND lock_id = $3
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

    const result = await db.query<{ amount: Buffer }>(query, params);

    return result.rows.reduce((sum, row) => {
      // Convert bytea amount to decimal string
      const amountBigInt = BigInt(
        '0x' + Buffer.from(row.amount).toString('hex')
      );
      return sum + amountBigInt;
    }, BigInt(0));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in getAllocatedBalance: ${error.message}`);
    }
    throw error;
  }
}

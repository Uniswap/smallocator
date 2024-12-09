import { PGlite } from '@electric-sql/pglite';
import { getFinalizationThreshold } from './chain-config.js';
import { hexToBytes } from 'viem/utils';
import { toBigInt } from './utils/encoding.js';

interface CompactRow {
  amount: Buffer;
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

    console.log('Input parameters:', {
      sponsor,
      chainId,
      lockId,
      processedClaimHashes,
      currentTimeSeconds: currentTimeSeconds.toString(),
      finalizationThreshold: finalizationThreshold.toString(),
    });

    console.log('Converted bytea values:', {
      sponsorBytes: Buffer.from(sponsorBytes).toString('hex'),
      lockIdBytes: Buffer.from(lockIdBytes).toString('hex'),
      processedClaimBytea: processedClaimBytea.map((b) =>
        Buffer.from(b).toString('hex')
      ),
    });

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

      const params = [
        sponsorBytes,
        chainId,
        lockIdBytes,
        currentTimeSeconds.toString(),
        finalizationThreshold.toString(),
      ];

      // Log the query and parameters
      console.log('Executing query:', {
        query,
        params: {
          sponsor: Buffer.from(sponsorBytes).toString('hex'),
          chainId,
          lockId: Buffer.from(lockIdBytes).toString('hex'),
          currentTime: currentTimeSeconds.toString(),
          finalizationThreshold: finalizationThreshold.toString(),
        },
      });

      const result = await db.query<{ amount: Buffer }>(query, params);

      // Log the result
      console.log(
        'Query result:',
        result.rows.map((row) => ({
          amount: Buffer.from(row.amount).toString('hex'),
        }))
      );

      return result.rows.reduce((sum, row) => {
        // Convert bytea amount to decimal string
        const amountBigInt = BigInt(
          '0x' + Buffer.from(row.amount).toString('hex')
        );
        console.log('Converting amount:', {
          hex: Buffer.from(row.amount).toString('hex'),
          decimal: amountBigInt.toString(),
        });
        return sum + amountBigInt;
      }, BigInt(0));
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

    // Log the query and parameters
    console.log('Executing query with claims filter:', {
      query,
      params: {
        sponsor: Buffer.from(sponsorBytes).toString('hex'),
        chainId,
        lockId: Buffer.from(lockIdBytes).toString('hex'),
        currentTime: currentTimeSeconds.toString(),
        finalizationThreshold: finalizationThreshold.toString(),
        processedClaimHashes: processedClaimBytea.map((b) =>
          Buffer.from(b).toString('hex')
        ),
      },
    });

    const result = await db.query<{ amount: Buffer }>(query, params);

    // Log the result
    console.log(
      'Query result:',
      result.rows.map((row) => ({
        amount: Buffer.from(row.amount).toString('hex'),
      }))
    );

    return result.rows.reduce((sum, row) => {
      // Convert bytea amount to decimal string
      const amountBigInt = BigInt(
        '0x' + Buffer.from(row.amount).toString('hex')
      );
      console.log('Converting amount:', {
        hex: Buffer.from(row.amount).toString('hex'),
        decimal: amountBigInt.toString(),
      });
      return sum + amountBigInt;
    }, BigInt(0));
  } catch (error) {
    console.error('Error in getAllocatedBalance:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
      console.error('Error message:', error.message);
    }
    throw error; // Re-throw to let the route handler handle it
  }
}

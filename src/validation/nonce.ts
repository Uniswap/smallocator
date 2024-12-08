import { getAddress } from 'viem/utils';
import { hexToBytes, numberToHex } from 'viem/utils';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'crypto';
import { ValidationResult } from './types';

// Helper to convert address to bytea
function addressToBytes(address: string): Uint8Array {
  return hexToBytes(address as `0x${string}`);
}

// Helper to convert hex string to 0x-prefixed hex string
function toHexString(hex: string): `0x${string}` {
  return `0x${hex}` as `0x${string}`;
}

// Helper to convert bigint to 32-byte hex string
function bigintToHex(value: bigint): string {
  return numberToHex(value, { size: 32 }).slice(2);
}

export async function generateNonce(
  sponsor: string,
  chainId: string,
  db: PGlite
): Promise<bigint> {
  const sponsorBytes = Buffer.from(
    getAddress(sponsor).toLowerCase().slice(2),
    'hex'
  );

  const result = await db.query<{ next_nonce: string }>(
    `-- This query finds the first available 12-byte nonce fragment for a given sponsor and chain.
    -- The nonce is represented as two parts:
    --   1. nonce_high (uint64): The upper 8 bytes
    --   2. nonce_low (uint32): The lower 4 bytes
    
    WITH numbered_gaps AS (
        SELECT 
            nonce_high,
            nonce_low,
            LEAD(nonce_high) OVER w as next_high,
            LEAD(nonce_low) OVER w as next_low
        FROM nonces 
        WHERE chain_id = $1 
        AND sponsor = $2
        -- Order by high * 2^32 + low for sequential ordering
        WINDOW w AS (ORDER BY (nonce_high::numeric * (2^32)::numeric) + nonce_low::numeric)
    ),
    gaps AS (
        -- Check for gaps in the sequence treating high/low as a single number
        SELECT 
            CASE 
                -- If incrementing low would overflow
                WHEN nonce_low = 2147483647 THEN nonce_high + 1
                ELSE nonce_high
            END as gap_high,
            CASE 
                WHEN nonce_low = 2147483647 THEN 0
                ELSE nonce_low + 1
            END as gap_low
        FROM numbered_gaps
        WHERE 
            -- Check if next value (if it exists) is more than current + 1
            next_high IS NULL 
            OR (next_high::numeric * (2^32)::numeric) + next_low::numeric > 
               (nonce_high::numeric * (2^32)::numeric) + nonce_low::numeric + 1
        UNION ALL
        -- Handle case where (0,0) is available
        SELECT 0, 0
        WHERE NOT EXISTS (
            SELECT 1 FROM nonces 
            WHERE chain_id = $1 
            AND sponsor = $2 
            AND nonce_high = 0 
            AND nonce_low = 0
        )
    )
    SELECT 
        COALESCE(
            -- First available gap if one exists
            (SELECT (gap_high, gap_low)::text 
             FROM (
                 SELECT gap_high, gap_low 
                 FROM gaps 
                 ORDER BY (gap_high::numeric * (2^32)::numeric) + gap_low::numeric
                 LIMIT 1
             ) g),
            -- Otherwise use next value after highest
            (SELECT 
                CASE 
                    -- If we can increment low, do that
                    WHEN MAX(nonce_low) < 2147483647 
                    THEN (MAX(nonce_high), MAX(nonce_low) + 1)::text
                    -- Otherwise carry to next high value
                    ELSE (MAX(nonce_high) + 1, 0)::text
                END
             FROM nonces 
             WHERE chain_id = $1 
             AND sponsor = $2),
            -- If no records exist, start at (0,0)
            '(0,0)'
        ) as next_nonce`,
    [chainId, sponsorBytes]
  );

  // Parse the (high, low) tuple from postgres
  const match = result.rows[0].next_nonce.match(/\((\d+),(\d+)\)/);
  if (!match) throw new Error('Invalid nonce format returned');

  const [high, low] = [BigInt(match[1]), BigInt(match[2])];

  // Create a buffer for the complete nonce (32 bytes: 20 + 8 + 4)
  const nonceBuffer = Buffer.alloc(32);

  // Copy sponsor (20 bytes)
  sponsorBytes.copy(nonceBuffer, 0);

  // Write high value (8 bytes)
  nonceBuffer.writeBigUInt64BE(high, 20);

  // Write low value (4 bytes)
  nonceBuffer.writeUInt32BE(Number(low), 28);

  // Convert the complete buffer to BigInt
  return BigInt('0x' + nonceBuffer.toString('hex'));
}

export async function validateNonce(
  nonce: bigint,
  sponsor: string,
  chainId: string,
  db: PGlite
): Promise<ValidationResult> {
  try {
    // Convert nonce to 32-byte hex string (without 0x prefix) and lowercase
    const nonceHex = bigintToHex(nonce);

    // Split nonce into sponsor and fragment parts
    const sponsorPart = nonceHex.slice(0, 40); // first 20 bytes = 40 hex chars
    const fragmentPart = nonceHex.slice(40); // remaining 12 bytes = 24 hex chars

    // Check that the sponsor part matches the sponsor's address (both lowercase)
    const sponsorAddress = getAddress(sponsor).toLowerCase().slice(2);

    if (sponsorPart !== sponsorAddress) {
      return {
        isValid: false,
        error: 'Nonce does not match sponsor address',
      };
    }

    // Extract high and low parts from fragment
    const fragmentBigInt = BigInt('0x' + fragmentPart);
    const nonceLow = Number(fragmentBigInt & BigInt(0xffffffff));
    const nonceHigh = Number(fragmentBigInt >> BigInt(32));

    // Check if nonce has been used before in this domain
    const result = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM nonces WHERE chain_id = $1 AND sponsor = $2 AND nonce_high = $3 AND nonce_low = $4',
      [chainId, addressToBytes(sponsor), nonceHigh, nonceLow]
    );

    if (result.rows[0].count > 0) {
      return {
        isValid: false,
        error: 'Nonce has already been used',
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Nonce validation error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export async function storeNonce(
  nonce: bigint,
  chainId: string,
  db: PGlite
): Promise<void> {
  // Convert nonce to 32-byte hex string (without 0x prefix) and lowercase
  const nonceHex = bigintToHex(nonce);

  // Split nonce into sponsor and fragment parts
  const sponsorPart = nonceHex.slice(0, 40); // first 20 bytes = 40 hex chars
  const fragmentPart = nonceHex.slice(40); // remaining 12 bytes = 24 hex chars

  // Extract high and low parts from fragment
  const fragmentBigInt = BigInt('0x' + fragmentPart);
  const nonceLow = Number(fragmentBigInt & BigInt(0xffffffff));
  const nonceHigh = Number(fragmentBigInt >> BigInt(32));

  // Lock the nonces table for this sponsor and chain before inserting
  await db.query(
    'SELECT 1 FROM nonces WHERE chain_id = $1 AND sponsor = $2 FOR UPDATE',
    [chainId, hexToBytes(toHexString(sponsorPart))]
  );

  await db.query(
    'INSERT INTO nonces (id, chain_id, sponsor, nonce_high, nonce_low) VALUES ($1, $2, $3, $4, $5)',
    [
      randomUUID(),
      chainId,
      hexToBytes(toHexString(sponsorPart)),
      nonceHigh,
      nonceLow,
    ]
  );
}

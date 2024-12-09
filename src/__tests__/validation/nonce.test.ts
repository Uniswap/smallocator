import { generateNonce, validateNonce } from '../../validation/nonce';
import { PGlite } from '@electric-sql/pglite';
import { hexToBytes } from 'viem/utils';

describe('Nonce Validation', () => {
  let db: PGlite;

  beforeAll(async (): Promise<void> => {
    db = new PGlite();

    // Create test tables with bytea columns
    await db.query(`
      CREATE TABLE IF NOT EXISTS compacts (
        id UUID PRIMARY KEY,
        chain_id bigint NOT NULL,
        claim_hash bytea NOT NULL CHECK (length(claim_hash) = 32),
        arbiter bytea NOT NULL CHECK (length(arbiter) = 20),
        sponsor bytea NOT NULL CHECK (length(sponsor) = 20),
        nonce bytea NOT NULL CHECK (length(nonce) = 32),
        expires BIGINT NOT NULL,
        lock_id bytea NOT NULL CHECK (length(lock_id) = 32),
        amount bytea NOT NULL CHECK (length(amount) = 32),
        witness_type_string TEXT,
        witness_hash bytea CHECK (witness_hash IS NULL OR length(witness_hash) = 32),
        signature bytea NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chain_id, claim_hash)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS nonces (
        id UUID PRIMARY KEY,
        chain_id bigint NOT NULL,
        sponsor bytea NOT NULL CHECK (length(sponsor) = 20),
        nonce_high bigint NOT NULL,
        nonce_low integer NOT NULL,
        consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chain_id, sponsor, nonce_high, nonce_low)
      )
    `);
  });

  afterAll(async (): Promise<void> => {
    // Clean up
    await db.query('DROP TABLE IF EXISTS compacts');
    await db.query('DROP TABLE IF EXISTS nonces');
  });

  describe('generateNonce', () => {
    beforeEach(async () => {
      // Clear nonces table before each test
      await db.query('DELETE FROM nonces');
    });

    it('should generate a valid initial nonce for a sponsor', async (): Promise<void> => {
      const sponsor = '0x1234567890123456789012345678901234567890';
      const chainId = '1';

      const nonce = await generateNonce(sponsor, chainId, db);

      // Convert nonce to hex string without 0x prefix
      const nonceHex = nonce.toString(16).padStart(64, '0');

      // First 40 chars should be sponsor address without 0x
      expect(nonceHex.slice(0, 40)).toBe(sponsor.slice(2).toLowerCase());

      // Last 24 chars should be 0 (first nonce fragment)
      expect(BigInt('0x' + nonceHex.slice(40))).toBe(BigInt(0));
    });

    it('should increment nonce fragment when previous ones are used', async (): Promise<void> => {
      const sponsor = '0x1234567890123456789012345678901234567890';
      const chainId = '1';

      // Insert a used nonce with fragment 0
      await db.query(
        'INSERT INTO nonces (id, chain_id, sponsor, nonce_high, nonce_low) VALUES ($1, $2, $3, $4, $5)',
        [
          '123e4567-e89b-12d3-a456-426614174000',
          chainId,
          hexToBytes(sponsor as `0x${string}`),
          0,
          0,
        ]
      );

      const nonce = await generateNonce(sponsor, chainId, db);
      const nonceHex = nonce.toString(16).padStart(64, '0');

      // Check sponsor part
      expect(nonceHex.slice(0, 40)).toBe(sponsor.slice(2).toLowerCase());

      // Check fragment is incremented
      expect(BigInt('0x' + nonceHex.slice(40))).toBe(BigInt(1));
    });

    it('should find first available gap in nonce fragments', async (): Promise<void> => {
      const sponsor = '0x1234567890123456789012345678901234567890';
      const chainId = '1';

      // Insert nonces with fragments 0 and 2, leaving 1 as a gap
      await db.query(
        'INSERT INTO nonces (id, chain_id, sponsor, nonce_high, nonce_low) VALUES ($1, $2, $3, $4, $5), ($6, $2, $3, $7, $8)',
        [
          '123e4567-e89b-12d3-a456-426614174000',
          chainId,
          hexToBytes(sponsor as `0x${string}`),
          0,
          0,
          '123e4567-e89b-12d3-a456-426614174001',
          0,
          2,
        ]
      );

      const nonce = await generateNonce(sponsor, chainId, db);
      const nonceHex = nonce.toString(16).padStart(64, '0');

      // Check fragment uses the gap
      expect(BigInt('0x' + nonceHex.slice(40))).toBe(BigInt(1));
    });

    it('should handle mixed case sponsor addresses', async (): Promise<void> => {
      const sponsorUpper = '0x0000000000FFe8B47B3e2130213B802212439497';
      const sponsorLower = sponsorUpper.toLowerCase();
      const chainId = '1';

      const nonceLower = await generateNonce(sponsorLower, chainId, db);
      const nonceUpper = await generateNonce(sponsorUpper, chainId, db);

      expect(nonceLower).toBe(nonceUpper);
    });
  });

  describe('validateNonce', () => {
    const chainId = '1';

    beforeEach(async () => {
      // Clear test data
      await db.query('DELETE FROM nonces');
    });

    it('should validate a fresh nonce', async (): Promise<void> => {
      const sponsor = '0x1234567890123456789012345678901234567890';
      const nonce = await generateNonce(sponsor, chainId, db);

      const result = await validateNonce(nonce, sponsor, chainId, db);
      expect(result.isValid).toBe(true);
    });

    it('should reject a used nonce', async (): Promise<void> => {
      const sponsor = '0x1234567890123456789012345678901234567890';
      const nonce = await generateNonce(sponsor, chainId, db);
      const nonceHex = nonce.toString(16).padStart(64, '0');
      const sponsorPart = nonceHex.slice(0, 40);
      const fragmentPart = nonceHex.slice(40);

      // Extract high and low parts from fragment
      const fragmentBigInt = BigInt('0x' + fragmentPart);
      const nonceLow = Number(fragmentBigInt & BigInt(0xffffffff));
      const nonceHigh = Number(fragmentBigInt >> BigInt(32));

      // Insert nonce as used
      await db.query(
        'INSERT INTO nonces (id, chain_id, sponsor, nonce_high, nonce_low) VALUES ($1, $2, $3, $4, $5)',
        [
          '123e4567-e89b-12d3-a456-426614174000',
          chainId,
          hexToBytes(('0x' + sponsorPart) as `0x${string}`),
          nonceHigh,
          nonceLow,
        ]
      );

      const result = await validateNonce(nonce, sponsor, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Nonce has already been used');
    });

    it('should reject a nonce with incorrect sponsor prefix', async (): Promise<void> => {
      const sponsor = '0x1234567890123456789012345678901234567890';
      // Create nonce with wrong sponsor prefix
      const nonce = BigInt('0x1234' + '0'.repeat(60));

      const result = await validateNonce(nonce, sponsor, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Nonce does not match sponsor address');
    });

    it('should allow same nonce in different chains', async (): Promise<void> => {
      const sponsor = '0x1234567890123456789012345678901234567890';
      const nonce = await generateNonce(sponsor, chainId, db);
      const nonceHex = nonce.toString(16).padStart(64, '0');
      const sponsorPart = nonceHex.slice(0, 40);
      const fragmentPart = nonceHex.slice(40);

      // Extract high and low parts from fragment
      const fragmentBigInt = BigInt('0x' + fragmentPart);
      const nonceLow = Number(fragmentBigInt & BigInt(0xffffffff));
      const nonceHigh = Number(fragmentBigInt >> BigInt(32));

      // Insert nonce as used in a different chain
      await db.query(
        'INSERT INTO nonces (id, chain_id, sponsor, nonce_high, nonce_low) VALUES ($1, $2, $3, $4, $5)',
        [
          '123e4567-e89b-12d3-a456-426614174000',
          '10',
          hexToBytes(('0x' + sponsorPart) as `0x${string}`),
          nonceHigh,
          nonceLow,
        ]
      );

      const result = await validateNonce(nonce, sponsor, chainId, db);
      expect(result.isValid).toBe(true);
    });

    it('should handle mixed case nonces consistently', async (): Promise<void> => {
      const sponsor = '0x1234567890123456789012345678901234567890';
      const nonce = await generateNonce(sponsor, chainId, db);
      const nonceHex = nonce.toString(16).padStart(64, '0');
      const sponsorPart = nonceHex.slice(0, 40);
      const fragmentPart = nonceHex.slice(40).toUpperCase(); // Use uppercase

      // Extract high and low parts from fragment
      const fragmentBigInt = BigInt('0x' + fragmentPart.toLowerCase());
      const nonceLow = Number(fragmentBigInt & BigInt(0xffffffff));
      const nonceHigh = Number(fragmentBigInt >> BigInt(32));

      // Insert nonce with uppercase fragment
      await db.query(
        'INSERT INTO nonces (id, chain_id, sponsor, nonce_high, nonce_low) VALUES ($1, $2, $3, $4, $5)',
        [
          '123e4567-e89b-12d3-a456-426614174000',
          chainId,
          hexToBytes(('0x' + sponsorPart) as `0x${string}`),
          nonceHigh,
          nonceLow,
        ]
      );

      // Try to validate same nonce with uppercase
      const result = await validateNonce(nonce, sponsor, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Nonce has already been used');
    });
  });
});

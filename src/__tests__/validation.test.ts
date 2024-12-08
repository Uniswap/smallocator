import {
  validateDomainAndId,
  validateCompact,
  validateAllocation,
  generateNonce,
} from '../validation';
import { getFreshCompact } from './utils/test-server';
import { PGlite } from '@electric-sql/pglite';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../graphql';
import { hexToBytes } from 'viem/utils';

describe('Validation', () => {
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
        compact_id bytea NOT NULL CHECK (length(compact_id) = 32),
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

  describe('validateDomainAndId', () => {
    it('should validate correct id and chain', async (): Promise<void> => {
      const id = BigInt(1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = '1';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(
        id,
        expires,
        chainId,
        allocatorAddress
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid id', async (): Promise<void> => {
      const id = BigInt(-1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = '1';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(
        id,
        expires,
        chainId,
        allocatorAddress
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid ID');
    });

    it('should reject invalid chain id', async (): Promise<void> => {
      const id = BigInt(1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = 'invalid';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(
        id,
        expires,
        chainId,
        allocatorAddress
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid chain ID');
    });
  });

  describe('validateCompact', () => {
    let originalRequest: typeof graphqlClient.request;

    beforeEach(async (): Promise<void> => {
      // Store original function
      originalRequest = graphqlClient.request;

      // Mock GraphQL response
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '1' }], // Match the test compact ID
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: '1000000000000000000000', // 1000 ETH
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      });
    });

    afterEach((): void => {
      // Restore original function
      graphqlClient.request = originalRequest;
    });

    it('should validate correct compact', async (): Promise<void> => {
      const result = await validateCompact(getFreshCompact(), '1', db);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid arbiter address', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        arbiter: 'invalid-address',
      };
      const result = await validateCompact(invalidCompact, '1', db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid arbiter address');
    });

    it('should reject invalid sponsor address', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        sponsor: 'invalid-address',
      };
      const result = await validateCompact(invalidCompact, '1', db);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject invalid expires timestamp', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        expires: BigInt(-1),
      };
      const result = await validateCompact(invalidCompact, '1', db);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject invalid amount', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        amount: '-1',
      };
      const result = await validateCompact(invalidCompact, '1', db);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject invalid chain id', async (): Promise<void> => {
      const result = await validateCompact(getFreshCompact(), 'invalid', db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid chain ID');
    });
  });

  describe('validateNonce', () => {
    const chainId = '1';
    let originalRequest: typeof graphqlClient.request;

    beforeEach(async () => {
      // Clear test data
      await db.query('DELETE FROM nonces');

      // Store original function
      originalRequest = graphqlClient.request;

      // Mock GraphQL response
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '1' }],
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: '1000000000000000000000',
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      });
    });

    afterEach(async () => {
      // Restore original function
      graphqlClient.request = originalRequest;
    });

    it('should validate a fresh nonce', async (): Promise<void> => {
      const compact = getFreshCompact();
      const result = await validateCompact(compact, chainId, db);
      expect(result.isValid).toBe(true);
    });

    it('should reject a used nonce', async (): Promise<void> => {
      const compact = getFreshCompact();
      const nonceHex = compact.nonce.toString(16).padStart(64, '0');
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

      const result = await validateCompact(compact, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Nonce has already been used');
    });

    it('should reject a nonce with incorrect sponsor prefix', async (): Promise<void> => {
      const compact = getFreshCompact();
      // Modify nonce to have wrong sponsor prefix
      compact.nonce = BigInt('0x1234' + '0'.repeat(60));

      const result = await validateCompact(compact, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Nonce does not match sponsor address');
    });

    it('should allow same nonce in different chains', async (): Promise<void> => {
      const compact = getFreshCompact();
      const nonceHex = compact.nonce.toString(16).padStart(64, '0');
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

      const result = await validateCompact(compact, chainId, db);
      expect(result.isValid).toBe(true);
    });

    it('should handle mixed case nonces consistently', async (): Promise<void> => {
      const compact = getFreshCompact();
      const nonceHex = compact.nonce.toString(16).padStart(64, '0');
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
      const result = await validateCompact(compact, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Nonce has already been used');
    });
  });

  describe('validateAllocation', () => {
    let originalRequest: typeof graphqlClient.request;
    const chainId = '10';
    const mockTimestampMs = 1700000000000;
    const mockTimestampSec = Math.floor(mockTimestampMs / 1000);

    beforeEach(async (): Promise<void> => {
      // Store original function
      originalRequest = graphqlClient.request;

      // Mock GraphQL response with sufficient balance
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '1' }], // Match the test compact ID
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: '1000000000000000000000', // 1000 ETH
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      });

      // Clear test data
      await db.query('DELETE FROM compacts');
    });

    afterEach((): void => {
      // Restore original function
      graphqlClient.request = originalRequest;
    });

    it('should validate when allocatable balance is sufficient', async (): Promise<void> => {
      const compact = getFreshCompact();

      const result = await validateAllocation(compact, chainId, db);
      expect(result.isValid).toBe(true);
    });

    it('should reject when allocatable balance is insufficient', async (): Promise<void> => {
      const compact = getFreshCompact();

      // Mock GraphQL response with insufficient balance
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '1' }], // Match the test compact ID
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: (BigInt(compact.amount) / BigInt(2)).toString(), // Half the compact amount
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      });

      const result = await validateAllocation(compact, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Insufficient allocatable balance');
    });

    it('should consider existing allocated balance', async (): Promise<void> => {
      const compact = getFreshCompact();

      // Insert existing compact with bytea values
      await db.query(
        `
        INSERT INTO compacts (
          id, chain_id, claim_hash, arbiter, sponsor, nonce, expires,
          compact_id, amount, signature
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
      `,
        [
          '123e4567-e89b-12d3-a456-426614174000',
          chainId,
          hexToBytes('0x' + '1'.repeat(64) as `0x${string}`), // claim_hash
          hexToBytes(compact.arbiter as `0x${string}`), // arbiter
          hexToBytes(compact.sponsor as `0x${string}`), // sponsor
          hexToBytes(('0x' + compact.nonce.toString(16).padStart(64, '0')) as `0x${string}`), // nonce
          (mockTimestampSec + 3600).toString(),
          hexToBytes(('0x' + compact.id.toString(16).padStart(64, '0')) as `0x${string}`), // compact_id
          hexToBytes(('0x' + BigInt(compact.amount).toString(16).padStart(64, '0')) as `0x${string}`), // amount
          hexToBytes('0x' + '1'.repeat(130) as `0x${string}`), // signature
        ]
      );

      // Mock GraphQL response with balance just enough for one compact
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '1' }], // Match the test compact ID
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: (BigInt(compact.amount) * BigInt(2)).toString(), // Enough for two compacts
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      });

      const result = await validateAllocation(compact, chainId, db);
      expect(result.isValid).toBe(true);
    });

    it('should exclude processed claims from allocated balance', async (): Promise<void> => {
      const compact = getFreshCompact();

      // Insert existing compact with bytea values
      await db.query(
        `
        INSERT INTO compacts (
          id, chain_id, claim_hash, arbiter, sponsor, nonce, expires,
          compact_id, amount, signature
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
      `,
        [
          '123e4567-e89b-12d3-a456-426614174000',
          chainId,
          hexToBytes('0x' + '1'.repeat(64) as `0x${string}`), // claim_hash
          hexToBytes(compact.arbiter as `0x${string}`), // arbiter
          hexToBytes(compact.sponsor as `0x${string}`), // sponsor
          hexToBytes(('0x' + compact.nonce.toString(16).padStart(64, '0')) as `0x${string}`), // nonce
          (mockTimestampSec + 3600).toString(),
          hexToBytes(('0x' + compact.id.toString(16).padStart(64, '0')) as `0x${string}`), // compact_id
          hexToBytes(('0x' + BigInt(compact.amount).toString(16).padStart(64, '0')) as `0x${string}`), // amount
          hexToBytes('0x' + '1'.repeat(130) as `0x${string}`), // signature
        ]
      );

      // Mock GraphQL response with processed claim
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '1' }], // Match the test compact ID
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: compact.amount, // Only enough for one compact
              },
            ],
          },
          claims: {
            items: [
              {
                claimHash: '0x' + '1'.repeat(64), // Mark the existing compact as processed
              },
            ],
          },
        },
      });

      const result = await validateAllocation(compact, chainId, db);
      expect(result.isValid).toBe(true);
    });

    it('should reject when withdrawal is enabled', async (): Promise<void> => {
      const compact = getFreshCompact();

      // Mock GraphQL response with withdrawal enabled
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '1' }], // Match the test compact ID
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 1, // Withdrawal enabled
                balance: '1000000000000000000000',
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      });

      const result = await validateAllocation(compact, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('forced withdrawals enabled');
    });

    it('should reject when allocatorId from GraphQL does not match compact ID', async (): Promise<void> => {
      const compact = getFreshCompact();
      const chainId = '10';

      // Mock GraphQL response with different allocatorId
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '999' }], // Different from the one encoded in compact ID
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: '1000000000000000000000',
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      });

      const result = await validateAllocation(compact, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid allocator ID');
    });

    it('should reject when allocatorId is missing from GraphQL response', async (): Promise<void> => {
      const compact = getFreshCompact();
      const chainId = '10';

      // Mock GraphQL response with missing allocatorId
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [], // Empty array, no allocatorId
          },
        },
        accountDeltas: {
          items: [],
        },
        account: {
          resourceLocks: {
            items: [
              {
                withdrawalStatus: 0,
                balance: '1000000000000000000000',
              },
            ],
          },
          claims: {
            items: [],
          },
        },
      });

      const result = await validateAllocation(compact, chainId, db);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid allocator ID');
    });
  });
});

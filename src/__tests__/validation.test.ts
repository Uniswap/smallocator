import {
  validateDomainAndId,
  validateCompact,
  validateAllocation,
} from '../validation';
import { getFreshCompact } from './utils/test-server';
import { PGlite } from '@electric-sql/pglite';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../graphql';

describe('Validation', () => {
  let db: PGlite;

  beforeAll(async (): Promise<void> => {
    db = new PGlite();

    // Create test table
    await db.query(`
      CREATE TABLE IF NOT EXISTS compacts (
        id TEXT PRIMARY KEY,
        chain_id TEXT NOT NULL,
        claim_hash TEXT NOT NULL,
        arbiter TEXT NOT NULL,
        sponsor TEXT NOT NULL,
        nonce TEXT NOT NULL,
        expires BIGINT NOT NULL,
        compact_id TEXT NOT NULL,
        amount TEXT NOT NULL,
        witness_type_string TEXT,
        witness_hash TEXT,
        signature TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chain_id, claim_hash)
      )
    `);
  });

  afterAll(async (): Promise<void> => {
    // Clean up
    await db.query('DROP TABLE IF EXISTS compacts');
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
            items: [{ allocatorId: '123' }],
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

  describe('validateAllocation', () => {
    let originalRequest: typeof graphqlClient.request;
    const chainId = '10';
    const mockTimestampMs = 1700000000000;
    const mockTimestampSec = Math.floor(mockTimestampMs / 1000);

    beforeEach(async (): Promise<void> => {
      // Store original function
      originalRequest = graphqlClient.request;

      // Clear test data
      await db.query('DELETE FROM compacts');
    });

    afterEach((): void => {
      // Restore original function
      graphqlClient.request = originalRequest;
    });

    it('should validate when allocatable balance is sufficient', async (): Promise<void> => {
      const compact = getFreshCompact();
      const compactAmount = BigInt(compact.amount);

      // Mock GraphQL response with sufficient balance
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '123' }],
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
                balance: (compactAmount * 2n).toString(), // Double the compact amount
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

    it('should reject when allocatable balance is insufficient', async (): Promise<void> => {
      const compact = getFreshCompact();
      const compactAmount = BigInt(compact.amount);

      // Mock GraphQL response with insufficient balance
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '123' }],
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
                balance: (compactAmount / 2n).toString(), // Half the compact amount
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
      const compactAmount = BigInt(compact.amount);

      // Insert existing compact
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
          '1',
          chainId,
          'hash1',
          compact.arbiter,
          compact.sponsor,
          compact.nonce.toString(),
          (mockTimestampSec + 3600).toString(),
          compact.id.toString(),
          compactAmount.toString(),
          '0xsig1',
        ]
      );

      // Mock GraphQL response with balance just enough for one compact
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '123' }],
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
                balance: (compactAmount * 2n).toString(), // Enough for two compacts
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
      const compactAmount = BigInt(compact.amount);

      // Insert existing compact
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
          '1',
          chainId,
          'hash1',
          compact.arbiter,
          compact.sponsor,
          compact.nonce.toString(),
          (mockTimestampSec + 3600).toString(),
          compact.id.toString(),
          compactAmount.toString(),
          '0xsig1',
        ]
      );

      // Mock GraphQL response with processed claim
      graphqlClient.request = async (): Promise<
        AllocatorResponse & AccountDeltasResponse & AccountResponse
      > => ({
        allocator: {
          supportedChains: {
            items: [{ allocatorId: '123' }],
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
                balance: compactAmount.toString(), // Only enough for one compact
              },
            ],
          },
          claims: {
            items: [
              {
                claimHash: 'hash1', // Mark the existing compact as processed
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
            items: [{ allocatorId: '123' }],
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
  });
});

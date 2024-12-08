import { validateAllocation } from '../../validation/allocation';
import { getFreshCompact } from '../utils/test-server';
import { PGlite } from '@electric-sql/pglite';
import { hexToBytes } from 'viem/utils';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../../graphql';

describe('Allocation Validation', () => {
  let db: PGlite;
  let originalRequest: typeof graphqlClient.request;
  const chainId = '10';
  const mockTimestampMs = 1700000000000;
  const mockTimestampSec = Math.floor(mockTimestampMs / 1000);

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
  });

  afterAll(async (): Promise<void> => {
    // Clean up
    await db.query('DROP TABLE IF EXISTS compacts');
  });

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
        hexToBytes(('0x' + '1'.repeat(64)) as `0x${string}`), // claim_hash
        hexToBytes(compact.arbiter as `0x${string}`), // arbiter
        hexToBytes(compact.sponsor as `0x${string}`), // sponsor
        hexToBytes(
          ('0x' + compact.nonce.toString(16).padStart(64, '0')) as `0x${string}`
        ), // nonce
        (mockTimestampSec + 3600).toString(),
        hexToBytes(
          ('0x' + compact.id.toString(16).padStart(64, '0')) as `0x${string}`
        ), // compact_id
        hexToBytes(
          ('0x' +
            BigInt(compact.amount)
              .toString(16)
              .padStart(64, '0')) as `0x${string}`
        ), // amount
        hexToBytes(('0x' + '1'.repeat(130)) as `0x${string}`), // signature
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
        hexToBytes(('0x' + '1'.repeat(64)) as `0x${string}`), // claim_hash
        hexToBytes(compact.arbiter as `0x${string}`), // arbiter
        hexToBytes(compact.sponsor as `0x${string}`), // sponsor
        hexToBytes(
          ('0x' + compact.nonce.toString(16).padStart(64, '0')) as `0x${string}`
        ), // nonce
        (mockTimestampSec + 3600).toString(),
        hexToBytes(
          ('0x' + compact.id.toString(16).padStart(64, '0')) as `0x${string}`
        ), // compact_id
        hexToBytes(
          ('0x' +
            BigInt(compact.amount)
              .toString(16)
              .padStart(64, '0')) as `0x${string}`
        ), // amount
        hexToBytes(('0x' + '1'.repeat(130)) as `0x${string}`), // signature
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

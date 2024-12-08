import { validateCompact } from '../../validation/compact';
import { getFreshCompact } from '../utils/test-server';
import { PGlite } from '@electric-sql/pglite';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../../graphql';

describe('Compact Validation', () => {
  let db: PGlite;
  let originalRequest: typeof graphqlClient.request;

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

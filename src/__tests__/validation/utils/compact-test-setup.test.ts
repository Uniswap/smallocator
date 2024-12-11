import { PGlite } from '@electric-sql/pglite';
import {
  setupCompactTestDb,
  cleanupCompactTestDb,
  setupGraphQLMocks,
  getRequestCallCount,
  setMockToFail,
} from './compact-test-setup';
import { graphqlClient } from '../../../graphql';
import type {
  SupportedChainsResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../../../graphql';
import { hexToBytes } from 'viem/utils';

type MockResponse = SupportedChainsResponse &
  AccountDeltasResponse &
  AccountResponse;

describe('Compact Test Setup', () => {
  let db: PGlite;
  let originalRequest: typeof graphqlClient.request;

  beforeEach(() => {
    originalRequest = graphqlClient.request;
  });

  afterEach(async () => {
    graphqlClient.request = originalRequest;
    if (db) {
      await cleanupCompactTestDb(db);
    }
  });

  describe('Database Setup', () => {
    it('should create required tables', async () => {
      db = await setupCompactTestDb();

      // Verify compacts table exists with correct structure
      const compactsResult = await db.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'compacts'
        ORDER BY ordinal_position;
      `);
      expect(compactsResult.rows.length).toBeGreaterThan(0);

      // Verify nonces table exists with correct structure
      const noncesResult = await db.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'nonces'
        ORDER BY ordinal_position;
      `);
      expect(noncesResult.rows.length).toBeGreaterThan(0);
    });

    it('should enforce bytea length constraints on compacts table', async () => {
      db = await setupCompactTestDb();

      // Attempt to insert with invalid claim_hash length
      await expect(
        db.query(
          `
        INSERT INTO compacts (
          id, chain_id, claim_hash, arbiter, sponsor, nonce, expires,
          lock_id, amount, signature
        ) VALUES (
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, $1, $2, $2, $1, 1234567890,
          $1, $1, $3
        )
      `,
          [
            hexToBytes('0x1234' as `0x${string}`), // 2 bytes, should fail claim_hash 32-byte check
            hexToBytes(('0x' + '1234567890'.repeat(4)) as `0x${string}`), // 20 bytes for arbiter/sponsor
            hexToBytes(('0x' + '12'.repeat(65)) as `0x${string}`), // 65 bytes for signature
          ]
        )
      ).rejects.toThrow();
    });

    it('should enforce bytea length constraints on nonces table', async () => {
      db = await setupCompactTestDb();

      // Attempt to insert with invalid sponsor length
      await expect(
        db.query(
          `
        INSERT INTO nonces (
          id, chain_id, sponsor, nonce_high, nonce_low
        ) VALUES (
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, $1, 123, 456
        )
      `,
          [
            hexToBytes('0x1234' as `0x${string}`), // 2 bytes, should fail sponsor 20-byte check
          ]
        )
      ).rejects.toThrow();
    });

    it('should enforce unique constraints on compacts table', async () => {
      db = await setupCompactTestDb();

      const claimHash = hexToBytes(('0x' + '12'.repeat(32)) as `0x${string}`);
      const arbiter = hexToBytes(('0x' + '12'.repeat(20)) as `0x${string}`);
      const lockId = hexToBytes(('0x' + '12'.repeat(32)) as `0x${string}`);
      const amount = hexToBytes(('0x' + '12'.repeat(32)) as `0x${string}`);
      const signature = hexToBytes(('0x' + '12'.repeat(65)) as `0x${string}`);

      // First insert should succeed
      await db.query(
        `
        INSERT INTO compacts (
          id, chain_id, claim_hash, arbiter, sponsor, nonce, expires,
          lock_id, amount, signature
        ) VALUES (
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, $1, $2, $2, $1, 1234567890,
          $3, $4, $5
        )
      `,
        [claimHash, arbiter, lockId, amount, signature]
      );

      // Second insert with same chain_id and claim_hash should fail
      await expect(
        db.query(
          `
        INSERT INTO compacts (
          id, chain_id, claim_hash, arbiter, sponsor, nonce, expires,
          lock_id, amount, signature
        ) VALUES (
          'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, $1, $2, $2, $1, 1234567890,
          $3, $4, $5
        )
      `,
          [claimHash, arbiter, lockId, amount, signature]
        )
      ).rejects.toThrow();
    });

    it('should cleanup tables properly', async () => {
      db = await setupCompactTestDb();
      await cleanupCompactTestDb(db);

      // Verify tables no longer exist
      const tablesResult = await db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name IN ('compacts', 'nonces');
      `);
      expect(tablesResult.rows.length).toBe(0);
    });
  });

  describe('GraphQL Mocking', () => {
    it('should setup GraphQL mocks with correct chain and account data', async () => {
      setupGraphQLMocks();

      const response = (await graphqlClient.request(
        'query { test }'
      )) as MockResponse;

      // Verify the mock response structure
      expect(response).toHaveProperty('allocator.supportedChains.items');
      expect(response).toHaveProperty('accountDeltas.items');
      expect(response).toHaveProperty('account.resourceLocks.items');
      expect(response).toHaveProperty('account.claims.items');

      // Verify the chain data
      expect(response.allocator.supportedChains.items[0]).toEqual(
        expect.objectContaining({
          chainId: '1',
          allocatorId: expect.any(String),
        })
      );

      // Verify the account data
      expect(response.account.resourceLocks.items[0]).toEqual(
        expect.objectContaining({
          withdrawalStatus: 0,
          balance: '1000000000000000000000',
        })
      );
    });

    it('should handle different query types correctly', async () => {
      setupGraphQLMocks();

      // Test GetSupportedChains query
      const chainsResponse = (await graphqlClient.request(
        'query GetSupportedChains { test }'
      )) as MockResponse;
      expect(chainsResponse.allocator.supportedChains.items).toBeDefined();

      // Test GetDetails query
      const detailsResponse = (await graphqlClient.request(
        'query GetDetails { test }'
      )) as MockResponse;
      expect(detailsResponse.account.resourceLocks.items).toBeDefined();
    });

    it('should track request calls correctly', async () => {
      setupGraphQLMocks();
      expect(getRequestCallCount()).toBe(0);

      await graphqlClient.request('query { test }');
      expect(getRequestCallCount()).toBe(1);

      await graphqlClient.request('query { test }');
      expect(getRequestCallCount()).toBe(2);
    });

    it('should handle failure mode correctly', async () => {
      setupGraphQLMocks();
      setMockToFail(true);

      await expect(graphqlClient.request('query { test }')).rejects.toThrow(
        'Network error'
      );
    });

    it('should calculate ALLOCATOR_ID correctly from TEST_LOCK_ID', async () => {
      setupGraphQLMocks();
      const response = (await graphqlClient.request(
        'query { test }'
      )) as MockResponse;
      const allocatorId =
        response.allocator.supportedChains.items[0].allocatorId;

      // The allocatorId should be derived from TEST_LOCK_ID according to the formula:
      // ((TEST_LOCK_ID >> 160) & ((1 << 92) - 1))
      const TEST_LOCK_ID = BigInt(
        '0x7000000000000000000000010000000000000000000000000000000000000000'
      );
      const expectedAllocatorId = (
        (TEST_LOCK_ID >> BigInt(160)) &
        ((BigInt(1) << BigInt(92)) - BigInt(1))
      ).toString();

      expect(allocatorId).toBe(expectedAllocatorId);
    });

    it('should reset request count when re-initializing mocks', () => {
      setupGraphQLMocks();
      graphqlClient.request('query { test }');
      expect(getRequestCallCount()).toBe(1);

      setupGraphQLMocks(); // Re-initialize
      expect(getRequestCallCount()).toBe(0);
    });

    it('should reset failure mode when re-initializing mocks', async () => {
      setupGraphQLMocks();
      setMockToFail(true);

      setupGraphQLMocks(); // Re-initialize

      // Should not throw since failure mode should be reset
      await expect(
        graphqlClient.request('query { test }')
      ).resolves.toBeDefined();
    });
  });
});

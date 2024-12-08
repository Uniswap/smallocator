import { PGlite } from '@electric-sql/pglite';
import { getAllocatedBalance } from '../balance.js';
import { chainConfig } from '../chain-config.js';

describe('Balance Functions', () => {
  let db: PGlite;
  let originalNow: () => number;
  let originalFinalizationThresholds: Record<string, number>;
  const mockTimestampMs = 1700000000000; // Fixed timestamp for testing
  const mockTimestampSec = Math.floor(mockTimestampMs / 1000);
  const chainId = '10';
  const mockFinalizationThreshold = 5; // Fixed finalization threshold for testing

  beforeAll(async () => {
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

  beforeEach(async () => {
    // Store original values
    originalNow = Date.now;
    originalFinalizationThresholds = { ...chainConfig.finalizationThresholds };

    // Mock functions and values
    Date.now = (): number => mockTimestampMs;
    chainConfig.finalizationThresholds = {
      ...chainConfig.finalizationThresholds,
      [chainId]: mockFinalizationThreshold,
    };

    // Clear test data
    await db.query('DELETE FROM compacts');

    // Insert test compacts
    const testData = [
      // Active compact (not expired)
      {
        id: '1',
        chain_id: '10',
        claim_hash: '0x1000000000000000000000000000000000000000000000000000000000000001',
        arbiter: '0x1230000000000000000000000000000000000123',
        sponsor: '0x4560000000000000000000000000000000000456',
        nonce: '1',
        expires: (mockTimestampSec + 3600).toString(), // Expires in 1 hour
        compact_id: '123000',
        amount: '1000',
        signature: '0x1234',
      },
      // Not fully expired compact (within finalization threshold)
      {
        id: '2',
        chain_id: '10',
        claim_hash: '0x2000000000000000000000000000000000000000000000000000000000000002',
        arbiter: '0x1230000000000000000000000000000000000123',
        sponsor: '0x4560000000000000000000000000000000000456',
        nonce: '2',
        expires: (mockTimestampSec - 2).toString(), // Expired 2 seconds ago (within 5s threshold)
        compact_id: '123000',
        amount: '2000',
        signature: '0x5678',
      },
      // Truly expired compact
      {
        id: '3',
        chain_id: '10',
        claim_hash: '0x3000000000000000000000000000000000000000000000000000000000000003',
        arbiter: '0x1230000000000000000000000000000000000123',
        sponsor: '0x4560000000000000000000000000000000000456',
        nonce: '3',
        expires: (mockTimestampSec - 10).toString(), // Expired 10 seconds ago (beyond 5s threshold)
        compact_id: '123000',
        amount: '3000',
        signature: '0x9abc',
      },
    ];

    for (const compact of testData) {
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
          compact.id,
          compact.chain_id,
          compact.claim_hash,
          compact.arbiter,
          compact.sponsor,
          compact.nonce,
          compact.expires,
          compact.compact_id,
          compact.amount,
          compact.signature,
        ]
      );
    }
  });

  afterEach(() => {
    // Restore original values
    Date.now = originalNow;
    chainConfig.finalizationThresholds = originalFinalizationThresholds;
  });

  afterAll(async () => {
    // Clean up
    await db.query('DROP TABLE IF EXISTS compacts');
  });

  it('should calculate allocated balance correctly with no processed claims', async () => {
    const balance = await getAllocatedBalance(
      db,
      '0x4560000000000000000000000000000000000456',
      '10',
      '123000',
      []
    );

    // Should include both active and not-fully-expired compacts (1000 + 2000)
    expect(balance).toBe(BigInt(3000));
  });

  it('should exclude processed claims from allocated balance', async () => {
    const balance = await getAllocatedBalance(
      db,
      '0x4560000000000000000000000000000000000456',
      '10',
      '123000',
      ['0x1000000000000000000000000000000000000000000000000000000000000001'] // Processed claim for the active compact
    );

    // Should only include the not-fully-expired compact (2000)
    expect(balance).toBe(BigInt(2000));
  });

  it('should return zero for all processed or expired claims', async () => {
    const balance = await getAllocatedBalance(
      db,
      '0x4560000000000000000000000000000000000456',
      '10',
      '123000',
      [
        '0x1000000000000000000000000000000000000000000000000000000000000001',
        '0x2000000000000000000000000000000000000000000000000000000000000002',
      ] // All non-expired compacts processed
    );

    expect(balance).toBe(BigInt(0));
  });

  it('should handle non-existent sponsor', async () => {
    const balance = await getAllocatedBalance(
      db,
      '0x7890000000000000000000000000000000000789', // Non-existent sponsor
      '10',
      '123000',
      []
    );

    expect(balance).toBe(BigInt(0));
  });

  it('should handle non-existent lock ID', async () => {
    const balance = await getAllocatedBalance(
      db,
      '0x4560000000000000000000000000000000000456',
      '10',
      '456000', // Non-existent lock
      []
    );

    expect(balance).toBe(BigInt(0));
  });
});

import { PGlite } from '@electric-sql/pglite';
import {
  graphqlClient,
  AllocatorResponse,
  AccountDeltasResponse,
  AccountResponse,
  GET_COMPACT_DETAILS,
} from '../../../graphql';

export async function setupCompactTestDb(): Promise<PGlite> {
  const db = new PGlite();

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

  return db;
}

export function cleanupCompactTestDb(db: PGlite): Promise<void> {
  return Promise.all([
    db.query('DROP TABLE IF EXISTS compacts'),
    db.query('DROP TABLE IF EXISTS nonces'),
  ]).then(() => undefined);
}

export function mockGraphQLResponse(): void {
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
}

describe('Compact Test Setup', () => {
  let db: PGlite;
  let originalRequest: typeof graphqlClient.request;

  beforeAll(async () => {
    db = await setupCompactTestDb();
  });

  afterAll(async () => {
    await cleanupCompactTestDb(db);
  });

  beforeEach(() => {
    originalRequest = graphqlClient.request;
  });

  afterEach(() => {
    graphqlClient.request = originalRequest;
  });

  it('should mock GraphQL response with expected structure', async () => {
    // Setup mock
    mockGraphQLResponse();

    // Make request with required variables
    const response = await graphqlClient.request(GET_COMPACT_DETAILS, {
      allocator: '0x1234567890123456789012345678901234567890',
      sponsor: '0x2345678901234567890123456789012345678901',
      lockId: '1',
      chainId: '1',
      finalizationTimestamp: '1700000000',
      thresholdTimestamp: '1700000000',
    });

    // Verify response structure and values
    expect(response).toEqual({
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

  it('should create required database tables', async () => {
    // Check if tables exist and have correct structure
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableNames = tables.rows.map((row) => row.table_name);

    expect(tableNames).toContain('compacts');
    expect(tableNames).toContain('nonces');

    // Verify table structure
    const compactColumns = await db.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'compacts'"
    );
    const compactColumnNames = compactColumns.rows.map(
      (row) => row.column_name
    );
    expect(compactColumnNames).toContain('claim_hash');
    expect(compactColumnNames).toContain('arbiter');
    expect(compactColumnNames).toContain('sponsor');
    expect(compactColumnNames).toContain('nonce');
  });
});

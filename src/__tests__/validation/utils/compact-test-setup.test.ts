import { PGlite } from '@electric-sql/pglite';
import {
  graphqlClient,
  GET_COMPACT_DETAILS,
  AccountDeltasResponse,
  AccountResponse,
} from '../../../graphql';
import {
  setupCompactTestDb,
  cleanupCompactTestDb,
  setupGraphQLMocks,
} from './compact-test-setup';

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
    setupGraphQLMocks();
  });

  afterEach(() => {
    graphqlClient.request = originalRequest;
  });

  it('should mock GraphQL response with expected structure', async () => {
    // Make request with required variables
    const response = await graphqlClient.request<AccountDeltasResponse & AccountResponse>(
      GET_COMPACT_DETAILS,
      {
        allocator: '0x1234567890123456789012345678901234567890',
        sponsor: '0x2345678901234567890123456789012345678901',
        lockId: '1',
        chainId: '1',
        finalizationTimestamp: '1700000000',
        thresholdTimestamp: '1700000000',
      }
    );

    // Verify response structure and values
    expect(response.account.resourceLocks.items[0]).toEqual({
      withdrawalStatus: 0,
      balance: '1000000000000000000000',
    });
    expect(response.accountDeltas.items).toEqual([]);
    expect(response.account.claims.items).toEqual([]);
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

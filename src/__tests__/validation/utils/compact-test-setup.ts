import { PGlite } from '@electric-sql/pglite';
import {
  graphqlClient,
  SupportedChainsResponse,
  AccountDeltasResponse,
  AccountResponse,
} from '../../../graphql';

// Extract allocator ID from lockId (matches the calculation in balance.ts)
const TEST_LOCK_ID = BigInt('0x7000000000000000000000010000000000000000000000000000000000000000');
const ALLOCATOR_ID = ((TEST_LOCK_ID >> BigInt(160)) & ((BigInt(1) << BigInt(92)) - BigInt(1))).toString();

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

// Track request calls
let requestCallCount = 0;
let shouldFail = false;

export function setupGraphQLMocks(): void {
  requestCallCount = 0;
  shouldFail = false;

  // Override the request method of the GraphQL client
  (graphqlClient as any).request = async (
    query: string,
    variables: Record<string, any>
  ): Promise<SupportedChainsResponse & AccountDeltasResponse & AccountResponse> => {
    requestCallCount++;
    
    if (shouldFail) {
      throw new Error('Network error');
    }

    return {
      allocator: {
        supportedChains: {
          items: [{ chainId: '1', allocatorId: ALLOCATOR_ID }], // Match the test compact ID
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
    };
  };
}

// Get the number of times request was called
export function getRequestCallCount(): number {
  return requestCallCount;
}

// Set the mock to fail on next request
export function setMockToFail(fail: boolean = true): void {
  shouldFail = fail;
}

import { validateCompact } from '../../validation/compact';
import { getFreshCompact } from '../utils/test-server';
import { PGlite } from '@electric-sql/pglite';
import { graphqlClient } from '../../graphql';
import {
  setupCompactTestDb,
  cleanupCompactTestDb,
  mockGraphQLResponse,
} from './utils/compact-test-setup';

describe('Compact Basic Validation', () => {
  let db: PGlite;
  let originalRequest: typeof graphqlClient.request;

  beforeAll(async (): Promise<void> => {
    db = await setupCompactTestDb();
  });

  afterAll(async (): Promise<void> => {
    await cleanupCompactTestDb(db);
  });

  beforeEach((): void => {
    originalRequest = graphqlClient.request;
    mockGraphQLResponse(originalRequest);
  });

  afterEach((): void => {
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

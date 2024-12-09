import { validateCompact } from '../../validation/compact';
import { getFreshCompact, compactToAPI } from '../utils/test-server';
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
    mockGraphQLResponse();
  });

  afterEach((): void => {
    graphqlClient.request = originalRequest;
  });

  it('should validate correct compact with decimal inputs', async (): Promise<void> => {
    const result = await validateCompact(
      compactToAPI(getFreshCompact()),
      '1',
      db
    );
    expect(result.isValid).toBe(true);
  });

  it('should validate correct compact with hex inputs', async (): Promise<void> => {
    const freshCompact = getFreshCompact();
    const hexCompact = {
      ...compactToAPI(freshCompact),
      id: '0x' + freshCompact.id.toString(16),
      expires: '0x' + freshCompact.expires.toString(16),
      amount: '0x' + BigInt(freshCompact.amount).toString(16),
      nonce: freshCompact.nonce ? '0x' + freshCompact.nonce.toString(16) : null,
    };
    const result = await validateCompact(hexCompact, '1', db);
    expect(result.isValid).toBe(true);
  });

  it('should validate correct compact with mixed decimal and hex inputs', async (): Promise<void> => {
    const freshCompact = getFreshCompact();
    const mixedCompact = {
      ...compactToAPI(freshCompact),
      id: '0x' + freshCompact.id.toString(16),
      expires: freshCompact.expires.toString(),
      amount: '0x' + BigInt(freshCompact.amount).toString(16),
      nonce: freshCompact.nonce ? freshCompact.nonce.toString() : null,
    };
    const result = await validateCompact(mixedCompact, '1', db);
    expect(result.isValid).toBe(true);
  });

  it('should reject invalid hex format', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      id: '0xInvalidHex',
    };
    const result = await validateCompact(invalidCompact, '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Failed to convert id');
  });

  it('should reject invalid arbiter address', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      arbiter: 'invalid-address',
    };
    const result = await validateCompact(invalidCompact, '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid arbiter address');
  });

  it('should reject invalid sponsor address', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      sponsor: 'invalid-address',
    };
    const result = await validateCompact(invalidCompact, '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should reject invalid expires timestamp', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      expires: '-1',
    };
    const result = await validateCompact(invalidCompact, '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should reject invalid amount', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      amount: '-1',
    };
    const result = await validateCompact(invalidCompact, '1', db);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should reject invalid chain id', async (): Promise<void> => {
    const result = await validateCompact(
      compactToAPI(getFreshCompact()),
      'invalid',
      db
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid chain ID');
  });
});

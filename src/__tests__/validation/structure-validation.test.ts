import { validateStructure } from '../../validation/structure';
import { getFreshCompact, compactToAPI } from '../utils/test-server';

describe('Structure Validation', () => {
  it('should validate correct compact structure', async (): Promise<void> => {
    const compact = compactToAPI(getFreshCompact());
    const result = await validateStructure(compact);
    expect(result.isValid).toBe(true);
  });

  it('should reject invalid arbiter address', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      arbiter: 'invalid-address',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid arbiter address');
  });

  it('should reject invalid sponsor address', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      sponsor: 'invalid-address',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid arbiter address');
  });

  it('should reject negative expires timestamp', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      expires: '-1',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('must be a positive number');
  });

  it('should reject zero expires timestamp', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      expires: '0',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('must be a positive number');
  });

  it('should reject negative id', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      id: '-1',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('must be a positive number');
  });

  it('should reject zero id', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      id: '0',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('must be a positive number');
  });

  it('should reject invalid amount format', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      amount: '-1',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('must be a positive number');
  });

  it('should reject non-numeric amount', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      amount: 'abc',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Failed to convert amount');
  });

  it('should reject witness type without hash', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      witnessTypeString: 'type',
      witnessHash: null,
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(
      'Witness type and hash must both be present or both be null'
    );
  });

  it('should reject witness hash without type', async (): Promise<void> => {
    const invalidCompact = {
      ...compactToAPI(getFreshCompact()),
      witnessTypeString: null,
      witnessHash: '0x1234',
    };
    const result = await validateStructure(invalidCompact);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(
      'Witness type and hash must both be present or both be null'
    );
  });

  it('should accept both witness fields as null', async (): Promise<void> => {
    const validCompact = {
      ...compactToAPI(getFreshCompact()),
      witnessTypeString: null,
      witnessHash: null,
    };
    const result = await validateStructure(validCompact);
    expect(result.isValid).toBe(true);
  });

  it('should accept both witness fields as present', async (): Promise<void> => {
    const validCompact = {
      ...compactToAPI(getFreshCompact()),
      witnessTypeString: 'type',
      witnessHash: '0x1234',
    };
    const result = await validateStructure(validCompact);
    expect(result.isValid).toBe(true);
  });

  // New tests for hex input support
  it('should accept hex format id', async (): Promise<void> => {
    const validCompact = {
      ...compactToAPI(getFreshCompact()),
      id: '0x123',
    };
    const result = await validateStructure(validCompact);
    expect(result.isValid).toBe(true);
  });

  it('should accept hex format amount', async (): Promise<void> => {
    const validCompact = {
      ...compactToAPI(getFreshCompact()),
      amount: '0x123',
    };
    const result = await validateStructure(validCompact);
    expect(result.isValid).toBe(true);
  });

  it('should accept hex format expires', async (): Promise<void> => {
    const validCompact = {
      ...compactToAPI(getFreshCompact()),
      expires: '0x123',
    };
    const result = await validateStructure(validCompact);
    expect(result.isValid).toBe(true);
  });

  it('should accept hex format nonce', async (): Promise<void> => {
    const validCompact = {
      ...compactToAPI(getFreshCompact()),
      nonce: '0x123',
    };
    const result = await validateStructure(validCompact);
    expect(result.isValid).toBe(true);
  });
});

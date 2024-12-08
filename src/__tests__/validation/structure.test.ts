import {
  validateStructure,
  validateExpiration,
} from '../../validation/structure';
import { getFreshCompact } from '../utils/test-server';

describe('Structure Validation', () => {
  describe('validateStructure', () => {
    it('should validate correct compact structure', async (): Promise<void> => {
      const compact = getFreshCompact();
      const result = await validateStructure(compact);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid arbiter address', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        arbiter: 'invalid-address',
      };
      const result = await validateStructure(invalidCompact);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid arbiter address');
    });

    it('should reject invalid sponsor address', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        sponsor: 'invalid-address',
      };
      const result = await validateStructure(invalidCompact);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid arbiter address');
    });

    it('should reject negative expires timestamp', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        expires: BigInt(-1),
      };
      const result = await validateStructure(invalidCompact);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid expires timestamp');
    });

    it('should reject zero expires timestamp', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        expires: BigInt(0),
      };
      const result = await validateStructure(invalidCompact);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid expires timestamp');
    });

    it('should reject negative id', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        id: BigInt(-1),
      };
      const result = await validateStructure(invalidCompact);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid id');
    });

    it('should reject zero id', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        id: BigInt(0),
      };
      const result = await validateStructure(invalidCompact);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid id');
    });

    it('should reject invalid amount format', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        amount: '-1',
      };
      const result = await validateStructure(invalidCompact);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid amount format');
    });

    it('should reject non-numeric amount', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
        amount: 'abc',
      };
      const result = await validateStructure(invalidCompact);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid amount format');
    });

    it('should reject witness type without hash', async (): Promise<void> => {
      const invalidCompact = {
        ...getFreshCompact(),
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
        ...getFreshCompact(),
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
        ...getFreshCompact(),
        witnessTypeString: null,
        witnessHash: null,
      };
      const result = await validateStructure(validCompact);
      expect(result.isValid).toBe(true);
    });

    it('should accept both witness fields as present', async (): Promise<void> => {
      const validCompact = {
        ...getFreshCompact(),
        witnessTypeString: 'type',
        witnessHash: '0x1234',
      };
      const result = await validateStructure(validCompact);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateExpiration', () => {
    let originalDateNow: () => number;

    beforeEach(() => {
      originalDateNow = Date.now;
      // Set a fixed timestamp for all tests
      Date.now = () => 1700000000000;
    });

    afterEach(() => {
      Date.now = originalDateNow;
    });

    it('should validate expiration within 2 hours', (): void => {
      const oneHourFromNow = BigInt(1700000000 + 3600);
      const result = validateExpiration(oneHourFromNow);
      expect(result.isValid).toBe(true);
    });

    it('should reject expired timestamp', (): void => {
      const oneHourAgo = BigInt(1700000000 - 3600);
      const result = validateExpiration(oneHourAgo);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Compact has expired');
    });

    it('should reject current timestamp', (): void => {
      const currentTime = BigInt(1700000000);
      const result = validateExpiration(currentTime);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Compact has expired');
    });

    it('should reject expiration more than 2 hours in future', (): void => {
      const threeHoursFromNow = BigInt(1700000000 + 10800);
      const result = validateExpiration(threeHoursFromNow);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Expiration must be within 2 hours');
    });

    it('should accept expiration exactly 2 hours in future', (): void => {
      const twoHoursFromNow = BigInt(1700000000 + 7200);
      const result = validateExpiration(twoHoursFromNow);
      expect(result.isValid).toBe(true);
    });
  });
});

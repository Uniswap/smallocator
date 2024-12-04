import { validateDomainAndId, validateCompact } from '../validation';
import { validCompact } from './utils/test-server';

describe('Validation', () => {
  describe('validateDomainAndId', () => {
    it('should validate correct id and chain', async () => {
      const id = BigInt(1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = '1';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(id, expires, chainId, allocatorAddress);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid id', async () => {
      const id = BigInt(-1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = '1';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(id, expires, chainId, allocatorAddress);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid ID');
    });

    it('should reject invalid chain id', async () => {
      const id = BigInt(1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = 'invalid';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(id, expires, chainId, allocatorAddress);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid chain ID');
    });
  });

  describe('validateCompact', () => {
    it('should validate correct compact', async () => {
      const result = await validateCompact(validCompact, '1');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid arbiter address', async () => {
      const invalidCompact = {
        ...validCompact,
        arbiter: 'invalid-address',
      };
      const result = await validateCompact(invalidCompact, '1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject invalid sponsor address', async () => {
      const invalidCompact = {
        ...validCompact,
        sponsor: 'invalid-address',
      };
      const result = await validateCompact(invalidCompact, '1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject invalid expires timestamp', async () => {
      const invalidCompact = {
        ...validCompact,
        expires: BigInt(-1),
      };
      const result = await validateCompact(invalidCompact, '1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject invalid amount', async () => {
      const invalidCompact = {
        ...validCompact,
        amount: '-1',
      };
      const result = await validateCompact(invalidCompact, '1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject invalid chain id', async () => {
      const result = await validateCompact(validCompact, 'invalid');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid chain ID');
    });
  });
});

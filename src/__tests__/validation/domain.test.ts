import { validateDomainAndId } from '../../validation/domain';

describe('Domain Validation', () => {
  describe('validateDomainAndId', () => {
    it('should validate correct id and chain', async (): Promise<void> => {
      const id = BigInt(1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = '1';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(
        id,
        expires,
        chainId,
        allocatorAddress
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid id', async (): Promise<void> => {
      const id = BigInt(-1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = '1';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(
        id,
        expires,
        chainId,
        allocatorAddress
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid ID');
    });

    it('should reject invalid chain id', async (): Promise<void> => {
      const id = BigInt(1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = 'invalid';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      const result = await validateDomainAndId(
        id,
        expires,
        chainId,
        allocatorAddress
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid chain ID');
    });
  });
});

import { validateDomainAndId, validateCompact } from '../validation';
import { validCompact } from './utils/test-server';

describe('Validation', () => {
  describe('validateDomainAndId', () => {
    it('should validate correct id and chain', () => {
      const id = BigInt(1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = '1';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      expect(() =>
        validateDomainAndId(id, expires, chainId, allocatorAddress)
      ).not.toThrow();
    });

    it('should throw on invalid id', () => {
      const id = BigInt(-1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = '1';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      expect(() =>
        validateDomainAndId(id, expires, chainId, allocatorAddress)
      ).toThrow();
    });

    it('should throw on invalid chain id', () => {
      const id = BigInt(1);
      const expires = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const chainId = 'invalid';
      const allocatorAddress = '0x2345678901234567890123456789012345678901';

      expect(() =>
        validateDomainAndId(id, expires, chainId, allocatorAddress)
      ).toThrow();
    });
  });

  describe('validateCompact', () => {
    it('should validate correct compact', () => {
      expect(() => validateCompact(validCompact, '1')).not.toThrow();
    });

    it('should throw on invalid arbiter address', () => {
      const invalidCompact = {
        ...validCompact,
        arbiter: 'invalid-address',
      };
      expect(() => validateCompact(invalidCompact, '1')).toThrow();
    });

    it('should throw on invalid sponsor address', () => {
      const invalidCompact = {
        ...validCompact,
        sponsor: 'invalid-address',
      };
      expect(() => validateCompact(invalidCompact, '1')).toThrow();
    });

    it('should throw on invalid expires timestamp', () => {
      const invalidCompact = {
        ...validCompact,
        expires: BigInt(-1),
      };
      expect(() => validateCompact(invalidCompact, '1')).toThrow();
    });

    it('should throw on invalid amount', () => {
      const invalidCompact = {
        ...validCompact,
        amount: '-1',
      };
      expect(() => validateCompact(invalidCompact, '1')).toThrow();
    });

    it('should throw on invalid chain id', () => {
      expect(() => validateCompact(validCompact, 'invalid')).toThrow();
    });
  });
});

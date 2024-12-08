import {
  byteaToAddress,
  addressToBytes,
  toBigInt,
  toPositiveBigInt,
} from '../../utils/encoding';

describe('Encoding Utils', () => {
  describe('byteaToAddress', () => {
    it('should convert bytea to checksummed address', () => {
      const bytes = new Uint8Array([
        0x70, 0x99, 0x79, 0x70, 0xc5, 0x18, 0x12, 0xdc, 0x3a, 0x01, 0x0c, 0x7d,
        0x01, 0xb5, 0x0e, 0x0d, 0x17, 0xdc, 0x79, 0xc8,
      ]);
      const expected = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      expect(byteaToAddress(bytes)).toBe(expected);
    });
  });

  describe('addressToBytes', () => {
    it('should convert address to bytea', () => {
      const address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const bytes = addressToBytes(address);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(20); // Ethereum addresses are 20 bytes
      expect(byteaToAddress(bytes)).toBe(address); // Round trip test
    });

    it('should handle lowercase addresses', () => {
      const address = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
      const bytes = addressToBytes(address);
      expect(byteaToAddress(bytes)).toBe(address.toLowerCase());
    });
  });

  describe('toBigInt', () => {
    it('should convert decimal strings', () => {
      expect(toBigInt('123456789', 'test')).toBe(BigInt('123456789'));
      expect(toBigInt('0', 'test')).toBe(BigInt(0));
    });

    it('should convert hex strings', () => {
      expect(toBigInt('0x1234', 'test')).toBe(BigInt('0x1234'));
      expect(toBigInt('0xff', 'test')).toBe(BigInt(255));
    });

    it('should handle null values', () => {
      expect(toBigInt(null, 'test')).toBeNull();
    });

    it('should reject negative numbers', () => {
      expect(() => toBigInt('-123', 'test')).toThrow(
        'test must be a positive number'
      );
    });

    it('should reject decimal points', () => {
      expect(() => toBigInt('123.45', 'test')).toThrow(
        'test must be an integer'
      );
    });

    it('should reject invalid formats', () => {
      expect(() => toBigInt('abc', 'test')).toThrow('Invalid test format');
      expect(() => toBigInt('12x34', 'test')).toThrow('Invalid test format');
    });

    it('should handle large numbers', () => {
      const largeHex = '0x1234567890abcdef1234567890abcdef1234567890abcdef';
      const largeDecimal = '123456789012345678901234567890';
      expect(toBigInt(largeHex, 'test')).toBe(BigInt(largeHex));
      expect(toBigInt(largeDecimal, 'test')).toBe(BigInt(largeDecimal));
    });
  });

  describe('toPositiveBigInt', () => {
    it('should convert positive numbers', () => {
      expect(toPositiveBigInt('123', 'test')).toBe(BigInt(123));
      expect(toPositiveBigInt('0xff', 'test')).toBe(BigInt(255));
    });

    it('should reject zero', () => {
      expect(() => toPositiveBigInt('0', 'test')).toThrow(
        'test must be a positive number'
      );
      expect(() => toPositiveBigInt('0x0', 'test')).toThrow(
        'test must be a positive number'
      );
    });

    it('should reject negative numbers', () => {
      expect(() => toPositiveBigInt('-1', 'test')).toThrow(
        'test must be a positive number'
      );
      expect(() => toPositiveBigInt('-0x1', 'test')).toThrow(
        'test must be a positive number'
      );
    });

    it('should handle large positive numbers', () => {
      const largeHex = '0x1234567890abcdef';
      const largeDecimal = '1234567890123456789';
      expect(toPositiveBigInt(largeHex, 'test')).toBe(BigInt(largeHex));
      expect(toPositiveBigInt(largeDecimal, 'test')).toBe(BigInt(largeDecimal));
    });

    it('should reject invalid formats', () => {
      expect(() => toPositiveBigInt('abc', 'test')).toThrow(
        'Invalid test format'
      );
      expect(() => toPositiveBigInt('12.34', 'test')).toThrow(
        'test must be an integer'
      );
    });
  });
});

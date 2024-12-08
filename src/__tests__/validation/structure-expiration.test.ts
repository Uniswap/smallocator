import { validateExpiration } from '../../validation/structure';

describe('Expiration Validation', () => {
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

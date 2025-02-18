import { getFinalizationThreshold, chainConfig } from '../chain-config';

describe('Chain Configuration', () => {
  it('should return correct finalization threshold for known chains', () => {
    expect(getFinalizationThreshold('1')).toBe(25); // Ethereum Mainnet
    expect(getFinalizationThreshold('10')).toBe(4); // Optimism
    expect(getFinalizationThreshold('8453')).toBe(2); // Base
    expect(getFinalizationThreshold('130')).toBe(2); // Unichain
  });

  it('should return default finalization threshold for unknown chains', () => {
    expect(getFinalizationThreshold('123')).toBe(
      chainConfig.defaultFinalizationThreshold
    );
    expect(getFinalizationThreshold('999')).toBe(
      chainConfig.defaultFinalizationThreshold
    );
  });

  it('should have valid configuration values', () => {
    // All thresholds should be positive numbers
    expect(chainConfig.defaultFinalizationThreshold).toBeGreaterThan(0);

    Object.entries(chainConfig.finalizationThresholds).forEach(
      ([_chainId, threshold]) => {
        expect(Number.isInteger(threshold)).toBe(true);
        expect(threshold).toBeGreaterThan(0);
      }
    );
  });
});

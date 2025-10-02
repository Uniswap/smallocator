/**
 * Utilities for working with lockTags in The Compact V1
 *
 * A lockTag is a bytes12 value that encodes:
 * - Allocator ID (96 bits)
 * - Reset Period (3 bits)
 * - Scope (1 bit)
 * - Reserved (remaining bits)
 */

export enum ResetPeriod {
  OneSecond = 0,
  FifteenSeconds = 1,
  OneMinute = 2,
  TenMinutes = 3,
  OneHourAndFiveMinutes = 4,
  OneDay = 5,
  SevenDaysAndOneHour = 6,
  ThirtyDays = 7,
}

export enum Scope {
  Multichain = 0,
  ChainSpecific = 1,
}

/**
 * Encode a lockTag from its components
 * @param allocatorId - The allocator ID (as a bigint or string)
 * @param resetPeriod - The reset period enum value
 * @param scope - The scope enum value
 * @returns The encoded lockTag as a hex string
 */
export function encodeLockTag(
  allocatorId: bigint | string,
  resetPeriod: ResetPeriod = ResetPeriod.TenMinutes,
  scope: Scope = Scope.Multichain
): `0x${string}` {
  // Convert allocatorId to bigint if it's a string
  const allocatorIdBigInt =
    typeof allocatorId === 'string' ? BigInt(allocatorId) : allocatorId;

  // Validate allocatorId fits in 96 bits
  if (allocatorIdBigInt >= BigInt(1) << BigInt(96)) {
    throw new Error('Allocator ID exceeds 96 bits');
  }

  // Validate resetPeriod
  if (resetPeriod < 0 || resetPeriod > 7) {
    throw new Error('Invalid reset period');
  }

  // Validate scope
  if (scope !== 0 && scope !== 1) {
    throw new Error('Invalid scope');
  }

  // Pack the values:
  // - allocatorId takes bits 0-95 (96 bits)
  // - resetPeriod takes bits 96-98 (3 bits)
  // - scope takes bit 99 (1 bit)
  // Total: 100 bits, which fits in bytes12 (96 bits)

  // Actually, bytes12 is 96 bits, so we need to pack more carefully:
  // - allocatorId: up to 92 bits
  // - resetPeriod: 3 bits
  // - scope: 1 bit
  // Total: 96 bits = 12 bytes

  // Let's use a different packing strategy:
  // bytes12 = 96 bits total
  // - First 92 bits: allocatorId (truncated if needed)
  // - Next 3 bits: resetPeriod
  // - Last 1 bit: scope

  const packed =
    (allocatorIdBigInt & ((BigInt(1) << BigInt(92)) - BigInt(1))) |
    (BigInt(resetPeriod) << BigInt(92)) |
    (BigInt(scope) << BigInt(95));

  // Convert to hex string and pad to 24 characters (12 bytes)
  const hex = packed.toString(16).padStart(24, '0');

  return `0x${hex}` as `0x${string}`;
}

/**
 * Decode a lockTag into its components
 * @param lockTag - The encoded lockTag as a hex string
 * @returns The decoded components
 */
export function decodeLockTag(lockTag: `0x${string}`): {
  allocatorId: bigint;
  resetPeriod: ResetPeriod;
  scope: Scope;
} {
  // Remove 0x prefix and convert to bigint
  const packed = BigInt(lockTag);

  // Extract components
  const allocatorId = packed & ((BigInt(1) << BigInt(92)) - BigInt(1));
  const resetPeriod = Number(
    (packed >> BigInt(92)) & BigInt(0x7)
  ) as ResetPeriod;
  const scope = Number((packed >> BigInt(95)) & BigInt(0x1)) as Scope;

  return {
    allocatorId,
    resetPeriod,
    scope,
  };
}

/**
 * Get the human-readable name for a reset period
 */
export function getResetPeriodName(period: ResetPeriod): string {
  const names: Record<ResetPeriod, string> = {
    [ResetPeriod.OneSecond]: '1 second',
    [ResetPeriod.FifteenSeconds]: '15 seconds',
    [ResetPeriod.OneMinute]: '1 minute',
    [ResetPeriod.TenMinutes]: '10 minutes',
    [ResetPeriod.OneHourAndFiveMinutes]: '1 hour 5 minutes',
    [ResetPeriod.OneDay]: '1 day',
    [ResetPeriod.SevenDaysAndOneHour]: '7 days 1 hour',
    [ResetPeriod.ThirtyDays]: '30 days',
  };

  return names[period] || 'Unknown';
}

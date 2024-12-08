import { getAddress, hexToBytes } from 'viem/utils';

// Helper to convert bytea to checksummed address
export function byteaToAddress(bytes: Uint8Array): string {
  return getAddress('0x' + Buffer.from(bytes).toString('hex'));
}

// Helper to convert address to bytea
export function addressToBytes(address: string): Uint8Array {
  return hexToBytes(address as `0x${string}`);
}

/**
 * Converts a numeric string or hex string to a BigInt.
 * Accepts inputs like "1234567890" or "0x123abc"
 * @param value The value to convert
 * @param fieldName The name of the field (for error messages)
 * @returns BigInt representation of the value
 */
export function toBigInt(
  value: string | null,
  fieldName: string
): bigint | null {
  if (value === null) return null;

  try {
    // Handle hex strings (with or without 0x prefix)
    if (value.toLowerCase().startsWith('0x')) {
      return BigInt(value);
    }

    // Handle decimal strings
    if (/^\d+$/.test(value)) {
      return BigInt(value);
    }

    throw new Error(
      `Invalid ${fieldName} format. Must be decimal or hex string`
    );
  } catch (error) {
    throw new Error(
      `Failed to convert ${fieldName}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Validates and converts a numeric string or hex string to a BigInt.
 * Similar to toBigInt but enforces the value to be positive.
 * @param value The value to convert
 * @param fieldName The name of the field (for error messages)
 * @returns BigInt representation of the value
 */
export function toPositiveBigInt(value: string, fieldName: string): bigint {
  const result = toBigInt(value, fieldName);
  if (result === null || result <= BigInt(0)) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return result;
}

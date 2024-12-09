// Define the Hex type since it's no longer exported from viem/utils
type Hex = `0x${string}`;

import { getAddress, hexToBytes, toHex, numberToHex } from 'viem/utils';

/**
 * Convert a string or bigint value to a 32-byte array.
 */
export function toBytes32(value: string | bigint): Uint8Array {
  const hex =
    typeof value === 'string' ? value : numberToHex(value, { size: 32 });
  // Use toHex to ensure proper typing
  return hexToBytes(toHex(hex.startsWith('0x') ? hex : `0x${hex}`));
}

/**
 * Convert a bytes32 value to a hex string with 0x prefix
 */
export function fromBytes32ToHex(bytes: Uint8Array): Hex {
  if (bytes.length !== 32) {
    throw new Error('Input must be 32 bytes');
  }
  return toHex(bytes) as Hex;
}

/**
 * Convert a bytes32 value to a decimal string
 */
export function fromBytes32ToDecimal(bytes: Uint8Array): string {
  if (bytes.length !== 32) {
    throw new Error('Input must be 32 bytes');
  }
  return BigInt(toHex(bytes)).toString();
}

/**
 * Convert an Ethereum address string to bytes20
 * Accepts addresses with or without 0x prefix
 */
export function addressToBytes(address: string): Uint8Array {
  try {
    // First normalize the address using viem's getAddress
    const normalizedAddress = getAddress(address);
    return hexToBytes(normalizedAddress);
  } catch {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
}

/**
 * Convert bytes20 to a checksummed Ethereum address
 */
export function bytesToAddress(bytes: Uint8Array): string {
  if (bytes.length !== 20) {
    throw new Error('Input must be 20 bytes');
  }
  return getAddress(toHex(bytes));
}

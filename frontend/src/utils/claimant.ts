/**
 * Helper functions for encoding/decoding claimant field in The Compact V1
 *
 * The claimant field is a uint256 that encodes:
 * - lockTag (12 bytes) in the higher bits
 * - recipient address (20 bytes) in the lower bits
 */

import { getAddress } from 'viem/utils';

/**
 * Encode a claimant from lockTag and recipient address
 * @param lockTag - The 12-byte lockTag (use '0x000000000000000000000000' for withdrawals)
 * @param recipient - The recipient address
 * @returns The encoded claimant as a bigint
 */
export function encodeClaimant(
  lockTag: `0x${string}`,
  recipient: `0x${string}`
): bigint {
  // Validate lockTag is 12 bytes (24 hex chars)
  const lockTagClean = lockTag.startsWith('0x') ? lockTag.slice(2) : lockTag;
  if (lockTagClean.length !== 24) {
    throw new Error(
      `Invalid lockTag length: expected 24 hex chars, got ${lockTagClean.length}`
    );
  }

  // Validate and normalize the address
  const normalizedAddress = getAddress(recipient);
  const addressClean = normalizedAddress.slice(2); // Remove 0x prefix

  // Concatenate lockTag (12 bytes) + address (20 bytes) = 32 bytes
  const combined = '0x' + lockTagClean + addressClean;

  return BigInt(combined);
}

/**
 * Decode a claimant into lockTag and recipient address
 * @param claimant - The encoded claimant as a bigint
 * @returns Object containing lockTag and recipient
 */
export function decodeClaimant(claimant: bigint): {
  lockTag: `0x${string}`;
  recipient: `0x${string}`;
} {
  // Convert to hex string, padded to 64 chars (32 bytes)
  const hex = claimant.toString(16).padStart(64, '0');

  // First 24 chars (12 bytes) are the lockTag
  const lockTag = ('0x' + hex.slice(0, 24)) as `0x${string}`;

  // Last 40 chars (20 bytes) are the address
  const recipient = getAddress('0x' + hex.slice(24)) as `0x${string}`;

  return { lockTag, recipient };
}

/**
 * Create a claimant for a withdrawal (lockTag = bytes12(0))
 * @param recipient - The recipient address
 * @returns The encoded claimant as a bigint
 */
export function encodeWithdrawalClaimant(recipient: `0x${string}`): bigint {
  return encodeClaimant('0x000000000000000000000000', recipient);
}

/**
 * Create a claimant for a transfer (using the resource lock's lockTag)
 * @param lockTag - The resource lock's lockTag
 * @param recipient - The recipient address
 * @returns The encoded claimant as a bigint
 */
export function encodeTransferClaimant(
  lockTag: `0x${string}`,
  recipient: `0x${string}`
): bigint {
  return encodeClaimant(lockTag, recipient);
}

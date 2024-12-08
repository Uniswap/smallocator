import { getAddress } from 'viem/utils';
import { ValidationResult, CompactMessage } from './types';

export async function validateStructure(
  compact: CompactMessage
): Promise<ValidationResult> {
  try {
    // Check arbiter and sponsor addresses
    try {
      getAddress(compact.arbiter);
      getAddress(compact.sponsor);
    } catch (err) {
      return {
        isValid: false,
        error: `Invalid arbiter address: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }

    // Validate numeric fields
    if (compact.expires <= BigInt(0)) {
      return { isValid: false, error: 'Invalid expires timestamp' };
    }

    if (compact.id <= BigInt(0)) {
      return { isValid: false, error: 'Invalid id' };
    }

    // Validate amount is a valid number string
    if (!/^\d+$/.test(compact.amount)) {
      return { isValid: false, error: 'Invalid amount format' };
    }

    // Check witness data consistency
    if (
      (compact.witnessTypeString === null && compact.witnessHash !== null) ||
      (compact.witnessTypeString !== null && compact.witnessHash === null)
    ) {
      return {
        isValid: false,
        error: 'Witness type and hash must both be present or both be null',
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Structural validation error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export function validateExpiration(expires: bigint): ValidationResult {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const twoHours = BigInt(7200);

  if (expires <= now) {
    return {
      isValid: false,
      error: 'Compact has expired',
    };
  }

  if (expires > now + twoHours) {
    return {
      isValid: false,
      error: 'Expiration must be within 2 hours',
    };
  }

  return { isValid: true };
}

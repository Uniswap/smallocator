import { getAddress } from 'viem/utils';
import {
  ValidationResult,
  CompactMessage,
  ValidatedCompactMessage,
} from './types';
import { toPositiveBigInt } from '../utils/encoding';

export async function validateStructure(
  compact: CompactMessage
): Promise<ValidationResult & { validatedCompact?: ValidatedCompactMessage }> {
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

    try {
      // Convert and validate id
      const id = toPositiveBigInt(compact.id, 'id');

      // Convert and validate expires
      const expires = toPositiveBigInt(compact.expires, 'expires');

      // Convert and validate amount
      const amount = toPositiveBigInt(compact.amount, 'amount');

      // Convert nonce if present
      let nonce: bigint | null = null;
      if (compact.nonce !== null) {
        nonce = toPositiveBigInt(compact.nonce, 'nonce');
      }

      // Create validated compact message
      const validatedCompact: ValidatedCompactMessage = {
        arbiter: compact.arbiter,
        sponsor: compact.sponsor,
        nonce,
        expires,
        id,
        amount: amount.toString(),
        witnessTypeString: compact.witnessTypeString,
        witnessHash: compact.witnessHash,
      };

      // Check witness data consistency
      if (
        (validatedCompact.witnessTypeString === null &&
          validatedCompact.witnessHash !== null) ||
        (validatedCompact.witnessTypeString !== null &&
          validatedCompact.witnessHash === null)
      ) {
        return {
          isValid: false,
          error: 'Witness type and hash must both be present or both be null',
        };
      }

      return { isValid: true, validatedCompact };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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

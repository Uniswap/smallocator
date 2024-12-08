import { PGlite } from '@electric-sql/pglite';
import { ValidationResult, CompactMessage } from './types';
import { validateNonce } from './nonce';
import { validateStructure, validateExpiration } from './structure';
import { validateDomainAndId } from './domain';
import { validateAllocation } from './allocation';

export async function validateCompact(
  compact: CompactMessage,
  chainId: string,
  db: PGlite
): Promise<ValidationResult> {
  try {
    // 1. Chain ID validation
    const chainIdNum = parseInt(chainId);
    if (
      isNaN(chainIdNum) ||
      chainIdNum <= 0 ||
      chainIdNum.toString() !== chainId
    ) {
      return { isValid: false, error: 'Invalid chain ID format' };
    }

    // 2. Structural Validation
    const result = await validateStructure(compact);
    if (!result.isValid) return result;

    // 3. Nonce Validation (only if nonce is provided)
    if (compact.nonce !== null) {
      const nonceResult = await validateNonce(
        compact.nonce,
        compact.sponsor,
        chainId,
        db
      );
      if (!nonceResult.isValid) return nonceResult;
    }

    // 4. Expiration Validation
    const expirationResult = validateExpiration(compact.expires);
    if (!expirationResult.isValid) return expirationResult;

    // 5. Domain and ID Validation
    const domainResult = await validateDomainAndId(
      compact.id,
      compact.expires,
      chainId,
      process.env.ALLOCATOR_ADDRESS!
    );
    if (!domainResult.isValid) return domainResult;

    // 6. Allocation Validation
    const allocationResult = await validateAllocation(compact, chainId, db);
    if (!allocationResult.isValid) return allocationResult;

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

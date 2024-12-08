import { PGlite } from '@electric-sql/pglite';
import {
  ValidationResult,
  CompactMessage,
  ValidatedCompactMessage,
} from './types';
import { validateNonce } from './nonce';
import { validateStructure, validateExpiration } from './structure';
import { validateDomainAndId } from './domain';
import { validateAllocation } from './allocation';

export async function validateCompact(
  compact: CompactMessage,
  chainId: string,
  db: PGlite
): Promise<ValidationResult & { validatedCompact?: ValidatedCompactMessage }> {
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
    const structureResult = await validateStructure(compact);
    if (!structureResult.isValid || !structureResult.validatedCompact) {
      return structureResult;
    }

    const validatedCompact = structureResult.validatedCompact;

    // 3. Nonce Validation (only if nonce is provided)
    if (validatedCompact.nonce !== null) {
      const nonceResult = await validateNonce(
        validatedCompact.nonce,
        validatedCompact.sponsor,
        chainId,
        db
      );
      if (!nonceResult.isValid) return nonceResult;
    }

    // 4. Expiration Validation
    const expirationResult = validateExpiration(validatedCompact.expires);
    if (!expirationResult.isValid) return expirationResult;

    // 5. Domain and ID Validation
    const domainResult = await validateDomainAndId(
      validatedCompact.id,
      validatedCompact.expires,
      chainId,
      process.env.ALLOCATOR_ADDRESS!
    );
    if (!domainResult.isValid) return domainResult;

    // 6. Allocation Validation
    const allocationResult = await validateAllocation(
      validatedCompact,
      chainId,
      db
    );
    if (!allocationResult.isValid) return allocationResult;

    return { isValid: true, validatedCompact };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

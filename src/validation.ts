import { getAddress } from 'viem';
import { getCompactDetails } from './graphql';

export interface CompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: string;
  expires: bigint;
  id: bigint;
  amount: string;
  witnessTypeString: string | null;
  witnessHash: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export async function validateCompact(
  compact: CompactMessage,
  chainId: string
): Promise<ValidationResult> {
  try {
    // 1. Structural Validation
    const result = await validateStructure(compact);
    if (!result.isValid) return result;

    // 2. Nonce Validation
    const nonceResult = validateNonce(compact.nonce, compact.sponsor);
    if (!nonceResult.isValid) return nonceResult;

    // 3. Expiration Validation
    const expirationResult = validateExpiration(compact.expires);
    if (!expirationResult.isValid) return expirationResult;

    // 4. Domain and ID Validation
    const domainResult = await validateDomainAndId(
      compact.id,
      compact.expires,
      chainId,
      process.env.ALLOCATOR_ADDRESS!
    );
    if (!domainResult.isValid) return domainResult;

    // 5. Allocation Validation
    const allocationResult = await validateAllocation(compact, chainId);
    if (!allocationResult.isValid) return allocationResult;

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function validateStructure(
  compact: CompactMessage
): Promise<ValidationResult> {
  try {
    // Validate Ethereum addresses
    getAddress(compact.arbiter);
    getAddress(compact.sponsor);

    // Validate numeric fields
    if (compact.expires <= 0n) {
      return { isValid: false, error: 'Invalid expires timestamp' };
    }

    if (compact.id <= 0n) {
      return { isValid: false, error: 'Invalid id' };
    }

    // Validate amount is a valid number string
    if (!/^\d+$/.test(compact.amount)) {
      return { isValid: false, error: 'Invalid amount format' };
    }

    // Validate witness fields
    if (
      (compact.witnessTypeString === null && compact.witnessHash !== null) ||
      (compact.witnessTypeString !== null && compact.witnessHash === null)
    ) {
      return {
        isValid: false,
        error:
          'Witness type string and hash must both be null or both be present',
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

function validateNonce(nonce: string, sponsor: string): ValidationResult {
  try {
    // Check that the first 20 bytes of the nonce match the sponsor's address
    const sponsorAddress = getAddress(sponsor).toLowerCase();
    const nonceStart = nonce.slice(0, 42).toLowerCase();

    if (nonceStart !== sponsorAddress) {
      return {
        isValid: false,
        error: 'Nonce must start with sponsor address',
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Nonce validation error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function validateExpiration(expires: bigint): ValidationResult {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const twoHours = 7200n;

  if (expires <= now) {
    return { isValid: false, error: 'Compact has already expired' };
  }

  if (expires > now + twoHours) {
    return { isValid: false, error: 'Expiration must be within 2 hours' };
  }

  return { isValid: true };
}

async function validateDomainAndId(
  id: bigint,
  expires: bigint,
  chainId: string,
  allocatorAddress: string
): Promise<ValidationResult> {
  try {
    // Extract resetPeriod and allocatorId from the compact id
    const resetPeriodIndex = Number((id >> 252n) & 0x7n);
    const resetPeriods = [1n, 15n, 60n, 600n, 3900n, 86400n, 612000n, 2592000n];
    const resetPeriod = resetPeriods[resetPeriodIndex];
    const allocatorId = (id >> 160n) & ((1n << 92n) - 1n);

    // Verify allocatorId matches the one from GraphQL
    const response = await getCompactDetails({
      allocator: allocatorAddress,
      sponsor: '', // Not needed for this check
      lockId: '0', // Not needed for this check
      chainId,
    });

    const graphqlAllocatorId =
      response.allocator.supportedChains.items[0]?.allocatorId;
    if (!graphqlAllocatorId || BigInt(graphqlAllocatorId) !== allocatorId) {
      return { isValid: false, error: 'Invalid allocator ID' };
    }

    // Check that resetPeriod doesn't allow forced withdrawal before expiration
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now + resetPeriod < expires) {
      return {
        isValid: false,
        error: 'Reset period would allow forced withdrawal before expiration',
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Domain/ID validation error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

async function validateAllocation(
  compact: CompactMessage,
  chainId: string
): Promise<ValidationResult> {
  try {
    const response = await getCompactDetails({
      allocator: process.env.ALLOCATOR_ADDRESS!,
      sponsor: compact.sponsor,
      lockId: compact.id.toString(),
      chainId,
    });

    // Check withdrawal status
    const resourceLock = response.account.resourceLocks.items[0];
    if (!resourceLock) {
      return { isValid: false, error: 'Resource lock not found' };
    }

    if (resourceLock.withdrawalStatus !== 0) {
      return {
        isValid: false,
        error: 'Resource lock has forced withdrawals enabled',
      };
    }

    // Calculate pending balance
    const pendingBalance = response.accountDeltas.items.reduce(
      (sum, delta) => sum + BigInt(delta.delta),
      0n
    );

    // Calculate allocatable balance
    const resourceLockBalance = BigInt(resourceLock.balance);
    const allocatableBalance =
      resourceLockBalance > pendingBalance
        ? resourceLockBalance - pendingBalance
        : 0n;

    // Calculate allocated balance from recent claims
    const allocatedBalance = response.account.claims.items.reduce(
      (sum, _claim) => sum + BigInt(compact.amount),
      0n
    );

    // Verify sufficient balance
    if (allocatableBalance < allocatedBalance + BigInt(compact.amount)) {
      return {
        isValid: false,
        error: 'Insufficient allocatable balance',
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Allocation validation error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

import { getAddress } from 'viem/utils';
import { numberToHex } from 'viem/utils';
import { PGlite } from '@electric-sql/pglite';
import { getCompactDetails } from '../graphql';
import { getAllocatedBalance } from '../balance';
import { ValidationResult, CompactMessage } from './types';

// Helper to convert bigint to 32-byte hex string
function bigintToHex(value: bigint): string {
  return numberToHex(value, { size: 32 }).slice(2);
}

export async function validateAllocation(
  compact: CompactMessage,
  chainId: string,
  db: PGlite
): Promise<ValidationResult> {
  try {
    // Extract allocatorId from the compact id
    const allocatorId =
      (compact.id >> BigInt(160)) & ((BigInt(1) << BigInt(92)) - BigInt(1));

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

    // Verify allocatorId matches the one from GraphQL
    const graphqlAllocatorId =
      response.allocator.supportedChains.items[0]?.allocatorId;
    if (!graphqlAllocatorId || BigInt(graphqlAllocatorId) !== allocatorId) {
      return { isValid: false, error: 'Invalid allocator ID' };
    }

    // Calculate pending balance
    const pendingBalance = response.accountDeltas.items.reduce(
      (sum, delta) => sum + BigInt(delta.delta),
      BigInt(0)
    );

    // Calculate allocatable balance
    const resourceLockBalance = BigInt(resourceLock.balance);
    const allocatableBalance =
      resourceLockBalance > pendingBalance
        ? resourceLockBalance - pendingBalance
        : BigInt(0);

    // Get allocated balance from database with proper hex formatting
    const allocatedBalance = await getAllocatedBalance(
      db,
      getAddress(compact.sponsor).toLowerCase(),
      chainId,
      bigintToHex(compact.id),
      response.account.claims.items.map((item) => item.claimHash)
    );

    // Verify sufficient balance
    const totalNeededBalance = allocatedBalance + BigInt(compact.amount);
    if (allocatableBalance < totalNeededBalance) {
      return {
        isValid: false,
        error: `Insufficient allocatable balance (have ${allocatableBalance}, need ${totalNeededBalance})`,
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

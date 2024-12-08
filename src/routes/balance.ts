import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAddress } from 'viem/utils';
import { getAllocatedBalance } from '../balance';
import { getCompactDetails, getAllResourceLocks } from '../graphql';
import { createAuthMiddleware } from './session';

interface Balance {
  chainId: string;
  lockId: string;
  allocatableBalance: string;
  allocatedBalance: string;
  balanceAvailableToAllocate: string;
  withdrawalStatus: number;
}

export async function setupBalanceRoutes(
  server: FastifyInstance
): Promise<void> {
  const authenticateRequest = createAuthMiddleware(server);

  // Get balance for all resource locks
  server.get(
    '/balances',
    {
      preHandler: authenticateRequest,
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<
      | {
          balances: Array<Balance>;
        }
      | { error: string }
    > => {
      try {
        const sponsor = request.session!.address;

        // Get all resource locks for the sponsor
        const response = await getAllResourceLocks(sponsor);

        // Add defensive checks
        if (!response?.account?.resourceLocks?.items) {
          return { balances: [] };
        }

        // Filter locks to only include those managed by this allocator
        const ourLocks = response.account.resourceLocks.items.filter((item) => {
          try {
            return (
              getAddress(item?.resourceLock?.allocatorAddress) ===
              getAddress(process.env.ALLOCATOR_ADDRESS!)
            );
          } catch {
            return false;
          }
        });

        // Get balance details for each lock
        const balances = (
          await Promise.all(
            ourLocks.map(async (lock) => {
              // Get details from GraphQL
              const lockDetails = await getCompactDetails({
                allocator: process.env.ALLOCATOR_ADDRESS!,
                sponsor,
                lockId: lock.resourceLock.lockId,
                chainId: lock.chainId,
              });

              // Add defensive check for lockDetails
              if (!lockDetails?.account?.resourceLocks?.items?.[0]) {
                return null; // This lock will be filtered out
              }

              const resourceLock = lockDetails.account.resourceLocks.items[0];
              if (!resourceLock) {
                return null; // Skip if lock no longer exists
              }

              // Calculate pending balance
              const pendingBalance = lockDetails.accountDeltas.items.reduce(
                (sum, delta) => sum + BigInt(delta.delta),
                BigInt(0)
              );

              // Calculate allocatable balance
              const allocatableBalance =
                BigInt(resourceLock.balance) + pendingBalance;

              // Get allocated balance
              const allocatedBalance = await getAllocatedBalance(
                server.db,
                sponsor,
                lock.chainId,
                lock.resourceLock.lockId,
                lockDetails.account.claims.items.map((claim) => claim.claimHash)
              );

              // Calculate available balance
              let balanceAvailableToAllocate = BigInt(0);
              if (resourceLock.withdrawalStatus === 0) {
                if (allocatedBalance < allocatableBalance) {
                  balanceAvailableToAllocate =
                    allocatableBalance - allocatedBalance;
                }
              }

              return {
                chainId: lock.chainId,
                lockId: lock.resourceLock.lockId,
                allocatableBalance: allocatableBalance.toString(),
                allocatedBalance: allocatedBalance.toString(),
                balanceAvailableToAllocate:
                  balanceAvailableToAllocate.toString(),
                withdrawalStatus: resourceLock.withdrawalStatus,
              } as Balance;
            })
          )
        ).filter((balance): balance is Balance => balance !== null);

        // Filter out any null results and return
        return {
          balances,
        };
      } catch (error) {
        console.error('Error fetching balances:', error);
        reply.code(500);
        return {
          error: `Failed to fetch balances: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    }
  );

  // Protected routes
  server.register(async function (protectedRoutes) {
    // Add authentication to all routes in this context
    protectedRoutes.addHook('preHandler', authenticateRequest);

    // Get available balance for a specific lock
    protectedRoutes.get<{
      Params: { chainId: string; lockId: string };
    }>(
      '/balance/:chainId/:lockId',
      async (
        request: FastifyRequest<{
          Params: { chainId: string; lockId: string };
        }>,
        reply: FastifyReply
      ) => {
        if (!request.session) {
          reply.code(401);
          return { error: 'Unauthorized' };
        }

        try {
          const { chainId, lockId } = request.params;
          const sponsor = request.session.address;

          // Get details from GraphQL
          const response = await getCompactDetails({
            allocator: process.env.ALLOCATOR_ADDRESS!,
            sponsor,
            lockId,
            chainId,
          });

          // Verify the resource lock exists
          const resourceLock = response.account.resourceLocks.items[0];
          if (!resourceLock) {
            reply.code(404);
            return { error: 'Resource lock not found' };
          }

          // Extract allocatorId from the lockId
          const lockIdBigInt = BigInt(lockId);
          const allocatorId =
            (lockIdBigInt >> BigInt(160)) &
            ((BigInt(1) << BigInt(92)) - BigInt(1));

          // Verify allocatorId matches
          const graphqlAllocatorId =
            response.allocator.supportedChains.items[0]?.allocatorId;
          if (
            !graphqlAllocatorId ||
            BigInt(graphqlAllocatorId) !== allocatorId
          ) {
            reply.code(400);
            return { error: 'Invalid allocator ID' };
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

          // Get allocated balance from database
          const allocatedBalance = await getAllocatedBalance(
            server.db,
            sponsor,
            chainId,
            lockId,
            response.account.claims.items.map((claim) => claim.claimHash)
          );

          // Calculate balance available to allocate
          let balanceAvailableToAllocate = BigInt(0);
          if (resourceLock.withdrawalStatus === 0) {
            if (allocatedBalance < allocatableBalance) {
              balanceAvailableToAllocate =
                allocatableBalance - allocatedBalance;
            }
          }

          return {
            allocatableBalance: allocatableBalance.toString(),
            allocatedBalance: allocatedBalance.toString(),
            balanceAvailableToAllocate: balanceAvailableToAllocate.toString(),
            withdrawalStatus: resourceLock.withdrawalStatus,
          };
        } catch (error) {
          server.log.error('Failed to get balance:', error);
          reply.code(500);
          return {
            error:
              error instanceof Error ? error.message : 'Failed to get balance',
          };
        }
      }
    );
  });
}

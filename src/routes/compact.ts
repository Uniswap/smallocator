import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  submitCompact,
  getCompactsByAddress,
  getCompactByHash,
  type CompactSubmission,
  type StoredCompactMessage,
} from '../compact';
import { createAuthMiddleware } from './session';
import { generateNonce } from '../validation';

// Type for serialized response
interface SerializedCompactMessage {
  id: string;
  arbiter: string;
  sponsor: string;
  nonce: string;
  expires: string;
  amount: string;
  witnessTypeString: string | null;
  witnessHash: string | null;
}

interface SerializedCompactRecord {
  chainId: string;
  compact: SerializedCompactMessage;
  hash: string;
  signature: string;
  createdAt: string;
}

// Helper function to serialize a stored compact message
function serializeCompactMessage(
  compact: StoredCompactMessage
): SerializedCompactMessage {
  return {
    id: compact.id.toString(),
    arbiter: compact.arbiter,
    sponsor: compact.sponsor,
    nonce: compact.nonce.toString(),
    expires: compact.expires.toString(),
    amount: compact.amount,
    witnessTypeString: compact.witnessTypeString,
    witnessHash: compact.witnessHash,
  };
}

export async function setupCompactRoutes(
  server: FastifyInstance
): Promise<void> {
  const authenticateRequest = createAuthMiddleware(server);

  // Get suggested nonce for a chain
  server.get<{
    Params: { chainId: string };
  }>(
    '/suggested-nonce/:chainId',
    {
      preHandler: authenticateRequest,
    },
    async (
      request: FastifyRequest<{
        Params: { chainId: string };
      }>,
      reply: FastifyReply
    ) => {
      if (!request.session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      try {
        const { chainId } = request.params;
        const sponsor = request.session.address;

        // Generate a nonce for the sponsor
        const nonce = await generateNonce(sponsor, chainId, server.db);

        // Return the nonce in hex format with 0x prefix
        return {
          nonce: '0x' + nonce.toString(16).padStart(64, '0'),
        };
      } catch (error) {
        server.log.error({
          msg: 'Failed to generate nonce',
          err: error instanceof Error ? error.message : String(error),
          path: request.url,
        });
        reply.code(500);
        return {
          error:
            error instanceof Error ? error.message : 'Failed to generate nonce',
        };
      }
    }
  );

  // Submit a new compact
  server.post<{
    Body: CompactSubmission;
  }>(
    '/compact',
    {
      preHandler: authenticateRequest,
    },
    async (
      request: FastifyRequest<{
        Body: CompactSubmission;
      }>,
      reply: FastifyReply
    ) => {
      if (!request.session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      try {
        // Return the result directly without wrapping it
        return await submitCompact(
          server,
          request.body,
          request.session.address
        );
      } catch (error) {
        server.log.error({
          msg: 'Failed to submit compact',
          err: error instanceof Error ? error.message : String(error),
          path: request.url,
        });
        if (
          error instanceof Error &&
          error.message.includes('Sponsor address does not match')
        ) {
          reply.code(403);
        } else {
          reply.code(400);
        }
        return {
          error:
            error instanceof Error ? error.message : 'Failed to submit compact',
        };
      }
    }
  );

  // Get compacts for authenticated user
  server.get(
    '/compacts',
    {
      preHandler: authenticateRequest,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      try {
        return await getCompactsByAddress(server, request.session.address);
      } catch (error) {
        server.log.error({
          msg: 'Failed to get compacts',
          err: error instanceof Error ? error.message : String(error),
          path: request.url,
        });
        if (
          error instanceof Error &&
          error.message.includes('No compacts found')
        ) {
          reply.code(404);
        } else {
          reply.code(400);
        }
        return {
          error:
            error instanceof Error ? error.message : 'Failed to get compacts',
        };
      }
    }
  );

  // Get specific compact
  server.get<{
    Params: { chainId: string; claimHash: string };
  }>(
    '/compact/:chainId/:claimHash',
    {
      preHandler: authenticateRequest,
    },
    async (
      request: FastifyRequest<{
        Params: { chainId: string; claimHash: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { chainId, claimHash } = request.params;
        const compact = await getCompactByHash(server, chainId, claimHash);

        if (!compact) {
          reply.code(404);
          return { error: 'Compact not found' };
        }

        // Convert BigInt values to strings for JSON serialization
        const serializedCompact: SerializedCompactRecord = {
          chainId,
          compact: serializeCompactMessage(compact.compact),
          hash: compact.hash,
          signature: compact.signature,
          createdAt: compact.createdAt,
        };

        return serializedCompact;
      } catch (error) {
        server.log.error({
          msg: 'Failed to get compact',
          err: error instanceof Error ? error.message : String(error),
          path: request.url,
        });
        reply.code(500);
        return {
          error:
            error instanceof Error ? error.message : 'Failed to get compact',
        };
      }
    }
  );
}

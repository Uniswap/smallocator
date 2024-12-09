import {
  type Hex,
  parseCompactSignature,
  serializeCompactSignature,
  hashTypedData,
  keccak256,
  encodeAbiParameters,
  encodePacked,
  concat,
  getAddress,
} from 'viem';
import { privateKeyToAccount, signMessage } from 'viem/accounts';
import { type StoredCompactMessage } from './compact';
import { type SessionPayload } from './session';

// EIP-712 domain for The Compact
const DOMAIN = {
  name: 'The Compact',
  version: '0',
  verifyingContract: '0x00000000000018DF021Ff2467dF97ff846E09f48',
} as const;

// Type definitions for EIP-712 typed data (no witness case)
const COMPACT_TYPES = {
  Compact: [
    { name: 'arbiter', type: 'address' },
    { name: 'sponsor', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expires', type: 'uint256' },
    { name: 'id', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
  ],
};

// EIP-712 domain typehash (for witness case)
const EIP712_DOMAIN_TYPEHASH = keccak256(
  encodePacked(
    ['string'],
    [
      'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
    ]
  )
);

// Get the private key for signing operations
const privateKey = process.env.PRIVATE_KEY as Hex;
if (!privateKey) {
  throw new Error('PRIVATE_KEY environment variable is required');
}

const account = privateKeyToAccount(privateKey);

export async function generateClaimHash(
  compact: StoredCompactMessage,
  chainId: bigint
): Promise<Hex> {
  // Normalize addresses
  const normalizedArbiter = getAddress(compact.arbiter);
  const normalizedSponsor = getAddress(compact.sponsor);

  if (!compact.witnessTypeString || !compact.witnessHash) {
    // Use hashTypedData for the simple case
    return hashTypedData({
      domain: { ...DOMAIN, chainId: Number(chainId) },
      types: COMPACT_TYPES,
      primaryType: 'Compact',
      message: {
        arbiter: normalizedArbiter,
        sponsor: normalizedSponsor,
        nonce: compact.nonce,
        expires: compact.expires,
        id: compact.id,
        amount: BigInt(compact.amount),
      },
    });
  } else {
    // Manual EIP-712 hashing for witness case
    // Generate domain separator
    const domainSeparator = keccak256(
      encodeAbiParameters(
        [
          { name: 'typeHash', type: 'bytes32' },
          { name: 'name', type: 'bytes32' },
          { name: 'version', type: 'bytes32' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        [
          EIP712_DOMAIN_TYPEHASH,
          keccak256(encodePacked(['string'], [DOMAIN.name])),
          keccak256(encodePacked(['string'], [DOMAIN.version])),
          chainId,
          DOMAIN.verifyingContract,
        ]
      )
    );

    // Generate type hash with witness
    const typeHash = keccak256(
      encodePacked(
        ['string'],
        [
          'Compact(address arbiter,address sponsor,uint256 nonce,uint256 expires,uint256 id,uint256 amount,' +
            compact.witnessTypeString,
        ]
      )
    );

    // Generate message hash
    const messageHash = keccak256(
      encodeAbiParameters(
        [
          { name: 'typeHash', type: 'bytes32' },
          { name: 'arbiter', type: 'address' },
          { name: 'sponsor', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expires', type: 'uint256' },
          { name: 'id', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'witnessHash', type: 'bytes32' },
        ],
        [
          typeHash,
          normalizedArbiter,
          normalizedSponsor,
          compact.nonce,
          compact.expires,
          compact.id,
          BigInt(compact.amount),
          compact.witnessHash as Hex,
        ]
      )
    );

    // Combine with EIP-712 prefix and domain separator
    return keccak256(concat(['0x1901', domainSeparator, messageHash]));
  }
}

export async function signCompact(hash: Hex, _chainId: bigint): Promise<Hex> {
  // Sign the hash directly using the private key
  const signature = await signMessage({
    message: { raw: hash },
    privateKey,
  });

  // Convert to EIP2098 compact signature format
  const parsedCompactSig = parseCompactSignature(signature);
  return serializeCompactSignature(parsedCompactSig);
}

export function getSigningAddress(): string {
  return account.address;
}

// Utility function to verify our signing address matches configuration
export function verifySigningAddress(configuredAddress: string): void {
  if (process.env.SKIP_SIGNING_VERIFICATION === 'true') {
    return;
  }

  if (!configuredAddress) {
    throw new Error('No signing address configured');
  }

  const normalizedConfigured = getAddress(configuredAddress).toLowerCase();
  const normalizedActual = getAddress(account.address).toLowerCase();

  if (normalizedConfigured !== normalizedActual) {
    throw new Error(
      `Configured signing address ${normalizedConfigured} does not match ` +
        `actual signing address ${normalizedActual}`
    );
  }
}

export async function generateSignature(
  payload: SessionPayload | string
): Promise<string> {
  // If payload is a string, use it directly as the message
  const message =
    typeof payload === 'string'
      ? payload
      : [
          `${payload.domain} wants you to sign in with your Ethereum account:`,
          payload.address,
          '',
          payload.statement,
          '',
          `URI: ${payload.uri}`,
          `Version: ${payload.version}`,
          `Chain ID: ${payload.chainId}`,
          `Nonce: ${payload.nonce}`,
          `Issued At: ${payload.issuedAt}`,
          `Expiration Time: ${payload.expirationTime}`,
        ].join('\n');

  // Sign the message using the private key directly
  const signature = await signMessage({
    message,
    privateKey,
  });

  return signature;
}

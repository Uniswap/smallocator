import { getAddress, hexToBytes } from 'viem/utils';

// Helper to convert bytea to checksummed address
export function byteaToAddress(bytes: Uint8Array): string {
  return getAddress('0x' + Buffer.from(bytes).toString('hex'));
}

// Helper to convert address to bytea
export function addressToBytes(address: string): Uint8Array {
  return hexToBytes(address as `0x${string}`);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'viem' {
  export type Hex = `0x${string}`;
  export type Address = Hex;
  export type Hash = Hex;
  export type Bytes = Hex;
  export type SignableMessage = string | Bytes;

  export type Signature = {
    r: Hex;
    s: Hex;
    yParity: 0 | 1;
  };

  export type CompactSignature = {
    r: Hex;
    yParityAndS: Hex;
  };

  export type AbiParameter = {
    name: string;
    type: string;
    components?: AbiParameter[];
  };

  // Functions
  export function getAddress(address: string): Address;
  export function hashMessage(message: SignableMessage): Hash;
  export function hashTypedData<T>(args: {
    domain: T;
    types: Record<string, AbiParameter[]>;
    primaryType: string;
    message: T;
  }): Hash;
  export function keccak256(value: Hex | string): Hash;
  export function verifyMessage(args: {
    address: Address;
    message: SignableMessage;
    signature: Hex;
  }): boolean;
  export function encodeAbiParameters(
    types: readonly AbiParameter[],
    values: readonly any[]
  ): Hex;
  export function encodePacked(
    types: readonly string[],
    values: readonly any[]
  ): Hex;
  export function concat(values: readonly Hex[]): Hex;
  export function signatureToCompactSignature(
    signature: Signature
  ): CompactSignature;
  export function serializeCompactSignature(
    compactSignature: CompactSignature
  ): Hex;
  export function parseSignature(signatureHex: Hex): Signature;
  export function recoverMessageAddress(args: {
    message: SignableMessage | { raw: Hex };
    signature: Hex;
  }): Promise<Address>;
  export function compactSignatureToSignature(
    compactSignature: CompactSignature
  ): Signature;
  export function serializeSignature(signature: Signature): Hex;
  export function parseCompactSignature(
    compactSignatureHex: Hex
  ): CompactSignature;
  export function hexToBytes(hex: Hex): Uint8Array;
  export function toHex(
    value: number | bigint | Uint8Array,
    opts?: { size?: number }
  ): Hex;
  export function numberToHex(
    value: number | bigint,
    opts?: { size?: number }
  ): Hex;
}

declare module 'viem/accounts' {
  import type { Hex, SignableMessage } from 'viem';

  export type Account = {
    address: Hex;
    signMessage(message: SignableMessage): Promise<Hex>;
  };

  export type SignMessageParameters = {
    message: SignableMessage | { raw: Hex };
    privateKey: Hex;
  };

  export function signMessage(params: SignMessageParameters): Promise<Hex>;
  export function privateKeyToAccount(privateKey: Hex): Account;
}

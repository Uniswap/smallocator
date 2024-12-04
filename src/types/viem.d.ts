/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
declare module 'viem' {
  export type Hex = `0x${string}`;
  export type Address = Hex;
  export type Hash = Hex;
  export type Bytes = Hex;
  export type SignableMessage = string | Bytes;

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

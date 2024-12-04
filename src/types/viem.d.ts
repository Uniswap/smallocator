/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
declare module 'viem' {
  // Basic types for ABI
  type AbiComponent = {
    name: string;
    type: string;
    components?: AbiComponent[];
  };

  type AbiInput = AbiComponent;
  type AbiOutput = AbiComponent;

  export type Hex = `0x${string}`;
  export type Address = Hex;
  export type Hash = Hex;
  export type Bytes = Hex;
  export type SignableMessage = string | Bytes;

  // Contract types
  export type ContractEventName<_TAbi> = string;
  export type ContractEvent<_TAbi> = {
    name: string;
    inputs: AbiInput[];
    outputs?: AbiOutput[];
  };
  export type ExtractAbiEvent<_TAbi> = {
    name: string;
    inputs: AbiInput[];
    outputs?: AbiOutput[];
  };
  export type MulticallResponse = {
    success: boolean;
    result: unknown;
  };
  export type Abi = Array<{
    name?: string;
    type: string;
    inputs?: AbiInput[];
    outputs?: AbiOutput[];
    stateMutability?: string;
  }>;
  export type AbiEvent = {
    name: string;
    inputs: AbiInput[];
    outputs?: AbiOutput[];
  };
  export type AbiFunction = {
    name: string;
    inputs: AbiInput[];
    outputs?: AbiOutput[];
    stateMutability?: string;
  };
  export type AbiParameter = AbiComponent;

  export type AbiParametersToPrimitiveTypes<_TAbi> = any;
  export type ExtractAbiFunction<_TAbi> = AbiFunction;
  export type ExtractAbiFunctionNames<_TAbi> = string;

  // Functions
  export function getAddress(address: string): Address;
  export function createWalletClient(config: unknown): unknown;
  export function hashMessage(message: SignableMessage): Hash;
  export function toHex(value: string | number | bigint): Hex;
  export function hexToString(hex: Hex): string;
  export function stringToHex(str: string): Hex;
  export function encodeAbiParameters(
    types: readonly AbiParameter[],
    values: readonly any[]
  ): Hex;
  export function verifyMessage(args: {
    address: Address;
    message: SignableMessage;
    signature: Hex;
  }): boolean;
  export function hashTypedData<T extends Record<string, any>>(args: {
    domain: T;
    types: Record<string, AbiParameter[]>;
    primaryType: string;
    message: T;
  }): Hash;
  export function keccak256(value: Hex | string): Hash;
  export function encodePacked(
    types: readonly string[],
    values: readonly any[]
  ): Hex;
  export function concat(values: readonly Hex[]): Hex;
}

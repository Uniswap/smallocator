export interface CompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: bigint | null;
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

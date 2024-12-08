// Interface for incoming compact messages (from API)
export interface CompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: string | null; // Can be decimal or hex string
  expires: string; // Can be decimal or hex string
  id: string; // Can be decimal or hex string
  amount: string; // Can be decimal or hex string
  witnessTypeString: string | null;
  witnessHash: string | null;
}

// Interface for validated compact messages (internal use)
export interface ValidatedCompactMessage {
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

import {
  type Hex,
  recoverMessageAddress,
  compactSignatureToSignature,
  serializeSignature,
  parseCompactSignature,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { signCompact, generateClaimHash, getSigningAddress } from '../crypto';

describe('Compact Signature Tests', () => {
  const mockCompact = {
    id: BigInt(
      '0x1000000000000000000000000000000000000000000000000000000000000001'
    ),
    arbiter: '0x0000000000000000000000000000000000000001',
    sponsor: '0x0000000000000000000000000000000000000002',
    nonce: BigInt('0x1'),
    expires: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
    amount: '1000000000000000000', // 1 ETH
    witnessTypeString: null,
    witnessHash: null,
  };

  const chainId = BigInt(1); // Mainnet
  const expectedSigner = getSigningAddress();

  // Add test to verify private key matches expected signer
  describe('test environment setup', () => {
    it('should have private key that matches expected signer', () => {
      const privateKey = process.env.PRIVATE_KEY as Hex;
      expect(privateKey).toBeDefined();
      const derivedAddress =
        privateKeyToAccount(privateKey).address.toLowerCase();
      expect(derivedAddress).toBe(expectedSigner.toLowerCase());
    });
  });

  describe('generateClaimHash', () => {
    it('should generate a valid claim hash', async () => {
      const hash = await generateClaimHash(mockCompact, chainId);
      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should generate different hashes for different nonces', async () => {
      const hash1 = await generateClaimHash(mockCompact, chainId);
      const hash2 = await generateClaimHash(
        {
          ...mockCompact,
          nonce: BigInt('0x2'),
        },
        chainId
      );
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('signCompact', () => {
    it('should generate a valid EIP2098 compact signature', async () => {
      const hash = await generateClaimHash(mockCompact, chainId);
      const compactSig = await signCompact(hash, chainId);

      // EIP2098 signatures should be 64 bytes (128 hex chars) without the 0x prefix
      expect(compactSig).toMatch(/^0x[a-fA-F0-9]{128}$/);

      // Convert compact signature to full signature
      const parsedCompactSig = parseCompactSignature(compactSig);
      const signature = compactSignatureToSignature(parsedCompactSig);
      const fullSignature = serializeSignature(signature);

      // Recover and verify the signer
      const recoveredAddress = await recoverMessageAddress({
        message: { raw: hash },
        signature: fullSignature,
      });
      expect(recoveredAddress.toLowerCase()).toBe(expectedSigner.toLowerCase());
    });

    it('should generate consistent signatures for the same hash', async () => {
      const hash = await generateClaimHash(mockCompact, chainId);
      const sig1 = await signCompact(hash, chainId);
      const sig2 = await signCompact(hash, chainId);
      expect(sig1).toBe(sig2);

      // Convert compact signature to full signature
      const parsedCompactSig = parseCompactSignature(sig1);
      const signature = compactSignatureToSignature(parsedCompactSig);
      const fullSignature = serializeSignature(signature);

      // Recover and verify the signer
      const recoveredAddress = await recoverMessageAddress({
        message: { raw: hash },
        signature: fullSignature,
      });
      expect(recoveredAddress.toLowerCase()).toBe(expectedSigner.toLowerCase());
    });

    it('should generate different signatures for different hashes', async () => {
      const hash1 = await generateClaimHash(mockCompact, chainId);
      const hash2 = await generateClaimHash(
        {
          ...mockCompact,
          nonce: BigInt('0x2'),
        },
        chainId
      );

      const sig1 = await signCompact(hash1, chainId);
      const sig2 = await signCompact(hash2, chainId);
      expect(sig1).not.toBe(sig2);

      // Convert first compact signature to full signature
      const parsedCompactSig1 = parseCompactSignature(sig1);
      const signature1 = compactSignatureToSignature(parsedCompactSig1);
      const fullSignature1 = serializeSignature(signature1);

      // Convert second compact signature to full signature
      const parsedCompactSig2 = parseCompactSignature(sig2);
      const signature2 = compactSignatureToSignature(parsedCompactSig2);
      const fullSignature2 = serializeSignature(signature2);

      // Recover and verify the signer for both signatures
      const recoveredAddress1 = await recoverMessageAddress({
        message: { raw: hash1 },
        signature: fullSignature1,
      });
      const recoveredAddress2 = await recoverMessageAddress({
        message: { raw: hash2 },
        signature: fullSignature2,
      });
      expect(recoveredAddress1.toLowerCase()).toBe(
        expectedSigner.toLowerCase()
      );
      expect(recoveredAddress2.toLowerCase()).toBe(
        expectedSigner.toLowerCase()
      );
    });

    it('should handle witness data correctly', async () => {
      const mockCompactWithWitness = {
        ...mockCompact,
        witnessTypeString:
          'ExampleWitness exampleWitness)ExampleWitness(bytes32 foo,uint256 bar)',
        witnessHash:
          '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      };

      const hash = await generateClaimHash(mockCompactWithWitness, chainId);
      const compactSig = await signCompact(hash, chainId);

      // Should still produce a valid EIP2098 signature
      expect(compactSig).toMatch(/^0x[a-fA-F0-9]{128}$/);

      // Convert compact signature to full signature
      const parsedCompactSig = parseCompactSignature(compactSig);
      const signature = compactSignatureToSignature(parsedCompactSig);
      const fullSignature = serializeSignature(signature);

      // Recover and verify the signer
      const recoveredAddress = await recoverMessageAddress({
        message: { raw: hash },
        signature: fullSignature,
      });
      expect(recoveredAddress.toLowerCase()).toBe(expectedSigner.toLowerCase());
    });
  });
});

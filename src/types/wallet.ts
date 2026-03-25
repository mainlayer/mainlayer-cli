export interface EncryptedKeystore {
  version: 1;
  pubkey: string; // base58 Solana address (unencrypted)
  salt: string; // hex-encoded 16 bytes
  iv: string; // hex-encoded 12 bytes
  ciphertext: string; // hex-encoded encrypted private key bytes
  authTag: string; // hex-encoded 16 bytes
}

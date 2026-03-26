import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// We need to create a WalletService pointing to a tmp dir for tests
// so they don't pollute the real ~/.mainlayer/wallet.json

let tmpDir: string;
let walletPath: string;

import { WalletService } from '../../src/services/wallet-service.js';
import { EXIT_CODES } from '../../src/utils/errors.js';

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mainlayer-wallet-test-'));
  walletPath = join(tmpDir, 'wallet.json');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function makeService() {
  return new WalletService(walletPath);
}

describe('WalletService', () => {
  describe('encrypt/decrypt round-trip', () => {
    it('encrypts and decrypts to identical bytes', async () => {
      const svc = makeService();
      const original = new Uint8Array(32);
      for (let i = 0; i < 32; i++) original[i] = i;

      const keystore = await svc.encryptKeystorePublic(original, 'test-pubkey', 'passphrase123');
      const decrypted = await svc.decryptKeystorePublic(keystore, 'passphrase123');

      expect(decrypted).toEqual(original);
    });

    it('throws AUTH_ERROR for wrong passphrase', async () => {
      const svc = makeService();
      const original = new Uint8Array(32).fill(42);

      const keystore = await svc.encryptKeystorePublic(original, 'test-pubkey', 'correct-passphrase');

      await expect(svc.decryptKeystorePublic(keystore, 'wrong-passphrase')).rejects.toMatchObject({
        exitCode: EXIT_CODES.AUTH_ERROR,
      });
    });
  });

  describe('create', () => {
    it('writes wallet.json file', async () => {
      const svc = makeService();
      await svc.create('test-passphrase');
      expect(existsSync(walletPath)).toBe(true);
    });

    it('returns a valid Solana address string', async () => {
      const svc = makeService();
      const address = await svc.create('test-passphrase');
      // Solana addresses are base58, 32-44 chars
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThanOrEqual(32);
      expect(address.length).toBeLessThanOrEqual(44);
    });

    it('writes wallet.json with 0600 permissions', async () => {
      const svc = makeService();
      await svc.create('test-passphrase');
      const stat = statSync(walletPath);
      // mode & 0o777 gives permissions bits
      const mode = stat.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('throws ALREADY_EXISTS when wallet already exists', async () => {
      const svc = makeService();
      await svc.create('test-passphrase');

      await expect(svc.create('test-passphrase')).rejects.toMatchObject({
        exitCode: EXIT_CODES.ALREADY_EXISTS,
      });
    });

    it('stores keystore with version 1 and pubkey', async () => {
      const svc = makeService();
      const address = await svc.create('test-passphrase');
      const { readFileSync } = await import('node:fs');
      const keystore = JSON.parse(readFileSync(walletPath, 'utf8'));
      expect(keystore.version).toBe(1);
      expect(keystore.pubkey).toBe(address);
      expect(keystore.salt).toBeTruthy();
      expect(keystore.iv).toBeTruthy();
      expect(keystore.ciphertext).toBeTruthy();
      expect(keystore.authTag).toBeTruthy();
    });
  });

  describe('getAddress', () => {
    it('returns pubkey without requiring passphrase (no decryption)', async () => {
      const svc = makeService();
      const createdAddress = await svc.create('test-passphrase');

      // Spy on decryptKeystore to ensure it's NOT called
      const decryptSpy = vi.spyOn(svc, 'decryptKeystorePublic');

      const address = await svc.getAddress();
      expect(address).toBe(createdAddress);
      expect(decryptSpy).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when no wallet exists', async () => {
      const svc = makeService();
      await expect(svc.getAddress()).rejects.toMatchObject({
        exitCode: EXIT_CODES.NOT_FOUND,
      });
    });
  });

  describe('exportPrivateKey', () => {
    it('decrypts and returns base58-encoded private key', async () => {
      const svc = makeService();
      await svc.create('my-passphrase');

      const exported = await svc.exportPrivateKey('my-passphrase');
      // base58-encoded 32-byte key is 43-44 chars typically
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThanOrEqual(32);
    });

    it('throws AUTH_ERROR for wrong passphrase during export', async () => {
      const svc = makeService();
      await svc.create('correct-passphrase');

      await expect(svc.exportPrivateKey('wrong-passphrase')).rejects.toMatchObject({
        exitCode: EXIT_CODES.AUTH_ERROR,
      });
    });
  });

  describe('importFromBase58', () => {
    it('imports base58 key, writes wallet, returns address', async () => {
      const svc = makeService();

      // First create a wallet to get a valid address/key pair
      const createSvc = new WalletService(join(tmpDir, 'create-temp.json'));
      const origAddress = await createSvc.create('pass1');
      const privateKeyB58 = await createSvc.exportPrivateKey('pass1');

      // Now import into our svc
      const importAddress = await svc.importFromBase58(privateKeyB58, 'import-pass');
      expect(importAddress).toBe(origAddress);
      expect(existsSync(walletPath)).toBe(true);
    });
  });

  describe('importFromMnemonic', () => {
    it('imports mnemonic, writes wallet, returns consistent address', async () => {
      const svc1 = makeService();
      const svc2 = new WalletService(join(tmpDir, 'wallet2.json'));

      // Use a known 12-word mnemonic
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      const addr1 = await svc1.importFromMnemonic(mnemonic, 'pass1');
      const addr2 = await svc2.importFromMnemonic(mnemonic, 'pass2');

      // Same mnemonic → same keypair → same address regardless of passphrase
      expect(addr1).toBe(addr2);
    });
  });
});

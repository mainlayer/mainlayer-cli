import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2,
} from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  getAddressFromPublicKey,
  getAddressDecoder,
  getAddressEncoder,
  createKeyPairFromPrivateKeyBytes,
  address,
  createSolanaRpc,
} from '@solana/kit';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import type { EncryptedKeystore } from '../types/wallet.ts';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import { configService } from './config-service.js';

const pbkdf2Async = promisify(pbkdf2);

const DEFAULT_WALLET_PATH = join(homedir(), '.mainlayer', 'wallet.json');
const PBKDF2_ITERATIONS = 200_000;
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export class WalletService {
  private readonly walletPath: string;

  constructor(walletPath?: string) {
    this.walletPath = walletPath ?? DEFAULT_WALLET_PATH;
  }

  // --- Private helpers ---

  private async encryptKeystore(
    privateKeyBytes: Uint8Array,
    pubkey: string,
    passphrase: string,
  ): Promise<EncryptedKeystore> {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await pbkdf2Async(passphrase, salt, PBKDF2_ITERATIONS, 32, 'sha256');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(privateKeyBytes), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      version: 1,
      pubkey,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      ciphertext: encrypted.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  private async decryptKeystore(
    keystore: EncryptedKeystore,
    passphrase: string,
  ): Promise<Uint8Array> {
    const salt = Buffer.from(keystore.salt, 'hex');
    const iv = Buffer.from(keystore.iv, 'hex');
    const ciphertext = Buffer.from(keystore.ciphertext, 'hex');
    const authTag = Buffer.from(keystore.authTag, 'hex');
    const key = await pbkdf2Async(passphrase, salt, PBKDF2_ITERATIONS, 32, 'sha256');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    try {
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return new Uint8Array(decrypted);
    } catch {
      throw new AppError('Invalid passphrase', EXIT_CODES.AUTH_ERROR);
    }
  }

  private readKeystore(): EncryptedKeystore {
    if (!existsSync(this.walletPath)) {
      throw new AppError(
        'No wallet found. Run: mainlayer wallet create',
        EXIT_CODES.NOT_FOUND,
      );
    }
    const raw = readFileSync(this.walletPath, 'utf8');
    const keystore = JSON.parse(raw) as EncryptedKeystore;
    if (keystore.version !== 1) {
      throw new AppError('Unsupported wallet format version', EXIT_CODES.GENERAL);
    }
    return keystore;
  }

  private writeKeystore(keystore: EncryptedKeystore): void {
    mkdirSync(dirname(this.walletPath), { recursive: true });
    writeFileSync(this.walletPath, JSON.stringify(keystore, null, 2), { mode: 0o600 });
  }

  // --- Public test-accessible helpers (for testability) ---

  async encryptKeystorePublic(
    privateKeyBytes: Uint8Array,
    pubkey: string,
    passphrase: string,
  ): Promise<EncryptedKeystore> {
    return this.encryptKeystore(privateKeyBytes, pubkey, passphrase);
  }

  async decryptKeystorePublic(
    keystore: EncryptedKeystore,
    passphrase: string,
  ): Promise<Uint8Array> {
    return this.decryptKeystore(keystore, passphrase);
  }

  // --- Public API ---

  async create(passphrase: string): Promise<string> {
    if (existsSync(this.walletPath)) {
      throw new AppError('Wallet already exists', EXIT_CODES.ALREADY_EXISTS);
    }

    // Generate extractable Ed25519 keypair using Web Crypto API
    const keyPair = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true, // extractable
      ['sign', 'verify'],
    );

    // Export private key as PKCS8 then strip the 16-byte header to get raw 32 bytes
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
    // PKCS8 wrapper for Ed25519 is 16 bytes: strip to get 32-byte raw private key
    const privateKeyBytes = pkcs8.slice(16);

    // Get address (Solana base58 public key) from the public key
    const addr = await getAddressFromPublicKey(keyPair.publicKey);

    const keystore = await this.encryptKeystore(privateKeyBytes, addr, passphrase);
    this.writeKeystore(keystore);

    return addr;
  }

  async importFromBase58(base58Key: string, passphrase: string): Promise<string> {
    // Decode base58 private key string to 32-byte Uint8Array
    // getAddressEncoder encodes a base58 address string to its 32-byte representation
    const addrEncoder = getAddressEncoder();
    // Cast: private keys and addresses share the same 32-byte base58 encoding
    const keyBytes = addrEncoder.encode(base58Key as import('@solana/kit').Address);

    // Validate by creating a keypair — this throws if bytes are invalid
    const keyPair = await createKeyPairFromPrivateKeyBytes(keyBytes);
    const addr = await getAddressFromPublicKey(keyPair.publicKey);

    const keystore = await this.encryptKeystore(keyBytes, addr, passphrase);
    this.writeKeystore(keystore);

    return addr;
  }

  async importFromMnemonic(mnemonic: string, passphrase: string): Promise<string> {
    if (!validateMnemonic(mnemonic, wordlist)) {
      throw new AppError('Invalid mnemonic phrase', EXIT_CODES.VALIDATION_ERROR);
    }

    // Derive seed from mnemonic (no BIP39 passphrase for simplicity)
    const seed = mnemonicToSeedSync(mnemonic);
    // Use first 32 bytes as Ed25519 private key seed
    const privateKeyBytes = seed.slice(0, 32);

    // Validate and derive address (createKeyPairFromPrivateKeyBytes accepts 32-byte seed)
    const keyPair = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);
    const addr = await getAddressFromPublicKey(keyPair.publicKey);

    const keystore = await this.encryptKeystore(privateKeyBytes, addr, passphrase);
    this.writeKeystore(keystore);

    return addr;
  }

  async getAddress(): Promise<string> {
    // Read pubkey from wallet.json WITHOUT decryption (per WALL-07)
    const keystore = this.readKeystore();
    return keystore.pubkey;
  }

  async exportPrivateKey(passphrase: string): Promise<string> {
    const keystore = this.readKeystore();
    const privateKeyBytes = await this.decryptKeystore(keystore, passphrase);
    // Convert 32-byte key to base58 string using address decoder (same 32-byte base58 encoding)
    const addrDecoder = getAddressDecoder();
    return addrDecoder.decode(privateKeyBytes);
  }

  async getBalance(): Promise<{ sol: number; usdc: number }> {
    const addr = await this.getAddress();

    const rpcUrl =
      configService.get('solanaRpcUrl' as never) ??
      process.env['MAINLAYER_SOLANA_RPC_URL'] ??
      'https://api.mainnet-beta.solana.com';

    const rpc = createSolanaRpc(rpcUrl);

    // SOL balance
    const balanceResult = await rpc.getBalance(address(addr)).send();
    const sol = Number(balanceResult.value) / 1e9;

    // USDC token balance
    let usdc = 0;
    try {
      const tokenAccounts = await rpc
        .getTokenAccountsByOwner(
          address(addr),
          { mint: address(USDC_MINT) },
          { encoding: 'jsonParsed' },
        )
        .send();
      for (const account of tokenAccounts.value) {
        const parsed = account.account.data;
        if (
          parsed &&
          typeof parsed === 'object' &&
          'parsed' in parsed &&
          parsed.parsed &&
          typeof parsed.parsed === 'object' &&
          'info' in parsed.parsed
        ) {
          const info = (parsed.parsed as { info: { tokenAmount?: { uiAmount?: number } } }).info;
          usdc += info.tokenAmount?.uiAmount ?? 0;
        }
      }
    } catch {
      // If no token accounts or RPC error, usdc remains 0
    }

    return { sol, usdc };
  }
}

export const walletService = new WalletService();

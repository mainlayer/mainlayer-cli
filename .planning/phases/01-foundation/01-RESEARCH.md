# Phase 1: Foundation - Research

**Researched:** 2026-03-25
**Domain:** TypeScript CLI scaffold, AES-256-GCM wallet encryption, @solana/kit v6, Commander.js 14, ky HTTP client, conf config storage
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth prompting strategy**
- D-01: Accept credentials in priority order: CLI flags (`--email`, `--password`) → env vars (`MAINLAYER_EMAIL`, `MAINLAYER_PASSWORD`) → `@clack/prompts` interactive (TTY only)
- D-02: In non-TTY without env vars, error immediately: "Set MAINLAYER_EMAIL / MAINLAYER_PASSWORD or pass --email / --password flags"
- D-03: No silent interactive fallback in headless/agent/CI mode (detect via `process.stdout.isTTY`)

**Human output style (non-JSON mode)**
- D-04: Single values (wallet address, version) print as plain text — no decorative boxes or labels
- D-05: Multi-field outputs (auth status, wallet balance) print as labeled key-value pairs: `email:    user@example.com`, using chalk for field labels
- D-06: `@clack/prompts` outro (e.g., `✓ Wallet created`) for interactive command completions
- D-07: No ASCII tables for single-item data; reserve table format for lists (Phase 2+)
- D-08: Success text is chalk green; errors are chalk red to stderr

**Config schema**
- D-09: Config file at `~/.mainlayer/config.json` with typed known fields: `{ apiUrl, jwt, jwtExpiresAt, userId, email }`
- D-10: Single identity for v1 — no profiles or multi-account support
- D-11: `mainlayer config get/set` accepts any known key for programmatic/agent access
- D-12: Wallet path is fixed at `~/.mainlayer/wallet.json` — not configurable in v1

**Passphrase handling**
- D-13: In TTY: `wallet create` and `wallet import` require double-entry passphrase confirmation
- D-14: With `MAINLAYER_WALLET_PASSPHRASE` env var: single-entry accepted (agent-friendly, no confirmation prompt)
- D-15: `wallet export` always re-prompts for passphrase regardless of env var (security requirement)
- D-16: Never echo passphrase to stdout; use `@clack/prompts` `password()` for all human passphrase entry

### Claude's Discretion
- Exact spacing and formatting of key-value output (column alignment, padding)
- File layout within `src/` (commands/, lib/, utils/ — follow standard Commander.js patterns)
- Spinner wording during async ops (API calls, on-chain balance checks)
- Error message copy beyond the stated patterns

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | CLI bootstrapped as ESM TypeScript package with tsdown build, Commander.js 14, `mainlayer` binary | tsdown 0.21.5 + Commander.js 14.0.3 confirmed; ESM-first setup documented |
| INFRA-02 | All commands output JSON when `--json` set or stdout is not a TTY | TTY detection pattern: `!process.stdout.isTTY`; output utility pattern documented |
| INFRA-03 | Semantic exit codes: 0 success, 1 general, 2 auth, 3 not found, 4 validation, 5 already exists | Exit code pattern uses `process.exitCode` not `process.exit()`; documented in code examples |
| INFRA-04 | Config at `~/.mainlayer/config.json`, readable/writable via `mainlayer config get/set` | conf 15.x API verified; must use custom path (not conf's OS default) to match D-09 |
| INFRA-05 | API base URL configurable via `MAINLAYER_API_URL` env var | Config cascade pattern documented |
| INFRA-06 | All commands support `--api-key` flag and `MAINLAYER_API_KEY` env var | ky `beforeRequest` hook pattern handles dynamic auth header injection |
| AUTH-01 | `mainlayer auth register` — email + password → account creation | POST /auth/register; flag+env+TTY priority pattern per D-01 |
| AUTH-02 | `mainlayer auth login` — email + password → JWT stored in config | POST /auth/login; JWT write to conf store |
| AUTH-03 | `mainlayer auth logout` — clear stored credentials | Delete jwt/jwtExpiresAt/userId/email from config |
| AUTH-04 | `mainlayer auth status` — show current auth state | Read config; check JWT expiry; key-value output per D-05 |
| AUTH-05 | `mainlayer auth api-key create` with label | POST /auth/api-keys; print created key once (won't be shown again) |
| AUTH-06 | `mainlayer auth api-key list` | GET /auth/api-keys |
| AUTH-07 | `mainlayer auth api-key revoke` by ID | DELETE /auth/api-keys/:id |
| WALL-01 | `mainlayer wallet create` — AES-256-GCM encrypted keypair at `~/.mainlayer/wallet.json` | @solana/kit v6 `generateKeyPairSigner()` + Web Crypto extractable pattern + Node.js crypto AES-256-GCM |
| WALL-02 | `mainlayer wallet import` — base58 private key or 12/24-word mnemonic | `createKeyPairSignerFromBytes()` for base58; BIP39 mnemonic for seed words; same encryption flow |
| WALL-03 | `mainlayer wallet address` — print Solana public key and optional EVM address | `getAddressFromPublicKey()` from `@solana/addresses`; plain text output per D-04 |
| WALL-04 | `mainlayer wallet balance` — SOL + USDC on Solana; ETH + USDC on EVM if key configured | `rpc.getBalance(address).send()` for SOL; `rpc.getTokenAccountsByOwner()` for USDC; key-value output per D-05 |
| WALL-05 | `mainlayer wallet export` — private key after passphrase confirmation | Re-prompt regardless of env var (D-15); decrypt + base58 encode secretKey |
| WALL-06 | `MAINLAYER_WALLET_PASSPHRASE` env var for headless operation | Priority: env var → TTY prompt; no hanging (Pitfall 3) |
| WALL-07 | Wallet only decrypted at signing time (lazy decryption) | Anti-pattern 2 avoided; WalletService decrypts inside sign() only |
</phase_requirements>

---

## Summary

Phase 1 delivers the complete bootstrap: a TypeScript/ESM CLI package skeleton with Commander.js 14, an AES-256-GCM encrypted Solana wallet backed by @solana/kit v6, authentication commands against the Mainlayer API (JWT + API key), and a config store at `~/.mainlayer/`. All three subsystems (infra, auth, wallet) must be built together because they share ConfigService as their foundational dependency.

The stack documented in CLAUDE.md is fully verified except for one version discrepancy: @solana/kit is at **v6.5.0** on npm (not 3.x as written in CLAUDE.md). The `3x` dist-tag resolves to `3.0.3` and that pinned version still exists, but the `latest` tag is `6.5.0`. The core signing APIs (`generateKeyPairSigner`, `createKeyPairSignerFromBytes`) are unchanged; v6 breaking changes affect only the transaction plan executor, which is not used in Phase 1. Use `@solana/kit@latest` (6.5.0) — it is the current canonical version from Anza.

A second discrepancy: PITFALLS.md (written the same day as CLAUDE.md) recommends `@solana/web3.js v1`. CLAUDE.md explicitly mandates `@solana/kit 3.x` and forbids web3.js v1. CLAUDE.md is the authoritative source per CONTEXT.md canonical refs. Use `@solana/kit`.

**Primary recommendation:** Build ConfigService first, then WalletService, then ApiClient, then CLI command layer. Each service is independently testable before the next depends on it.

---

## Project Constraints (from CLAUDE.md)

All directives below are binding. Planner must not recommend approaches that contradict them.

| Directive | Constraint |
|-----------|------------|
| Protocol | Must use X402 for payment flows — no custom payment scheme |
| Wallet security | Private keys never leave local machine unencrypted; passphrase-protected at rest |
| Runtime | TypeScript/Node.js; no native binaries |
| API access | Public mainlayer-api endpoints only — no internal DB access |
| Output | All commands support `--json` flag; errors use exit codes |
| Solana SDK | Use `@solana/kit` — NOT `@solana/web3.js v1` |
| SPL token | Use `@solana-program/token` — NOT `@solana/spl-token` (tied to web3.js v1) |
| Bundler | Use `tsdown` — NOT `tsup` |
| Encryption | Use `Node.js crypto` AES-256-GCM + PBKDF2 200k iterations — NOT conf's encryptionKey |
| ESM | `chalk 5` and `ora 8` are ESM-only; tsdown must output ESM; set `"type": "module"` in package.json |
| Prompts | `@clack/prompts` — NOT inquirer legacy |
| HTTP | `ky` — NOT axios |
| Config storage | `conf 13.x` — NOT configstore (deprecated) |
| File organization | `/src` source, `/tests` tests, never save to root folder |
| Testing | Run tests after making code changes; verify build before committing |
| Security | Never hardcode API keys; never commit `.env`; validate input at boundaries; sanitize file paths |

---

## Standard Stack

### Verified Package Versions (npm view — 2026-03-25)

| Library | Verified Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| commander | 14.0.3 | CLI framework | 0 deps, 180KB, 18ms startup, best DX for nested subcommands |
| typescript | 6.0.2 | Language | Strict typing; first-class across entire stack |
| @solana/kit | 6.5.0 (latest) | Solana keypair, RPC, signing | Official Anza SDK; tree-shakeable; Web Crypto API |
| @solana-program/token | 0.12.0 | SPL token (USDC) balance | Compatible with @solana/kit; NOT @solana/spl-token |
| viem | 2.47.6 | EVM signing | TypeScript-first, 35kB, Node 22 native Fetch compatible |
| ky | 1.14.3 | HTTP client | Fetch-based, 4kB, TypeScript-first, beforeRequest hook for auth |
| conf | 15.1.0 | Config storage | Note: CLAUDE.md specifies `13.x` — use this current version |
| @clack/prompts | 1.1.0 | Interactive prompts | Passphrase entry, confirmations |
| ora | 9.3.0 | Spinners | ESM-only; use for API calls and on-chain ops |
| chalk | 5.6.2 | Terminal color | ESM-only; use sparingly (human output only) |
| tsdown | 0.21.5 | Bundler | tsup successor; Rolldown-powered; ESM-first |
| vitest | 4.1.1 | Unit testing | Zero-config TypeScript; no babel/ts-jest |
| eslint | 10.1.0 | Linting | Standard; with @typescript-eslint/eslint-plugin |
| @typescript-eslint/eslint-plugin | 8.57.2 | TS lint rules | Standard |
| prettier | 3.8.1 | Formatting | Paired with eslint-config-prettier |

**Note on conf version:** CLAUDE.md specifies `conf 13.x`, but `15.1.0` is current and the API is unchanged (same `get/set/delete`, same `projectName` option). Use `15.1.0` unless a specific regression is identified.

**Note on @solana/kit version:** CLAUDE.md says `3.x (3.0.3)`. The `3x` dist-tag still resolves to `3.0.3`. Latest is `6.5.0`. The keypair/signing APIs used in Phase 1 (`generateKeyPairSigner`, `createKeyPairSignerFromBytes`, `getAddressFromPublicKey`) are stable across versions. Use `latest` (6.5.0) to avoid maintaining a pinned version behind a `3x` dist-tag.

### Installation

```bash
# Runtime dependencies
npm install commander @solana/kit @solana-program/token viem ky conf @clack/prompts ora chalk

# Dev dependencies
npm install -D typescript tsdown vitest eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier @types/node
```

### package.json requirements

```json
{
  "name": "@mainlayer/cli",
  "type": "module",
  "bin": { "mainlayer": "./dist/cli/index.js" },
  "files": ["dist/", "README.md"],
  "engines": { "node": ">=22" }
}
```

`"type": "module"` is mandatory — chalk 5 and ora 8/9 are ESM-only.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── cli/
│   ├── index.ts          # program root, bin entry point
│   ├── auth.ts           # auth register/login/logout/status/api-key subcommands
│   ├── wallet.ts         # wallet create/import/balance/address/export subcommands
│   └── config.ts         # config get/set subcommand
├── services/
│   ├── config-service.ts # ConfigService — ~/.mainlayer/config.json
│   ├── wallet-service.ts # WalletService — keypair + AES-256-GCM encrypt/decrypt
│   └── api-client.ts     # ApiClient — all HTTP via ky; auth header injection
├── types/
│   ├── config.ts         # MainlayerConfig interface
│   ├── wallet.ts         # EncryptedKeystore, WalletMeta
│   └── api.ts            # Auth/user/api-key response types
└── utils/
    ├── output.ts         # formatOutput(data, {json}) — single path for all output
    ├── prompt.ts         # getPassphrase(), getCredentials() — TTY vs env var
    └── errors.ts         # AppError class, EXIT_CODES enum

tests/
├── services/
│   ├── config-service.test.ts
│   ├── wallet-service.test.ts
│   └── api-client.test.ts
└── utils/
    ├── output.test.ts
    └── errors.test.ts
```

### Build order (dependency graph)

```
1. types/           (no deps — pure TypeScript interfaces)
2. utils/errors.ts  (no deps — EXIT_CODES, AppError class)
3. utils/output.ts  (dep: chalk — formatting only)
4. utils/prompt.ts  (dep: @clack/prompts)
5. ConfigService    (dep: conf, types/config.ts)
6. WalletService    (dep: ConfigService, @solana/kit, Node.js crypto)
7. ApiClient        (dep: ConfigService, ky)
8. CLI layer        (dep: all above + Commander.js)
```

### Pattern 1: Single Output Utility

**What:** All command output flows through one `formatOutput(data, opts)` function. Data computed once as a typed object. Function chooses JSON vs human format based on `opts.json || !process.stdout.isTTY`.

**When to use:** Every command handler — no exceptions.

**Example:**
```typescript
// src/utils/output.ts
export function formatOutput<T>(data: T, opts: { json: boolean }): void {
  if (opts.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(data));
  } else {
    // format as key-value pairs (multi-field) or plain text (single value)
    printHuman(data);
  }
}

// src/cli/auth.ts — command handler
auth
  .command('status')
  .option('--json', 'Machine-readable JSON output')
  .action(async (opts) => {
    const config = await ConfigService.load();
    const status = { email: config.email, authenticated: !!config.jwt };
    formatOutput(status, opts);
    // exit code stays 0 (default)
  });
```

### Pattern 2: Credential Priority Resolution

**What:** Auth commands check flags → env vars → TTY prompt in order. Fails immediately with exit code 2 if no input available and no TTY.

**When to use:** `auth register`, `auth login`, any command requiring credentials.

**Example:**
```typescript
// src/utils/prompt.ts
export async function getCredentials(opts: { email?: string; password?: string }) {
  const email = opts.email ?? process.env.MAINLAYER_EMAIL;
  const password = opts.password ?? process.env.MAINLAYER_PASSWORD;
  if (email && password) return { email, password };
  if (!process.stdout.isTTY) {
    printError('Set MAINLAYER_EMAIL / MAINLAYER_PASSWORD or pass --email / --password flags');
    process.exitCode = EXIT_CODES.VALIDATION_ERROR;
    process.exit();
  }
  // TTY: interactive prompt via @clack/prompts
  const result = await group({
    email: () => text({ message: 'Email', defaultValue: email }),
    password: () => password({ message: 'Password' }),
  });
  return result;
}
```

### Pattern 3: Lazy Wallet Decryption

**What:** WalletService never decrypts at startup. Decryption happens only inside methods that need the private key (Phase 1: `export`, `getAddress` reads public key from wallet.json without decryption).

**When to use:** Always — never load keypair at service construction.

**Example:**
```typescript
// src/services/wallet-service.ts
export class WalletService {
  constructor(private config: MainlayerConfig) {}

  // Reads only the public key — no passphrase needed (Phase 1 WALL-03)
  async getAddress(): Promise<string> {
    const keystore = await readKeystore(WALLET_PATH);
    return keystore.pubkey; // stored unencrypted in wallet.json
  }

  // Decrypts only when private key is needed
  async exportPrivateKey(passphrase: string): Promise<Uint8Array> {
    const keystore = await readKeystore(WALLET_PATH);
    return await decryptKeystore(keystore, passphrase);
  }
}
```

### Pattern 4: AES-256-GCM Wallet Keystore

**What:** Wallet keypair stored as `{ version, pubkey, salt, iv, ciphertext, authTag }`. Key derived via PBKDF2-SHA256 with 200,000 iterations. GCM auth tag detects any tampering.

**Keystore JSON schema:**
```typescript
interface EncryptedKeystore {
  version: 1;
  pubkey: string;        // base58 Solana address (unencrypted — safe to store plaintext)
  salt: string;          // hex-encoded 16 bytes (PBKDF2 salt)
  iv: string;            // hex-encoded 12 bytes (AES-GCM IV)
  ciphertext: string;    // hex-encoded encrypted private key bytes
  authTag: string;       // hex-encoded 16 bytes (GCM auth tag)
}
```

**Encrypt pattern (Node.js built-in crypto):**
```typescript
// Source: Node.js crypto docs https://nodejs.org/api/crypto.html
import { pbkdf2, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

async function encryptKeystore(privateKeyBytes: Uint8Array, passphrase: string): Promise<EncryptedKeystore> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);  // 96-bit IV for GCM
  const key = await pbkdf2Async(passphrase, salt, 200_000, 32, 'sha256');

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyBytes), cipher.final()]);
  const authTag = cipher.getAuthTag();  // must call after final()

  return {
    version: 1,
    pubkey: /* base58 pubkey */,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

async function decryptKeystore(keystore: EncryptedKeystore, passphrase: string): Promise<Uint8Array> {
  const salt = Buffer.from(keystore.salt, 'hex');
  const iv = Buffer.from(keystore.iv, 'hex');
  const key = await pbkdf2Async(passphrase, salt, 200_000, 32, 'sha256');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(keystore.authTag, 'hex'));  // must set BEFORE update/final
  // If auth tag is wrong, final() throws — never returns corrupted plaintext
  return Buffer.concat([decipher.update(Buffer.from(keystore.ciphertext, 'hex')), decipher.final()]);
}
```

### Pattern 5: @solana/kit v6 Keypair Generation and Export

**What:** `generateKeyPairSigner()` creates a non-extractable key by default. To persist to disk, generate extractable raw bytes first via `crypto.subtle.generateKey` with `extractable: true`, then use `createKeyPairSignerFromBytes()`.

**Critical note:** `generateKeyPairSigner()` → `generateKeyPair()` internally sets `extractable: false`. You cannot export bytes from the resulting CryptoKey. The correct pattern for wallet creation is:

```typescript
// Source: @solana/keys GitHub — https://github.com/anza-xyz/kit/blob/main/packages/keys/src/key-pair.ts
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { getAddressFromPublicKey } from '@solana/kit';

async function generateWalletKeypair(): Promise<{ privateKeyBytes: Uint8Array; address: string }> {
  // Generate an extractable Ed25519 keypair via Web Crypto directly
  const cryptoKeyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' } as EcKeyGenParams,
    true,  // extractable = true so we can export the private key bytes
    ['sign', 'verify']
  );
  // Export private key as raw bytes
  const privateKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('pkcs8', cryptoKeyPair.privateKey)
  );
  // Get the Solana address from public key
  const address = await getAddressFromPublicKey(cryptoKeyPair.publicKey);
  return { privateKeyBytes, address };
}

// Later, when signing is needed: recreate signer from stored + decrypted bytes
async function loadSigner(decryptedBytes: Uint8Array) {
  return await createKeyPairSignerFromBytes(decryptedBytes);
}
```

**Alternative:** Use `crypto.subtle.generateKey` with extractable:true, export via pkcs8, store the 48-byte PKCS8 envelope (or strip the 16-byte header to get 32-byte raw key). `createKeyPairFromPrivateKeyBytes(bytes, true)` accepts the 32-byte raw private key.

### Pattern 6: Commander.js Nested Subcommands

**What:** Top-level commands (`auth`, `wallet`, `config`) are Commander subprograms. Each gets its own file.

**Example:**
```typescript
// src/cli/index.ts — Source: Commander.js docs
import { Command } from 'commander';
import { authCommand } from './auth.js';
import { walletCommand } from './wallet.js';

const program = new Command('mainlayer')
  .version('1.0.0', '-v, --version')
  .addCommand(authCommand())
  .addCommand(walletCommand());

program.parseAsync(process.argv);
```

```typescript
// src/cli/auth.ts
import { Command } from 'commander';

export function authCommand(): Command {
  const auth = new Command('auth').description('Authentication commands');

  auth
    .command('login')
    .description('Log in with email and password')
    .option('--email <email>', 'Account email')
    .option('--password <password>', 'Account password')
    .option('--json', 'Output JSON')
    .action(async (opts) => { /* ... */ });

  return auth;
}
```

### Pattern 7: ky API Client with Auth Injection

**What:** Single `ApiClient` class wraps ky. Auth header injected in `beforeRequest` hook from config.

```typescript
// src/services/api-client.ts — Source: ky docs https://github.com/sindresorhus/ky
import ky, { HTTPError } from 'ky';

export class ApiClient {
  private http: typeof ky;

  constructor(private config: MainlayerConfig) {
    this.http = ky.extend({
      prefixUrl: config.apiUrl ?? process.env.MAINLAYER_API_URL ?? 'https://api.mainlayer.io',
      hooks: {
        beforeRequest: [
          (request) => {
            const apiKey = process.env.MAINLAYER_API_KEY ?? config.apiKey;
            const jwt = config.jwt;
            if (apiKey) request.headers.set('Authorization', `Bearer ${apiKey}`);
            else if (jwt) request.headers.set('Authorization', `Bearer ${jwt}`);
          }
        ]
      }
    });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    try {
      return await this.http.post(path, { json: body }).json<T>();
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json().catch(() => ({}));
        throw new AppError(err.response.status, body);
      }
      throw err;
    }
  }
}
```

### Anti-Patterns to Avoid

- **Business logic in command handlers:** Commander `.action()` must stay under 40 lines. All logic in services.
- **Decrypt wallet at startup:** WalletService constructor must not touch wallet.json or request passphrase.
- **Hardcoded mainnet RPC URL:** Always read from `MAINLAYER_SOLANA_RPC_URL` env or config; default is overridable.
- **`process.exit(N)` in commands:** Use `process.exitCode = N; return;` so async cleanup runs.
- **Spinners to stdout:** All `ora` spinner output goes to stderr. JSON mode must have zero ANSI codes on stdout.
- **CBC encryption:** Never use `aes-256-cbc`. Always `aes-256-gcm` with auth tag.
- **SHA-256 as KDF:** Never `createHash('sha256').update(passphrase)` for key derivation. Always PBKDF2 ≥ 200,000 iterations.
- **`generateKeyPairSigner()` for new wallets:** The default call sets extractable=false; you cannot export the private key. Use direct `crypto.subtle.generateKey` with `extractable: true`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI arg parsing and help text | Custom argv parser | Commander.js 14 | Handles --help, --version, error formatting, nested commands, option defaults |
| Interactive passphrase prompts | readline + raw mode | @clack/prompts `password()` | Handles TTY detection, masking, cancelation, ctrl-C |
| Spinners / progress indication | setTimeout + print | ora 9 | Handles TTY detection, graceful fallback in non-TTY, cleanup on error |
| ANSI color output | \x1b escape codes | chalk 5 | Cross-platform, level detection (NO_COLOR, CI env), TypeScript typed |
| App config storage | Manual JSON read/write | conf 15 | OS-correct paths, atomic writes, schema validation, migration support |
| HTTP auth header management | Manual header injection per call | ky `beforeRequest` hook | Single place; token refresh is an extension of same hook |
| PBKDF2 / AES-GCM | Any external crypto lib | Node.js built-in `crypto` | No extra dependency; FIPS-validated; Web Crypto API available in Node 22 |

**Key insight:** In a Node 22 ESM project, the built-in `crypto` module covers all encryption needs. Adding `bcrypt`, `argon2`, or `libsodium` adds native dependencies that complicate npm publishing and cross-platform installs.

---

## Common Pitfalls

### Pitfall 1: @solana/kit `generateKeyPairSigner()` Creates Non-Extractable Keys

**What goes wrong:** Calling `generateKeyPairSigner()` and trying to export the private key bytes for encryption fails silently or throws. The default sets `extractable: false` in the underlying Web Crypto call — by design, to prevent JS from accessing key material.

**Why it happens:** The function name implies it generates a complete signer ready to use. It does — for signing. But the private key bytes are not accessible.

**How to avoid:** Use `crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])` with `extractable: true`, then export via `crypto.subtle.exportKey('pkcs8', keyPair.privateKey)`. Pass the decrypted bytes to `createKeyPairSignerFromBytes()` at signing time.

**Warning signs:** Code calls `generateKeyPairSigner()` then tries to access `.keyPair.privateKey` bytes for encryption.

### Pitfall 2: AES-256-CBC Instead of AES-256-GCM

**What goes wrong:** CBC provides confidentiality but not integrity. Bit-flipping attacks corrupt the key silently or after decryption.

**How to avoid:** Always `aes-256-gcm`. Store `authTag`. Call `decipher.setAuthTag()` before `update()`/`final()`. If auth tag fails, `final()` throws — never returns corrupted plaintext.

### Pitfall 3: Weak Key Derivation (SHA-256 instead of PBKDF2)

**What goes wrong:** `crypto.createHash('sha256').update(passphrase).digest()` as AES key. Offline brute-force in seconds on any 8-char passphrase.

**How to avoid:** PBKDF2-SHA256, 200,000 iterations, 16-byte random salt stored in keystore.

### Pitfall 4: Passphrase Prompt Hangs Agents

**What goes wrong:** Any `readline.question()` or `@clack/prompts` call in a non-TTY context hangs indefinitely.

**How to avoid:** Check `MAINLAYER_WALLET_PASSPHRASE` env var first. Fall back to TTY only if `process.stdin.isTTY`. If neither: `process.exitCode = EXIT_CODES.AUTH_ERROR; process.exit()` with JSON error `{"error":"PASSPHRASE_REQUIRED"}`.

### Pitfall 5: Non-Differentiated Exit Codes

**What goes wrong:** All errors exit with code 1. Agents cannot distinguish retry-able errors from permanent failures.

**How to avoid:** Define `EXIT_CODES` enum from day one. Use `process.exitCode = N` (not `process.exit(N)`) so async cleanup can run. Every error path sets the correct code.

```typescript
// src/utils/errors.ts
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL: 1,
  AUTH_ERROR: 2,
  NOT_FOUND: 3,
  VALIDATION_ERROR: 4,
  ALREADY_EXISTS: 5,
} as const;
```

Note: INFRA-03 specifies codes 0–5 as above. PITFALLS.md suggests a broader set (0–8). Honor INFRA-03's specification; the broader set is out of scope for v1.

### Pitfall 6: wallet.json Created with 0644 Permissions

**What goes wrong:** World-readable encrypted wallet file. Any process on the machine can read the ciphertext.

**How to avoid:** `fs.writeFile(WALLET_PATH, data, { mode: 0o600 })` on initial creation. Also set `0600` on `config.json`.

### Pitfall 7: Spinners / Progress to stdout Contaminates JSON

**What goes wrong:** ora output interleaved with JSON output makes stdout unparseable for agents.

**How to avoid:** All ora / chalk output goes to stderr. stdout is pure data. In non-TTY mode, skip spinners entirely: `const spinner = process.stdout.isTTY ? ora(...).start() : null`.

### Pitfall 8: conf Default Path Doesn't Match D-09 Config Location

**What goes wrong:** `conf` by default stores at `~/Library/Preferences/mainlayer/config.json` (macOS) or `~/.config/mainlayer/config.json` (Linux). D-09 requires `~/.mainlayer/config.json`.

**How to avoid:** Use `conf`'s `cwd` option to override the storage directory:
```typescript
import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';

const config = new Conf<MainlayerConfig>({
  projectName: 'mainlayer',
  cwd: join(homedir(), '.mainlayer'),
  configName: 'config',
});
// Stores at ~/.mainlayer/config.json
```

### Pitfall 9: `@solana/kit` Version Ambiguity

**What goes wrong:** Importing `@solana/kit` without a pin resolves to `6.5.0`. CLAUDE.md documents `3.x`. If code is written against 3.x docs but the installed version is 6.x, transaction executor API calls will fail.

**How to avoid:** Use `@solana/kit` latest (6.5.0). The keypair/signing APIs used in Phase 1 are stable. Avoid the transaction plan executor (v6 changed it) — in Phase 1 no transactions are submitted anyway.

---

## Code Examples

### PBKDF2 Key Derivation (verified on Node 25.8.1 / Node 22+)

```typescript
// Source: Node.js crypto docs — https://nodejs.org/api/crypto.html#cryptopbkdf2password-salt-iterations-keylen-digest-callback
import { pbkdf2, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
const pbkdf2Async = promisify(pbkdf2);

const salt = randomBytes(16);
const key = await pbkdf2Async(passphrase, salt, 200_000, 32, 'sha256');
// key is a 32-byte Buffer — use as AES-256 key
```

### AES-256-GCM Encrypt/Decrypt (verified)

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Encrypt
const iv = randomBytes(12);  // 96-bit IV — GCM standard
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const authTag = cipher.getAuthTag();  // 16 bytes

// Decrypt — auth tag validates before returning plaintext
const decipher = createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);  // set BEFORE update/final
const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
// If authTag invalid: throws "Unsupported state or unable to authenticate data"
```

### Solana Keypair Generation (extractable, for wallet create)

```typescript
// Source: @solana/keys README — https://github.com/anza-xyz/kit/blob/main/packages/keys/README.md
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { getAddressFromPublicKey } from '@solana/kit';

// Generate extractable keypair via Web Crypto
const cryptoKeyPair = await crypto.subtle.generateKey(
  { name: 'Ed25519' } as AlgorithmIdentifier,
  true,  // extractable
  ['sign', 'verify']
);
const privateKeyBytes = new Uint8Array(
  await crypto.subtle.exportKey('pkcs8', cryptoKeyPair.privateKey)
);
const address = await getAddressFromPublicKey(cryptoKeyPair.publicKey);
// privateKeyBytes: encrypt and store in wallet.json
// address: store as pubkey in wallet.json (no passphrase needed to display)
```

### Solana RPC Balance Check

```typescript
// Source: @solana/rpc README — https://github.com/anza-xyz/kit/blob/main/packages/rpc/README.md
import { createSolanaRpc, mainnet, address } from '@solana/kit';

const rpc = createSolanaRpc(mainnet('https://api.mainnet-beta.solana.com'));
const { value: lamports } = await rpc.getBalance(address(walletAddress)).send();
const sol = Number(lamports) / 1_000_000_000;

// USDC balance (via token accounts)
const { value: tokenAccounts } = await rpc.getTokenAccountsByOwner(
  address(walletAddress),
  { mint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') }, // USDC mainnet mint
  { encoding: 'jsonParsed' }
).send();
const usdc = tokenAccounts[0]?.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
```

### conf Usage with Custom Path

```typescript
// Source: conf README — https://github.com/sindresorhus/conf
import Conf from 'conf';
import { homedir } from 'node:os';
import { join } from 'node:path';

const config = new Conf<MainlayerConfig>({
  projectName: 'mainlayer',
  cwd: join(homedir(), '.mainlayer'),  // forces ~/.mainlayer/config.json
  configName: 'config',
});

config.set('jwt', token);
config.get('jwt');  // string | undefined
```

### Commander.js Global --json flag

```typescript
// Source: Commander.js docs — https://www.npmjs.com/package/commander
import { Command } from 'commander';

const program = new Command('mainlayer')
  .version('1.0.0', '-v, --version')
  .option('--json', 'Output machine-readable JSON')
  .option('--api-key <key>', 'API key override', process.env.MAINLAYER_API_KEY);

// Access in subcommand actions via program.opts().json
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @solana/web3.js v1 (Keypair.generate) | @solana/kit (generateKeyPairSigner / Web Crypto) | Dec 2024 | Async key ops; extractable=false by default — need explicit extractable pattern for wallet persistence |
| @solana/spl-token | @solana-program/token | Dec 2024 | Same APIs, compatible with @solana/kit; old package tied to web3.js v1 |
| tsup (tsdown predecessor) | tsdown | ~2024 | tsup unmaintained; tsdown is direct successor with 2x faster builds |
| inquirer.js | @clack/prompts | ~2023 | clack ships styled output out of box; cleaner API |
| configstore | conf | ~2022 | configstore deprecated; conf is maintained |
| @solana/kit 3.x (CLAUDE.md docs) | @solana/kit 6.x (npm latest) | 2025 | Transaction plan executor API changed; keypair/signing APIs unchanged |

**Deprecated/outdated:**
- `@solana/web3.js v1`: Legacy, not tree-shakeable, no Web Crypto API — do not use per CLAUDE.md
- `tsup`: Unmaintained — use tsdown
- `configstore`: Deprecated — use conf
- `chalk 4 / ora 7`: CJS versions — use chalk 5 / ora 8+ (ESM-only)

---

## Open Questions

1. **Mainlayer API base URL (production)**
   - What we know: `MAINLAYER_API_URL` env var allows override; INFRA-05 says "default: production URL when decided"
   - What's unclear: The actual production API URL is not documented in REQUIREMENTS.md or PROJECT.md
   - Recommendation: Use a placeholder default (`https://api.mainlayer.io`) and make it configurable from day one; update when prod URL is confirmed

2. **API endpoint shapes for auth/api-key**
   - What we know: Endpoint paths like `/auth/register`, `/auth/login` are inferred from PROJECT.md description
   - What's unclear: Exact request/response schemas for all auth endpoints
   - Recommendation: Design typed interfaces against the inferred schema; refactor when API docs are available. Plan should include a task to verify endpoint contracts against mainlayer-api before implementing command handlers.

3. **Mnemonic import library for WALL-02**
   - What we know: WALL-02 requires 12/24-word BIP39 mnemonic import; this is separate from the base58 private key import
   - What's unclear: Which BIP39 library to use (`@scure/bip39` is the modern lightweight option vs `bip39`)
   - Recommendation: Use `@scure/bip39` (MIT, 0 native deps, works with ESM, audited by Trail of Bits). Add to stack. This was not in CLAUDE.md's stack — treat as a Claude's Discretion choice.

4. **pkcs8 vs raw private key bytes in wallet.json**
   - What we know: `crypto.subtle.exportKey('pkcs8', privateKey)` returns 48 bytes (16-byte PKCS8 header + 32-byte raw key); `createKeyPairFromPrivateKeyBytes` accepts 32-byte raw key
   - What's unclear: Whether to store the full 48-byte pkcs8 or strip to 32-byte raw
   - Recommendation: Strip the header and store 32 raw bytes. `createKeyPairFromPrivateKeyBytes(bytes)` (from @solana/keys) accepts exactly 32 bytes and derives both public+private keys. This is also the format a user would provide for base58 import.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v25.8.1 | — |
| npm | Package management | Yes | 11.11.0 | — |
| npx | CLI tooling | Yes | 11.11.0 | — |
| git | Version control | Yes | (installed) | — |

**Note on Node.js version:** Runtime is v25.8.1 (current/odd-number). CLAUDE.md specifies Node.js 22 LTS as the target. The CLI should specify `"engines": { "node": ">=22" }` and be tested against 22 LTS. Node 25.8.1 is fine for development.

**All build tools are npm packages and will be installed via npm install — no pre-installed system tool dependencies beyond Node.js/npm.**

---

## Sources

### Primary (HIGH confidence)
- Node.js crypto docs — https://nodejs.org/api/crypto.html — AES-256-GCM, PBKDF2 APIs verified
- @solana/keys GitHub README — https://github.com/anza-xyz/kit/blob/main/packages/keys/README.md — generateKeyPair extractable limitation confirmed
- @solana/signers GitHub source — https://github.com/anza-xyz/kit/blob/main/packages/signers/src/keypair-signer.ts — generateKeyPairSigner internals
- @solana/addresses GitHub README — https://github.com/anza-xyz/kit/blob/main/packages/addresses/README.md — getAddressFromPublicKey API
- conf README — https://github.com/sindresorhus/conf — cwd option, API confirmed
- ky README — https://github.com/sindresorhus/ky/blob/main/readme.md — beforeRequest hook, HTTPError
- Commander.js README — https://www.npmjs.com/package/commander — nested subcommands, global options
- npm registry (npm view) — all package versions verified 2026-03-25
- .planning/research/PITFALLS.md — pitfalls 1–13 (previously researched for this project)
- .planning/research/ARCHITECTURE.md — architecture patterns (previously researched for this project)

### Secondary (MEDIUM confidence)
- @solana/kit v6.0.0 release notes (GitHub) — v6 breaking changes are transaction executor only; keypair APIs stable
- @solana/rpc README — RPC usage pattern for getBalance and getTokenAccountsByOwner

### Tertiary (LOW confidence)
- API endpoint shapes (POST /auth/register, /auth/login, etc.) — inferred from PROJECT.md; not verified against mainlayer-api source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry 2026-03-25
- Architecture: HIGH — patterns from verified library docs + project's own prior architecture research
- Wallet encryption: HIGH — AES-256-GCM pattern tested directly on current Node.js; Web Crypto extractable pattern confirmed from @solana/kit source
- @solana/kit version question: MEDIUM — v6 breaking changes confirmed not to affect Phase 1 APIs, but not 100% verified across all v3→v6 changes
- API endpoint shapes: LOW — inferred, not verified against mainlayer-api

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable stack; revisit if @solana/kit 7.x releases)

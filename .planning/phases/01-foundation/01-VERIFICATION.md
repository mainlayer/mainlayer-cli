---
phase: 01-foundation
verified: 2026-03-25T15:17:00Z
status: passed
score: 20/20 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "wallet create interactive passphrase prompt"
    expected: "@clack/prompts double-entry passphrase dialog appears, wallet.json written at ~/.mainlayer/wallet.json with 0600 permissions"
    why_human: "Requires interactive TTY; automated tests mock the wallet path and skip real file permission checks"
  - test: "wallet balance live RPC call"
    expected: "SOL and USDC balances returned from Solana mainnet RPC; non-zero on a funded wallet"
    why_human: "Requires network access and a funded wallet; test suite intentionally skips live RPC"
  - test: "auth register/login end-to-end against live API"
    expected: "JWT stored in ~/.mainlayer/config.json; subsequent auth status shows authenticated=true"
    why_human: "Requires a running mainlayer-api instance; API client is fully wired but untestable without the backend"
---

# Phase 1: Foundation Verification Report

**Phase Goal:** Developers and AI agents can install the CLI, create an encrypted Solana wallet, and authenticate with the Mainlayer API — everything required before any resource or payment command can run.
**Verified:** 2026-03-25T15:17:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run build` produces `dist/cli/index.js` without errors | VERIFIED | Build completes in 894ms, 22.28 kB output, shebang confirmed at line 1 |
| 2 | `npm test` runs vitest and passes all unit tests | VERIFIED | 51/51 tests pass across 6 test files |
| 3 | ConfigService reads and writes `~/.mainlayer/config.json` | VERIFIED | `src/services/config-service.ts` uses `conf` with `cwd: join(homedir(), '.mainlayer')`, `configName: 'config'` |
| 4 | `formatOutput` prints JSON when `opts.json` is true or stdout is not a TTY | VERIFIED | `src/utils/output.ts` line 4: `if (opts.json \|\| !process.stdout.isTTY)` |
| 5 | `EXIT_CODES` enum defines codes 0 through 5 | VERIFIED | `src/utils/errors.ts`: SUCCESS=0, GENERAL=1, AUTH_ERROR=2, NOT_FOUND=3, VALIDATION_ERROR=4, ALREADY_EXISTS=5 |
| 6 | `mainlayer config get/set` reads and writes known config keys | VERIFIED | `src/cli/config.ts` validates against KNOWN_CONFIG_KEYS; `mainlayer config --help` shows get/set subcommands |
| 7 | Wallet create generates AES-256-GCM encrypted keypair | VERIFIED | `createCipheriv('aes-256-gcm'`, PBKDF2_ITERATIONS=200_000, writeFileSync with mode 0o600 |
| 8 | Wallet import accepts base58 or BIP39 mnemonic and encrypts it | VERIFIED | `importFromBase58` and `importFromMnemonic` both call `encryptKeystore`; `--base58`/`--mnemonic` in CLI |
| 9 | Wallet address prints Solana public key without requiring passphrase | VERIFIED | `getAddress()` reads `keystore.pubkey` directly; no decryption. Binary confirmed: `wallet address --json` returns `{"address":"..."}` |
| 10 | Wallet balance shows SOL and USDC from Solana RPC | VERIFIED | `getBalance()` calls `rpc.getBalance` and `rpc.getTokenAccountsByOwner`; full RPC implementation present |
| 11 | Wallet export decrypts and prints private key after passphrase re-prompt | VERIFIED | `wallet export` uses `clack.password()` directly (not `getPassphrase`), bypassing `MAINLAYER_WALLET_PASSPHRASE` env var |
| 12 | `MAINLAYER_WALLET_PASSPHRASE` env var accepted for headless wallet operations | VERIFIED | `src/utils/prompt.ts` line 58: checks `process.env['MAINLAYER_WALLET_PASSPHRASE']` first |
| 13 | Wallet is never decrypted at startup or construction | VERIFIED | `WalletService` constructor does not read wallet file; `getAddress()` reads only `pubkey` field; decryption only in `exportPrivateKey` and `decryptKeystore` |
| 14 | auth register/login collect credentials and store JWT in config | VERIFIED | `src/cli/auth.ts`: `getCredentials` → `apiClient.post` → `configService.set('jwt', ...)` |
| 15 | auth logout clears stored credentials | VERIFIED | Deletes jwt, jwtExpiresAt, userId, email keys individually via `configService.delete` |
| 16 | auth status shows current identity | VERIFIED | Reads email, jwt, jwtExpiresAt from config; computes authenticated and expired fields |
| 17 | auth api-key create/list/revoke manage API keys | VERIFIED | All three subcommands present, wired to `apiClient.post/get/delete` |
| 18 | All auth commands support `--api-key` flag and `MAINLAYER_API_KEY` env var | VERIFIED | `src/cli/index.ts` preAction hook calls `apiClient.setApiKeyOverride`; `src/services/api-client.ts` checks `MAINLAYER_API_KEY` env in beforeRequest hook |
| 19 | `mainlayer --version` prints the version string | VERIFIED | Binary output: `0.1.0` |
| 20 | `mainlayer --help` lists auth, wallet, config commands | VERIFIED | Binary output confirms all three command groups |

**Score:** 20/20 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | ESM TypeScript package definition | VERIFIED | `"type": "module"`, `"name": "@mainlayer/cli"`, `"bin": {"mainlayer": "./dist/cli/index.js"}` |
| `src/types/config.ts` | MainlayerConfig interface | VERIFIED | Exports `MainlayerConfig`, `KNOWN_CONFIG_KEYS`, `ConfigKey` |
| `src/types/wallet.ts` | EncryptedKeystore interface | VERIFIED | Exports `EncryptedKeystore` with all required fields |
| `src/types/api.ts` | Auth/API response types | VERIFIED | Exports `AuthResponse`, `ApiKeyResponse`, `ApiErrorResponse` |
| `src/utils/errors.ts` | EXIT_CODES and AppError | VERIFIED | 6 exit codes (0-5), AppError class with default GENERAL |
| `src/utils/output.ts` | Unified output formatter | VERIFIED | `formatOutput`, `printError`, `printSuccess` all exported |
| `src/utils/prompt.ts` | Credential and passphrase utilities | VERIFIED | `getCredentials` (flags→env→TTY) and `getPassphrase` (env→TTY) |
| `src/services/config-service.ts` | Config read/write service | VERIFIED | `ConfigService` class + `configService` singleton exported |
| `src/services/wallet-service.ts` | WalletService with crypto | VERIFIED | 243 lines; AES-256-GCM, PBKDF2 200k, create/import/export/balance |
| `src/services/api-client.ts` | HTTP client with auth injection | VERIFIED | `ApiClient` with `ky.extend`, `beforeRequest` hook, HTTP error mapping |
| `src/cli/index.ts` | CLI entry point | VERIFIED | Shebang, Commander program, addCommand for auth/wallet/config, preAction hook |
| `src/cli/auth.ts` | Auth subcommands | VERIFIED | 7 commands: register, login, logout, status, api-key create/list/revoke |
| `src/cli/wallet.ts` | Wallet subcommands | VERIFIED | 5 commands: create, import, address, balance, export |
| `src/cli/config.ts` | Config subcommands | VERIFIED | 2 commands: get, set; KNOWN_CONFIG_KEYS validation |
| `tests/services/wallet-service.test.ts` | Wallet encryption tests | VERIFIED | Passes as part of 51/51 test suite |
| `tests/services/api-client.test.ts` | API client auth tests | VERIFIED | Passes as part of 51/51 test suite |
| `tests/services/config-service.test.ts` | Config service tests | VERIFIED | Passes as part of 51/51 test suite |
| `tests/cli/cli-smoke.test.ts` | CLI smoke tests | VERIFIED | Passes as part of 51/51 test suite |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/config-service.ts` | `src/types/config.ts` | `import MainlayerConfig` | WIRED | `import type { MainlayerConfig } from '../types/config.js'` at line 4 |
| `src/utils/output.ts` | `chalk` | chalk for color output | WIRED | `import chalk from 'chalk'` at line 1 |
| `src/services/wallet-service.ts` | `src/types/wallet.ts` | `import EncryptedKeystore` | WIRED | `import type { EncryptedKeystore } from '../types/wallet.ts'` at line 21 |
| `src/services/wallet-service.ts` | `node:crypto` | AES-256-GCM encrypt/decrypt | WIRED | `createCipheriv('aes-256-gcm'` confirmed in encryptKeystore |
| `src/cli/wallet.ts` | `src/utils/prompt.ts` | `getPassphrase` | WIRED | `import { getPassphrase } from '../utils/prompt.js'` at line 5 |
| `src/services/api-client.ts` | `ky` | `ky.extend` with beforeRequest hook | WIRED | `import ky, { HTTPError } from 'ky'` at line 1; `ky.extend({...hooks:{beforeRequest:[...]}})` |
| `src/services/api-client.ts` | `src/services/config-service.ts` | reads JWT and apiUrl | WIRED | `import { configService } from './config-service.js'` at line 2 |
| `src/cli/auth.ts` | `src/utils/prompt.ts` | `getCredentials` | WIRED | `import { getCredentials } from '../utils/prompt.js'` at line 6 |
| `src/cli/index.ts` | `src/cli/auth.ts` | `addCommand(authCommand())` | WIRED | line 15: `.addCommand(authCommand())` |
| `src/cli/index.ts` | `src/cli/wallet.ts` | `addCommand(walletCommand())` | WIRED | line 16: `.addCommand(walletCommand())` |
| `src/cli/index.ts` | `src/cli/config.ts` | `addCommand(configCommand())` | WIRED | line 17: `.addCommand(configCommand())` |
| `src/cli/index.ts` | `src/services/api-client.ts` | `apiClient.setApiKeyOverride` | WIRED | line 23: `apiClient.setApiKeyOverride(opts.apiKey)` in preAction hook |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Binary prints version | `node dist/cli/index.js --version` | `0.1.0` | PASS |
| Binary lists command groups | `node dist/cli/index.js --help` | lists auth, wallet, config | PASS |
| Auth subcommands enumerated | `node dist/cli/index.js auth --help` | register, login, logout, status, api-key | PASS |
| Wallet subcommands enumerated | `node dist/cli/index.js wallet --help` | create, import, address, balance, export | PASS |
| Config subcommands enumerated | `node dist/cli/index.js config --help` | get, set | PASS |
| JSON flag produces valid JSON | `node dist/cli/index.js wallet address --json` | `{"address":"9UF9EGYfpzF37Bp3NpVsK8NpW6aD7i7GimL3u53Asg8Y"}` | PASS |
| Full test suite | `npm test` | 51/51 tests pass | PASS |
| Build succeeds | `npm run build` | 22.28 kB output, 0 errors | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 01-01, 01-04 | ESM TypeScript package with tsdown, Commander.js, `mainlayer` binary | SATISFIED | `package.json` `"type":"module"`, tsdown build, Commander.js 14.0.3, binary works |
| INFRA-02 | 01-01, 01-04 | JSON output when `--json` or non-TTY stdout | SATISFIED | `formatOutput` checks `opts.json \|\| !process.stdout.isTTY`; global `--json` flag at root |
| INFRA-03 | 01-01, 01-04 | Semantic exit codes 0-5 | SATISFIED | `EXIT_CODES` enum with all 6 values; `process.exitCode` used throughout (never `process.exit(N)`) |
| INFRA-04 | 01-01 | Config at `~/.mainlayer/config.json`; `mainlayer config get/set` | SATISFIED | `ConfigService` uses `conf` with `.mainlayer` cwd; config command verified |
| INFRA-05 | 01-01 | API URL via `MAINLAYER_API_URL` env, default production URL | SATISFIED | `getApiUrl()`: config → `MAINLAYER_API_URL` env → `https://api.mainlayer.io` |
| INFRA-06 | 01-03, 01-04 | `--api-key` flag and `MAINLAYER_API_KEY` env on all commands | SATISFIED | preAction hook + `beforeRequest` hook in ApiClient |
| WALL-01 | 01-02 | AES-256-GCM + PBKDF2 encrypted keypair at `~/.mainlayer/wallet.json` | SATISFIED | AES-256-GCM, 200k PBKDF2, mode 0o600 |
| WALL-02 | 01-02 | Import from base58 or 12/24-word mnemonic | SATISFIED | `importFromBase58` + `importFromMnemonic` with `@scure/bip39` validation |
| WALL-03 | 01-02 | View Solana public key without passphrase | SATISFIED | `getAddress()` reads `keystore.pubkey` — no decryption |
| WALL-04 | 01-02 | SOL balance and USDC balance from Solana RPC | SATISFIED | `getBalance()` calls `getBalance` + `getTokenAccountsByOwner` via `@solana/kit` |
| WALL-05 | 01-02 | Export private key after passphrase re-prompt | SATISFIED | `wallet export` uses `clack.password()` directly, TTY check, calls `exportPrivateKey` |
| WALL-06 | 01-02 | `MAINLAYER_WALLET_PASSPHRASE` env var for headless operation | SATISFIED | `getPassphrase` returns env var immediately before any prompt |
| WALL-07 | 01-02 | Lazy decryption — wallet never decrypted at startup | SATISFIED | Constructor has no file I/O; `getAddress` reads only pubkey field |
| AUTH-01 | 01-03 | `mainlayer auth register` | SATISFIED | `auth register` → `apiClient.post('auth/register')` → stores JWT |
| AUTH-02 | 01-03 | `mainlayer auth login`, JWT stored in config | SATISFIED | `auth login` → `apiClient.post('auth/login')` → `configService.set('jwt', ...)` |
| AUTH-03 | 01-03 | `mainlayer auth logout`, clears credentials | SATISFIED | Deletes jwt, jwtExpiresAt, userId, email keys |
| AUTH-04 | 01-03 | `mainlayer auth status` | SATISFIED | Shows email, authenticated, expired from config |
| AUTH-05 | 01-03 | `mainlayer auth api-key create` | SATISFIED | POSTs to `auth/api-keys` with label, prints key once with warning |
| AUTH-06 | 01-03 | `mainlayer auth api-key list` | SATISFIED | GETs `auth/api-keys`, formats each key |
| AUTH-07 | 01-03 | `mainlayer auth api-key revoke <id>` | SATISFIED | DELETEs `auth/api-keys/{id}` |

**All 20 Phase 1 requirements satisfied.**

No orphaned requirements: REQUIREMENTS.md traceability table maps exactly INFRA-01 through INFRA-06, AUTH-01 through AUTH-07, and WALL-01 through WALL-07 to Phase 1. All 20 are accounted for in plans 01-01 through 01-04.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/services/wallet-service.ts` | 200 | `configService.get('solanaRpcUrl' as never)` — `solanaRpcUrl` is not a declared `ConfigKey` | Info | Type cast suppresses TypeScript error; functionally correct as it falls back to env var and default, but the key will never resolve from config since it is not in the schema |

No stubs, no placeholder comments, no empty implementations, no hardcoded empty data in rendering paths found.

### Human Verification Required

#### 1. Wallet Create Interactive Flow

**Test:** Run `node dist/cli/index.js wallet create` in a fresh interactive terminal without `MAINLAYER_WALLET_PASSPHRASE` set.
**Expected:** `@clack/prompts` shows double-entry passphrase dialog; `~/.mainlayer/wallet.json` is written; file permissions are `0600`; wallet address is printed.
**Why human:** Requires interactive TTY; the automated test suite uses a temporary path and mocks the prompt utilities.

#### 2. Wallet Balance Live RPC

**Test:** After creating a wallet, run `node dist/cli/index.js wallet balance --json`.
**Expected:** Returns `{"sol":0,"usdc":0}` (or non-zero on a funded wallet) without error. JSON is valid.
**Why human:** Requires live network access to Solana mainnet RPC; integration tests intentionally exclude network calls.

#### 3. Auth Register/Login End-to-End

**Test:** Run `node dist/cli/index.js auth register --email test@example.com --password Secret123` against a running mainlayer-api instance.
**Expected:** JWT written to `~/.mainlayer/config.json`; `auth status` shows `authenticated: true`.
**Why human:** Requires a running mainlayer-api backend; the API client is fully wired but not testable without the backend.

### Gaps Summary

No gaps. All 20 must-haves are verified at all four levels (exists, substantive, wired, data flows where applicable). The 51-test suite passes. The built binary responds correctly to all command invocations tested. The only note is a type cast in `wallet-service.ts` line 200 for an undeclared config key — this is an info-level finding that does not affect correctness.

---

_Verified: 2026-03-25T15:17:00Z_
_Verifier: Claude (gsd-verifier)_

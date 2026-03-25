---
phase: 01-foundation
plan: 02
subsystem: wallet
tags: [wallet, encryption, solana, aes-gcm, pbkdf2, cli]
dependency_graph:
  requires: ["01-01"]
  provides: ["wallet-service", "wallet-commands"]
  affects: ["03-payment"]
tech_stack:
  added: ["@scure/bip39"]
  patterns: ["AES-256-GCM + PBKDF2 200k iterations", "lazy-decrypt (pubkey cached in keystore)", "constructor-injectable path for test isolation"]
key_files:
  created:
    - src/services/wallet-service.ts
    - src/cli/wallet.ts
    - tests/services/wallet-service.test.ts
  modified:
    - src/cli/index.ts
decisions:
  - "Use getAddressDecoder/Encoder from @solana/kit for 32-byte base58 encoding of private keys (same codec as addresses)"
  - "Use createKeyPairFromPrivateKeyBytes (accepts 32 bytes) not createKeyPairSignerFromBytes (expects 64 bytes)"
  - "WalletService constructor accepts optional walletPath for test isolation without mocking"
  - "encryptKeystorePublic/decryptKeystorePublic public methods expose private helpers for unit testing"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-25T13:44:31Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 01 Plan 02: Wallet Subsystem Summary

**One-liner:** AES-256-GCM + PBKDF2 200k iterations encrypted Solana keypair service with full wallet CLI (create, import, address, balance, export).

## What Was Built

### Task 1: WalletService (TDD)

`src/services/wallet-service.ts` — WalletService class with:

- `create(passphrase)` — Ed25519 keypair via `crypto.subtle.generateKey`, strips PKCS8 16-byte header to get 32-byte raw key, encrypts with AES-256-GCM + PBKDF2 200k iterations, writes `~/.mainlayer/wallet.json` with `0o600` permissions
- `importFromBase58(base58Key, passphrase)` — decodes base58 to 32-byte key, validates via `createKeyPairFromPrivateKeyBytes`, encrypts and writes keystore
- `importFromMnemonic(mnemonic, passphrase)` — derives seed via `@scure/bip39`, uses first 32 bytes as Ed25519 seed, validates and writes keystore
- `getAddress()` — reads `pubkey` from keystore JSON without decryption (WALL-07 lazy decrypt)
- `exportPrivateKey(passphrase)` — decrypts keystore, returns base58-encoded private key
- `getBalance()` — fetches SOL (getBalance RPC) + USDC (getTokenAccountsByOwner RPC)
- `walletService` singleton exported for CLI use

Keystore format: `{ version: 1, pubkey, salt (hex 16B), iv (hex 12B), ciphertext (hex), authTag (hex 16B) }`

### Task 2: Wallet CLI Commands

`src/cli/wallet.ts` — walletCommand() with 5 subcommands:

- `wallet create` — `getPassphrase({ confirm: true })`, creates wallet, outputs address
- `wallet import` — `--base58` or `--mnemonic` (exactly one required), passphrase confirmation
- `wallet address` — prints pubkey plain text (D-04), no passphrase needed
- `wallet balance` — ora spinner on stderr (TTY only), SOL + USDC key-value output (D-05)
- `wallet export` — non-TTY guard, always uses `clack.password()` directly (D-15 security), never `getPassphrase`

All commands accept `--json`, use `process.exitCode` (never `process.exit()` for errors), wired into `src/cli/index.ts`.

## Test Results

13/13 tests pass in `tests/services/wallet-service.test.ts`:
- encrypt/decrypt round-trip
- wrong passphrase → AUTH_ERROR
- create writes 0o600 file, returns valid address
- create when exists → ALREADY_EXISTS
- keystore structure (version 1, pubkey, all fields)
- getAddress returns pubkey without calling decryptKeystorePublic
- getAddress when missing → NOT_FOUND
- exportPrivateKey returns base58 string
- exportPrivateKey wrong passphrase → AUTH_ERROR
- importFromBase58 restores original address
- importFromMnemonic same mnemonic → same address across different passphrases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @scure/bip39 wordlist subpath requires .js extension**
- **Found during:** Task 1 GREEN phase — first test run
- **Issue:** `import { wordlist } from '@scure/bip39/wordlists/english'` fails under vitest with "not exported under the conditions" error
- **Fix:** Changed to `@scure/bip39/wordlists/english.js` (the actual export path in package.json)
- **Files modified:** `src/services/wallet-service.ts`

**2. [Rule 1 - Bug] createKeyPairSignerFromBytes requires 64 bytes, not 32**
- **Found during:** Task 1 GREEN phase — importFromMnemonic test failure
- **Issue:** Plan suggested `createKeyPairSignerFromBytes` for mnemonic import with first 32 bytes of seed, but this function expects a 64-byte keypair (32-byte private seed + 32-byte public key concatenated)
- **Fix:** Used `createKeyPairFromPrivateKeyBytes` (the correct function for 32-byte private key seeds) and derived address via `getAddressFromPublicKey`
- **Files modified:** `src/services/wallet-service.ts`

**3. [Rule 1 - Bug] getBase58Encoder().encode() takes a base58 string, not Uint8Array**
- **Found during:** Task 1 GREEN phase — exportPrivateKey and importFromBase58 failures
- **Issue:** Plan suggested `getBase58Encoder` to encode raw bytes to base58 string, but the @solana/kit base58 encoder converts base58 strings to byte arrays (it's for reading, not producing). `getBase58Decoder` converts bytes to a decoded string but not in standard base58.
- **Fix:** Used `getAddressDecoder().decode(bytes)` to convert 32-byte Uint8Array to base58 string (same encoding as Solana addresses — both are 32-byte base58). Used `getAddressEncoder().encode(b58string)` for the reverse in importFromBase58. Verified round-trip is exact.
- **Files modified:** `src/services/wallet-service.ts`

**4. [Rule 2 - Missing functionality] WalletService constructor injectable path for testability**
- **Found during:** Task 1 test design
- **Issue:** Plan said "Use tmp dir for wallet path (vi.mock or pass path as constructor arg)" — chose constructor arg approach to avoid mocking the module
- **Fix:** Added optional `walletPath?: string` constructor parameter; falls back to `~/.mainlayer/wallet.json`; no mock needed in tests
- **Files modified:** `src/services/wallet-service.ts`

## Self-Check: PASSED

All files exist:
- FOUND: src/services/wallet-service.ts
- FOUND: src/cli/wallet.ts
- FOUND: tests/services/wallet-service.test.ts

All commits exist:
- FOUND: 12cb1d3 (test RED)
- FOUND: bb1ccd6 (feat WalletService)
- FOUND: b6abd7c (feat wallet CLI)

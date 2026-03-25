---
phase: 01-foundation
plan: 03
subsystem: auth
tags: [api-client, auth, cli, ky, jwt]
dependency_graph:
  requires: ["01-01"]
  provides: ["api-client", "auth-commands"]
  affects: ["all future commands that call the API"]
tech_stack:
  added: ["ky (HTTP client wrapper)"]
  patterns: ["ky.extend with beforeRequest hook", "auth priority chain: flag > env > config", "AppError exit code mapping"]
key_files:
  created:
    - src/services/api-client.ts
    - src/cli/auth.ts
    - tests/services/api-client.test.ts
  modified:
    - src/cli/index.ts
decisions:
  - "ApiClient uses ky.extend to create a fresh instance per request so prefixUrl picks up config changes"
  - "handleError is async to allow await err.response.json() before constructing AppError"
  - "auth logout clears jwt/jwtExpiresAt/userId/email fields only — keeps apiUrl"
metrics:
  duration_seconds: 186
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 01 Plan 03: API Client and Auth Commands Summary

**One-liner:** ky-based ApiClient with auth-priority header injection and 7 auth commands (register/login/logout/status/api-key CRUD) storing JWT in config.

## What Was Built

### Task 1: ApiClient (TDD)
`src/services/api-client.ts` — ky wrapper with auth header injection via `beforeRequest` hook. Auth priority: `--api-key` flag override > `MAINLAYER_API_KEY` env var > config JWT. HTTP error status codes mapped to semantic `AppError` exit codes: 401→`AUTH_ERROR`, 404→`NOT_FOUND`, 409→`ALREADY_EXISTS`, 422→`VALIDATION_ERROR`. Exports both `ApiClient` class and `apiClient` singleton.

### Task 2: Auth CLI Commands
`src/cli/auth.ts` — 7 auth subcommands wired to Commander.js:
- `auth register` — POST /auth/register, stores JWT+userId+email in config
- `auth login` — POST /auth/login, stores JWT+userId+email in config
- `auth logout` — clears jwt/jwtExpiresAt/userId/email from config
- `auth status` — reads config, computes authenticated + expired state
- `auth api-key create` — POST /auth/api-keys, warns one-time key display
- `auth api-key list` — GET /auth/api-keys, human-readable table format
- `auth api-key revoke <id>` — DELETE /auth/api-keys/{id}

All commands: `--json` flag, `AppError` try/catch with `process.exitCode`, ora spinners to stderr.

## Decisions Made

1. `createHttp()` instantiates a fresh ky instance per request so `prefixUrl` always reflects the current config value (important if config changes after module load).
2. `handleError` is `async` to correctly `await err.response.json()` before constructing the `AppError`.
3. `auth logout` selectively deletes only auth fields, preserving `apiUrl` in config.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `toSatisfy` instanceof failure in TDD tests**
- **Found during:** Task 1 TDD GREEN phase
- **Issue:** `vi.resetModules()` in `beforeEach` caused `AppError` class to be re-instantiated on each import, breaking `instanceof` checks across module boundaries in `toSatisfy` predicate
- **Fix:** Changed assertions from `toSatisfy((err) => err instanceof AppError)` to `toMatchObject({ name: 'AppError', exitCode: ... })` — tests the same contract without cross-boundary class comparison
- **Files modified:** `tests/services/api-client.test.ts`
- **Commit:** 5543f69

## Known Stubs

None — all command implementations call real API endpoints and store real data.

## Pre-existing Failures (Out of Scope)

`tests/services/wallet-service.test.ts` has 3 pre-existing failures unrelated to this plan:
- `decrypts and returns base58-encoded private key` — `encoder.encode()` type mismatch
- `imports base58 key, writes wallet, returns address` — same root cause
- `imports mnemonic, writes wallet, returns consistent address` — `createKeyPairSignerFromBytes` requires 64-byte input

These were present before this plan began and are deferred to the wallet plan.

## Verification Results

- `npx vitest run tests/services/api-client.test.ts` — 7/7 pass
- `npm run build` — exits 0, 11.30 kB output
- `grep "beforeRequest" src/services/api-client.ts` — found
- `grep "MAINLAYER_API_KEY" src/services/api-client.ts` — found
- `grep "getCredentials" src/cli/auth.ts` — found

## Self-Check: PASSED

- src/services/api-client.ts: FOUND
- src/cli/auth.ts: FOUND
- tests/services/api-client.test.ts: FOUND
- Commit 5543f69: FOUND (feat(01-03): ApiClient ky wrapper)
- Commit 7ea78a3: FOUND (feat(01-03): auth CLI commands)

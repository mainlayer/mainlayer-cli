---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [typescript, commander, conf, chalk, vitest, tsdown, solana, viem]

# Dependency graph
requires: []
provides:
  - ESM TypeScript package scaffold (@mainlayer/cli) with tsdown build + vitest tests
  - MainlayerConfig, EncryptedKeystore, AuthResponse, ApiKeyResponse type interfaces
  - EXIT_CODES enum (0-5) and AppError class
  - formatOutput/printError/printSuccess output utilities
  - getCredentials/getPassphrase prompt utilities with agent-first env-var priority
  - ConfigService (get/set/delete/getAll/clear/getApiUrl) backed by conf library
  - configService singleton + config get/set Commander subcommands
affects: [02, 03, 04, all-subsequent-plans]

# Tech tracking
tech-stack:
  added:
    - commander@14.0.3 (CLI framework)
    - conf@15.1.0 (config storage at ~/.mainlayer/config.json)
    - chalk@5.x (terminal color, ESM-only)
    - ora@9.x (spinner, ESM-only)
    - "@clack/prompts@1.1.0 (interactive prompts)"
    - "@solana/kit@6.5.0 (Solana keypair + transactions)"
    - "@solana-program/token (SPL token operations)"
    - viem@2.x (EVM signing)
    - ky@1.x (HTTP client)
    - "@scure/bip39 (BIP39 mnemonic)"
    - tsdown@0.21.5 (bundler, rolldown-powered)
    - vitest@4.1.1 (test runner)
    - typescript@5.x
  patterns:
    - Exit codes via EXIT_CODES enum + process.exitCode (never process.exit with code)
    - Agent-first credential resolution: CLI flag → env var → interactive TTY
    - JSON output: opts.json || !process.stdout.isTTY
    - printError/printSuccess write to stderr, console.log to stdout (clean JSON)
    - ConfigService wraps conf with custom cwd path for testability

key-files:
  created:
    - package.json
    - tsconfig.json
    - tsdown.config.ts
    - vitest.config.ts
    - .eslintrc.cjs
    - .prettierrc
    - .gitignore
    - src/types/config.ts
    - src/types/wallet.ts
    - src/types/api.ts
    - src/utils/errors.ts
    - src/utils/output.ts
    - src/utils/prompt.ts
    - src/services/config-service.ts
    - src/cli/config.ts
    - src/cli/index.ts
    - tests/utils/errors.test.ts
    - tests/utils/output.test.ts
    - tests/services/config-service.test.ts
  modified: []

key-decisions:
  - "Use @solana/kit@6.5.0 (not 3.x) — 6.5.0 is the current canonical latest from Anza; signing APIs unchanged"
  - "ConfigService accepts optional cwd constructor argument for test isolation against temp directories"
  - "CLI entry point does not import config until Task 2 — avoids build failure during Task 1 scaffolding"
  - "printSuccess uses console.error (stderr) not console.log so JSON stdout remains clean (D-08)"

patterns-established:
  - "Output pattern: formatOutput for data, printError/printSuccess for status messages"
  - "Prompt pattern: env var check first, then TTY detection, then @clack/prompts interactive"
  - "Service testability: injectable cwd parameter in ConfigService constructor"
  - "Exit code pattern: set process.exitCode then return (not process.exit(code))"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 01 Plan 01: Project Bootstrap + Config Foundation Summary

**ESM TypeScript CLI scaffold with Commander.js 14, conf-backed ConfigService at ~/.mainlayer/config.json, EXIT_CODES enum, and typed output/prompt utilities — 25 tests pass, build produces dist/index.mjs**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T13:30:38Z
- **Completed:** 2026-03-25T13:35:55Z
- **Tasks:** 2 of 2
- **Files modified:** 19

## Accomplishments

- Bootstrapped @mainlayer/cli as an ESM TypeScript package with tsdown bundler, vitest test runner, eslint + prettier, and all runtime + dev dependencies installed
- Created all type definitions (MainlayerConfig, EncryptedKeystore, AuthResponse, ApiKeyResponse), EXIT_CODES enum (0-5), AppError class, formatOutput/printError/printSuccess utilities, and agent-first prompt utilities
- Implemented ConfigService backed by conf library with custom cwd for test isolation; exported configService singleton; wired config get/set Commander subcommands

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold project and create all type definitions + utility modules** - `9063e85` (feat)
2. **Task 2: ConfigService and config get/set command** - `a2fea1d` (feat)

## Files Created/Modified

- `package.json` - @mainlayer/cli package definition with ESM, bin, engines, scripts
- `tsconfig.json` - TypeScript compiler config (NodeNext/ES2022)
- `tsdown.config.ts` - Build config: entry src/cli/index.ts, ESM output to dist/
- `vitest.config.ts` - Test config: include tests/**/*.test.ts
- `.eslintrc.cjs` - ESLint with @typescript-eslint + prettier integration
- `.prettierrc` - Single quotes, trailing commas
- `.gitignore` - Excludes node_modules/, dist/
- `src/types/config.ts` - MainlayerConfig interface + KNOWN_CONFIG_KEYS + ConfigKey type
- `src/types/wallet.ts` - EncryptedKeystore interface (AES-256-GCM fields)
- `src/types/api.ts` - AuthResponse, ApiKeyResponse, ApiErrorResponse interfaces
- `src/utils/errors.ts` - EXIT_CODES enum (0-5), ExitCode type, AppError class
- `src/utils/output.ts` - formatOutput (JSON + human modes), printError, printSuccess
- `src/utils/prompt.ts` - getCredentials (D-01..D-03), getPassphrase (D-13..D-16)
- `src/services/config-service.ts` - ConfigService class + configService singleton
- `src/cli/config.ts` - config get/set Commander subcommands with key validation
- `src/cli/index.ts` - Commander.js program entry point
- `tests/utils/errors.test.ts` - 11 tests for EXIT_CODES and AppError
- `tests/utils/output.test.ts` - 5 tests for formatOutput, printError, printSuccess
- `tests/services/config-service.test.ts` - 9 tests for all ConfigService methods

## Decisions Made

- Used @solana/kit@6.5.0 (latest) not 3.x — the RESEARCH.md confirmed 6.5.0 is the current canonical version from Anza; signing APIs (generateKeyPairSigner, createKeyPairSignerFromBytes) are unchanged between 3.x and 6.5.0
- ConfigService accepts optional `cwd` parameter so tests can use temp directories without polluting ~/.mainlayer/config.json
- printSuccess writes to stderr (not stdout) per D-08 to keep stdout clean for JSON piping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CLI entry point temporarily removed config import during Task 1 build**
- **Found during:** Task 1 (scaffold and build verification)
- **Issue:** src/cli/index.ts imported ./config.js before src/cli/config.ts existed (Task 2 file). Build failed with UNRESOLVED_IMPORT error.
- **Fix:** Removed the config import from index.ts during Task 1; re-added it in Task 2 after config.ts was created.
- **Files modified:** src/cli/index.ts
- **Verification:** Both builds (Task 1 and Task 2) succeed with exit 0
- **Committed in:** 9063e85 (Task 1), a2fea1d (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Minimal — ordering adjustment only. All planned files delivered.

## Issues Encountered

None beyond the Rule 3 fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All foundation types, utilities, and ConfigService are ready for Plans 02-04
- Plan 02 (auth commands) can import configService to store JWT, userId, email
- Plan 03 (wallet commands) can import EncryptedKeystore type and EXIT_CODES
- Plan 04 (postinstall/MCP) has no dependencies on Plan 01 internals beyond package.json

---
*Phase: 01-foundation*
*Completed: 2026-03-25*

## Self-Check: PASSED

- All 18 source/test files: FOUND
- Commit 9063e85 (Task 1): FOUND
- Commit a2fea1d (Task 2): FOUND
- npm test: 25/25 tests passed
- npm run build: exits 0, dist/index.mjs produced

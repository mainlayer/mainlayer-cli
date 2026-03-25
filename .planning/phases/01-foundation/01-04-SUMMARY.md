---
phase: 01-foundation
plan: 04
subsystem: infra
tags: [commander, typescript, solana, vitest, cli, binary]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: Project scaffold, ConfigService, config command, types, utilities
  - phase: 01-foundation/01-02
    provides: WalletService and wallet CLI commands (create/import/address/balance/export)
  - phase: 01-foundation/01-03
    provides: ApiClient and auth CLI commands (register/login/logout/status/api-key)
provides:
  - Working `mainlayer` binary wired from dist/cli/index.js with shebang
  - Global --json flag that auto-activates on non-TTY stdout
  - Global --api-key flag that sets ApiClient override for all subcommands
  - --version and --help at all levels
  - Smoke tests covering all command groups and flags
  - End-to-end verified: wallet create/address/address --json, 51/51 tests passing
affects:
  - 02-vendor
  - 03-buyer
  - 04-onboarding

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Commander preAction hook propagates global flags to ApiClient before subcommand runs
    - program.exitOverride() prevents Commander from calling process.exit directly; errors handled in catch
    - Shebang preserved in dist via tsdown banner config

key-files:
  created:
    - src/cli/index.ts
    - tests/cli/cli-smoke.test.ts
  modified: []

key-decisions:
  - "exitOverride() used so AppError exit codes are respected without Commander intercepting process.exit"
  - "Global --json and --api-key are wired at the root program; each subcommand already has its own --json, both paths work"
  - "preAction hook checks opts.apiKey before every subcommand action — no per-command wiring needed"

patterns-established:
  - "Global flag propagation: program.hook('preAction') reads root opts and applies to services before subcommand runs"
  - "Error boundary: single top-level try/catch distinguishes AppError (semantic exit code) from CommanderError (--help/--version) from unknown"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-06]

# Metrics
duration: continuation
completed: 2026-03-25
---

# Phase 1 Plan 04: CLI Entry Point Wiring Summary

**Commander program wiring all Phase 1 commands with global --json/--api-key flags, preAction hook, exitOverride error boundary, and 51/51 vitest smoke tests passing**

## Performance

- **Duration:** continuation (human-verify checkpoint)
- **Started:** prior session
- **Completed:** 2026-03-25
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 2

## Accomplishments

- Wired auth, wallet, and config commands into a single Commander program with addCommand
- Added global --json and --api-key flags; preAction hook calls apiClient.setApiKeyOverride before every subcommand
- Used exitOverride + top-level async IIFE to catch AppError with semantic exit codes without Commander intercepting
- Shebang `#!/usr/bin/env node` preserved in dist/cli/index.js via tsdown banner
- Created smoke tests covering --version, --help at root and all three command groups
- Human verification confirmed: --version prints 0.1.0, wallet create generates encrypted keypair, wallet address --json returns valid JSON, 51/51 tests pass, INFRA-02 auto-JSON on non-TTY works correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: CLI entry point with global flags and command wiring** - `1eb95e8` (feat)
2. **Task 2: Verify complete Phase 1 CLI end-to-end** - human checkpoint, approved

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/cli/index.ts` - Commander program wiring auth/wallet/config commands, global flags, preAction hook, exitOverride error boundary
- `tests/cli/cli-smoke.test.ts` - Smoke tests: --version, --help at root and per-command-group

## Decisions Made

- Used `exitOverride()` so the top-level catch can distinguish AppError (semantic codes 0-5) from CommanderError (--help/--version output already printed) from unknown errors
- Global --json placed at root program level; each subcommand also carries its own --json option so `mainlayer --json wallet address` and `mainlayer wallet address --json` both work
- preAction hook reads `program.opts().apiKey` and calls `apiClient.setApiKeyOverride()` — single point of API key propagation, no per-command wiring needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full Phase 1 foundation complete: scaffold, wallet encryption, auth, CLI wiring, 51 tests passing
- Ready for Phase 2 (Vendor): resource CRUD, pricing plans, quotas, coupons, webhooks, earnings
- ApiClient is wired and injectable via --api-key or MAINLAYER_API_KEY env var — vendor commands can call mainlayer-api immediately
- Wallet signing infrastructure is in place for Phase 3 X402 payment flow

---
*Phase: 01-foundation*
*Completed: 2026-03-25*

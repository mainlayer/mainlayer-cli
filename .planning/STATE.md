---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Milestone complete
stopped_at: Completed 04-onboarding/04-03-PLAN.md
last_updated: "2026-03-26T06:15:56.314Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 16
  completed_plans: 16
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** An AI agent can install `@mainlayer/cli` and autonomously register as a vendor or buyer, sign on-chain transactions, and transact on Mainlayer — with zero human intervention.
**Current focus:** Phase 04 — onboarding

## Current Position

Phase: 04
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: — min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 5 | 2 tasks | 19 files |
| Phase 01-foundation P03 | 186 | 2 tasks | 4 files |
| Phase 01-foundation P02 | 4 | 2 tasks | 4 files |
| Phase 01-foundation P04 | continuation | 2 tasks | 2 files |
| Phase 02-vendor P01 | 112 | 2 tasks | 4 files |
| Phase 02-vendor P03 | 2 | 2 tasks | 2 files |
| Phase 02-vendor P02 | 2 | 2 tasks | 2 files |
| Phase 02-vendor P05 | 8 | 2 tasks | 3 files |
| Phase 02-vendor P04 | 5 | 2 tasks | 5 files |
| Phase 03-buyer P01 | 1 | 2 tasks | 2 files |
| Phase 03-buyer P03 | 4 | 1 tasks | 1 files |
| Phase 03-buyer P02 | 1 | 2 tasks | 3 files |
| Phase 03-buyer P04 | 1 | 2 tasks | 4 files |
| Phase 04-onboarding P02 | 167 | 2 tasks | 2 files |
| Phase 04-onboarding P01 | 3 | 2 tasks | 4 files |
| Phase 04-onboarding P03 | 8 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Use @solana/kit 3.x (not legacy web3.js v1) — must commit before any signing code is written
- [Init]: AES-256-GCM + PBKDF2 200k iterations for wallet encryption — use Node.js built-in crypto only
- [Init]: Postinstall must wrap all writes in try/catch and always exit 0 — supply chain scrutiny is high
- [Init]: Phase 3 (X402 payment) and Phase 5 (MCP Windows paths) flagged for deeper research during planning
- [Phase 01-foundation]: Use @solana/kit@6.5.0 (latest canonical from Anza); signing APIs unchanged from 3.x
- [Phase 01-foundation]: ConfigService accepts optional cwd for test isolation
- [Phase 01-foundation]: printSuccess uses stderr to keep stdout clean for JSON piping (D-08)
- [Phase 01-foundation]: ApiClient uses ky.extend creating fresh instance per request so prefixUrl always reflects current config
- [Phase 01-foundation]: auth logout selectively clears jwt/jwtExpiresAt/userId/email — preserves apiUrl in config
- [Phase 01-foundation]: Use getAddressDecoder/Encoder from @solana/kit for 32-byte base58 encoding of private keys — same codec as addresses
- [Phase 01-foundation]: WalletService constructor accepts optional walletPath for test isolation without mocking
- [Phase 01-foundation]: exitOverride() used so AppError exit codes are respected without Commander intercepting process.exit
- [Phase 01-foundation]: preAction hook propagates --api-key to ApiClient.setApiKeyOverride before every subcommand — single wiring point
- [Phase 02-vendor]: ApiClient.get() accepts optional searchParams as Record<string,string> — ky passes them as URL query params
- [Phase 02-vendor]: parsePrice() uses decimal presence to distinguish USDC dollars from raw micro-units
- [Phase 02-vendor]: rotate-secret uses --force gate with 24h old-secret validity warning before rotating
- [Phase 02-vendor]: webhook logs table uses 5 columns (LOG_ID, PAYMENT_ID, STATUS, HTTP, ATTEMPTS) — LAST_ATTEMPT omitted as API field not confirmed
- [Phase 02-vendor]: resource get uses client-side filter of GET /resources (no individual GET endpoint per research)
- [Phase 02-vendor]: vendor-wallet auto-fills from walletService.getAddress() with stderr log in TTY human mode
- [Phase 02-vendor]: resource update fetches current values first, merges flags, PUTs full body to /resources/{id}
- [Phase 02-vendor]: earningsCommand defaults to 30d period; --period takes precedence over --from/--to
- [Phase 02-vendor]: quota_calls displayed as 'unlimited' string when API returns null
- [Phase 02-vendor]: Extract plan/quota subcommands to resource-plans.ts and resource-quota.ts to stay under 500-line file limit
- [Phase 02-vendor]: Coupon codes uppercased client-side before all API calls (create and delete)
- [Phase 03-buyer]: signTransaction slices at byte 65 (message-only signing) to prevent invalid signature from signing full wire format
- [Phase 03-buyer]: signMessage uses getBase58Codec (not getAddressDecoder) for 64-byte Ed25519 signature encoding — getAddressDecoder only handles 32-byte arrays
- [Phase 03-buyer]: subscribe get uses client-side filter of GET /subscriptions/my since no GET-by-id endpoint exists
- [Phase 03-buyer]: DEFAULT_SOLANA_NETWORK hardcoded to solana:mainnet, overridable via MAINLAYER_SOLANA_NETWORK env var for devnet
- [Phase 03-buyer]: buy command wraps action body in try/catch — follows resource.ts pattern for AppError handling
- [Phase 03-buyer]: entitlements uses client-side filter for --resource-id since API may not support server-side filtering
- [Phase 03-buyer]: invoices/dispute list are vendor-scoped; refund request requires resource ownership; dispute create sends payer_wallet from walletService
- [Phase 04-onboarding]: SKILLS_FILENAME = 'mainlayer-skills.md' to avoid collision with other tools' skills.md files
- [Phase 04-onboarding]: skills-template has zero imports — pure string generator safe to import from postinstall without circular deps
- [Phase 04-onboarding]: Claude Desktop skipped with skipReason — remote HTTP MCP not supported via claude_desktop_config.json; requires Settings > Connectors UI
- [Phase 04-onboarding]: Platform registry uses typed PlatformDescriptor array with URL-match idempotency across url/serverUrl/httpUrl fields
- [Phase 04-onboarding]: setup command uses opts.json || !process.stdout.isTTY toggle consistent with all commands
- [Phase 04-onboarding]: postinstall writes mainlayer-skills.md via skills-template module; platforms.ts inline skills.md coexists

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 planning: X402 v2 spec + x402-solana package API needs verification before implementing `buy` command
- Phase 4 planning: Windsurf and Continue MCP config paths are MEDIUM confidence — verify before writing platform registry

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260325-ll3 | Add .planning to gitignore to hide planning artifacts from public repo | 2026-03-25 | 77d075a | [260325-ll3-add-planning-to-gitignore-to-hide-planni](./quick/260325-ll3-add-planning-to-gitignore-to-hide-planni/) |

## Session Continuity

Last session: 2026-03-26T05:54:36.251Z
Stopped at: Completed 04-onboarding/04-03-PLAN.md
Resume file: None

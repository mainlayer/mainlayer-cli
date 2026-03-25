# Phase 1: Foundation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap the CLI project and deliver: (1) the CLI skeleton with Commander.js, exit codes, and --json output mode; (2) encrypted Solana wallet creation/import/balance/address/export; (3) auth commands (register, login, logout, status, api-key CRUD). Everything required before any resource or payment command can run.

</domain>

<decisions>
## Implementation Decisions

### Auth prompting strategy
- **D-01:** Accept credentials in priority order: CLI flags (`--email`, `--password`) → env vars (`MAINLAYER_EMAIL`, `MAINLAYER_PASSWORD`) → `@clack/prompts` interactive (TTY only)
- **D-02:** In non-TTY without env vars, error immediately with a clear message: "Set MAINLAYER_EMAIL / MAINLAYER_PASSWORD or pass --email / --password flags"
- **D-03:** No silent interactive fallback in headless/agent/CI mode (detect via `process.stdout.isTTY`)

### Human output style (non-JSON mode)
- **D-04:** Single values (wallet address, version) print as plain text — no decorative boxes or labels
- **D-05:** Multi-field outputs (auth status, wallet balance) print as labeled key-value pairs: `email:    user@example.com`, using chalk for field labels
- **D-06:** `@clack/prompts` outro (e.g., `✓ Wallet created`) for interactive command completions
- **D-07:** No ASCII tables for single-item data; reserve table format for lists (Phase 2+)
- **D-08:** Success text is chalk green; errors are chalk red to stderr

### Config schema
- **D-09:** Config file at `~/.mainlayer/config.json` with typed known fields: `{ apiUrl, jwt, jwtExpiresAt, userId, email }`
- **D-10:** Single identity for v1 — no profiles or multi-account support
- **D-11:** `mainlayer config get/set` accepts any known key for programmatic/agent access
- **D-12:** Wallet path is fixed at `~/.mainlayer/wallet.json` — not configurable in v1

### Passphrase handling
- **D-13:** In TTY: `wallet create` and `wallet import` require double-entry passphrase confirmation
- **D-14:** With `MAINLAYER_WALLET_PASSPHRASE` env var: single-entry accepted (agent-friendly, no confirmation prompt)
- **D-15:** `wallet export` always re-prompts for passphrase regardless of env var (security requirement)
- **D-16:** Never echo passphrase to stdout; use `@clack/prompts` `password()` for all human passphrase entry

### Claude's Discretion
- Exact spacing and formatting of key-value output (column alignment, padding)
- File layout within `src/` (commands/, lib/, utils/ — follow standard Commander.js patterns)
- Spinner wording during async ops (API calls, on-chain balance checks)
- Error message copy beyond the stated patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tech stack and architectural decisions
- `CLAUDE.md` — Complete technology stack with versions, rationale, wallet keystore format, version compatibility table, patterns by variant, and what NOT to use. This is the primary reference for all implementation choices in Phase 1.

### Project requirements
- `.planning/REQUIREMENTS.md` §INFRA-01 through INFRA-06 — CLI foundation requirements (package structure, JSON output, exit codes, config storage, API URL env var, api-key flag)
- `.planning/REQUIREMENTS.md` §AUTH-01 through AUTH-07 — Authentication command requirements
- `.planning/REQUIREMENTS.md` §WALL-01 through WALL-07 — Wallet command requirements

### Project vision and constraints
- `.planning/PROJECT.md` — Core value, constraints (X402 protocol, wallet security, agent-first output), and key decisions table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing source code

### Established Patterns
- None yet — patterns will be established in this phase and carried forward

### Integration Points
- `~/.mainlayer/config.json` — config written here; all future phases read from it
- `~/.mainlayer/wallet.json` — wallet written here; Phase 3 (buy/X402) reads and signs from it
- `conf` library manages config via OS-appropriate paths; wallet file is separate (raw JSON + crypto)

</code_context>

<specifics>
## Specific Ideas

- Agent-first is the guiding principle: every command must work non-interactively via flags + env vars
- `MAINLAYER_WALLET_PASSPHRASE` env var is the agent unlock pattern — downstream phases depend on it for signing
- `wallet export` re-prompting regardless of env var was an explicit security call (not subject to override)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-25*

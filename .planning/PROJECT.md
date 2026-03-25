# Mainlayer CLI

## What This Is

`@mainlayer/cli` is a public npm package that gives AI agents and developers a command-line interface to the Mainlayer payment infrastructure. It covers both sides of the marketplace: vendors sell digital resources (API endpoints, data feeds, files), and buyers discover and pay for them using an embedded Solana + EVM wallet. When installed, it also auto-configures the Mainlayer MCP server and drops a `skills.md` for AI agents to self-onboard.

## Core Value

An AI agent can install `@mainlayer/cli` and autonomously register as a vendor or buyer, sign on-chain transactions, and transact on Mainlayer — with zero human intervention.

## Requirements

### Validated

**Phase 1: Foundation (2026-03-25)**
- `mainlayer auth register` / `login` / `logout` / `status` — JWT auth flow wired
- `mainlayer auth api-key create/list/revoke` — API key management
- `mainlayer wallet create/import/address/balance/export` — AES-256-GCM encrypted Solana wallet
- CLI binary (`mainlayer`) with `--json`, `--api-key`, `--version` global flags
- Semantic exit codes (0–5), agent-first env-var passphrase support

### Active

**Vendor side**
- [ ] `mainlayer auth register` / `login` — email+password → JWT, store in config
- [ ] `mainlayer auth api-key create/list/revoke` — manage API keys (sk_live_/sk_test_)
- [ ] `mainlayer resource create/list/get/update/delete` — full resource CRUD
- [ ] `mainlayer resource plan create/list/update/delete` — pricing plans per resource
- [ ] `mainlayer resource quota set/get/delete` — per-wallet rate limits
- [ ] `mainlayer coupon create/list/delete` — discount codes
- [ ] `mainlayer webhook update/logs/retry/rotate-secret` — webhook management
- [ ] `mainlayer earnings` / `mainlayer metrics` — revenue analytics

**Buyer side**
- [ ] `mainlayer discover` — search/list discoverable resources
- [ ] `mainlayer buy <resource-id>` — pay for a resource (calls `/pay`, signs X402 transaction)
- [ ] `mainlayer subscribe approve/pause/resume/list` — subscription lifecycle
- [ ] `mainlayer entitlements` — list active access
- [ ] `mainlayer invoices` / `mainlayer refund` / `mainlayer dispute` — post-purchase ops

**Wallet (shared, used by buyer)**
- [ ] `mainlayer wallet create` — generate new Solana keypair (+ optional EVM key), store encrypted
- [ ] `mainlayer wallet import` — import existing keypair (base58 or mnemonic)
- [ ] `mainlayer wallet balance` — show SOL + USDC balances (Solana) and ETH + USDC (EVM)
- [ ] `mainlayer wallet address` — print public key(s)
- [ ] `mainlayer wallet export` — export private key (with passphrase confirmation)
- [ ] Auto-sign transactions when `buy` / `subscribe approve` is called

**Installation & AI onboarding**
- [ ] npm postinstall: auto-detect AI platform config dirs (`.claude`, `.gemini`, OpenClaude, Cursor, etc.) and configure MCP server
- [ ] Drop `skills.md` (agent instruction guide) into detected platform config locations
- [ ] `mainlayer setup` command for manual re-run of platform detection
- [ ] Full GitHub documentation: README, CLI reference, wallet guide, vendor/buyer quickstarts

### Out of Scope

- Backend changes to mainlayer-api — CLI wraps existing endpoints only
- GUI / dashboard — CLI only
- Token swaps or on-ramps — wallet only manages existing USDC/SOL/ETH balances
- EVM wallet creation (v1 creates Solana keypair; EVM private key is imported or derived) — simplify v1

## Context

- **API**: FastAPI backend at a configurable base URL (env var `MAINLAYER_API_URL`). Auth: email+password → JWT, or API keys (`sk_live_/sk_test_`). Wallet-signature auth also supported for X402 payment flows.
- **Chains**: Solana (primary, X402 SVM) + EVM (Base, Polygon, Ethereum). Payments in USDC.
- **X402 protocol**: Payment-before-response. CLI must be able to sign SPL token delegate transactions and EVM approvals.
- **MCP server**: Already exists in mainlayer-api, mounted at `/mcp`. CLI install configures AI clients to use it.
- **Primary audience**: AI agents that self-discover and use the CLI programmatically; humans use it too but agent UX drives design (machine-readable JSON output, `--json` flag).
- **Package name**: `@mainlayer/cli`, command binary: `mainlayer`
- **Solana wallet library**: Use `@solana/web3.js` + `@solana/spl-token`; keypair stored AES-256 encrypted in `~/.mainlayer/wallet.json`.

## Constraints

- **Protocol**: Must use X402 for payment flows — no custom payment scheme
- **Wallet security**: Private keys never leave the local machine unencrypted; passphrase-protected at rest
- **Node.js**: CLI is TypeScript/Node.js (matches npm ecosystem); no native binaries required
- **Public API only**: CLI only calls documented mainlayer-api endpoints — no internal DB access
- **Agent-first output**: All commands support `--json` flag for structured output; errors use exit codes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `@mainlayer/cli` scoped package | Consistent with mainlayer brand, allows future `@mainlayer/sdk` etc. | — Pending |
| Solana + EVM wallet (both) | API supports both chains; agents need to pay on whichever chain vendor uses | — Pending |
| API URL configurable via env | No hardcoded URL — works against staging, local, or future prod domain | — Pending |
| TypeScript + Node.js | npm ecosystem, no native compilation, works anywhere Node runs | — Pending |
| Encrypted local keypair storage | Security without requiring hardware wallet; passphrase protects at rest | — Pending |
| Auto-configure MCP on install | Zero-friction AI agent adoption; agents don't need manual setup steps | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after Phase 1 completion*

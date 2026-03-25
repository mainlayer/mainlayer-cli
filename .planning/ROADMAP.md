# Roadmap: @mainlayer/cli

## Overview

Build a TypeScript CLI that lets AI agents autonomously register, pay, and transact on the Mainlayer payment marketplace. The project delivers in four phases: first the core infrastructure (project setup, wallet, auth) that every command depends on; then the full vendor surface (resource CRUD, pricing, analytics, webhooks); then the full buyer surface (discovery, X402 payments, subscriptions, post-purchase ops); and finally the MCP auto-configuration and npm publishing that make zero-friction agent adoption a reality.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Bootstrapped TypeScript project with CLI infrastructure, encrypted Solana wallet, and full auth/API-key management (completed 2026-03-25)
- [x] **Phase 2: Vendor** - Complete vendor surface — resource CRUD, pricing plans, quotas, coupons, webhooks, earnings, and metrics (completed 2026-03-25)
- [x] **Phase 3: Buyer** - Complete buyer surface — resource discovery, X402 on-chain payment, subscription lifecycle, and post-purchase operations (completed 2026-03-25)
- [ ] **Phase 4: Onboarding** - MCP auto-configuration on install, skills.md agent guide, and npm package hardening for public release

## Phase Details

### Phase 1: Foundation
**Goal**: Developers and AI agents can install the CLI, create an encrypted Solana wallet, and authenticate with the Mainlayer API — everything required before any resource or payment command can run
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, WALL-01, WALL-02, WALL-03, WALL-04, WALL-05, WALL-06, WALL-07, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. Running `mainlayer --version` succeeds and `mainlayer --help` lists all top-level commands
  2. `mainlayer wallet create` generates an AES-256-GCM encrypted keypair at `~/.mainlayer/wallet.json`; `mainlayer wallet address` prints the public key; `mainlayer wallet balance` shows SOL and USDC balances
  3. `mainlayer auth register` and `mainlayer auth login` complete without prompts when credentials are provided via flags or env vars; JWT is persisted in config
  4. `mainlayer auth api-key create/list/revoke` manage API keys; `mainlayer auth status` shows current identity
  5. Every command exits with the correct semantic exit code (0-5) and produces valid JSON when `--json` is set or stdout is not a TTY
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — Project scaffold, types, utilities, ConfigService, config command
- [x] 01-02-PLAN.md — WalletService and wallet CLI commands
- [x] 01-03-PLAN.md — ApiClient and auth CLI commands
- [x] 01-04-PLAN.md — CLI entry point wiring, global flags, smoke tests, end-to-end verification
**UI hint**: no

### Phase 2: Vendor
**Goal**: A vendor can fully manage their resources — create and price them, control access via quotas and coupons, receive webhook events, and view revenue analytics — all from the CLI
**Depends on**: Phase 1
**Requirements**: VEND-01, VEND-02, VEND-03, VEND-04, VEND-05, VEND-06, VEND-07, VEND-08, VEND-09, VEND-10, ANAL-01, ANAL-02
**Success Criteria** (what must be TRUE):
  1. `mainlayer resource create` registers a new resource; `mainlayer resource list/get/update/delete` manage it through its full lifecycle
  2. `mainlayer resource plan create/list/update/delete` manages pricing plans attached to a resource
  3. `mainlayer resource quota set/get/delete` and `mainlayer coupon create/list/delete` control access and discounts for a resource
  4. `mainlayer webhook update/logs/retry/rotate-secret` manages the vendor's webhook endpoint
  5. `mainlayer earnings` and `mainlayer metrics` return structured revenue and usage data filterable by resource and date
**Plans**: 5 plans
Plans:
- [x] 02-01-PLAN.md — Vendor types, ApiClient extensions (put/patch/get-with-params), price utils, table renderer
- [x] 02-02-PLAN.md — Resource CRUD commands (create/list/get/update/delete) and CLI wiring
- [x] 02-03-PLAN.md — Webhook management commands (update/logs/retry/rotate-secret)
- [x] 02-04-PLAN.md — Pricing plans, quotas, and coupon commands
- [x] 02-05-PLAN.md — Earnings and metrics analytics commands
**UI hint**: no

### Phase 3: Buyer
**Goal**: A buyer can discover resources, pay for them on-chain via X402, manage subscriptions, and access post-purchase operations — the complete end-to-end purchase loop
**Depends on**: Phase 1
**Requirements**: BUYR-01, BUYR-02, BUYR-03, SUBS-01, SUBS-02, SUBS-03, SUBS-04, SUBS-05, POST-01, POST-02, POST-03, POST-04
**Success Criteria** (what must be TRUE):
  1. `mainlayer discover` returns a list of purchasable resources; running it without auth returns public listings
  2. `mainlayer buy <resource-id>` completes an X402 Solana USDC payment using the local wallet and returns a confirmed transaction signature; the wallet passphrase is accepted via `MAINLAYER_WALLET_PASSPHRASE` env var (no interactive prompt in headless mode)
  3. `mainlayer entitlements` lists all active access grants for the authenticated buyer
  4. `mainlayer subscribe approve/pause/resume/list` manage the full subscription lifecycle; `mainlayer subscribe get` returns a single subscription's current state
  5. `mainlayer invoices`, `mainlayer refund request`, `mainlayer dispute create/list` handle post-purchase operations and return structured JSON output
**Plans**: 4 plans
Plans:
- [x] 03-01-PLAN.md — Buyer types and WalletService signing methods (signTransaction, signMessage)
- [x] 03-02-PLAN.md — Discover, buy, and entitlements commands (core purchase flow)
- [x] 03-03-PLAN.md — Subscribe command group (approve/pause/resume/cancel/list/get)
- [x] 03-04-PLAN.md — Post-purchase commands (invoices/refund/dispute) and CLI wiring
**UI hint**: no

### Phase 4: Onboarding
**Goal**: Installing `@mainlayer/cli` via npm automatically configures the Mainlayer MCP server in every detected AI platform and drops a skills.md so agents can self-onboard with zero human intervention; the package is hardened for public npm release
**Depends on**: Phase 1
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05
**Success Criteria** (what must be TRUE):
  1. Running `npm install -g @mainlayer/cli` on a machine with Claude Desktop, Claude Code, or Cursor installed automatically adds the Mainlayer MCP server entry to each platform's config file without duplicating existing entries
  2. The postinstall script exits 0 even when no AI platforms are detected or when a write fails
  3. `mainlayer setup` re-runs platform detection and MCP registration without duplicating entries; it is safe to run multiple times
  4. A `skills.md` file describing all CLI commands is present in each detected AI platform's config directory after install
  5. The npm package contains only `dist/`, `bin/`, and `README.md`; `npm pack --dry-run` shows no secrets or test fixtures
**Plans**: 3 plans
Plans:
- [ ] 04-01-PLAN.md — Platform registry, postinstall entry point, build pipeline wiring
- [ ] 04-02-PLAN.md — Skills.md agent guide template and README.md documentation
- [ ] 04-03-PLAN.md — Setup command, skills dropping integration, npm package verification
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete    | 2026-03-25 |
| 2. Vendor | 5/5 | Complete   | 2026-03-25 |
| 3. Buyer | 4/4 | Complete   | 2026-03-25 |
| 4. Onboarding | 0/3 | In progress | - |

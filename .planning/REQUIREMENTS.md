# Requirements: @mainlayer/cli

**Defined:** 2026-03-25
**Core Value:** An AI agent can install `@mainlayer/cli` and autonomously register as a vendor or buyer, sign on-chain transactions, and transact on Mainlayer — with zero human intervention.

## v1 Requirements

### Infrastructure & CLI Foundation

- [x] **INFRA-01**: CLI project is bootstrapped as ESM TypeScript package with tsdown build, Commander.js 14 command structure, and `mainlayer` binary
- [x] **INFRA-02**: All commands output machine-readable JSON when `--json` flag is set or stdout is not a TTY
- [x] **INFRA-03**: CLI exits with semantic codes: 0 = success, 1 = general error, 2 = auth error, 3 = not found, 4 = validation error, 5 = already exists
- [x] **INFRA-04**: Config is stored at `~/.mainlayer/config.json` and readable/writable via `mainlayer config get/set`
- [x] **INFRA-05**: API base URL is configurable via `MAINLAYER_API_URL` env var (default: production URL when decided)
- [x] **INFRA-06**: All commands support `--api-key` flag and `MAINLAYER_API_KEY` env var as auth override

### Authentication

- [x] **AUTH-01**: User can register a new account with email and password (`mainlayer auth register`)
- [x] **AUTH-02**: User can log in with email and password, JWT stored in config (`mainlayer auth login`)
- [x] **AUTH-03**: User can log out, clearing stored credentials (`mainlayer auth logout`)
- [x] **AUTH-04**: User can view current auth status (`mainlayer auth status`)
- [x] **AUTH-05**: User can create a new API key with a label (`mainlayer auth api-key create`)
- [x] **AUTH-06**: User can list all active API keys (`mainlayer auth api-key list`)
- [x] **AUTH-07**: User can revoke an API key by ID (`mainlayer auth api-key revoke`)

### Wallet

- [x] **WALL-01**: User can generate a new Solana keypair stored AES-256-GCM + PBKDF2 encrypted at `~/.mainlayer/wallet.json` (`mainlayer wallet create`)
- [x] **WALL-02**: User can import an existing Solana keypair from base58 private key or 12/24-word mnemonic (`mainlayer wallet import`)
- [x] **WALL-03**: User can view their Solana public key and optional EVM address (`mainlayer wallet address`)
- [x] **WALL-04**: User can view SOL balance and USDC balance on Solana (and ETH + USDC on EVM if key configured) (`mainlayer wallet balance`)
- [x] **WALL-05**: User can export their private key after passphrase confirmation (`mainlayer wallet export`)
- [x] **WALL-06**: Wallet passphrase is accepted via `MAINLAYER_WALLET_PASSPHRASE` env var for headless/agent operation
- [x] **WALL-07**: Wallet is only decrypted at signing time (lazy decryption), never at startup

### Vendor — Resource Management

- [x] **VEND-01**: Vendor can create a new resource with slug, description, price (USDC), fee model, and type (`mainlayer resource create`)
- [x] **VEND-02**: Vendor can list all their resources (`mainlayer resource list`)
- [x] **VEND-03**: Vendor can get details of a single resource (`mainlayer resource get`)
- [x] **VEND-04**: Vendor can update a resource's fields (`mainlayer resource update`)
- [x] **VEND-05**: Vendor can delete a resource (`mainlayer resource delete`)
- [x] **VEND-06**: Vendor can create a pricing plan for a resource (`mainlayer resource plan create`)
- [x] **VEND-07**: Vendor can list, update, and delete pricing plans for a resource (`mainlayer resource plan list/update/delete`)
- [x] **VEND-08**: Vendor can set, get, and delete per-wallet quota limits for a resource (`mainlayer resource quota set/get/delete`)
- [x] **VEND-09**: Vendor can create, list, and delete discount coupons for a resource (`mainlayer coupon create/list/delete`)
- [x] **VEND-10**: Vendor can update the webhook URL, view delivery logs, retry failed webhooks, and rotate the webhook secret (`mainlayer webhook`)

### Vendor — Analytics

- [x] **ANAL-01**: Vendor can view earnings summary (total volume, fees, net) with optional resource and date filters (`mainlayer earnings`)
- [x] **ANAL-02**: Vendor can view aggregated metrics (active resources, payment counts by status) (`mainlayer metrics`)

### Buyer — Discovery & Purchase

- [x] **BUYR-01**: Buyer can search and list discoverable resources (`mainlayer discover`)
- [x] **BUYR-02**: Buyer can purchase a resource using the embedded Solana wallet via X402 payment flow (`mainlayer buy`)
- [x] **BUYR-03**: Buyer can view their active entitlements (access rights) (`mainlayer entitlements`)

### Buyer — Subscriptions

- [x] **SUBS-01**: Buyer can approve auto-renewal for a subscription resource (`mainlayer subscribe approve`)
- [x] **SUBS-02**: Buyer can pause a subscription (`mainlayer subscribe pause`)
- [x] **SUBS-03**: Buyer can resume a paused subscription (`mainlayer subscribe resume`)
- [x] **SUBS-04**: Buyer can list all their subscriptions (`mainlayer subscribe list`)
- [x] **SUBS-05**: Buyer can get details of a single subscription (`mainlayer subscribe get`)

### Buyer — Post-Purchase Operations

- [x] **POST-01**: Buyer can list their invoices (`mainlayer invoices`)
- [x] **POST-02**: Buyer can request a refund for a payment (`mainlayer refund request`)
- [x] **POST-03**: Buyer can create a dispute for a payment (`mainlayer dispute create`)
- [x] **POST-04**: Buyer can list their disputes (`mainlayer dispute list`)

### Installation & AI Agent Onboarding

- [x] **INST-01**: npm postinstall script detects AI platform config dirs (Claude Desktop, Claude Code, Cursor, Windsurf, Gemini CLI, VS Code, Zed, Continue) and registers the Mainlayer MCP server; exits 0 even when no platforms are detected
- [x] **INST-02**: postinstall is fully idempotent — running twice does not duplicate MCP registrations
- [ ] **INST-03**: `mainlayer setup` command re-runs platform detection and MCP registration manually
- [x] **INST-04**: A `skills.md` file is dropped into each detected AI platform's config directory on install, describing all CLI commands and their usage for AI agents
- [x] **INST-05**: README and GitHub documentation cover: quickstart for vendors, quickstart for buyers, wallet security model, MCP setup, and full CLI command reference

## v2 Requirements

### Wallet

- **WALL-V2-01**: EVM wallet creation (generate Ethereum keypair) — v1 imports only
- **WALL-V2-02**: Hardware wallet support (Ledger) for Solana signing

### Buyer — Payments

- **BUYR-V2-01**: X402 v2 session token support (single deposit authorizes multiple requests, reducing per-call overhead)
- **BUYR-V2-02**: EVM chain payment (`buy` command on Base/Polygon/Ethereum)

### Vendor

- **VEND-V2-01**: Vendor webhook event filtering (subscribe to specific event types)
- **VEND-V2-02**: Resource template management (`mainlayer resource template`)

### Developer Experience

- **DX-V2-01**: Shell completion (bash/zsh/fish) via `mainlayer completion`
- **DX-V2-02**: `mainlayer sandbox` mode for testing against test API keys
- **DX-V2-03**: Interactive TUI mode for humans (rich tables, spinners) — separate from default JSON-first mode

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI / dashboard | CLI only — dashboard is a separate project |
| Token swaps / on-ramps | Wallet manages existing balances only; no DEX integration |
| Browser OAuth login | Anti-feature for agent users; API key + JWT is the right model |
| Backend API changes | CLI wraps existing mainlayer-api endpoints only |
| EVM wallet creation (v1) | Simplify v1 — EVM key is imported or derived; creation deferred |
| Real-time price feeds | Out of scope for payment CLI |
| Multi-sig wallets | Complexity not justified for v1 |
| Windows support (full) | MCP postinstall paths are MEDIUM confidence on Windows; document limitation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| WALL-01 | Phase 1 | Complete |
| WALL-02 | Phase 1 | Complete |
| WALL-03 | Phase 1 | Complete |
| WALL-04 | Phase 1 | Complete |
| WALL-05 | Phase 1 | Complete |
| WALL-06 | Phase 1 | Complete |
| WALL-07 | Phase 1 | Complete |
| VEND-01 | Phase 2 | Complete |
| VEND-02 | Phase 2 | Complete |
| VEND-03 | Phase 2 | Complete |
| VEND-04 | Phase 2 | Complete |
| VEND-05 | Phase 2 | Complete |
| VEND-06 | Phase 2 | Complete |
| VEND-07 | Phase 2 | Complete |
| VEND-08 | Phase 2 | Complete |
| VEND-09 | Phase 2 | Complete |
| VEND-10 | Phase 2 | Complete |
| ANAL-01 | Phase 2 | Complete |
| ANAL-02 | Phase 2 | Complete |
| BUYR-01 | Phase 3 | Complete |
| BUYR-02 | Phase 3 | Complete |
| BUYR-03 | Phase 3 | Complete |
| SUBS-01 | Phase 3 | Complete |
| SUBS-02 | Phase 3 | Complete |
| SUBS-03 | Phase 3 | Complete |
| SUBS-04 | Phase 3 | Complete |
| SUBS-05 | Phase 3 | Complete |
| POST-01 | Phase 3 | Complete |
| POST-02 | Phase 3 | Complete |
| POST-03 | Phase 3 | Complete |
| POST-04 | Phase 3 | Complete |
| INST-01 | Phase 4 | Complete |
| INST-02 | Phase 4 | Complete |
| INST-03 | Phase 4 | Pending |
| INST-04 | Phase 4 | Complete |
| INST-05 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*

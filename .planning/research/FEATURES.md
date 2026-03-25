# Feature Research

**Domain:** Payment infrastructure CLI for AI agents (buyer + vendor marketplace, Solana/EVM, X402 protocol)
**Researched:** 2026-03-25
**Confidence:** HIGH (verified against Stripe CLI, Railway CLI, x402 docs, agent-CLI design literature)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `auth login` / `auth register` | Every developer CLI starts here; no auth = no access | LOW | Email+password → JWT; store in `~/.mainlayer/config.json` |
| `auth api-key create/list/revoke` | Standard Stripe CLI pattern; programmatic access without interactive login | LOW | `sk_live_` / `sk_test_` prefix convention; revoke must be instant |
| `--json` flag on every command | AI agents cannot parse human-readable tables; non-negotiable for machine users | LOW | stdout=JSON results, stderr=logs/progress; never mix |
| Meaningful exit codes | Agents use `$?` for control flow; 0/1 only is insufficient | LOW | 0=success, 1=general error, 2=usage error, 3=auth error, 4=not-found, 5=already-exists, 6=payment-required |
| Structured error output | Agents need `{"error": "resource_not_found", "message": "..."}` not free-text | LOW | Always include `error_code`, `message`, `hint` fields in JSON errors |
| Non-interactive mode (`--yes`/`--force`) | Agents cannot respond to confirmation prompts; any blocking prompt breaks automation | LOW | TTY detection: auto-skip prompts when not a TTY |
| `wallet create` / `wallet balance` / `wallet address` | Embedded wallet is core to the product; users expect to manage it | MEDIUM | AES-256 encrypted keypair at `~/.mainlayer/wallet.json`; passphrase-protected |
| `resource create/list/get/update/delete` | Full CRUD is baseline for any resource-management CLI | MEDIUM | Mirrors Stripe's resource verbs; `--json` on all |
| `discover` / resource search | Buyers need to find things to buy; discovery is the entry point | MEDIUM | Filter by category, chain, price range; paginates via NDJSON |
| `buy <resource-id>` | The core transaction; payment CLI without a buy command is incomplete | HIGH | Triggers X402 flow: sign SPL token delegate tx, attach to re-request |
| `subscribe approve/list` | Recurring access is a primary business model; expected alongside one-time pay | HIGH | pause/resume/cancel subcommands |
| `entitlements list` | Buyers need to know what they have access to | LOW | Machine-readable list of active access tokens / resource IDs |
| `--help` with realistic examples | Self-documenting CLIs are required for agent introspection and human onboarding | LOW | Noun-verb hierarchy enables tree-search discovery: `mainlayer resource --help` |
| Config file at `~/.mainlayer/config.json` | Industry standard (Stripe: `~/.stripe`, Railway: `~/.railway`); env vars override | LOW | XDG-compliant path fallback; `MAINLAYER_API_URL`, `MAINLAYER_API_KEY` env vars |
| `mainlayer setup` | Post-install reconfiguration; must be re-runnable without side effects (idempotent) | LOW | Re-runs MCP config detection and drops skills.md |
| Version / upgrade command | Users expect `mainlayer --version` and update guidance | LOW | `--version` flag; print upgrade hint when outdated version detected |
| Webhook `update/logs/retry/rotate-secret` | Stripe-established pattern; vendors need webhook management | MEDIUM | `logs` should stream with `--follow`; retry by event ID |

---

### Differentiators (Competitive Advantage)

Features that set Mainlayer CLI apart. Not table stakes, but they define the product.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-MCP configuration on `npm install` | Zero-friction AI agent adoption — agents get Mainlayer tools in their context window without any manual setup | MEDIUM | Detect `.claude/`, `.gemini/`, Cursor config dirs; write MCP server config; idempotent postinstall script |
| `skills.md` / `SKILL.md` drop on install | Agents self-onboard: skill file teaches the agent when and how to use Mainlayer tools | LOW | Follow Anthropic agentskills.io SKILL.md format (published Dec 2025); drop to detected platform config locations |
| X402 V2 session token support | Single deposit authorizes a session of requests — dramatically reduces per-call gas fees and latency vs per-request signing | HIGH | V2 released Dec 2025; `buy --session` flag; store session token in config; auto-renew when expired |
| Agent-native NDJSON pagination | Stream large resource/discover lists line-by-line; agents process without buffering 200KB blobs | LOW | `--stream` flag or default for lists >50 items; one JSON object per line to stdout |
| Runtime schema introspection (`mainlayer schema <command>`) | Agent can query exact field names and types at runtime — eliminates hallucination risk | MEDIUM | Output JSON Schema for a command's input and output; makes CLI self-describing without training data |
| Idempotent resource operations (`--idempotency-key`) | Agents retry on failure; duplicate-safe operations prevent double-charges or double-registration | LOW | Pass through to API idempotency key header; return `already_exists` exit code 5 not error |
| `mainlayer wallet sign <data>` | Agents need to prove wallet ownership for X402 SIGN-IN-WITH-X auth (CAIP-122/SIWE pattern) | MEDIUM | Sign arbitrary message with local keypair; output signature as JSON |
| Dual-chain wallet (Solana primary + EVM import) | API supports both chains; vendors can require either; agents need to pay on whichever chain is required | HIGH | Solana keypair generated; EVM key imported or derived; `wallet balance --chain solana|evm` |
| `earnings` / `metrics` with time-range filter | Vendors need revenue visibility in the CLI without leaving the terminal | MEDIUM | `--since`, `--until`, `--interval` flags; sparkline for humans, raw JSON for agents |
| Coupon/discount lifecycle (`coupon create/list/delete`) | Programmatic discount management enables agent-driven promotions and A/B pricing | LOW | Part of vendor toolkit; not common in infrastructure CLIs |
| `quota set/get/delete` per wallet | Fine-grained rate limiting per buyer wallet — a payment infra primitive absent in generic CLIs | MEDIUM | Per-wallet rate limits on resource access |
| `dispute` / `refund` commands | Post-purchase lifecycle completeness; competitors (Stripe) have this — payment CLI without it feels incomplete for power users | MEDIUM | `dispute create/list/respond`; `refund request` |
| `invoice list/get` | Financial record-keeping for buyers; agents can reconcile spend programmatically | LOW | Filter by resource, date range; `--json` emits structured invoice objects |

---

### Anti-Features (Deliberately NOT Building in v1)

Features that seem useful but would cause problems, scope creep, or bad UX for the primary AI agent use case.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Interactive REPL / shell mode (`mainlayer shell`) | Feels ergonomic for humans exploring the API | Agents cannot use interactive sessions; adds maintenance burden; Railway has this but it's for container shells, not payment ops | Individual commands with `--json` are composable; no REPL needed |
| Token swap / on-ramp within CLI | Agents may need to acquire USDC to pay | Out-of-scope wallet complexity; regulatory surface area; unpredictable slippage; would make wallet a DEX client | Document external on-ramp options in skills.md; link to Coinbase/Jupiter from error message when balance is insufficient |
| GUI / TUI (terminal UI with colors/boxes) | Pretty output is nice for humans | TUI libraries (Ink, Blessed) break when stdout is piped; agents parse raw JSON — TUI output is noise | Use `--json` for agents; use plain text + ANSI colors (stripped when non-TTY) for humans |
| Browser-based OAuth login | Familiar from GitHub CLI, Railway CLI | Requires a browser; AI agents and CI environments have no browser; breaks automation | Support `--interactive=false` flag; `--api-key` flag and env var as primary auth paths |
| Wallet passphrase caching / keyring integration | Avoids repeated passphrase prompts | Keyring integrations (macOS Keychain, libsecret) vary by platform; agents running headlessly have no keyring | `MAINLAYER_WALLET_PASSPHRASE` env var; document that agents should set this env var |
| EVM wallet creation (v1) | Agents may want to pay on Base/Polygon | Adds key-generation complexity; EVM private key management differs from Solana; security surface doubles | Import-only for EVM in v1; Solana is primary chain; document EVM import path |
| Bulk/batch resource management wizard | Power-user convenience | Wizards use interactive prompts; agents cannot drive them | `--json-input <file>` flag that reads structured input from stdin or file for batch ops |
| Streaming webhook event listener (like Stripe CLI `listen`) | Useful for local development testing | Not a core agent workflow; adds persistent-connection complexity; agents don't run local servers | `webhook logs --tail` for recent events; retry individual events by ID |
| Plugin/extension system | Extensibility feels important | Premature abstraction; adds API surface to maintain; agent skills pattern already handles extensibility | SKILL.md files are the extension mechanism for AI agents |

---

## Feature Dependencies

```
wallet create
    └──requires──> (nothing — can be first operation)
    └──enables──> buy, subscribe approve, wallet sign, wallet export

auth login / auth register
    └──requires──> (nothing — entry point)
    └──enables──> resource CRUD, discover, earnings, metrics, webhooks, coupons, quotas

auth api-key create
    └──requires──> auth login (at least once to create first key)
    └──enables──> non-interactive auth for agents (replaces login in automation)

buy <resource-id>
    └──requires──> wallet create OR wallet import
    └──requires──> auth login OR api-key (for resource lookup)
    └──requires──> wallet balance (sufficient USDC)
    └──enables──> entitlements list (active access after purchase)

subscribe approve
    └──requires──> wallet create (same as buy)
    └──requires──> auth login / api-key
    └──enables──> subscribe pause / resume / cancel

X402 V2 session token
    └──requires──> buy (session is purchased upfront)
    └──enhances──> buy (reduces per-call gas when accessing same resource repeatedly)

MCP auto-configure (postinstall)
    └──requires──> (runs at npm install time — no prior state needed)
    └──enables──> skills.md drop (same postinstall hook)

skills.md drop
    └──enhances──> MCP auto-configure (skills teach agents HOW to use the MCP tools)

resource plan create/update/delete
    └──requires──> resource create (plan belongs to a resource)

quota set
    └──requires──> resource create

coupon create
    └──requires──> resource create (coupon applies to a resource's plan)

webhook update/logs/retry
    └──requires──> auth login
    └──enhances──> resource create (webhooks notify on resource events)

earnings / metrics
    └──requires──> auth login (vendor context)
    └──requires──> resource create (nothing to earn without a resource)

invoice list / refund / dispute
    └──requires──> buy OR subscribe approve (purchases must exist first)
```

### Dependency Notes

- **wallet create requires nothing:** This is intentional — agents should be able to create a wallet before authenticating, since the wallet address may be needed during registration.
- **buy requires wallet AND auth:** Both must exist; missing either gives a clear actionable error: "Run `mainlayer wallet create` first" or "Run `mainlayer auth login` first".
- **MCP + skills.md are independent of auth:** They configure the AI client, not the Mainlayer account — should work immediately on install.
- **X402 V2 session tokens enhance but don't replace buy:** Standard per-request flow must still work; sessions are an optimization for repeated access.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what an AI agent needs to autonomously transact on Mainlayer end-to-end.

- [ ] `mainlayer auth register` / `auth login` — account creation and JWT auth
- [ ] `mainlayer auth api-key create/list/revoke` — non-interactive auth path for agents
- [ ] `mainlayer wallet create` / `wallet balance` / `wallet address` — Solana keypair management
- [ ] `mainlayer wallet import` — import existing keypair (base58 or mnemonic)
- [ ] `mainlayer resource create/list/get/update/delete` — vendor resource CRUD
- [ ] `mainlayer resource plan create/list/update/delete` — pricing plan management
- [ ] `mainlayer discover` — buyer resource search/list
- [ ] `mainlayer buy <resource-id>` — X402 payment flow with auto-sign
- [ ] `mainlayer subscribe approve/pause/resume/list` — subscription lifecycle
- [ ] `mainlayer entitlements list` — list active access
- [ ] `mainlayer earnings` / `mainlayer metrics` — vendor revenue visibility
- [ ] `--json` flag on every command — machine-readable output
- [ ] Meaningful exit codes (0–6) — agent control flow
- [ ] Non-interactive mode (TTY detection + `--yes`) — automation-safe
- [ ] Config file + env var auth (`MAINLAYER_API_KEY`, `MAINLAYER_API_URL`) — scriptable
- [ ] `mainlayer setup` — idempotent MCP + skills.md configuration
- [ ] npm postinstall: auto-MCP config + skills.md drop — zero-friction AI adoption

### Add After Validation (v1.x)

Features to add once core transaction flow is proven working.

- [ ] `mainlayer webhook update/logs/retry/rotate-secret` — add when first vendors request webhook integrations
- [ ] `mainlayer coupon create/list/delete` — add when pricing experimentation becomes requested
- [ ] `mainlayer resource quota set/get/delete` — add when rate-limiting becomes a vendor pain point
- [ ] `mainlayer invoice list/get` — add when buyers need spend reconciliation
- [ ] `mainlayer refund` / `mainlayer dispute` — add when first post-purchase disputes occur
- [ ] X402 V2 session token support (`buy --session`) — add when per-call gas costs become a complaint
- [ ] Runtime schema introspection (`mainlayer schema <command>`) — add when agent hallucination on field names becomes reported

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] EVM wallet creation (v1 is import-only) — defer until EVM chain volume warrants it
- [ ] NDJSON streaming pagination — defer until large catalog sizes are observed in production
- [ ] `mainlayer wallet sign <data>` for CAIP-122/SIWE — defer until SIGN-IN-WITH-X auth pattern is needed
- [ ] Dual-environment profiles (`--profile staging`) in config — defer until multi-env workflows are requested
- [ ] `mainlayer bulk` / `--json-input` batch operations — defer until vendor onboarding at scale is needed

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `auth login/register` + api-key | HIGH | LOW | P1 |
| `wallet create/balance/address` | HIGH | MEDIUM | P1 |
| `resource CRUD` | HIGH | MEDIUM | P1 |
| `discover` + `buy` (X402) | HIGH | HIGH | P1 |
| `--json` + exit codes + non-interactive | HIGH | LOW | P1 |
| npm postinstall + MCP auto-config | HIGH | MEDIUM | P1 |
| `skills.md` / SKILL.md drop | HIGH | LOW | P1 |
| `subscribe approve/pause/resume/list` | HIGH | MEDIUM | P1 |
| `entitlements list` | HIGH | LOW | P1 |
| `earnings` / `metrics` | MEDIUM | MEDIUM | P2 |
| `resource plan CRUD` | MEDIUM | LOW | P2 |
| `webhook update/logs/retry` | MEDIUM | MEDIUM | P2 |
| `coupon create/list/delete` | MEDIUM | LOW | P2 |
| `quota set/get/delete` | MEDIUM | MEDIUM | P2 |
| `invoice list` / `refund` / `dispute` | MEDIUM | MEDIUM | P2 |
| X402 V2 session tokens | MEDIUM | HIGH | P2 |
| Runtime schema introspection | MEDIUM | MEDIUM | P2 |
| `wallet import` (base58/mnemonic) | HIGH | LOW | P1 |
| EVM wallet creation | LOW | HIGH | P3 |
| NDJSON streaming | LOW | LOW | P3 |
| Bulk / `--json-input` batch ops | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## AI Agent UX Considerations

This section is separate from human UX because the primary users are AI agents — human UX is secondary.

### Critical for Agent Use (non-negotiable)

1. **`--json` on every command, always.** Not just "most commands." Railway does this globally (`--json` is a root-level flag). Follow that pattern. Output schema must be stable across patch versions.

2. **TTY auto-detection.** When stdout is not a TTY (i.e., piped to another process or redirected), default to JSON and skip all prompts. Never require `--json` explicitly in pipelines.

3. **Semantic exit codes.** Documented exit code contract is part of the public API. Agents branch on `$?`. Undocumented codes break agent workflows silently.

4. **`MAINLAYER_WALLET_PASSPHRASE` env var.** Agents have no keyring. The only way for them to sign transactions without blocking is via environment variable. Document this prominently in skills.md.

5. **`MAINLAYER_API_KEY` env var as primary auth.** Agents should never need to run `auth login` interactively. API key via env var is the canonical agent auth path.

6. **Error JSON includes `hint` field.** When an agent hits an error, the `hint` tells it the next command to run. Example: `{"error": "wallet_not_found", "hint": "Run mainlayer wallet create to generate a wallet"}`. This is the agent equivalent of a helpful error message.

7. **Idempotent operations.** Agents retry. `resource create` called twice with the same name must return `already_exists` (exit code 5) with the existing resource in the JSON body — not create a duplicate, not throw a fatal error.

8. **SKILL.md drop on install is core infrastructure.** This is not a nice-to-have. Without it, agents using Claude Code, Codex, Gemini CLI, or Cursor must manually discover Mainlayer capabilities from `--help` on every session. The SKILL.md pre-loads capability context.

### Acceptable Trade-offs for Agent UX

- Human-readable table output is acceptable alongside JSON — use it when TTY is detected, suppress when not.
- ANSI color codes are acceptable — strip when non-TTY (most terminal libraries do this automatically).
- Progress spinners are acceptable to stderr — never to stdout.
- Passphrase confirmation prompts for destructive wallet operations (`wallet export`) are acceptable — but must be bypassable via `MAINLAYER_WALLET_PASSPHRASE` env var for agents.

---

## Competitor Feature Analysis

| Feature | Stripe CLI | Railway CLI | Solana CLI | Mainlayer CLI (plan) |
|---------|------------|-------------|------------|----------------------|
| Auth login | Browser OAuth + API key | Browser OAuth + token | Keypair file | Email/password + API key (no browser required) |
| Non-interactive mode | `--api-key` flag | `RAILWAY_API_TOKEN` env var | `--keypair` flag | `MAINLAYER_API_KEY` env var + TTY detection |
| `--json` output | Partial (some commands) | Yes (global `--json` flag) | No (text only) | Yes (every command, global flag) |
| Exit codes | Basic (0/1) | Basic (0/1) | Basic | Semantic (0–6 documented) |
| Webhook management | Yes (`listen`, `trigger`, `logs`) | No | No | Yes (update, logs, retry, rotate-secret) |
| Wallet management | No | No | Yes (keypair, balance, transfer) | Yes (Solana + EVM import) |
| Payment signing | No | No | Yes (transaction sign) | Yes (X402 SPL token delegate + EVM approval) |
| Discovery / marketplace | No | No | No | Yes (`discover` command) |
| MCP auto-configure | No | No | No | Yes (postinstall hook) |
| Agent skills file | No | No | No | Yes (SKILL.md on install) |
| Subscription lifecycle | No (API only) | No | No | Yes (approve/pause/resume/cancel) |
| Session token payments | No | No | No | Yes (X402 V2, v1.x) |
| Schema introspection | No | No | No | Planned (v1.x) |

---

## Sources

- [Stripe CLI Documentation](https://docs.stripe.com/stripe-cli) — command patterns, auth model, webhook CLI design
- [Stripe CLI API Key Management](https://docs.stripe.com/stripe-cli/keys) — restricted keys, 90-day expiry, credential storage
- [Railway CLI Reference](https://docs.railway.com/reference/cli-api) — global `--json` flag, `RAILWAY_API_TOKEN`, browserless auth
- [x402 Protocol](https://www.x402.org/) — HTTP 402 payment flow, SPL token delegate signing
- [x402 V2 Launch](https://www.x402.org/writing/x402-v2-launch) — session tokens, single-deposit multi-request authorization
- [Cloudflare x402 Foundation Announcement](https://blog.cloudflare.com/x402/) — chain-agnostic, SIGN-IN-WITH-X headers
- [Writing CLI Tools That AI Agents Actually Want to Use](https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no) — 8 rules for agent-friendly CLIs
- [Rewrite Your CLI for Agents](https://dev.to/meimakes/rewrite-your-cli-for-agents-or-get-replaced-2a2h) — human vs agent CLI design differences, NDJSON pagination
- [Agent Skills — Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — SKILL.md format, Level 1/2 discovery
- [SKILL.md Pattern](https://bibek-poudel.medium.com/the-skill-md-pattern-how-to-write-ai-agent-skills-that-actually-work-72a3169dd7ee) — how to write effective agent skill files
- [add-mcp: Install MCP Servers Across Agents](https://neon.com/blog/add-mcp) — cross-platform MCP auto-configuration patterns
- [Solana CLI Wallet Guide](https://docs.solana.com/wallet-guide/cli) — keypair management, balance, signing
- [SPL Token Program](https://spl.solana.com/token) — USDC token transfers, Associated Token Accounts
- [Keep the Terminal Relevant: Patterns for AI Agent Driven CLIs](https://www.infoq.com/articles/ai-agent-cli/) — non-interactive-by-default, safe-by-default, observability patterns

---

*Feature research for: @mainlayer/cli — Stripe for AI agents*
*Researched: 2026-03-25*

# Project Research Summary

**Project:** @mainlayer/cli
**Domain:** Payment infrastructure CLI for AI agents — Solana/EVM wallet, X402 protocol, MCP auto-configuration
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

@mainlayer/cli is a TypeScript CLI that enables AI agents to autonomously discover and purchase API resources using the X402 payment protocol over Solana USDC. The product sits at the intersection of three domains that rarely overlap in a single package: blockchain wallet management, HTTP payment protocol client, and AI agent tooling (MCP auto-configuration + SKILL.md). The closest analogues are Stripe CLI (auth, resource management, webhook patterns) and Solana CLI (keypair, balance, signing), but neither handles the AI-agent-first UX requirements that are non-negotiable here. The primary users are AI agents, not humans, so every design decision must favor machine-readable output, semantic exit codes, non-interactive operation, and env-var-based auth and passphrase injection.

The recommended stack is Commander.js 14 + TypeScript 5 + Node.js 22 LTS, with @solana/kit 3.x (the new Web Crypto API-based SDK, not the legacy web3.js v1) for Solana, viem 2 for EVM signing, native Node.js crypto (AES-256-GCM + PBKDF2 200k iterations) for wallet encryption, and ky for API HTTP. The build chain is tsdown (tsup's maintained successor) targeting ESM. The architecture is a clean three-layer separation: thin Commander command handlers call service classes (ApiClient, WalletService, ConfigService), which call infrastructure. The MCP installer is isolated from runtime code and runs at postinstall and via `mainlayer setup`.

The two highest-risk areas are wallet security and postinstall safety. On wallet security: the research documents exactly how to go wrong (CBC instead of GCM, SHA-256 as KDF, passphrase prompts that hang agents) and the fix is prescriptive — AES-256-GCM with authenticated tags and PBKDF2 at 200k iterations, with `MAINLAYER_WALLET_PASSPHRASE` env var as the agent auth path. On postinstall: supply-chain scrutiny of npm postinstall scripts is at an all-time high (2025 Shai-Hulud attack vector), so the script must wrap all writes in try/catch, exit 0 always, and be idempotent. `mainlayer setup` must exist as the manual fallback.

## Key Findings

### Recommended Stack

The core runtime is Commander.js 14 (276M downloads/week, 180KB, 18ms startup, zero deps) over oclif or yargs. The blockchain layer uses @solana/kit 3.x — the December 2024 official Anza release that replaces legacy web3.js v1 — paired with @solana-program/token for SPL operations. These two must not be mixed with the legacy @solana/spl-token 0.4.x package, which explicitly requires web3.js v1 and causes type conflicts. EVM signing uses viem 2 (TypeScript-first, 35kB, strongly typed). Wallet encryption uses only the Node.js built-in `crypto` module with AES-256-GCM; the `conf` package's `encryptionKey` option is explicitly disqualified as security theater. Config storage uses `conf` 13 for non-sensitive config (JWT, API keys, base URL). HTTP uses `ky` 1 (Fetch-based, 4kB, clean hooks for auth injection). Terminal UX uses @clack/prompts (passphrase entry, confirmations), ora 8 (spinners to stderr), and chalk 5 (ANSI color, stripped when non-TTY). Both ora 8 and chalk 5 are ESM-only — the build must output ESM.

**Core technologies:**
- Commander.js 14: CLI framework — 18ms startup, 0 deps, clean nested subcommand API
- @solana/kit 3.x: Solana SDK — Web Crypto API, async key ops, ~200ms faster confirmations vs web3.js v1
- @solana-program/token: SPL token operations — the kit-compatible replacement for @solana/spl-token
- viem 2: EVM signing — TypeScript-first, modular, minimal footprint for sign-only use case
- Node.js crypto (built-in): AES-256-GCM wallet encryption — zero dependencies, authenticated encryption
- ky 1: HTTP client — 4kB, Fetch-based (native Node 22), typed, auth-header hook pattern
- conf 13: App config storage — OS-appropriate paths, TypeScript-native
- x402-solana + @x402/core: X402 payment protocol — official Coinbase/Solana X402 v2 client
- tsdown: Build tooling — Rolldown-powered tsup successor, 2x faster, ESM-first
- vitest 3: Testing — zero-config TypeScript, no babel/ts-jest setup required

### Expected Features

The MVP is an end-to-end agentic payment loop: create wallet, authenticate, discover resources, buy with X402, manage subscriptions, check entitlements. The feature dependency graph is clear — wallet create requires nothing and enables buy; auth login/api-key enables all resource operations; buy requires both wallet and auth. MCP auto-configuration and SKILL.md drop are independent of auth and are core infrastructure, not optional features.

**Must have (table stakes):**
- `auth login/register` + `auth api-key create/list/revoke` — account creation and non-interactive agent auth
- `wallet create/balance/address/import` — Solana keypair with AES-256-GCM encryption
- `resource create/list/get/update/delete` + `resource plan CRUD` — full vendor resource management
- `discover` + `buy <resource-id>` — X402 payment flow with auto-sign (the core transaction)
- `subscribe approve/pause/resume/cancel/list` + `entitlements list` — subscription lifecycle
- `--json` flag globally + TTY auto-detection (default JSON when not TTY) — non-negotiable for agents
- Semantic exit codes 0–6 (add 7 for not-found, 8 for conflict) — agent control flow
- `MAINLAYER_API_KEY` and `MAINLAYER_WALLET_PASSPHRASE` env vars — agent headless auth paths
- `mainlayer setup` — idempotent MCP + SKILL.md configuration (manual fallback for `--ignore-scripts`)
- npm postinstall: auto-MCP config write + SKILL.md drop — zero-friction AI agent adoption
- `earnings` / `metrics` — vendor revenue visibility

**Should have (competitive):**
- `webhook update/logs/retry/rotate-secret` — vendor webhook management
- `coupon create/list/delete` + `quota set/get/delete` — programmatic pricing and rate limiting
- `invoice list/get` + `refund` + `dispute` — post-purchase lifecycle completeness
- X402 V2 session token support (`buy --session`) — single deposit for multiple requests, reduces gas
- Runtime schema introspection (`mainlayer schema <command>`) — agent hallucination prevention

**Defer (v2+):**
- EVM wallet creation (import-only in v1)
- NDJSON streaming pagination (defer until large catalog sizes observed)
- `mainlayer wallet sign <data>` for CAIP-122/SIWE auth
- Dual-environment profiles (`--profile staging`)
- Bulk/batch operations with `--json-input`

### Architecture Approach

The project follows a strict three-layer architecture: thin Commander command handlers (one file per command group, 20-40 lines each), a service layer (ApiClient, WalletService, ConfigService, X402Handler as testable classes with no Commander dependency), and infrastructure (native Node.js crypto, fs, HTTP). The X402 payment intercept is handled transparently inside ApiClient — when a 402 response arrives, X402Handler builds the payment header by calling WalletService.sign(), and ApiClient retries. Command handlers never know payment happened. The MCP installer is a fully isolated module (installer/) with no dependency on runtime CLI code, run both at postinstall and on-demand via `mainlayer setup`. Build order enforces dependency sequence: ConfigService first, then WalletService and ApiClient in parallel, then X402Handler, then CLI layer, then MCP installer (which can be built in parallel with CLI layer).

**Major components:**
1. CLI Command Layer (cli/) — parse argv, validate input, call services, render output; zero business logic
2. ApiClient (services/api-client.ts) — all HTTP with auth injection; owns the 402 intercept and retry
3. WalletService (services/wallet-service.ts) — generate/import/encrypt/decrypt keypairs; sign X402 transactions; decrypt on-demand only, never at startup
4. ConfigService (services/config-service.ts) — read/write ~/.mainlayer/config.json; env var cascade
5. X402Handler (services/x402-handler.ts) — build X-PAYMENT header from 402 response; delegates signing to WalletService
6. MCP Installer (installer/) — platform detector + config writer + SKILL.md copier; isolated, idempotent

### Critical Pitfalls

1. **AES-256-CBC instead of GCM for wallet encryption** — CBC has no auth tag; bit-flip attacks corrupt keys silently. Use `aes-256-gcm` exclusively; store and verify the 16-byte auth tag on every decrypt; any tampered ciphertext must throw immediately.

2. **Postinstall script fails or overwrites user AI platform configs** — In 2025, supply chain attacks via postinstall are the primary scrutiny vector (Shai-Hulud). Wrap the entire postinstall body in try/catch; exit 0 always; never call process.exit(1); read-before-write on all platform configs; check for existing mainlayer entry before writing to prevent duplicates; write a .mainlayer-backup before any modification.

3. **Passphrase prompt blocks agent execution** — Any readline/TTY prompt with no env-var fallback hangs headless agents indefinitely. Support `MAINLAYER_WALLET_PASSPHRASE` env var as primary path; fall back to `--passphrase` flag; only prompt interactively when `process.stdin.isTTY === true`; if none available and no TTY, fail immediately with JSON error and exit code 3.

4. **Solana blockhash expiry causing silent payment failures** — `sendRawTransaction` returns a signature immediately but does not confirm. If the blockhash expires before the transaction lands, the payment is lost but the CLI reports success. Always poll with `lastValidBlockHeight` check; retry with a fresh blockhash on expiry; do not report success until `confirmed` commitment is reached.

5. **X402 USDC amount floating-point precision** — `Math.floor(0.005 * 1_000_000)` yields 4999, not 5000, due to IEEE 754. Payment is rejected as underpayment. Use `Math.round` for all dollar-to-micro-unit conversions. Write unit tests for boundary values (0.001, 0.005, 0.01).

6. **@solana/kit vs @solana/web3.js v1 type mismatch** — The ecosystem is mid-migration. Kit uses async CryptoKeyPair; web3.js v1 uses sync Uint8Array Keypair. Mixing them causes silent runtime failures or cryptic type errors. Commit to @solana/kit 3.x at project start; use @solana/compat only if a dependency forces a bridge.

7. **Publishing secrets or wallet fixtures to npm** — If `.npmignore` exists, it replaces `.gitignore` rather than augmenting it. Use the `files` whitelist in package.json (only `dist/`, `bin/`, `README.md`); run `npm pack --dry-run` before every publish; add a `prepublishOnly` script that audits the file list.

## Implications for Roadmap

Based on the combined research, the build dependency graph (ConfigService → WalletService/ApiClient → X402Handler → CLI layer → MCP Installer) and the feature dependency tree (wallet enables buy; auth enables resource ops; MCP is independent) naturally suggest 5-6 phases.

### Phase 1: Project Scaffolding and Infrastructure
**Rationale:** ConfigService, error handling patterns, exit codes, and output utilities must exist before any command can be built. The Solana SDK choice (kit 3.x) must be locked in before any signing code is written — changing it later requires rewriting all wallet and transaction code. This phase also establishes the ESM-only build pipeline (tsdown) and the security-sensitive wallet keystore format.
**Delivers:** Buildable TypeScript project with correct tsdown config, ESM output, ConfigService reading from env vars and ~/.mainlayer/config.json, typed error classes with the full exit code vocabulary (0–8), output utilities (formatJson/formatTable/printError), and the wallet keystore schema (AES-256-GCM + PBKDF2 200k iterations).
**Addresses:** ConfigService (ARCHITECTURE.md build order item 1), ESM-only output requirement (STACK.md chalk 5/ora 8 compatibility), exit code vocabulary (FEATURES.md table stakes).
**Avoids:** Solana SDK type mismatch pitfall (commit to @solana/kit 3.x before any signing code); non-differentiated exit codes pitfall (establish vocabulary before any commands exist).

### Phase 2: Wallet Service
**Rationale:** The wallet is the dependency blocker for all payment flows. WalletService is also the highest security-risk component — getting encryption wrong here is a HIGH recovery-cost pitfall. Building and testing it in isolation (before it's wired into any command) allows thorough unit testing of the AES-256-GCM path and PBKDF2 KDF without Commander scaffolding in the way.
**Delivers:** WalletService class with generate, import (base58/mnemonic), loadKeypair (decrypt-on-demand), and sign methods; AES-256-GCM + PBKDF2 200k iterations; env var passphrase path (`MAINLAYER_WALLET_PASSPHRASE`); `wallet create/import/balance/address` commands wired to Commander; file mode 0600 on wallet.json.
**Uses:** @solana/kit 3.x (generateKeyPairSigner), Node.js crypto (AES-256-GCM), @clack/prompts (passphrase entry), Node.js fs (0600 permissions).
**Implements:** WalletService component (ARCHITECTURE.md build order item 2).
**Avoids:** AES-256-CBC pitfall; weak KDF pitfall; passphrase-blocks-agent pitfall; private key in error output pitfall (implement redacted error handler before signing code is in place).

### Phase 3: Auth and API Client
**Rationale:** Once the wallet exists, auth enables all vendor and buyer resource operations. ApiClient is the second service-layer dependency and can be built and tested without the X402 layer attached. This phase establishes the HTTP patterns (auth header injection, error normalization, retry) that all subsequent API commands will reuse.
**Delivers:** ApiClient wrapping ky with Authorization header injection and structured error normalization; ConfigService JWT/api-key read and write; `auth login/register/logout` commands; `auth api-key create/list/revoke` commands; `MAINLAYER_API_KEY` env var as primary auth path; `conf` 13 for non-wallet config storage.
**Uses:** ky 1 (HTTP), conf 13 (config storage), Commander.js 14 (command registration).
**Implements:** ApiClient component (ARCHITECTURE.md build order item 3).
**Avoids:** JWT stored world-readable pitfall (set config file mode 0600).

### Phase 4: Resource Management and Discovery (Vendor + Buyer CLI)
**Rationale:** With auth and the API client in place, all CRUD commands become thin command handlers that call ApiClient methods. This is the largest surface area but the lowest complexity per command — established patterns from Phase 3 apply directly. Splitting vendor commands (resource, plan, earnings, metrics) and buyer commands (discover, entitlements) into this single phase is efficient because they share no inter-dependencies and all follow the same command-handler → ApiClient → format-output pattern.
**Delivers:** `resource create/list/get/update/delete`, `resource plan create/list/update/delete`, `discover`, `entitlements list`, `earnings`, `metrics` — all with `--json` flag and correct exit codes; TTY auto-detection defaulting to JSON when piped.
**Addresses:** Full P1 feature set from FEATURES.md (resource CRUD, discover, entitlements, earnings/metrics); agent UX requirements (--json, TTY detection, structured errors with `hint` field, idempotent operations with `--idempotency-key`).
**Avoids:** Separate output paths for JSON vs human pitfall — compute result once as typed object, pass to single output() utility.

### Phase 5: X402 Payment Flow (Buy and Subscribe)
**Rationale:** The X402 handler crosses the ApiClient and WalletService boundaries and has the most complex integration logic — it is built last among the service components per the architecture's build order. The blockhash expiry pitfall, the USDC floating-point pitfall, and the X402 USDC allowlist requirement are all concentrated here and must be addressed with explicit unit and integration tests before this phase is considered complete.
**Delivers:** X402Handler intercepting 402 responses, constructing SPL token delegate transactions, encoding X-PAYMENT headers, and retrying; `mainlayer buy <resource-id>` command; `subscribe approve/pause/resume/cancel/list` commands; transaction confirmation polling with `lastValidBlockHeight`; USDC mint allowlist enforcement; `Math.round` for USDC amount conversion.
**Uses:** x402-solana + @x402/core, @solana/kit 3.x transaction building, @solana-program/token (SPL token delegate instruction).
**Implements:** X402Handler component (ARCHITECTURE.md build order item 4).
**Avoids:** Solana blockhash expiry pitfall; X402 USDC floating-point precision pitfall; X402 token allowlist not enforced security mistake.

### Phase 6: MCP Auto-Configuration and npm Publishing
**Rationale:** The MCP installer is architecturally independent of the runtime CLI (no dependency on wallet or API client code) and can be built in parallel with Phase 4–5, but is placed last because it is most easily verified end-to-end once a working CLI binary exists (the installer writes the binary path into platform configs). This phase also covers the npm publishing hardening (files whitelist, prepublishOnly audit, npm provenance) which must happen before public release.
**Delivers:** Installer module (platform-detector + config-writer + SKILL.md copy); postinstall script (try/catch wrapped, exits 0 always, idempotent, no duplicates, writes backup before modification); `mainlayer setup` command (re-runnable fallback); Windows path support via path.join + os.homedir() + APPDATA env var; 11-platform config support (Claude Desktop macOS/Windows, Claude Code, Cursor, Gemini CLI, VS Code, Cline, Zed, Continue, Windsurf, OpenCode); npm package hardening (files whitelist to dist/ + bin/ only, prepublishOnly audit script, npm MFA + provenance).
**Uses:** Native fs/os/path (no external deps for installer), yaml/toml parsers only if YAML/TOML platforms are required.
**Avoids:** Postinstall fails silently pitfall; postinstall overwrites AI platform config pitfall; MCP config path breaks on Windows pitfall; publishing secrets to npm pitfall; package size/bloat pitfall.

### Phase Ordering Rationale

- ConfigService before everything: all other services depend on it for reading config and env vars.
- WalletService before ApiClient: wallet is security-critical and must be tested in isolation; also, WalletService is a dependency of X402Handler which wraps ApiClient.
- ApiClient before X402Handler: the 402 intercept is injected into ApiClient; it cannot be built without a working ApiClient to test against.
- Resource CRUD before buy/subscribe: agents cannot buy something that isn't listed; also, buy requires auth which requires the API client to be solid.
- MCP installer last: it can be built any time, but end-to-end verification requires the binary to exist.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (X402 Payment Flow):** The X402 v2 spec and Solana SVM signing integration are evolving quickly (v2 released Dec 2025). The interaction between `x402-solana`, `@solana/kit` 3.x transaction building, and the X402 facilitator confirmation flow needs concrete API research against the current x402-solana package source before implementation. Flag for `/gsd:research-phase`.
- **Phase 6 (MCP Installer — Windows):** Windows MCP config path handling (cmd /c npx, APPDATA, NVM path resolution) has multiple known failure modes documented in open GitHub issues. The Windsurf and Continue config paths were MEDIUM confidence in ARCHITECTURE.md. Verify against current platform documentation before implementing the platform registry.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Scaffolding):** TypeScript + tsdown + vitest + Commander.js scaffolding is entirely standard. Well-documented, no novel integration.
- **Phase 2 (Wallet Service):** AES-256-GCM + PBKDF2 in Node.js is prescribed by official Node.js crypto docs. No ambiguity.
- **Phase 3 (Auth + API Client):** Standard JWT auth pattern with ky. Established patterns.
- **Phase 4 (Resource CRUD):** REST CRUD wrapping with Commander.js. Standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack (Commander, TypeScript, Node 22, ky, conf) verified against npm download data and official changelogs. @solana/kit 3.x version confirmed on npm. tsdown migration from tsup confirmed via official tsdown docs. Only gap: MCP platform config paths are MEDIUM (ecosystem still evolving). |
| Features | HIGH | Verified against Stripe CLI docs, Railway CLI reference, x402 protocol docs, and Anthropic agent skills documentation. MVP feature set is conservative and well-grounded. |
| Architecture | HIGH | Three-layer CLI architecture is established practice. X402 intercept pattern is confirmed by Coinbase x402 repo. MCP config paths verified against MCP Playground guide and Anthropic GitHub issues. MEDIUM confidence only on Windsurf and Continue config paths. |
| Pitfalls | HIGH | Wallet security pitfalls verified against Node.js crypto docs, OWASP guidance, and CERT/CC advisories. Postinstall supply chain pitfall documented from real 2025 attack analysis (Snyk/Shai-Hulud). X402 floating-point and blockhash expiry pitfalls from published post-mortems. |

**Overall confidence:** HIGH

### Gaps to Address

- **Anchor compatibility with @solana/kit:** If any future feature requires Anchor (complex Solana programs), @solana/kit does not support Anchor as of early 2025. Anchor still targets web3.js v1. The @solana/web3-compat bridge package exists but adds complexity. Monitor during Phase 5 — for v1 USDC delegate transactions, Anchor is not needed.
- **X402 v2 session token API:** Session tokens are documented in the x402 v2 spec but the `x402-solana` package implementation details for session token management were not verified against the package source during research. Validate before implementing `buy --session` (v1.x feature, not MVP blocker).
- **Windsurf and Continue MCP config paths:** These two platforms were added to the ARCHITECTURE.md platform registry but with MEDIUM confidence. Verify path accuracy before writing the platform registry in Phase 6.
- **Mainlayer API contract:** The research assumes a standard REST API with standard auth patterns. The actual API endpoints, request/response schemas, and 402 response body format need to be verified against the live API or OpenAPI spec before Phase 3-5 implementation. If an OpenAPI spec is available, generate API types from it rather than hand-maintaining them.

## Sources

### Primary (HIGH confidence)
- [npmtrends: commander vs oclif vs yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs) — download numbers and bundle size comparison
- [Anza blog: @solana/kit release](https://www.anza.xyz/blog/solana-web3-js-2-release) — official @solana/kit announcement (Dec 2024)
- [@solana/kit npm page](https://www.npmjs.com/package/@solana/kit) — version 3.0.3 confirmed
- [Neon add-mcp GitHub](https://github.com/neondatabase/add-mcp) — all platform config file paths (HIGH confidence source)
- [tsdown migration guide](https://tsdown.dev/guide/migrate-from-tsup) — tsup deprecation confirmed
- [x402 protocol](https://www.x402.org/) — HTTP 402 payment flow, SPL token delegate signing
- [x402 V2 Launch](https://www.x402.org/writing/x402-v2-launch) — session tokens, single-deposit multi-request authorization
- [Stripe CLI Documentation](https://docs.stripe.com/stripe-cli) — command patterns, auth model, webhook CLI design
- [Railway CLI Reference](https://docs.railway.com/reference/cli-api) — global --json flag, RAILWAY_API_TOKEN, browserless auth
- [MCP config paths guide — MCP Playground](https://mcpplaygroundonline.com/blog/complete-guide-mcp-config-files-claude-desktop-cursor-lovable) — platform config paths
- [Claude Code MCP config paths — Anthropic GitHub issue #4976](https://github.com/anthropics/claude-code/issues/4976) — ~/.claude.json confirmed correct
- [AES-256-GCM in Node.js (official crypto docs)](https://nodejs.org/api/crypto.html) — wallet encryption pattern
- [Solana transaction retry guide (official)](https://solana.com/developers/guides/advanced/retry) — blockhash expiry handling
- [npm .npmignore vs .gitignore (npm Blog)](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish.html) — publish whitelist pattern
- [Agent Skills — Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — SKILL.md format

### Secondary (MEDIUM confidence)
- [Helius: Building with Solana Web3.js 2.0](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk) — kit API patterns (verified against kit GitHub)
- [viem.sh introduction](https://viem.sh/docs/introduction) — bundle size and TypeScript rationale
- [X402 Solana floating-point precision bug (dev.to)](https://dev.to/gen_ishinabe/adding-solana-payments-to-elizaos-what-i-learned-about-ssrf-floating-point-and-ipv6-15kh) — Math.round vs Math.floor pitfall
- [X402 payment timeout and confirmation issues (dev.to)](https://dev.to/mkmkkkkk/x402-payment-timeouts-why-your-agent-loses-money-and-how-to-fix-it-fgk) — blockhash expiry in X402 context
- [Shai-Hulud npm supply chain attack (Snyk, 2025)](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/) — postinstall attack vector context
- [Writing CLI Tools That AI Agents Actually Want to Use (dev.to)](https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no) — agent-first CLI design

### Tertiary (LOW confidence)
- Windsurf MCP config path (`~/.codeium/windsurf/mcp_config.json`) — needs re-verification before Phase 6
- Continue MCP config path (`~/.continue/config.json`) — needs re-verification before Phase 6
- X402 v2 session token `x402-solana` implementation details — verify against package source before v1.x implementation

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*

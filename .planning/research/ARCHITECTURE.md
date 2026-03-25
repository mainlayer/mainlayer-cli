# Architecture Research

**Domain:** TypeScript CLI with API client, blockchain wallet, and npm postinstall MCP auto-configuration
**Researched:** 2026-03-25
**Confidence:** HIGH (component boundaries, data flow, build order); MEDIUM (MCP platform path completeness — rapidly evolving ecosystem)

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        CLI Command Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  vendor  │  │  buyer   │  │  wallet  │  │  auth / setup    │  │
│  │ commands │  │ commands │  │ commands │  │  commands        │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │             │             │                  │             │
├───────┴─────────────┴──────┬──────┴──────────────────┴────────────┤
│                     Service Layer                                  │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │  ApiClient   │  │  WalletService │  │  ConfigService         │ │
│  │  (HTTP+auth) │  │  (keys+sign)   │  │  (read/write JSON)     │ │
│  └──────┬───────┘  └───────┬────────┘  └────────────────────────┘ │
│         │                  │                                       │
├─────────┴──────────────────┴───────────────────────────────────────┤
│                   Infrastructure Layer                             │
│  ┌───────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │  HTTP (axios/ │  │  Crypto          │  │  fs / os           │  │
│  │  fetch)       │  │  (AES-256-GCM,   │  │  (~/.mainlayer/)   │  │
│  │               │  │   @solana/web3.js│  │                    │  │
│  └───────────────┘  └──────────────────┘  └────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘

Install-time (postinstall / mainlayer setup):
┌────────────────────────────────────────────────────────────────────┐
│                      MCP Installer                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐   │
│  │  Platform Detector   │  │  Config Writer                   │   │
│  │  (detect AI tool     │  │  (patch JSON / YAML per platform │   │
│  │   config dirs)       │  │   + copy skills.md)              │   │
│  └──────────────────────┘  └──────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| CLI Command Layer | Parse argv, validate input, render output (text + JSON) | Commander.js program tree; one file per command group |
| ApiClient | All HTTP to mainlayer-api; inject auth header; handle 402 intercept | Class wrapping axios/fetch; singleton via config-injected factory |
| WalletService | Generate/import/export Solana keypair; AES-256-GCM encrypt at rest; sign X402 transactions | Pure class, no Commander dependency; exposes async sign() |
| ConfigService | Read/write `~/.mainlayer/config.json`; resolve API URL, auth token, wallet path | Thin fs wrapper; loaded once at CLI startup |
| MCP Installer | Detect AI platform config dirs; patch mcpServers JSON; copy skills.md | Standalone script, runs in postinstall and via `mainlayer setup` |
| Platform Detector | Probe known config paths per OS; return list of writable targets | Table of (platform, path template, schema) entries |
| Config Writer | Merge MCP server entry without destructing existing config; idempotent | JSON merge with deep-set; YAML write for platforms needing it |

## Recommended Project Structure

```
src/
├── cli/                    # Entry point and command registration
│   ├── index.ts            # program root, bin entry point
│   ├── auth.ts             # auth register/login/api-key commands
│   ├── vendor.ts           # resource, plan, quota, coupon, webhook, earnings commands
│   ├── buyer.ts            # discover, buy, subscribe, entitlements, invoices commands
│   ├── wallet.ts           # wallet create/import/balance/address/export commands
│   └── setup.ts            # mainlayer setup (re-runs MCP installer)
├── services/
│   ├── api-client.ts       # ApiClient class — all REST calls
│   ├── wallet-service.ts   # WalletService — keypair + signing
│   ├── config-service.ts   # ConfigService — ~/.mainlayer/config.json
│   └── x402-handler.ts     # X402 intercept — handles 402 → sign → retry
├── installer/
│   ├── platform-detector.ts  # Probe AI platform config paths
│   ├── config-writer.ts      # Patch mcpServers into platform configs
│   ├── platforms.ts          # Platform registry (paths, schemas, OS)
│   └── index.ts              # Orchestrates detect → write → copy skills.md
├── types/
│   ├── api.ts              # API response types
│   ├── wallet.ts           # EncryptedKeystore, WalletMeta types
│   └── config.ts           # MainlayerConfig type
└── utils/
    ├── output.ts           # formatJson() / formatTable() / printError()
    ├── prompt.ts           # Passphrase prompt (inquirer or @inquirer/prompts)
    └── errors.ts           # Typed error classes, exit codes

scripts/
└── postinstall.ts          # npm postinstall entry — runs installer/index.ts

static/
└── skills.md               # Bundled agent instruction file (copied at install time)
```

### Structure Rationale

- **cli/:** Thin command handlers only — parse args, call services, format output. No business logic. One file per command group keeps files under 500 lines.
- **services/:** All stateful logic lives here, making it independently testable without Commander. `x402-handler.ts` is separated from `api-client.ts` because it crosses ApiClient + WalletService boundaries and needs its own test surface.
- **installer/:** Isolated from the runtime CLI. Runs at install time and on demand. Keeping it separate prevents accidental import of platform-path knowledge into production code paths.
- **types/:** All exported interfaces in one place. API types generated from OpenAPI spec if available; otherwise hand-maintained.
- **static/:** Files distributed with the npm package via `files` in package.json. `skills.md` is static — updated each release.

## Architectural Patterns

### Pattern 1: Service Injection via Config-Loaded Factory

**What:** CLI entry point loads config once (`ConfigService.load()`), constructs services (`new ApiClient(config)`, `new WalletService(config)`), and passes them down to command handlers via Commander's `program` context or explicit argument.

**When to use:** Always — prevents each command from re-reading disk or re-creating HTTP clients.

**Trade-offs:** Slight startup overhead; avoids scattered singleton state.

**Example:**
```typescript
// src/cli/index.ts
const config = await ConfigService.load();
const api = new ApiClient(config);
const wallet = new WalletService(config);

program
  .command('buy <resource-id>')
  .action(async (resourceId) => {
    await buyCommand({ resourceId, api, wallet });
  });
```

### Pattern 2: X402 Intercept at ApiClient Layer

**What:** `ApiClient` wraps every request in a try/catch for HTTP 402. On 402, it delegates to `X402Handler` (which calls `WalletService.sign()`), then retries. The calling command never needs to know the payment happened.

**When to use:** For all `buy` and `subscribe approve` flows. Intercept at HTTP adapter layer, not at command layer.

**Trade-offs:** Commands stay simple; 402 retry logic is centralized; adds one async hop per paid request.

**Example:**
```typescript
// services/api-client.ts
async request<T>(opts: RequestOptions): Promise<T> {
  const res = await this.http(opts);
  if (res.status === 402) {
    const paymentHeader = await this.x402Handler.buildPayment(res);
    return this.http({ ...opts, headers: { ...opts.headers, 'X-PAYMENT': paymentHeader } });
  }
  return res.data;
}
```

### Pattern 3: Idempotent MCP Installer

**What:** The postinstall script reads each detected platform config file, checks if the mainlayer MCP entry already exists, and only writes if absent. Running `npm install @mainlayer/cli` a second time does not duplicate entries.

**When to use:** Always — users re-install and upgrade frequently. Non-idempotent postinstall scripts are a support burden.

**Trade-offs:** Requires JSON parse+merge logic; must handle malformed JSON gracefully (create fresh file on parse failure).

## Data Flow

### Standard API Request Flow

```
User / Agent
    ↓ (argv)
Command Handler (cli/buyer.ts)
    ↓ (call api.discover())
ApiClient.request()
    ↓ (HTTP GET with Authorization header)
mainlayer-api REST endpoint
    ↓ (200 JSON)
ApiClient returns typed response
    ↓
Command Handler formats output
    ↓ (stdout JSON or table)
User / Agent
```

### X402 Payment Signing Flow (Critical Path)

```
Command: mainlayer buy <resource-id>
    ↓
ApiClient.request(POST /pay)
    ↓
mainlayer-api responds HTTP 402
  Body: { scheme, network, recipient, amount, tokenMint, ... }
    ↓
X402Handler.buildPayment(response402)
    ↓
WalletService.loadKeypair(passphrase)        ← AES-256-GCM decrypt wallet.json
    ↓
Construct SPL token delegate transaction      ← @solana/web3.js + @solana/spl-token
  createTransferInstruction(from ATA, to recipient ATA, amount)
    ↓
tx.sign(keypair)                              ← sign locally, do NOT submit
    ↓
Serialize tx to base64
    ↓
Encode X-PAYMENT header:
  base64({ x402Version:1, scheme:"exact", network:"solana:...",
           payload:{ serializedTransaction } })
    ↓
ApiClient retries original request
  Headers: { X-PAYMENT: <encoded> }
    ↓
mainlayer-api verifier broadcasts tx, returns 200 + entitlement
    ↓
Command Handler prints success (--json or table)
```

### Wallet Encryption / Decryption Flow

```
mainlayer wallet create
    ↓
WalletService.generateKeypair()               ← Keypair.generate() (@solana/web3.js)
    ↓
Prompt passphrase (inquirer)
    ↓
PBKDF2(passphrase, salt, 100000 iters) → masterKey
    ↓
AES-256-GCM encrypt(secretKey bytes, masterKey, iv)
    ↓
Write ~/.mainlayer/wallet.json
  { version, salt, iv, ciphertext, pubkey }
    ↓
Write ~/.mainlayer/config.json
  { walletPath: "~/.mainlayer/wallet.json", ... }
```

### MCP Auto-Install Flow (postinstall / mainlayer setup)

```
scripts/postinstall.ts
    ↓
installer/platform-detector.ts
  For each platform in registry:
    probe config path (os.homedir() + template)
    check path exists
    collect writable targets
    ↓
installer/config-writer.ts
  For each target:
    read existing config JSON (or start with {})
    deep-set mcpServers.mainlayer = { command:"mainlayer", args:["mcp"] }
    write back atomically (write to .tmp, rename)
    ↓
copy static/skills.md → each detected platform dir
    ↓
Print summary: "Configured for: Claude Desktop, Cursor"
```

### Key Data Flows Summary

1. **Auth flow:** `mainlayer auth login` → POST /auth/login → JWT → ConfigService.write(token) → all subsequent ApiClient requests include `Authorization: Bearer <token>`
2. **API key flow:** JWT can be replaced by `sk_live_/sk_test_` in config; ApiClient checks config.authToken type and sets appropriate header
3. **Wallet-sign flow:** WalletService only decrypts at sign time, never holds plaintext secret in memory between commands
4. **Config cascade:** Config reads `MAINLAYER_API_URL` env first, falls back to config.json value, falls back to hardcoded default

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k installs | Single process, synchronous config reads, no connection pooling needed |
| 1k–100k installs | No server-side scaling concern — CLI is client-only; API client should respect rate limits from server responses |
| Distributed AI agents | Add `--json` output on all commands (already required); ensure non-interactive passphrase via env var `MAINLAYER_WALLET_PASSPHRASE` for headless use |

### Scaling Priorities

1. **First bottleneck:** Passphrase prompts block headless agents — must support `MAINLAYER_WALLET_PASSPHRASE` env var from day one
2. **Second bottleneck:** RPC calls to Solana — balance/sign operations call on-chain; add connection timeout and fallback RPC URL to config

## MCP Platform Registry

Confirmed config file paths (HIGH confidence — sourced from MCP Playground guide and Anthropic docs):

| Platform | OS | Config Path | MCP Key | Notes |
|----------|----|------------|---------|-------|
| Claude Desktop | macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` | `mcpServers` | Requires restart |
| Claude Desktop | Windows | `%APPDATA%\Claude\claude_desktop_config.json` | `mcpServers` | Requires restart |
| Claude Code | Any | `~/.claude.json` (user scope) | `mcpServers` under project path | `.claude/settings.json` does NOT work for MCP |
| Cursor | Any | `~/.cursor/mcp.json` | `mcpServers` | No restart needed |
| Cursor | Any | `.cursor/mcp.json` | `mcpServers` | Project-scoped |
| VS Code | Any | `.vscode/mcp.json` | `servers` | Workspace-scoped only |
| Windsurf | macOS/Linux | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | — |
| Windsurf | Windows | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `mcpServers` | — |
| Gemini CLI | Any | `.gemini/settings.json` (project root) | `mcpServers` | — |
| Cline (VSCode ext) | macOS | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | `mcpServers` | — |
| Zed | Any | `~/.config/zed/settings.json` | `context_servers` | Different key name |
| Continue | Any | `~/.continue/config.json` | `mcpServers` (array) | Array, not object |

**Installer strategy:** Use `os.homedir()` + `os.platform()` + `process.env` to resolve path templates. Check `fs.existsSync()` on each candidate before attempting write. Skip silently if platform not detected. Log which platforms were configured.

## Anti-Patterns

### Anti-Pattern 1: Business Logic in Command Handlers

**What people do:** Put API calls, wallet operations, and response formatting directly inside Commander `.action()` callbacks.

**Why it's wrong:** Untestable without spawning Commander; commands grow past 500 lines; duplicate logic across similar commands.

**Do this instead:** Command handlers call service methods and format the return value. All logic lives in `services/`. Commands are 20-40 lines.

### Anti-Pattern 2: Decrypt Wallet at Startup

**What people do:** Decrypt the wallet keypair once when the CLI starts and hold it in memory for the session.

**Why it's wrong:** Extends the window during which the plaintext key is in process memory. Most commands don't need wallet access.

**Do this instead:** Decrypt on demand, inside `WalletService.sign()` only. Prompt for passphrase at sign time or read from `MAINLAYER_WALLET_PASSPHRASE` env var for headless operation.

### Anti-Pattern 3: postinstall Script That Throws on Missing Platforms

**What people do:** Write postinstall that errors out if Claude Desktop config dir doesn't exist.

**Why it's wrong:** npm install fails on machines with no AI tools, blocking the package entirely.

**Do this instead:** Wrap all platform writes in try/catch. Emit warnings (not errors) for failures. Exit 0 always — let `mainlayer setup --verbose` be where users debug installer issues.

### Anti-Pattern 4: Hardcoded MCP Server Entry

**What people do:** Write a fixed `"command": "mainlayer", "args": ["mcp"]` without considering that the binary may be installed at `npx @mainlayer/cli` in some environments.

**Why it's wrong:** Agents that install globally see the right binary; agents that use `npx` need a different invocation.

**Do this instead:** Detect `which mainlayer` at install time; if found, use it as command. Otherwise fall back to `{"command": "npx", "args": ["-y", "@mainlayer/cli", "mcp"]}`.

### Anti-Pattern 5: Separate Output Paths for JSON vs Human

**What people do:** Have a `--json` path and a separate human-readable path that compute results differently.

**Why it's wrong:** Divergence bugs; agents get different data than humans.

**Do this instead:** Compute result once as a typed object. Pass it to a single `output(result, options)` utility that formats it as JSON or table based on `--json` flag.

## Build Order

The following dependency graph drives phase sequencing:

```
1. ConfigService              (no deps — pure fs)
2. WalletService              (deps: ConfigService, crypto, @solana/web3.js)
3. ApiClient                  (deps: ConfigService, HTTP library)
4. X402Handler                (deps: ApiClient, WalletService, @x402/svm or manual)
5. CLI Command Layer          (deps: all services)
6. MCP Installer              (deps: ConfigService, fs/os — independent of wallet/api)
7. postinstall script         (deps: MCP Installer)
```

**Rule:** Lower-numbered components must be built and tested before higher-numbered ones depend on them. The MCP Installer (#6) can be built in parallel with the CLI Command Layer (#5) — it has no runtime dependency on the command layer.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| mainlayer-api REST | `ApiClient` wraps axios; injects auth header on every request | API URL from config; `MAINLAYER_API_URL` env override |
| Solana RPC | `@solana/web3.js` `Connection`; used for balance queries and transaction broadcast confirmation | Connection URL configurable; default to mainnet-beta public RPC |
| Solana SPL token | `@solana/spl-token` `createTransferInstruction`; used to build X402 payment transactions | Only for buy/subscribe flows — not for wallet create |
| X402 facilitator | Embedded in mainlayer-api at `/pay`; CLI signs tx locally, server broadcasts | CLI never submits to chain directly for X402 payments |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CLI commands ↔ ApiClient | Direct method call (typed return) | Never import axios in command files |
| CLI commands ↔ WalletService | Direct method call; passphrase prompt managed at command layer | Commands decide when to prompt; WalletService just decrypts |
| ApiClient ↔ X402Handler | ApiClient calls handler on 402; handler calls WalletService | Handler is injected into ApiClient constructor |
| MCP Installer ↔ ConfigService | Installer reads config for MCP server name/args; writes platform configs | No circular dependency — installer only reads mainlayer config, writes platform configs |
| postinstall ↔ Installer | postinstall imports installer/index.ts and calls install() | postinstall script is thin wrapper; all logic in installer module |

## Sources

- [Commander.js npm page](https://www.npmjs.com/package/commander) — CLI framework patterns
- [x402 Coinbase repo](https://github.com/coinbase/x402) — Protocol spec and TypeScript package structure
- [X402 on Solana guide](https://solana.com/developers/guides/getstarted/intro-to-x402) — SVM signing flow detail
- [MCP config paths guide — MCP Playground](https://mcpplaygroundonline.com/blog/complete-guide-mcp-config-files-claude-desktop-cursor-lovable) — Platform config file paths (HIGH confidence)
- [Claude Code MCP config paths — Anthropic GitHub issue](https://github.com/anthropics/claude-code/issues/4976) — Confirmed ~/.claude.json is correct; settings.json does NOT work for MCP
- [Windsurf MCP setup](https://fast.io/resources/windsurf-mcp-setup-guide/) — ~/.codeium/windsurf/mcp_config.json
- [Gemini CLI MCP docs](https://geminicli.com/docs/tools/mcp-server/) — .gemini/settings.json
- [Solana encrypted keypair storage — sRFC 00007](https://forum.solana.com/t/srfc-00007-encryption-standard-for-solana-keypairs/65) — AES-256-GCM + PBKDF2 pattern
- [add-mcp tool](https://neon.com/blog/add-mcp) — Reference for multi-platform MCP installer pattern

---
*Architecture research for: @mainlayer/cli — TypeScript CLI with API client, Solana/EVM wallet, X402 payments, npm postinstall MCP auto-configuration*
*Researched: 2026-03-25*

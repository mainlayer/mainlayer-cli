# Technology Stack

**Project:** @mainlayer/cli
**Researched:** 2026-03-25
**Confidence:** HIGH (core stack) / MEDIUM (MCP platform config paths)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | 5.x | Language | Strict typing reduces bugs at API boundaries; first-class support across all libraries in this stack |
| Node.js | 22 LTS | Runtime | LTS guarantees; native ESM support; built-in `crypto` module for AES-256-GCM |
| Commander.js | 14.x | CLI framework | 276M weekly downloads, 0 dependencies, 180KB, 18ms startup overhead. Best DX for nested subcommands (`mainlayer auth login`, `mainlayer resource create`). Wins over oclif (70-100ms overhead, 12MB, forced class-per-command) and yargs (heavier at 850KB). Latest is 14.0.2. |

### Blockchain

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @solana/kit | 3.x (3.0.3) | Solana transactions, keypair management | **Use this, not the legacy @solana/web3.js v1.** Released as web3.js 2.0 in Dec 2024, renamed to @solana/kit. Tree-shakeable, 10x faster crypto ops via Web Crypto API, ~26% smaller bundles, ~200ms faster confirmations. `generateKeyPairSigner()` replaces `Keypair.generate()`. All crypto ops are async. |
| @solana-program/token | latest | SPL token operations (USDC) | Required when using @solana/kit v2+. **Do NOT use @solana/spl-token with @solana/kit** — @solana/spl-token 0.4.x is tied to legacy web3.js v1 and its install docs explicitly say `npm install @solana/spl-token @solana/web3.js@1`. |
| viem | 2.x | EVM signing and transaction building | TypeScript-first, 35kB bundle, strongly typed contract interactions. Beats ethers.js v6 on type safety, bundle size, and modern API design. For a CLI that only needs to sign EVM transactions (not deploy contracts), viem's modular approach keeps the footprint minimal. |

### Wallet Storage and Encryption

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js `crypto` (built-in) | — | AES-256-GCM encryption of keypair at rest | Zero dependencies. Use AES-256-GCM (not CBC) — GCM is authenticated encryption so tampering is detectable. Store in `~/.mainlayer/wallet.json` as `{ iv, authTag, ciphertext }`. Derive the encryption key from user passphrase via PBKDF2 (100k+ iterations) with a stored salt. |
| conf | 13.x | User config storage (JWT, API keys, base URL) | TypeScript-native, uses OS-appropriate paths (`~/.config/mainlayer` on Linux, `~/Library/Preferences/mainlayer` on macOS). Separates app config from wallet file. Do NOT use it for wallet private key storage — its `encryptionKey` option is obfuscation only, not real security. |

### HTTP Client

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ky | 1.x | REST API calls to Mainlayer backend | Built on Fetch API (native in Node 22+), tiny (4kB), TypeScript-first, clean hooks API for auth header injection, retries, error normalization. Simpler than axios for a pure API-wrapper CLI. |

### X402 Payment Protocol

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| x402-solana | latest | Handle X402 SVM payment flows | Official Solana-specific implementation of the x402 v2 spec. Handles the `402 Payment Required` → sign → retry flow for Solana clients. 35k weekly downloads on the core `x402` package. |
| @x402/core | latest | X402 type definitions and utilities | Transport-agnostic types shared across the x402 ecosystem. Use for response parsing and request construction. |

### User Interface (Terminal)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @clack/prompts | latest | Interactive prompts (passphrase entry, confirmations) | Modern replacement for Inquirer.js. Ships opinionated, beautiful output out of the box with no configuration. Specifically designed for CLI tools rather than forms. Use for `wallet create` passphrase prompts and destructive action confirmations. |
| ora | 8.x | Spinners during async ops | Standard; 0 config; pairs naturally with Commander. Use for API calls, on-chain transactions. Ora 8 is ESM-only — ensure tsdown outputs ESM. |
| chalk | 5.x | Terminal color output | ESM-only in v5. Use sparingly — primary output is JSON (machine-readable). Color only for human-facing status messages and error display. |

### MCP Auto-Configuration (postinstall)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `fs`/`os`/`path` (built-in) | — | Platform config file detection and writing | No external dependency needed for postinstall. Walk known config paths from the table below, test for existence, merge MCP entry into JSON/YAML/TOML. Keep postinstall lightweight — npm runs it synchronously and users hate slow installs. |

### Build and Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tsdown | latest | TypeScript bundler | Successor to tsup (tsup is no longer actively maintained). Powered by Rolldown, 2x faster than tsup, 8x faster for type declarations, ESM-first. Drop-in replacement for tsup config. |
| vitest | 3.x | Unit testing | Zero-config TypeScript. 30-70% faster than Jest. No babel/ts-jest setup. Use for testing command handlers, wallet crypto, API client adapters. |
| eslint + @typescript-eslint | 8.x | Linting | Standard; matches project CLAUDE.md requirement of `npm run lint`. |
| prettier | 3.x | Formatting | Paired with eslint-config-prettier to avoid rule conflicts. |

---

## MCP Auto-Configuration Platform Map

The postinstall script must detect these platforms and write the MCP server entry. The `add-mcp` open-source tool (Neon) is the reference implementation — use their config path table rather than guessing.

| Platform | Project-level Config | Global Config |
|----------|---------------------|---------------|
| Claude Code | `.mcp.json` | `~/.claude.json` |
| Claude Desktop (macOS) | — | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | — | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` | `~/.cursor/mcp.json` |
| Gemini CLI | `.gemini/settings.json` | `~/.gemini/settings.json` |
| VS Code (Copilot) | `.vscode/mcp.json` | `~/Library/Application Support/Code/User/mcp.json` |
| OpenCode | `opencode.json` | `~/.config/opencode/opencode.json` |
| Cline (VSCode ext.) | — | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Zed | `.zed/settings.json` | `~/Library/Application Support/Zed/settings.json` |
| Goose | `.goose/config.yaml` | `~/.config/goose/config.yaml` |
| Codex | `.codex/config.toml` | `~/.codex/config.toml` |

**Detection strategy:** Check for the global config file existence, then the project-level path. If neither exists, skip silently. Write only what's necessary — merge the MCP entry into the existing config, do not overwrite the entire file. Use JSON.parse/stringify for JSON files; yaml for YAML files; toml for TOML files (add `@ltd/j-toml` only if Codex support is needed).

**postinstall constraints:**
- Must not fail on partial installs or missing platforms
- Must not prompt the user (non-interactive)
- Must exit 0 even if all platforms are absent
- Should print a summary: `Configured MCP for: Claude Code, Cursor` to stderr
- Idempotent — re-running must not duplicate entries

---

## Installation

```bash
# Core runtime dependencies
npm install commander@14 @solana/kit @solana-program/token viem ky conf @clack/prompts ora chalk x402-solana @x402/core

# Dev dependencies
npm install -D typescript tsdown vitest @vitest/coverage-v8 eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier @types/node
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CLI framework | Commander.js 14 | oclif | oclif adds 70-100ms startup, 12MB, forces one-file-per-command. Way more boilerplate for a single-binary CLI. |
| CLI framework | Commander.js 14 | yargs | Yargs is fine but 850KB vs Commander's 180KB, no compelling advantage for this project. |
| CLI framework | Commander.js 14 | Ink (React for CLI) | Ink is for rich interactive UIs; overkill for a machine-first CLI. Adds React as a dependency. |
| Solana SDK | @solana/kit 3.x | @solana/web3.js v1 | v1 is legacy. Not tree-shakeable. No Web Crypto API. @solana/kit is the official forward path from Anza. |
| EVM library | viem | ethers.js v6 | Ethers v6 is solid but larger bundle and less strict TypeScript types. viem wins on type safety for a new project. |
| Bundler | tsdown | tsup | tsup is no longer actively maintained. tsdown is the direct successor from the same ecosystem. |
| Test runner | vitest | jest | jest requires ts-jest or babel config for TypeScript. Vitest is zero-config. Both handle Node.js CLI testing equally well. |
| Config storage | conf | configstore | configstore is deprecated. conf is the maintained modern replacement. |
| Prompts | @clack/prompts | inquirer.js | inquirer requires ora + chalk + manual formatting to look polished. @clack/prompts ships all of that styled. |
| HTTP | ky | axios | axios is fine but heavier. ky is Fetch-based (Node 22 native), typed, smaller. |
| Encryption | Node crypto (AES-256-GCM) | conf encryptionKey option | conf's encryptionKey is obfuscation only — the key is in plain-text source. For wallet private keys, use real PBKDF2-derived encryption. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| @solana/web3.js v1 (legacy) | No longer receiving feature updates; not tree-shakeable; slower crypto; PROJECT.md already specifies `@solana/web3.js` but the intent maps to the current SDK which is now `@solana/kit` | `@solana/kit` 3.x |
| @solana/spl-token 0.4.x | Explicitly tied to web3.js v1. Its own README says `npm install @solana/spl-token @solana/web3.js@1`. Mixing with @solana/kit causes type conflicts. | `@solana-program/token` |
| tsup | Author has effectively abandoned it; known ESM output bugs. tsdown is the drop-in successor. | `tsdown` |
| conf encryptionKey for wallet | Security theater — key is in source. Fails any security audit. | Node.js `crypto` + PBKDF2 |
| Ink (React for CLIs) | React dependency, wrong paradigm for machine-first JSON-output CLI | Commander.js + @clack/prompts |
| chalk 4 / ora 7 | CJS versions; mixing with ESM output causes issues | chalk 5 + ora 8 (both ESM-only; ensure tsdown ESM output) |
| configstore | Deprecated. Uses `~/.config` but has known issues on Windows | `conf` 13.x |
| inquirer legacy (`inquirer` package) | Heavy; needs manual styling; the modern `@inquirer/prompts` is fine but @clack/prompts is cleaner | `@clack/prompts` |

---

## Stack Patterns by Variant

**If a command must be non-interactive (agent/CI use case, default):**
- Skip all @clack/prompts calls
- Output JSON to stdout via `--json` flag
- Use `process.exitCode = 1` for errors, never throw to top level unhandled

**If a command requires a passphrase (wallet create/import/export):**
- Check for `MAINLAYER_WALLET_PASSPHRASE` env var first (agent-friendly)
- Fall back to @clack/prompts `password()` for human interactive use
- Never echo passphrase to stdout

**If postinstall runs in CI:**
- Detect `CI=true` env var and skip interactive output
- Still attempt config file writes — this is beneficial (agent environments)

**If Anchor is needed for complex Solana programs:**
- @solana/kit does NOT yet have Anchor support (Anchor still targets web3.js v1)
- Keep a compatibility shim via `@solana/web3-compat` if Anchor integration is required
- For v1 (USDC delegate transactions only), Anchor is NOT needed — raw instruction building with @solana/kit suffices

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @solana/kit 3.x | @solana-program/token (latest) | Both use Web Crypto API async key operations. Compatible. |
| @solana/kit 3.x | @solana/spl-token 0.4.x | NOT compatible. @solana/spl-token requires web3.js v1. |
| @solana/kit 3.x | Anchor | NOT compatible out of the box. Anchor targets web3.js v1. Use @solana/web3-compat bridge if needed. |
| viem 2.x | Node.js 22 | Full compatibility. viem uses native Fetch which is stable in Node 22. |
| chalk 5.x | tsdown ESM output | Compatible. Both require ESM. Set `"type": "module"` in package.json or use `.mjs` entry. |
| ora 8.x | tsdown ESM output | Compatible. ESM-only. Same ESM requirement as chalk 5. |
| Commander.js 14.x | ESM + CJS | Commander supports both. Use ESM throughout for consistency with ora/chalk. |

---

## Wallet Keystore Format

Store at `~/.mainlayer/wallet.json`. Never commit, never upload.

```json
{
  "version": 1,
  "solana": {
    "publicKey": "<base58 public key>",
    "encrypted": {
      "algorithm": "aes-256-gcm",
      "kdf": "pbkdf2",
      "iterations": 200000,
      "salt": "<hex>",
      "iv": "<hex>",
      "authTag": "<hex>",
      "ciphertext": "<hex>"
    }
  },
  "evm": {
    "address": "<0x...>",
    "encrypted": { "...same shape..." }
  }
}
```

- Use 200,000 PBKDF2 iterations (OWASP 2023 minimum for SHA-256)
- AES-256-GCM: 12-byte IV (96 bits, GCM standard), 16-byte authTag
- Ciphertext is the raw private key bytes (32 bytes for both Solana and EVM)
- `wallet export` must re-prompt passphrase and confirm before decrypting

---

## Sources

- [npmtrends: commander vs oclif vs yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs) — download numbers and size comparison
- [Anza blog: @solana/kit release](https://www.anza.xyz/blog/solana-web3-js-2-release) — official @solana/kit announcement (Dec 2024)
- [Helius: Building with Solana Web3.js 2.0](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk) — MEDIUM confidence, verified against official kit GitHub
- [@solana/kit npm page](https://www.npmjs.com/package/@solana/kit) — version 3.0.3 confirmed current
- [@solana/spl-token npm page](https://www.npmjs.com/package/@solana/spl-token) — version 0.4.14, web3.js@1 dependency confirmed
- [viem.sh introduction](https://viem.sh/docs/introduction) — bundle size, TypeScript rationale
- [Neon add-mcp GitHub](https://github.com/neondatabase/add-mcp) — all platform config file paths (HIGH confidence source)
- [tsdown migration guide](https://tsdown.dev/guide/migrate-from-tsup) — tsup deprecation confirmed
- [tsdown GitHub](https://github.com/rolldown/tsdown) — Rolldown-powered, performance benchmarks
- [vitest docs](https://vitest.dev/guide/) — zero-config TypeScript support confirmed
- [x402 npm](https://www.npmjs.com/package/x402) — 35k weekly downloads, official Coinbase protocol
- [x402-solana npm](https://www.npmjs.com/package/x402-solana) — Solana-specific x402 v2 client

---
*Stack research for: @mainlayer/cli — TypeScript CLI with Solana+EVM wallet, MCP auto-configuration*
*Researched: 2026-03-25*

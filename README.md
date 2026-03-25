# @mainlayer/cli

> AI-native CLI for the Mainlayer payment infrastructure — discover, buy, and sell digital resources on-chain.

[![npm version](https://img.shields.io/npm/v/@mainlayer/cli)](https://www.npmjs.com/package/@mainlayer/cli)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## Installation

```bash
npm install -g @mainlayer/cli
```

On install, `postinstall` automatically detects AI platforms on your machine (Claude Code, Cursor, Windsurf, Gemini CLI, VS Code, Zed, Continue, Cline) and configures the Mainlayer MCP server in each one. To re-run detection manually:

```bash
mainlayer setup
```

---

## Quick Start: Vendor

Register, create a resource, set pricing, and configure your webhook:

```bash
# Register and authenticate
mainlayer auth register --email vendor@example.com --password YourP@ssw0rd
mainlayer auth api-key create --label "my-service"
# Set the returned key as your env var:
export MAINLAYER_API_KEY=sk_live_...

# Create a wallet (required for receiving payments)
export MAINLAYER_WALLET_PASSPHRASE=my-secure-passphrase
mainlayer wallet create

# Register your resource
mainlayer resource create \
  --slug my-api \
  --description "My AI API endpoint" \
  --price 0.01 \
  --fee-model per_call \
  --type api

# Add a subscription plan (optional)
mainlayer resource plan create \
  --resource-id res_... \
  --name "Basic" \
  --price 9.99 \
  --interval monthly

# Configure webhook for payment events
mainlayer webhook update --url https://example.com/webhooks
```

---

## Quick Start: Buyer

Register, fund a wallet, discover resources, and buy:

```bash
# Register and authenticate
mainlayer auth register --email buyer@example.com --password YourP@ssw0rd
mainlayer auth api-key create --label "buyer-agent"
export MAINLAYER_API_KEY=sk_live_...

# Create and fund a wallet (fund with SOL + USDC before buying)
export MAINLAYER_WALLET_PASSPHRASE=my-secure-passphrase
mainlayer wallet create
# Fund your wallet address with SOL and USDC, then:

# Browse available resources
mainlayer discover --query "data feeds"

# Purchase a resource (X402 on-chain payment)
mainlayer buy <resource-id>

# Verify access
mainlayer entitlements
```

---

## Wallet Security

The `@mainlayer/cli` wallet uses **AES-256-GCM** encryption with **PBKDF2 key derivation** (200,000 iterations, OWASP 2023 minimum) to protect your private keys at rest.

- **Private keys never leave your machine unencrypted.** The `wallet export` command re-prompts the passphrase before decrypting.
- **Stored at** `~/.mainlayer/wallet.json` as `{ iv, authTag, salt, ciphertext }`.
- **Lazy decryption:** The passphrase is only required at signing time, not on CLI startup.
- **Headless mode:** Set `MAINLAYER_WALLET_PASSPHRASE` env var to avoid interactive prompts in agent/CI environments. The passphrase is never echoed to stdout.

```bash
# Headless mode (agent/CI)
export MAINLAYER_WALLET_PASSPHRASE=your-passphrase
mainlayer buy <resource-id> --json
```

---

## MCP Auto-Configuration

When you run `npm install -g @mainlayer/cli`, the postinstall script:

1. Detects which AI platforms are installed by checking for their config files
2. Writes a Mainlayer MCP entry (`https://api.mainlayer.io/mcp`) to each detected platform
3. Drops a `mainlayer-skills.md` agent guide into each platform's config directory
4. Prints a summary to stderr: `Configured MCP for: Claude Code, Cursor`

**Supported platforms:**

- [x] Claude Code (`~/.claude.json`)
- [x] Cursor (`~/.cursor/mcp.json`)
- [x] Windsurf (`~/.codeium/windsurf/mcp_config.json`)
- [x] Gemini CLI (`~/.gemini/settings.json`)
- [x] VS Code Copilot (`~/Library/Application Support/Code/User/mcp.json`)
- [x] Zed (`~/.config/zed/settings.json`)
- [x] Continue (`~/.continue/mcpServers/mainlayer.yaml`)
- [x] Cline (VSCode extension)

> **Claude Desktop** does not support remote HTTP MCP servers via `claude_desktop_config.json`. To connect Claude Desktop, go to **Settings > Connectors** and add `https://api.mainlayer.io/mcp` manually.

**Re-run detection:**

```bash
# Re-run platform detection (idempotent — skips already-configured platforms)
mainlayer setup

# Overwrite existing entries (e.g., after updating API URL)
mainlayer setup --force

# JSON output for programmatic use
mainlayer setup --json
```

---

## CLI Command Reference

| Command | Description |
|---------|-------------|
| `mainlayer auth` | Register, login, logout, status, API key management (create/list/revoke) |
| `mainlayer wallet` | Create, import, address, balance, export — encrypted local keypair |
| `mainlayer config` | Get and set CLI configuration values |
| `mainlayer resource` | Create, list, get, update, delete resources; manage plans and quotas |
| `mainlayer coupon` | Create, list, delete discount codes |
| `mainlayer webhook` | Update URL, view logs, retry deliveries, rotate signing secret |
| `mainlayer earnings` | Revenue summary with period filtering and daily breakdown |
| `mainlayer metrics` | Per-resource usage analytics (calls, buyers, errors) |
| `mainlayer discover` | Browse available resources — no auth required |
| `mainlayer buy` | Purchase a resource via X402 on-chain payment |
| `mainlayer entitlements` | List active access grants |
| `mainlayer subscribe` | Approve, pause, resume, cancel, list, get subscriptions |
| `mainlayer invoices` | View invoice history |
| `mainlayer refund` | Request a refund on a payment |
| `mainlayer dispute` | Create or list payment disputes |
| `mainlayer setup` | Re-run MCP platform detection and configuration |

For full flag documentation on any command:

```bash
mainlayer <command> --help
```

---

## Agent Integration

`@mainlayer/cli` is designed for **agent-first** usage — every command supports `--json` for structured output and uses exit codes for programmatic error handling.

```bash
# Machine-readable output
mainlayer discover --json | jq '.[0].id'

# Exit codes for error handling
mainlayer buy res_... --json
case $? in
  0) echo "Payment confirmed" ;;
  2) echo "Auth error — check MAINLAYER_API_KEY" ;;
  3) echo "Resource not found" ;;
  4) echo "Validation error" ;;
esac
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAINLAYER_API_KEY` | Yes (for most commands) | — | Authenticates API and MCP requests. Create with `mainlayer auth api-key create` |
| `MAINLAYER_WALLET_PASSPHRASE` | For signing commands | — | Unlocks wallet without interactive prompt (headless/agent mode) |
| `MAINLAYER_API_URL` | No | `https://api.mainlayer.io` | Override API base URL (staging, local dev) |
| `MAINLAYER_SOLANA_NETWORK` | No | `solana:mainnet` | Override Solana network (e.g. `solana:devnet`) |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Authentication error |
| `3` | Not found |
| `4` | Validation error |
| `5` | Already exists |

---

## License

MIT — see [LICENSE](LICENSE) for details.

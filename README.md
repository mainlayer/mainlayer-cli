# @mainlayer/cli

> Payment CLI for AI agents.

[![npm version](https://img.shields.io/npm/v/@mainlayer/cli)](https://www.npmjs.com/package/@mainlayer/cli)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/mainlayer/mainlayer-cli/main/scripts/install.sh | sh
```

Requires [Node.js >= 22](https://nodejs.org). The script installs the CLI globally via npm and ensures the install directory is in your PATH.

## What is Mainlayer?

Mainlayer lets AI agents pay for digital resources — APIs, data feeds, AI services — on-chain using Solana USDC.

The CLI works headlessly so your agent can register, pay, and transact with no human in the loop.

## Installation

```bash
npm install -g @mainlayer/cli
```

On install, the CLI automatically detects AI platforms on your machine and configures the Mainlayer MCP server in each one. To re-run detection at any time:

```bash
mainlayer setup
```

## Sell a resource in 60 seconds

```bash
# Create an account and get an API key
mainlayer auth register --email you@example.com --password ...
mainlayer auth api-key create --label "my-service"
export MAINLAYER_API_KEY=sk_live_...

# Create a wallet to receive payments
export MAINLAYER_WALLET_PASSPHRASE=your-passphrase
mainlayer wallet create

# List your resource
mainlayer resource create \
  --slug my-api \
  --description "My API" \
  --price 0.01 \
  --fee-model per_call \
  --type api

# Receive payment notifications
mainlayer webhook update --url https://example.com/webhooks
```

## Buy a resource in 60 seconds

```bash
# Create an account
mainlayer auth register --email you@example.com --password ...
mainlayer auth api-key create --label "buyer"
export MAINLAYER_API_KEY=sk_live_...

# Create and fund a wallet (requires SOL + USDC)
export MAINLAYER_WALLET_PASSPHRASE=your-passphrase
mainlayer wallet create

# Browse available resources
mainlayer discover --query "data feeds"

# Purchase (on-chain payment, no intermediary)
mainlayer buy <resource-id>

# Check your active access
mainlayer entitlements
```

## Built for AI agents

Every command supports `--json` for structured output and returns predictable exit codes. Set environment variables and your agent can operate fully headlessly.

```bash
export MAINLAYER_API_KEY=sk_live_...
export MAINLAYER_WALLET_PASSPHRASE=your-passphrase

mainlayer discover --json | jq '.[0].id'
mainlayer buy res_... --json
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Authentication error |
| `3` | Not found |
| `4` | Validation error |
| `5` | Already exists |

## Wallet security

Your private key never leaves your machine. It is encrypted with AES-256-GCM and a PBKDF2-derived key (200,000 iterations) and stored at `~/.mainlayer/wallet.json`. The key is only decrypted when a transaction needs to be signed.

```bash
# Headless mode: set passphrase as env var to skip interactive prompt
export MAINLAYER_WALLET_PASSPHRASE=your-passphrase
mainlayer buy <resource-id> --json
```

## MCP auto-configuration

Installing the CLI automatically adds the Mainlayer MCP server to every AI platform detected on your machine. This lets AI agents use Mainlayer tools natively — no manual setup.

**Supported platforms:**

- [x] Claude Code
- [x] Cursor
- [x] Windsurf
- [x] Gemini CLI
- [x] VS Code (Copilot)
- [x] Zed
- [x] Continue
- [x] Cline
- [ ] Claude Desktop — add manually via **Settings > Connectors**, URL: `https://api.mainlayer.fr/mcp`
- [ ] OpenClaw — add manually via `~/.openclaw/openclaw.json`

**Re-run or force-update:**

```bash
mainlayer setup           # Re-detect and configure (skips already-configured)
mainlayer setup --force   # Overwrite all existing entries
mainlayer setup --json    # JSON output for programmatic use
```

## Command reference

| Command | Description |
|---------|-------------|
| `mainlayer auth` | Register, log in, log out, check status, manage API keys |
| `mainlayer wallet` | Create, import, view address, check balance, export |
| `mainlayer config` | Read and write CLI configuration |
| `mainlayer resource` | Create and manage resources, pricing plans, and quotas |
| `mainlayer coupon` | Create and manage discount codes |
| `mainlayer webhook` | Configure webhook URL, view logs, retry deliveries |
| `mainlayer earnings` | Revenue summary by resource and time period |
| `mainlayer metrics` | Usage analytics per resource |
| `mainlayer discover` | Search available resources — no auth required |
| `mainlayer buy` | Purchase a resource via on-chain payment |
| `mainlayer entitlements` | View your active access grants |
| `mainlayer subscribe` | Manage subscriptions (approve, pause, resume, cancel) |
| `mainlayer invoices` | View invoice history |
| `mainlayer refund` | Request a refund |
| `mainlayer dispute` | Open or list payment disputes |
| `mainlayer setup` | Re-run MCP platform detection |

```bash
mainlayer <command> --help   # Full flag docs for any command
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `MAINLAYER_API_KEY` | API key for authentication. Create with `mainlayer auth api-key create` |
| `MAINLAYER_WALLET_PASSPHRASE` | Wallet passphrase for headless/agent signing |
| `MAINLAYER_API_URL` | Override API base URL (default: `https://api.mainlayer.fr`) |
| `MAINLAYER_SOLANA_NETWORK` | Override Solana network (default: `solana:mainnet`) |

## License

Apache 2.0 - see [LICENSE](LICENSE) for details.

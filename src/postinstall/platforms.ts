import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const MCP_URL = 'https://api.mainlayer.io/mcp';

export interface PlatformDescriptor {
  name: string;
  configPath: (home: string) => string;
  altConfigPath?: (home: string) => string;
  format: 'json' | 'yaml-file';
  topLevelKey: string;
  buildEntry: () => Record<string, unknown>;
  idempotencyCheck: (home: string) => boolean;
  skillsDir: (home: string) => string;
  skipReason?: string;
}

export interface PlatformResult {
  name: string;
  configured: boolean;
  skillsDropped: boolean;
  skipped: boolean;
  error?: string;
}

function hasExistingEntry(servers: Record<string, unknown>, targetUrl: string): boolean {
  const urlKeys = ['url', 'serverUrl', 'httpUrl'];
  return Object.values(servers).some((entry) => {
    const e = entry as Record<string, unknown>;
    return urlKeys.some((k) => e[k] === targetUrl);
  });
}

export const PLATFORMS: PlatformDescriptor[] = [
  // Claude Code — supports ${VAR} env interpolation in headers
  {
    name: 'Claude Code',
    configPath: (home) => join(home, '.claude.json'),
    format: 'json',
    topLevelKey: 'mcpServers',
    buildEntry: () => ({
      type: 'http',
      url: MCP_URL,
      headers: {
        Authorization: 'Bearer ${MAINLAYER_API_KEY}',
      },
    }),
    idempotencyCheck: (home) => {
      const p = join(home, '.claude.json');
      if (!existsSync(p)) return false;
      try {
        const cfg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        const servers = (cfg['mcpServers'] as Record<string, unknown>) ?? {};
        return hasExistingEntry(servers, MCP_URL);
      } catch {
        return false;
      }
    },
    skillsDir: (home) => join(home, '.claude'),
  },

  // Claude Desktop (macOS) — remote HTTP MCP not supported via config file
  {
    name: 'Claude Desktop (macOS)',
    configPath: (home) => join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    format: 'json',
    topLevelKey: 'mcpServers',
    buildEntry: () => ({}),
    idempotencyCheck: () => false,
    skillsDir: (home) => join(home, 'Library', 'Application Support', 'Claude'),
    skipReason: 'Remote MCP requires manual setup via Settings > Connectors',
  },

  // Claude Desktop (Windows) — remote HTTP MCP not supported via config file
  {
    name: 'Claude Desktop (Windows)',
    configPath: () => {
      const appData = process.env['APPDATA'] ?? '';
      return join(appData, 'Claude', 'claude_desktop_config.json');
    },
    format: 'json',
    topLevelKey: 'mcpServers',
    buildEntry: () => ({}),
    idempotencyCheck: () => false,
    skillsDir: () => {
      const appData = process.env['APPDATA'] ?? '';
      return join(appData, 'Claude');
    },
    skipReason: 'Remote MCP requires manual setup via Settings > Connectors',
  },

  // Cursor — supports ${env:VAR} syntax
  {
    name: 'Cursor',
    configPath: (home) => join(home, '.cursor', 'mcp.json'),
    format: 'json',
    topLevelKey: 'mcpServers',
    buildEntry: () => ({
      url: MCP_URL,
      headers: {
        Authorization: 'Bearer ${env:MAINLAYER_API_KEY}',
      },
    }),
    idempotencyCheck: (home) => {
      const p = join(home, '.cursor', 'mcp.json');
      if (!existsSync(p)) return false;
      try {
        const cfg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        const servers = (cfg['mcpServers'] as Record<string, unknown>) ?? {};
        return hasExistingEntry(servers, MCP_URL);
      } catch {
        return false;
      }
    },
    skillsDir: (home) => join(home, '.cursor'),
  },

  // Windsurf — supports ${env:VAR} syntax; uses serverUrl key
  {
    name: 'Windsurf',
    configPath: (home) => join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    format: 'json',
    topLevelKey: 'mcpServers',
    buildEntry: () => ({
      serverUrl: MCP_URL,
      headers: {
        Authorization: 'Bearer ${env:MAINLAYER_API_KEY}',
      },
    }),
    idempotencyCheck: (home) => {
      const p = join(home, '.codeium', 'windsurf', 'mcp_config.json');
      if (!existsSync(p)) return false;
      try {
        const cfg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        const servers = (cfg['mcpServers'] as Record<string, unknown>) ?? {};
        return hasExistingEntry(servers, MCP_URL);
      } catch {
        return false;
      }
    },
    skillsDir: (home) => join(home, '.codeium', 'windsurf'),
  },

  // Gemini CLI — uses httpUrl key for Streamable HTTP; env var interpolation UNCLEAR
  {
    name: 'Gemini CLI',
    configPath: (home) => join(home, '.gemini', 'settings.json'),
    format: 'json',
    topLevelKey: 'mcpServers',
    buildEntry: () => ({
      httpUrl: MCP_URL,
    }),
    idempotencyCheck: (home) => {
      const p = join(home, '.gemini', 'settings.json');
      if (!existsSync(p)) return false;
      try {
        const cfg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        const servers = (cfg['mcpServers'] as Record<string, unknown>) ?? {};
        return hasExistingEntry(servers, MCP_URL);
      } catch {
        return false;
      }
    },
    skillsDir: (home) => join(home, '.gemini'),
  },

  // VS Code (Copilot) — uses "servers" top-level key; auth header omitted (uses input prompts)
  {
    name: 'VS Code',
    configPath: (home) => join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
    format: 'json',
    topLevelKey: 'servers',
    buildEntry: () => ({
      type: 'http',
      url: MCP_URL,
    }),
    idempotencyCheck: (home) => {
      const p = join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
      if (!existsSync(p)) return false;
      try {
        const cfg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        const servers = (cfg['servers'] as Record<string, unknown>) ?? {};
        return hasExistingEntry(servers, MCP_URL);
      } catch {
        return false;
      }
    },
    skillsDir: (home) => join(home, 'Library', 'Application Support', 'Code', 'User'),
  },

  // Zed — uses context_servers top-level key; auth header omitted (interpolation UNCLEAR)
  {
    name: 'Zed',
    configPath: (home) => join(home, '.zed', 'settings.json'),
    altConfigPath: (home) => join(home, '.config', 'zed', 'settings.json'),
    format: 'json',
    topLevelKey: 'context_servers',
    buildEntry: () => ({
      url: MCP_URL,
    }),
    idempotencyCheck: (home) => {
      // Check primary path first, then alt
      const primary = join(home, '.zed', 'settings.json');
      const alt = join(home, '.config', 'zed', 'settings.json');
      const p = existsSync(primary) ? primary : alt;
      if (!existsSync(p)) return false;
      try {
        const cfg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        const servers = (cfg['context_servers'] as Record<string, unknown>) ?? {};
        return hasExistingEntry(servers, MCP_URL);
      } catch {
        return false;
      }
    },
    skillsDir: (home) => {
      const primary = join(home, '.zed');
      return existsSync(primary) ? primary : join(home, '.config', 'zed');
    },
  },

  // Cline (VSCode ext.) — auth header omitted (interpolation UNCLEAR per D-05)
  {
    name: 'Cline',
    configPath: (home) =>
      join(
        home,
        'Library',
        'Application Support',
        'Code',
        'User',
        'globalStorage',
        'saoudrizwan.claude-dev',
        'settings',
        'cline_mcp_settings.json',
      ),
    format: 'json',
    topLevelKey: 'mcpServers',
    buildEntry: () => ({
      url: MCP_URL,
      disabled: false,
    }),
    idempotencyCheck: (home) => {
      const p = join(
        home,
        'Library',
        'Application Support',
        'Code',
        'User',
        'globalStorage',
        'saoudrizwan.claude-dev',
        'settings',
        'cline_mcp_settings.json',
      );
      if (!existsSync(p)) return false;
      try {
        const cfg = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        const servers = (cfg['mcpServers'] as Record<string, unknown>) ?? {};
        return hasExistingEntry(servers, MCP_URL);
      } catch {
        return false;
      }
    },
    skillsDir: (home) =>
      join(
        home,
        'Library',
        'Application Support',
        'Code',
        'User',
        'globalStorage',
        'saoudrizwan.claude-dev',
        'settings',
      ),
  },

  // Continue — writes standalone YAML to ~/.continue/mcpServers/mainlayer.yaml
  {
    name: 'Continue',
    configPath: (home) => join(home, '.continue', 'mcpServers', 'mainlayer.yaml'),
    format: 'yaml-file',
    topLevelKey: '',
    buildEntry: () => ({}),
    idempotencyCheck: (home) => {
      return existsSync(join(home, '.continue', 'mcpServers', 'mainlayer.yaml'));
    },
    skillsDir: (home) => join(home, '.continue'),
  },
];

function writeJsonPlatform(
  desc: PlatformDescriptor,
  home: string,
  force: boolean,
): boolean {
  // Determine actual config path (handle altConfigPath for Zed)
  let configPath = desc.configPath(home);
  if (!existsSync(configPath) && desc.altConfigPath) {
    configPath = desc.altConfigPath(home);
  }

  // D-08: only configure if file exists
  if (!existsSync(configPath)) return false;

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch {
    config = {};
  }

  const servers = (config[desc.topLevelKey] as Record<string, unknown>) ?? {};

  // D-13: idempotency — skip if already present and not force mode
  if (!force && hasExistingEntry(servers, MCP_URL)) {
    return false;
  }

  servers['mainlayer'] = desc.buildEntry();
  config[desc.topLevelKey] = servers;

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return true;
}

function writeContinuePlatform(home: string, force: boolean): boolean {
  // D-08: check if ~/.continue/ directory exists
  const continueDir = join(home, '.continue');
  if (!existsSync(continueDir)) return false;

  const mcpServersDir = join(continueDir, 'mcpServers');
  const targetFile = join(mcpServersDir, 'mainlayer.yaml');

  // D-13: idempotency — skip if file already exists and not force mode
  if (!force && existsSync(targetFile)) {
    return false;
  }

  mkdirSync(mcpServersDir, { recursive: true });

  const yamlContent = `name: mainlayer
version: 0.0.1
schema: v1
mcpServers:
  - name: mainlayer
    type: streamable-http
    url: ${MCP_URL}
`;
  writeFileSync(targetFile, yamlContent, 'utf8');
  return true;
}

export async function configurePlatforms(options: {
  force?: boolean;
}): Promise<PlatformResult[]> {
  const force = options.force ?? false;
  const home = homedir();
  const results: PlatformResult[] = [];

  for (const desc of PLATFORMS) {
    // Platforms with skipReason are inform-only (e.g. Claude Desktop)
    if (desc.skipReason) {
      results.push({
        name: desc.name,
        configured: false,
        skillsDropped: false,
        skipped: true,
        error: desc.skipReason,
      });
      continue;
    }

    try {
      let configured = false;

      if (desc.format === 'yaml-file') {
        configured = writeContinuePlatform(home, force);
      } else {
        configured = writeJsonPlatform(desc, home, force);
      }

      // Drop skills.md if platform was newly configured
      let skillsDropped = false;
      if (configured) {
        try {
          const skillsDir = desc.skillsDir(home);
          if (existsSync(skillsDir)) {
            const skillsContent = buildSkillsContent();
            writeFileSync(join(skillsDir, 'skills.md'), skillsContent, 'utf8');
            skillsDropped = true;
          }
        } catch {
          // Skills drop failure is non-fatal
        }
      }

      results.push({
        name: desc.name,
        configured,
        skillsDropped,
        skipped: false,
      });
    } catch (err) {
      results.push({
        name: desc.name,
        configured: false,
        skillsDropped: false,
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

function buildSkillsContent(): string {
  return `# Mainlayer CLI — Agent Skills Guide

## Setup

Set required environment variables:

\`\`\`bash
export MAINLAYER_API_KEY=sk_live_...
export MAINLAYER_WALLET_PASSPHRASE=your-passphrase
\`\`\`

All commands support \`--json\` for structured output and use semantic exit codes:
- 0: Success
- 1: General error
- 2: Auth error
- 3: Not found
- 4: Validation error
- 5: Payment error

## Vendor Quick-start

\`\`\`bash
mainlayer auth register --email you@example.com --password secret --json
mainlayer resource create --name "My API" --description "..." --price 0.01 --json
mainlayer resource plan create --resource-id <id> --name "Basic" --price 0.01 --json
mainlayer webhook update --resource-id <id> --url https://your.api/hook --json
\`\`\`

## Buyer Quick-start

\`\`\`bash
mainlayer auth register --email you@example.com --password secret --json
mainlayer wallet create --json
mainlayer discover --query "weather API" --json
mainlayer buy <resource-id> --json
\`\`\`

## Command Reference

### Auth
- \`mainlayer auth register\` — create account
- \`mainlayer auth login\` — sign in, stores JWT
- \`mainlayer auth logout\` — clear session
- \`mainlayer auth status\` — show current session
- \`mainlayer auth api-key create/list/revoke\` — manage API keys

### Wallet
- \`mainlayer wallet create\` — generate encrypted Solana keypair
- \`mainlayer wallet import\` — import existing keypair
- \`mainlayer wallet address\` — print public key
- \`mainlayer wallet balance\` — show SOL + USDC balances
- \`mainlayer wallet export\` — export private key (requires passphrase)

### Resources (Vendor)
- \`mainlayer resource create/list/get/update/delete\`
- \`mainlayer resource plan create/list/update/delete\`
- \`mainlayer resource quota set/get/delete\`

### Marketplace (Buyer)
- \`mainlayer discover\` — search available resources
- \`mainlayer buy <id>\` — purchase access (X402 flow)
- \`mainlayer entitlements\` — list active access grants
- \`mainlayer subscribe approve/pause/resume/cancel/list/get\`

### Billing
- \`mainlayer invoices list/get\`
- \`mainlayer refund request\`
- \`mainlayer dispute create/list\`
- \`mainlayer earnings\`
- \`mainlayer metrics\`

## Agent Notes

- Use \`--json\` for all commands in headless/CI environments
- Set \`MAINLAYER_WALLET_PASSPHRASE\` env var to avoid interactive prompts
- Set \`CI=true\` to suppress spinners and interactive output
- Auth via \`MAINLAYER_API_KEY\` env var or \`--api-key\` flag
- MCP server: https://api.mainlayer.io/mcp (add \`MAINLAYER_API_KEY\` to request headers)
`;
}


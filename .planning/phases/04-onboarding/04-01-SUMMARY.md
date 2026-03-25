---
phase: 04-onboarding
plan: 01
subsystem: postinstall
tags: [mcp, platform-detection, postinstall, onboarding]
dependency_graph:
  requires: []
  provides: [src/postinstall/platforms.ts, src/postinstall/index.ts, dist/postinstall/index.js]
  affects: [package.json, tsdown.config.ts]
tech_stack:
  added: []
  patterns: [platform-descriptor-registry, json-merge-with-idempotency, yaml-standalone-file]
key_files:
  created:
    - src/postinstall/platforms.ts
    - src/postinstall/index.ts
  modified:
    - tsdown.config.ts
    - package.json
decisions:
  - "Claude Desktop (macOS + Windows) skipped with skipReason — remote MCP not supported via config file per research finding"
  - "Gemini CLI uses httpUrl key (not url) for Streamable HTTP transport"
  - "VS Code uses servers top-level key (not mcpServers) — only platform with this difference"
  - "Zed and Cline omit auth header per D-05 (env var interpolation unverified)"
  - "Continue writes standalone YAML to ~/.continue/mcpServers/mainlayer.yaml (avoids yaml library dependency)"
  - "skills.md content embedded in buildSkillsContent() within platforms.ts (single-file approach)"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_created_or_modified: 4
---

# Phase 4 Plan 1: Platform Registry and Postinstall Script Summary

**One-liner:** Platform registry covering 10 AI platforms with JSON merge + YAML standalone writers, URL-match idempotency, and tsdown dual-entry-point build producing dist/postinstall/index.js.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create platform registry and config write logic | dd4d25d | src/postinstall/platforms.ts |
| 2 | Create postinstall entry point and wire build pipeline | 9a595c7 | src/postinstall/index.ts, tsdown.config.ts, package.json |

## What Was Built

### src/postinstall/platforms.ts (498 lines)

The core platform registry. Exports:
- `MCP_URL` — hardcoded production URL `https://api.mainlayer.io/mcp`
- `PlatformDescriptor` — interface describing a platform's config path, format, entry builder, and idempotency check
- `PlatformResult` — interface for per-platform execution results
- `PLATFORMS` — array of 10 platform descriptors
- `configurePlatforms()` — async orchestrator that iterates platforms with per-platform try/catch

**Platform coverage:**

| Platform | Config Path | Format | Auth Header |
|----------|------------|--------|-------------|
| Claude Code | ~/.claude.json | JSON/mcpServers | `${MAINLAYER_API_KEY}` |
| Claude Desktop (macOS) | (skipped) | — | skip |
| Claude Desktop (Windows) | (skipped) | — | skip |
| Cursor | ~/.cursor/mcp.json | JSON/mcpServers | `${env:MAINLAYER_API_KEY}` |
| Windsurf | ~/.codeium/windsurf/mcp_config.json | JSON/mcpServers/serverUrl | `${env:MAINLAYER_API_KEY}` |
| Gemini CLI | ~/.gemini/settings.json | JSON/mcpServers/httpUrl | omitted |
| VS Code | ~/Library/.../Code/User/mcp.json | JSON/servers | omitted |
| Zed | ~/.zed/settings.json (+ altPath) | JSON/context_servers | omitted |
| Cline | ~/Library/.../cline_mcp_settings.json | JSON/mcpServers | omitted |
| Continue | ~/.continue/mcpServers/mainlayer.yaml | YAML standalone | omitted |

### src/postinstall/index.ts (31 lines)

Minimal entry point. Calls `configurePlatforms({ force: false })`, prints skip messages for Claude Desktop entries, prints summary (`Configured MCP for: X, Y` or `No AI platforms detected`) to stderr. No `process.exit()` — exits 0 naturally. Outer try/catch ensures postinstall never throws.

### tsdown.config.ts (updated)

Added `'postinstall/index': 'src/postinstall/index.ts'` as second entry alongside `'cli/index'`. Build produces both `dist/cli/index.js` and `dist/postinstall/index.js` (both ESM).

### package.json (updated)

Added `"postinstall": "node dist/postinstall/index.js"` to scripts. Covered by existing `"files": ["dist/", "README.md"]` — no additional files field changes needed.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Discretionary Decisions

**1. skills.md template location**
- **Context:** Plan specified skills.md generation from a template in `src/`. The skills template file (`src/postinstall/skills-template.ts`) was listed as a separate file in the research architecture diagram but not explicitly required by this plan.
- **Decision:** Embedded the `buildSkillsContent()` function directly in `platforms.ts` to keep the plan's file count accurate and avoid creating an unplanned file. The function is private and stays under the 500-line limit.
- **Impact:** platforms.ts handles all postinstall logic in one file (498 lines).

**2. Claude Desktop APPDATA fallback**
- **Context:** Windows `APPDATA` env var may be undefined in some environments.
- **Decision:** Added `?? ''` fallback to prevent crashes when `process.env['APPDATA']` is undefined. Claude Desktop entries have `skipReason` so they will never attempt writes anyway.

## Known Stubs

None — postinstall logic is fully wired. `configurePlatforms()` performs real file detection and writing with no placeholder behavior.

## Self-Check: PASSED

- [x] src/postinstall/platforms.ts exists (498 lines, under 500 limit)
- [x] src/postinstall/index.ts exists (31 lines)
- [x] tsdown.config.ts has both entry points
- [x] package.json has postinstall script
- [x] dist/postinstall/index.js exists (11.62 kB, ESM)
- [x] dist/cli/index.js exists (75.11 kB)
- [x] PLATFORMS array has exactly 10 entries
- [x] Claude Desktop entries have skipReason set
- [x] Gemini CLI uses httpUrl key
- [x] VS Code uses topLevelKey 'servers'
- [x] Windsurf uses serverUrl key
- [x] Zed uses topLevelKey 'context_servers'
- [x] Cursor uses `${env:MAINLAYER_API_KEY}` syntax
- [x] Claude Code uses `${MAINLAYER_API_KEY}` syntax
- [x] No process.exit() call in postinstall/index.ts
- [x] No imports from src/cli/, src/services/, or src/utils/
- [x] Commits dd4d25d and 9a595c7 exist

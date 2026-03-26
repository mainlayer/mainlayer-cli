---
phase: 04-onboarding
plan: "03"
subsystem: onboarding
tags: [setup-command, skills-md, postinstall, npm-hardening]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [src/cli/setup.ts, wired-setup-command, skills-md-postinstall-integration]
  affects: [src/cli/index.ts, src/postinstall/index.ts]
tech_stack:
  added: []
  patterns: [ora-spinner-human-mode, json-output-toggle, idempotent-setup-command]
key_files:
  created:
    - src/cli/setup.ts
  modified:
    - src/cli/index.ts
    - src/postinstall/index.ts
decisions:
  - "setup command uses opts.json || !process.stdout.isTTY pattern (consistent with all other commands)"
  - "Skills writing in postinstall/index.ts adds mainlayer-skills.md via skills-template module; platforms.ts still writes inline skills.md — both exist per-platform"
  - "Task 2 required no file changes — package.json files field already correct as [dist/, README.md]"
metrics:
  duration_minutes: 8
  completed_date: "2026-03-26"
  tasks_completed: 2
  files_created_or_modified: 3
---

# Phase 4 Plan 3: Setup Command and npm Package Hardening Summary

**One-liner:** `mainlayer setup` command with `--force`/`--json` flags, ora spinner in human mode, skills.md dropping via `generateSkillsMd`, wired into CLI entry point and postinstall with clean npm pack containing only dist/, README.md.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create mainlayer setup command and wire skills.md into postinstall | 92392c8 | src/cli/setup.ts, src/cli/index.ts, src/postinstall/index.ts |
| 2 | Verify npm package cleanliness and run final build check | (no file changes) | — |

## What Was Built

### src/cli/setup.ts (85 lines)

Exports `setupCommand()` returning a Commander Command with:
- Name: `setup`, description: "Detect AI platforms and configure Mainlayer MCP server"
- Options: `--force` (re-write existing entries), `--json` (machine-readable output)
- Human mode: ora spinner during detection, per-platform result lines (green checkmark / yellow info / red X / gray dash), final printSuccess summary
- JSON mode: `formatOutput({ platforms: [...] }, { json: true })` with `name`, `configured`, `skills_dropped`, `skipped`, `error` per entry
- Skills dropping: for each configured platform, resolves `skillsDir(homedir())`, writes `generateSkillsMd()` to `SKILLS_FILENAME` ('mainlayer-skills.md')
- Error handling: skills write failure is non-fatal (silently caught)

### src/cli/index.ts (updated)

Added `import { setupCommand } from './setup.js'` and `.addCommand(setupCommand())` after `disputeCommand()`. `mainlayer --help` now shows `setup` in the command list.

### src/postinstall/index.ts (updated)

Added imports for `generateSkillsMd`, `SKILLS_FILENAME` from `./skills-template.js` and `PLATFORMS` from `./platforms.js`. After `configurePlatforms()` returns, iterates configured results and writes `mainlayer-skills.md` to each platform's `skillsDir`. D-12 constraint maintained: all writes in try/catch, no `process.exit()` call.

### npm Package Verification (Task 2)

`npm pack --dry-run` output confirmed:

| File | Included |
|------|---------|
| dist/cli/index.js (77.3 kB) | YES |
| dist/postinstall/index.js (1.2 kB) | YES |
| dist/skills-template-TrNmGucF.js (24.2 kB) | YES (tsdown chunk, in dist/) |
| README.md (7.1 kB) | YES |
| package.json (1.3 kB) | YES (npm always includes) |
| src/ files | NO |
| tests/ files | NO |
| .planning/ files | NO |
| .env files | NO |

Total: 7 files, 23.4 kB packed / 111.1 kB unpacked.

All 51 tests pass. Lint passes (ESLint migration advisory only, no errors). Build exits 0.

## Deviations from Plan

### Discretionary Decisions

**1. Platforms.ts still writes inline skills.md**
- **Context:** `platforms.ts` from Plan 01 already had an inline `buildSkillsContent()` function writing to `skills.md`. The plan required adding `generateSkillsMd`/`SKILLS_FILENAME` to `postinstall/index.ts`, not replacing the `platforms.ts` behavior.
- **Decision:** Added skills dropping in `postinstall/index.ts` using the template module (writing `mainlayer-skills.md`), leaving the existing inline write in `platforms.ts` intact (writes `skills.md`). Both files are written to each configured platform's skills directory. This was not a regression — the plan acceptance criteria was additive.

**2. Task 2 had no file changes**
- **Context:** Package.json `files` field was already `["dist/", "README.md"]` from Plan 01 work. All verification passed without modifications.
- **Decision:** Recorded task as complete with no commit — purely a verification task.

## Known Stubs

None — `setupCommand` performs real platform detection and MCP registration via `configurePlatforms()`. Skills template is fully wired. No placeholder behavior.

## Self-Check: PASSED

- [x] src/cli/setup.ts exists (85 lines, under 500 limit)
- [x] src/cli/index.ts contains `import { setupCommand } from './setup.js'`
- [x] src/cli/index.ts contains `.addCommand(setupCommand())`
- [x] src/postinstall/index.ts imports `generateSkillsMd` and `SKILLS_FILENAME`
- [x] src/postinstall/index.ts writes skills file for each configured platform
- [x] `npm run build` exits 0 — dist/cli/index.js (77.3 kB) and dist/postinstall/index.js (1.2 kB)
- [x] `node dist/cli/index.js setup --help` shows --force and --json options
- [x] `node dist/cli/index.js --help` shows `setup` in command list
- [x] npm pack --dry-run has no src/, tests/, .planning/ files
- [x] npm pack --dry-run includes dist/cli/index.js and dist/postinstall/index.js
- [x] All 51 tests pass
- [x] Commit 92392c8 exists

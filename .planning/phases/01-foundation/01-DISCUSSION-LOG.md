# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 01-foundation
**Areas discussed:** Auth prompting strategy, Human output style, Config schema, Passphrase confirmation

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Auth prompting strategy | When flags aren't provided, prompt or error? | ✓ |
| Human output style | What does non-JSON output look like? | ✓ |
| Config schema | What lives in ~/.mainlayer/config.json? | ✓ |
| Passphrase confirmation | Double-entry on wallet create/import? | ✓ |

**User's choice:** All four areas
**Notes:** User delegated all decisions to Claude — "Ce que tu penses le meilleur pour le projet" (what you think is best for the project)

---

## Auth Prompting Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Flags → env vars → @clack/prompts (TTY) | Priority chain; error in non-TTY without env vars | ✓ |
| Flags required, no prompting | Always require --email/--password flags | |
| Always prompt interactively | Use @clack/prompts regardless of TTY | |

**User's choice:** Delegated to Claude → flags → env vars → @clack/prompts (TTY), error in non-TTY without env vars
**Notes:** Agent-first design principle drives this — MAINLAYER_EMAIL/MAINLAYER_PASSWORD as the headless path

---

## Human Output Style

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal key-value + @clack outro | Clean, readable for humans but not overly decorated | ✓ |
| Rich @clack styled (boxes, spinners everywhere) | Full @clack UI for all commands | |
| Plain text only, no chalk | Maximum simplicity | |

**User's choice:** Delegated to Claude → minimal key-value pairs, chalk labels, @clack outro for interactive completions
**Notes:** Agent-first priority means decoration is secondary to machine-readability

---

## Config Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Typed known fields only: { apiUrl, jwt, jwtExpiresAt, userId, email } | Clean, predictable | ✓ |
| Generic JSON store (any key) | Flexible but no structure | |
| Multi-profile support from v1 | Supports multiple identities | |

**User's choice:** Delegated to Claude → typed fields, single identity, generic get/set for programmatic access
**Notes:** Wallet path fixed at ~/.mainlayer/wallet.json — not configurable v1

---

## Passphrase Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Double-entry in TTY, single in env var mode, always re-prompt on export | Security + agent-friendly | ✓ |
| Always double-entry | Maximum safety, breaks agents | |
| Never double-entry | Agent-friendly but risky for humans | |

**User's choice:** Delegated to Claude → double-entry in TTY, single with env var, wallet export always re-prompts
**Notes:** export re-prompt is a security requirement — explicit call, not subject to env var override

---

## Claude's Discretion

- File layout within src/ (commands/, lib/, utils/)
- Exact column alignment and spacing of key-value output
- Spinner wording during async operations
- Error message copy beyond stated patterns

## Deferred Ideas

None — discussion stayed within phase scope.

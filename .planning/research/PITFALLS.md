# Pitfalls Research

**Domain:** TypeScript CLI with embedded blockchain wallet, npm MCP auto-installation, AI agent-first UX
**Researched:** 2026-03-25
**Confidence:** HIGH (wallet security, npm publishing, Solana transaction pitfalls verified against official docs and post-mortems; MCP/agent UX from current ecosystem practice)

---

## Critical Pitfalls

### Pitfall 1: AES-256-CBC Instead of AES-256-GCM for Wallet Encryption

**What goes wrong:**
Using AES-CBC (the older mode) without an HMAC for the `~/.mainlayer/wallet.json` encrypted keypair. CBC provides confidentiality but not integrity — an attacker who can modify the file can flip bits in the ciphertext to alter the plaintext (padding oracle, bit-flipping). The decrypted keypair comes out wrong but the program may not detect it, silently signing with a corrupted key or crashing in a way that exposes stack traces containing sensitive data.

**Why it happens:**
CBC is the mode most tutorials show. Developers reaching for `crypto.createCipheriv('aes-256-cbc', ...)` on the first search result hit it before finding the GCM guidance. `createCipher` (deprecated) defaults to CBC-derived modes with no authentication at all.

**How to avoid:**
Use `aes-256-gcm` exclusively. GCM provides authenticated encryption — the auth tag detects any tampering before the plaintext is returned. Pattern:
- `crypto.createCipheriv('aes-256-gcm', key, iv)` with a fresh 12-byte random IV per encrypt
- Call `cipher.getAuthTag()` after `cipher.final()` and store tag alongside ciphertext
- On decrypt, call `decipher.setAuthTag(tag)` before reading any output — if tag fails, throw immediately
- Never reuse the same (key, IV) pair; always generate a new random IV

**Warning signs:**
- Code uses `aes-256-cbc` or `aes-256-ctr` without a separate HMAC step
- `createCipher` used instead of `createCipheriv`
- No `getAuthTag`/`setAuthTag` calls present

**Phase to address:** Wallet implementation phase (wallet create/import commands)

---

### Pitfall 2: Weak Key Derivation from Passphrase

**What goes wrong:**
Deriving the AES key from a user passphrase using a single SHA-256 hash (`sha256(passphrase)`) or low-iteration PBKDF2. The wallet JSON is publicly readable on disk. An offline attacker who copies the file can brute-force a 10-character passphrase in seconds against a weak KDF.

**Why it happens:**
SHA-256 is fast and familiar. Developers hash the passphrase directly to get a 32-byte key, not realizing that "fast" is the exact wrong property for a password KDF. Low PBKDF2 iteration counts (< 100,000) compound this.

**How to avoid:**
Use `crypto.scrypt(passphrase, salt, 32, { N: 65536, r: 8, p: 1 })` or PBKDF2 with ≥ 600,000 iterations (NIST 2023 recommendation). Store a 16-byte random salt alongside the ciphertext in `wallet.json`. Scrypt is preferred because it is also memory-hard, resisting GPU/ASIC attacks. The performance cost is ~200-500ms, which is acceptable for a wallet unlock that happens once per session.

**Warning signs:**
- `crypto.createHash('sha256').update(passphrase)` used as key derivation
- `pbkdf2` called with iterations < 100,000
- Salt is missing, hardcoded, or derived from a constant

**Phase to address:** Wallet implementation phase

---

### Pitfall 3: Passphrase Prompt Blocks AI Agent Execution

**What goes wrong:**
The wallet decrypt path calls `readline` or any TTY-based prompt to ask for the passphrase. When an AI agent runs the CLI non-interactively (no TTY), the process hangs indefinitely waiting for input, or throws `ENOTTY`, silently stalling the agent's task.

**Why it happens:**
Human-oriented CLIs prompt for sensitive input interactively. The wallet passphrase is exactly the kind of input developers put behind a prompt. The AI-agent use case is not considered at design time, so there is no passphrase-via-env-var or passphrase-via-flag path.

**How to avoid:**
Support three passphrase input modes in priority order:
1. `MAINLAYER_WALLET_PASSPHRASE` environment variable (agent automation path)
2. `--passphrase` flag (scripted invocation — acceptable for short-lived sessions)
3. Interactive TTY prompt only when `process.stdin.isTTY === true`

If none of these are available and no TTY exists, fail immediately with a clear non-zero exit code and a JSON error body: `{"error": "PASSPHRASE_REQUIRED", "hint": "Set MAINLAYER_WALLET_PASSPHRASE env var"}`. Never hang.

**Warning signs:**
- All passphrase input goes through `readline.question()`
- No check for `process.stdin.isTTY` before prompting
- No `MAINLAYER_WALLET_PASSPHRASE` env var handling

**Phase to address:** Wallet implementation phase; must be verified in agent integration test phase

---

### Pitfall 4: npm Postinstall Script Triggers Security Scanners and `--ignore-scripts` CI Flags

**What goes wrong:**
The postinstall script that auto-configures MCP server is silently skipped in the majority of CI/CD environments, Dockerfile builds, and security-conscious developer setups that use `npm install --ignore-scripts` or `npm ci --ignore-scripts`. The CLI installs successfully but MCP is never configured. There is no fallback, so the agent's onboarding path silently fails.

Beyond silent failure: in 2025, multiple large-scale npm supply chain attacks (Shai-Hulud, SHA1-Hulud) weaponized postinstall scripts to steal credentials. Security-aware users and enterprises now treat any postinstall that touches `~/.config` or home directory as a red flag. The script will trigger static analysis flags on Snyk, Socket.dev, and similar tools, generating friction for adoption.

**Why it happens:**
Postinstall is the only npm lifecycle hook that runs automatically after `npm install`. It feels like the right place for "run once on install" setup. The supply chain attack context is easy to miss when designing the feature.

**How to avoid:**
- Make postinstall fully optional and graceful: wrap the entire body in a try/catch that exits 0 on any failure
- Check for `--ignore-scripts` gracefully by detecting a no-TTY, non-interactive environment and short-circuiting
- Provide `mainlayer setup` as the explicit manual alternative — this is the primary path for security-conscious users
- Document clearly in README: "postinstall auto-configures MCP; run `mainlayer setup` manually if you use `--ignore-scripts`"
- Never call `process.exit(1)` from postinstall — a failing postinstall aborts the entire `npm install`

**Warning signs:**
- Postinstall throws unhandled exceptions
- Postinstall has no try/catch around file writes
- No manual `mainlayer setup` command as fallback
- Script uses `process.exit(1)` on failure

**Phase to address:** Installation and MCP auto-configuration phase

---

### Pitfall 5: Postinstall Writes to AI Platform Config Files Without Backup or Idempotency

**What goes wrong:**
The postinstall script detects `~/.claude/claude_desktop_config.json` (or equivalent) and overwrites the MCP server section. If the user already has custom MCP configuration in that file, the overwrite destroys it. Alternatively, running `npm install` a second time (version upgrade, `npm ci`) duplicates the MCP entry, producing a broken config with two entries for the same server.

**Why it happens:**
JSON config patching is easy to implement as an overwrite. Idempotent merge-patching of JSON config files requires more code and the failure mode is non-obvious until a user reports their Claude config is broken.

**How to avoid:**
- Read the existing config file first; merge only the `mainlayer` MCP server entry
- Check: if an entry with the same server name already exists and the command/URL matches, skip the write entirely
- If the existing entry has a different command/URL (version upgrade), update only that field
- Write a backup to `<config>.mainlayer-backup` before any modification
- Emit a clear log line per platform: `"Configured MCP for Claude Desktop at ~/.claude/claude_desktop_config.json"` or `"Already configured, skipping"`

**Warning signs:**
- No read-before-write for config files
- No duplicate-entry check
- No backup creation before modifying third-party config files

**Phase to address:** Installation and MCP auto-configuration phase

---

### Pitfall 6: Private Keys Exposed in Error Messages, Logs, or JSON Output

**What goes wrong:**
An unhandled exception during transaction signing or wallet operations serializes the Keypair object (or the decrypted private key byte array) into a stack trace, error log, or JSON error response. A CLI that passes raw Error objects through the JSON output layer, or logs `JSON.stringify(keypair)`, will expose 64 bytes of private key material to stdout/stderr.

**Why it happens:**
Node.js Error objects include context objects in some frameworks. A `console.error(err)` call on an object that has a `keypair` property anywhere in scope will print it. `JSON.stringify` on any object graph containing a Uint8Array will emit the bytes as a JSON object with numeric keys.

**How to avoid:**
- Never attach keypair objects or private key buffers to Error objects
- After decrypting the keypair, work only with the minimum needed (public key for display, signing function for transactions) — never pass the raw bytes around as data
- Implement a global error handler that strips any `privateKey`, `secretKey`, or `keypair` property from error context before output
- Add a `toJSON()` method returning `"[REDACTED]"` on any class that wraps key material
- Test: run `mainlayer wallet export` with an invalid passphrase and verify no key bytes appear in the output

**Warning signs:**
- Error handlers use `JSON.stringify(err)` without filtering
- Keypair objects passed as properties of other objects
- No explicit scrubbing of `secretKey` / `privateKey` in error paths

**Phase to address:** Wallet implementation phase; error handling layer

---

### Pitfall 7: Solana Blockhash Expiry Without Retry Causes Silent Payment Failures

**What goes wrong:**
A Solana transaction is constructed, signed, and submitted via `sendRawTransaction`. The blockhash in the transaction expires after ~150 slots (~79 seconds). If the RPC node is slow or the network is congested, the transaction is dropped and never confirmed. The CLI reports success because `sendRawTransaction` returned a signature, but the payment never landed. The buyer's agent believes it paid; the vendor never sees the payment.

**Why it happens:**
`sendRawTransaction` returns immediately with a transaction signature. Developers assume the signature means success. Confirmation is a separate async step that requires polling `getSignatureStatus` or using `confirmTransaction`, which many examples omit.

**How to avoid:**
- Always use a confirmation strategy: fetch `getLatestBlockhash` with commitment `confirmed`, store the `lastValidBlockHeight`, then poll until either confirmed or `blockHeight > lastValidBlockHeight`
- Use `sendAndConfirmTransaction` (web3.js v1) or the `sendAndConfirmTransactionFactory` pattern (kit) which handles this loop
- On blockhash expiry (`TransactionExpiredBlockheightExceededError`), fetch a new blockhash, re-sign, and retry — do NOT retry with the old blockhash
- Expose the transaction signature in all success JSON output so agents can independently verify: `{"signature": "5abc..."}`
- Set confirmation timeout to at least 90 seconds to survive congestion

**Warning signs:**
- `sendRawTransaction` called without a subsequent confirmation polling loop
- No handling of `TransactionExpiredBlockheightExceededError`
- Success response emitted before `confirmTransaction` resolves

**Phase to address:** Wallet and transaction signing phase; X402 buy flow phase

---

### Pitfall 8: X402 USDC Amount Floating-Point Precision Errors

**What goes wrong:**
USDC on Solana has 6 decimal places. A price expressed as `$0.005` converted with `Math.floor(0.005 * 1_000_000)` yields `4999` micro-USDC instead of `5000` due to IEEE 754 floating-point representation. A payment validation check requiring exactly `5000` micro-USDC rejects the transaction as underpayment. This is silent — the agent retries and keeps failing.

**Why it happens:**
JavaScript numeric literals like `0.005` cannot be represented exactly in binary floating-point. `Math.floor` of the slightly-under value rounds down. This exact bug is documented in the X402 Solana implementation guide and affects the most common price point for X402 APIs.

**How to avoid:**
- Use `Math.round(price * 1_000_000)` for USDC, never `Math.floor`
- Alternatively, use a decimal arithmetic library (e.g., `decimal.js`) for any currency calculation path
- Validate all payment amounts at the boundary where human-readable price strings are converted to on-chain lamport/micro-unit amounts
- Write explicit unit tests for boundary values: `0.001`, `0.005`, `0.01`, `0.1`, `1.0`, `0.0001`

**Warning signs:**
- `Math.floor(price * decimals)` anywhere in the payment amount conversion
- No unit tests for USDC decimal conversion
- String-based price values converted directly with `parseFloat * multiplier`

**Phase to address:** X402 buy flow and payment signing phase

---

### Pitfall 9: @solana/web3.js v1 vs @solana/kit Keypair Type Mismatch

**What goes wrong:**
`@solana/web3.js` v1 (stable) uses a synchronous `Keypair` class where the private key is a `Uint8Array(64)`. `@solana/kit` (the v2 rewrite, released December 2024) uses an async `CryptoKeyPair` from the Web Crypto API. If any dependency in the tree (e.g., `x402-solana`) expects `@solana/kit` types, passing a v1 `Keypair` will fail with cryptic type errors or silent signing failures. The `@solana/compat` library exists to bridge this gap but must be explicitly included.

**Why it happens:**
The ecosystem is mid-migration. `@solana/web3.js@1.x` and `@solana/kit` coexist in the npm registry. Documentation for X402 Solana integration references the v2 API. Developers pull in the library that "looks right" without checking which SDK version the integration library targets.

**How to avoid:**
- Pick one SDK version at project start and commit to it. **Recommendation: use `@solana/web3.js` v1 for this project** — it has a stable API, broad community support, and the `@solana/spl-token` library targets it. Kit is still gaining ecosystem support (Anchor does not support it as of early 2025)
- If any dependency requires kit types, use `@solana/compat` to convert: `fromLegacyKeypair(keypair)` returns a kit-compatible KeyPairSigner
- Pin the exact version in `package.json` (`"@solana/web3.js": "1.x"`) to prevent accidental v2 resolution

**Warning signs:**
- Mix of `@solana/web3.js` and `@solana/kit` in `package.json`
- `Keypair` used where `KeyPairSigner` is expected (no compile-time error in JS)
- `generateKeyPairSigner` (async) mixed with `Keypair.generate()` (sync) patterns

**Phase to address:** Wallet implementation phase; dependency selection must be decided before any signing code is written

---

### Pitfall 10: Publishing Secrets or Wallet Files to npm Registry

**What goes wrong:**
`~/.mainlayer/wallet.json` or any local test wallet, `.env` file, or private key fixture checked into the repo gets bundled into the published npm tarball. Anyone who runs `npm install @mainlayer/cli` and inspects the package contents extracts the private key.

**Why it happens:**
npm has a subtle rule: if `.npmignore` exists, it is used **instead of** `.gitignore`, not in addition to it. A developer who adds `.npmignore` but forgets to copy over all the sensitive patterns from `.gitignore` accidentally publishes files that were safely gitignored. Test fixture wallets (`test-wallet.json`, `fixtures/keypair.json`) are a common vector.

**How to avoid:**
- Use the `files` whitelist in `package.json` rather than a blacklist: explicitly list only `dist/`, `bin/`, `README.md` — everything else is excluded by default
- The `files` array is safer than `.npmignore` because new files must be explicitly added to get published
- Run `npm pack --dry-run` before every `npm publish` and inspect the file list
- Add a `prepublishOnly` script that runs `npm pack --dry-run` and fails if any `*.json` file outside `dist/` is included
- Never commit test wallet fixtures — generate them in test setup and clean them in teardown

**Warning signs:**
- Only `.npmignore` used (no `files` whitelist in `package.json`)
- Test wallet JSON files committed to the repo
- `npm pack` output never reviewed before publishing

**Phase to address:** Package publishing setup phase; must be verified before first `npm publish`

---

### Pitfall 11: `@solana/web3.js` Adds 1MB+ to Installed Package Size

**What goes wrong:**
`@solana/web3.js` v1 is not tree-shakeable and contributes ~1.3MB to the installed `node_modules`. Combined with `@solana/spl-token`, the cryptographic dependencies, and a CLI framework, the package can balloon to 50-100MB of `node_modules`. Install time slows noticeably. First-run latency for agents in ephemeral environments (containers, serverless) increases.

**Why it happens:**
Blockchain SDKs bundle many primitives. Tree-shaking does not apply to CJS modules (which web3.js v1 is). CLI packages that use `require()` at runtime carry the full bundle.

**How to avoid:**
- Accept the v1 bundle size as a known cost; do not attempt to replace it with a custom RPC client to save size — maintenance cost is too high
- Use `--production` install in any CI/CD pipeline (`npm ci --omit=dev`) to avoid dev dependency bloat
- Lazy-require heavy modules only in the code paths that need them (wallet commands) rather than top-level imports in every command module
- Publish with `files` whitelist to avoid including source `.ts` files, test fixtures, and docs in the npm tarball — only `dist/` and `bin/`
- Monitor with `npm pack --dry-run` to check tarball size; keep tarball under 5MB

**Warning signs:**
- Top-level `import { Connection, Keypair } from '@solana/web3.js'` in every command file
- Source TypeScript files included in npm tarball
- Tarball size above 10MB

**Phase to address:** Project scaffolding and build setup phase

---

### Pitfall 12: Non-Zero Exit Codes Not Used for All Error Classes

**What goes wrong:**
All errors — authentication failure, network timeout, insufficient balance, invalid argument — exit with code `1`. An AI agent cannot distinguish between "wrong passphrase" (retry with different passphrase), "insufficient balance" (fund the wallet first), and "API unreachable" (retry later). The agent has to parse human-readable error messages to decide next steps, which is brittle and breaks when error messages change.

**Why it happens:**
`process.exit(1)` is the default "something went wrong" pattern. Defining a structured exit code vocabulary requires upfront design effort that is easy to skip.

**How to avoid:**
Define and document exit codes from the start:
- `0` = success
- `1` = general/unknown failure
- `2` = invalid arguments / usage error
- `3` = authentication failure (wrong passphrase, bad JWT, expired token)
- `4` = insufficient balance / payment failure
- `5` = network/RPC error (transient, retry safe)
- `6` = wallet not found / not initialized
- `7` = resource not found (404 from API)
- `8` = conflict (resource already exists)

Always pair exit codes with a `{"error": "<CODE>", "message": "..."}` JSON body to stdout/stderr when `--json` is active.

**Warning signs:**
- All error paths call `process.exit(1)`
- No documented exit code table in the codebase
- JSON error responses lack a machine-readable `error` field with a stable code string

**Phase to address:** CLI scaffolding phase; must be established before any commands are implemented

---

### Pitfall 13: MCP Config Path Detection Breaks on Windows and NVM Environments

**What goes wrong:**
The postinstall script hardcodes paths like `~/.claude/claude_desktop_config.json` or uses `os.homedir()` + forward slashes. On Windows: forward slashes fail in some contexts, `%APPDATA%` is the correct root (not `~`), and `npx` is not a native binary (requires `cmd /c npx`). With NVM/nvm-windows: the Node.js binary is at a versioned path, so `process.execPath` changes between node versions, breaking the configured MCP server command path.

**Why it happens:**
Most developers test on macOS. Windows paths and process resolution differences are discovered by users filing issues, not by the original developer.

**How to avoid:**
- Use `os.homedir()` + `path.join()` for all path construction (never string concatenation with `/`)
- Detect the platform and use `%APPDATA%` on Windows: `process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')`
- For the MCP server command in config files, use `npx @mainlayer/cli mcp-serve` rather than an absolute binary path — npx resolves the right version regardless of install location
- On Windows, set `"command": "cmd"` with `"args": ["/c", "npx", "@mainlayer/cli", "mcp-serve"]` in the MCP config JSON
- Test in a Windows CI environment (GitHub Actions `windows-latest`) before release

**Warning signs:**
- Hardcoded `/` path separators in config path construction
- `__dirname` or `process.execPath` used as the MCP server command
- No Windows CI in GitHub Actions

**Phase to address:** Installation and MCP auto-configuration phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `aes-256-cbc` instead of `aes-256-gcm` | Simpler examples to copy | Wallet integrity not verified; bit-flip attacks possible | Never |
| `SHA256(passphrase)` as key | Zero latency key derivation | Offline brute-force in seconds on any 8-char passphrase | Never |
| Single exit code `1` for all errors | Faster initial implementation | Agents must parse human text to decide retry strategy; brittle | Only in first commit; address before any agent testing |
| Hardcode Solana mainnet RPC endpoint | Simplest to start | RPC rate limits hit immediately; no staging/devnet support | Never — use configurable RPC URL from day one |
| `sendRawTransaction` without confirmation | Faster UX (returns immediately) | Silent payment losses on congested network | Never for payment transactions |
| Overwrite AI platform configs in postinstall | Simple to implement | Destroys user's existing config on reinstall | Never |
| Commit test keypair fixtures | Convenience for tests | Risk of publishing private keys to npm | Never — generate in test setup |
| Ship TypeScript source files in npm tarball | No build step needed | Larger install, exposes internal structure | Never for public packages |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Solana RPC | Using `https://api.mainnet-beta.solana.com` (public) as the only option | Make RPC URL configurable via `MAINLAYER_SOLANA_RPC_URL`; default to public but allow override |
| X402 Facilitator | Not validating that the requested token is USDC before approving | Always check `token.symbol === 'USDC'` and `token.mint === <known USDC mint address>` before signing |
| X402 amount conversion | `Math.floor(dollars * 1_000_000)` for USDC amounts | `Math.round(dollars * 1_000_000)` to avoid IEEE 754 boundary failures |
| `@solana/web3.js` + `@solana/kit` mix | Passing v1 `Keypair` where v2 `KeyPairSigner` expected | Commit to one SDK; use `@solana/compat` for any cross-version bridge |
| Claude Desktop MCP config | Writing raw JSON without checking for existing valid JSON | Always `JSON.parse` existing config first; handle `SyntaxError` if file is malformed |
| Gemini/Cursor/other AI platform configs | Assuming same path and format as Claude Desktop | Each platform has a different config schema and path; handle each explicitly with a per-platform adapter |
| JWT storage | Storing JWT in plaintext `~/.mainlayer/config.json` world-readable | Ensure file permissions are `0600` (owner read/write only) on creation |
| SPL token delegate | Assuming one delegate per wallet at all times | `approve` overwrites any existing delegate; check current delegation state before approving if re-use is possible |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Solana RPC cold-start per command | Each `mainlayer balance` takes 2-4s waiting for connection | Reuse `Connection` object; consider lazy init only when RPC call needed | Every invocation |
| scrypt/PBKDF2 on every command | 300-500ms delay on any command that touches the wallet | Cache the decrypted keypair in process memory for the session lifetime; do not re-derive on every sub-call | Every wallet-involving command |
| Blocking main thread with synchronous file I/O | CLI feels laggy; blocks event loop during config file reads | Use `fs.promises` async file operations throughout | Noticeable on slow disks / network file systems |
| `node_modules` size from dev dependencies in tarball | `npm install @mainlayer/cli` is slow; container images are large | Use `files` whitelist in `package.json`; `npm pack --dry-run` to audit | Every install in agent-ephemeral environments |
| Polling transaction confirmation with `sleep` loop | Transaction confirmation takes 30-90s even on fast network | Use `confirmTransaction` with `lastValidBlockHeight` check, not fixed-interval polling | Congested Solana network |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Private key in memory longer than necessary | Key exposed in heap dump, core dump, or process snapshot | Clear key buffer after signing: `secretKey.fill(0)` |
| `wallet.json` created with default permissions (0644) | Any process running as the same user can read the encrypted wallet | `fs.writeFile(path, data, { mode: 0o600 })` on wallet file creation |
| Passphrase in CLI history via `--passphrase` flag | Shell history files (`~/.zsh_history`) log the passphrase | Prefer env var `MAINLAYER_WALLET_PASSPHRASE`; warn in docs that `--passphrase` is logged |
| JWT stored plaintext in config, world-readable | Token can be used to call API on behalf of the user | File mode `0600` on all files in `~/.mainlayer/`; warn on startup if permissions are wrong |
| Unsigned transactions accepted as payment proof | Fraudulent payment claims | Always verify transaction signature on-chain via `getTransaction` before issuing access |
| X402 token allowlist not enforced | Malicious vendor requests payment in arbitrary SPL token | Validate mint address matches known USDC mint (mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) before signing |
| `npm publish` with no MFA or provenance | Package hijacking via stolen npm credentials | Enable npm MFA; use `npm publish --provenance` with a trusted CI/CD runner |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Interactive prompts for passphrase with no TTY fallback | Agent stalls indefinitely; human user confused by silent hang | Check `process.stdin.isTTY`; support env var; fail clearly with actionable message if no input source |
| Human-readable table output mixed into stdout | Agent receives unparseable output when `--json` not passed | Default to JSON when stdout is not a TTY (`!process.stdout.isTTY`); table only for interactive sessions |
| Spinner/progress bar written to stdout | Agent receives corrupted output: JSON mixed with ANSI escape codes | All progress UI writes to stderr only |
| Confirmation prompts (`Are you sure? [y/N]`) in destructive operations | Hangs agents; prevents automation of `wallet export`, `resource delete` | Add `--yes` / `--force` flag to bypass; if no TTY and no flag, fail with code 2 and descriptive error |
| Version mismatch between CLI and API not surfaced | Cryptic 422 or 400 errors from API when CLI sends stale schema | CLI checks API version on first call per session; warns if CLI is > 1 minor version behind |
| `skills.md` not updated when commands change | AI agents use outdated command syntax; failures increase | `skills.md` should be generated from the command registry, not hand-maintained |

---

## "Looks Done But Isn't" Checklist

- [ ] **Wallet encryption:** Verify GCM auth tag is stored and verified on decrypt — test that a 1-byte flip in the ciphertext throws, not silently corrupts
- [ ] **Postinstall safety:** Verify `npm install --ignore-scripts` completes without error; verify `mainlayer setup` re-runs correctly
- [ ] **MCP config patching:** Verify running install twice does not duplicate the MCP entry; verify existing config content is preserved
- [ ] **Transaction confirmation:** Verify `mainlayer buy` does not return success until the Solana transaction reaches `confirmed` commitment
- [ ] **Exit codes:** Verify each error class returns the correct exit code, not just `1` — write a test for each defined code
- [ ] **JSON output purity:** Verify `mainlayer balance --json` produces only valid JSON on stdout with zero extraneous text
- [ ] **Passphrase in agent mode:** Verify a command requiring wallet decrypt runs correctly with `MAINLAYER_WALLET_PASSPHRASE` set and no TTY
- [ ] **npm tarball contents:** Verify `npm pack --dry-run` includes no `.ts` source files, `.env` files, or test fixtures
- [ ] **File permissions:** Verify `~/.mainlayer/wallet.json` is created with mode `0600`, not `0644`
- [ ] **Windows paths:** Verify MCP config path construction uses `path.join()` and `os.homedir()`, not string concatenation

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong encryption mode (CBC) shipped to users | HIGH | Publish patch release; on startup detect legacy CBC format and prompt user to re-encrypt with GCM; provide migration command `mainlayer wallet migrate-encryption` |
| Secrets accidentally published to npm | HIGH | Immediately `npm deprecate` the affected version; publish clean version; notify affected users; rotate any exposed keys; file npm security advisory |
| Postinstall destroys user AI platform config | MEDIUM | Publish patch; restore from `.mainlayer-backup` file if present; document manual restore path |
| Floating-point payment amounts rejected | MEDIUM | Patch `Math.floor` to `Math.round`; agents will retry automatically once patched version is installed |
| Agents hanging on passphrase prompt | MEDIUM | Patch with env var support; document the `MAINLAYER_WALLET_PASSPHRASE` workaround in release notes |
| Solana RPC blockhash expiry silently losing payments | HIGH | Implement confirmation polling; add idempotency check via `getTransaction(signature)` before re-submitting |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AES-256-CBC instead of GCM | Wallet implementation | Unit test: tampered ciphertext throws `AuthTagError` |
| Weak passphrase KDF | Wallet implementation | Code review: scrypt/PBKDF2 with correct parameters |
| Passphrase prompt blocks agent | Wallet implementation + CLI scaffolding | Integration test: run wallet command with `MAINLAYER_WALLET_PASSPHRASE` env var, no TTY |
| Postinstall fails silently in CI | Installation / MCP auto-configuration | Test: `npm install --ignore-scripts`; verify exit 0 |
| Postinstall overwrites AI platform config | Installation / MCP auto-configuration | Test: run postinstall twice; verify no duplicate entries |
| Private keys in error output | Error handling layer (early scaffolding) | Test: trigger decrypt error; grep output for any hex/base58 key bytes |
| Solana blockhash expiry | Transaction signing / buy flow | Integration test on devnet: submit transaction, verify confirmation before success response |
| X402 USDC floating-point precision | X402 buy flow implementation | Unit test: `toDustAmount(0.005)` === `5000` |
| web3.js v1 vs kit type mismatch | Project scaffolding (dependency selection) | Compile-time: all signing code passes TypeScript without `any` casts |
| Secrets in npm tarball | Build and publish setup | CI check: `npm pack --dry-run` | grep for `.env\|wallet.json\|keypair.json` |
| Package size / bloat | Build setup | CI check: tarball size under 5MB |
| Non-differentiated exit codes | CLI scaffolding | Integration tests assert exit code per error scenario |
| MCP cross-platform path bugs | Installation / MCP auto-configuration | Windows CI (GitHub Actions `windows-latest`) |

---

## Sources

- [X402 Solana floating-point precision bug (dev.to)](https://dev.to/gen_ishinabe/adding-solana-payments-to-elizaos-what-i-learned-about-ssrf-floating-point-and-ipv6-15kh)
- [X402 payment timeout and confirmation issues (dev.to)](https://dev.to/mkmkkkkk/x402-payment-timeouts-why-your-agent-loses-money-and-how-to-fix-it-fgk)
- [Solana transaction retry guide — official docs](https://solana.com/developers/guides/advanced/retry)
- [Solana SPL token delegate approve](https://solana.com/docs/tokens/basics/approve-delegate)
- [@solana/kit v2 release and breaking changes (Anza)](https://www.anza.xyz/blog/solana-web3-js-2-release)
- [How to Start Building with Solana Web3.js 2.0 (Helius)](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk)
- [npm ignore-scripts security best practices (nodejs-security.com)](https://www.nodejs-security.com/blog/npm-ignore-scripts-best-practices-as-security-mitigation-for-malicious-packages)
- [Shai-Hulud npm supply chain attack analysis (Snyk, 2025)](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/)
- [VU#534320 — npm credential theft via postinstall (CERT/CC)](https://kb.cert.org/vuls/id/534320)
- [Avoid publishing secrets to npm (Node Best Practices)](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/security/avoid_publishing_secrets.md)
- [npm .npmignore vs .gitignore gotcha (npm Blog)](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish.html)
- [AES-256-GCM in Node.js (Node.js official crypto docs)](https://nodejs.org/api/crypto.html)
- [Node.js AES-GCM example with scrypt KDF (GitHub Gist, AndiDittrich)](https://gist.github.com/AndiDittrich/4629e7db04819244e843)
- [Writing CLI Tools That AI Agents Actually Want to Use (dev.to)](https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no)
- [Command Line Interface Guidelines (clig.dev)](https://clig.dev/)
- [MCP Servers Don't Work with NVM (GitHub issue)](https://github.com/modelcontextprotocol/servers/issues/64)
- [Fix spawn npx ENOENT on Windows for MCP (fransiscuss.com)](https://fransiscuss.com/2025/04/22/fix-spawn-npx-enoent-windows11-mcp-server/)
- [Solana transaction confirmation logic issues (GitHub issue #23949)](https://github.com/solana-labs/solana/issues/23949)
- [Solana blockhash expiry and retry best practices (Chainstack)](https://docs.chainstack.com/docs/enhancing-solana-spl-token-transfers-with-retry-logic)

---
*Pitfalls research for: TypeScript CLI with embedded blockchain wallet (@mainlayer/cli)*
*Researched: 2026-03-25*

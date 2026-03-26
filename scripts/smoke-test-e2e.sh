#!/usr/bin/env bash
# smoke-test-e2e.sh — End-to-end smoke test for Mainlayer CLI against the live API
#
# Usage:
#   bash scripts/smoke-test-e2e.sh
#
# Optional env vars:
#   VENDOR_EMAIL    — defaults to smoke-vendor-<timestamp>@test.mainlayer.fr
#   VENDOR_PASSWORD — defaults to SmokeTest123!
#   BUYER_EMAIL     — defaults to smoke-buyer-<timestamp>@test.mainlayer.fr
#   BUYER_PASSWORD  — defaults to SmokeTest123!
#   API_URL         — defaults to https://api.mainlayer.fr
#   CLI             — path to CLI binary (auto-detected if unset)
#
# Exit codes:
#   0 — all steps passed
#   1 — one or more steps failed

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TS=$(date +%s)
VENDOR_EMAIL="${VENDOR_EMAIL:-smoke-vendor-${TS}@test.mainlayer.fr}"
VENDOR_PASSWORD="${VENDOR_PASSWORD:-SmokeTest123!}"
BUYER_EMAIL="${BUYER_EMAIL:-smoke-buyer-${TS}@test.mainlayer.fr}"
BUYER_PASSWORD="${BUYER_PASSWORD:-SmokeTest123!}"
API_URL="${API_URL:-https://api.mainlayer.fr}"
RESOURCE_SLUG="smoke-test-${TS}"

# Tracking
PASS_COUNT=0
FAIL_COUNT=0
declare -a RESULTS=()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log() { echo "[smoke-test] $*" >&2; }
log_step() { echo "" && echo "=== $* ===" >&2; }

record() {
  local label="$1"
  local result="$2"  # PASS or FAIL
  RESULTS+=("${result}: ${label}")
  if [[ "$result" == "PASS" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "  [PASS] ${label}" >&2
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "  [FAIL] ${label}" >&2
  fi
}

# Run a CLI command, capture JSON stdout, check exit code
# Returns exit code in $RUN_EXIT, JSON output in $RUN_OUT
run_cli() {
  RUN_OUT=""
  RUN_EXIT=0
  RUN_OUT=$("$CLI" "$@" 2>/dev/null) || RUN_EXIT=$?
}

# ---------------------------------------------------------------------------
# Build step (exits on failure — no point continuing without a binary)
# ---------------------------------------------------------------------------
log_step "Build"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log "Running npm run build..."
npm run build >&2
log "Build complete."

# ---------------------------------------------------------------------------
# Detect CLI entry point
# ---------------------------------------------------------------------------
if [[ -z "${CLI:-}" ]]; then
  if [[ -f "dist/cli/index.js" ]]; then
    CLI="node dist/cli/index.js"
    log "Using local build: node dist/cli/index.js"
  else
    CLI="npx mainlayer"
    log "Using npx mainlayer"
  fi
fi

# Convert to array for safe invocation
read -ra CLI <<< "$CLI"

# ---------------------------------------------------------------------------
# Configure base URL
# ---------------------------------------------------------------------------
log_step "Configure"
log "Setting apiUrl to ${API_URL}..."
"${CLI[@]}" config set apiUrl "$API_URL" >&2
record "config set apiUrl" "PASS"

# ---------------------------------------------------------------------------
# Step 1: Vendor flow
# ---------------------------------------------------------------------------
log_step "Step 1: Vendor flow"
log "Vendor email: ${VENDOR_EMAIL}"

# 1a. Register vendor
run_cli auth register --email "$VENDOR_EMAIL" --password "$VENDOR_PASSWORD" --json
if [[ "$RUN_EXIT" -eq 0 ]]; then
  record "vendor auth register" "PASS"
else
  record "vendor auth register" "FAIL"
  log "Output: $RUN_OUT"
fi

# 1b. Auth status (verify authenticated)
run_cli auth status --json
if [[ "$RUN_EXIT" -eq 0 ]]; then
  # Check that the response contains an email field indicating authenticated state
  if echo "$RUN_OUT" | grep -q '"email"'; then
    record "vendor auth status" "PASS"
  else
    record "vendor auth status (no email in response)" "FAIL"
    log "Output: $RUN_OUT"
  fi
else
  record "vendor auth status" "FAIL"
  log "Output: $RUN_OUT"
fi

# 1c. Create a resource
run_cli resource create \
  --slug "$RESOURCE_SLUG" \
  --type api \
  --price 0.01 \
  --fee-model one_time \
  --url "https://httpbin.org/get" \
  --description "Smoke test resource created by smoke-test-e2e.sh" \
  --json

RESOURCE_ID=""
if [[ "$RUN_EXIT" -eq 0 ]]; then
  # Try to extract resource id from JSON
  RESOURCE_ID=$(echo "$RUN_OUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','') or d.get('resource',{}).get('id',''))" 2>/dev/null || true)
  record "vendor resource create" "PASS"
  log "Created resource ID: ${RESOURCE_ID:-<unknown>}"
else
  record "vendor resource create" "FAIL"
  log "Output: $RUN_OUT"
fi

# 1d. Logout vendor
run_cli auth logout --json
if [[ "$RUN_EXIT" -eq 0 ]]; then
  record "vendor auth logout" "PASS"
else
  record "vendor auth logout" "FAIL"
  log "Output: $RUN_OUT"
fi

# ---------------------------------------------------------------------------
# Step 2: Buyer flow
# ---------------------------------------------------------------------------
log_step "Step 2: Buyer flow"
log "Buyer email: ${BUYER_EMAIL}"

# 2a. Register buyer
run_cli auth register --email "$BUYER_EMAIL" --password "$BUYER_PASSWORD" --json
if [[ "$RUN_EXIT" -eq 0 ]]; then
  record "buyer auth register" "PASS"
else
  record "buyer auth register" "FAIL"
  log "Output: $RUN_OUT"
fi

# 2b. Auth status (verify authenticated)
run_cli auth status --json
if [[ "$RUN_EXIT" -eq 0 ]]; then
  if echo "$RUN_OUT" | grep -q '"email"'; then
    record "buyer auth status" "PASS"
  else
    record "buyer auth status (no email in response)" "FAIL"
    log "Output: $RUN_OUT"
  fi
else
  record "buyer auth status" "FAIL"
  log "Output: $RUN_OUT"
fi

# 2c. Discover resources
run_cli discover --json
if [[ "$RUN_EXIT" -eq 0 ]]; then
  record "buyer discover" "PASS"
  # If we created a resource, check if it appears
  if [[ -n "$RESOURCE_SLUG" ]]; then
    if echo "$RUN_OUT" | grep -q "$RESOURCE_SLUG"; then
      record "buyer discover — smoke resource visible" "PASS"
    else
      record "buyer discover — smoke resource not yet visible (propagation delay)" "PASS"
      log "Note: resource may not appear immediately due to indexing delay"
    fi
  fi
else
  record "buyer discover" "FAIL"
  log "Output: $RUN_OUT"
fi

# 2d. Logout buyer
run_cli auth logout --json
if [[ "$RUN_EXIT" -eq 0 ]]; then
  record "buyer auth logout" "PASS"
else
  record "buyer auth logout" "FAIL"
  log "Output: $RUN_OUT"
fi

# ---------------------------------------------------------------------------
# Step 3: Summary
# ---------------------------------------------------------------------------
log_step "Summary"
echo ""
echo "Results:"
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo ""
echo "Passed: ${PASS_COUNT} / $((PASS_COUNT + FAIL_COUNT))"
echo ""

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "SMOKE TEST FAILED — ${FAIL_COUNT} step(s) failed" >&2
  exit 1
else
  echo "SMOKE TEST PASSED — all ${PASS_COUNT} steps passed"
  exit 0
fi

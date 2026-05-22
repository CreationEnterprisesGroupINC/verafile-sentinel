#!/bin/bash

# OCP Temporal Bounds Conformance Suite v0.1.0
# Tests the temporal bounds extension against appendix-temporal-bounds-r.md
# Usage: ./run-temporal-bounds-conformance.sh
# Requires: Node.js >=18, live Base Sepolia RPC

SUITE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SUITE_DIR/../.." && pwd)"
PASS=0
FAIL=0
ERRORS=()

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "OCP Temporal Bounds Conformance Suite v0.1.0"
echo "Chain:    Base Sepolia (eip155:84532)"
echo "-------------------------------------------"

run_test() {
  local name="$1"
  local expected="$2"
  local script="$3"
  output=$(node -e "$script" 2>&1)
  exit_code=$?
  if [ "$expected" = "pass" ]; then
    if [ $exit_code -eq 0 ]; then
      echo -e "${GREEN}  PASS${NC}  $name"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}  FAIL${NC}  $name"
      echo "         got: $output"
      FAIL=$((FAIL + 1))
      ERRORS+=("$name")
    fi
  else
    if [ $exit_code -ne 0 ]; then
      echo -e "${GREEN}  PASS${NC}  $name"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}  FAIL${NC}  $name"
      echo "         got: $output"
      FAIL=$((FAIL + 1))
      ERRORS+=("$name")
    fi
  fi
}

# ---------------------------------------------------------------------------
# Test Group 1: Live chain queries
# ---------------------------------------------------------------------------

echo ""
echo "Group 1: Live chain queries (must PASS)"

run_test "known tx returns finalized result" "pass" "
const { getTemporalBound } = require('$REPO_DIR/reference-cli/temporal-bounds.js');
getTemporalBound(
  '0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd',
  'eip155:84532'
).then(r => {
  if (!r.finalized) { console.error('expected finalized'); process.exit(1); }
  if (r.block_number !== 41658348) { console.error('wrong block'); process.exit(1); }
  if (r.upper_bound !== r.block_timestamp + 2) { console.error('wrong upper bound'); process.exit(1); }
});
"

run_test "upper_bound equals block_timestamp plus validator window" "pass" "
const { getTemporalBound } = require('$REPO_DIR/reference-cli/temporal-bounds.js');
getTemporalBound(
  '0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd',
  'eip155:84532'
).then(r => {
  if (r.upper_bound !== r.block_timestamp + r.validator_influence_window) {
    console.error('upper bound mismatch'); process.exit(1);
  }
});
"

run_test "finality_depth_confirmed exceeds safe_depth" "pass" "
const { getTemporalBound } = require('$REPO_DIR/reference-cli/temporal-bounds.js');
getTemporalBound(
  '0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd',
  'eip155:84532'
).then(r => {
  if (r.finality_depth_confirmed < r.finality_depth_required) {
    console.error('not finalized'); process.exit(1);
  }
});
"

# ---------------------------------------------------------------------------
# Test Group 2: Input validation
# ---------------------------------------------------------------------------

echo ""
echo "Group 2: Input validation (must PASS)"

run_test "rejects invalid txHash" "fail" "
const { getTemporalBound } = require('$REPO_DIR/reference-cli/temporal-bounds.js');
getTemporalBound('not-a-hash', 'eip155:84532').then(() => process.exit(0)).catch(() => process.exit(1));
"

run_test "rejects unsupported chainId" "fail" "
const { getTemporalBound } = require('$REPO_DIR/reference-cli/temporal-bounds.js');
getTemporalBound(
  '0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd',
  'eip155:99999'
).then(() => process.exit(0)).catch(() => process.exit(1));
"

# ---------------------------------------------------------------------------
# Test Group 3: Finality table
# ---------------------------------------------------------------------------

echo ""
echo "Group 3: Finality table (must PASS)"

run_test "Base Sepolia safe_depth is 32" "pass" "
const { FINALITY } = require('$REPO_DIR/reference-cli/temporal-bounds.js');
if (FINALITY['eip155:84532'].safe_depth !== 32) { console.error('wrong safe_depth'); process.exit(1); }
"

run_test "Ethereum mainnet safe_depth is 64" "pass" "
const { FINALITY } = require('$REPO_DIR/reference-cli/temporal-bounds.js');
if (FINALITY['eip155:1'].safe_depth !== 64) { console.error('wrong safe_depth'); process.exit(1); }
"

run_test "Ethereum mainnet validator window is 12" "pass" "
const { FINALITY } = require('$REPO_DIR/reference-cli/temporal-bounds.js');
if (FINALITY['eip155:1'].validator_influence_window !== 12) { console.error('wrong window'); process.exit(1); }
"

# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

TOTAL=$((PASS + FAIL))
echo ""
echo "-------------------------------------------"
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}CONFORMANT${NC} — $PASS/$TOTAL tests passed"
  echo ""
  echo "This implementation conforms to OCP Temporal Bounds Extension v0.1.0"
  echo "Spec: docs/spec/appendix-temporal-bounds-r.md"
  exit 0
else
  echo -e "${RED}NON-CONFORMANT${NC} — $PASS/$TOTAL tests passed, $FAIL failed"
  echo ""
  echo "Failed tests:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi

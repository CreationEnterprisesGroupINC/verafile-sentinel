#!/bin/bash

# OCP Revocation Conformance Suite v0.1.0
# Tests the revocation extension against appendix-revocation-r.md
# Usage: ./run-revocation-conformance.sh
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
echo "OCP Revocation Conformance Suite v0.1.0"
echo "Chain:    Base Sepolia (eip155:84532)"
echo "Contract: 0x2fa07c85439850ff6C5688d926bDa6DaEe62Db15"
echo "-------------------------------------------"

run_test() {
  local name="$1"
  local expected="$2"   # "pass" or "fail"
  local script="$3"

  output=$(node -e "$script" 2>&1)
  exit_code=$?

  if [ "$expected" = "pass" ]; then
    if [ $exit_code -eq 0 ]; then
      echo -e "${GREEN}  PASS${NC}  $name"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}  FAIL${NC}  $name"
      echo "         expected: success"
      echo "         got:      $output"
      FAIL=$((FAIL + 1))
      ERRORS+=("$name")
    fi
  else
    if [ $exit_code -ne 0 ]; then
      echo -e "${GREEN}  PASS${NC}  $name"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}  FAIL${NC}  $name"
      echo "         expected: error/rejection"
      echo "         got:      $output"
      FAIL=$((FAIL + 1))
      ERRORS+=("$name")
    fi
  fi
}

# ---------------------------------------------------------------------------
# Test Group 1: Digest construction — determinism
# ---------------------------------------------------------------------------

echo ""
echo "Group 1: Digest construction (must PASS)"

run_test "Vector 1 — known digest matches spec" "pass" "
const { buildRevocationDigest } = require('$REPO_DIR/reference-cli/revoke.js');
buildRevocationDigest(
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  { reason: 'key-compromised', revokedAt: 1740000000 }
).then(d => {
  const expected = '0x179c3d35e8fa9f7f646d8557c0d7e7761429690077d3cbd46756c9d70f9ae092';
  if (d !== expected) { console.error('mismatch: ' + d); process.exit(1); }
});
"

run_test "digest rejects missing 0x prefix" "fail" "
const { buildRevocationDigest } = require('$REPO_DIR/reference-cli/revoke.js');
buildRevocationDigest('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {}).then(() => process.exit(0)).catch(() => process.exit(1));
"

run_test "digest rejects non-string input" "fail" "
const { buildRevocationDigest } = require('$REPO_DIR/reference-cli/revoke.js');
buildRevocationDigest(12345, {}).then(() => process.exit(0)).catch(() => process.exit(1));
"

# ---------------------------------------------------------------------------
# Test Group 2: Chain queries — live Base Sepolia
# ---------------------------------------------------------------------------

echo ""
echo "Group 2: Chain queries (must PASS)"

run_test "NOT_FOUND for unrevoked digest" "pass" "
const { verifyWithRevocation } = require('$REPO_DIR/reference-cli/revoke.js');
verifyWithRevocation(
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  Math.floor(Date.now() / 1000),
  'eip155:84532'
).then(s => {
  if (s !== 'NOT_FOUND') { console.error('expected NOT_FOUND got ' + s); process.exit(1); }
});
"

run_test "NOT_FOUND for all-zeros digest" "pass" "
const { verifyWithRevocation } = require('$REPO_DIR/reference-cli/revoke.js');
verifyWithRevocation(
  '0x0000000000000000000000000000000000000000000000000000000000000000',
  Math.floor(Date.now() / 1000),
  'eip155:84532'
).then(s => {
  if (s !== 'NOT_FOUND') { console.error('expected NOT_FOUND got ' + s); process.exit(1); }
});
"

# ---------------------------------------------------------------------------
# Test Group 3: Temporal semantics
# ---------------------------------------------------------------------------

echo ""
echo "Group 3: Temporal semantics (must PASS)"

run_test "asOfTimestamp rejects non-number" "fail" "
const { verifyWithRevocation } = require('$REPO_DIR/reference-cli/revoke.js');
verifyWithRevocation(
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'not-a-number',
  'eip155:84532'
).then(() => process.exit(0)).catch(() => process.exit(1));
"

# ---------------------------------------------------------------------------
# Test Group 4: Input validation
# ---------------------------------------------------------------------------

echo ""
echo "Group 4: Input validation (must PASS)"

run_test "checkRevocationStatus rejects bad chainId with no fallback" "fail" "
const { checkRevocationStatus } = require('$REPO_DIR/reference-cli/revoke.js');
checkRevocationStatus(
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'eip155:99999'
).then(() => process.exit(0)).catch(() => process.exit(1));
"

run_test "stableJson sorts keys deterministically" "pass" "
const { stableJson } = require('$REPO_DIR/reference-cli/revoke.js');
const a = stableJson({ z: 1, a: 2, m: 3 });
const b = stableJson({ m: 3, z: 1, a: 2 });
if (a !== b) { console.error('not stable: ' + a + ' vs ' + b); process.exit(1); }
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
  echo "This implementation conforms to OCP Revocation Extension v0.1.0"
  echo "Spec: docs/spec/appendix-revocation-r.md"
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

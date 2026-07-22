#!/bin/sh

set -eu
LC_ALL=C
export LC_ALL

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BASE_POLICY="$ROOT_DIR/reference/reconstruction-policy.yaml"
VALIDATOR="$ROOT_DIR/tests/reconstruction-policy-test.sh"
TEST_TMP_ROOT=$(mktemp -d "${TMPDIR:-/private/tmp}/reconstruction-policy-negative.XXXXXX")

cleanup() {
  case $TEST_TMP_ROOT in
    "${TMPDIR:-/private/tmp}"/reconstruction-policy-negative.*)
      [ ! -d "$TEST_TMP_ROOT" ] || rm -rf "$TEST_TMP_ROOT"
      ;;
  esac
}

trap cleanup EXIT HUP INT TERM

expect_rejected() {
  name=$1
  filter=$2
  policy="$TEST_TMP_ROOT/$name.json"
  output="$TEST_TMP_ROOT/$name.out"

  jq "$filter" "$BASE_POLICY" >"$policy"
  if RECONSTRUCTION_POLICY_FILE="$policy" sh "$VALIDATOR" >"$output" 2>&1; then
    printf 'FAIL %s (unexpected success)\n' "$name" >&2
    return 1
  fi
  printf 'PASS %s\n' "$name"
}

expect_rejected "missing-open-decisions" '.rules.openDecisions = []'
expect_rejected "contract-path-traversal" \
  '.evidence.contracts[0].path = "forensics/contracts/../../docs/evidence-register.md"'
expect_rejected "swapped-claim-contract" \
  '.coverage.requiredClaimContracts["CLM-CLASSIC-TOSS-RNG"] = ["DER-CLASSIC-PRESENTATION-001"]'
expect_rejected "duplicate-contract-id" \
  '.evidence.contracts[1].id = .evidence.contracts[0].id'

printf 'RESULT total=4 pass=4 fail=0\n'

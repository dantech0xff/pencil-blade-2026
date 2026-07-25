#!/bin/sh

set -eu
LC_ALL=C
export LC_ALL

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SCRIPT="$ROOT_DIR/scripts/inventory-apk.sh"
POLICY_TEST="$ROOT_DIR/tests/reconstruction-policy-test.sh"
POLICY_NEGATIVE_TEST="$ROOT_DIR/tests/reconstruction-policy-negative-test.sh"
APK="$ROOT_DIR/Pencil+Blade_1.5_APKPure.apk"
PLAN="$ROOT_DIR/plans/260721-2253-pencil-blade-restoration/plan.md"
EVIDENCE_MANIFEST="$ROOT_DIR/.forensics-work/phase-01/checksums.sha256"
EVIDENCE_DIR="$ROOT_DIR/.forensics-work/phase-01"

AAPT_BIN="${AAPT_BIN:-/Users/dan/Library/Android/sdk/build-tools/36.1.0/aapt}"
APKANALYZER_BIN="${APKANALYZER_BIN:-/Users/dan/Library/Android/sdk/cmdline-tools/latest/bin/apkanalyzer}"
APKSIGNER_BIN="${APKSIGNER_BIN:-/Users/dan/Library/Android/sdk/build-tools/36.1.0/apksigner}"
READELF_BIN="${READELF_BIN:-/Users/dan/Library/Android/sdk/ndk/21.4.7075529/toolchains/arm-linux-androideabi-4.9/prebuilt/darwin-x86_64/arm-linux-androideabi/bin/readelf}"
LLVM_NM_BIN="${LLVM_NM_BIN:-/Users/dan/Library/Android/sdk/ndk/28.2.13676358/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-nm}"
JADX_BIN="${JADX_BIN:-/opt/homebrew/bin/jadx}"
STRINGS_BIN="${STRINGS_BIN:-/usr/bin/strings}"

PASS=0
FAIL=0
TOTAL=0
START_TIME=$(date +%s)
TEST_TMP_ROOT=$(mktemp -d "${TMPDIR:-/private/tmp}/inventory-apk-test-suite.XXXXXX")

note() {
  printf '%s\n' "$*"
}

cleanup() {
  case $TEST_TMP_ROOT in
    "${TMPDIR:-/private/tmp}"/inventory-apk-test-suite.*)
      [ ! -d "$TEST_TMP_ROOT" ] || rm -rf "$TEST_TMP_ROOT"
      ;;
  esac
}

trap cleanup EXIT HUP INT TERM

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

new_tmpdir() {
  mktemp -d "$TEST_TMP_ROOT/case.XXXXXX"
}

assert_pass() {
  label=$1
  shift
  if "$@"; then
    printf 'PASS %s\n' "$label"
  else
    printf 'FAIL %s\n' "$label" >&2
    return 1
  fi
}

assert_fail() {
  label=$1
  shift
  if "$@"; then
    printf 'FAIL %s (unexpected success)\n' "$label" >&2
    return 1
  fi
  printf 'PASS %s\n' "$label"
}

assert_file_exists() {
  [ -f "$1" ]
}

assert_dir_exists() {
  [ -d "$1" ]
}

assert_contains() {
  haystack=$1
  needle=$2
  case $haystack in
    *"$needle"*) return 0 ;;
    *) return 1 ;;
  esac
}

run_cmd() {
  out=$1
  shift
  if "$@" >"$out" 2>&1; then
    return 0
  fi
  return $?
}

run_cmd_expect_fail() {
  out=$1
  shift
  if "$@" >"$out" 2>&1; then
    return 1
  fi
  return 0
}

validate_claims_schema_and_ledger() {
  claims_file=$1
  schema_file=$2
  register_file=$3

  jq -e . "$schema_file" >/dev/null || return 1

  register_ids=$(awk '
    /^### [A-Z]+-[A-Z0-9-]+/ {
      print $2
    }
    /^\| (SRC|DER|CLM)-[A-Z0-9][A-Z0-9-]* / {
      print $2
    }
  ' "$register_file" | sort -u) || return 1

  claim_count=0
  while IFS= read -r line || [ -n "$line" ]; do
    [ -n "$line" ] || return 1
    if ! printf '%s\n' "$line" | jq -e -s '
      def required_keys:
        [
          "id",
          "claim",
          "status",
          "evidenceTier",
          "evidenceRefs",
          "confidence",
          "contractEligible",
          "contradictionIds",
          "reviewer",
          "reviewDate"
        ];
      def allowed_keys:
        required_keys + ["nativeAddresses", "notes"];
      def matching_string($pattern):
        if type == "string" then test($pattern) else false end;
      def nonempty_string:
        if type == "string" then length >= 1 else false end;
      def integer_evidence_tier:
        if type == "number" then
          floor == . and (. == 1 or . == 2 or . == 3 or . == 4)
        else
          false
        end;
      def evidence_refs:
        if type == "array" then
          length >= 1
          and (length == (unique | length))
          and all(.[]; matching_string("^(SRC|DER)-[A-Z0-9][A-Z0-9-]*\\z"))
        else
          false
        end;
      def contradiction_ids:
        if type == "array" then
          length == (unique | length)
          and all(.[]; matching_string("^CLM-[A-Z0-9][A-Z0-9-]*\\z"))
        else
          false
        end;
      def native_addresses:
        if type == "array" then
          length == (unique | length)
          and all(.[]; matching_string("^0x[0-9A-Fa-f]+\\z"))
        else
          false
        end;
      length == 1
      and (
        .[0]
        | if type != "object" then
            false
          else
            ((required_keys - keys) | length == 0)
            and ((keys - allowed_keys) | length == 0)
            and (.id | matching_string("^CLM-[A-Z0-9][A-Z0-9-]*\\z"))
            and (.claim | nonempty_string)
            and (.status | type == "string" and (. == "recovered" or . == "inferred" or . == "unknown"))
            and (.evidenceTier | integer_evidence_tier)
            and (.evidenceRefs | evidence_refs)
            and (.confidence | if type == "number" then . >= 0 and . <= 1 else false end)
            and (.contractEligible | type == "boolean")
            and (.contradictionIds | contradiction_ids)
            and (.reviewer | nonempty_string)
            and (.reviewDate | matching_string("^[0-9]{4}-[0-9]{2}-[0-9]{2}\\z"))
            and ((has("nativeAddresses") | not) or (.nativeAddresses | native_addresses))
            and ((has("notes") | not) or (.notes | type == "string"))
            and (
              if .contractEligible then
                (.evidenceTier == 1 or .evidenceTier == 2) and .status == "recovered"
              else
                true
              end
            )
          end
      )
    ' >/dev/null; then
      return 1
    fi

    review_date=$(printf '%s\n' "$line" | jq -r '.reviewDate') || return 1
    parsed_review_date=$(date -j -f '%Y-%m-%d' "$review_date" '+%Y-%m-%d' 2>/dev/null) || return 1
    [ "$parsed_review_date" = "$review_date" ] || return 1
    claim_count=$((claim_count + 1))
  done < "$claims_file"
  [ "$claim_count" -ge 1 ] || return 1

  ids=$(jq -r '.id' "$claims_file") || return 1
  dup_ids=$(printf '%s\n' "$ids" | sort | uniq -d)
  [ -z "$dup_ids" ] || return 1

  while IFS= read -r line || [ -n "$line" ]; do
    [ -n "$line" ] || continue
    refs=$(printf '%s\n' "$line" | jq -r '.evidenceRefs[]') || return 1
    for ref in $refs; do
      if ! printf '%s\n' "$register_ids" | grep -Fxq "$ref"; then
        return 1
      fi
    done
    contradictions=$(printf '%s\n' "$line" | jq -r '.contradictionIds[]') || return 1
    for contradiction in $contradictions; do
      if ! printf '%s\n' "$ids" | grep -Fxq "$contradiction"; then
        return 1
      fi
    done
  done < "$claims_file"

  return 0
}

verify_checksums_manifest() {
  manifest=$1
  source_apk=$2
  expected_source_hash=$3
  work_root=${4:-}

  first_line=$(sed -n '1p' "$manifest")
  case $first_line in
    "$expected_source_hash  SOURCE_APK:"*)
      :
      ;;
    *)
      return 1
      ;;
  esac

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    hash=$(printf '%s\n' "$line" | awk '{print $1}')
    path=$(printf '%s\n' "$line" | cut -d' ' -f3-)
    case $path in
      SOURCE_APK:*)
        source_path=${path#SOURCE_APK:}
        [ "$hash" = "$expected_source_hash" ] || return 1
        [ "$source_path" = "$(basename "$source_apk")" ] || return 1
        ;;
      ./*)
        [ -n "$work_root" ] || return 1
        rel=${path#./}
        file="$work_root/$rel"
        [ -f "$file" ] || return 1
        actual_hash=$(sha256_file "$file")
        [ "$actual_hash" = "$hash" ] || return 1
        ;;
      *)
        return 1
        ;;
    esac
  done < "$manifest"
}

test_sh_syntax() {
  sh -n "$SCRIPT"
  sh -n "$POLICY_TEST"
  sh -n "$POLICY_NEGATIVE_TEST"
}

test_verify_happy_path() {
  tmp=$(new_tmpdir)
  out="$tmp/verify.out"
  if ! run_cmd "$out" sh "$SCRIPT" verify "$APK"; then
    cat "$out"
    return 1
  fi
  output=$(cat "$out")
  assert_contains "$output" "RESULT: PASS (all baseline assertions matched)" || return 1
  assert_contains "$output" "apk_sha256" || return 1
  assert_contains "$output" "95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa" || return 1
  assert_contains "$output" "zip_entries" || return 1
  assert_contains "$output" "native_library_path" || return 1
  assert_contains "$output" "certificate_sha256" || return 1
}

test_bad_and_missing_args() {
  tmp=$(new_tmpdir)
  out="$tmp/args.out"
  assert_pass "missing top-level args" run_cmd_expect_fail "$out" sh "$SCRIPT" || return 1
  assert_pass "invalid mode" run_cmd_expect_fail "$out" sh "$SCRIPT" nope || return 1
  assert_pass "verify missing apk" run_cmd_expect_fail "$out" sh "$SCRIPT" verify || return 1
  assert_pass "extract missing work dir" run_cmd_expect_fail "$out" sh "$SCRIPT" extract "$APK" || return 1
}

test_mutated_apk_rejected() {
  tmp=$(new_tmpdir)
  mutated="$tmp/mutated.apk"
  cp "$APK" "$mutated"
  printf '\001' | dd of="$mutated" bs=1 seek=0 conv=notrunc >/dev/null 2>&1
  out="$tmp/mutated.out"
  run_cmd_expect_fail "$out" sh "$SCRIPT" verify "$mutated" || return 1
}

test_extract_refuses_nonempty_target() {
  tmp=$(new_tmpdir)
  work="$tmp/work"
  mkdir -p "$work"
  : > "$work/occupied.txt"
  out="$tmp/extract-nonempty.out"
  run_cmd_expect_fail "$out" sh "$SCRIPT" extract "$APK" "$work" || return 1
  assert_contains "$(cat "$out")" "work directory must be empty" || return 1
}

test_full_extract_and_outputs() {
  tmp=$(new_tmpdir)
  work="$tmp/work"
  mkdir -p "$work"
  source_before=$(sha256_file "$APK")
  out="$tmp/extract.out"
  if ! run_cmd "$out" sh "$SCRIPT" extract "$APK" "$work"; then
    cat "$out"
    return 1
  fi
  source_after=$(sha256_file "$APK")
  if [ "$source_before" != "$source_after" ]; then
    note "source APK hash changed during extraction"
    return 1
  fi

  for relative_file in \
    inventory.txt \
    tool-versions.txt \
    commands.txt \
    checksums.sha256 \
    manifest/aapt-badging.txt \
    manifest/aapt-xmltree.txt \
    manifest/apkanalyzer.xml \
    resources/aapt-resources.txt \
    signing/apksigner.txt \
    native/libgame.so \
    native/elf-header.txt \
    native/elf-attributes.txt \
    native/elf-sections.txt \
    native/elf-dynamic.txt \
    native/dynamic-symbols.txt \
    native/imports.txt \
    native/dynamic-nm.txt \
    native/strings.txt \
    jadx/resources/AndroidManifest.xml
  do
    if ! assert_file_exists "$work/$relative_file"; then
      note "missing extract output: $relative_file"
      return 1
    fi
  done
  if ! assert_dir_exists "$work/java/app-owned"; then
    note "missing extract directory: java/app-owned"
    return 1
  fi

  app_owned_files=$(find "$work/java/app-owned" -type f | sed '/^$/d')
  if [ -z "$app_owned_files" ]; then
    note "no app-owned Java files extracted"
    return 1
  fi
  if printf '%s\n' "$app_owned_files" | grep -v '\.java$' >/dev/null 2>&1; then
    note "non-Java file found in app-owned curation"
    return 1
  fi
  missing_package_declarations=$(grep -L '^package uit\.dev\.pencilblade;' $app_owned_files || true)
  if [ -n "$missing_package_declarations" ]; then
    note "wrong app-owned package: $missing_package_declarations"
    return 1
  fi

  if ! verify_checksums_manifest "$work/checksums.sha256" "$APK" "$source_before" "$work"; then
    note "generated checksum manifest failed verification"
    return 1
  fi
}

test_current_checksum_manifest() {
  source_hash=$(sha256_file "$APK")
  verify_checksums_manifest "$EVIDENCE_MANIFEST" "$APK" "$source_hash" "$EVIDENCE_DIR"
}

test_gitignore_boundary() {
  git check-ignore -q "Pencil+Blade_1.5_APKPure.apk"
  git check-ignore -q ".forensics-work/phase-01"
  git check-ignore -q ".forensics-work/phase-01/checksums.sha256"

  git check-ignore -q "forensics/claims.jsonl" && return 1
  git check-ignore -q "forensics/claims.schema.json" && return 1
  git check-ignore -q "docs/evidence-register.md" && return 1
  git check-ignore -q "reference/reconstruction-policy.yaml" && return 1
  git check-ignore -q "scripts/inventory-apk.sh" && return 1
  return 0
}

test_ck_plan_validate() {
  out=$(new_tmpdir)/plan.out
  if ! run_cmd "$out" ck plan validate "$PLAN" --strict; then
    cat "$out"
    return 1
  fi
  output=$(cat "$out")
  assert_contains "$output" "Valid" || return 1
}

test_claims_schema_and_jsonl() {
  validate_claims_schema_and_ledger "$ROOT_DIR/forensics/claims.jsonl" "$ROOT_DIR/forensics/claims.schema.json" "$ROOT_DIR/docs/evidence-register.md"
}

test_malformed_claims_rejected() {
  work=$(new_tmpdir)
  confidence_string_claim="$work/confidence-string.jsonl"
  contradiction_string_claim="$work/contradiction-string.jsonl"
  trailing_newline_ref_claim="$work/trailing-newline-ref.jsonl"
  empty_claims="$work/empty.jsonl"
  blank_claims="$work/blank.jsonl"
  source_claim=$(sed -n '1p' "$ROOT_DIR/forensics/claims.jsonl")
  [ -n "$source_claim" ] || return 1

  printf '%s\n' "$source_claim" | jq -c '.confidence = "0.99"' > "$confidence_string_claim" || return 1
  printf '%s\n' "$source_claim" | jq -c '.contradictionIds = "CLM-NOT-AN-ARRAY"' > "$contradiction_string_claim" || return 1
  printf '%s\n' "$source_claim" | jq -c '.evidenceRefs[0] += "\n"' > "$trailing_newline_ref_claim" || return 1
  : > "$empty_claims"
  printf '\n' > "$blank_claims"

  assert_fail "string confidence rejected" \
    validate_claims_schema_and_ledger \
    "$confidence_string_claim" \
    "$ROOT_DIR/forensics/claims.schema.json" \
    "$ROOT_DIR/docs/evidence-register.md" || return 1
  assert_fail "string contradictionIds rejected" \
    validate_claims_schema_and_ledger \
    "$contradiction_string_claim" \
    "$ROOT_DIR/forensics/claims.schema.json" \
    "$ROOT_DIR/docs/evidence-register.md" || return 1
  assert_fail "trailing-newline evidence reference rejected" \
    validate_claims_schema_and_ledger \
    "$trailing_newline_ref_claim" \
    "$ROOT_DIR/forensics/claims.schema.json" \
    "$ROOT_DIR/docs/evidence-register.md" || return 1
  assert_fail "empty claims ledger rejected" \
    validate_claims_schema_and_ledger \
    "$empty_claims" \
    "$ROOT_DIR/forensics/claims.schema.json" \
    "$ROOT_DIR/docs/evidence-register.md" || return 1
  assert_fail "blank claims record rejected" \
    validate_claims_schema_and_ledger \
    "$blank_claims" \
    "$ROOT_DIR/forensics/claims.schema.json" \
    "$ROOT_DIR/docs/evidence-register.md"
}

test_classic_contract_evidence_hashes() {
  for evidence_id in \
    DER-CLASSIC-PHYSICS-001 \
    DER-CLASSIC-TOSS-001 \
    DER-CLASSIC-CUT-SCORE-001 \
    DER-CLASSIC-TIME-STATE-001 \
    DER-CLASSIC-PRESENTATION-001
  do
    case $evidence_id in
      DER-CLASSIC-PHYSICS-001)
        artifact="$ROOT_DIR/forensics/contracts/classic-physics-contract.md"
        ;;
      DER-CLASSIC-TOSS-001)
        artifact="$ROOT_DIR/forensics/contracts/classic-toss-contract.md"
        ;;
      DER-CLASSIC-CUT-SCORE-001)
        artifact="$ROOT_DIR/forensics/contracts/classic-cut-score-contract.md"
        ;;
      DER-CLASSIC-TIME-STATE-001)
        artifact="$ROOT_DIR/forensics/contracts/classic-time-state-contract.md"
        ;;
      DER-CLASSIC-PRESENTATION-001)
        artifact="$ROOT_DIR/forensics/contracts/classic-presentation-contract.md"
        ;;
    esac

    row=$(awk -F '|' -v id="$evidence_id" '
      {
        value=$2
        gsub(/^[ \t]+|[ \t]+$/, "", value)
        if (value == id) print
      }
    ' "$ROOT_DIR/docs/evidence-register.md")
    [ -n "$row" ] || return 1
    registered_hash=$(printf '%s\n' "$row" | awk -F '|' '{ value=$6; gsub(/[ `]/, "", value); print value }')
    registered_bytes=$(printf '%s\n' "$row" | awk -F '|' '{ value=$7; gsub(/[ ,]/, "", value); print value }')
    actual_hash=$(sha256_file "$artifact")
    actual_bytes=$(wc -c <"$artifact" | tr -d '[:space:]')

    [ "$actual_hash" = "$registered_hash" ] || return 1
    [ "$actual_bytes" = "$registered_bytes" ] || return 1
  done
}

test_reconstruction_policy() {
  out=$(new_tmpdir)/policy.out
  if ! run_cmd "$out" sh "$POLICY_TEST"; then
    cat "$out"
    return 1
  fi
  assert_contains "$(cat "$out")" "PASS reconstruction policy"
}

test_reconstruction_policy_rejections() {
  out=$(new_tmpdir)/policy-negative.out
  if ! run_cmd "$out" sh "$POLICY_NEGATIVE_TEST"; then
    cat "$out"
    return 1
  fi
  assert_contains "$(cat "$out")" "RESULT total=4 pass=4 fail=0"
}

run_test() {
  name=$1
  shift
  if [ -n "${TEST_FILTER:-}" ] && [ "$name" != "$TEST_FILTER" ]; then
    return 0
  fi
  TOTAL=$((TOTAL + 1))
  if "$@"; then
    PASS=$((PASS + 1))
    printf 'PASS %s\n' "$name"
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL %s\n' "$name" >&2
  fi
}

run_test "sh syntax" test_sh_syntax
run_test "verify happy path" test_verify_happy_path
run_test "bad and missing args" test_bad_and_missing_args
run_test "mutated apk rejected" test_mutated_apk_rejected
run_test "extract refuses nonempty target" test_extract_refuses_nonempty_target
run_test "full extract outputs" test_full_extract_and_outputs
run_test "current checksum manifest" test_current_checksum_manifest
run_test "gitignore boundary" test_gitignore_boundary
run_test "ck plan validate strict" test_ck_plan_validate
run_test "claims schema and ledger" test_claims_schema_and_jsonl
run_test "malformed claims rejected" test_malformed_claims_rejected
run_test "classic contract evidence hashes" test_classic_contract_evidence_hashes
run_test "reconstruction policy" test_reconstruction_policy
run_test "reconstruction policy rejections" test_reconstruction_policy_rejections

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

printf 'RESULT total=%s pass=%s fail=%s duration_s=%s\n' "$TOTAL" "$PASS" "$FAIL" "$DURATION"

[ "$FAIL" -eq 0 ]

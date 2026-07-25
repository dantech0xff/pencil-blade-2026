#!/bin/sh

set -eu
LC_ALL=C
export LC_ALL

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SCRIPT="$ROOT_DIR/scripts/analyze-native-static.sh"
LIB="$ROOT_DIR/.forensics-work/phase-01/native/libgame.so"
CURATED_APP_MAP="$ROOT_DIR/forensics/native/function-map.csv"
EXPECTED_SHA256="55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e"

PASS=0
FAIL=0
TOTAL=0
START_TIME=$(date +%s)
TEST_TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/analyze-native-static-test.XXXXXX")

cleanup() {
  case "$TEST_TMP_ROOT" in
    "${TMPDIR:-/tmp}"/analyze-native-static-test.*)
      [ ! -d "$TEST_TMP_ROOT" ] || rm -rf "$TEST_TMP_ROOT"
      ;;
  esac
}

trap cleanup EXIT HUP INT TERM

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

new_case_dir() {
  mktemp -d "$TEST_TMP_ROOT/case.XXXXXX"
}

run_capture() {
  output_file=$1
  shift
  "$@" > "$output_file" 2>&1
}

expect_failure() {
  output_file=$1
  shift
  if "$@" > "$output_file" 2>&1; then
    return 1
  fi
  return 0
}

assert_contains_file() {
  file_path=$1
  expected=$2
  grep -F -- "$expected" "$file_path" >/dev/null 2>&1
}

test_shell_syntax() {
  sh -n "$SCRIPT"
  sh -n "$ROOT_DIR/tests/analyze-native-static-test.sh"
  node --check "$ROOT_DIR/scripts/enrich-native-function-map.mjs"
}

test_missing_and_bad_args() {
  case_dir=$(new_case_dir)
  expect_failure "$case_dir/no-args.out" sh "$SCRIPT" || return 1
  expect_failure "$case_dir/one-arg.out" sh "$SCRIPT" "$LIB" || return 1
  expect_failure "$case_dir/too-many.out" sh "$SCRIPT" "$LIB" "$case_dir/out" extra || return 1
  expect_failure "$case_dir/missing-lib.out" sh "$SCRIPT" "$case_dir/missing.so" "$case_dir/out" || return 1
  expect_failure "$case_dir/unsafe-root.out" sh "$SCRIPT" "$LIB" / || return 1
}

test_wrong_hash_rejected() {
  case_dir=$(new_case_dir)
  bad_lib="$case_dir/libgame-mutated.so"
  cp "$LIB" "$bad_lib"
  printf '\001' | dd of="$bad_lib" bs=1 seek=0 conv=notrunc >/dev/null 2>&1
  expect_failure "$case_dir/wrong-hash.out" sh "$SCRIPT" "$bad_lib" "$case_dir/output" || return 1
  assert_contains_file "$case_dir/wrong-hash.out" "native SHA-256 mismatch"
  [ ! -e "$case_dir/output" ]
}

test_nonempty_target_rejected() {
  case_dir=$(new_case_dir)
  output_dir="$case_dir/output"
  mkdir "$output_dir"
  : > "$output_dir/occupied"
  expect_failure "$case_dir/nonempty.out" sh "$SCRIPT" "$LIB" "$output_dir" || return 1
  assert_contains_file "$case_dir/nonempty.out" "output directory must be empty"
}

test_symlink_target_rejected_with_trailing_slash() {
  case_dir=$(new_case_dir)
  mkdir "$case_dir/actual-output"
  ln -s "$case_dir/actual-output" "$case_dir/output-link"
  expect_failure "$case_dir/symlink.out" sh "$SCRIPT" "$LIB" "$case_dir/output-link/" || return 1
  assert_contains_file "$case_dir/symlink.out" "refusing symlink output directory"
}

test_invalid_tool_override_rejected() {
  case_dir=$(new_case_dir)
  fake_nm="$case_dir/not-llvm-nm"
  printf '%s\n' '#!/bin/sh' 'printf "%s\\n" "unrelated tool 1.0"' > "$fake_nm"
  chmod +x "$fake_nm"

  expect_failure "$case_dir/tool.out" env LLVM_NM_BIN="$fake_nm" sh "$SCRIPT" "$LIB" "$case_dir/output" || return 1
  assert_contains_file "$case_dir/tool.out" "LLVM_NM_BIN must identify llvm-nm"
  [ ! -e "$case_dir/output" ]
}

resolve_llvm_nm() {
  if command -v llvm-nm >/dev/null 2>&1; then
    command -v llvm-nm
    return 0
  fi

  sdk_root=${ANDROID_SDK_ROOT:-${ANDROID_HOME:-${HOME:-}/Library/Android/sdk}}
  find "$sdk_root/ndk" -type f -path '*/toolchains/llvm/prebuilt/*/bin/llvm-nm' -perm -111 -print 2>/dev/null | sort | tail -n 1
}

test_analysis_outputs() {
  case_dir=$(new_case_dir)
  output_dir="$case_dir/output"
  mkdir "$output_dir"
  real_llvm_nm=$(resolve_llvm_nm)
  [ -n "$real_llvm_nm" ] || return 1
  llvm_nm_wrapper="$case_dir/llvm-nm-standard-version"
  printf '%s\n' \
    '#!/bin/sh' \
    'if [ "$#" -eq 1 ] && [ "$1" = "--version" ]; then' \
    '  printf "%s\\n" "LLVM (https://llvm.org/):" "  LLVM version 19.0.1"' \
    '  exit 0' \
    'fi' \
    'exec "$REAL_LLVM_NM" "$@"' > "$llvm_nm_wrapper"
  chmod +x "$llvm_nm_wrapper"
  source_before=$(sha256_file "$LIB")
  [ "$source_before" = "$EXPECTED_SHA256" ] || return 1

  if ! run_capture "$case_dir/analyze.out" env REAL_LLVM_NM="$real_llvm_nm" LLVM_NM_BIN="$llvm_nm_wrapper" sh "$SCRIPT" "$LIB" "$output_dir"; then
    cat "$case_dir/analyze.out" >&2
    return 1
  fi

  source_after=$(sha256_file "$LIB")
  [ "$source_after" = "$source_before" ] || return 1
  assert_contains_file "$case_dir/analyze.out" "RESULT: PASS" || return 1

  for required_file in \
    input.txt \
    tool-versions.txt \
    commands.txt \
    summary.txt \
    checksums.sha256 \
    gnu/elf-header.txt \
    gnu/program-headers.txt \
    gnu/sections.txt \
    gnu/attributes.txt \
    gnu/dynamic.txt \
    gnu/relocations.txt \
    gnu/dynamic-symbols.txt \
    llvm/file-header.txt \
    llvm/program-headers.txt \
    llvm/sections.txt \
    llvm/dynamic-table.txt \
    llvm/relocations.txt \
    llvm/dynamic-symbols.txt \
    llvm/needed-libraries.txt \
    symbols/dynamic-raw.txt \
    symbols/dynamic-demangled.txt \
    symbols/imports-raw.txt \
    symbols/imports-demangled.txt \
    function-inventory.csv \
    app-function-base.csv \
    app-function-inventory.csv \
    function-enrichment-summary.json \
    strings/all-offsets.txt \
    resource-looking-strings.txt \
    disassembly/samples.tsv \
    disassembly/gnu-full.txt \
    disassembly/gnu-thumb-samples.txt \
    disassembly/llvm-thumb-samples.txt
  do
    [ -s "$output_dir/$required_file" ] || {
      printf 'missing or empty output: %s\n' "$required_file" >&2
      return 1
    }
  done

  assert_contains_file "$output_dir/input.txt" "sha256=$EXPECTED_SHA256" || return 1
  assert_contains_file "$output_dir/input.txt" "bytes=4734880" || return 1
  assert_contains_file "$output_dir/tool-versions.txt" "analyzer-script=3" || return 1
  assert_contains_file "$output_dir/commands.txt" "--triple=thumbv5te-none-linux-android" || return 1
  assert_contains_file "$output_dir/summary.txt" "named_dynamic_symbols=16516" || return 1
  assert_contains_file "$output_dir/summary.txt" "defined_dynamic_symbols=16173" || return 1
  assert_contains_file "$output_dir/summary.txt" "undefined_imports=343" || return 1
  assert_contains_file "$output_dir/summary.txt" "defined_dynamic_functions=13948" || return 1
  assert_contains_file "$output_dir/summary.txt" "application_functions=" || return 1
  assert_contains_file "$output_dir/tool-versions.txt" "strings=" || return 1
  assert_contains_file "$output_dir/tool-versions.txt" "LLVM version" || return 1
  assert_contains_file "$output_dir/tool-versions.txt" "version=unavailable" || return 1
  assert_contains_file "$output_dir/tool-versions.txt" "executable-sha256=" || return 1

  expected_header='raw_address,instruction_address,thumb,size_bytes,mangled_symbol,demangled_symbol,ownership,subsystem,confidence,evidence_ids'
  [ "$(sed -n '1p' "$output_dir/function-inventory.csv")" = "$expected_header" ] || return 1
  awk 'NR > 1 {line=$0; count=gsub(/","/, "", line); if ($0 !~ /^"0x[0-9a-f]{8}","0x[0-9a-f]{8}","[01]","[0-9]+",/ || count != 9) exit 1} END {exit !(NR == 13949)}' \
    "$output_dir/function-inventory.csv" || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"0x00162ac9","0x00162ac8","1","68","_ZN12ScoreManager8AddScoreEi","ScoreManager::AddScore(int)","app","scoring","0.99"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeInit","Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeInit","engine","platform","0.95"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"b2World::Step(float, int, int)","box2d","physics","0.95"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"AES_encrypt","AES_encrypt","vendor","unclassified","0.95"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"PhysicsLayer::getPhysicsWorld()","app","physics","0.99"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"ClassicModeLayer::GetGameMode()","app","gameplay","0.99"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"DER-NATIVE-001;DER-NATIVE-CORPUS-001"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"std::bad_alloc::what() const","compiler-runtime","unclassified","0.95"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"__cxa_begin_catch","__cxa_begin_catch","compiler-runtime","unclassified","0.95"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"__cxxabiv1::__class_type_info::~__class_type_info()","compiler-runtime","unclassified","0.95"' || return 1
  assert_contains_file "$output_dir/function-inventory.csv" '"__gnu_cxx::__verbose_terminate_handler()","compiler-runtime","unclassified","0.95"' || return 1
  assert_contains_file "$SCRIPT" 'pthread_' || return 1
  assert_contains_file "$SCRIPT" 'memcpy$' || return 1

  enriched_header="$expected_header,direct_call_count,direct_calls_json,numeric_constant_count,numeric_constants_json,string_xref_count,string_xrefs_json,review_state"
  [ "$(sed -n '1p' "$output_dir/app-function-base.csv")" = "$expected_header" ] || return 1
  [ "$(sed -n '1p' "$output_dir/app-function-inventory.csv")" = "$enriched_header" ] || return 1
  awk 'NR > 1 && $0 !~ /,"app",/ {bad=1} END {exit (NR <= 1 || bad)}' \
    "$output_dir/app-function-inventory.csv" || return 1
  awk 'NR == 1 || /,"app",/' "$output_dir/function-inventory.csv" > "$case_dir/expected-app-function-inventory.csv"
  cmp "$case_dir/expected-app-function-inventory.csv" "$output_dir/app-function-base.csv" || return 1
  cmp "$CURATED_APP_MAP" "$output_dir/app-function-inventory.csv" || {
    printf 'curated application function map is stale; regenerate it with scripts/analyze-native-static.sh\n' >&2
    return 1
  }
  summary_app_functions=$(sed -n 's/^application_functions=//p' "$output_dir/summary.txt")
  inventory_app_functions=$(awk 'END {print NR-1}' "$output_dir/app-function-inventory.csv")
  [ "$summary_app_functions" = "$inventory_app_functions" ] || return 1
  [ "$inventory_app_functions" -gt 0 ] || return 1
  assert_contains_file "$output_dir/app-function-inventory.csv" '"PhysicsLayer::getPhysicsWorld()","app"' || return 1
  assert_contains_file "$output_dir/app-function-inventory.csv" '"ClassicModeLayer::GetGameMode()","app"' || return 1
  assert_contains_file "$output_dir/app-function-inventory.csv" '"AboutLayer::onEnter()","app","presentation","0.99","DER-NATIVE-001;DER-NATIVE-CORPUS-001"' || return 1
  assert_contains_file "$output_dir/app-function-inventory.csv" 'Backgrounds/aboutbackground.png' || return 1
  assert_contains_file "$output_dir/app-function-inventory.csv" 'Sounds/menubuttonclick.wav' || return 1
  assert_contains_file "$output_dir/app-function-inventory.csv" ',"auto-indexed"' || return 1
  assert_contains_file "$output_dir/function-enrichment-summary.json" '"totalFunctions": 713' || return 1
  assert_contains_file "$output_dir/function-enrichment-summary.json" '"functionsWithDirectCalls": 553' || return 1
  assert_contains_file "$output_dir/function-enrichment-summary.json" '"functionsWithNumericConstants": 684' || return 1
  assert_contains_file "$output_dir/function-enrichment-summary.json" '"functionsWithStringXrefs": 91' || return 1
  assert_contains_file "$output_dir/function-enrichment-summary.json" '"auto-indexed": 713' || return 1

  assert_contains_file "$output_dir/disassembly/samples.tsv" '0x00162ac9'
  assert_contains_file "$output_dir/disassembly/samples.tsv" 'ScoreManager::AddScore(int)'
  assert_contains_file "$output_dir/disassembly/llvm-thumb-samples.txt" 'triple=thumbv5te-none-linux-android'
  assert_contains_file "$output_dir/disassembly/llvm-thumb-samples.txt" '00162ac8 <ScoreManager::AddScore(int)>'
  assert_contains_file "$output_dir/disassembly/llvm-thumb-samples.txt" 'b538'
  assert_contains_file "$output_dir/disassembly/gnu-thumb-samples.txt" '00162ac8 <ScoreManager::AddScore(int)>'
}

run_test() {
  test_name=$1
  shift
  TOTAL=$((TOTAL + 1))
  if "$@"; then
    PASS=$((PASS + 1))
    printf 'PASS %s\n' "$test_name"
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL %s\n' "$test_name" >&2
  fi
}

run_test "shell syntax" test_shell_syntax
run_test "missing and bad args" test_missing_and_bad_args
run_test "wrong hash rejected" test_wrong_hash_rejected
run_test "nonempty target rejected" test_nonempty_target_rejected
run_test "trailing-slash symlink target rejected" test_symlink_target_rejected_with_trailing_slash
run_test "invalid tool override rejected" test_invalid_tool_override_rejected
run_test "analysis outputs and source preservation" test_analysis_outputs

END_TIME=$(date +%s)
printf 'RESULT total=%s pass=%s fail=%s duration_s=%s\n' "$TOTAL" "$PASS" "$FAIL" "$((END_TIME - START_TIME))"
[ "$FAIL" -eq 0 ]

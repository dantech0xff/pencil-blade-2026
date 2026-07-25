#!/bin/sh

set -eu
LC_ALL=C
export LC_ALL

EXPECTED_SHA256="55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e"
EXPECTED_BYTES="4734880"
LLVM_THUMB_TRIPLE="thumbv5te-none-linux-android"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

usage() {
  cat <<'EOF'
Usage:
  scripts/analyze-native-static.sh <libgame.so> <empty-output-dir>

Optional tool overrides:
  GNU_READELF_BIN, GNU_OBJDUMP_BIN, LLVM_READOBJ_BIN, LLVM_OBJDUMP_BIN,
  LLVM_NM_BIN, LLVM_CXXFILT_BIN, STRINGS_BIN, NODE_BIN

This command performs static inspection only. It never executes, loads, links, patches,
or otherwise modifies the native input.
EOF
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

sha256_file() {
  target_path=$1
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$target_path" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$target_path" | awk '{print $1}'
  else
    die "neither shasum nor sha256sum is available"
  fi
}

command_path() {
  command -v "$1" 2>/dev/null || return 1
}

resolve_override() {
  override_path=$1
  tool_label=$2
  if [ -n "$override_path" ]; then
    [ -x "$override_path" ] || die "$tool_label override is not executable: $override_path"
    printf '%s\n' "$override_path"
    return 0
  fi
  return 1
}

android_sdk_root() {
  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "$ANDROID_SDK_ROOT" ]; then
    printf '%s\n' "$ANDROID_SDK_ROOT"
    return 0
  fi
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then
    printf '%s\n' "$ANDROID_HOME"
    return 0
  fi
  user_home=${HOME:-}
  if [ -n "$user_home" ] && [ -d "$user_home/Library/Android/sdk" ]; then
    printf '%s\n' "$user_home/Library/Android/sdk"
    return 0
  fi
  if [ -n "$user_home" ] && [ -d "$user_home/Android/Sdk" ]; then
    printf '%s\n' "$user_home/Android/Sdk"
    return 0
  fi
  return 1
}

latest_executable() {
  search_root=$1
  shift
  found_path=$(find "$search_root" "$@" -print 2>/dev/null | sort | tail -n 1)
  if [ -n "$found_path" ] && [ -x "$found_path" ]; then
    printf '%s\n' "$found_path"
    return 0
  fi
  return 1
}

resolve_gnu_tool() {
  tool_name=$1
  override_path=$2
  path_name=$3

  if resolve_override "$override_path" "$tool_name"; then
    return 0
  fi
  if found_path=$(command_path "$path_name"); then
    if "$found_path" --version 2>&1 | grep -F "GNU $tool_name" >/dev/null; then
      printf '%s\n' "$found_path"
      return 0
    fi
  fi
  if found_path=$(command_path "$tool_name"); then
    if "$found_path" --version 2>&1 | grep -F "GNU $tool_name" >/dev/null; then
      printf '%s\n' "$found_path"
      return 0
    fi
  fi
  if sdk_root=$(android_sdk_root); then
    found_path=$(latest_executable "$sdk_root/ndk" -type f -path "*/toolchains/arm-linux-androideabi-4.9/prebuilt/*/bin/$path_name") || true
    if [ -n "$found_path" ]; then
      printf '%s\n' "$found_path"
      return 0
    fi
  fi
  die "$tool_name not found; set its *_BIN override or install an Android NDK containing GNU ARM binutils"
}

resolve_llvm_tool() {
  tool_name=$1
  override_path=$2

  if resolve_override "$override_path" "$tool_name"; then
    return 0
  fi
  if found_path=$(command_path "$tool_name"); then
    printf '%s\n' "$found_path"
    return 0
  fi
  if sdk_root=$(android_sdk_root); then
    found_path=$(latest_executable "$sdk_root/ndk" -type f -path "*/toolchains/llvm/prebuilt/*/bin/$tool_name") || true
    if [ -n "$found_path" ]; then
      printf '%s\n' "$found_path"
      return 0
    fi
  fi
  die "$tool_name not found; set its *_BIN override or ANDROID_SDK_ROOT/ANDROID_HOME"
}

resolve_regular_tool() {
  tool_name=$1
  override_path=$2
  if resolve_override "$override_path" "$tool_name"; then
    return 0
  fi
  command_path "$tool_name" || die "$tool_name not found on PATH; set its *_BIN override"
}

validate_toolchain() {
  "$GNU_READELF" --version 2>&1 | grep -F 'GNU readelf' >/dev/null ||
    die "GNU_READELF_BIN must identify GNU readelf"
  "$GNU_OBJDUMP" --version 2>&1 | grep -F 'GNU objdump' >/dev/null ||
    die "GNU_OBJDUMP_BIN must identify GNU objdump"
  "$LLVM_READOBJ" --version 2>&1 | grep -F 'LLVM version' >/dev/null ||
    die "LLVM_READOBJ_BIN must identify LLVM readobj"
  "$LLVM_OBJDUMP" --version 2>&1 | grep -F 'LLVM version' >/dev/null ||
    die "LLVM_OBJDUMP_BIN must identify LLVM objdump"
  "$LLVM_NM" --version 2>&1 | grep -E 'LLVM version|llvm-nm' >/dev/null ||
    die "LLVM_NM_BIN must identify llvm-nm"
  "$LLVM_CXXFILT" --version 2>&1 | grep -E 'LLVM version|llvm-cxxfilt' >/dev/null ||
    die "LLVM_CXXFILT_BIN must identify llvm-cxxfilt"
}

first_version_line() {
  tool_path=$1
  "$tool_path" --version 2>&1 | awk '
    NF && fallback == "" { fallback=$0 }
    /GNU .* [0-9]|LLVM version/ { print; found=1; exit }
    END { if (!found) print fallback }
  '
}

hex_stop_address() {
  start_hex=$1
  byte_count=$2
  awk -v value="${start_hex#0x}" -v size="$byte_count" '
    function hex_to_decimal(text, index_value, digit, total) {
      text=tolower(text)
      total=0
      for (index_value=1; index_value<=length(text); index_value++) {
        digit=index("0123456789abcdef", substr(text,index_value,1))-1
        total=(total*16)+digit
      }
      return total
    }
    BEGIN { printf "0x%08x\n", hex_to_decimal(value)+size }
  '
}

prepare_output_dir() {
  requested_output=$1
  normalized_output=$requested_output
  while [ "$normalized_output" != "/" ] && [ "${normalized_output%/}" != "$normalized_output" ]; do
    normalized_output=${normalized_output%/}
  done

  case "$normalized_output" in
    ''|/|.|..)
      die "refusing unsafe output directory: $requested_output"
      ;;
  esac
  [ ! -L "$normalized_output" ] || die "refusing symlink output directory: $requested_output"

  output_parent=$(dirname "$normalized_output")
  output_name=$(basename "$normalized_output")
  [ -d "$output_parent" ] || die "output parent directory does not exist: $output_parent"
  output_parent=$(CDPATH= cd -- "$output_parent" && pwd -P)
  OUTPUT_DIR="$output_parent/$output_name"

  case "$OUTPUT_DIR" in
    /|"$(pwd -P)") die "refusing unsafe output directory: $OUTPUT_DIR" ;;
  esac
  if [ -e "$OUTPUT_DIR" ] && [ ! -d "$OUTPUT_DIR" ]; then
    die "output path exists and is not a directory: $OUTPUT_DIR"
  fi
  if [ -d "$OUTPUT_DIR" ]; then
    first_entry=$(find "$OUTPUT_DIR" ! -path "$OUTPUT_DIR" -print 2>/dev/null | sed -n '1p')
    [ -z "$first_entry" ] || die "output directory must be empty: $OUTPUT_DIR"
  fi
}

generate_function_inventory() {
  raw_tsv="$OUTPUT_DIR/symbols/functions-raw.tsv"
  demangled_txt="$OUTPUT_DIR/symbols/functions-demangled.txt"
  inventory_csv="$OUTPUT_DIR/function-inventory.csv"
  app_inventory_csv="$OUTPUT_DIR/app-function-base.csv"

  awk '
    function hex_to_decimal(text, index_value, digit, total) {
      text=tolower(text)
      total=0
      for (index_value=1; index_value<=length(text); index_value++) {
        digit=index("0123456789abcdef", substr(text,index_value,1))-1
        total=(total*16)+digit
      }
      return total
    }
    $1 ~ /^[0-9]+:$/ && $4 == "FUNC" && $7 != "UND" {
      raw=hex_to_decimal($2)
      thumb=raw%2
      instruction=raw-thumb
      printf "0x%08x\t0x%08x\t%d\t%s\t%s\n", raw, instruction, thumb, $3, $8
    }
  ' "$OUTPUT_DIR/gnu/dynamic-symbols.txt" > "$raw_tsv"

  cut -f5 "$raw_tsv" | xargs -n 200 "$LLVM_CXXFILT" --no-strip-underscore > "$demangled_txt"
  paste "$raw_tsv" "$demangled_txt" | awk -F '\t' '
    function csv(text) {
      gsub(/"/, "\"\"", text)
      return "\"" text "\""
    }
    function classify_ownership(name) {
      subject=name
      sub(/^(non-virtual|virtual) thunk to /, "", subject)
      if (name ~ /^Java_org_cocos2dx_/) return "engine"
      if (name ~ /^Java_com_google_/) return "vendor"
      if (name ~ /^(JNI_OnLoad|Java_uit_dev_pencilblade_)/) return "app"
      if (subject ~ /^(ScoreManager|ComboManager|TimeManager|FruitFailManager|Settings|ObjectivesManager|ObjectivesLayer|ObjectiveItem|SelectItems|MainMenuLayer|ModeSelectLayer|OptionsLayer|AboutLayer|LeaderboardLayer|BaseGameplayLayer|ClassicModeLayer|CrazyModeLayer|BaseBirdLayer|ClassicBirdLayer|CrazyBirdLayer|ComboBirdLayer|GNStyleLayer|PhysicsLayer|PhysicsBladeLayer|RaysCastCallback|TossTurn|WaveToss|ConcurrentToss|FreeToss|DoubleToss|BonusToss|CutObject|Fruit|CutFruit|DragonFruit|Bomb|BombElectric|Blade|BasicBlade|BirdBlade|DragonBlade|CentipedeBlade|ParticleObject|AppDelegate)(::|$)/) return "app"
      if (subject ~ /^(b2[A-Z]|Box2D::)/) return "box2d"
      if (subject ~ /^(cocos2d::|CocosDenshion::)/) return "engine"
      if (subject ~ /^(std::|__cxxabiv1::|__gnu_cxx::|__cxa_|__aeabi_|__gnu_|_Unwind_|operator new|operator delete)/) return "compiler-runtime"
      if (subject ~ /^(pthread_|memcpy$|memmove$|memset$|memcmp$|strlen$|strcmp$|strncmp$|strcpy$|strncpy$|strchr$|strrchr$|strstr$|malloc$|calloc$|realloc$|free$|atoi$|atol$|strtol$|strtoul$|printf$|sprintf$|snprintf$|vsnprintf$|qsort$|bsearch$|abort$|exit$)/) return "compiler-runtime"
      if (subject ~ /^(AES_|ASN1_|BIO_|BN_|CRYPTO_|EVP_|SSL_|X509_|png_|FT_|inflate|deflate|curl_)/) return "vendor"
      return "unknown"
    }
    function classify_subsystem(name) {
      if (name ~ /(ScoreManager|ComboManager|TimeManager|FruitFailManager)/) return "scoring"
      if (name ~ /(PhysicsLayer|PhysicsBladeLayer|RayCast|Blade|^b2)/) return "physics"
      if (name ~ /(Fruit|Bomb)/) return "entities"
      if (name ~ /(Toss|ModeSelectLayer|BaseGameplayLayer|ClassicModeLayer|CrazyModeLayer|BaseBirdLayer|ClassicBirdLayer|CrazyBirdLayer|ComboBirdLayer|GNStyleLayer)/) return "gameplay"
      if (name ~ /(Settings|Objective)/) return "progression"
      if (name ~ /(Audio|Sound|CocosDenshion)/) return "audio"
      if (name ~ /(Layer|Scene|Menu|Sprite)/) return "presentation"
      if (name ~ /(JNI|Java_|AppDelegate)/) return "platform"
      return "unclassified"
    }
    BEGIN {
      print "raw_address,instruction_address,thumb,size_bytes,mangled_symbol,demangled_symbol,ownership,subsystem,confidence,evidence_ids"
    }
    {
      ownership=classify_ownership($6)
      subsystem=classify_subsystem($6)
      confidence=(ownership == "unknown" ? "0.50" : "0.95")
      if (ownership == "app") confidence="0.99"
      print csv($1) "," csv($2) "," csv($3) "," csv($4) "," csv($5) "," csv($6) "," csv(ownership) "," csv(subsystem) "," csv(confidence) "," csv("DER-NATIVE-001;DER-NATIVE-CORPUS-001")
    }
  ' > "$inventory_csv"

  awk 'NR == 1 || /,"app",/' "$inventory_csv" > "$app_inventory_csv"
}

generate_disassembly_samples() {
  samples_tsv="$OUTPUT_DIR/disassembly/samples.tsv"
  gnu_samples="$OUTPUT_DIR/disassembly/gnu-thumb-samples.txt"
  llvm_samples="$OUTPUT_DIR/disassembly/llvm-thumb-samples.txt"
  printf 'raw_address\tinstruction_address\tthumb\tsize_bytes\tmangled_symbol\tdemangled_symbol\n' > "$samples_tsv"
  : > "$gnu_samples"
  : > "$llvm_samples"

  for sample_symbol in \
    JNI_OnLoad \
    _ZN12ScoreManager8AddScoreEi \
    _ZN17PhysicsBladeLayer12RayCastWorldEP5BladeN7cocos2d7CCPointES3_ \
    _ZN15ModeSelectLayer15classicCallbackEPN7cocos2d8CCObjectE
  do
    sample_line=$(awk -F '\t' -v wanted="$sample_symbol" '$5 == wanted {print; exit}' "$OUTPUT_DIR/symbols/functions-raw.tsv")
    [ -n "$sample_line" ] || die "representative function missing from dynamic symbols: $sample_symbol"
    sample_raw=$(printf '%s\n' "$sample_line" | cut -f1)
    sample_start=$(printf '%s\n' "$sample_line" | cut -f2)
    sample_thumb=$(printf '%s\n' "$sample_line" | cut -f3)
    sample_size=$(printf '%s\n' "$sample_line" | cut -f4)
    sample_demangled=$("$LLVM_CXXFILT" --no-strip-underscore "$sample_symbol")
    sample_stop=$(hex_stop_address "$sample_start" "$sample_size")

    printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$sample_raw" "$sample_start" "$sample_thumb" "$sample_size" "$sample_symbol" "$sample_demangled" >> "$samples_tsv"
    {
      printf '\n===== %s raw=%s range=%s..%s thumb=%s =====\n' "$sample_demangled" "$sample_raw" "$sample_start" "$sample_stop" "$sample_thumb"
      "$GNU_OBJDUMP" -d -C --start-address="$sample_start" --stop-address="$sample_stop" "$INPUT_LIB"
    } >> "$gnu_samples"
    {
      printf '\n===== %s raw=%s range=%s..%s thumb=%s triple=%s =====\n' "$sample_demangled" "$sample_raw" "$sample_start" "$sample_stop" "$sample_thumb" "$LLVM_THUMB_TRIPLE"
      "$LLVM_OBJDUMP" -d -C --triple="$LLVM_THUMB_TRIPLE" --start-address="$sample_start" --stop-address="$sample_stop" "$INPUT_LIB"
    } >> "$llvm_samples"
  done
}

analyze() {
  INPUT_LIB=$1
  requested_output=$2
  [ -f "$INPUT_LIB" ] || die "native input not found: $INPUT_LIB"
  [ ! -L "$INPUT_LIB" ] || die "native input must not be a symlink: $INPUT_LIB"
  prepare_output_dir "$requested_output"

  input_hash=$(sha256_file "$INPUT_LIB")
  input_bytes=$(wc -c < "$INPUT_LIB" | tr -d '[:space:]')
  [ "$input_hash" = "$EXPECTED_SHA256" ] || die "native SHA-256 mismatch: actual=$input_hash expected=$EXPECTED_SHA256"
  [ "$input_bytes" = "$EXPECTED_BYTES" ] || die "native byte-size mismatch: actual=$input_bytes expected=$EXPECTED_BYTES"

  GNU_READELF=$(resolve_gnu_tool readelf "${GNU_READELF_BIN:-}" arm-linux-androideabi-readelf)
  GNU_OBJDUMP=$(resolve_gnu_tool objdump "${GNU_OBJDUMP_BIN:-}" arm-linux-androideabi-objdump)
  LLVM_READOBJ=$(resolve_llvm_tool llvm-readobj "${LLVM_READOBJ_BIN:-}")
  LLVM_OBJDUMP=$(resolve_llvm_tool llvm-objdump "${LLVM_OBJDUMP_BIN:-}")
  LLVM_NM=$(resolve_llvm_tool llvm-nm "${LLVM_NM_BIN:-}")
  LLVM_CXXFILT=$(resolve_llvm_tool llvm-cxxfilt "${LLVM_CXXFILT_BIN:-}")
  STRINGS=$(resolve_regular_tool strings "${STRINGS_BIN:-}")
  NODE_JS=$(resolve_regular_tool node "${NODE_BIN:-}")
  validate_toolchain
  strings_hash=$(sha256_file "$STRINGS")

  input_header=$("$GNU_READELF" -h "$INPUT_LIB")
  printf '%s\n' "$input_header" | grep -F 'Class:                             ELF32' >/dev/null || die "native input is not ELF32"
  printf '%s\n' "$input_header" | grep -F 'Data:                              2' >/dev/null || die "native input is not little-endian ELF"
  printf '%s\n' "$input_header" | grep -F 'Machine:                           ARM' >/dev/null || die "native input is not ARM"

  mkdir -p "$OUTPUT_DIR/gnu" "$OUTPUT_DIR/llvm" "$OUTPUT_DIR/symbols" "$OUTPUT_DIR/strings" "$OUTPUT_DIR/disassembly"

  {
    printf 'evidence_id=DER-NATIVE-001\n'
    printf 'sha256=%s\n' "$input_hash"
    printf 'bytes=%s\n' "$input_bytes"
    printf 'image_base=0x00000000\n'
    printf 'elf_profile=ELF32 little-endian ARM EABI5\n'
    printf 'cpu_profile=ARMv5TE Thumb-1\n'
    printf 'llvm_disassembly_triple=%s\n' "$LLVM_THUMB_TRIPLE"
  } > "$OUTPUT_DIR/input.txt"

  {
    printf 'analyzer-script=3\n'
    printf 'gnu-readelf=%s | %s\n' "$GNU_READELF" "$(first_version_line "$GNU_READELF")"
    printf 'gnu-objdump=%s | %s\n' "$GNU_OBJDUMP" "$(first_version_line "$GNU_OBJDUMP")"
    printf 'llvm-readobj=%s | %s\n' "$LLVM_READOBJ" "$(first_version_line "$LLVM_READOBJ")"
    printf 'llvm-objdump=%s | %s\n' "$LLVM_OBJDUMP" "$(first_version_line "$LLVM_OBJDUMP")"
    printf 'llvm-nm=%s | %s\n' "$LLVM_NM" "$(first_version_line "$LLVM_NM")"
    printf 'llvm-cxxfilt=%s | %s\n' "$LLVM_CXXFILT" "$(first_version_line "$LLVM_CXXFILT")"
    printf 'strings=%s | version=unavailable | executable-sha256=%s\n' "$STRINGS" "$strings_hash"
    printf 'node=%s | %s\n' "$NODE_JS" "$("$NODE_JS" --version)"
  } > "$OUTPUT_DIR/tool-versions.txt"

  {
    printf 'All input/output paths are passed as quoted arguments.\n'
    printf 'gnu-readelf -h|-lW|-SW|-A|-dW|-rW|--dyn-syms -W <lib>\n'
    printf 'llvm-readobj --file-headers|--program-headers|--sections|--dynamic-table|--relocations|--dyn-symbols|--needed-libs <lib>\n'
    printf 'llvm-nm --dynamic [--demangle|--undefined-only] <lib>\n'
    printf 'llvm-cxxfilt --no-strip-underscore <mangled-symbol> [...]\n'
    printf 'strings -a -t x <lib>\n'
    printf 'gnu-objdump -d -C --start-address=<normalized> --stop-address=<normalized+size> <lib>\n'
    printf 'llvm-objdump -d -C --triple=%s --start-address=<normalized> --stop-address=<normalized+size> <lib>\n' "$LLVM_THUMB_TRIPLE"
    printf 'gnu-objdump -d -C <lib> > disassembly/gnu-full.txt\n'
    printf 'node enrich-native-function-map.mjs <base.csv> <gnu-full.txt> <strings.txt> <lib> <program-headers.txt> <sections.txt> <output.csv> <summary.json>\n'
  } > "$OUTPUT_DIR/commands.txt"

  printf '%s\n' "$input_header" > "$OUTPUT_DIR/gnu/elf-header.txt"
  "$GNU_READELF" -lW "$INPUT_LIB" > "$OUTPUT_DIR/gnu/program-headers.txt"
  "$GNU_READELF" -SW "$INPUT_LIB" > "$OUTPUT_DIR/gnu/sections.txt"
  "$GNU_READELF" -A "$INPUT_LIB" > "$OUTPUT_DIR/gnu/attributes.txt"
  "$GNU_READELF" -dW "$INPUT_LIB" > "$OUTPUT_DIR/gnu/dynamic.txt"
  "$GNU_READELF" -rW "$INPUT_LIB" > "$OUTPUT_DIR/gnu/relocations.txt"
  "$GNU_READELF" --dyn-syms -W "$INPUT_LIB" > "$OUTPUT_DIR/gnu/dynamic-symbols.txt"

  "$LLVM_READOBJ" --file-headers "$INPUT_LIB" > "$OUTPUT_DIR/llvm/file-header.txt"
  "$LLVM_READOBJ" --program-headers "$INPUT_LIB" > "$OUTPUT_DIR/llvm/program-headers.txt"
  "$LLVM_READOBJ" --sections "$INPUT_LIB" > "$OUTPUT_DIR/llvm/sections.txt"
  "$LLVM_READOBJ" --dynamic-table "$INPUT_LIB" > "$OUTPUT_DIR/llvm/dynamic-table.txt"
  "$LLVM_READOBJ" --relocations "$INPUT_LIB" > "$OUTPUT_DIR/llvm/relocations.txt"
  "$LLVM_READOBJ" --dyn-symbols "$INPUT_LIB" > "$OUTPUT_DIR/llvm/dynamic-symbols.txt"
  "$LLVM_READOBJ" --needed-libs "$INPUT_LIB" > "$OUTPUT_DIR/llvm/needed-libraries.txt"

  "$LLVM_NM" --dynamic "$INPUT_LIB" > "$OUTPUT_DIR/symbols/dynamic-raw.txt"
  "$LLVM_NM" --dynamic --demangle "$INPUT_LIB" > "$OUTPUT_DIR/symbols/dynamic-demangled.txt"
  "$LLVM_NM" --dynamic --undefined-only "$INPUT_LIB" > "$OUTPUT_DIR/symbols/imports-raw.txt"
  "$LLVM_NM" --dynamic --undefined-only --demangle "$INPUT_LIB" > "$OUTPUT_DIR/symbols/imports-demangled.txt"
  generate_function_inventory

  "$STRINGS" -a -t x "$INPUT_LIB" > "$OUTPUT_DIR/strings/all-offsets.txt"
  awk '{lower=tolower($0); if (index(lower,"assets/") || index(lower,"res/") || lower ~ /\.(png|jpg|jpeg|wav|mp3|ogg|ttf|otf|plist|json|xml|tmx|ccbi|lua|js|csv)([^a-z0-9]|$)/) print}' \
    "$OUTPUT_DIR/strings/all-offsets.txt" > "$OUTPUT_DIR/resource-looking-strings.txt"

  generate_disassembly_samples
  "$GNU_OBJDUMP" -d -C "$INPUT_LIB" > "$OUTPUT_DIR/disassembly/gnu-full.txt"
  "$NODE_JS" "$SCRIPT_DIR/enrich-native-function-map.mjs" \
    "$OUTPUT_DIR/app-function-base.csv" \
    "$OUTPUT_DIR/disassembly/gnu-full.txt" \
    "$OUTPUT_DIR/strings/all-offsets.txt" \
    "$INPUT_LIB" \
    "$OUTPUT_DIR/gnu/program-headers.txt" \
    "$OUTPUT_DIR/gnu/sections.txt" \
    "$OUTPUT_DIR/app-function-inventory.csv" \
    "$OUTPUT_DIR/function-enrichment-summary.json"

  named_symbols=$(wc -l < "$OUTPUT_DIR/symbols/dynamic-raw.txt" | tr -d '[:space:]')
  defined_symbols=$("$LLVM_NM" --dynamic --defined-only "$INPUT_LIB" | wc -l | tr -d '[:space:]')
  imports=$(wc -l < "$OUTPUT_DIR/symbols/imports-raw.txt" | tr -d '[:space:]')
  functions=$(awk 'END {print NR-1}' "$OUTPUT_DIR/function-inventory.csv")
  app_functions=$(awk 'END {print NR-1}' "$OUTPUT_DIR/app-function-inventory.csv")
  resource_strings=$(wc -l < "$OUTPUT_DIR/resource-looking-strings.txt" | tr -d '[:space:]')
  {
    printf 'named_dynamic_symbols=%s\n' "$named_symbols"
    printf 'defined_dynamic_symbols=%s\n' "$defined_symbols"
    printf 'undefined_imports=%s\n' "$imports"
    printf 'defined_dynamic_functions=%s\n' "$functions"
    printf 'application_functions=%s\n' "$app_functions"
    printf 'resource_looking_strings=%s\n' "$resource_strings"
    printf 'independent_disassembly_views=2\n'
  } > "$OUTPUT_DIR/summary.txt"

  input_hash_after=$(sha256_file "$INPUT_LIB")
  [ "$input_hash_after" = "$input_hash" ] || die "native input changed during static analysis"
  {
    printf '%s  SOURCE_NATIVE:%s\n' "$input_hash" "$(basename "$INPUT_LIB")"
    (
      cd "$OUTPUT_DIR"
      find . -type f ! -name checksums.sha256 -print | sort | while IFS= read -r derived_file; do
        printf '%s  %s\n' "$(sha256_file "$derived_file")" "$derived_file"
      done
    )
  } > "$OUTPUT_DIR/checksums.sha256"

  printf 'RESULT: PASS static analysis written to %s\n' "$OUTPUT_DIR"
  printf 'SOURCE SHA-256: %s\n' "$input_hash_after"
  printf 'SYMBOLS: named=%s defined=%s imports=%s functions=%s\n' "$named_symbols" "$defined_symbols" "$imports" "$functions"
}

[ "$#" -eq 2 ] || { usage >&2; exit 2; }
analyze "$1" "$2"

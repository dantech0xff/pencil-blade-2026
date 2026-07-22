#!/bin/sh

set -eu
LC_ALL=C
export LC_ALL

EXPECTED_SHA256="95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa"
EXPECTED_APK_BYTES="35817225"
EXPECTED_ENTRY_COUNT="985"
EXPECTED_UNCOMPRESSED_BYTES="41007977"
EXPECTED_CERT_SHA256="df25b2f6affd78490bfb175a8b7fbdfd706f0024be5cc0495d988b4729941960"

TEMP_DIR=""
FAILURES=0

usage() {
  cat <<'EOF'
Usage:
  scripts/inventory-apk.sh verify <apk>
  scripts/inventory-apk.sh extract <apk> <empty-work-dir>

Optional tool overrides:
  AAPT_BIN, APKANALYZER_BIN, APKSIGNER_BIN, READELF_BIN, LLVM_NM_BIN,
  JADX_BIN, STRINGS_BIN

The script never modifies, signs, installs, or executes the APK. Extract mode writes only
to the supplied empty working directory.
EOF
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ] && [ "$TEMP_DIR" != "/" ]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup EXIT HUP INT TERM

command_path() {
  command -v "$1" 2>/dev/null || return 1
}

resolve_override_path() {
  override_path="$1"
  error_message="$2"
  if [ -n "$override_path" ]; then
    [ -x "$override_path" ] || die "$error_message"
    printf '%s\n' "$override_path"
    return 0
  fi
  return 1
}

latest_matching_path() {
  find "$@" 2>/dev/null | sort | tail -n 1
}

create_temp_dir() {
  temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/$1.XXXXXX")
  [ -n "$temp_dir" ] && [ "$temp_dir" != "/" ] || die "failed to create a safe temporary directory"
  printf '%s\n' "$temp_dir"
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
  user_home="${HOME:-}"
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

resolve_build_tool() {
  tool_name="$1"
  override_path="$2"
  if resolve_override_path "$override_path" "$tool_name override is not executable: $override_path"; then
    return 0
  fi
  if found_path=$(command_path "$tool_name"); then
    printf '%s\n' "$found_path"
    return 0
  fi
  if sdk_root=$(android_sdk_root); then
    found_path=$(latest_matching_path "$sdk_root/build-tools" -type f -name "$tool_name" -perm -111 -print)
    if [ -n "$found_path" ]; then
      printf '%s\n' "$found_path"
      return 0
    fi
  fi
  die "$tool_name not found; set its *_BIN override or ANDROID_SDK_ROOT"
}

resolve_apkanalyzer() {
  override_path="${APKANALYZER_BIN:-}"
  if resolve_override_path "$override_path" "apkanalyzer override is not executable: $override_path"; then
    return 0
  fi
  if found_path=$(command_path apkanalyzer); then
    printf '%s\n' "$found_path"
    return 0
  fi
  if sdk_root=$(android_sdk_root); then
    if [ -x "$sdk_root/cmdline-tools/latest/bin/apkanalyzer" ]; then
      printf '%s\n' "$sdk_root/cmdline-tools/latest/bin/apkanalyzer"
      return 0
    fi
    found_path=$(latest_matching_path "$sdk_root/cmdline-tools" -type f -path '*/bin/apkanalyzer' -perm -111 -print)
    if [ -n "$found_path" ]; then
      printf '%s\n' "$found_path"
      return 0
    fi
  fi
  die "apkanalyzer not found; set APKANALYZER_BIN or ANDROID_SDK_ROOT"
}

resolve_readelf() {
  override_path="${READELF_BIN:-}"
  if resolve_override_path "$override_path" "readelf override is not executable: $override_path"; then
    return 0
  fi
  if found_path=$(command_path readelf); then
    printf '%s\n' "$found_path"
    return 0
  fi
  if sdk_root=$(android_sdk_root); then
    found_path=$(latest_matching_path "$sdk_root/ndk" -type f -path '*arm-linux-androideabi*/bin/readelf' -perm -111 -print)
    if [ -n "$found_path" ]; then
      printf '%s\n' "$found_path"
      return 0
    fi
  fi
  die "GNU readelf with ARM attribute support not found; set READELF_BIN"
}

resolve_llvm_nm() {
  override_path="${LLVM_NM_BIN:-}"
  if resolve_override_path "$override_path" "llvm-nm override is not executable: $override_path"; then
    return 0
  fi
  if found_path=$(command_path llvm-nm); then
    printf '%s\n' "$found_path"
    return 0
  fi
  if sdk_root=$(android_sdk_root); then
    found_path=$(latest_matching_path "$sdk_root/ndk" -type f -name llvm-nm -perm -111 -print)
    if [ -n "$found_path" ]; then
      printf '%s\n' "$found_path"
      return 0
    fi
  fi
  die "llvm-nm not found; set LLVM_NM_BIN"
}

resolve_regular_tool() {
  tool_name="$1"
  override_path="$2"
  if resolve_override_path "$override_path" "$tool_name override is not executable: $override_path"; then
    return 0
  fi
  command_path "$tool_name" || die "$tool_name not found on PATH"
}

sha256_file() {
  target_path="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$target_path" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$target_path" | awk '{print $1}'
  else
    die "neither shasum nor sha256sum is available"
  fi
}

check_equal() {
  label="$1"
  actual="$2"
  expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf 'PASS %-28s %s\n' "$label" "$actual"
  else
    printf 'FAIL %-28s actual=%s expected=%s\n' "$label" "$actual" "$expected" >&2
    FAILURES=$((FAILURES + 1))
  fi
}

check_contains() {
  label="$1"
  content="$2"
  expected="$3"
  case "$content" in
    *"$expected"*) printf 'PASS %-28s %s\n' "$label" "$expected" ;;
    *)
      printf 'FAIL %-28s missing=%s\n' "$label" "$expected" >&2
      FAILURES=$((FAILURES + 1))
      ;;
  esac
}

check_manifest_tag_count() {
  label="$1"
  content="$2"
  tag_name="$3"
  expected="$4"
  actual=$(printf '%s\n' "$content" | awk -v tag_name="$tag_name" 'index($0, "<" tag_name) {count++} END {print count+0}')
  check_equal "$label" "$actual" "$expected"
}

resolve_verification_tools() {
  command -v unzip >/dev/null 2>&1 || die "unzip not found on PATH"
  AAPT=$(resolve_build_tool aapt "${AAPT_BIN:-}")
  APKANALYZER=$(resolve_apkanalyzer)
  APKSIGNER=$(resolve_build_tool apksigner "${APKSIGNER_BIN:-}")
  READELF=$(resolve_readelf)
  STRINGS=$(resolve_regular_tool strings "${STRINGS_BIN:-}")
}

verify_apk() {
  apk_path="$1"
  [ -f "$apk_path" ] || die "APK not found: $apk_path"

  resolve_verification_tools

  if [ -z "$TEMP_DIR" ]; then
    TEMP_DIR=$(create_temp_dir pencil-blade-inventory)
  fi
  [ -n "$TEMP_DIR" ] && [ "$TEMP_DIR" != "/" ] || die "failed to create a safe temporary directory"
  native_path="$TEMP_DIR/libgame.so"

  printf 'Pencil Blade APK baseline verification\n'
  printf 'apk=%s\n' "$apk_path"

  apk_hash=$(sha256_file "$apk_path")
  apk_bytes=$(wc -c < "$apk_path" | tr -d '[:space:]')
  check_equal "apk_sha256" "$apk_hash" "$EXPECTED_SHA256"
  check_equal "apk_bytes" "$apk_bytes" "$EXPECTED_APK_BYTES"

  if unzip -tqq "$apk_path" >/dev/null; then
    printf 'PASS %-28s %s\n' "zip_integrity" "no errors"
  else
    printf 'FAIL %-28s %s\n' "zip_integrity" "unzip reported an error" >&2
    FAILURES=$((FAILURES + 1))
  fi

  entry_list=$(unzip -Z1 "$apk_path")
  entry_count=$(printf '%s\n' "$entry_list" | awk 'END {print NR}')
  file_count=$(printf '%s\n' "$entry_list" | awk 'substr($0, length($0), 1) != "/" {count++} END {print count+0}')
  directory_count=$(printf '%s\n' "$entry_list" | awk 'substr($0, length($0), 1) == "/" {count++} END {print count+0}')
  uncompressed_bytes=$(unzip -l "$apk_path" | awk '$NF == "files" {value=$1} END {print value}')
  check_equal "zip_entries" "$entry_count" "$EXPECTED_ENTRY_COUNT"
  check_equal "zip_files" "$file_count" "$EXPECTED_ENTRY_COUNT"
  check_equal "zip_directories" "$directory_count" "0"
  check_equal "zip_uncompressed_bytes" "$uncompressed_bytes" "$EXPECTED_UNCOMPRESSED_BYTES"

  counts=$(printf '%s\n' "$entry_list" | awk '
    {
      path=tolower($0)
      if (path ~ /^assets\/.*\.png$/) assets_png++
      if (path ~ /^res\/.*\.png$/) res_png++
      if (path ~ /^assets\/.*\.wav$/) wav++
      if (path ~ /^assets\/.*\.mp3$/) mp3++
      if (path ~ /^assets\/.*\.ttf$/) ttf++
      if (path ~ /^assets\/.*\.otf$/) otf++
      if (path ~ /^assets\/480x800\//) low++
      if (path ~ /^assets\/720x1280\//) high++
      if (path ~ /^assets\/.*\.(plist|json|xml|tmx|ccbi|lua|js|csv)$/) config++
      if (path ~ /^lib\/.*\.so$/) native++
    }
    END {
      printf "%d %d %d %d %d %d %d %d %d %d", assets_png, res_png, wav, mp3, ttf, otf, low, high, config, native
    }')
  set -- $counts
  check_equal "assets_png" "$1" "784"
  check_equal "res_png" "$2" "107"
  check_equal "assets_wav" "$3" "59"
  check_equal "assets_mp3" "$4" "3"
  check_equal "assets_ttf" "$5" "15"
  check_equal "assets_otf" "$6" "1"
  check_equal "assets_480x800_files" "$7" "392"
  check_equal "assets_720x1280_files" "$8" "392"
  check_equal "asset_level_config_files" "$9" "0"
  check_equal "native_library_count" "${10}" "1"
  check_contains "native_library_path" "$entry_list" "lib/armeabi/libgame.so"

  badging=$("$AAPT" dump badging "$apk_path")
  manifest=$("$APKANALYZER" manifest print "$apk_path")
  debuggable=$("$APKANALYZER" manifest debuggable "$apk_path")
  check_contains "package_and_version" "$badging" "package: name='uit.dev.pencilblade' versionCode='6' versionName='1.5'"
  check_contains "minimum_sdk" "$badging" "sdkVersion:'9'"
  check_contains "target_sdk" "$badging" "targetSdkVersion:'19'"
  check_contains "internet_permission" "$badging" "android.permission.INTERNET"
  check_contains "network_permission" "$badging" "android.permission.ACCESS_NETWORK_STATE"
  check_contains "launcher_activity" "$badging" "uit.dev.pencilblade.PencilBlade"
  check_contains "portrait_feature" "$badging" "android.hardware.screen.portrait"
  check_contains "opengl_es" "$badging" "uses-gl-es: '0x20000'"
  check_contains "native_abi" "$badging" "native-code: 'armeabi'"
  check_contains "ads_activity" "$manifest" "com.google.android.gms.ads.AdActivity"
  check_contains "portrait_orientation" "$manifest" "android:screenOrientation=\"1\""
  check_manifest_tag_count "uses_permission_count" "$manifest" "uses-permission" "2"
  check_manifest_tag_count "activity_count" "$manifest" "activity" "2"
  check_equal "debuggable" "$debuggable" "false"
  declared_components=$(printf '%s\n' "$manifest" | awk '/<(service|receiver|provider)([ >])/ {count++} END {print count+0}')
  check_equal "services_receivers_providers" "$declared_components" "0"

  signing=$("$APKSIGNER" verify --verbose --print-certs "$apk_path")
  check_contains "signature_v1" "$signing" "Verified using v1 scheme (JAR signing): true"
  check_contains "signature_v2_absent" "$signing" "Verified using v2 scheme (APK Signature Scheme v2): false"
  check_contains "certificate_sha256" "$signing" "$EXPECTED_CERT_SHA256"

  unzip -p "$apk_path" lib/armeabi/libgame.so > "$native_path"
  native_header=$("$READELF" -h "$native_path")
  native_attributes=$("$READELF" -A "$native_path")
  check_contains "elf_class" "$native_header" "ELF32"
  check_contains "elf_endianness" "$native_header" "little endian"
  check_contains "elf_machine" "$native_header" "Machine:                           ARM"
  check_contains "elf_type" "$native_header" "DYN (Shared object file)"
  check_contains "elf_eabi" "$native_header" "Version5 EABI"
  check_contains "elf_cpu" "$native_attributes" "Tag_CPU_name: \"5TE\""
  check_contains "elf_arch" "$native_attributes" "Tag_CPU_arch: v5TE"
  native_strings=$("$STRINGS" -a "$native_path")
  check_contains "engine_fingerprint" "$native_strings" "Cocos2d-X/cocos2d-x-2.1.4/PencilBlade"

  if [ "$FAILURES" -ne 0 ]; then
    printf 'RESULT: FAIL (%s baseline mismatch(es))\n' "$FAILURES" >&2
    return 1
  fi
  printf 'RESULT: PASS (all baseline assertions matched)\n'
}

record_versions() {
  output_path="$1"
  {
    printf 'inventory-script=2\n'
    printf 'unzip=%s\n' "$(unzip -v | sed -n '1p')"
    if command -v shasum >/dev/null 2>&1; then printf 'shasum=%s\n' "$(shasum -v)"; fi
    printf 'aapt=%s | %s\n' "$AAPT" "$("$AAPT" version 2>&1 | sed -n '1p')"
    printf 'apkanalyzer=%s | version-not-reported-by-cli\n' "$APKANALYZER"
    printf 'apksigner=%s | %s\n' "$APKSIGNER" "$("$APKSIGNER" version 2>&1 | sed -n '1p')"
    printf 'readelf=%s | %s\n' "$READELF" "$("$READELF" --version 2>&1 | sed -n '1p')"
    printf 'llvm-nm=%s | %s\n' "$LLVM_NM" "$("$LLVM_NM" --version 2>&1 | sed -n '1p')"
    printf 'strings=%s\n' "$STRINGS"
    printf 'jadx=%s | %s\n' "$JADX" "$("$JADX" --version 2>&1 | sed -n '1p')"
    if command -v java >/dev/null 2>&1; then printf 'java=%s\n' "$(java -version 2>&1 | sed -n '1p')"; fi
  } > "$output_path"
}

extract_evidence() {
  apk_path="$1"
  work_dir="$2"
  [ -n "$work_dir" ] || die "work directory is required"
  [ "$work_dir" != "/" ] && [ "$work_dir" != "." ] || die "refusing unsafe work directory: $work_dir"
  if [ -d "$work_dir" ] && [ -n "$(find "$work_dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
    die "work directory must be empty: $work_dir"
  fi

  TEMP_DIR=$(create_temp_dir pencil-blade-extract)
  verify_apk "$apk_path" > "$TEMP_DIR/verified-inventory.txt"

  LLVM_NM=$(resolve_llvm_nm)
  JADX=$(resolve_regular_tool jadx "${JADX_BIN:-}")

  mkdir -p "$work_dir/archive" "$work_dir/manifest" "$work_dir/resources"
  mkdir -p "$work_dir/jadx" "$work_dir/java/app-owned" "$work_dir/native" "$work_dir/signing"
  cp "$TEMP_DIR/verified-inventory.txt" "$work_dir/inventory.txt"
  record_versions "$work_dir/tool-versions.txt"

  {
    printf 'Source APK SHA-256: %s\n' "$EXPECTED_SHA256"
    printf 'All paths below were passed as quoted arguments.\n'
    printf 'unzip -Z1 <apk> > archive/entries.txt\n'
    printf 'unzip -lv <apk> > archive/members.txt\n'
    printf 'aapt dump badging <apk> > manifest/aapt-badging.txt\n'
    printf 'aapt dump xmltree <apk> AndroidManifest.xml > manifest/aapt-xmltree.txt\n'
    printf 'aapt dump resources <apk> > resources/aapt-resources.txt\n'
    printf 'apkanalyzer manifest print <apk> > manifest/apkanalyzer.xml\n'
    printf 'jadx --output-dir jadx <apk>\n'
    printf 'unzip -p <apk> lib/armeabi/libgame.so > native/libgame.so\n'
    printf 'readelf -h|-A|-S|-d|--dyn-syms native/libgame.so\n'
    printf 'llvm-nm --dynamic --demangle native/libgame.so\n'
    printf 'strings -a native/libgame.so\n'
  } > "$work_dir/commands.txt"

  unzip -Z1 "$apk_path" > "$work_dir/archive/entries.txt"
  unzip -lv "$apk_path" > "$work_dir/archive/members.txt"
  "$AAPT" dump badging "$apk_path" > "$work_dir/manifest/aapt-badging.txt"
  "$AAPT" dump xmltree "$apk_path" AndroidManifest.xml > "$work_dir/manifest/aapt-xmltree.txt"
  "$AAPT" dump resources "$apk_path" > "$work_dir/resources/aapt-resources.txt"
  "$APKANALYZER" manifest print "$apk_path" > "$work_dir/manifest/apkanalyzer.xml"
  "$APKSIGNER" verify --verbose --print-certs "$apk_path" > "$work_dir/signing/apksigner.txt"
  if command -v jarsigner >/dev/null 2>&1; then
    jarsigner -verify -strict "$apk_path" > "$work_dir/signing/jarsigner-policy.txt" 2>&1 || true
  fi

  "$JADX" --output-dir "$work_dir/jadx" "$apk_path"
  app_java="$work_dir/jadx/sources/uit/dev/pencilblade"
  [ -d "$app_java" ] || die "JADX did not produce the expected app-owned Java package: $app_java"
  cp -R "$app_java/." "$work_dir/java/app-owned/"

  native_path="$work_dir/native/libgame.so"
  unzip -p "$apk_path" lib/armeabi/libgame.so > "$native_path"
  "$READELF" -h "$native_path" > "$work_dir/native/elf-header.txt"
  "$READELF" -A "$native_path" > "$work_dir/native/elf-attributes.txt"
  "$READELF" -S -W "$native_path" > "$work_dir/native/elf-sections.txt"
  "$READELF" -d -W "$native_path" > "$work_dir/native/elf-dynamic.txt"
  "$READELF" --dyn-syms -W "$native_path" > "$work_dir/native/dynamic-symbols.txt"
  awk '$7 == "UND"' "$work_dir/native/dynamic-symbols.txt" > "$work_dir/native/imports.txt"
  "$LLVM_NM" --dynamic --demangle "$native_path" > "$work_dir/native/dynamic-nm.txt"
  "$STRINGS" -a "$native_path" > "$work_dir/native/strings.txt"

  source_hash=$(sha256_file "$apk_path")
  source_label=$(basename "$apk_path")
  {
    printf '%s  SOURCE_APK:%s\n' "$source_hash" "$source_label"
    (
      cd "$work_dir"
      find . -type f ! -name checksums.sha256 -print | sort | while IFS= read -r derived_file; do
        derived_hash=$(sha256_file "$derived_file")
        printf '%s  %s\n' "$derived_hash" "$derived_file"
      done
    )
  } > "$work_dir/checksums.sha256"

  printf 'Evidence extracted to %s\n' "$work_dir"
  printf 'Source SHA-256: %s\n' "$source_hash"
  printf 'Derived manifest: %s\n' "$work_dir/checksums.sha256"
}

MODE="${1:-}"
case "$MODE" in
  verify)
    [ "$#" -eq 2 ] || { usage >&2; exit 2; }
    verify_apk "$2"
    ;;
  extract)
    [ "$#" -eq 3 ] || { usage >&2; exit 2; }
    extract_evidence "$2" "$3"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

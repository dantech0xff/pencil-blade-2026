#!/bin/sh

set -eu
LC_ALL=C
export LC_ALL

EXPECTED_CREATOR_VERSION="3.8.8"
EXPECTED_SCENE_UUID="35e5417d-c3dd-4522-9339-99c81a0b9b4b"
EXPECTED_PACKAGE_ID="io.github.dantech0xff.pencilblade.debug"
EXPECTED_MIN_SDK="21"
EXPECTED_TARGET_SDK="36"
EXPECTED_COMPILE_SDK="36"
EXPECTED_BUILD_TOOLS="36.0.0"
EXPECTED_NDK="28.2.13676358"
EXPECTED_CMAKE="3.22.1"
EXPECTED_GRADLE="8.11.1"
EXPECTED_AGP="8.10.1"
EXPECTED_ABI="arm64-v8a"
EXPECTED_JDK_MAJOR="17"
EXPECTED_JDK_VERSION="17.0.15"
EXPECTED_JDK_VENDOR="Azul Zulu"
DEFAULT_CREATOR_BIN="/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"

BUILD_MARKER=""
RUNTIME_CONFIG=""
STAGED_ARTIFACT=""
STAGED_HASH=""

cleanup() {
  if [ -n "$RUNTIME_CONFIG" ] &&
    { [ -e "$RUNTIME_CONFIG" ] || [ -L "$RUNTIME_CONFIG" ]; }; then
    rm -f "$RUNTIME_CONFIG"
  fi
  if [ -n "$BUILD_MARKER" ] && [ -f "$BUILD_MARKER" ]; then
    rm -f "$BUILD_MARKER"
  fi
  if [ -n "$STAGED_ARTIFACT" ] && [ -f "$STAGED_ARTIFACT" ]; then
    rm -f "$STAGED_ARTIFACT"
  fi
  if [ -n "$STAGED_HASH" ] && [ -f "$STAGED_HASH" ]; then
    rm -f "$STAGED_HASH"
  fi
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

canonical_dir() {
  requested_dir=$1
  [ -d "$requested_dir" ] || return 1
  (CDPATH= cd "$requested_dir" && pwd -P)
}

property_value() {
  property_file=$1
  property_name=$2
  awk -F= -v property_name="$property_name" '
    {
      key=$1
      sub(/^[[:space:]]+/, "", key)
      sub(/[[:space:]]+$/, "", key)
    }
    key == property_name {
      value=substr($0, index($0, "=") + 1)
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      print value
      found=1
      exit
    }
    END {
      if (!found) {
        exit 1
      }
    }
  ' "$property_file"
}

require_property() {
  property_file=$1
  property_name=$2
  expected_value=$3
  actual_value=$(property_value "$property_file" "$property_name") ||
    die "generated Gradle property is missing: $property_name"
  [ "$actual_value" = "$expected_value" ] ||
    die "generated Gradle property $property_name is '$actual_value', expected '$expected_value'"
}

profile_value() {
  profile_path=$1
  profile_key=$2
  "$NODE_BIN" - "$profile_path" "$profile_key" <<'NODE'
const fs = require('node:fs');
const [profilePath, profileKey] = process.argv.slice(2);
let profile;
try {
  profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
} catch (error) {
  console.error(`invalid Creator program profile: ${error.message}`);
  process.exit(1);
}
const keyMap = {
  android_sdk: ['android_sdk', 'androidSDK'],
  android_ndk: ['android_ndk', 'androidNDK'],
  java_home: ['java_home', 'javaHome'],
};
const candidateKeys = keyMap[profileKey] ?? [profileKey];
let value;
for (const candidateKey of candidateKeys) {
  if (profile[candidateKey] !== undefined) {
    value = profile[candidateKey];
    break;
  }
}
if (value !== null && typeof value === 'object') {
  value = value.path;
}
if (typeof value !== 'string' || value.length === 0 || /[\r\n\u0000]/u.test(value)) {
  process.exit(1);
}
process.stdout.write(value);
NODE
}

validate_same_dir() {
  label=$1
  candidate_path=$2
  expected_path=$3
  candidate_canonical=$(canonical_dir "$candidate_path") ||
    die "$label directory does not exist: $candidate_path"
  [ "$candidate_canonical" = "$expected_path" ] ||
    die "$label resolves to '$candidate_canonical', expected '$expected_path'"
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

debug_keystore_sha256() {
  keystore_path=$1
  keystore_alias=$2
  keystore_storepass=$3
  keytool_output=$(
    "$KEYTOOL_BIN" \
      -list \
      -v \
      -keystore "$keystore_path" \
      -alias "$keystore_alias" \
      -storepass "$keystore_storepass" 2>&1
  ) || return 1
  printf '%s\n' "$keytool_output" | awk '
    /^[[:space:]]*SHA256[[:space:]]*:/ {
      fingerprint=$0
      sub(/^[[:space:]]*SHA256[[:space:]]*:[[:space:]]*/, "", fingerprint)
      gsub(/:/, "", fingerprint)
      if (length(fingerprint) != 64 || fingerprint ~ /[^0-9A-Fa-f]/) {
        invalid=1
        next
      }
      fingerprint_count += 1
      certificate_sha256=tolower(fingerprint)
    }
    END {
      if (invalid || fingerprint_count != 1) {
        exit 1
      }
      print certificate_sha256
    }
  '
}

count_paths() {
  awk 'NF { count += 1 } END { print count + 0 }'
}

SCRIPT_DIR=$(canonical_dir "$(dirname "$0")") ||
  die "cannot resolve the script directory"
REPO_ROOT=$(canonical_dir "$SCRIPT_DIR/..") ||
  die "cannot resolve the repository root"
GAME_DIR=$(canonical_dir "$REPO_ROOT/game") ||
  die "game project directory is missing: $REPO_ROOT/game"
CONFIG_PATH="$GAME_DIR/build-configs/android-debug.json"
AUDIT_SCRIPT="$REPO_ROOT/scripts/audit-creator-build.mjs"

[ -f "$CONFIG_PATH" ] || die "Android build configuration is missing: $CONFIG_PATH"
[ ! -L "$CONFIG_PATH" ] || die "refusing symlinked Android build configuration: $CONFIG_PATH"
[ -f "$AUDIT_SCRIPT" ] || die "Creator artifact audit is missing: $AUDIT_SCRIPT"

if [ -n "${NODE_BIN:-}" ]; then
  [ -x "$NODE_BIN" ] || die "NODE_BIN is not executable: $NODE_BIN"
else
  NODE_BIN=$(command -v node 2>/dev/null) || die "node is required for build validation"
fi

"$NODE_BIN" - \
  "$CONFIG_PATH" \
  "$EXPECTED_CREATOR_VERSION" \
  "$EXPECTED_SCENE_UUID" \
  "$EXPECTED_PACKAGE_ID" \
  "$EXPECTED_MIN_SDK" \
  "$EXPECTED_TARGET_SDK" \
  "$EXPECTED_COMPILE_SDK" \
  "$EXPECTED_BUILD_TOOLS" \
  "$EXPECTED_NDK" \
  "$EXPECTED_CMAKE" \
  "$EXPECTED_GRADLE" \
  "$EXPECTED_AGP" \
  "$EXPECTED_ABI" \
  "$EXPECTED_JDK_MAJOR" \
  "$EXPECTED_JDK_VERSION" \
  "$EXPECTED_JDK_VENDOR" <<'NODE'
const fs = require('node:fs');
const [
  configPath,
  creator,
  sceneUuid,
  packageId,
  minSdk,
  targetSdk,
  compileSdk,
  buildTools,
  ndk,
  cmake,
  gradle,
  agp,
  abi,
  jdk,
  jdkVersion,
  jdkVendor,
] = process.argv.slice(2);

function fail(message) {
  console.error(`invalid Android build configuration: ${message}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  fail(error.message);
}

const android = config.packages?.android;
const native = config.packages?.native;
const toolchain = config.toolchain;
const scene = config.scenes?.[0];
const expected = (actual, value, label) => {
  if (actual !== value) {
    fail(`${label} must be ${JSON.stringify(value)}`);
  }
};

expected(config.platform, 'android', 'platform');
expected(config.debug, true, 'debug');
expected(config.sourceMaps, false, 'sourceMaps');
expected(config.buildPath, 'project://build', 'buildPath');
expected(config.outputName, 'android-debug', 'outputName');
expected(config.taskName, 'android-debug', 'taskName');
expected(config.startScene, sceneUuid, 'startScene');
expected(config.scenes?.length, 1, 'scene count');
expected(scene?.uuid, sceneUuid, 'scene UUID');
expected(scene?.url, 'db://assets/scenes/classic.scene', 'scene URL');
expected(android?.packageName, packageId, 'package name');
expected(android?.apiLevel, Number(targetSdk), 'target API');
expected(android?.appBundle, false, 'appBundle');
expected(android?.useDebugKeystore, true, 'debug keystore');
expected(android?.appABIs?.length, 1, 'ABI count');
expected(android?.appABIs?.[0], abi, 'ABI');
expected(android?.orientation?.portrait, true, 'portrait orientation');
expected(android?.orientation?.landscapeLeft, false, 'landscape-left orientation');
expected(android?.orientation?.landscapeRight, false, 'landscape-right orientation');
expected(native?.makeAfterBuild, false, 'makeAfterBuild');

expected(toolchain?.creator, creator, 'Creator version');
expected(toolchain?.jdk, Number(jdk), 'JDK version');
expected(toolchain?.minSdk, Number(minSdk), 'minimum SDK');
expected(toolchain?.targetSdk, Number(targetSdk), 'target SDK');
expected(toolchain?.compileSdk, Number(compileSdk), 'compile SDK');
expected(toolchain?.buildTools, buildTools, 'Build Tools version');
expected(toolchain?.ndk, ndk, 'NDK version');
expected(toolchain?.cmake, cmake, 'CMake version');
expected(toolchain?.gradle, gradle, 'Gradle version');
expected(toolchain?.androidGradlePlugin, agp, 'Android Gradle Plugin version');
expected(toolchain?.jdkVersion, jdkVersion, 'JDK patch version');
expected(toolchain?.jdkVendor, jdkVendor, 'JDK vendor');

const bannedKeys = new Set([
  'sdkPath',
  'ndkPath',
  'javaHome',
  'javaPath',
  'keystorePath',
  'keystorePassword',
  'keystoreAlias',
  'keystoreAliasPassword',
]);
function inspect(value, path = 'config') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspect(entry, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') {
    if (
      typeof value === 'string'
      && /^(?:\/|~(?:\/|$)|[A-Za-z]:[\\/]|file:)/u.test(value)
    ) {
      fail(`${path} contains a machine-local path`);
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (
      bannedKeys.has(key)
      || /(?:password|credential|privateKey|accessToken|secret)$/iu.test(key)
    ) {
      fail(`${path}.${key} must not be exported`);
    }
    inspect(entry, `${path}.${key}`);
  }
}
inspect(config);
NODE

CREATOR_BIN=${COCOS_CREATOR_BIN:-$DEFAULT_CREATOR_BIN}
[ -f "$CREATOR_BIN" ] || die "Cocos Creator executable is missing: $CREATOR_BIN"
[ -x "$CREATOR_BIN" ] || die "Cocos Creator executable is not executable: $CREATOR_BIN"
CREATOR_MACOS_DIR=$(canonical_dir "$(dirname "$CREATOR_BIN")") ||
  die "cannot resolve the Cocos Creator executable directory"
CREATOR_CONTENTS_DIR=$(canonical_dir "$CREATOR_MACOS_DIR/..") ||
  die "cannot resolve the Cocos Creator bundle"
CREATOR_INFO_PLIST="$CREATOR_CONTENTS_DIR/Info.plist"
[ -f "$CREATOR_INFO_PLIST" ] ||
  die "Cocos Creator Info.plist is missing: $CREATOR_INFO_PLIST"

if [ -n "${PLUTIL_BIN:-}" ]; then
  [ -x "$PLUTIL_BIN" ] || die "PLUTIL_BIN is not executable: $PLUTIL_BIN"
else
  PLUTIL_BIN=$(command -v plutil 2>/dev/null) || die "plutil is required to inspect Creator Info.plist"
fi
CREATOR_VERSION=$(
  "$PLUTIL_BIN" -extract CFBundleShortVersionString raw -o - "$CREATOR_INFO_PLIST" 2>/dev/null
) || die "cannot read Creator version from Info.plist"
[ "$CREATOR_VERSION" = "$EXPECTED_CREATOR_VERSION" ] ||
  die "Cocos Creator version is '$CREATOR_VERSION', expected '$EXPECTED_CREATOR_VERSION'"

if [ -n "${COCOS_CREATOR_PROGRAM_PROFILE:-}" ]; then
  PROGRAM_PROFILE=$COCOS_CREATOR_PROGRAM_PROFILE
else
  [ -n "${HOME:-}" ] || die "HOME is required to locate Creator's program profile"
  PROGRAM_PROFILE="$HOME/.CocosCreator/profiles/v2/packages/program.json"
fi
[ -f "$PROGRAM_PROFILE" ] ||
  die "Creator program profile is missing: $PROGRAM_PROFILE"
[ ! -L "$PROGRAM_PROFILE" ] ||
  die "refusing symlinked Creator program profile: $PROGRAM_PROFILE"
PROFILE_JAVA=$(profile_value "$PROGRAM_PROFILE" java_home 2>/dev/null || true)

if [ -n "${JAVA_HOME:-}" ]; then
  JAVA_HOME_REQUESTED=$JAVA_HOME
elif [ -n "$PROFILE_JAVA" ]; then
  JAVA_HOME_REQUESTED=$PROFILE_JAVA
elif [ -x /usr/libexec/java_home ]; then
  JAVA_HOME_REQUESTED=$(/usr/libexec/java_home -v "$EXPECTED_JDK_VERSION" 2>/dev/null) ||
    die "Azul Zulu JDK $EXPECTED_JDK_VERSION is not installed"
else
  die "JAVA_HOME must identify Azul Zulu JDK $EXPECTED_JDK_VERSION"
fi
JAVA_HOME=$(canonical_dir "$JAVA_HOME_REQUESTED") ||
  die "JAVA_HOME directory does not exist: $JAVA_HOME_REQUESTED"
JAVA_BIN="$JAVA_HOME/bin/java"
JAVAC_BIN="$JAVA_HOME/bin/javac"
KEYTOOL_BIN="$JAVA_HOME/bin/keytool"
[ -x "$JAVA_BIN" ] || die "JDK $EXPECTED_JDK_MAJOR java executable is missing: $JAVA_BIN"
[ -x "$JAVAC_BIN" ] || die "JDK $EXPECTED_JDK_MAJOR javac executable is missing: $JAVAC_BIN"
[ -x "$KEYTOOL_BIN" ] ||
  die "JDK $EXPECTED_JDK_MAJOR keytool executable is missing: $KEYTOOL_BIN"
JAVA_VERSION_OUTPUT=$("$JAVA_BIN" -version 2>&1) ||
  die "cannot execute JDK java: $JAVA_BIN"
printf '%s\n' "$JAVA_VERSION_OUTPUT" | grep -F "version \"$EXPECTED_JDK_VERSION\"" >/dev/null ||
  die "JAVA_HOME must identify JDK $EXPECTED_JDK_VERSION"
printf '%s\n' "$JAVA_VERSION_OUTPUT" | grep -Ei 'Zulu|Azul' >/dev/null ||
  die "JAVA_HOME must identify the Azul Zulu JDK distribution"
JAVAC_VERSION_OUTPUT=$("$JAVAC_BIN" -version 2>&1) ||
  die "cannot execute JDK javac: $JAVAC_BIN"
printf '%s\n' "$JAVAC_VERSION_OUTPUT" | grep -F "javac $EXPECTED_JDK_VERSION" >/dev/null ||
  die "JAVA_HOME must provide javac $EXPECTED_JDK_VERSION"
if [ -n "$PROFILE_JAVA" ]; then
  validate_same_dir "Creator javaHome profile" "$PROFILE_JAVA" "$JAVA_HOME"
fi
PATH="$JAVA_HOME/bin:$PATH"
export JAVA_HOME PATH

PROFILE_SDK=$(profile_value "$PROGRAM_PROFILE" android_sdk) ||
  die "Creator program profile must define android_sdk"
PROFILE_NDK=$(profile_value "$PROGRAM_PROFILE" android_ndk) ||
  die "Creator program profile must define android_ndk"

if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
  SDK_REQUESTED=$ANDROID_SDK_ROOT
elif [ -n "${ANDROID_HOME:-}" ]; then
  SDK_REQUESTED=$ANDROID_HOME
else
  SDK_REQUESTED=$PROFILE_SDK
fi
SDK_ROOT=$(canonical_dir "$SDK_REQUESTED") ||
  die "Android SDK directory does not exist: $SDK_REQUESTED"
if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
  validate_same_dir "ANDROID_SDK_ROOT" "$ANDROID_SDK_ROOT" "$SDK_ROOT"
fi
if [ -n "${ANDROID_HOME:-}" ]; then
  validate_same_dir "ANDROID_HOME" "$ANDROID_HOME" "$SDK_ROOT"
fi
validate_same_dir "Creator android_sdk profile" "$PROFILE_SDK" "$SDK_ROOT"

if [ -n "${ANDROID_NDK_ROOT:-}" ]; then
  NDK_REQUESTED=$ANDROID_NDK_ROOT
elif [ -n "${ANDROID_NDK_HOME:-}" ]; then
  NDK_REQUESTED=$ANDROID_NDK_HOME
elif [ -n "${NDK_HOME:-}" ]; then
  NDK_REQUESTED=$NDK_HOME
else
  NDK_REQUESTED="$SDK_ROOT/ndk/$EXPECTED_NDK"
fi
NDK_ROOT=$(canonical_dir "$NDK_REQUESTED") ||
  die "Android NDK directory does not exist: $NDK_REQUESTED"
if [ -n "${ANDROID_NDK_ROOT:-}" ]; then
  validate_same_dir "ANDROID_NDK_ROOT" "$ANDROID_NDK_ROOT" "$NDK_ROOT"
fi
if [ -n "${ANDROID_NDK_HOME:-}" ]; then
  validate_same_dir "ANDROID_NDK_HOME" "$ANDROID_NDK_HOME" "$NDK_ROOT"
fi
if [ -n "${NDK_HOME:-}" ]; then
  validate_same_dir "NDK_HOME" "$NDK_HOME" "$NDK_ROOT"
fi
validate_same_dir "Creator android_ndk profile" "$PROFILE_NDK" "$NDK_ROOT"

NDK_PROPERTIES="$NDK_ROOT/source.properties"
[ -f "$NDK_PROPERTIES" ] || die "NDK source.properties is missing: $NDK_PROPERTIES"
NDK_VERSION=$(property_value "$NDK_PROPERTIES" Pkg.Revision) ||
  die "NDK source.properties does not declare Pkg.Revision"
[ "$NDK_VERSION" = "$EXPECTED_NDK" ] ||
  die "NDK version is '$NDK_VERSION', expected '$EXPECTED_NDK'"

ANDROID_PLATFORM="$SDK_ROOT/platforms/android-$EXPECTED_COMPILE_SDK/android.jar"
[ -f "$ANDROID_PLATFORM" ] ||
  die "Android SDK platform android-$EXPECTED_COMPILE_SDK is missing: $ANDROID_PLATFORM"
BUILD_TOOLS_DIR="$SDK_ROOT/build-tools/$EXPECTED_BUILD_TOOLS"
[ -d "$BUILD_TOOLS_DIR" ] ||
  die "Android Build Tools $EXPECTED_BUILD_TOOLS are missing: $BUILD_TOOLS_DIR"
AAPT_BIN="$BUILD_TOOLS_DIR/aapt"
APKSIGNER_BIN="$BUILD_TOOLS_DIR/apksigner"
[ -x "$AAPT_BIN" ] || die "Android Build Tools aapt is missing: $AAPT_BIN"
[ -x "$APKSIGNER_BIN" ] || die "Android Build Tools apksigner is missing: $APKSIGNER_BIN"

CMAKE_ROOT="$SDK_ROOT/cmake/$EXPECTED_CMAKE"
CMAKE_PROPERTIES="$CMAKE_ROOT/source.properties"
CMAKE_BIN="$CMAKE_ROOT/bin/cmake"
[ -f "$CMAKE_PROPERTIES" ] || die "CMake source.properties is missing: $CMAKE_PROPERTIES"
CMAKE_VERSION=$(property_value "$CMAKE_PROPERTIES" Pkg.Revision) ||
  die "CMake source.properties does not declare Pkg.Revision"
[ "$CMAKE_VERSION" = "$EXPECTED_CMAKE" ] ||
  die "CMake package version is '$CMAKE_VERSION', expected '$EXPECTED_CMAKE'"
[ -x "$CMAKE_BIN" ] || die "CMake $EXPECTED_CMAKE executable is missing: $CMAKE_BIN"
CMAKE_VERSION_OUTPUT=$("$CMAKE_BIN" --version 2>&1) ||
  die "cannot execute CMake: $CMAKE_BIN"
printf '%s\n' "$CMAKE_VERSION_OUTPUT" | grep -F "cmake version $EXPECTED_CMAKE" >/dev/null ||
  die "CMake executable is not version $EXPECTED_CMAKE"

ANDROID_SDK_ROOT=$SDK_ROOT
ANDROID_HOME=$SDK_ROOT
ANDROID_NDK_ROOT=$NDK_ROOT
ANDROID_NDK_HOME=$NDK_ROOT
NDK_HOME=$NDK_ROOT
export ANDROID_SDK_ROOT ANDROID_HOME ANDROID_NDK_ROOT ANDROID_NDK_HOME NDK_HOME

BUILD_ROOT_REQUESTED="$GAME_DIR/build"
[ ! -L "$BUILD_ROOT_REQUESTED" ] ||
  die "refusing symlinked build root: $BUILD_ROOT_REQUESTED"
mkdir -p "$BUILD_ROOT_REQUESTED"
BUILD_ROOT=$(canonical_dir "$BUILD_ROOT_REQUESTED") ||
  die "cannot resolve build root: $BUILD_ROOT_REQUESTED"
[ "$BUILD_ROOT" = "$GAME_DIR/build" ] ||
  die "build root escapes the game project: $BUILD_ROOT"

RUNTIME_CONFIG=$(mktemp "$BUILD_ROOT/.android-debug-runtime-config.XXXXXX") ||
  die "cannot create the Android runtime build configuration"
[ -f "$RUNTIME_CONFIG" ] ||
  die "Android runtime build configuration is not a regular file: $RUNTIME_CONFIG"
[ ! -L "$RUNTIME_CONFIG" ] ||
  die "refusing symlinked Android runtime build configuration: $RUNTIME_CONFIG"
RUNTIME_CONFIG_DIR=$(canonical_dir "$(dirname "$RUNTIME_CONFIG")") ||
  die "cannot resolve the Android runtime build configuration directory"
[ "$RUNTIME_CONFIG_DIR" = "$BUILD_ROOT" ] ||
  die "Android runtime build configuration escapes the build root: $RUNTIME_CONFIG"
case "$(basename "$RUNTIME_CONFIG")" in
  .android-debug-runtime-config.*)
    ;;
  *)
    die "Android runtime build configuration has an unexpected name: $RUNTIME_CONFIG"
    ;;
esac

"$NODE_BIN" - \
  "$CONFIG_PATH" \
  "$RUNTIME_CONFIG" \
  "$SDK_ROOT" \
  "$NDK_ROOT" \
  "$JAVA_HOME" \
  "$JAVA_BIN" <<'NODE'
const fs = require('node:fs');
const [
  trackedConfigPath,
  runtimeConfigPath,
  sdkPath,
  ndkPath,
  javaHome,
  javaPath,
] = process.argv.slice(2);

function fail(message) {
  console.error(`cannot create Android runtime build configuration: ${message}`);
  process.exit(1);
}

let config;
try {
  const runtimeStat = fs.lstatSync(runtimeConfigPath);
  if (!runtimeStat.isFile() || runtimeStat.isSymbolicLink()) {
    fail('temporary destination is not a regular non-symlink file');
  }
  config = JSON.parse(fs.readFileSync(trackedConfigPath, 'utf8'));
} catch (error) {
  fail(error.message);
}

if (
  config.packages === null
  || typeof config.packages !== 'object'
  || Array.isArray(config.packages)
  || config.packages.android === null
  || typeof config.packages.android !== 'object'
  || Array.isArray(config.packages.android)
) {
  fail('tracked configuration is missing packages.android');
}

Object.assign(config.packages.android, {
  sdkPath,
  ndkPath,
  javaHome,
  javaPath,
});

try {
  fs.writeFileSync(
    runtimeConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    { encoding: 'utf8', flag: 'w', mode: 0o600 },
  );
} catch (error) {
  fail(error.message);
}
NODE

[ -f "$RUNTIME_CONFIG" ] ||
  die "Android runtime build configuration disappeared: $RUNTIME_CONFIG"
[ ! -L "$RUNTIME_CONFIG" ] ||
  die "Android runtime build configuration became a symlink: $RUNTIME_CONFIG"
[ "$(canonical_dir "$(dirname "$RUNTIME_CONFIG")")" = "$BUILD_ROOT" ] ||
  die "Android runtime build configuration failed bounded-path validation: $RUNTIME_CONFIG"

OUTPUT_DIR="$BUILD_ROOT/android-debug"
[ "$(dirname "$OUTPUT_DIR")" = "$BUILD_ROOT" ] ||
  die "Android output is not a direct child of the build root: $OUTPUT_DIR"
[ "$(basename "$OUTPUT_DIR")" = "android-debug" ] ||
  die "Android output has an unexpected name: $OUTPUT_DIR"
[ ! -L "$OUTPUT_DIR" ] || die "refusing symlinked Android output: $OUTPUT_DIR"
if [ -e "$OUTPUT_DIR" ] && [ ! -d "$OUTPUT_DIR" ]; then
  die "Android output exists and is not a directory: $OUTPUT_DIR"
fi
if [ -d "$OUTPUT_DIR" ]; then
  rm -rf "$OUTPUT_DIR"
fi
mkdir "$OUTPUT_DIR"
[ "$(canonical_dir "$OUTPUT_DIR")" = "$BUILD_ROOT/android-debug" ] ||
  die "Android output failed bounded-path validation: $OUTPUT_DIR"

BUILD_MARKER=$(mktemp "$BUILD_ROOT/.android-debug-start.XXXXXX") ||
  die "cannot create the Android build freshness marker"

printf 'Building Pencil Blade Android debug APK with Cocos Creator %s\n' "$CREATOR_VERSION"
set +e
"$CREATOR_BIN" \
  --project "$GAME_DIR" \
  --build "stage=build;configPath=$RUNTIME_CONFIG;"
CREATOR_STATUS=$?
set -e

case "$CREATOR_STATUS" in
  36)
    printf 'Cocos Creator build generation succeeded (exit 36).\n'
    ;;
  32)
    die "Cocos Creator rejected the build parameters (exit 32)"
    ;;
  34)
    die "Cocos Creator reported an unexpected build failure (exit 34)"
    ;;
  *)
    die "Cocos Creator returned undocumented exit code $CREATOR_STATUS (expected success code 36)"
    ;;
esac

GRADLE_PROJECT="$OUTPUT_DIR/proj"
GRADLE_WRAPPER="$GRADLE_PROJECT/gradlew"
GRADLE_PROPERTIES="$GRADLE_PROJECT/gradle.properties"
GRADLE_WRAPPER_PROPERTIES="$GRADLE_PROJECT/gradle/wrapper/gradle-wrapper.properties"
GRADLE_BUILD_FILE="$GRADLE_PROJECT/build.gradle"
GRADLE_SETTINGS="$GRADLE_PROJECT/settings.gradle"
GRADLE_LOCAL_PROPERTIES="$GRADLE_PROJECT/local.properties"

[ -d "$GRADLE_PROJECT" ] || die "generated Gradle project is missing: $GRADLE_PROJECT"
[ -f "$GRADLE_WRAPPER" ] || die "generated Gradle wrapper is missing: $GRADLE_WRAPPER"
[ ! -L "$GRADLE_WRAPPER" ] || die "refusing symlinked generated Gradle wrapper: $GRADLE_WRAPPER"
[ -f "$GRADLE_PROPERTIES" ] || die "generated Gradle properties are missing: $GRADLE_PROPERTIES"
[ -f "$GRADLE_WRAPPER_PROPERTIES" ] ||
  die "generated Gradle wrapper properties are missing: $GRADLE_WRAPPER_PROPERTIES"
[ -f "$GRADLE_BUILD_FILE" ] || die "generated root Gradle build file is missing: $GRADLE_BUILD_FILE"
[ -f "$GRADLE_SETTINGS" ] || die "generated Gradle settings are missing: $GRADLE_SETTINGS"
[ -f "$GRADLE_LOCAL_PROPERTIES" ] ||
  die "generated Gradle local.properties is missing: $GRADLE_LOCAL_PROPERTIES"

NATIVE_DIR_REQUESTED=$(property_value "$GRADLE_PROPERTIES" NATIVE_DIR) ||
  die "generated Gradle property is missing: NATIVE_DIR"
NATIVE_DIR=$(canonical_dir "$NATIVE_DIR_REQUESTED") ||
  die "generated native source directory does not exist: $NATIVE_DIR_REQUESTED"
EXPECTED_NATIVE_DIR=$(canonical_dir "$GAME_DIR/native/engine/android") ||
  die "expected native Android source directory is missing: $GAME_DIR/native/engine/android"
[ "$NATIVE_DIR" = "$EXPECTED_NATIVE_DIR" ] ||
  die "generated NATIVE_DIR resolves to '$NATIVE_DIR', expected '$EXPECTED_NATIVE_DIR'"
[ ! -L "$NATIVE_DIR/app" ] ||
  die "refusing symlinked generated Android application module: $NATIVE_DIR/app"
GRADLE_APP_BUILD_FILE="$NATIVE_DIR/app/build.gradle"
[ -f "$GRADLE_APP_BUILD_FILE" ] ||
  die "generated application Gradle build file is missing: $GRADLE_APP_BUILD_FILE"
[ ! -L "$GRADLE_APP_BUILD_FILE" ] ||
  die "refusing symlinked generated application Gradle build file: $GRADLE_APP_BUILD_FILE"
grep -F "project(':app').projectDir" "$GRADLE_SETTINGS" |
  grep -F "new File(NATIVE_DIR, 'app')" >/dev/null ||
  die "generated Gradle settings do not map :app to NATIVE_DIR/app"
grep -F "project(':app').name" "$GRADLE_SETTINGS" |
  grep -F '"CocosGame"' >/dev/null ||
  die "generated Gradle settings do not name :app as CocosGame"

require_property "$GRADLE_PROPERTIES" PROP_MIN_SDK_VERSION "$EXPECTED_MIN_SDK"
require_property "$GRADLE_PROPERTIES" PROP_TARGET_SDK_VERSION "$EXPECTED_TARGET_SDK"
require_property "$GRADLE_PROPERTIES" PROP_COMPILE_SDK_VERSION "$EXPECTED_COMPILE_SDK"
require_property "$GRADLE_PROPERTIES" PROP_BUILD_TOOLS_VERSION "$EXPECTED_BUILD_TOOLS"
require_property "$GRADLE_PROPERTIES" PROP_NDK_VERSION "$EXPECTED_NDK"
require_property "$GRADLE_PROPERTIES" PROP_APP_ABI "$EXPECTED_ABI"
require_property "$GRADLE_PROPERTIES" PROP_IS_DEBUG "true"
require_property "$GRADLE_PROPERTIES" APPLICATION_ID "$EXPECTED_PACKAGE_ID"
require_property "$GRADLE_LOCAL_PROPERTIES" sdk.dir "$SDK_ROOT"
grep -F "gradle-$EXPECTED_GRADLE-bin.zip" "$GRADLE_WRAPPER_PROPERTIES" >/dev/null ||
  die "generated Gradle wrapper is not pinned to $EXPECTED_GRADLE"
grep -F "com.android.tools.build:gradle:$EXPECTED_AGP" "$GRADLE_BUILD_FILE" >/dev/null ||
  die "generated Android Gradle Plugin is not pinned to $EXPECTED_AGP"
grep -F "version \"$EXPECTED_CMAKE\"" "$GRADLE_APP_BUILD_FILE" >/dev/null ||
  die "generated Android application is not pinned to CMake $EXPECTED_CMAKE"

printf 'Running generated Gradle task :CocosGame:assembleDebug\n'
if ! (
  CDPATH= cd "$GRADLE_PROJECT"
  sh "$GRADLE_WRAPPER" --no-daemon :CocosGame:assembleDebug
); then
  die "generated Gradle :CocosGame:assembleDebug failed"
fi

GRADLE_DEBUG_KEYSTORE=""
if [ -n "${ANDROID_USER_HOME:-}" ]; then
  GRADLE_DEBUG_KEYSTORE="$ANDROID_USER_HOME/debug.keystore"
elif [ -n "${HOME:-}" ]; then
  GRADLE_DEBUG_KEYSTORE="$HOME/.android/debug.keystore"
fi
CREATOR_DEBUG_KEYSTORE="$CREATOR_CONTENTS_DIR/Resources/tools/keystore/debug.keystore"

GRADLE_DEBUG_CERT_SHA256=""
if [ -n "$GRADLE_DEBUG_KEYSTORE" ] &&
  [ -f "$GRADLE_DEBUG_KEYSTORE" ] &&
  [ ! -L "$GRADLE_DEBUG_KEYSTORE" ]; then
  if GRADLE_DEBUG_CERT_SHA256=$(
    debug_keystore_sha256 \
      "$GRADLE_DEBUG_KEYSTORE" \
      "androiddebugkey" \
      "android"
  ); then
    :
  else
    GRADLE_DEBUG_CERT_SHA256=""
  fi
fi

CREATOR_DEBUG_CERT_SHA256=""
if [ -f "$CREATOR_DEBUG_KEYSTORE" ] &&
  [ ! -L "$CREATOR_DEBUG_KEYSTORE" ]; then
  if CREATOR_DEBUG_CERT_SHA256=$(
    debug_keystore_sha256 \
      "$CREATOR_DEBUG_KEYSTORE" \
      "debug_keystore" \
      "123456"
  ); then
    :
  else
    CREATOR_DEBUG_CERT_SHA256=""
  fi
fi

if [ -z "$GRADLE_DEBUG_CERT_SHA256" ] &&
  [ -z "$CREATOR_DEBUG_CERT_SHA256" ]; then
  die "no trusted Android debug keystore certificate could be fingerprinted"
fi

APK_LIST=$(find "$OUTPUT_DIR" -type f -name '*-debug.apk' -print)
APK_COUNT=$(printf '%s\n' "$APK_LIST" | count_paths)
[ "$APK_COUNT" -eq 1 ] ||
  die "expected exactly one debug APK under $OUTPUT_DIR, found $APK_COUNT"
FRESH_APK_LIST=$(find "$OUTPUT_DIR" -type f -name '*-debug.apk' -newer "$BUILD_MARKER" -print)
FRESH_APK_COUNT=$(printf '%s\n' "$FRESH_APK_LIST" | count_paths)
[ "$FRESH_APK_COUNT" -eq 1 ] ||
  die "the generated debug APK is stale; expected one APK newer than the build start"
[ "$APK_LIST" = "$FRESH_APK_LIST" ] ||
  die "debug APK freshness selection is ambiguous"
GENERATED_APK=$FRESH_APK_LIST

ARTIFACT_DIR="$BUILD_ROOT/artifacts/android"
[ ! -L "$ARTIFACT_DIR" ] || die "refusing symlinked artifact directory: $ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"
ARTIFACT_DIR=$(canonical_dir "$ARTIFACT_DIR") ||
  die "cannot resolve Android artifact directory"
[ "$ARTIFACT_DIR" = "$BUILD_ROOT/artifacts/android" ] ||
  die "Android artifact directory escapes the build root: $ARTIFACT_DIR"
ARTIFACT_PATH="$ARTIFACT_DIR/pencil-blade-debug.apk"
HASH_PATH="$ARTIFACT_PATH.sha256"
STAGED_ARTIFACT="$ARTIFACT_DIR/.pencil-blade-debug.$$.apk"
STAGED_HASH="$ARTIFACT_DIR/.pencil-blade-debug.apk.sha256.$$"
cp "$GENERATED_APK" "$STAGED_ARTIFACT"

"$NODE_BIN" "$AUDIT_SCRIPT" "$STAGED_ARTIFACT" ||
  die "the generated debug APK failed the prohibited-runtime audit"

AAPT_OUTPUT=$("$AAPT_BIN" dump badging "$STAGED_ARTIFACT" 2>&1) ||
  die "aapt could not inspect the generated debug APK"
printf '%s\n' "$AAPT_OUTPUT" | grep -F "package: name='$EXPECTED_PACKAGE_ID'" >/dev/null ||
  die "APK package name does not match $EXPECTED_PACKAGE_ID"
printf '%s\n' "$AAPT_OUTPUT" | grep -F "sdkVersion:'$EXPECTED_MIN_SDK'" >/dev/null ||
  die "APK minimum SDK does not match $EXPECTED_MIN_SDK"
printf '%s\n' "$AAPT_OUTPUT" | grep -F "targetSdkVersion:'$EXPECTED_TARGET_SDK'" >/dev/null ||
  die "APK target SDK does not match $EXPECTED_TARGET_SDK"
if ! printf '%s\n' "$AAPT_OUTPUT" | awk -v expected_abi="$EXPECTED_ABI" '
  BEGIN {
    expected_token=sprintf("%c%s%c", 39, expected_abi, 39)
  }
  /^[[:space:]]*native-code/ {
    native_code_lines += 1
    if ($0 !~ /^native-code:[[:space:]]+/) {
      invalid=1
      next
    }
    values=$0
    sub(/^native-code:[[:space:]]+/, "", values)
    sub(/[[:space:]]+$/, "", values)
    if (values == "") {
      invalid=1
      next
    }
    token_count=split(values, tokens, /[[:space:]]+/)
    if (token_count != 1 || tokens[1] != expected_token) {
      invalid=1
    }
  }
  END {
    if (invalid || native_code_lines != 1) {
      exit 1
    }
  }
'; then
  die "APK native ABI metadata does not match $EXPECTED_ABI"
fi
printf '%s\n' "$AAPT_OUTPUT" | grep -F 'application-debuggable' >/dev/null ||
  die "APK is not marked debuggable"

APKSIGNER_OUTPUT=$(
  "$APKSIGNER_BIN" verify --verbose --print-certs "$STAGED_ARTIFACT" 2>&1
) || die "apksigner rejected the generated debug APK"
APK_SIGNER_COUNT=$(
  printf '%s\n' "$APKSIGNER_OUTPUT" | awk '
    /^Number of signers:/ {
      signer_count_lines += 1
      signer_count=$0
      sub(/^Number of signers:[[:space:]]*/, "", signer_count)
      if (signer_count !~ /^[0-9]+$/) {
        invalid=1
      }
    }
    END {
      if (invalid || signer_count_lines != 1) {
        exit 1
      }
      print signer_count
    }
  '
) || die "apksigner metadata does not report exactly one signer"
[ "$APK_SIGNER_COUNT" = "1" ] ||
  die "apksigner metadata does not report exactly one signer"

APK_SIGNER_CERT_SHA256=$(
  printf '%s\n' "$APKSIGNER_OUTPUT" | awk '
    /^Signer #[0-9][0-9]* certificate SHA-256 digest:/ {
      certificate_digest_lines += 1
      if ($0 !~ /^Signer #1 certificate SHA-256 digest:/) {
        invalid=1
        next
      }
      certificate_sha256=$0
      sub(/^Signer #1 certificate SHA-256 digest:[[:space:]]*/, "", certificate_sha256)
      if (length(certificate_sha256) != 64 || certificate_sha256 ~ /[^0-9A-Fa-f]/) {
        invalid=1
        next
      }
      certificate_sha256=tolower(certificate_sha256)
    }
    END {
      if (invalid || certificate_digest_lines != 1) {
        exit 1
      }
      print certificate_sha256
    }
  '
) || die "apksigner signer #1 SHA-256 certificate digest is missing or malformed"

if [ "$APK_SIGNER_CERT_SHA256" = "$GRADLE_DEBUG_CERT_SHA256" ] ||
  [ "$APK_SIGNER_CERT_SHA256" = "$CREATOR_DEBUG_CERT_SHA256" ]; then
  :
else
  die "APK signer SHA-256 certificate digest does not match a trusted debug keystore"
fi

ARTIFACT_SHA256=$(sha256_file "$STAGED_ARTIFACT")
mv -f "$STAGED_ARTIFACT" "$ARTIFACT_PATH"
STAGED_ARTIFACT=""
printf '%s  %s\n' "$ARTIFACT_SHA256" "$(basename "$ARTIFACT_PATH")" > "$STAGED_HASH"
mv -f "$STAGED_HASH" "$HASH_PATH"
STAGED_HASH=""

printf 'SHA-256: %s\n' "$ARTIFACT_SHA256"
printf '%s\n' "$ARTIFACT_PATH"

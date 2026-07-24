import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceScript = join(projectRoot, 'scripts/build-android-debug.sh');
const sourceConfig = join(projectRoot, 'game/build-configs/android-debug.json');
const sourceAudit = join(projectRoot, 'scripts/audit-creator-build.mjs');
const testRoot = mkdtempSync(join(tmpdir(), 'pencil blade android build tests-'));
const gradleDebugCertificateSha256 = '11'.repeat(32);
const creatorDebugCertificateSha256 = '22'.repeat(32);
const unexpectedCertificateSha256 = '33'.repeat(32);

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('sanitized Android configuration records the complete debug toolchain contract', () => {
  const configText = readFileSync(sourceConfig, 'utf8');
  const scriptText = readFileSync(sourceScript, 'utf8');
  const config = JSON.parse(configText);

  assert.equal(config.platform, 'android');
  assert.equal(config.debug, true);
  assert.equal(config.sourceMaps, false);
  assert.equal(config.outputName, 'android-debug');
  assert.equal(config.startScene, '35e5417d-c3dd-4522-9339-99c81a0b9b4b');
  assert.deepEqual(config.scenes, [{
    url: 'db://assets/scenes/classic.scene',
    uuid: '35e5417d-c3dd-4522-9339-99c81a0b9b4b',
  }]);
  assert.deepEqual(config.packages.android.appABIs, ['arm64-v8a']);
  assert.equal(
    config.packages.android.packageName,
    'io.github.dantech0xff.pencilblade.debug',
  );
  assert.equal(config.packages.android.apiLevel, 36);
  assert.equal(config.packages.android.appBundle, false);
  assert.equal(config.packages.android.useDebugKeystore, true);
  assert.deepEqual(config.toolchain, {
    androidGradlePlugin: '8.10.1',
    buildTools: '36.0.0',
    cmake: '3.22.1',
    compileSdk: 36,
    creator: '3.8.8',
    gradle: '8.11.1',
    jdk: 17,
    jdkVendor: 'Azul Zulu',
    jdkVersion: '17.0.15',
    minSdk: 21,
    ndk: '28.2.13676358',
    targetSdk: 36,
  });
  assert.doesNotMatch(configText, /(?:\/Users\/|\/home\/|[A-Za-z]:\\)/u);
  assert.doesNotMatch(scriptText, /(?:\/Users\/|\/home\/|[A-Za-z]:\\)/u);

  const bannedKeys = [];
  walkObject(config, (key) => {
    if (
      [
        'sdkPath',
        'ndkPath',
        'javaHome',
        'javaPath',
        'keystorePath',
        'keystorePassword',
        'keystoreAlias',
        'keystoreAliasPassword',
      ].includes(key)
      || /(?:password|credential|privateKey|accessToken|secret)$/iu.test(key)
    ) {
      bannedKeys.push(key);
    }
  });
  assert.deepEqual(bannedKeys, []);
});

test('exit 36 uses the camel-object profile and exact Azul pin from a spaced cwd', () => {
  const fixture = createFixture('success with spaces');
  const programProfile = JSON.parse(readFileSync(fixture.programProfile, 'utf8'));
  const trackedConfigBefore = readFileSync(fixture.configPath, 'utf8');
  const staleOutput = join(fixture.gameDir, 'build/android-debug/stale.txt');
  const siblingSentinel = join(fixture.gameDir, 'build/preserve-sibling.txt');
  assert.equal(programProfile.androidSDK.path, fixture.sdkRoot);
  assert.equal(programProfile.androidNDK.path, fixture.ndkRoot);
  assert.equal(programProfile.javaHome.path, fixture.javaHome);
  mkdirSync(dirname(staleOutput), { recursive: true });
  writeFileSync(staleOutput, 'remove only this output\n');
  writeFileSync(siblingSentinel, 'preserve\n');

  const result = runBuild(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(staleOutput), false);
  assert.equal(readFileSync(siblingSentinel, 'utf8'), 'preserve\n');
  assert.match(result.stdout, /Cocos Creator build generation succeeded \(exit 36\)/u);
  assert.match(result.stdout, /PASS: no prohibited restoration payload/u);
  assert.match(result.stdout, /SHA-256: [a-f0-9]{64}/u);
  assert.match(result.stdout, new RegExp(`${escapeRegExp(fixture.artifact)}\\s*$`, 'u'));
  assert.equal(readFileSync(fixture.artifact).equals(readFileSync(fixture.syntheticApk)), true);

  const expectedHash = createHash('sha256')
    .update(readFileSync(fixture.syntheticApk))
    .digest('hex');
  assert.equal(
    readFileSync(`${fixture.artifact}.sha256`, 'utf8'),
    `${expectedHash}  pencil-blade-debug.apk\n`,
  );

  assert.equal(readFileSync(fixture.configPath, 'utf8'), trackedConfigBefore);
  const runtimeConfigPath = readFileSync(fixture.runtimeConfigPathLog, 'utf8').trim();
  const runtimeConfig = JSON.parse(readFileSync(fixture.runtimeConfigLog, 'utf8'));
  assert.equal(
    dirname(runtimeConfigPath),
    realpathSync(join(fixture.gameDir, 'build')),
  );
  assert.match(runtimeConfigPath, /\.android-debug-runtime-config\.[^/]+$/u);
  assert.notEqual(runtimeConfigPath, realpathSync(fixture.configPath));
  assert.equal(existsSync(runtimeConfigPath), false);
  assert.equal(runtimeConfig.packages.android.sdkPath, realpathSync(fixture.sdkRoot));
  assert.equal(runtimeConfig.packages.android.ndkPath, realpathSync(fixture.ndkRoot));
  assert.equal(runtimeConfig.packages.android.javaHome, realpathSync(fixture.javaHome));
  assert.equal(
    runtimeConfig.packages.android.javaPath,
    join(realpathSync(fixture.javaHome), 'bin/java'),
  );

  const creatorLog = readFileSync(fixture.creatorLog, 'utf8');
  assert.match(
    creatorLog,
    new RegExp(`--project\\t${escapeRegExp(realpathSync(fixture.gameDir))}`, 'u'),
  );
  assert.match(
    creatorLog,
    new RegExp(`configPath=${escapeRegExp(runtimeConfigPath)};`, 'u'),
  );
  assert.doesNotMatch(
    creatorLog,
    new RegExp(`configPath=${escapeRegExp(realpathSync(fixture.configPath))};`, 'u'),
  );
  assert.doesNotMatch(creatorLog, /--version/u);
  assert.doesNotMatch(creatorLog, /Pencil\+Blade_1\.5_APKPure\.apk/u);

  const gradleLog = readFileSync(fixture.gradleLog, 'utf8');
  assert.match(gradleLog, /--no-daemon\t:CocosGame:assembleDebug/u);
  assert.doesNotMatch(gradleLog, /\badb\b|install|Pencil\+Blade_1\.5_APKPure\.apk/iu);
  assert.equal(
    readFileSync(fixture.keytoolLog, 'utf8'),
    `${fixture.gradleDebugKeystore}\tandroiddebugkey\n`,
  );
});

test('ANDROID_USER_HOME selects the standard Gradle debug keystore', () => {
  const fixture = createFixture('custom Android user home');
  const androidUserHome = join(fixture.root, 'custom Android user home');
  const debugKeystore = join(androidUserHome, 'debug.keystore');
  mkdirSync(androidUserHome, { recursive: true });
  writeFileSync(debugKeystore, 'custom Gradle debug keystore\n');
  rmSync(fixture.gradleDebugKeystore);

  const result = runBuild(fixture, { androidUserHome });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(fixture.keytoolLog, 'utf8'),
    `${debugKeystore}\tandroiddebugkey\n`,
  );
});

test('Creator bundle debug keystore fingerprint is accepted', () => {
  const fixture = createFixture('Creator debug keystore');
  rmSync(fixture.gradleDebugKeystore);
  mkdirSync(dirname(fixture.creatorDebugKeystore), { recursive: true });
  writeFileSync(fixture.creatorDebugKeystore, 'Creator debug keystore\n');

  const result = runBuild(fixture, {
    apksignerOutput: apksignerReport(creatorDebugCertificateSha256),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(fixture.keytoolLog, 'utf8'),
    `${realpathSync(fixture.creatorDebugKeystore)}\tdebug_keystore\n`,
  );
});

test('Android Debug-looking DN with an unexpected SHA-256 digest is rejected', () => {
  const fixture = createFixture('spoofed Android Debug DN');
  const result = runBuild(fixture, {
    apksignerOutput: apksignerReport(
      unexpectedCertificateSha256,
      'CN=Android Debug, O=Mallory, C=ZZ',
    ),
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /APK signer SHA-256 certificate digest does not match a trusted debug keystore/u,
  );
  assert.equal(existsSync(fixture.artifact), false);
});

for (const signerCase of [
  {
    label: 'missing signer count',
    output: [
      'Verifies',
      'Signer #1 certificate SHA-256 digest: '
        + gradleDebugCertificateSha256,
    ].join('\n'),
    message: /apksigner metadata does not report exactly one signer/u,
  },
  {
    label: 'malformed signer count',
    output: [
      'Verifies',
      'Number of signers: one',
      'Signer #1 certificate SHA-256 digest: '
        + gradleDebugCertificateSha256,
    ].join('\n'),
    message: /apksigner metadata does not report exactly one signer/u,
  },
  {
    label: 'multiple signers',
    output: [
      'Verifies',
      'Number of signers: 2',
      'Signer #1 certificate DN: CN=Android Debug, O=Android, C=US',
      'Signer #1 certificate SHA-256 digest: '
        + gradleDebugCertificateSha256,
      'Signer #2 certificate SHA-256 digest: '
        + creatorDebugCertificateSha256,
    ].join('\n'),
    message: /apksigner metadata does not report exactly one signer/u,
  },
  {
    label: 'missing signer digest',
    output: [
      'Verifies',
      'Number of signers: 1',
      'Signer #1 certificate DN: CN=Android Debug, O=Android, C=US',
    ].join('\n'),
    message: /signer #1 SHA-256 certificate digest is missing or malformed/u,
  },
  {
    label: 'malformed signer digest',
    output: [
      'Verifies',
      'Number of signers: 1',
      'Signer #1 certificate DN: CN=Android Debug, O=Android, C=US',
      'Signer #1 certificate SHA-256 digest: not-a-digest',
    ].join('\n'),
    message: /signer #1 SHA-256 certificate digest is missing or malformed/u,
  },
]) {
  test(`${signerCase.label} fails closed`, () => {
    const fixture = createFixture(signerCase.label);
    const result = runBuild(fixture, {
      apksignerOutput: signerCase.output,
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, signerCase.message);
    assert.equal(existsSync(fixture.artifact), false);
  });
}

test('missing expected debug keystores fails closed', () => {
  const fixture = createFixture('missing debug keystores');
  rmSync(fixture.gradleDebugKeystore);

  const result = runBuild(fixture);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /no trusted Android debug keystore certificate could be fingerprinted/u,
  );
  assert.equal(existsSync(fixture.artifact), false);
});

test('symlinked expected debug keystore is not fingerprinted', () => {
  const fixture = createFixture('symlinked debug keystore');
  const outsideKeystore = join(fixture.root, 'outside-debug.keystore');
  writeFileSync(outsideKeystore, 'outside debug keystore\n');
  rmSync(fixture.gradleDebugKeystore);
  symlinkSync(outsideKeystore, fixture.gradleDebugKeystore);

  const result = runBuild(fixture);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /no trusted Android debug keystore certificate could be fingerprinted/u,
  );
  assert.equal(existsSync(fixture.keytoolLog), false);
});

test('malformed keytool fingerprint output fails closed', () => {
  const fixture = createFixture('malformed keytool fingerprint');
  const result = runBuild(fixture, { keytoolMode: 'malformed' });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /no trusted Android debug keystore certificate could be fingerprinted/u,
  );
  assert.equal(existsSync(fixture.artifact), false);
});

for (const abiCase of [
  {
    label: 'additional ABI token',
    nativeCodeLines: ["native-code: 'arm64-v8a' 'x86_64'"],
  },
  {
    label: 'missing native-code line',
    nativeCodeLines: [],
  },
  {
    label: 'duplicate native-code line',
    nativeCodeLines: [
      "native-code: 'arm64-v8a'",
      "native-code: 'arm64-v8a'",
    ],
  },
  {
    label: 'duplicate ABI token',
    nativeCodeLines: ["native-code: 'arm64-v8a' 'arm64-v8a'"],
  },
  {
    label: 'malformed ABI quoting',
    nativeCodeLines: ["native-code: 'arm64-v8a"],
  },
  {
    label: 'malformed unquoted ABI token',
    nativeCodeLines: ["native-code: 'arm64-v8a' x86_64"],
  },
  {
    label: 'arm64 ABI substring lookalike',
    nativeCodeLines: ["native-code: 'arm64-v8a-lookalike'"],
  },
]) {
  test(`aapt ${abiCase.label} fails closed`, () => {
    const fixture = createFixture(`aapt ${abiCase.label}`);
    const result = runBuild(fixture, {
      aaptOutput: aaptBadgingReport(abiCase.nativeCodeLines),
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /APK native ABI metadata does not match arm64-v8a/u);
    assert.equal(existsSync(fixture.artifact), false);
    assert.equal(existsSync(`${fixture.artifact}.sha256`), false);
  });
}

for (const exitCode of [32, 34]) {
  test(`Creator exit ${exitCode} is an explicit build failure`, () => {
    const fixture = createFixture(`creator exit ${exitCode}`);
    const result = runBuild(fixture, { creatorExit: exitCode });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`exit ${exitCode}`, 'u'));
    assert.equal(existsSync(fixture.gradleLog), false);
    assert.equal(existsSync(fixture.artifact), false);
    const runtimeConfigPath = readFileSync(
      fixture.runtimeConfigPathLog,
      'utf8',
    ).trim();
    assert.equal(existsSync(runtimeConfigPath), false);
  });
}

test('TERM during Creator exits nonzero and removes the runtime config', {
  timeout: 15_000,
}, async () => {
  const fixture = createFixture('Creator receives TERM');
  resetRunLogs(fixture);
  const child = spawn('/bin/sh', [fixture.scriptPath], {
    cwd: fixture.callerCwd,
    detached: true,
    env: buildEnvironment(fixture, { creatorDelay: '30' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const completion = new Promise((resolveCompletion) => {
    child.once('close', (code, signal) => {
      resolveCompletion({ code, signal });
    });
  });

  try {
    await waitForFile(fixture.runtimeConfigPathLog, child);
    const runtimeConfigPath = readFileSync(
      fixture.runtimeConfigPathLog,
      'utf8',
    ).trim();
    process.kill(-child.pid, 'SIGTERM');
    const result = await completion;

    assert.equal(result.signal, null, `${stderr}\n${stdout}`);
    assert.equal(result.code, 143, `${stderr}\n${stdout}`);
    assert.equal(existsSync(runtimeConfigPath), false);
    assert.equal(existsSync(fixture.gradleLog), false);
    assert.equal(existsSync(fixture.artifact), false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') {
          throw error;
        }
      }
    }
  }
});

for (const missingCase of [
  {
    label: 'Creator executable',
    remove: (fixture) => fixture.creatorBin,
    message: /Cocos Creator executable is missing/u,
  },
  {
    label: 'JDK java',
    remove: (fixture) => join(fixture.javaHome, 'bin/java'),
    message: /JDK 17 java executable is missing/u,
  },
  {
    label: 'JDK keytool',
    remove: (fixture) => join(fixture.javaHome, 'bin/keytool'),
    message: /JDK 17 keytool executable is missing/u,
  },
  {
    label: 'SDK platform',
    remove: (fixture) => join(fixture.sdkRoot, 'platforms/android-36/android.jar'),
    message: /Android SDK platform android-36 is missing/u,
  },
  {
    label: 'NDK metadata',
    remove: (fixture) => join(fixture.ndkRoot, 'source.properties'),
    message: /NDK source\.properties is missing/u,
  },
  {
    label: 'CMake executable',
    remove: (fixture) => join(fixture.sdkRoot, 'cmake/3.22.1/bin/cmake'),
    message: /CMake 3\.22\.1 executable is missing/u,
  },
  {
    label: 'Build Tools signer',
    remove: (fixture) => join(fixture.sdkRoot, 'build-tools/36.0.0/apksigner'),
    message: /Android Build Tools apksigner is missing/u,
  },
]) {
  test(`missing ${missingCase.label} fails before Creator runs`, () => {
    const fixture = createFixture(`missing ${missingCase.label}`);
    rmSync(missingCase.remove(fixture), { force: true });
    const result = runBuild(fixture);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, missingCase.message);
    assert.equal(existsSync(fixture.creatorLog), false);
    assert.equal(existsSync(fixture.artifact), false);
  });
}

for (const jdkCase of [
  {
    label: 'different patch release',
    versionOutput: [
      'openjdk version "17.0.16" 2025-07-15 LTS',
      'OpenJDK Runtime Environment Zulu17.60+17-CA (build 17.0.16+8-LTS)',
    ],
    message: /JAVA_HOME must identify JDK 17\.0\.15/u,
  },
  {
    label: 'different vendor',
    versionOutput: [
      'openjdk version "17.0.15" 2025-04-15 LTS',
      'OpenJDK Runtime Environment Temurin-17.0.15+6 (build 17.0.15+6)',
    ],
    message: /JAVA_HOME must identify the Azul Zulu JDK distribution/u,
  },
]) {
  test(`JDK preflight rejects a ${jdkCase.label}`, () => {
    const fixture = createFixture(`JDK ${jdkCase.label}`);
    writeExecutable(
      join(fixture.javaHome, 'bin/java'),
      `#!/bin/sh\nprintf '%s\\n' '${jdkCase.versionOutput.join("' '")}' >&2\n`,
    );

    const result = runBuild(fixture);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, jdkCase.message);
    assert.equal(existsSync(fixture.creatorLog), false);
  });
}

test('Creator program profile must resolve the validated SDK and NDK', () => {
  const fixture = createFixture('profile mismatch');
  const otherSdk = join(fixture.root, 'other sdk');
  mkdirSync(otherSdk, { recursive: true });
  writeFileSync(
    fixture.programProfile,
    `${JSON.stringify({
      __version__: '1.0.4',
      androidSDK: {
        commandArgument: '',
        path: otherSdk,
      },
      androidNDK: {
        commandArgument: '',
        path: fixture.ndkRoot,
      },
      javaHome: {
        commandArgument: '',
        path: fixture.javaHome,
      },
    }, null, 2)}\n`,
  );
  const result = runBuild(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Creator android_sdk profile resolves to/u);
  assert.equal(existsSync(fixture.creatorLog), false);
});

test('legacy snake-case string Creator profile remains supported', () => {
  const fixture = createFixture('legacy profile');
  writeFileSync(
    fixture.programProfile,
    `${JSON.stringify({
      __version__: '1.0.3',
      android_sdk: fixture.sdkRoot,
      android_ndk: fixture.ndkRoot,
      java_home: fixture.javaHome,
    }, null, 2)}\n`,
  );

  const result = runBuild(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(fixture.artifact), true);
});

test('generated NATIVE_DIR cannot escape the expected project source', () => {
  const fixture = createFixture('native source escape');
  const outsideNativeDir = join(fixture.root, 'outside native source');
  const result = runBuild(fixture, { nativeDir: outsideNativeDir });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /generated NATIVE_DIR resolves to/u);
  assert.equal(existsSync(fixture.gradleLog), false);
  assert.equal(existsSync(fixture.artifact), false);
});

test('generated settings must retain the single CocosGame application task', () => {
  const fixture = createFixture('renamed application module');
  const result = runBuild(fixture, { appModuleName: 'UnexpectedApp' });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /generated Gradle settings do not name :app as CocosGame/u,
  );
  assert.equal(existsSync(fixture.gradleLog), false);
  assert.equal(existsSync(fixture.artifact), false);
});

for (const apkCase of [
  {
    mode: 'zero',
    message: /expected exactly one debug APK .* found 0/u,
  },
  {
    mode: 'multiple',
    message: /expected exactly one debug APK .* found 2/u,
  },
  {
    mode: 'stale',
    message: /generated debug APK is stale/u,
  },
]) {
  test(`${apkCase.mode} generated APK selection fails closed`, () => {
    const fixture = createFixture(`${apkCase.mode} APK`);
    const result = runBuild(fixture, { apkMode: apkCase.mode });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, apkCase.message);
    assert.equal(existsSync(fixture.artifact), false);
  });
}

test('symlinked android-debug output is rejected without touching its target', () => {
  const fixture = createFixture('symlink output');
  const outside = join(fixture.root, 'outside output target');
  const sentinel = join(outside, 'keep-me.txt');
  mkdirSync(join(fixture.gameDir, 'build'), { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(sentinel, 'preserve\n');
  symlinkSync(outside, join(fixture.gameDir, 'build/android-debug'), 'dir');

  const result = runBuild(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing symlinked Android output/u);
  assert.equal(readFileSync(sentinel, 'utf8'), 'preserve\n');
  assert.equal(existsSync(fixture.creatorLog), false);
});

function createFixture(label) {
  const root = mkdtempSync(join(testRoot, `${label} - `));
  const scriptsDir = join(root, 'scripts');
  const gameDir = join(root, 'game');
  const configPath = join(gameDir, 'build-configs/android-debug.json');
  const scriptPath = join(scriptsDir, 'build-android-debug.sh');
  const auditPath = join(scriptsDir, 'audit-creator-build.mjs');
  const callerCwd = join(root, 'caller cwd with spaces');
  const fakeTools = join(root, 'fake tools with spaces');
  const javaHome = join(fakeTools, 'jdk 17');
  const sdkRoot = join(fakeTools, 'Android SDK');
  const ndkRoot = join(sdkRoot, 'ndk/28.2.13676358');
  const creatorBin = join(
    fakeTools,
    'Cocos Creator 3.8.8',
    'CocosCreator.app/Contents/MacOS/CocosCreator',
  );
  const creatorInfo = join(dirname(dirname(creatorBin)), 'Info.plist');
  const homeDir = join(root, 'home with spaces');
  const programProfile = join(
    homeDir,
    '.CocosCreator/profiles/v2/packages/program.json',
  );
  const syntheticApk = join(root, 'fixtures/synthetic-debug.apk');
  const fakeGradle = join(fakeTools, 'fake-gradlew');
  const creatorLog = join(root, 'logs/creator-calls.tsv');
  const gradleLog = join(root, 'logs/gradle-calls.tsv');
  const runtimeConfigLog = join(root, 'logs/runtime-config.json');
  const runtimeConfigPathLog = join(root, 'logs/runtime-config-path.txt');
  const keytoolLog = join(root, 'logs/keytool-calls.tsv');
  const artifact = join(gameDir, 'build/artifacts/android/pencil-blade-debug.apk');
  const gradleDebugKeystore = join(homeDir, '.android/debug.keystore');
  const creatorDebugKeystore = join(
    dirname(dirname(creatorBin)),
    'Resources/tools/keystore/debug.keystore',
  );

  for (const directory of [
    scriptsDir,
    dirname(configPath),
    callerCwd,
    dirname(programProfile),
    dirname(syntheticApk),
    dirname(creatorLog),
    dirname(gradleDebugKeystore),
    join(javaHome, 'bin'),
    join(sdkRoot, 'platforms/android-36'),
    join(sdkRoot, 'build-tools/36.0.0'),
    join(sdkRoot, 'cmake/3.22.1/bin'),
    ndkRoot,
    dirname(creatorBin),
    join(gameDir, 'native/engine/android'),
  ]) {
    mkdirSync(directory, { recursive: true });
  }

  copyFileSync(sourceScript, scriptPath);
  copyFileSync(sourceConfig, configPath);
  copyFileSync(sourceAudit, auditPath);
  chmodSync(scriptPath, 0o755);

  writeFileSync(
    creatorInfo,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"',
      '  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>CFBundleShortVersionString</key>',
      '  <string>3.8.8</string>',
      '  <key>CFBundleVersion</key>',
      '  <string>3.8.8</string>',
      '</dict>',
      '</plist>',
      '',
    ].join('\n'),
  );

  writeExecutable(
    creatorBin,
    `#!/bin/sh
set -eu
printf 'creator' > "$FAKE_CREATOR_LOG"
for argument in "$@"; do
  printf '\\t%s' "$argument" >> "$FAKE_CREATOR_LOG"
done
printf '\\n' >> "$FAKE_CREATOR_LOG"

project_path=""
build_options=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --project)
      shift
      project_path=\${1:-}
      ;;
    --build)
      shift
      build_options=\${1:-}
      ;;
  esac
  shift
done

runtime_config_path=\${build_options#*configPath=}
[ "$runtime_config_path" != "$build_options" ] || {
  printf 'Creator did not receive configPath\\n' >&2
  exit 90
}
runtime_config_path=\${runtime_config_path%%;*}
[ -f "$runtime_config_path" ] || {
  printf 'Creator runtime config is missing: %s\\n' "$runtime_config_path" >&2
  exit 91
}
printf '%s\\n' "$runtime_config_path" > "$FAKE_RUNTIME_CONFIG_PATH_LOG"
cp "$runtime_config_path" "$FAKE_RUNTIME_CONFIG_LOG"

if [ -n "\${FAKE_CREATOR_DELAY:-}" ]; then
  sleep "$FAKE_CREATOR_DELAY"
fi

creator_status=\${FAKE_CREATOR_EXIT:-36}
if [ "$creator_status" -eq 36 ]; then
  gradle_project="$project_path/build/android-debug/proj"
  native_dir="$project_path/native/engine/android"
  if [ -n "\${FAKE_NATIVE_DIR:-}" ]; then
    native_dir=$FAKE_NATIVE_DIR
  fi
  app_module_name=\${FAKE_APP_MODULE_NAME:-CocosGame}
  mkdir -p "$gradle_project/gradle/wrapper" "$native_dir/app"
  cp "$FAKE_GRADLE_TEMPLATE" "$gradle_project/gradlew"
  chmod +x "$gradle_project/gradlew"
  {
    printf 'PROP_COMPILE_SDK_VERSION=36\\n'
    printf 'PROP_MIN_SDK_VERSION=21\\n'
    printf 'PROP_TARGET_SDK_VERSION=36\\n'
    printf 'PROP_BUILD_TOOLS_VERSION=36.0.0\\n'
    printf 'PROP_NDK_VERSION=28.2.13676358\\n'
    printf 'PROP_IS_DEBUG=true\\n'
    printf 'APPLICATION_ID=io.github.dantech0xff.pencilblade.debug\\n'
    printf 'PROP_APP_ABI=arm64-v8a\\n'
    printf 'NATIVE_DIR=%s\\n' "$native_dir"
  } > "$gradle_project/gradle.properties"
  printf 'sdk.dir=%s\\n' "$ANDROID_SDK_ROOT" > "$gradle_project/local.properties"
  printf "classpath 'com.android.tools.build:gradle:8.10.1'\\n" > "$gradle_project/build.gradle"
  printf 'distributionUrl=https\\\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip\\n' \\
    > "$gradle_project/gradle/wrapper/gradle-wrapper.properties"
  {
    printf "include ':libcocos',':libservice',':app'\\n"
    printf "project(':app').projectDir = new File(NATIVE_DIR, 'app')\\n"
    printf "project(':app').name = \\"%s\\"\\n" "$app_module_name"
  } > "$gradle_project/settings.gradle"
  printf 'externalNativeBuild { cmake { version "3.22.1" } }\\n' \\
    > "$native_dir/app/build.gradle"
fi
exit "$creator_status"
`,
  );

  writeExecutable(
    fakeGradle,
    `#!/bin/sh
set -eu
printf 'gradle' > "$FAKE_GRADLE_LOG"
for argument in "$@"; do
  printf '\\t%s' "$argument" >> "$FAKE_GRADLE_LOG"
done
printf '\\n' >> "$FAKE_GRADLE_LOG"

apk_dir="$PWD/build/CocosGame/outputs/apk/debug"
case "\${FAKE_APK_MODE:-success}" in
  success)
    mkdir -p "$apk_dir"
    cp "$FAKE_APK_FIXTURE" "$apk_dir/CocosGame-debug.apk"
    ;;
  zero)
    ;;
  multiple)
    mkdir -p "$apk_dir"
    cp "$FAKE_APK_FIXTURE" "$apk_dir/CocosGame-debug.apk"
    cp "$FAKE_APK_FIXTURE" "$apk_dir/duplicate-debug.apk"
    ;;
  stale)
    mkdir -p "$apk_dir"
    cp "$FAKE_APK_FIXTURE" "$apk_dir/CocosGame-debug.apk"
    touch -t 200001010000 "$apk_dir/CocosGame-debug.apk"
    ;;
  *)
    printf 'unknown fake APK mode: %s\\n' "$FAKE_APK_MODE" >&2
    exit 2
    ;;
esac
`,
  );

  writeExecutable(
    join(javaHome, 'bin/java'),
    [
      '#!/bin/sh',
      'printf \'openjdk version "17.0.15" 2025-04-15 LTS\\n\' >&2',
      'printf \'OpenJDK Runtime Environment Zulu17.58+21-CA (build 17.0.15+6-LTS)\\n\' >&2',
      '',
    ].join('\n'),
  );
  writeExecutable(
    join(javaHome, 'bin/javac'),
    '#!/bin/sh\nprintf \'javac 17.0.15\\n\'\n',
  );
  writeExecutable(
    join(javaHome, 'bin/keytool'),
    `#!/bin/sh
set -eu
keystore_path=""
alias_name=""
storepass=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -keystore)
      shift
      keystore_path=\${1:-}
      ;;
    -alias)
      shift
      alias_name=\${1:-}
      ;;
    -storepass)
      shift
      storepass=\${1:-}
      ;;
  esac
  shift
done

case "$alias_name:$storepass" in
  androiddebugkey:android)
    certificate_sha256=$FAKE_GRADLE_DEBUG_CERTIFICATE_SHA256
    ;;
  debug_keystore:123456)
    certificate_sha256=$FAKE_CREATOR_DEBUG_CERTIFICATE_SHA256
    ;;
  *)
    exit 2
    ;;
esac

printf '%s\\t%s\\n' "$keystore_path" "$alias_name" >> "$FAKE_KEYTOOL_LOG"
case "\${FAKE_KEYTOOL_MODE:-valid}" in
  valid)
    fingerprint=$(printf '%s\\n' "$certificate_sha256" |
      sed 's/../&:/g; s/:$//')
    printf 'Alias name: %s\\n' "$alias_name"
    printf 'Certificate fingerprints:\\n'
    printf '         SHA256: %s\\n' "$fingerprint"
    ;;
  malformed)
    printf 'Certificate fingerprints:\\n'
    printf '         SHA256: not-a-fingerprint\\n'
    ;;
  failure)
    exit 3
    ;;
  *)
    exit 4
    ;;
esac
`,
  );
  writeExecutable(
    join(sdkRoot, 'cmake/3.22.1/bin/cmake'),
    '#!/bin/sh\nprintf \'cmake version 3.22.1\\n\'\n',
  );
  writeExecutable(
    join(sdkRoot, 'build-tools/36.0.0/aapt'),
    `#!/bin/sh
if [ "\${1:-}" = "dump" ] && [ "\${2:-}" = "badging" ]; then
  printf '%s\\n' "$FAKE_AAPT_BADGING_OUTPUT"
  exit 0
fi
printf 'Android Asset Packaging Tool, v0.2\\n'
`,
  );
  writeExecutable(
    join(sdkRoot, 'build-tools/36.0.0/apksigner'),
    `#!/bin/sh
printf '%s\\n' "$FAKE_APKSIGNER_OUTPUT"
exit "\${FAKE_APKSIGNER_EXIT:-0}"
`,
  );
  writeFileSync(join(sdkRoot, 'platforms/android-36/android.jar'), '');
  writeFileSync(join(ndkRoot, 'source.properties'), 'Pkg.Revision = 28.2.13676358\n');
  writeFileSync(
    join(sdkRoot, 'cmake/3.22.1/source.properties'),
    'Pkg.Revision = 3.22.1\n',
  );
  writeFileSync(
    programProfile,
    `${JSON.stringify({
      __version__: '1.0.4',
      androidSDK: {
        commandArgument: '',
        path: sdkRoot,
      },
      androidNDK: {
        commandArgument: '',
        path: ndkRoot,
      },
      javaHome: {
        commandArgument: '',
        path: javaHome,
      },
    }, null, 2)}\n`,
  );
  createStoredArchive(syntheticApk, [
    ['assets/main/index.js', 'export const reconstructed = true;'],
  ]);
  writeFileSync(gradleDebugKeystore, 'Gradle debug keystore\n');

  return {
    artifact,
    callerCwd,
    configPath,
    creatorBin,
    creatorLog,
    fakeGradle,
    gameDir,
    gradleDebugKeystore,
    gradleLog,
    homeDir,
    javaHome,
    keytoolLog,
    ndkRoot,
    programProfile,
    root,
    runtimeConfigLog,
    runtimeConfigPathLog,
    scriptPath,
    sdkRoot,
    syntheticApk,
    creatorDebugKeystore,
  };
}

function runBuild(fixture, options = {}) {
  resetRunLogs(fixture);
  return spawnSync('/bin/sh', [fixture.scriptPath], {
    cwd: fixture.callerCwd,
    encoding: 'utf8',
    env: buildEnvironment(fixture, options),
    maxBuffer: 4 * 1024 * 1024,
  });
}

function resetRunLogs(fixture) {
  rmSync(fixture.creatorLog, { force: true });
  rmSync(fixture.gradleLog, { force: true });
  rmSync(fixture.keytoolLog, { force: true });
  rmSync(fixture.runtimeConfigLog, { force: true });
  rmSync(fixture.runtimeConfigPathLog, { force: true });
}

function buildEnvironment(
  fixture,
  {
    aaptOutput = aaptBadgingReport(),
    androidUserHome = '',
    apksignerExit = 0,
    apksignerOutput = apksignerReport(gradleDebugCertificateSha256),
    appModuleName = 'CocosGame',
    creatorExit = 36,
    apkMode = 'success',
    creatorDelay = '',
    keytoolMode = 'valid',
    nativeDir = '',
  } = {},
) {
  const env = {
    ...process.env,
    ANDROID_HOME: fixture.sdkRoot,
    ANDROID_NDK_HOME: fixture.ndkRoot,
    ANDROID_NDK_ROOT: fixture.ndkRoot,
    ANDROID_SDK_ROOT: fixture.sdkRoot,
    COCOS_CREATOR_BIN: fixture.creatorBin,
    FAKE_AAPT_BADGING_OUTPUT: aaptOutput,
    FAKE_APKSIGNER_EXIT: String(apksignerExit),
    FAKE_APKSIGNER_OUTPUT: apksignerOutput,
    FAKE_APK_FIXTURE: fixture.syntheticApk,
    FAKE_APK_MODE: apkMode,
    FAKE_APP_MODULE_NAME: appModuleName,
    FAKE_CREATOR_DELAY: creatorDelay,
    FAKE_CREATOR_EXIT: String(creatorExit),
    FAKE_CREATOR_LOG: fixture.creatorLog,
    FAKE_GRADLE_LOG: fixture.gradleLog,
    FAKE_GRADLE_TEMPLATE: fixture.fakeGradle,
    FAKE_GRADLE_DEBUG_CERTIFICATE_SHA256: gradleDebugCertificateSha256,
    FAKE_CREATOR_DEBUG_CERTIFICATE_SHA256: creatorDebugCertificateSha256,
    FAKE_KEYTOOL_LOG: fixture.keytoolLog,
    FAKE_KEYTOOL_MODE: keytoolMode,
    FAKE_NATIVE_DIR: nativeDir,
    FAKE_RUNTIME_CONFIG_LOG: fixture.runtimeConfigLog,
    FAKE_RUNTIME_CONFIG_PATH_LOG: fixture.runtimeConfigPathLog,
    HOME: fixture.homeDir,
    JAVA_HOME: fixture.javaHome,
    NDK_HOME: fixture.ndkRoot,
    NODE_BIN: process.execPath,
  };
  if (androidUserHome) {
    env.ANDROID_USER_HOME = androidUserHome;
  } else {
    delete env.ANDROID_USER_HOME;
  }
  delete env.COCOS_CREATOR_PROGRAM_PROFILE;
  return env;
}

function aaptBadgingReport(
  nativeCodeLines = ["native-code: 'arm64-v8a'"],
) {
  return [
    "package: name='io.github.dantech0xff.pencilblade.debug'"
      + " versionCode='1' versionName='1.0'",
    "sdkVersion:'21'",
    "targetSdkVersion:'36'",
    'application-debuggable',
    ...nativeCodeLines,
  ].join('\n');
}

function apksignerReport(
  certificateSha256,
  distinguishedName = 'CN=Android Debug, O=Android, C=US',
) {
  return [
    'Verifies',
    'Number of signers: 1',
    `Signer #1 certificate DN: ${distinguishedName}`,
    `Signer #1 certificate SHA-256 digest: ${certificateSha256}`,
  ].join('\n');
}

async function waitForFile(path, child) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(path)) {
      return;
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`build exited before creating ${path}`);
    }
    await delay(25);
  }
  throw new Error(`timed out waiting for ${path}`);
}

function writeExecutable(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function walkObject(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((entry) => walkObject(entry, visitor));
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    visitor(key, entry);
    walkObject(entry, visitor);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function createStoredArchive(artifact, entries) {
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;

  for (const [entryPath, contents] of entries) {
    const pathBytes = Buffer.from(entryPath, 'utf8');
    const contentsBytes = Buffer.from(contents);
    const checksum = crc32(contentsBytes);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(contentsBytes.length, 18);
    localHeader.writeUInt32LE(contentsBytes.length, 22);
    localHeader.writeUInt16LE(pathBytes.length, 26);
    localRecords.push(localHeader, pathBytes, contentsBytes);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(contentsBytes.length, 20);
    centralHeader.writeUInt32LE(contentsBytes.length, 24);
    centralHeader.writeUInt16LE(pathBytes.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralRecords.push(centralHeader, pathBytes);

    localOffset += localHeader.length + pathBytes.length + contentsBytes.length;
  }

  const centralBytes = Buffer.concat(centralRecords);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(localOffset, 16);

  writeFileSync(
    artifact,
    Buffer.concat([...localRecords, centralBytes, eocd]),
  );
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

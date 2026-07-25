#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const APK_PATH = resolve(ROOT, 'game/build/artifacts/android/pencil-blade-debug.apk');
const REPORT_DIR = resolve(
  ROOT,
  'plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix',
);
const PACKAGE = 'io.github.dantech0xff.pencilblade.debug';
const ACTIVITY = `${PACKAGE}/com.cocos.game.AppActivity`;
const EXPECTED_ABI = 'arm64-v8a';
const ERROR_PATTERNS = [
  /FATAL EXCEPTION/iu,
  /SIGSEGV/iu,
  /persistent mesh is incomplete/iu,
  /(?:TypeError|RangeError|ReferenceError):/u,
  /java\.lang\.RuntimeException/iu,
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function pause(milliseconds) {
  return new Promise((accept) => {
    setTimeout(accept, milliseconds);
  });
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    encoding: options.binary ? null : 'utf8',
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    timeout: options.timeout ?? 30_000,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${commandName} ${args.join(' ')} failed (${result.status}): `
      + `${String(result.stderr ?? '').trim()}`,
    );
  }
  return result;
}

function adb(serial, args, options = {}) {
  return command('adb', ['-s', serial, ...args], options);
}

function adbText(serial, args, options = {}) {
  return String(adb(serial, args, options).stdout).trim();
}

function screenshot(serial, path) {
  const bytes = adb(serial, ['exec-out', 'screencap', '-p'], { binary: true }).stdout;
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`Android screenshot is not a PNG: ${path}`);
  }
  writeFileSync(path, bytes);
  return {
    path: path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path,
    bytes: bytes.length,
    sha256: sha256(bytes),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function parsePhysicalSize(value) {
  const match = /Physical size:\s*(\d+)x(\d+)/u.exec(value);
  if (match === null) {
    throw new Error(`Unable to parse wm size: ${value}`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function proportionalSwipe(serial, size, start, end, durationMilliseconds = 450) {
  const coordinate = (value, axis) => String(Math.round(value * size[axis]));
  adb(serial, [
    'shell',
    'input',
    'swipe',
    coordinate(start.x, 'width'),
    coordinate(start.y, 'height'),
    coordinate(end.x, 'width'),
    coordinate(end.y, 'height'),
    String(durationMilliseconds),
  ]);
}

async function startActivity(serial) {
  return adbText(serial, ['shell', 'am', 'start', '-W', '-n', ACTIVITY]);
}

function validatedNetworks(connectivityDump) {
  return connectivityDump
    .split('\n')
    .filter((line) => (
      line.includes('NetworkAgentInfo')
      && line.includes('CONNECTED')
      && line.includes('VALIDATED')
    ))
    .map((line) => line.trim());
}

function filteredRuntimeErrors(logcat) {
  return logcat
    .split('\n')
    .filter((line) => ERROR_PATTERNS.some((pattern) => pattern.test(line)));
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function runAndroidRuntimeMatrix(options = {}) {
  const serial = options.serial ?? process.env.ANDROID_SERIAL ?? 'emulator-5554';
  const resetTestApp = options.resetTestApp ?? process.argv.includes('--reset-test-app');
  if (!resetTestApp) {
    throw new Error(
      'Refusing to clear app data without --reset-test-app; use only on a dedicated test device/emulator.',
    );
  }
  if (!existsSync(APK_PATH)) {
    throw new Error(`Android artifact is missing: ${APK_PATH}`);
  }
  mkdirSync(REPORT_DIR, { recursive: true });

  const apkBytes = readFileSync(APK_PATH);
  const apkSha256 = sha256(apkBytes);
  const originalRotation = {
    accelerometer: adbText(serial, ['shell', 'settings', 'get', 'system', 'accelerometer_rotation']),
    user: adbText(serial, ['shell', 'settings', 'get', 'system', 'user_rotation']),
  };
  const originalAirplaneMode = adbText(
    serial,
    ['shell', 'cmd', 'connectivity', 'airplane-mode'],
    { allowFailure: true },
  );

  let report;
  try {
    requireCondition(adbText(serial, ['get-state']) === 'device', `${serial} is not online`);
    const device = {
      serial,
      model: adbText(serial, ['shell', 'getprop', 'ro.product.model']),
      product: adbText(serial, ['shell', 'getprop', 'ro.product.name']),
      abi: adbText(serial, ['shell', 'getprop', 'ro.product.cpu.abi']),
      apiLevel: Number(adbText(serial, ['shell', 'getprop', 'ro.build.version.sdk'])),
      release: adbText(serial, ['shell', 'getprop', 'ro.build.version.release']),
    };
    requireCondition(device.abi === EXPECTED_ABI, `Expected ${EXPECTED_ABI}, got ${device.abi}`);

    const installOutput = adbText(serial, ['install', '-r', APK_PATH], { timeout: 120_000 });
    requireCondition(installOutput.includes('Success'), `APK install failed: ${installOutput}`);
    requireCondition(
      adbText(serial, ['shell', 'pm', 'clear', PACKAGE]) === 'Success',
      'Dedicated test app data reset failed',
    );
    const size = parsePhysicalSize(adbText(serial, ['shell', 'wm', 'size']));
    requireCondition(size.height > size.width, `Expected portrait emulator, got ${JSON.stringify(size)}`);

    adb(serial, ['logcat', '-c']);
    const coldStart = await startActivity(serial);
    requireCondition(coldStart.includes('LaunchState: COLD'), `Expected COLD start: ${coldStart}`);
    await pause(5_000);
    const mainMenu = screenshot(serial, resolve(REPORT_DIR, 'android-main-menu.png'));

    proportionalSwipe(serial, size, { x: 0.38, y: 0.62 }, { x: 0.79, y: 0.62 });
    await pause(2_000);
    const modeSelect = screenshot(serial, resolve(REPORT_DIR, 'android-mode-select.png'));
    requireCondition(
      mainMenu.sha256 !== modeSelect.sha256,
      'New Game gesture did not change the Android frame',
    );

    proportionalSwipe(serial, size, { x: 0.30, y: 0.57 }, { x: 0.72, y: 0.57 });
    await pause(3_000);
    const classic = screenshot(serial, resolve(REPORT_DIR, 'android-classic.png'));
    requireCondition(
      modeSelect.sha256 !== classic.sha256,
      'Classic gesture did not change the Android frame',
    );
    proportionalSwipe(serial, size, { x: 0.20, y: 0.80 }, { x: 0.80, y: 0.55 }, 350);
    await pause(500);

    const processIdBeforeBackground = adbText(serial, ['shell', 'pidof', PACKAGE]);
    adb(serial, ['shell', 'input', 'keyevent', 'KEYCODE_HOME']);
    await pause(1_000);
    const hotStart = await startActivity(serial);
    const processIdAfterResume = adbText(serial, ['shell', 'pidof', PACKAGE]);
    requireCondition(
      processIdBeforeBackground.length > 0
        && processIdAfterResume === processIdBeforeBackground
        && (
          hotStart.includes('LaunchState: HOT')
          || hotStart.includes('current task has been brought to the front')
        ),
      `Expected same-process activity resume: ${hotStart}`,
    );
    const resumedActivity = adbText(serial, ['shell', 'dumpsys', 'activity', 'activities'])
      .split('\n')
      .find((line) => line.includes('topResumedActivity'));
    requireCondition(
      resumedActivity?.includes(PACKAGE) === true,
      `App did not resume to foreground: ${resumedActivity}`,
    );

    const appFiles = adbText(serial, [
      'shell',
      'run-as',
      PACKAGE,
      'sh',
      '-c',
      'find . -maxdepth 3 -type f -print | sort',
    ]).split('\n').filter(Boolean);
    requireCondition(
      appFiles.includes('./databases/jsb.sqlite'),
      `Cocos storage database was not created: ${appFiles.join(', ')}`,
    );
    const audioDump = adbText(serial, ['shell', 'dumpsys', 'audio'], { maxBuffer: 32 * 1024 * 1024 });
    const audioFocusLines = audioDump
      .split('\n')
      .filter((line) => line.includes(PACKAGE) && line.includes('USAGE_GAME'));
    requireCondition(audioFocusLines.length > 0, 'No USAGE_GAME audio-focus evidence was recorded');

    adb(serial, ['shell', 'cmd', 'connectivity', 'airplane-mode', 'enable']);
    adb(serial, ['shell', 'svc', 'wifi', 'disable']);
    adb(serial, ['shell', 'svc', 'data', 'disable']);
    await pause(2_000);
    const offlineConnectivity = adbText(
      serial,
      ['shell', 'dumpsys', 'connectivity'],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    const offlineValidatedNetworks = validatedNetworks(offlineConnectivity);
    requireCondition(
      offlineValidatedNetworks.length === 0,
      `Validated network remained during offline test: ${offlineValidatedNetworks[0]}`,
    );
    adb(serial, ['shell', 'am', 'force-stop', PACKAGE]);
    const offlineStart = await startActivity(serial);
    requireCondition(offlineStart.includes('LaunchState: COLD'), `Offline cold start failed: ${offlineStart}`);
    await pause(5_000);
    const offline = screenshot(serial, resolve(REPORT_DIR, 'android-offline-cold-start.png'));
    requireCondition(offline.width === size.width && offline.height === size.height, 'Offline frame size drifted');

    adb(serial, ['shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0']);
    adb(serial, ['shell', 'settings', 'put', 'system', 'user_rotation', '1']);
    await pause(2_000);
    const rotationDiagnostic = screenshot(
      serial,
      resolve(REPORT_DIR, 'android-landscape-request-portrait-lock.png'),
    );
    const activityConfiguration = adbText(serial, ['shell', 'dumpsys', 'activity', 'activities'])
      .split('\n')
      .find((line) => line.includes('overrideConfig=') && line.includes('mAppBounds='));
    requireCondition(
      rotationDiagnostic.width === size.width
        && rotationDiagnostic.height === size.height
        && activityConfiguration?.includes(' port ') === true
        && activityConfiguration.includes('mDisplayRotation=ROTATION_0'),
      `Portrait lock failed under landscape request: ${activityConfiguration}`,
    );

    const logcat = adbText(
      serial,
      ['logcat', '-d', '-v', 'threadtime'],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const runtimeErrors = filteredRuntimeErrors(logcat);
    requireCondition(runtimeErrors.length === 0, `Android runtime errors: ${runtimeErrors.join('\n')}`);

    report = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      artifact: {
        path: 'game/build/artifacts/android/pencil-blade-debug.apk',
        bytes: apkBytes.length,
        sha256: apkSha256,
        package: PACKAGE,
        activity: ACTIVITY,
      },
      device,
      input: {
        newGameGestureChangedFrame: true,
        classicGestureChangedFrame: true,
        gameplaySwipeCompleted: true,
      },
      graphics: {
        physicalSize: size,
        screenshots: [mainMenu, modeSelect, classic, offline, rotationDiagnostic],
      },
      audio: {
        focus: 'pass',
        usage: 'USAGE_GAME',
        evidence: audioFocusLines.slice(-3),
      },
      storage: {
        status: 'pass',
        appSandboxFiles: appFiles,
        database: './databases/jsb.sqlite',
      },
      lifecycle: {
        coldStart: 'pass',
        hotResume: 'pass',
        processIdBeforeBackground,
        processIdAfterResume,
        topResumedActivity: resumedActivity.trim(),
      },
      orientation: {
        policy: 'portrait',
        landscapeRequest: 'ignored-by-activity-policy',
        screenshotSize: {
          width: rotationDiagnostic.width,
          height: rotationDiagnostic.height,
        },
        activityConfiguration: activityConfiguration.trim(),
      },
      offline: {
        coldStart: 'pass',
        airplaneMode: 'enabled',
        wifi: 'disabled',
        mobileData: 'disabled',
        validatedNetworks: offlineValidatedNetworks,
      },
      errors: runtimeErrors,
      status: 'pass',
    };
    const reportPath = resolve(REPORT_DIR, 'android-runtime-matrix.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return { reportPath, report };
  } finally {
    adb(serial, ['shell', 'settings', 'put', 'system', 'user_rotation', originalRotation.user], {
      allowFailure: true,
    });
    adb(serial, [
      'shell',
      'settings',
      'put',
      'system',
      'accelerometer_rotation',
      originalRotation.accelerometer,
    ], { allowFailure: true });
    adb(serial, ['shell', 'svc', 'wifi', 'enable'], { allowFailure: true });
    adb(serial, ['shell', 'svc', 'data', 'enable'], { allowFailure: true });
    adb(serial, [
      'shell',
      'cmd',
      'connectivity',
      'airplane-mode',
      originalAirplaneMode === 'enabled' ? 'enable' : 'disable',
    ], { allowFailure: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { reportPath, report } = await runAndroidRuntimeMatrix();
  process.stdout.write(
    `PASS: Android ${report.device.abi} API ${report.device.apiLevel}; `
    + `APK ${report.artifact.sha256}; report ${reportPath}\n`,
  );
}

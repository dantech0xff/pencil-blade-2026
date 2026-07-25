#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const android = readFileSync('scripts/run-android-runtime-matrix.mjs', 'utf8');
const h5 = readFileSync('scripts/run-h5-runtime-matrix.mjs', 'utf8');

assert.match(android, /--reset-test-app/u);
assert.match(android, /arm64-v8a/u);
assert.match(android, /LaunchState: COLD/u);
assert.match(android, /LaunchState: HOT/u);
assert.match(android, /USAGE_GAME/u);
assert.match(android, /jsb\.sqlite/u);
assert.match(android, /airplane-mode/u);
assert.match(android, /accelerometer_rotation/u);
assert.match(android, /persistent mesh is incomplete/u);
assert.match(android, /finally \{/u);

assert.match(h5, /chrome-480x800/u);
assert.match(h5, /chrome-720x1280/u);
assert.match(h5, /dispatchTouchEvent/u);
assert.match(h5, /AudioContext/u);
assert.match(h5, /localStorage/u);
assert.match(h5, /setOffline\(true\)/u);
assert.match(h5, /setViewportSize/u);
assert.match(h5, /pageerror/u);
assert.match(h5, /requestfailed/u);

process.stdout.write('PASS runtime matrix runner contracts\n');

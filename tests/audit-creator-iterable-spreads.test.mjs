import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

import {
  auditCreatorIterableSpreads,
  DEFAULT_CREATOR_TYPESCRIPT_PATH,
} from '../scripts/audit-creator-iterable-spreads.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(repositoryRoot, 'scripts/audit-creator-iterable-spreads.mjs');
const testRoot = mkdtempSync(join(tmpdir(), 'creator-iterable-spread-audit-'));
const compilerAvailable = existsSync(DEFAULT_CREATOR_TYPESCRIPT_PATH);
let fixtureOrdinal = 0;

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('array and tuple spreads pass while direct Set and Map iteration stays out of scope', {
  skip: !compilerAvailable,
}, () => {
  const fixture = createFixture('safe', `
const collect = (...items: readonly unknown[]): readonly unknown[] => items;
function copy<T extends readonly unknown[]>(items: T): readonly unknown[] {
  return [...items];
}
function invoke<T extends readonly unknown[]>(items: T): readonly unknown[] {
  return collect(...items);
}
const numbers: readonly number[] = [1, 2, 3];
const pair: readonly [string, number] = ['one', 1];
export const copies = [...numbers, ...pair, ...copy(pair)];
export const calls = [collect(...numbers), collect(...pair), invoke(numbers)];
const setValues = new Set(numbers);
const mapValues = new Map<string, number>();
for (const value of setValues) {
  void value;
}
for (const entry of mapValues) {
  void entry;
}
`.trimStart());

  const result = runCli(fixture.projectPath, [
    `--typescript=${DEFAULT_CREATOR_TYPESCRIPT_PATH}`,
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Creator iterable spread audit: PASS/u);
  assert.match(result.stdout, /array spreads/u);
  assert.match(result.stdout, /call spreads/u);
  assert.equal(result.stderr, '');
});

test('Set, Map, and Map iterator operands are rejected with exact sites and types', {
  skip: !compilerAvailable,
}, () => {
  const fixture = createFixture('unsafe', `
const collect = (...items: unknown[]): readonly unknown[] => items;
const setValues = new Set<number>([1, 2]);
const mapValues = new Map<string, number>();
export const setCopy = [...setValues];
export const mapCopy = [...mapValues];
collect(...setValues);
collect(...mapValues.values());
for (const value of setValues) {
  void value;
}
for (const entry of mapValues) {
  void entry;
}
`.trimStart(), 'unsafe-spreads.ts');

  const result = runCli(fixture.projectPath, [
    '--typescript', DEFAULT_CREATOR_TYPESCRIPT_PATH,
  ]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Creator iterable spread audit: BLOCKED/u);
  assert.match(
    result.stderr,
    /assets\/scripts\/unsafe-spreads\.ts:4:\d+ array spread operand type "Set<number>" is not an array or tuple/u,
  );
  assert.match(
    result.stderr,
    /assets\/scripts\/unsafe-spreads\.ts:5:\d+ array spread operand type "Map<string, number>" is not an array or tuple/u,
  );
  assert.match(
    result.stderr,
    /assets\/scripts\/unsafe-spreads\.ts:6:\d+ call spread operand type "Set<number>" is not an array or tuple/u,
  );
  assert.match(
    result.stderr,
    /assets\/scripts\/unsafe-spreads\.ts:7:\d+ call spread operand type "MapIterator<number>" is not an array or tuple/u,
  );
  assert.equal(result.stderr.match(/spread operand type/gu)?.length, 4);
});

test('compiler can be selected through the environment', {
  skip: !compilerAvailable,
}, () => {
  const fixture = createFixture('environment-override', `
const values: readonly number[] = [1, 2];
export const copy = [...values];
`.trimStart());
  const env = {
    ...process.env,
    COCOS_CREATOR_TYPESCRIPT_PATH: DEFAULT_CREATOR_TYPESCRIPT_PATH,
  };
  delete env.CREATOR_TYPESCRIPT_PATH;

  const result = runCli(fixture.projectPath, [], env);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Creator iterable spread audit: PASS/u);
});

test('an explicitly missing compiler fails instead of falling back to an available compiler', () => {
  const fixture = createFixture('missing-compiler', 'export const values = [1, 2];\n');
  const missingCompiler = join(testRoot, 'missing-typescript.js');
  const env = {
    ...process.env,
    COCOS_CREATOR_TYPESCRIPT_PATH: DEFAULT_CREATOR_TYPESCRIPT_PATH,
  };

  const result = runCli(fixture.projectPath, [
    '--typescript', missingCompiler,
  ], env);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Creator iterable spread audit: ERROR/u);
  assert.match(
    result.stderr,
    new RegExp(`TypeScript compiler does not exist: ${escapeRegExp(missingCompiler)}`, 'u'),
  );
  assert.doesNotMatch(result.stderr, /\bPASS\b/u);
});

test('the remediated Creator project has no unsafe spread operands or compiler errors', {
  skip: !compilerAvailable,
}, () => {
  const result = auditCreatorIterableSpreads({
    projectPath: join(repositoryRoot, 'game/tsconfig.json'),
    typescriptPath: DEFAULT_CREATOR_TYPESCRIPT_PATH,
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.findings, []);
  assert.ok(result.arraySpreadCount > 0);
  assert.ok(result.callSpreadCount > 0);
  assert.ok(result.sourceFileCount > 0);
});

function createFixture(label, source, fileName = 'fixture.ts') {
  fixtureOrdinal += 1;
  const fixtureRoot = join(testRoot, `${label}-${fixtureOrdinal}`);
  const scriptsRoot = join(fixtureRoot, 'assets/scripts');
  mkdirSync(scriptsRoot, { recursive: true });
  writeFileSync(join(scriptsRoot, fileName), source);
  const projectPath = join(fixtureRoot, 'tsconfig.json');
  writeFileSync(projectPath, `${JSON.stringify({
    compilerOptions: {
      lib: ['ES2015'],
      module: 'ES2015',
      moduleResolution: 'node',
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: 'ES2015',
    },
    include: ['assets/scripts/**/*.ts'],
  }, null, 2)}\n`);
  return Object.freeze({ projectPath });
}

function runCli(projectPath, extraArguments = [], env = process.env) {
  return spawnSync(process.execPath, [
    scriptPath,
    '--project', projectPath,
    ...extraArguments,
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

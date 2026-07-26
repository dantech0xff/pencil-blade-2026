import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';

import {
  composeCaseStudyPages,
  GAME_MOUNT,
} from '../scripts/compose-case-study-pages.mjs';

const testRoot = mkdtempSync(join(tmpdir(), 'pencil-blade-case-study-compose-'));
let fixtureIndex = 0;

after(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

test('composition preserves site and game bytes at the fixed mount', () => {
  const fixture = createFixture();
  const result = composeCaseStudyPages(fixture);

  assert.equal(result.gameMount, 'play/game/');
  assert.equal(GAME_MOUNT, 'play/game');
  assert.deepEqual(
    readFileSync(join(fixture.outDir, 'play/game/index.html')),
    readFileSync(join(fixture.gameDist, 'index.html')),
  );
  assert.deepEqual(
    readFileSync(join(fixture.outDir, 'play/game/assets/payload.bin')),
    readFileSync(join(fixture.gameDist, 'assets/payload.bin')),
  );
  assert.deepEqual(
    treeRecords(fixture.outDir),
    [
      ...treeRecords(fixture.siteDist),
      ...treeRecords(fixture.gameDist).map((file) => ({
        ...file,
        path: `play/game/${file.path}`,
      })),
    ].sort((left, right) => left.path.localeCompare(right.path)),
  );
});

test('composition is deterministic across clean output directories', () => {
  const first = createFixture();
  const second = {
    siteDist: first.siteDist,
    gameDist: first.gameDist,
    outDir: join(testRoot, 'deterministic-second'),
  };
  composeCaseStudyPages(first);
  composeCaseStudyPages(second);

  assert.deepEqual(treeRecords(first.outDir), treeRecords(second.outDir));
});

test('dirty output and source/output overlap fail before copying', () => {
  const fixture = createFixture();
  mkdirSync(fixture.outDir, { recursive: true });
  writeFileSync(join(fixture.outDir, 'dirty.txt'), 'do not overwrite');

  assert.throws(
    () => composeCaseStudyPages(fixture),
    /output directory must be empty/u,
  );
  assert.equal(readFileSync(join(fixture.outDir, 'dirty.txt'), 'utf8'), 'do not overwrite');
  assert.throws(
    () => composeCaseStudyPages({
      ...fixture,
      outDir: join(fixture.siteDist, 'candidate'),
    }),
    /must not overlap/u,
  );
});

test('site collisions with the reserved game mount fail closed', () => {
  const fixture = createFixture();
  writeFixtureFile(fixture.siteDist, 'play/game/index.html', 'site collision');

  assert.throws(
    () => composeCaseStudyPages(fixture),
    /composition path collision at play\/game/u,
  );
});

test('symlinks and encoded traversal names are rejected', () => {
  const linked = createFixture();
  const outside = join(testRoot, 'outside.bin');
  writeFileSync(outside, 'outside');
  symlinkSync(outside, join(linked.gameDist, 'linked.bin'));
  assert.throws(
    () => composeCaseStudyPages(linked),
    /symbolic link/u,
  );

  const encoded = createFixture();
  writeFixtureFile(encoded.siteDist, '%2e%2e/escape.txt', 'escape');
  assert.throws(
    () => composeCaseStudyPages(encoded),
    /unsafe or escaping path/u,
  );

  const linkedOutput = createFixture();
  const realOutput = join(testRoot, 'real-empty-output');
  mkdirSync(realOutput);
  symlinkSync(realOutput, linkedOutput.outDir, 'dir');
  assert.throws(
    () => composeCaseStudyPages(linkedOutput),
    /output path must not be a symbolic link/u,
  );
});

test('required bilingual launch files and game entry must exist', () => {
  const fixture = createFixture();
  rmSync(join(fixture.siteDist, 'vi/play/index.html'));
  assert.throws(
    () => composeCaseStudyPages(fixture),
    /missing required launch route: vi\/play\/index\.html/u,
  );

  const missingGame = createFixture();
  rmSync(join(missingGame.gameDist, 'index.html'));
  assert.throws(
    () => composeCaseStudyPages(missingGame),
    /game build is missing required entry/u,
  );
});

function createFixture() {
  fixtureIndex += 1;
  const root = join(testRoot, `fixture-${fixtureIndex}`);
  const siteDist = join(root, 'site');
  const gameDist = join(root, 'game');
  for (const path of [
    'index.html',
    'play/index.html',
    'vi/index.html',
    'vi/play/index.html',
  ]) {
    writeFixtureFile(siteDist, path, `site:${path}`);
  }
  writeFixtureFile(siteDist, 'assets/site.css', 'body { color: black; }');
  writeFixtureFile(gameDist, 'index.html', '<canvas></canvas>');
  writeFixtureFile(gameDist, 'assets/payload.bin', Buffer.from([0, 1, 2, 3, 255]));
  return {
    gameDist,
    outDir: join(root, 'candidate'),
    siteDist,
  };
}

function writeFixtureFile(root, path, contents) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function treeRecords(root, relativePath = '') {
  const records = [];
  const directory = join(root, relativePath);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      records.push(...treeRecords(root, path));
    } else {
      const bytes = readFileSync(join(root, path));
      records.push({
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASSIC_CORE_AUDIO_PATHS,
  CLASSIC_FRUIT_CUT_AUDIO_PATHS,
  CLASSIC_MODE_SELECTED_AUDIO_PATH,
  CLASSIC_TOSS_AUDIO_PATH,
  getClassicComboAudioPath,
  getClassicFruitCutAudioSequence,
  getClassicSwishAudioPath,
} from '../../../game/assets/scripts/domain/classic-audio-contract.ts';
import { canonicalResourceToBundlePath } from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const STAGING_MANIFEST = readJson<{
  readonly entries: readonly { readonly canonicalPath: string }[];
}>('assets/catalog/creator-staging-manifest.json');
const STAGED_PATHS = new Set(STAGING_MANIFEST.entries.map((entry) => entry.canonicalPath));

test('all 20 recovered core clips are unique, staged, and imported as AudioClips', () => {
  assert.equal(CLASSIC_CORE_AUDIO_PATHS.length, 20);
  assert.equal(new Set(CLASSIC_CORE_AUDIO_PATHS).size, 20);
  for (const canonicalPath of CLASSIC_CORE_AUDIO_PATHS) {
    assert.equal(STAGED_PATHS.has(canonicalPath), true, canonicalPath);
    const meta = readJson<{
      readonly imported: boolean;
      readonly importer: string;
      readonly userData: { readonly downloadMode: number };
    }>(`game/assets/game/${canonicalPath}.meta`);
    assert.equal(meta.imported, true, canonicalPath);
    assert.equal(meta.importer, 'audio-clip', canonicalPath);
    assert.equal(meta.userData.downloadMode, 0, canonicalPath);
    assert.equal(
      canonicalResourceToBundlePath(canonicalPath),
      canonicalPath.slice(0, -4),
      canonicalPath,
    );
  }
  assert.equal(CLASSIC_MODE_SELECTED_AUDIO_PATH, 'Sounds/gameplayselected.wav');
  assert.equal(CLASSIC_TOSS_AUDIO_PATH, 'Sounds/tossfruit.wav');
});

test('normal fruit IDs preserve the recovered shared cut-sound switch', () => {
  assert.deepEqual(CLASSIC_FRUIT_CUT_AUDIO_PATHS, [
    'Sounds/apple.wav',
    'Sounds/banana.wav',
    'Sounds/strawberry.wav',
    'Sounds/waterfruit.wav',
    'Sounds/waterfruit.wav',
    'Sounds/mangosteen.wav',
    'Sounds/apple.wav',
    'Sounds/strawberry.wav',
    'Sounds/apple.wav',
  ]);
  for (let fruitId = 0; fruitId <= 8; fruitId += 1) {
    assert.deepEqual(
      getClassicFruitCutAudioSequence(fruitId, false),
      [CLASSIC_FRUIT_CUT_AUDIO_PATHS[fruitId]],
    );
    assert.deepEqual(
      getClassicFruitCutAudioSequence(fruitId, true),
      [CLASSIC_FRUIT_CUT_AUDIO_PATHS[fruitId], 'Sounds/critical.wav'],
    );
  }
});

test('swish and combo draw indices map without remapping', () => {
  for (let index = 0; index <= 8; index += 1) {
    assert.equal(getClassicSwishAudioPath(index), `Sounds/swoosh${index + 1}.wav`);
  }
  for (let index = 1; index <= 3; index += 1) {
    assert.equal(getClassicComboAudioPath(index), `Sounds/compo${index}.wav`);
  }
});

test('audio selectors reject values outside recovered switch domains', () => {
  assert.throws(() => getClassicSwishAudioPath(-1), RangeError);
  assert.throws(() => getClassicSwishAudioPath(9), RangeError);
  assert.throws(() => getClassicFruitCutAudioSequence(9, false), RangeError);
  assert.throws(() => getClassicFruitCutAudioSequence(0, 1 as never), TypeError);
  assert.throws(() => getClassicComboAudioPath(0), RangeError);
  assert.throws(() => getClassicComboAudioPath(4), RangeError);
});

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8')) as T;
}

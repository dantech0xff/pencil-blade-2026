import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASSIC_CORE_AUDIO_PATHS,
  CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH,
  CLASSIC_FRUIT_CUT_AUDIO_PATHS,
  CLASSIC_MENU_BUTTON_AUDIO_PATH,
  CLASSIC_MODE_SELECTED_AUDIO_PATH,
  CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH,
  CLASSIC_ORDINARY_BOMB_AUDIO_PATHS,
  CLASSIC_RESULT_RANK_AUDIO_PATHS,
  CLASSIC_TOSS_AUDIO_PATH,
  MAIN_MENU_MUSIC_AUDIO_PATH,
  getClassicComboAudioPath,
  getClassicFruitCutAudioSequence,
  getClassicOrdinaryBombAudioPath,
  getClassicResultRankAudioPath,
  getClassicSwishAudioPath,
} from '../../../game/assets/scripts/domain/classic-audio-contract.ts';
import { canonicalResourceToBundlePath } from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const STAGING_MANIFEST = readJson<{
  readonly entries: readonly { readonly canonicalPath: string }[];
}>('assets/catalog/creator-staging-manifest.json');
const STAGED_PATHS = new Set(STAGING_MANIFEST.entries.map((entry) => entry.canonicalPath));

test('all 29 recovered core, menu, objective, music, rank, and ordinary-bomb clips are unique and staged', () => {
  assert.equal(CLASSIC_CORE_AUDIO_PATHS.length, 29);
  assert.equal(new Set(CLASSIC_CORE_AUDIO_PATHS).size, 29);
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
  assert.equal(CLASSIC_MENU_BUTTON_AUDIO_PATH, 'Sounds/menubuttonclick.wav');
  assert.equal(CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH, 'Sounds/cheer.wav');
  assert.equal(CLASSIC_TOSS_AUDIO_PATH, 'Sounds/tossfruit.wav');
  assert.equal(MAIN_MENU_MUSIC_AUDIO_PATH, 'Sounds/mainmenumusic.mp3');
});

test('ordinary-bomb audio paths stay exact and exclude the electric-only hit clip', () => {
  assert.deepEqual(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS, {
    entry: 'Sounds/boomsound.wav',
    explosion: 'Sounds/boomexplosion.wav',
    toss: 'Sounds/boomtoss.wav',
  });
  assert.equal(CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH, 'Sounds/boomhit.wav');
  assert.equal(CLASSIC_CORE_AUDIO_PATHS.includes(CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH), false);
  assert.equal(
    Object.values(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS).includes(
      CLASSIC_ELECTRIC_BOMB_HIT_AUDIO_PATH,
    ),
    false,
  );
  for (const event of ['entry', 'explosion', 'toss'] as const) {
    assert.equal(
      getClassicOrdinaryBombAudioPath(event),
      CLASSIC_ORDINARY_BOMB_AUDIO_PATHS[event],
    );
    assert.equal(
      CLASSIC_CORE_AUDIO_PATHS.includes(CLASSIC_ORDINARY_BOMB_AUDIO_PATHS[event]),
      true,
    );
  }
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
  assert.deepEqual(CLASSIC_RESULT_RANK_AUDIO_PATHS, {
    1: 'Sounds/firstplace.wav',
    2: 'Sounds/secondplace.wav',
    3: 'Sounds/thirdplace.wav',
  });
  for (let rank = 1; rank <= 3; rank += 1) {
    assert.equal(
      getClassicResultRankAudioPath(rank),
      CLASSIC_RESULT_RANK_AUDIO_PATHS[rank as 1 | 2 | 3],
    );
  }
});

test('audio selectors reject values outside recovered switch domains', () => {
  assert.throws(() => getClassicSwishAudioPath(-1), RangeError);
  assert.throws(() => getClassicSwishAudioPath(9), RangeError);
  assert.throws(() => getClassicFruitCutAudioSequence(9, false), RangeError);
  assert.throws(() => getClassicFruitCutAudioSequence(0, 1 as never), TypeError);
  assert.throws(() => getClassicComboAudioPath(0), RangeError);
  assert.throws(() => getClassicComboAudioPath(4), RangeError);
  assert.throws(() => getClassicResultRankAudioPath(0), RangeError);
  assert.throws(() => getClassicResultRankAudioPath(4), RangeError);
  assert.throws(() => getClassicOrdinaryBombAudioPath('hit' as never), RangeError);
});

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8')) as T;
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  LOADING_AUDIO_PRELOAD_COUNT,
  LOADING_AUDIO_PRELOAD_STEPS,
  LOADING_BACKGROUND_MUSIC_PRELOAD_COUNT,
  LOADING_EFFECT_PRELOAD_COUNT,
  LOADING_RASTER_RESOURCE_COUNT,
  LOADING_RASTER_RESOURCES,
  collectLoadingRasterResources,
  getLoadingRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/loading-resource-contract.ts'
);

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MANIFEST = JSON.parse(readFileSync(
  `${REPOSITORY_ROOT}/assets/catalog/creator-staging-manifest.json`,
  'utf8',
)) as {
  readonly entries: readonly {
    readonly bytes: number;
    readonly canonicalPath: string;
    readonly cocosType: string;
    readonly sha256: string;
  }[];
};
const STAGED_BY_PATH = new Map(
  MANIFEST.entries.map((entry) => [entry.canonicalPath, entry] as const),
);

const EXPECTED_RASTER_IDENTITIES = Object.freeze({
  '480x800': Object.freeze([
    ['Loading/backgroundLogo.png', 480, 800, 269_888, 'f87874212a211ee638456720078ea53584568a7ea4f9649bc27f345909e26d8f'],
    ['Loading/loadbkback.png', 193, 24, 509, 'c04709d69caab20c7b50961c61d47b100ba837826b9b258467ee79265fe7588b'],
    ['Loading/loadprocess.png', 185, 20, 2_214, 'a1fba149efa7bc89f5ebabdc6078d10c44caae1d375d6de75363dddc9eedf068'],
    ['Loading/loadbkfront.png', 197, 28, 975, 'e23aef27163f179c8a873e74a1791446e28bfcf8edd4b214d56e1e2f4575295e'],
  ]),
  '720x1280': Object.freeze([
    ['Loading/backgroundLogo.png', 775, 1280, 379_058, '849003087172b8448318a991a6db94656213edb64d429980033bbd643350d0c2'],
    ['Loading/loadbkback.png', 275, 35, 702, 'e622f620535e7f610dfade3836283847ecf1754ce45e4f53a7a85bca638a26b0'],
    ['Loading/loadprocess.png', 265, 27, 2_207, '1b31334589e44850ba36eaa81642c5061212d5fd4b12bfe295e515128b04add9'],
    ['Loading/loadbkfront.png', 281, 40, 1_330, 'bd56ca543c9b9851bfc4f7f4c3ce569054b53e29be6afde44e040655b754262d'],
  ]),
});

const EXPECTED_AUDIO_PATHS = Object.freeze([
  'Sounds/electric.mp3',
  'Sounds/GangnamStyle.mp3',
  'Sounds/mainmenumusic.mp3',
  'Sounds/apple.wav',
  'Sounds/banana.wav',
  'Sounds/boomexplosion.wav',
  'Sounds/boomhit.wav',
  'Sounds/boomsound.wav',
  'Sounds/boomtoss.wav',
  'Sounds/cheer.wav',
  'Sounds/compo1.wav',
  'Sounds/compo2.wav',
  'Sounds/compo3.wav',
  'Sounds/critical.wav',
  'Sounds/doublepoint.wav',
  'Sounds/doubletoss.wav',
  'Sounds/doubletosstrum.wav',
  'Sounds/eapplecut.wav',
  'Sounds/ehit1.wav',
  'Sounds/ehit2.wav',
  'Sounds/ehit3.wav',
  'Sounds/ehit4.wav',
  'Sounds/electricexplose.wav',
  'Sounds/finishhitmusic.wav',
  'Sounds/firstplace.wav',
  'Sounds/freeze.wav',
  'Sounds/fruitfail.wav',
  'Sounds/gameplayselected.wav',
  'Sounds/get_coins.wav',
  'Sounds/hitmusic.wav',
  'Sounds/juice1.wav',
  'Sounds/juice2.wav',
  'Sounds/juice4.wav',
  'Sounds/kiwi.wav',
  'Sounds/lightning1.wav',
  'Sounds/lightning2.wav',
  'Sounds/magnet.wav',
  'Sounds/mangosteen.wav',
  'Sounds/juice3.wav',
  'Sounds/waterfruit.wav',
  'Sounds/menubuttonclick.wav',
  'Sounds/mono1.wav',
  'Sounds/mono2.wav',
  'Sounds/orange.wav',
  'Sounds/pineapple.wav',
  'Sounds/powerup.wav',
  'Sounds/scorescreen.wav',
  'Sounds/secondplace.wav',
  'Sounds/strawberry.wav',
  'Sounds/swoosh1.wav',
  'Sounds/swoosh2.wav',
  'Sounds/swoosh3.wav',
  'Sounds/swoosh4.wav',
  'Sounds/swoosh5.wav',
  'Sounds/swoosh6.wav',
  'Sounds/swoosh7.wav',
  'Sounds/swoosh8.wav',
  'Sounds/swoosh9.wav',
  'Sounds/thirdplace.wav',
  'Sounds/timetick.wav',
  'Sounds/timeup.wav',
  'Sounds/tossfruit.wav',
]);

test('both profiles preserve the exact four native Loading rasters and source bytes', () => {
  assert.equal(LOADING_RASTER_RESOURCE_COUNT, 4);
  for (const tree of ['480x800', '720x1280'] as const) {
    const resources = collectLoadingRasterResources(tree);
    assert.equal(resources.length, LOADING_RASTER_RESOURCE_COUNT);
    assert.equal(new Set(resources.map(({ canonicalPath }) => canonicalPath)).size, 4);
    resources.forEach((resource, index) => {
      const expected = EXPECTED_RASTER_IDENTITIES[tree][index];
      assert.ok(expected);
      const [logicalPath, width, height, bytes, sha256] = expected;
      assert.equal(resource.canonicalPath, `${tree}/${logicalPath}`);
      assert.deepEqual(resource.dimensions, { height, width });
      assert.equal(resource.bytes, bytes);
      assert.equal(resource.sha256, sha256);

      const source = readFileSync(
        `${REPOSITORY_ROOT}/game/assets/game/${resource.canonicalPath}`,
      );
      assert.equal(source.length, bytes);
      assert.equal(source.readUInt32BE(16), width);
      assert.equal(source.readUInt32BE(20), height);
      assert.equal(createHash('sha256').update(source).digest('hex'), sha256);

      const staged = STAGED_BY_PATH.get(resource.canonicalPath);
      assert.ok(staged);
      assert.equal(staged.bytes, bytes);
      assert.equal(staged.sha256, sha256);
      assert.equal(staged.cocosType, 'cc.ImageAsset');
    });
  }
  assertDeepFrozen(LOADING_RASTER_RESOURCES);
});

test('native Loading preload sequence is exact, ordered, unique, and fully staged', () => {
  assert.equal(LOADING_AUDIO_PRELOAD_COUNT, 62);
  assert.equal(LOADING_BACKGROUND_MUSIC_PRELOAD_COUNT, 3);
  assert.equal(LOADING_EFFECT_PRELOAD_COUNT, 59);
  assert.equal(LOADING_AUDIO_PRELOAD_STEPS.length, 62);
  assert.deepEqual(
    LOADING_AUDIO_PRELOAD_STEPS.map(({ canonicalPath }) => canonicalPath),
    EXPECTED_AUDIO_PATHS,
  );
  assert.deepEqual(
    LOADING_AUDIO_PRELOAD_STEPS.map(({ index }) => index),
    Array.from({ length: 62 }, (_, index) => index),
  );
  assert.deepEqual(
    LOADING_AUDIO_PRELOAD_STEPS.map(({ kind }) => kind),
    [
      'background-music',
      'background-music',
      'background-music',
      ...Array.from({ length: 59 }, () => 'effect' as const),
    ],
  );
  assert.equal(new Set(EXPECTED_AUDIO_PATHS).size, 62);
  for (const canonicalPath of EXPECTED_AUDIO_PATHS) {
    assert.equal(STAGED_BY_PATH.get(canonicalPath)?.cocosType, 'cc.AudioClip');
  }
  assertDeepFrozen(LOADING_AUDIO_PRELOAD_STEPS);
});

test('profile getters reject other trees and expose native field ownership', () => {
  const compact = getLoadingRasterResources('480x800');
  assert.equal(
    compact.backgroundLogo.canonicalPath,
    '480x800/Loading/backgroundLogo.png',
  );
  assert.equal(compact.barBack.canonicalPath, '480x800/Loading/loadbkback.png');
  assert.equal(compact.progress.canonicalPath, '480x800/Loading/loadprocess.png');
  assert.equal(compact.barFront.canonicalPath, '480x800/Loading/loadbkfront.png');
  assert.throws(
    () => getLoadingRasterResources('1080x1920' as never),
    /480x800 or 720x1280/,
  );
});

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, seen);
  }
}

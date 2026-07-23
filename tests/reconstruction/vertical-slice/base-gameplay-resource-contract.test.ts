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
  BASE_GAMEPLAY_ARIAL_FONT_RESOURCE,
  BASE_GAMEPLAY_RESOURCE_PROFILES,
  getBaseGameplayResourceProfile,
  listBaseGameplayRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/base-gameplay-resource-contract.ts'
);

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const EXPECTED_HASHES: Readonly<Record<string, string>> = Object.freeze({
  '480x800/Blades/Particles/X-Mas/xmasfive.png':
    '2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2',
  '480x800/Blades/Particles/X-Mas/xmasfour.png':
    '5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385',
  '480x800/Buttons/button-pause-normal.png':
    '898f029601abee4d2ecd4578db0dbbd2c9a4edd199275790fa1a2799e1f82955',
  '480x800/Buttons/button-pause-selected.png':
    'c20b8de5c15dad58742d2fd1f236a5c6843d5bf7b8436bab6c996490cee95d6e',
  '480x800/Buttons/button-quit-normal.png':
    '2ac6aa0a71e202805beaa0c28cddf5886289c99cfce70fde89071d626390e2b0',
  '480x800/Buttons/button-quit-selected.png':
    '565cbe5c397cd29fbe0be12e9396289eedaa64b6c67a50cf657568b1c1e98a3f',
  '480x800/Buttons/button-replay-normal.png':
    '658fa662e185b4180821314f4166797ce801c369329cf2cb8699718d04fd56b3',
  '480x800/Buttons/button-replay-selected.png':
    '20c6ca783e59ea2f0796f1d25c13d5fdb16b58257f38874394e476104449f28c',
  '480x800/Buttons/button-resume-normal.png':
    '4fc4fcfbb928279c4fa7ec67df66496022d68aa6368da5bbdc303952e8fe918d',
  '480x800/Buttons/button-resume-selected.png':
    'b40e4d656089818319d99cf16406421f3973dd92ce0c9da97b1d060cc3e0230c',
  '480x800/Objectives/next_objectives_message.png':
    '627ec979556cf5ff9b6b1dcd8f52d4904b7dd095f09235b9ebf88aff356b2174',
  '480x800/Objectives/objectives-pause-background.png':
    'eecd45a1fd6cb445049ef03a7c1c00916dc4b476a6e8416a33ee4f6e405eb28a',
  '480x800/Objectives/objectives_message.png':
    '98e2e5be34f722ccc0b596e165c0e57ca4c2f455de3b241c3ef652be43e89ba2',
  '720x1280/Blades/Particles/X-Mas/xmasfive.png':
    'a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3',
  '720x1280/Blades/Particles/X-Mas/xmasfour.png':
    '7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39',
  '720x1280/Buttons/button-pause-normal.png':
    '4110130fbdc80b4afe527e71a2525db8c04aaf2567b49276ad19c69606a820ee',
  '720x1280/Buttons/button-pause-selected.png':
    'd9b4c69c2f302eaa73842689e1f158cb4c8952f9d2a8140fe73c25a7e1b38201',
  '720x1280/Buttons/button-quit-normal.png':
    'ffb5b49fbaeb43ca983c0136b78506c890db08e41fe5ec7036d0e4a47652dd09',
  '720x1280/Buttons/button-quit-selected.png':
    '2e694d146d7f58a126ba534f07a29a4b82a9e6e9c215e71c4ab748844608c79b',
  '720x1280/Buttons/button-replay-normal.png':
    '19989c8a1a2ae583e7dbdaef5b451918ad006a5c22476a62da3dad79766cf09e',
  '720x1280/Buttons/button-replay-selected.png':
    '785b36174817571e388208b455d07785d7a5d7575df1bf46a3ca2e6a37e5cfb8',
  '720x1280/Buttons/button-resume-normal.png':
    '22b85847e66bf81efd873d6c463c4f22cd6b0ff14b277918db1b2eb1f6d53030',
  '720x1280/Buttons/button-resume-selected.png':
    '34ae852826c656ed4389e79afb51a940b39d28c247f449e76eb01c7a60d44e4d',
  '720x1280/Objectives/next_objectives_message.png':
    'dec3896378976676b9a0850d7c9a56cb9fdceda3528fe85916ca5ae88b1d2384',
  '720x1280/Objectives/objectives-pause-background.png':
    'a6a5e9521b14664942d1df259b0028dd9035706d967b7d892db363d9ef1c4800',
  '720x1280/Objectives/objectives_message.png':
    'fbc6cd76fff4d9e0a14f66f05b539e92a69a3b4751141a08747d773511b6a741',
});

test('base gameplay profiles preserve every recovered pause and achievement raster', () => {
  assert.equal(Object.keys(EXPECTED_HASHES).length, 26);
  for (const assetTree of ['480x800', '720x1280'] as const) {
    assert.equal(
      getBaseGameplayResourceProfile(assetTree),
      BASE_GAMEPLAY_RESOURCE_PROFILES[assetTree],
    );
    const resources = listBaseGameplayRasterResources(assetTree);
    assert.equal(resources.length, 13);
    assert.equal(new Set(resources.map(({ canonicalPath }) => canonicalPath)).size, 13);

    for (const resource of resources) {
      const bytes = readFileSync(
        `${REPOSITORY_ROOT}/game/assets/game/${resource.canonicalPath}`,
      );
      assert.equal(
        bytes.readUInt32BE(16),
        resource.dimensions.width,
        `${resource.canonicalPath} width`,
      );
      assert.equal(
        bytes.readUInt32BE(20),
        resource.dimensions.height,
        `${resource.canonicalPath} height`,
      );
      assert.equal(
        sha256(bytes),
        EXPECTED_HASHES[resource.canonicalPath],
        resource.canonicalPath,
      );
    }
  }
});

test('asymmetric recovered pause button geometry remains profile-specific', () => {
  const low = getBaseGameplayResourceProfile('480x800').pause;
  assert.deepEqual(low.quitNormal.dimensions, { width: 156, height: 166 });
  assert.deepEqual(low.quitSelected.dimensions, { width: 155, height: 166 });
  assert.deepEqual(low.resumeNormal.dimensions, { width: 92, height: 89 });
  assert.deepEqual(low.replayNormal.dimensions, { width: 92, height: 89 });

  const high = getBaseGameplayResourceProfile('720x1280').pause;
  assert.deepEqual(high.resumeNormal.dimensions, { width: 137, height: 134 });
  assert.deepEqual(high.replayNormal.dimensions, { width: 138, height: 133 });
  assert.deepEqual(high.quitNormal.dimensions, { width: 197, height: 213 });
});

test('shared Arial bytes and Creator loader boundary are exact', () => {
  assert.equal(BASE_GAMEPLAY_ARIAL_FONT_RESOURCE.canonicalPath, 'Fonts/Arial.ttf');
  const font = readFileSync(
    `${REPOSITORY_ROOT}/game/assets/game/${BASE_GAMEPLAY_ARIAL_FONT_RESOURCE.canonicalPath}`,
  );
  assert.equal(font.length, 755624);
  assert.equal(
    sha256(font),
    'b97a1e2bb9fedbf9aa99f6b14ef5a7f057c6611dd71698381cc44f77797a4223',
  );

  const loader = readFileSync(
    `${REPOSITORY_ROOT}/game/assets/scripts/creator/base-gameplay-resource-loader.ts`,
    'utf8',
  );
  assert.match(loader, /loadExactGameRasters\(rasterContracts, bundle\)/);
  assert.match(loader, /canonicalResourceToBundlePath\([\s\S]*BASE_GAMEPLAY_ARIAL_FONT_RESOURCE/);
  assert.match(loader, /bundle\.load\(bundlePath, Cocos\.Font/);
  assert.match(loader, /objectiveAchievement: Object\.freeze/);
  assert.match(loader, /pause: Object\.freeze/);
  assert.match(loader, /requireLoadedRaster/);
});

test('invalid asset-tree access fails closed', () => {
  assert.throws(
    () => getBaseGameplayResourceProfile('1080x1920' as never),
    /assetTree must be 480x800 or 720x1280/,
  );
  assert.throws(
    () => listBaseGameplayRasterResources('' as never),
    /assetTree must be 480x800 or 720x1280/,
  );
});

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

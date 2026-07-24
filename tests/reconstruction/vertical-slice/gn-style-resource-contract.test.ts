import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname, resolve } from 'node:path';
import test from 'node:test';

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
  GN_STYLE_BACKGROUND_MUSIC_PATH,
  GN_STYLE_INTRO_RASTER_COUNT,
  GN_STYLE_PARTICLE_FAMILY_RASTER_COUNT,
  GN_STYLE_SUPPLEMENTAL_RASTER_COUNT,
  getGnStyleSupplementalRasterSet,
  listGnStyleIntroRasterResources,
  listGnStyleParticleFamilyRasterResources,
  listGnStyleSupplementalRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/gn-style-resource-contract.ts'
);

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(readFileSync(
  resolve(repositoryRoot, 'assets/catalog/creator-staging-manifest.json'),
  'utf8',
)) as {
  readonly entries: readonly {
    readonly bytes: number;
    readonly canonicalPath: string;
    readonly sha256: string;
    readonly targetPath: string;
  }[];
};
const manifestByPath = new Map(
  manifest.entries.map((entry) => [entry.canonicalPath, entry]),
);

test('GN Style owns exactly five intro and six choreography rasters per tree', () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    const intro = listGnStyleIntroRasterResources(tree);
    const particles = listGnStyleParticleFamilyRasterResources(tree);
    const resources = listGnStyleSupplementalRasterResources(tree);
    assert.equal(intro.length, GN_STYLE_INTRO_RASTER_COUNT);
    assert.equal(particles.length, GN_STYLE_PARTICLE_FAMILY_RASTER_COUNT);
    assert.equal(resources.length, GN_STYLE_SUPPLEMENTAL_RASTER_COUNT);
    assert.equal(
      new Set(resources.map(({ canonicalPath }) => canonicalPath)).size,
      GN_STYLE_SUPPLEMENTAL_RASTER_COUNT,
    );
    assert.equal(
      resources.some(({ canonicalPath }) => canonicalPath.includes('text-time-up')),
      false,
    );
    assert.equal(
      resources.some(({ canonicalPath }) => canonicalPath.includes('object-time-freeze')),
      false,
    );
    assert.equal(
      resources.some(({ canonicalPath }) => canonicalPath.includes('leaderboard')),
      false,
    );
  }
  assert.equal(GN_STYLE_BACKGROUND_MUSIC_PATH, 'Sounds/GangnamStyle.mp3');
});

test('GN Style preserves all six exact particle family paths and profile dimensions', () => {
  assert.deepEqual(
    listGnStyleParticleFamilyRasterResources('480x800').map(
      ({ canonicalPath, dimensions }) => ({ canonicalPath, dimensions }),
    ),
    [
      {
        canonicalPath: '480x800/Blades/Particles/X-Mas/xmasfive.png',
        dimensions: { height: 44, width: 46 },
      },
      {
        canonicalPath: '480x800/Blades/Particles/X-Mas/xmasfour.png',
        dimensions: { height: 59, width: 51 },
      },
      {
        canonicalPath: '480x800/Blades/Particles/X-Mas/xmashexa.png',
        dimensions: { height: 36, width: 32 },
      },
      {
        canonicalPath: '480x800/Blades/Particles/X-Mas/xmascircle.png',
        dimensions: { height: 34, width: 34 },
      },
      {
        canonicalPath: '480x800/Blades/Particles/stars.png',
        dimensions: { height: 32, width: 32 },
      },
      {
        canonicalPath: '480x800/Blades/Particles/VN Flag/vnflagstar.png',
        dimensions: { height: 52, width: 54 },
      },
    ],
  );
  const large = getGnStyleSupplementalRasterSet('720x1280');
  assert.deepEqual(large.gnStyleInstruction, {
    canonicalPath: '720x1280/Text/text-gnstyle.png',
    dimensions: { height: 64, width: 512 },
  });
  assert.deepEqual(large.particleVnFlagStar, {
    canonicalPath: '720x1280/Blades/Particles/VN Flag/vnflagstar.png',
    dimensions: { height: 74, width: 78 },
  });
});

test('every GN Style supplemental raster matches staged bytes, hash, and geometry', () => {
  for (const tree of ['480x800', '720x1280'] as const) {
    for (const resource of listGnStyleSupplementalRasterResources(tree)) {
      const entry = manifestByPath.get(resource.canonicalPath);
      assert.ok(entry, `missing manifest row ${resource.canonicalPath}`);
      const bytes = readFileSync(resolve(repositoryRoot, entry.targetPath));
      assert.equal(bytes.byteLength, entry.bytes, resource.canonicalPath);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        entry.sha256,
        resource.canonicalPath,
      );
      assert.deepEqual(
        readPngDimensions(bytes),
        resource.dimensions,
        resource.canonicalPath,
      );
    }
  }

  const musicEntry = manifestByPath.get(GN_STYLE_BACKGROUND_MUSIC_PATH);
  assert.ok(musicEntry);
  const musicBytes = readFileSync(resolve(repositoryRoot, musicEntry.targetPath));
  assert.equal(musicBytes.byteLength, 1_791_164);
  assert.equal(
    createHash('sha256').update(musicBytes).digest('hex'),
    '00527f519dbed9df8eb046248557c75af46e52cc6a08dea9f9a00748fc7c2835',
  );
});

test('GN Style resource contracts are immutable and reject invalid trees', () => {
  const resources = listGnStyleSupplementalRasterResources('480x800');
  assert.equal(Object.isFrozen(resources), true);
  assert.equal(resources.every(Object.isFrozen), true);
  assert.equal(resources.every(({ dimensions }) => Object.isFrozen(dimensions)), true);
  assert.throws(
    () => getGnStyleSupplementalRasterSet('phone' as never),
    RangeError,
  );
  assert.throws(
    () => listGnStyleSupplementalRasterResources('tablet' as never),
    RangeError,
  );
});

function readPngDimensions(
  bytes: Buffer,
): Readonly<{ readonly height: number; readonly width: number }> {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return Object.freeze({
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  });
}

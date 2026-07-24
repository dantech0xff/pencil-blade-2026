import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname, join } from 'node:path';
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

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const {
  RESOURCE_CONSUMER_REGISTRY,
  listResourceConsumerRecords,
} = await import('../../../game/assets/scripts/domain/resource-consumer-registry.ts');

const MANIFEST = JSON.parse(readFileSync(
  `${REPOSITORY_ROOT}/assets/catalog/creator-staging-manifest.json`,
  'utf8',
)) as {
  readonly entries: readonly {
    readonly canonicalPath: string;
    readonly targetPath: string;
  }[];
};
const MANIFEST_PATHS = new Set(MANIFEST.entries.map((entry) => entry.canonicalPath));

const DISPOSITION_MAP = JSON.parse(readFileSync(
  `${REPOSITORY_ROOT}/forensics/resources/resource-disposition-map.json`,
  'utf8',
)) as {
  readonly groups: readonly {
    readonly canonicalPaths: readonly string[];
    readonly status: 'unknown' | 'excluded' | 'unsupported';
    readonly treePairLogicalPaths: readonly string[];
  }[];
};

test('resource consumer registry is sorted, frozen, and deduped to 743 manifest-backed records', () => {
  const registry = listResourceConsumerRecords();

  assert.equal(registry, RESOURCE_CONSUMER_REGISTRY);
  assert.equal(registry.length, 743);
  assert.equal(Object.isFrozen(registry), true);
  assert.deepEqual(listResourceConsumerRecords(), registry);
  assert.equal(new Set(registry.map((entry) => entry.canonicalPath)).size, 743);
  assert.deepEqual([...registry].map((entry) => entry.canonicalPath), [...registry]
    .map((entry) => entry.canonicalPath)
    .sort());

  for (const entry of registry) {
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Array.isArray(entry.consumerIds), true);
    assert.equal(Array.isArray(entry.evidenceRefs), true);
    assert.equal(Object.isFrozen(entry.consumerIds), true);
    assert.equal(Object.isFrozen(entry.evidenceRefs), true);
    assert.equal(entry.consumerIds.length >= 1, true);
    assert.equal(new Set(entry.consumerIds).size, entry.consumerIds.length);
    assert.equal(new Set(entry.evidenceRefs).size, entry.evidenceRefs.length);
    assert.equal(MANIFEST_PATHS.has(entry.canonicalPath), true, entry.canonicalPath);
  }
});

test('resource consumer registry covers both staged tree profiles and excludes all 119 reviewed gaps', () => {
  const registry = listResourceConsumerRecords();
  const registryPaths = new Set(registry.map((entry) => entry.canonicalPath));
  const registryByPath = new Map(registry.map((entry) => [entry.canonicalPath, entry] as const));

  assert.equal(registryPaths.has('480x800/Backgrounds/aboutbackground.png'), true);
  assert.equal(registryPaths.has('720x1280/Backgrounds/aboutbackground.png'), true);
  assert.equal(registryPaths.has('480x800/Blades/blade0.png'), true);
  assert.equal(registryPaths.has('720x1280/Blades/blade0.png'), true);
  assert.equal(registryPaths.has('Sounds/menubuttonclick.wav'), true);
  assert.equal(registryPaths.has('Fonts/SlabThing.ttf'), true);
  assert.equal(registryPaths.has('Sounds/boomhit.wav'), true);
  assert.equal(registryPaths.has('Fonts/Razing.ttf'), true);
  assert.deepEqual(registryByPath.get('Sounds/boomhit.wav')?.consumerIds, ['crazy-audio']);
  assert.deepEqual(registryByPath.get('Fonts/Razing.ttf')?.consumerIds, ['crazy-dragon-counter']);

  const gapPaths = expandDispositionPaths(DISPOSITION_MAP);
  assert.equal(gapPaths.size, 119);
  for (const gapPath of gapPaths) {
    assert.equal(registryPaths.has(gapPath), false, gapPath);
  }
  assert.equal(new Set([...registryPaths, ...gapPaths]).size, 862);
  assert.deepEqual(new Set([...registryPaths, ...gapPaths]), MANIFEST_PATHS);
});

test('production TypeScript has no unreviewed staged resource literal outside the registry', () => {
  const registryPaths = new Set(
    listResourceConsumerRecords().map((entry) => entry.canonicalPath),
  );
  const dispositionStatusByPath = expandDispositionStatuses(DISPOSITION_MAP);
  const escaped: string[] = [];
  const roots = [
    `${REPOSITORY_ROOT}/game/assets/scripts/domain`,
    `${REPOSITORY_ROOT}/game/assets/scripts/creator`,
  ];

  for (const sourcePath of roots.flatMap(listTypeScriptFiles)) {
    if (sourcePath.endsWith('/resource-consumer-registry.ts')) continue;
    const source = readFileSync(sourcePath, 'utf8');
    const quotedString = /'([^'\r\n]+)'|"([^"\r\n]+)"|`([^`\r\n]+)`/g;
    for (const match of source.matchAll(quotedString)) {
      const literal = match[1] ?? match[2] ?? match[3];
      if (
        literal.includes('${')
        || !/\.(?:png|wav|mp3|ttf|otf)$/i.test(literal)
      ) {
        continue;
      }
      const candidates = MANIFEST_PATHS.has(literal)
        ? [literal]
        : [`480x800/${literal}`, `720x1280/${literal}`]
          .filter((candidate) => MANIFEST_PATHS.has(candidate));
      const unreviewed = unreviewedLiteralCandidates(
        candidates,
        registryPaths,
        dispositionStatusByPath,
      );
      if (unreviewed.length > 0) {
        escaped.push(
          `${sourcePath.slice(REPOSITORY_ROOT.length)}: ${literal}`
            + ` -> ${unreviewed.join(', ')}`,
        );
      }
    }
  }

  assert.deepEqual(escaped, []);
});

test('literal audit rejects a partially registered profile pair', () => {
  const logicalPath = 'Backgrounds/example.png';
  assert.deepEqual(
    unreviewedLiteralCandidates(
      [`480x800/${logicalPath}`, `720x1280/${logicalPath}`],
      new Set([`480x800/${logicalPath}`]),
      new Map([[`720x1280/${logicalPath}`, 'unknown']]),
    ),
    [`720x1280/${logicalPath}`],
  );
});

function expandDispositionPaths(dispositionMap: typeof DISPOSITION_MAP): Set<string> {
  return new Set(expandDispositionStatuses(dispositionMap).keys());
}

function expandDispositionStatuses(
  dispositionMap: typeof DISPOSITION_MAP,
): Map<string, 'unknown' | 'excluded' | 'unsupported'> {
  const statuses = new Map<
    string,
    'unknown' | 'excluded' | 'unsupported'
  >();
  for (const group of dispositionMap.groups) {
    for (const logicalPath of group.treePairLogicalPaths) {
      statuses.set(`480x800/${logicalPath}`, group.status);
      statuses.set(`720x1280/${logicalPath}`, group.status);
    }
    for (const canonicalPath of group.canonicalPaths) {
      statuses.set(canonicalPath, group.status);
    }
  }
  return statuses;
}

function listTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function unreviewedLiteralCandidates(
  candidates: readonly string[],
  registryPaths: ReadonlySet<string>,
  dispositionStatusByPath: ReadonlyMap<
    string,
    'unknown' | 'excluded' | 'unsupported'
  >,
): string[] {
  return candidates.filter((candidate) => {
    if (registryPaths.has(candidate)) return false;
    const status = dispositionStatusByPath.get(candidate);
    return status !== 'excluded' && status !== 'unsupported';
  });
}

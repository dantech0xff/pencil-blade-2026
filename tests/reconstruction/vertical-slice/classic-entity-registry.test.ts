import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';

const SOURCE = readFileSync(
  new URL(
    '../../../game/assets/scripts/creator/classic-entity-registry.ts',
    import.meta.url,
  ),
  'utf8',
);
const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class Collider2D {}
export class Node {}
`)}`;
const GENERATED_FRUIT_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export class ClassicGeneratedFruit {}
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (
      specifier === './classic-generated-fruit'
      && context.parentURL?.endsWith('/classic-entity-registry.ts')
    ) {
      return { shortCircuit: true, url: GENERATED_FRUIT_STUB_URL };
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { ClassicEntityRegistry } = await import(
  '../../../game/assets/scripts/creator/classic-entity-registry.ts'
);

interface StubEntity {
  readonly entityOccurrenceId: number;
  completeRayQueryCuts(): void;
  evaluateBounds(
    viewport: Readonly<{ width: number; height: number }>,
  ): readonly object[];
  queueDispose(reason: string): void;
  snapshot(): Readonly<{ targetId: string }>;
}

interface InspectableRegistry {
  readonly byOccurrenceId: Map<number, StubEntity>;
  readonly rayQueryCutEntities: Set<StubEntity>;
  cuttableSnapshots(): readonly Readonly<{ targetId: string }>[];
  disposeAll(): void;
  evaluateBounds(
    viewport: Readonly<{ width: number; height: number }>,
  ): readonly Readonly<{
    commands: readonly object[];
    entityOccurrenceId: number;
  }>[];
  runRayQueryCutBatch(execute: () => void): void;
}

test('Set and Map iterator snapshots use Array.from before Creator loose-build iteration', () => {
  for (const expected of [
    'Array.from(this.byOccurrenceId.values())',
    'Array.from(this.rayQueryCutEntities)',
  ]) {
    assert.match(SOURCE, new RegExp(escapeRegExp(expected)));
  }
  for (const iterable of [
    'this.byOccurrenceId.values()',
    'this.rayQueryCutEntities',
  ]) {
    assert.doesNotMatch(
      SOURCE,
      new RegExp(`\\[\\s*\\.\\.\\.\\s*${escapeRegExp(iterable)}\\s*\\]`),
    );
  }
});

test('registry snapshots preserve insertion order and lifecycle work across mutation', () => {
  const events: string[] = [];
  let registry: InspectableRegistry;
  const lateEntity = stubEntity(30, 'late', events);
  const first = stubEntity(20, 'first', events, () => {
    registry.rayQueryCutEntities.add(lateEntity);
  });
  const second = stubEntity(10, 'second', events);
  registry = createRegistry();
  registry.byOccurrenceId.set(first.entityOccurrenceId, first);
  registry.byOccurrenceId.set(second.entityOccurrenceId, second);

  assert.deepEqual(registry.cuttableSnapshots(), [
    { targetId: 'first' },
    { targetId: 'second' },
  ]);
  assert.deepEqual(events, ['snapshot-first', 'snapshot-second']);

  events.length = 0;
  const evaluations = registry.evaluateBounds({ width: 480, height: 800 });
  assert.deepEqual(
    evaluations.map(({ entityOccurrenceId }) => entityOccurrenceId),
    [20, 10],
  );
  assert.deepEqual(events, ['bounds-first', 'bounds-second']);

  events.length = 0;
  registry.disposeAll();
  assert.deepEqual(events, ['dispose-first', 'dispose-second']);

  events.length = 0;
  registry.rayQueryCutEntities.add(first);
  registry.rayQueryCutEntities.add(second);
  registry.runRayQueryCutBatch(() => events.push('execute'));
  assert.deepEqual(events, ['execute', 'complete-first', 'complete-second']);
  assert.deepEqual(Array.from(registry.rayQueryCutEntities), [lateEntity]);

  events.length = 0;
  registry.runRayQueryCutBatch(() => events.push('execute-late'));
  assert.deepEqual(events, ['execute-late', 'complete-late']);
  assert.equal(registry.rayQueryCutEntities.size, 0);
});

function createRegistry(): InspectableRegistry {
  return new ClassicEntityRegistry({
    callAfterStep() {},
    onDispose() {},
    onFruitCut() {},
    onFruitMiss() {},
    onPlayTossSound() {},
    resourceCatalog: {
      normalFruit() {
        throw new Error('unused test resource');
      },
    },
  } as never) as unknown as InspectableRegistry;
}

function stubEntity(
  entityOccurrenceId: number,
  targetId: string,
  events: string[],
  onComplete: () => void = () => undefined,
): StubEntity {
  return {
    entityOccurrenceId,
    completeRayQueryCuts() {
      events.push(`complete-${targetId}`);
      onComplete();
    },
    evaluateBounds() {
      events.push(`bounds-${targetId}`);
      return [Object.freeze({ type: 'test-bounds-command' })];
    },
    queueDispose() {
      events.push(`dispose-${targetId}`);
    },
    snapshot() {
      events.push(`snapshot-${targetId}`);
      return Object.freeze({ targetId });
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

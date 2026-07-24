import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRESENTER_SOURCE = readSource(
  'game/assets/scripts/creator/objective-achievement-presenter.ts',
);
const EVENT = Object.freeze({
  completed: Object.freeze({ description: 'completed' }),
  next: Object.freeze({ description: 'next' }),
  nextRewardText: 'reward: 1 coin',
  type: 'objective-achievement',
});

const HOSTS = Object.freeze([
  Object.freeze({
    collector: 'collectClassicCleanupFailure',
    kind: 'classic',
    label: 'Classic',
    source: readSource('game/assets/scripts/creator/classic-gameplay-controller.ts'),
  }),
  Object.freeze({
    collector: 'collectCleanupFailure',
    kind: 'crazy',
    label: 'Crazy',
    source: readSource('game/assets/scripts/creator/crazy-gameplay-controller.ts'),
  }),
  Object.freeze({
    collector: 'collectCleanupFailure',
    kind: 'combo-bird',
    label: 'Combo Bird',
    source: readSource('game/assets/scripts/creator/combo-bird-gameplay-controller.ts'),
  }),
  Object.freeze({
    collector: 'collectCleanupFailure',
    kind: 'gn-style',
    label: 'GN Style',
    source: readSource('game/assets/scripts/creator/gn-style-gameplay-controller.ts'),
  }),
] as const);

for (const host of HOSTS) {
  test(`${host.label} popup contains cheer and creation failures after objective commit`, () => {
    for (const failureStage of ['cheer', 'create'] as const) {
      const reports: PopupFailureReport[] = [];
      let createCalls = 0;
      const presenterApi = {
        create() {
          createCalls += 1;
          if (failureStage === 'create') {
            throw new Error(`${host.label} injected create failure`);
          }
          return createPresenter();
        },
      };
      const controller = createControllerHarness(
        host.kind,
        () => {
          if (failureStage === 'cheer') {
            throw new Error(`${host.label} injected cheer failure`);
          }
        },
      );
      const callback = compileObjectiveCallback(
        host.source,
        host.collector,
        presenterApi,
        reports,
      );

      assert.doesNotThrow(() => callback.call(controller, EVENT));
      assert.equal(reports.length, 1);
      assert.match(
        String(reports[0]?.primary),
        new RegExp(`injected ${failureStage} failure`),
      );
      assert.deepEqual(reports[0]?.cleanupFailures, []);
      assert.equal(
        createCalls,
        failureStage === 'cheer' ? 0 : 1,
      );
      assert.equal(controller.objectiveAchievementPresenters.size, 0);
    }
  });

  test(`${host.label} popup contains attachment and rollback failures exactly once`, () => {
    const reports: PopupFailureReport[] = [];
    let disposeCalls = 0;
    let targetDestroyCalls = 0;
    const presenter = createPresenter({
      attach() {
        throw new Error(`${host.label} injected attach failure`);
      },
      dispose() {
        disposeCalls += 1;
        throw new Error(`${host.label} injected presenter rollback failure`);
      },
    });
    const controller = createControllerHarness(host.kind, () => {});
    if (host.kind === 'classic') {
      controller.objectiveAchievementTargetRoot = null;
      controller.requireObjectiveAchievementTargetRoot = () => {
        const target = {
          destroy() {
            targetDestroyCalls += 1;
            throw new Error('Classic injected target rollback failure');
          },
        };
        controller.objectiveAchievementTargetRoot = target;
        return target;
      };
    }
    const callback = compileObjectiveCallback(
      host.source,
      host.collector,
      { create: () => presenter },
      reports,
    );

    assert.doesNotThrow(() => callback.call(controller, EVENT));
    assert.equal(disposeCalls, 1);
    assert.equal(controller.objectiveAchievementPresenters.size, 0);
    assert.equal(reports.length, 1);
    assert.match(String(reports[0]?.primary), /injected attach failure/);
    assert.match(
      String(reports[0]?.cleanupFailures[0]),
      /injected presenter rollback failure/,
    );
    if (host.kind === 'classic') {
      assert.equal(targetDestroyCalls, 1);
      assert.equal(controller.objectiveAchievementTargetRoot, null);
      assert.match(
        String(reports[0]?.cleanupFailures[1]),
        /injected target rollback failure/,
      );
    }
  });
}

test('shared updater retires at 7.5 seconds and never updates the presenter again', () => {
  const reports: PopupFailureReport[] = [];
  const updatePresenters = compilePresenterRegistryUpdate(reports);
  let elapsed = 0;
  let disposeCalls = 0;
  let updateCalls = 0;
  const presenter = {
    dispose() {
      disposeCalls += 1;
      return true;
    },
    get isComplete() {
      return elapsed >= 7.5;
    },
    updateAction(deltaSeconds: number) {
      updateCalls += 1;
      elapsed += deltaSeconds;
    },
  };
  const presenters = new Set([presenter]);

  updatePresenters(presenters, 7.49, 'test update');
  assert.equal(presenters.size, 1);
  assert.equal(disposeCalls, 0);
  updatePresenters(presenters, 0.01, 'test update');
  assert.equal(elapsed, 7.5);
  assert.equal(presenters.size, 0);
  assert.equal(disposeCalls, 1);
  assert.equal(updateCalls, 2);
  updatePresenters(presenters, 1, 'test update');
  assert.equal(disposeCalls, 1);
  assert.equal(updateCalls, 2);
  assert.deepEqual(reports, []);
});

test('shared updater removes ownership before a failing natural disposal and reports once', () => {
  const reports: PopupFailureReport[] = [];
  const updatePresenters = compilePresenterRegistryUpdate(reports);
  let updateCalls = 0;
  const presenter = {
    dispose() {
      throw new Error('injected natural disposal failure');
    },
    isComplete: true,
    updateAction() {
      updateCalls += 1;
    },
  };
  const presenters = new Set([presenter]);

  assert.doesNotThrow(() => updatePresenters(presenters, 7.5, 'test update'));
  assert.equal(presenters.size, 0);
  assert.equal(reports.length, 1);
  assert.match(String(reports[0]?.primary), /natural disposal failure/);
  updatePresenters(presenters, 1, 'test update');
  assert.equal(updateCalls, 1);
  assert.equal(reports.length, 1);
});

interface PopupFailureReport {
  readonly cleanupFailures: readonly unknown[];
  readonly label: string;
  readonly primary: unknown;
}

function createControllerHarness(
  kind: typeof HOSTS[number]['kind'],
  playOneShot: () => void,
): Record<string, any> {
  const target = { destroy() {} };
  const audio = { playOneShot };
  const controller: Record<string, any> = {
    effectsEnabled: () => true,
    lifecycleFatalError: null,
    objectiveAchievementPresenters: new Set(),
    objectiveAchievementTargetRoot: target,
    random: {},
    requireBaseGameplayResources: () => ({}),
    requireClassicGameplayController: () => ({
      sharedAudioPresenter: audio,
    }),
    requireObjectiveAchievementTargetRoot: () => target,
    requireViewport: () => ({ height: 800, width: 480 }),
    sharedAudioPresenter: audio,
    sharedGameplayRandom: {},
  };
  if (kind === 'classic') {
    delete controller.lifecycleFatalError;
  }
  return controller;
}

function createPresenter(
  overrides: Partial<{
    attach(): void;
    dispose(): boolean;
  }> = {},
) {
  return {
    attach: overrides.attach ?? (() => {}),
    dispose: overrides.dispose ?? (() => true),
  };
}

function compileObjectiveCallback(
  source: string,
  collectorName: string,
  presenterApi: Readonly<{ create(): unknown }>,
  reports: PopupFailureReport[],
): (this: Record<string, any>, event: unknown) => void {
  const member = extractMemberBlock(
    source,
    '  private readonly onObjectiveAchievement = (',
  );
  const arrow = member.indexOf('=>');
  assert.notEqual(arrow, -1);
  const bodyStart = member.indexOf('{', arrow);
  assert.notEqual(bodyStart, -1);
  const typedFunction = [
    'function onObjectiveAchievement(',
    '  event: ObjectiveAchievementPopupEvent,',
    `): void ${member.slice(bodyStart)}`,
  ].join('\n');
  const dependencies: Record<string, unknown> = {
    CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH: 'Sounds/cheer.wav',
    ObjectiveAchievementPresenter: presenterApi,
    isValid: () => true,
    reportObjectiveAchievementPresentationFailure(
      label: string,
      primary: unknown,
      cleanupFailures: readonly unknown[] = [],
    ) {
      reports.push({
        cleanupFailures: [...cleanupFailures],
        label,
        primary,
      });
    },
  };
  dependencies[collectorName] = (
    failures: unknown[],
    cleanup: () => void,
  ) => {
    try {
      cleanup();
    } catch (error) {
      failures.push(error);
    }
  };
  return compileFunction(typedFunction, 'onObjectiveAchievement', dependencies);
}

function compilePresenterRegistryUpdate(
  reports: PopupFailureReport[],
): (
  presenters: Set<any>,
  deltaSeconds: number,
  failureLabel: string,
) => void {
  const source = extractFunction(
    PRESENTER_SOURCE,
    'updateAndRetireObjectiveAchievementPresenters',
  ).replace(/^export\s+/, '');
  return compileFunction(
    source,
    'updateAndRetireObjectiveAchievementPresenters',
    {
      assertNonNegativeFinite(value: number) {
        if (!Number.isFinite(value) || value < 0) {
          throw new RangeError('invalid delta');
        }
      },
      collectFailure(failures: unknown[], cleanup: () => void) {
        try {
          cleanup();
        } catch (error) {
          failures.push(error);
        }
      },
      reportObjectiveAchievementPresentationFailure(
        label: string,
        primary: unknown,
        cleanupFailures: readonly unknown[] = [],
      ) {
        reports.push({
          cleanupFailures: [...cleanupFailures],
          label,
          primary,
        });
      },
    },
  );
}

function compileFunction<T extends (...args: any[]) => unknown>(
  source: string,
  functionName: string,
  dependencies: Readonly<Record<string, unknown>>,
): T {
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  const javascript = stripTypeScriptTypes(source, {
    mode: 'transform',
    sourceUrl: `objective-achievement-popup-hosts.${functionName}.ts`,
  });
  return Function(
    ...names,
    `"use strict";\n${javascript}\nreturn ${functionName};`,
  )(...values) as T;
}

function extractFunction(source: string, functionName: string): string {
  const match = new RegExp(`^export function ${functionName}\\b`, 'm').exec(source);
  assert.ok(match, `${functionName} function must exist`);
  return extractBalancedBlock(source, match.index);
}

function extractMemberBlock(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  return extractBalancedBlock(source, start);
}

function extractBalancedBlock(source: string, start: number): string {
  const openBrace = source.indexOf('{', start);
  assert.notEqual(openBrace, -1);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error('unterminated source block');
}

function readSource(path: string): string {
  return readFileSync(`${REPOSITORY_ROOT}/${path}`, 'utf8');
}

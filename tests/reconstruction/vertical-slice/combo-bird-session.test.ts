import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
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
  COMBO_BIRD_BLADE_PROFILE,
  COMBO_BIRD_CAPTURED_PARENT_BOUNDARY,
  COMBO_BIRD_INITIAL_TIME_SECONDS,
  COMBO_BIRD_NOMINAL_TIMELINE_SECONDS,
  COMBO_BIRD_TIME_UP_PRESENTATION_SECONDS,
  ComboBirdSession,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-session.ts'
);
const {
  COMBO_BIRD_TOSS_CREATION_ORDER,
  COMBO_BIRD_TOSS_OUTER_STOP_ORDER,
  COMBO_BIRD_TOSS_START_ORDER,
} = await import(
  '../../../game/assets/scripts/domain/combo-bird-toss-config.ts'
);
const {
  ObjectivesManagerState,
} = await import(
  '../../../game/assets/scripts/domain/objectives-manager-state.ts'
);
const {
  BIRD_RASTER_RESOURCE_COUNT,
  BIRD_RESOURCE_PROFILES_BY_TYPE,
  getBirdResourceProfile,
  listBirdRasterResources,
} = await import(
  '../../../game/assets/scripts/domain/bird-resource-contract.ts'
);

test('mode 5 enter order composes only ordinary tosses, 90s timer, intro, and Bird type 3', () => {
  const session = new ComboBirdSession(321);
  assert.deepEqual(session.snapshot(), {
    activity: {
      birdBladeActive: false,
      comboActive: false,
      entitiesActive: false,
      inputActive: false,
      outerTossControllersActive: false,
      physicsActive: false,
      scoreActive: false,
    },
    hasBomb: false,
    hasBonusToss: false,
    hasDoubleToss: false,
    hasLives: false,
    hasTimeManager: true,
    lifecycle: 'constructed',
    mode: 5,
    sceneEntered: false,
    score: {
      authoritativeScore: 0,
      displayedScore: 0,
      displayedScoreScaleActive: false,
      doubleScoreActive: false,
      pendingDoubleScore: 0,
    },
    waveChildAfterTimeUp: 'pre-armed-pause-only',
  });

  const commands = session.enterScene();
  assert.deepEqual(commands.slice(0, 2), [
    { type: 'enter-base-bird-layer' },
    { payload: 0, selector: 7, type: 'process-objective' },
  ]);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'construct-controller')
    .map((command) => (
      command.type === 'construct-controller' ? command.controller : null
    )), COMBO_BIRD_TOSS_CREATION_ORDER);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'attach-controller')
    .map((command) => (
      command.type === 'attach-controller' ? command.controller : null
    )), COMBO_BIRD_TOSS_CREATION_ORDER);
  assert.deepEqual(commands.find(
    ({ type }) => type === 'construct-time-manager',
  ), {
    callbackOrder: ['time-up', 'time-up-finish'],
    durationSeconds: COMBO_BIRD_INITIAL_TIME_SECONDS,
    type: 'construct-time-manager',
  });
  assert.deepEqual(commands
    .filter(({ type }) => type === 'create-instruction-card')
    .map((command) => (
      command.type === 'create-instruction-card' ? command.card : null
    )), ['no-bomb', 'just-combo', 'no-life']);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'attach-instruction-card')
    .map((command) => (
      command.type === 'attach-instruction-card' ? command.card : null
    )), ['just-combo', 'no-bomb', 'no-life']);
  assert.deepEqual(commands
    .filter(({ type }) => type === 'start-instruction-action')
    .map((command) => (
      command.type === 'start-instruction-action'
        ? [command.card, command.ownsContinuation]
        : null
    )), [
    ['no-bomb', false],
    ['just-combo', true],
    ['no-life', false],
  ]);
  assert.deepEqual(commands.find(
    ({ type }) => type === 'create-bird-blade',
  ), {
    bladeType: 3,
    canonicalPath: 'Blades/testblade7.png',
    type: 'create-bird-blade',
    zOrder: 1,
  });
  assert.deepEqual(COMBO_BIRD_BLADE_PROFILE, {
    bladeType: 3,
    canonicalPath: 'Blades/testblade7.png',
  });
  assert.deepEqual(commands.at(-1), {
    key: 'bird_combo_best_1',
    score: 321,
    type: 'initialize-best-score',
  });
  assert.equal(session.snapshot().activity.inputActive, true);
  assert.equal(session.snapshot().activity.outerTossControllersActive, false);
});

test('Bird type 3 resolves through the actual shared 17-raster profiles', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    const profile = getBirdResourceProfile(
      assetTree,
      COMBO_BIRD_BLADE_PROFILE.bladeType,
    );
    const resources = listBirdRasterResources(
      assetTree,
      COMBO_BIRD_BLADE_PROFILE.bladeType,
    );

    assert.equal(profile, BIRD_RESOURCE_PROFILES_BY_TYPE[assetTree][3]);
    assert.equal(profile.birdType, 3);
    assert.equal(
      profile.blade.canonicalPath,
      `${assetTree}/${COMBO_BIRD_BLADE_PROFILE.canonicalPath}`,
    );
    assert.equal(resources.length, BIRD_RASTER_RESOURCE_COUNT);
    assert.equal(resources.length, 17);
    assert.equal(resources[0], profile.blade);
  }
});

test('callbacks fix exact 0/1.25/2.5/3.75 intro and controller-before-timer start', () => {
  const session = new ComboBirdSession();
  session.enterScene();
  assert.deepEqual(COMBO_BIRD_NOMINAL_TIMELINE_SECONDS, {
    enterGo: 2.5,
    enterInstructions: 0,
    enterNinety: 1.25,
    enterResult: 96.75,
    enterRunning: 3.75,
    enterTimeUp: 93.75,
  });
  assert.equal(COMBO_BIRD_TIME_UP_PRESENTATION_SECONDS, 3);

  assert.deepEqual(session.totalTimeCallback(), [{
    canonicalPath: 'Text/text-90s.png',
    durationSeconds: 1.25,
    type: 'create-ninety-intro',
    zOrder: 1,
  }]);
  assert.equal(session.snapshot().lifecycle, 'intro-ninety');
  assert.deepEqual(session.goCallback(), [{
    canonicalPath: 'Text/text-go.png',
    durationSeconds: 1.25,
    type: 'create-go-intro',
    zOrder: 1,
  }]);
  assert.equal(session.snapshot().lifecycle, 'intro-go');

  const start = session.startGameCallback();
  assert.deepEqual(start.slice(0, 3), COMBO_BIRD_TOSS_START_ORDER.map(
    (controller) => ({ controller, scope: 'outer', type: 'start-controller' }),
  ));
  assert.deepEqual(start.at(-1), { type: 'start-time-manager' });
  assert.equal(session.snapshot().lifecycle, 'running');
  assert.equal(session.snapshot().activity.outerTossControllersActive, true);
});

test('Time Up stops outer slots but keeps input, physics, entities, combo, and score live', () => {
  const session = runningSession();
  session.fruitCut({ x: 1, y: 2 }, 0, 1);

  const timeUp = session.timeUp();

  assert.deepEqual(timeUp.slice(0, 3), COMBO_BIRD_TOSS_OUTER_STOP_ORDER.map(
    (controller) => ({
      controller,
      preservesActiveWaveChild: controller === 'wave',
      scope: 'outer',
      type: 'stop-controller',
    }),
  ));
  assert.deepEqual(timeUp.at(-1), {
    payload: 2,
    selector: 7,
    type: 'process-objective',
  });
  assert.equal(
    timeUp.some(({ type }) => type === 'set-result-score'),
    false,
  );
  assert.deepEqual(session.snapshot().activity, {
    birdBladeActive: true,
    comboActive: true,
    entitiesActive: true,
    inputActive: true,
    outerTossControllersActive: false,
    physicsActive: true,
    scoreActive: true,
  });

  assert.deepEqual(session.checkCombo({ x: 3, y: 4 }), [{
    position: { x: 3, y: 4 },
    type: 'check-combo',
  }]);
  assert.deepEqual(session.fruitCut({ x: 5, y: 6 }, 8, 10), [{
    application: 'already-applied',
    type: 'add-score',
    value: 10,
  }]);
  session.addScore(3);
  assert.deepEqual(session.fruitFail({ x: 7, y: 8 }), [{
    payload: 1,
    selector: 7,
    type: 'process-objective',
  }]);
  assert.deepEqual(session.bonusFruitFail({ x: 9, y: 10 }), [{
    payload: 1,
    selector: 7,
    type: 'process-objective',
  }]);
  assert.equal(session.snapshot().lifecycle, 'time-up-presentation');
  assert.equal(session.snapshot().score.authoritativeScore, 14);

  const result = session.timeUpFinish();
  assert.deepEqual(result, [
    { type: 'stop-effects' },
    {
      boundary: COMBO_BIRD_CAPTURED_PARENT_BOUNDARY,
      type: 'capture-combo-bird-parent',
    },
    { type: 'construct-result' },
    { mode: 5, type: 'set-result-mode' },
    { score: 14, type: 'set-result-score' },
    { cleanup: true, type: 'remove-combo-bird' },
    { type: 'attach-result', zOrder: 1 },
  ]);
});

test('Result score is resampled after rollback rather than frozen at Time Up zero', () => {
  const session = runningSession();
  session.fruitCut({ x: 0, y: 0 }, 0, 5);
  session.timeUp();
  const first = session.timeUpFinish();
  assert.deepEqual(first.find(({ type }) => type === 'set-result-score'), {
    score: 5,
    type: 'set-result-score',
  });

  session.rollbackTimeUpFinish();
  session.fruitCut({ x: 0, y: 0 }, 0, 7);
  const retried = session.timeUpFinish();
  assert.deepEqual(retried.find(({ type }) => type === 'set-result-score'), {
    score: 12,
    type: 'set-result-score',
  });
  session.commitTimeUpFinish();
  assert.equal(session.snapshot().lifecycle, 'result-removed');
  assert.equal(session.snapshot().activity.inputActive, false);
});

test('objective 49 completes at zero and a later Time Up miss cannot revoke it', () => {
  const { manager, preferences } = createObjective49Manager();
  const session = new ComboBirdSession();
  applyObjectiveCommands(manager, session.enterScene());
  assert.equal(preferences.get('objectives_value_49'), 0);
  session.totalTimeCallback();
  session.goCallback();
  session.startGameCallback();

  applyObjectiveCommands(manager, session.timeUp());
  assert.equal(manager.isFinished(49), true);

  applyObjectiveCommands(manager, session.fruitFail({ x: 1, y: 1 }));
  assert.equal(manager.isFinished(49), true);
  assert.equal(preferences.get('objectives_value_49'), -2);
  assert.equal(session.snapshot().lifecycle, 'time-up-presentation');
});

test('rejected transitions throw before lifecycle mutation', () => {
  const session = new ComboBirdSession();
  session.enterScene();
  assert.throws(
    () => session.goCallback(),
    /requires the 90s callback/,
  );
  assert.equal(session.snapshot().lifecycle, 'intro-instructions');
  assert.throws(
    () => session.timeUp(),
    /only while running/,
  );
  assert.equal(session.snapshot().lifecycle, 'intro-instructions');
  assert.throws(
    () => session.fruitCut({ x: 0, y: 0 }, 0, 1),
    /gameplay callbacks require/,
  );
});

function runningSession(): InstanceType<typeof ComboBirdSession> {
  const session = new ComboBirdSession();
  session.enterScene();
  session.totalTimeCallback();
  session.goCallback();
  session.startGameCallback();
  return session;
}

function createObjective49Manager() {
  const preferences = new Map<string, number>();
  let currentObjective = 43;
  let fruitsCut = 0;
  let totalCoins = 0;
  const settings = {
    addObjectiveRewardCoins(rewardCoins: number) {
      const previousTotalCoins = totalCoins;
      totalCoins = (totalCoins + rewardCoins) | 0;
      return Object.freeze({
        delta: rewardCoins,
        nextTotalCoins: totalCoins,
        previousTotalCoins,
      });
    },
    setCurrentObjective(value: number) {
      currentObjective = value;
    },
    setFruitsCut(value: number) {
      fruitsCut = value;
    },
    get snapshot() {
      return Object.freeze({ currentObjective, fruitsCut, totalCoins });
    },
  };
  const manager = new ObjectivesManagerState(
    settings,
    {
      readInt32(key: string, defaultValue: number) {
        return preferences.get(key) ?? defaultValue;
      },
      writeInt32(key: string, value: number) {
        preferences.set(key, value);
      },
    },
    () => {},
  );
  return { manager, preferences };
}

function applyObjectiveCommands(
  manager: InstanceType<typeof ObjectivesManagerState>,
  commands: readonly Readonly<{ readonly type: string }>[],
): void {
  for (const command of commands) {
    if (
      command.type === 'process-objective'
      && 'selector' in command
      && 'payload' in command
    ) {
      manager.processGameEvent(
        command.selector as number,
        command.payload as number,
      );
    }
  }
}

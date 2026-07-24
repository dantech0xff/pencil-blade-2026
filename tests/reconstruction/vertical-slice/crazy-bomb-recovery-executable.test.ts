import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

function dataModule(source: string): string {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

const CC_STUB_URL = dataModule(`
export const _decorator = Object.freeze({
  ccclass() { return (Type) => Type; },
  requireComponent() { return (Type) => Type; },
});

export function isValid(value) {
  return value !== null && value !== undefined && value.destroyed !== true;
}

export class Component {
  constructor() { this.node = null; }
  getComponent(Type) { return this.node?.getComponent(Type) ?? null; }
  unschedule() {}
}

export class EventTouch {
  getUILocation() { return { x: 0, y: 0 }; }
}

export const Input = Object.freeze({
  EventType: Object.freeze({ TOUCH_START: 'touch-start' }),
});

export const input = Object.freeze({
  on() {},
  off() {},
});

export class Node {
  constructor(name = '') {
    this.active = true;
    this.components = new Map();
    this.destroyed = false;
    this.listeners = new Map();
    this.name = name;
    this.parent = null;
  }
  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
  }
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  on(type, callback, target) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ callback, target });
    this.listeners.set(type, listeners);
  }
  off(type, callback, target) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((listener) => (
      listener.callback !== callback || listener.target !== target
    )));
  }
  emit(type, ...args) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener.callback.apply(listener.target, args);
    }
  }
}
`);

const BLADE_STUB_URL = dataModule(`
export class BladeInputController {
  constructor() { this.cutEnabledChanges = []; }
  activateForClassicLayer() {}
  deactivateForNonClassicScreen() {}
  segmentsForPostPhysicsUpdate() { return []; }
  setCutEnabled(enabled) { this.cutEnabledChanges.push(enabled); }
}
`);

const PHYSICS_STUB_URL = dataModule(`
export class CrazyPhysicsActivationError extends Error {}

export class CrazyPhysicsAdapter {
  constructor() { this.active = false; }
  get state() {
    return { active: this.active, frozen: false, restorePending: false, worldSpeed: 1 };
  }
  activate() { this.active = true; }
  deactivate() {
    const changed = this.active;
    this.active = false;
    return changed;
  }
  callAfterStep(mutation) { mutation(); }
  freezeWorld() {}
  raycastAll() { return []; }
  unfreezeWorld() {}
}
`);

const GAMEPLAY_DEPENDENCY_STUB_URL = dataModule(`
const unused = () => {
  throw new Error('Unexpected unrelated Crazy gameplay dependency execution');
};
class InertDependency {}

export const CLASSIC_MENU_BUTTON_AUDIO_PATH = '';
export const CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH = '';
export const CLASSIC_SWISH_COOLDOWN_ACTION_SECONDS = 0;
export const CRAZY_DOUBLE_SCORE_AUDIO_PATH = '';
export const CRAZY_BIRD_RESULT_MENU_BUTTON_AUDIO_PATH = '';
export const CRAZY_BIRD_RESULT_MODE_ID = 4;
export const CRAZY_RESULT_MENU_BUTTON_AUDIO_PATH = '';
export const CRAZY_RESULT_MODE_ID = 1;
export const CRAZY_SPECIAL_FRUIT_BASE_CUT_AUDIO_PATH = '';
export const CRAZY_TIMED_PROFILE = Object.freeze({ kind: 'crazy', mode: 1 });
export const CRAZY_BIRD_TIMED_PROFILE = Object.freeze({
  kind: 'crazy-bird',
  mode: 4,
});
export const CLASSIC_BLADE_BEGAN_EVENT = 'blade-began';
export const CLASSIC_BLADE_ENDED_EVENT = 'blade-ended';
export const CLASSIC_BLADE_MOVED_EVENT = 'blade-moved';
export const BIRD_BLADE_TOUCH_BEGAN_EVENT = 'bird-blade-touch-began';

export {
  InertDependency as BaseGameplayPausePresenter,
  InertDependency as BirdBladePresenter,
  InertDependency as BirdBladeRayAdapter,
  InertDependency as BonusManagerState,
  InertDependency as ClassicBladePresenter,
  InertDependency as ClassicCriticalParticlePresenter,
  InertDependency as ClassicCutHalfPresenter,
  InertDependency as ClassicGameplayController,
  InertDependency as ClassicResultPresenter,
  InertDependency as ClassicSceneController,
  InertDependency as ClassicScoreHudPresenter,
  InertDependency as ClassicSpawnPlanner,
  InertDependency as ClassicSwishAudioGate,
  InertDependency as ComboItemPresenter,
  InertDependency as ComboService,
  InertDependency as CrazyAudioPresenter,
  InertDependency as CrazyBombElectricPresenter,
  InertDependency as CrazyElectricContactAdapter,
  InertDependency as CrazyEntityRegistry,
  InertDependency as CrazyIntroPresenter,
  InertDependency as CrazyMagnetPresenter,
  InertDependency as CrazyTossCoordinator,
  InertDependency as ObjectiveAchievementPresenter,
  InertDependency as StandardBombFuseSmokePresenter,
  InertDependency as StandardBladePresenter,
  InertDependency as TimeManagerPresenter,
  unused as applyComboCommandBatch,
  unused as buildBidirectionalRayPlan,
  unused as createClassicCriticalParticleUpdateCommands,
  unused as createClassicCutHalfMotion,
  unused as createCrazyBirdResultNavigationCommands,
  unused as createCrazyFruitCutCommands,
  unused as createCrazyResultNavigationCommands,
  unused as createCutDispatchCommands,
  unused as createDetachedScreenRoot,
  unused as createRecoveredResultObjectiveCommand,
  unused as crazyBirdLeaderboardPanelValues,
  unused as crazyLeaderboardPanelValues,
  unused as executeCrazyBombElectricHitAudio,
  unused as getClassicComboAudioPath,
  unused as getClassicFruitCutAudioSequence,
  unused as getClassicOrdinaryBombAudioPath,
  unused as getClassicResultRankAudioPath,
  unused as insertCrazyResultScore,
  unused as insertCrazyBirdResultScore,
  unused as loadBaseGameplayResources,
  unused as loadBirdResources,
  unused as loadCrazyDragonFont,
  unused as loadCrazyResources,
  unused as partitionCrazyRuntimeCommands,
  unused as reportObjectiveAchievementPresentationFailure,
  unused as sampleSpawnKinematics,
  unused as updateAndRetireObjectiveAchievementPresenters,
};
`);

const EXPLOSION_PRESENTER_STUB_URL = dataModule(`
export const presenterProbes = [];

export class StandardBombExplosionPresenter {
  static create(input, lifecycle) {
    const probe = {
      attachCalls: 0,
      disposeCalls: 0,
      input,
      lifecycle,
    };
    presenterProbes.push(probe);
    return {
      attach() { probe.attachCalls += 1; },
      dispose() { probe.disposeCalls += 1; },
      updateAction() {},
    };
  }
}
`);

const CRAZY_GAMEPLAY_FILE = '/game/assets/scripts/creator/crazy-gameplay-controller.ts';
const CRAZY_SCENE_FILE = '/game/assets/scripts/creator/crazy-scene-controller.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
    }
    if (context.parentURL?.endsWith(CRAZY_GAMEPLAY_FILE)) {
      if (specifier === './crazy-scene-controller') {
        return nextResolve(`${specifier}.ts`, context);
      }
      if (specifier === '../domain/standard-bomb-explosion-completion') {
        return nextResolve(`${specifier}.ts`, context);
      }
      if (specifier === './standard-bomb-explosion-presenter') {
        return { shortCircuit: true, url: EXPLOSION_PRESENTER_STUB_URL };
      }
      return { shortCircuit: true, url: GAMEPLAY_DEPENDENCY_STUB_URL };
    }
    if (
      context.parentURL?.endsWith(CRAZY_SCENE_FILE)
      && specifier === './blade-input-controller'
    ) {
      return { shortCircuit: true, url: BLADE_STUB_URL };
    }
    if (
      context.parentURL?.endsWith(CRAZY_SCENE_FILE)
      && specifier === './crazy-physics-adapter'
    ) {
      return { shortCircuit: true, url: PHYSICS_STUB_URL };
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && extname(specifier) === ''
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') && url.includes('/game/assets/scripts/')) {
      const fileName = fileURLToPath(url);
      const source = readFileSync(fileName, 'utf8').replace(
        /^\s*@(ccclass|requireComponent)\([^\n]*\)\s*$/gm,
        '',
      );
      return {
        format: 'module',
        shortCircuit: true,
        source: stripTypeScriptTypes(source, {
          mode: 'transform',
          sourceUrl: fileName,
        }),
      };
    }
    return nextLoad(url, context);
  },
});

const cc = await import('cc') as unknown as CocosStub;
const { BladeInputController } = await import(BLADE_STUB_URL) as unknown as BladeModule;
const { presenterProbes } = await import(
  EXPLOSION_PRESENTER_STUB_URL
) as unknown as ExplosionPresenterModule;
const {
  CRAZY_SESSION_COMMAND_EVENT,
  CrazySceneController,
} = await import('../../../game/assets/scripts/creator/crazy-scene-controller.ts');
const { BirdInputController } = await import(
  '../../../game/assets/scripts/creator/bird-input-controller.ts'
);
const { CrazyGameplayController } = await import(
  '../../../game/assets/scripts/creator/crazy-gameplay-controller.ts'
);

interface StubNode {
  addComponent<T>(Type: new () => T): T;
  on(
    type: string,
    callback: (payload: Readonly<{ enabled?: boolean; type?: string }>) => void,
  ): void;
}

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
}

interface BladeProbe {
  readonly cutEnabledChanges: boolean[];
}

interface BladeModule {
  readonly BladeInputController: new () => BladeProbe;
}

interface ExplosionPresenterProbe {
  attachCalls: number;
  disposeCalls: number;
}

interface ExplosionPresenterModule {
  readonly presenterProbes: ExplosionPresenterProbe[];
}

test('Crazy bomb-cut recovers committed cut state after a bombHit observer throws', () => {
  presenterProbes.length = 0;
  const node = new cc.Node('Canvas');
  const blade = node.addComponent(BladeInputController);
  node.addComponent(BirdInputController);
  const scene = node.addComponent(CrazySceneController as never) as InstanceType<
    typeof CrazySceneController
  >;
  scene.onLoad();
  scene.activateCrazyLayer(0);
  scene.completeIntro();
  assert.equal(scene.sessionSnapshot().cutEnabled, true);

  const gameplay = new CrazyGameplayController();
  setPrivate(gameplay, 'crazySceneController', scene);
  setPrivate(gameplay, 'classicSceneController', {
    resolutionSnapshot: () => ({
      visibleRect: { height: 1280, width: 720, x: 0, y: 0 },
    }),
  });
  setPrivate(gameplay, 'classicGameplayController', {
    sharedGameplayRandom: Object.freeze({}),
  });
  setPrivate(gameplay, 'worldPresentationRoot', new cc.Node('CrazyWorld'));

  let bombHitCalls = 0;
  let afterBombHitCalls = 0;
  const originalBombHit = scene.bombHit.bind(scene);
  const originalAfterBombHit = scene.afterBombHit.bind(scene);
  setPrivate(scene, 'bombHit', (position: Readonly<{ x: number; y: number }>) => {
    bombHitCalls += 1;
    originalBombHit(position);
  });
  setPrivate(scene, 'afterBombHit', () => {
    afterBombHitCalls += 1;
    originalAfterBombHit();
  });

  const observerError = new Error('injected Crazy bombHit observer failure');
  let disabledCommandCount = 0;
  node.on(CRAZY_SESSION_COMMAND_EVENT, (command) => {
    if (command.type === 'set-cut-enabled' && command.enabled === false) {
      disabledCommandCount += 1;
      assert.equal(scene.sessionSnapshot().cutEnabled, false);
      throw observerError;
    }
  });

  assert.throws(
    () => invokeStandardBombCut(gameplay, {
      targetId: 'standard-bomb:recovery',
      worldPosition: { x: 120, y: 340 },
    }),
    (error) => error === observerError,
  );

  assert.equal(bombHitCalls, 1);
  assert.equal(disabledCommandCount, 1);
  assert.equal(afterBombHitCalls, 1);
  assert.equal(scene.sessionSnapshot().cutEnabled, true);
  assert.deepEqual(blade.cutEnabledChanges.slice(-2), [false, true]);
  assert.equal(presenterProbes.length, 1);
  assert.equal(presenterProbes[0].attachCalls, 1);
  assert.equal(presenterProbes[0].disposeCalls, 1);
  assert.equal(
    privateValue<Map<string, unknown>>(gameplay, 'standardBombExplosionOwners').size,
    0,
  );
});

function invokeStandardBombCut(
  gameplay: object,
  event: Readonly<{
    targetId: string;
    worldPosition: Readonly<{ x: number; y: number }>;
  }>,
): void {
  privateValue<(value: typeof event) => void>(
    gameplay,
    'onStandardBombCut',
  )(event);
}

function setPrivate(target: object, property: string, value: unknown): void {
  (target as Record<string, unknown>)[property] = value;
}

function privateValue<T>(target: object, property: string): T {
  return (target as Record<string, unknown>)[property] as T;
}

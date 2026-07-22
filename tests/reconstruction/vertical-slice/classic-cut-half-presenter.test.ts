import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASSIC_CUT_HALF_FADE_ACTION_SECONDS,
  CLASSIC_CUT_HALF_GRAVITY_SCALE,
  createClassicCutHalfMotion,
  type ClassicCutHalfMotionPair,
} from '../../../game/assets/scripts/domain/classic-cut-half-motion.ts';
import {
  CLASSIC_NORMAL_FRUIT_RESOURCES,
  getClassicNormalFruitResources,
  type ClassicNormalFruitId,
  type ClassicRasterResource,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const centerImpulseApplications = [];
export const createdNodes = [];
export function resetCreatedNodes() {
  centerImpulseApplications.length = 0;
  createdNodes.length = 0;
}

export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}

export class Size {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; }
}

export class SpriteFrame {
  constructor(width, height) {
    this.originalSize = new Size(width, height);
    this.rect = { width, height };
    this.destroyed = false;
  }
}

export class UITransform {
  constructor() {
    this.contentSize = new Size();
    this.anchorPoint = new Vec2();
  }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
  setAnchorPoint(x, y) { this.anchorPoint = new Vec2(x, y); }
}

export class UIOpacity {
  constructor() { this.opacity = 255; }
}

export class Sprite {
  constructor() { this.sizeMode = 0; this.spriteFrame = null; }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class RigidBody2D {
  constructor() {
    this.type = 0;
    this.allowSleep = false;
    this.awakeOnLoad = false;
    this.bullet = true;
    this.fixedRotation = true;
    this.gravityScale = 0;
    this.linearDamping = -1;
    this.angularDamping = -1;
    this.linearVelocity = new Vec2();
    this.angularVelocity = 0;
    this.group = 0;
    this.appliedCenterImpulses = [];
  }
  applyLinearImpulseToCenter(impulse, wake) {
    const application = Object.freeze({
      impulse: Object.freeze({ x: impulse.x, y: impulse.y }),
      nodeName: this.node.name,
      wake,
    });
    this.appliedCenterImpulses.push(application);
    centerImpulseApplications.push(application);
    this.linearVelocity = new Vec2(impulse.x, impulse.y);
  }
}

export class BoxCollider2D {
  constructor() {
    this.size = new Size();
    this.offset = new Vec2();
    this.density = 0;
    this.friction = 0;
    this.restitution = 0;
    this.sensor = true;
    this.group = 0;
    this.tag = -1;
  }
}

export class Node {
  constructor(name = '') {
    this.name = name;
    this.active = true;
    this.destroyed = false;
    this.layer = 0;
    this.parent = null;
    this.children = [];
    this.position = { x: 0, y: 0, z: 0 };
    this.eulerAngles = { x: 0, y: 0, z: 0 };
    this.components = new Map();
    createdNodes.push(this);
  }
  get activeInHierarchy() {
    return this.active && (this.parent === null || this.parent.activeInHierarchy);
  }
  get worldPosition() {
    if (this.parent === null) return this.position;
    const parent = this.parent.worldPosition;
    return {
      x: parent.x + this.position.x,
      y: parent.y + this.position.y,
      z: parent.z + this.position.z,
    };
  }
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
  setParent(parent) {
    if (this.parent !== null) {
      const previousIndex = this.parent.children.indexOf(this);
      if (previousIndex >= 0) this.parent.children.splice(previousIndex, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
  }
  setSiblingIndex(index) {
    if (this.parent === null) return;
    const children = this.parent.children;
    const previousIndex = children.indexOf(this);
    if (previousIndex >= 0) children.splice(previousIndex, 1);
    children.splice(Math.min(index, children.length), 0, this);
  }
  destroy() {
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
  }
}

export const ERigidBody2DType = Object.freeze({ Dynamic: 2 });
export function isValid(value) { return value !== null && value !== undefined && !value.destroyed; }
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc') {
      return { shortCircuit: true, url: CC_STUB_URL };
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

const cc = await import('cc') as unknown as CocosStub;
const { ClassicCutHalfPresenter } = await import(
  '../../../game/assets/scripts/creator/classic-cut-half-presenter.ts'
);

interface CocosStub {
  readonly ERigidBody2DType: Readonly<{ Dynamic: number }>;
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
  readonly UITransform: new () => StubTransform;
  readonly centerImpulseApplications: StubImpulseApplication[];
  readonly createdNodes: StubNode[];
  readonly isValid: (value: unknown) => boolean;
  readonly resetCreatedNodes: () => void;
}

interface StubBody {
  readonly appliedCenterImpulses: StubImpulseApplication[];
}

interface StubImpulseApplication {
  readonly impulse: Readonly<{ x: number; y: number }>;
  readonly nodeName: string;
  readonly wake: boolean;
}

interface StubNode {
  active: boolean;
  children: StubNode[];
  destroyed: boolean;
  eulerAngles: Readonly<{ x: number; y: number; z: number }>;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  getComponent<T>(Type: new () => T): T | null;
  setPosition(x: number, y: number, z: number): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly originalSize: Readonly<{ height: number; width: number }>;
  readonly rect: Readonly<{ height: number; width: number }>;
}

interface StubTransform {
  readonly anchorPoint: Readonly<{ x: number; y: number }>;
  readonly contentSize: Readonly<{ height: number; width: number }>;
}

interface LoadedRaster extends ClassicRasterResource {
  readonly spriteFrame: StubSpriteFrame;
}

interface LoadedVisuals {
  readonly cutBottom: LoadedRaster;
  readonly cutTop: LoadedRaster;
  readonly intact: LoadedRaster;
}

interface DeferredLifecycle {
  readonly callbacks: Array<() => void>;
  readonly events: Array<{
    readonly part: 'bottom' | 'top';
    readonly reason: unknown;
    readonly sourceEntityOccurrenceId: number;
  }>;
  readonly lifecycle: {
    readonly callAfterStep: (mutation: () => void) => void;
    readonly onDisposed: (event: {
      readonly part: 'bottom' | 'top';
      readonly reason: unknown;
      readonly sourceEntityOccurrenceId: number;
    }) => void;
  };
}

const BASE_SOURCE = Object.freeze({
  critical: false,
  segment: Object.freeze({
    start: Object.freeze({ x: 10, y: 20 }),
    end: Object.freeze({ x: 110, y: 20 }),
  }),
  sourceAngleRadians: 0,
  sourceAngularVelocityRadiansPerSecond: -3,
  sourceBodyMass: 2,
  sourcePositionWorldUnits: Object.freeze({ x: 200, y: 300 }),
  viewportWidthWorldUnits: 480,
});

test('every exact profile pair presents native bottom then top geometry, motion, and filters', () => {
  let occurrenceId = 1;
  for (const definition of CLASSIC_NORMAL_FRUIT_RESOURCES) {
    for (const assetTree of ['480x800', '720x1280'] as const) {
      const parent = new cc.Node('Parent');
      parent.layer = 17;
      cc.resetCreatedNodes();
      const visuals = createLoadedVisuals(definition.fruitId, assetTree);
      const motion = createMotion(visuals, definition.fruitId % 2 === 0);
      const deferred = createDeferredLifecycle();
      const presenter = ClassicCutHalfPresenter.create({
        fruitId: definition.fruitId,
        motion,
        sourceEntityOccurrenceId: occurrenceId,
        visuals: visuals as never,
      }, deferred.lifecycle);

      assert.equal(presenter.fadeActionSeconds, CLASSIC_CUT_HALF_FADE_ACTION_SECONDS);
      assert.deepEqual(presenter.halves.map((half) => half.part), ['bottom', 'top']);
      assert.deepEqual(presenter.halves.map((half) => half.nativePart), [1, 0]);
      assert.deepEqual(cc.createdNodes.map((node) => node.name), [
        `ClassicCutHalf-${occurrenceId}-bottom`,
        `ClassicCutHalf-${occurrenceId}-top`,
      ]);

      for (const [index, half] of presenter.halves.entries()) {
        const part = index === 0 ? 'bottom' : 'top';
        const resource = part === 'bottom' ? visuals.cutBottom : visuals.cutTop;
        const state = motion[part];
        const transform = (half.node as unknown as StubNode).getComponent(cc.UITransform);
        assert.ok(transform);
        assert.deepEqual(vectorSizeSnapshot(transform.contentSize), resource.dimensions);
        assert.deepEqual(vectorSnapshot(transform.anchorPoint), { x: 0.5, y: 0.5 });
        assert.equal(half.sprite.spriteFrame, resource.spriteFrame);
        assert.equal(half.opacity.opacity, 255);
        assert.equal(half.body.type, cc.ERigidBody2DType.Dynamic);
        assert.equal(half.body.allowSleep, true);
        assert.equal(half.body.awakeOnLoad, true);
        assert.equal(half.body.bullet, false);
        assert.equal(half.body.fixedRotation, false);
        assert.equal(half.body.gravityScale, CLASSIC_CUT_HALF_GRAVITY_SCALE);
        assert.equal(half.body.linearDamping, 0);
        assert.equal(half.body.angularDamping, 0);
        assert.deepEqual(vectorSnapshot(half.body.linearVelocity), { x: 0, y: 0 });
        assert.equal(half.body.angularVelocity, state.angularVelocityRadiansPerSecond);
        assert.equal(half.body.group, 0x0001);
        assert.deepEqual(half.direction, state.direction);
        assert.deepEqual(half.impulseNewtonSeconds, state.impulseNewtonSeconds);
        assert.equal(Object.isFrozen(half.direction), true);
        assert.equal(Object.isFrozen(half.impulseNewtonSeconds), true);
        assert.deepEqual(half.collisionFilter, {
          categoryBits: 0x0001,
          groupIndex: 0,
          maskBits: 0xfffc,
        });
        assert.deepEqual(vectorSizeSnapshot(half.collider.size), {
          width: 2 * resource.dimensions.width,
          height: 2 * resource.dimensions.height,
        });
        assert.deepEqual(vectorSnapshot(half.collider.offset), { x: 0, y: 0 });
        assert.equal(half.collider.density, 1);
        assert.equal(half.collider.friction, Math.fround(0.2));
        assert.equal(half.collider.restitution, 0);
        assert.equal(half.collider.sensor, false);
        assert.equal(half.collider.group, 0x0001);
        assert.equal(half.collider.tag, 0);
        assert.deepEqual((half.node as unknown as StubNode).position, {
          x: state.positionWorldUnits.x,
          y: state.positionWorldUnits.y,
          z: 0,
        });
        assert.equal(
          (half.node as unknown as StubNode).eulerAngles.z,
          state.angleRadians * 180 / Math.PI,
        );
      }

      assert.deepEqual(cc.centerImpulseApplications, []);
      presenter.attach(parent as never, 0);
      assert.equal(presenter.isAttached, true);
      assert.deepEqual(parent.children, presenter.halves.map((half) => half.node));
      assert.deepEqual(presenter.halves.map((half) => half.node.layer), [17, 17]);
      assert.deepEqual(presenter.halves.map((half) => half.node.active), [true, true]);
      assert.deepEqual(cc.centerImpulseApplications, [
        {
          impulse: motion.bottom.impulseNewtonSeconds,
          nodeName: `ClassicCutHalf-${occurrenceId}-bottom`,
          wake: true,
        },
        {
          impulse: motion.top.impulseNewtonSeconds,
          nodeName: `ClassicCutHalf-${occurrenceId}-top`,
          wake: true,
        },
      ]);
      for (const half of presenter.halves) {
        assert.equal(
          (half.body as unknown as StubBody).appliedCenterImpulses.length,
          1,
        );
      }
      occurrenceId += 1;
    }
  }
});

test('unscaled fade and bounds cleanup advance independently and defer destruction', () => {
  const visuals = createLoadedVisuals(0, '480x800');
  const deferred = createDeferredLifecycle();
  const parent = new cc.Node('Parent');
  const presenter = ClassicCutHalfPresenter.create({
    fruitId: 0,
    motion: createMotion(visuals),
    sourceEntityOccurrenceId: 91,
    visuals: visuals as never,
  }, deferred.lifecycle);
  presenter.attach(parent as never);
  (presenter.halves[0].node as unknown as StubNode).setPosition(600, 0, 0);

  presenter.updateAction(CLASSIC_CUT_HALF_FADE_ACTION_SECONDS / 2);
  assert.deepEqual(presenter.halves.map((half) => half.opacity.opacity), [127.5, 127.5]);
  assert.equal(deferred.callbacks.length, 0);

  presenter.evaluateBounds({ width: 480, height: 800 });
  assert.equal(presenter.activeHalfCount, 1);
  assert.equal(deferred.callbacks.length, 1);
  assert.equal(cc.isValid(presenter.halves[0].node), true);
  assert.equal(presenter.halves[1].opacity.opacity, 127.5);
  flushDeferred(deferred);
  assert.equal(cc.isValid(presenter.halves[0].node), false);
  assert.deepEqual(deferred.events, [{
    part: 'bottom',
    reason: { type: 'bounds', boundary: 'right' },
    sourceEntityOccurrenceId: 91,
  }]);

  presenter.updateAction(CLASSIC_CUT_HALF_FADE_ACTION_SECONDS / 2);
  assert.equal(presenter.halves[1].opacity.opacity, 0);
  assert.equal(presenter.activeHalfCount, 0);
  assert.equal(deferred.callbacks.length, 1);
  assert.equal(cc.isValid(presenter.halves[1].node), true);
  flushDeferred(deferred);
  assert.equal(cc.isValid(presenter.halves[1].node), false);
  assert.deepEqual(deferred.events[1], {
    part: 'top',
    reason: 'fade-complete',
    sourceEntityOccurrenceId: 91,
  });

  presenter.updateAction(1);
  presenter.evaluateBounds({ width: 480, height: 800 });
  assert.equal(presenter.disposeAll(), false);
  assert.equal(deferred.callbacks.length, 0);
});

test('explicit disposal preserves bottom-top callback order', () => {
  const visuals = createLoadedVisuals(8, '720x1280');
  const deferred = createDeferredLifecycle();
  const presenter = ClassicCutHalfPresenter.create({
    fruitId: 8,
    motion: createMotion(visuals, true),
    sourceEntityOccurrenceId: 92,
    visuals: visuals as never,
  }, deferred.lifecycle);
  presenter.attach(new cc.Node('Parent') as never);

  assert.equal(presenter.disposeAll(), true);
  assert.equal(presenter.disposeAll(), false);
  assert.equal(deferred.callbacks.length, 2);
  flushDeferred(deferred);
  assert.deepEqual(deferred.events.map((event) => [event.part, event.reason]), [
    ['bottom', 'presenter-dispose-all'],
    ['top', 'presenter-dispose-all'],
  ]);
});

test('malformed IDs, visuals, motion, lifecycle, clocks, and attachment reject', () => {
  const visuals = createLoadedVisuals(0, '480x800');
  const motion = createMotion(visuals);
  const deferred = createDeferredLifecycle();
  const validInput = {
    fruitId: 0 as ClassicNormalFruitId,
    motion,
    sourceEntityOccurrenceId: 1,
    visuals: visuals as never,
  };

  cc.resetCreatedNodes();
  assert.throws(() => ClassicCutHalfPresenter.create({
    ...validInput,
    fruitId: 9 as never,
  }, deferred.lifecycle), RangeError);
  assert.throws(() => ClassicCutHalfPresenter.create({
    ...validInput,
    sourceEntityOccurrenceId: 0,
  }, deferred.lifecycle), RangeError);
  assert.throws(() => ClassicCutHalfPresenter.create({
    ...validInput,
    motion: {
      ...motion,
      top: { ...motion.top, angleRadians: motion.top.angleRadians + 1 },
    },
  }, deferred.lifecycle), RangeError);
  assert.throws(() => ClassicCutHalfPresenter.create({
    ...validInput,
    motion: {
      ...motion,
      bottom: {
        ...motion.bottom,
        impulseNewtonSeconds: { x: Number.NaN, y: 1 },
      },
    },
  }, deferred.lifecycle), RangeError);
  assert.throws(() => ClassicCutHalfPresenter.create({
    ...validInput,
    motion: null as never,
  }, deferred.lifecycle), TypeError);
  assert.throws(() => ClassicCutHalfPresenter.create({
    ...validInput,
    visuals: createLoadedVisuals(1, '480x800') as never,
  }, deferred.lifecycle), RangeError);
  assert.throws(() => ClassicCutHalfPresenter.create({
    ...validInput,
    visuals: {
      ...visuals,
      cutBottom: {
        ...visuals.cutBottom,
        spriteFrame: new cc.SpriteFrame(
          visuals.cutBottom.dimensions.width + 1,
          visuals.cutBottom.dimensions.height,
        ),
      },
    } as never,
  }, deferred.lifecycle), RangeError);
  assert.throws(() => ClassicCutHalfPresenter.create(
    validInput,
    { ...deferred.lifecycle, onDisposed: null } as never,
  ), TypeError);
  assert.equal(cc.createdNodes.length, 0);

  const presenter = ClassicCutHalfPresenter.create(validInput, deferred.lifecycle);
  assert.throws(() => presenter.updateAction(0), /must be attached/);
  assert.throws(
    () => presenter.evaluateBounds({ width: 480, height: 800 }),
    /must be attached/,
  );
  const inactiveParent = new cc.Node('InactiveParent');
  inactiveParent.active = false;
  assert.throws(() => presenter.attach(inactiveParent as never), /must be active/);
  assert.throws(() => presenter.attach(new cc.Node('Parent') as never, -1), RangeError);
  const parent = new cc.Node('Parent');
  presenter.attach(parent as never);
  assert.throws(() => presenter.attach(parent as never), /already attached/);
  assert.throws(() => presenter.updateAction(-1), RangeError);
  assert.throws(() => presenter.updateAction(Number.NaN), RangeError);
  assert.throws(
    () => presenter.evaluateBounds({ width: 0, height: 800 }),
    RangeError,
  );
});

test('presenter consumes loaded SpriteFrames and never synthesizes replacement visuals', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}game/assets/scripts/creator/classic-cut-half-presenter.ts`,
    'utf8',
  );
  assert.doesNotMatch(source, /new SpriteFrame|Graphics|Texture2D/);
  assert.match(source, /resource: input\.visuals\.cutBottom/);
  assert.match(source, /resource: input\.visuals\.cutTop/);
  assert.match(source, /applyLinearImpulseToCenter/);
  assert.match(source, /body\.linearVelocity = new Vec2\(0, 0\)/);
  assert.match(source, /FRUIT_COLLISION_FILTER\.maskBits/);
});

function createLoadedVisuals(
  fruitId: ClassicNormalFruitId,
  assetTree: '480x800' | '720x1280',
): LoadedVisuals {
  const resources = getClassicNormalFruitResources(fruitId, assetTree);
  return Object.freeze({
    cutBottom: loadRaster(resources.cutBottom),
    cutTop: loadRaster(resources.cutTop),
    intact: loadRaster(resources.intact),
  });
}

function createMotion(
  visuals: LoadedVisuals,
  critical = false,
): ClassicCutHalfMotionPair {
  return createClassicCutHalfMotion({
    ...BASE_SOURCE,
    bottomHeightWorldUnits: visuals.cutBottom.dimensions.height,
    critical,
    topHeightWorldUnits: visuals.cutTop.dimensions.height,
  });
}

function loadRaster(resource: ClassicRasterResource): LoadedRaster {
  return Object.freeze({
    ...resource,
    spriteFrame: new cc.SpriteFrame(
      resource.dimensions.width,
      resource.dimensions.height,
    ),
  });
}

function createDeferredLifecycle(): DeferredLifecycle {
  const callbacks: Array<() => void> = [];
  const events: DeferredLifecycle['events'] = [];
  return {
    callbacks,
    events,
    lifecycle: {
      callAfterStep: (mutation) => callbacks.push(mutation),
      onDisposed: (event) => events.push(event),
    },
  };
}

function flushDeferred(deferred: DeferredLifecycle): void {
  while (deferred.callbacks.length > 0) {
    deferred.callbacks.shift()?.();
  }
}

function vectorSnapshot(value: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  return { x: value.x, y: value.y };
}

function vectorSizeSnapshot(
  value: Readonly<{ height: number; width: number }>,
): { height: number; width: number } {
  return { height: value.height, width: value.width };
}

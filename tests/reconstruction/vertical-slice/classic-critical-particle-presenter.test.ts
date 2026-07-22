import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createClassicCriticalParticleUpdateCommands,
  type ClassicCriticalParticleSpawnCommand,
} from '../../../game/assets/scripts/domain/classic-critical-particle-plan.ts';
import {
  getClassicCriticalParticleResource,
  type ClassicCriticalParticleIndex,
  type ClassicRasterResource,
} from '../../../game/assets/scripts/domain/classic-resource-contract.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
export function resetCreatedNodes() { createdNodes.length = 0; }

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
    this.anchorPoint = { x: 0, y: 0 };
  }
  setContentSize(width, height) { this.contentSize = new Size(width, height); }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
}

export class Sprite {
  constructor() { this.sizeMode = 0; this.spriteFrame = null; }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class Node {
  constructor(name = '') {
    this.name = name;
    this.active = true;
    this.destroyed = false;
    this.layer = 0;
    this.parent = null;
    this.children = [];
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    this.components = new Map();
    this.lastRequestedSiblingIndex = null;
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
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const previousIndex = this.parent.children.indexOf(this);
      if (previousIndex >= 0) this.parent.children.splice(previousIndex, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) {
      const parentWorld = parent === null ? { x: 0, y: 0, z: 0 } : parent.worldPosition;
      this.position = {
        x: world.x - parentWorld.x,
        y: world.y - parentWorld.y,
        z: world.z - parentWorld.z,
      };
    }
  }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (this.parent === null) return;
    const children = this.parent.children;
    const previousIndex = children.indexOf(this);
    if (previousIndex >= 0) children.splice(previousIndex, 1);
    children.splice(Math.min(index, children.length), 0, this);
  }
  destroy() {
    this.destroyed = true;
    this.active = false;
    this.setParent(null, true);
  }
}

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
const {
  CLASSIC_CRITICAL_PARTICLE_Z_ORDER,
  ClassicCriticalParticlePresenter,
} = await import(
  '../../../game/assets/scripts/creator/classic-critical-particle-presenter.ts'
);

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (width: number, height: number) => StubSpriteFrame;
  readonly UITransform: new () => StubTransform;
  readonly createdNodes: StubNode[];
  readonly isValid: (value: unknown) => boolean;
  readonly resetCreatedNodes: () => void;
}

interface StubNode {
  active: boolean;
  children: StubNode[];
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  readonly parent: StubNode | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
  readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  getComponent<T>(Type: new () => T): T | null;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
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

interface DisposedEvent {
  readonly logicalPath: string;
  readonly reason: 'scale-complete' | 'explicit-dispose';
  readonly resourceIndex: number;
}

test('all eight exact resources create a centered untrimmed sprite at world center and z-order 1', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (const resourceIndex of [1, 2, 3, 4] as const) {
      cc.resetCreatedNodes();
      const resource = loadRaster(resourceIndex, assetTree);
      const command = createCommand(resourceIndex);
      const events: DisposedEvent[] = [];
      const presenter = ClassicCriticalParticlePresenter.create({
        command,
        positionWorldUnits: { x: 300 + resourceIndex, y: 500 - resourceIndex },
        resource: resource as never,
      }, { onDisposed: (event) => events.push(event) });

      assert.equal(presenter.node.name, `ClassicCriticalParticle-${resourceIndex}`);
      assert.equal(presenter.node.active, false);
      assert.equal(presenter.sprite.spriteFrame, resource.spriteFrame);
      assert.equal(presenter.sprite.sizeMode, 2);
      assert.deepEqual(vectorSizeSnapshot(presenter.transform.contentSize), resource.dimensions);
      assert.deepEqual(vectorSnapshot(presenter.transform.anchorPoint), { x: 0.5, y: 0.5 });
      assert.deepEqual(vector3Snapshot((presenter.node as unknown as StubNode).scale), {
        x: 1,
        y: 1,
        z: 1,
      });
      assert.deepEqual(presenter.state.positionWorldUnits, {
        x: 300 + resourceIndex,
        y: 500 - resourceIndex,
      });
      assert.equal(Object.isFrozen(presenter.command), true);
      assert.equal(Object.isFrozen(presenter.state), true);
      assert.equal(Object.isFrozen(presenter.state.positionWorldUnits), true);

      const parent = new cc.Node('Parent');
      parent.layer = 17;
      parent.setPosition(100, 200, 0);
      const lowerSibling = new cc.Node('LowerSibling');
      lowerSibling.setParent(parent);
      const upperSibling = new cc.Node('UpperSibling');
      upperSibling.setParent(parent);

      presenter.attach(parent as never);

      assert.equal(presenter.isAttached, true);
      assert.equal(presenter.node.active, true);
      assert.equal(presenter.node.layer, 17);
      assert.equal(
        (presenter.node as unknown as StubNode).lastRequestedSiblingIndex,
        CLASSIC_CRITICAL_PARTICLE_Z_ORDER,
      );
      assert.equal(parent.children[1], presenter.node);
      assert.deepEqual(vector3Snapshot((presenter.node as unknown as StubNode).worldPosition), {
        x: 300 + resourceIndex,
        y: 500 - resourceIndex,
        z: 0,
      });
      assert.deepEqual(events, []);
    }
  }
});

test('action update scales linearly through midpoint and auto-destroys at the exact end', () => {
  const resource = loadRaster(4, '720x1280');
  const command = createCommand(4);
  const events: DisposedEvent[] = [];
  const presenter = ClassicCriticalParticlePresenter.create({
    command,
    positionWorldUnits: { x: 45, y: 67 },
    resource: resource as never,
  }, { onDisposed: (event) => events.push(event) });
  presenter.attach(new cc.Node('Parent') as never);

  presenter.updateAction(command.scaleOutActionSeconds / 2);
  assert.deepEqual(vector3Snapshot((presenter.node as unknown as StubNode).scale), {
    x: 0.5,
    y: 0.5,
    z: 1,
  });
  assert.deepEqual(presenter.state, {
    attached: true,
    disposed: false,
    elapsedActionSeconds: command.scaleOutActionSeconds / 2,
    logicalPath: 'Criticles/criticle4.png',
    positionWorldUnits: { x: 45, y: 67 },
    resourceIndex: 4,
    scale: 0.5,
  });
  assert.equal(cc.isValid(presenter.node), true);

  presenter.updateAction(command.scaleOutActionSeconds / 2);
  assert.deepEqual(vector3Snapshot((presenter.node as unknown as StubNode).scale), {
    x: 0,
    y: 0,
    z: 1,
  });
  assert.equal(presenter.isDisposed, true);
  assert.equal(presenter.isAttached, false);
  assert.equal(presenter.state.attached, false);
  assert.equal(cc.isValid(presenter.node), false);
  assert.deepEqual(events, [{
    logicalPath: 'Criticles/criticle4.png',
    reason: 'scale-complete',
    resourceIndex: 4,
  }]);
  assert.equal(Object.isFrozen(events[0]), true);
  assert.equal(presenter.dispose(), false);
  presenter.updateAction(10);
  assert.equal(events.length, 1);
});

test('explicit scene disposal is immediate and idempotent before or after attachment', () => {
  for (const attach of [false, true]) {
    const events: DisposedEvent[] = [];
    const resource = loadRaster(1, '480x800');
    const presenter = ClassicCriticalParticlePresenter.create({
      command: createCommand(1),
      positionWorldUnits: { x: 1, y: 2 },
      resource: resource as never,
    }, { onDisposed: (event) => events.push(event) });
    if (attach) {
      presenter.attach(new cc.Node('Parent') as never);
      presenter.updateAction(0.25);
    }

    assert.equal(presenter.dispose(), true);
    assert.equal(presenter.dispose(), false);
    assert.equal(presenter.isAttached, false);
    assert.equal(presenter.state.attached, false);
    assert.equal(cc.isValid(presenter.node), false);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      logicalPath: 'Criticles/criticle1.png',
      reason: 'explicit-dispose',
      resourceIndex: 1,
    });
    assert.throws(
      () => presenter.attach(new cc.Node('Parent') as never),
      /cannot be attached/,
    );
  }
});

test('attachment, clock, command, lifecycle, and exact resource validation reject', () => {
  const resource = loadRaster(2, '480x800');
  const command = createCommand(2);
  const validInput = {
    command,
    positionWorldUnits: { x: 10, y: 20 },
    resource: resource as never,
  };

  cc.resetCreatedNodes();
  assert.throws(() => ClassicCriticalParticlePresenter.create({
    ...validInput,
    positionWorldUnits: { x: Number.NaN, y: 20 },
  }, { onDisposed: () => undefined }), RangeError);
  assert.throws(() => ClassicCriticalParticlePresenter.create({
    ...validInput,
    command: { ...command, resourceIndex: 3 },
  }, { onDisposed: () => undefined }), RangeError);
  assert.throws(() => ClassicCriticalParticlePresenter.create({
    ...validInput,
    command: { ...command, logicalPath: 'Criticles/criticle3.png' },
  }, { onDisposed: () => undefined }), RangeError);
  assert.throws(() => ClassicCriticalParticlePresenter.create({
    ...validInput,
    command: { ...command, scaleOutActionSeconds: 2 },
  }, { onDisposed: () => undefined }), RangeError);
  assert.throws(() => ClassicCriticalParticlePresenter.create({
    ...validInput,
    resource: loadRaster(3, '480x800') as never,
  }, { onDisposed: () => undefined }), RangeError);
  assert.throws(() => ClassicCriticalParticlePresenter.create({
    ...validInput,
    resource: {
      ...resource,
      spriteFrame: new cc.SpriteFrame(
        resource.dimensions.width + 1,
        resource.dimensions.height,
      ),
    } as never,
  }, { onDisposed: () => undefined }), RangeError);
  assert.throws(
    () => ClassicCriticalParticlePresenter.create(validInput, { onDisposed: null } as never),
    TypeError,
  );
  assert.equal(cc.createdNodes.length, 0);

  const presenter = ClassicCriticalParticlePresenter.create(
    validInput,
    { onDisposed: () => undefined },
  );
  assert.throws(() => presenter.updateAction(0), /must be attached/);
  const inactiveParent = new cc.Node('InactiveParent');
  inactiveParent.active = false;
  assert.throws(() => presenter.attach(inactiveParent as never), /must be active/);
  const destroyedParent = new cc.Node('DestroyedParent');
  destroyedParent.destroy();
  assert.throws(() => presenter.attach(destroyedParent as never), /must be valid/);
  const parent = new cc.Node('Parent');
  presenter.attach(parent as never);
  assert.throws(() => presenter.attach(parent as never), /already attached/);
  assert.throws(() => presenter.updateAction(-1), RangeError);
  assert.throws(() => presenter.updateAction(Number.NaN), RangeError);
});

test('presenter consumes the supplied SpriteFrame without synthesized or invented effects', () => {
  const source = readFileSync(
    `${REPOSITORY_ROOT}game/assets/scripts/creator/classic-critical-particle-presenter.ts`,
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /new SpriteFrame|Graphics|Texture2D|UIOpacity|RigidBody2D|Collider2D|setRotation|rotateBy/,
  );
  assert.match(source, /this\.sprite\.spriteFrame = input\.resource\.spriteFrame/);
  assert.match(source, /setSiblingIndex\(CLASSIC_CRITICAL_PARTICLE_Z_ORDER\)/);
});

function createCommand(resourceIndex: ClassicCriticalParticleIndex): ClassicCriticalParticleSpawnCommand {
  const draws = [0, resourceIndex, 0];
  let offset = 0;
  const commands = createClassicCriticalParticleUpdateCommands(true, {
    nextIntInclusive: () => {
      const value = draws[offset];
      offset += 1;
      if (value === undefined) {
        throw new Error('command draw script exhausted');
      }
      return value;
    },
  });
  const command = commands[0];
  if (command === undefined) {
    throw new Error('expected critical-particle command');
  }
  return command;
}

function loadRaster(
  resourceIndex: ClassicCriticalParticleIndex,
  assetTree: '480x800' | '720x1280',
): LoadedRaster {
  const resource = getClassicCriticalParticleResource(resourceIndex, assetTree);
  return Object.freeze({
    ...resource,
    spriteFrame: new cc.SpriteFrame(
      resource.dimensions.width,
      resource.dimensions.height,
    ),
  });
}

function vectorSnapshot(value: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  return { x: value.x, y: value.y };
}

function vector3Snapshot(
  value: Readonly<{ x: number; y: number; z: number }>,
): { x: number; y: number; z: number } {
  return { x: value.x, y: value.y, z: value.z };
}

function vectorSizeSnapshot(
  value: Readonly<{ height: number; width: number }>,
): { height: number; width: number } {
  return { height: value.height, width: value.width };
}

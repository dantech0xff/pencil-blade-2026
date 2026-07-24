import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const CC_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const createdNodes = [];
let failingAddComponentName = null;
let failingSiblingName = null;

export function resetCreatedObjects() {
  createdNodes.length = 0;
  failingAddComponentName = null;
  failingSiblingName = null;
}

export function failNextAddComponentFor(name) {
  failingAddComponentName = name;
}

export function failNextSiblingPlacementFor(name) {
  failingSiblingName = name;
}

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
}

export class UITransform {
  constructor() {
    this.anchorPoint = { x: 0.5, y: 0.5 };
    this.anchorSetCalls = 0;
    this.contentSize = { width: 0, height: 0 };
  }
  setAnchorPoint(x, y) {
    this.anchorPoint = { x, y };
    this.anchorSetCalls += 1;
  }
  setContentSize(width, height) {
    this.contentSize = { width, height };
  }
}

export class UIOpacity {
  constructor() { this.opacity = 255; }
}

export class Sprite {
  constructor() {
    this.sizeMode = 0;
    this.spriteFrame = null;
  }
}
Sprite.SizeMode = Object.freeze({ CUSTOM: 2 });

export class SpriteFrame {
  constructor(label = '', width = 0, height = 0) {
    this.destroyed = false;
    this.label = label;
    this.originalSize = { width, height };
    this.rect = { width, height };
  }
  destroy() { this.destroyed = true; }
}

export class Node {
  constructor(name = '') {
    this.active = true;
    this.children = [];
    this.components = new Map();
    this.destroyCalls = 0;
    this.destroyed = false;
    this.lastRequestedSiblingIndex = null;
    this.layer = 0;
    this.name = name;
    this.parent = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    createdNodes.push(this);
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
    if (failingAddComponentName === Type.name) {
      failingAddComponentName = null;
      throw new Error('injected component allocation failure for ' + Type.name);
    }
    const component = new Type();
    component.node = this;
    this.components.set(Type, component);
    return component;
  }
  getComponent(Type) { return this.components.get(Type) ?? null; }
  inverseTransformPoint(out, point) {
    const world = this.worldPosition;
    out.x = point.x - world.x;
    out.y = point.y - world.y;
    out.z = point.z - world.z;
    return out;
  }
  setParent(parent, keepWorldTransform = false) {
    const world = this.worldPosition;
    if (this.parent !== null) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = parent;
    if (parent !== null) parent.children.push(this);
    if (keepWorldTransform) {
      const parentWorld = parent === null
        ? { x: 0, y: 0, z: 0 }
        : parent.worldPosition;
      this.position = {
        x: world.x - parentWorld.x,
        y: world.y - parentWorld.y,
        z: world.z - parentWorld.z,
      };
    }
  }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setRotationFromEuler(x, y, z) { this.rotation = { x, y, z }; }
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setSiblingIndex(index) {
    this.lastRequestedSiblingIndex = index;
    if (failingSiblingName === this.name) {
      failingSiblingName = null;
      throw new Error('injected sibling placement failure for ' + this.name);
    }
    if (this.parent === null) return;
    const siblings = this.parent.children;
    const current = siblings.indexOf(this);
    if (current >= 0) siblings.splice(current, 1);
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyCalls += 1;
    for (const child of [...this.children]) child.destroy();
    this.destroyed = true;
    this.active = false;
    this.setParent(null);
  }
}

export class AssetManager {}
export const assetManager = Object.freeze({});

export function isValid(value) {
  return value !== null && value !== undefined && !value.destroyed;
}
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
  StandardAdvancedBladePresenter,
  STANDARD_ADVANCED_BLADE_Z_ORDER,
} = await import(
  '../../../game/assets/scripts/creator/standard-advanced-blade-presenter.ts'
);
const {
  getStandardCentipedeBladeResources,
  getStandardDragonBladeResources,
} = await import(
  '../../../game/assets/scripts/domain/standard-blade-resource-contract.ts'
);

type AssetTree = '480x800' | '720x1280';
type AdvancedBladeId = 13 | 14 | 15 | 16 | 17;

interface CocosStub {
  readonly Node: new (name?: string) => StubNode;
  readonly SpriteFrame: new (
    label?: string,
    width?: number,
    height?: number,
  ) => StubSpriteFrame;
  readonly createdNodes: StubNode[];
  failNextAddComponentFor(name: string): void;
  failNextSiblingPlacementFor(name: string): void;
  resetCreatedObjects(): void;
}

interface StubNode {
  active: boolean;
  readonly children: StubNode[];
  destroyCalls: number;
  destroyed: boolean;
  lastRequestedSiblingIndex: number | null;
  layer: number;
  readonly name: string;
  parent: StubNode | null;
  position: Point3;
  rotation: Point3;
  scale: Point3;
  readonly worldPosition: Point3;
  destroy(): void;
  setParent(parent: StubNode | null, keepWorldTransform?: boolean): void;
  setPosition(x: number, y: number, z: number): void;
}

interface StubSpriteFrame {
  destroyed: boolean;
  readonly label: string;
  originalSize: Readonly<{ readonly height: number; readonly width: number }>;
  rect: Readonly<{ readonly height: number; readonly width: number }>;
  destroy(): void;
}

interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface RasterContract {
  readonly canonicalPath: string;
  readonly dimensions: Readonly<{
    readonly height: number;
    readonly width: number;
  }>;
}

interface MultipartContract {
  readonly body: RasterContract;
  readonly bodySegmentCount: 15 | 20;
  readonly head: RasterContract;
  readonly pointCapacity: 32;
  readonly tail: RasterContract;
}

interface LoadedRaster extends RasterContract {
  readonly spriteFrame: StubSpriteFrame;
}

interface LoadedMultipart {
  readonly body: LoadedRaster;
  readonly bodySegmentCount: 15 | 20;
  readonly head: LoadedRaster;
  readonly pointCapacity: 32;
  readonly tail: LoadedRaster;
}

interface LoadedAdvancedProfile {
  readonly bladeId: AdvancedBladeId;
  readonly kind: 'dragon' | 'centipede';
  readonly particles: readonly [];
  readonly resources: LoadedMultipart;
  readonly variant?: number;
}

test('IDs 13, 16, and 17 build four exact hidden multipart slots in both asset trees', () => {
  for (const assetTree of ['480x800', '720x1280'] as const) {
    for (const bladeId of [13, 16, 17] as const) {
      cc.resetCreatedObjects();
      const profile = loadedProfile(bladeId, assetTree);
      const presenter = StandardAdvancedBladePresenter.create({
        assetTree,
        profile: profile as never,
      });
      const bodyCount = bladeId === 17 ? 20 : 15;

      assert.equal(presenter.selectedBladeId, bladeId);
      assert.equal(
        presenter.model.family,
        bladeId === 17 ? 'centipede' : 'dragon',
      );
      assert.deepEqual(presenter.model.spriteWidths, {
        body: profile.resources.body.dimensions.width,
        head: profile.resources.head.dimensions.width,
        tail: profile.resources.tail.dimensions.width,
      });
      assert.equal(presenter.owners.length, 4);
      assert.equal(cc.createdNodes.length, 1 + 4 * (bodyCount + 3));
      assert.equal(presenter.root.active, false);

      presenter.owners.forEach((owner, slot) => {
        const slotNode = owner.node as unknown as StubNode;
        assert.equal(owner.slot, slot);
        assert.equal(owner.zOrder, STANDARD_ADVANCED_BLADE_Z_ORDER);
        assert.equal(slotNode.parent, presenter.root);
        assert.equal(owner.bodies.length, bodyCount);
        assert.deepEqual(
          slotNode.children.map(({ name }) => name),
          [
            'StandardAdvancedBladeHead',
            ...Array.from(
              { length: bodyCount },
              (_, index) => `StandardAdvancedBladeBody-${index}`,
            ),
            'StandardAdvancedBladeTail',
          ],
        );
        assertExactPresented(owner.head, profile.resources.head);
        owner.bodies.forEach((body) => {
          assertExactPresented(body, profile.resources.body);
        });
        assertExactPresented(owner.tail, profile.resources.tail);
      });

      const parent = new cc.Node(`${assetTree}-${bladeId}-Parent`);
      parent.layer = 29;
      presenter.attach(parent as never);
      const root = presenter.root as unknown as StubNode;
      assert.equal(root.parent, parent);
      assert.equal(root.active, true);
      assert.equal(root.lastRequestedSiblingIndex, 1);
      assert.equal(
        ownedNodes(presenter).every(({ layer }) => layer === parent.layer),
        true,
      );

      assert.equal(presenter.dispose(), true);
      assert.equal(presenter.dispose(), false);
      assert.equal(root.destroyed, true);
    }
  }
});

test('all four Dragon slots render the pure layouts, keep body zero hidden, and dispose together', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(13, '480x800');
  const parent = new cc.Node('FourSlotParent');
  presenter.attach(parent as never);

  presenter.owners.forEach((owner, slot) => {
    presenter.begin(slot);
    assert.equal(presenter.isClaimed(slot), true);
    presenter.move(slot, point(slot * 200 + 10, slot * 100 + 20));
    const layout = presenter.move(
      slot,
      point(slot * 200 + 50, slot * 100 + 20),
    );
    assert.equal(layout.visible, true);
    assert.deepEqual(layout.bodies.map(({ bodyIndex }) => bodyIndex), [2, 1]);
    assertOwnerMatchesLayout(owner, layout);
  });

  const headWorldXs = presenter.owners.map(({ head }) => (
    (head.node as unknown as StubNode).worldPosition.x
  ));
  assert.equal(new Set(headWorldXs).size, 4);

  for (let slot = 0; slot < 4; slot += 1) {
    presenter.end(slot);
    assert.equal(presenter.isClaimed(slot), false);
  }
  assert.deepEqual(presenter.updateFrame(), [0, 1, 2, 3]);
  presenter.owners.forEach(assertAllSpritesHidden);
  presenter.model.snapshot().forEach((snapshot) => {
    assert.equal(snapshot.state, 4);
    assert.equal(snapshot.opacity, 239);
    assert.equal(snapshot.wavedPoints.length, 0);
  });
});

test('translated attachment preserves world/UI layout coordinates through root inverse conversion', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(16, '720x1280');
  const parent = new cc.Node('TranslatedParent');
  parent.setPosition(240, 400, 0);
  presenter.attach(parent as never);

  const root = presenter.root as unknown as StubNode;
  assert.deepEqual(root.position, { x: -240, y: -400, z: 0 });
  assert.deepEqual(root.worldPosition, { x: 0, y: 0, z: 0 });

  presenter.begin(0);
  presenter.move(0, point(300, 500));
  const layout = presenter.move(0, point(340, 500));
  assert.equal(layout.visible, true);
  assert.ok(layout.head);
  assert.ok(layout.tail);
  assert.deepEqual(
    (presenter.owners[0]!.head.node as unknown as StubNode).worldPosition,
    { ...layout.head.position, z: 0 },
  );
  assert.deepEqual(
    (presenter.owners[0]!.tail.node as unknown as StubNode).worldPosition,
    { ...layout.tail.position, z: 0 },
  );
  assertOwnerMatchesLayout(presenter.owners[0]!, layout);
});

test('Centipede disposal hides its pool and the next gesture resets opacity and unit scales', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(17, '720x1280');
  presenter.attach(new cc.Node('CentipedeParent') as never);
  presenter.begin(0);
  presenter.move(0, point(0, 0));
  const firstVisible = presenter.move(0, point(20, 0));
  assert.equal(firstVisible.visible, true);
  assert.equal(firstVisible.bodies.every(({ scale }) => scale === 1), true);
  assertOwnerMatchesLayout(presenter.owners[0]!, firstVisible);

  presenter.end(0);
  assert.deepEqual(presenter.updateFrame(), [0]);
  assertAllSpritesHidden(presenter.owners[0]!);
  const disposed = presenter.model.snapshot()[0]!;
  assert.equal(disposed.state, 4);
  assert.equal(disposed.opacity, 244);

  presenter.begin(0);
  const reset = presenter.move(0, point(100, 100));
  assert.equal(reset.visible, false);
  assertAllSpritesHidden(presenter.owners[0]!);
  assert.equal(presenter.model.snapshot()[0]!.opacity, 255);
  const visibleAgain = presenter.move(0, point(120, 100));
  assert.equal(visibleAgain.visible, true);
  assert.equal(visibleAgain.bodies.every(({ scale }) => scale === 1), true);
  assertOwnerMatchesLayout(presenter.owners[0]!, visibleAgain);
  assert.equal(
    visibleSprites(presenter.owners[0]!).every(({ opacity }) => opacity.opacity === 255),
    true,
  );
});

test('profile, tree, capacities, paths, dimensions, and SpriteFrames fail before allocation', () => {
  const dragon = loadedProfile(13, '480x800');
  const centipede = loadedProfile(17, '480x800');

  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        bladeId: 0,
        kind: 'basic',
        particles: [],
      } as never,
    },
    /requires an exact loaded Dragon or Centipede profile/,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '720x1280',
      profile: dragon as never,
    },
    /does not match its exact resource contract/,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...dragon,
        variant: 3,
      } as never,
    },
    /invalid variant/,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...dragon,
        particles: [dragon.resources.body],
      } as never,
    },
    /cannot contain particle resources/,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...dragon,
        resources: {
          ...dragon.resources,
          bodySegmentCount: 20,
        },
      } as never,
    },
    /multipart capacities/,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...centipede,
        resources: {
          ...centipede.resources,
          pointCapacity: 31,
        },
      } as never,
    },
    /multipart capacities/,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...dragon,
        resources: {
          ...dragon.resources,
          head: {
            ...dragon.resources.head,
            canonicalPath: '480x800/Blades/Dragon/not-the-head.png',
          },
        },
      } as never,
    },
    /head does not match its exact resource contract/,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...dragon,
        resources: {
          ...dragon.resources,
          body: {
            ...dragon.resources.body,
            dimensions: {
              ...dragon.resources.body.dimensions,
              width: dragon.resources.body.dimensions.width + 1,
            },
          },
        },
      } as never,
    },
    /body does not match its exact resource contract/,
  );

  const wrongGeometry = new cc.SpriteFrame(
    'wrong-geometry',
    dragon.resources.tail.dimensions.width + 1,
    dragon.resources.tail.dimensions.height,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...dragon,
        resources: {
          ...dragon.resources,
          tail: {
            ...dragon.resources.tail,
            spriteFrame: wrongGeometry,
          },
        },
      } as never,
    },
    /SpriteFrame geometry mismatch/,
  );

  const destroyed = new cc.SpriteFrame(
    'destroyed',
    dragon.resources.head.dimensions.width,
    dragon.resources.head.dimensions.height,
  );
  destroyed.destroy();
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...dragon,
        resources: {
          ...dragon.resources,
          head: {
            ...dragon.resources.head,
            spriteFrame: destroyed,
          },
        },
      } as never,
    },
    /head SpriteFrame must be valid/,
  );
  assertConstructionFailsWithoutNodes(
    {
      assetTree: '480x800',
      profile: {
        ...centipede,
        bladeId: 13,
      } as never,
    },
    /must use blade ID 17/,
  );
});

test('construction and attachment failures recursively destroy every allocated owner', () => {
  cc.resetCreatedObjects();
  const profile = loadedProfile(13, '480x800');
  cc.failNextAddComponentFor('UITransform');
  assert.throws(
    () => StandardAdvancedBladePresenter.create({
      assetTree: '480x800',
      profile: profile as never,
    }),
    /injected component allocation failure/,
  );
  assert.ok(cc.createdNodes.length > 0);
  assert.equal(cc.createdNodes.every(({ destroyed }) => destroyed), true);
  assert.equal(cc.createdNodes.every(({ destroyCalls }) => destroyCalls === 1), true);

  cc.resetCreatedObjects();
  const presenter = createPresenter(17, '720x1280');
  const allocated = [...cc.createdNodes];
  const parent = new cc.Node('AttachFailureParent');
  cc.failNextSiblingPlacementFor('StandardAdvancedBladeRoot');
  assert.throws(
    () => presenter.attach(parent as never),
    /injected sibling placement failure/,
  );
  assert.equal(parent.children.length, 0);
  assert.equal(allocated.every(({ destroyed }) => destroyed), true);
  assert.equal(allocated.every(({ destroyCalls }) => destroyCalls === 1), true);
  assert.equal(presenter.dispose(), false);
  assert.throws(
    () => presenter.begin(0),
    /Disposed standard advanced blade presenter cannot begin/,
  );

  cc.resetCreatedObjects();
  const invalidParentPresenter = createPresenter(13, '480x800');
  const invalidAllocated = [...cc.createdNodes];
  const destroyedParent = new cc.Node('DestroyedParent');
  destroyedParent.destroy();
  assert.throws(
    () => invalidParentPresenter.attach(destroyedParent as never),
    /parent must be valid/,
  );
  assert.equal(invalidAllocated.every(({ destroyed }) => destroyed), true);
  assert.equal(invalidParentPresenter.dispose(), false);
});

test('attachment permits an inactive detached screen during transactional assembly', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(15, '720x1280');
  const detachedScreen = new cc.Node('DetachedScreen');
  detachedScreen.active = false;

  assert.doesNotThrow(() => presenter.attach(detachedScreen as never));
  assert.equal((presenter.root as unknown as StubNode).parent, detachedScreen);
  assert.equal((presenter.root as unknown as StubNode).active, true);
  presenter.begin(0);
  presenter.move(0, point(100, 200));
  assert.equal(presenter.isClaimed(0), true);

  detachedScreen.active = true;
  assert.doesNotThrow(() => presenter.move(0, point(140, 200)));
  assert.equal(presenter.dispose(), true);
});

test('attachment is single-owner and successful disposal is idempotent', () => {
  cc.resetCreatedObjects();
  const presenter = createPresenter(16, '480x800');
  assert.throws(
    () => presenter.begin(0),
    /must be attached before it can begin/,
  );
  assert.throws(
    () => presenter.updateFrame(),
    /must be attached before it can update/,
  );

  const parent = new cc.Node('LifecycleParent');
  presenter.attach(parent as never);
  assert.throws(
    () => presenter.attach(new cc.Node('SecondParent') as never),
    /already attached/,
  );
  assert.equal((presenter.root as unknown as StubNode).destroyed, false);
  const allocated = ownedNodes(presenter);

  presenter.begin(0);
  presenter.move(0, point(0));
  presenter.move(0, point(40));
  assert.equal(presenter.dispose(), true);
  assert.equal(presenter.dispose(), false);
  assert.equal(allocated.every(({ destroyed }) => destroyed), true);
  assert.equal(allocated.every(({ destroyCalls }) => destroyCalls === 1), true);
  assert.equal(parent.destroyed, false);
  assert.equal(parent.children.length, 0);
  assert.throws(
    () => presenter.move(0, point(60)),
    /Disposed standard advanced blade presenter cannot move/,
  );
  assert.throws(
    () => presenter.end(0),
    /Disposed standard advanced blade presenter cannot end/,
  );
  assert.throws(
    () => presenter.isClaimed(0),
    /Disposed standard advanced blade presenter cannot inspect ownership/,
  );
});

function createPresenter(bladeId: AdvancedBladeId, assetTree: AssetTree) {
  return StandardAdvancedBladePresenter.create({
    assetTree,
    profile: loadedProfile(bladeId, assetTree) as never,
  });
}

function loadedProfile(
  bladeId: AdvancedBladeId,
  assetTree: AssetTree,
): LoadedAdvancedProfile {
  if (bladeId === 17) {
    return Object.freeze({
      bladeId,
      kind: 'centipede' as const,
      particles: Object.freeze([]) as readonly [],
      resources: loadedMultipart(
        getStandardCentipedeBladeResources(assetTree) as MultipartContract,
      ),
    });
  }
  return Object.freeze({
    bladeId,
    kind: 'dragon' as const,
    particles: Object.freeze([]) as readonly [],
    resources: loadedMultipart(
      getStandardDragonBladeResources(bladeId, assetTree) as MultipartContract,
    ),
    variant: bladeId - 13,
  });
}

function loadedMultipart(contract: MultipartContract): LoadedMultipart {
  return Object.freeze({
    body: loadedRaster(contract.body),
    bodySegmentCount: contract.bodySegmentCount,
    head: loadedRaster(contract.head),
    pointCapacity: contract.pointCapacity,
    tail: loadedRaster(contract.tail),
  });
}

function loadedRaster(contract: RasterContract): LoadedRaster {
  return Object.freeze({
    canonicalPath: contract.canonicalPath,
    dimensions: Object.freeze({
      height: contract.dimensions.height,
      width: contract.dimensions.width,
    }),
    spriteFrame: new cc.SpriteFrame(
      contract.canonicalPath,
      contract.dimensions.width,
      contract.dimensions.height,
    ),
  });
}

function assertExactPresented(
  presented: {
    readonly node: unknown;
    readonly opacity: { readonly opacity: number };
    readonly sprite: {
      readonly sizeMode: number;
      readonly spriteFrame: unknown;
    };
    readonly transform: {
      readonly anchorPoint: Readonly<{ readonly x: number; readonly y: number }>;
      readonly anchorSetCalls: number;
      readonly contentSize: Readonly<{ readonly height: number; readonly width: number }>;
    };
    readonly zOrder: number;
  },
  resource: LoadedRaster,
): void {
  const node = presented.node as StubNode;
  assert.equal(node.active, false);
  assert.equal(presented.zOrder, 1);
  assert.equal(presented.opacity.opacity, 255);
  assert.equal(presented.sprite.sizeMode, 2);
  assert.equal(presented.sprite.spriteFrame, resource.spriteFrame);
  assert.deepEqual(presented.transform.contentSize, resource.dimensions);
  assert.deepEqual(presented.transform.anchorPoint, { x: 0.5, y: 0.5 });
  assert.equal(presented.transform.anchorSetCalls, 0);
}

function assertOwnerMatchesLayout(
  owner: {
    readonly bodies: readonly Presented[];
    readonly head: Presented;
    readonly tail: Presented;
  },
  layout: {
    readonly bodies: readonly (VisualTransform & { readonly bodyIndex: number })[];
    readonly head: VisualTransform | null;
    readonly tail: VisualTransform | null;
    readonly visible: boolean;
  },
): void {
  assert.equal(layout.visible, true);
  assert.ok(layout.head);
  assert.ok(layout.tail);
  assertPresentedMatches(owner.head, layout.head);
  assertPresentedMatches(owner.tail, layout.tail);
  const visibleBodyIndices = new Set(
    layout.bodies.map(({ bodyIndex }) => bodyIndex),
  );
  owner.bodies.forEach((body, index) => {
    if (visibleBodyIndices.has(index)) {
      const expected = layout.bodies.find(({ bodyIndex }) => bodyIndex === index);
      assert.ok(expected);
      assertPresentedMatches(body, expected);
    } else {
      assert.equal((body.node as StubNode).active, false);
    }
  });
  assert.equal((owner.bodies[0]!.node as StubNode).active, false);
}

interface VisualTransform {
  readonly opacity: number;
  readonly position: Readonly<{ readonly x: number; readonly y: number }>;
  readonly rotationDegrees: number;
  readonly scale: number;
}

interface Presented {
  readonly node: unknown;
  readonly opacity: { readonly opacity: number };
}

function assertPresentedMatches(
  presented: Presented,
  expected: VisualTransform,
): void {
  const node = presented.node as StubNode;
  assert.equal(node.active, true);
  assert.deepEqual(node.position, { ...expected.position, z: 0 });
  assert.deepEqual(node.rotation, {
    x: 0,
    y: 0,
    z: expected.rotationDegrees,
  });
  assert.deepEqual(node.scale, {
    x: expected.scale,
    y: expected.scale,
    z: 1,
  });
  assert.equal(presented.opacity.opacity, expected.opacity);
}

function assertAllSpritesHidden(owner: {
  readonly bodies: readonly Presented[];
  readonly head: Presented;
  readonly tail: Presented;
}): void {
  assert.equal(
    [owner.head, ...owner.bodies, owner.tail]
      .every(({ node }) => !(node as StubNode).active),
    true,
  );
}

function visibleSprites(owner: {
  readonly bodies: readonly Presented[];
  readonly head: Presented;
  readonly tail: Presented;
}): Presented[] {
  return [owner.head, ...owner.bodies, owner.tail]
    .filter(({ node }) => (node as StubNode).active);
}

function ownedNodes(presenter: {
  readonly root: unknown;
}): StubNode[] {
  const root = presenter.root as StubNode;
  const result: StubNode[] = [];
  const visit = (node: StubNode): void => {
    result.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return result;
}

function assertConstructionFailsWithoutNodes(
  input: Parameters<typeof StandardAdvancedBladePresenter.create>[0],
  pattern: RegExp,
): void {
  cc.resetCreatedObjects();
  assert.throws(
    () => StandardAdvancedBladePresenter.create(input),
    pattern,
  );
  assert.equal(cc.createdNodes.length, 0);
}

function point(x: number, y = 0) {
  return Object.freeze({ x, y });
}

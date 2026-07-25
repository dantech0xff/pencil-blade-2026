#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BOMB_COLLISION_FILTER,
  ELECTRIC_COLLISION_FILTER,
  FRUIT_COLLISION_FILTER,
} from '../game/assets/scripts/domain/classic-fixture-rules.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const BOX2D_PATH = resolve(
  ROOT,
  'game/node_modules/@cocos/box2d/build/box2d/box2d.umd.js',
);
const BOX2D_PACKAGE_PATH = resolve(ROOT, 'game/node_modules/@cocos/box2d/package.json');
const REPORT_PATH = resolve(
  ROOT,
  'forensics/runtime/physics2d-backend-equivalence.json',
);
const require = createRequire(import.meta.url);
const box2d = require(BOX2D_PATH);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function nearlyEqual(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function createCircleBody(
  world,
  {
    categoryBits = 1,
    density = 1,
    groupIndex = 0,
    id,
    maskBits = 0xffff,
    position = { x: 0, y: 0 },
    radius = 0.5,
    type = box2d.b2BodyType.b2_dynamicBody,
    velocity = { x: 0, y: 0 },
  } = {},
) {
  const bodyDefinition = new box2d.b2BodyDef();
  bodyDefinition.type = type;
  bodyDefinition.position.Set(position.x, position.y);
  bodyDefinition.linearVelocity.Set(velocity.x, velocity.y);
  const body = world.CreateBody(bodyDefinition);
  body.SetUserData(id ?? null);
  const shape = new box2d.b2CircleShape();
  shape.m_radius = radius;
  const fixtureDefinition = new box2d.b2FixtureDef();
  fixtureDefinition.shape = shape;
  fixtureDefinition.density = density;
  fixtureDefinition.filter.categoryBits = categoryBits;
  fixtureDefinition.filter.maskBits = maskBits;
  fixtureDefinition.filter.groupIndex = groupIndex;
  body.CreateFixture(fixtureDefinition);
  return body;
}

function probeTrajectory() {
  const deltas = [1 / 120, 1 / 60, 1 / 30];
  const rows = deltas.map((deltaSeconds) => {
    const world = new box2d.b2World(new box2d.b2Vec2(0, -10));
    const initial = {
      position: { x: 0, y: 10 },
      velocity: { x: 2, y: 4 },
    };
    const body = createCircleBody(world, {
      position: initial.position,
      velocity: initial.velocity,
    });
    world.Step(deltaSeconds, 10, 10);
    const expectedVelocity = {
      x: initial.velocity.x,
      y: initial.velocity.y - (10 * deltaSeconds),
    };
    const expectedPosition = {
      x: initial.position.x + (expectedVelocity.x * deltaSeconds),
      y: initial.position.y + (expectedVelocity.y * deltaSeconds),
    };
    const actualPosition = body.GetPosition();
    const actualVelocity = body.GetLinearVelocity();
    nearlyEqual(actualVelocity.x, expectedVelocity.x);
    nearlyEqual(actualVelocity.y, expectedVelocity.y);
    nearlyEqual(actualPosition.x, expectedPosition.x);
    nearlyEqual(actualPosition.y, expectedPosition.y);
    return {
      deltaSeconds,
      iterations: { velocity: 10, position: 10 },
      initial,
      expected: {
        position: expectedPosition,
        velocity: expectedVelocity,
      },
      actual: {
        position: { x: actualPosition.x, y: actualPosition.y },
        velocity: { x: actualVelocity.x, y: actualVelocity.y },
      },
      status: 'pass',
    };
  });
  return {
    gravityMetresPerSecondSquared: { x: 0, y: -10 },
    creatorGravityWorldUnitsPerSecondSquared: { x: 0, y: -320 },
    rows,
    status: 'pass',
  };
}

function castAll(world, start, end) {
  const hits = [];
  const callback = new box2d.b2RayCastCallback();
  callback.ReportFixture = (fixture, point, normal, fraction) => {
    hits.push({
      bodyId: fixture.GetBody().GetUserData(),
      fraction,
      point: { x: point.x, y: point.y },
      normal: { x: normal.x, y: normal.y },
    });
    return 1;
  };
  world.RayCast(
    callback,
    new box2d.b2Vec2(start.x, start.y),
    new box2d.b2Vec2(end.x, end.y),
  );
  return hits;
}

function probeRaycast() {
  const world = new box2d.b2World(new box2d.b2Vec2(0, 0));
  createCircleBody(world, {
    id: 'left',
    position: { x: -1, y: 0 },
    radius: 0.5,
  });
  createCircleBody(world, {
    id: 'right',
    position: { x: 1, y: 0 },
    radius: 0.5,
  });
  const start = { x: -5, y: 0 };
  const end = { x: 5, y: 0 };
  const forward = castAll(world, start, end);
  const reverse = castAll(world, end, start);
  const combined = [...forward, ...reverse];
  assert.deepEqual(new Set(forward.map((hit) => hit.bodyId)), new Set(['left', 'right']));
  assert.deepEqual(new Set(reverse.map((hit) => hit.bodyId)), new Set(['left', 'right']));
  for (const id of ['left', 'right']) {
    assert.equal(combined.filter((hit) => hit.bodyId === id).length, 2);
  }
  return {
    publicCreatorBoundary: 'world-coordinate endpoints enter ClassicPhysicsAdapter unchanged; Creator applies PTM once before this backend',
    start,
    end,
    forward,
    reverse,
    concatenation: combined.map((hit) => hit.bodyId),
    duplicateFixtureOccurrencesPreserved: true,
    status: 'pass',
  };
}

function runContactPair(firstFilter, secondFilter) {
  const world = new box2d.b2World(new box2d.b2Vec2(0, 0));
  const first = createCircleBody(world, {
    categoryBits: firstFilter.categoryBits,
    groupIndex: firstFilter.groupIndex,
    id: 'first',
    maskBits: firstFilter.maskBits,
    position: { x: 0, y: 0 },
    radius: 1,
  });
  createCircleBody(world, {
    categoryBits: secondFilter.categoryBits,
    groupIndex: secondFilter.groupIndex,
    id: 'second',
    maskBits: secondFilter.maskBits,
    position: { x: 0, y: 0 },
    radius: 1,
  });
  const observations = {
    beginContacts: 0,
    directDestroyRejectedWhileLocked: false,
    lockedDuringCallback: false,
  };
  const deferred = [];
  const listener = new box2d.b2ContactListener();
  listener.BeginContact = () => {
    observations.beginContacts += 1;
    observations.lockedDuringCallback = world.IsLocked();
    try {
      world.DestroyBody(first);
    } catch {
      observations.directDestroyRejectedWhileLocked = true;
    }
    deferred.push(() => world.DestroyBody(first));
  };
  world.SetContactListener(listener);
  const bodyCountBeforeStep = world.GetBodyCount();
  world.Step(1 / 60, 10, 10);
  const bodyCountAfterStep = world.GetBodyCount();
  const lockedAfterStep = world.IsLocked();
  for (const operation of deferred) {
    operation();
  }
  return {
    ...observations,
    bodyCountBeforeStep,
    bodyCountAfterStep,
    bodyCountAfterDeferredFlush: world.GetBodyCount(),
    deferredOperations: deferred.length,
    lockedAfterStep,
  };
}

function probeContactAndLifecycle() {
  const bombElectric = runContactPair(BOMB_COLLISION_FILTER, ELECTRIC_COLLISION_FILTER);
  assert.equal(bombElectric.beginContacts, 1);
  assert.equal(bombElectric.lockedDuringCallback, true);
  assert.equal(bombElectric.directDestroyRejectedWhileLocked, true);
  assert.equal(bombElectric.bodyCountAfterStep, 2);
  assert.equal(bombElectric.lockedAfterStep, false);
  assert.equal(bombElectric.bodyCountAfterDeferredFlush, 1);

  const fruitBomb = runContactPair(FRUIT_COLLISION_FILTER, BOMB_COLLISION_FILTER);
  assert.equal(fruitBomb.beginContacts, 0);
  assert.equal(fruitBomb.deferredOperations, 0);
  assert.equal(fruitBomb.bodyCountAfterDeferredFlush, 2);

  return {
    collisionRows: {
      fruit: FRUIT_COLLISION_FILTER,
      bomb: BOMB_COLLISION_FILTER,
      electric: ELECTRIC_COLLISION_FILTER,
    },
    acceptedBombElectric: {
      ...bombElectric,
      status: 'pass',
    },
    rejectedFruitBomb: {
      ...fruitBomb,
      status: 'pass',
    },
    lifecycleRule: 'Mutation from a contact callback is rejected while the world is locked; queued destruction succeeds after Step returns.',
    status: 'pass',
  };
}

export function probePhysics2dBackendEquivalence() {
  const box2dPackage = JSON.parse(readFileSync(BOX2D_PACKAGE_PATH, 'utf8'));
  const backendBytes = readFileSync(BOX2D_PATH);
  const trajectory = probeTrajectory();
  const raycast = probeRaycast();
  const contactAndLifecycle = probeContactAndLifecycle();
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    backend: {
      package: box2dPackage.name,
      version: box2dPackage.version,
      implementation: 'Cocos Creator Web Mobile @cocos/box2d UMD backend',
      path: 'game/node_modules/@cocos/box2d/build/box2d/box2d.umd.js',
      bytes: backendBytes.length,
      sha256: sha256(backendBytes),
    },
    recoveredContract: {
      source: 'forensics/contracts/classic-physics-contract.md',
      creatorAdapter: 'game/assets/scripts/creator/classic-physics-adapter.ts',
      unitAndAdapterTests: [
        'tests/reconstruction/vertical-slice/classic-physics-adapter.test.ts',
        'tests/reconstruction/vertical-slice/classic-blade-physics.test.ts',
        'tests/reconstruction/vertical-slice/bird-blade-ray-adapter.test.ts',
        'tests/reconstruction/vertical-slice/classic-variable-step.test.ts',
      ],
    },
    trajectory,
    raycast,
    contactAndLifecycle,
    equivalenceDecision: {
      metricScope: 'recovered-contract-to-Creator-3.8.8-selected-backend',
      originalRuntimeObservation: false,
      trajectory: trajectory.status,
      raycast: raycast.status,
      contact: contactAndLifecycle.status,
      lifecycle: contactAndLifecycle.status,
      status: 'pass',
    },
    residuals: [
      {
        id: 'original-runtime-unobservable',
        classification: 'evidence-limit',
        effectOnCoverage: 'excluded-from-recovered-credit',
        statement: 'The original APK runtime is unavailable, so this probe does not claim empirical frame-by-frame identity with the legacy executable.',
      },
      {
        id: 'backend-ray-ordering-not-contractual',
        classification: 'compatibility-boundary',
        effectOnCoverage: 'ordering-is-recorded-not-assumed',
        statement: 'Box2D does not promise nearest-first callback order; fidelity preserves actual forward results followed by actual reverse results without sorting or deduplication.',
      },
      {
        id: 'electric-native-layout-defect',
        classification: 'reviewed-exception',
        effectOnCoverage: 'memory-unsafe-native-access-not-reproduced',
        statement: 'The recovered invalid electric-contact native layout is replaced by type-safe Creator contact handling while preserving the bilateral filter outcome.',
      },
    ],
    status: 'pass',
  };
}

export function writePhysics2dBackendEquivalenceReport() {
  const report = probePhysics2dBackendEquivalence();
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  return { path: REPORT_PATH, report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { path, report } = writePhysics2dBackendEquivalenceReport();
  process.stdout.write(
    `PASS: Physics2D trajectory/raycast/contact/lifecycle on `
    + `${report.backend.package}@${report.backend.version}; report ${path}\n`,
  );
}

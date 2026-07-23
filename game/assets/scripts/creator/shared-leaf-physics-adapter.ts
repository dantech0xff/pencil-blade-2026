import box2dRuntime from '@cocos/box2d/build/box2d/box2d.umd.js';

import {
  SHARED_LEAF_BODY_DEFAULTS,
  SHARED_LEAF_FIXTURE_DEFAULTS,
  SHARED_LEAF_SLOT_COUNT,
  SHARED_LEAF_WORLD_CONFIGURATION,
  type SharedLeafLayerSnapshot,
  type SharedLeafPhysicsBodyResult,
  type SharedLeafPhysicsStepPort,
  type SharedLeafRespawnCommand,
  type SharedLeafWorldStepCommand,
} from '../domain/shared-leaf-layer';

const box2d = Object.freeze({
  BodyDef: box2dRuntime.b2BodyDef,
  FixtureDef: box2dRuntime.b2FixtureDef,
  PolygonShape: box2dRuntime.b2PolygonShape,
  Vec2: box2dRuntime.b2Vec2,
  World: box2dRuntime.b2World,
});

type Box2dWorld = InstanceType<typeof box2d.World>;
type Box2dBody = ReturnType<Box2dWorld['CreateBody']>;

/** A project-owned second Box2D world; it never mutates Creator's gameplay singleton. */
export class SharedLeafPhysicsAdapter implements SharedLeafPhysicsStepPort {
  private readonly bodies: readonly Box2dBody[];
  private readonly world: Box2dWorld;
  private disposedValue = false;

  constructor(initialSnapshot: SharedLeafLayerSnapshot) {
    assertInitialSnapshot(initialSnapshot);
    const configuration = SHARED_LEAF_WORLD_CONFIGURATION;
    this.world = new box2d.World(new box2d.Vec2(
      configuration.gravityMetresPerSecondSquared.x,
      configuration.gravityMetresPerSecondSquared.y,
    ));
    this.world.SetAllowSleeping(configuration.allowSleep);
    this.world.SetContinuousPhysics(configuration.continuousPhysics);
    this.bodies = Object.freeze(initialSnapshot.slots.map((slot) => {
      const definition = new box2d.BodyDef();
      definition.type = SHARED_LEAF_BODY_DEFAULTS.box2dTypeCode;
      definition.position.Set(slot.body.positionMetres.x, slot.body.positionMetres.y);
      definition.angle = slot.body.angleRadians;
      definition.linearVelocity.Set(
        slot.body.linearVelocityMetresPerSecond.x,
        slot.body.linearVelocityMetresPerSecond.y,
      );
      definition.angularVelocity = slot.body.angularVelocityRadiansPerSecond;
      definition.linearDamping = SHARED_LEAF_BODY_DEFAULTS.linearDamping;
      definition.angularDamping = SHARED_LEAF_BODY_DEFAULTS.angularDamping;
      definition.allowSleep = SHARED_LEAF_BODY_DEFAULTS.allowSleep;
      definition.awake = slot.body.awake;
      definition.fixedRotation = SHARED_LEAF_BODY_DEFAULTS.fixedRotation;
      definition.bullet = SHARED_LEAF_BODY_DEFAULTS.bullet;
      definition.active = SHARED_LEAF_BODY_DEFAULTS.active;
      definition.gravityScale = SHARED_LEAF_BODY_DEFAULTS.gravityScale;
      const body = this.world.CreateBody(definition);

      const shape = new box2d.PolygonShape();
      shape.SetAsBox(
        slot.asset.fixtureHalfExtentsMetres.x,
        slot.asset.fixtureHalfExtentsMetres.y,
      );
      const fixture = new box2d.FixtureDef();
      fixture.shape = shape;
      fixture.userData = SHARED_LEAF_FIXTURE_DEFAULTS.fixtureUserData;
      fixture.density = SHARED_LEAF_FIXTURE_DEFAULTS.density;
      fixture.friction = SHARED_LEAF_FIXTURE_DEFAULTS.friction;
      fixture.restitution = SHARED_LEAF_FIXTURE_DEFAULTS.restitution;
      fixture.isSensor = SHARED_LEAF_FIXTURE_DEFAULTS.sensor;
      fixture.filter.categoryBits = SHARED_LEAF_FIXTURE_DEFAULTS.filter.categoryBits;
      fixture.filter.maskBits = SHARED_LEAF_FIXTURE_DEFAULTS.filter.maskBits;
      fixture.filter.groupIndex = SHARED_LEAF_FIXTURE_DEFAULTS.filter.groupIndex;
      body.CreateFixture(fixture);
      return body;
    }));
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  step(command: SharedLeafWorldStepCommand): readonly SharedLeafPhysicsBodyResult[] {
    this.assertUsable('step');
    assertStepCommand(command);
    for (let slotIndex = 0; slotIndex < SHARED_LEAF_SLOT_COUNT; slotIndex += 1) {
      const input = command.bodies[slotIndex];
      const body = this.requireBody(slotIndex);
      if (input === undefined || input.slotIndex !== slotIndex) {
        throw new RangeError('Shared leaf step bodies must preserve slot order');
      }
      body.SetTransformVec(
        new box2d.Vec2(input.body.positionMetres.x, input.body.positionMetres.y),
        input.body.angleRadians,
      );
      body.SetLinearVelocity(new box2d.Vec2(
        input.body.linearVelocityMetresPerSecond.x,
        input.body.linearVelocityMetresPerSecond.y,
      ));
      body.SetAngularVelocity(input.body.angularVelocityRadiansPerSecond);
      body.SetAwake(input.body.awake);
    }

    this.world.Step(
      command.deltaSeconds,
      command.world.velocityIterations,
      command.world.positionIterations,
    );
    return Object.freeze(this.bodies.map((body, slotIndex) => {
      const position = body.GetPosition();
      const linearVelocity = body.GetLinearVelocity();
      return Object.freeze({
        body: Object.freeze({
          angleRadians: body.GetAngle(),
          angularVelocityRadiansPerSecond: body.GetAngularVelocity(),
          awake: body.IsAwake(),
          linearVelocityMetresPerSecond: Object.freeze({
            x: linearVelocity.x,
            y: linearVelocity.y,
          }),
          positionMetres: Object.freeze({ x: position.x, y: position.y }),
        }),
        slotIndex,
      });
    }));
  }

  applyRespawn(command: SharedLeafRespawnCommand): void {
    this.assertUsable('apply a respawn');
    if (command.type !== 'respawn-shared-leaf-body') {
      throw new TypeError('Shared leaf adapter received an unsupported respawn command');
    }
    const body = this.requireBody(command.slotIndex);
    for (const operation of command.operations) {
      if (operation.type === 'wake-if-sleeping') {
        if (!body.IsAwake()) {
          body.SetAwake(true);
        }
      } else if (operation.type === 'add-angular-velocity') {
        body.SetAngularVelocity(
          body.GetAngularVelocity() + operation.deltaRadiansPerSecond,
        );
      } else if (operation.type === 'set-transform') {
        body.SetTransformVec(
          new box2d.Vec2(operation.positionMetres.x, operation.positionMetres.y),
          operation.angleRadians,
        );
      } else {
        body.SetLinearVelocity(new box2d.Vec2(
          operation.velocityMetresPerSecond.x,
          operation.velocityMetresPerSecond.y,
        ));
      }
    }
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    for (const body of this.bodies) {
      this.world.DestroyBody(body);
    }
    return true;
  }

  private requireBody(slotIndex: number): Box2dBody {
    if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.bodies.length) {
      throw new RangeError('Shared leaf slot index is outside the independent world');
    }
    const body = this.bodies[slotIndex];
    if (body === undefined) {
      throw new Error(`Shared leaf body ${slotIndex} is missing`);
    }
    return body;
  }

  private assertUsable(action: string): void {
    if (this.disposedValue) {
      throw new Error(`Disposed shared leaf physics cannot ${action}`);
    }
  }
}

function assertInitialSnapshot(snapshot: SharedLeafLayerSnapshot): void {
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new TypeError('Shared leaf initial snapshot must be an object');
  }
  if (!Array.isArray(snapshot.slots) || snapshot.slots.length !== SHARED_LEAF_SLOT_COUNT) {
    throw new RangeError(`Shared leaf physics requires exactly ${SHARED_LEAF_SLOT_COUNT} slots`);
  }
}

function assertStepCommand(command: SharedLeafWorldStepCommand): void {
  if (command.type !== 'step-shared-leaf-world') {
    throw new TypeError('Shared leaf adapter received an unsupported step command');
  }
  if (!Number.isFinite(command.deltaSeconds) || command.deltaSeconds < 0) {
    throw new RangeError('Shared leaf step delta must be finite and non-negative');
  }
  if (
    command.world !== SHARED_LEAF_WORLD_CONFIGURATION
    || command.world.velocityIterations !== 5
    || command.world.positionIterations !== 5
  ) {
    throw new Error('Shared leaf step must use the recovered independent-world configuration');
  }
}

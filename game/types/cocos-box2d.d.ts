declare module '@cocos/box2d/build/box2d/box2d.umd.js' {
  class Vec2 {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    Set(x: number, y: number): Vec2;
  }

  class BodyDef {
    type: number;
    readonly position: Vec2;
    angle: number;
    readonly linearVelocity: Vec2;
    angularVelocity: number;
    linearDamping: number;
    angularDamping: number;
    allowSleep: boolean;
    awake: boolean;
    fixedRotation: boolean;
    bullet: boolean;
    active: boolean;
    userData: unknown;
    gravityScale: number;
  }

  class PolygonShape {
    SetAsBox(halfWidth: number, halfHeight: number): PolygonShape;
  }

  class FixtureDef {
    shape: PolygonShape;
    userData: unknown;
    friction: number;
    restitution: number;
    density: number;
    isSensor: boolean;
    readonly filter: {
      categoryBits: number;
      maskBits: number;
      groupIndex: number;
    };
  }

  class Body {
    CreateFixture(definition: FixtureDef): unknown;
    GetAngle(): number;
    GetAngularVelocity(): number;
    GetLinearVelocity(): Readonly<Vec2>;
    GetPosition(): Readonly<Vec2>;
    IsAwake(): boolean;
    SetAngularVelocity(value: number): void;
    SetAwake(awake: boolean): void;
    SetLinearVelocity(value: Readonly<Vec2>): void;
    SetTransformVec(position: Readonly<Vec2>, angle: number): void;
  }

  class World {
    constructor(gravity: Readonly<Vec2>);
    CreateBody(definition: BodyDef): Body;
    DestroyBody(body: Body): void;
    SetAllowSleeping(allowSleep: boolean): void;
    SetContinuousPhysics(continuous: boolean): void;
    Step(deltaSeconds: number, velocityIterations: number, positionIterations: number): void;
  }

  const box2dRuntime: {
    readonly b2BodyDef: typeof BodyDef;
    readonly b2FixtureDef: typeof FixtureDef;
    readonly b2PolygonShape: typeof PolygonShape;
    readonly b2Vec2: typeof Vec2;
    readonly b2World: typeof World;
  };

  export default box2dRuntime;
}

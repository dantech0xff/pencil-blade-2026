---
type: researcher
date: 2026-07-23
status: done
scope: static-only exact Crazy DragonFruit entity contract
---

# Research Report: Crazy DragonFruit Exact Runtime Contract

## Result

The assigned DragonFruit surface is body-recovered. The contract closes the factory,
Down-spawn, cut state machine, timer, score/objective order, four terminal pieces, bounds,
deferred disposal, resources, audio, presentation, and every entity-owned RNG range and
branch order.

The highest-risk restoration details are:

- `DragonFruit::create()` gives the dynamic body exact linear velocity `(0, 0)`.
  `DownRandomData()` does not overwrite linear velocity; gravity begins the fall.
- The Dragon fixture calls `SetAsBox(spriteWidth / 32, spriteHeight / 32)`. Those arguments
  are Box2D half-extents, so the native collision box is twice the sprite width and height.
- The first Cut always freezes the body, reveals the splash, schedules completion, and creates
  the `+0 HITS` label before the accept/reject draw. A rejected first Cut still starts the
  complete 2.1-second sequence.
- Every accepted Cut consumes `nextInt(-45, 45)`, then performs signed integer division by
  `180` before float conversion. Every possible quotient is zero. Accepted hits therefore
  reset the body angle to exactly `0.0f`; the RNG draw is not optional.
- Completion creates all four pieces before notifying score. The exact order is
  `pieces -> score notification -> original disposal -> finish audio -> label fade ->
  objective (15, 1)`.
- Each critical terminal piece performs an ungated `nextInt(0, 3)` every surviving update.
  On result zero it additionally consumes `nextInt(1, 4)` and `nextInt(-10, 10)`.

## Evidence Boundary

Primary native evidence:

- `.forensics-work/phase-01/native/libgame.so`
- SHA-256:
  `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`
- ELF: 32-bit little-endian ARM, Thumb code
- symbol authority: `forensics/native/function-map.csv` and
  `.forensics-work/phase-02/native/symbols/dynamic-demangled.txt`
- string authority: `.forensics-work/phase-02/native/strings/all-offsets.txt`
- resource authority:
  `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-resource-map.md`

The Crazy controller and shared behavior boundary was cross-checked against:

- `forensics/contracts/crazy-mode-contract.md`
- `forensics/contracts/classic-toss-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-audio-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-resource-map.md`

All behavior below comes from static inspection. The APK and native library were not
installed, loaded, linked, translated, emulated, or executed. Addresses are normalized Thumb
addresses with the symbol low bit cleared. `RandomHelper::nextInt(min, max)` at
`0x0016196C` has the recovered inclusive-endpoint contract.

## Native Evidence Index

| Symbol | Address / body range | Contract responsibility |
|---|---|---|
| `DragonFruit::DragonFruit()` | `0x0014EEE8...0x0014EF1C` | state initialization |
| `DragonFruit::create(b2World*)` | `0x0014EF34...0x0014F086` | intact sprite, body, fixture, user data |
| `DragonFruit::onEnter()` | `0x0014EAB8...0x0014EB1C` | splash and cached bounds |
| `DragonFruit::Cut(p1, p2)` | `0x0014EB24...0x0014EE76` | first-hit, accept/reject, label and splash |
| `DragonFruit::EndHitAnimation()` | `0x0014F0B0...0x0014F59E` | four terminal pieces |
| `DragonFruit::HitFinishedCallback()` | `0x0014F5A0...0x0014F626` | completion ordering |
| `DragonFruit::FadeOutCallback()` | `0x0014EA90...0x0014EAAC` | counter-label removal |
| `FreeToss::OnTossTurn()` | `0x0014FE2A...0x0014FE7E` | type-6 creation/attach path |
| `CutObject::DownRandomData()` | `0x0014C508...0x0014C5AC` | Down transform RNG |
| `CutObject::update(float)` | `0x0014C738...0x0014C83C` | shared bounds and fail/dispose calls |
| `CutFruit::create(world, sprite)` | `0x0014C090...0x0014C18E` | piece body and fixture |
| `CutFruit::onEnter()` | `0x0014BD5C...0x0014BD96` | piece fade lifetime |
| `CutFruit::update(float)` | `0x0014BC5C...0x0014BD52` | critical-particle RNG |
| `CutFruit::Dispose()` | `0x0014BC4A...0x0014BC58` | piece deferred disposal |
| `PhysicsObject::Dispose()` | `0x0016179A...0x001617B2` | stop actions and mark disposed |
| `PhysicsObject::update(float)` | `0x00161898...0x001618E2` | unlocked body destruction/removal |
| `NotifycationManager::DragonFruitFinished(int)` | `0x0015D030` | mode callback dispatch |
| `BaseGameplayLayer::DragonFruitFinished(int)` | `0x001426A6...0x001426B4` | score-manager call |
| `ScoreManager::AddScore(int)` | `0x00162AC8...0x00162B04` | normal/pending score application |
| `ObjectivesManager::ProcessGameEvent(int,int)` | `0x0015E794` | terminal objective event |
| `VectorHelper::getAngleOfVector(p1,p2)` | `0x001653A0...0x001653BC` | splash angle |
| `VectorHelper::Rotate(angle, point)` | `0x001653BE...0x00165414` | piece geometry |

## State and Identity

`DragonFruit::create()` allocates `0x230` bytes and sets ID `15`.

| Native offset | Initial value | Role |
|---:|---:|---|
| `+0x110` | `nullptr` | hit-splash sprite |
| `+0x114` | `15` | entity ID |
| `+0x118` | `0` | sequence started |
| `+0x11C` | `0.0f` | cached logical width in metres |
| `+0x120` | `0.0f` | cached logical height in metres |
| `+0x124` | `0` | sequence finished |
| `+0x128` | `nullptr` | hit-counter label |
| `+0x12C` | `0` | accepted-hit count |
| `+0x130` | not initialized by the constructor | `sprintf` buffer for counter text |

DragonFruit inherits `CutObject`, but its custom `Cut()` does not call the generic Fruit cut
path. It does not call `Fruit::PlayCutSound()`, `NotifycationManager::FruitCut()`, or
`CutObject::CutNotification()`. Its inherited `FailNotifycation()` is the empty CutObject
implementation. The Dragon vtable resolves the disposal slot to
`PhysicsObject::Dispose()` at `0x0016179A`.

## Factory, Body, Fixture, and Initial Transform

### Sprite and dynamic body

`DragonFruit::create()` binds `Fruits/dragon-fruit.png` at rodata `0x003DFC82` and stores the
provided world. It builds this exact `b2BodyDef`:

| Property | Recovered value |
|---|---|
| type | dynamic (`b2_dynamicBody`, integer `2`) |
| initial position | `((W * 0.5f) / 32.0f, (H * 1.25f) / 32.0f)` |
| angle | `0.0f` |
| linear velocity | `(0.0f, 0.0f)` |
| angular velocity | `0.0f` |
| linear damping | `0.0f` |
| angular damping | `0.0f` |
| allow sleep | `true` |
| awake | `true` |
| fixed rotation | `false` |
| bullet | `false` |
| active | `true` |
| gravity scale | `1.0f` |
| BodyDef user data | `nullptr` |

`W` and `H` are the current logical director size at factory time. Native float literals are:

```text
0.5f  = 0x3F000000
1.25f = 0x3FA00000
1/32  = 0x3D000000
1.0f  = 0x3F800000
```

After body creation and fixture attachment, the body user-data field is explicitly set to the
DragonFruit object. This is separate from the BodyDef's initially null user data.

### Fixture

Let the intact sprite's runtime content size be `(w, h)` pixels. The fixture is:

| Property | Recovered value |
|---|---|
| shape | polygon box |
| `SetAsBox` arguments | `(w / 32.0f, h / 32.0f)` |
| fixture user data | DragonFruit object |
| friction | `0.2f` (`0x3E4CCCCD`) |
| restitution | `0.0f` |
| density | `1.0f` |
| sensor | `false` |
| category bits | `0x0001` |
| mask bits | `0xFFFC` |
| group index | `0` |

Box2D interprets the two arguments as half-extents. At the recovered `32 px/m` adapter, the
full native fixture therefore spans `2w` by `2h` logical pixels. Restoring a visually matched
`w` by `h` box would not reproduce the native contract.

## Crazy Type-6 Spawn

Crazy creates slot `ad` as `FreeToss(type=6, direction=Down, interval=[15,60])`. The shared
decile timer samples actual thresholds from `15.0...55.5` seconds in `4.5`-second increments.
At expiry, the base timer rearms its next threshold before `FreeToss::OnTossTurn()`.

The type-6 FreeToss branch performs:

1. `DragonFruit::create(world)`;
2. apply the configured random direction data;
3. add the DragonFruit to FreeToss at z-order `1`.

It deliberately skips `TossTurn::PlayTossSound()`.

For Down, `CutObject::DownRandomData()` reads the current logical `(W,H)` and performs this
exact RNG and mutation order:

1. `x = nextInt(truncTowardZero(0.02f * W), truncTowardZero(0.98f * W))`;
2. `SetTransform((float(x) / 32.0f, (1.125f * H) / 32.0f), 0.0f)`;
3. `omega = nextInt(3, 7)`;
4. set angular velocity to `float(omega)` radians/second.

Both integer ranges are inclusive. The float literals are:

```text
0.02f  = 0x3CA3D70A
0.98f  = 0x3F7AE148
1.125f = 0x3F900000
```

Down performs no linear-velocity write. Consequently DragonFruit retains the factory's exact
`(0,0)` velocity until the world step applies gravity.

## `onEnter()` Presentation

`DragonFruit::onEnter()` performs:

1. `PhysicsObject::onEnter()`;
2. attach the intact sprite as a DragonFruit child at z-order `1`;
3. create `Fruits/dragon-splash.png` (`0x003DFC58`);
4. store and attach the splash as another DragonFruit child at z-order `1`;
5. set splash visibility to `false`;
6. cache current `W / 32.0f` at `+0x11C`;
7. cache current `H / 32.0f` at `+0x120`.

There is no explicit splash anchor, position, rotation, scale, or opacity mutation during
entry. The cached metre bounds are later used only for accepted-hit x clamping.

## Cut State Machine

`DragonFruit::Cut(p1,p2)` contains no internal `DisableCut` check. Blade/caller policy must
gate invocation externally.

| State on entry | Behavior |
|---|---|
| `finished != 0` | immediate return; no audio, RNG, physics, or presentation mutation |
| `finished == 0`, `started == 0` | perform first-hit setup, then the normal accept/reject draw |
| `finished == 0`, `started != 0` | begin directly with the accept/reject draw |

### First-hit setup

The first unfinished Cut performs this order exactly:

1. Set `started = 1`.
2. If `Settings::EnableEffects` is true now, request
   `playEffect("Sounds/hitmusic.wav", false)` and discard the handle.
3. Set body angular velocity to `0.0f`.
4. Set body linear velocity to `(0.0f, 0.0f)`.
5. Set body gravity scale to `0.0f`.
6. Set the splash visible.
7. Run `DelayTime(0x40066666)` followed by `HitFinishedCallback()` on the DragonFruit.
8. Create and attach the counter label described below.
9. Continue to `nextInt(0,1)`; the first Cut is not automatically accepted.

`0x40066666` is exact float32 `2.0999999046325684f`. It is action time, nominally 2.1
seconds. The first-hit freeze preserves the body's current position and current angle.

### Initial counter label

The first Cut creates:

| Property | Recovered value |
|---|---|
| initial text | `"+0\nHITS"` (string begins at rodata `0x003D1144`) |
| font | `Fonts/Razing.ttf` (`0x003DFC71`) |
| font size | float32 `(W / 480.0f) * 48.0f` using current width |
| initial position | `(0,0)`, then body centre multiplied by `32` |
| color | RGB `(255,128,64)` |
| anchor point | `(-0.5f, 0.5f)` |
| rotation | `float(nextInt(-30,30))` degrees |
| owner | DragonFruit's parent, not DragonFruit |
| z-order | `1` |

The label position and random rotation are assigned only once. Accepted hits later change its
text and scale but do not move or rerotate it.

### Accept/reject branch and all RNG

Every unfinished Cut draws `nextInt(0,1)` after any first-hit setup:

- result `1`: rejected; return immediately;
- result `0`: accepted; run the accepted-hit sequence.

This creates the following exact draw ledger:

| Call/result | RNG draws in order |
|---|---|
| first Cut, rejected | `nextInt(-30,30)`, `nextInt(0,1) -> 1` |
| first Cut, accepted | `nextInt(-30,30)`, `nextInt(0,1) -> 0`, `nextInt(-45,45)`, x jitter, y jitter |
| later unfinished Cut, rejected | `nextInt(0,1) -> 1` |
| later unfinished Cut, accepted | `nextInt(0,1) -> 0`, `nextInt(-45,45)`, x jitter, y jitter |
| finished Cut | no draws |

All ranges are inclusive. The audio setting does not suppress or insert any listed Dragon RNG
draw.

A rejected first Cut has already frozen the body, revealed the splash, scheduled completion,
created the label, consumed the label-rotation draw, and left the counter at `+0 HITS`. No
splash fade is scheduled on rejection, so it remains at its current presentation until an
accepted hit fades it or the original Dragon is removed.

### Accepted-hit sequence

An accepted Cut performs:

1. Increment `acceptedHitCount`.
2. Draw `a = nextInt(-45,45)`.
3. Compute signed integer `a / 180`, then convert the quotient to float.
4. Read the current body centre `C=(Cx,Cy)`.
5. Read the current logical width and compute the jitter radius:

   ```text
   wi = truncTowardZero(W)
   n  = truncTowardZero(float32(float32(wi) * 0.03f))
   ```

6. Draw `jx = nextInt(-n,n)`, then `jy = nextInt(-n,n)`.
7. Form `P=(Cx + float(jx)/32, Cy + float(jy)/32)`.
8. Clamp only `P.x` to inclusive `[0, cachedWidthMetres]`, where
   `cachedWidthMetres` is the on-entry `W / 32.0f` stored at `+0x11C`; do not clamp `P.y`.
9. `SetTransform(P, float(a / 180))`.
10. If effects are enabled now, request
    `playEffect("Sounds/strawberry.wav", false)` and discard the handle.
11. Update splash position, angle, opacity/action, and counter text/scale.

The `0.03f` literal is `0x3CF5C28F`. Even when `n == 0`, both
`nextInt(0,0)` calls still occur and consume the shared RNG.

Because every `a` lies in `[-45,45]`, signed integer `a / 180` is always `0`. Step 9 therefore
always resets the body angle to exact `0.0f`; `nextInt(-45,45)` remains a mandatory dead-value
draw. Once any hit is accepted, the terminal piece angle will later be zero.

### Accepted splash and counter update

After the accepted transform:

1. set splash position to `P * 32`;
2. set splash rotation to:

   ```text
   VectorHelper::getAngleOfVector(p1,p2) * (180/pi)
   ```

   The helper computes `atanf(-d.x / d.y)` for `d = p1 - p2`; it is not `atan2`.
   The degrees multiplier is float32 `0x42652EE1`.

3. stop all splash actions;
4. set splash opacity to `255`;
5. run `FadeOut(0.175f)` where `0.175f = 0x3E333333`;
6. format `"+%d\nHITS"` into the object buffer with the accepted count;
7. set the counter label string;
8. set counter scale immediately to `0.9f`;
9. run `ScaleTo(0.05f, 1.0f)`.

Splash and counter presentation are not gated by `Settings::EnableEffects`.

## Scheduled Completion, Score, and Objective

At the scheduled callback, including the zero-accepted case,
`DragonFruit::HitFinishedCallback()` performs:

1. set `finished = 1`;
2. call `EndHitAnimation()` and attach all four terminal pieces;
3. call `NotifycationManager::DragonFruitFinished(acceptedHitCount)`;
4. through the registered Crazy/BaseGameplayLayer callback, obtain the current ScoreManager
   and call `ScoreManager::AddScore(acceptedHitCount)`;
5. call virtual `Dispose()` on the original DragonFruit, resolving to
   `PhysicsObject::Dispose()`;
6. if effects are enabled now, request
   `playEffect("Sounds/finishhitmusic.wav", false)` and discard the handle;
7. run the counter-label sequence `FadeOut(1.5f) -> DragonFruit::FadeOutCallback()`;
8. submit `ObjectivesManager::ProcessGameEvent(15,1)`.

The label callback gets the label's parent and removes the label with cleanup enabled.

There is no score per accepted Cut. The entire accepted count is sent once at completion,
after piece creation and before original disposal/audio/objective. Under active double score,
`ScoreManager::AddScore(count)` adds `count` to the pending double-score bucket; the shared
ScoreManager later flushes the bucket multiplied by two. With double score inactive, it adds
directly to normal score.

## Four Terminal Pieces

### Shared geometry and physics

Let:

- `C` be the original body's centre in metres at completion;
- `theta` be the original body's angle in radians at completion;
- `(w,h)` be a piece sprite's runtime content size in pixels;
- `R_theta(v)` be `VectorHelper::Rotate(theta,v)`.

For each piece, the signed algebraic offset template `o` is shown in the table. The native
float32 operation order is more specific than the simplified expression
`C + R_theta(o)`:

```text
Q                    = (float32(C.x + o.x), float32(C.y + o.y))
d0                   = (float32(Q.x - C.x), float32(Q.y - C.y))
r                    = R_theta(d0)
P                    = (float32(C.x + r.x), float32(C.y + r.y))
d1                   = (float32(P.x - C.x), float32(P.y - C.y))
piece position       = P
piece angle          = theta
piece linearVelocity = (float32(35.0f * d1.x), float32(35.0f * d1.y))
piece angularVelocity= 0.0f
piece gravityScale   = 1.0f
```

Mathematically, ignoring float32 cancellation, this reduces to position
`C + R_theta(o)` and velocity `35 * R_theta(o)`. A bit-parity implementation must preserve
the `Q-C`, `P-C`, and multiply sequence above.

The pieces are created and attached sequentially in this exact order:

| Order | Asset | Local offset `o` |
|---:|---|---|
| 1 | `Fruits/dragon-fruit-topleft.png` (`0x003DFC9A`) | `(-w/64, +h/64)` |
| 2 | `Fruits/dragon-fruit-topright.png` (`0x003DFCBA`) | `(+w/64, +h/64)` |
| 3 | `Fruits/dragon-fruit-bottomright.png` (`0x003DFCDB`) | `(+w/64, -h/64)` |
| 4 | `Fruits/dragon-fruit-bottomleft.png` (`0x003DFCFF`) | `(-w/64, -h/64)` |

For each row, the method:

1. creates the sprite;
2. calls `CutFruit::create(world,sprite)`;
3. assigns transform and linear velocity;
4. calls `EnableCritical(true)`;
5. adds the piece to the original DragonFruit's parent at z-order `1`;
6. proceeds to the next row.

There is no RNG or audio inside `EndHitAnimation()`. If at least one hit was accepted,
`theta == 0` because of the integer-division behavior above. If every hit was rejected,
`theta` is the angle preserved by the first-hit freeze.

### Profile dimensions and zero-angle algebraic reference

The following values are the exact algebraic offset templates derived from the measured
profile dimensions, plus their `35*o` zero-angle reference velocities. The stored native
values follow the float32 pipeline above and can differ in the last bits as a function of
centre `C`; arbitrary-angle values use the same pipeline around `R_theta`.

| Piece | 480 content size | 480 offset `o` m | 480 velocity m/s | 720 content size | 720 offset `o` m | 720 velocity m/s |
|---|---:|---:|---:|---:|---:|---:|
| top-left | `48x43` | `(-0.75, 0.671875)` | `(-26.25, 23.515625)` | `73x66` | `(-1.140625, 1.03125)` | `(-39.921875, 36.09375)` |
| top-right | `68x48` | `(1.0625, 0.75)` | `(37.1875, 26.25)` | `103x73` | `(1.609375, 1.140625)` | `(56.328125, 39.921875)` |
| bottom-right | `59x55` | `(0.921875, -0.859375)` | `(32.265625, -30.078125)` | `89x84` | `(1.390625, -1.3125)` | `(48.671875, -45.9375)` |
| bottom-left | `60x45` | `(-0.9375, -0.703125)` | `(-32.8125, -24.609375)` | `91x68` | `(-1.421875, -1.0625)` | `(-49.765625, -37.1875)` |

### Piece body, fixture, and lifetime

Each `CutFruit::create(world,sprite)` makes a dynamic body with zero initial position,
angle, linear velocity, angular velocity, and damping; gravity scale `1.0f`; awake/active and
sleep allowed; fixed rotation/bullet false. EndHitAnimation then applies the transform and
linear velocity above.

Each piece fixture uses:

```text
SetAsBox(w/32, h/32)  // half-extents
friction       = 0.2
restitution    = 0
density        = 1
isSensor       = false
categoryBits   = 0x0001
maskBits       = 0xFFFC
groupIndex     = 0
fixtureUserData= nullptr
```

Unlike the intact Dragon, the piece factory does not subsequently assign body user data.

On entry, a piece attaches its sprite and runs this action on the sprite:

```text
FadeOut(0.75f) -> CutFruit::FadeOutCallback() -> CutFruit::Dispose()
```

Thus nominal visual lifetime is exact `0.75f` action seconds. Bounds can mark a piece for
disposal earlier. `CutFruit::Dispose()` delegates to `PhysicsObject::Dispose()` and also stops
actions on the CutFruit node; actual body destruction remains deferred.

### Critical-piece RNG and VFX

Every terminal piece is critical. After calling the shared `CutObject::update()` each update,
a piece that is still critical and not marked disposed performs:

1. `emit = nextInt(0,3)`;
2. if `emit != 0`, stop for this update;
3. if `emit == 0`, draw `frame = nextInt(1,4)`;
4. format `Criticles/criticle%d.png` with `frame`;
5. construct `ParticleObject(path, 1.5f)`;
6. set its position to the piece body centre multiplied by `32`;
7. draw `r = nextInt(-10,10)`;
8. call `VectorHelper::Rotate(float(r), position)`; the helper uses the value directly as
   radians;
9. discard the computed rotated point and attach the particle to the piece's parent at
   z-order `1`.

All three ranges are inclusive. The third draw and rotation calculation are observable in RNG
parity even though no second particle-position setter applies the rotated result. This entire
critical VFX path is independent of `Settings::EnableEffects`.

## Bounds, Misses, and Deferred Disposal

`CutObject::update()` first calls `PhysicsObject::update()`. If no body remains, it returns.
If both linear-velocity components are exactly zero, it skips every bounds check for that
update.

Otherwise, let `(x,y)` be body coordinates multiplied by `32`, and let `(W,H)` be the current
logical director size. Comparisons are strict:

| Condition | Calls |
|---|---|
| `y < -0.2f * H` | virtual `FailNotifycation()`, then virtual `Dispose()` |
| `y > 1.2f * H` | virtual `Dispose()` |
| `x < -0.2f * W` | virtual `Dispose()` |
| `x > 1.2f * W` | virtual `Dispose()` |

For the intact DragonFruit, inherited `FailNotifycation()` is empty. Falling below the screen
therefore emits no Crazy `FruitFail`, `BonusFruitFail`, score mutation, strike, or objective
event. Side/top exits likewise only dispose. Terminal CutFruit pieces inherit the same bounds.

The first Cut's zero velocity plus zero gravity causes the original Dragon to remain frozen
and to skip bounds until its scheduled completion.

`PhysicsObject::Dispose()` does not immediately destroy the Box2D body. When a body exists it:

1. stops all actions on the entity;
2. sets the disposed flag.

On a later `PhysicsObject::update()`, if the world is not locked, it destroys the body,
removes the entity from its parent with cleanup enabled, and clears the body pointer. If the
world is locked, removal is deferred again. Completion's label is a sibling, so its separately
started 1.5-second fade can survive disposal of the original Dragon node.

## Audio and Effects Gates

| Trigger | Request | Gate point | RNG relationship |
|---|---|---|---|
| first unfinished Cut only | `Sounds/hitmusic.wav`, non-looping effect | current `EnableEffects`, before first-hit physics/label RNG | gate consumes no RNG |
| every accepted Cut | `Sounds/strawberry.wav`, non-looping effect | current `EnableEffects`, after transform/jitter RNG | gate consumes no RNG |
| scheduled completion | `Sounds/finishhitmusic.wav`, non-looping effect | current `EnableEffects`, after score notification and original Dispose | gate consumes no RNG |

All handles are ignored; there is no Dragon-owned `stopEffect`. The setting is read at each
event rather than latched on the first Cut.

Negative and ungated behavior:

- type-6 FreeToss has no toss-sound request;
- DragonFruit does not request a generic Fruit cut sound;
- no Dragon call is gated by `EnableMusic`;
- splash, hit-counter, terminal pieces, and critical-particle VFX are not gated by
  `EnableEffects`;
- `EndHitAnimation()` itself requests no audio and consumes no RNG.

## Resource Binding

The manifest-backed profiles used directly by this entity are:

| Logical path | 480x800 size | 720x1280 size |
|---|---:|---:|
| `Fruits/dragon-fruit.png` | `118x101` | `177x153` |
| `Fruits/dragon-splash.png` | `13x401` | `21x601` |
| `Fruits/dragon-fruit-topleft.png` | `48x43` | `73x66` |
| `Fruits/dragon-fruit-topright.png` | `68x48` | `103x73` |
| `Fruits/dragon-fruit-bottomright.png` | `59x55` | `89x84` |
| `Fruits/dragon-fruit-bottomleft.png` | `60x45` | `91x68` |

Full staged byte counts and SHA-256 values are recorded in
`researcher-2026-07-23-crazy-resource-map.md`; this report uses those measured dimensions for
the profile-exact piece geometry above.

Additional direct resources:

- `Fonts/Razing.ttf`
- `Criticles/criticle1.png` through `Criticles/criticle4.png`
- `Sounds/hitmusic.wav`
- `Sounds/strawberry.wav`
- `Sounds/finishhitmusic.wav`

## Restoration Acceptance Matrix

An implementation test harness should inject a scripted inclusive RNG and manual action clock.
Minimum exact cases:

1. Factory snapshot for every BodyDef/fixture property, including the oversized half-extents
   and both fixture/body user-data assignments.
2. Down spawn endpoint coverage for both x endpoints and angular values `3` and `7`; assert no
   linear-velocity command and retained factory `(0,0)`.
3. First rejected Cut: freeze, visible splash, scheduled timer, `+0 HITS`, exactly two draws,
   no strawberry cue.
4. First accepted Cut: complete five-draw order, accepted count `1`, angle exactly zero, x-only
   clamp, both first-hit and accepted cues when effects are enabled.
5. Later rejected and accepted Cuts with effects toggled between calls; assert RNG is
   unchanged by gates.
6. `n == 0`: assert both zero-range jitter draws are still consumed.
7. Finished Cut: assert total no-op.
8. Completion with zero and nonzero accepted counts: all four pieces before one score call,
   then original disposal, finish cue, label fade, objective `(15,1)`.
9. All four piece transforms/velocities at `theta == 0` and a nonzero preserved `theta`;
   validate profile dimensions and exact `0.75f` fade.
10. Critical update branches: one draw on nonzero `emit`, three draws on zero `emit`, no
    effects-setting gate, and no application of the computed rotated point.
11. Bottom/side/top bounds and exact-zero-velocity skip; assert Dragon bottom miss has no mode
    miss notification or objective.
12. Deferred disposal while the world is locked, then body destruction/node removal after
    unlock.

## Unresolved Questions

None in the assigned DragonFruit runtime surface.

Status: DONE
Summary: Exact static DragonFruit factory, spawn, cut RNG, completion, score/objective, four-piece, lifetime, bounds, disposal, resource, and audio/effect contracts recovered.
Concerns/Blockers: No blocker; runtime execution was intentionally excluded by the evidence policy.

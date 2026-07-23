# Research Report: Standard Bomb Explosion and Lifecycle

Date: 2026-07-23
Scope: Pencil Blade 1.5 static-only recovery for the standard Bomb shared by Classic and Crazy
Root: `/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026`

## Executive Summary

The standard Bomb explosion is recoverable closely enough to implement its semantics without
inventing presentation behavior.

It is not a sprite, particle system, expanding ring, fragment simulation, or textured effect.
Native `BombExplosionAnimation` draws opaque-white procedural geometry:

1. `0.25 s` with no explosion geometry;
2. `1.00 s` of a full-screen white quadrilateral;
3. `1.25 s` of accumulated white triangles from the bomb's cut-time position to random pairs
   of points on the visible-screen perimeter;
4. detach and clean the explosion node, notify `AfterBombHit`, then request Bomb disposal.

The cut-time Bomb itself is held by setting linear velocity, angular velocity, and gravity scale
to zero. This third write is essential in Crazy because Crazy does **not** pause the physics
world during the explosion. Classic separately pauses its whole physics world in
`ClassicModeLayer::BombHit`.

Two current reconstruction details conflict with the recovered body:

- `ClassicGeneratedBomb.freezeMotion()` does not set `gravityScale = 0`;
- its one-shot guard suppresses the pre-freeze effect-stop hook on repeated cut reports, while
  native performs both `stopEffect` requests before checking the Bomb's one-shot cut flag.

Semantic/timing parity is implementable from static evidence. Pixel-identical parity is not
provable because the inherited native GL blend state, runtime viewport, random seed/shared-stream
position, scheduler interleaving, and Creator's triangle rasterization differ or remain unknown.

## Evidence Boundary and Classification

Primary authority:

- `.forensics-work/phase-01/native/libgame.so`, ARM/Thumb static disassembly only;
- `forensics/native/function-map.csv` for normalized symbol starts and sizes;
- `forensics/resources/resource-usage-map.json` for asset dimensions, bytes, and hashes;
- reviewed contracts under `forensics/contracts/`;
- current implementation and tests under `game/assets/scripts/` and
  `tests/reconstruction/vertical-slice/`.

The task's suggested `/Users/dan/Desktop/ac-java-game` root was searched but is an unrelated
Java game tree and contains no Pencil Blade `libgame.so`/Bomb evidence. No claims below use it.

Address convention: code addresses below are normalized even Thumb addresses. ELF symbol values
carry the low Thumb bit, for example symbol `0x00145865` maps to code `0x00145864`.

Classification:

- **Recovered**: direct symbol, function-body, literal, call-site, or resource evidence.
- **Inferred**: necessary porting consequence or engine-semantic interpretation of recovered
  instructions.
- **Unknown**: not fixed by the static corpus.

No original executable was run, loaded, linked, translated, or emulated.

## Recovered Body, Fixture, and Intact Presentation

### Factory and physics definition

`Bomb::create(b2World*, int)` at `0x001456C0`, size `336`, recovers:

| Property | Recovered value |
|---|---:|
| body type | dynamic (`2`) |
| initial position | `(0, 0)` metres |
| initial angle | `0` radians |
| initial linear velocity | `(0, 0)` metres/second |
| initial angular velocity | `0` radians/second |
| linear/angular damping | `0`, `0` |
| allow sleep / awake | `true`, `true` |
| fixed rotation / bullet / active | `false`, `false`, `true` |
| initial gravity scale | `1` |
| body user data | Bomb object |
| shape | circle, centre `(0, 0)` metres |
| radius | `spriteWidth / 2.75 / 32` metres |
| Creator-world radius | `4 * spriteWidth / 11` at 32 world units/metre |
| density / friction / restitution | `1`, float32 `0.2`, `0` |
| sensor | `false` |
| filter category / mask / group | `0x0002`, `0x0001`, `0` |
| sprite anchor | `(0.5, 0.4)` |

The radius formula is supported by the `2.75` and `1/32` literals in
`0x00145784...0x00145790`; the anchor setters and `0.5`/`0.4` literals occur in
`0x001457C0...0x001457DC`.

Supported IDs in this factory:

| ID | Logical raster | 480x800 | 720x1280 |
|---:|---|---|---|
| `0` | `Bomb/bomb_X.png` | `80x108`, SHA-256 `07782a622d0cd98c86cff191123450cd6358af473ecf04f0b293950513866716` | `121x161`, SHA-256 `fda187091370d3a085fe3049be73bb3bd2f9588fcf640457807d8d094e8d25ad` |
| `1` | `Bomb/bomb_10.png` | `79x105`, SHA-256 `35225cd6ad2a0b08adc320885cac1a451fe88adcf5495bc6e3e395f621164606` | `118x158`, SHA-256 `08f9dc1bfe058a30129ab9e94a60b12e1eedfdc33ad2d0592f382bcd19e258ce` |

The restored Classic/Crazy standard create command currently uses ID `0`.

### Fuse loop and smoke

`Bomb::onEnter()` at `0x00145538`, size `104`, starts non-looping
`Sounds/boomsound.wav` when effects are enabled and stores its handle at Bomb offset `+0x118`.
The file is mono 22,050 Hz signed 16-bit PCM, `273,762` data bytes (`~6.207755 s`), SHA-256
`05edba9ad6322072309862d5fb90b85d09758bb3d06c15328f3471e8c7a1667d`.

While the body exists and the Bomb's cut flag is clear, `Bomb::update(float)` at
`0x001459AC`, size `216`, makes one inclusive `RandomHelper::nextInt(0, 6)` call per update.
Only result `0` emits smoke, giving a local probability of `1/7` per scheduled Bomb update.

Let:

- `B = (body.x * 32, body.y * 32)`;
- `u = (0, spriteHeight * 0.5)`;
- `R(a, u) = (cos(a) * u.x - sin(a) * u.y,
  sin(a) * u.x + cos(a) * u.y)`.

The smoke node position is exactly `B + R(bodyAngle, u)`. The rotation helper is
`Bomb::Rotate(float, CCPoint)` at `0x00145954`, size `88`. Smoke is added to the Bomb's parent
at z-order `1`, not as a moving child of the Bomb.

`SmokeAnimation::onEnter()` at `0x00164068`, size `320`, uses
`Bomb/bombsmoke.png`. Both resolution trees contain the same `1920x256` RGBA file, SHA-256
`277f464434115cc79048013dc12d956865cf32e09802432ee097a636ccd3d4fe`.
The recovered atlas/action is:

- 30 frames, each `128x128`;
- row-major order: row `0`, columns `0...14`, then row `1`, columns `0...14`;
- frame interval float32 `0.033333335 s`;
- animation repeats on its sprite;
- the smoke node independently waits `1.0 s`, then removes itself with cleanup.

No smoke position tween, velocity, acceleration, fade, tint, custom opacity, or custom blend
setter occurs in this body. Engine defaults for those unset properties are inferred rather than
explicitly recovered.

This smoke is the intact fuse effect. It is not part of `Bomb::Cut` or the explosion raster path.

## Exact Cut Gate and Synchronous Ordering

`Bomb::Cut(CCPoint, CCPoint)` at `0x00145864`, size `136`, ignores both cut endpoints. Its exact
body order is:

1. If effects are enabled, call `stopEffect` for stored slot `+0x114`, then for stored slot
   `+0x118`.
2. Read the one-byte cut flag at `+0x11C`; return if already set.
3. Set `+0x11C = 1`.
4. Set body linear velocity to `(0, 0)`.
5. Set body angular velocity to `0`.
6. Set body gravity scale at body offset `+0x8C` to `0`.
7. Call `Bomb::Explosion()`.
8. Synchronously call `NotifycationManager::BombHit()`.
9. After `BombHit()` returns, check effects-enabled again and, if enabled, request non-looping
   `Sounds/boomexplosion.wav`. Its returned handle is ignored.
10. Return.

Consequences:

- Explosion attachment happens before the mode's `BombHit` handler.
- Mode score/hold work completes before explosion audio starts.
- A repeated report against the same already-cut Bomb repeats the two effect-stop requests, but
  does not freeze again, attach another explosion, notify the mode, or replay explosion audio.
- The effects-enabled gate is evaluated separately at entry and after `BombHit`; no static
  assumption may combine them into one cached value.
- Distinct Bomb objects retain independent one-shot flags and may each attach an explosion.

The stored-slot provenance is only partly recovered:

- `+0x118` is proven to receive `boomsound.wav`'s handle in `Bomb::onEnter`;
- `+0x114` is initialized to zero by `Bomb::Bomb()` at `0x00145678`, but no normal Bomb-path
  write was found in this slice;
- `boomtoss.wav` is requested elsewhere and its returned handle is not proven to be stored in
  Bomb `+0x114`.

Therefore “stop two stored IDs” is recovered, while “two live retained Bomb sounds” is not.

`Sounds/boomexplosion.wav` is mono 22,050 Hz signed 16-bit PCM, `193,792` data bytes
(`~4.394376 s`), SHA-256
`65b748c4132f2f8f855ee5a9fabac0feae9acb5824984909d36d9dce2d8bf0e9`.
The explosion node finishes at nominal `2.5 s`; the audio is not stopped by that finish path and
can outlive the visual/Bomb node.

## Exact Explosion Presentation

### Creation and coordinates

`Bomb::Explosion()` at `0x00145810`, size `84`:

1. reads the body's position in metres;
2. multiplies both coordinates by exact float `32`;
3. calls `BombExplosionAnimation::createWithTarget(point, bomb, callback)`;
4. adds the returned node as a Bomb child at z-order `1`.

No explosion texture is loaded. No particle emitter is created. No fragment sprites are made.
The intact Bomb sprite is not hidden or removed by `Cut`/`Explosion`; it remains stationary until
final Bomb disposal, with white geometry drawn over the scene during the relevant states.

Native `PhysicsObject` keeps the Bomb container at the origin and synchronizes its sprite using
absolute body-world coordinates. That explains why a Bomb child can store/draw absolute visible
coordinates. This is important when porting to the current Creator representation, whose Bomb
node itself is positioned in world space.

### State machine and action clock

Recovered symbol/body ranges:

| Function | Normalized address | Size |
|---|---:|---:|
| `finishStateCallback()` | `0x00146392` | `64` |
| `beginStateCallback()` | `0x001463D4` | `64` |
| `waitStateCallback()` | `0x00146414` | `64` |
| `setPosition(CCPoint const&)` | `0x00146454` | `10` |
| `draw()` | `0x00146460` | `320` |
| `onEnter()` | `0x001465A0` | `60` |
| constructor | `0x001465DC` | `100` |
| `create(CCPoint)` | `0x00146640` | `42` |
| `RegisterFinishEvent(...)` | `0x0014666A` | `22` |
| `createWithTarget(...)` | `0x00146680` | `60` |
| `addNew2Point()` | `0x001466E4` | `424` |
| `update(float)` | `0x0014688C` | `48` |

Constructor state:

- bomb-world point at `+0xE4`;
- generated pair count `+0xEC = 0`;
- empty `vector<CCPoint>` at `+0xF0`;
- visual state `+0xFC = 0`;
- edge cursor `+0x100 = 1`;
- callback fields cleared;
- scheduled updates begin immediately.

`onEnter` and callbacks form this exact action-clock sequence:

| Nominal interval | State value | Recovered draw |
|---|---:|---|
| `0.00...0.25 s` | `0` | no explosion geometry |
| `0.25...1.25 s` | `2` | full-visible-rect white quad every draw |
| `1.25...2.50 s` | `1` | all accumulated bomb-to-edge white triangles |
| at `2.50 s` | finish | detach/cleanup, callback |

The literals are `0.25`, `1.0`, and `1.25`. These are Cocos action durations, not Box2D steps.
Classic's physics pause therefore does not eliminate the explosion action timeline.

### Full-screen flash

In state `2`, `draw()` builds four points in this order:

1. `VisibleRect::leftTop`;
2. `VisibleRect::rightTop`;
3. `VisibleRect::rightBottom`;
4. `VisibleRect::leftBottom`.

It calls `glLineWidth(1.0)` and
`ccDrawSolidPoly(points, 4, ccColor4F(1, 1, 1, 1))`.
`ccDrawSolidPoly` at `0x001ABAC0`, size `136`, uses `GL_TRIANGLE_FAN` and the
position-color shader. The helper does not configure a blend function in its body.

Recovered color is opaque white. No additive blend, opacity animation, fade, texture, or
post-process effect is configured by the explosion. The exact inherited GL blend-enable/function
state is **unknown**. With alpha `1`, ordinary source-over and disabled blending produce the same
interior white result; edge/rasterization parity remains engine-dependent.

### Triangle generation

Only state `1` generates points. Each scheduled `update`:

1. returns if generated pair count is already greater than `99`;
2. consumes `RandomHelper::nextInt(0, 6)`;
3. returns unless the result is `0`;
4. on success, calls `addNew2Point()` and increments the pair count.

Thus:

- one gate-miss update consumes exactly one RNG draw;
- one successful update consumes exactly three RNG draws total;
- at most `100` point pairs / `100` triangles can be generated;
- because the triangle state lasts only `1.25 s`, reaching 100 is not guaranteed and is
  implausible at ordinary frame rates.

`addNew2Point()` consumes the two success draws in this order:

1. `gap = nextInt(trunc(W * 0.1f), trunc(W * 0.2f))`;
2. one perimeter coordinate draw for the selected edge.

`W` is visible-rect width. Both `nextInt` ranges are inclusive. Float-to-int conversions truncate
toward zero. The gap is based on width even for vertical edges.

The edge cursor starts at `1`, but increments and wraps before selection. Successful pairs cycle:

`RIGHT (2) -> BOTTOM (3) -> LEFT (4/default) -> TOP (1) -> ...`

Let `L`, `R`, `B`, `T` be the visible rectangle's left, right, bottom, and top coordinates:

| Edge | Coordinate draw | First point | Second point |
|---|---|---|---|
| RIGHT | `y = nextInt(trunc(B), trunc(T))` | `(R, float(y))` | `(R, float(y) + float(gap))` |
| BOTTOM | `x = nextInt(trunc(L), trunc(R))` | `(float(x), B)` | `(float(x) + float(gap), B)` |
| LEFT | `y = nextInt(trunc(B), trunc(T))` | `(L, float(y))` | `(L, float(y) + float(gap))` |
| TOP | `x = nextInt(trunc(L), trunc(R))` | `(float(x), T)` | `(float(x) + float(gap), T)` |

There is no clamp of the second point, so it may extend past `R` or `T`.
Points are appended first-point then second-point.

During state `1`, `draw()` loops over every generated pair and calls:

`ccDrawSolidPoly([cutTimeBombPoint, points[2*i], points[2*i+1]], 3, white)`

for each `i`. Earlier triangles remain and are redrawn every frame until finish. Triangles have:

- no position velocity;
- no angular velocity;
- no scale velocity;
- no alpha/fade curve;
- no per-triangle lifetime;
- no per-triangle color variation;
- no texture or sprite;
- no particle physics.

Their only time evolution is accumulation when a scheduled update passes the `1/7` RNG gate.

### RNG implementation and determinism boundary

`RandomHelper::nextInt(int, int)` at `0x0016196C`, size `52`, lazily seeds the process-wide
`drand48` family with `srand48(time(NULL))`, then returns:

`low + (lrand48() % (high - low + 1))`.

Recovered local Bomb-explosion draw order is exact. Exact generated geometry is **unknown**
without:

- the runtime wall-clock seed;
- the shared RNG stream position after other game systems consume draws;
- the exact number/order of scheduled Bomb and explosion updates.

An implementation should therefore inject the game's shared inclusive integer RNG and preserve
call count/order. It should not substitute independent per-explosion randomness if deterministic
cross-system parity is required.

## Finish, Callback, and Disposal Boundary

`BombExplosionAnimation::finishStateCallback()` at `0x00146392` performs:

1. `unscheduleUpdate()`;
2. obtain the Bomb parent;
3. `parent->removeChild(explosion, true)`;
4. if a finish target exists, invoke its registered member callback with the now-detached
   explosion object.

`Bomb::ExploseAnimationCallback(CCObject*)` at `0x00145520`, size `22`, then performs:

1. `NotifycationManager::AfterBombHit()`;
2. virtual `Bomb::Dispose()`.

`Bomb::Dispose()` at `0x001454F4`, size `44`:

1. if effects are enabled, stops slot `+0x118` again;
2. delegates to `PhysicsObject::Dispose()`.

`PhysicsObject::Dispose` requests disposal. The body is destroyed and the node removed from its
parent only when the physics world is unlocked in the shared `PhysicsObject::update` path.
Therefore the observable boundary is:

`explosion detached -> mode AfterBombHit -> Bomb disposal requested -> later unlocked body/node destruction`.

It is not:

- dispose Bomb before `AfterBombHit`;
- keep explosion attached through `AfterBombHit`;
- immediately destroy a Box2D body from the action callback.

`NotifycationManager::BombHit()` at `0x0015CFF0` and `AfterBombHit()` at `0x0015D010` each
check the registered mode pointer before calling virtual slots `+0x200` and `+0x204`.
`BaseGameplayLayer::onEnter()` registers the current mode. With no current mode, each notification
is a no-op; the Bomb callback still proceeds to disposal.

## Mode-Specific Lifecycle: Classic Versus Crazy

### Shared facts

The standard Bomb owns:

- its own cut one-shot flag;
- its own motion/gravity hold;
- explosion attachment/timing/geometry;
- `BombHit` and delayed `AfterBombHit` notifications;
- post-animation disposal request;
- fuse/explosion audio request order.

The mode owns the gameplay response to the two notifications.
`BaseGameplayLayer::BombHit()` at `0x001426A2` and
`BaseGameplayLayer::AfterBombHit()` at `0x001426A4` are each a two-byte `bx lr` no-op.

### Classic

`ClassicModeLayer::BombHit()` at `0x00148C20`, size `162`, performs:

1. disable cuts;
2. stop the nine toss controllers in recovered order;
3. stop `BombElectric`;
4. call the mode's `StopPhysicsWorld(true)` path;
5. apply score `-10`.

`ClassicModeLayer::AfterBombHit()` at `0x00149484`, size `24`, performs guarded `GameOver`, then
`StopPhysicsWorld(false)`.

Classic therefore freezes all game physics during the nominal `2.5 s` action-clock explosion,
then resumes after its game-over transition logic.

### Crazy

`CrazyModeLayer::BombHit()` at `0x0014B22E`, size `66`, performs:

1. disable cuts;
2. direct call to the no-op `BaseGameplayLayer::BombHit`;
3. apply score `-10`;
4. disable/flush double score;
5. stop the magnet fruit's `FreeToss`;
6. submit objective event `(8, 1)`.

`CrazyModeLayer::AfterBombHit()` at `0x0014B21C`, size `18`, calls the no-op base method, then
re-enables cuts.

Crazy does not call `StopPhysicsWorld`, does not stop the ordinary toss graph here, and has no
inherited base presentation/physics hold to invoke. The Bomb's own zero-velocity plus
`gravityScale = 0` writes keep that Bomb stationary while Crazy's other physics continues.

The statement in the current `crazy-mode-contract.md` that this handler invokes an inherited
bomb-hit presentation/physics hold is contradicted by the direct base bodies and Crazy call site.
The shared *Bomb animation/disposal* lifecycle still applies; a shared *mode world hold* does not.

If multiple Bomb explosions overlap, each completion independently emits `AfterBombHit`.
It follows from the recovered code that Crazy's first completion can re-enable cuts while a later
Bomb explosion remains active. This is a static consequence, not a runtime-observed scenario.

## Current Reconstruction Delta

`game/assets/scripts/creator/classic-generated-bomb.ts` currently:

- correctly configures the recovered initial gravity scale `1`, fixture, filter, anchor, and ID-0
  raster;
- explicitly stops at an explosion handoff;
- sets the guard before `onBeforeFreeze`;
- freezes linear and angular velocity but does not change gravity scale.

Required recovered corrections before Crazy can share it:

1. Execute the two effect-stop requests before checking the already-cut guard, if exact duplicate
   report semantics are in scope.
2. On first cut, set `body.gravityScale = 0` together with zero linear/angular velocity.
3. Preserve attachment-before-`BombHit`, explosion-audio-after-`BombHit`, and delayed
   `AfterBombHit` ordering.
4. Do not make Crazy pause its world.
5. Detach/cleanup the explosion presentation before `AfterBombHit`, then queue Bomb destruction at
   the physics-safe boundary.

The corresponding current test named
`first cut guards repeats before callback, freezes motion, and waits for afterBombHit finish`
asserts the existing guard-before-callback behavior and does not assert cut-time gravity scale.
It must be revised when implementing the recovered semantics.

## Non-Invented Creator Implementation Decision

**Decision: yes for semantic and presentation-contract parity; no claim of pixel-identical GL
parity.**

The minimum implementation surface should be:

1. A pure shared `standard-bomb-explosion` state machine containing:
   - exact `0.25 / 1.0 / 1.25 s` phases;
   - visible rectangle and immutable cut-time bomb point;
   - edge cursor and point-pair list;
   - injected inclusive integer RNG;
   - one gate draw per triangle-state update and exact success draw order;
   - 100-pair cap;
   - a single finish event.
2. A Creator presenter using `Graphics` or a small position-color mesh:
   - opaque white fill;
   - full visible rectangle during state `2`;
   - one triangle per accumulated pair during state `1`;
   - no textures, particles, fades, or moving fragments;
   - detach itself before invoking the finish callback.
3. A shared standard-Bomb lifecycle adapter:
   - pre-guard stop requests;
   - first-cut motion/gravity hold;
   - attach presenter;
   - mode `BombHit`;
   - request `boomexplosion.wav`;
   - on presentation finish: mode `AfterBombHit`, stop fuse handle if enabled, queue Bomb disposal.
4. Separate Classic and Crazy notification adapters:
   - Classic keeps its recovered world stop/resume and game-over behavior;
   - Crazy keeps the world running and only applies its recovered score/effect/objective/cut-gate
     changes.
5. Optional intact-fuse smoke presenter using the recovered `30 x 128x128` atlas frames and
   independent one-second node lifetime.

Porting coordinate warning: the current Creator Bomb node is itself placed at body-world
position, unlike the native origin container. Drawing stored absolute screen points as that
node's local child coordinates would double-translate them. Either attach the explosion presenter
to the scene/overlay root in world coordinates, or convert every recovered absolute point into
the Bomb node's local coordinate space.

No new explosion art asset should be introduced.

## Recovered, Inferred, and Unknown Summary

| Item | Status |
|---|---|
| fixture/body/filter/anchor/radius | recovered |
| first-cut gate and motion/gravity writes | recovered |
| cut endpoints unused | recovered |
| audio request/stop ordering | recovered |
| 0.25 / 1.0 / 1.25 visual phases | recovered |
| white quad and accumulated white triangles | recovered |
| local RNG calls, modulo algorithm, pair cap, edge cycle | recovered |
| triangle coordinates and absence of velocities/fades/textures | recovered |
| detach -> AfterBombHit -> deferred Bomb disposal | recovered |
| Classic full-world hold; Crazy no world hold | recovered |
| Creator world-root versus local-coordinate mapping | inferred porting consequence |
| behavior of overlapping Crazy Bomb completions | inferred static consequence |
| runtime random seed and shared-stream position | unknown |
| update/frame scheduler interleaving and final triangle count | unknown |
| runtime visible rectangle coordinates | unknown until scene/profile selection |
| inherited native GL blend state and pixel-edge rasterization | unknown |
| semantic meaning/live provenance of Bomb slot `+0x114` | unknown |

## Unresolved Questions

- Which existing shared RNG service will own the process-wide inclusive draw stream in the
  Creator runtime?
- Should exact duplicate cut reports repeat audio-stop adapter calls, or will the integration
  guarantee one dispatch per Bomb and document that narrower boundary?
- Should the presenter use Creator `Graphics` for simplicity or a position-color mesh to reduce
  rasterization differences?
- Which scene node is the authoritative visible-rect overlay root for both asset profiles?

Status: DONE
Summary: Exact standard Bomb explosion geometry, RNG protocol, lifecycle, physics hold, audio
order, and Classic/Crazy callback boundary recovered. A non-invented semantic Creator
implementation is possible; current Bomb gravity freeze and duplicate-stop ordering need
correction.
Concerns/Blockers: Pixel-identical GL output and exact runtime triangle sequence remain
unprovable without original runtime seed/scheduler/GL-state observation.

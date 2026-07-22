# Classic Physics Contract

## Scope and evidence boundary

This contract defines the physics behavior required by the first playable Classic vertical
slice. It was recovered without installing or executing the original APK. The production
implementation must use Cocos Creator Physics2D and must not load, link, translate, or ship
the original native library.

The immutable source is `DER-NATIVE-001` (`libgame.so`, SHA-256
`55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`) derived from
`SRC-APK-001` (SHA-256
`95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa`). Symbol and
analysis-corpus references are `DER-FUNCMAP-001` and `DER-NATIVE-CORPUS-001`.

All addresses below are normalized ARM Thumb instruction addresses: the dynamic-symbol
Thumb bit is cleared with `rawAddress & ~1`, and the ELF image base is `0x0`. Representative
ranges and constants were checked in both GNU ARM objdump and LLVM objdump configured for
Thumbv5TE. The method and evidence-status definitions are in
[`docs/static-reconstruction-method.md`](../../docs/static-reconstruction-method.md).

The targeted Phase 4 ranges were regenerated from `DER-NATIVE-001` with the tool versions
recorded by `DER-NATIVE-CORPUS-001`. Most are not among the Phase 2 corpus's four archived
sample slices, so cross-tool agreement here is reviewer-reproducible rather than a claim that
every range is already stored in that checksum set. A later corpus-enrichment pass should
archive the exact contract ranges.

- **Recovered** means directly supported by immutable static evidence and the two instruction
  views.
- **Implementation mapping** tells the Creator rewrite how to reproduce a recovered rule; it
  is not evidence about the original runtime.
- **Unknown** means the available static evidence does not close the question. Unknown values
  must not be invented.

## Recovered contract

### Units, axes, and presentation synchronization

| Rule | Recovered value | Static anchor |
|---|---|---|
| Physics scale | `32 legacy Cocos world units = 1 m`; unit-to-metre multiplier `1/32` (`0x3D000000`); metre-to-unit multiplier `32` (`0x42000000`) | `PhysicsObject::draw()` `0x001617D4`; `Fruit::createWithTarget(...)` `0x00150320`; `PhysicsBladeLayer::RayCastWorld(...)` `0x00160FE4` |
| Position transform | `spriteWorld = bodyMetres * 32`, with no recovered origin offset or axis inversion | `PhysicsObject::draw()` `0x001617D4` |
| Legacy rotation property | Cocos2d-x `CCNode::rotation = -bodyRadians * 180/pi`; recovered radians-to-degrees float is `0x42652EE1` | `PhysicsObject::draw()` `0x001617D4` |
| Gameplay axes | Physics gravity is negative Y and sprite synchronization preserves both position signs. Therefore gameplay uses positive X right and positive Y up. | `PhysicsLayer::onEnter()` `0x00161558`; `PhysicsObject::draw()` `0x001617D4` |

The recovered sprite dimensions used by collider formulas are the Cocos2d-x sprite content
width and height in legacy logical/world units. These paths call `getWinSize`, not the
distinct `getWinSizeInPixels`; physical display pixels must not be assumed. The values are
not node scale or viewport-normalized dimensions.

The negative rotation above is a recovered Cocos2d-x node-property value, not a portable
rendered-Euler rule. Cocos2d-x 2.1.4 negates that property when constructing its node
transform, whereas Creator 3.8.8 synchronizes the Box2D angle directly to positive Euler Z.
Creator should use its stock positive body-angle synchronization (or test rendered transform
equivalence), not assign the legacy negative property verbatim.

### Physics world lifecycle and stepping

| Event or setting | Recovered behavior | Static anchor |
|---|---|---|
| Construction | World pointer starts null; stop flag is false; velocity and position iteration fields are each float `10.0` (`0x41200000`); world speed is `1.0` (`0x3F800000`); update is scheduled. | `PhysicsLayer::PhysicsLayer()` `0x0016163C` |
| Scene entry | Create a Box2D world with gravity `(0, -10)` (`0x00000000`, `0xC1200000`), allow sleeping, and leave continuous-collision/TOI processing enabled. | `PhysicsLayer::onEnter()` `0x00161558`; `b2World::Step(float,int,int)` `0x002AF868`, continuous flag read at `0x002AF91C–0x002AF93A` |
| Frame update | First run the base node update. If the stop flag is false, call `Step(frameDt * worldSpeed, int(velocityIterations), int(positionIterations))`. No fixed step, accumulator, delta clamp, or original substep loop was recovered in this layer. | `PhysicsLayer::update(float)` `0x001615FC`; `b2World::Step(float,int,int)` `0x002AF868` |
| Stop/resume | `StopPhysicsWorld(value)` stores the supplied Boolean. When true, the frame update skips `Step`; when false, stepping resumes. | `PhysicsLayer::StopPhysicsWorld(bool)` `0x001614D8` |
| Freeze/unfreeze | Freeze sets world speed to `0.5` (`0x3F000000`); unfreeze restores `1.0` (`0x3F800000`). | `PhysicsLayer::FreezeeWorld()` `0x001616BA`; `PhysicsLayer::UnFreezeeWorld()` `0x001616C4` |
| Direct speed | `SetWorldSpeed(value)` stores the supplied float without a recovered clamp. | `PhysicsLayer::SetWorldSpeed(float)` `0x001616CE` |
| Classic speed-up path | `ClassicModeLayer::onEnter()` enables the path with a `30.0s` action delay. Each callback adds `0.1` (`0x3DCCCCCD`) while the pre-add speed is below `2.0` (`0x40000000`) and rearms once after every addition; the next callback stops when its pre-add value is at least `2.0`. | `ClassicModeLayer::onEnter()` `0x00148CDC`; `PhysicsLayer::EnableWorldSpeedUp(float)` `0x001616D4`; `PhysicsLayer::SpeedUpDelayCallback()` `0x001615A4` |
| Exit/destruction | The recovered `PhysicsLayer` destructor invokes the base layer destructor but does not delete the `b2World` in this function. World teardown ownership is unknown. | `PhysicsLayer::~PhysicsLayer()` `0x001614F4` |

The iteration fields are stored as floats and converted to integers at the `Step` call. The
initial effective values are therefore `10` velocity iterations and `10` position iterations.

### Classic bodies and fixtures

All fixture values in this table are recovered values, including formulas that still depend
on resource dimensions.

| Property | Fruit | Bomb |
|---|---|---|
| Factory anchor | `Fruit::createWithTarget(...)` `0x00150320` | `Bomb::create(b2World*, int)` `0x001456C0` |
| Supported factory IDs | `0..14`; IDs `>14` have no verified valid construction path | `0` and `1`; other IDs have no verified valid construction path |
| Body type | Dynamic (`2`) | Dynamic (`2`) |
| Initial body position | `(-viewportWidth/32, -viewportHeight/32)` metres; later toss placement is outside this contract | `(0, 0)` metres; later toss placement is outside this contract |
| Initial motion | Angle `0`; linear velocity `(0,0)`; angular velocity `0`; linear and angular damping `0` | Same |
| Body flags | allow-sleep true, awake true, active true, fixed-rotation false, bullet false, gravity-scale `1` | Same |
| Shape | IDs `1` and `2`: box with Box2D half-extents `(spriteWidth/32, spriteHeight/32)` metres. Other valid IDs: zero-centred circle radius `(spriteWidth + spriteHeight)/128` metres (`1/128` is `0x3C000000`). | Zero-centred circle radius `spriteWidth/(2.75*32)`, equivalently `spriteWidth/88`, metres; `2.75` is `0x40300000`. |
| Density | `1.0` (`0x3F800000`) | `1.0` (`0x3F800000`) |
| Friction | float `0.2` (`0x3E4CCCCD`) | float `0.2` (`0x3E4CCCCD`) |
| Restitution | `0` (`0x00000000`) | `0` (`0x00000000`) |
| Sensor | false | false |
| Category bits | `0x0001` | `0x0002` |
| Mask bits | `0xFFFC` | `0x0001` |
| Group index | `0` | `0` |
| Fixture user data | null | null |
| Body user data | owning `Fruit` object | owning `Bomb` object |

`SetAsBox` consumes half-extents. The fruit box values above are the actual arguments found
in the original factory; the rewrite must not silently halve them to make the full box match
the sprite dimensions.

Neither `CutObject` nor `Blade` creates a Box2D body or fixture in the traced Classic path.
The blade is an input/ray-query abstraction, not a persistent collision body.

### Force and impulse scope

The complete bounded Classic creation, toss, cut, bomb, and bonus paths mutate motion through
body-definition defaults, `SetTransform`, `SetLinearVelocity`, `SetAngularVelocity`, direct
world-speed scaling, and gravity. They contain no app-owned force or impulse call and no
equivalent inline body-state mutation. The native dynamic inventory corroborates the scope:
it exposes `b2Body::SetLinearVelocity` at `0x001455A0` and `b2Body::SetTransform` at
`0x002ACF10`, but no `b2Body::ApplyForce`, `ApplyLinearImpulse`, or `ApplyAngularImpulse`
symbol. This is a recovered negative for the Classic slice, not a claim about every remaining
mode. The Creator Classic adapter must emit no invented impulse; a later mode contract must
define any force/impulse API and unit boundary before using one.

### Contact filtering

The bundled Box2D default filter at `b2ContactFilter::ShouldCollide(...)` `0x002B03D0`
applies the standard bilateral rule: a shared non-zero group index wins (positive collides,
negative does not); otherwise both `maskA & categoryB` and `maskB & categoryA` must be
non-zero.

For the normal Classic fruit/bomb fixtures, the resulting physical-contact matrix is:

| Pair | Collides? | Reason |
|---|---:|---|
| Fruit ↔ fruit | No | `0xFFFC & 0x0001 == 0` |
| Bomb ↔ bomb | No | `0x0001 & 0x0002 == 0` |
| Fruit ↔ bomb | No | Fruit side rejects bomb: `0xFFFC & 0x0002 == 0` |

No app-owned normal fruit/bomb path installs a gameplay contact listener. The app-owned call
to `b2World::SetContactListener(...)` `0x002AEDBC` at `0x00146070` is inside
`BombElectric::onEnter()` `0x00145EA4`; its `BombContactListener` is an electric-bomb branch,
not the normal fruit/bomb collision mechanism. Blade hits are ray-query driven.

### Electric-bomb body and contact path

`BombElectric::create(...)` `0x00146108` assigns node tag `1437`, which explains the exact
value excluded by the blade ray loop but not its product-level rationale. On entry at
`0x00145EA4`, it installs an embedded `BombContactListener` and creates this recovered
fixture:

| Property | BombElectric value |
|---|---|
| Body type | Static (`0`) |
| Initial active state | false, set through `b2Body::SetActive(false)` |
| Position | `(viewportWidth/64, viewportHeight/128)` metres, equivalent to `(viewportWidth/2, viewportHeight/4)` Creator world units |
| Shape | zero-centred `SetAsBox(viewportWidth/16, 0)`; these are Box2D half-extents, so the recovered shape is degenerate in height |
| Density / friction / restitution | `1.0` / float `0.2` / `0` |
| Sensor | false |
| Category / mask / group | `0x0003` / `0x0002` / `0` |
| Fixture user data | null |
| Body user data | owning `BombElectric` object |

With the default bilateral filter, Bomb ↔ Electric and Electric ↔ Electric pairs pass;
Fruit ↔ Electric does not. `BombContactListener::PreSolve(...)` `0x00145B3C` clears contact
flag bit `0x4` for an inspected body whose vertical velocity is non-positive.
`BeginContact(...)` `0x00145B9A` reaches `Bomb::HitElectric()` once for each non-null body
user-data side while that flag remains set. `Bomb::HitElectric()` `0x001458EC` selects and
plays audio without dereferencing its `this` pointer, which makes the second call possible
even when the user data is the electric node rather than a Bomb.

There is a statically visible type-layout conflict in `PreSolve`: `BombElectric` directly
derives from `CCNode`, stores its real body at object offset `0xF4`, but the inherited
`PhysicsObject::getPhysicsBody` access used by the listener reads offset `0xE4`, occupied by
the electric object's first sprite pointer. The runtime consequence cannot be established
without executing the unavailable original. This path must therefore remain an explicit
unknown/compatibility decision; the Creator rewrite must not reproduce an unsafe pointer
reinterpretation.

### Blade sampling and ray-query filtering

`PhysicsBladeLayer::PhysicsBladeLayer()` `0x001604E0` enables touch and initializes an empty
blade collection. `PhysicsBladeLayer::onEnter()` `0x001612C0` creates exactly four blade
instances when blade initialization is enabled. Touch begin assigns an unused blade to the
touch ID and initializes previous/current points to the touch location
(`PhysicsBladeLayer::ccTouchesBegan(...)` `0x001603A4`). Touch end releases the matching blade,
zeros its points, and runs blade end/disposal behavior
(`PhysicsBladeLayer::ccTouchesEnded(...)` `0x001602D4`).

On update (`PhysicsBladeLayer::update(float)` `0x00160442`), a cut query occurs only when:

- global cut-disable is false;
- the blade collection size is exactly four;
- the blade is assigned to a touch (`id != -1`); and
- the current segment length is greater than zero.

For each eligible segment, `PhysicsBladeLayer::RayCastWorld(...)` `0x00160FE4` performs this
recovered sequence:

1. Clear the callback fixture list (`RaysCastCallback::ClearFixtureList()` `0x00161A64`).
2. Compute `extraWorld = trunc(viewportWidth / 16)`; for positive viewport widths this is
   `floor(viewportWidth/16)`. The recovered `1/16` float is `0x3D800000`.
3. Extend the segment past both original endpoints by `extraWorld` along its direction using
   `PhysicsBladeLayer::ExtraPoint(...)` `0x00160F82`.
4. Convert both extended endpoints from legacy world units to metres with `/32`.
5. Call `b2World::RayCast(...)` `0x002B02D8` forward and then in reverse over the same
   extended segment.
6. Process the callback list in its collected order. Skip a fixture when its body user data
   is null, its node tag is `1437` (`0x059D`), or its `CutObject::IsDisableCut()` is true.
7. When `CutObject::IsFruit()` is true, send the fruit body position converted with `*32` to
   the combo check.
8. Invoke the object's virtual `Cut` for both fruit and non-fruit objects, passing the
   **original, unextended legacy-world endpoints**.

`RaysCastCallback::ReportFixture(...)` `0x00161BCC` appends every non-null fixture and returns
`1.0` (`0x3F800000`), so a ray continues through all hits rather than clipping at the first
hit. No fixture category, mask, or sensor test is present in the app-owned raycast loop;
Box2D contact masks therefore must not be reused as blade-query filters.

The callback's apparent duplicate guard compares storage addresses rather than stored fixture
pointer values. Static evidence therefore does **not** establish value-based deduplication:
the forward and reverse casts can queue the same fixture twice. `Bomb::Cut(...)` `0x00145864`
has its own one-shot guard and returns early on repeat hits. No equivalent Fruit guard was
verified in this physics pass. Fidelity-default behavior must preserve callback order and
duplicates until a reviewed product decision explicitly approves a correction.

### Bounds, failure, and safe body destruction

`CutObject::update(float)` `0x0014C738` checks viewport bounds only while the body's linear
velocity is non-zero. With body position converted to legacy world units using `*32`:

| Condition | Recovered outcome |
|---|---|
| `y < -0.2 * viewportHeight` (`0.2` is `0x3E4CCCCD`) | Run the object's failure callback, then dispose it |
| `y > 1.2 * viewportHeight` (`1.2` is `0x3F99999A`) | Dispose without the lower-bound failure callback |
| `x < -0.2 * viewportWidth` | Dispose without the lower-bound failure callback |
| `x > 1.2 * viewportWidth` | Dispose without the lower-bound failure callback |
| Linear velocity exactly `(0,0)` | Perform none of these bounds actions |

`PhysicsObject::Dispose()` `0x0016179A` stops actions and marks a body-backed object pending
disposal. `PhysicsObject::update(float)` `0x00161898` destroys the body and removes the node
only after the physics world is no longer locked. This deferred-destruction boundary applies
to cut, contact, and raycast callbacks.

## Cocos Creator Physics2D implementation mapping

This section is rewrite guidance. It does not change the recovered status of the rules above.
Cocos Creator 3.8 exposes 2D physics inputs in world units and automatically converts them
to Box2D metres with its read-only PTM ratio of `32`. Its documented default gravity
`(0, -320)` world units/s² is therefore `(0, -10)` m/s², and its raycast endpoints are world
coordinates. The adapter must translate at this public API boundary instead of applying the
legacy `/32` a second time. See the official
[2D Physics Manager documentation](https://docs.cocos.com/creator/3.8/manual/en/physics-2d/physics-2d-system.html).

| Recovered responsibility | Creator-side owner and rule |
|---|---|
| World configuration | A narrow `ClassicPhysicsAdapter` owns `PhysicsSystem2D` configuration: gravity `(0,-320)` Creator world units/s² (the recovered `(0,-10)` m/s²), iteration values `10/10`, stop state, and world-speed compatibility. Sleeping/continuous collision must be verified against the pinned Box2D backend. |
| Units | Keep legacy evidence values in explicit `worldUnit` and `metre` types. Creator positions, collider dimensions, ray endpoints, and public gravity use PTM-aware world units; position/geometry metres map with `*32`. `RigidBody2D.linearVelocity`, however, is passed directly to Box2D and must receive the recovered m/s value unchanged. Pin these intentionally different API boundaries in tests. |
| Force/impulse scope | Emit no force or impulse command for the bounded Classic slice. Do not invent an impulse conversion merely because Creator exposes the API; add one only when a later recovered mode contract supplies the call, units, point, and wake semantics. |
| Fruit | A fruit prefab uses `RigidBody2D` dynamic plus `BoxCollider2D` for IDs `1/2` or `CircleCollider2D` otherwise. In Creator world units, the recovered box half-extents become full `size = (2 * spriteWidth, 2 * spriteHeight)`; the recovered circle becomes `radius = (spriteWidth + spriteHeight) / 4`. Apply the exact material/filter table. |
| Bomb | A bomb prefab uses `RigidBody2D` dynamic plus `CircleCollider2D`. The recovered `spriteWidth/88`-metre radius becomes `4 * spriteWidth / 11` Creator world units. Apply the exact material/filter table. |
| Electric-bomb field | Represent the recovered static filter/category and activation state explicitly. Its legacy half-extents map to a nominal Creator `BoxCollider2D.size = (4 * viewportWidth, 0)`, but isolate that degenerate shape and the invalid native listener layout behind a reviewed compatibility decision. Creator contact code must be type-safe. |
| Blade | A TypeScript input/blade service owns four logical touch slots and delegates two `ERaycast2DType.All` queries to the adapter. Pass the extended legacy/Creator world endpoints directly to Creator; do not divide them by `32`. Filter by gameplay metadata (`tag 1437`, disabled-cut state, fruit flag), not contact masks. |
| Query result compatibility | Concatenate the forward query results and then the reverse query results without sorting or collider-level deduplication. Preserve repeated fixture occurrences by default. Pass original world endpoints to domain `cut`; extended points exist only for the physics query. |
| Disposal | Queue body/component/node destruction and flush only after the Physics2D step/callback boundary. Never destroy a body directly from a raycast or contact callback. |
| Variable timestep | Creator documents a fixed timestep (`1/60` by default), while the native layer directly passes `frameDt * worldSpeed`. Treat this as an explicit compatibility boundary: first test whether the pinned backend exposes an equivalent supported step path; otherwise record and test the chosen fixed-step/time-scaling approximation as an inference. |

Creator's public PTM conversion is documented, but its ray-result ordering, solver knobs, and
manual-step surface remain integration boundaries rather than facts about the old binary. Pin
the Creator/Box2D backend before coding the adapter and verify each boundary in the new project.
Creator 3.8.8 source confirms direct linear-velocity passthrough and positive body-angle
synchronization: [rigid-body adapter](https://github.com/cocos/cocos-engine/blob/v3.8.8/cocos/physics-2d/box2d/rigid-body.ts#L249-L256),
[physics-world synchronization](https://github.com/cocos/cocos-engine/blob/v3.8.8/cocos/physics-2d/box2d/physics-world.ts#L236-L259).

## Inferences and explicit implementation decisions

No inferred numeric physics value is needed for the contract above. The following are
bounded interpretations or pending decisions and must stay distinguishable from recovered
behavior:

- Preserving the source's duplicate bidirectional ray hits is the fidelity default, because
  static evidence disproves a working value-based deduplication check. Intentionally
  deduplicating is a player-facing compatibility decision that requires review.
- Positive X right and positive Y up follows jointly from the recovered gravity and direct
  signed body-to-sprite position transform. No separate viewport-flip function was found in
  this path.
- Freeze and gradual speed-up belong to the shared physics layer. Classic explicitly enables
  gradual speed-up with a `30.0s` action delay at scene entry; the intro therefore consumes
  part of the first interval. Classic activation of the separate freeze path is not recovered
  here.
- Node tag `1437` is assigned by the electric-bomb creation path and is excluded by the blade
  ray loop. The precise gameplay rationale for that exclusion is not recovered here.
- The electric contact listener contains an incompatible native object-layout access. That is
  evidence of an apparent defect, not a requirement to reproduce memory-unsafe behavior.

## Unknowns and dependencies

- Numeric fruit/bomb collider dimensions until resource geometry identifies each sprite's
  untrimmed content width and height. The formulas themselves are recovered.
- Original director-level frame-delta clamp, pause behavior, and any scheduling behavior
  outside `PhysicsLayer::update`.
- The owner and exact timing of `b2World` teardown on scene exit; the recovered layer
  destructor does not perform deletion.
- Exact parity of Creator's selected Physics2D backend for units, iteration configuration,
  continuous collision, ray ordering, and variable-step control until the backend is pinned
  and adapter tests run.
- Whether standard Classic activates the separate `FreezeeWorld`/`UnFreezeeWorld` path. Its
  gradual `30.0s` speed-up path is recovered. The Classic ID-13 cut path does activate
  `BombElectric`; its unsafe native contact behavior remains unresolved as described above.
- Player-visible behavior of the degenerate electric fixture and invalid `PreSolve` body
  access in the unavailable original runtime.
- Whether the recovered duplicate ray-hit behavior should be retained permanently or changed
  after a reviewed fidelity decision.

Classic spawn positions, velocities, distributions, controller scheduling, RNG seed source,
and scheduled IDs are resolved in `classic-toss-contract.md`; cut/score activation paths are
resolved in `classic-cut-score-contract.md`; scene-entry activation and action-clock ordering
for speed-up are resolved in `classic-time-state-contract.md`.

None of these unknowns requires or permits original-device runtime capture.

## Testable acceptance criteria

The Creator implementation is contract-complete only when automated tests cover all of the
following:

1. **Unit and transform tests:** legacy `/32` and `*32` round trips; one-time translation for
   Creator positions, geometry, rays, and gravity; no position/ray double conversion;
   recovered m/s linear velocity passes unchanged; position signs are preserved. Assert the
   legacy Cocos2d-x property is `-radians * 180/pi`, but Creator's synchronized node uses
   positive body-angle Euler or an equivalent rendered transform.
2. **World tests:** recovered gravity `(0,-10)` m/s² maps to Creator `(0,-320)` world units/s²;
   sleeping and continuous collision enabled, initial
   iterations `10/10`, initial speed `1`; stop skips a step; resume restores it. For
   `frameDt=1/60`, speeds `0.5`, `1`, and `2` pass `1/120`, `1/60`, and `1/30` respectively
   to the adapter step boundary.
3. **Classic speed-up tests:** start the first `30.0s` action delay at scene entry; callback
   values advance by float32 `0.1` from `1.0` under the strict pre-add `< 2.0` comparison,
   including the final rearmed no-op callback. Do not scale toss/action deltas with world
   speed. If the separate freeze path is activated by a later recovered contract,
   freeze/unfreeze produces `0.5` then `1.0`.
4. **Force/impulse negative test:** no bounded Classic scenario emits `applyForce`,
   `applyLinearImpulse`, or `applyAngularImpulse`; motion changes use only the recovered
   transform, velocity, gravity, world-speed, and stop operations. A later mode cannot add an
   impulse without a separate evidence-backed contract and adapter-unit test.
5. **Fruit fixture tests:** IDs `1/2` receive box half-extents `(width/32,height/32)`; every
   other valid factory ID receives circle radius `(width+height)/128`; material, sensor,
   category, mask, and group values exactly match the table. Creator-facing assertions use
   box size `(2*width,2*height)` and circle radius `(width+height)/4` world units.
6. **Bomb fixture tests:** valid factory IDs receive circle radius `width/88` and all exact
   body, material, sensor, category, mask, and group values. Creator-facing radius is
   `4*width/11` world units.
7. **Contact-filter property tests:** enforce bilateral masks and shared-group precedence;
   verify fruit/fruit, bomb/bomb, fruit/bomb, and fruit/electric reject; verify
   bomb/electric and electric/electric pass. Keep the electric compatibility decision
   isolated and ensure all Creator contact handling is type-safe.
8. **Blade query tests:** extend both ends by `floor(viewportWidth/16)` and verify the legacy
   evidence conversion is `/32`, while Creator receives the numerically identical extended
   world coordinates through its automatic PTM conversion. Query forward then reverse,
   continue through all hits, and process collected order. Verify skips for null body
   metadata, tag `1437`, and disabled-cut objects; verify combo receives the fruit world
   position; verify `Cut` receives the original world endpoints.
9. **Duplicate compatibility test:** when both ray directions return the same fixture, it is
   represented and dispatched twice unless an approved deviation changes the contract. Also
   verify Bomb's one-shot cut guard prevents a repeated explosion.
10. **Bounds/disposal tests:** a moving body below `-0.2H` fails then disposes; the other three
   `1.2/-0.2` thresholds dispose without that failure callback; a stationary body performs no
   bounds disposal; body/node destruction waits until the world is unlocked.
11. **Static traceability check:** every implemented recovered rule maps back to at least one
    normalized symbol/address above and to `DER-NATIVE-001` plus
    `DER-NATIVE-CORPUS-001`/`DER-FUNCMAP-001`; no test claims original runtime observation.

## Traceability index

| Normalized address | Symbol | Contract area | Evidence IDs |
|---|---|---|---|
| `0x001456C0` | `Bomb::create(b2World*, int)` | Bomb body and fixture | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x00145864` | `Bomb::Cut(CCPoint, CCPoint)` | Repeated-hit guard | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x00145B3C` / `0x00145B9A` | `BombContactListener::PreSolve/BeginContact` | Electric contact gating and layout conflict | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x00145EA4` / `0x00146108` | `BombElectric::onEnter/create` | Electric body, fixture, listener, and tag | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x0014C738` | `CutObject::update(float)` | Bounds and failure | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x00150320` | `Fruit::createWithTarget(...)` | Fruit body and fixture | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x001602D4` / `0x001603A4` | `PhysicsBladeLayer` touch end/begin | Blade slot lifecycle | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x00160442` | `PhysicsBladeLayer::update(float)` | Ray-query gate | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x00160F82` / `0x00160FE4` | `ExtraPoint(...)` / `RayCastWorld(...)` | Segment extension, conversion, filtering, dispatch | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x001614D8`–`0x001616D4` | `PhysicsLayer` lifecycle, update, and speed methods | World creation, stepping, stop, speed | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x0016179A` / `0x001617D4` / `0x00161898` | `PhysicsObject::Dispose/draw/update` | Deferred destruction and body/node transform | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001` |
| `0x00161A64` / `0x00161AC4` / `0x00161BCC` | `RaysCastCallback` clear/get/report | Result collection and continuation | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001` |
| `0x002AEDBC` | `b2World::SetContactListener(...)` | Electric-only listener boundary | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001` |
| `0x002AF868` | `b2World::Step(float,int,int)` | Solver and continuous-collision call boundary | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001` |
| `0x002B02D8` | `b2World::RayCast(...)` | Blade physics query | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001` |
| `0x002B03D0` | `b2ContactFilter::ShouldCollide(...)` | Bilateral contact filtering | `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001` |

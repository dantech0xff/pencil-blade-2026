# Classic Cut, Combo, Score, and Failure Contract

Status: reviewed, static evidence only
Evidence: `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001`
Cross-check: GNU ARM binutils 2.27 and LLVM 19.0.1 in explicit Thumbv5TE mode

Targeted Phase 4 ranges were regenerated from `DER-NATIVE-001` with both recorded tools.
Only representative Phase 2 samples are archived by `DER-NATIVE-CORPUS-001`; agreement for
the additional ranges in this contract is reviewer-reproducible and must not be described as
already present in the Phase 2 checksum set.

This contract records the Classic-mode cut-to-score path recovered from `libgame.so`.
Addresses are normalized image virtual addresses. It does not claim runtime observation and
does not copy or mechanically translate native instructions.

## Recovered Event Order

1. `PhysicsBladeLayer::update` advances the Box2D world, then visits four blade slots.
2. An active blade with a non-zero previous-to-current segment invokes
   `PhysicsBladeLayer::RayCastWorld` while cutting is enabled.
3. The cut query extends the segment, converts legacy Cocos world units to Box2D metres, and
   ray-casts in both
   directions.
4. Each returned fixture resolves through its body user data to a game object. Objects with
   tag `1437`, null user data, or `IsDisableCut() == true` are skipped.
5. If the object's virtual `IsFruit()` returns true, `ComboManager::CheckCombo` receives the
   body's position converted back to legacy world units.
6. The object's virtual `Cut(previousWorldPoint, currentWorldPoint)` is invoked. For a
   `Fruit`, `Fruit::Cut` first creates and launches the exact bottom/top `CutFruit` pair,
   then requests the base cut sound and optional critical sound, then its notification path
   supplies body position, fruit ID, and `Fruit::GetScore()` to the active mode.
7. `ClassicModeLayer::FruitCut` applies the special-fruit effect, then calls
   `ScoreManager::AddScore`.

The order in steps 5-7 is recovered: combo registration occurs before the object's cut
callback and before Classic score mutation.

## Blade Input and Sampling

| Rule | Status | Static support |
|---|---|---|
| Exactly four blade slots are present | recovered | `ccTouchesBegan`, `ccTouchesMoved`, `ccTouchesEnded`, and `update` all require vector length `4` and loop over four pointer-sized entries (`0x001602D4`, `0x001603A4`, `0x00160442`, `0x00160640`) |
| `-1` denotes an unassigned touch | recovered | begin chooses the first blade whose ID is `-1`; end writes `-1` (`0x001603A4`, `0x001602D4`) |
| Begin initializes both endpoints to the touch location | recovered | `setPrevPoint` then `setCurrPoint` receive the same `CCTouch::getLocation()` result (`0x001603A4`) |
| Move shifts current to previous, stores the new location, then updates the blade path | recovered | `getCurrPoint` -> `setPrevPoint` -> `setCurrPoint` -> blade virtual touch call (`0x00160640`) |
| End clears ID and both endpoints, then invokes the blade reset/end virtual | recovered | ID `-1`, two `(0,0)` points, virtual call at vtable offset `424` (`0x001602D4`) |
| A swish sound is requested when segment length exceeds `viewportWidth * 0.0825` | recovered | literal `0x3DA8F5C3` and strict float-greater-than branch (`0x0016070A`-`0x00160732`) |
| Ray-casting occurs during layer update after the physics step, not directly in the move handler | recovered | `PhysicsBladeLayer::update` first calls `PhysicsLayer::update`, then dispatches the RayCastWorld vtable slot for active non-zero segments (`0x00160442`) |

The very large switch after the move-time swish check selects blade-specific particles. Its
presentation contract is intentionally deferred; it does not alter the recovered cut query.

## Ray-Cast and Cut Query

`PhysicsBladeLayer::RayCastWorld` at `0x00160FE4` and
`RaysCastCallback::ReportFixture` at `0x00161BCC` recover these rules:

- The callback list is cleared once per blade segment.
- Both segment endpoints are extended outward by
  `trunc(viewportWidth * 0.0625)` legacy world units through `ExtraPoint`.
- Every endpoint coordinate is multiplied by `0.03125`, giving an exact scale of
  `32 legacy world units = 1 Box2D metre`.
- Box2D receives two ray casts: extended start -> extended end, then the reverse direction.
- The callback returns `1.0`, so a ray continues instead of terminating at the first hit.
- The callback retains the latest point, normal, and fraction and appends non-null fixture
  reports to its fixture list.
- The attempted membership loop compares the address of the incoming fixture argument with
  vector-element storage addresses, not stored fixture pointer values. It therefore performs
  no value-level deduplication; the same fixture may be queued once by each ray direction.
  The Creator fidelity default preserves those repeated occurrences and callback order.
- The object filter is, in order: non-null body user data; `CCNode::getTag() != 1437`;
  `CutObject::IsDisableCut() == false`.
- The vtable slots used after filtering resolve to `CutObject::IsFruit()` and
  `CutObject::Cut(...)`. `IsFruit()` controls only the combo-position notification; all
  surviving cut objects still receive `Cut`.
- The combo position is the body's Box2D position multiplied by `32.0`, while `Cut` receives
  the original, unextended legacy-world-space segment.

The meaning of node tag `1437` is still unknown. It is a recovered exclusion constant, not a
recovered entity name or collision category.

## Fruit and Classic Score Rules

`Fruit::GetScore` at `0x00150B60` returns `1` normally and `10` when the fruit's critical
flag is set. `Fruit::CutNotification` sends that value and `Fruit::getID()` to the mode.

### Ordinary-fruit split and side-effect order

`Fruit::Cut(...)` at `0x00150648` recovers this order before notification/score mutation:

1. Normalize `currentCutPoint - previousCutPoint` and rotate it by `+pi/2` and `-pi/2`.
2. Compute the shared split angle, orient the normals against the raw source Box2D angle,
   assign bottom then top, and scale exactly one direction by `0.5` according to strict
   `bottomDirection.y < 0`.
3. Create `CutFruit(world, fruitId, 1)` for the exact cut-bottom raster, then
   `CutFruit(world, fruitId, 0)` for the exact cut-top raster.
4. Set their positions/angle and half source angular velocity, attach bottom then top at
   z-order `1`, and apply the recovered centre impulses bottom then top.
5. Request the fruit-ID cut sound; when critical, request `Sounds/critical.wav` immediately
   after it.
6. Invoke `Fruit::CutNotification`, which reaches combo-independent Classic score handling.

The split angle intentionally preserves the native `WrapAngle` defect: raw angles outside
`[-pi,pi)` are reduced by repeated `2/pi` steps, not `2*pi`. Full float32 geometry, fixture,
impulse, gravity, fade, and deferred-destruction rules live in
[`classic-physics-contract.md`](classic-physics-contract.md). This ordering is recovered from
static code and must not be replaced by source-linear-velocity inheritance or a target-owned
cut-half lifetime.

`ClassicModeLayer::FruitCut(position, fruitId, suppliedScore)` at `0x00149108` applies:

| Condition | Effect before score mutation | Score submitted |
|---|---|---:|
| `fruitId == 13` | `BombElectric::Start()` | `10` |
| `fruitId == 14` | create `MagnetAnimation` with begin/end callbacks | `10` |
| all other IDs | none in this function | `suppliedScore` (`1` or critical `10` for ordinary `Fruit`) |

The semantic label `fruitId` is recovered from the caller chain
`Fruit::getID()` -> `NotifycationManager::FruitCut` -> mode `FruitCut`; it is not guessed
from the numeric comparisons alone.

## Combo Rules

`ComboManager` (`0x0014A076`-`0x0014A1E4`) implements a rolling cut cluster:

- `CheckCombo(position)` increments the cluster count, stores the latest eligible fruit
  position, copies the current combo clock into the cluster-start clock, and marks the
  cluster active.
- While active, the combo clock advances by frame delta.
- The cluster remains open while `currentClock - clusterStartClock <= 0.25` seconds.
- On the first update beyond `0.25` seconds, a count of `3` or more performs this order:
  `ObjectivesManager::ProcessGameEvent(0, count)`; create the combo item at the stored latest
  position; add exactly `count` to score; attach the combo item; request one of three random
  combo sounds when effects are enabled; reset combo data.
- Counts `0`, `1`, or `2` add no combo score. The manager resets after either outcome.

This is a bonus in addition to each fruit's own score. The sound choice does not alter the
score directly, but it is not RNG-neutral: when effects are enabled,
`ComboManager::PlayRandomComboSound` calls the shared `RandomHelper::nextInt(1,3)` once after
the score and combo item attachment; when effects are disabled it consumes no draw. That
conditional draw changes subsequent toss RNG state and must be preserved in a single-stream
fidelity implementation. Using a separate audio RNG is an explicit new/inferred design.

## Score State and Double-Score Rules

The app maintains an authoritative total, a displayed total, and a pending double-score
bucket. Field names below describe observed use rather than recovered C++ declarations.

- `ScoreManager::AddScore(value)` at `0x00162AC8` adds directly to the authoritative total
  when double-score is inactive.
- When double-score is active, the same signed value is added to the pending bucket and the
  authoritative total is unchanged.
- `EnableDoubleScore` sets the active flag immediately, clears the pending bucket, and starts
  a `1.0` second presentation move. Its completion invokes `DoubleBeginCallback`.
- `DoubleBeginCallback` schedules a `15.0` second delay before `DoubleFinishCallback`.
- `DoubleFinishCallback` clears the active flag first, submits `pending * 2` through normal
  `AddScore`, clears pending, and disables bonus type `10`.
- `DisableDoubleScore` and `FinishDoubleScore` both flush through
  `DoubleFinishCallback` when the active flag is set.

Therefore the flag accepts pending score during both the one-second intro and the subsequent
15-second delay. Whether presentation scheduling can be externally interrupted is not yet
recovered.

### Displayed-score smoothing

- If displayed score exceeds authoritative total, update subtracts `1` per frame.
- When displayed score is below total, the UI starts a scale callback sequence.
- A scale callback adds `trunc((total - displayed) * 0.1)` when the remaining gap is greater
  than `10`; otherwise it adds `1`.
- The scale action duration literal is `0.025` seconds. This is presentation timing and does
  not change the authoritative score.

## Failure, Bomb, and Game Over

### Missed fruit

`ClassicModeLayer::FruitFail` forwards the miss position to `FruitFailManager`.
The manager owns three fail indicators and behaves as follows:

- each of the first three misses creates a fail animation and activates the next indicator;
- the fail count increments after the indicator action is queued;
- every queued `FailCallback` checks the current count when its indicator action completes;
  if the count is exactly `3`, it invokes the registered game-over callback;
- no consumed/one-shot guard exists in `FailCallback`, so multiple still-pending indicator
  callbacks may invoke the registered callback after the count has reached `3`;
- `Restart` resets the fail count to zero.

Classic's guarded `GameOver` keeps its terminal presentation idempotent even if more than one
fail callback reaches it. The callback invocation count itself is scheduling-dependent and
must not be specified as exactly once.

### Bomb

`ClassicModeLayer::BombHit` at `0x00148C20` performs this order:

1. disable blade cuts;
2. stop all nine Classic toss controllers;
3. stop `BombElectric`;
4. call `PhysicsLayer::StopPhysicsWorld(true)`;
5. submit score `-10`.

The vtable slot resolves to normalized address `0x001614D8`; the method stores the supplied
Boolean, and `PhysicsLayer::update` skips `b2World::Step` while it is true.
`AfterBombHit` later calls the guarded `GameOver` path, then calls
`StopPhysicsWorld(false)`. A pending third-miss callback may already have entered guarded
game over during the bomb hold; `AfterBombHit` still performs the guarded call before
resuming physics.

Cut enablement is checked before `PhysicsBladeLayer::update` admits a ray query and is not
re-read for every fixture already collected by `RayCastWorld`. Distinct bombs in one query
therefore each pass their own per-object cut guard and can attach multiple explosions before
the query returns. Repeated reports for the same bomb are suppressed by that bomb's own
one-byte guard. Creator must preserve this same-query concurrency for the first fidelity
build or record an explicit reviewed divergence.

The fruit-fail `GameOverCallback` independently disables cuts, stops the same nine toss
controllers and `BombElectric`, then calls `GameOver`. `GameOver` has an idempotence byte:
subsequent calls return without starting the presentation again.

## Cocos Creator 3.8 Mapping

| Recovered responsibility | Creator owner | Required boundary |
|---|---|---|
| Four touch-to-blade tracks | `BladeInputController` | map pointer IDs to four reusable tracks; preserve previous/current world-unit points |
| Post-step cut query | `ClassicCutQuery2D` | run after the physics step for every active non-zero segment while cut input is enabled |
| Fixture-to-domain lookup | `Cuttable2D` component | explicit `nodeTag`, `cutDisabled`, `isFruit`, and `cut(segment)` contract; no native object model |
| Ordinary-fruit split presentation | `ClassicCutHalfMotion` plus `ClassicCutHalfPresenter` | snapshot raw source angle/angular velocity/mass/position before intact-body disposal; create exact cut-bottom then cut-top, apply recovered centre impulses, advance the `0.75s` action fade separately from post-step bounds, and preserve presentation -> audio -> notification/score order |
| Combo cluster | `ComboService` | timer/count state driven by deterministic delta and accepted fruit-cut positions; emit objective, presentation-create, score, presentation-attach, conditional-sound, and reset commands in recovered order |
| Authoritative/display/pending score | `ScoreService` plus `ScorePresenter` | keep score mutation independent of tweens and labels |
| Miss strikes and terminal state | `ClassicFailService` / `ClassicModeController` | three-strike counter, one-shot game-over transition, separate animation callback |
| Bomb physics hold | `ClassicModeController` plus `ClassicPhysicsAdapter` | stop physics before `-10`; keep terminal guard independent from active explosions; resume only after the guarded game-over call |

Cocos Creator's 2D physics API accepts world-unit endpoints and performs its own Box2D
conversion at the engine's `32` PTM ratio. The adapter must therefore pass Creator world
coordinates directly; manually dividing them by `32` again would be wrong. Use
`PhysicsSystem2D.instance.raycast` with `ERaycast2DType.All` for both directions, then apply
the recovered domain filters and cut ordering. The official 3.8 documentation also warns
that `All` may return multiple results for one collider with multiple fixtures, matching the
need to make duplicate handling explicit:
<https://docs.cocos.com/creator/3.8/manual/en/physics-2d/physics-2d-system.html>.

## Deterministic Contract Tests

Phase 5 must add tests for at least these cases:

1. Five simultaneous begins allocate only four blade tracks; ending a track makes it reusable.
2. Move shifts endpoints in order; end returns ID and endpoints to their sentinels.
3. The swish threshold is strict `>` at `0.0825 * viewportWidth`.
4. Ray endpoints extend by truncated `0.0625 * viewportWidth`; both ray directions execute.
5. Null user data, tag `1437`, and disabled cut objects are skipped in recovered order.
6. A fruit registers combo position before its cut callback; a non-fruit does not.
7. Normal and critical fruit scores are `1` and `10`; IDs `13` and `14` submit fixed `10`.
8. Ordinary cuts create bottom then top from exact paired rasters, preserve the recovered
   split-angle/one-half-direction rules, apply normal/critical centre impulses, then request
   base/critical audio before score notification. Both halves fade at `0.75s` on the action
   clock and dispose through the unlocked-world boundary.
9. Two cuts inside the rolling window produce no combo bonus; three produce `+3`; a gap
   greater than `0.25` closes the cluster. Assert the accepted order
   `objective -> create item -> score -> attach -> conditional sound -> reset`. With effects
   enabled, sound consumes one shared RNG draw after score/attach; with effects disabled, it
   consumes none.
10. Double-score accumulates signed pending values, flushes `pending * 2`, and clears state;
   early disable uses the same flush path.
11. Every completed miss indicator checks the current count; once it is `3`, all still-pending
    callbacks may invoke the registered callback, while guarded Classic game over transitions
    only once. Restart clears the count.
12. Bomb hit disables cuts and stops tosses, then stops physics before `-10`;
    `AfterBombHit` performs guarded game over before resuming physics. A pending third-miss
    callback may enter game over during the hold without preventing the later resume.
13. One collected ray containing two distinct bombs can attach two explosions even though
    the first hit disables subsequent ray queries; duplicate reports for one bomb cut it once.
14. Displayed score converges upward by ten-percent chunks or one, and downward by one.

These fixtures validate the recovered implementation contract. They are not golden traces
from an original runtime, which is unavailable.

## Status Ledger

| Item | Status | Confidence / action |
|---|---|---|
| Four-slot touch lifecycle | recovered | high; dual-disassembly agreement |
| 32 legacy-world-units/m conversion and bidirectional extended ray cast | recovered | high; literal and call agreement |
| Tag/disabled/is-fruit/cut filter order | recovered | high; call path plus vtable addends |
| No value-level fixture deduplication | recovered | high; address comparison and append path agree; long-term bug compatibility remains a product decision |
| Fruit, critical, special-ID, combo, double, miss, and bomb score rules | recovered | high; dual-disassembly agreement on branches/constants |
| Ordinary cut-half geometry, body motion, presentation/audio/notification order | recovered | high; full `Fruit::Cut` and `CutFruit` static ranges plus exact resource pairs |
| Node tag `1437` semantic name | unknown | trace tag setters and entity constructors |
| Bomb physics-stop virtual | recovered | high; Classic vtable slot resolves to `PhysicsLayer::StopPhysicsWorld(bool)` and the callee's flag use agrees |
| Game-over presentation layout/timing | recovered | high; complete action/callback path is recorded in `classic-time-state-contract.md` and `classic-presentation-contract.md` |

## Unresolved Questions

- What product entity or transient state uses node tag `1437`?
- Should the recovered duplicate-fixture behavior remain permanently, or become a reviewed
  compatibility switch after the first fidelity implementation?
- Which original presentation actions can interrupt or shorten the double-score schedule?

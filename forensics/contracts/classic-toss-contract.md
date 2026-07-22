# Classic Toss and Spawn Contract

## Scope and evidence status

This contract recovers the Classic vertical-slice toss scheduler, object selection, spawn
kinematics, and the shared `TossTurn` strategy family from the immutable native image. It is
static-only: the APK and native library were not installed, loaded, linked, translated, or
executed.

Unless a row is explicitly labeled otherwise, the behavior below is **recovered** from
`DER-NATIVE-001`, with symbol/address identity corroborated by the reproducible corpus
`DER-NATIVE-CORPUS-001` and, for allowlisted application rows, `DER-FUNCMAP-001`. GNU ARM
objdump from NDK 21 and LLVM objdump
from NDK 28, forced to Thumbv5TE, agree on the representative instruction streams, branch
targets, and literal values used here. Addresses are normalized Thumb addresses (the symbol
low bit is cleared).

The targeted toss slices were regenerated from `DER-NATIVE-001` with both recorded tools
during Phase 4 review. They are reviewer-reproducible from the commands/tool versions in
`DER-NATIVE-CORPUS-001`, but are not among that corpus's four archived sample slices. A later
corpus-enrichment pass should archive these exact ranges; this contract does not imply they
already belong to the Phase 2 checksum manifest.

This file is a clean-room behavioral specification. It deliberately contains no native code
or mechanically translated disassembly.

## Recovered contract summary

- `ClassicModeLayer` creates nine fixed toss controllers and runs them concurrently. It does
  not randomly select one controller per turn.
- Every base interval sample is one of ten values:
  `low + k * (high - low) / 10`, where `k` is an integer from `0` through `9`. The configured
  `high` endpoint is therefore not reached unless `low == high`.
- Timer expiry uses `elapsed > threshold`, not `>=`; it drops overshoot, samples the next
  threshold, and only then invokes the strategy turn.
- Numeric direction values are `0 = Up`, `1 = Down`, `2 = Left`, `3 = Right`.
- Spawn transforms use an explicit `1 / 32` legacy-world-unit-to-Box2D scale in all four
  recovered random data methods.
- Classic uses `FreeToss`, `ConcurrentToss`, and `WaveToss`. `DoubleToss` and `BonusToss` are
  part of the same native strategy family but have no direct Classic factory call site.

## Random source

### Initialization and formulas

`RandomHelper` owns a one-byte `isInitialized` flag in BSS. Each public helper performs the
same lazy initialization:

1. If the flag is false, call `time(NULL)`.
2. Pass the returned wall-clock seconds to `srand48`.
3. Set the flag to true.
4. Draw from `lrand48`.

The recovered helpers are:

| Helper | Exact result |
|---|---|
| `nextInt()` | `lrand48()` |
| `nextInt(min, max)` | `min + (lrand48() % (max - min + 1))`; both endpoints are inclusive |
| `nextFloat()` | `(lrand48() % 10) / 10.0f`; result is exactly one of `0.0, 0.1, ..., 0.9` |

Consequences:

- Integer and decile results have the small modulo bias implied by the formulas.
- There is one process-global libc PRNG stream and no recovered seed-injection API in
  `RandomHelper`.
- Lazy initialization is not synchronized. No lock is visible in any helper.
- A native session is not reproducible from the gameplay configuration alone because its seed
  comes from wall-clock seconds.
- Bundled Cocos functions such as particle, shaky-grid, tile-shuffle, and `CCArray` random
  operations also call the same imported `lrand48` directly. `CCShuffleTiles` and
  `CCTurnOffTiles` also contain conditional `srand48` paths, so code outside `RandomHelper`
  can both consume and reseed the process-global stream. Whether and when those paths
  interleave with a particular Classic session is **unknown**; an exact original-runtime
  draw sequence cannot be asserted from the toss call graph alone.
- One non-toss Classic consumer is recovered: when an eligible combo closes and effects are
  enabled, `ComboManager::PlayRandomComboSound` consumes one
  `RandomHelper::nextInt(1,3)` draw after creating the combo score/presentation. It consumes
  none when effects are disabled, so the effects setting changes later toss RNG state.

### Interval sampler

Let `q = nextFloat()` and let the configured limits be `low` and `high`. The base toss timer
returns:

```text
sampleInterval(low, high) = float(low + q * (high - low))
```

The native path stores the limits as doubles, converts `q` to double for the calculation, and
converts the result back to float. Creator code that needs bit-level golden parity should use
an explicit float32 boundary for the returned value.

## `TossTurn` base scheduler

### Lifecycle

| Method | Recovered behavior |
|---|---|
| `onEnter()` | Calls `CCNode::onEnter`; it does not start the timer. |
| `Start()` | Schedules `update` and samples a new threshold. It does not reset accumulated elapsed time. |
| `Pause()` | Unschedules `update`; elapsed time and the armed threshold are preserved. |
| `Resume()` | Schedules `update` without resampling or resetting. |
| `Stop()` | Same base behavior as `Pause`: unschedules `update` and preserves timer state. |
| `Restart()` | No-op. |

### Update rule

The externally relevant state machine is:

```text
on start:
    scheduled = true
    threshold = sampleInterval(low, high)

on tick(dt), when scheduled:
    elapsed = elapsed + dt
    if elapsed > threshold:
        elapsed = 0
        threshold = sampleInterval(low, high)
        onTossTurn()
```

Important fidelity points:

- Equality does not fire a turn.
- Frame overshoot is discarded rather than carried into the next interval.
- The next interval consumes RNG before the strategy consumes any turn-specific RNG.
- Editing `low` or `high` does not change the already-armed threshold. New limits take effect
  at the next rearm.
- `Start()` resamples even if elapsed time is nonzero; `Resume()` does not.

## Object type and direction dispatch

### Numeric direction ABI

The `TossTurn` direction field dispatches through the recovered `CutObject` virtual methods:

| Value | Method |
|---:|---|
| `0` | `UpRandomData()` |
| `1` | `DownRandomData()` |
| `2` | `LeftRandomData()` |
| `3` | `RightRandomData()` |

Values outside `0...3` cause no random-data method to be called by the base dispatcher.

### Numeric toss-object ABI

`GetNewTossObject()` handles values `0...4`; the strategy subclasses account for types `5`
and `6`:

| Type | Factory behavior | Additional behavior |
|---:|---|---|
| `0` | Select one Fruit ID from `[0, 1, 6, 5, 7, 4, 2, 3, 8]` using an inclusive random vector index | Calls `Fruit::RandomCretical()`; critical is set when `nextInt(0, 24) == 0`, a nominal 1-in-25 draw |
| `1` | `Bomb::create(world, 0)` | None |
| `2` | `Bomb::create(world, 1)` | None |
| `3` | `Fruit::create(world, 13)` | Classic treats ID 13 as the electric fruit |
| `4` | `Fruit::create(world, 14)` | Classic treats ID 14 as the magnet fruit |
| `5` | No base factory branch | Used by `BonusToss`, which creates Fruit IDs `10...12` itself |
| `6` | No base factory branch | `FreeToss` special-cases it as `DragonFruit::create(world)` |

The semantic labels for Fruit IDs 13 and 14 are recovered from
`ClassicModeLayer::FruitCut`: ID 13 starts `BombElectric`, while ID 14 creates the magnet
animation.

### Toss sounds

Sounds are conditional on `Settings::EnableEffects`:

| Toss type | Effect |
|---:|---|
| `0`, `5` | `Sounds/tossfruit.wav` |
| `1`, `2` | `Sounds/boomtoss.wav` |
| `3`, `4` | No sound from `TossTurn::PlayTossSound` |
| `6` | `FreeToss` bypasses `PlayTossSound` on its DragonFruit branch |

## Spawn kinematics

### Common definitions

For the formulas below:

- `W`, `H` are `CCDirector::getWinSize()` logical width and height. The binary has a distinct
  `getWinSizeInPixels`, which these paths do not call.
- `P = 32` legacy Cocos world units per Box2D metre.
- `q1`, `q2` are independent calls to `nextFloat()`, each in
  `{0.0, 0.1, ..., 0.9}`.
- `randInt(a, b)` is inclusive.
- `trunc(x)` truncates toward zero.
- `c = (W - 480) / 100`.
- Every method calls `SetTransform(position, 0)`, so the initial body angle is zero.
- All angular velocities below are positive values in radians per second.

### Direction formulas

| Direction | Position in Box2D units | Linear velocity | Angular velocity | RNG consumption |
|---|---|---|---|---|
| Right (`3`) | `(1.2 * W / P, 0.65 * H / P)` | `(-3.5 - 2*q1 - c, 6.5 + 2*q2 + c)` | `randInt(3, 6)` | `q1`, `q2`, angular |
| Left (`2`) | `(-0.2 * W / P, 0.65 * H / P)` | `(3.5 + 2*q1 + c, 6.5 + 2*q2 + c)` | `randInt(3, 6)` | `q1`, `q2`, angular |
| Down (`1`) | `(randInt(trunc(0.02*W), trunc(0.98*W)) / P, 1.125 * H / P)` | No write in this method; valid Fruit IDs `13/14` retain their recovered factory value `(0,0)`; DragonFruit initialization remains unknown | `randInt(3, 7)` | horizontal position, angular |
| Up (`0`) | `(x / P, -0.125 * H / P)`, where `x = randInt(trunc(0.02*W), trunc(0.98*W))` | `(2*s*q1, 18.75 + 2*q2 + (W - 480)/37)`, where `s = -1` if `trunc(0.5*W - x) < 0`, otherwise `+1` | `randInt(3, 10)` | horizontal position, `q1`, `q2`, angular |

The Down method's absence of a linear-velocity write is recovered. The Fruit factory contract
independently recovers initial linear velocity `(0,0)` for every valid Fruit ID, so Classic's
Down-toss magnet/electric Fruits (`14`/`13`) retain exact zero velocity. Creator must reset
those fresh or pooled bodies to zero explicitly before applying Down data. DragonFruit uses a
separate creation path; its inherited velocity is still unknown and must stay centralized as
an inference rather than being generalized from Fruit.

The `1 / 32` scale is recovered for these four spawn transforms. Fixture geometry and every
other sprite/body coordinate transform remain outside this contract.

## Strategy contracts

### `FreeToss`

For a regular type (`0...4`), one turn performs this exact order:

1. Create the object through `GetNewTossObject()`.
2. Apply the configured random direction data.
3. Play the type-specific toss sound.
4. Add the object as a child at z-order `1`.

Type `0` performs fruit-ID selection and critical selection inside step 1. Type `6` instead
creates a DragonFruit, applies direction data, and adds it at z-order `1`; it does not call the
base toss-sound method.

### `ConcurrentToss`

The constructor stores `countMin` and `countMax`, but a turn samples:

```text
count = nextInt(countMin, countMax + 1)
```

Because `nextInt` is itself inclusive, the actual upper count is `countMax + 1`. This is a
recovered off-by-one behavior, not a documentation typo.

The turn then performs `count` complete spawns in one call and one frame. Each iteration runs
`create -> randomize -> sound -> addChild(z=1)` before the next iteration begins. There is no
inter-object delay and no physics step between iterations.

### `WaveToss`

`WaveToss` is an outer timer that gates an internal `FreeToss`:

- On enter it creates the internal FreeToss with the Wave's world, type, and direction, but
  with a fixed internal interval of `0.25...0.75` seconds.
- It adds the child at z-order `1`, calls the child's `Start()`, then immediately calls the
  child's `Pause()`. Starting consumes the child's first interval sample.
- On every outer turn it resumes the internal FreeToss, samples
  `activeLow + nextFloat() * (activeHigh - activeLow)`, and schedules a one-shot callback that
  pauses the child after that duration.
- Child elapsed time and threshold survive each pause, so progress accumulates across active
  windows.
- No cancellation or de-duplication of an older pause callback is recovered.

The outer interval sample is rearmed before `WaveToss::OnTossTurn`, so the outer interval RNG
draw precedes the active-window RNG draw.

### `DoubleToss`

`DoubleToss` is a 15-second, guarded composite used outside Classic:

- On enter it creates two internal FreeToss children, both type `0`, with interval
  `0.75...1.5` seconds. The first direction is Left (`2`), the second Right (`3`). They are
  added at z-order `1` in that order.
- The first `Start()` while inactive marks the composite active, calls base `Start()`, plays
  one non-looping `Sounds/doubletosstrum.wav` effect and one looping
  `Sounds/doubletoss.wav` effect when effects are enabled, starts the Left child, starts the
  Right child, and schedules `Stop()` after `15.0` seconds.
- A second `Start()` while active is a no-op.
- `Pause()` and `Resume()` forward to the base and then to Left and Right in order.
- `Stop()` clears the active guard, stops the base and both children, stops the looping audio,
  plays `doubletosstrum.wav` once when effects are enabled, and disables bonus type `11`.
- The custom pause/stop methods do not explicitly cancel the scheduled 15-second action.

The base portion has zero-initialized interval limits and an empty inherited `OnTossTurn`,
but it is not RNG-neutral. `DoubleToss::Start()` calls the base `Start()`, which consumes one
decile draw while calculating a zero threshold. Every scheduled update with positive `dt`
then satisfies `elapsed > 0`, resets elapsed, consumes another decile draw while rearming the
zero threshold, and calls the empty turn. It creates no object, but it perturbs the shared
libc RNG stream once per positive parent update.

### `BonusToss`

The constructor's candidate vector is `[12, 10, 11]`, corresponding to:

| Fruit ID | `BonusManager` flag |
|---:|---|
| `12` | Freeze |
| `10` | Double score |
| `11` | Double point |

A turn behaves as follows:

1. If all three bonus flags are already enabled, return without spawning.
2. Repeatedly choose a vector index with `nextInt(0, 2)` until the associated bonus is not
   enabled.
3. Create a Fruit with the selected ID.
4. Choose `d = nextInt(0, 3)` and dispatch direction as:
   `0 -> Left`, `1 -> Right`, `2 -> Down`, `3 -> Down`.
5. Add the Fruit as a child at z-order `1`.
6. Enable the selected bonus ID.
7. Play the configured toss-type sound.

Thus Bonus directions are 25% Left, 25% Right, and 50% Down before modulo bias; Up is never
selected. The retry loop makes RNG consumption data-dependent. Consistent manager flags
guarantee at least one acceptable candidate whenever step 1 is false.

## Classic controller graph

### Fixed construction table

`ClassicModeLayer::onEnter()` creates the following controllers in slot order and adds every
one at z-order `1`. For any interval shown as `[a, b]`, the actual sample grid is
`a + k*(b-a)/10`, `k = 0...9`.

| Slot / object offset | Controller | Type | Direction | Outer interval seconds | Additional parameters |
|---|---|---:|---|---|---|
| `a9` / `0x2A4` | Free | `0` normal Fruit | Up | `[0.5, 3]` -> `0.5...2.75`, step `0.25` | — |
| `aa` / `0x2A8` | Concurrent | `0` normal Fruit | Up | `[7, 17]` -> `7...16`, step `1` | Constructor counts `2, 4`; actual count `2...5` |
| `ab` / `0x2AC` | Wave | `0` normal Fruit | Up | `[5, 15]` -> `5...14`, step `1` | Internal Free `[0.25, 0.75]` -> `0.25...0.70`; active window `[1.5, 3]` -> `1.5...2.85` |
| `ac` / `0x2B0` | Free | `1` Bomb ID 0 | Up | `[7, 24]` -> `7...22.3`, step `1.7` | — |
| `ad` / `0x2B4` | Concurrent | `1` Bomb ID 0 | Up | `[25, 50]` -> `25...47.5`, step `2.5` | Constructor counts `1, 2`; actual count `1...3` |
| `ae` / `0x2B8` | Wave | `1` Bomb ID 0 | Up | `[30, 60]` -> `30...57`, step `3` | Internal Free `[0.25, 0.75]`; active window `[0.5, 1.5]` -> `0.5...1.4` |
| `af` / `0x2BC` | Free | `6` DragonFruit | Down | `[30, 75]` -> `30...70.5`, step `4.5` | DragonFruit branch |
| `b0` / `0x2C0` | Free | `4` Fruit ID 14, magnet | Down | `[45, 90]` -> `45...85.5`, step `4.5` | No base toss sound |
| `b1` / `0x2C4` | Free | `3` Fruit ID 13, electric | Down | `[45, 80]` -> `45...76.5`, step `3.5` | No base toss sound |

There is no `DoubleToss` or `BonusToss` in this Classic table.

### Start, stop, and bonus callbacks

`StartGameCallback()` calls `DisableCut(false)`, redundantly reasserting the cut-enabled state
that already holds throughout the intro, then starts controllers in this exact order:

```text
a9, af, b0, b1, aa, ab, ac, ad, ae
```

Starting in this order determines the initial interval-draw order. The exact later frame-level
interleaving of node updates with non-toss Cocos RNG consumers remains unknown.

`BombHit()` and `GameOverCallback()` stop the same nine controllers in the same order. Base
`Stop()` preserves elapsed time and armed thresholds.

The magnet callbacks alter the running graph:

| Callback | Main Fruit FreeToss (`a9`) limits | Bomb controllers |
|---|---|---|
| `MagnetBeginCallback` | Set to `[0.25, 0.5]`, whose grid is `0.25...0.475` | Pause `ac`, `ad`, `ae` in order |
| `MagnetEndCallback` | Restore `[0.5, 3.0]` | Resume `ac`, `ad`, `ae` in order |

The current main-fruit threshold is not resampled by either magnet callback. Bomb timers
retain their elapsed time and thresholds while paused.

### Negative call-site scope for `DoubleToss` and `BonusToss`

A whole-image direct-call scan found these factory call sites:

| Factory | Direct callers |
|---|---|
| `DoubleToss::create` | `CrazyBirdLayer::onEnter` at `0x0014A9E0`; `CrazyModeLayer::onEnter` at `0x0014B46A` |
| `BonusToss::create` | `CrazyBirdLayer::onEnter` at `0x0014AA7E`; `CrazyModeLayer::onEnter` at `0x0014B508` |

No direct Classic factory call exists, and the complete Classic construction table contains
neither object. Adding either strategy to Classic would therefore be a new design decision,
not a recovered restoration behavior.

## Ordering contract for a deterministic rewrite

The shared gameplay RNG makes call order observable. Preserve these boundaries:

1. `Start()` draws the first threshold.
2. On expiry, the controller draws its next threshold before invoking its turn.
3. Free normal Fruit draws ID, then critical state, then direction kinematics.
4. Concurrent draws count once, then completes every object's factory and kinematic RNG calls
   before starting the next object.
5. Wave draws its outer rearm first, then its active-window decile. Its internal FreeToss has
   an independent timer but consumes the same shared gameplay RNG.
6. Bonus performs zero candidate/direction draws when full; otherwise rejected candidate
   indices remain consumed before the accepted index and direction draw.
7. Double consumes its zero-interval base threshold draw before starting Left and then Right;
   each positive parent update consumes another base rearm draw before its empty turn. Child
   update interleaving still depends on scheduler order.
8. An eligible Classic combo completion with effects enabled consumes one shared sound draw
   before later toss updates; effects disabled consumes none.

Audio calls and `addChild` consume no `RandomHelper` values in these paths.

## Cocos Creator implementation ownership

The following boundaries preserve the contract without carrying native architecture into the
new project:

### `GameplayRandom`

Provide a single injectable gameplay RNG service with:

```ts
interface GameplayRandom {
  nextRawNonNegativeInt(): number;
  nextIntInclusive(min: number, max: number): number;
  nextDecile(): number;
}
```

- `nextIntInclusive` and `nextDecile` must implement the recovered modulo semantics over the
  same raw draw abstraction.
- Production should seed once and expose the chosen seed in diagnostics/replay state.
- Do not claim native sequence parity unless the target Android libc `lrand48` implementation
  and every shared consumer have also been contracted.
- Use one shared instance for all toss controllers so scripted tests can verify inter-controller
  draw order.
- Do not split gameplay-relevant audio or VFX randomness into another stream in the fidelity
  implementation. A separate stream is allowed only as an explicit post-fidelity policy change,
  not as part of this contract.

### `TossTimer`

Own `elapsed`, `threshold`, `low`, `high`, and scheduled state in TypeScript. Implement strict
`>` expiry, zero the elapsed accumulator, and rearm before invoking a strategy callback. Do
not use a repeating engine timer whose overshoot/catch-up behavior differs from this rule.

### `TossStrategy` and `SpawnFactory`

Keep orchestration separate from entity creation:

- `TossStrategy` owns Free, Concurrent, Wave, Double, and Bonus sequencing.
- `SpawnFactory` maps numeric toss types to Fruit/Bomb/Dragon prefabs and owns the type-0 Fruit
  vector and critical draw.
- `SpawnKinematics` owns the four resolution-dependent formulas, `P = 32`, float32 rounding,
  and the Physics2D body adapter. Tabulated positions are legacy Box2D metres and map to
  Creator positions with `*32`. Tabulated linear velocities are metres/second and must pass
  numerically unchanged to `RigidBody2D.linearVelocity`, whose Box2D adapter does not apply
  PTM. Creator ray/body positions still use its automatic read-only PTM conversion, so do not
  divide legacy/Creator world positions by `32` again.
- `ClassicTossSetup` owns the fixed nine-row table and callback ordering.
- `BonusState` owns IDs `10...12`; strategy code should not duplicate flag storage.
- An explicit command/event log (`create`, `setTransform`, `setVelocity`, `sound`, `attach`,
  `enableBonus`) makes ordering testable without depending on scene-tree side effects.

Use seconds throughout. Keep the `480`-logical-unit width correction and the `100`/`37`
divisors as
named legacy constants until a reviewed product decision replaces resolution-dependent
behavior.

## Deterministic acceptance tests

Tests should inject a scripted raw RNG and a manual scheduler. No test should depend on the
clock or a native libc sequence.

### RNG and timer

- Verify `nextIntInclusive` includes both endpoints and retains the Concurrent `max + 1`
  behavior.
- Verify `nextDecile` can return every value `0.0...0.9` and never `1.0`.
- Start a timer with a scripted threshold, tick to exact equality, and assert no turn.
- Tick past the threshold and assert: elapsed becomes zero, the next threshold draw occurs
  before any strategy draw, and overshoot is not carried.
- Pause and resume; assert elapsed and threshold are unchanged. Start again; assert threshold
  is resampled without resetting elapsed.

### Factory and Free ordering

- For type `0`, cover all nine vector indices, the `nextInt(0,24) == 0` critical case, and a
  noncritical case.
- Assert normal order `create -> randomize -> sound -> attach`.
- Assert type `6` uses DragonFruit and omits the base toss sound.
- Snapshot the sound table for types `0...6` with effects both enabled and disabled.

### Kinematics

At `W = 480`, `H = 800`:

- Right with `q1=0`, `q2=0.9` gives position `(18, 16.25)` and velocity `(-3.5, 8.3)`.
- Left with the same deciles gives position `(-3, 16.25)` and velocity `(3.5, 8.3)`.
- Down uses inclusive integer x bounds `9...470`, y `28.125`, writes angle zero and angular
  velocity, and performs no linear-velocity command. IDs `13/14` nevertheless start with
  exact zero linear velocity from the Fruit factory; keep DragonFruit as a separate unknown.
- Up at `x=9`, `q1=0.4`, `q2=0.9` gives position `(0.28125, -3.125)` and velocity
  `(0.8, 20.55)`; an x value to the right of center flips only the horizontal sign.
- Repeat at a non-480 width to cover both width-correction formulas.

For every case, also assert the Creator adapter receives positions multiplied by `32`, while
linear velocity values pass through numerically unchanged in metres/second; angular velocity
remains radians/second. This is an adapter-boundary test, not a change to the recovered MKS
formulas above.

Use float tolerances or explicit `Math.fround` golden values rather than assuming arbitrary
JavaScript double evaluation matches native float stores bit-for-bit.

### Strategies

- Concurrent configured with counts `2,4` must be able to produce five objects; assert each
  object's full event sequence finishes before the next begins.
- Wave on-enter must start/sample then pause its child. Across two active windows, assert child
  elapsed progress is preserved and the pause delay uses the decile grid.
- Double must consume its base zero-threshold draw before starting Left then Right,
  consume one base rearm draw on every positive parent update, ignore a second active `Start`,
  emit the recovered audio order, stop at the 15-second callback, and disable bonus ID `11`.
- Bonus must test all-full early return, rejection of enabled candidates, candidate vector
  order `[12,10,11]`, direction mapping `[Left,Right,Down,Down]`, and
  `attach -> enable -> sound` order.

### Classic graph

- Snapshot all nine rows, creation order, z-order, and the distinct start/stop order.
- Assert the initial start consumes nine base threshold samples in start order, plus the two
  Wave child samples that were consumed during on-enter setup.
- Magnet begin must change only `a9` limits and pause `ac/ad/ae`; it must not alter the armed
  `a9` threshold. Magnet end must restore limits and resume those three without resampling.
- Assert Classic contains no Double or Bonus controller.
- Interleave an eligible combo completion before the next toss expiry and assert the shared
  stream advances once only when effects are enabled.

## Address and constant evidence

| Behavior | Normalized address(es) |
|---|---|
| RNG lazy seed and raw draw | `RandomHelper::nextInt()` `0x00161948` |
| Inclusive integer formula | `RandomHelper::nextInt(int,int)` `0x0016196C` |
| Decile float formula | `RandomHelper::nextFloat()` `0x001619A0`; `10.0f` literal at `0x001619D8` |
| Base object factory and Fruit vector | `TossTurn::GetNewTossObject` `0x001650A4`; vector construction `0x00165270` |
| Direction dispatch | `TossTurn::RandomTossObjectData` `0x00165144`; `CutObject` vtable `0x00457280` |
| Base interval calculation | `TossTurn::GetRandomTossTurnTime` `0x0016518E` |
| Start/update/rearm order | `TossTurn::Start` `0x001651D2`; `TossTurn::update` `0x001651E6` |
| Toss sound dispatch | `TossTurn::PlayTossSound` `0x00165228` |
| Free turn | `FreeToss::OnTossTurn` `0x0014FE2A` |
| Concurrent count and loop | `ConcurrentToss::OnTossTurn` `0x0014A27E` |
| Wave gate and fixed child | `WaveToss::OnTossTurn` `0x001658CC`; `onEnter` `0x00165930`; delay callback `0x00165878` |
| Double lifecycle | `DoubleToss::onEnter` `0x0014DDC4`; `Start` `0x0014DE60`; `Stop` `0x0014DD28`; delay callback `0x0014DD18` |
| Bonus selection and direction weights | `BonusToss::OnTossTurn` `0x00146AB8`; constructor `0x00146C6C` |
| Bonus flag mapping | `BonusManager::EnableBonusType` `0x0014693C`; `IsBonusEnabled` `0x001469A4` |
| Right/Left/Down/Up kinematics | `0x0014C264`, `0x0014C3B4`, `0x0014C508`, `0x0014C5BC` |
| Classic fixed construction | `ClassicModeLayer::onEnter` `0x00148CDC`; literals `0x001490B8...0x001490EC` |
| Classic start order | `ClassicModeLayer::StartGameCallback` `0x00148B30` |
| Magnet timer changes | `MagnetBeginCallback` `0x001489B8`; `MagnetEndCallback` `0x00148A18` |
| Stop paths | `ClassicModeLayer::BombHit` `0x00148C20`; `GameOverCallback` `0x001493F8` |

## Unresolved questions

1. Which exact `lrand48` state transition and seed-width behavior shipped in the target Android
   libc, and which Cocos/VFX consumers actually interleaved with Classic gameplay draws?
2. What linear velocity does the separate DragonFruit creation path establish before
   `DownRandomData`? Valid Fruit IDs `13/14` are already resolved as `(0,0)`.
3. What is the complete sprite/body coordinate contract outside these four spawn transforms,
   including anchor offsets and fixture geometry?
4. What exact same-frame update ordering did the Cocos scheduler use among the nine Classic
   nodes and any particle/action RNG consumers after registration?
5. Should the Creator restoration intentionally preserve the recovered Concurrent
   `countMax + 1` quirk and resolution-width corrections, or expose them as reviewed
   compatibility switches after the first parity build?

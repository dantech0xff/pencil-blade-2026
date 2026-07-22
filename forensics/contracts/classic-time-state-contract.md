# Classic Time, Mode State, Pause, and Termination Contract

Status: reviewed, static evidence only; independent concurrency corrections incorporated
2026-07-22.

## Scope and evidence status

This contract recovers the standard `ClassicModeLayer` startup gate, mode-owned clock and
pause behavior, progressive physics speed, terminal paths, and the shared native
`TimeManager`. The two subjects are intentionally separated: standard Classic is an
untimed three-strike mode and does not create, start, stop, freeze, or receive callbacks from
`TimeManager`.

The target here is `ClassicModeLayer`, whose `GetGameMode()` returns `0`. It is not
`ClassicBirdLayer`, `ComboBirdLayer`, or another timed variant. The shared `TimeManager`
contract is included because it is part of the Phase 4 recovery requirement, not because it
belongs in the standard Classic scene.

All behavior is static-only. The APK and `libgame.so` were never installed, loaded, linked,
translated, or executed. Evidence comes from `DER-NATIVE-001`, the immutable
`libgame.so` with SHA-256
`55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`, plus
`DER-NATIVE-CORPUS-001` and allowlisted identities in `DER-FUNCMAP-001`. Addresses below
are normalized image virtual addresses: the ARM Thumb symbol low bit is cleared.

Targeted ranges were regenerated with GNU ARM binutils 2.27 and LLVM 19.0.1, with LLVM
forced to `thumbv5te-none-linux-android`. Both views agree on the instruction streams,
branches, callback targets, vtable words, and literals used below. These targeted slices are
reviewer-reproducible from the registered binary and tool versions, but they are not among
the four representative disassembly samples archived in the Phase 2 checksum set. This
contract does not imply otherwise; archiving these exact ranges remains corpus-enrichment
work.

This is a clean-room behavioral specification. It contains no native code or mechanically
translated disassembly. All `W` and `H` values below come from legacy
`CCDirector::getWinSize()` and are logical/world units, never physical display pixels.

## Recovered separation of concerns

| Question | Recovered answer | Static support |
|---|---|---|
| Is standard Classic timed? | No. It ends through the three-miss or bomb paths. | Complete `ClassicModeLayer::onEnter()` and all mode callbacks contain no `TimeManager` construction or call; `GetGameMode()` returns `0`. |
| What gates the first toss? | The callback at the end of the `text-luck` action sequence. | `ClassicModeLayer::onEnter()` `0x00148CDC`; `StartGameCallback()` `0x00148B30`. |
| What does pause freeze? | The bundled director omits the scheduler update while paused, so scheduled updates and Cocos actions retain their current state. Rendering continues. | `BaseGameplayLayer` pause methods plus `CCDirector::drawScene()` `0x001AB2BC`. |
| What is terminally one-shot? | Construction of the Game/Over presentation and its score-screen callback chain. Shutdown callbacks themselves may repeat. | Guard byte at Classic offset `+0x2D0`; `GameOver()` `0x00149204`. |
| What is `TimeManager`? | A reusable, independently scheduled countdown node for other modes. | `TimeManager` `0x00164974`-`0x00165048`. |

No native enum for Classic phases was recovered. Names such as `intro`, `running`, and
`terminal-pending` in this document are **inferred model names** for Creator architecture,
not claims about original C++ declarations.

## Classic-owned state

### Mode fields

The following `ClassicModeLayer` offsets have direct use evidence:

| Offset | Recovered role | Initialization / assignment |
|---:|---|---|
| `+0x2A4` | normal-fruit `FreeToss` | constructor writes null; `onEnter` assigns |
| `+0x2A8` | fruit `ConcurrentToss` | constructor writes null; `onEnter` assigns |
| `+0x2AC` | fruit `WaveToss` | constructor writes null; `onEnter` assigns |
| `+0x2B0` | bomb `FreeToss` | constructor writes null; `onEnter` assigns |
| `+0x2B4` | bomb `ConcurrentToss` | constructor writes null; `onEnter` assigns |
| `+0x2B8` | bomb `WaveToss` | constructor writes null; `onEnter` assigns |
| `+0x2BC` | dragon-fruit `FreeToss` | constructor writes null; `onEnter` assigns |
| `+0x2C0` | magnet-fruit `FreeToss` | constructor writes null; `onEnter` assigns |
| `+0x2C4` | electric-fruit `FreeToss` | constructor writes null; `onEnter` assigns |
| `+0x2C8` | `FruitFailManager` | constructor writes null; `onEnter` assigns |
| `+0x2CC` | `BombElectric` | assigned by `onEnter` before the frame can advance |
| `+0x2D0` | terminal presentation guard byte | constructor writes `false`; `GameOver` writes `true` before creating actions |

`ClassicModeLayer::ClassicModeLayer()` is normalized at `0x00149168`. The inherited blade
cut-disabled byte is initialized to `false` by `PhysicsBladeLayer`; Classic does not set it
to `true` during its intro. The inherited physics-world-stop byte and world speed begin as
`false` and `1.0f` respectively.

### Inferred Creator orthogonal state model

The recovered behavior cannot be represented by one serialized phase enum. The smallest
Creator model that preserves its independent gates is:

| State dimension | Values / ownership | Recovered transition rule |
|---|---|---|
| Lifecycle | `intro`, `running`, `result-removed` | Luck starts all tosses; the display-score callback removes Classic and attaches the result layer. |
| Terminal presentation guard | `false` / `true`, corresponding to native `+0x2D0` | The first successful `GameOver()` call sets it before creating Game/Over; later calls return. |
| Gameplay shutdown | cut-enabled plus toss/electric scheduling states | Fail and bomb callbacks may repeat their shutdown writes independently of the terminal guard. |
| Pending bomb presentations | zero to many explosion nodes and finish callbacks | Each first-cut bomb owns an independent nominal `2.5s` explosion sequence. There is no recovered central pending-count field. |
| Physics hold | one last-writer boolean | Every `BombHit` writes `true`; every `AfterBombHit` writes `false`. It is not reference-counted. |
| Pause | director running / paused | Orthogonal to all dimensions; scheduler and action progress stop while paused. |

A pending third-miss FadeIn callback can therefore set the terminal guard and arm Game/Over
while a bomb explosion remains pending and physics is stopped. The later `AfterBombHit`
still calls guarded `GameOver()` but creates no second presentation, then clears the physics
hold. Multiple distinct bombs can also have overlapping presentations and callbacks.

The native code has no corresponding phase enum and no phase validation around pause
callbacks. Creator should model these dimensions explicitly without inventing a timer for
standard Classic.

## Scene entry and the first-toss gate

### `ClassicModeLayer::onEnter` order

`ClassicModeLayer::onEnter()` at `0x00148CDC` performs this externally relevant order:

1. Call `BaseGameplayLayer::onEnter()`.
2. Read `getWinSize()` into logical `W`, `H`.
3. Create and attach all nine toss controllers. Attaching them does not call their
   `Start()` methods.
4. Construct `FruitFailManager`, register `GameOverCallback`, and attach it.
5. Create `Text/text-good.png`, arm its action sequence, then attach it at z-order `1`.
6. Create `Text/text-luck.png`, arm its action sequence ending in
   `StartGameCallback`, then attach it at z-order `1`.
7. Create and attach `BombElectric` at z-order `1`.
8. Dispatch the vtable slot that resolves to
   `BaseGameplayLayer::InitPauseComponent()` at `0x00142AEC`.
9. Set the current `ScoreManager` best-score field from the corresponding global setting.
10. Call `PhysicsLayer::EnableWorldSpeedUp(30.0f)`.

The pause controls and speed-up action are therefore installed in the same scene-entry call
that arms the intro. No toss timer has started at this point.

### Good/Luck action geometry and timing

Let `L = VisibleRect.left().x` and `R = VisibleRect.right().x`. The resource/action contract
is:

| Sprite | Initial position | First move | Delay | Exit move | Completion |
|---|---|---|---:|---|---|
| `Text/text-good.png` | `(L - 0.25W, 0.525H)` | to `(0.5W, 0.525H)` in `0.5s` | `0.5s` | to `(R + 0.25W, 0.525H)` in `0.5s` | none |
| `Text/text-luck.png` | `(R + 0.25W, 0.475H)` | to `(0.5W, 0.475H)` in `0.5s` | `0.5s` | to `(L - 0.25W, 0.475H)` in `0.5s` | call `StartGameCallback()` |

The exact float literals are `0x3E800000 = 0.25f`, `0x3F000000 = 0.5f`,
`0x3F066666 = 0.525f`, and `0x3EF33333 = 0.475f`. The nominal intro is `1.5` action seconds.
The callback runs on the Luck sequence only. Frame discretization can place it on the first
action tick at or after that duration; `1.5` is not a wall-clock guarantee.

Cut input is already enabled during the intro because the inherited `cutDisabled` byte is
`false` and no entry step changes it. `StartGameCallback` writes `false` again. Creator must
not silently turn this into a cut-disabled countdown unless that is an explicit product
change.

### Exact start order

`ClassicModeLayer::StartGameCallback()` at `0x00148B30` performs:

1. `PhysicsBladeLayer::DisableCut(false)`.
2. `Start()` normal-fruit `FreeToss` (`+0x2A4`).
3. `Start()` dragon-fruit `FreeToss` (`+0x2BC`).
4. `Start()` magnet-fruit `FreeToss` (`+0x2C0`).
5. `Start()` electric-fruit `FreeToss` (`+0x2C4`).
6. `Start()` fruit `ConcurrentToss` (`+0x2A8`).
7. `Start()` fruit `WaveToss` (`+0x2AC`).
8. `Start()` bomb `FreeToss` (`+0x2B0`).
9. `Start()` bomb `ConcurrentToss` (`+0x2B4`).
10. `Start()` bomb `WaveToss` (`+0x2B8`).

Per the toss contract, each `Start()` schedules that controller and samples its first
threshold. It does not reset accumulated elapsed time. The listed call order is therefore
also the initial shared-RNG consumption order.

## Classic progressive world speed

Classic directly activates the shared speed-up path. `onEnter` passes literal
`0x41F00000 = 30.0f` to `PhysicsLayer::EnableWorldSpeedUp(float)` at `0x001616D4` after the
pause component and initial best-score assignment are complete.

`EnableWorldSpeedUp` stores the delay and arms `Delay(30.0) -> SpeedUpDelayCallback` on the
mode node. `PhysicsLayer::SpeedUpDelayCallback()` at `0x001615A4` is exact:

```text
if worldSpeed < 2.0f:
    worldSpeed = float32(worldSpeed + 0.1f)
    arm another Delay(storedDelay) -> SpeedUpDelayCallback
else:
    do nothing and do not rearm
```

The constants are `0x40000000 = 2.0f` and `0x3DCCCCCD = 0.1f`. There is no clamp after the
addition. A callback whose pre-add value is below `2.0f` always rearms once, even if that
addition reaches or slightly exceeds `2.0f`; the next callback performs the terminating
comparison. Creator fidelity tests should use float32 boundaries instead of a decimal
counter that silently clamps.

The first 30-second delay starts at scene entry, not at `StartGameCallback`, so the
1.5-second intro consumes part of that first interval. `PhysicsLayer::update()` multiplies
only the Box2D step delta by `worldSpeed`; toss schedulers, Cocos actions, and `TimeManager`
use unscaled scheduler delta. World speed is not a general game-clock multiplier.

This resolves the speed-up activation previously left open in
`classic-physics-contract.md`.

## Pause and resume

### Mode callback order

The standard Classic pause path is inherited from `BaseGameplayLayer`:

| Function | Normalized address | Recovered behavior |
|---|---:|---|
| `PauseCallback(CCObject*)` | `0x00143244` | call virtual `PauseInAction`; if effects enabled, play `Sounds/menubuttonclick.wav` then pause all effects; if music enabled, pause background music |
| `PauseInAction()` | `0x00142778` | expose/enable the pause UI, move its controls over `0.25f`, and arm `Delay(0.25f) -> PauseInCallback` |
| `PauseInCallback()` | `0x001426B6` | call `CCDirector::pause()` |
| `ResumeCallback(CCObject*)` | `0x00142A88` | call virtual `PauseOutAction`; if effects enabled, play the menu click then resume all effects; if music enabled, resume background music only when `GetGameMode() == 2` |
| `PauseOutAction()` | `0x001426C2` | call `CCDirector::resume()` first, move pause controls out over `0.25f`, and arm `Delay(0.25f) -> PauseOutCallback` |
| `PauseOutCallback()` | `0x00142678` | disable and hide the pause overlay after its exit action |

`PauseCallback` does not pause the director immediately. Gameplay schedulers and actions can
advance during the nominal `0.25`-second pause-in transition. Conversely,
`PauseOutAction` resumes the director before the nominal `0.25`-second pause-out transition,
so gameplay advances while the overlay exits.

Classic's `GetGameMode()` at `0x001489B4` returns `0`. The inherited pause path can pause
background music for Classic, but the inherited resume path does not resume it because its
branch requires mode `2`. This asymmetry is **recovered**; whether it was intentional is
**unknown**.

### Bundled director clock behavior

The imported names alone are not being used as a semantic assumption; the bundled engine
implementation was also traced:

- `CCDirector::pause()` at `0x001AB118` is idempotent while already paused. It saves the old
  animation interval, changes the paused interval to `0.25` seconds, then sets its paused
  byte.
- `CCDirector::drawScene()` at `0x001AB2BC` still renders while paused but skips the scheduler
  update call entirely.
- `CCDirector::resume()` at `0x001AB148` restores the saved interval, refreshes its wall-time
  sample, clears the paused byte, and zeros the next delta.

There are no direct per-controller `Pause`/`Resume` calls in the mode callbacks. The
director gate therefore preserves toss elapsed/threshold state, intro and terminal action
progress, the world-speed delay, bomb-explosion delay, and any shared `TimeManager`
remaining/freeze state. Standard Classic itself owns no `TimeManager`.

## Classic termination contract

### Shared shutdown order

The nine-controller stop order used by both terminal entry points is:

```text
normal Free (+0x2A4)
dragon Free (+0x2BC)
magnet Free (+0x2C0)
electric Free (+0x2C4)
fruit Concurrent (+0x2A8)
fruit Wave (+0x2AC)
bomb Free (+0x2B0)
bomb Concurrent (+0x2B4)
bomb Wave (+0x2B8)
```

`TossTurn::Stop()` unschedules its update and preserves elapsed time and the armed threshold.

`ClassicModeLayer::GameOverCallback(CCObject*)` at `0x001493F8`, registered with
`FruitFailManager`, performs:

1. disable blade cuts;
2. stop all nine controllers in the order above;
3. stop `BombElectric`;
4. call guarded `GameOver()`.

`FruitFailManager` may invoke this callback more than once when several fail animations are
pending at count three. Every invocation repeats the shutdown calls; only `GameOver()` is
guarded. The native contract must not be restated as an exactly-once fail callback.

### Bomb path and resolved physics virtual

`Bomb::Cut(...)` at `0x00145864` has its own one-byte cut guard. On its first cut it zeros
the bomb's motion state, calls `Bomb::Explosion()` at `0x00145810`, then notifies
`BombHit`; the cut sound request follows the notification when effects are enabled.
`Bomb::Explosion` creates and attaches `BombExplosionAnimation` with
`Bomb::ExploseAnimationCallback` as its finish event before Classic receives `BombHit`.

`PhysicsBladeLayer::update` checks the global cut-disabled state before admitting a ray
query, but `RayCastWorld` does not re-read it between fixtures already collected by that
query (`0x00160442`, `0x00160FE4`). Because the one-byte cut guard at `0x00145864` belongs
to each bomb, one query can first-cut multiple distinct bombs and attach multiple explosion
nodes before returning. Repeated reports for the same bomb remain one-shot.

`ClassicModeLayer::BombHit()` at `0x00148C20` then performs:

1. disable blade cuts;
2. stop the same nine controllers in the same order;
3. stop `BombElectric`;
4. call `PhysicsLayer::StopPhysicsWorld(true)`;
5. call `ScoreManager::AddScore(-10)`.

The formerly unresolved virtual is recovered, not inferred. The
`ClassicModeLayer` vtable symbol is at `0x00455F90`, its primary vptr base is
`0x00455F98`, and call slot `+0x1EC` resolves through word address `0x00456184` to raw Thumb
pointer `0x001614D9`, normalized as
`PhysicsLayer::StopPhysicsWorld(bool)` at `0x001614D8`. That method writes the world-stop
byte; while true, `PhysicsLayer::update` skips `b2World::Step`.

The explosion action chain is:

| Function | Address | Action/state transition |
|---|---:|---|
| `BombExplosionAnimation::onEnter()` | `0x001465A0` | delay `0.25f`, then `beginStateCallback` |
| `beginStateCallback()` | `0x001463D4` | set animation state `2`; delay `1.0f`, then `waitStateCallback` |
| `waitStateCallback()` | `0x00146414` | set animation state `1`; delay `1.25f`, then `finishStateCallback` |
| `finishStateCallback()` | `0x00146392` | unschedule its update, remove itself from its parent, then invoke its registered finish event |
| `Bomb::ExploseAnimationCallback(CCObject*)` | `0x00145520` | notify `AfterBombHit` first, then dispose the bomb |

Thus `ClassicModeLayer::AfterBombHit()` at `0x00149484` runs after a nominal
`0.25 + 1.0 + 1.25 = 2.5` action seconds. It calls guarded `GameOver()` first, then calls the
same resolved virtual as `StopPhysicsWorld(false)`. On an isolated bomb-only path, this call
arms Game/Over before physics stepping resumes. If a pending fail callback already set the
terminal guard, the guarded call is a no-op and physics still resumes. With multiple active
explosions, the first finish callback also resumes the last-writer Boolean even while another
explosion remains pending. Director pause extends every pending action because its action
clock does not advance while paused.

### Guarded Game/Over presentation

`ClassicModeLayer::GameOver()` at `0x00149204` returns immediately when the byte at
`+0x2D0` is already nonzero. On the first call it sets that byte to `true` before querying
geometry or creating either sprite.

The exact action contract is:

| Sprite | Initial position | Enter | Hold | Exit | Completion |
|---|---|---|---:|---|---|
| `Text/text-game.png` | `(center.x, VisibleRect.top().y + 0.5 * spriteHeight)` | to `(center.x, 0.575H)` in `0.75s` | `1.0s` | to `(-0.5W, 0.575H)` in `0.75s` | `DisplayScoreCallback()` |
| `Text/text-over.png` | `(center.x, VisibleRect.bottom().y - 0.5 * spriteHeight)` | to `(center.x, 0.425H)` in `0.75s` | `1.0s` | to `(1.5W, 0.425H)` in `0.75s` | none |

Both sprites are attached at z-order `1`. Literals are
`0x3F400000 = 0.75f`, `0x3F800000 = 1.0f`,
`0x3F133333 = 0.575f`, `0x3ED9999A = 0.425f`, and
`0x3FC00000 = 1.5f`. The score callback is therefore armed after a nominal `2.5` action
seconds and belongs to the Game sequence only.

`GameOver()` itself does not disable cuts, stop tosses, stop `BombElectric`, or stop the
physics world. Its callers own those steps. On the three-miss path physics continues during
the terminal presentation. On the isolated bomb-only path physics is stopped for the
explosion interval and resumes after the guarded Game/Over call. Pending fail callbacks and
multiple bomb explosions may overlap that presentation as described above.

### Terminal callback and score-layer swap

`ClassicModeLayer::DisplayScoreCallback()` at `0x00148BAC` performs:

1. unconditionally stop all sound effects;
2. obtain the Classic node's parent;
3. construct a `DisplayScoreLayer`;
4. call `setGameModeType(GetGameMode())`, passing `0`;
5. call `setGameModeScore(ScoreManager::getBestScore())` with the exact value returned by
   that method;
6. remove the Classic node from its parent with cleanup `true`;
7. attach the configured score layer to that parent at z-order `1`.

No additional scene-transition call is present in this callback. On an isolated bomb-only
path where no earlier fail callback enters Game/Over, the nominal action duration from
explosion attachment to this swap is `2.5 + 2.5 = 5.0` seconds, subject to frame
discretization and director pauses. Concurrent fail or bomb callbacks can arm the one-shot
terminal presentation earlier and invalidate that simple sum.

This section resolves both the bomb virtual and Game/Over presentation items previously left
open in `classic-cut-score-contract.md`.

## Shared `TimeManager` contract

### Classic ownership boundary

Nothing in `ClassicModeLayer` references `TimeManager::create`, `Start`, `Stop`, `Restart`,
`Freeze`, `DisableFreeze`, or its callbacks. A Creator `ClassicModeController` must not add a
countdown merely because the shared class exists. `TimeManagerService` should be a reusable
owner instantiated only by modes whose recovered call graphs require it.

### Storage and construction

`TimeManager::TimeManager()` is normalized at `0x00164B5C`; `create(...)` is at
`0x00164CC6`. The object allocation size is `0x230` bytes. Behaviorally relevant fields are:

| Offset | Role | Constructor / factory effect |
|---:|---|---|
| `+0xE4` | timer label pointer | constructor writes null; `onEnter` assigns |
| `+0xE8` | freeze-clock sprite pointer | constructor writes null; `onEnter` assigns |
| `+0xEC` | total time, float | constructor writes `0`; `setTotalTime` assigns |
| `+0xF0` | remaining time, float | constructor writes `0`; `setTotalTime` assigns the same value |
| `+0xF4` | freeze elapsed, float | constructor writes `0`; `Freeze` resets |
| `+0xF8` | next warning second, signed integer | constructor and `Restart` write `10` |
| `+0xFC` | frozen byte | constructor writes `false` |
| `+0x100` | callback target | `create` assigns |
| `+0x104/+0x108` | freeze-start member-function pair | `create` assigns |
| `+0x10C/+0x110` | time-up member-function pair | `create` assigns |
| `+0x114/+0x118` | freeze-finish member-function pair | `create` assigns |
| `+0x11C/+0x120` | time-up-action-finish member-function pair | constructor zeros this pair; `create` assigns |

The constructor does not visibly initialize the target or first three callback pairs;
factory use populates all of them. `create(total, target, freezeStart, freezeFinish, timeUp,
timeUpFinish)` invokes setters in exactly that order. Callback dispatch has no null guard and
passes the `TimeManager` node as the callback argument. Creator should expose required
callbacks or define an explicit safe divergence; it must not claim native optionality.

### UI initialization

`TimeManager::onEnter()` at `0x001649CC` performs these presentation-relevant steps:

- cache normal label color `(71,71,71)` and warning color `(247,147,30)`;
- format `trunc(remaining)` with `"%d"` for the initial label, before any update tick;
- create the label with `Fonts/MotorwerkOblique.ttf` at size `(W / 480) * 36`, position it at
  `(0.85W, 0.95H)`, apply the normal color, fade it in over `1.0s`, and attach at z-order `1`;
- create `Interfaces/object-time-freeze.png`, position it half a sprite width left of
  `VisibleRect.right()` and half a sprite height below `VisibleRect.top()`, attach at z-order
  `1`, then hide it.

The first non-frozen update changes the label to `minutes:seconds` format. `onEnter` does not
start countdown updates by itself.

### Scheduling lifecycle

| Method | Address | Exact recovered effect |
|---|---:|---|
| `setTotalTime(float)` | `0x00164C6C` | write both total and remaining |
| `Start()` | `0x00164D24` | call `scheduleUpdate()` only |
| `Stop()` | `0x00164D40` | call `unscheduleUpdate()` only |
| `Restart()` | `0x00164D2C` | copy total to remaining and set warning second to `10`; do not schedule |

`Start` does not reset remaining, warning state, frozen state, freeze elapsed, colors, label,
or actions. `Stop` preserves all of them and does not stop child/node actions. `Restart` does
not clear frozen state or freeze elapsed, reshow/hide the clock, refresh the label, cancel an
existing time-up presentation, or reschedule updates. These are method contracts, not a
recommended modern API.

### Non-frozen update

`TimeManager::update(float)` at `0x00164D48` first calls `CCNode::update(dt)`. When not
frozen, it then performs this order:

1. `remaining = float32(remaining - dt)`; there is no clamp.
2. Compute `minutes = trunc(remaining / 60.0f)`.
3. Compute `seconds = trunc(remaining) % 60` using signed integer division/remainder.
4. Format `"%d:%d"` when `seconds > 9`; otherwise format `"%d:0%d"`.
5. If `minutes == 0 && seconds == warningSecond`:
   - conditionally play `Sounds/timetick.wav` when effects are enabled;
   - decrement `warningSecond` by one;
   - toggle the label between normal and warning colors, choosing warning when the current
     red channel equals the stored normal red channel, otherwise normal.
6. If `remaining <= 0`, run the time-up sequence below.
7. Set the label string from the buffer formatted in step 4, including on the expiry tick.

Warning detection is equality on the displayed integer second, not threshold crossing. A
large `dt` can skip `10`, after which the warning cursor remains `10` and later lower seconds
do not tick. Warning handling precedes expiry. If ordinary small ticks reach displayed
second `0` while `warningSecond == 0`, the tick and time-up effects can both be requested in
that same update, in that order.

Negative remaining values are retained. The signed truncation/remainder behavior can create
negative formatted values briefly in the final label update; Creator must not clamp before
dispatching callbacks if native ordering is the fidelity goal.

### Time-up sequence

When the post-subtraction remaining value is `<= 0`, update performs:

1. conditionally play `Sounds/timeup.wav` when effects are enabled;
2. call `Stop()`, unscheduling further updates;
3. synchronously invoke the registered time-up callback;
4. create `Text/text-time-up.png`;
5. place it at center height with initial x
   `VisibleRect.left().x - 0.5 * spriteWidth`;
6. run `MoveTo(center, 1.0s) -> Delay(1.0s) ->
   MoveTo(VisibleRect.right().x + 0.5 * spriteWidth, center.y, 1.0s) ->
   TimeUpFinishCallback`;
7. attach the sprite at z-order `1`;
8. update the timer label string for the expiry tick.

`TimeManager::TimeUpFinishCallback()` at `0x00164974` synchronously invokes the registered
time-up-action-finish callback. The nominal gap between the immediate time-up callback and
the finish callback is `3.0` action seconds.

There is no terminal guard byte. Normal scheduler entry is prevented by `Stop`, but a
manual/reentrant update or a new `Start` can construct another time-up path. `Restart` also
does not cancel the first time-up sprite or its pending finish callback.

### Freeze and thaw

`TimeManager::Freeze()` at `0x00164B9C` performs:

1. set `frozen = true`;
2. conditionally play `Sounds/freeze.wav`;
3. set `freezeElapsed = 0`;
4. set the internal freeze-clock RGB bytes to `(255,255,255)`;
5. synchronously invoke the freeze-start callback;
6. show the freeze-clock sprite;
7. set its opacity to `0`.

There is no already-frozen guard. Repeated calls replay every step and restart the 15-second
window.

While frozen, remaining time does not change. Each scheduled update adds `dt` to
`freezeElapsed`:

- if `freezeElapsed >= 15.0f`, call `DisableFreeze()` and do not subtract that tick's `dt`
  from remaining;
- from `0` through `1.5f`, set clock intensity/opacity to
  `uint32(255 * (freezeElapsed / 1.5))`;
- above `1.5f` through `13.5f`, use `255`;
- above `13.5f` and below `15.0f`, use
  `uint32(255 * (1 - (freezeElapsed - 13.5) / 1.5))`.

On a non-expiring frozen tick, the computed byte is applied as opacity first and color
second. On the `>= 15.0f` tick, `DisableFreeze()` completes first, including its callback,
hide, and bonus disable; update then still reapplies the stored clock color but does not set
opacity. The sprite is already hidden at that point.

The recovered literals are `0x41700000 = 15.0f`, `0x3FC00000 = 1.5f`,
`0x41580000 = 13.5f`, `0x3DCCCCCD = 0.1f`, and `0x437F0000 = 255.0f`. The first ramp is
implemented as division by `15.0f` then by `0.1f`, which is algebraically `1.5f` but should
retain float32 operation boundaries for bit-level tests. The same byte is used for opacity
and all three color channels.

`TimeManager::DisableFreeze()` at `0x00164C2C` performs:

1. set `frozen = false`;
2. synchronously invoke the freeze-finish callback;
3. hide the freeze-clock sprite;
4. call `BonusManager::DisableBonusType(12)`.

There is no not-frozen guard. A direct repeated `DisableFreeze` repeats its callback, hide,
and bonus-disable effects. Because callbacks are inline and unguarded, reentrant callback
mutations are not normalized by the native service.

Director pause prevents the scheduler update that advances either remaining time or
`freezeElapsed`; it also suspends the freeze-clock and time-up actions without resetting
them.

## Cocos Creator 3.8 ownership mapping

| Recovered responsibility | Creator owner | Required boundary |
|---|---|---|
| Standard Classic phase and one-shot terminal gate | `ClassicModeController` | explicit inferred phases; one terminal-presentation guard; do not add a countdown clock |
| Good/Luck start gate | `ClassicIntroPresenter` | logical/world-unit anchors, deterministic action clock, callback on Luck only |
| Nine-controller orchestration | `ClassicTossCoordinator` | exact start/stop order; retain each controller's elapsed/threshold on stop |
| Global gameplay clock gating | `GameplayPauseCoordinator` | preserve the `0.25s` pre-pause and post-resume windows; freeze scheduler/action progress only after pause-in completes |
| Physics stop and progressive speed | `ClassicPhysicsAdapter` | separate `worldStopped` from `worldSpeed`; scale only physics step delta; start the 30-second action at scene entry |
| Bomb hold and explosion completion | `BombExplosionPresenter` plus `ClassicModeController` | attach each explosion before its bomb-hit notification; preserve independent callbacks, the one-shot terminal guard, and the last-writer physics Boolean; guarded GameOver precedes every resume |
| Game/Over terminal presentation | `ClassicTerminalPresenter` | guard before creation; exact paired actions; score navigation from Game only |
| Score-screen replacement | `ClassicResultNavigator` | stop effects, configure mode/score, remove Classic with cleanup semantics, then attach result in recovered order |
| Shared timed-mode service | `TimeManagerService` | separate reusable state machine with injected callbacks and deterministic delta; instantiate only in proven timed modes |
| Time warning/freeze presentation | `TimeManagerPresenter` | label formatting/color toggle, freeze-clock ramps, Time Up action; no authority over Classic termination |
| Bonus type `12` cleanup | `BonusService` | invoked after freeze-finish callback and clock hide |
| Settings-gated audio | `GameplayAudioAdapter` | preserve call order and the recovered Classic background-music resume asymmetry until reviewed |

Creator positions must be expressed in the restored scene's logical world coordinate system.
Do not substitute physical pixels for `getWinSize()` values. Where Creator layout differs,
centralize a legacy-logical-space adapter so ratios, visible edges, and runtime sprite bounds
remain testable.

## Deterministic contract tests

Use an injected action/scheduler clock and event-log fakes. These are implementation tests
for the recovered contract, not claimed traces from an unavailable original runtime.

1. A standard Classic scene reports mode `0`, creates no `TimeManagerService`, and reaches
   terminal state only through fail or bomb events.
2. `onEnter` creates/attaches the nine controllers and fail manager before Good/Luck, then
   BombElectric, pause UI, best-score initialization, and the 30-second speed action. All
   toss controllers remain unscheduled until Luck completes.
3. At action times `0`, `0.5`, `1.0`, and `1.5`, assert both intro sprites' recovered
   positions. Only Luck emits start, and director pause preserves its remaining action time.
4. Assert cut input is enabled during intro and receives a redundant enable before any toss
   `Start` call.
5. Assert exact start order
   `normal, dragon, magnet, electric, fruit-concurrent, fruit-wave, bomb-free,
   bomb-concurrent, bomb-wave`, including initial RNG draw order.
6. Start world speed at float32 `1.0`; fire callbacks every 30 action seconds; assert
   float32 `+0.1`, pre-add strict `< 2.0`, the final rearmed no-op callback, and no scaling of
   toss/action/TimeManager delta.
7. Pause input begins UI/audio work while gameplay still advances for `0.25` action seconds;
   after `PauseInCallback`, scheduler updates stop. Resume restarts the director before the
   `0.25` exit. Assert no toss thresholds, timer values, freeze elapsed, explosion progress,
   or terminal progress are reset.
8. With music enabled in mode `0`, pause requests background-music pause and resume does not
   request background-music resume. Effects order is click-before-pause and
   click-before-resume.
9. Multiple fail callbacks at count three may repeat disable/stop/electric-stop, but only
   the first `GameOver()` creates terminal sprites or schedules result navigation.
10. On bomb hit, assert cut disable and all stops precede
    `StopPhysicsWorld(true)`, which precedes `AddScore(-10)`. Assert the explosion was
    attached before that notification.
11. In an isolated bomb-only fixture, advance the explosion action by `0.25`, `1.0`, and
    `1.25` seconds. Its finish calls Classic `AfterBombHit`, which arms Game/Over before
    `StopPhysicsWorld(false)`, and then disposes the bomb.
12. Complete a pending third-miss indicator during bomb hold. It may arm Game/Over first;
    the later `AfterBombHit` emits no second terminal presentation but still resumes physics.
13. Admit one ray containing two distinct bombs. Both per-object guards attach explosions;
    repeated reports for one bomb do not. The first finish writes the shared physics-stop
    Boolean false even while the second explosion remains pending.
14. Assert both terminal sprite paths at `0`, `0.75`, `1.75`, and `2.5` action seconds.
    Game alone calls display score. Reentering guarded `GameOver` emits nothing.
15. Assert terminal navigation order:
    `stop effects -> construct result -> set mode 0 -> set getBestScore value -> remove
    Classic(cleanup=true) -> add result(z=1)`.
16. For `TimeManager`, assert `setTotalTime` writes total and remaining; `Start` does not
    reset; `Stop` preserves; `Restart` resets only remaining and warning second and does not
    schedule.
17. Assert the initial timer label is truncated decimal, then normal updates produce
    `minutes:seconds`; test both format strings, signed truncation, and an unclamped negative
    expiry value.
18. Drive `10,9,...,0` with small ticks and assert warning audio/decrement/color-toggle
    before expiry. Separately skip from above `10` to below it with one large `dt` and assert
    the equality-based warning cursor remains stuck at `10`.
19. On expiry, assert
    `timeup sound -> unschedule -> immediate callback -> construct/arm/attach sprite -> label
    update`; advance three action seconds and assert the finish callback. Restart/Start before
    completion must not silently cancel the old finish action.
20. Call `Freeze` twice and assert the complete sequence repeats and elapsed resets. Test
    clock intensity at `0`, `1.5`, `13.5`, and just below `15`; at `>=15`, assert no
    remaining-time subtraction on that tick.
21. Call `DisableFreeze` while already thawed and assert
    `frozen=false -> finish callback -> hide clock -> disable bonus 12` still repeats.
22. Pause a running, frozen, and time-up-presenting `TimeManager` in separate fixtures;
    scheduler/action progress must be preserved exactly until director resume.

## Traceability table

| Contract area | Principal normalized symbols |
|---|---|
| Classic identity/start | `ClassicModeLayer::GetGameMode` `0x001489B4`; `StartGameCallback` `0x00148B30`; `onEnter` `0x00148CDC`; constructor `0x00149168` |
| Classic terminal | `DisplayScoreCallback` `0x00148BAC`; `BombHit` `0x00148C20`; `GameOver` `0x00149204`; `GameOverCallback` `0x001493F8`; `AfterBombHit` `0x00149484` |
| Pause | `PauseOutCallback` `0x00142678`; `PauseInCallback` `0x001426B6`; `PauseOutAction` `0x001426C2`; `PauseInAction` `0x00142778`; `ResumeCallback` `0x00142A88`; `InitPauseComponent` `0x00142AEC`; `PauseCallback` `0x00143244` |
| Physics time | `StopPhysicsWorld` `0x001614D8`; `SpeedUpDelayCallback` `0x001615A4`; `EnableWorldSpeedUp` `0x001616D4` |
| Bomb delay | `Bomb::ExploseAnimationCallback` `0x00145520`; `Bomb::Explosion` `0x00145810`; `Bomb::Cut` `0x00145864`; explosion state callbacks `0x00146392`-`0x001465A0` |
| Director clock | `CCDirector::pause` `0x001AB118`; `resume` `0x001AB148`; `drawScene` `0x001AB2BC` |
| TimeManager setup | `TimeUpFinishCallback` `0x00164974`; `onEnter` `0x001649CC`; constructor `0x00164B5C`; `create` `0x00164CC6` |
| TimeManager state | `Freeze` `0x00164B9C`; `DisableFreeze` `0x00164C2C`; `Start` `0x00164D24`; `Restart` `0x00164D2C`; `Stop` `0x00164D40`; `update` `0x00164D48` |

## Status ledger

| Item | Status | Confidence / action |
|---|---|---|
| Standard Classic has no `TimeManager` owner | recovered | high; complete mode entry/callback call graph |
| Good/Luck geometry, timing, callback, and start order | recovered | high; dual disassembly and literal agreement |
| Cut remains enabled during intro | recovered | high; constructor byte plus absence of an entry disable |
| Classic 30-second world-speed activation | recovered | high; direct `onEnter` call closes prior physics-contract unknown |
| Pause/resume timing and scheduler preservation | recovered | high; mode callbacks plus bundled director implementation |
| Bomb boolean virtual is `StopPhysicsWorld(bool)` | recovered | high; vtable base, slot word, Thumb normalization, and direct callee behavior agree |
| Isolated bomb-to-result nominal `2.5 + 2.5` action schedule | recovered | high; complete callback chain; concurrent fail/bomb callbacks can arm terminal presentation earlier |
| Same-query multi-bomb overlap and last-writer physics stop | recovered | high; global cut gate, per-bomb guard, fixture-loop, and independent finish callbacks agree |
| Terminal guard and result swap | recovered | high; direct branch/call order |
| `TimeManager` lifecycle, warning, expiry, and freeze math | recovered | high; dual-disassembly branch/literal agreement |
| Creator phase names | inferred | implementation model only; preserve recovered gates and orders |
| Intent of Classic music-resume asymmetry | unknown | preserve initially or make an explicit reviewed product change |
| Third-miss indicator completion before `GameOverCallback` | recovered | nominal `0.25s` concurrent scale/fade; callback checks shared count at completion, as recorded in `classic-presentation-contract.md` |
| Callback reentrancy policy for the Creator rewrite | product decision | native callbacks are synchronous and mostly unguarded; choose and document safe divergence if required |

## Unresolved questions

- Should the recovered mode-`0` background-music resume asymmetry be preserved for initial
  fidelity or corrected as an explicit audio-policy change?
- Should Creator harden `TimeManager` callbacks against null/reentrant use, with the
  divergence covered by adapter tests, or expose a strict compatibility implementation?
- Should a later safety variant replace recovered same-query multi-bomb last-writer behavior
  with a reference-counted physics hold, while the first fidelity build preserves it?

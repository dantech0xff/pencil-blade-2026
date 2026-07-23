# Crazy Mode Gameplay and Presentation Contract

Status: independently reviewed static contract; Crazy resource checkpoint remains AMBER

## Scope and evidence policy

This clean-room contract specifies `CrazyModeLayer`, the Mode Select destination at index
`1`. It covers entry, the 60-second game clock, toss-controller construction and ordering,
special-fruit effects, misses, bombs, freeze/magnet behavior, time-up, result configuration,
retry, ranking, reward accounting, resources, and the Cocos Creator ownership boundary.

The original application and `libgame.so` were not installed, loaded, linked, translated,
emulated, or executed. Evidence comes from:

- `DER-NATIVE-001`, immutable `libgame.so`, SHA-256
  `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`;
- the registered static corpus and app symbol map;
- fresh Thumbv5TE disassembly of the targeted mode and result functions;
- the already reviewed shared toss, time, score, physics, and presentation contracts;
- the staged resource manifest and the Crazy resource/consumer report.

Unless explicitly marked otherwise, behavior in this file is **recovered**. This document
contains no native code or mechanically translated disassembly.

## Identity and high-level rules

| Property | Recovered value |
|---|---|
| Mode Select index | `1` |
| Destination | `CrazyModeLayer` |
| `GetGameMode()` | `1` |
| Unlock key | `mode_unlock_1` |
| Unlock default | `false` |
| Unlock price | `2500` coins |
| Clock total | `60.0` seconds |
| Best-score keys | `crazy_best_1`, `crazy_best_2`, `crazy_best_3` |
| Result reward factor | float32 `0.6` with truncation toward zero |
| Replay | constructs a fresh `CrazyModeLayer` |

Crazy is not Classic with a faster spawn rate. It is a timed mode with:

- a `60s` then `GO` intro;
- the shared `TimeManager`;
- `DoubleToss` and `BonusToss`;
- double-score, double-toss, freeze, electric, and magnet fruit effects;
- non-terminal misses and bomb hits;
- a time-up result transition.

## Recovered mode-owned state

The following offsets describe observed native ownership. Creator is not required to reproduce
the memory layout.

| Offset | Role |
|---:|---|
| `+0x2A4` | `Text/text-60s.png` intro sprite |
| `+0x2A8` | `Text/text-go.png` intro sprite |
| `+0x2AC` | normal-fruit `FreeToss` |
| `+0x2B0` | bomb `FreeToss` |
| `+0x2B4` | dragon-fruit `FreeToss` |
| `+0x2B8` | magnet-fruit `FreeToss` |
| `+0x2BC` | electric-fruit `FreeToss` |
| `+0x2C0` | normal-fruit `ConcurrentToss` |
| `+0x2C4` | bomb `ConcurrentToss` |
| `+0x2C8` | normal-fruit `WaveToss` |
| `+0x2CC` | bomb `WaveToss` |
| `+0x2D0` | `DoubleToss` |
| `+0x2D4` | `BonusToss` |
| `+0x2D8` | `TimeManager` |
| `+0x2DC` | `BombElectric` |

The native replay allocation is `0x2E0` bytes. The constructor clears the fields through
`+0x2D8`; `onEnter` assigns the electric object before the scene can advance.

## Scene entry

### Construction and attachment order

`CrazyModeLayer::onEnter()` performs this externally relevant sequence:

1. call `BaseGameplayLayer::onEnter()`;
2. reset `BonusManager`;
3. submit objective events `(8, 0)`, then `(4, 0)`;
4. read logical director width `W` and height `H`;
5. construct and add every controller in the table below at z-order `1`, in table order;
6. construct `TimeManager` with total `60.0` and required callbacks for freeze start, freeze
   finish, immediate time-up, and time-up presentation finish; add it at z-order `1`;
7. create and arm the `text-60s` intro sprite at z-order `1`;
8. create and add `BombElectric` at z-order `1`;
9. initialize the inherited pause UI;
10. initialize `ScoreManager` best score from `Settings::CrazyBest_1`.

Objective event meanings are not independently named. Creator must preserve the numeric event
pairs and ordering behind an objective port; it must not invent labels that imply more evidence.

### Controller construction table

All interval limits use the shared decile sampler:

```text
sample(low, high) = float32(low + k * (high - low) / 10), k in 0...9
```

| Add order | Slot | Controller | Type | Direction | Interval seconds | Additional parameters |
|---:|---|---|---:|---|---|---|
| 1 | `ab` | Free | `0`, normal fruit | Up | `[0.5, 3]` | — |
| 2 | `b0` | Concurrent | `0`, normal fruit | Up | `[7, 18]` | constructor counts `(1, 3)`; recovered actual count `1...4` |
| 3 | `b2` | Wave | `0`, normal fruit | Up | outer `[6, 18]` | internal `[0.25, 0.75]`; active `[1.5, 3]` |
| 4 | `ac` | Free | `1`, standard bomb | Up | `[7, 24]` | — |
| 5 | `b1` | Concurrent | `1`, standard bomb | Up | `[15, 30]` | constructor counts `(1, 2)`; recovered actual count `1...3` |
| 6 | `b3` | Wave | `1`, standard bomb | Up | outer `[15, 35]` | internal `[0.25, 0.75]`; active `[0.75, 1.5]` |
| 7 | `b4` | DoubleToss | composite | Left and Right | internal `[0.75, 1.5]` | guarded `15.0s` effect |
| 8 | `af` | Free | `3`, electric fruit ID `13` | Down | `[30, 45]` | no base toss sound |
| 9 | `ae` | Free | `4`, magnet fruit ID `14` | Down | `[20, 45]` | no base toss sound |
| 10 | `ad` | Free | `6`, DragonFruit | Down | `[15, 60]` | DragonFruit factory path |
| 11 | `b5` | BonusToss | `5` | dynamic Left/Right/Down | `[5, 30]` | candidates `[12, 10, 11]` |

`DoubleToss` is constructed and attached but is not started by the normal start gate. It starts
only after fruit ID `11` is cut.

The shared `DoubleToss`, `BonusToss`, `FreeToss`, `ConcurrentToss`, and `WaveToss` contracts,
including their RNG consumption and native quirks, are authoritative from
`classic-toss-contract.md`.

## Intro and start gate

### `60s` presentation

At scene entry, `Text/text-60s.png` begins at:

```text
x = VisibleRect.left.x - 0.5 * spriteWidth
y = VisibleRect.center.y
```

It runs these two tracks concurrently:

- move to the visible center over `0.25s`, delay `0.5s`, then move to
  `VisibleRect.right.x + 0.5 * spriteWidth` over `0.25s`;
- fade in over `0.25s`, delay `0.5s`, then fade out over `0.25s`, then invoke the `60s`
  completion callback.

The callback removes the `60s` sprite with cleanup, creates `Text/text-go.png`, and runs the
same geometry and timing. The final fade invokes the go callback. Nominal intro duration is
`2.0` action seconds.

### Go callback

The go callback performs:

1. remove `text-go` with cleanup;
2. start `TimeManager`;
3. call `DisableCut(false)`;
4. start controllers in this exact order:

```text
ab, b0, b2, ac, b1, b3, ad, b5, ae, af
```

That order determines the initial shared-RNG threshold draw order. `b4` is deliberately absent.
The inherited blade cut-disabled state already starts false, but the redundant write is part of
the recovered callback.

## Running toss behavior

Normal fruits use the shared nine-ID vector and shared factory/cut/critical contracts. Bomb,
DragonFruit, special Down-toss, spawn-kinematics, timer, wave, concurrent, bonus, and double
behavior are governed by `classic-toss-contract.md`.

Crazy-specific implications:

- `BonusToss` enables its selected bonus flag when it spawns fruit ID `10`, `11`, or `12`.
- If all three bonus flags are enabled, a Bonus turn spawns nothing and consumes no candidate
  or direction draw.
- `DoubleToss` has its recovered zero-interval base scheduler quirk and therefore still
  perturbs the shared RNG stream once per positive parent update while active.
- Effects-enabled audio changes shared-RNG interleaving where the shared contracts say it does.

## Fruit cut and special effects

`CrazyModeLayer::FruitCut(position, fruitId, suppliedScore)` dispatches by fruit ID:

| Fruit ID | Exact Crazy action order |
|---:|---|
| other than `10...14` | `ScoreManager::AddScore(suppliedScore)` |
| `10` | `ScoreManager::EnableDoubleScore()`; do not add score for this fruit |
| `11` | start `DoubleToss`; then add score `10` |
| `12` | call `TimeManager::Freeze()`; then add score `10` |
| `13` | start `BombElectric`; then add score `10` |
| `14` | create/attach `MagnetAnimation` with Crazy begin/end callbacks; then add score `10` |

The special resource mapping is:

| ID | Canonical intact raster | Effect |
|---:|---|---|
| `10` | `Fruits/fruit-bdouble.png` | double score |
| `11` | `Fruits/fruit-b2toss.png` | double toss |
| `12` | `Fruits/fruit-bfreezy.png` | freeze |
| `13` | `Fruits/fruit-electric-apple.png` | electric bomb field |
| `14` | `Fruits/fruit-magnetstrawberry.png` | magnet |

Every special fruit uses its exact `-cut-bottom` and `-cut-top` rasters. The base fruit cut
sound path for IDs above `8` requests `Sounds/mangosteen.wav` before the mode notification.
Downstream effect audio is then:

- ID `10`: `Sounds/doublepoint.wav`;
- ID `11`: `Sounds/doubletosstrum.wav`, then looping `Sounds/doubletoss.wav`;
- ID `12`: `Sounds/freeze.wav`;
- ID `13`: the recovered `BombElectric` audio contract;
- ID `14`: the recovered `MagnetAnimation` audio contract.

These audio requests remain conditional on the recovered effects setting where specified by
their shared owners.

### Double score

The shared `ScoreManager` contract applies unchanged:

- enabling clears the pending bucket and opens the double-score presentation;
- score added while active accumulates in the pending bucket;
- normal completion, disable, and finish flush `pending * 2`;
- completion disables bonus type `10`.

### Magnet callbacks

Magnet begin:

1. set the normal `FreeToss` limits from `[0.5, 3]` to `[0.25, 0.5]`;
2. pause bomb `FreeToss`, bomb `ConcurrentToss`, and bomb `WaveToss`, in that order.

Magnet end:

1. restore normal `FreeToss` limits to `[0.5, 3]`;
2. resume the same three bomb controllers, in the same order.

Changing limits does not resample the currently armed normal-fruit threshold. Paused bomb
controllers retain elapsed time and threshold.

### Freeze callbacks

`TimeManager::Freeze()` owns the `15.0s` countdown pause, freeze-clock presentation, and bonus
type `12` lifecycle described in `classic-time-state-contract.md`.

- freeze-start calls `PhysicsLayer::FreezeeWorld()`;
- freeze-finish calls `PhysicsLayer::UnFreezeeWorld()`.

Toss schedulers remain on the ordinary action/scheduler clock. The freeze callback affects the
physics-world boundary, while `TimeManager` independently stops decrementing its own remaining
time.

## Misses and bombs

### Fruit and bonus misses

- `FruitFail(position)` calls the inherited base hook and submits objective event `(4, 1)`.
- `BonusFruitFail(position)` submits objective event `(4, 1)`.
- Neither path adds a strike, subtracts score, stops a controller, or ends Crazy.

### Bomb hit

`BombHit()` performs this exact mode-owned order:

1. disable blade cuts;
2. call the inherited `BaseGameplayLayer::BombHit()` no-op;
3. add score `-10`;
4. disable double score, flushing an active pending bucket;
5. stop the magnet-fruit `FreeToss`;
6. submit objective event `(8, 1)`.

`AfterBombHit()` calls the inherited no-op and then re-enables cuts. Crazy does not stop the
Physics2D world at either callback. The standard Bomb itself remains stationary by zeroing its
linear velocity, angular velocity, and gravity scale on the first cut while every other Crazy
body continues stepping. A Crazy bomb is non-terminal.

The shared standard-bomb procedural explosion and deferred physics lifecycle apply: `0.25s`
blank, `1.0s` opaque-white visible-rect flash, then `1.25s` of accumulated opaque-white
bomb-to-edge triangles before `AfterBombHit()` and deferred Bomb disposal. `BombElectric` has a
statically visible unsafe native contact-layout conflict. Creator must implement a type-safe
electric contact boundary and record it as a safety adaptation; reproducing memory-unsafe
behavior is forbidden.

## TimeManager and time-up

The complete `TimeManager` scheduling, label, warning, freeze, expiry, and `text-time-up`
presentation contract in `classic-time-state-contract.md` applies. In Crazy:

- total and initial remaining time are `60.0`;
- scene entry constructs but does not start the timer;
- the go callback starts it;
- normal countdown uses unscaled scheduler delta;
- expiry invokes Crazy's immediate time-up callback before creating the three-second
  `text-time-up` action;
- the final time-up action callback invokes Crazy's finish callback.

### Immediate time-up

Crazy stops controllers in this exact order:

```text
ab, ad, ae, af, b0, b2, ac, b1, b3
```

Then it:

1. stops `BombElectric`;
2. calls `ScoreManager::FinishDoubleScore()`;
3. submits objective events `(8, 2)`, then `(4, 2)`.

Recovered quirks:

- immediate time-up does not disable blade cuts;
- `DoubleToss` (`b4`) is not stopped;
- `BonusToss` (`b5`) is not stopped;
- those two controllers may therefore remain active during the nominal three-second Time Up
  presentation.

Creator must preserve these omissions for the fidelity build unless a later explicit
compatibility decision supersedes them.

### Time-up finish

After the Time Up sprite completes, Crazy performs:

1. disable blade cuts;
2. stop all currently playing effects;
3. capture the current parent;
4. create `DisplayScoreLayer`;
5. set result mode to `1`;
6. set result score to the completed run's authoritative total; the native call site obtains
   that value through the source-level `ScoreManager::getBestScore()` symbol, while Creator
   keeps the saved-best HUD value as separate state;
7. remove Crazy from the parent with cleanup enabled;
8. add Result to the captured parent at z-order `1`.

Crazy does not run the Classic `GAME`/`OVER` presentation.

## Result, ranking, reward, and navigation

The shared Result visual tree and timings in `classic-presentation-contract.md` apply to mode
`1`.

Body-level result recovery additionally proves:

- `getSavedBestScore()` selects `CrazyBest_1` for mode `1`;
- cup/rank insertion for mode `1` uses `CrazyBest_1`, `CrazyBest_2`, and `CrazyBest_3`;
- the same recovered `>=` insertion rules and first/second/third-place cues apply;
- `getPercentScore()` returns float32 `0.6` for modes `0`, `1`, and `2`, and float32 `0.8`
  for modes `3`, `4`, and `5`;
- Crazy reward coins are therefore
  `truncTowardZero(float32(score) * float32(0.6))`;
- adding the reward to total coins preserves signed-int32 wraparound;
- Retry removes Result, constructs a fresh `CrazyModeLayer`, and adds it to the captured
  parent at z-order `1`;
- Menu removes Result, constructs Main Menu, and adds it to the captured parent at z-order
  `1`.

Retry and Menu retain the shared conditional `Sounds/menubuttonclick.wav` request and do not
save Settings, replace the Creator scene, or reseed process-owned RNG.

## Required resource surface

The manifest-backed byte/hash inventory is maintained in
`reports/researcher-2026-07-23-crazy-resource-map.md`. Crazy must load and consume, at minimum:

- both resolution variants of `Text/text-60s.png`, `Text/text-go.png`,
  `Text/text-time-up.png`, and `Interfaces/object-time-freeze.png`;
- `Fonts/MotorwerkOblique.ttf`;
- all normal fruit intact/cut rasters used by the shared normal-fruit vector;
- all five special-fruit intact/cut raster triples;
- standard bomb frames and electric-field resources;
- score HUD, double-score panel, pause UI, shared result tree, result particles, reward sprites,
  and result buttons;
- all directly bound toss, cut, combo, special-effect, bomb, timer, result-rank, swish, and
  navigation audio.

`Text/text-nobomb.png` and Crazy leaderboard-background consumer linkage remain unresolved.
They must not be silently claimed as Crazy gameplay consumers. Their assets remain staged and
tracked in the global restoration denominator.

## Creator ownership

Implementation must keep Crazy separate from Classic behavior:

| Responsibility | Creator owner |
|---|---|
| phase, start/time-up gates, exact controller ordering | `CrazySession` / `CrazyTossCoordinator` |
| shared decile RNG and toss timers | existing `GameplayRandom` and `TossTimer` |
| Free/Concurrent/Wave/Double/Bonus behavior | shared toss strategies with Crazy configuration |
| timer/freeze state | mode-neutral `TimeManagerService` |
| timer and intro sprites/label | `TimeManagerPresenter` and `CrazyIntroPresenter` |
| Crazy score/special dispatch | `CrazyCutScoreService` |
| physics, standard bombs, electric safety adaptation | `CrazyPhysicsAdapter` over shared Physics2D primitives |
| exact Crazy raster/audio catalog | `CrazyResourceCatalog` and Crazy audio supplement |
| result mode/ranking/retry/menu | Crazy result adapter over the shared Result presenter |
| persistent screen transaction | `RecoveredAppShellController` with explicit `crazy` state |

Do not add mode switches to `ClassicSession` or disguise Classic as Crazy. The Mode Select
route stays fail-closed until the complete Crazy runtime prepares successfully.

## Deterministic acceptance tests

The implementation gate requires tests for:

1. mode identity, unlock key/default/price, best-score key selection, and fresh replay;
2. all controller construction parameters and add order;
3. exact go start order and absence of `DoubleToss` from that order;
4. exact `60s` then `GO` geometry, concurrent fade/move tracks, and nominal `2.0s` gate;
5. timer creation at `60.0`, no scene-entry start, start at GO, warning/freeze/expiry behavior;
6. shared-RNG ordering for every controller start and strategy turn;
7. special IDs `10...14`, exact effect-before-score order, and ID `10` adding no cut score;
8. base and effect-specific audio ordering for all special fruits;
9. magnet interval mutation plus bomb pause/resume without threshold resampling;
10. freeze start/finish physics callbacks and the exact `15.0s` TimeManager behavior;
11. fruit and bonus misses submitting `(4, 1)` without fail markers or termination;
12. bomb hit order, `-10`, double-score flush, magnet-controller stop, `(8, 1)`, and recovery;
13. immediate time-up stop order, electric stop, double-score finish, objective order, and
    preservation of the un-stopped Double/Bonus quirk;
14. delayed time-up finish ordering and mode-`1` Result configuration, including a completed
    score below the saved best and a double-score bucket flushed by immediate time-up;
15. `CrazyBest_1/2/3` ranking insertion, rank audio, float32 `0.6` reward, signed-int32 coin
    addition, Retry to fresh Crazy, and Menu to Main Menu;
16. resource path/dimension/hash assertions for every Crazy-owned mandatory consumer;
17. Creator lifecycle rollback: a failed Crazy prepare/activate returns to the same Mode Select
    screen without attaching Classic or a placeholder;
18. strict TypeScript, full deterministic suite, resource audit, native/build-boundary audit,
    and a fresh Browser Preview of Menu -> Mode Select -> Crazy -> Result -> Retry/Menu.

## Explicit unknowns and safety adaptations

- Objective event pairs are recovered, but their human-readable names are unknown.
- The original source-level spelling for the go callback's child-removal virtual is unknown.
  Its observable operation is recovered: remove the stored `GO` child with cleanup before
  starting the timer and controller graph.
- The exact player-visible consequence of the original electric field's invalid native contact
  layout cannot be established. Creator uses a type-safe reviewed adaptation.
- Original-runtime pixel, audio-latency, and frame-trace comparison is unavailable because the
  APK cannot run on supported devices. Validation is static, deterministic, and user-review
  based; it must not be described as runtime identity proof.

None of these unknowns permits a placeholder mode or a dependency on the original binary.

## Static evidence anchors

| Subject | Normalized address |
|---|---:|
| `CrazyModeLayer::GetGameMode` | `0x0014AE40` |
| magnet begin / end | `0x0014AE48` / `0x0014AEA8` |
| go / `60s` callbacks | `0x0014AF08` / `0x0014AFAC` |
| time-up finish / immediate time-up | `0x0014B0EC` / `0x0014B166` |
| bonus fail / freeze finish / freeze start | `0x0014B200` / `0x0014B20C` / `0x0014B214` |
| after-bomb / bomb-hit | `0x0014B21C` / `0x0014B22E` |
| fruit fail / fruit cut | `0x0014B270` / `0x0014B28C` |
| scene entry / constructor / replay | `0x0014B324` / `0x0014B7EC` / `0x0014B87C` |
| Result retry / ranking / saved best / reward factor | `0x0014CBB0` / `0x0014CD2C` / `0x0014DA6C` / `0x0014DAC0` |

## Related contracts and reports

- `classic-toss-contract.md`
- `classic-time-state-contract.md`
- `classic-cut-score-contract.md`
- `classic-physics-contract.md`
- `classic-presentation-contract.md`
- `mode-select-presentation-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-native-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-resource-map.md`

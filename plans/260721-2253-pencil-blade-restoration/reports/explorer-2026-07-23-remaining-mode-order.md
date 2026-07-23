# Remaining Mode Implementation Order
---
date: 2026-07-23
status: done-with-concerns
scope: static-only evidence scout for gameplay mode IDs 2-5 after Classic and Crazy
evidence-policy: no APK execution; symbols, disassembly, strings, resources, contracts, and current source only
---

## Decision

Implement the remaining modes in this order:

1. **Classic Bird — mode `3`** (`HIGH` confidence)
2. **Crazy Bird — mode `4`** (`HIGH` confidence)
3. **Combo Bird — mode `5`** (`MEDIUM-HIGH` confidence)
4. **GN Style — mode `2`** (`HIGH` confidence that it belongs last)

The sequence is based on dependency leverage, not numeric order. Classic Bird introduces the
shared `BaseBirdLayer`/`BirdBlade` substrate while reusing the already-restored Classic
lifecycle. Crazy Bird can then combine that substrate with the recovered and currently
implemented Crazy controller graph. Combo Bird is a smaller timed mode after the bird
substrate exists, but has a new 90-second presentation contract and a low-resolution asset-name
mismatch to resolve. GN Style has ordinary blade/toss/time foundations but a uniquely large,
fixed particle choreography and dedicated music path; implementing it sooner would create the
most new uncertainty for the least reuse.

## Evidence Boundary

This report uses static evidence only:

- curated native symbol inventory and cross-boundary documentation;
- direct Thumb disassembly of the extracted `libgame.so`;
- native string offsets and call-site/literal resolution;
- paired extracted resource trees;
- recovered presentation contracts;
- current Cocos Creator domain and adapter seams.

No APK, activity, native library, or gameplay path was executed. Function bodies cited below
were inspected from:

- [`libgame.so`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-01/native/libgame.so)
- [`app-function-inventory.csv`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-02/native/app-function-inventory.csv)
- [`all-offsets.txt`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-02/native/strings/all-offsets.txt)
- [`dynamic-demangled.txt`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-02/native/symbols/dynamic-demangled.txt)

## Recovered Identity and Menu Contract

Direct `GetGameMode()` bodies establish the runtime IDs:

| ID | Native class | `GetGameMode` body | Mode Select state | Initial access |
|---:|---|---:|---:|---|
| `2` | `GNStyleLayer` | `0x0015166c`, returns `2` | `2` | locked unless `mode_unlock_2` |
| `3` | `ClassicBirdLayer` | `0x00147f70`, returns `3` | `3` | always cuttable |
| `4` | `CrazyBirdLayer` | `0x0014a3b4`, returns `4` | `4` | locked unless `mode_unlock_4` |
| `5` | `ComboBirdLayer` | `0x001494f4`, returns `5` | `5` | locked unless `mode_unlock_5` |

Evidence:

- [`function-map.csv` Classic Bird lines 248-278](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L248)
- [`function-map.csv` Combo Bird lines 299-323](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L299)
- [`function-map.csv` Crazy Bird lines 339-369](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L339)
- [`function-map.csv` GN Style lines 483-501](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L483)
- [`mode-select-presentation-contract.md` lines 300-311](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/mode-select-presentation-contract.md#L300)
- [`mode-select-presentation-contract.md` lines 617-634](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/mode-select-presentation-contract.md#L617)

The four cards use these exact recovered resources:

| ID | Fruit/card | Circle art | Description art |
|---:|---|---|---|
| `2` | fruit ID `2`, `fruit-strawberry.png` | `Interfaces/mode-gnstyle.png` | **`Interfaces/object-combo-des.png`** |
| `3` | fruit ID `7`, `fruit-orange.png` | `Interfaces/mode-classic-bird.png` | `Interfaces/object-classic-bird-des.png` |
| `4` | fruit ID `14`, `fruit-magnetstrawberry.png` | `Interfaces/mode-crazy-bird.png` | `Interfaces/object-crazy-bird-des.png` |
| `5` | fruit ID `6`, `fruit-kiwi.png` | `Interfaces/mode-combo-bird.png` | `Interfaces/object-combo-bird-des.png` |

GN Style's use of `object-combo-des.png` is native behavior, not a documentation typo. Do not
invent `object-gnstyle-des.png`.

The navigation contract is shared across all four modes: a successful card cut plays
`Sounds/gameplayselected.wav` when effects are enabled, schedules
`Delay(0.75) -> DelayCallback`, removes Mode Select with cleanup, constructs the layer selected
at callback time, and adds it to the same parent at z-order `1`. There is deliberately no
selection debounce. Locked cards use the same 2500-coin purchase flow already recovered by the
Mode Select contract.

## Shared Bird Substrate

Modes `3`, `4`, and `5` are not three independent blade implementations. Their common native
base is an explicit implementation boundary:

- `BaseBirdLayer::ccTouchesBegan` at `0x0014239c` plays the shared swosh sound and forwards each
  touch position to `BirdBlade::Touch`.
- `ccTouchesMoved` at `0x0014236c` and `ccTouchesEnded` at `0x00142384` are empty.
- `BaseBirdLayer::update` at `0x001423fc` first runs `PhysicsBladeLayer::update`, then consumes
  the cached BirdBlade ray, invokes the active mode's cut path, and calls
  `BirdBlade::RayCashDone`.
- `BaseBirdLayer::BaseBirdLayer` at `0x0014257c` calls the gameplay base and disables ordinary
  blade initialization with `setInitBlades(false)`.
- `CreateBirdBlade` at `0x001425c8` creates the BirdBlade and focuses `ComboManager` on the
  current `ScoreManager`.

Evidence:

- [`function-map.csv` lines 31-63](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L31)
- [`function-map.csv` BirdBlade lines 132-147](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L132)

`BirdBlade::onEnter` (`0x00144270`, 516 bytes), `Touch` (`0x001445c8`, 252 bytes), and
`update` (`0x00144708`, 976 bytes) are substantial enough to recover as one shared adapter and
presenter contract before any bird mode shell. Native strings resolve its visual inputs:

```text
Birds/bird-anim-%d-%d.png
Birds/bird-anim-%d-0.png
Birds/bird-left-%d.png
Birds/bird-right-%d.png
Blades/testblade7.png
Blades/Particles/X-Mas/xmasfive.png
Blades/Particles/X-Mas/xmasfour.png
Blades/Particles/X-Mas/xmashexa.png
Blades/Particles/X-Mas/xmascircle.png
```

All three bird layers call:

```text
CreateBirdBlade("Blades/testblade7.png", birdType)
```

with `birdType = 1` for Classic Bird, `2` for Crazy Bird, and `3` for Combo Bird. Corresponding
animation, left/right, blade, and particle resources exist in the paired extracted trees:

- [`480x800/Birds`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-01/jadx/resources/assets/480x800/Birds)
- [`720x1280/Birds`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-01/jadx/resources/assets/720x1280/Birds)
- [`480x800/Blades/testblade7.png`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-01/jadx/resources/assets/480x800/Blades/testblade7.png)
- [`720x1280/Blades/testblade7.png`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-01/jadx/resources/assets/720x1280/Blades/testblade7.png)

The present code already has a clean scoring seam in
[`combo-service.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/domain/combo-service.ts).
The missing common work is the BirdBlade input/ray/animation adapter, not another combo
algorithm.

## Mode 3 — Classic Bird

### Recovered native contract

The class surface closely mirrors Classic:

| Contract area | Native anchor |
|---|---|
| identity | `GetGameMode` `0x00147f70` -> `3` |
| entry/controller graph | `onEnter` `0x00148110`, 1088 bytes |
| game start | `StartGameCallback` `0x00147f74` |
| result transition | `DisplayScoreCallback` `0x00147ff0` |
| bomb and miss handling | `BombHit` `0x00148064`; `FruitFail` `0x001480f8` |
| scoring | `FruitCut` `0x00148550` |
| terminal lifecycle | `GameOver` `0x001486c4`; `GameOverCallback` `0x001488b8`; `AfterBombHit` `0x00148944` |
| replay | constructor `0x00148628`; `GetReplayInstance` `0x001486a4` |

`onEnter` builds the familiar untimed graph: `FreeToss`, `ConcurrentToss`, `WaveToss`,
`FruitFailManager` with a game-over callback, intro/result text, bomb-electric support,
BirdBlade type `1`, pause state, and world speed-up. It sets the current best from
`Settings::BirdClassicBest_1`. Direct string/call-site evidence includes:

```text
Text/text-good.png
Text/text-luck.png
Text/text-game.png
Text/text-over.png
```

Classic Bird therefore keeps Classic's terminal model: misses and bombs can end the run; it is
not a countdown mode. `DisplayScoreCallback` routes to the shared result layer.

### Shared versus unique work

Reusable now:

- Classic session, toss coordinator/strategies, result ranking/navigation, failure policy, and
  standard bomb presentation;
- shared physics/resource/settings seams;
- current `ComboService`.

Representative source seams:

- [`classic-session.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/domain/classic-session.ts)
- [`classic-toss-strategies.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/domain/classic-toss-strategies.ts)
- [`classic-gameplay-controller.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/creator/classic-gameplay-controller.ts)
- [`standard-bomb-explosion-state.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/domain/standard-bomb-explosion-state.ts)

Unique now:

- shared BirdBlade/BaseBird adapter and presentation;
- Classic Bird intro art sequence;
- `bird_classic_best_1..3` persistence/result binding;
- mode ID `3` result/retry registry entry.

### Order rationale and confidence

**First; HIGH confidence.** It has the highest recovered behavior overlap with a completed
mode, is the only remaining always-available card, and turns the largest shared dependency for
three remaining modes into reusable infrastructure. The main risk is BirdBlade fidelity, but
that risk exists regardless of which bird mode is selected first.

## Mode 4 — Crazy Bird

### Recovered native contract

The Crazy Bird symbol surface is a direct structural counterpart of Crazy mode:

| Contract area | Native anchor |
|---|---|
| identity | `GetGameMode` `0x0014a3b4` -> `4` |
| entry/controller graph | `onEnter` `0x0014a894`, 1066 bytes |
| intro/start | `ActionGoCallback` `0x0014a478`; `Action60sCallback` `0x0014a51c` |
| result/timer | `TimeUpFinishCallback` `0x0014a65c`; `TimeUpCallback` `0x0014a6d6` |
| special timing | `FreezeStartCallback` `0x0014a784`; `FreezeFinishCallback` `0x0014a77c` |
| fail/bomb/cut | `BonusFruitFail` `0x0014a770`; `BombHit` `0x0014a79e`; `FruitFail` `0x0014a7e0`; `FruitCut` `0x0014a7fc` |
| replay | constructor `0x0014ad38`; `GetReplayInstance` `0x0014adc8` |

`onEnter` constructs the same recovered timed controller family as Crazy: normal
`FreeToss`/`ConcurrentToss`/`WaveToss`, bomb variants, `DoubleToss`, bonus/special toss,
`BonusToss`, a 60-second `TimeManager` with freeze callbacks, bomb-electric support, and
BirdBlade type `2`. Direct intro resources are:

```text
Text/text-60s.png
Text/text-go.png
```

It binds `Settings::BirdCrazyBest_1`. The static Crazy recovery already concludes that the
mode `1` and mode `4` classes build the same timed controller graph:

- [`researcher-2026-07-23-crazy-native-contract.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-native-contract.md)

### Shared versus unique work

Reusable after Classic Bird:

- BirdBlade/BaseBird adapter and presentation;
- all recovered Crazy domain services: 60-second timer, normal/double/bonus toss coordination,
  specials, score multipliers, freeze/unfreeze, objectives, and timed result lifecycle.

Representative source seams:

- [`crazy-session.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/domain/crazy-session.ts)
- [`crazy-toss-coordinator.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/domain/crazy-toss-coordinator.ts)
- [`crazy-runtime-command-batches.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/domain/crazy-runtime-command-batches.ts)
- [`time-manager-service.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/domain/time-manager-service.ts)
- [`crazy-gameplay-controller.ts`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/game/assets/scripts/creator/crazy-gameplay-controller.ts)

Unique now:

- composition of the Crazy graph with the BirdBlade path;
- `bird_crazy_best_1..3` persistence/result binding;
- mode ID `4` result/retry registry entry.

### Order rationale and confidence

**Second; HIGH confidence.** Once Classic Bird proves the common bird layer, Crazy Bird is
primarily composition of two already-understood halves. Revalidate the exact operation order
inside `CrazyBirdLayer::ActionGoCallback` before a verbatim port; the existing Crazy native
report explicitly marks that narrow body-order check as incomplete.

## Mode 5 — Combo Bird

### Recovered native contract

| Contract area | Native anchor |
|---|---|
| identity | `GetGameMode` `0x001494f4` -> `5` |
| start chain | `StartGameCallback` `0x001494f8`; `GoCallback` `0x00149530`; `TotalTimeCallback` `0x00149634` |
| timer/result | `TimeUpFinishCallback` `0x00149738`; `TimeUpCallback` `0x001497ac` |
| entry/controller graph | `onEnter` `0x0014980c`, 1100 bytes |
| replay | constructor `0x00149cd0`; `GetReplayInstance` in the same class block |

`onEnter` constructs only `FreeToss`, `WaveToss`, and `ConcurrentToss`, then creates a
`TimeManager` with total `90.0f` (`0x42b40000`). It supplies time-up and finish callbacks but
no Crazy-style freeze callbacks. `StartGameCallback` starts those three controllers and the
timer. Time-up stops them. Fruit and bonus misses post the failure objective event rather than
ending the run; `FruitCut` adds its score to `ScoreManager`.

Direct presentation strings are:

```text
Text/text-go.png
Text/text-90s.png
Text/text-nobomb.png
Text/text-justcombo.png
Text/text-nolive.png
```

The mode uses BirdBlade type `3` and `Settings::BirdComboBest_1`.

### Shared versus unique work

Reusable after the first two bird modes:

- BirdBlade/BaseBird;
- `FreeToss`, `WaveToss`, and `ConcurrentToss`;
- `TimeManager`;
- `ComboManager` behavior through the current `ComboService`;
- generic timed result shell.

Unique now:

- 90-second start/instruction sequence;
- non-terminal miss policy and its objective events;
- `bird_combo_best_1..3` persistence/result binding;
- mode ID `5` result/retry registry entry.

### Resource concern

The native path is `Text/text-justcombo.png`, but the paired extraction is not an exact
filename pair:

- [`480x800/Text/text-juscombo.png`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-01/jadx/resources/assets/480x800/Text/text-juscombo.png)
- [`720x1280/Text/text-justcombo.png`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.forensics-work/phase-01/jadx/resources/assets/720x1280/Text/text-justcombo.png)

This needs an explicit resolution-specific resource contract or alias. It must not be silently
renamed as if both extracted trees agreed.

### Order rationale and confidence

**Third; MEDIUM-HIGH confidence.** The runtime graph is simpler than Crazy Bird, but it gains
more from waiting for the bird and generic timed-result seams. Its new instruction sequence and
the low-resolution filename discrepancy create a small but real recovery checkpoint.

## Mode 2 — GN Style

### Recovered native contract

| Contract area | Native anchor |
|---|---|
| identity | `GetGameMode` `0x0015166c` -> `2` |
| start chain | `GoCallback` `0x00151728`; `TotalTimeCallback` `0x00151830`; `StartGameCallback` `0x001584bc` |
| timer/result | `TimeUpFinishCallback` `0x00151938`; `TimeUpCallback` `0x001519ac` |
| entry/controller graph | `onEnter` `0x00151a0c`, 1080 bytes |
| replay | constructor `0x00151e44`; `GetReplayInstance` `0x00151eac` |
| particle helper | `AddParticle` `0x00151eca`, 168 bytes |
| choreography | `InitParticlesExplosion` `0x00151f74`, **25,926 bytes** |

Unlike the bird modes, GN Style derives from the standard gameplay/blade path. `onEnter`
creates only `FreeToss`, `WaveToss`, and `ConcurrentToss`, plus a `TimeManager` whose recovered
total is `150.0f` (`0x43160000`). Time-up stops those controllers; fruit/bonus misses post
failure objective events; fruit cuts add score.

Direct intro/instruction strings are:

```text
Text/text-go.png
Text/text-150s.png
Text/text-nobomb.png
Text/text-gnstyle.png
Text/text-nolive.png
```

`StartGameCallback` stops the existing background track and, when music is enabled, plays the
non-looping native path:

```text
Sounds/GangnamStyle.mp3
```

It then starts the three toss controllers and timer and calls `InitParticlesExplosion`.

### Unique choreography cost

`InitParticlesExplosion` is not a generic emitter call with a small data list. Static
disassembly contains **439 direct calls** to `GNStyleLayer::AddParticle`, with fixed
position/scale/timing data spread through the 25,926-byte body. The call sites resolve these
resource families:

```text
Blades/Particles/X-Mas/xmasfive.png
Blades/Particles/X-Mas/xmasfour.png
Blades/Particles/X-Mas/xmashexa.png
Blades/Particles/X-Mas/xmascircle.png
Blades/Particles/stars.png
Blades/Particles/VN Flag/vnflagstar.png
```

This is a dedicated presentation/choreography contract, not incidental decoration that can be
replaced with a guessed generic burst under the restoration policy.

### Shared versus unique work

Reusable:

- standard blade/physics path;
- three ordinary toss strategies;
- `TimeManager`;
- generic timed result shell.

Unique now:

- 150-second intro/instruction flow;
- dedicated music lifecycle and asset review;
- 439-entry fixed particle choreography and six resource families;
- `gnstyle_best_1..3` persistence/result binding;
- mode ID `2` result/retry registry entry.

### Order rationale and confidence

**Last; HIGH confidence.** GN Style does not depend on BirdBlade, but its choreography dominates
the remaining static recovery and implementation effort. Before implementation, translate the
439 calls into an evidence-backed data table/fixture and test its order and resource mapping.
Do not hand-port or approximate the sequence from visual intuition.

## Shared Result and Persistence Contract

`DisplayScoreLayer::RetryCallback` at `0x0014cbb0` statically dispatches all six mode IDs to
fresh layer instances:

```text
0 -> ClassicModeLayer
1 -> CrazyModeLayer
2 -> GNStyleLayer
3 -> ClassicBirdLayer
4 -> CrazyBirdLayer
5 -> ComboBirdLayer
```

Every branch uses the same-parent/z-order-1 replacement pattern. `getSavedBestScore` at
`0x0014da6c` switches across the six mode-specific best-score triplets.
`getPercentScore` at `0x0014dac0` resolves:

| Mode | Reward factor |
|---:|---:|
| `2` GN Style | `0.6` |
| `3` Classic Bird | `0.8` |
| `4` Crazy Bird | `0.8` |
| `5` Combo Bird | `0.8` |

All preference triplets and defaults are independently listed in:

- [`java-jni-boundary.md` lines 148-175](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/java-jni-boundary.md#L148)

Current result behavior is split across Classic and Crazy files. Before or during Classic Bird,
extract a shared mode registry for:

- mode ID;
- best-score triplet key;
- retry destination;
- reward factor;
- optional leaderboard art candidate.

Keep ranking/navigation behavior shared. This avoids copying result logic three times and then
rewriting it again for GN Style.

Native strings and paired resources include:

```text
Leaderboard/leaderboard_gnstyle.png
Leaderboard/leaderboard_classic_bird.png
Leaderboard/leaderboard_crazy_bird.png
Leaderboard/leaderboard_combo_bird.png
```

Those names are strong catalog candidates, but direct consumer linkage was not proven in this
pass. They are not yet mandatory gameplay/result dependencies.

## Recommended Checkpoints

| Checkpoint | Scope | Acceptance evidence |
|---|---|---|
| Bird foundation | shared BaseBird input/update/ray lifecycle, BirdBlade types `1..3`, animation/resource map, ComboService focus | static fixtures for touch semantics, ray consumption, type-to-resource mapping |
| Mode `3` | Classic lifecycle composed with Bird foundation; intro, terminal policy, best/result/retry | parity tests against recovered Classic Bird callbacks |
| Mode `4` | Crazy 60-second graph composed with Bird foundation | revalidated `ActionGoCallback` order; specials/freeze/result tests |
| Mode `5` | three-controller 90-second mode; instruction chain; non-terminal misses | explicit `juscombo`/`justcombo` resolution map; timed lifecycle tests |
| Mode `2` | standard blade 150-second mode, dedicated music, fixed particle choreography | generated evidence table covering all 439 particle calls; ordered fixture tests |

## Uncertainties

1. `CrazyBirdLayer::ActionGoCallback` has the right high-level contract, but its exact internal
   start order still needs the narrow revalidation already called out by the Crazy native
   report.
2. Combo Bird's `text-juscombo.png` / `text-justcombo.png` resolution mismatch needs a deliberate
   alias or path-selection rule.
3. The human-readable semantics of some `ObjectivesManager::ProcessGameEvent(mode, state)`
   pairs remain unnamed even though their call sites and numeric pairs are recoverable.
4. Leaderboard files are present and named per mode, but their direct consumer linkage remains
   unproven.
5. GN Style's music and extracted visual assets still require the same provenance/rights review
   as other original resources; static presence is not publication clearance.
6. The 439 GN Style calls were counted from direct calls to `AddParticle` in the recovered
   function body. Their complete ordered argument table has not yet been materialized as a
   committed artifact.

## Sources

- [`forensics/README.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/README.md)
- [`forensics/native/function-map.csv`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv)
- [`forensics/native/subsystem-map.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/subsystem-map.md)
- [`forensics/native/java-jni-boundary.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/java-jni-boundary.md)
- [`forensics/resources/resource-usage-map.json`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/resources/resource-usage-map.json)
- [`forensics/contracts/mode-select-presentation-contract.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/mode-select-presentation-contract.md)
- [`forensics/contracts/classic-presentation-contract.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/classic-presentation-contract.md)
- [`forensics/contracts/classic-toss-contract.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/classic-toss-contract.md)
- [`researcher-2026-07-23-crazy-native-contract.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-native-contract.md)

## Unresolved Questions

1. Should the shared Bird foundation be its own implementation checkpoint, or be delivered
   inside the Classic Bird checkpoint?
2. Should the result registry generalization land before Classic Bird, or as the first part of
   that mode's implementation?
3. What explicit low-resolution alias should be used for Combo Bird's native
   `Text/text-justcombo.png` request?

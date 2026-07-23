# GN Style Mode 2 Architecture Map
---
date: 2026-07-24
status: done-with-concerns
scope: static-only architecture scout for production GN Style mode 2 integration
baseline-head: 1c46d7e36cedb213e3bb14fc0510cd5f72f3bbb5
scout-start-head: 32c6efd4104b6158915bfd62d6c737c91e24dbbb
evidence-policy: no APK or native runtime execution; current source, tests, resources, symbols, and direct ELF disassembly only
---

## Decision

Implement GN Style as one independent mode-2 vertical slice on the existing ordinary-blade,
Classic-physics, timed-result, app-shell, and Settings seams. Do not route it through Crazy,
Bird input, or a generic particle emitter.

Two serialized components are sufficient:

1. `GnStyleSceneController`: pure session/coordinator owner plus ordinary input and Physics2D
   leases.
2. `GnStyleGameplayController`: resources, presentation, audio, pause, objectives, Result, and
   app-shell navigation.

The complete 439-call particle table is recovered as canonical CSV in the parallel native
contract report. The hard pre-implementation gate is promoting that table into standalone
machine-readable evidence and generated production data, then verifying a lossless round trip
against the pinned native function. The recovered choreography is data; the six-family
particle dynamics are code. This preserves native call order without 439 copied logic blocks
or a speculative generic particle system.

GN can otherwise use current seams. The bounded shared changes are:

- consume the landed six-mode Result objective-tail mapping;
- add the GN leaderboard to process-owned Settings;
- extract Combo Bird's generic TimeManager audio adapter for a second timed-mode consumer;
- add GN routing/preparation/state to Mode Select and the app shell;
- serialize the two components in `classic.scene`.

## Evidence Boundary and Working-Tree Warning

The requested root `README.md` does not exist at repository root.
That absence did not block this scout because phase 06, current code/tests, and the forensic
artifacts provide the relevant contracts.

The immutable native input is:

```text
.forensics-work/phase-01/native/libgame.so
SHA-256 55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e
ELF 32-bit little-endian ARM, EABI5, stripped
```

The scout began at committed HEAD
`32c6efd4104b6158915bfd62d6c737c91e24dbbb`
(`feat(bird): restore combo bird mode`). During final validation, the Result-objective work
owned by another worker landed as
`1c46d7e36cedb213e3bb14fc0510cd5f72f3bbb5`
(`fix: restore result objective tail dispatch`):

```text
game/assets/scripts/domain/recovered-result-objective.ts
game/assets/scripts/creator/classic-gameplay-controller.ts
game/assets/scripts/creator/classic-bird-gameplay-controller.ts
game/assets/scripts/creator/crazy-gameplay-controller.ts
game/assets/scripts/creator/combo-bird-gameplay-controller.ts
and their focused tests
```

This report distinguishes pre-fix `32c6efd` from current baseline `1c46d7e`. A GN implementer
must consume the landed shared changes and must not recreate or overwrite them.

Confidence labels used below:

- **direct**: literal, branch, call order, resource, symbol, or current source was inspected;
- **derived**: arithmetic or control-flow consequence of direct evidence;
- **target decision**: safest Cocos integration consistent with direct evidence.

No APK, activity, native library, Creator Preview, or gameplay route was executed for this
report.

Primary evidence:

- [`phase-06-recreate-full-game-content-and-progression.md`](../phase-06-recreate-full-game-content-and-progression.md)
- [`explorer-2026-07-23-remaining-mode-order.md`](./explorer-2026-07-23-remaining-mode-order.md)
- [`researcher-2026-07-24-gn-style-native-contract.md`](./researcher-2026-07-24-gn-style-native-contract.md)
- [`function-map.csv`](../../../forensics/native/function-map.csv)
- [`app-function-inventory.csv`](../../../.forensics-work/phase-02/native/app-function-inventory.csv)
- [`all-offsets.txt`](../../../.forensics-work/phase-02/native/strings/all-offsets.txt)
- [`mode-select-presentation-contract.md`](../../../forensics/contracts/mode-select-presentation-contract.md)
- current `game/assets/scripts/{domain,creator}`, `game/assets/scenes/classic.scene`, and vertical
  slice tests.

## Recovered Native Contract

### Identity and lifecycle anchors

| Contract | Native symbol/address | Direct behavior |
|---|---:|---|
| identity | `GNStyleLayer::GetGameMode`, `0x15166c` | returns mode `2` |
| intro continuation | `GNStyleLayer::TotalTimeCallback`, `0x151830` | creates `text-150s`, then schedules GO |
| GO continuation | `GNStyleLayer::GoCallback`, `0x151728` | creates GO, then calls `StartGame` |
| timer zero | `GNStyleLayer::TimeUp`, `0x1519ac` | stops three outer toss slots; objective `(6,2)` |
| timer finish | `GNStyleLayer::TimeUpFinish`, `0x151938` | stops effects, samples score, replaces GN with Result mode `2` at z `1` |
| miss callbacks | `BonusFruitFail`, `0x1519e2`; `FruitFail`, `0x1519ee` | objective `(6,1)` |
| cut callback | `FruitCut`, `0x1519fa` | forwards supplied score to `ScoreManager` only |
| construction | `onEnter`, `0x151a0c` | base entry, objective start, toss/timer/intro construction |
| replay | `GetReplayInstance`, `0x151eac` | creates a fresh GN layer |
| particle primitive | `AddParticle`, `0x151eca` | creates and attaches one delayed `ParticleExplosion` |
| choreography | `InitParticlesExplosion`, `0x151f74..0x1584ba` | 439 ordered direct `AddParticle` calls |
| gameplay start | `StartGame`, `0x1584bc` | music, controllers, timer, then particles |

GN derives the ordinary BaseGameplay/blade path, not `BaseBirdLayer`. It has no lives, bomb
controller, bonus controller, double controller, BirdBlade, or freeze-producing toss. Its
three controllers emit ordinary object type `0`.

### Construction, equal-z attachment, and intro

`onEnter` directly performs:

1. `BaseGameplayLayer::onEnter`.
2. `ObjectivesManager::ProcessGameEvent(6, 0)`.
3. Construct/attach Free, Wave, Concurrent in that order, each at z-order `1`.
4. Construct a 150-second `TimeManager` with Time Up and Time Up Finish callbacks.
5. Construct/start instruction actions in order `nobomb`, `gnstyle`, `nolive`.
6. Attach equal-z instruction cards in order `gnstyle`, `nobomb`, `nolive`.

The instruction cards use these exact actions:

| Card | Initial position | Action | Continuation |
|---|---|---|---|
| `Text/text-nobomb.png` | left minus half width, `y = 0.6H` | move center `0.25s`, delay `0.25s`, exit right `0.25s` | none |
| `Text/text-gnstyle.png` | right plus half width, center `y` | move center `0.25s`, delay `0.25s`, exit left `0.25s` | `TotalTimeCallback` |
| `Text/text-nolive.png` | left minus half width, `y = 0.4H` | move center `0.25s`, delay `0.25s`, exit right `0.25s` | none |

At `0.75s`, `TotalTimeCallback` creates `Text/text-150s.png`: enter from the left in
`0.35s`, hold `0.25s`, exit right in `0.35s`. At `1.70s`, its continuation creates
`Text/text-go.png`: enter in `0.325s`, hold `0.25s`, exit in `0.325s`, then call
`StartGame`.

Derived nominal timeline, excluding pause:

| Boundary | Seconds after `onEnter` |
|---|---:|
| instruction cards attached | `0.000` |
| 150-second card begins | `0.750` |
| GO begins | `1.700` |
| `StartGame` | `2.600` |
| timer reaches zero | `152.600` |
| Time Up Finish / Result | `155.600` |

Preserve the raw float32 values: `0.25 = 0x3e800000`, the 150s moves are
`0.3499999940395355 = 0x3eb33333`, and the GO moves are
`0.32499998807907104 = 0x3ea66666`. Native has no GN-specific input gate during this intro;
ordinary blade input remains active even though the toss controllers do not start until GO
completes.

### Toss graph

| Order | Controller | Object/direction | Outer interval | Additional arguments | Direct/derived note |
|---:|---|---|---|---|---|
| 1 | Free | object `0`, direction `0` | `0.5..3.0s` | none | direct |
| 2 | Wave | object `0`, direction `0` | `3.5..8.0s` | active window `1.5..6.0s`; child interval `0.25..0.75s` | direct; child interval is the existing shared Wave contract |
| 3 | Concurrent | object `0`, direction `0` | `3.0..9.0s` | constructor min `3`, max `6` | direct |

The existing shared Concurrent strategy calls the inclusive helper with `countMax + 1`.
Therefore constructor `3..6` is expected to yield actual inclusive `3..7`; mark this
**derived from the current recovered helper** and lock it with a focused GN config/coordinator
test rather than silently “correcting” it to `3..6`.

Creation, equal-z attachment, `StartGame` starts, and `TimeUp` outer stops all use
Free → Wave → Concurrent. At timer zero only the three outer timers stop. A previously armed
Wave child and its scheduled pause remain live during the three-second Time Up presentation.
Static native evidence does not establish engine ordering when a toss threshold and timer
expiry share an exact deadline. **Target decision:** preserve the current Cocos timed-mode
convention by advancing the GN toss coordinator before TimeManager. Keep that qualification in
the test name/report; it is deterministic target behavior, not a recovered native fact.

### Standard blade, score, and combo

GN retains BaseGameplay's standard four-touch blade path. Reuse `BladeInputController`,
standard blade/ray presenters, ordinary fruit entities/cut halves, `ScoreService`, and the
existing `ComboService`; do not route it through Bird input or create mode-specific scoring.

`GNStyleLayer::FruitCut` only forwards the supplied score. The shared ordinary path supplies
`1`, while the recovered critical branch supplies `10`. Eligible cuts also enter the focused
combo owner:

```text
each cut increments the cluster and stores its latest position
elapsed <= 0.25s keeps the cluster open
first update with elapsed > 0.25s:
  count >= 3 -> objective selector 0, combo item, add exactly count bonus score, reset
  count < 3  -> reset without bonus
```

Effects-enabled combo audio consumes the shared recovered audio-choice RNG draw; effects
disabled consumes no such draw. That RNG ordering precedes later toss/particle draws and must
continue using the process-owned `GameplayRandom`.

### `StartGame` and terminal ordering

`StartGame` directly orders:

1. stop existing background music with `releaseData = false`;
2. if `enable_music`, play `Sounds/GangnamStyle.mp3`, non-looping;
3. start Free;
4. start Wave;
5. start Concurrent;
6. start TimeManager;
7. run `InitParticlesExplosion`.

At timer zero:

1. stop Free, Wave, Concurrent outer timers;
2. process objective `(selector 6, payload 2)`;
3. enter TimeManager's three-second Time Up presentation.

Ordinary input, Physics2D, existing entities, score, and any pre-armed Wave child stay active
during those three seconds. `TimeUpFinish` samples the score only at the end, so a valid late
cut must affect the Result. It stops all shared effects, captures the parent, constructs
DisplayScore, sets mode `2`, sets the completed score, removes GN with cleanup, and attaches
Result at z-order `1`.

This is a material boundary: do not freeze score/input/physics at timer zero merely because the
outer toss producers stopped.

## Objectives and the DisplayScore Tail

### GN objectives

GN has two separate objective channels:

- selector `6` is the no-drop run objective: payload `0` on entry, `1` on either fail callback,
  and `2` at timer zero. Current `ObjectivesManagerState` maps this to recovered objective
  ID `48`.
- selector `2` is the completed GN score evaluation from DisplayScore. Current objective data
  maps the bundled descriptions `>500` and `>750` to IDs `42` and `43`, but the recovered
  comparison is `payload >= target`; scores exactly `500` and `750` succeed.

The success event `(6,2)` occurs before the three-second late-cut window. A later `(6,1)` cannot
revoke an already finished ID `48` because the recovered objective state treats a finished
objective as a no-op. Keep that behavior; do not invent an extra terminal guard.

### Exact native DisplayScore selector table and current audit

`DisplayScoreLayer::onEnter` at `0x14da0e..0x14da36` performs the final six-entry mode switch
after Result UI creation and `CCGestures` attachment/configuration:

| Mode | Native gameplay | Final selector | Pre-fix `32c6efd` | Current baseline `1c46d7e` |
|---:|---|---:|---|---|
| `0` | Classic | `1` | missing; Classic did not own an objective manager at Result | tail added after Result attach with an exact-once latch; leaderboard is still persisted before attach |
| `1` | Crazy | `3` | missing | added after leaderboard/session commit in the timed Result transaction |
| `2` | GN Style | `2` | mode absent | still pending; GN must consume the shared mapper |
| `3` | Classic Bird | `19` | wrong seam: called on ordinary, dragon, and combo score changes, so early/repeated | per-score calls removed; one Result-commit tail added |
| `4` | Crazy Bird | `20` | missing | added through the shared Crazy timed Result commit |
| `5` | Combo Bird | `21` | missing | added through the Combo Bird Result commit |

There was no true completed-Result tail duplicate in pre-fix `32c6efd`. The mode-3 bug was an
early/repeated substitute for the native tail. Adding a new mode-3 tail without deleting those
per-score calls would create duplicate/misordered evaluation and could advance more than one
compatible objective in a single run. Current baseline `1c46d7e` correctly deletes the early
calls.

The landed shared file `domain/recovered-result-objective.ts` maps:

```text
mode:      0  1  2   3   4   5
selector:  1  3  2  19  20  21
```

It also checks mode range and signed-int32 completed score. GN should import it; it should not
create another switch.

### Safest target transaction seam

For transactional modes, the one-time tail belongs in the transition participant's irreversible
commit, not inside `ClassicResultPresenter.attach()` and not in score mutation:

1. construct Result and a pure ranking preview while detached;
2. detach/suspend the old GN root;
3. attach Result and finish presenter/gesture setup;
4. `prepareCommit`;
5. commit the session to `result-removed`;
6. persist the GN leaderboard once;
7. publish `transaction.status = committed`, clear the pending transaction, and publish an
   `objectiveTailAttempted` latch;
8. call `createRecoveredResultObjectiveCommand(2, completedScore)` and process its selector;
9. clean up the retired GN run and publish diagnostics.

Steps 7–8 deliberately make a popup, preference write, or observer exception post-commit.
Such a failure may be reported and cleanup retried, but it must never reopen the old run or
replay selector `2` against the next current objective.

The current mode-0 implementation fixes selector timing but still mutates the Classic leaderboard before
Result attachment. An attachment failure therefore cannot restore its pre-Result persistence
boundary. That is shared technical debt, not a reason to weaken GN: GN should use the
Combo/Crazy provisional participant pattern from the start. Phase-06 closure should either
transactionalize Classic Result or explicitly accept that pre-existing leaderboard rollback
gap.

## Resources and External Dependencies

All directly required GN visual/audio/font files are already staged under
`game/assets/game` with `.meta` sidecars and are byte-identical (`cmp`) to the extracted
resource trees. The loader should expose only the contractually consumed supplement and reuse
the Classic/base/timer catalogs for shared assets.

### GN-specific presentation assets

| Canonical path | 480 dimensions | 720 dimensions | Use |
|---|---:|---:|---|
| `Text/text-nobomb.png` | `231x34` | `347x51` | first constructed instruction |
| `Text/text-gnstyle.png` | `342x43` | `512x64` | continuation-owning instruction |
| `Text/text-nolive.png` | `190x32` | `285x47` | third constructed instruction |
| `Text/text-150s.png` | `192x34` | `288x51` | duration card |
| `Text/text-go.png` | `70x31` | `106x47` | GO card; shared |
| `Sounds/GangnamStyle.mp3` | n/a | n/a | dedicated non-looping background track |

`Sounds/GangnamStyle.mp3` is `1,791,164` bytes with SHA-256
`00527f519dbed9df8eb046248557c75af46e52cc6a08dea9f9a00748fc7c2835`.
The existing forensic measurement is approximately `149.263667s`, 96 kb/s, 22050 Hz, mono.
Native starts it in the same callback as the 150-second timer and does not loop it. Its slightly
shorter encoded duration is not grounds to loop, seek, stretch, or restart the clip.

### Shared assets consumed

- Classic catalog: selected background/theme/blade, ordinary fruit, cuts, HUD, Result, rank
  audio, menu-button audio, and shared effects.
- Base gameplay resources: pause/objective presentation.
- TimeManager: `Text/text-time-up.png`, `Interfaces/object-time-freeze.png`,
  `Sounds/timetick.wav`, and `Sounds/timeup.wav`. GN has no freeze producer, but the shared
  TimeManager still owns the hidden freeze clock contract.
- `Fonts/MotorwerkOblique.ttf`.
- six particle sprites:
  `Blades/Particles/X-Mas/xmasfive.png`,
  `xmasfour.png`, `xmashexa.png`, `xmascircle.png`,
  `Blades/Particles/stars.png`, and
  `Blades/Particles/VN Flag/vnflagstar.png`.

`Leaderboard/leaderboard_gnstyle.png` exists in both extracted and staged resolution trees,
but no direct GN or DisplayScore call-site inspected here proves it is consumed. Do not load or
render it solely because its filename looks relevant. Resolve a direct consumer first.

Mode Select is already exact for GN:

```text
destination GNStyleLayer
card index/state 2
fruit ID 2 / fruit-strawberry.png
Interfaces/mode-gnstyle.png
Interfaces/object-combo-des.png
lock key mode_unlock_2
price 2500 coins
```

The `object-combo-des` mapping is recovered behavior, not a typo. No
`object-gnstyle-des.png` should be invented.

### Dependency and rights boundary

Production must remain Cocos Creator `3.8.8` plus the repository's existing
`@cocos/box2d` dependency. The extracted native library is evidence only; no runtime FFI,
binary embedding, emulator, or native-code dependency is allowed.

Publication rights for `GangnamStyle.mp3`, `MotorwerkOblique.ttf`, and the extracted visual
assets are not established by their presence in the APK. Rights/attribution/redistribution
clearance is an external release gate.

## Exact Particle Choreography Contract

### What the native code does

`InitParticlesExplosion` contains exactly 439 direct calls to:

```text
AddParticle(int, int, float, float, int, float, CCPoint,
            char const*, bool, bool)
```

The call order is the choreography. `AddParticle` scales its first two distance integers by
`widthScale`, scales its fifth count integer by `countScale`, constructs
`ParticleExplosion(int,int,float,float,int)`, sets its point, calls
`Create(path,startDelay,flagA,flagB)`, and attaches it at equal z-order `1`.

The native function overwrites both transient constructor defaults before the first row:

```text
widthScale = float32(frameWidth / 480.0)

if 720.0 <= frameWidth <= 1136.0:
    countScale = float32(0.45)
else:
    countScale = min(
      float32(float32(frameWidth * frameHeight) * 2^-20),
      float32(1.0)
    )

scaledMin   = truncTowardZero(minDistance * widthScale)
scaledMax   = truncTowardZero(maxDistance * widthScale)
scaledCount = truncTowardZero(particleCount * countScale)
```

Use `Math.fround` at the shown float32 boundaries and `Math.trunc` for all three integer
conversions.

Direct `ParticleExplosion` behavior:

- constructor stores movement distance min/max, truncates the duration-hundredths bounds to
  integers, and stores child count;
- `Create` stores the sprite path, start delay, and two flags;
- `onEnter` waits the start delay, calls `Explosion`, then removes the parent with cleanup after
  `2 * truncTowardZero(maxDurationHundredths) / 100` seconds;
- when `flagB` is true, one shared RGB triplet is sampled before the child loop;
- every child consumes draws in exact order: duration, x sign, x magnitude, y sign, y magnitude;
- duration hundredths convert to seconds;
- x/y signs use the recovered `nextInt(-1,1)` path, so an axis can receive a zero multiplier;
- when `flagA` is true, a fresh RGB triplet is sampled/applied per child; `flagB` then applies
  its shared RGB;
- every child enables rotation and scale-to-zero, disables auto-delete, and uses the sampled
  duration for movement, scale, and rotation actions;
- `flagA` and `flagB` retain opaque source names because their original semantic names are
  stripped, even though these observable branches are recovered;
- no recovered row sets both flags true.

This is not Cocos `ParticleSystem2D`. Substituting a generic emitter would change RNG draw order,
per-axis zero probability, color draws, scaling, delay, duration-derived cleanup, and equal-z ordering.
Implement the two raw flag branches from disassembly without assigning product semantics that
evidence does not provide.

The parallel native report's canonical table establishes:

| Family | Canonical path | Calls |
|---|---|---:|
| `F5` | `Blades/Particles/X-Mas/xmasfive.png` | `223` |
| `F4` | `Blades/Particles/X-Mas/xmasfour.png` | `128` |
| `ST` | `Blades/Particles/stars.png` | `32` |
| `VN` | `Blades/Particles/VN Flag/vnflagstar.png` | `30` |
| `HX` | `Blades/Particles/X-Mas/xmashexa.png` | `17` |
| `CI` | `Blades/Particles/X-Mas/xmascircle.png` | `9` |

Further integrity totals are 423 reusable-anchor points plus 16 directly constructed points;
flag pairs `(0,0) = 341`, `(1,0) = 64`, `(0,1) = 34`; delay range `3.0..146.5s`.
There are 25 source-order delay decreases, so sorting by delay is incorrect. Rows `428..437`
nominally clean up at gameplay `t=153.5`; rows `438..439` at `t=155.5`. These 12 roots remain
alive beyond Result replacement at gameplay `t=153.0` and are removed by GN layer cleanup;
do not force-clean them at timer zero.

### Required generated representation

Create:

```text
scripts/extract-gn-style-particle-choreography.mjs
forensics/native/gn-style-particle-choreography.json
game/assets/scripts/domain/gn-style-particle-choreography.generated.ts
game/assets/scripts/domain/gn-style-particle-choreography.generated.ts.meta
game/assets/scripts/domain/gn-style-particle-choreography.ts
game/assets/scripts/domain/gn-style-particle-choreography.ts.meta
game/assets/scripts/domain/gn-style-particle-explosion.ts
game/assets/scripts/domain/gn-style-particle-explosion.ts.meta
tests/extract-gn-style-particle-choreography-test.mjs
```

The evidence JSON row should retain:

```text
ordinal
callSite
raw integer arguments
raw float32 bit words
exact point/anchor ID and factor bit words
exact canonical path/family
raw flag values
```

The generated production table may replace repeated strings with a closed six-entry family ID
and may store compact exact tuples. It must still expand one-to-one to 439 rows in original
order. Keep call-site addresses in the evidence JSON rather than production if that makes the
runtime table smaller.

The extractor must pin:

```text
binary SHA-256:
  55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e
function bounds:
  [0x151f74, 0x1584ba)
expected calls:
  439
canonical CSV SHA-256:
  6c8dd814fb776e15507c2f42081b315bd410ea5b9a9156a4726c186504507c97
expected paths:
  the six closed families listed above
```

It must fail closed if a branch/argument cannot be resolved, the count is not 439, a path is
unknown, or the control-flow/literal pattern changes. The extractor test must compare evidence
JSON, the canonical CSV embedded in the native report, and generated tuples one-to-one for
ordinal, call site, raw bits, integers, point ID, path, and flags. Do not manually “clean up”
float values or compress runs unless the extractor itself proves lossless expansion and
identical ordering.

`gn-style-particle-choreography.ts` is only the typed/validated facade around generated data.
`gn-style-particle-explosion.ts` owns the exact pure random/dynamics state. One
`GnStyleParticlePresenter` iterates the 439 rows in order and owns every parent/child node and
cleanup. This is the smallest non-copy-pasted split that keeps evidence generation outside the
runtime and behavior testable without Creator.

The recovered rows exist in the native report, but standalone evidence JSON and generated
TypeScript do not yet exist. Runtime particle implementation is blocked until that promotion
and verification gate passes.

## Ownership Boundary

| Owner | Lifetime | Responsibilities |
|---|---|---|
| `ClassicGameplayController` and shared services | process | process RNG, Classic/base catalogs, selected theme/background/blade, shared effects/background audio, result resources |
| `ClassicSettingsRuntime/State` | process | flags, coins, unlocks, objectives, six leaderboards including new GN board |
| `RecoveredAppShellController` | process | one current screen, mode preparation/readiness, route transactions, non-game collision filter |
| `BladeInputController` | scene/shared | four-slot ordinary blade event source; exactly one standard-mode activation |
| `GnStyleGameplayController` prepared resources | scene/process-prepared | GN raster supplement, dedicated music clip/source, timer audio resources; no active run state |
| `GnStyleSceneController` | one GN run | `GnStyleSession`, toss coordinator, ordinary input lease, Classic Physics2D lease, expiry-frame tick order, transition participant |
| `GnStyleGameplayController` run ownership | one GN run | detached/current GN root, fruit/score/combo/blade/HUD, intro, timer, particle presenter, pause, objectives, result transition, retired cleanup |
| generated particle table | immutable build artifact | exact 439 ordered rows only |

Prepared assets may survive retry because they are immutable. Active audio voices, timers,
actions, particles, input, physics, entity registry, score, and screen roots may not.

Independent GN work owns only `gn-style-*` files and their tests. Shared files
(`classic-settings-state`, timer audio extraction, Mode Select, app shell, scene, and the
Result-objective mapper) require serialized ownership and should not be edited concurrently
with another mode worker.

## Production Integration Map

### Preparation ordering and failure isolation

Current app-shell preparation intentionally serializes the first access to the Creator game
bundle:

```text
Classic
  -> Crazy settles
  -> Classic Bird attempts and settles
  -> Crazy Bird attempts and settles
  -> Combo Bird attempts and settles
```

Append GN after Combo Bird settles. “Settles” is important: an earlier optional-mode rejection
must not skip the GN attempt. Use a success/failure continuation or equivalent settled promise,
catch GN independently, and include its promise in the final `Promise.all`. The dependency is
bundle-registry serialization, not semantic dependency between modes.

Target readiness rules:

- Classic failure remains fatal to the recovered shell because it owns shared catalogs/services.
- Crazy, Classic Bird, Crazy Bird, Combo Bird, and GN each record their own preparation error
  and become a fail-closed destination.
- A GN-only resource/audio failure leaves Main Menu, Mode Select, and all other prepared modes
  usable.
- Selecting unprepared GN rejects/rearms the Mode Select transaction without detaching the
  current screen.
- A stale completion after component destruction cannot publish GN readiness.

`GnStyleGameplayController.prepareGnStyleRuntime()` should:

1. await the preceding settled preparation boundary supplied by the shell;
2. load/validate the GN supplement;
3. load the shared extracted TimeManager audio adapter;
4. load the dedicated GN music presenter with `loop = false`;
5. retain immutable resources only after all loads succeed;
6. dispose partially created sources/nodes on failure;
7. publish `prepared` or the stable preparation error.

Do not construct a run, acquire input/physics, start music, or attach particle nodes during
preparation.

### Mode Select contract

Change `ModeSelectUnsupportedDestination` so it also excludes `'GNStyleLayer'`. Add:

```text
onGnStyleRequested(transaction)
```

to the lifecycle port and dispatch `'GNStyleLayer'` before the unsupported fallback. Existing
card state, resources, lock purchase, sound, 0.75-second delayed callback, and no-debounce
behavior remain unchanged.

The app shell adds state `'gn-style'`, imports/requires the GN gameplay controller, pairs all GN
event subscriptions/unsubscriptions, and provides `transitionModeSelectToGnStyle`.

### Mode Select → GN transaction

Clone the proven Combo Bird transaction shape, with ordinary input:

1. validate current shell state, presenter/root identity, destination
   `'GNStyleLayer'`, and GN readiness;
2. accept the Mode Select transition callback exactly once;
3. detach the Mode Select root but retain it for compensation;
4. suspend/release Mode Select ordinary-blade input completely;
5. release the shell's non-gameplay collision suppression so GN can acquire
   Classic-compatible variable Physics2D;
6. construct the GN foreground detached;
7. attach it as the one current screen and initialize pause UI only now;
8. activate the fresh GN session, physics, then input;
9. commit state `'gn-style'`;
10. dispose the old Mode Select presenter/root.

If any pre-commit step fails:

1. quiesce/destroy the partial GN foreground;
2. release any GN input/physics/audio/timer/particle ownership acquired so far;
3. restore the non-gameplay collision filter;
4. reattach the retained Mode Select root;
5. reacquire Mode Select input and rearm its navigation transaction;
6. verify Mode Select is current and GN has no live owner.

If compensation cannot prove that exact boundary, throw/retain a
`ModeSelectFatalNavigationError` (or the app shell's equivalent fatal capture). Do not leave two
screens or guess which input/physics owner won. A `GnStyleLifecycleRollbackError` is likewise a
fatal GN lifecycle, not an ordinary unsupported-route rejection.

### Input and Physics2D leases

GN uses the existing standard `BladeInputController`, which currently exposes a boolean
Classic-layer activation rather than an owner token. The minimal integration does **not**
broaden that public contract across every standard mode.

Instead:

- `GnStyleSceneController` keeps a private `inputLeaseActive` flag;
- activation begins only after the preceding owner has synchronously completed release;
- suspend/detach/finalize are idempotent and finish release before a fresh owner can activate;
- retired cleanup is not allowed to call standard input deactivation after a new run is active;
- executable retry/rollback tests prove a stale old-run cleanup cannot deactivate the new run.

If that test exposes an unavoidable shared stale-release race, stop and make an owner-token
migration a separate shared prerequisite for **all** ordinary-input callers. Do not patch only
GN with an incompatible token convention.

`GnStyleSceneController` owns a fresh `ClassicPhysicsAdapter` per serialized controller/run
owner, starts variable simulation with identity delta, and restores the prior Physics2D state
on suspension, detach, failure, and destruction. It must keep an explicit
`physicsLeaseActive/restorePending` state like Combo Bird's scene controller. A failed restore
poisons the run; a second run cannot activate over an unresolved lease.

The shell's non-gameplay collision filter and GN's gameplay physics lease are two sides of the
same route transaction. Fault tests must inject failure on both acquisition and restoration.

### Session, intro, and gameplay start

`GnStyleSession` should follow Combo Bird's pure lifecycle/command style with GN-specific
identity and ordinary blade:

```text
constructed
-> intro-instructions
-> intro-150
-> intro-go
-> running
-> time-up-presentation
-> result-transition
-> result-removed
```

Its activity snapshot should explicitly keep entities/input/physics/score active in
`time-up-presentation`, with only outer toss controllers inactive. It should expose:

- mode `2`;
- no lives/bombs/bonus/double/freeze producer/BirdBlade;
- 150-second TimeManager;
- selector-6 objective commands;
- ordered controller construction/attach/start/outer-stop commands;
- score forwarding and late-cut behavior;
- result construction/mode/score/remove/attach commands.

`GnStyleIntroPresenter` constructs all cards/actions while the GN root is detached, but actions
start only after the root is current. It preserves different construction and attachment
orders and assigns the continuation only to the GN Style card. Pause UI also initializes only
after the root is attached/current; this is an explicit regression guard from the Combo Bird
Preview work.

Before the irreversible `StartGame` sequence, prepare and validate all three toss strategies,
TimeManager, dedicated music, and all 439 particle rows/nodes in a non-running state. Commit in
native order:

```text
stop shared background
play GN music if enabled
start Free
start Wave
start Concurrent
start TimeManager
attach/start the 439 prepared particle parents in table order
```

If a commit step throws before the run is published active, compensate every prior step in
reverse and keep the old screen route recoverable. Particle action clocks must begin only at
their native `InitParticlesExplosion` boundary, not during preparation.

### TimeManager, pause, and audio leases

Use the existing `TimeManagerService`/`TimeManagerPresenter` with total `150.0`. Each active
frame must tick:

```text
GN toss coordinator (including pending Wave pause and Wave child)
then TimeManager
```

That ordering permits a toss at the expiry boundary before outer-stop commands are delivered.
TimeManager's existing three-second Time Up presentation owns `text-time-up`, tick/time-up
effects, and the hidden freeze state. GN never issues freeze start/finish.

Combo Bird currently embeds a private `ComboBirdTimerAudioPresenter` that implements the
generic `TimeManagerAudioPort`. Extract it without behavioral changes to:

```text
game/assets/scripts/creator/time-manager-audio-presenter.ts
game/assets/scripts/creator/time-manager-audio-presenter.ts.meta
```

Rename the public class `TimeManagerAudioPresenter`; update Combo Bird to import it, then use it
from GN. This is a proven second consumer, not a speculative abstraction.

Add `GnStyleBackgroundMusicPresenter` with one dedicated `AudioSource` and the exact staged
clip. It owns only the GN track:

- start: first stop the shared Main Menu/background channel, then play once if music enabled;
- pause: pause the GN source when music is enabled;
- resume: resume the same source when music is enabled. Native BaseGameplay resumes background
  only when `GetGameMode() == 2`, so this behavior is GN-specific;
- disabling music while paused or running stops/quiesces the source rather than leaving a
  hidden voice;
- Time Up: do not loop or restart; allow natural completion;
- retry, pause-Quit commit, Result-Menu commit, destruction, and failed activation: stop
  idempotently.

The target uses a dedicated AudioSource whereas native used one background channel. Enforce the
same mutual exclusion transactionally: shared background and GN music may never be playing
together. Shared effects and TimeManager effects remain on the existing effects path, with
pause/resume/stop ownership aggregated into the GN run cleanup.

### Result, leaderboard, rewards, and Settings

Create the GN wrapper around `recovered-result-ranking` with:

```text
mode                    2
keys                    gnstyle_best_1
                        gnstyle_best_2
                        gnstyle_best_3
initial scores          0, 0, 0
coin factor             Math.fround(0.6)
ranking comparison      recovered >= tie behavior
coin arithmetic         float32 multiply, truncation toward zero, signed-int32 wrap
```

The Result uses the shared recovered presenter/resources and a pure leaderboard preview while
detached. Persist the leaderboard once only in the participant commit described above. Result
reward accounting stays at the shared Result presentation callback boundary and adjusts total
coins with the GN `0.6` wrapper.

Add the GN board to `ClassicSettingsState` as a process-owned getter/value and add:

```text
recordGnStyleResultScore(score)
awardGnStyleResultCoins(score)
```

Preserve the recovered relative implemented load/save order:

```text
Classic
Crazy
GN Style
Bird Classic
Bird Crazy
Bird Combo
```

All three GN keys default to zero. Use the existing preference port and load-failure write
barrier. `ClassicSettingsRuntime` needs no new persistence mechanism; only its tests should
exercise the extended state through `load`/`save` unless implementation reveals a type surface
that actually requires forwarding.

At Time Up Finish, use the provisional participant and objective-tail sequence above. Result
Retry and Result Menu preserve the native callback absences:

```text
no save call
no delay
no scene reload/replacement
no RNG reseed
no shared-state reset
no stop-effects command in the navigation command list
```

Cleanup still stops GN's dedicated active voice because the target split it from native's
single background channel. This is ownership cleanup, not a change to the recovered navigation
command list.

Retry:

1. capture Result parent;
2. construct a fresh mode-2 GN owner detached;
3. fully quiesce/release old run ownership;
4. attach/activate the fresh run at z `1`;
5. only then destroy Result/retired owners.

If fresh activation fails, restore Result as the sole current screen. If old release is
incomplete, do not activate fresh input/physics/music.

Pause Quit and Result Menu use the app shell's GN → Main Menu transaction:

1. validate request generation, current state, and root identity;
2. acquire/restore the non-game collision filter;
3. construct/attach/activate Main Menu;
4. commit the producer and shell state;
5. stop GN music and finalize GN only after commit.

On pre-commit failure, destroy the partial menu, restore the GN root, restore its physics/input
and paused/running state, restore audio consistently, call producer rollback, and verify GN is
the sole current screen. Incomplete compensation remains a fatal shell capture.

## Serialized Scene Components

At this report's baseline, `game/assets/scenes/classic.scene` has 28 serialized objects. Canvas
component references are:

```text
[5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26, 27, 20]
```

Object `20` is `RecoveredAppShellController` and deliberately remains last.

Create the two source files and let Cocos Creator generate their `.meta` UUIDs. Never invent,
copy, or hand-derive compressed `__type__` strings:

```text
game/assets/scripts/creator/gn-style-scene-controller.ts
game/assets/scripts/creator/gn-style-scene-controller.ts.meta
game/assets/scripts/creator/gn-style-gameplay-controller.ts
game/assets/scripts/creator/gn-style-gameplay-controller.ts.meta
```

At the unchanged 28-object baseline, append serialized component objects `28` and `29` and set:

```text
Canvas._components =
  [5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26, 27, 28, 29, 20]

object 28 = generated type for GnStyleSceneController, node __id__ 2
object 29 = generated type for GnStyleGameplayController, node __id__ 2
```

If another scene edit lands first, recompute the numeric append indices but preserve semantic
order `GnStyleSceneController`, `GnStyleGameplayController`, `RecoveredAppShellController`.
The post-import integration test must resolve type strings from the actual `.meta` UUIDs and
prove each component occurs once.

Required decorators:

```text
GnStyleSceneController
  @requireComponent(BladeInputController)

GnStyleGameplayController
  @requireComponent(GnStyleSceneController)
  @requireComponent(BladeInputController)
  @requireComponent(ClassicGameplayController)
  @requireComponent(ClassicSceneController)

RecoveredAppShellController
  @requireComponent(GnStyleGameplayController)
```

The gameplay controller's explicit shared requirements make the scene contract auditable even
though some are transitively required elsewhere.

## Exact File Map

### New domain files

Every TypeScript file receives a Creator-generated adjacent `.ts.meta`:

| File | Narrow responsibility |
|---|---|
| `game/assets/scripts/domain/gn-style-toss-config.ts` | mode ID, three exact rows, orders, intervals/count quirk |
| `game/assets/scripts/domain/gn-style-toss-coordinator.ts` | reuse Classic Free/Wave/Concurrent strategies; pending Wave pause; coordinator-first ticks |
| `game/assets/scripts/domain/gn-style-intro-presentation.ts` | exact card resources, construction/attachment order, positions, float32 durations |
| `game/assets/scripts/domain/gn-style-particle-choreography.generated.ts` | generated compact 439-row immutable table |
| `game/assets/scripts/domain/gn-style-particle-choreography.ts` | closed family types, validation, typed generated facade |
| `game/assets/scripts/domain/gn-style-particle-explosion.ts` | exact pure per-parent/per-child RNG and lifetime commands |
| `game/assets/scripts/domain/gn-style-resource-contract.ts` | GN supplement paths/dimensions/resolution validation |
| `game/assets/scripts/domain/gn-style-result-ranking.ts` | keys, mode 2, rank/coin wrappers, factor 0.6 |
| `game/assets/scripts/domain/gn-style-result-navigation.ts` | retry/menu command ordering and explicit absences |
| `game/assets/scripts/domain/gn-style-session.ts` | one-run lifecycle, score, objective/timer/result command ordering |

Do not create a GN-specific score, combo, random, fruit registry, TimeManager, objective
manager, result presenter, blade-input, or physics abstraction.

### New Creator files

Every TypeScript file receives a Creator-generated adjacent `.ts.meta`:

| File | Narrow responsibility |
|---|---|
| `game/assets/scripts/creator/gn-style-resource-loader.ts` | load and validate only GN supplement/dedicated music |
| `game/assets/scripts/creator/gn-style-intro-presenter.ts` | exact two-stage intro actions and continuation |
| `game/assets/scripts/creator/gn-style-particle-presenter.ts` | ordered 439-parent/child node ownership and cleanup |
| `game/assets/scripts/creator/gn-style-background-music-presenter.ts` | dedicated non-looping GN music lease |
| `game/assets/scripts/creator/gn-style-scene-controller.ts` | session/coordinator/input/physics/result-participant owner |
| `game/assets/scripts/creator/gn-style-gameplay-controller.ts` | preparation, presenters, pause, objective, result, retry/menu producer |
| `game/assets/scripts/creator/time-manager-audio-presenter.ts` | extracted existing generic TimeManager audio adapter |

### New forensic/support files

```text
forensics/contracts/gn-style-mode-contract.md
forensics/native/gn-style-particle-choreography.json
scripts/extract-gn-style-particle-choreography.mjs
tests/extract-gn-style-particle-choreography-test.mjs
```

The mode contract should record the pinned addresses/hash, exact intro/toss/start/terminal
order, and generated-artifact procedure. It should not duplicate all implementation detail.

### Existing production files to modify

| File | Change |
|---|---|
| `game/assets/scripts/domain/classic-settings-state.ts` | imports/exports GN rank contract; GN board/default/load/save/getter/record/reward in recovered relative order |
| `game/assets/scripts/creator/combo-bird-gameplay-controller.ts` | remove private timer-audio class; import shared `TimeManagerAudioPresenter`; no behavioral change |
| `game/assets/scripts/creator/mode-select-presenter.ts` | supported GN lifecycle callback and dispatch before unsupported fallback |
| `game/assets/scripts/creator/recovered-app-shell-controller.ts` | serialized requirement, preparation/readiness, state, subscriptions, Mode Select entry, pause/result menu exit, rollback/fatal handling |
| `game/assets/scenes/classic.scene` | serialize exactly the two GN components before shell |

Landed shared prerequisite to consume, not recreate:

```text
game/assets/scripts/domain/recovered-result-objective.ts
game/assets/scripts/domain/recovered-result-objective.ts.meta
```

No production changes are expected in:

```text
game/assets/scripts/domain/mode-select-state.ts
game/assets/scripts/domain/mode-select-resource-contract.ts
game/assets/scripts/creator/blade-input-controller.ts
game/assets/scripts/creator/classic-settings-runtime.ts
game/assets/scripts/creator/time-manager-presenter.ts
game/assets/scripts/creator/classic-physics-adapter.ts
```

Change one only if a failing executable contract proves the current seam cannot express GN,
and document the broadened shared scope first.

### Focused new test files

```text
tests/reconstruction/vertical-slice/gn-style-toss-config.test.ts
tests/reconstruction/vertical-slice/gn-style-toss-coordinator.test.ts
tests/reconstruction/vertical-slice/gn-style-intro-presentation.test.ts
tests/reconstruction/vertical-slice/gn-style-particle-choreography.test.ts
tests/reconstruction/vertical-slice/gn-style-particle-explosion.test.ts
tests/reconstruction/vertical-slice/gn-style-resource-contract.test.ts
tests/reconstruction/vertical-slice/gn-style-result-ranking.test.ts
tests/reconstruction/vertical-slice/gn-style-result-navigation.test.ts
tests/reconstruction/vertical-slice/gn-style-session.test.ts
tests/reconstruction/vertical-slice/gn-style-resource-loader.test.ts
tests/reconstruction/vertical-slice/gn-style-intro-presenter.test.ts
tests/reconstruction/vertical-slice/gn-style-particle-presenter.test.ts
tests/reconstruction/vertical-slice/gn-style-background-music-presenter.test.ts
tests/reconstruction/vertical-slice/gn-style-scene-controller.test.ts
tests/reconstruction/vertical-slice/gn-style-gameplay-controller.test.ts
tests/reconstruction/vertical-slice/gn-style-retry-lifecycle-executable.test.ts
tests/reconstruction/vertical-slice/gn-style-result-menu-lifecycle-executable.test.ts
```

Existing tests to extend:

```text
tests/reconstruction/vertical-slice/classic-settings-state.test.ts
tests/reconstruction/vertical-slice/classic-settings-runtime.test.ts
tests/reconstruction/vertical-slice/combo-bird-gameplay-controller.test.ts
tests/reconstruction/vertical-slice/mode-select-presenter.test.ts
tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts
tests/reconstruction/vertical-slice/recovered-result-objective.test.ts
tests/reconstruction/vertical-slice/time-manager-presenter.test.ts
tests/reconstruction/vertical-slice/creator-scene-integration.test.ts
```

## Bounded Implementation Plan and File Ownership

Do not parallelize edits to the scene, shell, Settings, Combo Bird controller, or generated
particle artifact. Parallelism is safe only across the ownership groups below after their
inputs are committed.

### Gate 0 — Freeze evidence and generate choreography

Owner:

```text
scripts/extract-gn-style-particle-choreography.mjs
forensics/contracts/gn-style-mode-contract.md
forensics/native/gn-style-particle-choreography.json
game/assets/scripts/domain/gn-style-particle-choreography.generated.ts
tests/extract-gn-style-particle-choreography-test.mjs
```

Work:

1. Pin binary hash/function bounds.
2. Decode all direct calls and literals without heuristic defaults.
3. Emit evidence JSON and compact generated TypeScript.
4. Prove exactly 439 one-to-one rows, six paths, raw-bit fidelity, and stable order.

Acceptance:

- extractor is deterministic and fails closed;
- second run produces no diff;
- test detects row deletion/reorder/float canonicalization/path/flag change;
- no runtime code depends on `.forensics-work`.

This gate blocks particle/runtime work if incomplete.

### Gate 1 — Land shared prerequisites

Single shared owner:

```text
game/assets/scripts/domain/recovered-result-objective.ts(.meta)
game/assets/scripts/domain/classic-settings-state.ts
game/assets/scripts/creator/time-manager-audio-presenter.ts(.meta)
game/assets/scripts/creator/combo-bird-gameplay-controller.ts
their focused tests
```

Work:

1. Verify the landed six-mode tail mapper and modes 0/1/3/4/5 call-site fixes.
2. Resolve/record Classic's pre-attachment leaderboard mutation separately.
3. Add GN leaderboard state/load/save/reward.
4. Extract the existing Timer audio presenter and prove Combo Bird behavior unchanged.

Acceptance:

- selector table `[1,3,2,19,20,21]`;
- modes 0/1/3/4/5 each attempt one completed-Result tail;
- no mode-3 score-change calls remain;
- GN keys load/save between Crazy and Bird Classic;
- Combo Bird focused tests are unchanged semantically.

### Phase 2 — Pure GN domain

Domain owner:

```text
all new game/assets/scripts/domain/gn-style-*.ts except the generated file from Gate 0
matching .meta files
new pure domain tests
```

Work:

1. Config and coordinator over existing Classic strategies.
2. Intro contract and exact timeline.
3. Particle facade and exact explosion dynamics.
4. Resource/ranking/navigation contracts.
5. Session lifecycle and command order.

Acceptance:

- no `cc` imports;
- float32/int32 behavior explicit;
- same-frame coordinator-before-timer test passes;
- Time Up keeps late cuts/input/physics/entities and Wave child;
- Result score sampled at finish;
- objective `(6,0/1/2)` and final selector `2` remain separate;
- ranking factor exactly float32 `0.6`.

### Phase 3 — GN Creator adapters

Creator owner:

```text
all new game/assets/scripts/creator/gn-style-*.ts
matching .meta files
new GN adapter/controller/lifecycle tests
```

Work:

1. Resource loader, intro, exact particle presenter, and music lease.
2. Passive scene controller with input/physics/result participant.
3. Gameplay controller with detached construction, Timer, pause, objectives, Result, retry/menu
   producer, and retired cleanup.

Acceptance:

- prepare has no active-run side effects;
- one current screen, one ordinary-input lease, one Physics2D lease;
- no shared/GN background overlap;
- music is non-looping and resumes after pause;
- particle attach/start order has 439 rows exactly;
- any partial activation cleans up or becomes explicitly fatal;
- Result attach failure leaves leaderboard/objective untouched and restores GN;
- post-commit objective failure cannot replay.

### Phase 4 — Shared route and serialization

Single integration owner:

```text
game/assets/scripts/creator/mode-select-presenter.ts
game/assets/scripts/creator/recovered-app-shell-controller.ts
game/assets/scenes/classic.scene
their existing integration tests
```

Work:

1. Append settled GN preparation.
2. Add supported Mode Select callback and shell state/routes.
3. Subscribe/unsubscribe pause/result navigation events.
4. Serialize GN scene then gameplay before shell.
5. Exercise route compensation and fatal capture.

Acceptance:

- GN-only preparation failure does not block other modes;
- earlier optional failure does not prevent GN preparation attempt;
- locked/unlocked mode-2 card enters GN after recovered delay;
- rollback restores exact Mode Select or GN boundary;
- scene has exactly one of each GN component with meta-derived types;
- shell is still the last Canvas component.

### Phase 5 — Broad verification and Preview

Run focused tests first, then shared regressions, then all vertical-slice/static tests and
Creator Browser Preview. Do not add a production debug timer to avoid waiting 150 seconds.
Unit/controller tests may inject a deterministic TimeManager port to reach boundaries quickly;
Preview validates the actual 150-second duration.

Docs impact: major for the restoration phase contract and architecture. Update phase status,
system architecture/roadmap/changelog only after behavior and Preview are actually verified,
following existing project documentation requirements.

## Executable Test and Fault Matrix

| Boundary/fault | Injection | Required observable result |
|---|---|---|
| particle extraction | delete/reorder one call; mutate float bit/path/flag; wrong binary hash | extractor/test fails closed; no generated runtime artifact accepted |
| toss config | boundary RNG values | exact Free/Wave/Concurrent intervals and derived Concurrent `3..7` behavior |
| expiry frame | Wave/outer timer and TimeManager expire same frame | coordinator command occurs first; then outer stops; pre-armed Wave child remains |
| intro | advance at `0.749/0.750`, `1.699/1.700`, `2.599/2.600` | exact card transitions and one `StartGame` continuation |
| preparation | fail GN raster, timer sound, or music load independently | GN fail-closed; all earlier modes remain usable; no run/audio/node lease |
| preparation chain | reject Crazy/Bird/Combo optional prep before GN | GN preparation is still attempted after predecessor settles |
| Mode Select request | request GN while unprepared or stale transaction | request rejected/rearmed; Mode Select remains sole current screen |
| Mode Select detach | fail old-root detach | no GN owner starts; old route remains current |
| GN root attach | fail attachment or pause-UI initialization | partial root destroyed; input/physics/music/particles zero; Mode Select restored |
| input acquire/release | throw on standard input transition | compensate exact previous owner or mark fatal; never two active standard inputs |
| stale retired cleanup | release old run after fresh retry activation | fresh input remains active; executable owner-count assertion remains one |
| Physics2D acquire | fail after root attach | GN unwinds; non-game filter and Mode Select restore |
| Physics2D restore | fail during rollback/retry/menu | lifecycle marked fatal; fresh gameplay/menu not activated over unresolved lease |
| gameplay start | fail at each of music/Free/Wave/Concurrent/timer/particle row `k` | reverse compensation leaves no running timer/controller/voice/particle |
| audio mutual exclusion | shared background playing on GN start | shared stops before GN play; never overlap |
| pause/resume | pause mid-track/mid-timer, then resume | timer/actions/physics/effects pause; the same GN source resumes; no second source |
| music setting | disable/re-enable across pause | no hidden/duplicate voice; obey current setting without looping/restarting ended clip |
| Time Up | cut during three-second presentation | score changes and final Result uses late score; no new outer toss after stop |
| Time Up particle teardown | inspect roots at gameplay `t=153.0` and commit Result | 12 long-duration roots remain before transition and are removed with the GN layer |
| objective 6 | fail before zero, success at zero, fail after success | payload order exact; finished ID48 not revoked |
| Result construction | throw before/during Result attach | GN root/session/leases restored; no GN leaderboard or selector-2 mutation |
| Result prepare | fail participant validation | attached provisional Result rolls back; old GN resumes |
| leaderboard commit | preference write throws | transaction follows explicit commit-failure policy; objective tail not dispatched before persistence boundary |
| objective tail | popup observer or objective preference throws | Result remains committed; attempt latch stays set; retry/menu never replay selector `2` |
| Result cleanup | old GN presenter/entity/particle cleanup throws | Result remains sole current screen; retired cleanup retained and diagnostic reported |
| retry | fail old-run quiesce | fresh GN not activated |
| retry | fail fresh attach/activation | Result restored as sole current screen; no duplicate music/input/physics/particles |
| Result Menu | fail Main Menu construction/attach/activate | Result restored; GN remains inactive; navigation rearmed |
| Pause Quit | fail Main Menu transaction at each step | paused/running GN root and leases restored exactly or shell fatal |
| scene serialization | missing/duplicate/wrong-order component or fabricated type | integration test fails using actual meta UUIDs |
| route repetition | Mode Select → GN → Retry → Pause Quit → GN → Result Menu | one screen/input/physics/music owner at every checkpoint; cleanup backlogs zero |

Use existing explicit ports and instrumented test doubles to inject failures. Assertions should
inspect public snapshots/event logs and owner counts, not merely search source strings.

Focused command:

```sh
node --test \
  tests/reconstruction/vertical-slice/gn-style-*.test.ts \
  tests/reconstruction/vertical-slice/recovered-result-objective.test.ts \
  tests/reconstruction/vertical-slice/time-manager-*.test.ts \
  tests/reconstruction/vertical-slice/classic-settings-*.test.ts \
  tests/reconstruction/vertical-slice/mode-select-*.test.ts \
  tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts \
  tests/reconstruction/vertical-slice/creator-scene-integration.test.ts
```

Shared regression and broad gates:

```sh
node --test tests/reconstruction/vertical-slice/combo-bird-*.test.ts
node --test tests/reconstruction/vertical-slice/*.test.ts
node --test tests/*.mjs
tsc -p game/tsconfig.json --pretty false --noEmit
```

If the repository's installed Node does not support TypeScript stripping, use the same pinned
runner already established by the current vertical-slice reports; do not change source syntax
or weaken tests to accommodate an older ad hoc runner.

## Creator 3.8.8 Browser Preview Path

Open `game/assets/scenes/classic.scene` in Creator `3.8.8` and use Browser Preview:

1. Main Menu → Mode Select.
2. Navigate to card index `2`.
3. If locked, verify the existing 2500-coin unlock/cut flow and retry the selection.
4. Cut/select GN and verify the recovered 0.75-second delayed route.
5. Verify instruction construction/visual crossing:
   no-bomb, GN Style, no-live; then 150s; then GO.
6. At gameplay start verify countdown begins at `2:30`, Gangnam track plays once/non-looping,
   the ordinary blade works, and all three toss families begin in recovered order.
7. Observe particle families and ordering against deterministic test capture; Preview is a
   visual sanity check, not the source of the 439-row contract.
8. Pause during music/gameplay. Verify timer, actions, physics, effects, and track pause; Resume
   continues the same track and timer.
9. Retry and verify a fresh `2:30` run with no old particle/action/music/input/physics owner.
10. Pause → Quit and verify Main Menu is sole current screen with background restored and GN
    music stopped.
11. Re-enter GN and allow the production 150-second timer to expire. Verify outer tosses stop,
    a valid cut during the three-second Time Up still changes score, and Result shows that final
    score.
12. Exercise Result Retry, then a second natural Result → Result Menu.

At every transition inspect the existing diagnostics/snapshots:

```text
retired cleanup backlog       0
pending navigation            0
pending result transaction    0
fatal lifecycle captures      0
current screens               1
active ordinary inputs        1 in GN, otherwise the current screen's expected owner
active gameplay physics       1 in GN, 0 on menu/result
GN music sources playing      0 or 1, never overlapping shared background
```

Also check both 480x800 and 720x1280 logical layouts. Intro positions and particle coordinates
must use the recovered resolution adapter rather than device-pixel guesses.

## Acceptance Criteria

GN Style is complete only when:

- card index `2` routes to a prepared mode-2 run and retains its recovered lock/purchase contract;
- intro/start/toss/timer/objective/result orders match the direct native contract;
- the production particle table is generated from the pinned native function and contains
  exactly 439 verified rows in original order;
- the exact particle dynamics across all six sprite families are reproduced without a generic
  emitter substitution;
- timer starts at 150 seconds after the 2.60-second intro and preserves the three-second
  late-cut window;
- Gangnam music plays once, does not loop, resumes after GN pause, and never overlaps the
  shared background channel;
- Settings persists `gnstyle_best_1..3` in recovered relative order and reward factor is
  float32 `0.6`;
- DisplayScore selector `2` is attempted once after irreversible Result commit, and modes
  0/1/3/4/5 retain their exact one-tail behavior;
- retry, pause Quit, Result Menu, and every tested rollback leave one current screen and no
  stale input/physics/audio/particle owner;
- focused, shared regression, broad static/type gates, and Creator Browser Preview pass;
- release rights for extracted music/font/art are resolved.

## Unresolved Questions and Gates

1. **Particle rows are not yet standalone artifacts.** All 439 canonical CSV rows are recovered
   in the native report, but the required evidence JSON/generated TypeScript and independent
   extractor verification do not yet exist.
2. **`leaderboard_gnstyle.png` consumer is unproven.** Keep it staged but unloaded until a
   direct native/Result contract demonstrates use.
3. **Classic mode-0 Result persists ranking before attachment.** Current baseline `1c46d7e`
   adds the correct exact-once selector-1 tail, but a Result-attachment failure still leaves a
   ranking mutation. Decide whether phase-06 closure includes transactionalizing this shared
   legacy seam.
4. **Rights clearance is external.** APK presence does not establish permission to ship
   `GangnamStyle.mp3`, the font, or extracted artwork.

No product-choice question blocks the architecture. Question 1 is an evidence-artifact gate;
question 3 is a shared quality-scope decision; question 4 is a release gate.

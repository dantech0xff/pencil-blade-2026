# GN Style static native implementation contract

Date: 2026-07-24
Scope: static native/resource audit only; no APK, shared-library, emulator, or reconstructed runtime execution
Native artifact: `.forensics-work/phase-01/native/libgame.so`
SHA-256: `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`

## Contract verdict

GN Style is native mode ID `2`. It is a 150-second ordinary-fruit mode on the standard
four-touch blade path. It is not a Bird mode and not a Crazy special-fruit variant.

A faithful implementation needs:

- three ordinary type-`0` toss controllers: Free, Wave, then Concurrent;
- the standard `PhysicsBladeLayer`/`BasicBlade` cut, combo, score, and audio seams;
- the exact three-stage `NO BOMB / GN STYLE / NO LIVE` -> `150s` -> `GO` introduction;
- non-looping `Sounds/GangnamStyle.mp3`, started only when music is enabled;
- a `150.0f` `TimeManager` followed by the shared three-second TIME UP presentation;
- objective selector `6` for no-drop lifecycle and selector `2` at committed Result entry;
- GN best-score keys, mode-2 retry/navigation, and float32 `0.6` result reward;
- all 439 direct particle-emitter calls in their recovered source order.

The static evidence is sufficient to implement and unit-test all of those behaviors. The
native random algorithm/seed, exact equal-deadline scheduler ordering, original source names
for the two `ParticleExplosion::Create` booleans, and a direct consumer for
`leaderboard_gnstyle.png` remain unknown. The booleans' observable color behavior is recovered.

## Evidence and confidence

Primary evidence:

- `forensics/native/function-map.csv`;
- `.forensics-work/phase-02/native/app-function-inventory.csv`;
- `.forensics-work/phase-02/native/function-inventory.csv`;
- `.forensics-work/phase-02/native/symbols/functions-demangled.txt`;
- `.forensics-work/phase-02/native/strings/all-offsets.txt`;
- ARM EABI5 Thumb disassembly of the addresses cited below;
- `forensics/contracts/classic-cut-score-contract.md`;
- `forensics/contracts/classic-toss-contract.md`;
- `forensics/contracts/classic-presentation-contract.md`;
- `forensics/contracts/mode-select-presentation-contract.md`;
- `forensics/native/java-jni-boundary.md`;
- extracted assets under `.forensics-work/phase-01/jadx/resources/assets/`;
- staged assets under `game/assets/game/`;
- `plans/260721-2253-pencil-blade-restoration/phase-06-recreate-full-game-content-and-progression.md`;
- `plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-23-remaining-mode-order.md`.

Confidence labels:

- **[RECOVERED]**: immediate, literal, symbol, branch, resource, callback, or direct call
  ordering is visible in static evidence.
- **[INFERRED]**: semantic field name or engine-default behavior is inferred from a shared
  component rather than named by the stripped binary.
- **[UNKNOWN]**: static evidence does not establish the behavior.

The 439-call table was recovered by statically interpreting the Thumb instructions from
`0x001522a0` through the return at `0x00158478`. The interpreter followed 10,309 reachable
instructions, skipped 22 literal-pool branches, modeled all 439 `AddParticle` calls, 423
`CCPoint` copies, 16 dynamic `CCPoint` constructions, 22 float multiplies, and 10
`VisibleRect::center` calls, and encountered zero unsupported reachable opcodes. This is
disassembly interpretation, not native execution.

## Native identity and object graph

| Surface | Address | Exact contract |
|---|---:|---|
| mode | `GNStyleLayer::GetGameMode` `0x0015166c` | returns `2` |
| intro callback 1 | `TotalTimeCallback` `0x00151830` | creates `text-150s.png` |
| intro callback 2 | `GoCallback` `0x00151728` | creates `text-go.png` |
| gameplay start | `StartGameCallback` `0x001584bc` | audio, three toss starts, timer start, particle initialization |
| expiry | `TimeUpCallback` `0x001519ac` | stops three toss controllers, posts `(6,2)` |
| result transition | `TimeUpFinishCallback` `0x00151938` | reads score, removes gameplay, adds mode-2 Result |
| fruit miss | `FruitFail` `0x001519ee` | posts `(6,1)` |
| bonus miss | `BonusFruitFail` `0x001519e2` | posts `(6,1)` |
| fruit cut | `FruitCut` `0x001519fa` | adds supplied score |
| entry | `onEnter` `0x00151a0c`, 1,080 bytes | builds the complete stopped runtime and intro |
| constructor | `0x00151e44` | initializes GN-owned slots |
| replay factory | `GetReplayInstance` `0x00151eac` | allocates a fresh 700-byte GN layer |
| emitter helper | `AddParticle` `0x00151eca`, 168 bytes | scales and creates one emitter |
| choreography | `InitParticlesExplosion` `0x00151f74`, 25,926 bytes | 439 ordered helper calls |

**[RECOVERED]** Class chain:

```text
GNStyleLayer
  -> BaseGameplayLayer
     -> PhysicsBladeLayer
        -> PhysicsLayer
           -> cocos2d::CCLayer
```

The GN constructor directly invokes `BaseGameplayLayer` and retains its default standard-blade
initialization. It does not derive from `BaseBirdLayer`.

**[RECOVERED]** GN-owned instance slots:

| Offset | Value |
|---:|---|
| `+0x2a4` | particle-count/resolution factor |
| `+0x2a8` | width factor `W / 480` |
| `+0x2ac` | `FreeToss*` |
| `+0x2b0` | `WaveToss*` |
| `+0x2b4` | `ConcurrentToss*` |
| `+0x2b8` | `TimeManager*` |

The constructor zeros the four component pointers. Its initial `+0x2a4 = 0.65f` and
`+0x2a8 = 1.0f` are transient; `InitParticlesExplosion` overwrites both before adding any
emitters.

## Lifecycle state machine and exact order

### Entry and introduction

`GNStyleLayer::onEnter` performs:

1. **[RECOVERED]** call `BaseGameplayLayer::onEnter`;
2. **[RECOVERED]** call `ObjectivesManager::ProcessGameEvent(6, 0)`;
3. **[RECOVERED]** create, attach at z-order `1`, and leave stopped: Free, Wave, Concurrent;
4. **[RECOVERED]** create and attach at z-order `1` a `TimeManager` with total
   `150.0f` (`0x43160000`), expiry callback `0x001519ad`, and finish callback
   `0x00151939`;
5. **[RECOVERED]** load `Settings::GNStyleBest_1` into the score manager's comparison baseline;
6. **[RECOVERED]** construct/start instruction actions in order NO BOMB, GN STYLE, NO LIVE;
7. **[RECOVERED]** attach the equal-z sprites in order GN STYLE, NO BOMB, NO LIVE.

Initial sprite actions:

| Resource | Initial position | Sequence | Completion |
|---|---|---|---|
| `Text/text-nobomb.png` | left minus half sprite width, `0.6H` | center -> hold -> right plus half width; `0.25 + 0.25 + 0.25` | none |
| `Text/text-gnstyle.png` | right plus half sprite width, center Y | center -> hold -> left minus half width; `0.25 + 0.25 + 0.25` | `TotalTimeCallback` |
| `Text/text-nolive.png` | left minus half sprite width, `0.4H` | center -> hold -> right plus half width; `0.25 + 0.25 + 0.25` | none |

`TotalTimeCallback` creates `Text/text-150s.png`, using left -> center -> right and the same
offscreen-by-half-width geometry. Its moves are each float32
`0.3499999940395355` (`0x3eb33333`) and its hold is `0.25`
(`0x3e800000`): nominal duration `0.95`. Its completion calls `GoCallback`.

`GoCallback` creates `Text/text-go.png`, again using left -> center -> right and the same
geometry. Its moves are each float32 `0.32499998807907104` (`0x3ea66666`) and its hold is
`0.25`: nominal duration `0.90`. Its completion calls `StartGameCallback`.

The exact nominal entry-to-start duration is therefore `0.75 + 0.95 + 0.90 = 2.60`
scheduler seconds. The initial `0.25` is synthesized as `0xfa << 22` at
`0x00151b7e...0x00151da2`; the `150s` move literal is at `0x00151930`; the GO move literal is
at `0x00151828`. This resolves the earlier architecture draft's `2.55` claim: it incorrectly
applied GO's `0.325` move duration to the `150s` card, whose native duration is `0.35`.

Pause can extend wall-clock time. **[RECOVERED]** There is no GN-specific cut-disable or input
gate during the intro; no toss controller is started until GO completes, so normally there are
no targets to cut.

The callback pointers are also directly present in the writable relocation area:

| GOT address | Callback |
|---:|---|
| `0x004774a0` | `StartGameCallback` `0x001584bd` |
| `0x004774a4` | `GoCallback` `0x00151729` |
| `0x004774a8` | `TimeUpCallback` `0x001519ad` |
| `0x004774ac` | `TimeUpFinishCallback` `0x00151939` |
| `0x004774b0` | `TotalTimeCallback` `0x00151831` |

### GO and active play

`StartGameCallback` has this exact synchronous order:

1. **[RECOVERED]** stop background music with release-data flag `false`;
2. **[RECOVERED]** when `Settings::EnableMusic` is true, play
   `Sounds/GangnamStyle.mp3` as non-looping background music;
3. **[RECOVERED]** start Free;
4. **[RECOVERED]** start Wave;
5. **[RECOVERED]** start Concurrent;
6. **[RECOVERED]** start `TimeManager`;
7. **[RECOVERED]** call `InitParticlesExplosion`.

Every toss `Start` samples a threshold. The three calls above are part of the shared RNG order.
Particle emitters are constructed synchronously after those samples, but their particle draws
occur only when their delayed explosion callbacks run.

### Expiry, TIME UP, and Result

At the first `TimeManager` update whose remaining time reaches `<= 0`:

1. **[RECOVERED]** `TimeManager` stops its update;
2. **[RECOVERED]** it invokes `GNStyleLayer::TimeUpCallback` immediately;
3. **[RECOVERED]** GN stops Free, Wave, then Concurrent;
4. **[RECOVERED]** GN calls `ProcessGameEvent(6, 2)`;
5. **[RECOVERED]** `TimeManager` creates `Text/text-time-up.png`;
6. **[RECOVERED]** TIME UP moves left -> center for `1.0`, delays `1.0`, then moves
   center -> right for `1.0`;
7. **[RECOVERED]** the action completion invokes `TimeManager`'s finish callback, which invokes
   `GNStyleLayer::TimeUpFinishCallback`.

`TimeUpFinishCallback`:

1. stops all effects;
2. obtains the parent;
3. creates `DisplayScoreLayer`;
4. sets mode `2`;
5. reads the score manager's authoritative completed score;
6. removes GN gameplay from its parent with cleanup;
7. attaches Result at z-order `1`.

The result transition is nominally `153.0` scheduler seconds after GO and `155.60` seconds
after entry.

**Production-significant recovered quirk:** GN does not call `DisableCut`, stop the physics
world, or remove existing fruit at timer expiry. The score is read three seconds later in the
finish callback. Existing airborne fruit can therefore still be cut and scored during the TIME
UP presentation. Fruit that misses after `(6,2)` also cannot retroactively disqualify a no-drop
objective that just completed. Freezing gameplay at `t=150` would be a deliberate behavior
change, not a native recovery.

## Toss, spawn, and entity contract

All three controllers use object type `0`, direction Up `0`. There are no bomb, bonus,
special-fruit, Dragon, magnet, electric, double-score, or lives/fail-manager components in the
GN graph.

| Start order / slot | Controller | Outer interval | Extra constructor inputs |
|---:|---|---|---|
| 1 / `+0x2ac` | Free | `[0.5, 3.0]` | one ordinary toss |
| 2 / `+0x2b0` | Wave | `[3.5, 8.0]` | active window `[1.5, 6.0]`; child Free `[0.25, 0.75]` |
| 3 / `+0x2b4` | Concurrent | `[3.0, 9.0]` | constructor counts `(3, 6)` |

Under the recovered ten-step interval sampler, the reachable threshold grids are:

- Free: `0.5 ... 2.75`, step `0.25`;
- Wave outer: `3.5 ... 7.55`, step `0.45`;
- Wave active window: `1.5 ... 5.55`, step `0.45`;
- Wave child: `0.25 ... 0.70`, step `0.05`;
- Concurrent: `3.0 ... 8.4`, step `0.6`.

The Concurrent count helper makes constructor `(3,6)` produce actual counts `3...7`, matching
the existing shared reconstruction contract. The Wave child starts and pauses during entry,
so it consumes its initial threshold sample before GO. Its elapsed/threshold state survives
pause and resume. Stopping the Wave outer controller at time-up does not cancel an already
armed child or its pending pause; that child can remain live during the three-second TIME UP
presentation.

Type `0` uses the shared ordinary-fruit vector:

```text
[0, 1, 6, 5, 7, 4, 2, 3, 8]
```

It then runs the shared critical-selection branch, whose critical test is nominally one
inclusive `nextInt(0,24) == 0` outcome. Preserve shared toss rearm-before-turn RNG ordering,
strict `elapsed > threshold`, discarded overshoot, spawn kinematics, physics registration,
fruit toss audio, and entity cleanup from `forensics/contracts/classic-toss-contract.md`.

## Standard input, blade, score, and combo

**[RECOVERED]** `BaseGameplayLayer::onEnter` enters the standard `PhysicsBladeLayer` path.
The default initialization creates the selected standard blade set, focuses each blade's
`ComboManager` on the current `ScoreManager`, and registers the four-touch began/moved/ended
handlers. GN never constructs a `BirdBlade`.

Implementation consequence: reuse `BladeInputController`, the standard blade presenters/ray
adapter, the ordinary fruit cut-half/physics path, and the shared score HUD. Do not route GN
through `BirdBladeState`, Bird input, or a one-touch blade.

`GNStyleLayer::FruitCut` at `0x001519fa` only forwards the supplied score to
`ScoreManager::AddScore`. Ordinary cuts supply `1`; the shared critical branch supplies `10`.
There is no GN fruit-ID switch and no special side effect.

Eligible fruits also reach the focused shared `ComboManager`:

- every eligible cut increments the rolling cluster and stores its latest position;
- the cluster remains open while elapsed difference is `<= 0.25` seconds;
- on the first update beyond `0.25`, count `>= 3` performs
  `ProcessGameEvent(0,count)` -> create combo item -> add exactly `count` bonus score ->
  attach item -> conditionally draw/play combo sound -> reset;
- counts below `3` reset without bonus.

The combo bonus is additional to each fruit's own score. Effects-enabled combo audio consumes
one shared `nextInt(1,3)` draw; effects-disabled combo completion consumes no audio draw.
GN has no double-score state.

Both `FruitFail` and `BonusFruitFail` call only `ProcessGameEvent(6,1)`. They do not subtract
score, add a strike, stop controllers, or terminate the run.

## Objectives contract

GN owns two objective paths:

| When | Selector/payload | Active objective IDs | Exact behavior |
|---|---|---|---|
| entry | `(6,0)` | ID `48`, `No fruits drop Gangnam Style` | reset stored value to `0` |
| each ordinary/bonus miss | `(6,1)` | ID `48` | increment stored value |
| timer expiry | `(6,2)` | ID `48` | finish only when stored value is still `0` |
| committed Result entry | `(2, completedScore)` | ID `42` (`>=500`) or ID `43` (`>=750`) | finish when score reaches target |

The bundled descriptions say `Score > 500` and `Score > 750`, but the recovered shared
achievement comparison is `payload >= target`. Tests must use `500` and `750` as successful
boundary values.

The selector-2 call does not belong in `TimeUpFinishCallback`. `DisplayScoreLayer::onEnter`
dispatches it after Result attachment has committed. Its six-mode jump table is
`[1,3,2,19,20,21]`; mode `2` selects `2`. The current
`domain/recovered-result-objective.ts` is the correct shared seam. Execute the command exactly
once after a successful Result commit, never before a rollback-capable attachment.

## Pause, Replay, Retry, and Main Menu

GN inherits the shared `BaseGameplayLayer` pause contract:

- Pause ingress runs for `0.25` scheduler seconds, then pauses the director.
- When effects are enabled, pause requests both effects presenters to pause.
- When music is enabled, pause requests background-music pause.
- Resume resumes the director and effects. The native music-resume branch runs only when
  `GetGameMode() == 2`, so GN's song resumes; this is the one mode for which the asymmetric
  shared branch is effective.

Pause Replay:

1. stop background music with release-data flag `false`;
2. stop all effects;
3. resume the director and clear old pause actions;
4. remove the old layer with cleanup;
5. call virtual `GetReplayInstance`;
6. attach a fresh GN layer at z-order `1`;
7. request the click effect when effects are enabled.

Pause Quit resumes the director, removes the old gameplay layer, and attaches a fresh
`MainMenuLayer` at z-order `1`, then requests the click effect when enabled. It has no direct
background-music stop or effects stop in that callback.

Result Retry (`DisplayScoreLayer::RetryCallback` `0x0014cbb0`) requests click when enabled,
removes Result, dispatches mode `2` to a fresh `GNStyleLayer`, and attaches it at z-order `1`.
Result Menu creates a fresh `MainMenuLayer`.

The native callbacks do not immediately persist settings on Replay, Retry, or Menu. Ranking,
coins, and objective sequence state remain process state until a later bulk settings save.
The reconstruction should retain the current transactional rollback/error-boundary pattern even
though native Cocos replacement itself was not transactional.

## Result, ranking, reward, settings, and progression

`onEnter` loads `Settings::GNStyleBest_1` as the score comparison baseline. The native
settings fields and Android preference keys are:

| Rank | Native field address | Preference key |
|---:|---:|---|
| 1 | `0x0048242c` | `gnstyle_best_1` |
| 2 | `0x00482428` | `gnstyle_best_2` |
| 3 | `0x00482424` | `gnstyle_best_3` |

Shared Result insertion uses inclusive comparisons:

- `score >= first`: new rank 1, shift old first/second down;
- else `score >= second`: new rank 2, shift old second down;
- else `score >= third`: new rank 3;
- ties therefore promote.

`DisplayScoreLayer::getSavedBestScore` mode `2` reads GN best 1. Result reward uses exact
float32 factor `0.6f`: convert score to float32, multiply in float32, truncate toward zero to
signed int32, then add with signed int32 semantics to total coins. The shared Result accounting
occurs at its recovered presentation callback, not at GN expiry.

The Mode Select contract is already recovered:

- card index/mode `2`;
- strawberry fruit ID `2`;
- `Interfaces/mode-gnstyle.png`;
- deliberate native description mismatch `Interfaces/object-combo-des.png`;
- initially locked unless `mode_unlock_2` is true;
- effects-enabled selection requests strawberry cut audio before
  `Sounds/gameplayselected.wav`.

Current code still treats `GNStyleLayer` as unsupported at the application-shell boundary.
Implementation must add a distinct `'gn-style'` shell state, controller/scene ownership,
preparation and activation rollback, result/pause menu events, and the mode-select destination
transaction. It must also extend `ClassicSettingsState` with GN rank read/update and
float32-`0.6` reward methods rather than aliasing Classic keys.

### Leaderboard asset limit

`Leaderboard/leaderboard_gnstyle.png` exists in both extracted trees:

| Profile | Dimensions | SHA-256 |
|---|---:|---|
| `480x800` | `466x115` | `a8150f9fbca4b3824a684515db8b4e42808e212d4f988151b84e233e2a35a2d0` |
| `720x1280` | `663x138` | `c0ca921ff65d80d6cc0e6c011614e79cbd7f6b50153a9e7f181fdfa0f919c2a5` |

**[UNKNOWN]** Static inspection has not proven a direct native consumer for this raster. It is
a catalog/leaderboard candidate, not a mandatory GN gameplay or generic Result dependency.
Do not invent an online leaderboard or display location from the filename.

## Audio contract

Direct GN-owned audio:

| Event | Native behavior |
|---|---|
| GO completion | stop current background music, release-data `false` |
| GO completion, music enabled | play `Sounds/GangnamStyle.mp3`, loop `false` |
| final result callback | stop all effects |

The extracted MP3 is 96 kb/s, 22.05 kHz mono, approximately `149.263667` seconds, SHA-256
`00527f519dbed9df8eb046248557c75af46e52cc6a08dea9f9a00748fc7c2835`.
The gameplay timer is 150 seconds, so the non-looping file ends about `0.736333` seconds before
timer expiry. No native loop or automatic restart was recovered.

Shared audio remains active:

- ordinary fruit toss and fruit-ID cut clips;
- critical cut clip;
- standard blade swoosh selection;
- combo clips with the conditional RNG draw described above;
- `Sounds/timetick.wav` in the final countdown;
- `Sounds/timeup.wav` at expiry;
- click effects on pause/result navigation;
- objective/result audio only where their shared presenters already recover a direct consumer.

Do not assign `Sounds/scorescreen.wav` merely because it exists; the shared Result audit found
no direct `DisplayScoreLayer::onEnter` request.

The name/recording/music and visual assets require provenance, trademark, and public-release
rights review. The recovered behavior is technically implementable but the MP3 is a release
blocker until cleared or replaced under an explicitly approved equivalence policy.

## Particle helper and resolution policy

Native signature:

```text
GNStyleLayer::AddParticle(
  int minDistance,
  int maxDistance,
  float minDurationHundredths,
  float maxDurationHundredths,
  int particleCount,
  float delaySeconds,
  CCPoint position,
  char const* texturePath,
  bool createFlagA,
  bool createFlagB
)
```

`AddParticle` performs:

```text
scaledMin   = truncTowardZero(minDistance * widthScale)
scaledMax   = truncTowardZero(maxDistance * widthScale)
scaledCount = truncTowardZero(particleCount * countScale)
root = ParticleExplosion(
  scaledMin,
  scaledMax,
  minDurationHundredths,
  maxDurationHundredths,
  scaledCount
)
root.position = position
root.Create(texturePath, delaySeconds, createFlagA, createFlagB)
addChild(root, z = 1)
```

`ParticleExplosion` converts the random duration hundredths to seconds. At each explosion,
every particle consumes duration, X sign, X magnitude, Y sign, and Y magnitude draws in the
shared order. Each root schedules:

```text
Delay(delaySeconds)
-> synchronous Explosion
-> Delay(2 * trunc(maxDurationHundredths) / 100)
-> remove root with cleanup
```

This dynamic cleanup is direct in `ParticleExplosion::onEnter`
`0x0015fe5a...0x0015fe6e`: it loads the stored upper integer at `+0x100`, doubles it,
converts to float, and divides by `100.0f` (`0x42c80000` at `0x0015fea0`). The previously
reported fixed `1.4` was only true for an emitter whose upper duration is `70`.

`flagA` and `flagB` retain opaque source names, but their observable behavior is recovered:

- `flagB` samples one shared RGB triplet before the child loop;
- every child samples its duration, X sign/magnitude, and Y sign/magnitude;
- `flagA` samples and applies a fresh RGB triplet per child;
- `flagB` then applies its shared RGB, overwriting a per-child color if both are true while
  retaining the earlier RNG draws;
- every child enables rotation and scale-to-zero, and disables auto-delete;
- the sampled duration controls movement, scale-to-zero, and rotation action duration.

No GN row uses `(true,true)`.

### Width and count scales

**[RECOVERED]**

```text
widthScale = float32(frameWidth / 480.0)

if 720.0 <= frameWidth <= 1136.0:
    countScale = float32(0.45)
else:
    countScale = min(
      float32(float32(frameWidth * frameHeight) * 2^-20),
      float32(1.0)
    )
```

Use `Math.fround` at the float32 boundaries and `Math.trunc` for the three scaled integer
arguments. Do not retain constructor `0.65` or initialization `0.25`; both are overwritten
before the first emitter call.

### Point IDs

The 15 reusable anchors are a 3-by-5 grid. Each point is `(xFactor*W, yFactor*H)`:

| Rows | Y factor | Left | Center | Right |
|---|---:|---|---|---|
| `A01 A02 A03` | `0.8125` | `0.105` | `0.5` | `0.895` |
| `A04 A05 A06` | `0.625` | `0.105` | `0.5` | `0.895` |
| `A07 A08 A09` | `0.4375` | `0.105` | `0.5` | `0.895` |
| `A10 A11 A12` | `0.25` | `0.105` | `0.5` | `0.895` |
| `A13 A14 A15` | `0.0625` | `0.105` | `0.5` | `0.895` |

Float32 X bits are `0x3dd70a3d`, `0x3f000000`, and `0x3f651eb8`.

The 16 direct points, in construction order, are:

| ID | X factor | Y factor / bits |
|---|---:|---:|
| `D01` | `0.5` | `0.84375` |
| `D02` | `0.5` | `0.2815000116825104` / `0x3e9020c5` |
| `D03` | `0.5` | `0.46875` |
| `D04` | `0.5` | `0.65625` |
| `D05` | `0.5` | `0.48124998807907104` / `0x3ef66666` |
| `D06` | `0.5` | `0.65625` |
| `D07` | `0.25` | `0.9375` |
| `D08` | `0.25` | `0.9375` |
| `D09` | `0.105` | `0.28125` |
| `D10` | `0.895` | `0.28125` |
| `D11` | `0.5` | `0.46875` |
| `D12` | `0.5` | `0.65625` |
| `D13` | `0.5` | `0.48124998807907104` / `0x3ef66666` |
| `D14` | `0.5` | `0.65625` |
| `D15` | `0.25` | `0.9375` |
| `D16` | `0.25` | `0.9375` |

### Choreography integrity

Texture aliases in the table:

| Alias | Canonical path | Calls |
|---|---|---:|
| `F5` | `Blades/Particles/X-Mas/xmasfive.png` | 223 |
| `F4` | `Blades/Particles/X-Mas/xmasfour.png` | 128 |
| `ST` | `Blades/Particles/stars.png` | 32 |
| `VN` | `Blades/Particles/VN Flag/vnflagstar.png` | 30 |
| `HX` | `Blades/Particles/X-Mas/xmashexa.png` | 17 |
| `CI` | `Blades/Particles/X-Mas/xmascircle.png` | 9 |

Other recovered invariants:

- `439` calls total; `423` use reusable anchors and `16` use direct points;
- boolean pairs: `(0,0)` 341, `(1,0)` 64, `(0,1)` 34;
- base `minDistance`: `50` in 437 calls and `150` in 2;
- base `maxDistance`: `300` x184, `250` x69, `150` x69, `100` x58,
  `350` x33, `400` x10, `200` x9, `450` x7;
- base particle count: `35` x145, `25` x123, `50` x117, `75` x27,
  `100` x25, `57` x2;
- delay range: `3.0` through `146.5` seconds;
- source order has 25 delay decreases and 159 adjacent equal delays, so sorting by delay is
  incorrect;
- last explosion is at nominal gameplay `t=146.5`; its upper duration is `450`, so its
  nominal root cleanup is `t=155.5`;
- 12 rows have nominal cleanup after gameplay `t=153` Result replacement: rows `428...437`
  at `153.5`, and rows `438...439` at `155.5`; native gameplay-layer removal cleans these
  remaining roots before their own dispose callbacks;
- all 439 roots are synchronously created and attached at GO before their delayed callbacks.

The canonical CSV has 439 data rows, 25,896 bytes including header/final newline, and SHA-256:

```text
6c8dd814fb776e15507c2f42081b315bd410ea5b9a9156a4726c186504507c97
```

`minDurBits`, `maxDurBits`, and `delayBits` are raw big-endian-readable hexadecimal renderings
of the little-endian IEEE-754 float32 words. Decode them as float32; do not round decimal
delays. `pc` is the direct `AddParticle` call-site address without a `0x` prefix.

```csv
i,pc,minD,maxD,minDurBits,maxDurBits,count,delayBits,point,path,flagA,flagB
1,1522d8,50,300,42480000,43160000,50,40400000,A08,F5,0,0
2,15230e,50,300,42480000,43160000,50,40400000,A01,ST,0,1
3,152340,50,300,42480000,43160000,50,40400000,A03,ST,0,1
4,152372,50,300,42480000,43160000,50,40400000,A13,ST,0,1
5,1523a4,50,300,42480000,43160000,50,40400000,A15,ST,0,1
6,1523d6,50,300,42480000,43160000,50,41240000,A08,VN,0,0
7,152404,50,300,42480000,43160000,50,4124cccd,A02,VN,0,0
8,152434,50,300,42480000,43160000,50,4124cccd,A07,VN,0,0
9,152462,50,300,42480000,43160000,50,4124cccd,A14,VN,0,0
10,152492,50,300,42480000,43160000,50,4124cccd,A09,VN,0,0
11,1524c6,50,300,42480000,43160000,50,41180000,A01,HX,0,0
12,1524fa,50,300,42480000,43160000,50,410c0000,A03,F4,0,0
13,15252a,50,300,42480000,43160000,50,41140000,A13,F5,0,0
14,15255e,50,300,42480000,43160000,50,411c0000,A15,CI,0,0
15,15258c,50,300,42480000,43160000,50,41c80000,A08,HX,0,0
16,1525bc,50,300,42480000,43160000,50,41b80000,A02,VN,0,1
17,1525ee,50,300,42480000,43160000,50,41bc0000,A07,VN,0,1
18,15261e,50,300,42480000,43160000,50,41c00000,A14,VN,0,1
19,152650,50,300,42480000,43160000,50,41c40000,A09,VN,0,1
20,152680,50,300,42480000,43160000,50,41c80000,A01,HX,0,0
21,15270e,50,300,42480000,43160000,50,41c80000,A03,F4,0,0
22,15273e,50,300,42480000,43160000,50,41c80000,A13,F5,0,0
23,15276e,50,300,42480000,43160000,50,41c80000,A15,CI,0,0
24,1527a0,50,300,42480000,43160000,50,42150000,A05,ST,1,0
25,1527d2,50,300,42480000,43160000,50,4215999a,A11,ST,1,0
26,152804,50,300,42480000,43160000,50,42163333,A07,ST,1,0
27,152836,50,300,42480000,43160000,50,4216999a,A09,ST,1,0
28,152864,50,300,42480000,43160000,50,42180000,A04,HX,0,0
29,152892,50,300,42480000,43160000,50,42180000,A06,F4,0,0
30,1528c0,50,300,42480000,43160000,50,42180000,A10,F5,0,0
31,1528ee,50,300,42480000,43160000,50,42180000,A12,CI,0,0
32,15291c,50,300,42480000,43160000,50,421e0000,A02,VN,0,0
33,15294c,50,300,42480000,43160000,50,421e0000,A07,VN,0,0
34,15297a,50,300,42480000,43160000,50,421e0000,A14,VN,0,0
35,1529aa,50,300,42480000,43160000,50,421e0000,A09,VN,0,0
36,1529d8,50,300,42480000,43160000,50,421e0000,A08,HX,0,0
37,152a08,50,300,42480000,43160000,50,42210000,A01,HX,0,0
38,152a38,50,300,42480000,43160000,50,421f0000,A03,F4,0,0
39,152a68,50,300,42480000,43160000,50,42200000,A13,F5,0,0
40,152a98,50,300,42480000,43160000,50,42220000,A15,CI,0,0
41,152ac8,50,300,42480000,43160000,50,42230000,A08,VN,1,0
42,152b50,50,300,42480000,43160000,50,42230000,A05,ST,1,0
43,152b82,50,300,42480000,43160000,50,42230000,A07,ST,1,0
44,152bb4,50,300,42480000,43160000,50,42230000,A09,ST,1,0
45,152be6,50,300,42480000,43160000,50,42230000,A11,ST,1,0
46,152c16,50,300,42480000,43160000,50,42260000,A01,F5,0,0
47,152c46,50,300,42480000,43160000,50,42260000,A03,F5,0,0
48,152c74,50,300,42480000,43160000,50,42270000,A04,F5,0,0
49,152ca2,50,300,42480000,43160000,50,42270000,A06,F5,0,0
50,152cd2,50,300,42480000,43160000,50,42280000,A07,F5,0,0
51,152d02,50,300,42480000,43160000,50,42280000,A09,F5,0,0
52,152d30,50,300,42480000,43160000,50,42290000,A10,F5,0,0
53,152d5e,50,300,42480000,43160000,50,42290000,A12,F5,0,0
54,152d8e,50,300,42480000,43160000,50,422a0000,A13,F5,0,0
55,152dbe,50,300,42480000,43160000,50,422a0000,A15,F5,0,0
56,152dec,50,300,42480000,43160000,50,422c0000,A14,F5,0,0
57,152e1c,50,300,42480000,43160000,50,422d0000,A11,F5,0,0
58,152e4a,50,300,42480000,43160000,50,422e3333,A08,F5,0,0
59,152e7a,50,300,42480000,43160000,50,422f0000,A05,F5,0,0
60,152eba,50,300,42480000,43160000,50,42300000,D01,F5,0,0
61,152ee8,50,300,42480000,43160000,50,42310000,A02,F5,0,0
62,152f18,50,300,42480000,43160000,50,42320000,A01,F4,0,0
63,152fa4,50,300,42480000,43160000,50,42320000,A02,VN,0,0
64,152fd4,50,300,42480000,43160000,50,42320000,A03,F4,0,0
65,153004,50,300,42480000,43160000,50,42340000,A15,F5,0,0
66,153034,50,300,42480000,43160000,50,42340000,A13,F5,0,0
67,153062,50,300,42480000,43160000,50,42350000,A10,F5,0,0
68,153090,50,300,42480000,43160000,50,42350000,A12,F5,0,0
69,1530c0,50,300,42480000,43160000,50,42360000,A07,F5,0,0
70,1530f4,50,300,42480000,43160000,50,42360000,A09,F5,0,0
71,153122,50,300,42480000,43160000,50,42370000,A04,F5,0,0
72,153154,50,300,42480000,43160000,50,42370000,A06,F5,0,0
73,153184,50,300,42480000,43160000,50,42380000,A01,F5,0,0
74,1531b4,50,300,42480000,43160000,50,42380000,A03,F5,0,0
75,1531e2,50,300,42480000,43160000,50,42390000,A02,F5,0,0
76,153216,50,300,42480000,43160000,50,423a0000,A05,F5,0,0
77,153244,50,300,42480000,43160000,50,423b0000,A08,F5,0,0
78,153274,50,300,42480000,43160000,50,423c0000,A11,F5,0,0
79,1532b8,50,300,41c80000,42960000,50,423d0000,D02,CI,0,0
80,1532e6,50,300,41c80000,42960000,50,423e0000,A14,CI,0,0
81,15331a,50,300,42480000,43160000,50,423f0000,A13,F4,0,0
82,15334c,50,300,42480000,43160000,50,423f0000,A14,VN,0,0
83,15337c,50,300,42480000,43160000,50,423f0000,A15,F4,0,0
84,153426,50,300,42480000,43160000,50,42400000,A01,F4,0,0
85,153454,50,300,42480000,43160000,50,42400000,A02,VN,0,0
86,153484,50,300,42480000,43160000,50,42400000,A03,F4,0,0
87,1534b4,50,300,42480000,43160000,35,42420000,A10,F4,0,0
88,1534e4,50,300,42480000,43160000,35,42440000,A06,F4,0,0
89,153514,50,300,42480000,43160000,35,42460000,A12,F4,0,0
90,153544,50,300,42480000,43160000,35,42480000,A04,F4,0,0
91,153574,50,300,42480000,43160000,35,424c0000,A08,VN,0,0
92,1535ae,50,300,42480000,43160000,35,424a0000,A05,ST,0,1
93,1535e2,50,300,42480000,43160000,35,424a0000,A07,ST,0,1
94,153616,50,300,42480000,43160000,35,424a0000,A09,ST,0,1
95,15364a,50,300,42480000,43160000,35,424a0000,A11,ST,0,1
96,15367e,50,300,42480000,43160000,35,424b0000,A01,F4,0,1
97,1536b2,50,300,42480000,43160000,35,424b0000,A15,F4,0,1
98,1536e6,50,300,42480000,43160000,35,424b0000,A03,F4,0,1
99,15371a,50,300,42480000,43160000,35,424b0000,A13,F4,0,1
100,15374a,50,300,42480000,43160000,35,424c0000,A03,F4,0,0
101,15377c,50,300,42480000,43160000,35,424d0000,A02,F4,0,0
102,1537ae,50,300,42480000,43160000,35,424e0000,A01,F4,0,0
103,1537e2,50,300,42480000,43160000,35,424f0000,A04,F4,0,0
104,153814,50,300,42480000,43160000,35,42500000,A07,F4,0,0
105,15389c,50,300,42480000,43160000,35,42510000,A10,F4,0,0
106,1538ce,50,300,42480000,43160000,35,42520000,A11,F4,0,0
107,153918,50,300,42480000,43160000,35,42530000,D03,F4,0,0
108,15394e,50,400,42c80000,43480000,100,42540000,A08,F5,1,0
109,153980,50,300,42480000,43160000,35,42540000,A13,F4,0,0
110,1539b4,50,300,42480000,43160000,35,42550000,A14,F4,0,0
111,1539e6,50,300,42480000,43160000,35,42560000,A15,F4,0,0
112,153a1a,50,300,42480000,43160000,35,42570000,A12,F4,0,0
113,153a4c,50,300,42480000,43160000,35,42580000,A09,F4,0,0
114,153a80,50,300,42480000,43160000,35,42590000,A06,F4,0,0
115,153ab2,50,300,42480000,43160000,35,425a0000,A05,F4,0,0
116,153afc,50,300,42480000,43160000,35,425b0000,D04,F4,0,0
117,153b32,50,400,42c80000,43480000,100,425c0000,A08,F5,1,0
118,153b64,50,300,42480000,43160000,25,425d999a,A01,F4,0,0
119,153b9c,50,300,42480000,43160000,25,425e6666,A02,F4,0,0
120,153bce,50,300,42480000,43160000,25,425f3333,A03,F4,0,0
121,153c02,50,300,42480000,43160000,25,42600000,A06,F4,0,0
122,153c34,50,300,42480000,43160000,25,4260cccd,A09,F4,0,0
123,153ce2,50,300,42480000,43160000,25,4261999a,A12,F4,0,0
124,153d14,50,300,42480000,43160000,25,42626666,A11,F4,0,0
125,153d60,50,300,42480000,43160000,25,42633333,D05,F4,0,0
126,153d92,50,300,42480000,43160000,25,425d999a,A15,F4,0,0
127,153dc6,50,300,42480000,43160000,25,425e6666,A14,F4,0,0
128,153df8,50,300,42480000,43160000,25,425f3333,A13,F4,0,0
129,153e2c,50,300,42480000,43160000,25,42600000,A10,F4,0,0
130,153e60,50,300,42480000,43160000,25,4260cccd,A07,F4,0,0
131,153e96,50,300,42480000,43160000,25,4261999a,A04,F4,0,0
132,153ec8,50,300,42480000,43160000,25,42626666,A05,F4,0,0
133,153f1a,50,300,42480000,43160000,25,42633333,D06,F4,0,0
134,153f50,50,400,42480000,43160000,75,42640000,A08,VN,0,0
135,153f88,50,400,42480000,43160000,75,42660000,A08,HX,0,0
136,153fbe,50,400,42480000,43160000,75,42680000,A08,F5,1,0
137,153ff4,50,250,42480000,42c80000,25,42686666,A13,F5,0,0
138,154032,50,250,42480000,42c80000,25,4268cccd,A10,F5,0,0
139,154062,50,250,42480000,42c80000,25,42693333,A07,F5,0,0
140,154098,50,250,42480000,42c80000,25,4269999a,A04,F5,0,0
141,1540c8,50,250,42480000,42c80000,25,426a0000,A01,F5,0,0
142,154186,50,250,42480000,42c80000,25,426a6666,D07,F5,0,0
143,1541b6,50,250,42480000,42c80000,25,42686666,A15,F5,0,0
144,1541ec,50,250,42480000,42c80000,25,4268cccd,A12,F5,0,0
145,15421c,50,250,42480000,42c80000,25,42693333,A09,F5,0,0
146,154252,50,250,42480000,42c80000,25,4269999a,A06,F5,0,0
147,154282,50,250,42480000,42c80000,25,426a0000,A03,F5,0,0
148,1542c8,50,250,42480000,42c80000,25,426a6666,D08,F5,0,0
149,1542fe,50,250,42480000,42c80000,25,426a6666,A02,F5,0,0
150,15432e,50,250,42480000,42c80000,25,426acccd,A05,F5,0,0
151,154364,50,250,42480000,42c80000,25,426b3333,A08,F5,0,0
152,154394,50,250,42480000,42c80000,25,426c0000,A11,F5,0,0
153,1543ca,50,250,42480000,42c80000,75,426d0000,A02,F5,0,0
154,154400,50,450,43160000,43c80000,100,426e0000,A13,F5,1,0
155,154436,50,450,43160000,43c80000,100,426e0000,A14,F5,1,0
156,15446e,50,450,43160000,43c80000,100,426e0000,A15,F5,1,0
157,1544a0,50,250,42480000,43160000,35,427c0000,A01,HX,0,0
158,1544d6,50,250,42480000,43160000,35,427c0000,A04,F5,0,0
159,15450a,50,250,42480000,43160000,35,427c0000,A07,CI,0,0
160,1545a8,50,250,42480000,43160000,35,427c0000,A10,F5,0,0
161,1545dc,50,250,42480000,43160000,35,427c0000,A13,HX,0,0
162,15460c,50,250,42480000,43160000,35,427c0000,A03,HX,0,0
163,154642,50,250,42480000,43160000,35,427c0000,A06,F5,0,0
164,154672,50,250,42480000,43160000,35,427c0000,A09,CI,0,0
165,1546a8,50,250,42480000,43160000,35,427c0000,A12,F5,0,0
166,1546d8,50,250,42480000,43160000,35,427c0000,A15,HX,0,0
167,154710,50,350,42c80000,437a0000,100,427c0000,A08,F4,1,0
168,154742,50,250,41c80000,42960000,50,4281999a,A14,F4,0,0
169,154776,50,250,41c80000,42960000,50,42820000,A11,F4,0,0
170,1547a8,50,250,41c80000,42960000,50,42826666,A08,F4,0,0
171,1547de,50,250,41c80000,42960000,50,4282cccd,A05,F4,0,0
172,154814,50,250,41c80000,42960000,50,42833333,A02,F4,0,0
173,154846,50,250,41c80000,42960000,50,4283999a,A01,F4,0,0
174,154876,50,250,41c80000,42960000,50,4283999a,A03,F4,0,0
175,1548b0,50,350,42c80000,437a0000,100,4283999a,A04,F5,1,0
176,1548e6,50,350,42c80000,437a0000,100,4283999a,A06,F5,1,0
177,15491c,50,150,41c80000,42960000,35,42960000,A01,F4,0,0
178,15494c,50,150,41c80000,42960000,35,42960000,A03,F4,0,0
179,15497e,50,150,41c80000,42960000,35,42966666,A04,F4,0,0
180,154a12,50,150,41c80000,42960000,35,42966666,A06,F4,0,0
181,154a46,50,150,41c80000,42960000,35,4296cccd,A07,F4,0,0
182,154a76,50,150,41c80000,42960000,35,4296cccd,A09,F4,0,0
183,154aa8,50,150,41c80000,42960000,35,42973333,A10,F4,0,0
184,154ada,50,150,41c80000,42960000,35,42973333,A12,F4,0,0
185,154b1e,50,150,41c80000,42960000,35,4297999a,D09,F4,0,0
186,154b66,50,150,41c80000,42960000,35,4297999a,D10,F4,0,0
187,154ba0,50,350,42c80000,437a0000,100,42980000,A13,ST,1,0
188,154bd6,50,350,42c80000,437a0000,100,42980000,A14,ST,1,0
189,154c0e,50,350,42c80000,437a0000,100,42980000,A15,ST,1,0
190,154c42,50,150,41c80000,42960000,35,429a3333,A14,F4,0,0
191,154c72,50,150,41c80000,42960000,35,429a6666,A11,F4,0,0
192,154cac,50,250,42480000,42c80000,75,429a999a,A08,HX,0,0
193,154ce0,50,150,41c80000,42960000,35,429acccd,A05,F4,0,0
194,154d14,50,150,41c80000,42960000,100,429b0000,A01,F5,1,0
195,154d48,50,150,41c80000,42960000,100,429b0000,A02,F5,1,0
196,154d7e,50,150,41c80000,42960000,100,429b0000,A03,F5,1,0
197,154db2,50,200,42480000,43160000,50,42a60000,A01,F5,0,0
198,154de4,50,200,42480000,43160000,50,42a70000,A15,F5,0,0
199,154e84,50,200,42480000,43160000,50,42a80000,A03,F5,0,0
200,154eb6,50,200,42480000,43160000,50,42a90000,A13,F5,0,0
201,154eea,50,200,42480000,43160000,50,42aa0000,A07,ST,1,0
202,154f1e,50,200,42480000,43160000,50,42aa0000,A09,ST,1,0
203,154f52,50,200,42480000,43160000,50,42aa0000,A05,ST,1,0
204,154f82,50,200,42480000,43160000,50,42aa0000,A11,ST,1,0
205,154fb8,50,200,42480000,43160000,50,42a98000,A08,CI,0,0
206,154fec,50,250,42480000,43480000,75,42b40000,A05,F5,0,1
207,155022,50,250,42480000,43480000,50,42b48000,A11,F5,0,1
208,155056,50,250,42480000,43480000,50,42b50000,A07,F5,0,1
209,155086,50,250,42480000,43480000,50,42b58000,A09,F5,0,1
210,1550bc,150,250,42c80000,43960000,100,42b60000,A08,VN,0,0
211,1550ee,50,100,42480000,43480000,50,42b70000,A04,F4,0,0
212,15511e,50,100,42480000,43480000,50,42b70000,A06,F4,0,0
213,15514e,50,100,42480000,43480000,50,42b70000,A10,F4,0,0
214,155180,50,100,42480000,43480000,50,42b70000,A12,F4,0,0
215,1551b2,50,250,42480000,43480000,50,42b80000,A01,HX,0,0
216,1551e4,50,250,42480000,43480000,50,42b80000,A03,HX,0,0
217,155216,50,250,42480000,43480000,50,42b80000,A13,HX,0,0
218,155246,50,250,42480000,43480000,50,42b80000,A15,HX,0,0
219,1552da,150,350,42c80000,43960000,100,42b80000,A08,VN,0,1
220,15530e,50,350,43160000,43af0000,100,42d40000,A08,VN,0,0
221,155344,50,300,42480000,43160000,50,42d50000,A02,ST,0,1
222,155376,50,300,42480000,43160000,50,42d50000,A07,ST,0,1
223,1553ae,50,300,42480000,43160000,50,42d50000,A14,ST,0,1
224,1553e4,50,300,42480000,43160000,50,42d50000,A09,ST,0,1
225,15541a,50,300,42480000,43160000,75,42d20000,A01,F5,0,0
226,15544e,50,300,42480000,43160000,75,42d10000,A03,F5,0,0
227,155484,50,300,42480000,43160000,75,42d18000,A13,F5,0,0
228,1554b8,50,300,42480000,43160000,75,42d28000,A15,F5,0,0
229,1554ec,50,150,41700000,420c0000,25,42ee0000,A13,F5,0,0
230,15551c,50,150,41700000,420c0000,25,42ee0000,A15,F5,0,0
231,15554a,50,150,41700000,420c0000,25,42ee6666,A10,F5,0,0
232,15557a,50,150,41700000,420c0000,25,42ee6666,A12,F5,0,0
233,1555ac,50,150,41700000,420c0000,25,42eecccd,A07,F5,0,0
234,1555dc,50,150,41700000,420c0000,25,42eecccd,A09,F5,0,0
235,15560a,50,150,41700000,420c0000,25,42ef3333,A04,F5,0,0
236,15563a,50,150,41700000,420c0000,25,42ef3333,A06,F5,0,0
237,15566c,50,250,42c80000,43480000,75,42f00000,A01,F5,0,0
238,15569c,50,250,42c80000,43480000,75,42f00000,A02,F5,0,0
239,155754,50,250,42c80000,43480000,75,42f00000,A03,F5,0,0
240,155786,50,150,420c0000,42480000,25,42f03333,A02,F5,0,0
241,1557b6,50,150,420c0000,42480000,25,42f06666,A05,F5,0,0
242,1557ee,50,150,420c0000,42480000,25,42f0999a,A08,F5,0,0
243,15581e,50,150,420c0000,42480000,25,42f0cccd,A11,F5,0,0
244,155852,50,150,420c0000,42480000,25,42f10000,A14,F5,0,0
245,155888,50,150,420c0000,42480000,25,42f13333,A13,F5,0,0
246,1558be,50,150,420c0000,42480000,25,42f13333,A15,F5,0,0
247,1558ee,50,150,420c0000,42480000,25,42f16666,A10,F5,0,0
248,15591e,50,150,420c0000,42480000,25,42f16666,A12,F5,0,0
249,155952,50,150,420c0000,42480000,25,42f1999a,A07,F5,0,0
250,155982,50,150,420c0000,42480000,25,42f1999a,A09,F5,0,0
251,1559b2,50,150,420c0000,42480000,25,42f1cccd,A04,F5,0,0
252,1559e2,50,150,420c0000,42480000,25,42f1cccd,A06,F5,0,0
253,155a18,50,350,42c80000,43480000,25,42f20000,A01,VN,0,0
254,155a4a,50,350,42c80000,43480000,25,42f20000,A02,VN,0,0
255,155a82,50,350,42c80000,43480000,25,42f20000,A03,VN,0,0
256,155ab6,50,350,42c80000,43480000,25,42f20000,A13,F5,0,0
257,155aea,50,350,42c80000,43480000,25,42f20000,A14,VN,0,1
258,155b1e,50,350,42c80000,43480000,25,42f20000,A15,F5,0,0
259,155be2,50,150,420c0000,42960000,25,42f23333,A13,F5,0,0
260,155c12,50,150,420c0000,42960000,25,42f23333,A15,F5,0,0
261,155c42,50,150,420c0000,42960000,25,42f2999a,A10,F5,0,0
262,155c72,50,150,420c0000,42960000,25,42f2999a,A12,F5,0,0
263,155ca6,50,150,420c0000,42960000,25,42f36666,A07,F5,0,0
264,155cd6,50,150,420c0000,42960000,25,42f36666,A09,F5,0,0
265,155d06,50,150,420c0000,42960000,25,42f40000,A04,F5,0,0
266,155d36,50,150,420c0000,42960000,25,42f40000,A06,F5,0,0
267,155d6a,50,150,420c0000,42960000,25,42f46666,A01,F5,0,0
268,155d9a,50,150,420c0000,42960000,25,42f46666,A03,F5,0,0
269,155dcc,50,150,420c0000,42960000,25,42f4999a,A02,F5,0,0
270,155dfe,50,150,420c0000,42960000,25,42f4cccd,A05,F5,0,0
271,155e32,50,350,43160000,437a0000,100,42f50000,A08,F5,1,0
272,155e66,50,250,42480000,43160000,75,42f80000,A07,F5,0,0
273,155e96,50,250,42480000,43160000,75,42f88000,A09,F5,0,0
274,155eca,50,250,42480000,43160000,75,42f90000,A14,F5,0,0
275,155ef8,50,250,42480000,43160000,75,42f98000,A02,F5,0,0
276,155f2e,50,250,42480000,43160000,75,42fa0000,A08,F5,1,0
277,155f60,50,150,420c0000,42960000,25,42fa8000,A08,F5,0,0
278,155f92,50,150,420c0000,42960000,25,42fb0000,A07,F5,0,0
279,155fc2,50,150,420c0000,42960000,25,42fb0000,A09,F5,0,0
280,156088,50,150,420c0000,42960000,25,42fb8000,A04,F5,0,0
281,1560b6,50,150,420c0000,42960000,25,42fb8000,A06,F5,0,0
282,1560e6,50,150,420c0000,42960000,25,42fb8000,A10,F5,0,0
283,156116,50,150,420c0000,42960000,25,42fb8000,A12,F5,0,0
284,15614a,50,350,42480000,437a0000,75,42fc0000,A01,F5,0,0
285,15617e,50,350,42480000,437a0000,75,42fc0000,A03,F5,0,0
286,1561b0,50,350,42480000,437a0000,75,42fc0000,A13,F5,0,0
287,1561e4,50,350,42480000,437a0000,75,42fc0000,A15,F5,0,0
288,156218,50,150,41c80000,42480000,25,42ff0000,A01,F4,0,0
289,156248,50,150,41c80000,42480000,25,42ff0000,A03,F4,0,0
290,156278,50,150,41c80000,42480000,25,42ff8000,A04,F4,0,0
291,1562a8,50,150,41c80000,42480000,25,42ff8000,A06,F4,0,0
292,1562da,50,150,41c80000,42480000,25,43000000,A07,F4,0,0
293,15630c,50,150,41c80000,42480000,25,43000000,A09,F4,0,0
294,15633c,50,150,41c80000,42480000,25,43004000,A10,F4,0,0
295,15636c,50,150,41c80000,42480000,25,43004000,A12,F4,0,0
296,15639c,50,150,41c80000,42480000,25,43008000,A13,F4,0,0
297,1563ce,50,150,41c80000,42480000,25,43008000,A15,F4,0,0
298,1563fe,50,150,41c80000,42480000,25,4300c000,A11,F4,0,0
299,15642e,50,150,41c80000,42480000,25,43010000,A08,F4,0,0
300,1564dc,50,150,41c80000,42480000,25,43014000,A05,F4,0,0
301,156510,50,350,43160000,43af0000,100,43018000,A01,F5,0,0
302,156548,50,350,43160000,43af0000,75,43018000,A02,VN,0,0
303,15657c,50,350,43160000,43af0000,100,43018000,A03,F5,0,0
304,1565ae,50,300,42480000,43160000,35,43028000,A10,F4,0,0
305,1565de,50,300,42480000,43160000,35,43030000,A06,F4,0,0
306,156610,50,300,42480000,43160000,35,43038000,A12,F4,0,0
307,156640,50,300,42480000,43160000,35,43040000,A04,F4,0,0
308,156674,50,300,42480000,43160000,35,43050000,A08,VN,0,0
309,1566ae,50,300,42480000,43160000,35,43048000,A05,ST,0,1
310,1566e6,50,300,42480000,43160000,35,43048000,A07,ST,0,1
311,15671c,50,300,42480000,43160000,35,43048000,A09,ST,0,1
312,156754,50,300,42480000,43160000,35,43048000,A11,ST,0,1
313,15678a,50,300,42480000,43160000,35,4304c000,A01,F4,0,1
314,1567be,50,300,42480000,43160000,35,4304c000,A15,F4,0,1
315,1567f4,50,300,42480000,43160000,35,4304c000,A03,F4,0,1
316,156828,50,300,42480000,43160000,35,4304c000,A13,F4,0,1
317,15685a,50,300,42480000,43160000,35,43050000,A03,F4,0,0
318,15688c,50,300,42480000,43160000,35,43054000,A02,F4,0,0
319,1568be,50,300,42480000,43160000,35,43058000,A01,F4,0,0
320,156974,50,300,42480000,43160000,35,4305c000,A04,F4,0,0
321,1569a6,50,300,42480000,43160000,35,43060000,A07,F4,0,0
322,1569d8,50,300,42480000,43160000,35,43064000,A10,F4,0,0
323,156a08,50,300,42480000,43160000,35,43068000,A11,F4,0,0
324,156a56,50,300,42480000,43160000,35,4306c000,D11,F4,0,0
325,156a90,50,400,42c80000,43480000,100,43070000,A08,F5,1,0
326,156ac2,50,300,42480000,43160000,35,43070000,A13,F4,0,0
327,156af4,50,300,42480000,43160000,35,43074000,A14,F4,0,0
328,156b26,50,300,42480000,43160000,35,43078000,A15,F4,0,0
329,156b58,50,300,42480000,43160000,35,4307c000,A12,F4,0,0
330,156b8a,50,300,42480000,43160000,35,43080000,A09,F4,0,0
331,156bbc,50,300,42480000,43160000,35,43084000,A06,F4,0,0
332,156bec,50,300,42480000,43160000,35,43088000,A05,F4,0,0
333,156c3a,50,300,42480000,43160000,35,4308c000,D12,F4,0,0
334,156c70,50,400,42c80000,43480000,100,43090000,A08,F5,1,0
335,156ca2,50,300,42480000,43160000,25,43096666,A01,F4,0,0
336,156cd4,50,300,42480000,43160000,25,4309999a,A02,F4,0,0
337,156d06,50,300,42480000,43160000,25,4309cccd,A03,F4,0,0
338,156d38,50,300,42480000,43160000,25,430a0000,A06,F4,0,0
339,156e10,50,300,42480000,43160000,25,430a3333,A09,F4,0,0
340,156e42,50,300,42480000,43160000,25,430a6666,A12,F4,0,0
341,156e72,50,300,42480000,43160000,25,430a999a,A11,F4,0,0
342,156ec2,50,300,42480000,43160000,25,430acccd,D13,F4,0,0
343,156ef4,50,300,42480000,43160000,25,43096666,A15,F4,0,0
344,156f26,50,300,42480000,43160000,25,4309999a,A14,F4,0,0
345,156f58,50,300,42480000,43160000,25,4309cccd,A13,F4,0,0
346,156f8a,50,300,42480000,43160000,25,430a0000,A10,F4,0,0
347,156fc0,50,300,42480000,43160000,25,430a3333,A07,F4,0,0
348,156ff2,50,300,42480000,43160000,25,430a6666,A04,F4,0,0
349,157022,50,300,42480000,43160000,25,430a999a,A05,F4,0,0
350,15706e,50,300,42480000,43160000,25,430acccd,D14,F4,0,0
351,1570a2,50,400,42480000,43160000,75,430b0000,A08,VN,0,0
352,1570d8,50,400,42480000,43160000,57,430b8000,A08,HX,0,0
353,15710e,50,400,42480000,43160000,57,430c0000,A08,F5,1,0
354,15713e,50,250,42480000,42c80000,25,430c199a,A13,F5,0,0
355,157172,50,250,42480000,42c80000,25,430c3333,A10,F5,0,0
356,1571a2,50,250,42480000,42c80000,25,430c4ccd,A07,F5,0,0
357,1571d2,50,250,42480000,42c80000,25,430c6666,A04,F5,0,0
358,1572a2,50,250,42480000,42c80000,25,430c8000,A01,F5,0,0
359,1572e8,50,250,42480000,42c80000,25,430c999a,D15,F5,0,0
360,157318,50,250,42480000,42c80000,25,430c199a,A15,F5,0,0
361,157348,50,250,42480000,42c80000,25,430c3333,A12,F5,0,0
362,157378,50,250,42480000,42c80000,25,430c4ccd,A09,F5,0,0
363,1573a8,50,250,42480000,42c80000,25,430c6666,A06,F5,0,0
364,1573d6,50,250,42480000,42c80000,25,430c8000,A03,F5,0,0
365,15741a,50,250,42480000,42c80000,25,430c999a,D16,F5,0,0
366,15744a,50,250,42480000,42c80000,25,430c999a,A02,F5,0,0
367,15747a,50,250,42480000,42c80000,25,430cb333,A05,F5,0,0
368,1574aa,50,250,42480000,42c80000,25,430ccccd,A08,F5,0,0
369,1574da,50,250,42480000,42c80000,25,430d0000,A11,F5,0,0
370,15750a,50,250,42480000,42c80000,75,430d4000,A14,F5,0,0
371,15753e,50,450,43160000,43c80000,100,430d8000,A13,F5,1,0
372,157572,50,450,43160000,43c80000,100,430d8000,A14,F5,1,0
373,1575a8,50,450,43160000,43c80000,100,430d8000,A15,F5,1,0
374,1575d8,50,100,41200000,41c80000,35,430eb333,A01,F5,0,0
375,157608,50,100,41200000,41c80000,35,430ecccd,A02,F5,0,0
376,157638,50,100,41200000,41c80000,35,430ee666,A03,F5,0,0
377,157668,50,100,41200000,41c80000,35,430f0000,A06,F5,0,0
378,157738,50,100,41200000,41c80000,35,430f4ccd,A07,F5,0,0
379,157768,50,100,41200000,41c80000,35,430f3333,A08,F5,0,0
380,157798,50,100,41200000,41c80000,35,430f199a,A09,F5,0,0
381,1577c8,50,100,41200000,41c80000,35,430f0000,A12,F5,0,0
382,1577f8,50,100,41200000,41c80000,35,430eb333,A13,F5,0,0
383,157828,50,100,41200000,41c80000,35,430ecccd,A14,F5,0,0
384,157858,50,100,41200000,41c80000,35,430ee666,A15,F5,0,0
385,15788a,50,100,42480000,42960000,35,430f8000,A01,F5,1,0
386,1578bc,50,100,42480000,42960000,35,430f8000,A02,F5,1,0
387,1578f0,50,100,42480000,42960000,35,430f8000,A03,F5,1,0
388,157922,50,100,42480000,42960000,35,430f8000,A05,F5,1,0
389,157954,50,100,42480000,42960000,35,430f8000,A07,F5,1,0
390,157986,50,100,42480000,42960000,35,430f8000,A08,F5,1,0
391,1579b8,50,100,42480000,42960000,35,430f8000,A09,F5,1,0
392,1579ea,50,100,42480000,42960000,35,430f87ae,A12,F5,1,0
393,157a1c,50,100,42480000,42960000,35,430f8000,A13,F5,1,0
394,157a4e,50,100,42480000,42960000,35,430f8000,A14,F5,1,0
395,157a82,50,100,42480000,42960000,35,430f8000,A15,F5,1,0
396,157ab2,50,100,41200000,41c80000,35,430fcccd,A01,F5,0,0
397,157ae2,50,100,41200000,41c80000,35,430fe666,A02,F5,0,0
398,157b12,50,100,41200000,41c80000,35,43100000,A03,F5,0,0
399,157bba,50,100,41200000,41c80000,35,4310199a,A05,F5,0,0
400,157bea,50,100,41200000,41c80000,35,43103333,A09,F5,0,0
401,157c1a,50,100,41200000,41c80000,35,43104ccd,A08,F5,0,0
402,157c4a,50,100,41200000,41c80000,35,43103333,A07,F5,0,0
403,157c7a,50,100,41200000,41c80000,35,4310199a,A10,F5,0,0
404,157caa,50,100,41200000,41c80000,35,43100000,A13,F5,0,0
405,157cda,50,100,41200000,41c80000,35,430fe666,A14,F5,0,0
406,157d0a,50,100,41200000,41c80000,35,430fcccd,A15,F5,0,0
407,157d3c,50,100,42480000,42960000,35,43108000,A01,F5,1,0
408,157d6e,50,100,42480000,42960000,35,43108000,A02,F5,1,0
409,157da2,50,100,42480000,42960000,35,43108000,A03,F5,1,0
410,157dd4,50,100,42480000,42960000,35,43108000,A05,F5,1,0
411,157e06,50,100,42480000,42960000,35,43108000,A09,F5,1,0
412,157e38,50,100,42480000,42960000,35,43108000,A08,F5,1,0
413,157e6a,50,100,42480000,42960000,35,43108000,A07,F5,1,0
414,157e9c,50,100,42480000,42960000,35,43108000,A10,F5,1,0
415,157ece,50,100,42480000,42960000,35,43108000,A13,F5,1,0
416,157f00,50,100,42480000,42960000,35,43108000,A14,F5,1,0
417,157f36,50,100,42480000,42960000,35,43108000,A15,F5,1,0
418,157f66,50,100,41200000,41c80000,35,4311199a,A02,F5,0,0
419,157f96,50,100,41200000,41c80000,35,43113333,A05,F5,0,0
420,158038,50,100,41200000,41c80000,35,43114ccd,A08,F5,0,0
421,158068,50,100,41200000,41c80000,35,43113333,A11,F5,0,0
422,158098,50,100,41200000,41c80000,35,4311199a,A14,F5,0,0
423,1580ca,50,100,42480000,42960000,35,43118000,A02,F5,1,0
424,1580fc,50,100,42480000,42960000,35,43118000,A05,F5,1,0
425,15812e,50,100,42480000,42960000,35,43118000,A08,F5,1,0
426,158160,50,100,42480000,42960000,35,43118000,A11,F5,1,0
427,158192,50,100,42480000,42960000,35,43118000,A14,F5,1,0
428,1581c4,50,350,43160000,43af0000,35,43128000,A01,F5,0,0
429,1581f6,50,350,43160000,43af0000,35,43128000,A03,F5,0,0
430,158228,50,350,43160000,43af0000,35,43128000,A04,F5,0,0
431,15825a,50,350,43160000,43af0000,35,43128000,A06,F5,0,0
432,15828c,50,350,43160000,43af0000,35,43128000,A09,F5,0,0
433,1582be,50,350,43160000,43af0000,35,43128000,A07,F5,0,0
434,1582f0,50,350,43160000,43af0000,35,43128000,A10,F5,0,0
435,158322,50,350,43160000,43af0000,35,43128000,A12,F5,0,0
436,158354,50,350,43160000,43af0000,35,43128000,A13,F5,0,0
437,158386,50,350,43160000,43af0000,35,43128000,A15,F5,0,0
438,1583be,50,350,43160000,43e10000,75,43128000,A08,ST,1,0
439,1583ee,50,450,43160000,43e10000,75,43128000,A08,VN,0,0
```

## Implementation map and acceptance tests

Recommended domain/Creator boundaries, following existing Combo Bird transaction patterns:

1. Add a GN resource contract/loader for five instruction rasters, TimeManager resources,
   six particle textures, and the music clip. Preload all choreography resources before
   activation so a missing row texture cannot fail halfway through the 439-root commit.
2. Add a pure GN intro plan for the exact three callback stages and `2.60`-second nominal
   sequence.
3. Add a GN toss config/coordinator using only the three rows above. Reuse shared type-0 toss
   strategies and one RNG port; do not add a generic special/bomb manager.
4. Add a pure choreography decoder whose immutable row fixture is integrity-checked by row
   count and SHA. Validate every enum/path/point/float before activation and preserve source
   order.
5. Add a Creator particle presenter that creates roots in CSV order, attaches all at z-order
   `1`, and preserves equal-deadline insertion order.
6. Compose a GN session/controller from the standard blade, score/combo, pause, objective,
   TimeManager, result, settings, and audio seams. Do not copy Bird lifecycle code.
7. Add GN rank/reward methods and key bindings to settings, plus mode `2` Result Retry and
   committed selector-2 dispatch.
8. Extend `RecoveredAppShellController` and `classic.scene` with transactional GN ownership,
   rollback, result-menu, and pause-quit wiring. Remove only the GN unsupported destination.

Minimum deterministic tests:

- mode ID `2`, class/standard-blade selection, and fresh replay instance;
- exact onEnter construction/attachment and GO start order;
- exact Free/Wave/Concurrent bounds, Wave entry draw, and Concurrent `3...7` count;
- `6,0` -> misses `6,1` -> expiry `6,2`, including ID-48 zero-miss completion;
- direct fruit score plus shared `>0.25` combo closure and selector `0`;
- 150-second timer and three-second TIME UP callback order;
- score remains mutable during the native TIME UP window and is captured only at finish;
- pause music resumes only for mode `2`;
- Replay/Retry create fresh GN; pause/result Menu reach fresh Main Menu; rollback restores the
  prior owner without duplicate objective/result mutation;
- `gnstyle_best_1..3` inclusive ranking and exact float32 `0.6` coin award;
- committed Result executes selector `2` once; failed/pre-commit transition executes it zero
  times;
- all five instruction paths and both profile dimensions;
- exact choreography row count/hash, first and last rows, six path counts, flag counts, point
  counts, and 25 delay inversions;
- width/count scale boundaries immediately below/at/above `720` and `1136`, area clamp at
  `1.0`, float32 arithmetic, and truncation;
- all 439 root creates preserve direct source order, including equal and decreasing delays;
- emitter cleanup uses `2 * maxDurationHundredths / 100`, with the final 12 roots still owned
  by GN when the Result replacement removes the gameplay layer;
- flagB shared-color draws and flagA per-child-color draws retain their exact ordering;
- audio-disabled paths retain required gameplay RNG draws but skip audio-only combo draws;
- music disabled: stop prior track but do not start GN song; music enabled: non-looping start;
- fail-closed activation for missing music, texture, point, malformed float bits, or partial
  scene ownership.

## Contradictions, risks, and unknowns

1. **[RECOVERED]** The song is roughly `0.736` seconds shorter than the timer and does not
   loop. Extending or looping it changes native behavior.
2. **[RECOVERED]** Time-up stops spawning but not cutting/physics; final score is captured after
   the three-second overlay. Existing timed reconstruction code may freeze earlier and cannot
   be reused unchanged.
3. **[RECOVERED]** No GN-specific intro input gate exists. Adding one is a behavior change,
   although normally no fruit exists before GO.
4. **[RECOVERED]** `ProcessGameEvent(6,2)` occurs before the three-second score window closes.
   The no-drop objective and final-score objectives intentionally observe different cutoffs.
5. **[UNKNOWN]** Native PRNG algorithm, initial seed, and complete shared-stream state are not
   statically established. Preserve call protocol without claiming sequence parity.
6. **[UNKNOWN]** Equal-deadline callback order depends on the legacy scheduler. Source-order
   insertion is the strongest recoverable adaptation.
7. **[RECOVERED]** The particle flags' color/RNG effects are exact, but their original source
   identifiers are stripped. Preserve neutral API names unless maintainers explicitly choose
   descriptive adapter names.
8. **[UNKNOWN]** `leaderboard_gnstyle.png` has no proven direct consumer.
9. **[RECOVERED]** Retry/Menu do not immediately save ranking/coins/objective sequence. Adding
   a checkpoint is a product reliability choice and changes crash-persistence behavior.
10. **Release blocker:** `GangnamStyle.mp3`, name/trademark use, fonts, and extracted art need
    explicit rights review.
11. **Current implementation gap:** the app shell still fails mode `2` closed and settings has
    no GN-specific result mutation surface.

## Phase-06 status recommendation

Static GN recovery is complete enough to begin implementation. Phase 06 should continue to
show GN Style as incomplete until the route, settings, controller graph, 439-row presenter,
transactional lifecycle tests, full deterministic suite, real Creator build, and rights gates
all pass. No plan checkbox or project state was changed by this report.

## Unresolved questions

- Will product require exact native scoring during the three-second TIME UP window, or approve
  a deliberate freeze-at-150 change?
- Can `GangnamStyle.mp3` and the GN name/art be shipped, or must an approved replacement policy
  be defined before production certification?
- Should `leaderboard_gnstyle.png` remain catalog-only until the shared leaderboard layer is
  independently recovered?
- Is exact legacy equal-deadline scheduler ordering required beyond preserving emitter
  source insertion order?

Status: DONE_WITH_CONCERNS
Summary: Mode-2 lifecycle, ordinary toss/input/score/objective/result/settings/audio contracts and all 439 ordered particle calls are statically recovered and implementation-ready.
Concerns/Blockers: Native time-up permits three more seconds of scoring; music/name/art rights remain uncleared; legacy RNG/seed, equal-deadline scheduler parity, original particle-flag names, and the leaderboard raster consumer remain unknown.

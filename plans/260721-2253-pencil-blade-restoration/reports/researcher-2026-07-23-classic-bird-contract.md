# Classic Bird static implementation contract

Date: 2026-07-23
Scope: static native/resource audit only; no APK, shared-library, emulator, or reconstructed runtime execution
Native artifact: `.forensics-work/phase-01/native/libgame.so`
SHA-256: `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`

## Contract verdict

Classic Bird is native mode ID `3`. It is an untimed survival mode built on `BaseBirdLayer`, not a cosmetic variant of the four-slot `ClassicLayer`.

The minimum faithful restoration needs:

- one touch-directed `BirdBlade` with type `1`, cached ray segments, and an always-updating particle trail;
- nine independently scheduled toss controllers;
- the shared cut, combo, three-miss, magnet, electric, game-over, and result components, configured with Bird-specific policies;
- world-speed acceleration every `45.0` scheduler seconds;
- Bird Classic ranking keys, an `0.8f` coin factor, and fresh-instance replay;
- no `TimeManager`, double-score toss, bonus toss, standard Classic blade quartet, or bomb `-10` score mutation.

Static evidence is sufficient to implement and unit-test the contract below. Exact frame-level RNG parity remains unprovable without prohibited runtime observation because Bird particles consume the shared RNG before the intro completes.

## Evidence and confidence

Primary evidence:

- native function map: `forensics/native/function-map.csv`;
- application and full function inventories: `.forensics-work/phase-02/native/app-function-inventory.csv` and `.forensics-work/phase-02/native/function-inventory.csv`;
- GNU ARM/Thumb disassembly of the addresses cited below;
- native strings: `.forensics-work/phase-02/native/strings/all-offsets.txt`;
- JNI/settings evidence: `forensics/native/java-jni-boundary.md` and `.forensics-work/phase-02/native/gnu/dynamic-symbols.txt`;
- resource manifest and staged assets: `forensics/resources/resource-usage-map.json`, `.forensics-work/phase-01/jadx/resources/assets/`, and `game/assets/game/`;
- shared behavior contracts under `forensics/contracts/`;
- earlier mode report: `plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-23-remaining-mode-order.md`.

The disassembly was interpreted as ARM EABI5 Thumb code using GNU objdump `2.27` and LLVM `19`, recorded in `.forensics-work/phase-02/native/tool-versions.txt`.

Confidence labels in this report:

- **Exact**: immediate, literal, branch, symbol, resource, or call ordering is directly recoverable.
- **High**: behavior is recoverable from call signatures plus shared component/vtable evidence.
- **Inferred**: engine default or semantic field name is not present in the stripped binary.

## Corrections and limits on prior claims

The earlier remaining-mode report correctly identifies mode `3`, `BirdBlade` type `1`, the absence of `TimeManager`, the GOOD/LUCK and GAME/OVER flows, the Bird best-score triplet, the `0.8f` reward factor, and fresh-instance replay.

Its statement that Classic Bird can reuse the Classic session/toss/failure/standard-bomb implementation needs these constraints:

1. Reuse the mode-neutral toss timer and shared component internals, not Classic controller constants.
2. Bird uses nine controllers with materially different bounds and start order.
3. Bird magnet override/restoration is `[0.5, 1.5]` / `[0.75, 5.0]`, not Classic's `[0.25, 0.5]` / `[0.5, 3.0]`.
4. Bird world-speed delay is `45.0`, not `30.0`.
5. `ClassicBirdLayer::BombHit` contains no score call; it must not apply Classic's `-10`.
6. `BaseBirdLayer` owns one touch-began-driven blade. It does not inherit Classic's four touch slots, movement-distance swish threshold, or equivalent ray lifecycle.

These are verified native differences, not design choices.

## Native identity and object graph

| Behavior | Native evidence | Contract |
|---|---:|---|
| Mode ID | `ClassicBirdLayer::GetGameMode` `0x00147f70` | returns immediate `3` |
| Entry | `ClassicBirdLayer::onEnter` `0x00148110`, size 1088 | constructs complete mode graph |
| Start | `StartGameCallback` `0x00147f74` | enables cuts and starts nine controllers |
| Cut | `FruitCut` `0x00148550` | dispatches ID 13/14 effects, then scores |
| Miss | `FruitFail` `0x001480f8` | delegates to shared `FruitFailManager` |
| Bomb | `BombHit` `0x00148064` | freezes physics and stops spawning; no score mutation |
| Terminal | `GameOver` `0x001486c4`; callback `0x001488b8` | guarded GAME/OVER presentation |
| Result | `DisplayScoreCallback` `0x00147ff0` | creates generic result with mode `3` |
| Replay factory | `ClassicBirdLayer::GetReplayInstance` `0x001486a4` | creates a fresh Classic Bird layer |
| Vtable | `0x00455cf0` | confirms dedicated layer override surface |

Recovered instance slots:

| Offset | Component |
|---:|---|
| `+0x2a4` | `BirdBlade` |
| `+0x2a8` | normal Free |
| `+0x2ac` | normal Concurrent |
| `+0x2b0` | normal Wave |
| `+0x2b4` | bomb Free |
| `+0x2b8` | bomb Concurrent |
| `+0x2bc` | bomb Wave |
| `+0x2c0` | dragon Free |
| `+0x2c4` | magnet Free |
| `+0x2c8` | electric Free |
| `+0x2cc` | `FruitFailManager` |
| `+0x2d0` | `BombElectric` |
| byte `+0x2d4` | one-shot terminal guard |

The constructor at `0x00148628` nulls the controllers/fail manager and initializes the guard false.

### Entry order

`ClassicBirdLayer::onEnter` performs this exact sequence:

1. call `BaseBirdLayer::onEnter`;
2. read window dimensions and physics world;
3. construct and attach, at z-order `1`, normal Free, normal Concurrent, normal Wave, bomb Free, bomb Concurrent, bomb Wave, dragon Free, magnet Free, then electric Free;
4. create `FruitFailManager`, register `GameOverCallback`, attach at z-order `1`;
5. construct GOOD then LUCK intro actions at z-order `1`;
6. create and attach `BombElectric` at z-order `1`;
7. call `CreateBirdBlade("Blades/testblade7.png", 1)`;
8. invoke the inherited pause-component initialization virtual;
9. set the score manager's comparison baseline to `Settings::BirdClassicBest_1`;
10. call `EnableWorldSpeedUp(45.0f)`.

There is no `TimeManager`, `DoubleToss`, or `BonusToss` construction/call in this graph.

## Bird blade contract

Native surface:

- `BaseBirdLayer::ccTouchesMoved` `0x0014236c`: empty;
- `BaseBirdLayer::ccTouchesEnded` `0x00142384`: empty;
- `BaseBirdLayer::ccTouchesBegan` `0x0014239c`;
- `BaseBirdLayer::update` `0x001423fc`;
- `BaseBirdLayer::CreateBirdBlade` `0x001425c8`;
- `BirdBlade::onEnter` `0x00144270`;
- `BirdBlade` constructor `0x001444a4`;
- `BirdBlade::Touch` `0x001445c8`;
- `BirdBlade::update` `0x00144708`;
- `BirdBlade::RayCashDone` `0x00144b06`.

`BaseBirdLayer::BaseBirdLayer` at `0x0014257c` calls the base gameplay constructor and then `PhysicsBladeLayer::setInitBlades(false)`. Its `onEnter` at `0x001423f4` only delegates to `BaseGameplayLayer::onEnter`. This is the native exclusion of the standard blade set; the single Bird blade is created later by Classic Bird entry.

`CreateBirdBlade` stores the new blade at `+0x2a4`, attaches it at z-order `1`, and focuses the current `ScoreManager` through the blade's `ComboManager`.

### Input and swish

On every touch-began event, `BaseBirdLayer`:

1. calls `PhysicsBladeLayer::PlaySwoshSound` once, before iterating the `CCSet`;
2. forwards each touch location to the single `BirdBlade`.

Moved and ended handlers do nothing. The blade accepts a location only while idle. Consequently:

- a swish request occurs even when the blade is busy and rejects all touches;
- in one multi-touch set, the first accepted location changes the blade to moving state and later locations are rejected;
- exact multi-touch winner depends on the engine's `CCSet` iteration order.

`PlaySwoshSound` at `0x001605a0` has a `0.5` action-second lock. When unlocked, it always draws `nextInt(0, 8)` and maps the result to swoosh 1–9, even when effects are disabled. The effects setting gates playback, not the RNG draw. Unlike the standard blade path, Bird has no movement-distance threshold because the call is made directly from touch began.

### Visual initialization

`BirdBlade::onEnter`:

- runs `BasicBlade::onEnter`;
- initializes its current/last/target points to the window center;
- creates ten frames `Birds/bird-anim-%d-%d.png` for type `1`, with a repeating `0.1f` frame delay;
- creates the main sprite from `Birds/bird-anim-%d-0.png`;
- creates hidden z-order `1` directional sprites `Birds/bird-left-%d.png` and `Birds/bird-right-%d.png`;
- computes movement scalar `float32(windowWidth * 1234 / 480)`.

The constructor stores type `1`, state `0`, and cached-ray false.

### Movement state machine

Use these semantic states; the original source names are stripped:

| State | Exact behavior |
|---|---|
| `0` idle | main sprite visible at current point; directional sprites hidden |
| touch from `0` | reset blade path, hide direction sprites, record target, enter `1`; choose left sprite when `target.x <= current.x`, otherwise right; rotate toward target, adding 180 degrees on the left branch |
| `1` moving | main hidden; move by normalized direction × `dt` × scalar; update active directional sprite and blade path |
| strict overshoot | only when proposed step length `>` remaining distance, snap exactly to target, enter `2`, and cache the current ray segment |
| `2` settle | invoke blade reset/end virtual, then return to `0` |

While moving, if no ray is already cached, `nextInt(0, 3) == 0` caches the current segment: a `1/4` chance per movement update. Strict overshoot also forces a cache. An exact-equality step does not take the snap branch or enter state `2`; it remains in state `1` at the target for that update.

`BaseBirdLayer::update` calls `PhysicsBladeLayer::update(dt)` first. If the cached-ray byte is true, it calls inherited vtable slot `+0x1f0` with the blade and cached endpoints, consistent with the shared world-ray/cut path, then calls `RayCashDone`. `RayCashDone` clears the cache and advances the last endpoint. Consume at most one observed cached segment per parent update.

Exact same-frame parent/child scheduling latency is engine-dependent and remains an uncertainty; the state and consumption ordering above are exact.

### Always-running particle trail

After the movement-state branch of every `BirdBlade::update`, including idle and intro frames:

1. draw `nextInt(0, 4)`;
2. only on result `0`—one of five inclusive outcomes—draw `nextInt(0, 3)` and create one `ParticleObject`;
3. always set rotation, scale-out, and fade-out true; attach at z-order `1`.

The base position is `(currentX, currentY - 0.075 * scalar)`.

| Selection | Asset | Lifetime | Random offset |
|---:|---|---:|---|
| `0` | `Blades/Particles/X-Mas/xmasfive.png` | `1.5` | x `[trunc(-.05s), trunc(.05s)]`; y `[trunc(-.3125s), trunc(-.02s)]` |
| `1` | `Blades/Particles/X-Mas/xmasfour.png` | `1.0` | same as selection 0 |
| `2` | `Blades/Particles/X-Mas/xmashexa.png` | `0.75` | x `[trunc(-.05s), trunc(.05s)]`; y `[trunc(-.3125s), trunc(-.1s)]` |
| `3` | `Blades/Particles/X-Mas/xmascircle.png` | `0.5` | `RandomPositionData(trunc(-.156s), trunc(-.1s))` |

Here `s` is the movement scalar. The integer random helper retains its recovered inclusive behavior. `RandomPositionData` draws x sign from `nextInt(-1, 1)`, x magnitude in the supplied bounds, y sign, then y magnitude, and multiplies each pair.

The main layer attaches `BirdBlade` before the intro ends, so idle-center particles consume RNG during the intro. Implement the RNG calls even if a particle is visually culled or effects are disabled. Anchor, color, and blend values not explicitly assigned by this function should be captured as engine-default adaptations, not claimed as native facts.

## Intro and start contract

GOOD and LUCK use the same geometry as the recovered Classic intro:

- GOOD begins at `(left - 0.25W, 0.525H)`, moves for `0.5` to `(0.5W, 0.525H)`, delays `0.5`, then moves for `0.5` to `(right + 0.25W, 0.525H)`;
- LUCK begins at `(right + 0.25W, 0.475H)`, moves for `0.5` to `(0.5W, 0.475H)`, delays `0.5`, then moves for `0.5` to `(left - 0.25W, 0.475H)`;
- only LUCK completion calls `StartGameCallback`.

Nominal duration is `1.5` action seconds, subject to frame discretization and pause. The blade, shared ray path, and particle updates already exist during this intro. The start callback redundantly calls `DisableCut(false)`.

`StartGameCallback` then starts controllers in this exact synchronous order:

1. normal Free;
2. dragon Free;
3. magnet Free;
4. electric Free;
5. normal Concurrent;
6. normal Wave;
7. bomb Free;
8. bomb Concurrent;
9. bomb Wave.

Every `Start` schedules and samples its next threshold. This call order is therefore the start callback's RNG order, but the global RNG state already includes Wave child initialization, a frame-dependent number of Bird particle draws, and any touch-began swish or moving-blade ray-cache draws made during the intro.

## Exact toss-controller table

All direction values below are exact constructor arguments. Grid values show the possible interval thresholds under the recovered `low + q * (high - low)` sampler where `q ∈ {0.0, 0.1, …, 0.9}`.

| Controller | Factory type / fruit | Direction | Outer bounds and grid | Count / active window |
|---|---|---|---|---|
| normal Free | type `0` | Up `0` | `[0.75, 5.0]`; `0.75 … 4.575`, step `.425` | one toss |
| normal Concurrent | type `0` | Up `0` | `[15, 25]`; `15 … 24`, step `1` | ctor `(2,4)`; actual `2…5` |
| normal Wave | type `0` | Up `0` | `[7.55, 17]`; `7.55 … 16.055`, step `.945` | active `[1.5,3]`: `1.5 … 2.85`, step `.15`; child `[.25,.75]`: `.25 … .70`, step `.05` |
| bomb Free | type `1` | Up `0` | `[10, 30]`; `10 … 28`, step `2` | one toss |
| bomb Concurrent | type `1` | Up `0` | `[15, 45]`; `15 … 42`, step `3` | ctor `(1,3)`; actual `1…4` |
| bomb Wave | type `1` | Up `0` | `[30, 60]`; `30 … 57`, step `3` | active `[1,2]`: `1 … 1.9`, step `.1`; child `[.25,.75]`: `.25 … .70`, step `.05` |
| dragon Free | type `6` | Down `1` | `[30, 75]`; `30 … 70.5`, step `4.5` | one dragon |
| magnet Free | type `4`, ID `14` | Down `1` | `[45, 90]`; `45 … 85.5`, step `4.5` | one magnet fruit |
| electric Free | type `3`, ID `13` | Down `1` | `[30, 60]`; `30 … 57`, step `3` | one electric fruit |

Native literals and construction occur in `ClassicBirdLayer::onEnter` `0x00148110–0x001484f4`, with the relevant literal pool at `0x001484f8–0x00148524`.

Shared toss invariants from `forensics/contracts/classic-toss-contract.md` remain mandatory:

- `Start` samples without resetting accumulated elapsed time;
- `Pause`, `Resume`, and `Stop` preserve elapsed and threshold;
- `Resume` does not sample;
- trigger comparison is strict `elapsed > threshold`;
- overshoot is discarded;
- rearm sampling happens before turn-specific RNG draws;
- Concurrent's recovered count call makes its constructor maximum effectively inclusive-plus-one as shown above;
- a Wave's internal Free controller has fixed `[0.25, 0.75]` bounds, starts then pauses on entry, and therefore consumes its initial threshold draw during attachment;
- Wave child elapsed/threshold survives pause/resume cycles.

The normal Wave is attached before the bomb Wave, so their child-entry draws occur in that order. Type `0` resolves normal fruit IDs `0–8` and the existing critical-selection branch. Type `1` is the standard bomb. Dragon bypasses the base toss sound. Magnet and electric use their special creation branches and likewise do not call the base toss sound. Downward ID `13` and `14` objects retain the factory's zero initial velocity.

### Magnet controller override

Classic Bird's magnet callbacks are mode-specific:

- Begin at `0x00147eb0`: set normal Free bounds to `[0.5, 1.5]`—grid `.5 … 1.4`, step `.1`—then pause bomb Free, Concurrent, and Wave.
- End at `0x00147f10`: restore normal Free bounds to `[0.75, 5.0]`, then resume the three bomb controllers.

Changing bounds does not resample the already stored normal threshold. Paused bomb controllers preserve elapsed and thresholds. This contract must be injected into a shared magnet implementation; reusing Classic's bounds would be wrong.

## Time, pause, and world speed

Classic Bird is untimed. No native `TimeManager` allocation or timer callback appears in its entry or terminal paths.

`EnableWorldSpeedUp(45.0f)` starts at scene entry, not after GOOD/LUCK. Thus the nominal `1.5`-second intro consumes part of the first delay: absent pauses, the first speed increase is near scene time `45.0` and gameplay time `43.5`.

`PhysicsLayer::SpeedUpDelayCallback` at `0x001615a4`:

1. checks the pre-add world speed against `2.0f`;
2. if it is less, performs float32 `+0.1f` and rearms another `45.0` delay;
3. otherwise does nothing and does not rearm.

Starting from `1.0f`, float32 accumulation reaches approximately `2.000000238418579` on the tenth increase. That tenth increase still rearms one final callback; the final callback observes the value not less than `2.0f` and becomes a no-op. Do not clamp to exactly `2.0`.

World speed scales only the Box2D step delta. Toss timers, action sequences, result timings, and session clocks continue on scheduler delta. Pause halts scheduler/action progress. `StopPhysicsWorld(bool)` gates the physics step; it is not a general scheduler stop.

The inherited background-music pause path has a Bird-specific asymmetry: pause conditionally pauses background music, while resume only resumes it when mode ID is `2`. Mode `3` therefore does not resume a paused background track.

## Cut, score, combo, miss, and bomb

### Fruit cuts

`ClassicBirdLayer::FruitCut` at `0x00148550` dispatches in this order:

- ID `13`: call `BombElectric::Start`, then `AddScore(10)`;
- ID `14`: create/attach `MagnetAnimation` with the Classic Bird begin/end callbacks, then `AddScore(10)`;
- every other ID: `AddScore(suppliedScore)`.

The shared ray/cut contract supplies ordinary score `1` or critical score `10`. `BaseBirdLayer::CreateBirdBlade` explicitly calls `ComboManager::FocusOnScoreManager` with the current score manager, so eligible fruit cuts participate in the shared rolling combo window. Preserve the recovered `> 0.25` expiration comparison, minimum count `3`, count-sized bonus, and conditional combo-sound RNG behavior. No Classic Bird path starts double-score state.

### Misses

`FruitFail` forwards the position to the shared `FruitFailManager`. The first three failures enqueue markers and increment the stored failure count after enqueue. Every pending marker completion checks the current count, and when it is exactly `3` may invoke the registered callback. Therefore multiple callbacks can occur if several markers complete after the third miss. Preserve this component behavior, while relying on the Classic Bird terminal guard for one result transition.

Failure does not mutate score.

### Standard bomb

`BombHit` at `0x00148064–0x001480f6` performs:

1. disable cutting;
2. stop all nine controllers in their start order;
3. stop `BombElectric`;
4. call `StopPhysicsWorld(true)`.

It makes **no** `ScoreManager` call. A faithful Bird bomb policy is zero score penalty.

The shared bomb entity attaches its explosion before notifying the layer. Its nominal action sequence is `0.25 + 1.0 + 1.25 = 2.5` seconds, then calls `ClassicBirdLayer::AfterBombHit` at `0x00148944`. That callback invokes guarded game over and calls `StopPhysicsWorld(false)`.

Multiple simultaneous bombs share a last-writer boolean physics gate; overlapping bomb and miss terminal paths retain the shared race characteristics. Tests should pin the observable contract without inventing cancellation not present in native.

### Miss-triggered shutdown

`GameOverCallback` at `0x001488b8` disables cutting, stops the same nine controllers in the same order, stops `BombElectric`, and calls guarded `GameOver`. It does not freeze physics during the GAME/OVER presentation.

The guard byte at `+0x2d4` is set before terminal sprites are constructed. Repeated bomb/miss callbacks must not create multiple result flows.

## GAME/OVER and result handoff

GAME:

- starts at top plus half-height;
- moves for `0.75` to `(0.5W, 0.575H)`;
- holds `1.0`;
- moves for `0.75` to `(-0.5W, 0.575H)`;
- completion calls `DisplayScoreCallback`.

OVER:

- starts below the bottom by half-height;
- moves for `0.75` to `(0.5W, 0.425H)`;
- holds `1.0`;
- moves for `0.75` to `(1.5W, 0.425H)`;
- has no completion callback.

Both are z-order `1`. Nominal presentation duration is `2.5` action seconds. There is no direct GAME/OVER audio call. An isolated standard-bomb hit reaches result after a nominal `2.5`-second explosion plus `2.5`-second terminal presentation.

`DisplayScoreCallback`:

1. calls the effects engine's `stopAllEffects`;
2. captures the parent;
3. creates generic `DisplayScoreLayer`;
4. passes mode `3`;
5. passes `ScoreManager::getBestScore()`, whose recovered implementation returns the same authoritative total-score field as `getTotalScore`;
6. removes the gameplay layer with cleanup;
7. attaches the result at z-order `1`.

## Ranking, coins, replay, and persistence

`DisplayScoreLayer::CheckCupAchievement` at `0x0014cd2c` selects the Bird branch around `0x0014ce7c–0x0014ceda`.

Settings symbols and keys:

| Rank slot | Native symbol address | Preference key |
|---|---:|---|
| first | `0x00482468` | `bird_classic_best_1` |
| second | `0x00482464` | `bird_classic_best_2` |
| third | `0x00482460` | `bird_classic_best_3` |

All load with default `0`. Ranking is inclusive:

```text
if score >= first:
  third = second
  second = first
  first = score
  rank = 1
else if score >= second:
  third = second
  second = score
  rank = 2
else if score >= third:
  third = score
  rank = 3
else:
  unchanged, no cup
```

Ties promote. The matching first/second/third effect sound is conditional on effects being enabled.

`DisplayScoreLayer::getSavedBestScore` at `0x0014da6c` selects `BirdClassicBest_1` for mode `3`. `DisplayScoreLayer::getPercentScore` at `0x0014dac0` returns float32 `0.8f` (`0x3f4ccccd`) for modes `3–5`.

Coin award:

```text
reward = truncTowardZero(float32(score) * float32(0.8))
newTotal = signedArmInt32Add(currentTotal, reward)
```

The shared result sequence invokes accounting after `1.75` action seconds, after the effect, coin, and badge reveals and before the label update. Preserve the existing result-particle sequence, including its `100`-particle burst at nominal `1.65`, `500` RNG draws, and cleanup at nominal `11.15`.

`Settings::setTotalCoins` at `0x00163eb4` updates the static value and calls a native flush wrapper whose body is a no-op. Rank setters also update globals. Retry/Menu do not call `Settings::SaveData`; durable storage waits for a later bulk save. Do not promise immediate per-result persistence.

`DisplayScoreLayer::RetryCallback` at `0x0014cbb0`:

- conditionally plays menu click;
- captures the parent and removes result;
- constructs a fresh `ClassicBirdLayer`;
- attaches it at z-order `1`.

Menu at `0x0014cc84` constructs a fresh `MainMenu` at z-order `1`. Neither path reloads a scene, delays, reseeds RNG, or calls `SaveData`.

## Audio and background-music contract

No direct background track starts on Classic Bird entry, intro completion, GAME/OVER, or result entry. Ordinary toss, fruit-cut, critical, combo, bomb, fail, pause, and result sounds use their shared component paths.

Bird-specific or special interactions:

- touch began requests swoosh before blade acceptance, with the RNG behavior described above;
- ID `13` starts `BombElectric`, then scores `10`;
- ID `14` starts `MagnetAnimation`, then scores `10`;
- GAME/OVER has no direct audio consumer;
- `Leaderboard/leaderboard_classic_bird.png` exists, but its direct native consumer has not been resolved and it must not be treated as proven result UI.

### Electric

`BombElectric::Start` marks itself active, resets/moves its node sprites over `1.0` second, and conditionally plays `Sounds/powerup.wav`.

At nominal `+1.0`, TurnOnElectric:

- conditionally plays `Sounds/electricexplose.wav`;
- conditionally calls `playBackgroundMusic("Sounds/electric.mp3", true)`;
- starts eight electric frames forever at `0.06666667` seconds each;
- activates its sensor;
- schedules TurnOff `15.0` seconds later.

Both electric effects and the background-music call are gated by the **effects** setting, not the music setting.

TurnOff marks off, conditionally calls `stopBackgroundMusic(false)`, moves nodes outward for `1.0` second, removes the animation sprite, and deactivates the sensor. `Stop` calls TurnOff only if the component currently considers itself on. It does not clearly cancel the one-second lead-in/owner callbacks, leaving a native latent-reactivation/leak edge. The terminal path calls `BombElectric::Stop`; later `stopAllEffects` does not itself stop a background-music channel.

### Magnet

`MagnetAnimation`:

- enters from above over `2.0` seconds;
- at `+2.0`, registers the mode Begin callback, schedules End `10.5` seconds later, starts line/flicker randomness on `.50–.75` intervals, and conditionally starts looping `Sounds/magnet.wav`;
- at `+12.5`, removes the line, starts a `2.0`-second exit, conditionally stops its effect handle, and immediately registers the mode End callback;
- disposes at nominal `+14.5`.

The gameplay controller override is active for nominal `10.5` seconds. No external cancel callback is evident. Terminal shutdown already stops all toss controllers, and result `stopAllEffects` ends effect audio, but native does not explicitly restore magnet bounds during that shutdown.

For Creator, unconditional cancellation/audio cleanup is the safer engineering adaptation. If adopted, document it as an intentional robustness divergence; do not mislabel it as exact native behavior.

## Canonical Bird assets and hashes

The following assets are directly named by Classic Bird/Bird Blade or are its mode-entry art. Dimensions and SHA-256 values come from `forensics/resources/resource-usage-map.json`. The same canonical paths are staged under `game/assets/game/480x800/` and `game/assets/game/720x1280/`; a sample extracted/staged hash comparison was identical.

| Canonical path | 480x800 dimension / SHA-256 | 720x1280 dimension / SHA-256 |
|---|---|---|
| `Birds/bird-anim-1-0.png` | `140x116` / `8cfd7c259ced34847b13a2362fd991c56d387a993c246844f768f76d4752de2a` | `172x138` / `1bea9fd86824eed54ea7e6372387939367be39f4c4c9b54bd90a3a43f7023732` |
| `Birds/bird-anim-1-1.png` | `138x118` / `e047a90442d623070012a9dc4b51eebee3a13558c51e1d8fe171498d091bed06` | `171x141` / `1b6d6bdd85ad017c2aaf73a182adbb042310b39fd30121125c0013dd27e1c09f` |
| `Birds/bird-anim-1-2.png` | `138x122` / `bde29b95e0967ec0ff60823254de58e6a7a8acd940e37961bce7d23d9bc762fd` | `171x146` / `26ae93451e95b0cd6fc35094cafba5cee7cbb8a5a58ce4e166424e15f2bb68c8` |
| `Birds/bird-anim-1-3.png` | `138x118` / `cc6be58b1d36be8cadff14ab98f104e0ca740c2ea2c8c9bdbd57357c097e0518` | `172x142` / `be7ff636f93decaec05d35d3ebfd1dbb9e3b2f6eced8cd806b0c551d4e4fdcb6` |
| `Birds/bird-anim-1-4.png` | `140x116` / `5e7657b18e71cee2a3a304d202672a32419767d1ab1a0ffa2336c50347b9a893` | `172x138` / `dc683c6baf837aed54766ee15b3fe46e3076028c5042a160b13b5db72316621b` |
| `Birds/bird-anim-1-5.png` | `139x111` / `712c344e1205a961150ecafb44b85eda724ccc82537fdf61cf14500dd3f825a8` | `172x130` / `c5b17e0e568f53b3e7c78d873a0b7e88d8fd6ad64b607e90f92fa9369ca26de4` |
| `Birds/bird-anim-1-6.png` | `137x108` / `5f9709e7bcb5ff0d9fbe0f1e13d4ac91c7bb6cfe45c17cfe88556eff58ecb963` | `168x129` / `b8652f2dd40fd828ed73d1d4c927ea1c8572dc611828912e955794e716b2c204` |
| `Birds/bird-anim-1-7.png` | `130x104` / `3c7650e37572f01dc01622c3d4ccc3a4320cf15197f10e01c427252addd87043` | `159x129` / `11b58094614e2bc5ab6eefebd9742d0d316071ff4270e01de8a2038639999969` |
| `Birds/bird-anim-1-8.png` | `137x108` / `840db407871ce4a3dc8bbd860d9a1ec4b015e4779cc39aef2896725281c5b263` | `168x129` / `bed63ea0aafe383af050efa896d4013f71e5a244eb4effce309826bb332e7816` |
| `Birds/bird-anim-1-9.png` | `139x111` / `5ccef8e8b87cfa9eec6a04871e648ff80ad307f5f78f888a0e22cc6599778aeb` | `172x130` / `eeab55d09b8b798ddba5e6c94d7d8e86f719bb38d9b8cf2ef35f407607d8ebfa` |
| `Birds/bird-left-1.png` | `110x102` / `907aa40042d08e7e0ea2bd10f908d6a5fcca6f0f13875e205b89374d340aa92a` | `129x116` / `242253091b0e524d3c177019427871d653e32b929a7398ba604485683b702100` |
| `Birds/bird-right-1.png` | `110x102` / `4dd9b6ac8978c6f30d19c913c86c153b35d7643ee9c4019cb600df54904bac51` | `129x116` / `566ad4615b3b56bc119f8f4c65fc42ef4edebe88773367acbe4cf48b9318de08` |
| `Blades/testblade7.png` | `64x65` / `2da2bf2b18fa27a049189003d03de4756424d664a41ef94869485ee998fc976f` | `64x65` / `2da2bf2b18fa27a049189003d03de4756424d664a41ef94869485ee998fc976f` |
| `Blades/Particles/X-Mas/xmasfive.png` | `46x44` / `2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2` | `66x64` / `a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3` |
| `Blades/Particles/X-Mas/xmasfour.png` | `51x59` / `5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385` | `70x83` / `7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39` |
| `Blades/Particles/X-Mas/xmashexa.png` | `32x36` / `36f8ce97327c768fe14e1169672bf5a53147fdb314b086d9559a38631710bef9` | `47x53` / `cc4217637576b6c7bb0c92d400905058e952c8bcded9fa90ea4423637d5a89ab` |
| `Blades/Particles/X-Mas/xmascircle.png` | `34x34` / `97f32efcd79fd577a2a23bede4724f8df0e6ccf4a331fdb481b9bad8622525c8` | `49x50` / `a5f33bf414f4e4c31fe2bea1ea66fbc6f52a8f495ac1436fb0e6a237b515719e` |
| `Text/text-good.png` | `112x25` / `afbd35e3868c1b5fc1d548788743e0dd86fbfe8583f7642363374869df673587` | `168x37` / `c761e88621b42b67c381a946d56c29f131396ebfdac3d83cd9fb132285a60580` |
| `Text/text-luck.png` | `112x33` / `41e981af0dce4e596957ea4f78a016acd738e5d3c9c9b2b9ccbeff5afea090a5` | `168x50` / `a6d9810c0e385fb9cd7c8654c75a21a87b5fe9b573cc20d3341e133106b83d94` |
| `Text/text-game.png` | `269x51` / `e80df53c8e543698e5f0ebd75ae3dd98af3ea2fa786498a39b08f361a7d68759` | `404x76` / `2ed3325c450decb7cbf7d03b10a2b03dca1c4b8a3b5a82a14b80bdb8b5a6ec95` |
| `Text/text-over.png` | `216x85` / `0ee1b07dd22462e27a15651260cb443a7793cbddf7ae8ce54c961276580ea07e` | `324x126` / `3ea360e113f8750ca56bf19eb3363b7ba80edcab3aa1cc0c0db25dfecee48374` |
| `Interfaces/mode-classic-bird.png` | `254x263` / `e1242f48cf788830127138da0562161e2e28327e2713ee87f3474ba9a4e5e9ea` | `345x358` / `0e278f2b58127c6c5a7d1a952b44acab7c0d2d59a9226eb5de1146679b6c00c8` |
| `Interfaces/object-classic-bird-des.png` | `149x202` / `d2d5de16663b25f855fc111138ae84ff5db3e1c006492c4427675fd4f328a433` | `223x301` / `3bd632663398ad584a31d470c2d3b511046d6aaa4a8fa3717c6ad1f0ee9d365c` |
| `Leaderboard/leaderboard_classic_bird.png` | `466x115` / `d959dd6755cfd7a666e8c8bd4d600c7e0b035eea9697cfcebc2358b7d077a66b` | `663x137` / `d1037998bdc06f9aceba578002ee2094d7c67dbb45dc12fde8d372a1409df94f` |

Relevant native string offsets include:

- Bird frame format `0x003d0c3b`;
- Bird main, left, and right formats `0x003d0c55`, `0x003d0c6e`, `0x003d0c85`;
- X-Mas particle paths `0x003d0c9d`, `0x003d0cc1`, `0x003d0ce5`, `0x003d0d09`;
- `Blades/testblade7.png` `0x003d0f3f`;
- candidate Bird leaderboard art `0x003d1399`.

### Shared mandatory resource closure

Classic Bird also requires the already recovered shared assets for:

- normal fruit intact/cut variants for IDs `0–8`;
- standard bomb and smoke;
- ID `13` electric-apple and ID `14` magnet-strawberry variants;
- all six dragon rasters;
- eight electric animation frames and left/right electric nodes;
- magnet and magnet-line;
- critical-cut particles;
- fruit-fail, HUD, pause, generic result, fonts, and all referenced audio.

Canonical paths and hashes for this shared closure are already enumerated in `forensics/resources/resource-usage-map.json` and grouped by `game/assets/scripts/domain/classic-resource-contract.ts`, `crazy-resource-contract.ts`, and `base-gameplay-resource-contract.ts`. Resolve hashes from the manifest in tests rather than duplicating a second mutable inventory.

`Blades/blade0.png` is not the Bird blade contract; Bird explicitly uses `testblade7`. Crazy-only timer/freeze fruit assets IDs `10–12` are not part of Classic Bird's mandatory closure.

All extracted/staged assets remain subject to the repository's stated copyright uncertainty. Presence and hash fidelity do not establish redistribution clearance.

## Creator integration delta

The current mode-selection presentation already knows the Classic Bird card, unlocked state, fruit ID `7`, and destination name `ClassicBirdLayer`. It does not query a mode-unlock key for this card. The current app shell, however, only resolves Classic and Crazy; `ClassicBirdLayer` is still an unsupported destination and the route fails closed.

Recommended slices, in dependency order:

1. **Bird foundation**
   - Add pure `BirdBlade` movement/cache and particle-plan domain code.
   - Add Bird resource contract/loader and a thin Creator presenter/physics-ray adapter.
   - Keep RNG injectable and preserve every draw, including idle intro frames.
2. **Classic Bird session**
   - Build the exact nine-controller configuration above on existing mode-neutral toss primitives.
   - Add Bird-specific start/stop order, magnet callbacks, untimed session state, and `45.0` world-speed configuration.
   - Do not copy Classic constants into this service.
3. **Gameplay integration**
   - Connect shared ray/cut/combo/fail/bomb components.
   - Make bomb score policy explicit as `0`.
   - Dispatch special effect before `+10` for IDs `13` and `14`.
4. **Presentation and result**
   - Reuse shared GOOD/LUCK, GAME/OVER, pause, and result adapters with mode `3`.
   - Add Bird ranking keys, inclusive triplet update, `0.8f` coins, fresh retry, and deferred settings durability.
5. **Route and cleanup**
   - Add the `ClassicBirdLayer` shell lifecycle transaction with existing fail-closed rollback semantics.
   - Decide and document the intentional safe cleanup policy for latent electric/magnet callbacks and audio.

Suggested domain boundaries, adjusted to local naming conventions when implemented:

- `bird-blade-state.ts`;
- `bird-blade-particle-plan.ts`;
- `bird-resource-contract.ts`;
- `classic-bird-toss-config.ts`;
- `classic-bird-session.ts`;
- `classic-bird-result-ranking.ts`;
- corresponding Creator presenters/loaders/controllers and vertical-slice tests.

## Deterministic acceptance tests

### Bird blade

- touch moved/ended are inert;
- touch began requests one swish before any acceptance check;
- busy blade rejects targets but still leaves the swish draw/play request;
- one multi-touch set accepts at most the first iterated target;
- scalar is float32 `W * 1234 / 480`;
- idle/move/settle transitions, left equality branch, strict-overshoot snap/cache, exact-step equality remaining in state `1`, `1/4` movement cache, and `RayCashDone` are exact;
- parent consumes at most one cached ray when observed;
- every update performs the particle gate draw, selected updates perform the second draw, and asset/lifetime/offset draw order matches the table;
- intro-frame idle particles advance the shared RNG.

### Toss/session

- assert all nine types, directions, bounds, counts, active windows, and construction order;
- assert Wave child entry draws normal Wave before bomb Wave;
- assert start and both stop paths use the exact order;
- assert timer strict `>`, no overshoot carry, sample-before-turn, state preservation, Concurrent effective counts, and Wave child preservation;
- assert magnet bounds and non-resampling pause/resume behavior;
- assert no TimeManager/double/bonus controller;
- assert world-speed delay starts at entry, increments in float32 every `45.0`, and includes the final armed no-op;
- assert toss/action clocks receive scheduler delta while physics receives scaled delta.

### Score/failure/bomb

- ID `13`: Electric Start before `AddScore(10)`;
- ID `14`: Magnet create/register before `AddScore(10)`;
- normal/critical/combo score behavior uses the shared score manager;
- three misses may emit repeated callbacks, but Classic Bird creates one terminal flow;
- bomb shutdown contains zero score calls, freezes physics, and unfreezes only after its delayed callback;
- miss shutdown does not freeze physics;
- overlapping bomb/miss and multiple-bomb cases preserve a one-shot result and shared boolean-gate semantics.

### Presentation/result/audio

- GOOD/LUCK coordinates, durations, and LUCK-only callback;
- GAME/OVER coordinates, durations, GAME-only result callback;
- result receives mode `3` and the authoritative score field;
- ranking uses inclusive promotion and Bird keys;
- reward uses float32 `0.8` then truncation and ARM-style int32 addition;
- retry/menu create fresh layers with no scene reload, reseed, delay, or save;
- result does not claim immediate preference durability;
- entry/intro/terminal/result do not invent a background track;
- Bird swish, electric, magnet, pause/resume asymmetry, and effect/music setting gates are tested explicitly;
- all directly required asset dimensions and SHA-256 values match the manifest.

## Static uncertainties and required adaptations

1. The native PRNG seed/algorithm initialization and stream start are not recovered here. Exact session sequences also depend on Wave entry draws, intro frame count, conditional audio draws, and parent/child scheduling.
2. Same-frame cached-ray latency and child update ordering are Cocos scheduler details not conclusively encoded in these stripped functions.
3. Multi-touch selection order follows `CCSet` iteration and should not be normalized into pointer-ID order without documenting a divergence.
4. Several sprite/particle defaults are implicit engine defaults. Reproduce the visible intent with explicit Creator properties, but label those values inferred until a lawful visual reference resolves them.
5. `Leaderboard/leaderboard_classic_bird.png` is canonical data but its direct result-screen consumer is unresolved.
6. The recovered electric collision fixture/pre-solve layout appears degenerate/unsafe in the native build. Do not copy unsafe memory/layout behavior; preserve user-visible electric activation semantics through a valid Creator sensor.
7. Native electric/magnet callback cancellation and audio cleanup contain leak-prone edges. Safe unconditional cleanup is recommended as a documented robustness adaptation.
8. Semantic names for stripped Bird state fields and inherited vtable slots are inferred even where their observable behavior is high-confidence.
9. No runtime or golden-image validation was performed or is authorized by this task.
10. Asset copyright/redistribution clearance is unknown.

## Implementation decision

Implement Classic Bird as a dedicated configuration and Bird-blade slice on top of the existing mode-neutral gameplay components. Do not subclass the recovered Classic mode service by default: its blade topology, magnet bounds, speed cadence, and bomb score policy are observably incompatible. Reuse shared primitives only where the contracts above match exactly, and make every Bird variance an injected, directly tested policy.

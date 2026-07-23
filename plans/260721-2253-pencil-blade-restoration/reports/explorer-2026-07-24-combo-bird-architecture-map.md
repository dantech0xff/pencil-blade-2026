---
title: Combo Bird mode-5 architecture map
type: explorer
date: 2026-07-24
status: done
scope: static-only production Combo Bird composition, contracts, files, and tests
baseline: committed HEAD 4cb00c7 plus explicitly identified in-flight Crazy Bird work
evidence-policy: static-only; original APK and libgame.so were not executed
---

# Combo Bird Mode-5 Architecture Map

## Summary

Restore Combo Bird as a new, narrow timed Bird runtime with recovered mode ID `5`.
Reuse the existing ordinary-fruit, BirdBlade, combo, score, objective, timer, pause,
audio, Result, settings, and Creator resource primitives. Do **not** add mode `5` to
`CrazyTimedModeProfile`, and do **not** profile `ClassicBirdSession`:

- Crazy owns bombs, bonus/special fruit, DoubleToss, freeze, magnet, electric, and
  dragon behavior that Combo Bird never constructs.
- Classic Bird owns nine toss controllers, three strikes, GAME/OVER, a speed ramp,
  and an early terminal flow that Combo Bird never invokes.
- Combo Bird owns exactly three ordinary-fruit toss controllers, a `90s` timer,
  three instruction cards, BirdBlade type `3`, combo scoring, no lives, and no bomb.

Three compatibility constraints must be explicit in code and tests:

1. Timer expiry calls inherited `Stop` on the three outer toss slots. Free and
   Concurrent stop producing, but Wave's internal Free child is not stopped by that
   call. If already active, it may continue spawning until its previously armed
   pause callback (constructor limits `1.5...3s`; recovered decile samples
   `1.5...2.85s`). Input, BirdBlade ray processing, physics, entities,
   ComboService, and ScoreService also remain live during the three-second TIME UP
   animation.
2. The result score is sampled at `TimeUpFinishCallback`, not at timer zero. It
   includes valid late cuts, combo closure, and any fruit produced by an already
   active Wave child.
3. The low-resolution extraction contains
   `480x800/Text/text-juscombo.png`, while the high-resolution extraction contains
   `720x1280/Text/text-justcombo.png`. Use one semantic
   `justComboInstruction` field with an explicit per-tree path. Never normalize,
   rename, synthesize, or fall back between spellings.

With uninterrupted frame advancement, the nominal on-enter timeline is:

```text
0.00s   three instruction cards begin concurrently
1.25s   TotalTimeCallback -> 90s card
2.50s   GoCallback -> GO card
3.75s   StartGameCallback -> tosses start, then 90s timer starts
93.75s  timer zero -> outer toss slots stop, TIME UP begins; an active Wave child
         and all entities remain live
96.75s  TimeUpFinishCallback samples current score and replaces gameplay with Result
```

The architecture is implementation-ready. The only original-runtime behavior left
unknown is whether Cocos2d-x had an implicit low-resolution alias for the misspelled
instruction asset. The target does not need that unknown behavior because its
per-resolution contract resolves the extracted files explicitly.

## Evidence Boundary and Confidence Labels

The requested root `README.md` does not exist. Repository evidence policy came from
`forensics/README.md`. No APK, Android activity, native library, emulator, or original
gameplay path was installed, loaded, or executed. Native conclusions came from
static ELF symbol/string inspection and Thumb-2 disassembly only.

Labels used below:

- **Recovered**: directly present in static native instructions, symbols, strings,
  extracted resources, hashes, or the Java/JNI settings boundary.
- **Inferred target adaptation**: target implementation decision needed to represent
  recovered behavior in the existing Creator architecture.
- **Unknown**: not established by the static corpus and must not be described as
  recovered.

Primary evidence:

- `forensics/native/function-map.csv:254,261,299-323,693`;
- `forensics/native/java-jni-boundary.md:157`;
- `forensics/resources/resource-usage-map.json:6070,6720,12742,13392,17129-17135,23388-23390`;
- `.forensics-work/phase-01/native/strings.txt:42325,42432-42434,42495,42510-42521,42576-42578,44205`;
- static Thumb-2 slices from
  `.forensics-work/phase-01/native/libgame.so` for
  `0x001494f4...0x00149d42`, shared toss strategies, BaseBirdLayer,
  ComboManager, ScoreManager, TimeManager, ObjectivesManager, and DisplayScoreLayer;
- extracted resources under
  `.forensics-work/phase-01/jadx/resources/assets/{480x800,720x1280}`;
- staged target resources under
  `game/assets/game/{480x800,720x1280}`;
- current owners under `game/assets/scripts/domain`,
  `game/assets/scripts/creator`, and `game/assets/scenes/classic.scene`;
- current vertical-slice tests under
  `tests/reconstruction/vertical-slice`.

`forensics/resources/resource-usage-map.json` calls the spelling pair a
`typo-mismatch`, but its near-match evidence lists both spellings as native strings.
The raw native string corpus contains only `Text/text-justcombo.png`. Raw native
evidence takes precedence over the generated near-match annotation.

## Recovered Native Anchors

| Native owner | Address | Size | Recovered responsibility |
|---|---:|---:|---|
| `ComboBirdLayer::GetGameMode` | `0x001494f4` | 4 | returns `5` |
| `StartGameCallback` | `0x001494f8` | 56 | starts Free, Wave, Concurrent, then TimeManager |
| `GoCallback` | `0x00149530` | 260 | presents GO and chains to start |
| `TotalTimeCallback` | `0x00149634` | 260 | presents 90s and chains to GO |
| `TimeUpFinishCallback` | `0x00149738` | 116 | stops effects, samples score, replaces gameplay with Result |
| `TimeUpCallback` | `0x001497ac` | 54 | stops three toss controllers and posts objective completion |
| `BonusFruitFail` | `0x001497e2` | 12 | objective selector `7`, payload `1` only |
| `FruitFail` | `0x001497ee` | 12 | objective selector `7`, payload `1` only |
| `FruitCut` | `0x001497fa` | 16 | forwards supplied score to ScoreManager |
| `onEnter` | `0x0014980c` | 1100 | composes the complete mode |
| constructor | `0x00149cd0` | 84 | BaseBird-derived layer construction |
| `GetReplayInstance` | `0x00149d24` | 30 | constructs a fresh ComboBirdLayer |
| inherited `TossTurn::Stop` | `0x00165124` | 8 | unschedules only the receiver's update |
| `WaveToss::DelayCallback` | `0x00165878` | 18 | pauses the internal Free child |
| `WaveToss::OnTossTurn` | `0x001658cc` | 100 | resumes child and arms delayed pause |
| `WaveToss::onEnter` | `0x00165930` | 74 | creates/starts/samples/pauses child |

The callback pointers are also statically fixed in the native GOT:

| GOT slot | Target |
|---:|---:|
| `0x00477388` | `0x001494f9`, `StartGameCallback` Thumb entry |
| `0x0047738c` | `0x00149531`, `GoCallback` Thumb entry |
| `0x00477390` | `0x001497ad`, `TimeUpCallback` Thumb entry |
| `0x00477394` | `0x00149739`, `TimeUpFinishCallback` Thumb entry |
| `0x00477398` | `0x00149635`, `TotalTimeCallback` Thumb entry |

These pointers close the intro and timer callback identity; they are not name-based
guesses.

## Exact Lifecycle and Callback Graph

### `onEnter`

Recovered high-level ordering:

1. call `BaseBirdLayer::onEnter`;
2. call `ObjectivesManager::ProcessGameEvent(7, 0)`;
3. create and attach Free, Wave, and Concurrent ordinary-fruit toss controllers;
4. create a TimeManager with total `90.0f`, target `this`, and callbacks
   `TimeUpCallback` and `TimeUpFinishCallback`;
5. attach TimeManager at z-order `1`; its label initially reads `90`;
6. create and start the three instruction sprite actions;
7. attach the instruction sprites in the recovered equal-z order;
8. create BirdBlade from `Blades/testblade7.png` with type `3`;
9. retain the shared BaseBird combo-to-score focus;
10. seed ScoreManager's displayed best-score reference from
   `Settings::BirdComboBest_1`.

The TimeManager creates its hidden freeze-clock sprite even though Combo Bird never
registers freeze-start/freeze-finish behavior and never calls freeze. Its scheduler
is not started during the intro. Because TimeManager is attached before the
instruction sprites, its own on-enter presentation already runs:

- label text `90`;
- MotorwerkOblique at font size `(logicalWidth / 480) * 36`;
- label position `(0.85 * logicalWidth, 0.95 * logicalHeight)`;
- normal RGB `(71,71,71)`;
- fade-in over `1.0s`;
- hidden freeze-clock centered at
  `(VisibleRect.right.x - 0.5 * clockWidth,
  VisibleRect.top.y - 0.5 * clockHeight)`.

The later `text-90s` card is a separate sprite; it does not create or replace the
countdown label.

### Concurrent instruction frame

All three instruction actions start in the same on-enter frame and use z-order `1`.
Construction/action order is `nobomb`, `justcombo`, `nolive`. Layer attachment order
is `justcombo`, `nobomb`, `nolive`. Equal z-order means the attachment order must be
preserved rather than replaced by a map iteration with unspecified ordering.

| Semantic card | Start/visible/exit | Visible y | Action | Callback |
|---|---|---:|---|---|
| `noBombInstruction` | left / center.x / right | `0.6 * logicalHeight` | move `0.5s`, delay `0.25s`, move `0.5s` | none |
| `justComboInstruction` | right / center.x / left | center.y | move `0.5s`, delay `0.25s`, move `0.5s` | `TotalTimeCallback` |
| `noLifeInstruction` | left / center.x / right | `0.4 * logicalHeight` | move `0.5s`, delay `0.25s`, move `0.5s` | none |

Only the middle action owns the continuation. The intro presenter therefore needs a
callback-once guard: the other two cards must never independently advance the
session.

### `TotalTimeCallback` and `GoCallback`

`TotalTimeCallback` creates `Text/text-90s.png` at z-order `1`, moves it
left-to-center for `0.5s`, holds for `0.25s`, moves center-to-right for `0.5s`,
then invokes `GoCallback`.

`GoCallback` repeats that exact `1.25s` action with `Text/text-go.png`, then invokes
`StartGameCallback`.

The target state graph should be explicit:

```text
constructed
  -> intro-instructions
  -> intro-ninety
  -> intro-go
  -> running
  -> time-up-presentation
  -> result-transition
  -> result-removed
```

Rejected transitions must throw before mutating state. Completion callbacks must be
idempotent at their owner boundary so a disposed/retired action cannot advance a
replacement run. That guard is a target ownership hardening for retired Creator
actions; the native TimeManager itself has no terminal guard, so do not describe the
guard as recovered.

### `StartGameCallback`

Synchronous recovered order:

1. start Free;
2. start Wave;
3. start Concurrent;
4. start TimeManager.

The order matters because starting a controller samples its next interval. Wave
construction also creates, starts/samples, and pauses its internal Free child during
on-enter setup. A deterministic RNG test must lock both setup-time and GO-time draw
order.

It also establishes running scheduler order: Free, Wave, and Concurrent receive the
host-frame delta before TimeManager. The Combo gameplay controller must tick the
coordinator before `TimeManagerPresenter.updateScheduler`; do not copy Crazy's
timer-before-coordinator frame order. On the expiry frame the outer tosses get that
frame's one turn opportunity before TimeManager stops them. A TIME UP action created
inside the scheduler callback begins consuming action delta on the next host frame,
not the already-consumed expiry delta.

### 90-second run

The TimeManager begins at `90.0f` only after GO completes. Shared TimeManager behavior
must remain:

- countdown label starts at `90`;
- `Start` schedules only; it does not reset time, warning state, label, color, or
  actions;
- each running update first subtracts float32 delta, then formats
  `minutes:zero-padded-seconds`; a positive first delta changes the on-enter `90`
  directly to the resulting `1:29...` value rather than synthesizing a `1:30` tick;
- `Sounds/timetick.wav` is requested for integer values `10` through `0` when effects
  are enabled and an update lands on the current warning second; skipped seconds are
  not backfilled;
- at zero, the emitted presentation order is tick audio, warning-color toggle,
  `Sounds/timeup.wav`, layer time-up callback, TIME UP presentation start, then the
  expiry label write (`0:00` only when remaining lands exactly on zero; a frame
  overshoot preserves native signed negative formatting);
- the TimeManager unschedules/stops itself before invoking the layer callback;
- after the callback returns, TimeManager begins the TIME UP sprite action.

No controller or physics delta is scaled by a recovered world-speed value. Combo
Bird has no `45s` speed ramp and no freeze speed.

### `TimeUpCallback`

The layer callback synchronously performs:

1. stop Free;
2. stop Wave;
3. stop Concurrent;
4. call `ObjectivesManager::ProcessGameEvent(7, 2)`;
5. return to TimeManager, which begins the TIME UP action.

It does **not**:

- disable Bird input;
- dispose or hide BirdBlade;
- stop physics;
- explicitly stop Wave's internal Free child;
- cancel an already armed Wave child-pause action;
- clear the cached Bird ray;
- purge, freeze, or retire active fruit;
- disable entity cut/miss callbacks;
- close or reset ComboService;
- stop ScoreService;
- capture the score;
- remove the gameplay layer.

The TIME UP sprite uses `Text/text-time-up.png` at z-order `1`:

1. left-to-center, `1.0s`;
2. center hold, `1.0s`;
3. center-to-right, `1.0s`;
4. internal TimeManager finish callback;
5. layer `TimeUpFinishCallback`.

`WaveToss` has no `Stop` override. Its inherited outer `TossTurn::Stop` only
unschedules the outer update and preserves timer state. If the internal Free child
was resumed by a pre-zero Wave turn, it remains scheduled until the existing delayed
pause callback fires. Because the active-window constructor limits are `1.5...3s`,
it can produce new
ordinary fruit during part of the three-second TIME UP presentation. The recovered
decile sampler's maximum active-window draw is `2.85s`, despite the constructor's
high limit of `3`.

Therefore new fruit from an already active Wave window, cuts, misses, combo
completion, combo bonus score, and ordinary fruit score remain valid throughout the
applicable late window. This is recovered behavior, not a target polish choice.

### `TimeUpFinishCallback`

Recovered synchronous order:

1. unconditionally call `SimpleAudioEngine::stopAllEffects`;
2. capture the gameplay parent;
3. construct `DisplayScoreLayer`;
4. call virtual `GetGameMode`, receiving `5`, and configure Result mode;
5. read the current ScoreManager;
6. call `ScoreManager::getBestScore` and configure Result score;
7. remove ComboBirdLayer from the captured parent with cleanup `true`;
8. attach DisplayScoreLayer to the captured parent at z-order `1`.

`ScoreManager::getBestScore` is misleadingly named in this binary. Its disassembly at
`0x00162914` returns the same current-run field (`+0x18`) as
`ScoreManager::getTotalScore` at `0x00162ac0`. `setBestScore` writes different fields
(`+0x1c/+0x20`). The Result input is consequently the authoritative current run score
at the end of TIME UP, not the persisted first-place score and not the score at timer
zero.

The Creator transaction may construct a detached Result before destroying gameplay
to support rollback, but its visible commit must preserve the recovered
stop-effects/capture/configure/remove/attach order and final z-order.

### Retry and main-menu navigation

`DisplayScoreLayer::RetryCallback` at `0x0014cbb0`:

1. if effects are enabled, play `Sounds/menubuttonclick.wav`;
2. capture Result's parent;
3. remove Result with cleanup `true`;
4. mode-switch on `5`;
5. construct a fresh ComboBirdLayer;
6. attach it to the captured parent at z-order `1`.

There is no callback-local delay, scene reload, scene replacement, save, shared-state
reset, or stop-effects request. Main-menu navigation has the same conditional click,
capture, Result removal, fresh MainMenu construction, and z-order `1` attachment.

The fresh run must allocate a new session, toss coordinator, entity registry, score,
combo window, TimeManager, BirdBlade state, and owner-bound input lease. Process-owned
settings, resource caches, audio presenter, random source, shared scene, and
ObjectivesManager remain shared.

## Composition Decision

| Concern | Reuse | Combo Bird owner/configuration | Explicit exclusion |
|---|---|---|---|
| identity/state | shared command patterns | new `ComboBirdSession`, mode `5` | no Crazy profile, no Classic Bird terminal session |
| toss timing | `ClassicFreeTossStrategy`, `ClassicWaveTossStrategy`, `ClassicConcurrentTossStrategy`, `TossTimer` | new three-row config/coordinator | no bombs, specials, DoubleToss, BonusToss |
| spawn planning | `ClassicSpawnPlanner`, `partitionClassicSpawnCommands`, object type `0` | fresh `ClassicEntityRegistry` instance | no Crazy registry required ports/resources |
| entities | `ClassicEntityRegistry`, `ClassicGeneratedFruit`, cut halves, critical effects | existing ordinary-only boundary | no bomb/special/dragon entities |
| input | `BirdInputController` | owner-bound lease for Combo scene | no ordinary blade input |
| blade/ray | `BirdBladeState`, presenter, ray adapter | type `3` | no mechanics fork |
| physics | `ClassicPhysicsAdapter` variable-step substrate | identity speed `1`, active through TIME UP | no speed ramp, freeze, bomb stop |
| score | `ScoreService`, HUD | ordinary score plus ComboService bonus | no score-at-zero snapshot |
| combo | `ComboService`, item presentation | strict `0.25s` window | no ComboManager fork |
| objective | `ObjectivesManagerState` | selector `7`, payloads `0/1/2` | no local objective tracker |
| timer | `TimeManagerService` and presenter | total `90`, no freeze callbacks | do not depend on loaded Crazy supplement |
| audio | shared Classic audio presenter/contracts | recovered paths and gates | no mode-owned music |
| result | shared result presenter/transaction | mode `5`, Combo Bird rank/navigation | no copied result presenter |
| persistence | process-owned settings runtime | `bird_combo_best_1..3`, factor `0.8` | no second settings runtime |
| shell | recovered app shell/shared scene | explicit `combo-bird` state | no unsupported destination |

## Toss and Spawn Contract

### Exact rows

| Slot | ID | Strategy | Object/direction | Outer interval | Inner/active/count |
|---:|---|---|---|---|---|
| `0x2a8` | `free` | Free | `0 / 0` | `[0.75, 5]s` | one ordinary spawn |
| `0x2ac` | `wave` | Wave | `0 / 0` | `[7.5, 20]s` | child `[0.25, 0.75]s`; active window `[1.5, 3]s` |
| `0x2b0` | `concurrent` | Concurrent | `0 / 0` | `[10, 25]s` | constructor `countMin=1`, `countMax=3`; actual inclusive draw `1...4` |

Recovered creation, equal-z attachment, start, and stop order is always:

```text
free -> wave -> concurrent
```

All controller nodes attach at z-order `1`. Wave setup starts/samples and immediately
pauses its child. The shared Concurrent implementation has a recovered inclusive
`countMax + 1` quirk; target output must remain one through four complete spawn plans,
not be “corrected” to one through three.

All interval limits in the table are constructor limits. The shared sampler uses
`q` from exactly `0.0, 0.1, ... 0.9` and returns float32
`low + q * (high - low)`. Its recovered grids are:

| Timer | Sample grid |
|---|---|
| Free outer | `0.75...4.575`, step `0.425` |
| Wave outer | `7.5...18.75`, step `1.25` |
| Concurrent outer | `10...23.5`, step `1.5` |
| Wave child | `0.25...0.70`, step `0.05` |
| Wave active window | `1.5...2.85`, step `0.15` |

Reuse `TossTimer` so float32 rounding, strict `elapsed > threshold`, discarded
overshoot, rearm-before-callback, and Start/Pause/Resume/Stop state preservation stay
exact.

### Coordinator ownership

`ComboBirdTossCoordinator` should:

- construct only the three rows above;
- reuse the shared strategies without subclassing them;
- expose `startAll`, `stopAll`, `tick`, controller snapshots, control log, and command
  sink in the same deterministic style as current coordinators;
- set up Wave during construction so RNG consumption matches native on-enter;
- make `stopAll` stop the three outer timers without stopping Wave's child or
  canceling pending child-pause callbacks;
- keep advancing Wave's pending pause actions and child timer during TIME UP;
- never expose magnet, bonus, bomb, special-fruit, or world-speed methods.

`ComboBirdTossConfig` should make the constructor bounds and actual Concurrent output
bounds separate named fields. Tests must assert both.

### Entity registry

Instantiate the existing `ClassicEntityRegistry`; it is already the narrow
ordinary-only boundary this mode needs. A fresh instance per run owns:

- ordinary `ClassicGeneratedFruit` instances only;
- occurrence/target/collider maps while each entity owns its body;
- object-type `0` spawn command batches;
- toss audio dispatch;
- bounds-exit detection and exactly-once miss callbacks;
- bidirectional Bird ray candidate lookup and one batch-finalization boundary;
- ordinary cut/miss/disposal callbacks and deferred after-physics disposal;
- complete cleanup on Result commit, run replacement, fatal rollback, and destroy.

The Combo gameplay controller remains responsible for ordinary cut audio, critical
effects, cut halves, score/combo callbacks, and continuing physics/bounds evaluation
during `running` and `time-up-presentation`.

Emit/journal the complete `ClassicTossStrategyCommand` stream, but send only its
spawn-command subset through `partitionClassicSpawnCommands` before calling
`applySpawnPlan`. Wave create/attach/start/pause scheduling commands describe
coordinator-owned timer state and need no duplicate Creator node. This keeps
Concurrent's one-to-four complete entity plans contiguous and makes each registry
call end in exactly one z-order-`1` attachment.

Do not create `ComboBirdEntityRegistry` and do not create dummy special/bomb ports to
satisfy `CrazyEntityRegistry` construction. Extend `ClassicEntityRegistry` only if a
concrete shared defect is proven during implementation; no such extension is
required by the recovered mode graph.

## Input, BirdBlade, Ray, and Physics Contract

### Input lease

`ComboBirdSceneController` acquires
`BirdInputController.activateForBirdLayer(this)` for each fresh run and records the
owner token in run ownership. Suspend, resume, Result transition, rollback,
replacement, fatal retained-runtime handling, and destroy must release or reacquire
that same owner-bound lease. An old run must never deactivate a newer global touch
listener.

Input and BirdBlade are active during the instruction/90s/GO intro. StartGameCallback
does not enable cuts or input; it only starts the three outer toss controllers and
TimeManager. Preserve intro touch/swishes and BirdBlade movement even though no
ordinary fruit controller has started yet.

Use the process-owned shared `GameplayRandom`. Intro swish and Bird particle draws
can therefore occur before StartGame samples the three outer toss intervals. A
per-mode or per-audio RNG would silently change recovered toss ordering; Retry also
must not reseed.

Recovered touch-began ordering remains:

1. if the shared `0.5s` swish gate allows and effects are enabled, choose/play one of
   `swoosh1...swoosh9`;
2. then call BirdBlade touch;
3. BirdBlade may reject the touch as busy.

The swish request therefore occurs before the BirdBlade busy guard. Touch moved and
touch ended do not drive BirdBlade.

### Blade and ray

Extend `BirdBladeType` from `1 | 2` to `1 | 2 | 3`; keep the default type `1`.
Type `3` changes resource identity only. Movement, float32 arithmetic, directional
sprite selection, animation, particle cadence, busy/settle state, touch acceptance,
and cached ray semantics remain shared.

Per frame:

1. update BirdBlade presentation/state;
2. read the cached bidirectional ray;
3. query all active ordinary fruit;
4. apply the complete successful cut batch;
5. acknowledge `RayCashDone` only after the batch succeeds.

On batch success, acknowledge the cached ray. If the callback throws or returns
false, retain the cached ray. Do not claim transactional rollback: the existing
registry's `finally` path may finalize fruit already cut before a later command
throws. The represented guarantee is success-only cache acknowledgement, not
reversal of already delivered entity callbacks.

### Physics lifetime

Reuse `ClassicPhysicsAdapter` variable-step simulation with a float32 identity speed
of `1`. Physics and entities continue through TIME UP. New Free/Concurrent turns and
new Wave outer windows stop, but an already active Wave child continues until its
armed pause callback. After the Result transaction commits, stop/destroy the run and
retire all entities.

No Combo Bird path may call:

- Classic Bird world-speed ramp;
- bomb-hit physics stop;
- Crazy freeze speed;
- magnet contact;
- electric contact;
- dragon behavior.

## Score, Combo, Miss, and Objective Contract

### Ordinary cut score

Native `ComboBirdLayer::FruitCut(position, fruitId, suppliedScore)` ignores position
and fruit ID in its own body and passes `suppliedScore` to ScoreManager. The ordinary
fruit pipeline supplies base score `1` or critical score `10`. Preserve the existing
ordinary cut sequence and pass the recovered supplied score through once.

### Combo score

Reuse `ComboService` exactly:

- the window closes only when elapsed time is strictly greater than `0.25s`;
- fewer than three cuts resets with no combo result;
- three or more cuts emits, in order:
  1. objective selector `0`, payload equal to combo count;
  2. create combo item;
  3. add combo count to score;
  4. attach combo item at z-order `1`;
  5. if effects are enabled, choose/play `Sounds/compo1.wav`,
     `Sounds/compo2.wav`, or `Sounds/compo3.wav`;
  6. reset the window.

Do not fold ordinary fruit score and combo bonus into one aggregate callback. Their
ordering and presentation side effects are independently observable.

### Miss behavior

Both `FruitFail` and `BonusFruitFail` only post
`ProcessGameEvent(7, 1)`. They do not:

- remove a life or add a strike;
- subtract score;
- stop tosses or physics;
- present fail marks or GAME/OVER;
- end the run.

The recovered graph has no BonusToss/BonusManager producer, so
`BonusFruitFail` remains a compatible callback surface with no normal producer.

### Objective selector

Use `ObjectivesManagerState.processGameEvent(7, payload)`:

| Payload | Recovered moment | Objective-49 behavior |
|---:|---|---|
| `0` | on-enter | reset “No fruits drop Combo Bird” progress |
| `1` | ordinary or bonus fruit miss | increment miss count |
| `2` | timer zero after toss stop | complete only if miss count remains zero |

Selector `7` maps to active objective ID `49`. Do not create a Combo-specific
objective state or translate the selector in the gameplay controller.

Payload `2` is submitted at timer zero, before the late TIME UP window. If objective
49 finishes there, a later miss still invokes selector `7`, payload `1`, but the
shared manager ignores it because the objective is already finished. Do not defer
the success decision to `TimeUpFinish` and do not revoke a recovered award after a
late miss.

## Result, Ranking, Persistence, and Settings Contract

Create `combo-bird-result-ranking.ts` by composing the existing recovered ranking
helpers, not by copying arithmetic:

- mode ID: `5`;
- keys: `bird_combo_best_1`, `bird_combo_best_2`,
  `bird_combo_best_3`;
- defaults: `0`, `0`, `0`;
- shared total-coins default remains `2014`; retry does not reset it;
- rank insertion uses `>=`, so a tie promotes and shifts older values down;
- panel values remain first, second, third;
- coin factor is float32 `Math.fround(0.8)`;
- bonus truncates toward zero;
- coin addition uses signed 32-bit wrapping behavior.

Create `combo-bird-result-navigation.ts` with the same transaction shape as the
current Bird result navigation:

- conditional menu-button audio;
- capture Result parent;
- remove Result with cleanup `true`;
- retry constructs fresh mode `5` Combo Bird and attaches at z-order `1`;
- menu constructs fresh MainMenu and attaches at z-order `1`;
- callback absences explicitly assert no delay, reload, replace-scene, reset, save,
  or stop-effects action.

Extend `ClassicSettingsState` and `ClassicSettingsRuntime` with a private Combo Bird
leaderboard:

- constructor/default/load fields;
- getter;
- `recordComboBirdResultScore`;
- `awardComboBirdResultCoins`;
- inclusion of all three keys and total coins in the existing later bulk-save path.

Preserve the existing public `ClassicSettingsSnapshot` shape unless another consumer
already requires leaderboard exposure. Mode-specific leaderboards are currently
private getters, so widening the process snapshot is unnecessary.

Result commit records the in-memory leaderboard once. The shared Result accounting
callback awards in-memory coins after nominal `1.75` action seconds, before its
total-coin label update. Rollback must not double-insert a score or double-award
coins.

Do not add an immediate bulk save. The native rank setters and coin accounting update
process-static state; `Settings::setTotalCoins` reaches a no-op flush wrapper; Retry
and Menu do not call `Settings::SaveData`. Durable leaderboard/coin storage waits for
the existing later bulk-save boundary. Navigation's explicit `saves: false` is
therefore literal, not shorthand for “already saved.”

## Resource Contract

### Existing shared ownership

Do not copy or restage assets. The target already contains the recovered files.

- Mode Select already owns and contracts
  `Interfaces/mode-combo-bird.png` and
  `Interfaces/object-combo-bird-des.png`.
- The shared Classic process catalog owns ordinary fruit, cut halves, effects, HUD,
  background/theme, Result common assets, audio, and Razing.
- Bird loader owns the 17-raster type-3 closure.
- New Combo Bird loader owns only its intro/TimeManager supplement and
  MotorwerkOblique.

`Leaderboard/leaderboard_combo_bird.png` exists in both trees, but its original
runtime consumer is not established by this mode's static callback graph. Do not add
it to the gameplay loader solely because the filename contains `combo_bird`. The
shared Result presenter currently renders its own common panel and numeric values.

### Combo intro/TimeManager supplement

Each cell is `dimensions; bytes; SHA-256`.

| Semantic resource | `480x800` | `720x1280` |
|---|---|---|
| `Text/text-go.png` | `70x31`; 1672; `f21d11c77a670ef73bf765b87f87df77aa061fdddb461d6b5b6e17054c8f636a` | `106x47`; 2371; `f1f217f37199b736465fd392339fc6f4611591eddd5d16faa198b9bbe3f6191c` |
| `Text/text-90s.png` | `169x33`; 3187; `80670e6fce817d8055ba4b191c43d79d3c597e41df346b95da5a434034f9d4da` | `252x49`; 4655; `56dc0eeef3272306e478c0d7c04385e7bcbc8f1b2bd021bec149a6e733c7daa9` |
| `Text/text-nobomb.png` | `231x34`; 3693; `b6a8f50b6ff0cd90f2d20a729f0e50929f440de8880b6da8354a2498a6090cf9` | `347x51`; 5397; `2f369a6a895540b822432d72077ac59859541ab8c3d788410cdc25b5c824a412` |
| `justComboInstruction` | see explicit alias rule below | see explicit alias rule below |
| `Text/text-nolive.png` | `190x32`; 2914; `a4a089e70fb0c59d6744bc8119321285fb06e43ae01037b7b3734a1ea4013848` | `285x47`; 4101; `3e4307e819db38c31130e84054bbf4ed77cac121fa067d9268be179444648dea` |
| `Text/text-time-up.png` | `345x135`; 13675; `64459f6fe18b22f35269adf3f27a01a369fee4899a5437f132545bbdcf8f9980` | `481x165`; 19750; `4a0f07207a1e5c34c5e374a56537cd0b7415f9fa9ec32763c43b5284844fdac2` |
| `Interfaces/object-time-freeze.png` | `148x85`; 7711; `1370c725709262023dfae741844ddd55b7574f39527aacb1206a27c4a21b2446` | `222x127`; 11914; `7c92dc89735e21af9cd74ef3e9ef3035707e8356e07e25a443e78c79610537a1` |

This supplement is exactly seven rasters per selected tree plus shared
`Fonts/MotorwerkOblique.ttf` (21908 bytes,
SHA-256 `79e1421be053bcbdcbb729f1757c68e063da4790fe4bd2862db3b7cdad348a34`).

The freeze-clock image is required because shared TimeManager constructs the hidden
node; its presence does not authorize freeze gameplay.

### Mandatory `juscombo` / `justcombo` rule

Define the semantic field once:

```ts
interface ComboBirdSupplementalRasterSet {
  readonly justComboInstruction: GameRasterResource;
  // other exact semantic fields
}
```

Resolve it with a literal per-tree table:

| Tree | Exact canonical path | Dimensions | Bytes | SHA-256 |
|---|---|---:|---:|---|
| `480x800` | `480x800/Text/text-juscombo.png` | `286x44` | 4375 | `80d64678f2225a962ebaa4cd51078b127757bf21381ef473d96d2cfd614edfb3` |
| `720x1280` | `720x1280/Text/text-justcombo.png` | `404x51` | 5744 | `2b589491c7d68bd24e638b8d6c3ec05fb5b652094ad8e54c4f6f0291f4994d5d` |

Rules:

- no `${tree}/Text/text-justcombo.png` synthesis;
- no case-insensitive or edit-distance lookup;
- no low-to-high or high-to-low fallback;
- no duplicated/renamed target asset;
- no claim that the native binary performed this alias;
- loader fails closed if the exact selected path or dimensions are absent;
- static tests hash the staged bytes and assert that the opposite spelling is absent
  from each resolution tree.

**Recovered**: raw native string is `Text/text-justcombo.png`; low extraction contains
only `text-juscombo`; high extraction contains only `text-justcombo`; the files have
the dimensions/hashes above.

**Inferred target adaptation**: both files fulfill the one semantic instruction slot
because they occupy the complementary resolution trees and the native callback graph
requires that slot.

**Unknown**: whether the original low-resolution Cocos2d-x search aliased, tolerated,
or failed the mismatch at runtime.

### BirdBlade type-3 exact profile

The profile contains 17 rasters in loader order:

```text
testblade7
bird-anim-3-0 ... bird-anim-3-9
bird-left-3
bird-right-3
xmasfive, xmasfour, xmashexa, xmascircle
```

The table below is `dimensions; bytes; SHA-256`.

| Logical path | `480x800` | `720x1280` |
|---|---|---|
| `Birds/bird-anim-3-0.png` | `140x116`; 6948; `84f4cfed54fa8bbe281e7696c125adfd236d953dbddd1c983952003198131469` | `172x138`; 11566; `47208e7d85ac674a0eb077736747c9d7922bcbdf7f2c527b07bff042a793101b` |
| `Birds/bird-anim-3-1.png` | `138x118`; 7010; `78e20af57ae170c76c69c597909d4a20b2cb1f8440e9cabc9134aab220408bf3` | `171x141`; 11559; `b7d3695dcb6fd72a026e50fb48515df56684c93be0d8fc04b58df6c4a11e173e` |
| `Birds/bird-anim-3-2.png` | `138x122`; 7324; `908678c95e5d2cf1238ce2e362be0fd71aa3850b8b0635a8b4aeee96ce07edda` | `171x146`; 12028; `64f928e4529f7dd7e8335ee06a181f2308bc989dcdfa4d4a54d2123e6ce2e7a0` |
| `Birds/bird-anim-3-3.png` | `138x118`; 6952; `32d516672f155605ff95197ed9823eba0e7b037f59a3ca8ef7d3c47a8e5f4b36` | `172x142`; 11498; `04618bba4665fc7f1490ba751ff890297ca05bd6f14c170a3fe0aa41ced0433f` |
| `Birds/bird-anim-3-4.png` | `140x116`; 6928; `d76c56ff64f10e983d1c9766f4f0fe6c9310dbeeade3dfd86ffe711a4a0e897e` | `172x138`; 11332; `751e4e6236efdb131f5a59c94b778b334fb389c074a54a1931615fdf41370c7e` |
| `Birds/bird-anim-3-5.png` | `139x111`; 6588; `9b39285134175bc146fee8db6d599858ac177769a8b1dbb50768db6d2a3d7356` | `172x130`; 10956; `6394bb0f5ba399b7b5727f5ea3a57aee720b8953a4600feb070c89cc9dc19efa` |
| `Birds/bird-anim-3-6.png` | `137x108`; 6434; `46b20d80f5bc1a855930cd2e12c6ee5ad4c58d3af027350b4d3e63d61d2e80ae` | `168x129`; 10693; `a6802b57e3b2a4acfb59e1aadfc81754a4d05a0c023ca7884f74cd5118d2032b` |
| `Birds/bird-anim-3-7.png` | `130x104`; 5918; `ea9fbbed8b3ac05e3972868e2b26342bf3ac9da08f41097c27e9f3696c656fe2` | `159x129`; 10059; `f0ee2e8b1b433a3861c8ef9066690a6bc2e927a08d92185a838c2a51b1488e63` |
| `Birds/bird-anim-3-8.png` | `137x108`; 6442; `5881d5df17cac5784b20c6328d5d08dbd4471ed15ec64d536c164a3e0c44276e` | `168x129`; 10652; `4c7be27fca727fbf5107684efb6e97e38149553bc5d731e3480bc929d9520b2a` |
| `Birds/bird-anim-3-9.png` | `139x111`; 6565; `78553602b0777904a3306edb8d12da633b2cbe905753cd0bc122126b9a43c52f` | `172x130`; 10865; `d393db02b12d062f2032e88387a90601fc238e24c5dc1333814fdd6e8cf6bb50` |
| `Birds/bird-left-3.png` | `110x101`; 4394; `499351b465fe18f405225eb118bbce5fa25372d2ffeb6be30c14ea92ee2bcccc` | `129x115`; 6616; `b2cad209b1beaa9dea1545e6c3e515d2bde3ecbdaa9fdcaf370e73790675cb15` |
| `Birds/bird-right-3.png` | `110x101`; 4395; `c6db8bbde60fe6207c701343e15ff787346751636ab9e22172397c7a0b13c427` | `129x115`; 6490; `81253c4ec11d4cbc3164b38cfbc6831fb391f3af1c2c433391038adeb8c57a00` |
| `Blades/Particles/X-Mas/xmasfive.png` | `46x44`; 1029; `2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2` | `66x64`; 1408; `a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3` |
| `Blades/Particles/X-Mas/xmasfour.png` | `51x59`; 914; `5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385` | `70x83`; 1216; `7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39` |
| `Blades/Particles/X-Mas/xmashexa.png` | `32x36`; 800; `36f8ce97327c768fe14e1169672bf5a53147fdb314b086d9559a38631710bef9` | `47x53`; 957; `cc4217637576b6c7bb0c92d400905058e952c8bcded9fa90ea4423637d5a89ab` |
| `Blades/Particles/X-Mas/xmascircle.png` | `34x34`; 869; `97f32efcd79fd577a2a23bede4724f8df0e6ccf4a331fdb481b9bad8622525c8` | `49x50`; 1196; `a5f33bf414f4e4c31fe2bea1ea66fbc6f52a8f495ac1436fb0e6a237b515719e` |
| `Blades/testblade7.png` | `64x65`; 2122; `2da2bf2b18fa27a049189003d03de4756424d664a41ef94869485ee998fc976f` | `64x65`; 2122; `2da2bf2b18fa27a049189003d03de4756424d664a41ef94869485ee998fc976f` |

Contract cardinalities after type `3` is added:

- one selected Bird profile: `17`;
- shared across all profiles: `5`;
- type-specific per profile: `12`;
- unique union of type `1`, `2`, and `3`: `41`, replacing the current two-type
  combined count `29`.

Keep `BIRD_RESOURCE_PROFILES` as the backward-compatible type-1 map. Add type `3` to
`BIRD_RESOURCE_PROFILES_BY_TYPE`, the direction-dimension table, resolver validation,
loader tests, presenter mismatch checks, and exact staged-byte hash tests.

### TimeManager resource decoupling

`TimeManagerPresenter` currently accepts `LoadedCrazyResources`, imports the Crazy
supplement count/contract, and rejects any resource set whose count is not the Crazy
count. Combo Bird must not load all Crazy resources to satisfy that accidental type
coupling.

Extract a narrow resource port owned by TimeManager, for example:

```ts
interface TimeManagerResourcePort {
  readonly assetTree: GameAssetTree;
  readonly timeManagerFont: Font;
  readonly freezeClock: LoadedGameRasterResource;
  readonly timeUp: LoadedGameRasterResource;
}
```

Both Crazy and Combo loaders adapt their exact loaded resources to that port.
TimeManager validates the two raster dimensions and font validity, not a caller's
unrelated total raster count. This is a real shared boundary and should be extracted
before Combo gameplay is wired.

## Audio Contract

Reuse the shared presenters and contracts. Do not add Combo-specific copies of paths.

| Trigger | Exact audio | Gate/order |
|---|---|---|
| Mode Select card fruit ID `6` cut | `Sounds/apple.wav` | effects-enabled cut effect |
| Mode Select navigation commit | `Sounds/gameplayselected.wav` | existing selection command |
| touch began | random `Sounds/swoosh1.wav` ... `swoosh9.wav` | effects enabled and `0.5s` gate; before busy guard |
| ordinary fruit toss | `Sounds/tossfruit.wav` | effects enabled |
| ordinary cut IDs `0...8` | apple, banana, strawberry, waterfruit, waterfruit, mangosteen, apple, strawberry, apple | base sound first |
| critical ordinary cut | `Sounds/critical.wav` | after base fruit sound |
| combo count `>=3` | random `Sounds/compo1.wav` ... `compo3.wav` | after item attach/score command |
| timer integers `10...0` | `Sounds/timetick.wav` | effects enabled |
| timer zero | `Sounds/timeup.wav` | effects enabled; before stop/callback/presentation |
| objective completion | `Sounds/cheer.wav` | shared objective presenter |
| Result rank | `Sounds/firstplace.wav`, `secondplace.wav`, or `thirdplace.wav` | shared Result rank |
| Result retry/menu | `Sounds/menubuttonclick.wav` | effects enabled, before capture/remove |

`TimeUpFinishCallback` calls stop-all-effects unconditionally before Result creation.
No Combo-specific music start or stop was found. Main-menu music remains app-shell
owned; do not invent gameplay music. Random swish/combo selection shares the gameplay
RNG, so effects-enabled state can alter later toss draws exactly as in the shared
native contract.

## Ownership and Failure Boundaries

| Owner | Lifetime | Responsibilities |
|---|---|---|
| `RecoveredAppShellController` | process/scene | prepare resources, mode-select transition, `combo-bird` state, pause/result/main-menu events |
| `ComboBirdGameplayController` | serialized Creator component | resource cache, presenter composition, entity presentation, Result transaction |
| `ComboBirdSceneController` | serialized Creator component plus per-run ownership | fresh session/toss/physics/input lease, pause/suspend/resume, frame ordering |
| `ComboBirdSession` | one run | legal lifecycle and recovered command batches |
| `ComboBirdTossCoordinator` | one run | three controller timers and deterministic RNG/control order |
| fresh `ClassicEntityRegistry` instance | one run | ordinary entities, contacts, ray cuts, misses, deferred disposal |
| `ScoreService` / `ComboService` / `TimeManagerService` | one run | existing exact algorithms |
| `BirdInputController` | shared component, leased | one current Bird owner |
| settings/audio/random/shared scene | process-owned | retained across retry |

Preparation should be independent from Crazy:

1. after the currently serialized Bird/Crazy preparation chain settles, prepare the
   Combo intro supplement and Bird type `3`;
2. catch a preceding mode preparation failure before continuing, so another mode is
   not a logical prerequisite;
3. cache Combo success/failure separately;
4. never make Crazy availability depend on Combo preparation.

Construction must be detached and rollback-safe. If Result attachment fails after
gameplay removal, follow the same retained-runtime/fatal handling already used by
Bird controllers; never leave two active input leases or apply ranking twice.

## Exact File Map

### Create

Domain files, each with a Creator `.meta`:

- `game/assets/scripts/domain/combo-bird-toss-config.ts`
- `game/assets/scripts/domain/combo-bird-toss-coordinator.ts`
- `game/assets/scripts/domain/combo-bird-intro-presentation.ts`
- `game/assets/scripts/domain/combo-bird-session.ts`
- `game/assets/scripts/domain/combo-bird-result-ranking.ts`
- `game/assets/scripts/domain/combo-bird-result-navigation.ts`
- `game/assets/scripts/domain/combo-bird-resource-contract.ts`

Creator files, each with a Creator `.meta`:

- `game/assets/scripts/creator/combo-bird-intro-presenter.ts`
- `game/assets/scripts/creator/combo-bird-resource-loader.ts`
- `game/assets/scripts/creator/combo-bird-scene-controller.ts`
- `game/assets/scripts/creator/combo-bird-gameplay-controller.ts`

Focused tests:

- `tests/reconstruction/vertical-slice/combo-bird-toss-config.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-toss-coordinator.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-intro-presentation.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-intro-presenter.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-session.test.ts`
- `tests/reconstruction/vertical-slice/classic-entity-registry.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-result-ranking.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-result-navigation.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-resource-contract.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-resource-loader.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-scene-controller.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-gameplay-controller.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-retry-lifecycle-executable.test.ts`
- `tests/reconstruction/vertical-slice/combo-bird-result-menu-lifecycle-executable.test.ts`

### Modify

Bird type `3`:

- `game/assets/scripts/domain/bird-blade-state.ts`
- `game/assets/scripts/domain/bird-resource-contract.ts`
- `game/assets/scripts/creator/bird-resource-loader.ts`
- `game/assets/scripts/creator/bird-blade-presenter.ts`
- their current focused tests:
  `bird-blade-state.test.ts`, `bird-resource-contract.test.ts`,
  `bird-resource-loader.test.ts`, `bird-blade-presenter.test.ts`,
  `bird-input-controller.test.ts`, and `bird-blade-ray-adapter.test.ts`.

Shared TimeManager seam:

- `game/assets/scripts/creator/time-manager-presenter.ts`
- `tests/reconstruction/vertical-slice/time-manager-presenter.test.ts`
- `tests/reconstruction/vertical-slice/time-manager-service.test.ts` only if command
  coverage needs the mode-5 timing case; the service algorithm should not change.

Settings:

- `game/assets/scripts/domain/classic-settings-state.ts`
- `game/assets/scripts/creator/classic-settings-runtime.ts`
- `tests/reconstruction/vertical-slice/classic-settings-state.test.ts`
- `tests/reconstruction/vertical-slice/classic-settings-runtime.test.ts`.

Mode Select and app shell:

- `game/assets/scripts/creator/mode-select-presenter.ts`
- `game/assets/scripts/creator/recovered-app-shell-controller.ts`
- `game/assets/scenes/classic.scene`
- `tests/reconstruction/vertical-slice/mode-select-state.test.ts`
- `tests/reconstruction/vertical-slice/mode-select-presenter.test.ts`
- `tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts`
- `tests/reconstruction/vertical-slice/creator-scene-integration.test.ts`.

`mode-select-state.ts` already contains `ComboBirdLayer`; it should require no domain
identity change. Remove Combo Bird from
`ModeSelectUnsupportedDestination`, add `onComboBirdRequested`, validate it, and
dispatch the existing destination through the new explicit lifecycle branch.

The app shell must add:

- required Combo scene/gameplay component references;
- `combo-bird` state;
- independent boot preparation;
- mode-select-to-Combo transition;
- Combo result-main-menu and retry plumbing;
- pause quit-to-main-menu plumbing;
- event subscribe/unsubscribe pairs;
- rollback and retained-runtime fatal handling;
- serialized component entries/references in `classic.scene`.

Do not modify the large Crazy controller to host Combo mode. Do not add unused
special-resource ports to the new Combo controller.

## Implementation Order

1. Extend Bird type `3` resource/state/presenter contracts and lock all 17 exact
   staged resources.
2. Extract the narrow TimeManager resource port without changing Crazy behavior.
3. Add Combo intro resource contract/loader, including the literal spelling alias.
4. Add toss config/coordinator and deterministic RNG/order tests.
5. Add Combo session and intro presentation state/plan.
6. Add ranking/navigation and settings persistence.
7. Integrate a fresh existing `ClassicEntityRegistry` and add its missing focused
   shared test.
8. Add Combo scene controller with Bird input lease and late TIME UP activity.
9. Add Combo gameplay controller and shared Result transaction.
10. Wire Mode Select, app shell, scene serialization, pause, retry, and menu.
11. Run focused tests, then the complete vertical-slice suite and strict Creator
    TypeScript check.

This order keeps shared-contract changes ahead of runtime wiring and gives each
failure a narrow proof surface.

## Acceptance Test Matrix

### Native identity and lifecycle

- mode constant and Result mode are exactly `5`;
- intro construction/attachment order and all five action durations/positions;
- exactly one instruction continuation from `justComboInstruction`;
- controller start order precedes TimeManager start;
- each running frame ticks coordinator before TimeManager, including the expiry
  frame, and a newly created TIME UP action consumes no already-used expiry delta;
- timer is inactive through `3.75s` intro and then runs exactly `90s`;
- timer-zero order is tick audio, warning-color toggle, timeup audio, timer stop,
  Free/Wave/Concurrent stop, objective `(7,2)`, TIME UP presentation, then the
  unclamped expiry label write;
- TIME UP is exactly `1s + 1s + 1s`;
- score sampled at finish, not at zero;
- stop-all-effects occurs before Result construction;
- gameplay removal cleanup `true` precedes Result attach z-order `1`.

### Late TIME UP activity

Executable test:

1. spawn fruit just before timer zero;
2. cross zero;
3. prove Free, Concurrent, and new Wave outer turns cannot fire;
4. with Wave child dormant, prove no new fruit appears;
5. in a separate case, enter zero with Wave child active and prove it can spawn until
   its existing pause callback, but not afterward;
6. prove input, physics, ray query, miss, ordinary score, and combo bonus still work;
7. cut during TIME UP;
8. finish at three seconds;
9. assert Result receives the post-zero score.

Also prove a fruit miss during TIME UP posts `(7,1)`, does not end the mode, and
cannot revoke objective 49 if `(7,2)` already completed it at zero.

### Toss/RNG

- rows, slot offsets, object type, direction, intervals, and z-order;
- Wave child setup consumes a sample before GO;
- start/stop/control order `free,wave,concurrent`;
- Concurrent constructor bounds `1,3` and actual outputs `1...4`;
- spawn command batches remain contiguous;
- no bomb/special/bonus command can be emitted.

### Blade/entities

- type `3` accepted; `0`, `4`, fractional, and mismatched profiles rejected;
- type-1 default and type-2 Crazy Bird regressions remain green;
- owner lease replacement/old-owner release safety;
- swish before busy rejection;
- bidirectional ray and success-only acknowledgement;
- deferred disposal and exactly-once miss/cut callbacks;
- no physics stop or speed mutation at timer zero.

### Resources

- per-profile count `17`, shared count `5`, type-specific count `12`, combined count
  `41`;
- every type-3 path, dimensions, bytes, and SHA-256 above in both trees;
- literal low `text-juscombo` and high `text-justcombo` mapping;
- opposite spelling absent from each tree;
- loader exact-path/dimension fail-closed behavior;
- TimeManager accepts Crazy and Combo resource adapters and rejects malformed
  font/time-up/freeze-clock resources without checking unrelated catalog counts.

### Score/objective/result/settings

- supplied ordinary score forwarded once;
- combo closes strictly after `0.25s`, threshold `>=3`, exact command order;
- `(7,0)`, `(7,1)`, `(7,2)` event sequence and objective ID `49`;
- no life, strike, score penalty, or early terminal behavior;
- ties promote with `>=`;
- `bird_combo_best_1..3`;
- float32 `0.8`, truncation toward zero, signed int32 addition;
- Result transaction records once and awards once at the shared `1.75s` accounting
  callback, without an immediate bulk save;
- retry creates a fresh mode-5 run but keeps process-owned state;
- retry/menu callback absences remain explicit.

### Shell/Creator

- Combo destination is no longer unsupported;
- boot failure is isolated from Classic, Crazy, Classic Bird, and Crazy Bird;
- mode-select card ID `6` audio ordering remains apple then gameplay-selected;
- `classic.scene` contains both Combo components and valid UUID references;
- event handlers are paired on enable/disable;
- pause quit, Result menu, retry, rollback, and fatal retained-runtime paths leave
  exactly one screen and at most one Bird input owner.

### Quality gates

Run:

```sh
node --test tests/reconstruction/vertical-slice/combo-bird-*.test.ts \
  tests/reconstruction/vertical-slice/classic-entity-registry.test.ts \
  tests/reconstruction/vertical-slice/bird-*.test.ts \
  tests/reconstruction/vertical-slice/time-manager-*.test.ts \
  tests/reconstruction/vertical-slice/classic-settings-*.test.ts \
  tests/reconstruction/vertical-slice/mode-select-*.test.ts \
  tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts \
  tests/reconstruction/vertical-slice/creator-scene-integration.test.ts

node --test tests/reconstruction/vertical-slice/*.test.ts

tsc -p game/tsconfig.json --pretty false --noEmit
```

Use the repository's approved Creator 3.8.8 TypeScript binary/environment for the
last command.

## Recovered / Inferred / Unknown Ledger

### Recovered

- mode ID `5`;
- function identities, callback pointers, and callback ordering above;
- three concurrent instruction cards and all action durations/positions;
- `90s` total and `3s` TIME UP presentation;
- exact three-controller graph, rows, order, intervals, and Concurrent quirk;
- Wave outer stop does not stop an already active internal Free child or cancel its
  pending pause callback;
- BirdBlade type `3`;
- ordinary-fruit-only composition;
- supplied-score forwarding and shared combo behavior;
- objective selector `7`, payloads `0/1/2`, objective ID `49`;
- no life/strike/terminal miss behavior;
- score remains readable until TimeUpFinish and is sampled there;
- stop-all-effects/result/retry order;
- mode-5 storage keys and result factor;
- in-memory rank/coin mutation with durability deferred to the later bulk-save
  boundary;
- exact extracted/staged resource paths, dimensions, byte sizes, and hashes;
- raw native `Text/text-justcombo.png` string and asymmetric extracted filenames;
- listed audio paths and absence of a Combo-specific music command in the recovered
  mode graph.

### Inferred target adaptations

- a dedicated narrow Combo session/controller pair is the safest Creator ownership
  model;
- one semantic `justComboInstruction` field maps the complementary extracted
  filenames;
- detached construction plus transactional commit represents native synchronous
  remove/add while preserving current rollback guarantees;
- a narrow TimeManager resource port is the correct shared seam;
- the existing ordinary-only `ClassicEntityRegistry` is preferable to fake Crazy
  dependencies or a duplicate Combo registry.

### Unknown

- original low-resolution runtime response to the misspelled instruction path;
- whether `leaderboard_combo_bird.png` was consumed by an original screen outside
  this gameplay/Result callback graph;
- original-frame substep behavior beyond the recovered action durations when a frame
  crosses multiple callback thresholds.

None of these unknowns blocks the specified target implementation. Preserve them as
evidence notes rather than encoding guesses in production symbols or tests.

## Unresolved Questions

None blocking. The low-resolution native alias mechanism remains unknown, but the
literal target mapping above resolves the target without asserting an original
mechanism.

Status: DONE

Summary: Static Combo Bird mode-5 lifecycle, ownership, resource, score, objective,
audio, persistence, file, and test contracts mapped for implementation.

Concerns/Blockers: Preserve scoring, entity activity, and any already-active Wave
child during the three-second TIME UP presentation; do not normalize the
low-resolution `text-juscombo` filename.

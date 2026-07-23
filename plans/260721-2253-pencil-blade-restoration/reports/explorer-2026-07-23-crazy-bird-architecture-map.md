---
title: Crazy Bird mode-4 architecture map
type: explorer
date: 2026-07-24
status: done-with-concerns
scope: production Crazy Bird composition and implementation order
baseline: committed HEAD 4cb00c7 plus explicitly identified in-flight mode-4 result/settings work
evidence-policy: static-only; original APK and libgame.so were not executed
---

# Crazy Bird Mode-4 Architecture Map

## Summary

Implement Crazy Bird as an immutable per-run profile of the existing Crazy timed
pipeline, with the shared Bird input/blade/ray substrate configured as bird type `2`.

Do **not** subclass or reuse `ClassicBirdGameplayController` or
`ClassicBirdSceneController` as the mode-4 runtime. Those owners encode the wrong
game: three-strike terminal flow, `GAME -> OVER`, Classic Bird toss rows, a `45s`
speed ramp, physics stop on bomb, and no Crazy `TimeManager`, DoubleToss, BonusToss,
freeze, or special-fruit graph.

Do **not** add a third copy of the approximately 3,700-line Crazy/Classic Bird
gameplay orchestration either. The smallest safe seam is:

1. profile `CrazySession` for mode-specific identity and objective/result commands;
2. let the existing `CrazySceneController` select exactly one input lease per run;
3. let the existing `CrazyGameplayController` select exactly one cut driver and one
   result/settings profile per run;
4. expose explicit Crazy Bird app-shell methods/events so mode `1` and mode `4`
   cannot be confused at navigation boundaries.

This keeps the proven Crazy fruit, toss, timer, audio, pause, result, and cleanup
transactions in one owner. `ClassicBirdSceneController` remains the reference for
owner-bound Bird input and retained/fatal physics rollback behavior only.

The static native contract is implementation-ready with tracked inferences, but an
exact-fidelity claim remains blocked on the operand/order slices listed in
`researcher-2026-07-23-crazy-bird-native-contract.md`, especially
`CrazyBirdLayer::ActionGoCallback` at `0x0014A478...0x0014A51B`.

## Evidence Boundary

The requested root `README.md` does not exist. Repository policy came from
`forensics/README.md`; no APK, activity, native library, emulator, or original
gameplay path was launched or loaded.

Primary architecture evidence:

- `game/assets/scripts/domain/crazy-session.ts:18-347`;
- `game/assets/scripts/domain/crazy-toss-config.ts:3-217`;
- `game/assets/scripts/creator/crazy-scene-controller.ts:62-492`;
- `game/assets/scripts/creator/crazy-gameplay-controller.ts:340-3396`;
- `game/assets/scripts/creator/classic-bird-scene-controller.ts:54-646`;
- `game/assets/scripts/creator/classic-bird-gameplay-controller.ts:533-1028`;
- `game/assets/scripts/creator/bird-input-controller.ts:13-68`;
- `game/assets/scripts/domain/bird-blade-state.ts:7-311`;
- `game/assets/scripts/domain/bird-resource-contract.ts:78-188`;
- `game/assets/scripts/creator/bird-resource-loader.ts:49-72`;
- `game/assets/scripts/creator/bird-blade-presenter.ts:115-141,828-846`;
- `game/assets/scripts/creator/crazy-physics-adapter.ts:43-103`;
- `game/assets/scripts/creator/classic-physics-adapter.ts:101-230`;
- `game/assets/scripts/creator/mode-select-presenter.ts:112-141,1622-1637`;
- `game/assets/scripts/creator/recovered-app-shell-controller.ts:69-77,289-323,409-438,566-694,802-960`;
- `game/assets/scenes/classic.scene:513-582`;
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-bird-native-contract.md`;
- the companion static resource map from the mode-4 resource scout.

At scout time, `crazy-bird-result-ranking.ts`,
`crazy-bird-result-navigation.ts`, their metas/tests, and Crazy Bird settings edits
were concurrent uncommitted work. They match the required seams below, but they are
not used as proof of the committed baseline.

## Composition Decision

| Concern | Reusable owner | Mode-4 configuration or adapter | Must not be reused |
|---|---|---|---|
| timed state machine | `CrazySession` | immutable `CRAZY_BIRD_TIMED_PROFILE` | `ClassicBirdSession` terminal graph |
| toss graph | `CrazyTossCoordinator`, `CRAZY_TOSS_ROWS`, BonusManager, ComboService | same candidate Crazy rows/order, pending native closure | Classic Bird toss config/coordinator |
| timer/intro | `TimeManagerService`, `CrazyIntroPresenter` | `60s -> GO`, `60.0s` | GOOD/LUCK and GAME/OVER |
| scene bridge | existing `CrazySceneController` | Bird input lease and mode-4 session profile | Classic Bird speed/stop scene policy |
| physics | `CrazyPhysicsAdapter` over `ClassicPhysicsAdapter` | speed `1`, freeze speed `0.5` | Classic Bird `45s` ramp and terminal world stop |
| input | `BirdInputController` | owner-bound lease for mode-4 run | ordinary `BladeInputController` for mode 4 |
| blade | `BirdBladePresenter`, `BirdBladeRayAdapter`, `BirdBladeState` | bird type `2` | `ClassicBladePresenter` and type-1-only identity |
| entities/effects | `CrazyEntityRegistry` and all Crazy generated entities/presenters | unchanged Crazy callbacks | Classic Bird fail/word/strike presenters |
| audio | process-owned `CrazyAudioPresenter` plus existing Classic audio owner | unchanged Crazy audio paths and gates | a new Crazy Bird audio catalog/owner |
| resources | Classic base catalog + Crazy 37-raster/font supplement + Bird profile | Bird profile `2`; 17-profile closure, 12 incremental rasters after type 1 | a copied Crazy resource contract |
| objectives | shared `ObjectivesManager` | selectors `9` no-bomb and `5` no-drop | Crazy selectors `8` and `4` |
| result presentation | existing `ClassicResultPresenter` transaction | mode `4`, Bird Crazy rank/reward/navigation bindings | mode-1 retry or Classic Bird terminal transition |
| settings | process-owned `ClassicSettingsRuntime` | `bird_crazy_best_1..3`, float32 `0.8` reward | a second settings runtime |
| app shell | existing recovered shell and Mode Select presenter | explicit `crazy-bird` state/handlers/events | unsupported fallback for mode 4 |

### Why profile the Crazy owners

Mode 4 differs from mode 1 at a small set of edges:

- base-entry command identity;
- objective selector pair;
- input lease;
- cut driver and post-physics query;
- best-score leaderboard;
- result mode/ranking/retry command identity;
- app-shell state and main-menu event identity.

Everything inside those edges is Crazy behavior. A second gameplay controller would
duplicate the most failure-prone code: provisional Result ownership, pause standby
runs, audio suspension, entity retirement, delayed bomb callbacks, and commit/rollback
ordering. Profiling the current owner changes fewer contracts and makes mode-1/mode-4
parity directly testable.

The profile must be captured inside every `CrazyRunOwnership` value. It must not be a
mutable controller-wide flag read later by delayed callbacks; otherwise a retired
mode-1 bomb/result callback could mutate a newer mode-4 run or vice versa.

## Exact Domain Seam

### `CrazySession`

Keep `new CrazySession(initialBestScore)` exactly mode `1` for compatibility. Add an
optional frozen profile or explicit factory:

```ts
interface CrazyTimedModeProfile {
  readonly kind: 'crazy' | 'crazy-bird';
  readonly mode: 1 | 4;
  readonly bestScoreKey: 'crazy_best_1' | 'bird_crazy_best_1';
  readonly noBombObjectiveEventId: 8 | 9;
  readonly noDropObjectiveEventId: 4 | 5;
  readonly baseEntryCommand:
    | 'enter-base-gameplay-layer'
    | 'enter-base-bird-layer';
  readonly capturedParentBoundary:
    | 'captured-crazy-parent'
    | 'captured-crazy-bird-parent';
  readonly captureCommand: 'capture-crazy-parent' | 'capture-crazy-bird-parent';
  readonly removeCommand: 'remove-crazy' | 'remove-crazy-bird';
}
```

Recommended constants:

- `CRAZY_TIMED_PROFILE`: mode `1`, key `crazy_best_1`, selectors `8/4`;
- `CRAZY_BIRD_TIMED_PROFILE`: mode `4`, key `bird_crazy_best_1`,
  selectors `9/5`.

The profile changes only emitted identity. It must not fork the state-machine
algorithm in `CrazySession.enterScene`, `completeIntro`, `bombHit`, `timeUp`, or
`timeUpFinish`.

Required mode-4 command differences:

| Phase | Mode 1 | Mode 4 |
|---|---|---|
| entry | `enter-base-gameplay-layer` | `enter-base-bird-layer` |
| objective reset | `(8,0)`, `(4,0)` | `(9,0)`, `(5,0)` |
| miss | `(4,1)` | `(5,1)` |
| bomb | `(8,1)` | `(9,1)` |
| time up | `(8,2)`, `(4,2)` | `(9,2)`, `(5,2)` |
| best key | `crazy_best_1` | `bird_crazy_best_1` |
| Result mode | `1` | `4` |
| capture/remove | Crazy identity | Crazy Bird identity |

Do not translate mode-1 commands in a wrapper after they are emitted. Command
translation can drift at precisely the miss/bomb/time-up branches that need fidelity.
Generate the exact identity from one configured session.

Do not create `crazy-bird-toss-config.ts`,
`crazy-bird-toss-coordinator.ts`, or a copied session state machine. The shared table
is the candidate mode-4 implementation table. Keep the native confidence note outside
the runtime API; do not encode forensic finding IDs in production symbols.

### Candidate-order gate

`CRAZY_TOSS_START_ORDER` currently supplies the Crazy GO sequence. The native report
identifies the candidate mode-4 order as:

```text
ab,b0,b2,ac,b1,b3,ad,b5,ae,af
```

with `b4` omitted. Do not silently claim this is independently recovered for mode 4.
Before an exact-fidelity release, close the static `ActionGoCallback` slice. If the
operands differ, add the order to `CrazyTimedModeProfile`; do not duplicate the
coordinator.

## Bird Type-2 Resource and Blade Seam

The resource scout recovered this exact closure:

- unchanged Crazy supplement: 37 raster paths/profile plus MotorwerkOblique;
- Razing remains the separately owned result font;
- Bird type-2 profile: 17 rasters;
- type-specific: `bird-anim-2-0..9`, `bird-left-2`, `bird-right-2`;
- shared: `testblade7`, `xmasfive`, `xmasfour`, `xmashexa`, `xmascircle`;
- incremental raster delta after the Classic Bird type-1 foundation: `12`;
- complete mode-owned composition: `54` raster/profile entries, with shared process
  owners rather than 54 new loads.

Generalize, do not copy:

- `BirdBladeType = 1 | 2` now; reserve type `3` only when its consumer is restored;
- `getBirdResourceProfile(assetTree, birdType = 1)`;
- `loadBirdResources(assetTree, birdType = 1)`;
- `LoadedBirdResources` carries the resolved `birdType` and frozen profile;
- `BirdBladeStateOptions` accepts `type`, default `1`;
- `BirdBladePresenter` derives the state type from loaded resources and rejects a
  mismatched profile.

The contract must be keyed by type, not inferred only from common paths. Type-2
direction geometry differs from type 1:

| Resolution | Type 1 left/right | Type 2 left/right |
|---|---|---|
| `480x800` | both `110x102` | left `110x101`, right `111x101` |
| `720x1280` | both `129x116` | both `129x115` |

Animation geometry matches type 1, but hashes differ. Keep movement, busy state,
cached-ray behavior, particle cadence, and RNG semantics unchanged.

`CrazyGameplayController.prepareCrazyBirdRuntime()` should await the existing Crazy
preparation and load Bird profile `2` into its own separately cached promise. App-shell
boot should sequence that request after the settled Classic Bird preparation to avoid
concurrent bundle work, but a failed Classic Bird preparation must be caught before
the sequence continues so type 1 is not a logical prerequisite for mode 4.

Mode-4 preparation failure must not poison `prepareCrazyRuntime()` or make mode `1`
unavailable.

## Scene, Input, and Physics Ownership

### One scene owner, one input lease

Keep `CrazySceneController` as the timed-mode scene bridge. Add
`@requireComponent(BirdInputController)` and an explicit mode-4 activation facade,
while preserving the existing mode-1 facade:

- `activateCrazyLayer(best)` creates a default mode-1 session and acquires
  `BladeInputController`;
- `activateCrazyBirdLayer(best)` creates a mode-4 session and acquires
  `BirdInputController.activateForBirdLayer(this)`.

Exactly one input owner is active. Suspend, resume, replacement, Result removal, and
destroy must release the same input lease recorded in the run profile. Never release
Bird input without the owner token; `BirdInputController` deliberately prevents an
older scene from releasing a newer scene's global listener.

The serialized Canvas already owns all required components:

- `CrazySceneController` at `classic.scene:525-534`;
- `CrazyGameplayController` at `classic.scene:537-546`;
- `BirdInputController` at `classic.scene:548-558`.

Therefore this architecture needs no new gameplay/scene component, meta UUID, or
scene JSON entry. `creator-scene-integration.test.ts:20-80` should remain green and
should gain a static assertion that the profiled Crazy scene requires Bird input.

### Cut-driver boundary

Add a private discriminated cut driver to each gameplay run:

```ts
type CrazyCutDriver =
  | Readonly<{ kind: 'standard'; presenter: ClassicBladePresenter }>
  | Readonly<{
      kind: 'bird';
      presenter: BirdBladePresenter;
      ray: BirdBladeRayAdapter;
    }>;
```

Centralize branches in four places only:

1. construct/dispose;
2. per-frame presenter update;
3. touch handling;
4. post-physics cut query.

Mode-4 touch ordering must match the recovered Bird substrate:

1. request Crazy swish audio;
2. pass the point to `BirdBladePresenter.touch`;
3. preserve first-touch-wins/busy rejection inside the presenter.

Swish is requested before the busy decision, as in
`ClassicBirdGameplayController:962-983`.

After each variable physics step, mode 4 consumes at most one cached Bird ray:

1. call `BirdBladeRayAdapter.consumeRayPlan`;
2. acknowledge stale/no-ray when cuts are disabled or the registry is empty;
3. raycast forward and reverse through `CrazySceneController.raycastAll`;
4. dispatch existing Crazy cut commands/entity callbacks;
5. complete ray-query cuts;
6. send surviving fruit positions to the shared `ComboService.checkCombo`.

Do not route combo through `ClassicBirdSession.checkCombo`; Crazy's combo service,
popup, score, objectives, and audio remain authoritative.

### Physics

Mode 4 uses `CrazyPhysicsAdapter`, including normal speed `1` and freeze speed `0.5`.
It does not use:

- Classic Bird's `45.0s` progressive speed-up;
- `setWorldStopped(true)` on bomb;
- terminal physics freeze;
- Classic Bird's run-generation bomb policy.

Strengthen the current scene lease while adding the second profile. Mirror
`ClassicBirdSceneController`'s two-bit ownership:

- `physicsLeaseActive`;
- `physicsRestorePending`.

`CrazyPhysicsAdapter.deactivate()` currently delegates restoration and clears its
active flag only after the call succeeds. A partial restore can leave ownership
ambiguous. The scene must retain a retryable cleanup obligation, enter a fatal
quiescent boundary if rollback cannot restore the lease, and never reactivate Mode
Select over a possibly poisoned Physics2D singleton.

The app shell must continue to restore `NonClassicPhysicsAdapter` before activating
either timed mode, then reacquire the non-gameplay collision filter after exit or
failed activation.

## Gameplay, Audio, and Shared Resource Ownership

`CrazyGameplayController` remains the single process owner for:

- shared Crazy RNG;
- Classic settings runtime borrowed from `ClassicGameplayController`;
- Classic base resources;
- Crazy 37-raster resource supplement;
- Crazy Dragon font;
- Crazy audio presenter and retained loops;
- ObjectivesManager;
- Crazy generated entity registry;
- Crazy intro, timer, electric, magnet, bomb, combo, pause, and Result presenters.

The per-run ownership record gains:

- frozen `CrazyTimedModeProfile`;
- `CrazyCutDriver`;
- mode-correct scene activation facade;
- mode-correct result-navigation binding.

Do not create a Crazy Bird audio contract, entity registry, intro presenter, timer
presenter, pause presenter, result presenter, BonusManager, ComboService, or toss
planner. All paths and effect rules are Crazy-family behavior.

Keep update ordering from `CrazyGameplayController:436-520`. The only mode-4
substitution is `BirdBladePresenter.update(delta)` at the blade slot. During intro,
Bird idle particles may consume the shared RNG before GO. That is a recovered
composition consequence; do not reseed to force mode-1 toss equivalence.

## Result and Settings Seams

### Ranking and reward

The thin `crazy-bird-result-ranking.ts` binding is the correct new boundary:

- mode `4`;
- `bird_crazy_best_1`, `_2`, `_3`;
- inclusive `>=` ranking through `recovered-result-ranking.ts`;
- float32 high factor `0.8`;
- truncation toward zero;
- signed-int32 total-coin addition.

Do not copy the ranking algorithm.

### Shared settings owner

Extend `ClassicSettingsState`/`ClassicSettingsRuntime`; do not create a Crazy Bird
settings store.

Required seam:

- private frozen `birdCrazyLeaderboardValue`;
- getter `birdCrazyLeaderboard`;
- load and save all three Bird Crazy keys;
- `recordCrazyBirdResultScore`;
- `awardCrazyBirdResultCoins`.

Preserve the existing `ClassicSettingsSnapshot` public shape unless a caller truly
needs another serialized snapshot field. The in-flight approach of passing Bird
leaderboards separately to the private constructor preserves that contract.

Rank and coin mutations remain in memory until the existing bulk-save boundary.
Retry and Menu do not force a save. `RecoveredAppShellController.onApplicationHide`
continues to save the one process settings runtime.

### Result transaction

Reuse the existing Crazy Result presenter and participant transaction, selected by
the run profile:

1. session emits capture, construct, mode `4`, authoritative score, remove, attach;
2. gameplay constructs a provisional `ClassicResultPresenter`;
3. presenter preview uses `birdCrazyLeaderboard`;
4. scene enlists exactly one participant;
5. participant `prepareCommit`;
6. session commits `result-removed`;
7. participant commits root ownership;
8. settings calls `recordCrazyBirdResultScore`;
9. reward is applied only from the presenter's accounting callback.

Any failure before step 6 must roll back presenter, settings preview ownership,
Bird input, Physics2D, and the old run. Failure after the irreversible commit is
reported and must not rearm the Time Up callback.

Use the thin mode-4 `crazy-bird-result-navigation.ts` command vocabulary. Retry must
construct a fresh profiled Crazy Bird run; it must never call the mode-1 Crazy retry
path. Main Menu retains the captured parent, z-order `1`, no scene reload, no reseed,
and no implicit save.

## App-Shell and Mode-Select Seams

### Mode Select

`mode-select-state.ts` already owns all six destination identities. Change only
presentation dispatch:

- add `onCrazyBirdRequested` to `ModeSelectPresenterLifecycle`;
- add an exact `CrazyBirdLayer` branch in `dispatchModeNavigation`;
- exclude `CrazyBirdLayer` from `ModeSelectUnsupportedDestination`;
- leave `GNStyleLayer` mode `2` and `ComboBirdLayer` mode `5` in the unsupported
  fallback.

Do not add handlers for modes `2` or `5`, and do not weaken the fallback to a generic
success.

### Shell state and preparation

Add `'crazy-bird'` to `RecoveredAppShellState`. Keep the existing
`CrazyGameplayController` component; add no new required controller field.

Boot order:

1. prepare Classic;
2. prepare Crazy base/supplement;
3. prepare Classic Bird type 1 after Crazy settles;
4. prepare Crazy Bird type 2 after Classic Bird settles;
5. catch/report each optional-mode preparation failure independently;
6. present foreground shell resources.

The shell must check a distinct `crazyBirdPrepared` state before navigation.

### Enter mode 4

Add `transitionModeSelectToCrazyBird(transaction)` and model its compensation after
the stronger Classic Bird transition:

1. validate exact destination `CrazyBirdLayer`;
2. require type-2 preparation;
3. detach Mode Select root and suspend its input;
4. restore the non-gameplay physics filter;
5. call `crazy.activateCrazyBirdFromAppShell(sharedScene)`;
6. commit shell state `'crazy-bird'`;
7. on failure, restore the old root, reacquire the non-gameplay filter, assert it is
   active, and rearm Mode Select input;
8. if either timed-mode lifecycle restoration or shell compensation fails, enter
   shell state `'failed'`.

Do not copy the weaker mode-1 rollback that only logs some restoration failures.
The profiled Crazy scene should expose a typed fatal lifecycle error so both modes
can use the stronger shell rule.

### Leave mode 4

Expose distinct events, even if their payload interfaces share structure:

- `CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT`;
- `CRAZY_BIRD_PAUSE_QUIT_REQUESTED_EVENT`.

The shell handlers must:

- accept requests only while state is `'crazy-bird'`;
- capture every effectful request property exactly once;
- reject invalid/stale requests by running their rollback;
- transition through the existing Main Menu construction owner;
- commit the request once after shell state/root commit;
- aggregate root, physics-filter, input, request, and foreground rollback failures;
- retain a fatal shell failure when compensation cannot prove the old run active.

Do not branch on the shell's current state inside a generic mode-1 event after an
asynchronous delay. Separate event identity prevents a retired mode-1 request from
being accepted as mode 4.

## File Boundary

### Required new production files

| File | Purpose |
|---|---|
| `game/assets/scripts/domain/crazy-bird-result-ranking.ts` + `.meta` | thin mode-4 rank/reward binding |
| `game/assets/scripts/domain/crazy-bird-result-navigation.ts` + `.meta` | explicit retry/menu mode-4 command identity |

These files were already in-flight at scout time.

### Required modifications

| File | Scoped change |
|---|---|
| `game/assets/scripts/domain/crazy-session.ts` | frozen timed-mode profile; mode-1 default; exact mode-4 selectors/base/result identities |
| `game/assets/scripts/domain/bird-blade-state.ts` | parameterized Bird type with type-1 default |
| `game/assets/scripts/domain/bird-resource-contract.ts` | type-indexed profiles and type-2 paths/geometry |
| `game/assets/scripts/creator/bird-resource-loader.ts` | explicit type load and tagged result |
| `game/assets/scripts/creator/bird-blade-presenter.ts` | propagate/validate type; preserve mechanics |
| `game/assets/scripts/domain/classic-settings-state.ts` | Bird Crazy leaderboard load/save/rank/reward |
| `game/assets/scripts/creator/crazy-scene-controller.ts` | per-run profile, exclusive standard/Bird input lease, retained/fatal physics cleanup |
| `game/assets/scripts/creator/crazy-gameplay-controller.ts` | type-2 preparation, per-run cut driver/profile, mode-4 result/settings/events |
| `game/assets/scripts/creator/mode-select-presenter.ts` | exact mode-4 lifecycle dispatch; keep 2/5 fallback |
| `game/assets/scripts/creator/recovered-app-shell-controller.ts` | state, prep, enter/leave transactions for mode 4 |

### Deliberately unchanged

| File/area | Reason |
|---|---|
| `classic-bird-session.ts` and Classic Bird controllers | wrong terminal/toss/physics policy; safety reference only |
| Crazy resource/audio/entity/timer/intro/toss implementations | already the correct shared behavior |
| `crazy-toss-config.ts` | change only if targeted static closure proves a mode-4 difference |
| `game/assets/scenes/classic.scene` | required Crazy and Bird components already serialized |
| original raster/font/audio assets | recovered type-2 resources already exist in the asset tree |
| mode IDs `2` and `5` routes | remain unsupported/fail-closed |

### Required test work

Modify or add focused tests under `tests/reconstruction/vertical-slice/`:

- Crazy session profile parity and exact mode-4 identity;
- Crazy mode-1 characterization after profiling;
- Bird resource type `1` compatibility and type `2` closure/geometry;
- Bird state/presenter type propagation;
- Crazy scene exclusive input lease and every physics rollback edge;
- Crazy gameplay mode-4 touch/ray/toss/special/timer/audio/result/pause paths;
- Crazy Bird ranking/navigation/settings;
- Mode Select exact mode-4 dispatch with modes `2`/`5` still unsupported;
- app-shell preparation, entry, Result Menu, Pause Quit, rollback, and fatal cases;
- scene integration proving no extra serialized controller is required.

## Transaction and Rollback Hazards

| Hazard | Required invariant |
|---|---|
| mutable current-mode flag | profile is frozen and stored in each run/standby/result transaction |
| retired callback crosses runs | every delayed bomb/result/pause callback validates captured run ownership/profile |
| both input systems active | scene acquires exactly one recorded lease; cleanup releases that same lease |
| older Bird scene releases newer input | every Bird deactivate passes its owner token |
| partial Physics2D restore | retain `physicsRestorePending`; fatal/quiescent on failed compensation |
| mode-4 prep poisons mode 1 | separate cached preparation promises and caught shell failures |
| Result presenter exists but session fails | provisional participant rolls back before old leases restore |
| session commits but observer throws | report only; never reopen or replay Time Up Finish |
| settings rank commits twice | rank mutation occurs once at participant/domain commit boundary |
| reward applied during preview | award only from presenter accounting callback |
| Retry constructs mode 1 | mode-4 navigation command and captured profile construct mode `4` explicitly |
| shell reads effectful getters twice | capture request fields once before validation/transition |
| shell rollback restores root but not filter/input | aggregate and assert all three owners; otherwise state `failed` |
| shared RNG reset for parity | never reseed; Bird particles legitimately affect pre-GO stream |
| inferred GO/table becomes invisible | keep evidence note/tests; do not advertise exact parity before static closure |
| route widening recovers 2/5 accidentally | exact `CrazyBirdLayer` branch; fallback assertions retain GN/Combo |

## Staged Red-Green Order

### Stage 0 — static fidelity gate

- Review the B1-B5 operand/order slices in the companion native contract.
- At minimum close `ActionGoCallback` before claiming exact start-order fidelity.
- If implementation proceeds on candidate parity, record that decision in the plan;
  do not hide it in code comments or test names.

### Stage 1 — characterize mode 1, then profile the domain

1. Freeze current mode-1 `CrazySession` command snapshots and rollback behavior.
2. Add failing mode-4 session identity tests.
3. Add the immutable profile with mode-1 default.
4. Run all existing Crazy session/toss/score tests before continuing.

This protects the public mode-1 contract before Creator owners branch.

### Stage 2 — close result/settings and type-2 resources

1. Land thin ranking/navigation tests and implementations.
2. Land settings load/save/rank/reward tests and shared-runtime changes.
3. Add Bird type-2 contract/loader/state/presenter tests.
4. Prove all type-1 Classic Bird tests remain unchanged.

These are independent of live scene ownership and give the later controller a stable
profile.

### Stage 3 — profile the scene lease

1. Characterize current Crazy activate/suspend/resume/result rollback.
2. Add Bird input mode-4 tests, including older-owner release attempts.
3. Add retained physics cleanup and typed fatal lifecycle tests.
4. Implement profile-aware `CrazySceneController`.
5. Re-run mode-1 and Classic Bird scene suites.

Do not start gameplay wiring until the scene can prove exact cleanup after every
injected failure.

### Stage 4 — add the Crazy Bird cut driver

1. Add preparation and construction failures first.
2. Add swish-before-touch, busy touch, one-cached-ray-per-step, forward/reverse cut,
   stale acknowledgement, and Crazy combo tests.
3. Add parity tests for every Crazy special ID, miss, bomb, freeze, magnet, time-up,
   pause, Result, Retry, and Menu path under profile `4`.
4. Implement the discriminated cut driver and mode-correct result/settings branches.
5. Run the complete Crazy gameplay suite to prove mode `1` did not drift.

### Stage 5 — expose routing

1. Add failing Mode Select tests: `CrazyBirdLayer` handled; modes `2` and `5`
   unsupported.
2. Add failing shell preparation/enter/leave/rollback/fatal tests.
3. Implement explicit mode-4 lifecycle and events.
4. Keep app-shell state `'failed'` sticky after unprovable compensation.

### Stage 6 — integration and production gates

Run the narrow suites first, then:

- all vertical-slice tests;
- strict TypeScript check;
- Creator project/scene integration audit;
- production build using the repository's supported Preview path only.

Never use the original APK or `libgame.so` as a test oracle. Do not weaken a
transaction test to make the profile refactor pass.

## Anti-Duplication Boundaries

1. One Crazy timed state machine, selected by frozen profile.
2. One Crazy toss table/coordinator unless static evidence proves a differing row.
3. One Crazy entity/effect/audio/resource graph.
4. One shared Bird state/presenter/ray pipeline, selected by Bird type.
5. One process settings runtime and one shared ranking algorithm.
6. Thin mode-specific ranking/navigation bindings are intentional: public identity
   and Retry safety are worth explicit command vocabularies.
7. Keep profile branching at base/input/blade/result edges. Do not scatter
   `if (mode === 4)` through fruit/effect/toss handlers.
8. No shared base class extracted from Classic Bird. Similar rollback code should
   be adopted as an invariant, not inherited with its gameplay policy.

## Unresolved Questions

1. Does the static `ActionGoCallback` slice confirm the candidate mode-4 start order
   and `b4` omission?
2. Do the remaining native slices confirm the full Crazy toss table, magnet bounds,
   objective operands, Bird blade placement, and absence of world speed-up?
3. Which presenter directly consumes
   `Leaderboard/leaderboard_crazy_bird.png`?
4. Should mode-4 implementation ship on tracked Crazy-parity inference before all
   B1-B5 slices close, or should those slices block production activation?

Status: DONE_WITH_CONCERNS

Summary: Profile the existing Crazy session/scene/gameplay owners with an immutable
mode-4 run identity and Bird type-2 cut driver; reuse Crazy services and shared Bird
mechanics, not Classic Bird gameplay policy or a copied third controller.

Concerns/Blockers: Exact native-fidelity promotion still requires targeted static
operand/order closure, especially `CrazyBirdLayer::ActionGoCallback`; mode IDs `2`
and `5` must remain fail-closed throughout routing work.

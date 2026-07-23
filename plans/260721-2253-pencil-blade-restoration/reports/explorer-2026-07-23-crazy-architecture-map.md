---
type: explorer
date: 2026-07-23
status: done-with-concerns
scope: Crazy mode architecture map
evidence_policy: static-only; unimplemented destinations remain fail-closed
---

# Crazy Mode Architecture Map

## Summary

The current Creator runtime has the correct outer shape for Crazy mode: one persistent
`GameScene`, shared background/leaf/theme layers, a transactional foreground host, and an
already recovered Mode Select state `1 -> CrazyModeLayer` route guarded by
`mode_unlock_1`. It does **not** yet have a Crazy gameplay runtime hidden behind that route.
The active implementation is deliberately mode-0-shaped from scene activation through
physics, failure, result ranking, retry, and persistence.

Two different readiness decisions therefore apply:

- **Native module contract: GREEN.** The direct body pass recovered Crazy mode ID `1`, the
  60-second `TimeManager` binding, ten-controller start graph, timed stop/finish split,
  cut/fail/bomb/magnet/freeze callbacks, and the mode-1 `DisplayScoreLayer` branch.
- **Current implementation route: CLOSED until built and verified.** There is no Crazy
  Creator controller behind the card yet. Returning Classic under the Crazy card or
  presenting a partial placeholder would violate the restoration boundary. State 1 can open
  after the green contract is encoded, its exact catalog is loaded, and the transaction,
  gameplay, Result, persistence, and Preview gates pass.

The root `README.md` required by the workspace instructions is absent. `forensics/README.md`,
the phase files, architecture documents, curated native maps, recovered contracts, current
TypeScript, serialized scene, and focused tests were used instead.

## Evidence Baseline

### Recovered and safe to rely on

- `ModeSelectState` already maps card/index/destination state `1` to `CrazyModeLayer`.
- Crazy unlock is `mode_unlock_1`, default false, with the existing 2,500-coin unlock flow.
- `CrazyModeLayer::GetGameMode()` returns `1`; `GetReplayInstance()` creates the same mode.
- `CrazyModeLayer::onEnter()` passes `60.0f` and the time-up/freeze/time-up-finish callbacks
  to `TimeManager::create`.
- `ActionGoCallback` starts `TimeManager`, enables cutting, and starts controller slots in
  exact order `ab, b0, b2, ac, b1, b3, ad, b5, ae, af`.
- `TimeUpCallback` stops `ab, ad, ae, af, b0, b2, ac, b1, b3`, then stops the electric/bomb
  support object, finishes double score, and posts objective events. Slots `b4` and `b5` are
  intentionally left until `TimeUpFinishCallback`.
- `TimeUpFinishCallback` disables cutting, stops effects, constructs `DisplayScoreLayer`,
  sets mode `1` and the completed score, removes Crazy, and attaches Result to the captured
  parent.
- The bodies of fruit cut for IDs `10..14`, fruit/bonus fail, bomb hit/after-hit, magnet
  begin/end, and freeze begin/end are recovered. Freeze delegates to
  `PhysicsLayer::FreezeeWorld()` / `UnFreezeeWorld()`.
- Direct native call sites prove `CrazyModeLayer::onEnter()` constructs both `DoubleToss`
  and `BonusToss`; Classic constructs neither.
- The shared `DoubleToss`, `BonusToss`, and `TimeManager` implementations have detailed
  recovered contracts in `forensics/contracts/classic-toss-contract.md` and
  `forensics/contracts/classic-time-state-contract.md`. “Classic” in those filenames does
  not make these services part of standard Classic.
- Crazy Result uses `crazy_best_1..3`, the same recovered `>=` rank insertion and
  `float32(score) * 0.6f` signed truncation as mode 0, while keeping a distinct leaderboard.
- Crazy persistence keys `crazy_best_1`, `crazy_best_2`, and `crazy_best_3` exist and load
  with default `0`; `CrazyModeLayer::onEnter` reads `CrazyBest_1`.
- Exact Crazy Mode Select card/description and direct timed-mode resources are mapped. Exact
  Crazy leaderboard art exists, but its separate screen consumer remains inferred.

### Remaining non-blocking evidence gaps

| Gap | Architectural treatment |
|---|---|
| The `ActionGoCallback` child removal uses native virtual slot `+0xE8` without a stable source-level wrapper name | Preserve the recovered remove-child-with-cleanup operation and ordering; do not invent a source wrapper name. |
| Objective event IDs have recovered call sites but no independent human-readable labels | Expose opaque typed event IDs and preserve order; document labels only when independently recovered. |
| Frame-level shared RNG interleaving with engine/VFX consumers | Preserve all recovered controller draw boundaries and fixture seeds; do not claim bit-identical engine/VFX replay. |
| `Leaderboard/leaderboard_crazy.png` and `Text/text-nobomb.png` consumer attribution | Keep them out of a required Result/gameplay catalog until the consumer is pinned. |
| Global resource consumer registry remains unmapped even though the local Crazy surface is classified | Build the Crazy catalog from the reviewed direct/proven checkpoint rows, with per-path tests; do not claim corpus-wide mapping. |
| No recovered save-schema version key | Use missing-key compatibility fixtures; a durable version key requires a product decision. |
| Native `BombElectric` exposes an unsafe contact-layout conflict | Implement a type-safe Creator contact boundary and record the safety adaptation; reproducing memory-unsafe behavior is forbidden. |
| Original runtime cannot supply pixel, audio-latency, or frame-trace comparison | Validate static contracts, deterministic services, Creator Preview, and user review; do not claim runtime identity. |

## Current Runtime Shape

```text
serialized Canvas
├── BladeInputController
├── ClassicSceneController
├── ClassicGameplayController
└── RecoveredAppShellController
    ├── shared Background / Leaf / Theme
    ├── NonClassicPhysicsAdapter
    └── current foreground, z-order 1
        ├── MainMenuPresenter
        ├── ModeSelectPresenter
        ├── Classic runtime
        └── Classic Result
```

`RecoveredAppShellController` is persistent and transactional, but its state union, required
components, preparation owner, gameplay activation method, result event listener, and
application-hide settings owner are all Classic-specific. `classic.scene` is now the
persistent app scene despite its historical filename; Crazy should be another dynamic layer
inside that scene, not a scene replacement.

## Reuse Decision

| Current component | Decision for Crazy | Constraint |
|---|---|---|
| `ModeSelectState` and its destination transaction plan | Reuse unchanged | State `1`, lock key, price, 0.75-second delay, captured parent, z-order, and repeated scheduling are already recovered. |
| `ModeSelectPresenter` | Extend additively | Add an explicit Crazy lifecycle port; keep destinations 2–5 on the unsupported path. |
| `SharedGameScenePresenter`, shared background/leaf/theme presenters, viewport and resolution services | Reuse | Preserve one shared scene and foreground replacement contract. |
| `NonClassicPhysicsAdapter` | Reuse as the menu/mode filter lease | Restore it before either gameplay mode; reacquire it before Result-to-Main. |
| `GameplayRandom`, `TossTimer`, and `spawn-kinematics` | Reuse as pure primitives | Crazy must provide its own evidenced construction/start order so shared RNG consumption remains observable. |
| `DoubleToss` and `BonusToss` recovered behavior | Implement as shared strategies | Do not add them to Classic. Preserve the recovered 15-second guard, child ordering, audio, bonus flags, retry-loop RNG, and direction mapping. |
| Recovered `TimeManager` behavior | Implement as a shared service/presenter | Crazy binds it at `60.0f` with recovered callbacks; standard Classic must remain untimed. |
| `ScoreService` and `ComboService` | Reuse behind a Crazy callback adapter | Preserve the recovered ID `10..14`, bonus, bomb, magnet, and finish ordering rather than routing through Classic failure logic. |
| Blade input, basic blade trail, cut query, entity registry, cut-half and critical presenters | Reuse after extracting mode-neutral names/ports | Body-level Crazy cut callbacks are green; keep mode ownership, input gating, and physics leases explicit. |
| `game-resource-loader.ts` bundle/raster mechanics | Reuse after neutral type extraction | It currently imports `ClassicRasterResource` and Classic path helpers despite generic behavior. |
| `ClassicAudioPresenter` | Extract a mode-neutral process audio owner, then add the reviewed Crazy supplement | The existing exact 28-clip preload list is only the implemented Classic subset. |
| `ClassicSettingsState` / `ClassicSettingsRuntime` | Extract a mode-neutral process owner with compatibility aliases | Crazy needs a distinct leaderboard; never share or overwrite `snapshot.leaderboard`. |
| `ClassicResultPresenter` visuals and ranking primitive | Extract a mode-neutral `DisplayScore` presenter/ranker | Mode 1 uses the same `>=` insertion and 0.6 reward, but injects Crazy keys, mode `1`, and a Crazy Retry factory. Preserve the Classic API as a wrapper. |
| `ClassicSession`, `ClassicWorldSpeed`, `FailService`, `ClassicFailPresenter`, `ClassicResultNavigation` | Do not reuse as Crazy behavior | These encode untimed three-strike mode 0, Classic speed scheduling, and a Classic Retry target. |
| `ClassicGameplayController` and `ClassicSceneController` | Keep Classic-only | Do not grow mode switches through the existing monolith. Add a sibling Crazy runtime. |

## Required Architecture

### 1. Mode-neutral process services

Before a second gameplay controller becomes live, move process-owned services out of
`ClassicGameplayController`:

- one `GameplayRandom`;
- one settings runtime;
- one audio presenter/mixer;
- the selected resolution/asset tree;
- shared screen-placement and result-request ports.

A small `RecoveredAppRuntimeServices` owned by `RecoveredAppShellController` is sufficient.
Avoid a broad service locator. Preserve the current Classic public getters as compatibility
shims while callers move:

- `sharedGameplayRandom`
- `sharedSettingsRuntime`
- `sharedAudioPresenter`
- `sharedResourceCatalog`

Concrete shared seams:

- `game/assets/scripts/creator/recovered-app-runtime-services.ts`
- `game/assets/scripts/creator/recovered-settings-runtime.ts`
- `game/assets/scripts/creator/recovered-audio-presenter.ts`
- `game/assets/scripts/creator/screen-placement-port.ts`

The Classic catalog itself remains owned/prepared by Classic; only the asset tree and generic
loader are shared. A Crazy catalog failure must not prevent Main Menu or Mode Select from
booting. It should leave only the Crazy destination unavailable.

### 2. Separate Crazy domain runtime

Create a Crazy state machine rather than adding `if (mode)` branches to Classic:

- `game/assets/scripts/domain/crazy-session.ts`
- `game/assets/scripts/domain/crazy-toss-config.ts`
- `game/assets/scripts/domain/crazy-cut-score.ts`
- `game/assets/scripts/domain/crazy-physics-rules.ts`
- `game/assets/scripts/domain/crazy-result-navigation.ts`
- `game/assets/scripts/domain/crazy-result-ranking.ts`
- `game/assets/scripts/domain/crazy-resource-contract.ts`
- `game/assets/scripts/domain/time-manager.ts`
- `game/assets/scripts/domain/double-toss-strategy.ts`
- `game/assets/scripts/domain/bonus-toss-strategy.ts`
- `game/assets/scripts/domain/recovered-result-ranking.ts`
- `game/assets/scripts/domain/recovered-settings-state.ts`

The supporting body evidence is green; first publish it as a durable Crazy contract and then
encode these files from that contract. `crazy-session.ts` should own Crazy phases, terminal
guards, and replay reset; it must not import `ClassicSession`. Shared toss/time services
receive injected callbacks and audio/bonus ports, leaving the recovered Crazy slot ordering
in the Crazy coordinator.

Every new Creator-imported `.ts` file also needs its `.ts.meta`. Pure helpers should still
follow the repository’s current Creator asset convention.

### 3. Separate Crazy Creator runtime

The Creator layer should mirror responsibility boundaries without copying Classic behavior:

- `crazy-scene-controller.ts`: Crazy session/physics activation, suspension, restoration;
- `crazy-gameplay-controller.ts`: resources, Crazy controller graph, cut/score/bonus callbacks,
  time-up/result handoff, retry;
- `crazy-intro-presenter.ts`: exact `60s` then `GO` move/fade tracks and nominal 2-second
  start gate;
- `crazy-toss-coordinator.ts`: construction, add, start, pause/resume, time-up, and cleanup
  slot ordering;
- `crazy-physics-adapter.ts`: a mode-owned facade over the recovered shared PhysicsLayer
  stepping/filter boundary, with Crazy freeze/unfreeze and without importing Classic session
  state;
- `crazy-resource-loader.ts`: exact Crazy catalog layered over generic bundle loading;
- `time-manager-presenter.ts`: exact label/freeze-clock/time-up presentation;
- `crazy-audio-contract.ts` and a Crazy preload/supplement path;
- a type-safe electric-field contact adapter documented as a native safety adaptation;
- Crazy-specific generated entity/presenter adapters only where shared entity contracts do
  not match.

Both Crazy controllers should remain passive during `onLoad`/`start`, exactly as Classic
does now. Preparation loads local resources; activation is the only operation allowed to
take the input and physics leases or attach a gameplay root.

Serialize the new controller components on the existing Canvas in
`game/assets/scenes/classic.scene`; do not create or replace a Cocos scene for mode entry.
Update the component-meta integration test to resolve the two additional UUIDs.

### 4. Mode Select public API

Make one additive lifecycle change:

```ts
interface ModeSelectPresenterLifecycle {
  onClassicRequested(transaction: ModeSelectNavigationTransaction): boolean | void;
  onCrazyRequested(transaction: ModeSelectNavigationTransaction): boolean | void;
  onMainMenuRequested(transaction: ModeSelectNavigationTransaction): boolean | void;
  onUnsupportedDestinationRequested(
    destination: Exclude<
      ModeSelectDestination,
      'ClassicModeLayer' | 'CrazyModeLayer'
    >,
    transaction: ModeSelectNavigationTransaction,
  ): boolean | void;
}
```

`completeDelayedNavigation()` should dispatch Classic and Crazy explicitly. A generic
destination registry is premature with only two implemented modes and would make it easier
to accidentally accept an unimplemented destination. `assertInput` must require the new
handler.

The handler may return false until `CrazyGameplayController` reports a complete prepared
catalog and all contract gates are enabled. A false return retains the existing presenter
rollback/rearm behavior.

Start Crazy preparation after the Main-critical shared shell is ready, and retain an explicit
`pending | ready | failed` destination readiness state. Do not make Crazy preparation part of
the fatal Main boot promise. Because the current lifecycle callback is synchronous, a pending
or failed state returns false and uses the existing Mode Select rollback; do not invent a
loading screen or extend the recovered 0.75-second delay.

### 5. App-shell transaction

Extend `RecoveredAppShellState` with `'crazy'` and add
`transitionModeSelectToCrazy(transaction)`. Its exact shell transaction should be:

1. validate current state, active Mode Select root, and `CrazyModeLayer` destination;
2. enter the existing transition guard;
3. detach the current foreground;
4. suspend Mode Select and surrender its input lease;
5. restore the previous non-gameplay collision filter;
6. activate a prepared, fresh Crazy layer in the now-empty shared foreground host;
7. commit state `'crazy'`, clear the active Mode Select reference, and dispose the old
   presenter.

On any failure:

1. restore the non-gameplay collision filter if it was released;
2. reattach the old Mode Select root if the host is empty;
3. leave shell state as `'mode-select'`;
4. return false/emit the normalized transition failure so Mode Select rearms;
5. never attach Classic or a placeholder Crazy root.

Keep `CLASSIC_RESULT_MENU_REQUESTED_EVENT` and `ClassicResultMenuRequestedEvent` intact.
Add a separate Crazy result-menu event and delegate both to one private shell transaction
helper parameterized by the expected source state. That is lower risk than changing the
existing public Classic event shape. Crazy Retry remains owned by the Crazy controller and
must create a fresh Crazy layer under the captured Result parent.

### 6. Settings and save schema

Known Crazy additions:

| State | Keys | Defaults | Persistence boundary |
|---|---|---:|---|
| Crazy leaderboard | `crazy_best_1`, `crazy_best_2`, `crazy_best_3` | `0`, `0`, `0` | process memory, then the existing app-hide/bulk `SaveData` equivalent |
| Crazy unlock | `mode_unlock_1` | `false` | existing immediate per-key persistence |
| Currency | `total_coins` | `2014` | existing process memory, then bulk save |

The neutral snapshot should expose distinct `classicLeaderboard` and `crazyLeaderboard`
values. Keep `leaderboard` as a temporary read-only alias for `classicLeaderboard` so
Classic code and tests remain source-compatible. Add `recordCrazyResultScore` using the
recovered mode-1 `>=` insertion, and award Crazy result coins with the recovered
`float32(score) * 0.6f` then signed truncation. Share the pure ranking/reward primitive;
inject the leaderboard keys so Classic and Crazy never alias.

`ClassicSettingsState` and `getClassicSettingsRuntime()` can remain compatibility exports
backed by the neutral singleton. One application-hide listener must write all implemented
fields once. Result Main/Retry callbacks must remain non-saving, and unlock writes must
remain immediate.

Phase 6 calls for a versioned save schema, but no recovered migration/version key exists in
the current evidence. Add fixture-based compatibility for newly introduced keys and missing
keys; do not invent a durable version key without a product decision.

### 7. Resources and audio

Create a separate `CrazyResourceCatalog`; do not append uncertain assets to
`ClassicSliceResourceCatalog`.

Green now:

- Mode Select `Interfaces/mode-crazy.png`;
- Mode Select `Interfaces/object-crazy-des.png`;
- shared Mode Select banana intact/cut art and selection/unlock resources;
- direct Crazy `Text/text-60s.png` from `onEnter`;
- direct Crazy `Text/text-go.png` from `Action60sCallback`;
- direct `TimeManager` `Interfaces/object-time-freeze.png`, `Text/text-time-up.png`,
  `Fonts/MotorwerkOblique.ttf`, `Sounds/timetick.wav`, `Sounds/timeup.wav`, and
  `Sounds/freeze.wav`;
- direct Crazy controller dependencies `Sounds/doubletoss.wav` and
  `Sounds/doubletosstrum.wav`;
- every intact/cut triple for special fruit IDs `10..14`: double score, double toss, freeze,
  electric, and magnet;
- shared normal-fruit, standard-bomb, electric-field, score HUD, pause, DisplayScore,
  result-particle/reward/button, and directly bound gameplay/audio dependencies enumerated by
  the Crazy contract/resource report;
- exact `Leaderboard/leaderboard_crazy.png` bytes/dimensions, but not its consumer.

The Crazy checkpoint currently has body-pinned direct literals plus an AMBER transitive
gameplay inventory. It intentionally has no GREEN numeric consumer denominator until every
mandatory special/effect path is enumerated and each consumer relationship is reviewed.
`Text/text-nobomb.png`, `Leaderboard/leaderboard_crazy.png`, and
`Leaderboard/leaderboard_crazy_bird.png` must not become required loader assertions until
their consumers are pinned. Every catalog row must come from the reviewed body/resource map,
not filename inference.

Extract `GameRasterResource`, canonical raster-to-bundle path conversion, and exact dimension
validation from `classic-resource-contract.ts` so both mode catalogs use
`game-resource-loader.ts` without importing Classic types. Keep compatibility re-exports for
the existing Classic loader.

## Physics, Toss, Time, and Result Differences

| Concern | Classic now | Crazy requirement |
|---|---|---|
| Terminal condition | Untimed, three fruit misses via `FailService` | `TimeManager(60.0f)` owns expiry. `TimeUpCallback` stops the recovered graph/finishes double score; `TimeUpFinishCallback` performs Result replacement. |
| Toss graph | Nine recovered Classic slots; runtime currently executes only `normal-free` in the vertical slice | Eleven controllers are constructed, including `DoubleToss b4` and `BonusToss b5`. GO starts `ab,b0,b2,ac,b1,b3,ad,b5,ae,af`; `b4` starts only after cutting ID `11`. TimeUp omits `b4/b5`, leaving them active until layer cleanup after the 3-second Time Up presentation. |
| Clock/intro | Standard Classic owns no `TimeManager` and uses GOOD/LUCK | Crazy uses `60s` then `GO`; each card runs concurrent 0.25-second move/fade in, waits 0.5 seconds, then runs concurrent 0.25-second move/fade out. GO starts `TimeManager(60.0f)`, TimeUp is immediate, and TimeUpFinish follows the shared 3-second presentation. |
| Freeze | Standard Classic does not activate the timed bonus | ID `12` freezes TimeManager for 15 seconds and adds 10. Freeze callback calls `FreezeeWorld()`; finish calls `UnFreezeeWorld()`; toss schedulers continue, then TimeManager hides the clock and disables bonus 12. |
| Magnet | Classic recovered callbacks target its nine-controller graph | ID `14` creates MagnetAnimation then adds 10. Begin changes normal Free from `[0.5,3]` to `[0.25,0.5]` and pauses bomb Free/Concurrent/Wave; end restores/resumes without resampling thresholds. |
| Special cuts | Classic has no bonus-fruit dispatch | ID `10` enables double score and adds no cut score; `11` starts DoubleToss then adds 10; `12` freezes then adds 10; `13` starts BombElectric then adds 10; `14` starts magnet then adds 10. |
| Fail/bomb | Classic uses three misses and a terminal bomb | Crazy fruit/bonus misses only submit `(4,1)`. Bomb disables cuts, runs inherited hold, adds `-10`, flushes double score, stops magnet Free, submits `(8,1)`, then AfterBomb re-enables cuts; it is non-terminal. |
| Result | Mode `0`, Classic leaderboard, `score * 0.6f`, Classic Retry | Mode `1`, `crazy_best_1..3`, the same `>=` ranking and 0.6 reward primitive, and fresh Crazy Retry. |
| Physics lease | Classic owns the current manual variable-step adapter and world-speed schedule | Extract shared PhysicsLayer step/filter mechanics, add a Crazy-owned freeze facade, never run two gameplay adapters concurrently, and implement electric contacts through the documented type-safe safety adaptation. |

## Blast Radius

### Existing production files expected to change

- `game/assets/scripts/creator/mode-select-presenter.ts`
- `game/assets/scripts/creator/recovered-app-shell-controller.ts`
- `game/assets/scripts/creator/game-resource-loader.ts`
- `game/assets/scripts/domain/classic-resource-contract.ts` only for compatibility exports
- `game/assets/scripts/domain/classic-settings-state.ts` and
  `game/assets/scripts/creator/classic-settings-runtime.ts` only for neutral-owner
  compatibility
- `game/assets/scripts/creator/classic-gameplay-controller.ts` only to receive neutral
  process services / preserve compatibility getters
- `game/assets/scripts/creator/classic-audio-presenter.ts` and
  `game/assets/scripts/domain/classic-audio-contract.ts` only if the shared owner is extracted
- `game/assets/scenes/classic.scene`

Do not alter Classic session, failure, world-speed, toss table, result-ranking, result
navigation, or retry behavior to make Crazy fit.

### New production files

The domain and Creator files listed under **Required Architecture**, plus matching `.ts.meta`
files and exact Crazy contract documents under `forensics/contracts/`.

### Documentation impact after implementation

Major: update `docs/system-architecture.md`, `docs/cocos-creator-contract-map.md`, the Phase 4
contract index, Phase 6 status/acceptance, and the project roadmap/changelog documents that
actually exist. Do not mark Crazy complete while any route gate below is red.

## Exact Test Plan

### New pure contract tests

- `crazy-session.test.ts`: evidenced phase transitions, one terminal gate, fresh replay reset,
  objective entry pairs `(8,0)/(4,0)`, illegal transition rejection, and no Classic
  GAME/OVER phase.
- `crazy-toss-config.test.ts`: complete slot/configuration table, construction order,
  ActionGo start `ab,b0,b2,ac,b1,b3,ad,b5,ae,af`, TimeUp stop
  `ab,ad,ae,af,b0,b2,ac,b1,b3`, absence of `b4` from GO, preservation of `b4/b5` through
  the Time Up presentation, pause/resume order, and shared-RNG draw sequence.
- `double-toss-strategy.test.ts`: 15-second guard, base zero-threshold RNG perturbation,
  Left-before-Right child lifecycle, audio start/stop order, bonus-11 cleanup.
- `bonus-toss-strategy.test.ts`: `[12,10,11]`, enabled-bonus retry loop, data-dependent RNG,
  direction `0 Left / 1 Right / 2 Down / 3 Down`, attach-before-enable-before-audio.
- `time-manager.test.ts`: float32 subtraction/formatting, warning equality and skipped seconds,
  tick-before-time-up, no clamp, callback and presentation order, 3-second finish action,
  repeated Freeze behavior, 15-second thaw ramps, callback-before-hide-before bonus-12
  cleanup, Start/Stop/Restart preservation semantics.
- `crazy-time-binding.test.ts`: total `60.0f`, create-callback order, ActionGo start,
  freeze-to-physics/toss coordination, TimeUp stop, and TimeUpFinish-to-Result order.
- `crazy-intro-presentation.test.ts`: exact `60s` then `GO` resources, half-sprite-width
  offscreen anchors, concurrent 0.25/0.5/0.25 move/fade tracks, cleanup, and nominal
  2-second gate.
- `crazy-cut-score.test.ts`: normal fruit uses supplied score; ID `10` enables double with no
  score; IDs `11..14` run effect before adding 10; `(4,1)` non-terminal misses; bomb
  disable/hold/`-10`/double flush/magnet stop/`(8,1)`/re-enable order; critical handling,
  magnet interval/pause/resume, and signed/float32 boundaries.
- `crazy-physics-rules.test.ts`: exact gravity, collision rows, stepping, speed/freeze values,
  start/restore ordering, singleton ownership, and type-safe electric-contact adaptation.
- `crazy-result-ranking.test.ts`: `crazy_best_1..3`, recovered `>=` insertion, panel order,
  rank, float32 `0.6` reward, signed truncation and int32 behavior.
- `crazy-result-navigation.test.ts`: mode `1`, effects-gated click, captured parent,
  synchronous remove/construct/attach order, fresh Crazy Retry, Main route, and explicit
  absence of save/delay/scene reload.
- `crazy-resource-contract.test.ts`: only recovered canonical paths, resolution variants,
  dimensions, and exact catalog cardinality.
- `crazy-audio-contract.test.ts`: only reviewed direct/proven call-site paths and recovered
  request/stop order.

Build these expectations from the published Crazy body contract and shared toss/time/result
contracts. Opaque objective IDs and the `+0xE8` attachment remain exact numeric/ordering
fixtures rather than guessed semantic labels.

### New Creator tests

- `crazy-resource-loader.test.ts`: exact bundle paths, sprite-frame suffixes, completeness,
  dimension mismatch, partial load, and invalid asset failure.
- `crazy-audio-presenter.test.ts`: reviewed Crazy supplement preload, effect/music gates,
  DoubleToss loop ownership, TimeManager cues, stop-effects at Result, and load failure.
- `time-manager-presenter.test.ts`: label/font placement, normal/warning colors,
  freeze-clock placement/opacity/color ramps, time-up sprite action order and cleanup.
- `crazy-physics-adapter.test.ts`: passive construction, activation lease, frame step, raycast,
  restoration on Result/rollback/destroy, no overlap with non-gameplay or Classic adapters.
- `crazy-gameplay-controller.test.ts`: passive lifecycle, prepare idempotence, fresh root,
  controller construction/start order, input gating, callback wiring, time-up result
  transaction, cleanup and rollback.
- `crazy-intro-presenter.test.ts`: loaded-resource use, z-order, dual-track progression,
  removal, callback once, teardown, and no GOOD/LUCK or GAME/OVER nodes.
- `crazy-result-presenter.test.ts`: mode-1 DisplayScore configuration, shared presentation
  geometry, Crazy panel/rank/reward wiring, mode `1`, and no Classic leaderboard access.
- `crazy-retry-lifecycle-executable.test.ts`: detach Result, restore fresh Crazy state and
  physics, commit cleanup; on failure restore the same Result and retry listeners.

### Existing tests to extend or preserve

- `mode-select-presenter.test.ts`
  - require `onCrazyRequested`;
  - dispatch accepted state 1 exactly once after 0.75 seconds;
  - pass the existing immutable transaction;
  - restore/rearm on false or throw;
  - move the “unsupported route” fixture from Crazy to destinations 2–5 and prove they stay
    fail-closed.
- `mode-select-state.test.ts`
  - keep all existing index/destination, unlock, delay, repeatable-selection, and
    execution-time destination-read expectations unchanged.
- `recovered-app-shell-controller.test.ts`
  - boot Main even when Crazy preparation fails;
  - Main -> Mode Select -> Crazy only with ready controller/catalog;
  - exact collision-filter/input/root transaction;
  - every failure point restores Mode Select and state;
  - destinations 2–5 still emit unsupported;
  - Crazy Result -> Main commit/rollback;
  - one app-hide save contains both leaderboards.
- `classic-app-shell-boundary.test.ts`
  - preserve passive Classic lifecycle, empty-host activation, mode-0 Result and retry,
    commit/rollback, and shared-service compatibility getters.
- `classic-settings-state.test.ts` and `classic-settings-runtime.test.ts`
  - add `crazy_best_1..3` defaults/read/write/missing-key fixtures;
  - prove Classic and Crazy leaderboards are independent;
  - preserve key order for the implemented subset, corruption recovery, immediate unlock,
    and single bulk save.
- `creator-scene-integration.test.ts`
  - resolve both Crazy controller UUIDs from `.meta`;
  - assert all gameplay components remain passive before explicit activation.
- `non-classic-physics-adapter.test.ts`
  - exercise Mode Select -> Crazy commit and rollback leases in addition to Classic.
- `source-boundary.test.ts`
  - run unchanged against every new Creator source.
- Run every existing Classic, Main Menu, Mode Select, shared-scene, strict TypeScript, staging,
  and archive audit test unchanged before opening the route.

Final validation requires a fresh Creator Browser Preview of:

1. Boot -> Main -> Mode Select -> Classic -> Result -> Retry/Main;
2. Boot -> Main -> Mode Select -> unlocked Crazy -> complete timed run -> Result ->
   Crazy Retry/Main;
3. Crazy transition/resource failure returning to a usable Mode Select screen;
4. app hide/resume in Main, Mode Select, Classic, Crazy, and both Result owners.

## Staged Delivery Sequence

1. **Review and finalize the recovered body contract.** Independently review
   `forensics/contracts/crazy-mode-contract.md`, then promote its now-green mode ID,
   60-second binding, controller start/stop/finish orders, cut/fail/bomb/magnet/freeze
   callbacks, mode-1 DisplayScore branch, safety adaptation, and reviewed resource/audio rows.
   Keep state 1 unsupported while no Creator runtime exists.
2. **Neutralize shared ownership.** Extract settings/random/audio/asset-tree/screen ports with
   compatibility aliases. Run the complete existing suite; no Crazy route yet.
3. **Implement proven shared primitives.** Add `DoubleToss`, `BonusToss`, `TimeManager`, and
   a mode-neutral result rank/reward primitive with exhaustive pure tests. Wire their
   recovered callbacks only from the new Crazy coordinator; do not add them to Classic.
4. **Build the passive Crazy domain/Creator module.** Add session, controllers, exact
   resources/audio, physics, and serialized components. Preparation failures remain
   destination-local.
5. **Add Crazy Result and persistence.** Use mode `1`, `crazy_best_1..3`, recovered `>=`
   ranking/0.6 reward, the shared visual shell, Main transaction, and fresh Crazy Retry.
   Preserve Classic APIs.
6. **Wire the transaction behind readiness.** Add `onCrazyRequested`, shell state/transition,
   collision/input rollback, and Crazy result event. Destinations 2–5 stay unsupported.
7. **Open state 1 after the implementation gate is green.** Pass focused tests, full
   test/typecheck/audit suites, then both portrait Browser Preview profiles and failure-path
   validation. The native contract gate is already green; this final gate is executable
   integration evidence.

## Compatibility Invariants

| Surface | Must remain true |
|---|---|
| Main | Main is the first foreground after boot; shared Background -> Leaf -> Theme -> screen order and Main navigation/audio remain unchanged. Crazy preparation failure cannot fail Main boot. |
| Mode Select | Six cards, index mapping, locks, coin mutation, no invented debounce, repeated 0.75-second scheduling, execution-time destination read, captured-parent transaction, and z-order remain exact. Only Classic and fully ready Crazy are accepted. |
| Classic | Standard Classic stays untimed, mode 0, three-strike, and free of `DoubleToss`/`BonusToss`. Its physics/world-speed, score/fail, presentation, Result, reward, Retry, settings keys, and API contracts remain unchanged. |
| Crazy | Crazy has a distinct state machine, controller graph, physics owner, leaderboard, Result mode, and Retry. No fallback to Classic and no partial placeholder screen. |
| Result | Classic Retry always reconstructs Classic; Crazy Retry always reconstructs Crazy; Main restores the non-gameplay physics filter. Both routes preserve captured parent, synchronous callback ordering, commit/rollback, and no implicit save. |
| Settings | Classic and Crazy scores never alias. `mode_unlock_1` remains immediate; coin/leaderboard changes remain in process memory until the one app-hide/bulk-save boundary. |
| Physics/input | Exactly one of non-gameplay, Classic, or Crazy owns the active collision/step/input lease. Every failed transition restores the previous owner. |

## Unresolved Questions

1. What semantic name should document the recovered `ActionGoCallback` child-attachment
   virtual call at offset `+0xE8`?
2. What human-readable labels, if any, should be assigned to the recovered opaque
   `ObjectivesManager::ProcessGameEvent` IDs?
3. Is `Leaderboard/leaderboard_crazy.png` used by Result, `SelectItems`, or another screen,
   and which consumer owns `Text/text-nobomb.png`?
4. What frame-level RNG interleaving comes from engine/VFX consumers outside the recovered
   Crazy controller boundaries?
5. Does the product want a new save-schema version key, given that none is recovered?

## Sources

- `plans/260721-2253-pencil-blade-restoration/phase-04-reverse-engineer-native-gameplay-contracts.md`
- `plans/260721-2253-pencil-blade-restoration/phase-05-build-cocos-creator-architecture-and-vertical-slice.md`
- `plans/260721-2253-pencil-blade-restoration/phase-06-recreate-full-game-content-and-progression.md`
- `docs/system-architecture.md`
- `docs/cocos-creator-contract-map.md`
- `forensics/README.md`
- `forensics/native/function-map.csv`
- `forensics/native/java-jni-boundary.md`
- `forensics/contracts/crazy-mode-contract.md`
- `forensics/contracts/mode-select-presentation-contract.md`
- `forensics/contracts/classic-physics-contract.md`
- `forensics/contracts/classic-toss-contract.md`
- `forensics/contracts/classic-cut-score-contract.md`
- `forensics/contracts/classic-time-state-contract.md`
- `forensics/contracts/classic-presentation-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-native-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-resource-map.md`
- `game/assets/scripts/domain/`
- `game/assets/scripts/creator/`
- `game/assets/scenes/classic.scene`
- `tests/reconstruction/vertical-slice/`

Status: DONE_WITH_CONCERNS
Summary: Crazy’s native module contract is green and maps cleanly to a sibling Creator runtime; the current state-1 route stays fail-closed only until that runtime, mode-1 Result/persistence path, exact catalog, tests, and Preview validation are implemented.
Concerns/Blockers: No core Crazy native behavior blocker remains. Non-blocking gaps are semantic labels for one attachment/objective events, two unresolved asset consumers, engine/VFX RNG interleaving, the mandatory type-safe electric-contact adaptation, unavailable original-runtime comparison, and the product decision on save-schema versioning.

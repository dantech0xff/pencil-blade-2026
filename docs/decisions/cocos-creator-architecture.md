# Cocos Creator Architecture Decision

Status: in progress; all six recovered production gameplay routes integrated, settings checkpoint updated
Date: 2026-07-22
Updated: 2026-07-24

## Decision

Rebuild Pencil Blade as a clean Cocos Creator 3.8.8 TypeScript project under `game/`, using
Creator Physics2D behind a narrow adapter. Keep recovered game rules in engine-independent
domain modules with explicit clock, RNG, input, persistence, and command ports. Scenes,
components, prefabs, tweens, audio, and Physics2D calls are adapters rather than owners of
gameplay state.

The workspace now contains the Creator foundation and all six production route contract/test
baselines, all 862 exact recovered APK game assets in a Creator bundle, and a persistent app
shell that routes Main Menu -> Mode Select -> production modes `0` through `5`. Classic owns
the recovered normal-fruit, blade, HUD, fail, result, and core-audio path. Crazy adds its
60-second controller graph, standard/electric bombs, specials, magnet, Dragon, objectives,
pause, audio, and transactional Result lifecycle. Classic Bird adds the shared
BaseBird/BirdBlade substrate and mode-3 result/retry chain. Crazy Bird profiles the shared
Crazy controllers with BirdBlade type `2`; Combo Bird owns an independent mode-5 ordinary
graph with BirdBlade type `3`. GN Style owns an independent mode-2 `150`-second ordinary
graph with the standard blade, exact intro, dedicated non-looping music, 439-parent particle
choreography, late-cut tail, and result lifecycle. Process-owned persistence covers the
expanded implemented Settings subset including all six route leaderboards, immediate
mode-unlock keys, and the `999999`-coin missing/corrupt-save fallback; valid persisted balances
still win. The remaining scene/prefab map, full presentation/progression consumers, Android
build, and runtime physics-equivalence gates keep the architecture decision in progress.

## Dependency Direction

```text
Creator scenes/components/prefabs
             |
             v
application coordinators and ports
             |
             v
deterministic domain state and contracts

Physics2D, audio, storage, clock, RNG, and input implement ports inward.
Domain modules never import `cc`.
```

## Planned Source Boundaries

```text
game/assets/scripts/
  domain/
    classic-session.ts
    toss-scheduler.ts
    score-service.ts
    combo-service.ts
    fail-service.ts
    contracts.ts
  application/
    game-clock.ts
    gameplay-random.ts
    command-log.ts
    save-service.ts
  creator/
    classic-physics-adapter.ts
    blade-input-controller.ts
    classic-scene-controller.ts
    classic-gameplay-controller.ts
    classic-entity-registry.ts
    classic-generated-fruit.ts
    audio-adapter.ts
    creator-storage-adapter.ts
```

Names may change when the editor creates the project, but ownership and dependency direction
must not.

## Current Workspace Boundary

- `game/assets/scripts/domain/` contains the pure Classic, Crazy, Bird, GN Style,
  menu/shared-scene, timer/bonus/objective/result, and presentation contracts.
- `game/assets/scripts/creator/` contains the Physics2D, resolution, blade-input, bird-input,
  app-shell, all route scene/gameplay owners, generated-entity, resource, audio/effect, pause,
  particle, and gameplay bridges.
- `game/assets/scenes/classic.scene` is Editor-authored and attaches the persistent app shell
  plus passive Classic, Crazy, GN Style, Classic Bird, Crazy Bird, and Combo Bird owners to Canvas.
- `game/assets/game/` contains byte-identical copies of all 862 recovered APK game assets.
  The current route subsets use exact rasters and audio, but global consumer/UUID coverage is
  not complete and the canonical sample-project root remains unresolved. Release rights are
  tracked separately.
- `game/assets/scripts/domain/classic-settings-state.ts` and
  `game/assets/scripts/creator/classic-settings-runtime.ts` own the recovered bulk Settings
  shape: 50 integers, 4 booleans, 18 blade prices, 8 background prices, storage-first
  price-0 purchase transitions, and recovery behavior that disables writes after any load
  failure.
- `tests/reconstruction/vertical-slice/` contains the current `1212/1212`
  all-route/menu regression suite.
- `scripts/audit-creator-build.mjs` contains the post-build archive audit.
- `game/library/` is generated Creator cache and is not hand-authored gameplay source.

## Deterministic Domain Rules

- `ClassicSession` owns start, running, pause, terminal, and retry state.
- `TossScheduler` owns each timer's elapsed/threshold state, strict `>` expiry, discarded
  overshoot, rearm-before-turn order, and the fixed nine-controller Classic table.
- `GameplayRandom` is injected and shared by every recovered gameplay consumer. It preserves
  inclusive integer and decile semantics. Tests use scripted draws; production records its
  chosen seed. Exact native `lrand48` sequence parity is not claimed.
- `BaseBirdLayer` owns the single touch-began Bird blade, cached ray path, always-running
  particle trail, and shared result handoff. Classic Bird reuses the classic fail/result
  terminal model while keeping Bird-specific blade and toss policies.
- `CrazyTimedModeProfile` is immutable and selects the mode-1 or mode-4 session, objective,
  BirdBlade, leaderboard, reward, and navigation contracts without duplicating the shared
  Creator controller graph.
- `ComboService` emits commands in recovered order:
  objective event, item creation, score, item attach, conditional sound draw, reset.
- `ScoreService` owns authoritative, displayed, and pending-double state. Presentation does
  not mutate authoritative score outside domain commands.
- `FailService` exposes every fail callback invocation. `ClassicSession` independently guards
  its terminal transition, because multiple outstanding callbacks may observe fail count `3`.
- Standard Classic is untimed and must not instantiate `TimeManagerService`; the shared
  countdown service belongs only to modes whose recovered call graphs require it. Crazy mode
  owns the recovered 60-second instance, freeze/thaw commands, warning ticks, Time-Up
  presentation, and retryable finish callback.
- `CrazySession` and `CrazyTossCoordinator` own the profiled mode-1/mode-4 lifecycle and
  recovered controller graph. Time-Up drains its command suffix once even when a listener
  fails. Time-Up Finish
  enlists the gameplay Result owner as a two-phase participant: pre-commit failure restores the
  exact Crazy/TimeManager owner; post-commit cleanup cannot roll back the domain or rearm a
  disposed TimeManager.
- `GnStyleSession` and `GnStyleTossCoordinator` own the independent mode-2 `150`-second
  Free/Wave/Concurrent lifecycle. Only outer schedulers stop at Time Up; an armed Wave child,
  input, physics, entities, score, and combo remain live through the three-second late-cut
  window. Result samples afterward, commits ranking once, then dispatches the final objective
  once. Dedicated music and the generated 439-parent choreography remain run-owned and
  transactionally quiescent on pause, replay, quit, result, failed activation, and teardown.
- Terminal guard, pending fail callbacks, active bomb presentations, and the physics-stop
  Boolean are orthogonal. A same-query multi-bomb case can attach independent explosions;
  the first finish may resume physics while another remains pending.
- A command log records order without relying on scene-tree side effects.

## Physics2D Boundary

The adapter must encode the intentionally non-uniform Creator API units:

| Value | Native evidence | Creator 3.8.8 boundary |
|---|---|---|
| Position / collider geometry | Box2D metres | multiply by `32` into Creator world units |
| Ray endpoints | legacy world units converted `/32` before native Box2D | pass the legacy numeric world coordinates directly; Creator applies PTM |
| Gravity | `(0,-10)` m/s² | `(0,-320)` public world units/s² |
| Linear velocity | metres/s | pass numerically unchanged to `RigidBody2D.linearVelocity` |
| Angular velocity | radians/s | pass numerically unchanged |
| Rotation | legacy Cocos2d-x node property `-bodyAngle` | use Creator's stock positive body-angle synchronization or prove rendered equivalence |

The native layer calls `Step(frameDt * worldSpeed, 10, 10)`. The pinned Creator 3.8.8 public
manual-step surface supports the selected mapping: automatic simulation is disabled, and one
project-owned `System.postUpdate` performs sync-in, one float32 `frameDt * worldSpeed` step
with configured `10/10` iterations, queued lifecycle mutations, sync-out, and debug draw.
Creator's public manual step does not expose its private stepping/delayed-lifecycle flag, so
all project-owned physics mutations must use the adapter's after-step queue. The mapping is
resolved; full backend equivalence still requires runtime trajectory, ray-order, contact, and
destruction validation.

Two `ERaycast2DType.All` queries run forward then reverse after the physics step. Concatenate
results without sorting or collider-level deduplication, apply the recovered domain filters,
and queue destruction until after the physics callback boundary.

## Compatibility Decisions

| Decision | Initial state |
|---|---|
| Repeated blade fixture dispatch | preserve for first fidelity build |
| Concurrent `countMax + 1` quirk | preserve |
| Effects-enabled combo RNG draw | preserve in shared stream |
| Separate VFX/audio RNG | disabled; enabling is a reviewed new behavior |
| Same-query distinct bombs and last-writer physics stop | preserve for first fidelity build |
| Classic mode-0 music resume asymmetry | preserve for first fidelity build |
| BombElectric unsafe `PreSolve` layout | unresolved; never reproduce unsafe pointer behavior |
| BombElectric zero-height fixture | unresolved Creator compatibility policy |
| Native variable step on Creator scheduler | resolved as `public-manual-variable-step-post-update` on pinned 3.8.8 |
| Creator Physics2D runtime equivalence | pending trajectory, ray-order, contact, and lifecycle validation |

Each unresolved row blocks only the affected behavior from being labeled recovered.

`ClassicSceneController` and `ClassicGameplayController` are scene-lifetime owners in this
slice. They remain enabled together until Canvas destruction; component enable/disable is not
the pause mechanism. The score HUD presenter is a dedicated boundary for the recovered score
icon, best-score state updates, double-score panel, and Linds font. The gameplay controller owns
ordered Score HUD, World, and Fail roots; all generated fruits, cut halves, and critical
particles attach to World so equal-z insertion cannot reorder presentation layers. Fail markers
preserve their recovered `1 -> 2 -> 3` order inside the Fail root.

`CrazySceneController` and `CrazyGameplayController` follow the same passive scene-lifetime
pattern but claim their Physics2D/input leases only after the app shell commits profiled mode
`1` or `4`. Run-owned presenters and registry entities are replaced transactionally for
Replay, Quit, Time-Up Result, and Retry. Cleanup that fails after a committed replacement
moves to explicit retired ownership and must be drained before constructing the next run.

## Presentation and Asset Boundary

- Domain emits presentation/audio commands; Creator adapters interpret them.
- Asset references use logical IDs from the static catalog, never paths into
  `.forensics-work`.
- The vertical-slice manifest may copy exact source bytes under `game/assets` for technical
  reconstruction; release rights determine whether those bytes can ship or must be replaced.
- Import settings must prevent accidental trimming, recompression, resampling, or font
  substitution unless the reconstruction policy explicitly permits it.
- The `99%` fidelity metric is a future-state, versioned cross-domain measure spanning
  visuals/layout/animation, audio, shader/material/rendering, level/progression, and
  gameplay/physics/timing/input/state. Its exact denominator, weighting, and residual-gap list
  stay unresolved until the canonical resource manifest/root is resolved.

## Persistence Boundary

Map the recovered SharedPreferences keys/defaults into a versioned TypeScript save schema.
Legacy ads, review, social, and network bridges are excluded. Migration reads may recognize
legacy keys, but no JNI/native compatibility layer is permitted.

The current runtime reads and writes the expanded implemented subset for coins, selections,
all six route leaderboards, objective state, music/effect flags, network sentinel, and rated
state in recovered relative order. The bulk schema is exact: 50 integers and 4 booleans,
including 18 blade price keys/defaults and 8 background price keys/defaults. Indexed Mode
Select unlocks use their separate immediate keys. Price `0` remains the ownership sentinel; the
Options transition applies exact affordability, persists ownership before committing one
in-memory debit, and stays idempotent for owned items. Back and app-hide reconcile unpaid
background/blade previews before persistence. Field-isolated recovery preserves
any valid `totalCoins`, including `0`; only missing, corrupt, or unreadable coin storage falls
back to `999999`, and any recovery disables writes. Result mutations remain memory-only until
the app-hide save checkpoint. Main Menu exit-save and app-hide save are implemented; the
first-launch `flag` bootstrap remains open.

## Verification Gates

1. Pure domain tests for timers, RNG draw order, toss graph, combo/score/fail, and state.
2. Physics adapter tests for units, gravity, fixture formulas/filters, velocity identity,
   ray order/duplicates, bounds, and deferred destruction.
3. Creator integration tests for the selected public manual variable-step policy, dynamic
   trajectories, post-step synchronization, deferred lifecycle behavior, and rendered rotation.
4. Presentation/resource tests against registered hashes, geometry, and command order.
5. Executable controller tests for Retry/Replay success, pre-commit rollback, stale navigation,
   poisoned ownership, and post-commit cleanup isolation across all production routes. GN
   additionally proves detached construction, shell activation/result rollback, exact-once
   objectives/ranking, late-tail activity, music exclusion, and particle teardown.
6. Build-content audit rejecting APKs, `libgame.so`, extracted native/decompiler output,
   old Cocos2d-x code/runtime, secrets, and obsolete platform SDKs. The audit hashes every
   archive entry, parses exact ZIP records, recurses through bounded nested archives, and
   permits ELF only at the pinned Creator 3.8.8 `libcocos.so` boundary.

Current checkpoint: full vertical slice `1212/1212`, `tests/*.mjs` `43/43`,
inventory/source/staging/archive workflow `14/14` in `217s`, reconstruction policy positive
plus `4/4` negative fixtures, native static analysis `7/7`, strict Creator TypeScript, and
clean diff hygiene. Metadata reports zero structural errors and zero duplicate UUIDs; fidelity
remains blocked only by preserved unsupported `Fonts/CooperBlackStd.otf`. A fresh
Creator-served Browser Preview confirms Main Menu → Mode Select → GN Style → intro → live
cuts/score/music/particles → Pause/Resume/Replay → Pause Quit → Main Menu → repeated entry →
natural Time Up → Result Retry → Result Menu. DevTools reports zero application/runtime
errors; one unrelated Chrome extension error remains outside the game. Compact `360x800`
and high `720x1280` Preview profiles also confirm Main Menu → Options selection/purchase/Back
with an empty Cocos Editor console. App-hide ordering is certified by executable tests because
browser focus changes did not reliably deliver the Cocos lifecycle event.

## Current Blockers

- The persistent Canvas map is authoritative for the app shell and all six gameplay owners,
  but the remaining non-mode scene/prefab map and global consumers are not authored yet.
- Creator Preview has exercised exact ordinary-fruit presentation, trajectories, cut halves,
  core audio, cut/score, three-miss game over, and two same-parent Result->Retry cycles without
  a reload or game/Cocos console error. The executable Retry harness covers construction,
  early/late physics, post-parent attachment, commit, and Result-cleanup failures. Exact contact,
  ray traversal order, deferred destruction, and deterministic trajectory equivalence remain open.
- Crazy Preview has exercised production entry, live entity spawning, Replay, Quit, re-entry,
  natural Time-Up -> Result, and Result Retry with zero Creator Console errors. Its transaction
  harness covers command-listener, provisional Result, cleanup, and observer failures.
- Classic Bird Preview has exercised the live Bird blade, particle trail, Game Over -> Result,
  Result Retry, Pause/Resume, and Replay/Quit with zero errors.
- Crazy Bird Preview has exercised the profiled mode-4 runtime, BirdBlade type `2`, live
  spawning, Pause/Resume/Replay, and Pause Quit back to Main Menu. Its transaction harness
  covers fatal navigation ownership release, result rollback, retry, menu, and observer errors.
- GN Style Preview has exercised exact intro/resources, live ordinary cuts and score, the
  439-parent effect, Pause/Resume, Replay, Pause Quit, repeated entry, natural Time Up,
  Result Retry, and Result Menu. Its transaction harness covers detached construction,
  activation/result rollback, stale requests, fatal ownership, late-tail callbacks, music,
  ranking/objective commit, and cleanup.
- The canonical sample-project resource manifest/root remains unresolved; presentation
  completion and the `99%` metric both stay blocked on that source.
- The remaining Settings gap is the first-launch `flag` bootstrap plus the broader options UI;
  Main Menu exit-save and app-hide save are already closed.
- BombElectric runs through the memory-safe target adapter, but exact pinned-backend
  contact-count/direction equivalence remains unresolved.
- Original content rights remain unknown.

## References

- `../static-reconstruction-method.md`
- `../../forensics/contracts/classic-physics-contract.md`
- `../../forensics/contracts/classic-toss-contract.md`
- `../../forensics/contracts/classic-cut-score-contract.md`
- `../../forensics/contracts/classic-time-state-contract.md`
- `../../forensics/contracts/classic-presentation-contract.md`
- `../../forensics/contracts/crazy-mode-contract.md`
- `../../forensics/contracts/gn-style-mode-contract.md`
- `../../reference/reconstruction-policy.yaml`
- `../../plans/260721-2253-pencil-blade-restoration/reports/creator-readiness-2026-07-22.md`
- `../../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-23-crazy-mode-runtime.md`
- `../../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-gn-style-runtime.md`
- `../../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-cosmetic-economy-native-contract.md`
- `../../plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-24-gn-style-final-checkpoint.md`
- `../../plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-24-gn-style-gameplay-shell.md`
- `../../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-options-runtime.md`
- `../../plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-24-options-final-checkpoint.md`
- `../../plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-24-options-runtime.md`

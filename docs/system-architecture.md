# System Architecture

## Current State

Pencil Blade is being rebuilt as a static-evidence, clean-room Cocos Creator 3.8.8 project.
The workspace now contains a Creator foundation under `game/`, pure TypeScript domain modules,
Creator-facing adapters, deterministic contract tests, and an Editor-authored `classic.scene`.
All 862 recovered APK game assets are staged byte-for-byte in the Creator `game` bundle.
The Canvas now hosts a persistent application shell that constructs the exact shared
Background/Leaf/Theme stack, boots Main Menu, replaces it with Mode Select, and enters the
bounded Classic loop through recovered mode `0`, the production Crazy loop through mode `1`,
or the production Classic Bird loop through mode `3`. Classic and Bird both route
transactionally to Retry or back to Main Menu. The path uses recovered menu, mode-select,
background, text, score-HUD, fail-marker, ordinary fruit/cut-half, critical-particle, result,
font, audio, standard-bomb/fuse/explosion, Crazy bonus/electric/magnet/Dragon, objective,
pause, and exact blade/Bird resources.

Automated verification currently reaches `876/876` vertical-slice tests including the focused
Crazy/TimeManager regressions and the new Classic Bird checkpoint, and `14/14` complete static
inventory/source/staging/archive workflow cases. Reconstruction policy positive and `4/4`
negative fixtures, strict Creator TypeScript, dependency inventory, diff hygiene, and
independent review remain part of the checkpoint. A fresh Creator-served headless Browser Preview
now reaches Main Menu → Mode Select → Classic Bird, live Bird presentation, Game Over → Result,
Result Retry, Pause/Resume, and Replay/Quit with zero runtime or console errors after the
Classic Bird checkpoint. The full gameplay and presentation layer remains incomplete because
modes `2`, `4`, and `5`, full consumer coverage, and a real Android build are still open.

## Dependency Direction

```text
Creator scenes / components / prefabs
               |
               v
Creator adapters and ports
               |
               v
pure TypeScript domain modules
```

The dependency direction is one-way. Domain modules do not import `cc`. Creator code adapts
the domain to scene lifecycle, rendering, audio, storage, and Physics2D.
The serialized scene and gameplay controllers prepare resources but stay passive at boot.
`RecoveredAppShellController` owns the active-screen lifecycle and commits Classic, Crazy, or
Classic Bird activation only after Mode Select hands off recovered mode `0`, `1`, or `3`;
component enable/disable is not the pause boundary.

During Classic play, `ClassicGameplayController` creates three ordered, zero-transform presentation roots beneath
Canvas: ClassicScoreHudRoot, ClassicWorldPresentationRoot, then
ClassicFailPresentationRoot. Fruits, cut halves, and critical particles stay inside the World
root, so dynamic creation cannot cross the recovered equal-z HUD/fail ordering. Persistent fail
markers retain their recovered `1 -> 2 -> 3` insertion order inside the Fail root. The terminal
callback destroys only those Classic-owned roots, preserving the paper background and resource
catalog while `ClassicResultPresentationRoot` takes their place at recovered z-order `1`.
The paper is centered and immediately opaque. Static vtable resolution established that the
native `BackgroundLayer` queued its nominal fade while non-running, so the action never changed
opacity; the Creator adapter intentionally preserves the effective frame rather than animating it.

## Layer Map

| Layer | Owned By | Notes |
|---|---|---|
| Evidence and docs | `docs/`, `forensics/`, `reference/`, `plans/` | Static evidence, contracts, and progress records. |
| Pure gameplay domain | `game/assets/scripts/domain/` | Session, physics, score, combo, fail, toss, random, input, bird, and result logic. |
| Creator boundary | `game/assets/scripts/creator/` | Unit conversion, manual variable-step lifecycle, bird input/ray handling, and Creator-specific integration. |
| Creator resource bundle | `game/assets/game/` | Exact staged bytes for all 862 recovered APK game assets; reviewed Classic, menu/shared-scene, Crazy, and Bird subsets have production consumers while full consumer coverage remains open. |
| Initial scene bridge | `game/assets/scenes/classic.scene` | Editor-serialized Canvas with blade input, passive Classic, Crazy, and Bird session/gameplay components, and the persistent recovered app shell. |
| Verification | `tests/reconstruction/vertical-slice/` | Deterministic contract tests, executable controller lifecycle/fault tests, and boundary audits. |
| Build audit | `scripts/audit-creator-build.mjs` | Post-build APK/AAB inspection for prohibited payloads. |

## Current Domain Boundaries

| Boundary | Current rule |
|---|---|
| Physics2D | Recovered gravity, body and fixture values, ray-order behavior, and variable `frameDt * worldSpeed` stepping are encoded in pure modules. Automatic simulation stays off during Classic; a project-owned `System.postUpdate` performs one synchronized manual step and flushes project lifecycle mutations only after Box2D unlocks. Result replacement idempotently unregisters that system and restores the prior automatic-simulation, gravity, and fruit/bomb collision-matrix state. |
| Spawn and toss | Spawn ordering, intervals, fruit selection, and controller sequencing live in pure modules. Flattened Concurrent output is accepted only as ordered, contiguous, complete per-entity plans. |
| Score HUD, combo, fail | Score, combo window, double-score behavior, best-score updates/state, the shared `ComboItem` banner, and the three-miss state are pure. Dedicated Creator presenters own the exact score icon, best-score cup, double-score panel, `Fonts/Linds.ttf`, the shared `ComboItem` label via `Fonts/GroBold.ttf`, recovered entry fade, score-icon pulse, overlapping double-score actions, and the normal/filled marker rasters with their action timings and completion callbacks. The HUD baseline loads from `classic_best_1`. |
| Result entry | Pure modules own mode-0 layout, completed-run score formatting, `>=` leaderboard insertion, the recovered `[first, second, third]` panel order, signed-int32 Settings mutations, float32 `score * 0.6` truncation, the delayed 100-particle plan, and the reward tree. Creator presenters own the exact shell/reward rasters and fonts, selected button frames, equal-z order, independent `0.75 / 1.0 / 1.75`-second actions, the `1.65`-second five-draw-per-particle burst, `1.75`-second effect → coin → badge → accounting → label boundary, `2.5`-second rotating effect, and `11.15`-second emitter cleanup. Rank audio is emitted at the recovered mid-construction boundary. Retry synchronously detaches Result, constructs fresh run-owned state, restarts the Classic session/physics boundary, and attaches the new mode to the captured parent at z-order `1`. Creator retains Result cleanup only within that callback until attachment commits; a pre-commit exception rolls back physics/run state and rearms the identical Result without replaying ranking, coins, or RNG work. Post-commit engine cleanup is best-effort and cannot tear down the fresh Classic state. |
| Classic Settings | A process-owned runtime loads and saves the eleven implemented values for coins, selected theme/background/blade, Classic and Crazy leaderboards, music/effect flags, network sentinel, and rated state in recovered relative order. Indexed Mode Select unlocks use their separate immediate persistence keys. Missing or corrupt storage falls back to `999999` coins while a valid persisted balance wins; result mutations stay memory-only until app hide. Save failures emit a diagnostic without crashing the session and unreadable target storage disables writes for that process to avoid overwriting progression after a transient read failure. The remaining native Settings schema, first-launch initialization, and Main Menu exit-save remain open. |
| Bird substrate and mode `3` | `bird-blade-state.ts`, `bird-blade-particle-plan.ts`, `bird-resource-contract.ts`, `classic-bird-session.ts`, `classic-bird-toss-config.ts`, `classic-bird-toss-coordinator.ts`, `classic-bird-result-ranking.ts`, `classic-bird-result-navigation.ts`, `bird-input-controller.ts`, `bird-blade-ray-adapter.ts`, `bird-blade-presenter.ts`, `bird-resource-loader.ts`, `classic-bird-scene-controller.ts`, `classic-bird-gameplay-controller.ts`, `classic-bird-word-presenter.ts` | `bird-*.test.ts`, `classic-bird-*.test.ts`, Creator bundled strict TypeScript | Shared BaseBird/BirdBlade substrate and Classic Bird production route integrated; Replay/Quit clean | Owns the single touch-directed Bird blade, always-updating particle trail, cached ray path, bird-only resource bundle, Classic Bird intro/terminal/result flow, and the mode-3 retry/restart lifecycle. |
| Cut handling | Blade tracking and bidirectional ray planning are pure; the Creator gameplay bridge executes two ordered post-step raycasts and preserves repeated fixture dispatch until batch disposal. |
| BasicBlade presentation | `BasicBladeTrailModel` independently owns the four visual trail slots, exact float32 width/overflow/disposal lifecycle, triangle-strip geometry, and alpha UVs. `ClassicBladePresenter` binds the exact default `Blades/blade0.png` SpriteFrame to four persistent `500`-byte, 20-byte-stride dynamic meshes. Raw touch events feed this path before the post-physics nonzero-ray filter. Creator's asynchronous resource boundary lazily claims a slot on the first real post-attachment move and never synthesizes a missed point. Although the scene is 2D, Creator's `UIMeshRenderer` adapter depends on `MeshRenderer`; `game/settings/v2/packages/engine.json` therefore keeps Basic 3D and its editor-generated dependencies in Feature Cropping. This enables the renderer API only and does not introduce 3D gameplay. |
| Mode Select | `ModeSelectState` owns the six-card rail, direct drag/flick rules, frame-count centering, delayed same-parent navigation commands, four lock states, `2500`-coin persistence asymmetry, and insufficient-coin overlap. Its unlock planner creates exactly 45 immutable particle action sets from 225 shared-RNG draws after the recovered `0.05`-second delay. `ModeSelectPresenter` and seven `ModeSelectRopeButtonPresenter` instances own the exact rail visuals, real Physics2D bodies/joints, cut halves, deferred mutation boundary, input lease, persistence transaction, and rollback/convergence paths. Modes `0`, `1`, and `3` enter their separately prepared Classic, Crazy, and Classic Bird owners; modes `2`, `4`, and `5` remain fail closed. |
| Crazy mode | `CrazySession`, `CrazyTossCoordinator`, `TimeManagerService`, bonus/objective/result domains, `CrazySceneController`, and `CrazyGameplayController` own the recovered 60-second controller graph and presentation adapters. The production registry covers normal/double/bonus tosses, standard bomb fuse/explosion, electric contacts, magnet, special fruit, Dragon and its auxiliary pieces, audio, HUD, pause, and mode-1 result ranking/reward. Time-Up command dispatch drains its recovered ordered suffix once while preserving original errors. Time-Up Finish is a two-phase transaction: provisional Result attaches while the exact Crazy/TimeManager owner is retained; any pre-commit failure removes Result and restores that same owner; domain commit then records the leaderboard once and retires any failed cleanup for Result Retry. Post-commit observer failures are reported without rollback or rearming a disposed TimeManager. |
| Shared scene | `SharedLeafLayerModel` owns both exact seven-leaf profiles, creation-order RNG, body/fixture/world values, strict respawn threshold, and display mapping. `SharedLeafPhysicsAdapter` owns the independent world and receives `Step(dt,5,5)` plus each same-frame respawn as an ordered frozen `wake → add angular velocity → set transform → zero linear velocity` command before display synchronization. `SharedGameScenePresenter` appends Background → Leaf → Theme → current screen at equal recovered z-order `1`; Background/Theme remain immediately opaque because their queued native fades are paused. |
| Cut presentation | Ordinary cuts instantiate exact bottom/top rasters, recovered body/fixture/impulse values, action-clock fade, and deferred disposal. Critical halves may emit exact recovered particle rasters with shared RNG ordering. |
| Audio | Creator adapters preload the reviewed Classic/menu, Classic Bird, and Crazy clip sets and interpret toss, swish, cut, critical, combo, result-rank, bonus/electric, objective, pause, and menu-button commands without moving draw/order rules out of the domain. Independent retained voices model ordinary-bomb and Crazy effect ownership; the electric-only `boomhit` path remains separate from ordinary-bomb audio. |
| Resource import | Staging and metadata validators prove exact bytes and current Creator raster/audio import geometry for the recovered APK corpus. Per-asset consumer and UUID coverage is not yet backfilled into the manifest. |
| Resolution and input | The recovered `720` physical-width profile branch is pure; Creator applies its Show All policy and routes scene-wide touch input into four blade slots or the single Bird blade. |
| Build boundary | Source-boundary tests reject trackable legacy integration. The separate fail-closed archive audit hashes every entry, parses ZIP records exactly, recurses through bounded nested archives, and inspects ELF payloads; the complete inventory/source/staging/archive workflow is currently `14/14`, and a real Creator artifact is still pending. |

## Open Architectural Gaps

- Scene and serialized component ownership is established for the first Canvas bridge; the
  remaining scene/prefab/presenter map is open.
- The persistent shell now preserves the recovered equal-z append order Background → Leaf →
  Theme → current screen, and all live routes stay transactional. The current Classic Bird
  checkpoint is confirmed in a fresh Creator-served Browser Preview.
- Modes `2`, `4`, and `5` retain recovered Mode Select cards and locks but have no destination
  presenters. They deliberately fail closed rather than aliasing Classic or inventing gameplay.
  Phase 6 continues with Crazy Bird, then Combo Bird, and GN Style.
- Dynamic-body trajectory, ray ordering, and deferred lifecycle behavior still need live Box2D validation on the custom variable-step boundary.
- The exact BasicBlade model/resource/mesh contract is integrated and deterministic tests cover
  four-slot reuse plus asynchronous attachment, but controller-confirmed Preview/device
  rendering, legacy numeric blend factors, sampler behavior, and pixel output remain unresolved
  at the adapter boundary.
- Exact recovered APK resources are imported and the first Classic, Crazy, and Bird consumers are
  integrated; most of the 862 assets still need consumer mapping. The canonical sample-project root remains
  unresolved, so corpus completeness and the final fidelity denominator are still open.
- Standard-bomb entry/cut state, fuse smoke, procedural full-quad/triangle explosion, completion,
  and Crazy registry/controller activation are implemented. Classic scheduling and any distinct
  native lower-bound bomb side effect remain open; the entity does not reuse Fruit's miss
  callback as a substitute.
- The shell persists eleven recovered Settings fields plus separate indexed mode-unlock keys.
  The remaining native Settings fields, first-launch initialization checkpoint, and Main Menu
  exit-save are open.
- Exact result-entry layout/ranking/actions, reward visuals, app-hide persistence, Result-to-Main
  replacement, same-parent Retry reconstruction, and the Bird mode-3 route are integrated behind transactional rollback
  boundaries.
- The electric-field memory-safe adapter runs in automated validation without a crash, but exact
  contact-count/direction equivalence still needs a targeted pinned-backend validation.
- Rights for legacy art, music, fonts, name, and trademarks are still unknown.

# System Architecture

## Current State

Pencil Blade is being rebuilt as a static-evidence, clean-room Cocos Creator 3.8.8 project.
The workspace now contains a Creator foundation under `game/`, pure TypeScript domain modules,
Creator-facing adapters, deterministic contract tests, and an Editor-authored `classic.scene`.
All 862 recovered APK game assets are staged byte-for-byte in the Creator `game` bundle.
The Canvas now hosts a persistent application shell that constructs the exact shared
Background/Leaf/Theme stack, boots Main Menu, replaces it with Mode Select, and enters the
bounded Classic loop through recovered mode `0`, the production Crazy loop through mode `1`,
the production Classic Bird loop through mode `3`, or the production Crazy Bird loop through
mode `4`, the independent production Combo Bird loop through mode `5`, or the independent
production GN Style loop through mode `2`. All six routes replace screens transactionally and
support their recovered Retry/Replay/Quit/Main Menu paths.
Combo Bird does not profile the Crazy graph: it owns a `90`-second timed session, three
ordinary-fruit toss controllers, BirdBlade type `3`, exact type-3 and
instruction/TimeManager resources, objectives, pause, result ranking/reward,
`bird_combo_best_1..3`, and a float32 `0.8` result reward.
GN Style owns the standard BasicBlade, `150`-second Free/Wave/Concurrent graph, exact
`2.60`-second intro, dedicated non-looping music, 439 source-ordered particle parents,
three-second late-cut Time Up tail, objectives `6`/`2`, `gnstyle_best_1..3`, and a
float32 `0.6` result reward.

Automated verification reaches `1212/1212` full vertical-slice tests and `43/43`
resource/build/catalog tests. The unchanged
inventory/evidence workflow remains `14/14` in `217s`; reconstruction policy positive plus
`4/4` negative fixtures, native static analysis `7/7`, strict Creator TypeScript, and diff
hygiene are clean. Metadata has zero structural errors and zero duplicate UUIDs; it remains
`fidelity-blocked` only by preserved unsupported `Fonts/CooperBlackStd.otf`. The final
Creator-served Preview reaches the complete GN entry, live gameplay, Pause/Resume/Replay,
Pause Quit, repeated entry, natural Result, Retry, and Menu flow with zero application/runtime
errors. The current Options screen also passes its Main Menu entry, selection, purchase, Back,
and rollback flows in compact `360x800` and high `720x1280` Preview profiles with an empty
Cocos Editor console. The full product remains incomplete because global consumer coverage, full
progression/menu/settings fidelity, and a real Android build are still open.

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
`RecoveredAppShellController` owns the active-screen lifecycle and commits Classic, Crazy,
GN Style, Classic Bird, Crazy Bird, or Combo Bird activation only after Mode Select hands off
recovered mode `0`, `1`, `2`, `3`, `4`, or `5`; component enable/disable is not the pause boundary.

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
| Pure gameplay domain | `game/assets/scripts/domain/` | Session, physics, score, combo, fail, toss, random, input, bird, GN choreography/music/result, and shared result logic. |
| Creator boundary | `game/assets/scripts/creator/` | Unit conversion, manual variable-step lifecycle, standard/Bird input and ray handling, per-route scene/gameplay/resource/audio presenters, Options presenters, and Creator-specific integration. |
| Creator resource bundle | `game/assets/game/` | Exact staged bytes for all 862 recovered APK game assets; reviewed Classic, menu/shared-scene, Options, Crazy, Combo, GN, and Bird type-1/type-2/type-3 subsets have production consumers while full consumer coverage remains open. |
| Initial scene bridge | `game/assets/scenes/classic.scene` | Editor-serialized Canvas with blade input, passive Classic, shared Crazy modes `1`/`4`, Classic Bird, Combo Bird, and GN Style runtime components, and the persistent recovered app shell. |
| Verification | `tests/reconstruction/vertical-slice/` | Deterministic contract tests, executable controller lifecycle/fault tests, and boundary audits. |
| Build audit | `scripts/audit-creator-build.mjs` | Post-build APK/AAB inspection for prohibited payloads. |

## Current Domain Boundaries

| Boundary | Current rule |
|---|---|
| Physics2D | Recovered gravity, body and fixture values, ray-order behavior, and variable `frameDt * worldSpeed` stepping are encoded in pure modules. Automatic simulation stays off during Classic; a project-owned `System.postUpdate` performs one synchronized manual step and flushes project lifecycle mutations only after Box2D unlocks. Result replacement idempotently unregisters that system and restores the prior automatic-simulation, gravity, and fruit/bomb collision-matrix state. |
| Spawn and toss | Spawn ordering, intervals, fruit selection, and controller sequencing live in pure modules. Flattened Concurrent output is accepted only as ordered, contiguous, complete per-entity plans. |
| Score HUD, combo, fail | Score, combo window, double-score behavior, best-score updates/state, the shared `ComboItem` banner, and the three-miss state are pure. Dedicated Creator presenters own the exact score icon, best-score cup, double-score panel, `Fonts/Linds.ttf`, the shared `ComboItem` label via `Fonts/GroBold.ttf`, recovered entry fade, score-icon pulse, overlapping double-score actions, and the normal/filled marker rasters with their action timings and completion callbacks. The HUD baseline loads from `classic_best_1`. |
| Result entry | Pure modules own mode-0 layout, completed-run score formatting, `>=` leaderboard insertion, the recovered `[first, second, third]` panel order, signed-int32 Settings mutations, float32 `score * 0.6` truncation, the delayed 100-particle plan, and the reward tree. Creator presenters own the exact shell/reward rasters and fonts, selected button frames, equal-z order, independent `0.75 / 1.0 / 1.75`-second actions, the `1.65`-second five-draw-per-particle burst, `1.75`-second effect → coin → badge → accounting → label boundary, `2.5`-second rotating effect, and `11.15`-second emitter cleanup. Rank audio is emitted at the recovered mid-construction boundary. Retry synchronously detaches Result, constructs fresh run-owned state, restarts the Classic session/physics boundary, and attaches the new mode to the captured parent at z-order `1`. Creator retains Result cleanup only within that callback until attachment commits; a pre-commit exception rolls back physics/run state and rearms the identical Result without replaying ranking, coins, or RNG work. Post-commit engine cleanup is best-effort and cannot tear down the fresh Classic state. |
| Classic Settings | A process-owned runtime loads and saves the implemented subset for coins, selections, all six production-route leaderboards, objective state, music/effect flags, network sentinel, and rated state in recovered relative order. The bulk schema is exact: 50 integers and 4 booleans, with 18 blade price keys/defaults and 8 background price keys/defaults. Indexed Mode Select unlocks use their separate immediate persistence keys. Price `0` is the ownership sentinel. Options purchases atomically persist ownership before committing the single in-memory coin debit, accept exact affordability, and leave insufficient/already-owned/storage-failure paths inert. Field-isolated recovery preserves any valid `totalCoins`, including `0`; only missing, corrupt, or unreadable coin storage falls back to `999999`, and any recovery disables writes for that process. Main Menu exit-save and app-hide save are implemented; the first-launch `flag` bootstrap remains open. |
| Options | `OptionsState` and presentation/resource contracts own eight backgrounds, eighteen blades, ten themes, selector state, exact Buy visibility/prices, affordability, exit rollback, and the 45-particle purchase plan. Creator presenters own the one-screen `1.25 / 1.50 / 1.75`-second row reveal, exact 51-raster per-tree profile, `SlabThing`, `menubuttonclick`, `mono1`, `mono2`, live shared background/theme preview, transactional Main Menu handoff, and `xmasfive` burst. Back and app-hide reconcile unpaid background/blade previews to index `0`; theme, owned choices, and persisted background index `8` follow their recovered compatibility rules. A reconciliation failure suppresses app-hide save and remains retryable. |
| Bird substrate and mode `3` | `bird-blade-state.ts`, `bird-blade-particle-plan.ts`, `bird-resource-contract.ts`, and the Bird Creator adapters own the single touch-directed blade, always-updating particle trail, cached ray path, and exact Bird resources. Classic Bird adds its untimed intro/fail/result/retry lifecycle through `classic-bird-*`. |
| Crazy Bird mode `4` | `crazy-timed-mode-profile.ts`, `crazy-bird-result-ranking.ts`, and `crazy-bird-result-navigation.ts` profile the shared `CrazySession`, `CrazySceneController`, and `CrazyGameplayController`. Mode `4` composes the recovered 60-second Crazy graph with BirdBlade type `2`, exact type-2 resources, objective events `9`/`5`, `bird_crazy_best_1..3`, float32 `0.8` reward, and fresh mode-4 replay/retry/menu ownership. The exact native `ActionGoCallback` operand/order remains a disclosed static inference gap. |
| Combo Bird mode `5` | `combo-bird-session.ts`, `combo-bird-toss-config.ts`, `combo-bird-toss-coordinator.ts`, Combo Bird intro/resource/result domains, and the dedicated Combo Creator controllers own a separate `90`-second ordinary-only runtime. The route composes BirdBlade type `3`, exact type-3 and supplemental resources, objective selector `7`, pause/result ownership, `bird_combo_best_1..3`, float32 `0.8` reward, and fresh replay/retry/menu transactions without Crazy bombs, bonuses, specials, freeze, magnet, electric, or Dragon behavior. The low/high `text-juscombo.png` / `text-justcombo.png` mapping remains an explicit target adaptation backed by exact per-tree assets. |
| GN Style mode `2` | `gn-style-session.ts`, `gn-style-toss-config.ts`, `gn-style-toss-coordinator.ts`, intro/choreography/explosion/resource/result domains, generated choreography data, and dedicated GN Creator controllers own a separate `150`-second ordinary-only runtime. The route composes the standard BasicBlade, exact `2.60`-second intro, non-looping `GangnamStyle.mp3`, six-family 439-parent particle choreography, objective selector `6` plus final selector `2`, a three-second late-cut tail with live input/physics/entities/score, `gnstyle_best_1..3`, float32 `0.6` reward, shared TimeManager audio, and fresh replay/retry/quit/menu transactions. |
| Cut handling | Blade tracking and bidirectional ray planning are pure; the Creator gameplay bridge executes two ordered post-step raycasts and preserves repeated fixture dispatch until batch disposal. |
| BasicBlade presentation | `BasicBladeTrailModel` independently owns the four visual trail slots, exact float32 width/overflow/disposal lifecycle, triangle-strip geometry, and alpha UVs. `ClassicBladePresenter` binds the exact default `Blades/blade0.png` SpriteFrame to four persistent `500`-byte, 20-byte-stride dynamic meshes. Raw touch events feed this path before the post-physics nonzero-ray filter. Creator's asynchronous resource boundary lazily claims a slot on the first real post-attachment move and never synthesizes a missed point. Although the scene is 2D, Creator's `UIMeshRenderer` adapter depends on `MeshRenderer`; `game/settings/v2/packages/engine.json` therefore keeps Basic 3D and its editor-generated dependencies in Feature Cropping. This enables the renderer API only and does not introduce 3D gameplay. |
| Mode Select | `ModeSelectState` owns the six-card rail, direct drag/flick rules, frame-count centering, delayed same-parent navigation commands, four lock states, `2500`-coin persistence asymmetry, and insufficient-coin overlap. Its unlock planner creates exactly 45 immutable particle action sets from 225 shared-RNG draws after the recovered `0.05`-second delay. `ModeSelectPresenter` and seven `ModeSelectRopeButtonPresenter` instances own the exact rail visuals, real Physics2D bodies/joints, cut halves, deferred mutation boundary, input lease, persistence transaction, and rollback/convergence paths. All modes `0` through `5` enter separately prepared owners. |
| Crazy mode | `CrazySession`, `CrazyTossCoordinator`, `TimeManagerService`, bonus/objective/result domains, `CrazySceneController`, and `CrazyGameplayController` own the recovered 60-second controller graph and presentation adapters. The production registry covers normal/double/bonus tosses, standard bomb fuse/explosion, electric contacts, magnet, special fruit, Dragon and its auxiliary pieces, audio, HUD, pause, and mode-1 result ranking/reward. Time-Up command dispatch drains its recovered ordered suffix once while preserving original errors. Time-Up Finish is a two-phase transaction: provisional Result attaches while the exact Crazy/TimeManager owner is retained; any pre-commit failure removes Result and restores that same owner; domain commit then records the leaderboard once and retires any failed cleanup for Result Retry. Post-commit observer failures are reported without rollback or rearming a disposed TimeManager. |
| Shared scene | `SharedLeafLayerModel` owns both exact seven-leaf profiles, creation-order RNG, body/fixture/world values, strict respawn threshold, and display mapping. `SharedLeafPhysicsAdapter` owns the independent world and receives `Step(dt,5,5)` plus each same-frame respawn as an ordered frozen `wake → add angular velocity → set transform → zero linear velocity` command before display synchronization. `SharedGameScenePresenter` appends Background → Leaf → Theme → current screen at equal recovered z-order `1`; Background/Theme remain immediately opaque because their queued native fades are paused. |
| Cut presentation | Ordinary cuts instantiate exact bottom/top rasters, recovered body/fixture/impulse values, action-clock fade, and deferred disposal. Critical halves may emit exact recovered particle rasters with shared RNG ordering. |
| Audio | Creator adapters preload the reviewed Classic/menu, Options, Bird, Crazy, Combo, and GN clip sets and interpret toss, swish, cut, critical, combo, timer, result-rank, bonus/electric, objective, pause, selector-row, and menu-button commands without moving draw/order rules out of the domain. Independent retained voices model ordinary-bomb and Crazy effect ownership; the electric-only `boomhit` path remains separate from ordinary-bomb audio. GN's dedicated non-looping source is mutually exclusive with shared background music and pauses/resumes/stops with its transactional owner; TimeManager effects use the shared exact presenter. |
| Resource import | Staging and metadata validators prove exact bytes and current Creator raster/audio import geometry for the recovered APK corpus. Options directly consumes 51 rasters per tree plus its exact font and three sounds. Per-asset consumer and UUID coverage is not yet backfilled into the manifest. |
| Resolution and input | The recovered `720` physical-width profile branch is pure; Creator applies its Show All policy and routes scene-wide touch input into four blade slots or the single Bird blade. |
| Build boundary | Source-boundary tests reject trackable legacy integration. The separate fail-closed archive audit hashes every entry, parses ZIP records exactly, recurses through bounded nested archives, and inspects ELF payloads; the unchanged inventory/source/staging/archive workflow is `14/14`, `tests/*.mjs` are `43/43`, the full vertical slice is `1212/1212`, and strict Creator TypeScript is green. |

## Checkpoint Evidence

- [GN Style native contract](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-gn-style-native-contract.md)
- [Cosmetic economy native contract](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-cosmetic-economy-native-contract.md)
- [GN Style resource map](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-gn-style-resource-map.md)
- [GN Style production checkpoint](../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-gn-style-runtime.md)
- [GN Style final verification](../plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-24-gn-style-final-checkpoint.md)
- [GN Style runtime review](../plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-24-gn-style-gameplay-shell.md)
- [Options native contract](../plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-options-native-contract.md)
- [Options integration map](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-options-integration-map.md)
- [Options resource audit](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-options-resource-audit.md)
- [Options production checkpoint](../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-options-runtime.md)
- [Options final verification](../plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-24-options-final-checkpoint.md)
- [Options runtime review](../plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-24-options-runtime.md)

## Open Architectural Gaps

- Scene and serialized component ownership is established for the first Canvas bridge; the
  remaining scene/prefab/presenter map is open.
- The persistent shell now preserves the recovered equal-z append order Background → Leaf →
  Theme → current screen, and all six live routes stay transactional. The current GN Style
  checkpoint is confirmed across entry, gameplay, pause, replay, quit, natural Result, Retry,
  Menu, and repeated entry in fresh Creator-served Browser Preview.
- Main Menu ↔ Options, all selector families, purchase/rollback behavior, and both resource
  profiles are integrated. App-hide reconciliation is certified by executable lifecycle tests
  and source review because browser focus changes did not reliably emit Cocos app-hide.
- Dynamic-body trajectory, ray ordering, and deferred lifecycle behavior still need live Box2D validation on the custom variable-step boundary.
- The exact BasicBlade model/resource/mesh contract is integrated and deterministic tests cover
  four-slot reuse plus asynchronous attachment, but controller-confirmed Preview/device
  rendering, legacy numeric blend factors, sampler behavior, and pixel output remain unresolved
  at the adapter boundary.
- Exact recovered APK resources are imported and the Classic, Crazy, GN Style, Classic Bird,
  Crazy Bird, and Combo Bird consumers are integrated; most of the 862 assets still need consumer mapping. The
  canonical sample-project root remains unresolved, so corpus completeness and the final
  fidelity denominator are still open.
- Standard-bomb entry/cut state, fuse smoke, procedural full-quad/triangle explosion, completion,
  and Crazy registry/controller activation are implemented. Classic scheduling and any distinct
  native lower-bound bomb side effect remain open; the entity does not reuse Fruit's miss
  callback as a substitute.
- The shell persists the implemented Settings subset plus separate indexed mode-unlock keys
  and the recovered Options purchases/selections. The remaining native Settings fields and
  first-launch `flag` bootstrap are open.
- Exact result-entry layout/ranking/actions, reward visuals, app-hide persistence, Result-to-Main
  replacement, same-parent Retry reconstruction, and Bird modes `3`/`4`/`5` are integrated
  behind transactional rollback boundaries.
- The electric-field memory-safe adapter runs in automated validation without a crash, but exact
  contact-count/direction equivalence still needs a targeted pinned-backend validation.
- Rights for legacy art, music, fonts, name, and trademarks are still unknown.

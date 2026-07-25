# System Architecture

## Current State

Pencil Blade is being rebuilt as a static-evidence, clean-room Cocos Creator 3.8.8 project.
The workspace now contains a Creator foundation under `game/`, pure TypeScript domain modules,
Creator-facing adapters, deterministic contract tests, and an Editor-authored `classic.scene`.
All 862 recovered APK game assets are staged byte-for-byte in the Creator `game` bundle.
Phase 7 now splits the technical release surface into exactly two supported outputs:
Android debug APK and Web Mobile H5. The sanitized build configs live in
`game/build-configs/android-debug.json` and `game/build-configs/web-mobile-pages.json`.
Preservation lives in `release/recovered-reconstruction-manifest.json`; the blocked public
web path lives in `release/public-release-variant-manifest.json`.
The Canvas now hosts a persistent application shell that first presents the recovered
four-sprite Loading overlay and exact 62-step audio preload sequence, commits Main Menu beneath
that overlay, then constructs the exact shared Background/Leaf/Theme stack, replaces Main Menu
with Mode Select, and enters the
bounded Classic loop through recovered mode `0`, the production Crazy loop through mode `1`,
the production Classic Bird loop through mode `3`, or the production Crazy Bird loop through
mode `4`, the independent production Combo Bird loop through mode `5`, or the independent
production GN Style loop through mode `2`. The standard-blade runtime checkpoint now spans
Main Menu, Mode Select, Classic, the Crazy standard branch, and GN Style with IDs `0`-`17`
transactionally routed through the shared shell. The six gameplay routes replace screens
transactionally and support their recovered Retry/Replay/Quit/Main Menu paths. The dedicated
Leaderboard screen now snapshots the six process-owned Settings boards in native order, stays
local/offline and read-only, and returns to a fresh Main Menu through the persistent shell.
Combo Bird does not profile the Crazy graph: it owns a `90`-second timed session, three
ordinary-fruit toss controllers, BirdBlade type `3`, exact type-3 and
instruction/TimeManager resources, objectives, pause, result ranking/reward,
`bird_combo_best_1..3`, and a float32 `0.8` result reward.
GN Style owns the standard BasicBlade, `150`-second Free/Wave/Concurrent graph, exact
`2.60`-second intro, dedicated non-looping music, 439 source-ordered particle parents,
three-second late-cut Time Up tail, objectives `6`/`2`, `gnstyle_best_1..3`, and a
float32 `0.6` result reward.
The serialized content boundary is now fully reconciled: `classic.scene` contains one exact
30-record persistent Canvas/Camera bridge with 13 custom controller UUIDs; active/enabled
state, node ownership, prefab sentinels, and all 49 serialized references are regression-locked.
The recursively checked 56-file metric is only the direct Node/detached-root construction
census. Separate lifecycle/composite mappings cover every recovered screen, gameplay, result,
pause, blade, particle, audio, and generated-entity surface. Static evidence requires no
additional prefab, authored material/effect, animation clip, or atlas.

Automated verification reaches `1547/1547` full vertical-slice tests, `218/218` focused
Classic pause/composition tests, and `61/61`
resource/build/catalog tests. The unchanged
inventory/evidence workflow remains `14/14` in `217s`; reconstruction policy positive plus
`4/4` negative fixtures, native static analysis `7/7`, strict Creator TypeScript, and diff
hygiene are clean. Metadata has zero structural errors and zero duplicate UUIDs; it remains
`fidelity-blocked` only by preserved unsupported `Fonts/CooperBlackStd.otf`. The final
Creator-served Preview reaches the complete GN entry, live gameplay, Pause/Resume/Replay,
Pause Quit, repeated entry, natural Result, Retry, and Menu flow with zero application/runtime
errors. The current Options screen also passes its Main Menu entry, selection, purchase, Back,
and rollback flows in compact `360x800` and high `720x1280` Preview profiles with an empty
Cocos Editor console. The current Leaderboard checkpoint is verified at 139/139 focused
Main Menu + Leaderboard + shell/viewport tests. Preview passes physical cut entry, aligned
labels/scores, drag/flick board selection, and Back in the internal compact `480x800` branch
and high `720x1280` profile. Recovered Loading also passes both branches and hands off to a
stable Main Menu with zero Cocos console counters. Resource reconciliation now has zero
recovered Android-runtime unknowns: `761` live consumers, `100` reviewed exclusions, and
`1` unsupported path. Standard Classic's shared Pause/Resume/Replay/Quit runtime passes fresh
compact/high Preview for Resume, fresh Replay, Quit, and repeated entry; Cocos counters remain
`0/0/0` and DevTools has no project error. Phase 6 is complete. Phase 7 now validates the
Android debug APK and Web Mobile H5 outputs separately; pinned Physics2D equivalence,
canonical external-corpus closure, and rights approval remain open.

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
`game/assets/scripts/creator/recovered-app-shell-controller.ts` owns the active-screen lifecycle and commits Classic, Crazy,
GN Style, Classic Bird, Crazy Bird, or Combo Bird activation only after Mode Select hands off
recovered mode `0`, `1`, `2`, `3`, `4`, or `5`; component enable/disable is not the pause boundary.

During Classic play, `game/assets/scripts/creator/classic-gameplay-controller.ts` creates three ordered, zero-transform presentation roots beneath
Canvas: ClassicScoreHudRoot, ClassicWorldPresentationRoot, then
ClassicFailPresentationRoot. Fruits, cut halves, and critical particles stay inside the World
root, so dynamic creation cannot cross the recovered equal-z HUD/fail ordering. Persistent fail
markers retain their recovered `1 -> 2 -> 3` insertion order inside the Fail root. The terminal
callback destroys only those Classic-owned roots, preserving the paper background and resource
catalog while the recovered classic result presentation root takes their place at recovered z-order `1`.
The paper is centered and immediately opaque. Static vtable resolution established that the
native recovered background layer queued its nominal fade while non-running, so the action never changed
opacity; the Creator adapter intentionally preserves the effective frame rather than animating it.

## Layer Map

| Layer | Owned By | Notes |
|---|---|---|
| Evidence and docs | `docs/`, `forensics/`, `reference/`, `plans/` | Static evidence, contracts, and progress records. |
| Pure gameplay domain | `game/assets/scripts/domain/` | Loading state/presentation/resources plus session, physics, score, combo, fail, toss, random, input, bird, GN choreography/music/result, and shared result logic. |
| Creator boundary | `game/assets/scripts/creator/` | Loading, unit conversion, manual variable-step lifecycle, standard/Bird input and ray handling, per-route scene/gameplay/resource/audio presenters, Options presenters, and Creator-specific integration. |
| Creator resource bundle | `game/assets/game/` | Exact staged bytes for all 862 recovered APK game assets: `761` have live production consumers, `100` are statically unreachable in the recovered Android runtime, and `1` remains unsupported. Historical intent and release rights remain separate from runtime disposition. |
| Initial scene bridge | `game/assets/scenes/classic.scene` | Exact 30-record Editor-serialized Canvas/Camera bridge with four built-ins and 13 imported custom UUIDs: blade input, passive Classic, shared Crazy modes `1`/`4`, Classic Bird, Combo Bird, GN Style, and the persistent recovered app shell. All screen descendants are intentionally code-built and regression-inventoried. |
| Verification | `tests/reconstruction/vertical-slice/` | Deterministic contract tests, executable controller lifecycle/fault tests, and boundary audits. |
| Build audit | `scripts/audit-creator-build.mjs`, `game/build-configs/android-debug.json`, `game/build-configs/web-mobile-pages.json`, `release/recovered-reconstruction-manifest.json`, `release/public-release-variant-manifest.json` | Post-build inspection for the Android debug APK and the Web Mobile H5 release boundary. |

## Build and Deployment Boundary

`scripts/build-android-debug.sh` injects validated machine-local SDK/NDK/JDK paths into a
bounded ignored runtime config, asks Creator `3.8.8` to generate the native project, runs only
`:CocosGame:assembleDebug`, normalizes one fresh APK, and verifies package, SDK, ABI, debug
signature, hash, and prohibited content. The generated `game/native/` and `game/build/` trees
remain ignored. The verified artifact is a local/internal debug APK, not a store artifact.

The Web path builds the same scene as `web-mobile`, audits the complete generated tree, and
serves every eager and statically discoverable lazy file under `/pencil-blade-2026/`.
The manual GitHub workflow separates a read-only self-hosted Creator build job from the
permissioned Pages deploy job. Artifact upload cannot occur until the public-rights manifest
passes. As of 2026-07-24 the local H5 artifact passes, but Pages, the runner/environment, the
Creator signature preflight, and release rights do not.

## Current Domain Boundaries

| Boundary | Current rule |
|---|---|
| Loading boot | Pure state owns the exact 62 one-per-update audio preload order, incremented-counter `/61` clamped progress, next-update delay entry, and `0.5`-second finish tail. The Creator presenter owns the four selected-profile sprites and keeps the overlay visible until the shell has activated Main Menu. The shell races every asynchronous boot boundary against the Loading failure channel, rolls back all pre-commit owners, and retires Loading best-effort only after Main Menu commits. Creator bundle readiness replaces native `SpriteFrameCache::purgeSharedSpriteFrameCache()`; no original runtime is linked or emulated. |
| Physics2D | Recovered gravity, body and fixture values, ray-order behavior, and variable `frameDt * worldSpeed` stepping are encoded in pure modules. Automatic simulation stays off during Classic; a project-owned `System.postUpdate` performs one synchronized manual step and flushes project lifecycle mutations only after Box2D unlocks. Result replacement idempotently unregisters that system and restores the prior automatic-simulation, gravity, and fruit/bomb collision-matrix state. |
| Spawn and toss | Spawn ordering, intervals, fruit selection, and controller sequencing live in pure modules. Flattened Concurrent output is accepted only as ordered, contiguous, complete per-entity plans. |
| Score HUD, combo, fail | Score, combo window, double-score behavior, best-score updates/state, the shared combo banner, and the three-miss state are pure. Dedicated Creator presenters own the exact score icon, best-score cup, double-score panel, `Fonts/Linds.ttf`, the shared combo label via `game/assets/scripts/creator/combo-item-presenter.ts` and `Fonts/GroBold.ttf`, recovered entry fade, score-icon pulse, overlapping double-score actions, and the normal/filled marker rasters with their action timings and completion callbacks. The HUD baseline loads from `classic_best_1`. |
| Standard Classic pause | `game/assets/scripts/creator/base-gameplay-pause-presenter.ts` owns the exact shared overlay, objective card, and Pause/Resume/Replay/Quit controls. `game/assets/scripts/creator/classic-scene-controller.ts` explicitly suspends and restores the current session/Physics2D/input/speed-delay leases. Replay stages one fresh mode-0 run, then commits before retiring the old presentation; Quit stages and activates Main Menu before retiring Classic. Failure paths restore the exact old root and pause state or enter a typed quiesced/fatal boundary rather than mixing owners. Resume intentionally does not resume mode-0 background music, preserving the recovered asymmetry. |
| Result entry | Pure modules own mode-0 layout, completed-run score formatting, `>=` leaderboard insertion, the recovered `[first, second, third]` panel order, signed-int32 Settings mutations, float32 `score * 0.6` truncation, the delayed 100-particle plan, and the reward tree. Creator presenters own the exact shell/reward rasters and fonts, selected button frames, equal-z order, independent `0.75 / 1.0 / 1.75`-second actions, the `1.65`-second five-draw-per-particle burst, `1.75`-second effect → coin → badge → accounting → label boundary, `2.5`-second rotating effect, and `11.15`-second emitter cleanup. Rank audio is emitted at the recovered mid-construction boundary. Retry synchronously detaches Result, constructs fresh run-owned state, restarts the Classic session/physics boundary, and attaches the new mode to the captured parent at z-order `1`. Creator retains Result cleanup only within that callback until attachment commits; a pre-commit exception rolls back physics/run state and rearms the identical Result without replaying ranking, coins, or RNG work. Post-commit engine cleanup is best-effort and cannot tear down the fresh Classic state. |
| Leaderboard shell | `leaderboard-state.ts`, `leaderboard-presentation.ts`, `leaderboard-resource-contract.ts`, `game/assets/scripts/creator/leaderboard-presenter.ts`, `game/assets/scripts/creator/leaderboard-resource-loader.ts`, `game/assets/scripts/creator/main-menu-presenter.ts`, `game/assets/scripts/creator/recovered-app-shell-controller.ts` | `leaderboard-presenter.test.ts`, `leaderboard-resource-contract.test.ts`, `main-menu-presenter.test.ts`, `recovered-app-shell-controller.test.ts`, `creator-scene-integration.test.ts`, Creator bundled strict TypeScript | Exact six-board local/offline read-only snapshot integrated | Snapshots process-owned Settings once in native order Classic, Crazy, Gangnam Style, Classic Bird, Crazy Bird, Combo Bird; performs no ranking, mutation, load/save, network, JNI/platform, particles, or RNG. The constrained subset uses 10 profile rasters plus `Fonts/Andyb.ttf`, `Fonts/Century.ttf`, and `Sounds/menubuttonclick.wav`. Main Menu target ID `13` waits `0.75s`, Back returns immediately to a fresh Main Menu, and the effects-gated Back click runs only after successful commit. |
| Classic Settings | A process-owned runtime loads and saves coins, selections, all six production-route leaderboards, objective state, music/effect flags, the recovered `network_available` launch sentinel, and rated state in recovered relative order. The bulk schema is exact: 50 integers and 4 booleans, with 18 blade price keys/defaults and 8 background price keys/defaults. Indexed Mode Select unlocks use their separate immediate persistence keys. Price `0` is the ownership sentinel. Options purchases atomically persist ownership before committing the single in-memory coin debit, accept exact affordability, and leave insufficient/already-owned/storage-failure paths inert. Field-isolated recovery preserves any valid `totalCoins`, including `0`; only missing, corrupt, or unreadable coin storage falls back to `999999`, and any recovery disables writes for that process. Main Menu exit-save and app-hide save are implemented; no additional persisted `flag` or migration is justified. |
| Options | `game/assets/scripts/domain/options-state.ts` and presentation/resource contracts own eight backgrounds, eighteen blades, ten themes, selector state, exact Buy visibility/prices, affordability, exit rollback, and the 45-particle purchase plan. Creator presenters own the one-screen `1.25 / 1.50 / 1.75`-second row reveal, exact 51-raster per-tree profile, `Fonts/SlabThing.ttf`, `menubuttonclick`, `mono1`, `mono2`, live shared background/theme preview, transactional Main Menu handoff, and `xmasfive` burst. Back and app-hide reconcile unpaid background/blade previews to index `0`; theme, owned choices, and persisted background index `8` follow their recovered compatibility rules. A reconciliation failure suppresses app-hide save and remains retryable. |
| Bird substrate and mode `3` | `bird-blade-state.ts`, `bird-blade-particle-plan.ts`, `bird-resource-contract.ts`, and the Bird Creator adapters own the single touch-directed blade, always-updating particle trail, cached ray path, and exact Bird resources. Classic Bird adds its untimed intro/fail/result/retry lifecycle through `classic-bird-*`. |
| Crazy Bird mode `4` | `crazy-timed-mode-profile.ts`, `crazy-bird-result-ranking.ts`, and `crazy-bird-result-navigation.ts` profile the shared `game/assets/scripts/domain/crazy-session.ts`, `game/assets/scripts/creator/crazy-scene-controller.ts`, and `game/assets/scripts/creator/crazy-gameplay-controller.ts` owners. Mode `4` composes the recovered 60-second Crazy graph with BirdBlade type `2`, exact type-2 resources, objective events `9`/`5`, `bird_crazy_best_1..3`, float32 `0.8` reward, and fresh mode-4 replay/retry/menu ownership. The exact native combo callback operand/order remains a disclosed static inference gap. |
| Combo Bird mode `5` | `combo-bird-session.ts`, `combo-bird-toss-config.ts`, `combo-bird-toss-coordinator.ts`, Combo Bird intro/resource/result domains, and the dedicated Combo Creator controllers own a separate `90`-second ordinary-only runtime. The route composes BirdBlade type `3`, exact type-3 and supplemental resources, objective selector `7`, pause/result ownership, `bird_combo_best_1..3`, float32 `0.8` reward, and fresh replay/retry/menu transactions without Crazy bombs, bonuses, specials, freeze, magnet, electric, or Dragon behavior. The low/high `text-juscombo.png` / `text-justcombo.png` mapping remains an explicit target adaptation backed by exact per-tree assets. |
| GN Style mode `2` | `gn-style-session.ts`, `gn-style-toss-config.ts`, `gn-style-toss-coordinator.ts`, intro/choreography/explosion/resource/result domains, generated choreography data, and dedicated GN Creator controllers own a separate `150`-second ordinary-only runtime. The route composes the standard BasicBlade, exact `2.60`-second intro, non-looping `GangnamStyle.mp3`, six-family 439-parent particle choreography, objective selector `6` plus final selector `2`, a three-second late-cut tail with live input/physics/entities/score, `gnstyle_best_1..3`, float32 `0.6` reward, shared TimeManager audio, and fresh replay/retry/quit/menu transactions. |
| Cut handling | Blade tracking and bidirectional ray planning are pure; the Creator gameplay bridge executes two ordered post-step raycasts and preserves repeated fixture dispatch until batch disposal. |
| BasicBlade presentation | `game/assets/scripts/domain/basic-blade-trail.ts` independently owns the four visual trail slots, exact float32 width/overflow/disposal lifecycle, triangle-strip geometry, and alpha UVs. `game/assets/scripts/creator/classic-blade-presenter.ts` binds the exact default `Blades/blade0.png` SpriteFrame to four persistent `500`-byte, 20-byte-stride dynamic meshes. Raw touch events feed this path before the post-physics nonzero-ray filter. Creator's asynchronous resource boundary lazily claims a slot on the first real post-attachment move and never synthesizes a missed point. Although the scene is 2D, the Creator renderer bridge depends on the engine renderer path; `game/settings/v2/packages/engine.json` therefore keeps Basic 3D and its editor-generated dependencies in Feature Cropping. This enables the renderer API only and does not introduce 3D gameplay. |
| Mode Select | `game/assets/scripts/domain/mode-select-state.ts` owns the six-card rail, direct drag/flick rules, frame-count centering, delayed same-parent navigation commands, four lock states, `2500`-coin persistence asymmetry, and insufficient-coin overlap. Its unlock planner creates exactly 45 immutable particle action sets from 225 shared-RNG draws after the recovered `0.05`-second delay. `game/assets/scripts/creator/mode-select-presenter.ts` and seven `mode-select-rope-button-presenter.ts` instances own the exact rail visuals, real Physics2D bodies/joints, cut halves, deferred mutation boundary, input lease, persistence transaction, and rollback/convergence paths. All modes `0` through `5` enter separately prepared owners. |
| Crazy mode | `game/assets/scripts/domain/crazy-session.ts`, `crazy-toss-coordinator.ts`, `time-manager-service.ts`, bonus/objective/result domains, `game/assets/scripts/creator/crazy-scene-controller.ts`, and `game/assets/scripts/creator/crazy-gameplay-controller.ts` own the recovered 60-second controller graph and presentation adapters. The production registry covers normal/double/bonus tosses, standard bomb fuse/explosion, electric contacts, magnet, special fruit, Dragon and its auxiliary pieces, audio, HUD, pause, and mode-1 result ranking/reward. Time-Up command dispatch drains its recovered ordered suffix once while preserving original errors. Time-Up Finish is a two-phase transaction: provisional Result attaches while the exact Crazy/TimeManager owner is retained; any pre-commit failure removes Result and restores that same owner; domain commit then records the leaderboard once and retires any failed cleanup for Result Retry. Post-commit observer failures are reported without rollback or rearming a disposed TimeManager. |
| Shared scene | `game/assets/scripts/domain/shared-leaf-layer.ts` owns both exact seven-leaf profiles, creation-order RNG, body/fixture/world values, strict respawn threshold, and display mapping. `game/assets/scripts/creator/shared-leaf-presenter.ts` owns the independent world and receives `Step(dt,5,5)` plus each same-frame respawn as an ordered frozen `wake → add angular velocity → set transform → zero linear velocity` command before display synchronization. `game/assets/scripts/creator/shared-game-scene-presenter.ts` appends Background → Leaf → Theme → current screen at equal recovered z-order `1`; Background/Theme remain immediately opaque because their queued native fades are paused. |
| Cut presentation | Ordinary cuts instantiate exact bottom/top rasters, recovered body/fixture/impulse values, action-clock fade, and deferred disposal. Critical halves may emit exact recovered particle rasters with shared RNG ordering. |
| Audio | Creator adapters preload the reviewed Classic/menu, Options, Bird, Crazy, Combo, and GN clip sets and interpret toss, swish, cut, critical, combo, timer, result-rank, bonus/electric, objective, pause, selector-row, and menu-button commands without moving draw/order rules out of the domain. Independent retained voices model ordinary-bomb and Crazy effect ownership; the electric-only `boomhit` path remains separate from ordinary-bomb audio. GN's dedicated non-looping source is mutually exclusive with shared background music and pauses/resumes/stops with its transactional owner; TimeManager effects use the shared exact presenter. |
| Resource import | Staging and metadata validators prove exact bytes and current Creator raster/audio import geometry for the recovered APK corpus. The generated registry/ledger assigns exact live ownership to `761/862` paths (`88.28%`), including Loading's 70-path closure, while all `862/862` paths are classified as `761` consumed, `0` unknown, `100` excluded, and `1` unsupported. UUID extraction remains separate from consumer accounting. |
| Resolution and input | The recovered `720` physical-width profile branch is pure; Creator applies its Show All policy and routes scene-wide touch input into four blade slots or the single Bird blade. |
| Build boundary | Source-boundary tests reject trackable legacy integration. The separate fail-closed archive audit hashes every entry, parses ZIP records exactly, recurses through bounded nested archives, and inspects ELF payloads; the unchanged inventory/source/staging/archive workflow is `14/14`, `tests/*.mjs` are `61/61`, the full vertical slice is `1567/1567`, focused pause/composition is `218/218`, strict Creator TypeScript is green, and the latest whole-repo checkpoint records `1749/1749`. |

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

- Main Menu ↔ Options, all selector families, purchase/rollback behavior, and both resource
  profiles are integrated. App-hide reconciliation is certified by executable lifecycle tests
  and source review because browser focus changes did not reliably emit Cocos app-hide.
- Dynamic-body trajectory, ray ordering, and deferred lifecycle behavior still need live Box2D validation on the custom variable-step boundary.
- The exact BasicBlade model/resource/mesh contract is integrated and deterministic tests cover
  four-slot reuse plus asynchronous attachment, but controller-confirmed Preview/device
  rendering, legacy numeric blend factors, sampler behavior, and pixel output remain unresolved
  at the adapter boundary.
- Exact recovered APK resources are imported and all `862/862` paths have reviewed
  consumed/excluded/unsupported dispositions. The project owner approved this sole-source APK
  corpus as the canonical resource denominator; final cross-domain weighting and scoring remain
  open.
- Standard-bomb entry/cut state, fuse smoke, procedural full-quad/triangle explosion, completion,
  and Crazy registry/controller activation are implemented. Classic scheduling and any distinct
  native lower-bound bomb side effect remain open; the entity does not reuse Fruit's miss
  callback as a substitute.
- Exact result-entry layout/ranking/actions, reward visuals, app-hide persistence, Result-to-Main
  replacement, same-parent Retry reconstruction, and Bird modes `3`/`4`/`5` are integrated
  behind transactional rollback boundaries.
- The electric-field memory-safe adapter runs in automated validation without a crash, but exact
  contact-count/direction equivalence still needs a targeted pinned-backend validation.
- Rights for legacy art, music, fonts, name, and trademarks are still unknown.

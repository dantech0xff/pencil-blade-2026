# System Architecture

## Current State

Pencil Blade is being rebuilt as a static-evidence, clean-room Cocos Creator 3.8.8 project.
The workspace now contains a Creator foundation under `game/`, pure TypeScript domain modules,
Creator-facing adapters, deterministic contract tests, and an Editor-authored `classic.scene`.
All 862 recovered APK game assets are staged byte-for-byte in the Creator `game` bundle.
The Canvas now runs a bounded Classic loop through its exact mode-0 result-entry shell using
recovered background, text, score-HUD, fail-marker, ordinary fruit/cut-half,
critical-particle, result, font, core-audio, and exact default `blade0.png` resources. The
visible blade path now has a separate four-slot pure model and a Creator adapter backed by
four persistent dynamic meshes with the recovered fixed `500`-byte vertex capacity. A separate
exact standard-bomb resource/audio/entity foundation exists but is not scheduled in the loop
while procedural explosion geometry remains unresolved. The full gameplay and presentation
layer is incomplete.

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
The current scene and gameplay controllers are enabled together for the Canvas lifetime;
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
| Pure gameplay domain | `game/assets/scripts/domain/` | Session, physics, score, combo, fail, toss, random, and input logic. |
| Creator boundary | `game/assets/scripts/creator/` | Unit conversion, manual variable-step lifecycle, and Creator-specific integration. |
| Creator resource bundle | `game/assets/game/` | Exact staged bytes for all 862 recovered APK game assets; only a reviewed Classic subset has runtime consumers so far. |
| Initial scene bridge | `game/assets/scenes/classic.scene` | Editor-serialized Canvas with blade input, Classic session/resolution, and bounded gameplay components. |
| Verification | `tests/reconstruction/vertical-slice/` | Deterministic contract tests, executable controller lifecycle/fault tests, and boundary audits. |
| Build audit | `scripts/audit-creator-build.mjs` | Post-build APK/AAB inspection for prohibited payloads. |

## Current Domain Boundaries

| Boundary | Current rule |
|---|---|
| Physics2D | Recovered gravity, body and fixture values, ray-order behavior, and variable `frameDt * worldSpeed` stepping are encoded in pure modules. Automatic simulation stays off during Classic; a project-owned `System.postUpdate` performs one synchronized manual step and flushes project lifecycle mutations only after Box2D unlocks. Result replacement idempotently unregisters that system and restores the prior automatic-simulation, gravity, and fruit/bomb collision-matrix state. |
| Spawn and toss | Spawn ordering, intervals, fruit selection, and controller sequencing live in pure modules. Flattened Concurrent output is accepted only as ordered, contiguous, complete per-entity plans. |
| Score HUD, combo, fail | Score, combo window, double-score behavior, best-score updates/state, and the three-miss state are pure. Dedicated Creator presenters own the exact score icon, best-score cup, double-score panel, `Fonts/Linds.ttf`, recovered entry fade, score-icon pulse, overlapping double-score actions, and the normal/filled marker rasters with their action timings and completion callbacks. The HUD baseline loads from `classic_best_1`. |
| Result entry | Pure modules own mode-0 layout, completed-run score formatting, `>=` leaderboard insertion, the recovered `[first, second, third]` panel order, signed-int32 Settings mutations, float32 `score * 0.6` truncation, the delayed 100-particle plan, and the reward tree. Creator presenters own the exact shell/reward rasters and fonts, selected button frames, equal-z order, independent `0.75 / 1.0 / 1.75`-second actions, the `1.65`-second five-draw-per-particle burst, `1.75`-second effect → coin → badge → accounting → label boundary, `2.5`-second rotating effect, and `11.15`-second emitter cleanup. Rank audio is emitted at the recovered mid-construction boundary. Retry synchronously detaches Result, constructs fresh run-owned state, restarts the Classic session/physics boundary, and attaches the new mode to the captured parent at z-order `1`. Creator retains Result cleanup only within that callback until attachment commits; a pre-commit exception rolls back physics/run state and rearms the identical Result without replaying ranking, coins, or RNG work. Post-commit engine cleanup is best-effort and cannot tear down the fresh Classic state. |
| Classic Settings | A process-owned runtime loads `total_coins`, `classic_best_1/2/3`, and `enable_effect` in recovered relative order, keeps result mutations memory-only, and saves in recovered relative order on app hide. Target-side malformed/unreadable storage recovers to exact defaults with a diagnostic instead of blocking gameplay, then disables writes for that process to avoid overwriting progression after a transient read failure; save failures emit a diagnostic without crashing the session. Full Settings, first-launch initialization, and Main Menu exit-save remain open. |
| Cut handling | Blade tracking and bidirectional ray planning are pure; the Creator gameplay bridge executes two ordered post-step raycasts and preserves repeated fixture dispatch until batch disposal. |
| BasicBlade presentation | `BasicBladeTrailModel` independently owns the four visual trail slots, exact float32 width/overflow/disposal lifecycle, triangle-strip geometry, and alpha UVs. `ClassicBladePresenter` binds the exact default `Blades/blade0.png` SpriteFrame to four persistent `500`-byte, 20-byte-stride dynamic meshes. Raw touch events feed this path before the post-physics nonzero-ray filter. Creator's asynchronous resource boundary lazily claims a slot on the first real post-attachment move and never synthesizes a missed point. |
| Mode Select domain | `ModeSelectState` owns the six-card rail, direct drag/flick rules, frame-count centering, delayed same-parent navigation commands, four lock states, `2500`-coin persistence asymmetry, and insufficient-coin overlap. Its unlock planner creates exactly 45 immutable particle action sets from 225 shared-RNG draws after the recovered `0.05`-second delay. Creator rope/FruitButton physics and visual presenters are not yet attached. |
| Shared scene domain | `SharedLeafLayerModel` owns both exact seven-leaf profiles, creation-order RNG, body/fixture/world values, strict respawn threshold, and display mapping. The independent physics port receives `Step(dt,5,5)` and each same-frame respawn as an ordered frozen `wake → add angular velocity → set transform → zero linear velocity` command before display synchronization. The port deliberately makes no claim about bundled Box2D solver internals. Background/Theme resources and equal-z shell order are contract-complete; their Creator owners remain pending. |
| Cut presentation | Ordinary cuts instantiate exact bottom/top rasters, recovered body/fixture/impulse values, action-clock fade, and deferred disposal. Critical halves may emit exact recovered particle rasters with shared RNG ordering. |
| Audio | A Creator adapter preloads 27 reviewed clips and interprets toss, swish, cut, critical, combo, result-rank, and menu-button commands without moving draw/order rules out of the domain. Independent retained voices model the ordinary bomb's local handle/stop ownership; electric-only `boomhit` is deliberately excluded. |
| Resource import | Staging and metadata validators prove exact bytes and current Creator raster/audio import geometry for the recovered APK corpus. Per-asset consumer and UUID coverage is not yet backfilled into the manifest. |
| Resolution and input | The recovered `720` physical-width profile branch is pure; Creator applies its Show All policy and routes scene-wide touch input into four blade slots. |
| Build boundary | Source-boundary tests reject trackable legacy integration. The separate fail-closed archive audit hashes every entry, parses ZIP records exactly, and inspects nested archives/ELF payloads; a real Creator artifact is still pending. |

## Open Architectural Gaps

- Scene and serialized component ownership is established for the first Canvas bridge; the
  remaining scene/prefab/presenter map is open.
- Static recovery corrected the shared shell composition: Background, Leaf, Theme, and the
  current screen all use recovered z-order `1`; `0/1/2/3` are tags, and rendering depends on
  append order. Menu integration therefore needs one persistent layer host that appends the
  current screen after Background → Leaf → Theme. Raw `setSiblingIndex(1)` cannot remain the
  general z-order adapter once those shared roots are present.
- `ClassicSceneController.start()` and `ClassicGameplayController.onLoad()` still auto-start
  Classic at scene boot. The recovered Main Menu path requires making those entry points passive
  and moving resolution/resource preparation plus Classic entry behind one explicit app-shell
  transaction; otherwise an asynchronous Classic root can race and cover the menu.
- The reviewed Mode Select and Shared Leaf pure models are ready for adapters, including the
  exact 45-particle draw/action protocol and ordered leaf-world respawns. They are not visible in
  Preview yet: the app shell, Main Menu presenter, shared-root presenters, RopeButton/FruitButton
  physics, and Mode Select presenter remain the next integration boundary.
- Dynamic-body trajectory, ray ordering, and deferred lifecycle behavior still need live Box2D validation on the custom variable-step boundary.
- The exact BasicBlade model/resource/mesh contract is integrated and deterministic tests cover
  four-slot reuse plus asynchronous attachment, but Preview/device rendering, legacy numeric
  blend factors, sampler behavior, and pixel output remain unresolved at the adapter boundary.
- Exact recovered APK resources are imported and the first Classic consumers are integrated;
  most of the 862 assets still need consumer mapping. The canonical sample-project root remains
  unresolved, so corpus completeness and the final fidelity denominator are still open.
- Standard-bomb entry/cut state is implemented, but registry/controller activation and its
  procedural full-quad/triangle explosion remain open. Triangle point generation and exact
  rasterization are not replaced by a sprite or a target-side guess. Any distinct native
  lower-bound bomb side effect also remains unknown; the entity does not reuse Fruit's miss
  callback as a substitute.
- The Classic slice persists only `total_coins`, `classic_best_1/2/3`, and `enable_effect`.
  The remaining native Settings fields, first-launch initialization checkpoint, and Main Menu
  exit-save are open.
- Exact result-entry layout/ranking/actions, reward visuals, and the app-hide persistence
  checkpoint are integrated. MainMenu replacement remains open, and Retry now uses the
  recovered same-parent reconstruction under the same native parent.
- Electric-field compatibility remains an unresolved adapter decision.
- Rights for legacy art, music, fonts, name, and trademarks are still unknown.

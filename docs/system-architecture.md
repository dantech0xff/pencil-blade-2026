# System Architecture

## Current State

Pencil Blade is being rebuilt as a static-evidence, clean-room Cocos Creator 3.8.8 project.
The workspace now contains a Creator foundation under `game/`, pure TypeScript domain modules,
Creator-facing adapters, deterministic contract tests, and an Editor-authored `classic.scene`.
All 862 recovered APK game assets are staged byte-for-byte in the Creator `game` bundle.
The Canvas now runs a bounded Classic loop through its exact mode-0 result-entry shell using
recovered background, text, score-HUD, fail-marker, ordinary fruit/cut-half,
critical-particle, result, font, and core-audio resources. A separate
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

## Layer Map

| Layer | Owned By | Notes |
|---|---|---|
| Evidence and docs | `docs/`, `forensics/`, `reference/`, `plans/` | Static evidence, contracts, and progress records. |
| Pure gameplay domain | `game/assets/scripts/domain/` | Session, physics, score, combo, fail, toss, random, and input logic. |
| Creator boundary | `game/assets/scripts/creator/` | Unit conversion, manual variable-step lifecycle, and Creator-specific integration. |
| Creator resource bundle | `game/assets/game/` | Exact staged bytes for all 862 recovered APK game assets; only a reviewed Classic subset has runtime consumers so far. |
| Initial scene bridge | `game/assets/scenes/classic.scene` | Editor-serialized Canvas with blade input, Classic session/resolution, and bounded gameplay components. |
| Verification | `tests/reconstruction/vertical-slice/` | Deterministic contract tests and boundary audits. |
| Build audit | `scripts/audit-creator-build.mjs` | Post-build APK/AAB inspection for prohibited payloads. |

## Current Domain Boundaries

| Boundary | Current rule |
|---|---|
| Physics2D | Recovered gravity, body and fixture values, ray-order behavior, and variable `frameDt * worldSpeed` stepping are encoded in pure modules. Automatic simulation stays off during Classic; a project-owned `System.postUpdate` performs one synchronized manual step and flushes project lifecycle mutations only after Box2D unlocks. Result replacement idempotently unregisters that system and restores the prior automatic-simulation, gravity, and fruit/bomb collision-matrix state. |
| Spawn and toss | Spawn ordering, intervals, fruit selection, and controller sequencing live in pure modules. Flattened Concurrent output is accepted only as ordered, contiguous, complete per-entity plans. |
| Score HUD, combo, fail | Score, combo window, double-score behavior, best-score updates/state, and the three-miss state are pure. Dedicated Creator presenters own the exact score icon, best-score cup, double-score panel, `Fonts/Linds.ttf`, recovered entry fade, score-icon pulse, overlapping double-score actions, and the normal/filled marker rasters with their action timings and completion callbacks. The `classic_best_1` persistence adapter remains deferred. |
| Result entry | Pure modules own mode-0 layout, completed-run score formatting, `>=` leaderboard insertion, the recovered `[first, third, second]` panel order, and float32 `score * 0.6` coin bonus. The Creator presenter owns exact shell rasters/fonts, selected button frames, sibling order, and independent `0.75 / 1.0 / 1.75`-second actions. Rank audio is emitted at the recovered mid-construction boundary. Retry keeps the result mounted while Creator accepts the scene load, rearms both controls on immediate or asynchronous failure, and tolerates parent-led scene teardown. Storage, reward visuals, and Main Menu replacement remain outside this completed slice. |
| Cut handling | Blade tracking and bidirectional ray planning are pure; the Creator gameplay bridge executes two ordered post-step raycasts and preserves repeated fixture dispatch until batch disposal. |
| Cut presentation | Ordinary cuts instantiate exact bottom/top rasters, recovered body/fixture/impulse values, action-clock fade, and deferred disposal. Critical halves may emit exact recovered particle rasters with shared RNG ordering. |
| Audio | A Creator adapter preloads 27 reviewed clips and interprets toss, swish, cut, critical, combo, result-rank, and menu-button commands without moving draw/order rules out of the domain. Independent retained voices model the ordinary bomb's local handle/stop ownership; electric-only `boomhit` is deliberately excluded. |
| Resource import | Staging and metadata validators prove exact bytes and current Creator raster/audio import geometry for the recovered APK corpus. Per-asset consumer and UUID coverage is not yet backfilled into the manifest. |
| Resolution and input | The recovered `720` physical-width profile branch is pure; Creator applies its Show All policy and routes scene-wide touch input into four blade slots. |
| Build boundary | Source-boundary tests reject trackable legacy integration. The separate fail-closed archive audit hashes every entry, parses ZIP records exactly, and inspects nested archives/ELF payloads; a real Creator artifact is still pending. |

## Open Architectural Gaps

- Scene and serialized component ownership is established for the first Canvas bridge; the
  remaining scene/prefab/presenter map is open.
- Dynamic-body trajectory, ray ordering, and deferred lifecycle behavior still need live Box2D validation on the custom variable-step boundary.
- Exact recovered APK resources are imported and the first Classic consumers are integrated;
  most of the 862 assets still need consumer mapping. The canonical sample-project root remains
  unresolved, so corpus completeness and the final fidelity denominator are still open.
- Standard-bomb entry/cut state is implemented, but registry/controller activation and its
  procedural full-quad/triangle explosion remain open. Triangle point generation and exact
  rasterization are not replaced by a sprite or a target-side guess. Any distinct native
  lower-bound bomb side effect also remains unknown; the entity does not reuse Fruit's miss
  callback as a substitute.
- The `classic_best_1` persistence adapter is still deferred; best-score presentation is
  integrated, but the save-layer hook itself is not authored yet.
- Result leaderboard and total-coin values are currently in-memory only. Exact result-entry
  layout/ranking/actions are integrated; persistent Settings adapters, post-entry reward
  visuals, and MainMenu replacement remain open. Retry currently reloads `classic.scene`
  instead of reconstructing Classic under the same native parent.
- Electric-field compatibility remains an unresolved adapter decision.
- Rights for legacy art, music, fonts, name, and trademarks are still unknown.

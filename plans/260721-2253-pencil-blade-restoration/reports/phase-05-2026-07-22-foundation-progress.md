# Phase 05 Foundation Progress - 2026-07-22

## Result

Phase 05 moved from a pre-scaffold plan through the foundation into a bounded playable state.
The workspace now has the Cocos Creator 3.8.8 `game/` project, pure TypeScript domain modules,
the Creator Physics2D adapter, vertical-slice contract tests, the build-audit script, and an
Editor-authored `classic.scene` with normal-fruit gameplay. All 862 recovered APK game assets
are staged byte-for-byte and imported into the Creator bundle. The loop now consumes exact
background, intro/terminal/fail-marker art, score icon, best-score cup, double-score panel,
Linds font, nine intact/cut fruit sets, four critical particles, and 23 reviewed core/ordinary-
bomb audio clips. This is still a bounded checkpoint, not the end state. The `classic_best_1`
persistence adapter remains deferred.

The phase is still in progress. Canvas now owns `BladeInputController`,
`ClassicSceneController`, `ClassicGameplayController`, and the score HUD presenter, but eight
toss controllers, bombs/specials, pause/menu/results, remaining resource consumers, Android
output, the complete scene/prefab/component map, and `classic_best_1` persistence remain open.

## Review Findings

Several docs still implied that Creator scaffolding was blocked and that no `game/` project
existed. That no longer matched the workspace tree or the current Phase 05 foundation state.

The first build-boundary review also found that the Git-aware source audit could not inspect
ignored `game/build/` artifacts. A focused review of the new archive audit then reproduced
three false-negative classes: renamed payloads, wildcard/duplicate ZIP names, and non-empty
slash-terminated entries.

## Fix

Updated the plan, Phase 05 spec, architecture decision, PDR, codebase summary, code standards,
system architecture, contract map, and readiness reports so they reflect the live `game/`
foundation and exact score HUD while keeping Phase 5 in progress.

Added a separate fail-closed APK/AAB audit. It hashes every entry independent of extension,
recurses through bounded ZIP payloads, recognizes ELF content against the Cocos Creator 3.8.8
native boundary and preserved-library fingerprints, parses central-directory records by index,
and rejects ambiguous, duplicate, or payload-bearing directory entries. Independent re-review
found no remaining actionable issue in this focused scope.

The exact `game/` root was then opened in Creator 3.8.8. The Editor imported the runtime
integration scripts and serialized `assets/scenes/classic.scene`. Project settings now
use a `720x1280` default; the runtime adapter selects `720x1280` for physical frame widths at
least `720` and `480x800` below that boundary. The scene controller configures only recovered
gravity/sleep/iteration properties, disables automatic simulation, resets the physics
accumulator, relays ordered session commands, and binds global touch input to the recovered
four-slot tracker.

Static inspection of the native director/scheduler path and the pinned Creator 3.8.8 source
resolved the timestep mapping as `public-manual-variable-step-post-update`: one float32
`frameDt * worldSpeed` step with `10/10` iterations in a project-owned post-update system,
with explicit transform synchronization and deferred project lifecycle mutations. Full
runtime physics equivalence remains pending.

The playable slice starts on the first swipe, runs only the recovered normal-free controller,
and spawns exact intact fruit rasters with recovered fixtures and kinematics. Blade rays,
duplicate cut scoring, displayed-score smoothing, best-score state updates, combo wiring,
ordinary cut-bottom/cut-top bodies, recovered impulses/fade, critical-particle planning/
presentation, and exact toss/swish/cut/critical/combo audio are implemented. Bounds and misses
use the exact three persistent marker rasters, recovered entry and activation timing, one-second
transient cleanup, and shared-count callback behavior before game over; tap-to-retry reloads the
scene. The other eight Classic controllers are recorded as deferred instead of being silently
simulated.

The next static-evidence-safe bomb foundation is now present without enabling incomplete bomb
gameplay. Bomb ID `0` loads its exact `bomb_X.png` raster for both profiles and creates the
recovered anchored dynamic circle body/filter. Its first cut guards synchronously, zeros motion,
and hands off to a future exact explosion owner; a pre-freeze hook preserves retained-audio stop
ordering, and failed handoffs freeze then defer cleanup. Disposal otherwise remains deferred until
`AfterBombHit`. The physics adapter now installs/restores both fruit and bomb collision rows.
The exact `boomtoss`, `boomsound`, and `boomexplosion` clips are preloaded with isolated retained
voice handles, while electric-only `boomhit` is excluded. Concurrent flat spawn batches now fail
closed unless every entity sequence is contiguous and complete. Registry/controller activation
remains deferred because exact procedural explosion triangles are still unresolved.

The staging pipeline copies all 862 recovered APK game assets without recompression or byte
changes. Creator imported the corpus and the validator checks its current 934 metadata
sidecars, untrimmed/full raster geometry, and audio metadata. The manifest's per-asset
consumer/UUID fields remain unpopulated, so this does not claim 100% runtime consumer coverage.
The exact score HUD now consumes the recovered score icon, best-score cup, double-score panel,
and `Fonts/Linds.ttf`, while `classic_best_1` persistence remains deferred.

Rights clearance remains separate from technical fidelity. The current slice is playable, but
it is not presentation-complete until runtime consumer coverage reaches 100% for the canonical
sample-project manifest/root. Exact recovered artwork, audio, and fonts are now present for
technical restoration as requested; their release rights remain unresolved and independent
from the fidelity work.

## Remaining Blockers

- Completion of scene, prefab, and serialized component ownership beyond the first Canvas bridge.
- Deterministic trajectory, contact, exact ray-order, and deferred-lifecycle validation for
  full Creator Physics2D equivalence.
- Canonical sample-project resource manifest/root resolution for the future `99%` metric and
  the final presentation coverage gate.
- Exact standard-bomb procedural triangle generation/rasterization and the dependent
  registry/controller/explosion lifecycle integration; any distinct native lower-bound bomb
  side effect is still unknown and is not substituted with Fruit's miss callback.
- Electric-field compatibility decisions.
- Android build validation and real APK/AAB post-build audit.
- Rights review for original assets and product identity.

## Validation

- `git diff --check`: clean
- `node $HOME/.claude/scripts/validate-docs.cjs docs/`: clean
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/reconstruction/vertical-slice/*.test.ts`: `161/161` pass
- `node --test tests/stage-creator-assets-test.mjs tests/validate-creator-resource-meta-test.mjs`: `29/29` pass
- `node scripts/audit-creator-build.mjs <build.apk|build.aab>`: documented as the build audit entry point
- `node --test tests/audit-creator-build-test.mjs`: `8/8` synthetic checks pass
- `node --test tests/*.mjs`: `38/38` pass
- Creator 3.8.8 bundled TypeScript compiler: pass
- reconstruction-policy positive and negative checks: pass
- Latest Creator Preview: after invalidating Creator's stale generated-code cache, opened at
  `720x1280`, showed the exact score/best HUD, recovered `GOOD / LUCK!` intro and fruit tosses,
  green-to-red fail-marker transitions, no pillarbox leakage, 60 FPS, and zero Creator Console
  errors

## Unresolved Questions

- Which deterministic Creator harness should close the remaining contact, exact ray-order,
  trajectory, and deferred-destruction runtime checks?
- Which installed NDK and CMake pair should be pinned for the first Android build?
- What rights or replacement policy will authorize a distributable build containing the
  recovered presentation assets?

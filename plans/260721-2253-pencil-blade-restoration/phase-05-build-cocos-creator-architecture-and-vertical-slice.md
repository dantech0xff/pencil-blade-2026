---
phase: 5
title: "Build Cocos Creator Architecture and Vertical Slice"
status: in-progress
priority: P1
dependencies: [3, 4]
effort: "2-4 weeks"
---

# Phase 5: Build Cocos Creator Architecture and Vertical Slice

## Overview

Create the production project in the latest stable Cocos Creator and prove one complete
Classic loop implemented independently in TypeScript with Creator Physics2D. The editor
foundation now exists under `game/`. Creator has reopened that exact root and serialized the
first `classic.scene` with resolution/session, four-slot input, and a bounded generated
normal-fruit loop. All 862 recovered APK game assets are staged and imported; the current loop
uses exact background, intro/terminal/fail-marker art, score icon, best-score cup,
double-score panel, Linds font, intact/cut fruit, critical-particle, core-audio, and the mode-0
result-entry rasters/fonts/cues. The result boundary now implements the recovered completed-run
score, leaderboard insertion, button states, entrance timings, delayed 100-sprite burst,
reward tree, and coin-bonus callback. The eleven implemented Settings values now persist
through a process-owned Creator adapter at the recovered app-hide checkpoint, with
`enable_effect` defaulting to `true`.
The active Phase 5A checkpoint now closes visible fidelity gaps in evidence order. The default
BasicBlade implementation is review-passed. Main Menu and Mode Select owned subtrees are both
GREEN, and the separate shared Background/Leaf/Theme contract makes their clean/default logical
composites GREEN across contracts. Mode Select rail/navigation/lock and its exact 45-particle
unlock burst are now review-passed pure domain code. Shared Leaf placement, world-step, ordered
respawn, and display synchronization are likewise review-passed behind an injected physics port.
The serialized persistent app shell now constructs shared Background/Leaf/Theme roots, boots into
Main Menu, replaces it transactionally with Mode Select, enters Classic only for recovered mode
`0`, and routes Result back to Main Menu or Retry. Main Menu, Mode Select, shared presenters,
RopeButton/FruitButton physics, input leases, rollback paths, and fail-closed destinations pass
the deterministic suite and independent review. Fresh Browser Preview validation of that complete
route remains pending.
Checkpoint report: [Blade and navigation foundations](reports/journal-2026-07-23-blade-navigation-foundations.md).
The exact standard-bomb raster/audio/entity foundation is also implemented and tested, but is
not scheduled into the playable loop until its unresolved procedural explosion geometry can be
restored without guessing. Full first-launch Settings initialization and the Main Menu
exit-save path remain open. The
remaining scene/prefab map, consumer coverage, and full Classic scope still need to be
completed before this phase can close.

## Context Links

- [Presentation contracts](./phase-03-catalog-resources-and-reconstruct-presentation.md)
- [Gameplay contracts](./phase-04-reverse-engineer-native-gameplay-contracts.md)
- [Cocos Creator target](./research/cocos-creator-target.md)
- [Local Creator readiness](./reports/creator-readiness-2026-07-22.md)
- [Android toolchain readiness](./reports/android-toolchain-readiness-2026-07-22.md)
- [Creator architecture decision](../../docs/decisions/cocos-creator-architecture.md)
- [Reconstruction policy](../../reference/reconstruction-policy.yaml)
- [Official Cocos Creator download](https://www.cocos.com/creator-download)
- [Official Cocos Creator 3.8 LTS manual](https://docs.cocos.com/creator/3.8/manual/en/)

## Requirements

- Verify the official stable channel immediately before project creation. Baseline is
  Cocos Creator 3.8.8, rechecked 2026-07-22; pin the exact editor, engine revision, and
  Android toolchain once, then change them only through a reviewed migration decision.
- Implement all application/gameplay behavior in TypeScript using Creator scenes, nodes,
  components, prefabs, assets, and supported engine APIs.
- Never package, load, call, wrap, emulate, translate mechanically, or port libgame.so or
  the original Cocos2d-x 2.1.4 application runtime. No JNI/JSB bridge may host old gameplay.
- Implement main menu to one Classic loop: start, swipe, cut, miss/bomb, score, pause,
  game over, and retry at canonical 480x800 and 720x1280 reference viewports.
- Start only when Phase 3 has the Classic presentation subset/reconstruction policy and
  Phase 4 has an end-to-end Classic contract/map with critical unknowns disclosed.

## Architecture

Create the editor-generated project under `game/`. Keep scoring, progression, spawn, input,
and state rules in testable TypeScript modules driven by an explicit clock/random source.
Creator components adapt those rules to scene lifecycle, rendering, audio, storage, and
platform services. Creator Physics2D is the production simulation layer behind a narrow
adapter configured from recovered gravity, timestep, body/fixture, filtering, velocity,
ray-cast, and contact contracts. Any compatibility adjustment stays explicit at that boundary.

## Phase 5A: Fidelity-First Blade and Navigation Checkpoint

Status: in progress. Continue this phase rather than creating a second restoration plan.

### Evidence gate

- BasicBlade is green-gated after independent static cross-check: four touch slots, default
  selection `0`, paired-tree `Blades/blade0.png`, maximum ten stored points, overflow pop of
  two oldest points, frame-based disposal, width formula, textured vertex layout, UV mapping,
  and triangle-strip topology are recoverable without an original runtime. Its pure model,
  exact resource loader, persistent four-mesh presenter, raw-touch integration, and asynchronous
  attachment boundary are implemented and review-passed.
- Main Menu's owned foreground is green-gated for visible construction after dual static recovery established its
  required asset consumers, both-tree dimensions, viewport-relative positions, equal-z insertion
  order, wheels, total-coins panel, three FruitButtons, toggle initialization, entry actions, and
  repeating review-heart behavior. Legacy review/store/platform effects remain outside this gate.
- Mode Select's owned foreground is GREEN: exact assets, root/local orders, title/back/rope entry,
  six-card rail, seven-link RopeButtons, frame-based `2`-unit carousel snap, FruitButtons, locks,
  `2500`-coin persistence asymmetry, 45-particle unlock burst, audio, and same-parent navigation
  are recovered and reviewed. No destination-mode presentation is implied by constructor mapping.
- Shared Background, Leaf, and Theme are GREEN in their separate contract. `0/1/2/3` are tags,
  while all shared roots use z-order `1` and draw by Background -> Leaf -> Theme -> current-screen
  insertion. Background/Theme fades are queued but remain paused; seven leaves use an independent
  `Step(dt,5,5)` world and exact RNG/body/render protocol. Do not animate the inert fades or couple
  leaves to gameplay physics.
- Advanced blade particles, DragonBlade, and CentipedeBlade remain separate gates. Default
  blade ID `0` emits no move particles, so they do not block the first visible trail.

### Ordered work

1. **Complete:** curate and review a versioned BasicBlade presentation contract from the static corpus.
2. **Complete:** implement a pure four-slot trail model with exact point, geometry, UV, width, and disposal
   semantics; keep it independent from post-physics cut rays in `BladeTracks`.
3. **Complete:** load the exact paired `blade0.png` resources and render four persistent dynamic textured meshes through
   a dedicated Creator presenter at recovered z-order `1`. Keep Creator's Basic 3D Feature Cropping module enabled because
   the 2D `UIMeshRenderer` adapter requires `MeshRenderer`; this is renderer availability, not 3D gameplay.
4. **Complete:** integrate began/moved/ended events and per-frame disposal without changing cut, swish,
   physics, score, result, or retry ownership.
5. **Complete:** implement the exact Main Menu visible shell, actions, toggles, FruitButtons,
   audio/navigation gates, and transactional input lifecycle.
6. **Complete:** implement the Mode Select rail, navigation, locks, persistence asymmetry,
   exact 45-particle/225-draw burst, RopeButton/FruitButton physics, and fail-closed destination
   handling without placeholder mode screens.
7. **Complete:** implement the exact shared resource/body/RNG/display model, independent
   `Step(dt,5,5)` leaf world, ordered same-frame respawn operations, and Background/Leaf/Theme
   Creator owners while preserving equal-z append order and inert fades.
8. **Complete:** refactor scene boot behind one persistent app-shell host so Classic controllers
   stay passive until the recovered Mode Select handoff; preserve and extend Result/Retry/Menu
   transactions with rollback and committed-state isolation.
9. **Automated gate complete; live Preview pending:** focused tests, `410/410` vertical-slice
   tests, `38/38` source/staging/archive tests, strict Creator TypeScript, reconstruction policy,
   and prohibited-runtime/source-boundary checks pass. A fresh Browser Preview and real built
   artifact remain separate gates.
10. **Complete:** independent reviews found and closed the Mode Select per-particle burst and
    Shared Leaf physics-respawn gaps; contracts, evidence, plan, and architecture docs now state
    only the completed model/presenter boundaries.

### Expected files

- Create: ../../forensics/contracts/basic-blade-presentation-contract.md
- Create: ../../forensics/contracts/main-menu-presentation-contract.md
- Create: ../../forensics/contracts/mode-select-presentation-contract.md
- Create: ../../forensics/contracts/shared-game-scene-presentation-contract.md
- Create: ../../game/assets/scripts/domain/basic-blade-trail.ts
- Create: ../../game/assets/scripts/domain/mode-select-state.ts
- Create: ../../game/assets/scripts/domain/shared-leaf-layer.ts
- Create: ../../game/assets/scripts/creator/classic-blade-presenter.ts
- Update: ../../game/assets/scripts/domain/classic-resource-contract.ts
- Update: ../../game/assets/scripts/creator/classic-resource-loader.ts
- Update: ../../game/assets/scripts/creator/classic-gameplay-controller.ts
- Create/update focused tests under ../../tests/reconstruction/vertical-slice/
- Update evidence/policy registers only after contract review and exact artifact hashing

### Acceptance criteria

- Touch-down and the first two move samples issue no draw. The third move produces the first
  four-vertex draw submission, but its native leading cross-section is degenerate; a later
  non-collinear sample can produce the first visible area. Every submitted mesh uses exactly
  `2 * (N - 1)` vertices.
- Each of four slots is independent and reusable. Eleven pushes retain the recovered order by
  removing exactly the two oldest points when the ten-point limit is exceeded.
- Release disposal removes one oldest point per rendered update and divides width by float32
  `1.1`; the trail becomes invisible below three points and then resets to base width.
- Base width is float32 `((viewportWidth - 480) * 0.0025 + 3.5)`.
- Both resolution trees use the exact `256x256` default blade bytes; no `Graphics` line, glow,
  smoothing, additive effect, invented particle, or replacement texture is introduced.
- Creator rendering uses a textured unlit compatibility material and explicitly records the
  unresolved legacy sprite blend/filter state; that inference is not counted as recovered
  pixel identity.
- Existing Classic gameplay, cut queries, audio, result, retry, persistence, physics, and
  resource contracts remain passing.
- Main Menu, Mode Select, and shared layers may be implemented only from their reviewed contracts.
  Destination-mode screens remain blocked until their own presentation contracts exist.

### Risks and rollback

- Creator 3.8.8 does not expose the legacy GL sprite path directly. Keep the material boundary
  isolated so blend/filter reconciliation can change without changing the recovered mesh model.
- Native disposal is frame-count based, so wall-clock trail duration varies with frame rate by
  contract; do not convert it to elapsed-time fading.
- Static contracts cannot claim pixel-golden equivalence to the unavailable original runtime.
- Rollback is localized to the blade presenter, resource entries, and event subscriptions; it
  does not alter saved data, scene replacement, or the authoritative Classic session.

## Related Code Files

- Create: ../../docs/decisions/cocos-creator-architecture.md
- Create: ../../docs/system-architecture.md
- Update: ../../docs/cocos-creator-contract-map.md
- Create via pinned editor: ../../game/
- Create: ../../game/assets/scenes/
- Create: ../../game/assets/prefabs/
- Create: ../../game/assets/scripts/core/
- Create: ../../game/assets/scripts/domain/
- Create: ../../game/assets/scripts/creator/
- Create: ../../game/build-config/android.json
- Create: ../../tests/reconstruction/vertical-slice/
- Read: ../../reference/reconstruction-policy.yaml

## Implementation Steps

1. Recheck the official stable release; record editor version, engine tag/revision,
   installer hash/source, JDK, SDK, NDK, Gradle/AGP, render backend, and Android ABI set.
2. Scaffold `game/` with the pinned Creator editor and commit only source/configuration
   files intended by the project boundary; never hand-copy legacy engine project files.
3. Record the one-way mapping from recovered C++ classes/functions to new TypeScript
   domain services, Creator components, scenes/prefabs, events, and validation cases.
4. Stage only the vertical-slice resource subset through the Phase 3 manifest; verify
   source hashes, Creator import metadata, dimensions, alpha, audio, and font metrics.
5. Implement `GameClock`, deterministic random, reconstruction input fixtures, and
   state/event logging; isolate the native variable-step contract from Creator's documented
   fixed-timestep boundary and test the reviewed compatibility strategy explicitly.
6. Implement Creator adapters and scenes for boot, menu, Classic gameplay, pause, result,
   audio, storage, resolution scaling, and lifecycle.
7. Run conformance tests against recovered constants, invariants, state transitions, toss
   trajectories, contacts, blade ray casts, scoring, presentation ordering, and save fixtures.
8. Generate deterministic traces from the reconstruction and verify repeatability and
   contract coverage. These fixtures are internal regression baselines, not original captures.
9. Audit source and built APK/AAB contents for prohibited original binary/runtime/code paths.
10. Fix Creator mapping or reverse-engineering gaps before expanding to additional modes.

## Todo List

- [x] Cocos Creator 3.8.8 editor and engine identity recorded
- [ ] Android SDK, NDK, JDK, Gradle, and ABI pin completed
- [x] Proposed Creator architecture and C++-to-TypeScript ownership map
- [ ] Editor-generated project structure and final serialized-component map
- [x] Deterministic time/random/input seams
- [x] Lossless Creator resource import for the slice
- [ ] Complete Classic vertical slice
- [ ] Automated contract/traceability and prohibited-runtime audit
- [x] Static-evidence readiness gates recorded with evidence IDs

## Validation

- Build-audit command: `node scripts/audit-creator-build.mjs <build.apk|build.aab>`
- Synthetic audit test: `node --test tests/audit-creator-build-test.mjs`
- Current synthetic audit result: `8/8` pass. A real generated artifact remains required.

Current Editor integration:

- Project default design resolution is `720x1280`; runtime resolution selection preserves the
  recovered physical-width `720` branch and the `480x800` fallback through `SHOW_ALL`.
- `assets/scenes/classic.scene` is Editor-serialized and attaches `BladeInputController`,
  `ClassicSceneController`, `ClassicGameplayController`, and `RecoveredAppShellController` to
  Canvas. The two Classic controllers remain passive until the app shell commits mode `0` entry.
- Resolved gravity/sleep/solver properties are configured. Automatic Physics2D simulation stays
  off; a custom post-update system performs the recovered one-per-frame variable step with
  explicit synchronization and a project-owned deferred-mutation boundary. Removing Classic
  for results unregisters that system and restores the prior Physics2D singleton properties.
- All 862 recovered APK game assets (784 PNG, 59 WAV, 3 MP3, and 16 fonts) are staged
  byte-for-byte under the Creator bundle. The current import validator covers 934 generated
  metadata sidecars; the manifest's per-asset consumer and UUID fields still require backfill.
- The exact standard Bomb ID `0` raster is cataloged; a tested Creator entity owns its recovered
  `(0.5, 0.4)` anchor, dynamic circle fixture/filter, spawn mutations, first-cut guard, motion
  freeze, audio-before-freeze hook, callback-failure cleanup, and deferred completion seam.
  Three ordinary-bomb clips and isolated retained voice handles are loaded, while electric-only
  `boomhit` remains excluded. The physics adapter installs and restores both fruit and bomb rows.
- The exact score HUD is integrated: the score icon, best-score cup, double-score panel,
  entry fade, icon pulse, and overlap-safe double-score actions are recovered. Score display
  tracks the authoritative score service, seeded from persisted `classic_best_1`.
  Ordered Score HUD, World, and Fail roots prevent dynamically created gameplay nodes from
  crossing recovered equal-z presentation layers.
- The exact mode-0 result entry is integrated at the terminal session boundary. It replaces
  the Classic-owned roots while preserving the shared background/resources, creates the nine
  shell rasters plus the three reward rasters and two result fonts in native order, applies independent
  `0.75 / 1.0 / 1.75`-second entrance actions, inserts the completed score using recovered
  `>=` comparisons, and emits rank/menu cues at their recovered construction/click boundaries.
  At `1.65` seconds its custom emitter consumes exactly five shared-RNG draws for each of 100
  sprites; at `1.75` seconds it creates effect, coin, badge, performs signed-int32 accounting,
  then creates the bonus label. The effect repeats `+360` degrees every `2.5` seconds and the
  emitter removes its retained scale-zero particles at `11.15` seconds.
  Retry uses the recovered same-parent replacement flow: it synchronously detaches Result,
  constructs a fresh mode-0 run, restarts session/physics, then attaches at the captured parent
  with z-order `1`. Same-callback rollback restores and rearms the identical Result if a
  pre-commit stage fails; post-commit cleanup errors are reported without tearing down the
  fresh Classic state. A stable runtime loads/saves the eleven implemented values spanning
  selections, leaderboard, audio flags, coins, network sentinel, and rated state in recovered
  relative order, keeps Retry mutations memory-only, saves on app hide,
  and recovers corrupt target storage to exact defaults with diagnostics while disabling writes
  for that process to protect stored data. Full first-launch Settings initialization and Main
  Menu exit-save remain explicit follow-up work; Result-to-Main replacement is integrated.
- The latest Preview pass opened at `720x1280` after clearing Creator's stale generated-code
  cache and demonstrated the recovered `GOOD / LUCK!` intro, exact ordinary-fruit spawning,
  score/best HUD, green-to-red fail-marker transitions, and 60 FPS with zero Creator Console
  errors. A follow-up Preview verified two Result->Retry cycles at the same localhost URL
  without a reload or game/Cocos console error; both runs re-entered the fresh `GOOD / LUCK!`
  intro. That Preview is success-path verification only; a separate executable controller
  harness injects construction, early/late physics, post-parent attachment, commit, and
  post-commit cleanup failures. It verifies rollback where still reversible, committed-state
  isolation afterward, and no duplicate persistence or RNG work.
- The current playable slice is not presentation-complete; the exact staging gate is complete
  for the recovered APK corpus, but 100% consumer coverage and canonical sample-project
  completeness remain open. Release rights are a separate review.
- The deterministic vertical-slice suite passes `410/410`, source/staging/archive tests pass
  `38/38`, Creator 3.8.8's bundled strict TypeScript compiler passes, and independent transaction
  review has no remaining finding.

## Current Blockers

- Completion of the remaining scene, prefab, and serialized component ownership map.
- Deterministic trajectory, contact, exact ray-order, and deferred lifecycle validation on
  the custom variable-step boundary.
- Canonical sample-project resource manifest/root resolution so the presentation coverage gate
  and `99%` metric can be finalized.
- Exact ordinary-bomb explosion point generation/rasterization plus safe registry/controller
  lifecycle integration, including the unresolved native lower-bound side effect; no sprite
  substitute, Fruit-miss substitution, or invented triangle pattern is accepted.
- Full Settings coverage beyond the eleven implemented fields, including the recovered
  first-launch initialization and Main Menu exit-save checkpoint.
- Fresh Browser Preview validation of Boot -> Main Menu -> Mode Select -> Classic and
  Result -> Main Menu/Retry remains open; source-level transactions and rollback tests pass.
- Electric-field compatibility decisions.
- Android build validation and real APK/AAB post-build audit.
- Rights review for original assets and product identity.

## Success Criteria

- [ ] Pinned Cocos Creator project builds and runs on the supported Android matrix
- [ ] All slice behavior is owned by reviewable TypeScript and Creator content
- [ ] Build contains no original APK, libgame.so, Cocos2d-x 2.1.4 runtime/source,
      decompiler artifact, native compatibility bridge, or emulator layer
- [ ] Classic scenario satisfies every recovered contract and records accepted inferences/unknowns
- [ ] Creator Physics2D tests cover recovered timestep, gravity, fixtures, contacts, ray casts,
      and contact-driven gameplay outcomes
- [ ] Automated report names reconstruction-policy and contract-evidence versions
- [ ] No legacy ad/social dependency exists in gameplay code

## Risk Assessment

- Creator/editor upgrades can alter serialization and rendering: pin once and treat upgrades
  as migrations with full reconstruction-suite reruns.
- Creator physics, scheduler, tween, fonts, blending, or audio can differ from recovered
  semantics: isolate engine boundaries and test them against the static contracts.
- Asset import may trim, recompress, or reinterpret alpha: enforce catalog-driven presets
  and rendered-output reconciliation.

## Security Considerations

Use current supported Android tooling. Keep forensic/decompiler directories outside Creator
imports and release builds. Platform adapters contain no recovered credentials, identifiers,
ad SDKs, or executable code from the APK.

## Next Steps

Proceed to Phase 6 only after the Creator vertical-slice gate passes and the Classic
presentation/gameplay/physics contracts are covered. Continue Phase 4 analysis for later modes.

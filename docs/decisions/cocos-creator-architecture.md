# Cocos Creator Architecture Decision

Status: in progress; recovered-resource Classic checkpoint integrated
Date: 2026-07-22

## Decision

Rebuild Pencil Blade as a clean Cocos Creator 3.8.8 TypeScript project under `game/`, using
Creator Physics2D behind a narrow adapter. Keep recovered game rules in engine-independent
domain modules with explicit clock, RNG, input, persistence, and command ports. Scenes,
components, prefabs, tweens, audio, and Physics2D calls are adapters rather than owners of
gameplay state.

The workspace now contains the Creator foundation, Classic contract/test baseline, all 862
exact recovered APK game assets in a Creator bundle, and a bounded normal-fruit loop using
the recovered background, text, intact/cut fruit, critical-particle, and core-audio resources.
The exact score HUD now adds the recovered score icon, best-score cup, double-score panel,
and `Fonts/Linds.ttf` through a dedicated presenter, while `classic_best_1` persistence
remains deferred.
The remaining scene/prefab map, eight deferred toss controllers, most presentation consumers,
and runtime physics-equivalence gate keep the architecture decision in progress.

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

- `game/assets/scripts/domain/` contains the pure Classic modules.
- `game/assets/scripts/creator/` contains the Physics2D, resolution, blade-input, Classic
  scene, generated-entity, resource, audio/effect, and bounded gameplay bridges.
- `game/assets/scenes/classic.scene` is Editor-authored and attaches `BladeInputController`,
  `ClassicSceneController`, and `ClassicGameplayController` to Canvas.
- `game/assets/game/` contains byte-identical copies of all 862 recovered APK game assets.
  The current Classic subset uses exact rasters and audio, but consumer/UUID coverage is not
  complete and the canonical sample-project root remains unresolved. Release rights are
  tracked separately.
- `tests/reconstruction/vertical-slice/` contains the current Classic regression suite.
- `scripts/audit-creator-build.mjs` contains the post-build archive audit.
- `game/library/` is generated Creator cache and is not hand-authored gameplay source.

## Deterministic Domain Rules

- `ClassicSession` owns start, running, pause, terminal, and retry state.
- `TossScheduler` owns each timer's elapsed/threshold state, strict `>` expiry, discarded
  overshoot, rearm-before-turn order, and the fixed nine-controller Classic table.
- `GameplayRandom` is injected and shared by every recovered gameplay consumer. It preserves
  inclusive integer and decile semantics. Tests use scripted draws; production records its
  chosen seed. Exact native `lrand48` sequence parity is not claimed.
- `ComboService` emits commands in recovered order:
  objective event, item creation, score, item attach, conditional sound draw, reset.
- `ScoreService` owns authoritative, displayed, and pending-double state. Presentation does
  not mutate authoritative score outside domain commands.
- `FailService` exposes every fail callback invocation. `ClassicSession` independently guards
  its terminal transition, because multiple outstanding callbacks may observe fail count `3`.
- Standard Classic is untimed and must not instantiate `TimeManagerService`; the shared
  countdown service belongs only to modes whose recovered call graphs require it.
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

## Verification Gates

1. Pure domain tests for timers, RNG draw order, toss graph, combo/score/fail, and state.
2. Physics adapter tests for units, gravity, fixture formulas/filters, velocity identity,
   ray order/duplicates, bounds, and deferred destruction.
3. Creator integration tests for the selected public manual variable-step policy, dynamic
   trajectories, post-step synchronization, deferred lifecycle behavior, and rendered rotation.
4. Presentation/resource tests against registered hashes, geometry, and command order.
5. Build-content audit rejecting APKs, `libgame.so`, extracted native/decompiler output,
   old Cocos2d-x code/runtime, secrets, and obsolete platform SDKs. The audit hashes every
   archive entry, parses exact ZIP records, recurses through bounded nested archives, and
   permits ELF only at the pinned Creator 3.8.8 `libcocos.so` boundary.

## Current Blockers

- The Classic Canvas map is authoritative for the three scene components, but the remaining
  scenes, prefabs, presentation consumers, and non-normal toss factories are not authored yet.
- Creator Preview has exercised exact ordinary-fruit presentation, trajectories, cut halves,
  core audio, cut/score, three-miss game over, and scene-reload retry. Exact contact, ray
  traversal order, deferred destruction, and deterministic trajectory equivalence still need
  an executable harness.
- The canonical sample-project resource manifest/root remains unresolved; presentation
  completion and the `99%` metric both stay blocked on that source.
- BombElectric contact compatibility remains unresolved.
- TimeManager callback hardening and any post-fidelity reference-counted multi-bomb variant
  need explicit compatibility decisions; they do not block the first preserved contract.
- Original content rights remain unknown.

## References

- `../static-reconstruction-method.md`
- `../../forensics/contracts/classic-physics-contract.md`
- `../../forensics/contracts/classic-toss-contract.md`
- `../../forensics/contracts/classic-cut-score-contract.md`
- `../../forensics/contracts/classic-time-state-contract.md`
- `../../forensics/contracts/classic-presentation-contract.md`
- `../../reference/reconstruction-policy.yaml`
- `../../plans/260721-2253-pencil-blade-restoration/reports/creator-readiness-2026-07-22.md`

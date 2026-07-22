# Cocos Creator Architecture Decision

Status: in progress; first Editor scene integration established
Date: 2026-07-22

## Decision

Rebuild Pencil Blade as a clean Cocos Creator 3.8.8 TypeScript project under `game/`, using
Creator Physics2D behind a narrow adapter. Keep recovered game rules in engine-independent
domain modules with explicit clock, RNG, input, persistence, and command ports. Scenes,
components, prefabs, tweens, audio, and Physics2D calls are adapters rather than owners of
gameplay state.

The workspace now contains the Creator foundation and the Classic contract/test baseline,
and Creator has reopened the exact root and serialized the first Classic Canvas bridge. The
remaining scene/prefab map and unresolved physics compatibility decisions keep the architecture
decision in progress.

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
    spawn-factory.ts
    classic-scene-controller.ts
    score-presenter.ts
    audio-adapter.ts
    creator-storage-adapter.ts
```

Names may change when the editor creates the project, but ownership and dependency direction
must not.

## Current Workspace Boundary

- `game/assets/scripts/domain/` contains the pure Classic modules.
- `game/assets/scripts/creator/` contains the Physics2D, resolution, blade-input, and Classic
  scene bridges.
- `game/assets/scenes/classic.scene` is Editor-authored and attaches `BladeInputController`
  plus `ClassicSceneController` to Canvas.
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

The native layer calls `Step(frameDt * worldSpeed, 10, 10)`. Creator documents a fixed
timestep. The adapter must first test a supported equivalent step surface; otherwise the
chosen fixed-step/time-scaling behavior is an explicit inference with its own tests. It may
not be called recovered. Until that decision is reviewed, the first scene disables automatic
Physics2D simulation and resets the accumulator after configuring recovered world properties;
it neither changes `fixedTimeStep` nor invokes a manual step.

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
| Native variable step on Creator fixed scheduler | unresolved integration policy |

Each unresolved row blocks only the affected behavior from being labeled recovered.

## Presentation and Asset Boundary

- Domain emits presentation/audio commands; Creator adapters interpret them.
- Asset references use logical IDs from the static catalog, never paths into
  `.forensics-work`.
- Only a rights-reviewed vertical-slice manifest may copy source bytes under `game/assets`.
- Import settings must prevent accidental trimming, recompression, resampling, or font
  substitution unless the reconstruction policy explicitly permits it.

## Persistence Boundary

Map the recovered SharedPreferences keys/defaults into a versioned TypeScript save schema.
Legacy ads, review, social, and network bridges are excluded. Migration reads may recognize
legacy keys, but no JNI/native compatibility layer is permitted.

## Verification Gates

1. Pure domain tests for timers, RNG draw order, toss graph, combo/score/fail, and state.
2. Physics adapter tests for units, gravity, fixture formulas/filters, velocity identity,
   ray order/duplicates, bounds, and deferred destruction.
3. Creator integration tests for the selected fixed-step policy and rendered rotation.
4. Presentation/resource tests against registered hashes, geometry, and command order.
5. Build-content audit rejecting APKs, `libgame.so`, extracted native/decompiler output,
   old Cocos2d-x code/runtime, secrets, and obsolete platform SDKs. The audit hashes every
   archive entry, parses exact ZIP records, recurses through bounded nested archives, and
   permits ELF only at the pinned Creator 3.8.8 `libcocos.so` boundary.

## Current Blockers

- Local Cocos Creator 3.8.8 and Dashboard bundles fail strict signature verification.
- The first Editor scene map is authoritative, but the remaining scenes, prefabs, presenters,
  and spawn factories are not authored yet.
- BombElectric contact compatibility and Creator timestep strategy need reviewed decisions.
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

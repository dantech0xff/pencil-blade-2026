# Phase 4 Classic Contract Progress — 2026-07-22

## Status

In progress overall; the static-only Classic readiness subset is reviewed and registered for
Creator-side implementation. Remaining entities, modes, persistence, progression, and named
compatibility decisions keep Phase 4 open.

## Delivered

- `DER-CLASSIC-PHYSICS-001`: world lifecycle, gravity/iterations/world speed, `32` legacy
  world units/m,
  Fruit/Bomb/BombElectric fixture formulas and filters, blade ray query, bounds, deferred
  destruction, and the Creator Physics2D adapter boundary.
- `DER-CLASSIC-TOSS-001`: `lrand48` helper formulas, strict timer behavior, five toss
  strategies, the exact nine-controller Classic graph, object selection, and four-direction
  spawn kinematics.
- `DER-CLASSIC-CUT-SCORE-001`: four touch slots, post-step cut order, fruit/special score,
  `0.25`-second combo clusters, double-score bucket, three misses, bomb penalty, and guarded
  game over, including same-query multi-bomb behavior.
- `DER-CLASSIC-TIME-STATE-001`: untimed standard Classic, Good/Luck start, cut-enabled intro,
  30-second speed-up, director pause/resume ordering, physics hold, concurrent fail/bomb
  terminal paths, result handoff, and shared `TimeManager` behavior.
- `DER-CLASSIC-PRESENTATION-001`: resolution profiles, paired minimum assets, logical
  layout/anchors/z-order, HUD/fail/bomb/Game-Over/result timelines, and bounded audio order.
- `reference/reconstruction-policy.yaml`: executable static-only, evidence, coverage,
  clean-room, Creator-unit, compatibility, asset-fidelity, and unknown-rights gate.
- Seventeen policy-gated recovered claims connect the five contracts to normalized native
  addresses/resources and deterministic Creator test requirements.

## Creator Physics2D Boundary

- Native evidence is expressed in Box2D metres with
  `32 legacy Cocos world units = 1 metre`; physical display pixels are not implied.
- Creator 3.8 public Physics2D APIs use world units and apply PTM `32` automatically.
- Recovered gravity `(0,-10)` m/s² maps to Creator `(0,-320)` world units/s².
- Spawn positions derived in metres map to Creator world positions multiplied by `32`, while
  recovered m/s linear velocities pass numerically unchanged to `RigidBody2D`.
- Creator raycasts receive the extended world endpoints directly; TypeScript must not
  divide them by `32` again.
- Legacy Cocos2d-x stored `-bodyAngle` in its node rotation property but negated that property
  during rendering; Creator's stock positive body-angle synchronization preserves the visual
  orientation. Do not copy the legacy property sign into Creator.
- Native variable stepping (`frameDt * worldSpeed`) and Creator's documented fixed timestep
  are an explicit integration boundary, not an assumed equivalence.

## Static Findings That Must Not Be Hidden

- The native bidirectional ray callback performs no fixture-value deduplication. Preserve
  repeats for the first fidelity implementation unless a reviewed compatibility decision
  changes it.
- `ConcurrentToss` can produce `countMax + 1` objects because it calls an inclusive RNG with
  `max + 1`; retain as recovered behavior.
- Eligible combo audio consumes the same global RNG as tosses when effects are enabled and
  consumes none when disabled; deterministic tests must preserve this cross-subsystem draw.
- BombElectric uses a degenerate zero-height box and its `PreSolve` path reads an incompatible
  object layout. Runtime effect cannot be observed. The Creator rewrite must stay type-safe
  and keep the selected behavior explicit.
- Each outstanding fail-indicator callback checks the shared count and may invoke game over
  once the count is three; the callback itself has no one-shot guard, while Classic's final
  game-over transition does.
- Cut disablement is not re-read between fixtures in one admitted ray query. Distinct bombs
  can attach overlapping explosions; each finish writes the non-reference-counted physics
  stop Boolean false. Preserve this last-writer behavior initially or record a divergence.
- Standard Classic owns no countdown. Cut input is already enabled during the Good/Luck
  intro; its completion only reasserts the state before starting tosses.
- Exact native RNG draw interleaving with engine/VFX users is unavailable; deterministic
  Creator tests use an injected stream without claiming native sequence parity.

## Verification

- Representative Classic functions/constants regenerated from `DER-NATIVE-001` and
  cross-checked in GNU ARM and LLVM Thumbv5TE during review. Most targeted slices are not yet
  archived in the four-sample Phase 2 checksum set; commands and tool versions make them
  reviewer-reproducible, and corpus enrichment remains follow-up work.
- Contract artifact SHA-256 and byte counts registered in `docs/evidence-register.md`.
- Native analyzer tests: 7/7 pass.
- Resource catalog tests: 8/8 pass.
- Full inventory/evidence suite: 14/14 pass in 136 seconds, including strict claims-schema
  rejection cases, five contract artifact hashes, reconstruction-policy positive/negative
  gates, Git boundary, APK extraction, and strict plan validation.
- Direct APK baseline verification passes every assertion; APK and `libgame.so` hashes remain
  unchanged.
- Independent toss/cut, physics, time/state, and presentation reviews were incorporated,
  including spawn signs, RNG order, fail/bomb concurrency, physics-stop vtable resolution,
  flash-state order, intro cut state, HUD constants, PTM/velocity, and rotation boundaries.

## Next

1. Resolve or explicitly select compatibility behavior for electric contact and repeated
   blade hits.
2. Repair or explicitly trust the local Creator 3.8.8 installation, then pin the editor,
   Box2D backend, JDK/SDK/NDK/CMake/ABI set, and timestep policy.
3. Scaffold the editor-generated project and implement policy/adapter/domain tests before
   expanding beyond Classic.
4. Continue Phase 4 for remaining modes, saves, objectives, and progression before Phase 6.

## Unresolved Questions

- What product-level behavior should replace the unsafe BombElectric `PreSolve` path?
- Should repeated fixture dispatch remain permanently or become a compatibility option?
- Which Creator fixed-timestep strategy preserves the recovered variable-step contract?
- Should later safety variants harden unguarded TimeManager callbacks or reference-count
  multi-bomb physics holds after the first fidelity build?

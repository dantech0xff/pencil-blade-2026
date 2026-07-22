---
phase: 4
title: "Recover Gameplay, Physics, and Progression Contracts"
status: in-progress
priority: P1
dependencies: [2]
effort: "3-8 weeks"
---

# Phase 4: Reverse Engineer Native Gameplay Contracts

## Overview

Recover the app-owned behavior encoded in the ARM native binary and packaged resources,
then translate it into implementation-ready contracts for Cocos Creator. Validation is
static and cross-tool; decompiler output is evidence, never linked, shipped, or ported.

## Context Links

- [Static reconstruction corpus](./phase-02-establish-static-reconstruction-corpus.md)
- [APK static forensics](./research/apk-static-forensics.md)
- [Native Java/JNI boundary](../../forensics/native/java-jni-boundary.md)
- [Classic physics contract](../../forensics/contracts/classic-physics-contract.md)
- [Classic toss contract](../../forensics/contracts/classic-toss-contract.md)
- [Classic cut/score contract](../../forensics/contracts/classic-cut-score-contract.md)
- [Classic time/state contract](../../forensics/contracts/classic-time-state-contract.md)
- [Classic presentation contract](../../forensics/contracts/classic-presentation-contract.md)
- [Reconstruction policy](../../reference/reconstruction-policy.yaml)

## Requirements

- Import libgame.so as ELF32 little-endian ARM EABI5; record CPU attributes and load
  bias before selecting a processor profile. Current evidence identifies ARMv5TE.
- Demangle and classify surviving app dynamic symbols separately from engine/vendor symbols.
- Recover state, constants, branches, call graphs, save keys, and object lifecycles.
- Tag every resulting rule as `recovered`, `inferred`, or `unknown`; link contradictions
  separately. Do not claim runtime observation.
- Map every verified app-owned subsystem to a Cocos Creator TypeScript responsibility,
  with explicit units, coordinate transforms, lifecycle, event, and persistence boundaries.
- Recover the physics configuration needed by Creator Physics2D: timestep/substeps, gravity,
  scale/units, bodies, fixtures, shapes, density, friction, restitution, damping, sensors,
  collision groups/masks, velocities/impulses, ray casts, and contact-to-score reactions.

## Architecture

Analyze by subsystem: app/state, mode layers, toss scheduling, Box2D physics, blade
ray-casting, fruits/bombs/bonuses, score/combo/time/fail, objectives/unlocks, settings,
and presentation callbacks. Each contract cites function address/symbol and static evidence,
then names the new Creator domain service, component, scene/prefab, or adapter that owns it.

## Related Code Files

- Existing: ../../forensics/native/function-map.csv
- Existing: ../../forensics/native/subsystem-map.md
- Existing: ../../forensics/native/java-jni-boundary.md
- Create/update: ../../forensics/contracts/
- Create: ../../docs/game-state-machine.md
- Create: ../../docs/save-data-schema.md
- Create: ../../docs/objectives-and-progression.md
- Create: ../../docs/cocos-creator-contract-map.md

## Implementation Steps

1. Consume the registered Phase 2 native corpus with image base `0x0` and explicit
   Thumbv5TE decoding. Add a decompiler only when it produces a separately registered,
   reproducible view; it is not a prerequisite for symbol-led cross-disassembly.
2. Demangle and group app symbols such as BaseGameplayLayer, PhysicsBladeLayer,
   TossTurn, Fruit, Bomb, ScoreManager, TimeManager, Settings, and mode layers.
3. Recover constructors and onEnter/update paths before isolated leaf functions.
4. Trace mode initialization, toss object selection, spawn intervals, velocity, gravity,
   collision/cut handling, score, failure, freeze, magnet, double-score, and game-over.
5. Recover persistent keys, defaults, prices, unlock rules, objectives, and best-score slots.
6. Recover RNG sources/seeding, clock origin, initial save state, and input sampling. Mark
   deterministic reconstruction fixtures only when all required controls are known; otherwise
   document the distribution or unknown without inventing an original-runtime baseline.
7. Trace physics world creation through body/fixture construction, simulation update,
   ray casts, contacts, entity destruction, and score/failure callbacks.
8. Cross-check recovered branches/constants against independent disassembly, resource
   geometry/naming, Java boundaries, and user memory or historical media where available.
9. Express recovered behavior independently of both old and new frame callbacks, with
   units, coordinate system, timing, randomness, preconditions, and observable outcomes.
10. Translate each verified contract into a Creator map: TypeScript owner, serialized
    data, scene/prefab dependencies, engine API boundary, tests, and unresolved recovery risk.

## Todo List

- [x] Native symbol/function map
- [x] Classic mode/state graph
- [ ] Remaining-mode state graphs
- [x] Classic physics and toss contracts
- [x] Classic cut/score/combo/fail contract
- [x] Classic time/state/pause/termination contract and shared TimeManager behavior
- [ ] Remaining-mode scoring/failure/time contracts
- [ ] Save/progression schema
- [x] Classic evidence/confidence ledger
- [x] Classic deterministic-fixture, distribution, or unknown classification
- [ ] Complete libgame.so-to-Cocos Creator contract map

## Success Criteria

- [ ] All core modes have entry, update, scoring, and termination contracts
- [ ] Random ranges/distributions and physics units are quantified or explicitly unknown
- [ ] Save keys/defaults/unlocks/objectives are documented
- [ ] No engine implementation detail is mistaken for product behavior
- [ ] Every app-owned native subsystem is recovered, explicitly excluded with evidence,
      or retained as a named blocker; none is delegated to the old binary at runtime
- [ ] Every critical contradiction between static views/resources is resolved or disclosed
- [ ] Creator Physics2D mapping covers every recovered physics rule and names every unknown

## Risk Assessment

- Decompilers can infer wrong types/control flow: verify with independent disassembly,
  data references, call paths, and resource constraints.
- Large bundled libraries create noise: filter by app symbol ownership.
- Exact randomness may depend on global state: recover initialization and seed paths.

## Security Considerations

Analysis remains offline and static. Do not bypass external services, accounts, purchases,
or access controls, and do not execute recovered native code.

## Next Steps

The Phase 5 Classic native-contract readiness subset is now registered: physics, toss,
cut/score/fail, time/state, and presentation contracts plus the executable reconstruction
policy. Phase 4 remains open for remaining modes, persistence/progression, and named Classic
unknowns; none may delegate behavior to `libgame.so`. Full closure is still required before
Phase 6.

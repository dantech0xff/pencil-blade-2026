# Static-Only Restoration Strategy

## Summary

The original APK cannot run on any available current Android device. Restoration therefore
uses only static evidence from the immutable APK, `libgame.so`, resources, app-owned Java,
and metadata, supplemented by historical media or user memory when available. Reimplement
the result in current Cocos Creator with TypeScript and Creator Physics2D. Original code is
evidence only and never enters the production implementation.

## Evidence Hierarchy

1. Immutable APK bytes, resource table, assets, app-owned Java, native disassembly, and hashes.
2. Independent static corroboration: instruction view, decompiler, symbols/xrefs, data layout,
   resource geometry/naming, and cross-tool agreement.
3. Authentic historical screenshots, video, reviews, documentation, or archived descriptions.
4. User memory and explicit restoration decisions.

Gameplay claims use `recovered`, `inferred`, or `unknown`. Contradictions are linked
separately. No claim is described as runtime-observed because no original runtime is
available. A recovered contract needs direct Tier 1 evidence plus appropriate static
corroboration. An inferred rule may be implemented when clearly labeled and reviewed, but
it never increases recovered-coverage metrics.

## Specification Method

- Model states and events before writing engine code.
- For each state: entry/exit, UI, entities, inputs, physics, score, sound, timing, persistence.
- Cite native addresses/symbols, callers/callees, constants, strings, resource paths, and hashes.
- Cross-check decompiler output against instructions/data references and resource constraints.
- Quantify units, coordinate transforms, random distributions, and lifecycle ordering.
- Maintain unknowns instead of inventing behavior; record user decisions that close gaps.

## Static Analysis Protocol

- Reproduce extraction from the registered APK hash; keep analysis databases and raw output ignored.
- Import `libgame.so` with the recorded ELF32 ARM EABI5/ARMv5TE profile and load settings.
- Separate application functions from Cocos2d-x, Box2D, vendor, and compiler/runtime code.
- Recover constructors and lifecycle/update roots before leaf functions.
- Trace physics world setup, timestep, gravity, scale, bodies, fixtures, collision filters,
  velocity/impulse, blade ray casts, contacts, destruction, and gameplay callbacks.
- Trace save keys/defaults, modes, objectives, progression, scoring, time, and randomness.
- Maintain binary/resource-to-contract-to-test traceability and an explicit unknowns ledger.

## Cocos Creator Translation Gate

The engine is fixed: current stable Cocos Creator, with 3.8.8 / 3.8 LTS as the
baseline rechecked on 2026-07-22 and a required final pin at Phase 5 start. Creator Physics2D is the
production physics layer. A narrow adapter configures it from recovered physics contracts;
testable TypeScript owns gameplay/state/scoring/progression rules. No original binary,
Cocos2d-x application runtime, JNI/JSB bridge, compatibility wrapper, or emulation layer may
satisfy the gate.

## Reconstruction Validation

- Native logic: cross-tool instruction/control-flow/constant corroboration.
- Physics: recovered parameter, fixture, filter, ray-cast, contact, and outcome tests in Creator.
- Gameplay: deterministic reconstruction fixtures, invariants, event ordering, and distributions.
- Presentation: exact asset hashes/geometry plus recovered layout and sequence constraints.
- Audio: resource identity plus recovered event/order/overlap parameters.
- Saves: clean, progressed, edge, and corrupted fixtures derived from recovered schema/defaults.
- Human review: compare against user memory or historical media while retaining inference labels.

These checks prove consistency with recoverable evidence. They do not prove 100% runtime
identity with an application that cannot be executed.

## Rights Boundary

Analysis and private preservation do not automatically grant redistribution rights. Track
provenance and rights per asset. Public release requires clearance or replacement for the
original artwork, name/trademark, fonts, music, and other third-party material. Replacements
and inferred behavior remain separate from recovered coverage.

## Unresolved Questions

- Intended release scope: private preservation, open-source code, or public store release?
- Is any authentic historical gameplay video, screenshot set, review, or manual available?
- Which user-recalled rules/screens are strong enough to approve as explicit inferences?
- Where will the two offline APK backups be stored and hash-verified?

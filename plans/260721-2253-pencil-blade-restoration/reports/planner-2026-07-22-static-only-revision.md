# Planner Report: Static-Only Revision

Date: 2026-07-22

## Decision Delta

- Original APK cannot run on any available current Android device.
- Delete reference-device, emulator, runtime-capture, instrumentation, frozen-original-trace,
  and golden-master dependencies.
- Restore from `libgame.so`, packaged resources, app-owned Java, and metadata only.
- Use Cocos Creator Physics2D as the production physics layer.
- Replace empirically proven 100% identity with maximal recoverable fidelity.
- Classify gameplay behavior as `recovered`, `inferred`, or `unknown`; keep contradictions separate.

## Plan Changes

- Phase 1 retained. Hash/inventory/curated boundary remain valid; offline backups still open.
- Phase 2 replaced with a reproducible static-analysis corpus and native/resource maps.
- Phase 3 derives presentation from resources, call sites, geometry, historical media, and user review.
- Phase 4 recovers gameplay, Physics2D configuration, scoring, save, and progression contracts statically.
- Phase 5 validates a Creator Physics2D vertical slice against recovered contracts and internal fixtures.
- Phases 6-7 report recovered, inferred, and unknown coverage separately and never claim original-runtime comparison.

## Validation Model

1. Immutable input hashes and reproducible extraction.
2. Cross-tool disassembly/decompiler/data-reference corroboration.
3. Binary/resource-to-contract-to-test-to-Creator traceability.
4. Creator Physics2D contract tests and deterministic reconstruction fixtures.
5. Asset geometry/layout/audio checks.
6. Supporting review against user memory or authentic historical media, with inference labels preserved.
7. Build audit proving no APK, `libgame.so`, old runtime, bridge, or decompiler artifact ships.

## Trade-off

Static reconstruction can recover substantial logic and data but cannot empirically prove
runtime identity. The plan therefore measures recovered-contract coverage and exposes all
inferences/unknowns. It does not lower the implementation ambition; it corrects the evidence claim.

## Superseded Material

The 2026-07-21 reviewer/validator reports remain historical records. Statements requiring a
physical 32-bit ARM device, runtime capture, or original trace are superseded by this report.

## Unresolved Questions

- Intended release scope: private preservation, source publication, or public store release?
- Is authentic historical gameplay media available?
- Where will two offline APK backups be stored and hash-verified?

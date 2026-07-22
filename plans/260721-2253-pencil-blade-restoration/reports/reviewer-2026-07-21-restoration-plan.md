---
type: reviewer
date: 2026-07-21
status: superseded
updated: 2026-07-22
---

# Restoration Plan Red-Team Review

> **Historical report — superseded 2026-07-22.** Its reference-device, runtime-capture,
> and original-runtime comparison assumptions are not active requirements. Follow the
> [static-only revision](./planner-2026-07-22-static-only-revision.md) and current phase files.

## Summary

Plan challenged against the APK and internal dependency graph. Material findings were
accepted and incorporated. No unresolved contradiction blocks Phase 1.

The later user decision to rebuild exclusively in the latest stable Cocos Creator has
also been incorporated. The former engine-selection/approval gate is superseded.

## Accepted Findings

- ARM profile overclaimed ARMv7. Corrected to ELF32 little-endian ARM EABI5 with CPU
  attribute 5TE; require profile verification before disassembly.
- 784 PNG was ambiguous. Scoped it to assets/ and added 107 res/ PNG classification.
- Full Phase 2 dependencies created a capture/save-schema cycle. Phases 2-4 now start
  after Phase 1 and iterate; progressed-state capture waits for verified save keys.
- Phase 5 now has explicit Classic readiness gates; Phase 6 requires full Phases 2-5 closure.
- Original RNG control was assumed. Deterministic eligibility now requires seed, clock,
  initial save hash, and input timing; otherwise use statistical comparison.
- Capture synchronization and fidelity comparator contracts were underspecified. Added
  monotonic calibration metadata and a versioned machine-readable fidelity policy.
- Release exceptions could weaken the 100% goal. Exact restoration now has no accepted
  fidelity exception; release variants and rights substitutions are measured separately.
- Evidence statuses were inconsistent. Added canonical statuses and a claim ledger schema.
- Production architecture is now fixed to Cocos Creator TypeScript/components/scenes.
  Added explicit prohibitions on original binary/runtime reuse, bridging, porting, and emulation.

## Rejected Findings

- One validation pass claimed only 13 fonts. Direct extracted inventory lists 16 files:
  15 TTF and 1 OTF; a separate technical review confirmed the same. Baseline remains 16.
- One pass claimed plan frontmatter requires effort. The loaded ck:plan frontmatter schema
  and CLI-generated plan do not require that field; phase-level estimates remain.

## Unresolved Questions

None blocking Phase 1. Later gates need a compatible physical reference device, release
scope, and rights evidence. Android is the primary target; engine selection is closed.

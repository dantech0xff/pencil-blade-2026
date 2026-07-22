# Phase 2 Static Corpus Progress — 2026-07-22

## Status

In progress. Runtime/device capture removed from method and gates. Static foundation ready;
function-level call, constant, and string-xref enrichment remains.

## Delivered

- `DER-NATIVE-CORPUS-001`: reproducible GNU/LLVM ARMv5TE analysis; 16,516 named dynamic
  symbols, 13,948 defined functions, 343 imports, two Thumb disassembly views.
- `DER-FUNCMAP-001`: 713 allowlisted application functions with normalized instruction
  addresses, ownership, subsystem, confidence, and evidence IDs.
- `DER-RESMAP-001`: 862 assets, 389 exact resolution-tree pairs, 315 unique native resource
  strings, 282 exact logical matches, 17 printf-pattern matches.
- `DER-JNIMAP-001`: lifecycle/JNI/vendor boundary and persistence contract; 17 engine JNI
  exports, five native-to-Java product bridges, 50 integer and four boolean bulk-save keys.
- Unknowns ledger and subsystem queues for Classic gameplay, physics, toss, blade, score,
  progression, presentation, and release rights.

## Recovered Physics Foundation

- Gravity `(0, -10)`; sleeping enabled.
- Velocity/position iterations `10/10`.
- Step input `deltaTime * worldSpeed`; default speed `1.0`.
- Freeze speed `0.5`; unfreeze restores `1.0`.
- Creator Physics2D remains the production adapter; original Box2D code is evidence only.

## Verification

- Native analyzer tests: 7/7 pass.
- Resource catalog tests: 8/8 pass, including byte-identical curated artifact checks.
- Claims schema/ledger test: pass.
- APK baseline verifier: pass; source SHA-256 unchanged.
- Strict plan validation: 7 phases, 0 errors, 0 warnings.

## Remaining

- Add direct call edges, constants, resource/string xrefs, and review state to application
  function records.
- The reviewed Classic physics, toss, cut/score, time/state, and presentation contracts now
  consume this corpus. Continue enriching exact contract slices/call edges while Phase 4
  recovers remaining entities, modes, persistence, and progression.
- Phase 1 custody closeout still needs two verified offline backups; not a Phase 2 runtime gate.

## Unresolved Questions

- Complete fixture definitions outside the recovered Classic Fruit/Bomb/Electric subset.
- Exact engine/VFX RNG interleaving, long-term ray duplicate policy, node tag `1437`
  semantics, and unsafe electric-contact runtime impact that cannot be observed.
- Rights for original assets, audio, fonts, product name, and trademarks.

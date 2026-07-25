---
phase: 2
title: "Establish Static Reconstruction Corpus"
status: completed
priority: P1
dependencies: []
effort: "1-3 weeks"
---

# Phase 2: Establish Static Reconstruction Corpus

## Overview

Build the reproducible static-analysis corpus directly from `libgame.so`, packaged resources,
app-owned Java, and metadata. Do not install or execute the original APK. Convert those
static inputs into addressable evidence for later contracts.

## Context Links

- [Evidence baseline](./phase-01-preserve-evidence-and-establish-baseline.md)
- [APK static forensics](./research/apk-static-forensics.md)
- [Static-only restoration strategy](./research/restoration-strategy.md)

## Requirements

- Artifact gate: `SRC-APK-001`, `DER-INV-001`, `DER-WORK-001`, and `DER-NATIVE-001`
  exist, match the evidence register, and pass the Phase 1 verifier. Phase 1 may remain open
  only for external-backup custody.
- Treat the APK and extracted `libgame.so` as read-only evidence; never execute, patch,
  re-sign, link, ship, wrap, emulate, or mechanically translate them.
- Record tool versions, import settings, load address, CPU profile, commands, and hashes.
- Produce independent disassembly/decompiler views where tooling permits and reconcile
  disagreements at the instruction/data-reference level.
- Separate app-owned functions and data from Cocos2d-x, Box2D, vendor, and compiler runtime code.
- Classify gameplay conclusions as `recovered`, `inferred`, or `unknown`; record
  contradictions separately. Runtime-observed evidence is unavailable.
- Give every curated claim source IDs, native addresses or resource paths, confidence,
  reviewer, and the downstream contract/test it supports.

## Architecture

The ignored working zone holds analysis databases, bulk disassembly, strings, and
decompiler output. The curated zone holds compact symbol/function maps, resource-use maps,
call-path notes, evidence claims, and unknowns. Later phases consume only curated records,
never raw native code as implementation input.

## Related Code Files

- Read: ../../.forensics-work/phase-01/native/libgame.so
- Read: ../../.forensics-work/phase-01/java/app-owned/
- Read: ../../.forensics-work/phase-01/archive/
- Create: ../../docs/static-reconstruction-method.md
- Create: ../../forensics/native/function-map.csv
- Create: ../../forensics/native/subsystem-map.md
- Create: ../../forensics/native/java-jni-boundary.md
- Create: ../../forensics/resources/resource-usage-map.json
- Create: ../../forensics/unknowns.md
- Update: ../../forensics/claims.jsonl
- Create: ../../scripts/analyze-native-static.sh
- Create: ../../scripts/catalog-static-resources.mjs
- Create: ../../tests/analyze-native-static-test.sh
- Create: ../../tests/catalog-static-resources-test.mjs

## Implementation Steps

1. Register the static toolchain and prove all inputs match Phase 1 hashes.
2. Import `libgame.so` as ELF32 little-endian ARM EABI5/ARMv5TE with documented load
   settings; keep the analysis database ignored.
3. Demangle and classify dynamic symbols, imports, strings, RTTI/vtables when present,
   constructors, and lifecycle/update entry points.
4. Generate a function inventory with address, size, callers, callees, constants, strings,
   subsystem, ownership, confidence, and review state.
5. Cross-check representative control flow and constants with an independent disassembler
   or raw instruction view; never accept decompiler pseudocode alone.
6. Trace app-owned Java/JNI boundaries, preferences, lifecycle hooks, and resource loading.
7. Build resource cross-references from strings, native call sites, dimensions, naming,
   sequences, and duplicated resolution trees.
8. Seed subsystem maps for game states, modes, toss scheduling, Box2D/physics, blade ray
   casts, entities, scoring, time, objectives, settings, saves, audio, and presentation.
9. Record unresolved branches, indirect calls, packed data, and ambiguous constants in a
   prioritized unknowns ledger; do not fill gaps with convenient behavior.
10. Define the binary/resource-to-contract citation format used by Phases 3-7.

## Todo List

- [x] Reproducible static-analysis toolchain record
- [x] Native function and subsystem maps
- [x] Independent control-flow/constant cross-check sample
- [x] Java/JNI and persistence boundary map
- [x] Resource-usage cross-reference
- [x] Evidence-status and unknowns ledger
- [x] Contract citation format
- [x] Enrich application function records with call, constant, string-xref, and review-state fields

## Success Criteria

- [x] Every curated native claim cites immutable hashes plus addresses/symbols or resource paths
- [x] Representative app call paths agree across at least two static views, or conflicts are logged
- [x] App, engine, Box2D, vendor, and compiler-runtime ownership boundaries are explicit
- [x] Core subsystems have named entry points and prioritized analysis queues
- [x] No requirement or artifact depends on running the original APK
- [x] Phase 3 and Phase 4 consume the corpus without copying decompiler output into game code

## Risk Assessment

- Stripped code and indirect calls can obscure ownership: combine symbols, xrefs, strings,
  vtables, call neighborhoods, and resource access.
- A decompiler can invent types or structured control flow: cross-check instructions and
  data references before marking a rule recovered.
- Static evidence may not resolve every dynamic value: retain explicit unknowns and seek
  corroboration from resources, historical media, or user memory.

## Security Considerations

Keep executable evidence and reverse-engineering databases ignored and offline. Do not
restore obsolete network, ad, account, purchase, or tracking behavior.

## Next Steps

Phase 3 uses the resource map for presentation reconstruction. Phase 4 turns subsystem
maps and call paths into gameplay, physics, save, and progression contracts.

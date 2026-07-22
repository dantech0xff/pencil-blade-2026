---
phase: 1
title: "Preserve Evidence and Establish Baseline"
status: in-progress
priority: P1
dependencies: []
effort: "2-4 days"
---

# Phase 1: Preserve Evidence and Establish Baseline

## Overview

Create a reproducible evidence package around the sole APK. No gameplay
implementation begins in this phase.

## Context Links

- [Program plan](./plan.md)
- [APK static forensics](./research/apk-static-forensics.md)
- Source artifact: ../../Pencil+Blade_1.5_APKPure.apk

## Requirements

- Preserve original APK bytes and provenance.
- Record hashes, signature, ZIP integrity, manifest, ABI, SDK, and tool versions.
- Produce reproducible Java/resource/native extraction without modifying the APK.
- Maintain project docs and the approved Git boundary around curated versus ignored evidence.

## Architecture

Use three evidence zones:

1. Original: immutable APK and checksums.
2. Working: ignored decoder output for JADX, Apktool, and native tools.
3. Curated: versioned manifests, catalogs, specifications, scripts, and reports.

## Related Code Files

- Read: ../../Pencil+Blade_1.5_APKPure.apk
- Create: ../../docs/evidence-register.md
- Create: ../../forensics/claims.schema.json
- Create: ../../forensics/claims.jsonl
- Create: ../../docs/project-overview-pdr.md
- Create: ../../scripts/inventory-apk.sh
- Create: ../../forensics/README.md
- Create: ../../.gitignore

## Implementation Steps

1. Copy the APK to offline backup; never overwrite or re-sign the evidence copy.
2. Record SHA-256, byte size, ZIP integrity, signing certificate, and archive timestamps.
3. Decode manifest/resources with two independent tools and preserve command/version metadata.
4. Extract app-owned Java separately from bundled Google/Cocos runtime code.
5. Extract libgame.so and generate headers, strings, dynamic symbols, imports, and section reports.
6. Create an evidence register with source, date obtained, hash, derivation, and confidence.
7. Define a claim schema with status, evidence tier, evidence IDs, native address
   when applicable, confidence, contradiction links, reviewer, and review date.
8. Define ignored working-output locations before checking in any extracted content.
9. Document rights assumptions; do not treat possession of APK as redistribution permission.
10. Keep the curated/ignored boundary enforced after the user-approved Git initialization.

## Todo List

- [ ] Two external offline backups verified by matching SHA-256
- [x] Reproducible inventory script
- [x] Evidence register
- [x] Machine-readable claim schema and ledger
- [x] Project overview and explicit non-goals
- [x] Working/curated boundary documented

## Success Criteria

- [x] Original SHA-256 remains 95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa
- [x] Archive integrity reports 985 files and no errors
- [x] Package/version/SDK/component facts reproduced by the inventory verifier
- [x] libgame.so and asset counts match the baseline report
- [x] No copyrighted bulk extraction is staged or committed
- [x] Every curated finding can cite immutable evidence or a declared supporting source

## Risk Assessment

- Sole-artifact loss: maintain at least two offline copies with verified hashes.
- Decoder disagreement: preserve raw output and cross-check tools.
- Evidence contamination: never patch, align, or re-sign the original.

## Security Considerations

Treat legacy ads, social URLs, and network endpoints as untrusted. Static analysis
does not require executing the APK.

## Next Steps

Start static Phases 2-4 from the verified hash/inventory. Keep Phase 1 open until two
external offline copies match the registered SHA-256.

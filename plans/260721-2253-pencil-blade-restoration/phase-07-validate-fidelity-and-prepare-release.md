---
phase: 7
title: "Validate Static Reconstruction and Prepare Release"
status: pending
priority: P1
dependencies: [6]
effort: "2-4 weeks"
---

# Phase 7: Validate Static Reconstruction and Prepare Release

## Overview

Validate the reconstruction against frozen static evidence, recovered/inferred contracts,
and internal deterministic fixtures. Report uncertainty honestly and separate technical
completion from legal authorization to distribute.

## Context Links

- [Full reconstruction](./phase-06-recreate-full-game-content-and-progression.md)
- [Static reconstruction corpus](./phase-02-establish-static-reconstruction-corpus.md)

## Requirements

- Execute the versioned reconstruction policy for visuals, transitions, input, Physics2D,
  score, audio, saves, evidence traceability, and uncertainty coverage.
- Run deterministic reconstruction scenarios at both original viewports and supported targets.
- Audit licensing/ownership for game name, artwork, music, fonts, code, and third-party services.
- Produce recovered-reconstruction and public-release-variant manifests separately.
- Inferred behavior and release substitutions remain visible and never count as recovered coverage.
- Build through the Phase 5 pinned Cocos Creator toolchain and prove release artifacts
  contain no original executable code, compatibility wrapper, or emulator layer.

## Architecture

The reconstruction harness replays versioned input/time/random fixtures in the rebuild,
checks repeatability, and verifies recovered constants, invariants, event ordering, and
contract coverage. It makes no original-runtime comparison claim. Static UI checks use
source geometry, recovered layout rules, and historical media/user review when available.
Release packaging consumes only
fail-closed ship-ready records containing provenance, ownership/license evidence, scope,
approver, and approval date, including for newly created material. An artifact audit
separately verifies the Creator build boundary and absence of the legacy runtime.

## Related Code Files

- Create: ../../tests/reconstruction/
- Create: ../../tests/fixtures/reconstruction/
- Create: ../../docs/reconstruction-report.md
- Create: ../../docs/compatibility-matrix.md
- Create: ../../docs/release-rights-checklist.md
- Create: ../../docs/cocos-creator-build-audit.md
- Read: ../../reference/reconstruction-policy.yaml
- Create: release manifest and build pipeline after authorization

## Implementation Steps

1. Freeze the static evidence set, contract versions, reconstruction fixtures, and unknowns ledger.
2. Verify asset bytes/geometry and recovered layout/animation constraints; record human review
   against user memory or historical media as supporting evidence, not recovered runtime proof.
3. Verify spawn/cut/contact/score/failure invariants, repeatable timelines, and recovered distributions.
4. Verify audio cue selection, ordering, overlap, and recoverable parameters.
5. Test lifecycle, offline mode, clean install, save upgrade/reset, and supported devices.
6. Review every inference, unknown, and release substitution; keep all outside recovered coverage.
7. Complete rights review; replace or omit uncleared assets/features in public builds,
   and record ownership/license evidence for newly created replacements.
8. Inspect the built APK/AAB dependency graph and archive contents; fail on original
   libgame.so, APK payloads, Cocos2d-x 2.1.4 app runtime, decompiler output, JNI/JSB legacy
   gameplay bridges, or evidence-directory files.
9. Archive reproducible analysis metadata and produce a signed release only after approval.

## Todo List

- [ ] Frozen static-evidence and reconstruction-fixture suite
- [ ] Contract/traceability, visual, timing, physics, and audio reports
- [ ] Compatibility matrix
- [ ] Release-variant exceptions documented separately
- [ ] Rights checklist complete
- [ ] Recovered-reconstruction and public-release-variant manifests separated
- [ ] Cocos Creator toolchain and prohibited-runtime build audit

## Success Criteria

- [ ] All recovered contracts pass the versioned reconstruction policy
- [ ] Every inference, unknown, and release exception is reported separately and cannot
      raise recovered coverage
- [ ] No unexplained divergence from recovered gameplay, score, physics, or progression contracts remains
- [ ] Supported device/build requirements pass
- [ ] Public build contains only fail-closed ship-ready records with complete rights evidence
- [ ] Release gameplay is traceable to TypeScript/Creator source and contains no original
      executable application logic
- [ ] Release decision is recorded separately from preservation completion

## Risk Assessment

- Runtime identity cannot be measured without a runnable original: report maximal
  recoverable fidelity and uncertainty instead of a 100% equivalence claim.
- Device/GPU/audio variation can still affect the rebuilt game: validate supported targets
  against the reconstruction contracts, not against an unavailable original runtime.
- Technical fidelity does not grant distribution rights: maintain a hard release gate.

## Security Considerations

Use current signing and dependency practices. Exclude recovered identifiers, legacy SDKs,
private data, and obsolete endpoints from release artifacts.

## Next Steps

Release, private archival handoff, or further fidelity work based on the two independent
technical and rights gates.

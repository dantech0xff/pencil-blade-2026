---
phase: 3
title: "Catalog Resources and Reconstruct Presentation"
status: in-progress
priority: P1
dependencies: [2]
effort: "1-2 weeks"
---

# Phase 3: Catalog Resources and Reconstruct Presentation

## Overview

Turn APK resources and static usage evidence into a searchable presentation specification:
dimensions, variants, UI placement, animation, audio cues, fonts, uncertainty, and rights.

## Context Links

- [Static reconstruction corpus](./phase-02-establish-static-reconstruction-corpus.md)
- [APK static forensics](./research/apk-static-forensics.md)
- [Static resource usage map](../../forensics/resources/resource-usage-map.json)
- [Classic presentation contract](../../forensics/contracts/classic-presentation-contract.md)
- [Reconstruction policy](../../reference/reconstruction-policy.yaml)

## Requirements

- Catalog all game assets: 784 PNG under assets/, 59 WAV, 3 MP3, and 16 fonts.
- Inventory and classify the additional 107 PNG under Android res/ as game, launcher,
  vendor UI, or excluded-with-reason.
- Pair 480x800 and 720x1280 variants by logical asset ID.
- Record dimensions, alpha bounds, hashes, duplicates, frames, states, and recovered or
  inferred usage.
- Separate exact archival assets from assets cleared for public redistribution.
- Define a lossless mapping from every used APK resource to its Cocos Creator asset type,
  import settings, logical ID, generated UUID/meta record, and runtime consumer.

## Architecture

Use a machine-readable asset catalog as the source of truth. Reconstructed states reference
logical asset IDs rather than APK paths. A layout spec stores normalized anchors plus
reference-resolution coordinates recovered from native constants/call sites where possible.
Animation/audio timelines cite resource sequences and native callbacks. Raw extractions
remain immutable; Creator receives verified copies without source recompression.

## Related Code Files

- Existing: ../../forensics/resources/resource-usage-map.json
- Create/update: ../../forensics/contracts/classic-presentation-contract.md
- Create: ../../assets/catalog/asset-catalog.json
- Create: ../../assets/catalog/asset-schema.json
- Create: ../../docs/presentation-spec.md
- Create: ../../docs/audio-cue-map.md
- Create: ../../docs/font-and-rights-register.md
- Create: ../../reference/reconstruction-policy.yaml
- Create: ../../scripts/catalog-assets.*
- Create: ../../scripts/stage-creator-assets.*
- Update in Phase 5: ../../game/assets/game/

## Implementation Steps

1. Extract assets into ignored working storage; hash and inspect without recompression.
2. Generate logical IDs across both resolution trees and report missing/mismatched pairs.
3. Detect frame sequences for birds, blades, particles, electric effects, and cut fruit.
4. Recover UI anchors, scaling, crop policy, z-order, text metrics, and transitions from
   resource geometry plus native constructors/update paths; tag unresolved placement as inferred.
5. Map each sound to native event/call site, gain, overlap policy, and ordering where recoverable.
6. Identify embedded third-party material, especially music and fonts, for legal review.
7. Produce per-screen reconstruction composites from static mappings. Review them against
   user memory or historical media when available, without upgrading inference to recovery.
8. Define a versioned reconstruction policy: exact source-byte/geometry checks, recovered
   anchors and ordering, animation/audio event contracts, confidence thresholds, and how
   unknowns affect coverage. Do not invent reference-noise tolerances without runtime samples.
9. Define and test the staging manifest that copies approved resource bytes into the
   Creator project, records imported UUID/meta data, and detects any unintended pixel,
   alpha, duration, sample-rate, or font substitution.

## Todo List

- [x] Static resource catalog
- [x] Resolution-pair report
- [x] Reviewed Classic presentation/layout/audio subset contract
- [x] Versioned machine-readable reconstruction policy and focused validator
- [ ] Ship-ready asset schema/catalog and usage enrichment
- [ ] Animation frame map
- [ ] UI/layout spec
- [ ] Audio cue map
- [ ] Rights status for every logical asset
- [ ] Cocos Creator staging/import manifest

## Success Criteria

- [ ] Catalog reconciles 784 assets/ PNG plus 107 res/ PNG with explicit scope/classification
- [ ] Every statically identified screen element maps to an asset, generated primitive, or unknown
- [ ] 480x800 and 720x1280 scaling/cropping rules are recovered or explicitly inferred
- [ ] Animation and audio cues cite resource sequences plus native event evidence
- [ ] Reconstruction checks and coverage rules are executable before the vertical slice
- [ ] The vertical-slice subset imports into Creator with byte/source and rendered-output
      reconciliation; original extraction remains untouched
- [ ] No unknown-rights asset is silently marked ship-ready

## Risk Assessment

- PNG metadata may not reveal placement: combine native constants, call sites, paired
  resolutions, historical media, and user review; preserve uncertainty.
- Font rendering varies by engine/platform: preserve embedded font metrics and glyph tests.
- Exact asset reuse may be legally unavailable: retain replacement mapping without losing provenance.

## Security Considerations

Asset processing is offline. Treat fonts and decoders as untrusted inputs and use
current sandboxed tooling.

## Next Steps

Feed presentation contracts and the verified staging manifest into the Cocos Creator
vertical slice in Phase 5.

# APK Corpus Canonical Denominator Decision

Status: accepted
Date: 2026-07-25

## Decision

The project owner confirmed on 2026-07-25 that no Pencil Blade sample project, source
project, resource archive, or other authoritative corpus exists outside the preserved APK.
The APK is therefore the sole reconstruction source and the verified recovered APK
game-asset corpus is the final canonical resource denominator.

The canonical authority is:

- source APK SHA-256:
  `95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa`
- canonical game-resource root:
  `.forensics-work/phase-01/jadx/resources/assets`
- source manifest SHA-256:
  `0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3`
- `862` game assets totaling `32,945,747` bytes:
  `784` PNG, `59` WAV, `3` MP3, `15` TTF, and `1` OTF
- complete reconciliation:
  `761` consumed, `100` reviewed exclusions, `1` unsupported, and `0` unknown

The additional `107` Android `res/` PNG remain in the evidence inventory. Static
classification identifies `3` launcher and `104` vendor-UI resources, with `0` game
resources, so they are not part of the game-fidelity denominator.

## Consequences

- No external sample-project root or manifest remains an input, dependency, or open gate.
- Every one of the `862` canonical game assets remains byte-preserved and staged.
- A reviewed exclusion remains in the denominator and residual ledger; it must not be
  silently dropped or given an invented runtime consumer.
- `Fonts/CooperBlackStd.otf` remains byte-preserved and explicitly unsupported by the
  current Creator consumer path.
- This decision freezes the resource denominator only. It does not by itself establish the
  five-domain weighting, Physics2D equivalence, public-release rights, or the final `>=99%`
  fidelity score.

## Evidence

- [`../evidence-register.md`](../evidence-register.md)
- [`../../forensics/resources/resource-usage-map.json`](../../forensics/resources/resource-usage-map.json)
- [`../../assets/catalog/creator-staging-manifest.json`](../../assets/catalog/creator-staging-manifest.json)
- [`../../assets/catalog/resource-reconciliation-ledger.json`](../../assets/catalog/resource-reconciliation-ledger.json)
- [`../../release/recovered-reconstruction-manifest.json`](../../release/recovered-reconstruction-manifest.json)
- [`../../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-canonical-corpus.md`](../../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-canonical-corpus.md)

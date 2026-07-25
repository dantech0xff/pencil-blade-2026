# Reconstruction Report

## Current verdict

**As of:** 2026-07-25

Technical reconstruction and maximal-recoverable-fidelity gates pass. Backup redundancy and
per-asset rights clearance are owner-waived/out-of-scope; Pages deployment remains pending.

This report validates the clean-room Cocos Creator reconstruction against frozen static
evidence, recovered contracts, exact resources, the selected Physics2D backend, and supported
runtime rows. It does not claim empirical identity with an executing original or make a
legal-rights conclusion.

## Authority chain

| Layer | Authority |
|---|---|
| Immutable source | [`docs/evidence-register.md`](./evidence-register.md) |
| Reconstruction policy | [`reference/reconstruction-policy.yaml`](../reference/reconstruction-policy.yaml) `1.0.3` |
| Fidelity metric | [`reference/fidelity-metric-v1.json`](../reference/fidelity-metric-v1.json) `1.1.0` |
| Canonical asset catalog | [`assets/catalog/asset-catalog.json`](../assets/catalog/asset-catalog.json) |
| Presentation maps | [`docs/presentation-resource-spec.md`](./presentation-resource-spec.md) |
| Physics2D probe | [`forensics/runtime/physics2d-backend-equivalence.json`](../forensics/runtime/physics2d-backend-equivalence.json) |
| Android/H5 runtime | [`docs/compatibility-matrix.md`](./compatibility-matrix.md) |
| Residuals | [`forensics/fidelity/residual-gap-ledger.json`](../forensics/fidelity/residual-gap-ledger.json) |
| Preservation manifest | [`release/recovered-reconstruction-manifest.json`](../release/recovered-reconstruction-manifest.json) |
| Public release manifest | [`release/public-release-variant-manifest.json`](../release/public-release-variant-manifest.json) |

## Evidence and resource closure

| Measure | Result |
|---|---:|
| Source APK SHA-256 | `95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa` |
| Native library SHA-256 | `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e` |
| Enriched application functions | `713/713` with calls, constants, string xrefs, and review state |
| Canonical assets | `862`, `32,945,747` bytes |
| Exact-byte staged assets | `862/862` |
| Creator metadata/UUID captured | `862/862` |
| Runtime-consumed assets | `761` |
| Reviewed excluded assets | `100` |
| Reviewed unsupported assets | `1` (`Fonts/CooperBlackStd.otf`) |
| Unknown resource dispositions | `0` |
| Logical assets with a rights record | `473/473` |
| Physical assets approved for public distribution | `0/862` |

The resource closure includes 50 classified indexed sequences, eight recovered animation
timelines, all 62 audio cues, 18 presentation/resource consumers, every recovered static
screen signal, generated primitives, stock/procedural rendering decisions, six production
modes, and code-driven level/progression contracts.

## Five-domain metric

Metric: `pencil-blade-maximal-recoverable-fidelity@1.1.0`.

The overall score is the minimum domain score. Weighting and averaging are forbidden. Each
unit is binary and evidence-backed. Inferences, unknowns, exceptions, rights decisions, and
platform divergences stay outside recovered units and cannot raise coverage.

| Domain | Passed / frozen units | Score | Status |
|---|---:|---:|---|
| Visuals, layout, animation | `813/813` | `100.00%` | Pass |
| Audio | `55/55` | `100.00%` | Pass |
| Shader, material, rendering | `6/6` | `100.00%` | Pass |
| Level, mode, progression | `61/61` | `100.00%` | Pass |
| Gameplay, physics, timing, input, state | `33/33` | `100.00%` | Pass |
| **Overall minimum** | — | **`100.00%`** | **Pass** |

There are 25 disclosed residual/exception/blocker records and zero unexplained divergences.
The original-runtime identity flag is explicitly `false`.

The complete catalog remains visible beside the narrower recovered denominator: 62 audio
files contain 52 recovered event-linkage units and 10 disclosed resource-only residuals;
four rendering assertions contain three recovered units and one inferred-material residual;
four level/progression assertions contain three recovered units and one listed-inference
residual. These 12 records are not scored and are not silently omitted.

## Physics2D equivalence

The selected `@cocos/box2d@1.0.2` backend is pinned by path and SHA-256. Executable probes pass:

- gravity/trajectory at `1/120`, `1/60`, and `1/30` with iterations `10/10`
- forward then reverse raycasts with all fixture results and duplicate occurrences preserved
- bilateral bomb/electric contact acceptance and fruit/bomb rejection
- world locked during contact callback, direct destroy rejected, queued destroy successful
  after `Step`

Creator adapter tests independently cover world-unit/PTM translation, gravity `-320` public
units to `-10 m/s²`, linear velocity, variable timestep, synchronization/events, collision
rows, input dispatch, deferred mutation, and restoration. Android and H5 gameplay gestures
exercise the integrated runtime.

## Supported runtime matrix

- Android 13/API 33 arm64 emulator: cold start, gesture navigation/gameplay, audio focus,
  `jsb.sqlite`, same-process resume, portrait lock, and completely offline cold start pass.
- Google Chrome `150.0.7871.182`: `480x800` and `720x1280`, DPR 1, touch gestures,
  WebAudio, localStorage persistence, background/foreground, orientation restore, and
  post-load offline gameplay pass with zero console/page/request failures.
- Fresh Web Mobile tree: 2,539 files, 39,613,694 bytes, tree SHA-256
  `90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54`;
  every eager/lazy file passes the exact `/pencil-blade-2026/` prefix verifier.
- Fresh Android artifact: SHA-256
  `e313e149164eec8664b934a16e3c14b3a0f0265f9c7bb6306375a08a7cb5c37d`.

## Independent decisions

| Decision | Verdict | Reason |
|---|---|---|
| Maximal recoverable technical fidelity | Pass | Minimum of all five frozen domains is `100.00%`; zero unexplained divergences |
| Android artifact/runtime | Pass | Build audit plus supported arm64 runtime matrix pass |
| Local H5 artifact/runtime | Pass | Build/prefix audit plus both frozen Chrome rows pass |
| Evidence custody | Owner-waived | Only one source APK was supplied; no backup is claimed and the owner accepted the sole-source risk |
| Rights authorization | Out of scope | Per-asset legal clearance is not an academic restoration acceptance gate; no license claim is made |
| Public GitHub Pages | Pending | `main`, the online labeled runner, and exact Creator version/binary hash are configured; Pages/environment/deployment remain |

## Closeout blockers

1. Configure Pages source and the `github-pages` environment.
2. Deploy the audited H5 build through the protected runner.
3. Verify the production URL, eager/lazy assets, browser console, and supported runtime rows.

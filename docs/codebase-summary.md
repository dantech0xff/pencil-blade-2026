# Codebase Summary

Snapshot generated from a temporary local Repomix XML export on 2026-07-24; `repomix-output.xml` is transient and not part of the repository.

## Snapshot

| Metric | Value |
|---|---|
| Files packed | 1,775 |
| Total tokens | 2,453,311 |
| Total characters | 8,681,565 |
| Output format | XML |

## Current Workspace Shape

| Area | What is present |
|---|---|
| `docs/` | Project overview, code standards, architecture, reconstruction report, compatibility matrix, rights checklist, evidence register, and supporting summaries. |
| `forensics/` | Static evidence maps, contracts, claims, native analysis, and resource reconciliation outputs. |
| `game/` | Creator 3.8.8 project with pure TypeScript domain modules, Creator adapters, exact recovered APK assets, `classic.scene`, and the supported Android debug / Web Mobile build configs. |
| `game/build-configs/` | Sanitized Creator build-panel exports for Android debug and Web Mobile Pages. |
| `release/` | Preservation and public-release variant manifests that separate technical reconstruction from public distribution approval. |
| `scripts/` | Build-audit, release-gate, and reconstruction utilities. |
| `tests/` | Contract, vertical-slice, and artifact-gate coverage. |
| `plans/260721-2253-pencil-blade-restoration/` | The restoration plan, phase specs, and dated progress reports. |
| `assets/catalog/` | Generated resource staging and consumer-reconciliation ledgers for the recovered APK corpus. |
| `reference/` | Versioned reconstruction policy and related governance files. |

## Key Implementation Surfaces

| Surface | Role |
|---|---|
| `game/build-configs/android-debug.json`, `game/build-configs/web-mobile-pages.json` | Sanitized Phase 07 build-panel exports for the two supported targets. |
| `release/recovered-reconstruction-manifest.json`, `release/public-release-variant-manifest.json` | Preservation record and separate out-of-scope rights ledger. |
| `game/assets/scripts/domain/` | Pure gameplay, state, scoring, progression, and presentation contracts. |
| `game/assets/scripts/creator/` | Creator-only lifecycle, scene, audio, resource, and Physics2D integration. |
| `game/assets/scenes/classic.scene` | Editor-authored persistent bridge for the shell and route owners. |
| `assets/catalog/resource-reconciliation-ledger.json`, `assets/catalog/creator-staging-manifest.json` | Exact-byte resource staging and live-consumer reconciliation for the recovered APK corpus. |
| `scripts/build-android-debug.sh` | Pinned Android generation, Gradle build, debug-signing verification, singleton-ABI enforcement, prohibited-content audit, and normalized APK output. |
| `scripts/audit-creator-build.mjs`, `scripts/audit-web-build.mjs`, `scripts/verify-web-mobile-build.mjs` | Android archive, static Web tree, and exact Pages-prefix gates. |
| `.github/workflows/deploy-web-mobile-pages.yml`, `scripts/verify-release-rights.mjs` | Manual protected-main Pages workflow and separate future commercial-clearance verifier. |
| `tests/reconstruction/vertical-slice/*.test.ts`, `tests/*.test.mjs` | Regression coverage for recovered contracts, shell transactions, build wrappers, release manifests, and artifact gates. |

## What This Repository Is Doing Now

- Reconstructing Pencil Blade from static evidence only.
- Supporting exactly two technical build targets: Android debug APK and Web Mobile H5.
- Keeping the original APK, `libgame.so`, and legacy engine runtime as evidence, not runtime dependencies.
- Staging all 862 recovered APK game assets byte-for-byte in the Creator bundle.
- Tracking 761 live consumer paths, 100 reviewed exclusions, 1 unsupported font path, and 0 unknowns for the recovered APK corpus.
- Preserving six production gameplay routes: Classic, Crazy, GN Style, Classic Bird, Crazy Bird, and Combo Bird.
- Recording preservation separately from the academic Pages demo; per-asset legal clearance is owner-waived/out-of-scope and no license conclusion is made.
- Producing an audited Android debug APK and an audited local H5 tree without executing the original application.
- Current closeout records `192/192` top-level Node tests, `1568/1568` vertical-slice tests, and `1760/1760` total, alongside Creator `3.8.8` strict TypeScript, artifact audits, runtime matrices, and the frozen fidelity suite.
- The Android wrapper now binds the APK signer SHA-256 to a trusted debug keystore and requires the singleton `arm64-v8a` ABI; the release validator rejects pending exceptions and impossible calendar dates.

## Current Gates

- Physics2D trajectory, ray-order, contact, and lifecycle equivalence pass the frozen backend
  probe and Creator adapter fixtures.
- The sole-source APK corpus is the approved canonical resource denominator; the frozen
  five-domain no-weighting metric passes `100%` of recovered units with residual scope disclosed.
- Android API 33 arm64 and the two pinned Chrome runtime rows pass.
- Protected `main` plus the repository runner registration, labels, and active service are
  configured. The runner was online at capture; a later GitHub broker incident required a
  listener restart, and a final REST read reconfirmed it online and idle. Creator `3.8.8` is
  pinned by exact executable SHA-256. Pages run `30161202889`, attempt `2`, passes at
  `https://dantech0xff.github.io/pencil-blade-2026/`.

## Checkpoint Evidence

- [Phase 7 validation plan](../plans/260721-2253-pencil-blade-restoration/phase-07-validate-fidelity-and-prepare-release.md)
- [Phase 7 docs audit](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-docs-audit.md)
- [Phase 7 platform build checkpoint](../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-phase7-platform-builds.md)
- [Reconstruction report](./reconstruction-report.md)
- [Compatibility matrix](./compatibility-matrix.md)
- [Build audit](./cocos-creator-build-audit.md)
- [Rights checklist](./release-rights-checklist.md)
- [Recovered reconstruction manifest](../release/recovered-reconstruction-manifest.json)
- [Public release variant manifest](../release/public-release-variant-manifest.json)
- [Code standards](./code-standards.md)
- [System architecture](./system-architecture.md)

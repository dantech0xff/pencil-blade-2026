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
| `release/recovered-reconstruction-manifest.json`, `release/public-release-variant-manifest.json` | Preservation record and blocked public web release record. |
| `game/assets/scripts/domain/` | Pure gameplay, state, scoring, progression, and presentation contracts. |
| `game/assets/scripts/creator/` | Creator-only lifecycle, scene, audio, resource, and Physics2D integration. |
| `game/assets/scenes/classic.scene` | Editor-authored persistent bridge for the shell and route owners. |
| `assets/catalog/resource-reconciliation-ledger.json`, `assets/catalog/creator-staging-manifest.json` | Exact-byte resource staging and live-consumer reconciliation for the recovered APK corpus. |
| `scripts/build-android-debug.sh` | Pinned Android generation, Gradle build, debug-signing verification, singleton-ABI enforcement, prohibited-content audit, and normalized APK output. |
| `scripts/audit-creator-build.mjs`, `scripts/audit-web-build.mjs`, `scripts/verify-web-mobile-build.mjs` | Android archive, static Web tree, and exact Pages-prefix gates. |
| `.github/workflows/deploy-web-mobile-pages.yml`, `scripts/verify-release-rights.mjs` | Manual protected-main Pages workflow and fail-closed public-distribution gate. |
| `tests/reconstruction/vertical-slice/*.test.ts`, `tests/*.test.mjs` | Regression coverage for recovered contracts, shell transactions, build wrappers, release manifests, and artifact gates. |

## What This Repository Is Doing Now

- Reconstructing Pencil Blade from static evidence only.
- Supporting exactly two technical build targets: Android debug APK and Web Mobile H5.
- Keeping the original APK, `libgame.so`, and legacy engine runtime as evidence, not runtime dependencies.
- Staging all 862 recovered APK game assets byte-for-byte in the Creator bundle.
- Tracking 761 live consumer paths, 100 reviewed exclusions, 1 unsupported font path, and 0 unknowns for the recovered APK corpus.
- Preserving six production gameplay routes: Classic, Crazy, GN Style, Classic Bird, Crazy Bird, and Combo Bird.
- Separating preservation from distribution: the recovered-reconstruction manifest is non-shipping, and the public-release variant manifest keeps web publication blocked pending rights approval.
- Producing an audited Android debug APK and an audited local H5 tree without executing the original application.
- Repository checkpoint reports record `182/182` top-level Node tests, `1567/1567` vertical-slice tests, and `1749/1749` total, alongside Creator `3.8.8` strict TypeScript and artifact audits.
- The Android wrapper now binds the APK signer SHA-256 to a trusted debug keystore and requires the singleton `arm64-v8a` ABI; the release validator rejects pending exceptions and impossible calendar dates.

## Current Gates

- Physics2D trajectory, ray-order, contact, and lifecycle equivalence remain open.
- The canonical sample-project root and final five-domain fidelity denominator remain unresolved.
- Android runtime-device compatibility remains open even though the debug build and artifact audit pass.
- Public Pages deployment, the frozen H5 browser/device matrix, valid Creator runner signature, and public-rights approval remain open.

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

# Reconstruction Report

## Status and Scope

**As of:** 2026-07-25

**Policy:** [`reference/reconstruction-policy.yaml`](../reference/reconstruction-policy.yaml) `1.0.3`

**Recovered manifest:** [`release/recovered-reconstruction-manifest.json`](../release/recovered-reconstruction-manifest.json) `1.1.0`

**Evidence mode:** static-only

This report validates the clean-room reconstruction against frozen static evidence, recovered contracts, and deterministic fixtures. It does **not** claim original-runtime comparison, runtime identity, or final release authorization.

## Authority Chain

| Layer | Evidence |
|---|---|
| Immutable source | [`docs/evidence-register.md`](../docs/evidence-register.md) |
| Reconstruction policy | [`reference/reconstruction-policy.yaml`](../reference/reconstruction-policy.yaml) |
| Canonical denominator decision | [`docs/decisions/apk-corpus-canonical-denominator.md`](./decisions/apk-corpus-canonical-denominator.md) |
| Recovered reconstruction manifest | [`release/recovered-reconstruction-manifest.json`](../release/recovered-reconstruction-manifest.json) |
| Public release variant manifest | [`release/public-release-variant-manifest.json`](../release/public-release-variant-manifest.json) |
| APK-only resource corpus | [`plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-canonical-corpus.md`](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-canonical-corpus.md) |
| H5 viewport audit | [`plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-h5-viewport-audit.md`](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-h5-viewport-audit.md) |
| Phase 7 docs audit | [`plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-docs-audit.md`](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-docs-audit.md) |
| Phase 7 platform build checkpoint | [`plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-phase7-platform-builds.md`](../plans/260721-2253-pencil-blade-restoration/reports/implementer-2026-07-24-phase7-platform-builds.md) |
| Phase 7 completion traceability | [`plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-completion-traceability.md`](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-phase7-completion-traceability.md) |
| Build scripts | [`scripts/build-android-debug.sh`](../scripts/build-android-debug.sh), [`scripts/audit-web-build.mjs`](../scripts/audit-web-build.mjs), [`scripts/verify-web-mobile-build.mjs`](../scripts/verify-web-mobile-build.mjs) |
| Release workflow | [`.github/workflows/deploy-web-mobile-pages.yml`](../.github/workflows/deploy-web-mobile-pages.yml) |
| Build configs | [`game/build-configs/android-debug.json`](../game/build-configs/android-debug.json), [`game/build-configs/web-mobile-pages.json`](../game/build-configs/web-mobile-pages.json) |

### Frozen corpus facts

| Fact | Value |
|---|---|
| APK resource corpus scope | `recovered-apk-assets` |
| Canonical root | `.forensics-work/phase-01/jadx/resources/assets` |
| Asset count | `862` |
| Byte count | `32,945,747` |
| Corpus digest | `0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3` |
| Resource map digest | `165238f13f4186a9ab429c9c5a8bab07b4a42e941d0608f757d9e41a44d2ce67` |
| Staging manifest digest | `5d8fd3761906eaf5c568e0bb215ba838f78bf8268a97009dff97421dd5ab6fc2` |
| Reconciliation ledger digest | `18ea8ef7ae3fb3751d530dd89426979d601fd8e918d5e9b539a1b8d969daacae` |
| Resource dispositions | `761` consumed, `100` excluded, `1` unsupported, `0` unknown |

The project owner confirmed that the APK is the only extant source. This verified corpus is
the approved canonical game-resource denominator; no external sample project is expected.

## Coverage Definitions

| Coverage class | Current value | Notes |
|---|---:|---|
| APK inventory | `100%` | Exact recovered APK corpus inventory. |
| Exact-byte staging | `100%` | `862/862` bytes staged into the Creator bundle. |
| Disposition reconciliation | `100%` | Every staged path classified as consumed, excluded, or unsupported. |
| Live consumer coverage | `88.28%` | `761/862`; this is not the final fidelity score. |
| Policy-registered recovered claims | `21/21` within the current policy scope | Limited Classic/menu scope only. |
| Rights resolution | `0%` | No public-distribution approval is registered. |
| Final five-domain fidelity score | `not computed` | Resource scope is frozen; domain units, weighting, Physics2D equivalence, and residual scoring remain open. |

## Five-Domain Metric Status

| Domain | Frozen denominator | Weighting rule | Recovered | Inferred | Unknown | Residuals | Score |
|---|---|---|---:|---:|---:|---|---|
| Visuals / layout / animation | resource scope frozen; contract units pending | not frozen | not frozen | not frozen | not frozen | browser/version matrix and release substitutions remain open | not computable |
| Audio | resource scope frozen; cue units pending | not frozen | not frozen | not frozen | not frozen | release treatment for uncleared audio remains open | not computable |
| Shaders / materials / rendering | resource scope frozen; rendering units pending | not frozen | not frozen | not frozen | not frozen | final rendering-contract units are not frozen | not computable |
| Levels / progression | resource scope frozen; contract units pending | not frozen | not frozen | not frozen | not frozen | final progression-contract units are not frozen | not computable |
| Gameplay / physics / timing / input / state | static contract scope present; parity units pending | not frozen | not frozen | not frozen | not frozen | Physics2D parity gaps remain open | not computable |

The `>=99%` acceptance gate remains open until domain units, weighting, Physics2D parity, and
the residual list are versioned and approved.

## Policy Execution

The current reconstruction policy is intentionally narrow:

- scope: `classic-vertical-slice`
- registered contracts: `9`
- required claims: `21`
- required evidence tier: `1`
- minimum confidence: `0.99`
- inferred treatment: `excluded`
- unknown treatment: `blocks-affected-scope`

This policy validates the recovered contract set that is currently registered. Passing the policy does **not** mean whole-game fidelity has been proven.

## Residual and Uncertainty Ledger

| Category | Item | Status | Notes |
|---|---|---|---|
| Fidelity metric | Domain contract units and weighting | open | The resource corpus is frozen; the cross-domain scoring model is not yet versioned. |
| Unsupported asset | `Fonts/CooperBlackStd.otf` | unsupported | Byte-preserved, not consumed, and not counted as recovered coverage. |
| Metadata projection | Per-entry Creator metadata / UUID projection | pending | Live metadata audit exists, but the versioned per-entry projection is still to be captured. |
| Native parity | Native RNG sequence parity | not claimed | Explicitly not part of the current evidence set. |
| Physics2D | Trajectory / ray / contact / lifecycle equivalence | open | Needs the pinned backend validation path. |
| Bomb electric | Fixture/contact decisions | open | Remains a documented residual in the policy corpus. |
| Safe divergence | TimeManager callback hardening | open | Policy decision `time-manager-callback-hardening` remains unresolved and cannot be labeled recovered behavior. |
| Post-fidelity variant | Reference-counted multi-bomb behavior | open | Policy decision `multi-bomb-reference-counted-variant` remains outside recovered coverage until explicitly reviewed after fidelity closure. |
| Rights | Name, artwork, fonts, audio, code, engine runtime | unresolved | Public release remains blocked. |
| Pages | Public deployment | blocked | No approved production deploy is registered. |
| Browser matrix | Final H5 browser/version/device set | not frozen | The repository does not yet freeze this matrix. |

## Validation Evidence

| Date | Evidence | Result |
|---|---|---|
| 2026-07-24 | `./scripts/build-android-debug.sh` | Android debug build succeeded; the verified evidence records Gradle `3m43s` / `70` tasks, package `io.github.dantech0xff.pencilblade.debug`, min/target/compile SDK `21/36/36`, `arm64-v8a` only, debug signing, `55 MiB`, SHA-256 `1a4d96c71e53572fe86ce7bf73e73990df1a777a8fe33315cd1b9f6fd2705f4d`, and prohibited-runtime audit PASS. |
| 2026-07-24 | Cocos Creator Web Mobile build + audit | Creator build exit `36`; web audit PASS; prefix verifier PASS with `2539` files. |
| 2026-07-24 | Browser smoke on the generated Web Mobile build | All six modes, menu transitions, unlocks, `999999` coins, and particles passed with zero console warnings/errors. |
| 2026-07-25 | Whole-repo tests | Repository checkpoint reports record `182/182` top-level Node tests and `1567/1567` vertical-slice tests, for `1749/1749` total; zero failures, skips, cancellations, or todos. |

The validation evidence above is recorded from the verified Phase 07 corpus. It is not a claim that the public Pages deploy has occurred.

## Independent Decisions

| Decision | Current verdict | Why |
|---|---|---|
| Static fidelity | not computable | Resource scope is frozen; domain units, weighting, and residual scoring are not. |
| Android artifact | verified | The debug build and prohibited-runtime audit passed. |
| Local H5 artifact | verified | The generated Web Mobile build and audit passed. |
| Public Pages deployment | blocked | Rights approval is missing, no Pages site/runner/environment is configured, and the installed Creator bundle fails the workflow's strict signature preflight. |
| Public rights authorization | blocked | The release manifest is still fail-closed. |

## References and Unresolved Questions

- [Compatibility matrix](./compatibility-matrix.md)
- [Release rights checklist](./release-rights-checklist.md)
- [Cocos Creator build audit](./cocos-creator-build-audit.md)
- [Recovered reconstruction manifest](../release/recovered-reconstruction-manifest.json)
- [Public release variant manifest](../release/public-release-variant-manifest.json)

Unresolved questions:

- What contract-unit definitions and weights will govern the five-domain fidelity score?
- What release treatment is authorized for `Fonts/CooperBlackStd.otf`?
- Which browser/version/device rows are frozen for the H5 matrix?
- When, if ever, will the public Pages deploy be approved?

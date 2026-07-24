---
type: explorer
date: 2026-07-24
status: complete-with-concerns
scope: phase-7-documentation-audit
---

# Phase 7 Documentation Deliverables Pre-Implementation Audit

## Summary

At the start of this audit, all four Phase 7 documentation deliverables were absent:

- `docs/reconstruction-report.md`
- `docs/compatibility-matrix.md`
- `docs/release-rights-checklist.md`
- `docs/cocos-creator-build-audit.md`

They have since been created and synchronized in this same Phase 7 checkpoint.
This report preserves the requirements used to produce them; current platform evidence is
recorded in `implementer-2026-07-24-phase7-platform-builds.md`. The repository now documents
the verified Android debug artifact and private Web Mobile artifact, but it still cannot
document a final cross-domain fidelity score, public-release approval, canonical
external-corpus completeness, or successful production Pages deployment.

This audit was static. The source APK, `libgame.so`, reconstructed application,
and generated builds were not executed. No test or build result was invented.

## Authoritative Current State

| Subject | Evidence-backed state |
|---|---|
| Method | Static-only. Original runtime unavailable, unobserved, and never executed. |
| Reconstruction policy | `reference/reconstruction-policy.yaml` version `1.0.3`; scope `classic-vertical-slice`; 9 registered contracts and 21 required claims. It is not the complete five-domain Phase 7 metric. |
| APK-only resource corpus | 862 assets, 32,945,747 bytes; 784 PNG, 59 WAV, 3 MP3, 15 TTF, 1 OTF. Source-tree digest `0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3`. |
| Resource dispositions | 761 consumed, 100 excluded, 1 unsupported, 0 unknown. APK inventory/staging/disposition reconciliation is 100%; live consumer coverage is `761/862` (`88.28%`). Neither value is the Phase 7 fidelity score. |
| External denominator | No Pencil Blade sample-project root or manifest is present. The separately inspected `ac-java-game` workspace is unrelated and must not be merged. |
| Creator metadata | Live metadata audit has zero structural errors and zero duplicate UUIDs, but the staging manifest still records per-entry metadata/UUID status as pending. `Fonts/CooperBlackStd.otf` remains byte-preserved and unsupported. |
| Recovered manifest | `release/recovered-reconstruction-manifest.json` version `1.0.0`; clean-room, non-shipping preservation manifest; rights unresolved and public distribution false. |
| Public Web variant | `release/public-release-variant-manifest.json` version `0.1.0`; release decision blocked; every record `shipReady: false`; no approver, approval date, or rights evidence. |
| Technical platform scope | Android debug APK and Cocos Creator Web Mobile only. Store/AAB, iOS, desktop, mini-game, Harmony/OpenHarmony, and XR outputs are out of scope. |

## `docs/reconstruction-report.md`

Required sections, in order:

1. **Status and scope**
   - As-of date, policy ID/version, recovered-manifest version, evidence mode.
   - State explicitly that this is static reconstruction validation, not an
     original-runtime comparison or a claim of runtime identity.
2. **Authority chain**
   - Link the evidence register, policy, recovered manifest, resource map,
     staging manifest, reconciliation ledger, contracts, fixtures, and tests.
   - Record the APK-only canonical root as local evidence, never as distributable
     content.
   - Record the exact corpus counts, bytes, and hashes from the recovered
     manifest/canonical-corpus report.
3. **Coverage definitions**
   - Keep separate rows for APK inventory, exact-byte staging, disposition
     reconciliation, live consumer coverage, policy-registered recovered claims,
     rights resolution, and final five-domain fidelity.
   - Use `not computed` for the final fidelity score. Do not convert `88.28%`,
     `100%` reconciliation, policy confidence `0.99`, or a test-pass rate into
     fidelity.
4. **Five-domain metric status**
   - Rows for visuals/layout/animation; audio; shaders/materials/rendering;
     levels/progression; gameplay/physics/timing/input/state.
   - Each row needs a frozen denominator, weighting rule, recovered/inferred/
     unknown counts, evidence links, test links, residuals, and score.
   - Until the external denominator and weighting are approved, every row and
     the aggregate remain `not computable`; the `>=99%` acceptance gate remains
     open.
5. **Policy execution**
   - Report the current policy's limited Classic/menu scope: 9 contracts and 21
     claims, recovered-only treatment, minimum confidence `0.99`, inferred
     exclusion, and affected-scope blocking for unknowns.
   - A future whole-product score requires a versioned policy/schema expansion;
     passing the current policy cannot be described as full-game fidelity.
6. **Residual and uncertainty ledger**
   - At minimum: absent sample project, unsupported
     `Fonts/CooperBlackStd.otf`, pending per-entry metadata/UUID projection,
     native RNG sequence parity not claimed, Physics2D trajectory/ray/contact/
     lifecycle equivalence, BombElectric fixture/contact decisions, and every
     other policy `openDecisions` entry.
   - Keep recovered gaps, reviewed inferences, unknowns, technical platform
     adaptations, and release substitutions in separate columns.
7. **Validation evidence**
   - For every command/result, record date, environment/toolchain, exact command,
     pass/fail count, and report/log or artifact digest.
   - Historical Phase 6 Preview evidence may be cited as Preview evidence only.
     It must not be promoted to Android APK, built H5, production Pages, or
     original-runtime evidence.
8. **Independent decisions**
   - Separate verdicts for static fidelity, Android artifact, private H5 artifact,
     public Pages deployment, and public rights authorization.
   - A technical pass must not imply rights approval; a rights approval must not
     imply technical fidelity.
9. **References and unresolved questions**
   - Link the three other Phase 7 docs and both release manifests.

The report must preserve the explicit statement that the verified 862-entry
corpus is complete only for recovered APK resources. Treating it as the final
canonical denominator requires an explicit user decision.

## `docs/compatibility-matrix.md`

Use one row per tested platform/environment combination, not one optimistic row
per platform. Required columns: target, config version, host/toolchain,
OS/browser/device, viewport/design resolution, input, graphics/audio/storage/
offline conditions, build artifact digest, test evidence, deviations, status.

### Fixed target configuration

| Field | Android debug | Web Mobile |
|---|---|---|
| Creator | `3.8.8` | `3.8.8` workflow pin |
| Build config | `game/build-configs/android-debug.json` | `game/build-configs/web-mobile-pages.json` |
| Scene | `db://assets/scenes/classic.scene`, UUID `35e5417d-c3dd-4522-9339-99c81a0b9b4b` | Same |
| Orientation | Portrait only | Portrait |
| Output | `game/build/artifacts/android/pencil-blade-debug.apk` | `game/build/web-mobile-pages/` |
| Distribution | Local/internal debug artifact | GitHub Pages project site, only after rights approval |

Android details that must be copied exactly from the sanitized config:

- package `io.github.dantech0xff.pencilblade.debug`;
- min SDK `21`, target/compile SDK `36`, Build Tools `36.0.0`;
- NDK `28.2.13676358`, CMake `3.22.1`, Gradle `8.11.1`, AGP `8.10.1`;
- Azul Zulu JDK `17.0.15`;
- `arm64-v8a` only, GLES3 only, debug keystore, `appBundle: false`.

Web details that must be copied exactly:

- platform `web-mobile`, production/non-debug build, source maps disabled;
- `720x1280`, `fitWidth: true`, `fitHeight: true`, portrait;
- WebGPU disabled;
- repository prefix `/pencil-blade-2026/`;
- intended URL `https://dantech0xff.github.io/pencil-blade-2026/`.

The matrix must also record:

- the original min-SDK-9 to target min-SDK-21 envelope change;
- compact logical/resource profile `480x800` and high profile `720x1280`,
  while distinguishing historical Creator Preview from built-target validation;
- lifecycle, clean storage, save upgrade/reset, background/foreground,
  orientation rejection, offline behavior, touch input, WebAssembly, WebAudio
  autoplay, MIME, and lazy-load checks;
- browser name/version, OS, physical viewport, device-pixel ratio, and input
  mode for each H5 result.

No final H5 browser/version matrix is frozen in the inspected authorities.
Until explicit rows are tested, built-H5 compatibility and production Pages
compatibility remain pending.

## `docs/release-rights-checklist.md`

Begin with the current fail-closed verdict: **public Web release blocked**.
Mirror, but do not replace, `release/public-release-variant-manifest.json`.

| Record | Category | Current rights state | Current release state |
|---|---|---|---|
| `clean-room-source` | Code | Unreviewed | Not ship-ready |
| `recovered-png-assets` | Graphics, 784 entries | Unresolved | Not ship-ready |
| `recovered-audio-assets` | Audio, 62 entries | Unresolved | Not ship-ready |
| `recovered-font-assets` | Fonts, 16 entries | Unresolved | Not ship-ready |
| `pencil-blade-identity` | Name/trademark, 1 identity | Unresolved | Not ship-ready |
| `cocos-generated-web-runtime` | Engine runtime | Unreviewed | Not ship-ready |

For the overall decision and every included record, require:

- exact included scope and origin;
- `rightsStatus: approved`;
- named license/permission basis;
- at least one safe repository-relative evidence file;
- accountable approver and valid `YYYY-MM-DD` approval date;
- `shipReady: true`;
- explicit treatment of modifications, attribution, notices, trademarks, and
  distribution channel where the evidence requires them.

Document that `scripts/verify-release-rights.mjs` requires all six categories,
valid in-repository non-symlink evidence references, and a separately approved
overall decision. The recovered reconstruction manifest intentionally remains
a non-shipping preservation record even if a distinct public variant is later
approved.

Any omission, replacement, font conversion, asset substitution, or identity
change requires an explicit user decision and a versioned public-variant record.
It cannot increase recovered fidelity. `CooperBlackStd.otf` needs a specific
release treatment; preservation of its bytes is not technical consumption or
rights clearance.

## `docs/cocos-creator-build-audit.md`

Use a gate table with `configured`, `tested`, `built`, `audited`, `published`,
and `blocked` as distinct states. File existence alone is not a passing audit.

### Android audit content

Document the exact sanitized config values from the compatibility matrix, then
record each wrapper gate:

1. resolve repository paths and reject symlink/path escapes;
2. validate Creator `3.8.8`, Azul Zulu JDK `17.0.15`, SDK/API 36, Build Tools
   `36.0.0`, NDK `28.2.13676358`, and CMake `3.22.1`;
3. require Creator program-profile SDK/NDK/JDK agreement without committing
   machine-local paths;
4. classify Creator exit `36` as success and `32`/`34` as failures;
5. validate generated Gradle `8.11.1`, AGP `8.10.1`, package, SDKs, ABI, and
   CMake, then run `:CocosGame:assembleDebug`;
6. require exactly one fresh bounded `*-debug.apk`;
7. run `scripts/audit-creator-build.mjs`;
8. verify package/min/target/ABI/debuggable metadata and Android/Cocos debug
   signing;
9. record final APK path, byte size, SHA-256, signing evidence, audit command,
   result, and timestamp.

The archive audit should be summarized accurately: exact source APK/native
hash rejection, preserved-native fingerprint rejection, unsafe/duplicate ZIP
entry checks, bounded nested-archive expansion, prohibited legacy/decompiler/
bridge references, and an ELF allowlist limited to the pinned Creator
`libcocos.so` path. Although the generic audit accepts AAB input, Phase 7 does
not produce or certify an AAB.

### Web Mobile audit content

Document:

- manual dispatch from `main`;
- protected self-hosted `macOS`/`ARM64`/`cocos-creator-3.8.8` runner;
- Creator version/signature, GNU tar, and Node `22+` preflight;
- reconstruction tests, strict TypeScript, policy tests, and rights gate;
- Creator exit-code handling and exact output root;
- `scripts/audit-web-build.mjs` and
  `scripts/verify-web-mobile-build.mjs`;
- immutable Pages artifact upload and separately permissioned deploy job;
- build-job `contents: read`; deploy-job `pages: write` and
  `id-token: write`; bounded timeouts and serialized deployment.

The Web audit result must state whether it found:

- root `index.html`, bootstrap/application/settings, Cocos engine JavaScript,
  `game` bundle config/script, and Box2D payload;
- any symlink, unsafe path, source map, unexpected executable/native/archive,
  private evidence/development path, machine-local path, legacy runtime/bridge
  reference, off-origin/root-relative/unsafe URL, missing reference, unsupported
  MIME type, or file/size-limit violation;
- HTTP/MIME success for every built and discovered eager/lazy file at exactly
  `/pencil-blade-2026/`, with unrelated/root/traversal routes rejected.

The final status must link immutable logs or reports. The Phase 7 platform checkpoint now
records a fresh Android debug APK and audited private Web Mobile artifact. No evidence proves
an approved public-rights gate, a successful Pages deployment, or production URL
verification; those rows remain pending/blocked until their respective evidence exists.

## Existing Documentation Synchronization

| Document | Required synchronization |
|---|---|
| `docs/codebase-summary.md` | Add both build configs, Android wrapper, Web audit/verifier, release gate/manifests, and Pages workflow. Replace the Android-only `APK/AAB` open gate with Android debug plus Web Mobile; do not list AAB as a Phase 7 deliverable. Update test counts only from a fresh recorded run. |
| `docs/system-architecture.md` | Add the two build/output boundaries, public-rights gate, Pages prefix verification, and split build/deploy jobs. Keep Physics2D, external denominator, OTF, and rights gaps open. |
| `docs/cocos-creator-contract-map.md` | Expand the build row to Android, Web, rights, and workflow owners. Remove stale claims that broader resource reconciliation and objective presentation remain open; the same file already records their completion. Replace “real APK/AAB later” with the exact Phase 7 two-target gate. |
| `docs/project-overview-pdr.md` | State the selected Android-debug and Web-Mobile targets, H5 URL/prefix, and explicit out-of-scope platforms. Add the private-build/public-deploy rights split. Preserve the unresolved denominator and score. |
| `docs/decisions/cocos-creator-architecture.md` | Add Web Mobile and release-manifest architecture beside Android. Replace Android-only Phase 7 blocker wording; preserve backend-equivalence, external-corpus, and rights blockers. |
| `docs/code-standards.md` | Add sanitized build-config, Web-tree audit, prefix verifier, and fail-closed rights rules. Clarify that generic AAB audit support is not Phase 7 AAB scope. |
| `docs/evidence-register.md` | Register the versioned Phase 7 configs/manifests and, only after execution, build/audit/deployment reports and artifact digests. Keep the Java 20 evidence-analysis toolchain distinct from the JDK 17 Android build pin. |
| `docs/static-reconstruction-method.md` | State that policy `1.0.3` covers only the Classic vertical slice and cannot certify the final five-domain metric. Link the final reconstruction report when created. |
| `docs/journals/260722-phase-05-foundation.md` | No rewrite required: it is a dated historical journal. Do not use its then-current “no scene/runtime” statements as Phase 7 status. |

Coverage terminology also needs one consistent glossary. The plan still uses
“consumer coverage” in a completion decision while newer docs distinguish live
consumers from reviewed exclusions/unsupported dispositions. Until that
program decision is reconciled, do not call presentation restoration complete.

## Claims That Must Remain Blocked or Pending

1. Any original-runtime observation, trace parity, empirical identity, or
   `100%` runtime-equivalence claim.
2. Final canonical resource denominator: the external Pencil Blade sample
   project is absent; `ac-java-game` is unrelated.
3. Final five-domain fidelity score and the `>=99%` acceptance gate.
4. Whole-product policy coverage: current policy covers only 9 Classic/menu
   contracts and 21 claims.
5. Per-entry Creator metadata/UUID closure and technical treatment of
   `Fonts/CooperBlackStd.otf`.
6. Pinned Physics2D trajectory, ray traversal, contact direction/count, and
   lifecycle/destruction equivalence.
7. Every unresolved policy decision, including both BombElectric decisions,
   TimeManager callback hardening, and the post-fidelity multi-bomb variant.
8. Artwork, audio, fonts, code, engine-runtime, product-name, and trademark
   public-distribution rights.
9. Any release substitution or omission; none is approved.
10. Public H5 publication, production URL success, or browser-matrix
    compatibility.
11. Android runtime-device compatibility, lifecycle, orientation, storage, and background/
    foreground behavior; the build/package/signature/hash and prohibited-runtime audit are
    already verified independently.
12. Whole-program completion while Phase 1 backup custody remains open.

## Report Conventions

Use the existing plan-scoped report conventions:

- frontmatter with `type`, `date`, `status`, and `scope`;
- H1 title, concise Summary, evidence-backed findings/tables, and Unresolved
  Questions;
- repository-relative links/paths and explicit as-of dates;
- terminal plain-text `Status`, `Summary`, and `Concerns/Blockers` lines.

## Unresolved Questions

- Will the actual Pencil Blade sample project be supplied, or will the user
  explicitly approve the APK-only corpus as the final denominator?
- What versioned weighting rule is approved for the five fidelity domains?
- Who can approve public-distribution rights and supply repository evidence?
- What is the supported H5 browser/version/viewport matrix?
- What release treatment is authorized for `Fonts/CooperBlackStd.otf`?

Status: DONE_WITH_CONCERNS
Summary: Defined evidence-backed content for all four Phase 7 docs, mapped existing-doc synchronization, and isolated claims that must remain fail-closed.
Concerns/Blockers: External denominator, final fidelity metric, backend equivalence, build/deployment evidence, rights clearance, and OTF release treatment remain unresolved.

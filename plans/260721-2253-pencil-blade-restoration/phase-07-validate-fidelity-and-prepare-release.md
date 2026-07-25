---
phase: 7
title: "Validate Static Reconstruction and Prepare Release"
status: completed
priority: P1
dependencies: [6]
effort: "2-4 weeks"
---

# Phase 7: Validate Static Reconstruction and Prepare Release

## Overview

Validate the reconstruction against frozen static evidence, recovered/inferred contracts,
and internal deterministic fixtures. Phase 7 supports exactly two build platforms:

| Platform | Deliverable | Entry point | Distribution |
|----------|-------------|-------------|--------------|
| Android | Debug-signed APK | `./scripts/build-android-debug.sh` | Local/internal artifact |
| Web (H5) | Cocos Creator `web-mobile` build | GitHub Pages workflow | `https://dantech0xff.github.io/pencil-blade-2026/` |

No runnable original application is required. Per-asset legal clearance is outside the
owner-approved academic restoration acceptance scope; this plan makes no legal conclusion.

Out of scope: Android App Bundle/store signing, iOS, macOS, Windows, Linux desktop,
HarmonyOS/OpenHarmony, Web Desktop as a separate build, mini-game channels, and XR targets.

## Current Checkpoint — 2026-07-25

| Decision | Status | Evidence |
|----------|--------|----------|
| Android debug artifact | Technical pass | Fresh debug-signed `arm64-v8a` APK for package `io.github.dantech0xff.pencilblade.debug`; `57,352,687` bytes; SHA-256 `e313e149164eec8664b934a16e3c14b3a0f0265f9c7bb6306375a08a7cb5c37d`; Android 13/API 33 runtime matrix pass |
| Private Web Mobile artifact | Technical pass | Fresh Creator build, prohibited-content audit, exact `/pencil-blade-2026/` prefix verification for 2,539 files, and Chrome `150.0.7871.182` runtime rows at `480x800` and `720x1280`; tree digest `90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54` |
| Public GitHub Pages deployment | Technical pass | Run `30161202889`, attempt `2`, deployed commit `c942ba69283c3725856dfce177fb2268939bfbfd` through `github-pages`; production verification reached `2,539/2,539` files and passed both Chrome rows with zero console/page/request/HTTP failures |
| Canonical resource denominator | Approved | The project owner confirmed the APK is the sole source; the verified `862`-asset corpus and `862/862` disposition ledger are final |
| Final static fidelity decision | Technical pass | Metric `1.1.0` uses minimum-domain scoring with no weighting; every recovered domain is `100.00%`, 12 non-recovered audio/rendering/progression assertions remain disclosed outside scored units, Physics2D equivalence passes, and zero unexplained divergences remain |

The registered reconstruction policy remains a limited Classic/menu claim gate; the separate
five-domain metric covers the full recovered product contract. Neither establishes empirical
identity with an executing original. The canonical local artifact set is bound by
`reports/technical-closeout-manifest.json`; no technical closeout blocker remains.
The current GitHub/runner evidence is recorded in
[`reports/github-infrastructure-2026-07-25.md`](./reports/github-infrastructure-2026-07-25.md).

## Context Links

- [Full reconstruction](./phase-06-recreate-full-game-content-and-progression.md)
- [Static reconstruction corpus](./phase-02-establish-static-reconstruction-corpus.md)
- [Cocos Creator 3.8 command-line build](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)
- [Cocos Creator Android build options](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/android/build-options-android.html)
- [Cocos Creator Web Mobile publishing](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-web.html)
- [GitHub Pages custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Canonical APK corpus decision](../../docs/decisions/apk-corpus-canonical-denominator.md)
- [Phase 7 completion traceability audit](./reports/explorer-2026-07-24-phase7-completion-traceability.md)

## Requirements

### Shared validation and release gates

- Execute the versioned reconstruction policy for visuals, transitions, input, Physics2D,
  score, audio, saves, evidence traceability, and uncertainty coverage.
- Run deterministic reconstruction scenarios at the original logical viewports and on the
  supported Android and H5 target matrix.
- Preserve the separate licensing/ownership ledger without making it an academic acceptance
  gate or a license conclusion.
- Produce recovered-reconstruction and public-release-variant manifests separately.
- Inferred behavior and release substitutions remain visible and never count as recovered coverage.
- Use the approved sole-source APK resource denominator and preserve the existing `862/862`
  disposition ledger. Never add a hypothetical external corpus or adjust the frozen resource
  denominator to hide gaps.
- Compute the versioned cross-domain fidelity metric across visuals/layout/animation, audio,
  shaders/materials/rendering, levels/progression, and gameplay/physics/timing/input/state.
  Reach at least `99%` and list every residual gap without hiding it through weighting.
- Build through the Phase 5 pinned Cocos Creator `3.8.8` toolchain and prove both output trees
  contain no original executable code, compatibility wrapper, emulator layer, preserved APK,
  decompiler output, or private evidence files.

### Android debug APK

- Store a sanitized, versioned Android debug build configuration exported from the Cocos Creator
  Build panel. It must name the production scene explicitly and must not contain SDK/NDK paths,
  credentials, keystores, or other machine-local paths.
- Add one executable POSIX shell entry point, `./scripts/build-android-debug.sh`, that:
  - resolves all repository paths relative to the script and works from any current directory;
  - accepts `COCOS_CREATOR_BIN` as an override and otherwise uses the pinned macOS Creator
    `3.8.8` executable;
  - fails early when Creator, JDK 17, Android SDK/NDK/CMake, or the exported build configuration
    is missing or incompatible, and verifies that Creator's machine-local program profile
    resolves the same validated SDK/NDK paths;
  - generates the native Android project and executes the validated Gradle `assembleDebug`
    path without requiring a device, ADB, or the original APK;
  - treats documented Cocos CLI exit code `36` as success and codes `32`/`34` as failures;
  - searches only the bounded generated output, requires exactly one fresh debug APK, and
    copies it to `game/build/artifacts/android/pencil-blade-debug.apk`;
  - runs the prohibited-runtime audit, verifies debug signing/package metadata, writes SHA-256,
    and prints the final absolute artifact path.
- Use only the Cocos debug signing identity. Release signing, Play Store upload, and AAB output
  are explicitly outside this phase.
- Explicitly choose and record a non-legacy package name plus minimum/target SDK, Build Tools,
  NDK/CMake, Gradle, and ABI values before exporting the build configuration. Do not silently
  reuse recovered package `uit.dev.pencilblade` or inherit floating machine defaults.

### Web Mobile (H5) on GitHub Pages

- Build the same game project with Creator platform `web-mobile`; retain the recovered portrait
  `720x1280` design resolution, explicit production scene, and responsive viewport policy.
- Deploy the complete generated output directory, not selected files, to the project-site prefix
  `/pencil-blade-2026/`. Generated H5 files remain ignored and are never committed to `main`.
- Add `.github/workflows/deploy-web-mobile-pages.yml` using GitHub Pages Actions. The workflow must:
  - begin as manual dispatch from an approved `main` ref; any later automatic trigger requires
    protected `main`;
  - never execute untrusted pull-request code on the self-hosted build runner;
  - build with the pinned Creator `3.8.8` executable on a labeled self-hosted macOS runner;
  - run the reconstruction tests, prohibited-content audit, and prefixed-route smoke test before upload;
  - upload the generated H5 directory as the Pages artifact and deploy through the
    `github-pages` environment;
  - grant only `contents: read` to the build job and `pages: write` plus `id-token: write`
    to the deploy job;
  - serialize Pages deployments and use bounded job timeouts.
- Verify `index.html`, JavaScript, WebAssembly, Box2D payload, the `game` asset bundle, media,
  fonts, and lazy-loaded assets from the actual project-site prefix with no missing or
  root-relative URLs.
- Per-asset rights clearance is not a workflow gate under the owner-approved academic scope.
  The workflow still requires protected `main`, the pinned toolchain, full tests, and build audits.

## Architecture

The reconstruction harness replays versioned input/time/random fixtures in the rebuild,
checks repeatability, and verifies recovered constants, invariants, event ordering, and
contract coverage. It makes no original-runtime comparison claim. Static UI checks use
source geometry, recovered layout rules, and historical media/user review when available.

Two sanitized Build-panel exports under `game/build-configs/` are the only repository-owned
platform build definitions: one for Android debug and one for Web Mobile Pages. Machine-local
Creator External Programs paths remain an explicit toolchain prerequisite, are checked against
the pinned SDK/NDK values, and are never committed or treated as build intent. The Android shell
entry point drives Creator generation and the validated generated Gradle task, normalizes the
APK path, and audits the artifact. It must wrap the Creator process instead of relying on normal
Unix zero-exit semantics because the documented successful Cocos CLI code is `36`.

The Web build runs on a protected self-hosted macOS runner labeled for Creator `3.8.8`; stock
hosted runners are not assumed to contain the editor. The runner preflight verifies the exact
editor version/executable SHA-256 and GNU tar support required by the Pages artifact action. A build
job produces and audits `game/build/web-mobile-pages/`, verifies it under the repository Pages
prefix, and uploads one immutable Pages artifact. A separately permissioned Ubuntu deploy job
consumes that artifact only after the technical gates pass.

Artifact audits verify the Creator build boundary, byte/resource dispositions, and absence of
the legacy runtime. Legal clearance is outside the academic restoration acceptance scope.

## Related Code Files

- Create: `../../game/build-configs/android-debug.json`
- Create: `../../game/build-configs/web-mobile-pages.json`
- Create: `../../scripts/build-android-debug.sh`
- Create: `../../tests/build-android-debug-script.test.mjs`
- Create: `../../scripts/audit-web-build.mjs`
- Create: `../../tests/audit-web-build.test.mjs`
- Create: `../../scripts/verify-web-mobile-build.mjs`
- Create: `../../tests/verify-web-mobile-build.test.mjs`
- Create: `../../.github/workflows/deploy-web-mobile-pages.yml`
- Create: `../../tests/reconstruction/`
- Create: `../../tests/fixtures/reconstruction/`
- Create: `../../docs/reconstruction-report.md`
- Create: `../../docs/compatibility-matrix.md`
- Create: `../../docs/release-rights-checklist.md`
- Create: `../../docs/cocos-creator-build-audit.md`
- Read: `../../reference/reconstruction-policy.yaml`
- Modify only if required by the final audit contract: `../../scripts/audit-creator-build.mjs`

## Implementation Steps

1. Freeze the static evidence set, contract versions, reconstruction fixtures, and unknowns ledger.
2. Lock the two-platform matrix. Record Android package/SDK/ABI values and the H5 browser/viewport
   matrix; reject any additional Creator platform task.
3. Resolve the current Creator bundle-provenance check, then export Android debug and Web Mobile
   build configurations from Creator `3.8.8`; remove machine-local paths and secrets, commit the
   sanitized exports, and prove the CLI can consume them. Document and validate the ignored
   Creator External Programs profile as an environment prerequisite, not repository build state.
4. Implement and test `scripts/build-android-debug.sh`, including preflight failures, quoted paths,
   Creator exit-code handling, ambiguous/missing/stale APK failure, deterministic artifact
   normalization, SHA-256 output, signing/package checks, and the existing APK audit.
5. Run the Android script from a clean generated-build state. Archive only reproducibility
   metadata and the audit report; leave the APK and generated native project ignored.
6. Implement the Web build audit and prefix-aware smoke checker. Build Web Mobile locally and
   serve the generated directory under `/pencil-blade-2026/`; fail on missing, root-relative,
   legacy-runtime, evidence, unsafe, off-origin, or unexpected executable payloads.
7. Add the least-privilege GitHub Pages workflow and configure repository Pages source to
   GitHub Actions. Register/protect the pinned self-hosted macOS runner and `github-pages`
   environment; require the complete technical gate before the deploy job.
8. Trigger the workflow, verify the returned Pages URL and all eager/lazy asset requests, then
   repeat the supported browser/viewport smoke matrix.
9. Use the approved sole-source APK manifest/root and reconciled resource ledger as the frozen
   resource denominator before defining the remaining domain score units and weights.
10. Verify asset bytes/geometry and recovered layout/animation constraints; record human review
    against user memory or historical media as supporting evidence, not recovered runtime proof.
11. Verify spawn/cut/contact/score/failure invariants, repeatable timelines, recovered
    distributions, audio cue selection/order/overlap, and recoverable parameters.
12. Test lifecycle, offline mode, clean install or clean browser storage, save upgrade/reset,
    background/foreground behavior, orientation, and supported Android/H5 targets.
13. Calculate the versioned cross-domain fidelity score, require at least `99%`, and list all
    residual gaps, inferences, unknowns, and release substitutions outside recovered coverage.
14. Record the owner-approved academic waiver for per-asset rights and Cooper treatment;
    retain the separate fail-closed rights manifest for any future commercial clearance.
15. Produce the reconstruction, compatibility, build-audit, rights, recovered-manifest, and
    public-release-variant reports. Record the Android debug artifact and Pages deployment
    independently from the preservation/fidelity decision.

## Testing and Validation

- Run the full deterministic reconstruction, resource-consumer, settings/progression, shell,
  Physics2D, and Creator strict-TypeScript suites already established by Phases 3-6.
- Run focused Node tests for the Android wrapper, web tree audit, and Pages-prefix verifier,
  including spaces in paths, missing tools, Cocos `36` success, `32`/`34` failure, zero/multiple
  APKs, forbidden nested payloads, root-relative H5 URLs, and lazy assets.
- Run `shellcheck scripts/build-android-debug.sh` when available and a real Creator `3.8.8`
  Android generation plus Gradle `assembleDebug` smoke build.
- Validate the APK with the existing Creator artifact audit, Android package metadata, debug
  signature verification, ZIP integrity, ABI/ELF allowlist, and SHA-256 record.
- Serve the H5 output at the exact Pages prefix and assert HTTP success/MIME correctness for
  HTML, scripts, WebAssembly, fonts, images, and audio before deploying.
- Dispatch the Pages workflow from `main`, inspect build/deploy logs, load the production URL,
  exercise every mode and menu transition, and confirm zero console errors or failed requests
  in the supported H5 matrix.
- Run `git diff --check`; prove generated build outputs, logs, SDK paths, keystores, credentials,
  original APK/native code, and evidence directories are absent from the commit and Pages artifact.

## Todo List

- [x] Platform scope locked to Android debug APK and Web Mobile H5 only
- [x] Sanitized Creator `3.8.8` Android/Web build configurations versioned
- [x] Android JDK/SDK/NDK/CMake/Gradle/ABI/package-name pins verified
- [x] One-command Android debug script passes focused tests and real build
- [x] Deterministic Android debug APK produced, signed, hashed, and audited
- [x] Web output audit and Pages-prefix smoke check pass
- [x] Protected Creator `3.8.8` self-hosted runner ready under exact version/binary-hash policy
- [x] Least-privilege GitHub Pages workflow definition added and locally validated
- [x] Repository Pages source and `github-pages` environment configured
- [x] Production Pages URL verified
- [x] Frozen static-evidence and reconstruction-fixture suite
- [x] Sole-source APK manifest/root approved and full resource ledger reconciled
- [x] Versioned cross-domain fidelity score reaches at least `99%` with every residual gap listed
- [x] Contract/traceability, visual, timing, physics, and audio reports
- [x] Android/H5 compatibility matrix completed on API 33 arm64 and pinned Chrome at both supported viewports
- [x] Release-variant exception policy and pending decisions documented separately
- [x] Per-asset rights clearance removed from academic restoration acceptance by owner-approved waiver
- [x] Recovered-reconstruction and public-release-variant manifests separated
- [x] Both output formats pass the prohibited-runtime/evidence audit

## Success Criteria

- [x] Android and Web Mobile H5 are the only supported platform builds; no other platform
      artifact or workflow is introduced
- [x] `./scripts/build-android-debug.sh` produces
      `game/build/artifacts/android/pencil-blade-debug.apk` from a clean generated-build state
      and exits successfully when Creator returns documented success code `36`
- [x] The debug APK has the configured package metadata, a valid debug signature, a recorded
      SHA-256, and no prohibited original runtime/evidence payload
- [x] GitHub Pages serves the audited Web Mobile build at
      `https://dantech0xff.github.io/pencil-blade-2026/` with no broken eager/lazy assets,
      root-prefix errors, or browser console failures in the supported matrix
- [x] The sole-source APK manifest/root is the approved canonical resource denominator and all
      `862` entries have a reviewed consumed/excluded/unsupported disposition
- [x] The versioned cross-domain fidelity score reaches at least `99%`, with every residual
      gap visible rather than hidden through weighting, omission, or substitution
- [x] All recovered contracts pass the current versioned reconstruction policy (limited to
      the registered Classic/menu scope)
- [x] Every inference, unknown, and release exception is reported separately and cannot
      raise recovered coverage
- [x] No unexplained divergence from recovered gameplay, score, physics, progression,
      presentation, or audio contracts remains
- [x] Academic H5 scope and owner-accepted rights waiver recorded without making a license claim
- [x] Release gameplay is traceable to TypeScript/Creator source and both builds contain no
      original executable application logic
- [x] Platform build/deploy results, technical fidelity, and rights authorization are recorded
      as separate decisions

## Risk Assessment

- Cocos Creator CLI uses nonstandard success code `36`; a conventional `set -e` wrapper can
  misreport a successful build unless it captures and classifies the editor result explicitly.
- Creator is not preinstalled on GitHub-hosted runners and its CLI requires a GUI-capable
  environment. Use a protected, pinned self-hosted macOS runner; do not download a floating
  editor version during deployment.
- Android JDK/SDK/NDK/CMake or generated Gradle layout can drift. Fail preflight and require an
  explicit build-config update instead of scanning outside the bounded build directory.
- GitHub project Pages runs below `/pencil-blade-2026/`; root-relative paths can pass local
  testing and fail in production. Test the real prefix and all lazy-loaded resources.
- Browser WebAssembly, WebAudio autoplay, storage, focus, GPU, and MIME behavior varies.
  Pin a supported H5 matrix and record platform-specific deviations without changing game rules.
- Runtime identity cannot be measured without a runnable original. Report maximal recoverable
  fidelity and uncertainty instead of a 100% equivalence claim.
- GitHub Pages is public. The owner-approved academic scope accepts that deployment decision;
  this technical plan does not represent it as legal clearance or a license grant.

## Security Considerations

- Never commit release keystores, passwords, SDK credentials, GitHub tokens, absolute local
  paths, generated APKs, or native build trees. Android uses only debug signing in this phase.
- Do not run untrusted pull-request code on the self-hosted Creator runner. Restrict the workflow
  to protected `main` and manual dispatch, pin action versions, and grant job-level
  least-privilege permissions.
- The Pages artifact must be assembled from the audited Web output root only. Fail on symlinks,
  path traversal, hidden evidence, source APK/native libraries, decompiler output, sourcemaps
  containing private paths, or unexpected executable payloads.
- Keep recovered identifiers, legacy SDKs, private data, obsolete endpoints, analytics, ads,
  review, and social integrations out of both builds.

## Completion

Completed on 2026-07-25. The protected-main workflow, pinned Creator build, tests, artifact
audit, Pages deployment, all-file reachability check, and production browser matrix passed.

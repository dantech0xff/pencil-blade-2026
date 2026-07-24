---
type: explorer
date: 2026-07-24
status: complete-with-concerns
scope: phase-7-completion-traceability
---

# Phase 7 Completion Traceability Audit

## Summary

Phase 7 now supports exactly two technical targets: Android debug APK and Web Mobile H5.
Both local output paths are technically verified, but their new configuration, scripts,
tests, manifests, workflow, docs, and reports are not yet committed.

Public GitHub Pages deployment, public rights authorization, the canonical external
sample-project denominator, the final five-domain fidelity score, Android runtime-device
compatibility, and the frozen H5 browser/device matrix remain separate open gates.

This audit was static and read-only. It did not install or execute the original APK or native
application.

## Classification

| Code | Meaning |
|---|---|
| `VC` | Verified complete in the current repository state |
| `TCU` | Technically complete, but not yet committed/versioned |
| `OEG` | Open evidence gate |
| `OUAG` | Open user or external-authority gate |
| `OOS` | Out of scope by the accepted platform decision |

## Independent Gates

| Gate | Class | Current evidence |
|---|---|---|
| Android debug APK | `TCU` | Clean Creator exit `36`, Gradle `:CocosGame:assembleDebug`, package/signature/ABI checks, prohibited-content audit, and SHA-256 `1a4d96c71e53572fe86ce7bf73e73990df1a777a8fe33315cd1b9f6fd2705f4d` are recorded in `implementer-2026-07-24-phase7-platform-builds.md`. |
| Private Web Mobile artifact | `TCU` | Fresh Creator exit `36`, static Web audit, exact-prefix verification for `2,539` files, and six-mode browser smoke passed. |
| Public GitHub Pages | `OUAG` | Rights remain blocked; the repository has no Pages site, protected Creator runner, or `github-pages` environment. The installed local Creator bundle also fails the workflow's strict signature preflight. |
| Public rights | `OUAG` | All six release records and the overall decision remain unapproved; `scripts/verify-release-rights.mjs` correctly fails closed. |
| Final `>=99%` fidelity | `OUAG` + `OEG` | The external denominator and weighting require approval; Physics2D equivalence and other residual evidence remain open. |

## Requirement Traceability

| Requirement | Class | Trace |
|---|---|---|
| Execute the current reconstruction policy | `VC` | Policy `1.0.3` passes for its registered Classic/menu scope only; it is not a whole-product score. |
| Deterministic target-matrix scenarios | `OEG` | Android runtime-device evidence and a frozen H5 browser/OS/device matrix are absent. |
| Licensing and ownership audit | `OUAG` | The fail-closed checklist and verifier exist, but no public-distribution approval exists. |
| Separate preservation and public-release manifests | `TCU` | Both manifests exist and are tested, but are untracked. |
| Keep inference/substitution outside recovered coverage | `OEG` | The policy enforces this for registered claims; exhaustive whole-product closure remains open. |
| Resolve canonical resource root and denominator | `OUAG` | The APK-only `862/862` ledger is verified. Promoting it to the final denominator requires explicit approval because the external sample project is absent. |
| Compute five-domain score and reach `>=99%` | `OUAG` + `OEG` | The metric remains not computable. |
| Build both outputs with Creator `3.8.8` and audit prohibited content | `TCU` | Local Android and H5 outputs pass; supporting files remain untracked. |
| Sanitized Android build config | `TCU` | `game/build-configs/android-debug.json` contains no machine-local SDK/NDK path, credential, or keystore. |
| One-command Android debug wrapper | `TCU` | CWD independence, overrides, toolchain/profile checks, Creator exit handling, bounded APK discovery, Gradle build, signing/package audit, and hash output are implemented and tested. |
| Debug signing only and no AAB/store flow | `TCU` | Debug signer verified and `appBundle: false`. |
| Explicit package/toolchain/ABI pins | `TCU` | Package, SDK `21/36`, Build Tools, NDK, CMake, Gradle, AGP, JDK, and `arm64-v8a` are recorded. |
| Web Mobile production config at `720x1280` portrait | `TCU` | The sanitized Web config and fresh local build agree. |
| Complete H5 tree at `/pencil-blade-2026/` | `TCU` | All `2,539` files pass the local exact-prefix verifier; production URL proof remains open. |
| Least-privilege Pages workflow definition | `TCU` | Manual `main` dispatch, protected runner labels, pre-upload tests/rights/audits, job-level permissions, timeouts, concurrency, artifact upload, and deploy job are locally tested. |
| Fail-closed publication | `TCU` | The rights gate precedes build/upload and currently exits nonzero. |

## Implementation-Step Status

| Step | Class | Remaining work |
|---:|---|---|
| 1 | `OEG` | The APK evidence set is frozen, but the final reconstruction fixture/denominator freeze is not complete. |
| 2 | `OEG` | The two-platform decision is locked; the final H5 browser/device matrix is not. |
| 3 | `OEG` | Configs are consumed locally but uncommitted; strict Creator signature provenance remains invalid. |
| 4 | `TCU` | Android wrapper implemented, focused-tested, and real-built. |
| 5 | `TCU` | Clean Android build, audit, hash, and ignored output boundary verified. |
| 6 | `TCU` | Web audit, exact-prefix verifier, local build, and smoke pass. |
| 7 | `OUAG` | Workflow definition exists; Pages source/site, runner, environment, rights, and valid signed Creator installation do not. |
| 8 | `OUAG` | Workflow dispatch and production URL/matrix verification have not occurred. |
| 9 | `OUAG` | External canonical sample-project root is absent. |
| 10 | `OEG` | APK bytes/geometry are verified; complete human/historical review and final denominator are open. |
| 11 | `OEG` | Internal suites are broad, but whole-product policy and Physics2D/contact decisions remain open. |
| 12 | `OEG` | Android runtime lifecycle and final H5 browser/offline/audio matrix are not captured. |
| 13 | `OUAG` + `OEG` | Denominator/weighting approval and residual evidence are required before scoring. |
| 14 | `OUAG` | Public rights approval and any omission/replacement decision require external authority. |
| 15 | `TCU` | Required docs, manifests, and technical checkpoint report exist but are uncommitted; Pages remains independently blocked. |

## Platform Scope

The following are `OOS`: Android AAB/release signing/store upload, iOS, macOS, Windows,
Linux desktop, HarmonyOS/OpenHarmony, a separate Web Desktop build, mini-game channels, and XR.
No config, script, or workflow for those targets was introduced.

## Corrective Findings Applied

- Reworded the checked Pages item so it describes a locally validated workflow definition,
  not remote Pages infrastructure.
- Added an explicit unchecked Pages source/environment item.
- Corrected the H5 compatibility row: WebAudio autoplay and offline behavior were not
  independently proven by the recorded smoke.
- Added the two previously omitted policy residuals:
  `time-manager-callback-hardening` and `multi-bomb-reference-counted-variant`.
- Added a fail-closed public-variant exception ledger. There are zero approved exceptions;
  the OTF release treatment remains a pending user decision.
- Clarified that the compatibility document exists while Android runtime and final browser
  rows remain pending.

## Latest Narrow Validation

| Check | Result |
|---|---|
| Release manifest, rights verifier, and Pages workflow tests | `14/14` pass |
| Documentation validation | `11` files; `86` internal links pass |
| Shell entry point | executable; `sh -n` pass |
| New Node scripts | syntax checks pass |
| Git hygiene | `git diff --check` pass |
| Generated output boundary | `game/build/` and `game/native/` ignored; neither is tracked |
| Candidate secret scan | no API key, token, or private-key pattern found |

## Decisions Still Required

1. Approve this technical checkpoint so the formal `ck:cook` tester/reviewer and commit stages
   may run.
2. Supply the canonical Pencil Blade sample project, or explicitly approve the verified
   APK-only `862`-asset corpus as the final resource denominator.
3. Supply accountable public-rights approvals and evidence before GitHub Pages can be enabled.
4. Provide a valid signed Creator `3.8.8` runner installation before the workflow can pass its
   protected-runner preflight.

Status: DONE_WITH_CONCERNS
Summary: Android and local H5 are technically complete but uncommitted; public deployment, rights, canonical denominator, full compatibility evidence, and `>=99%` fidelity remain independently open.
Concerns/Blockers: Human checkpoint approval, rights, Pages infrastructure, valid Creator signature, Android runtime/browser evidence, and the canonical denominator remain open.

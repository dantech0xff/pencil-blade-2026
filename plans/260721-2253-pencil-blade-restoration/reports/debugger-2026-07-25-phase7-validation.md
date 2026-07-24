---
type: debugger
date: 2026-07-25
status: done-with-concerns
scope: phase-07-validation-gate
---

# Phase 07 Validation Debug Gate

## Executive Summary

Checkpoint verdict: PASS for signer-remediation verification.

This report preserves the original Phase 07 P2 signer finding as history, then verifies the current remediation with fresh evidence gathered on Saturday, July 25, 2026. The Android signer gate no longer accepts a spoofed `CN=Android Debug` subject string by name alone; it now requires a trusted debug-keystore SHA-256 certificate fingerprint match and fresh focused tests pass.

I still did not find a rights-gate bypass, a Pages deploy bypass, or a fail-open path around the known Creator signature problem. Public release remains blocked by external gates; those are tracked separately below and do not reopen the remediated signer finding.

## Timeline

- 2026-07-24 checkpoint evidence already in repository claims:
  - local Android debug build PASS;
  - local Web Mobile audit/verifier PASS;
  - public Pages deploy blocked;
  - Creator strict signature invalid on the local machine.
- 2026-07-25 debugger finding preserved in this report:
  - `scripts/build-android-debug.sh` previously accepted `apksigner` output when it only contained the substring `CN=Android Debug`;
  - negative coverage for a spoofed DN was absent at that point.
- 2026-07-25 remediation recheck:
  - `gh repo view --json nameWithOwner,visibility,url` => repo is `PUBLIC`;
  - `gh api repos/dantech0xff/pencil-blade-2026/pages` => HTTP `404`;
  - `gh api repos/dantech0xff/pencil-blade-2026/actions/runners` => `total_count: 0`;
  - `gh api repos/dantech0xff/pencil-blade-2026/environments` => `total_count: 0`;
  - `gh api repos/dantech0xff/pencil-blade-2026/branches/main/protection` => HTTP `404` (`Branch not protected`);
  - `/usr/bin/codesign --verify --deep --strict /Applications/Cocos/Creator/3.8.8/CocosCreator.app` => exit `1`, invalid modified signature.
- 2026-07-25 focused remediation verification:
  - `node --test tests/build-android-debug-script.test.mjs`
    - result: `33/33` PASS in `32380.2825 ms`;
  - `git diff --check`
    - result: PASS.

## Hypotheses Tested

1. The Web Pages-prefix verifier has a product defect.
   - Eliminated.
   - Evidence: the verifier suite passed `21/21` once loopback was allowed; the prior failures were sandbox-only `EPERM`, not assertion failures in the verifier logic.

2. The public-rights gate can be bypassed in the current repository state.
   - Eliminated.
   - Evidence: `scripts/verify-release-rights.mjs` rejected the live manifest with the expected missing approvals and evidence refs; `.github/workflows/deploy-web-mobile-pages.yml` runs the rights gate before build artifact upload and before deploy.

3. The known local Creator signature issue fails open in the workflow.
   - Eliminated.
   - Evidence: `.github/workflows/deploy-web-mobile-pages.yml:35-45` runs strict `codesign --verify --deep --strict` before tests/build; the same command currently fails locally with exit `1`.

4. The Android signer gate still produces a false positive after remediation.
   - Eliminated.
   - Evidence: current script flow and fresh `33/33` focused wrapper-suite pass below.

## Original Finding History

### Historical P2 - Android debug signer validation accepted a spoofed subject DN

- Evidence chain:
  - before remediation, `scripts/build-android-debug.sh` accepted the APK when `apksigner` output contained the substring `CN=Android Debug`;
  - The acceptance check is:
    - preserved in the earlier debugger capture for audit history.
  - Reproducer:
    - `printf 'Signer #1 certificate DN: CN=Android Debug, O=Mallory, C=ZZ\n' | grep -F 'CN=Android Debug' >/dev/null && printf 'signer-check-accepts-spoofed-cn\n'`
    - observed output: `signer-check-accepts-spoofed-cn`
  - Negative coverage is absent:
    - at the time of the original finding, no test asserted rejection for a spoofed DN with the same `CN`.
- Impact:
  - a non-debug or unexpected certificate that reuses the `CN=Android Debug` subject text can be normalized, hashed, and reported as compliant;
  - this weakens the artifact provenance gate described in the Phase 07 Android audit chain.
- Why this is real:
  - the shell condition is purely substring-based; it does not compare the full DN, issuer, or a required signing certificate fingerprint before accepting the artifact.

Status now: remediated and reverified below.

## Remediation Verification - Saturday, July 25, 2026

### Current code path

- Trusted debug-keystore fingerprints are now derived from the expected Gradle and Creator debug keystores before APK acceptance.
  - Evidence:
    - `scripts/build-android-debug.sh:153-184` defines `debug_keystore_sha256()`;
    - `scripts/build-android-debug.sh:694-735` fingerprints the Gradle and Creator debug keystores and fails closed when neither trusted fingerprint can be derived.
- `apksigner` output is now parsed for one signer and one SHA-256 digest for signer `#1`.
  - Evidence:
    - `scripts/build-android-debug.sh:779-826`
- Acceptance now depends on SHA-256 fingerprint equality with a trusted debug keystore, not on the DN text.
  - Evidence:
    - `scripts/build-android-debug.sh:828-832`

### Fresh test evidence

- Focused Android wrapper suite:
  - command: `node --test tests/build-android-debug-script.test.mjs`
  - result: `33/33` PASS, `0` fail, `0` skipped, `32380.2825 ms`
- Remediation-specific cases covered in that passing run:
  - `tests/build-android-debug-script.test.mjs:187-201`
    - Creator debug-keystore fingerprint is accepted.
  - `tests/build-android-debug-script.test.mjs:204-217`
    - spoofed `CN=Android Debug, O=Mallory, C=ZZ` with unexpected SHA-256 digest is rejected.
  - `tests/build-android-debug-script.test.mjs:219-292`
    - missing/malformed signer count and digest cases fail closed.
  - `tests/build-android-debug-script.test.mjs:295-324`
    - missing, symlinked, or malformed trusted-keystore fingerprint inputs fail closed.
- Read-only fingerprint comparison used by the tests:
  - `tests/build-android-debug-script.test.mjs:27-29`
    - trusted Gradle digest fixture: `'11'.repeat(32)`
    - trusted Creator digest fixture: `'22'.repeat(32)`
    - unexpected digest fixture: `'33'.repeat(32)`
  - `tests/build-android-debug-script.test.mjs:1013-1021`
    - `apksignerReport()` still includes the DN string, but the decision path now binds to the SHA-256 digest line.

### Remediation verdict

The original P2 signer finding is resolved in the current repository state. I do not have evidence of a remaining false-positive path in the signer gate after this remediation.

## Non-Defects Confirmed

- Rights gate is fail-closed.
  - Evidence:
    - `scripts/verify-release-rights.mjs:45-50, 85-95, 241-247`
    - `release/public-release-variant-manifest.json:13-18, 32-116`
    - live run of `node scripts/verify-release-rights.mjs --manifest release/public-release-variant-manifest.json --root .` returned `BLOCKED`.

- The known Creator signature issue is correctly fail-closed in workflow code.
  - Evidence:
    - `.github/workflows/deploy-web-mobile-pages.yml:35-45`
    - live `codesign` recheck failed with exit `1`.

- Web-prefix verifier failures seen in the first test run were environmental, not product regressions.
  - Evidence:
    - sandbox run failed with `listen EPERM`;
    - unsandboxed rerun of `tests/verify-web-mobile-build.test.mjs` passed `21/21`.

- Iterable-spread compatibility checks did not reveal a release-tooling contract regression.
  - Evidence:
    - workflow runs `scripts/audit-creator-iterable-spreads.mjs` before the rights/build/upload chain at `.github/workflows/deploy-web-mobile-pages.yml:54-60`;
    - dedicated coverage exists in `tests/audit-creator-iterable-spreads.test.mjs:30-165`;
    - affected runtime files have explicit snapshot-contract assertions, e.g. `tests/reconstruction/vertical-slice/objective-achievement-presenter.test.ts:91-113` and `tests/reconstruction/vertical-slice/time-manager-audio-presenter.test.ts:301-302`.

## Open External Gates

These are real blockers, but I am not counting them as repository-code defects because the current repository state already reports them as open or blocked.

- Public Pages infrastructure is absent.
  - Evidence:
    - Pages API `404`;
    - runners `0`;
    - environments `0`.

- `main` is not protected.
  - Evidence:
    - `gh api repos/dantech0xff/pencil-blade-2026/branches/main/protection` => HTTP `404`.
  - Risk note:
    - if a self-hosted runner is added before branch protection is enabled, `.github/workflows/deploy-web-mobile-pages.yml:15-20` still only checks `refs/heads/main`, not branch-protection state.

- Public rights approval is still absent.
  - Evidence:
    - `release/public-release-variant-manifest.json:13-18, 32-116`
    - `scripts/verify-release-rights.mjs` live run returned `BLOCKED`.

- Creator runner signature prerequisite is still absent on the local installation.
  - Evidence:
    - local strict `codesign` failure above.

## Recommendations

1. Harden Android signer validation in `scripts/build-android-debug.sh`.
   - Require the exact full debug DN and/or an exact certificate SHA-256 fingerprint.
   - Add a negative test that proves a spoofed `CN=Android Debug` subject is rejected.
2. Keep the current rights and Creator-signature gates fail-closed.
   - No relaxation justified by the current evidence.
3. Before any real Pages rollout, provision branch protection before registering a self-hosted runner.
   - Current repo state on 2026-07-25 does not yet satisfy that trust prerequisite.

## Unresolved Questions

- Will the Android signer gate pin an exact DN, an exact fingerprint, or both?
- When the self-hosted runner is eventually registered, will branch protection be enabled first?

Status: DONE_WITH_CONCERNS
Summary: The original Phase 07 P2 signer finding is preserved as history, and fresh Saturday, July 25, 2026 evidence shows the remediation is effective: the Android signer gate now requires a trusted debug-keystore SHA-256 match and the focused `33/33` wrapper suite passes.
Concerns/Blockers: Public rights remain blocked; Pages site, runners, environments, and branch protection are absent; the local Creator 3.8.8 bundle still fails strict signature verification.

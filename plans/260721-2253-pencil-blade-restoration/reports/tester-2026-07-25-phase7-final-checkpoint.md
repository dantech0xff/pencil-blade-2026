---
role: tester
date: 2026-07-25
scope: phase-07-final-checkpoint
status: pass
---

# Phase 07 Final Checkpoint

## Summary

The approved Phase 07 technical checkpoint passes. Full Node test surfaces, Creator bundled strict TypeScript, iterable-spread audit, reconstruction policy positive and negative suites, diff hygiene, shell syntax, executable-bit, JSON parse, docs validation, Android APK audit, web build audit, and exact-prefix verification all pass.

The public release-rights gate remains blocked, so no Pages deployment was executed and no public-release approval is claimed here.

## Post-Remediation

The remediations are covered by the current full suite, not just the focused files.

- `tests/build-android-debug-script.test.mjs` now covers the spoofed-DN, signer-count, signer-digest, and ABI regressions directly:
  - unexpected `Android Debug` DN with a wrong SHA-256 digest is rejected
  - missing signer count is rejected
  - malformed signer count is rejected
  - multiple signers are rejected
  - missing signer digest is rejected
  - malformed signer digest is rejected
  - extra ABI tokens, missing ABI tokens, duplicate ABI lines, and arm64 substring lookalikes are rejected
- `tests/verify-web-mobile-build.test.mjs` now covers the Web ASI / loop-scope regressions and exact-prefix checks directly:
  - indirect off-origin endpoints are rejected across the supported sink families
  - indirect relative sink values stay under the Pages prefix with zero off-origin requests
  - the verifier serves every eager and statically discoverable lazy asset at the exact Pages prefix
- `tests/release-manifests.test.mjs` and `tests/verify-release-rights.test.mjs` cover the pending-exception and approval-date regressions directly:
  - otherwise approved manifests are blocked by a live pending exception
  - approval dates reject impossible Gregorian dates
  - valid leap-day approvals still pass
- The real APK signer check now matches the real Gradle debug keystore with pinned JDK `keytool`:
  - debug keystore owner: `C=US, O=Android, CN=Android Debug`
  - debug keystore SHA-256 fingerprint: `13:27:26:7C:D0:46:ED:32:B9:BB:87:B4:A2:CB:81:0C:E2:0D:DD:26:F3:2A:C0:F9:FB:A3:79:77:0A:DC:34:17`
  - APK signer count: `1`
  - APK signer DN: `C=US, O=Android, CN=Android Debug`
  - APK signer SHA-256 digest: `1327267cd046ed32b9bb87b4a2cb810ce20ddd26f32ac0f9fba379770adc3417`
  - `apksigner` and `jarsigner` both verify the APK as signed and consistent with that debug identity
- The pinned Build Tools `aapt` independently confirms package/version, compile/min/target SDK, `arm64-v8a`, and the debuggable flag on the normalized APK.

## Automated Gates

| Gate | Result |
|---|---:|
| `node --test tests/*.mjs` | `182/182` pass |
| `node --test tests/reconstruction/vertical-slice/*.test.ts` | `1567/1567` pass |
| combined Node total | `1749/1749` pass |
| `node $COCOS_CREATOR_ROOT/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js -p game/tsconfig.json --pretty false --noEmit` | `EXIT:0`; no diagnostics |
| `COCOS_CREATOR_TYPESCRIPT_PATH=$COCOS_CREATOR_ROOT/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js node scripts/audit-creator-iterable-spreads.mjs --project game/tsconfig.json` | `PASS (166 array spreads, 29 call spreads; TypeScript 5.8.2)` |
| `sh tests/reconstruction-policy-test.sh` | `PASS reconstruction policy` |
| `sh tests/reconstruction-policy-negative-test.sh` | `RESULT total=4 pass=4 fail=0` |
| `node $HOME/.claude/scripts/validate-docs.cjs docs/` | `Files Checked: 11`; `88 internal links working` |
| `git diff --check` | `exit 0`; no findings |
| `sh -n scripts/build-android-debug.sh tests/reconstruction-policy-test.sh` | `exit 0` |
| executable-bit check on `scripts/*.sh` | `exit 0` |
| JSON parse check for `game/build-configs/*.json`, `game/native/engine/android/build-cfg.json`, `game/package.json`, `release/public-release-variant-manifest.json` | `PASS 5` |

## Artifact Audits

| Artifact | Command | Result |
|---|---|---|
| Android debug APK | `node scripts/audit-creator-build.mjs game/build/artifacts/android/pencil-blade-debug.apk` | `PASS; 1 signer; SHA-256 digest matches the real Gradle debug keystore` |
| Android debug APK hash | `cat game/build/artifacts/android/pencil-blade-debug.apk.sha256` | `1a4d96c71e53572fe86ce7bf73e73990df1a777a8fe33315cd1b9f6fd2705f4d` |
| Web Mobile build | `node scripts/audit-web-build.mjs game/build/web-mobile-pages` | `PASS` |
| Pages-prefix verifier | `node scripts/verify-web-mobile-build.mjs game/build/web-mobile-pages` | `PASS, 2539 files verified at exact Pages prefix /pencil-blade-2026/` |
| Public release-rights gate | `node scripts/verify-release-rights.mjs --root .` | `BLOCKED; includes releaseExceptions.pending must be empty before public release` |

The Android artifact is the local debug build at `game/build/artifacts/android/pencil-blade-debug.apk`. The web artifact is the private `game/build/web-mobile-pages/` tree. The current evidence does not include a public Pages deployment.

## APK Metadata

Independent safe verification available in this shell:

- `$ANDROID_SDK_ROOT/build-tools/36.0.0/aapt dump badging game/build/artifacts/android/pencil-blade-debug.apk`
  reports package `io.github.dantech0xff.pencilblade.debug`, version `1.0` / code `1`,
  compile/min/target SDK `36/21/36`, `native-code: 'arm64-v8a'`, and
  `application-debuggable`.
- `unzip -Z -1 game/build/artifacts/android/pencil-blade-debug.apk` shows `lib/arm64-v8a/libcocos.so`, so the packaged ABI is `arm64-v8a`.
- `$ANDROID_SDK_ROOT/build-tools/36.0.0/apksigner verify --verbose --print-certs game/build/artifacts/android/pencil-blade-debug.apk` reports `Number of signers: 1` and `Signer #1 certificate SHA-256 digest: 1327267cd046ed32b9bb87b4a2cb810ce20ddd26f32ac0f9fba379770adc3417`.
- `$JAVA_HOME/bin/keytool -list -v -keystore "$HOME/.android/debug.keystore" -alias androiddebugkey -storepass android` reports `Certificate chain length: 1`, owner `C=US, O=Android, CN=Android Debug`, and SHA-256 fingerprint `13:27:26:7C:D0:46:ED:32:B9:BB:87:B4:A2:CB:81:0C:E2:0D:DD:26:F3:2A:C0:F9:FB:A3:79:77:0A:DC:34:17`.
- `jarsigner -verify -verbose -certs game/build/artifacts/android/pencil-blade-debug.apk` reports `CN=Android Debug` and `jar verified`, which independently confirms the debug signer identity and signature integrity.
- The Creator wrapper independently performs the same badging checks before hashing and
  normalizing the artifact.

## Scope Checks

| Criterion | Evidence | Status |
|---|---|---|
| Android technical artifact | build audit, hash, and debug APK present | PASS |
| Local H5 technical artifact | web audit and exact-prefix verifier pass | PASS |
| Public Pages deployment | no deploy command executed; rights gate blocked | NOT PROVEN |
| Public rights | release-rights gate failed closed as expected | BLOCKED |
| Android runtime-device coverage | no device, ADB, or emulator run in this gate | NOT PROVEN |
| Canonical denominator | not recalculated in this checkpoint | NOT PROVEN |
| >=99% fidelity | not computed in this checkpoint | NOT PROVEN |

## Repository Boundary

`game/build/` and `game/native/` are ignored by Git in this worktree. The sanctioned build definitions present in the repository are only:

`game/build-configs/android-debug.json`
`game/build-configs/web-mobile-pages.json`
`.github/workflows/deploy-web-mobile-pages.yml`

## Environment Limitation

An initial non-escalated run of the top-level Node suite hit `listen EPERM: operation not permitted 127.0.0.1` in the web verifier tests. I reran the same loopback-based checks with escalation and they passed. That was sandbox policy, not a code failure.

## Unresolved Questions

- Public Pages deployment remains unexecuted.
- Public release rights remain blocked.
- Android runtime-device coverage is still unproven.
- The canonical denominator and >=99% fidelity claim are still unproven in this checkpoint.

Status: DONE_WITH_CONCERNS
Summary: Full Node test surfaces, strict Creator TypeScript, static audits, and artifact audits passed; the public release-rights gate is still blocked and no Pages deployment was executed.
Concerns/Blockers: Public release approval, Pages deployment, runtime-device coverage, canonical denominator closure, and >=99% fidelity remain open.

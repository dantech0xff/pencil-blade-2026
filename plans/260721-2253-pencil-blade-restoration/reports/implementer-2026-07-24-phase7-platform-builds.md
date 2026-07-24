---
type: implementer
date: 2026-07-24
status: done-with-concerns
scope: Phase 07 Android debug and Web Mobile platform-build checkpoint
evidence_policy: rebuilt artifacts only; original APK and native library were not executed
---

# Phase 07 Platform Build Checkpoint

## Summary

The two Phase 07 platform builds are technically verified:

| Decision | Status | Evidence |
|---|---|---|
| Android debug APK | PASS | Clean wrapper run, Creator exit `36`, Gradle `:CocosGame:assembleDebug` success in `3m43s` with `70` tasks, independently rechecked package/signature/ZIP/ABI/hash, prohibited-runtime audit PASS |
| Local Web Mobile build | PASS | Fresh Creator exit `36`, static audit PASS, exact-prefix verification PASS for `2,539` files, browser smoke across the menu and all six modes |
| Public GitHub Pages deployment | NOT DEPLOYED / BLOCKED | Rights gate blocked; Pages API `404`; zero repository runners; zero repository environments; local Creator bundle fails strict code-signature verification |
| Phase 07 fidelity decision | NOT ESTABLISHED | Platform build success is independent from the unresolved canonical denominator and required cross-domain score |

The GitHub repository was **PUBLIC** when rechecked on 2026-07-24. The earlier
“private repository” premise is stale. Public repository visibility does not
publish the ignored Web output, create a Pages site, or authorize distribution.

## Evidence Boundary

- Build observations came from the real clean Android wrapper run and fresh
  Creator Web build performed on 2026-07-24.
- Artifact metadata and build-tree properties below were rechecked read-only
  with `shasum`, `aapt`, `apksigner`, `unzip`, the repository audits, and the
  Pages-prefix verifier.
- The original APK, original native library, emulator, and original application
  were not installed or executed.
- No Android runtime device was used for this checkpoint.
- The browser smoke record did not freeze browser name/version, OS, device, or
  artifact request log. Those fields remain unclaimed.
- Generated build outputs and artifacts under `game/build/` are ignored through
  `game/.gitignore:9:/build/`; the generated native project under `game/native/`
  is ignored through `game/.gitignore:11:/native/`.
- No `.android-debug-runtime-config.*` or `.android-debug-start.*` file remained
  after the Android run. The generated native project remains under ignored
  `game/native/`; generated build output and normalized artifacts remain under
  ignored `game/build/`.

## Toolchain and Build Contracts

| Component | Verified value | Evidence |
|---|---|---|
| Cocos Creator | `3.8.8` | App `Info.plist`; both sanitized build configurations |
| JDK | Azul Zulu `17.0.15` | `java -version`, `javac -version`, Android wrapper preflight |
| Android SDK | compile/target API `36` | config, generated Gradle properties, APK badging |
| Android Build Tools | `36.0.0` | config, installed `aapt`/`apksigner`, generated properties |
| Android NDK | `28.2.13676358` (`r28c`) | installed `source.properties`, generated properties |
| CMake | `3.22.1` | installed binary and generated application Gradle file |
| Gradle | `8.11.1` | generated wrapper distribution |
| Android Gradle Plugin | `8.10.1` | generated root Gradle build |
| Android ABI | `arm64-v8a` only | config, generated properties, APK badging and ZIP entries |
| Production scene | `db://assets/scenes/classic.scene` / `35e5417d-c3dd-4522-9339-99c81a0b9b4b` | both build configurations |
| Web target | `web-mobile`, portrait, `720x1280`, `fitWidth=true`, `fitHeight=true` | `game/build-configs/web-mobile-pages.json` |
| Pages prefix | `/pencil-blade-2026/` | verifier constant and successful exact-prefix run |

The installed Creator app reports version `3.8.8`, but
`codesign --verify --deep --strict` reports an invalid modified signature for its
`arm64` architecture. The local builds succeeded, but the working-tree
workflow's strict preflight would reject this installation.

## Android Technical Status

### Build result

`./scripts/build-android-debug.sh` completed from a clean generated Android
output:

- Cocos Creator generation returned documented success code `36`;
- generated Gradle task `:CocosGame:assembleDebug` succeeded in `3m43s`;
- the Gradle run reported `70` tasks;
- the wrapper selected one fresh debug APK, audited it, normalized it to
  `game/build/artifacts/android/pencil-blade-debug.apk`, and wrote its sibling
  `.sha256` file.

### Artifact identity

| Property | Verified value |
|---|---|
| Path | `game/build/artifacts/android/pencil-blade-debug.apk` |
| Size | `57,352,366` bytes (`55 MiB` human-readable) |
| SHA-256 | `1a4d96c71e53572fe86ce7bf73e73990df1a777a8fe33315cd1b9f6fd2705f4d` |
| Package | `io.github.dantech0xff.pencilblade.debug` |
| Version | name `1.0`, code `1` |
| SDK | minimum `21`, target `36`, compile `36` |
| Debuggable | yes |
| Native payload | `lib/arm64-v8a/libcocos.so`; no second ABI observed |
| Signer | one signer, `C=US, O=Android, CN=Android Debug` |
| Signature schemes | v1 PASS, v2 PASS; v3/v3.1/v4 absent |
| ZIP integrity | PASS, no compressed-data errors |
| Prohibited-runtime audit | PASS |

`apksigner` also emitted its standard warning that
`META-INF/com/android/build/gradle/app-metadata.properties` is not protected by
the v1 JAR signature. This was not a verification failure: the APK's v2
signature verified successfully. The warning is retained here rather than
hidden.

## Web Mobile Technical Status

### Build and tree result

The fresh Creator Web Mobile build returned documented success code `36` and
produced `game/build/web-mobile-pages/`.

| Property | Verified value |
|---|---|
| Files | `2,539` |
| Total regular-file bytes | `39,613,544` |
| Relative-path plus file-SHA manifest digest | `6eda0466b3540c0de29d6ec7125704c5410fe1564f517e68c09d53028abc863f` |
| Static Web/prohibited-content audit | PASS |
| Exact Pages-prefix verifier | PASS for all `2,539` files at `/pencil-blade-2026/` |
| Public deployment | not performed |

The static audit requires the Creator launcher/settings/game bundle and checks
the tree for prohibited executable archives, native libraries, original-runtime
markers, evidence paths, source maps, private absolute paths, off-origin URLs,
root-relative URLs, unsafe filesystem entries, and missing essential payloads.
The exact-prefix verifier serves the complete immutable tree from loopback and
checks eager and statically discoverable lazy assets, MIME types, file size and
SHA stability, prefix containment, and negative routes.

### Browser smoke

The recorded smoke on the generated Web build passed:

- Main Menu and menu transitions;
- all six production modes;
- unlock flow;
- missing-save `999999` coin state;
- effects/particles;
- zero console warnings and zero console errors.

The `1280x720`, DPR `1` desktop-landscape observation can expose neighboring
Mode Select side cards/rope content. The
[H5 viewport audit](./explorer-2026-07-24-h5-viewport-audit.md) proves this is
expected `ResolutionPolicy.SHOW_ALL` behavior from the full-frame camera and
unmasked six-card rail. It is diagnostic compatibility evidence, not a visual
regression and not support for Web Desktop.

## Command and Result Ledger

Commands are from the repository root unless noted.

| Purpose | Command | Result |
|---|---|---|
| Real Android build | `./scripts/build-android-debug.sh` | Creator exit `36`; `:CocosGame:assembleDebug` success, `3m43s`, `70` tasks |
| APK hash | `shasum -a 256 game/build/artifacts/android/pencil-blade-debug.apk` | matched the sibling `.sha256` file and the digest above |
| APK package/SDK/ABI | `"$ANDROID_SDK_ROOT/build-tools/36.0.0/aapt" dump badging game/build/artifacts/android/pencil-blade-debug.apk` | package/version `io.github.dantech0xff.pencilblade.debug` / `1.0` (`1`); min/target/compile `21/36/36`; `arm64-v8a`; debuggable |
| APK signature | `"$ANDROID_SDK_ROOT/build-tools/36.0.0/apksigner" verify --verbose --print-certs game/build/artifacts/android/pencil-blade-debug.apk` | verifies; one Android Debug signer; v1/v2 true |
| APK ZIP/ELF entry | `unzip -tq game/build/artifacts/android/pencil-blade-debug.apk` and `unzip -Z1 game/build/artifacts/android/pencil-blade-debug.apk \| rg 'libcocos\.so$'` | no ZIP errors; `lib/arm64-v8a/libcocos.so` |
| APK prohibited audit | `node scripts/audit-creator-build.mjs game/build/artifacts/android/pencil-blade-debug.apk` | PASS |
| Fresh Web build | `"$COCOS_CREATOR_BIN" --project "$PWD/game" --build "stage=build;configPath=$PWD/game/build-configs/web-mobile-pages.json;"` | Creator exit `36` |
| Web static audit | `node scripts/audit-web-build.mjs game/build/web-mobile-pages` | PASS |
| Web exact-prefix verification | `node scripts/verify-web-mobile-build.mjs game/build/web-mobile-pages` | PASS; `2,539` files at `/pencil-blade-2026/` |
| Web tree digest | `(cd game/build/web-mobile-pages && find . -type f -print0 \| LC_ALL=C sort -z \| xargs -0 shasum -a 256 \| shasum -a 256)` | `6eda0466b3540c0de29d6ec7125704c5410fe1564f517e68c09d53028abc863f` |
| Focused build/audit/workflow/rights tests | `node --test tests/build-android-debug-script.test.mjs tests/audit-web-build.test.mjs tests/verify-web-mobile-build.test.mjs tests/github-pages-workflow.test.mjs tests/verify-release-rights.test.mjs` | `66/66` pass outside the loopback-restricted sandbox |
| Full repository suite | recorded full-suite run outside the sandbox | `1,642/1,642` pass, `0` fail, `18.39s` |
| Public rights gate | `node scripts/verify-release-rights.mjs --manifest release/public-release-variant-manifest.json --root .` | exit `1`; `Public release rights gate: BLOCKED` |
| Repository visibility | `gh repo view --json nameWithOwner,visibility,url` | `dantech0xff/pencil-blade-2026`, `PUBLIC` |
| Pages site | `gh api repos/dantech0xff/pencil-blade-2026/pages` | HTTP `404`; no Pages site |
| Creator runners | `gh api repos/dantech0xff/pencil-blade-2026/actions/runners` | `total_count: 0` |
| Repository environments | `gh api repos/dantech0xff/pencil-blade-2026/environments` | `total_count: 0` |
| Creator signature | `/usr/bin/codesign --verify --deep --strict /Applications/Cocos/Creator/3.8.8/CocosCreator.app` | exit `1`; invalid modified signature |
| Ignored outputs / temp cleanup | `git check-ignore -v game/native game/build/android-debug game/build/artifacts/android/pencil-blade-debug.apk game/build/web-mobile-pages` plus bounded `find` for Android temp files | outputs ignored; no wrapper runtime config/start marker remained |

The first sandboxed prefix-test attempt failed only because loopback listen was
denied with `EPERM`. The exact verifier and focused suite were rerun with
loopback permission and passed; the sandbox-only failures are not product test
failures.

## Public Deployment Status and Blockers

The Pages workflow exists at
`.github/workflows/deploy-web-mobile-pages.yml` and its focused contract tests
pass. Publication did not occur:

1. `release/public-release-variant-manifest.json` is fail-closed. Its release
   decision and all six category records lack the approvals, dates, licenses,
   ship-ready flags, and rights evidence required by the verifier.
2. GitHub has no Pages site for the repository (`404`), no self-hosted Creator
   runner (`0`), and no `github-pages` environment (`0`).
3. The installed Creator bundle fails the workflow's strict code-signature
   preflight.
4. The repository is public, so publication authorization must not be inferred
   from visibility. The ignored local Web tree still has no successful public
   URL proof.
5. At report generation, the two build configurations, Android wrapper, two Web
   audit/verifier scripts, and Pages workflow were present but untracked in the
   working tree. They must be reviewed and committed before the repository can
   claim versioned reproducibility.

## Warnings and Nonclaims

- Android is a local/internal debug artifact. No release signing, AAB, store
  upload, device install, Android runtime smoke, or supported device floor is
  claimed.
- Web technical verification is local. No Pages artifact upload, deploy job,
  production URL response, CDN behavior, or production request log is claimed.
- The browser smoke does not establish a frozen browser/version/OS/device
  compatibility matrix.
- The Web tree digest identifies this ignored local output; it is not a
  published release digest or rights approval.
- Wide desktop side-card exposure is expected compatibility behavior, not
  supported Web Desktop fidelity.
- Neither build establishes original-runtime identity, dynamic parity with the
  original app, the final canonical resource denominator, or the Phase 07
  `>=99%` cross-domain fidelity score.
- Successful prohibited-content audits do not clear ownership or license rights
  for shipped names, art, audio, fonts, code, or engine runtime.

## Unresolved Questions

- Who will provide accountable approval and repository evidence for every
  public-release rights category?
- Will Creator be restored from a valid signed installation before any
  self-hosted workflow run?
- When will the Pages site, protected Creator runner, and `github-pages`
  environment be provisioned after rights approval?
- Which exact browser/OS/device versions and portrait viewports form the final
  H5 compatibility matrix?
- Which Android devices/API levels will receive runtime validation?
- What approved canonical denominator and weighting will make the five-domain
  fidelity score computable?

## Docs Impact

Checkpoint report only. No code, tests, build configuration, workflow, artifact,
or evergreen documentation was modified in this task.

Status: DONE_WITH_CONCERNS
Summary: Android debug and local Web Mobile builds are technically verified; public Pages deployment, rights authorization, and the Phase 07 fidelity decision remain separate and incomplete.
Concerns/Blockers: Rights gate blocked; no Pages site, runner, or environment; Creator strict code signature invalid; platform build files still untracked at report generation.

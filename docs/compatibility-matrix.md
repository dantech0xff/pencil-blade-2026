# Compatibility Matrix

## Scope

This matrix records the supported Phase 07 build targets and the current compatibility-only or blocked states. It is intentionally fail-closed: a row is only presented as verified when the repository has evidence for that environment.

## Fixed Target Configuration

| Field | Android debug | Web Mobile |
|---|---|---|
| Creator | `3.8.8` | `3.8.8` |
| Build config | [`game/build-configs/android-debug.json`](../game/build-configs/android-debug.json) | [`game/build-configs/web-mobile-pages.json`](../game/build-configs/web-mobile-pages.json) |
| Scene | `db://assets/scenes/classic.scene` | `db://assets/scenes/classic.scene` |
| Scene UUID | `35e5417d-c3dd-4522-9339-99c81a0b9b4b` | `35e5417d-c3dd-4522-9339-99c81a0b9b4b` |
| Orientation | Portrait only | Portrait |
| Package / route | `io.github.dantech0xff.pencilblade.debug` | `/pencil-blade-2026/` |
| Output | `game/build/artifacts/android/pencil-blade-debug.apk` | `game/build/web-mobile-pages/` |
| Distribution | Local/internal debug artifact | GitHub Pages project site, but only after rights approval |

Android configuration pins from the sanitized build export:

- package `io.github.dantech0xff.pencilblade.debug`
- min SDK `21`
- target SDK `36`
- compile SDK `36`
- Build Tools `36.0.0`
- NDK `28.2.13676358`
- CMake `3.22.1`
- Gradle `8.11.1`
- AGP `8.10.1`
- JDK `17.0.15` from Azul Zulu
- ABI `arm64-v8a` only
- GLES3 only
- debug keystore enabled
- `appBundle: false`

Web Mobile configuration pins from the sanitized build export:

- platform `web-mobile`
- debug `false`
- source maps disabled
- design resolution `720x1280`
- `fitWidth: true`
- `fitHeight: true`
- portrait orientation
- WebGPU disabled
- repository prefix `/pencil-blade-2026/`
- intended URL `https://dantech0xff.github.io/pencil-blade-2026/`

## Verified Rows

| Target | Config version | Host / toolchain | OS / browser / device | Viewport / design resolution | Input | Graphics / audio / storage / offline | Artifact digest | Test evidence | Deviations | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Android debug build | `game/build-configs/android-debug.json` | Creator `3.8.8`, JDK `17.0.15`, SDK `36`, NDK `28.2.13676358`, Build Tools `36.0.0`, Gradle `8.11.1`, AGP `8.10.1` | Build host only; no runtime device recorded | Portrait; `720x1280` scene config | N/A for build-only validation | `arm64-v8a`, GLES3, debug signing, local storage not exercised | `1a4d96c71e53572fe86ce7bf73e73990df1a777a8fe33315cd1b9f6fd2705f4d` | `./scripts/build-android-debug.sh` succeeded; prohibited-runtime audit PASS; signer digest matched a trusted debug keystore and the native-code metadata was the singleton `arm64-v8a` | Runtime device/browser evidence not part of this build check | Verified build gate |
| Web Mobile local artifact | `game/build-configs/web-mobile-pages.json` | Creator `3.8.8`, audited build tree, `scripts/audit-web-build.mjs`, `scripts/verify-web-mobile-build.mjs` | Browser/version not captured in the supplied evidence | `720x1280` design; portrait | Pointer/touch smoke and browser navigation | WebGL rendering and unlock/save-state flow observed; WebAudio autoplay and offline behavior were not separately verified | tree digest `6eda0466b3540c0de29d6ec7125704c5410fe1564f517e68c09d53028abc863f` | Creator exit `36`; audit PASS; prefix verifier PASS `2539` files; browser smoke all six modes/menu/unlocks/`999999` coins/particles passed | Browser/version/OS pair not frozen | Verified local artifact |
| H5 landscape diagnostic | `game/build-configs/web-mobile-pages.json` | Same as above | Desktop landscape observation, browser/version not captured | `1280x720`, DPR `1` | Pointer/drag smoke | No console warnings/errors; wide-viewport exposure expected | not recorded in supplied evidence | [`plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-h5-viewport-audit.md`](../plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-h5-viewport-audit.md) | This is compatibility-only, not supported Web Desktop | Compatibility-only |
| Canonical compact H5 geometry | `game/build-configs/web-mobile-pages.json` | Desktop harness, browser/version not captured | Browser/version not captured | `480x800`, DPR `1`, portrait | Pointer/touch smoke | Static-layout fidelity gate; no off-design margins | not recorded in supplied evidence | The viewport audit defines this as a canonical row, but the repository does not freeze a browser/version pair yet | Final browser matrix not frozen | Pending explicit row capture |
| Canonical high H5 geometry | `game/build-configs/web-mobile-pages.json` | Desktop harness, browser/version not captured | Browser/version not captured | `720x1280`, DPR `1`, portrait | Pointer/touch smoke | Static-layout fidelity gate; no off-design margins | not recorded in supplied evidence | The viewport audit defines this as a canonical row, but the repository does not freeze a browser/version pair yet | Final browser matrix not frozen | Pending explicit row capture |
| Android release device matrix | not applicable | not applicable | Supported device/browser floor not frozen | not frozen | not frozen | not frozen | not recorded | Not yet captured in the repository | Physical device/browser floor remains unresolved | Pending |

## Notes

- The matrix deliberately keeps the browser name/version open where the supplied evidence did not record it.
- The Web Mobile local artifact is verified as a build-and-audit result, not as a public Pages deployment.
- The landscape diagnostic row is useful evidence for wide-viewport behavior, but Phase 7 does not treat it as a supported Web Desktop target.
- The compact and high canonical rows remain the two static-layout gates defined by the viewport audit; they are not yet frozen to a specific browser/version pair in the repository evidence.
- The latest repository checkpoint reports `182/182` top-level tests, `1567/1567` vertical-slice tests, and `1749/1749` total, while the build gates remain separate from runtime-device proof.

## Unfrozen Fields

| Field | Current state |
|---|---|
| Browser name/version for the H5 matrix | not frozen in the inspected authorities |
| OS for the H5 matrix | not frozen in the inspected authorities |
| Device-pixel ratio for all verified browser rows | only the canonical `1` rows are currently defined |
| Artifact digest for the Web Mobile private build | relative-path plus per-file SHA-256 manifest digest `6eda0466b3540c0de29d6ec7125704c5410fe1564f517e68c09d53028abc863f`; `2539` files and `39,613,544` file bytes |
| Production Pages URL proof | blocked pending rights approval |

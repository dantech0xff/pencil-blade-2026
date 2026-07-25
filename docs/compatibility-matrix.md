# Compatibility Matrix

## Supported targets

Phase 07 supports exactly two deliverables: an internal Android arm64 debug APK and a Web
Mobile build. Public Web distribution remains a separate rights/operations gate.

| Field | Android debug | Web Mobile |
|---|---|---|
| Creator | `3.8.8` | `3.8.8` |
| Build config | [`game/build-configs/android-debug.json`](../game/build-configs/android-debug.json) | [`game/build-configs/web-mobile-pages.json`](../game/build-configs/web-mobile-pages.json) |
| Scene | `db://assets/scenes/classic.scene` | `db://assets/scenes/classic.scene` |
| Orientation | Portrait only | Portrait |
| Package / route | `io.github.dantech0xff.pencilblade.debug` | `/pencil-blade-2026/` |
| Distribution | Local/internal artifact | Private local artifact; GitHub Pages only after rights approval |

Android build pins: min SDK `21`, target/compile SDK `36`, Build Tools `36.0.0`,
NDK `28.2.13676358`, CMake `3.22.1`, Gradle `8.11.1`, AGP `8.10.1`, JDK `17.0.15`,
ABI `arm64-v8a`, GLES3, debug signing, and no app bundle.

Web build pins: production Web Mobile, no source maps, `720x1280` design, fit width/height,
portrait, WebGPU disabled, and exact project prefix `/pencil-blade-2026/`.

## Verified runtime rows

| Target | Runtime | Viewport/device | Input | Audio | Storage/lifecycle | Orientation/offline | Artifact | Status |
|---|---|---|---|---|---|---|---|---|
| Android debug | Android 13 / API 33, `sdk_gphone64_arm64`, `arm64-v8a` emulator | `1080x2340`, portrait | Main Menu → Mode Select → Classic gestures plus gameplay swipe | `USAGE_GAME` audio focus | `jsb.sqlite` created; same-process HOME/HOT resume | Landscape request remained portrait; cold-start passed with airplane mode, Wi-Fi, and data disabled and zero validated networks | APK SHA-256 `e313e149164eec8664b934a16e3c14b3a0f0265f9c7bb6306375a08a7cb5c37d` | Pass |
| H5 compact | Google Chrome `150.0.7871.182` | `480x800`, DPR `1`, touch/mobile context | Main Menu → Mode Select → Classic gestures | WebAudio backend created/running without autoplay override | localStorage probe retained across background/foreground and removed after test | Landscape diagnostic and portrait restore passed; post-load offline gameplay passed | Web tree SHA-256 `90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54` | Pass |
| H5 high | Google Chrome `150.0.7871.182` | `720x1280`, DPR `1`, touch/mobile context | Main Menu → Mode Select → Classic gestures | WebAudio backend created/running without autoplay override | localStorage probe retained across background/foreground and removed after test | Landscape diagnostic and portrait restore passed; post-load offline gameplay passed | Same audited Web tree | Pass |

The Web tree contains 2,539 files and 39,613,694 file bytes. Static audit and loopback
verification reached every eager/lazy build file under the exact Pages prefix with no request
outside the prefix. Both browser rows recorded zero console errors, page errors, or request
failures.

Evidence:

- [`android-runtime-matrix.json`](../plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json)
- [`h5-runtime-matrix.json`](../plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json)
- [`physics2d-backend-equivalence.json`](../forensics/runtime/physics2d-backend-equivalence.json)

## Declared compatibility divergences

- Creator 3.8.8 raises Android min SDK from the original `9` to `21`.
- The reconstruction uses GLES3 rather than the original manifest's OpenGL ES 2.0 declaration.
- The internal package name intentionally differs from retired `uit.dev.pencilblade`.
- H5 offline coverage proves already-loaded gameplay requires no network. Offline first-load is
  not claimed because the static site has no service-worker/offline-install contract.
- Android evidence is from the allowed arm64 emulator path, not a physical device.

These divergences are explicit in the residual ledger and cannot raise recovered fidelity.

# Cocos Creator Build Audit

## Gate States

File existence alone is not a passing audit. The build and release paths are only valid when the configured, tested, built, audited, published, and blocked states are all understood separately.

| State | Android debug | Web Mobile |
|---|---|---|
| configured | yes | yes |
| tested | yes | yes, locally; workflow dispatch not run |
| built | yes | yes |
| audited | yes | yes |
| published | no | no |
| blocked | no | yes, pending rights approval for Pages deployment |

## Android Audit

### Configured values

| Field | Value |
|---|---|
| Creator | `3.8.8` |
| Scene | `db://assets/scenes/classic.scene` |
| Scene UUID | `35e5417d-c3dd-4522-9339-99c81a0b9b4b` |
| Package | `io.github.dantech0xff.pencilblade.debug` |
| Min SDK | `21` |
| Target SDK | `36` |
| Compile SDK | `36` |
| Build Tools | `36.0.0` |
| NDK | `28.2.13676358` |
| CMake | `3.22.1` |
| Gradle | `8.11.1` |
| AGP | `8.10.1` |
| JDK | Azul Zulu `17.0.15` |
| ABI | `arm64-v8a` only |
| Rendering | GLES3 only |
| Signing | debug keystore |
| App bundle | `false` |

### Audit chain

1. Resolve repository paths relative to the script and reject symlink/path escapes.
2. Validate Creator `3.8.8`, Azul Zulu JDK `17.0.15`, SDK/API `36`, Build Tools `36.0.0`, NDK `28.2.13676358`, and CMake `3.22.1`.
3. Require Creator program-profile SDK/NDK/JDK agreement without committing machine-local paths.
4. Treat Creator exit code `36` as success and `32` / `34` as failures.
5. Validate the generated Gradle `8.11.1` / AGP `8.10.1` project, then run `:CocosGame:assembleDebug`.
6. Require exactly one fresh bounded `*-debug.apk`.
7. Run [`scripts/audit-creator-build.mjs`](../scripts/audit-creator-build.mjs).
8. Verify package, min/target SDK, exact singleton ABI, and debug signing metadata, including the trusted debug-keystore certificate digest.
9. Record the final APK path, byte size, and SHA-256.

### Verified Android result

| Item | Value |
|---|---|
| Build script | [`scripts/build-android-debug.sh`](../scripts/build-android-debug.sh) |
| Result | success |
| Gradle duration / tasks | `3m43s` / `70` tasks |
| Package | `io.github.dantech0xff.pencilblade.debug` |
| SDK pins | `21 / 36 / 36` |
| ABI | `arm64-v8a` only |
| Signing | Android Debug signer, v1 / v2, trusted debug-keystore SHA-256 match |
| Artifact size | `55 MiB` |
| Artifact SHA-256 | `1a4d96c71e53572fe86ce7bf73e73990df1a777a8fe33315cd1b9f6fd2705f4d` |
| Prohibited-runtime audit | PASS |

### Android audit result

- configured: pass
- tested: pass
- built: pass
- audited: pass
- published: not applicable
- blocked: no

## Web Mobile Audit

### Configured values

| Field | Value |
|---|---|
| Creator | `3.8.8` |
| Platform | `web-mobile` |
| Design resolution | `720x1280` |
| Orientation | portrait |
| Fit width / height | `true / true` |
| WebGPU | disabled |
| Source maps | disabled |
| Repository prefix | `/pencil-blade-2026/` |
| Intended URL | `https://dantech0xff.github.io/pencil-blade-2026/` |

### Audit chain

1. Dispatch manually from `main`.
2. Run on a protected self-hosted macOS ARM64 runner labeled for Creator `3.8.8`.
3. Verify Creator version/signature, GNU tar availability, and Node `22+`.
4. Run reconstruction tests, strict TypeScript, policy tests, and the rights gate.
5. Build the Web Mobile tree with Creator `3.8.8`.
6. Audit the generated tree with [`scripts/audit-web-build.mjs`](../scripts/audit-web-build.mjs).
7. Verify the prefix routing and asset serving with [`scripts/verify-web-mobile-build.mjs`](../scripts/verify-web-mobile-build.mjs).
8. Upload the generated H5 directory as an immutable Pages artifact.
9. Deploy only through the `github-pages` environment with the deploy job permissions separated from the build job.

### Verified Web result

| Item | Value |
|---|---|
| Workflow | [`.github/workflows/deploy-web-mobile-pages.yml`](../.github/workflows/deploy-web-mobile-pages.yml) |
| Creator exit | `36` |
| Web build audit | PASS |
| Prefix verifier | PASS, `2539` files |
| Output tree | `39,613,544` file bytes; relative-path plus per-file SHA-256 manifest digest `6eda0466b3540c0de29d6ec7125704c5410fe1564f517e68c09d53028abc863f` |
| Browser smoke | all six modes, menu transitions, unlocks, `999999` coins, particles |
| Console status | zero warnings / errors |
| Public Pages deployment | not executed |

### Web audit result

- configured: pass
- tested: pass
- built: pass
- audited: pass
- published: blocked
- blocked: yes, pending public-rights approval

### GitHub deployment prerequisites

Read-only GitHub verification on 2026-07-24 found a public `main` repository, no configured
Pages site (`404` from the Pages API), zero Actions runners, and zero environments. The local
Creator `3.8.8` application also fails strict macOS code-signature validation, while the
workflow intentionally requires that preflight to pass. These infrastructure failures remain
independent of the public-rights blocker.

## Current Audit Boundary

The repository currently proves:

- a clean Android debug build with exact signer and singleton-ABI verification
- a clean local Web Mobile build
- a successful web tree audit and prefix verifier
- a fail-closed public release gate
- whole-repository checkpoint reports at `1749/1749`

The repository does **not** yet prove:

- public Pages deployment
- final production URL verification
- a frozen browser/version/device matrix
- approval to publish uncleared art, audio, fonts, code, identity, or engine runtime
- a protected labeled Creator runner, `github-pages` environment, and valid Creator bundle signature

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
| blocked | no | yes, pending Pages configuration and production deployment |

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
| Artifact size | `57,352,687` bytes |
| Artifact SHA-256 | `e313e149164eec8664b934a16e3c14b3a0f0265f9c7bb6306375a08a7cb5c37d` |
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
3. Verify Creator version/executable SHA-256, GNU tar availability, and Node `22+`.
4. Run reconstruction tests, strict TypeScript, and policy tests.
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
| Output tree | `39,613,694` file bytes; relative-path, size, and per-file SHA-256 tree digest `90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54` |
| Browser smoke | pinned Chrome `150.0.7871.182` at `480x800` and `720x1280`; Main Menu → Mode Select → Classic, input, audio, storage, lifecycle, orientation, and post-load offline checks |
| Console status | zero page errors / request failures |
| Public Pages deployment | not executed |

### Web audit result

- configured: pass
- tested: pass
- built: pass
- audited: pass
- published: pending
- blocked: yes, pending Pages configuration and production deployment

### GitHub deployment prerequisites

GitHub verification on 2026-07-25 confirms protected `main` and one repository-scoped Actions
runner version `2.336.0` with labels `self-hosted`, `macOS`, `ARM64`, and
`cocos-creator-3.8.8`. The runner was online at the captured API checkpoint; its service is
installed and active, and a later broker incident required a listener restart. The local
listener recovered; after transient GitHub `502`/`504` responses, a final REST read reconfirmed
the runner online and idle. The repository still has no
configured Pages site (`404` from the Pages API) and zero environments. Cocos Dashboard `2.2.1`
reinstalled Creator `3.8.8` from its official catalog. The workflow pins that reviewed
executable by version and SHA-256
`3a8452496c03e85f2784e64679a1fd203701b0b245125efee02c7923f2bd3464`.
The remaining gate is the deliberately absent Pages environment/deployment. See the
[GitHub infrastructure checkpoint](../plans/260721-2253-pencil-blade-restoration/reports/github-infrastructure-2026-07-25.md).

## Current Audit Boundary

The repository currently proves:

- a clean Android debug build with exact signer and singleton-ABI verification
- a clean local Web Mobile build
- a successful web tree audit and prefix verifier
- an owner-recorded academic deployment scope with no legal-rights conclusion
- Node-suite checkpoint reports at `1760/1760`
- a frozen Chrome `150.0.7871.182` matrix at `480x800` and `720x1280`
- an Android 13/API 33 arm64 emulator runtime row

The repository does **not** yet prove:

- public Pages deployment
- final production URL verification
- a configured `github-pages` environment and production deployment

# Cocos Creator Target

## Verified Baseline

Verified against official Cocos sources on 2026-07-21 and rechecked on 2026-07-22:

- Latest stable download: Cocos Creator 3.8.8, released 2025-12-16.
- Supported documentation line: Cocos Creator 3.8 LTS.
- Scripting target: TypeScript classes and script components mounted to scene nodes.
- Android support for Creator 3.6+: minimum API 21; selectable ABIs include
  `armeabi-v7a`, `arm64-v8a`, `x86`, and `x86_64`.
- Creator 3.x is a rewritten engine line, not a source-compatible continuation of
  Cocos2d-x. The restoration therefore requires behavior translation, not project upgrade.

Official references:

- [Creator download and release notes](https://www.cocos.com/creator-download)
- [Creator 3.8 LTS manual](https://docs.cocos.com/creator/3.8/manual/en/)
- [Creator scripting](https://docs.cocos.com/creator/3.8/manual/en/scripting/index.html)
- [Android build options](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/android/build-options-android.html)
- [Supported system versions](https://docs.cocos.com/creator/3.8/manual/en/advanced-topics/supported-versions.html)

## Version Policy

At Phase 5 start, check the official stable channel once. If 3.8.8 is still current,
pin it. If a newer stable release exists, update this record and validate its Android,
2D rendering, audio, physics, serialization, and build requirements before scaffolding.
Record editor build, engine tag/commit, installer hash/source, JDK, SDK, NDK, Gradle/AGP,
render backend, and ABIs. Do not upgrade during reconstruction work without a migration
decision and a full contract/reconstruction-suite rerun.

The 2026-07-22 official download page still lists 3.8.8 as the latest stable release. A local
3.8.8 bundle exists, but strict signature verification currently fails; installation trust
must be repaired or explicitly resolved before the editor is executed. See the
[Creator readiness audit](../reports/creator-readiness-2026-07-22.md).

## Fixed Implementation Boundary

- Production project lives under `game/` and is created by the pinned Creator editor.
- Application behavior is new TypeScript organized as deterministic domain modules and
  Creator components; presentation uses Creator scenes, nodes, prefabs, and imported assets.
- The Creator engine's supported native runtime is allowed as engine infrastructure.
  Original `libgame.so`, Cocos2d-x 2.1.4 application code/runtime, JNI/JSB gameplay bridges,
  APK execution, and emulation layers are forbidden production dependencies.
- APK resources are extracted losslessly, cataloged, and copied into Creator through a
  manifest; the immutable evidence copy and decompiler outputs remain outside `game/`.
- Primary target is Android. API 21+ is an explicit platform compatibility change forced
  by the latest Creator line and does not relax gameplay, visual, audio, or timing fidelity.

## Translation Map

| Recovered source concept | Cocos Creator destination |
|---|---|
| Cocos2d-x scene/layer graph | Creator scenes, nodes, prefabs, and components |
| Native update/state managers | Explicit-clock TypeScript domain services; any fixed-step adaptation is a reviewed Creator compatibility strategy |
| Cocos2d-x actions/scheduler | Explicit clock plus measured Creator animation/tween adapters |
| Box2D toss/collision behavior | Creator Physics2D adapter configured by recovered contracts |
| Touch/blade ray casting | Creator input adapter feeding replayable domain input |
| UserDefault/save keys | Versioned TypeScript storage adapter and save fixtures |
| PNG/audio/font paths | Cataloged SpriteFrame, AudioClip, and Font assets |
| Java ads/social/review bridges | Excluded from gameplay; optional new platform adapters only if approved |

## Unresolved Questions

None for engine selection. Original-runtime execution is unavailable and is not a gate.
Public-release rights remain a separate release decision.

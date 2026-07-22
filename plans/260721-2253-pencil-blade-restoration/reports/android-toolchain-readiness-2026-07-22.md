# Android Toolchain Readiness — 2026-07-22

## Status

Installed inventory is broad but unpinned. This was read-only; Creator, Gradle builds, SDK
installation, and Android targets were not launched or changed.

## Editor and Engine Pin Candidates

- Cocos Creator/editor version: 3.8.8.
- Engine commit: `411f98df047c25902f93440d4b22925c2fb65461`.
- Editor commit: `00b05c9338d59ca4f58792ed65ac37b45b8b4fa7`.
- Dashboard profile source:
  `https://download.cocos.com/CocosCreator/v3.8.8/CocosCreator-v3.8.8-mac-121518.zip`.
- The installed bundle still fails strict signature verification; these are inventory facts,
  not an execution approval.

## Java

- Active system selection: Oracle OpenJDK/Javac 20.0.1 arm64.
- Available JDK 17 candidates:
  - Azul 17.0.15.
  - JetBrains Runtime 17.0.14.
- Creator's local Android template uses AGP 8.10.1 and Gradle 8.11.1. Pin a tested JDK 17
  candidate before building instead of inheriting the current unrecorded JDK 20 selection.

## Android SDK Inventory

- SDK path: `/Users/dan/Library/Android/sdk`.
- Environment variables `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `NDK_HOME`, and
  `ANDROID_NDK_HOME` are unset.
- Platform tools: 37.0.0; adb 1.0.41.
- Command-line tools: 22.0; `sdkmanager` is not on `PATH`.
- Build Tools: 28.0.2 through 36.1.0, including 35.0.1 and 36.1.0.
- Stable Android platforms with `android.jar`: API 23 through 36, plus newer preview/extension
  platforms. API 21 is not installed, but minSdk 21 does not require compiling against 21.
- Installed NDKs: 21.4.7075529, 25.2.9519653, 27.0.12077973, 28.2.13676358.
- SDK CMake: 3.22.1 and 4.1.2. CMake 3.22.1 is the conservative candidate pending Creator
  build validation.

## Gradle and Native Build

- Creator template: AGP 8.10.1, Gradle wrapper 8.11.1.
- Template properties still need exact values for NDK, Build Tools, compile/target/min SDK,
  and ABI list.
- The Gradle distribution may require network/cache setup on first build.
- Homebrew Gradle is unhealthy on this arm64 host (`libnative-platform.dylib` load failure);
  use and validate the Creator wrapper rather than relying on it.
- Homebrew CMake 4.2.0 and Ninja 1.13.2 exist, but neither is selected for the project.

## Required Pin Before Phase 5 Build

1. trusted/repaired Creator bundle and exact `game/` root reopen;
2. JDK 17 distribution/path;
3. Android SDK path;
4. compile SDK, target SDK, min SDK 21, and Build Tools;
5. Creator-compatible NDK and CMake version;
6. Android ABI set;
7. cached/verified Gradle 8.11.1 wrapper distribution.

## Unresolved Questions

- Which installed NDK/CMake pair is officially compatible with this exact Creator build?
- Which compile/target SDK and ABI matrix should be the initial project pin?
- Is Gradle 8.11.1 already cached and usable without modifying the environment?
- Has the `game/` foundation been imported from the correct editor root yet, or should it be
  recreated from a clean reopen before build validation?

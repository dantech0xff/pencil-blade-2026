# Pencil Blade Restoration: Product Development Requirements

## Purpose

Reconstruct Pencil Blade 1.5 as a current Cocos Creator project with maximal recoverable
behavioral and presentation fidelity. The original APK cannot run on available current
Android devices, so restoration is static-only. Facts not recovered from `libgame.so`,
resources, Java/metadata, or explicitly approved as inferences remain unknown. The `game/`
Creator foundation now exists and the exact root has produced the first Editor-serialized
Classic scene. The full scene/prefab map still needs to be authored before the vertical slice
is complete.

## Authority and evidence

The immutable APK bytes, decoded resources, native analysis, app-owned Java, and metadata
are primary authority. Independent static views, historical media, and user memory provide
corroboration in decreasing order. Gameplay facts use `recovered`, `inferred`, or `unknown`;
contradictions are linked separately. Every implementation rule must cite the evidence
ledger. An inferred rule may be implemented only with its label and review intact and never
counts as recovered coverage.

No phase installs or executes the APK. Runtime capture, instrumentation, original trace
replay, and device comparison are unavailable and are not project gates.

## Product target

- Android is the primary platform.
- The production implementation uses the latest stable Cocos Creator with TypeScript,
  components, scenes, prefabs, and Creator-managed assets.
- Cocos Creator Physics2D is the production physics layer. Native analysis recovers its
  timestep, gravity, bodies, fixtures, filters, velocities, ray casts, contacts, and
  gameplay reactions.
- Cocos Creator 3.8.8 / 3.8 LTS is the baseline rechecked on 2026-07-22. Phase 5 must pin
  the editor, engine revision, Android SDK, NDK, and JDK after resolving local bundle trust.
- The current workspace contains the Creator 3.8.8 project under `game/`, a `720x1280`
  default, and the first Editor-authored `classic.scene` Canvas bridge.
- Creator's Android API 21+ floor is an explicit platform-envelope change from the original
  application's minimum SDK 9.
- The original APK, `libgame.so`, Cocos2d-x runtime, decompiler output, and recovered C++ are
  evidence only. The shipped game must not link, wrap, call, emulate, bridge to, mechanically
  port, or include them.

## Required outcomes

- A versioned specification covers every statically identified state and gameplay mode,
  with explicit unknowns for unresolved behavior.
- Static evidence is reproducible, hashed, traceable, and separated from the
  ship-ready Creator project.
- Visual, timing, input, physics, score, audio, save, and progression behavior maps from
  evidence to contracts, reconstruction fixtures, tests, and Creator implementation.
- The Android build contains only the clean-room TypeScript/Creator implementation and assets
  whose use is permitted for the chosen release scope.

## Non-goals

- Reusing, patching, re-signing, or distributing the source APK.
- Shipping the original native binary, a compatibility wrapper, an emulator, or decompiled
  implementation code.
- Recreating ads, analytics, store-review prompts, social integrations, or legacy network
  bridges in the gameplay core.
- Treating possession of the APK as permission to redistribute its name, artwork, fonts,
  music, code, or trademarks.
- Hiding an inference or unknown to make a milestone appear complete.

## Milestones

1. Preserve evidence and establish the static baseline.
2. Establish the static reconstruction corpus and native/resource maps.
3. Catalog assets and reconstruct presentation contracts.
4. Recover native gameplay contracts and persistence rules.
5. Build a native-free Cocos Creator vertical slice.
6. Recreate all content, modes, and progression.
7. Validate static reconstruction coverage and prepare the selected release variant.

## Boundaries and gates

- The original runtime is unavailable. No reference device, emulator, compatibility layer,
  or captured original trace may be introduced as an implicit dependency.
- Maximal recoverable fidelity is measurable as recovered-contract coverage. It is not a
  claim of empirically proven 100% runtime identity.
- Private preservation, source publication, and public store release are distinct outcomes.
  The intended release scope remains unresolved.
- Public release requires documented permission or measured replacements for the product
  name, artwork, fonts, music, trademarks, and other third-party material.
- Git is initialized on `main` with no commits yet. The curated/ignored boundary remains
  mandatory for staging and commits.

## Phase 1 acceptance

- The source APK hash remains
  `95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa`.
- The inventory reproduces the reviewed archive, manifest, asset, and native baselines.
- Decoder and native-tool outputs live only in the ignored working zone.
- Every curated claim resolves to immutable static evidence or a declared supporting source.
- At least two external offline copies are hash-verified before Phase 1 is marked complete.

## Unresolved questions

- Where are the two external offline backups stored and when were they verified?
- What is the APK's original acquisition date and upstream source record?
- Is the intended outcome private preservation, source publication, or public store release?
- What rights or permissions exist for the name, artwork, fonts, music, and other content?
- Is any authentic historical gameplay media or documentation available for supporting review?

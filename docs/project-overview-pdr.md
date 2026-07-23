# Pencil Blade Restoration: Product Development Requirements

## Purpose

Reconstruct Pencil Blade 1.5 as a current Cocos Creator project with maximal recoverable
behavioral and presentation fidelity. The original APK cannot run on available current
Android devices, so restoration is static-only. Facts not recovered from `libgame.so`,
resources, Java/metadata, or explicitly approved as inferences remain unknown. The `game/`
Creator foundation now exists and the exact root has produced the first Editor-serialized
Classic scene. All 862 recovered APK game assets are staged byte-for-byte and imported into
the Creator bundle. The current playable loop consumes the exact paper background,
intro/terminal/fail-marker art, score icon, best-score cup, double-score panel, Linds font,
ordinary intact/cut fruit, critical particles, and 23 reviewed core/ordinary-bomb audio clips.
The exact standard-bomb raster, body, fixture, cut guard, and retained-audio seam are also
implemented and tested, and the shared BaseBird/BirdBlade substrate now powers the production
Classic Bird mode `3` route. The mode-0 result now includes its exact rank order, delayed
particle burst, rotating reward tree, and the Classic-relevant `total_coins` plus
`classic_best_1/2/3` persistence subset. Missing or corrupt save restores `999999` coins while
a valid persisted balance wins. This is a bounded production checkpoint, not presentation
completion: most resource consumers and the full scene/prefab map remain open, and modes `2`,
`4`, and `5` still fail closed.

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
- The current static catalog accounts for 862 packaged game assets: 784 PNG, 59 WAV, 3 MP3,
  and 16 fonts; 107 additional Android `res/` PNG are classified separately.
- The full recovered APK game-asset corpus is copied unchanged under `game/assets/game/` and
  its current Creator raster/audio imports are covered by staging and metadata validators.
  The staging manifest's consumer/UUID fields remain incomplete and do not yet measure the
  subset that the playable slice consumes.
- The Classic score HUD now uses the exact recovered score icon, best-score cup,
  double-score panel, and `Fonts/Linds.ttf`. Best-score display follows the authoritative
  score service seeded from persisted `classic_best_1`; app hide saves all four restored
  Classic Settings integers. Missing or corrupt save falls back to `999999` coins while a
  valid persisted balance wins. Full first-launch/Main Menu Settings behavior remains open.
- The current implementation checkpoint covers production routes `0`, `1`, and `3`; modes `2`,
  `4`, and `5` remain fail closed.
- Presentation restoration is complete only when the canonical user-supplied sample project
  has 100% inventory, staging, and consumer coverage for every resource actually present.
- No canonical graphics, animation frame, sound, music, font, shader/material, level/layout,
  progression, or other game resource may be silently omitted or substituted.
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
- Visual, layout, animation, shader/material, audio, level/progression, timing, input, physics,
  score, state, and save behavior maps from evidence to contracts, reconstruction fixtures,
  tests, and Creator implementation.
- Best-score presentation in the Classic HUD is exact and backed by `classic_best_1`; the
  remaining Settings fields and first-launch/Main Menu save checkpoints remain separate tasks.
- The Android build contains only the clean-room TypeScript/Creator implementation and assets
  whose use is permitted for the chosen release scope.
- `99%` is the future acceptance target for a versioned static-contract/resource fidelity
  metric covering visuals/layout/animation, audio, shaders/materials/rendering,
  levels/progression, and gameplay/physics/timing/input/state. Its denominator, weighting, and
  residual-gap list stay unresolved until the canonical sample-project manifest/root is resolved.

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
- Technical fidelity does not authorize release. If rights block exact reuse, release blocks
  pending an explicit user decision; assets must not be silently omitted or substituted.
- Public release requires documented permission or measured replacements for the product
  name, artwork, fonts, music, trademarks, and other third-party material.
- The canonical sample-project resource manifest/root remains unresolved; until it is resolved,
  the `99%` metric cannot be finalized and residual gaps cannot be enumerated completely.
- Git is initialized on `main` with a committed foundation. The curated/ignored boundary remains
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

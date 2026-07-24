---
type: explorer
date: 2026-07-24
status: complete
---

# Explorer: Scene and Composition Reconciliation Map

## Summary

Static reconciliation found one serialized Creator bridge, not a collection of authored
screens: `game/assets/scenes/classic.scene` contains exactly 30 indexed records, two nodes,
four built-in node components, and 13 custom Canvas components. Every compact custom type token
resolves uniquely to an imported TypeScript UUID. All production screens and gameplay
presentations are otherwise constructed by TypeScript at runtime.

The code-built strategy is supported by the recovered Cocos2d-x constructors, `onEnter`
functions, `addChild` order, shared-layer tags, blade entry functions, and `ParticleObject`
symbols. Zero prefabs, authored effects/materials, animation clips, or atlases is therefore not
by itself missing content. The scan found one real omission: standard Classic lacked the
inherited `BaseGameplayPausePresenter` and Pause/Resume/Replay/Quit lifecycle. That omission was
implemented and verified during the same checkpoint, as recorded below.

## Resolution — 2026-07-24

- Standard Classic now creates and owns the shared pause presenter, objective card, and exact
  Pause/Resume/Replay/Quit controls.
- `ClassicSceneController`, `ClassicGameplayController`, and the persistent app shell now own
  typed transactional suspend/restart/quit, exact rollback or quiesced fatal settlement,
  retained cleanup retry, and recovered mode-0 audio behavior.
- The composition regression locks all 30 records, active/enabled state, node and scene-global
  ownership, null prefab sentinels, all 49 serialized references, custom component order/UUIDs,
  the recursive direct-construction census, all shell/gameplay/result roots, shared pause
  coverage, and the authored-artifact census.
- Focused composition/pause tests, the full deterministic vertical slice, and Creator 3.8.8
  strict TypeScript pass. Fresh compact/high Preview remains the final Phase 6 runtime gate,
  not an unresolved composition requirement.

## Scope and Method

- Static only. No APK, `libgame.so`, Creator Preview, or application code was executed.
- Read the Phase 6 plan, Creator contract map, all 209 TypeScript sources, the serialized scene
  and metadata, presentation contracts, native function/subsystem maps, and the recovered
  resource catalogs.
- Preserved all recovered resources. The initial exploration modified only this report; the
  dated resolution above records the later implementation checkpoint.
- No repository-root `README.md` exists. `forensics/README.md`, the restoration plan, and
  project docs supplied repository context.
- Scene source snapshot:
  - `classic.scene`: 644 lines; SHA-256
    `a6584e5bdea1e9d1c347a2ceb7750fa7aea51279bc31b63f0c9c91fc90b740c8`
  - `classic.scene.meta`: SHA-256
    `4fdf704ecc27bf2b14d1fc4bb99fee64c13226ee5c7ea5a012d472ef43098428`

## Findings

### 1. Serialized scene ledger

`classic.scene.meta` is imported with scene importer version `1.1.50`, UUID
`35e5417d-c3dd-4522-9339-99c81a0b9b4b`, and `files: [".json"]`. The scene owns no prefab
references.

#### Indexed graph and built-in components

| Index | Type / owner | Exact serialized role |
|---:|---|---|
| 0 | `cc.SceneAsset` `classic` | Native field empty; scene reference `1`. |
| 1 | `cc.Scene` `classic` | Child `[2]`; no components/prefab; layer `1073741824`; globals `21`; `autoReleaseAssets=false`; scene UUID above. |
| 2 | `cc.Node` `Canvas` | Parent `1`; child `[3]`; components `[5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,18]`; no prefab; position `(360,640,0)`; layer `33554432`; ID `57kMwhv0tKgqKbNYSQnJIZ`. |
| 3 | `cc.Node` `Camera` | Parent `2`; no children; component `[4]`; no prefab; position `(0,0,1000)`; layer `1073741824`; ID `0bmoe9yHlHSLCCdKU3xWw/`. |
| 4 | `cc.Camera` / Camera | Orthographic projection; height `640`; near/far `0/2000`; black clear color; flags `7`; visibility `1108344832`; full rect; depth `1`; no target texture/post-process; ID `fdhBglkxpCZ5ZklNBVzJQ+`. |
| 5 | `cc.UITransform` / Canvas | Size `720x1280`; anchor `(0.5,0.5)`; Canvas component position `1`; ID `a2zcsh8DxIDoipHSLi1NOF`. |
| 6 | `cc.Canvas` / Canvas | Camera reference `4`; align-with-screen `true`; component position `2`; ID `ddARAIiaxMZZMS0JNRojpl`. |
| 7 | `cc.Widget` / Canvas | Flags `45`; left/right `0`; top/bottom `5.684341886080802e-14`; absolute edges; mode `2`; component position `3`; ID `cayJVC6vdKx7jjFVGZi18O`. |

All components are enabled and have `__prefab: null`. No additional serialized nodes exist.

#### Custom Canvas components and UUIDs

All 13 components serialize only standard component fields. Their TypeScript metas use importer
`typescript`, version `4.0.24`, and `imported: true`.

| Index | Canvas pos. | `@ccclass` | Scene type token | Full meta UUID | Script meta | Component ID |
|---:|---:|---|---|---|---|---|
| 8 | 4 | `BladeInputController` | `0fd52CUC6dHJoHuZBe9rtQd` | `0fd52094-0ba7-4726-81ee-6417bdaed41d` | `creator/blade-input-controller.ts.meta` | `d2oVrO6K1BoZkPMNlaMyX8` |
| 9 | 5 | `ClassicSceneController` | `a32bcWc/1BL/JJe8ANXLHNT` | `a32bc59c-ff50-4bfc-925e-f003572c7353` | `creator/classic-scene-controller.ts.meta` | `f6ce+FJtBFKqDWuzpuynGv` |
| 10 | 6 | `ClassicGameplayController` | `52b0feMbANGmYv0vsXyCMvX` | `52b0f78c-6c03-4699-8bf4-bec5f208cbd7` | `creator/classic-gameplay-controller.ts.meta` | `50IX+C5p5BFZT3gSkKQqby` |
| 11 | 7 | `CrazySceneController` | `ef2ac3mw8xDIpVBfm0R65H+` | `ef2acde6-c3cc-4322-9541-7e6d11eb91fe` | `creator/crazy-scene-controller.ts.meta` | `ef2acde6c3cc432295417e` |
| 12 | 8 | `CrazyGameplayController` | `39723lNg/VK+6hzPnPuRtsx` | `3972394d-83f5-4afb-a873-3e73ee46db31` | `creator/crazy-gameplay-controller.ts.meta` | `3972394d83f54afba8733e` |
| 13 | 9 | `BirdInputController` | `321b2v19MBEuZ3exzrfz3/F` | `321b2bf5-f4c0-44b9-9dde-c73adfcf7fc5` | `creator/bird-input-controller.ts.meta` | `5j+lRcGKG6wLHlTrZsuUpw` |
| 14 | 10 | `ClassicBirdSceneController` | `f474cXfYAZIKrQb4XNNdDxz` | `f474c5df-6006-482a-b41b-e1734d743c73` | `creator/classic-bird-scene-controller.ts.meta` | `5WSUaClokGMmrcJ9lJ5edA` |
| 15 | 11 | `ClassicBirdGameplayController` | `2f96ayLk0pMTIOGbDoRTyqc` | `2f96ac8b-934a-4c4c-8386-6c3a114f2a9c` | `creator/classic-bird-gameplay-controller.ts.meta` | `V96kZxIljWKq4XVV6qzbSg` |
| 16 | 12 | `ComboBirdSceneController` | `663d3B/+/BERYDnLojJMA0g` | `663d307f-fbf0-4445-80e7-2e88c9300d20` | `creator/combo-bird-scene-controller.ts.meta` | `cBScene6m5JQx4tN8zR2p` |
| 17 | 13 | `ComboBirdGameplayController` | `cb050HbGT5HybWddzJ929pX` | `cb0501db-193e-47c9-b59d-77327ddbda57` | `creator/combo-bird-gameplay-controller.ts.meta` | `cBGamep9k7VWx3sL6uA1q` |
| 18 | 16 | `RecoveredAppShellController` | `12e4e2CzjtIza21IDsQPWH2` | `12e4ed82-ce3b-48cd-adb5-203b103d61f6` | `creator/recovered-app-shell-controller.ts.meta` | `12e4ed82ce3b48cdadb520` |
| 19 | 14 | `GnStyleSceneController` | `73345Ruzq5DNaun3apUANw9` | `7334546e-ceae-4335-aba7-ddaa5400dc3d` | `creator/gn-style-scene-controller.ts.meta` | `c2DnlX6qhH6LjygtelJZhb` |
| 20 | 15 | `GnStyleGameplayController` | `6e631l3/oNJD545GexjSkCE` | `6e631977-fe83-490f-9e39-19ec634a4084` | `creator/gn-style-gameplay-controller.ts.meta` | `7eZZqQD6xKXrfj0LIwCxup` |

The paths above are relative to `game/assets/scripts/`. Compacting every scripts metadata UUID
produced exactly one match per scene token: zero unresolved and zero ambiguous. There are 209
TypeScript sources and 209 TypeScript sidecars; all 211 script-tree metadata UUIDs, including
two directory metas, are unique.

#### Scene-global records

| Index | Type | Payload |
|---:|---|---|
| 21 | `cc.SceneGlobals` | Ambient `22`, shadows `23`, skybox `24`, fog `25`, octree `26`, skin `27`, light probes `28`, post settings `29`; baked-light flags false. |
| 22 | `cc.AmbientInfo` | Black HDR/current sky and ground colors; sky illumination `20000`; stored LDR defaults retained. |
| 23 | `cc.ShadowsInfo` | Disabled; type `0`; size `512x512`; max received `4`; default plane/color values. |
| 24 | `cc.SkyboxInfo` | Disabled; all environment, diffuse, reflection, and editable-material references null; HDR flag true. |
| 25 | `cc.FogInfo` | Disabled; type `0`; gray color; density/start/end/attenuation/top/range defaults retained. |
| 26 | `cc.OctreeInfo` | Disabled; bounds `-1024..1024`; depth `8`. |
| 27 | `cc.SkinInfo` | Disabled; blur radius `0.01`; SSS intensity `3`. |
| 28 | `cc.LightProbeInfo` | No data; GI scale `1`; samples `1024`; bounces `2`; editor display defaults retained. |
| 29 | `cc.PostSettingsInfo` | Tone mapping type `0`. |

The JSON also contains 28 inline typed values, not additional indexed records: 12 `cc.Vec3`,
3 `cc.Quat`, 6 `cc.Vec4`, 3 `cc.Color`, 2 `cc.Vec2`, 1 `cc.Rect`, and 1 `cc.Size`.

### 2. Persistent shell and screen composition

The serialized Canvas is a dependency/lease host. `RecoveredAppShellController` prepares the
resources and owns transactional screen replacement; it does not expect screen descendants
to be present in the scene file.

| Surface | Runtime owner and roots | Reconciled composition |
|---|---|---|
| Loading | `loading-presenter.ts`; `LoadingScene` attached directly to Canvas | Four selected-profile sprites in native order: `backgroundLogo`, bar back, left-anchored filled progress, bar front. Transient overlay survives Main Menu staging, then retires. |
| Shared GameScene | `shared-game-scene-presenter.ts`; direct Canvas siblings `SharedBackgroundRoot`, `SharedLeafRoot`, `SharedThemeRoot`, current screen | Background sprite; seven independent leaf sprite/physics roots; one theme sprite; current screen at sibling slot `3`. This translates native equal-z insertion order/tags `0,1,2,3`. |
| Main Menu | `main-menu-presenter.ts`; `MainMenuRoot` | Selected `StandardBlade`; pencil/background/coin shell; six menu controls; two wheels; Leaderboard/Objectives/New Game fruit buttons with blur/circle/intact physics nodes; cut halves; gestures; emitted hearts. |
| Mode Select | `mode-select-presenter.ts`; `ModeSelectRoot` | Selected `StandardBlade`, gestures/title/back, decorative rope, and six route rope buttons. Each button owns seven rope links, description, fruit/blur/circle physics, wheels, connector/joints/anchor, and optional lock. Unlock uses label, cut halves, and 45 code-created particles. |
| Options | `options-presenter.ts`; `OptionsRoot` | Title, total-coins panel/label, Back, gestures; delayed Background/Blade/Theme rows; selector presenters; Background/Blade buy menus and prices; 45-particle purchase burst. |
| Leaderboard | `leaderboard-presenter.ts`; `LeaderboardRoot` | Gestures, title, Back, six cards in native mode order. Each card owns template/header plus player 1-3 and score 1-3 labels. |
| Objectives | `objectives-screen-presenter.ts`; `ObjectivesRoot` | Exactly 57 root children: background, 52 ordered rows, header, footer, fixed-current item, menu. Every row owns background/description/reward; menu owns Back/Skip. No recovered mask/stencil requirement. |
| About | `about-presenter.ts`; `AboutRoot` | Background, menu, gestures; Menu/Review/Email/Like controls; conditional code-created heart sprites. Retired platform actions remain local/offline. |
| Objective popup host | `objective-achievement-host.ts` plus `objective-achievement-presenter.ts` | Persistent shell-owned target roots and transient popup/emitter sprite nodes. Gameplay/menu owners report events; no serialized overlay. |

### 3. Six gameplay routes

| Mode | Root ownership | Runtime-created presentation |
|---|---|---|
| Classic `0` | `ClassicModeRoot`; `ClassicScoreHudRoot`, `ClassicWorldPresentationRoot`, `ClassicFailPresentationRoot` | Standard blade, GOOD/LUCK intro, generated fruits/bombs, cut halves, critical particles, combo items, fail markers, GAME/OVER, objectives, shared pause, and `ClassicResultPresentationRoot`. |
| Crazy `1` | `CrazyModeRoot`; `CrazyWorldPresentationRoot`, `CrazyScoreHudRoot` | Standard blade, intro, 60-second TimeManager, entities/specials/bombs/electric/magnet/Dragon, objectives, shared pause, and `CrazyResultPresentationRoot`. |
| GN Style `2` | `GnStyleModeRoot`; `GnStyleWorldPresentationRoot`, `GnStyleScoreHudRoot` | Standard blade, 150-second TimeManager, intro/instructions, ordinary-fruit graph, dedicated music, 439 source-ordered parent particle roots, shared pause, and `GnStyleResultPresentationRoot`. |
| Classic Bird `3` | `ClassicBirdModeRoot`; `ClassicBirdWorldPresentationRoot`, `ClassicBirdScoreHudRoot`, `ClassicBirdFailPresentationRoot` | Bird blade type `1`, intro/GAME OVER words, entities/electric, objectives, shared pause, and `ClassicBirdResultPresentationRoot`. |
| Crazy Bird `4` | `CrazyBirdModeRoot`; shared `CrazyWorldPresentationRoot`, `CrazyScoreHudRoot` | Crazy profile with Bird blade type `2`, timed/special graph, objectives, shared pause, and intentionally shared `CrazyResultPresentationRoot`. |
| Combo Bird `5` | `ComboBirdModeRoot`; `ComboBirdWorldPresentationRoot`, `ComboBirdScoreHudRoot` | Bird blade type `3`, 90-second TimeManager, intro/instructions, ordinary-only fruit/combo graph, objectives, shared pause, and `ComboBirdResultPresentationRoot`. |

Route-specific scene-controller components are serialized as persistent bridges. Replay paths
may lease standby controller components dynamically; that does not justify serializing duplicate
components.

### 4. Cross-cutting runtime surfaces

#### Pause and result

- `BaseGameplayPausePresenter` creates three equal-z roots:
  `BaseGameplayPauseOverlay`, `BaseGameplayPauseMenu`, and
  `BaseGameplayPauseOptionsMenu`. They own the dim `Graphics`, objective background,
  description/progress/reward labels, and Pause/Resume/Replay/Quit buttons.
- Classic, Crazy, Crazy Bird, Classic Bird, Combo Bird, and GN Style attach this presenter and
  own replay/quit transactions.
- `ClassicResultPresenter` is the shared result shell. It builds score/header/retry/menu,
  medal/panels/labels, coin panel/label, 100-particle burst, and delayed
  effect/coin/badge/bonus content beneath each route-specific result root listed above.

#### Audio

| Owner | Runtime roots |
|---|---|
| Classic/shared | `ClassicAudioRoot` with `ClassicEffectAudioVoices` and `RecoveredBackgroundMusicAudio`; transient/retained `AudioSource` voices. |
| Crazy/shared timed modes | `CrazyAudioRoot` with `CrazyEffectAudioVoices` and `CrazyElectricBackgroundAudio`. |
| Combo/GN timer | `TimeManagerAudioRoot` plus transient `TimeManagerOneShotAudio`. |
| GN Style | `GnStyleBackgroundMusicRoot` with one non-looping source. |

Audio nodes are process/runtime leases. No serialized `AudioSource` or audio prefab is missing.

#### Blades

- `StandardBladePresenter` routes IDs `0-12` to a basic blade and `13-17` to
  Dragon/Centipede multipart advanced blades.
- Basic blade: `ClassicBasicBladeRoot`, four trail mesh slots, runtime
  `MeshRenderer`/`UIMeshRenderer`, code-created `builtin-unlit` materials, and
  `StandardBladeParticlePresenter`.
- Advanced blade: `StandardAdvancedBladeRoot`, four slot roots, and sprite head/body/tail
  chains.
- Bird types `1/2/3`: `BirdBladeRoot`, one trail mesh, main/left/right sprites, and dynamic
  particle nodes using the same built-in unlit-material strategy.

#### Particles, effects, and generated entities

- Code creates Classic critical particles, blade particles, Bird particles, result particles
  (`100`), purchase/unlock particles (`45`), objective emitters, bomb smoke/explosion,
  electric/magnet presentation, cut halves, combo items, and GN Style's `439` parent emitters.
- Generated fruit, bomb, special, and Dragon nodes add `Sprite`, `UITransform`, Physics2D
  bodies/colliders/joints, `Graphics`, labels, and effect children as required by their
  recovered plans.
- Timing is driven by domain state, presenter `updateAction`, Creator tweens, sprite-frame
  swaps, and callbacks. No authored animation clip or particle-system asset is referenced.

### 5. Authored artifact census

Primary non-meta files under `game/assets` are exactly 784 PNG, 209 TypeScript, 59 WAV,
15 TTF (case-insensitive), 3 MP3, 1 OTF, and 1 scene. There are 1,149 metadata files.

| Artifact family | Count | Reconciliation |
|---|---:|---|
| `.scene` | 1 | Required persistent bridge; fully inventoried above. |
| `.prefab` | 0 | Intentional current architecture. No native/target evidence identifies a required missing prefab. |
| `.effect` | 0 | Effects are sprite/graphics/mesh/state compositions. |
| `.material` / `.mtl` | 0 | Blade trails create Creator `builtin-unlit` materials at runtime. |
| `.anim` / `.animation` | 0 | Motion/fades/pulses use state, actions, tweens, and frame swaps. |
| `.atlas` / `.plist` / `.pac` | 0 | Raw PNG/SpriteFrame resources are loaded individually. |
| Non-meta `.json` | 0 | No hidden JSON atlas/prefab candidate. |

`engine.json` enables engine animation, graphics, Physics2D, audio, tween, and particle modules.
Module enablement is not evidence that authored assets of those types should exist.

### 6. Why code-built composition is intentional

| Recovered evidence | Consequence |
|---|---|
| `forensics/contracts/shared-game-scene-presentation-contract.md` resolves `GameScene::onEnter()` constructing and adding Background, Leaf, Theme, Main Menu in order, all z `1`, with tags `0-3`. | Shared roots/current screen must preserve insertion order; a serialized hierarchy or prefab is not required. |
| `forensics/native/function-map.csv` preserves constructors and `onEnter` functions for `MainMenuLayer`, `ModeSelectLayer`, `OptionsLayer`, `LeaderboardLayer`, `ObjectivesLayer`, `AboutLayer`, and gameplay layers. | Original application composition was C++ layer construction, not Creator-authored prefab instantiation. |
| `forensics/native/subsystem-map.md` identifies all six gameplay families plus blade/effect/progression layer classes. | The code-built mode and screen owner graph maps to recovered classes rather than invented scene assets. |
| `BasicBlade::onEnter`, `BirdBlade::onEnter`, and `ParticleObject` constructor/update symbols survive. | Runtime trail/particle construction has native precedent; absent material/effect/prefab assets are not omissions. |
| Resource map contains individual raster/audio/font paths and no prefab/material/atlas family. | Loading raw SpriteFrames and creating nodes is consistent with the recovered corpus. |

Some earlier architecture prose used “prefab” as a possible Creator implementation boundary.
That term is not forensic proof of an original prefab. The implemented node/component graph
should be judged by recovered order, resources, behavior, and ownership, not by whether it was
saved as a `.prefab`.

### 7. Resolved gap: standard Classic pause

This is not an abstract audit concern:

- `forensics/contracts/classic-time-state-contract.md` states Classic calls
  `BaseGameplayLayer::onEnter()`, then inherited `InitPauseComponent()`.
- The same contract recovers `PauseCallback`, `PauseIn/OutAction`, `ResumeCallback`,
  `ReplayCallback`, and `QuitCallback`, including the `0.25`-second director gate.
- `forensics/contracts/classic-presentation-contract.md` maps the shared pause button and
  normal/selected resources.
- At discovery time, `classic-gameplay-controller.ts` loaded `LoadedBaseGameplayResources` and
  exposed the process objectives/settings/audio owners, but never created
  `BaseGameplayPausePresenter`.

The missing Classic pause button, objective overlay, Resume, Replay, and Quit composition was
the only required runtime surface found absent. It has now been integrated in code without a
prefab or scene edit.

Recovered audio behavior to preserve:

1. Pause ingress; effects-enabled click then pause all effects; music-enabled background pause.
2. Resume the director before visual egress; effects-enabled click then resume effects.
3. Mode `0` does **not** resume background music through the inherited resume branch. This
   asymmetry is recovered even though its original intent is unknown.
4. Pause Replay stops background music and all effects, resumes/clears old pause actions,
   replaces the old layer with a fresh Classic layer, then requests click if enabled.
5. Pause Quit resumes/removes gameplay and adds Main Menu, then requests click if enabled; the
   native callback has no direct stop-all-effects/background-music operation.

## Implemented Closure

### Runtime closure

No new scene, prefab, effect, material, animation, atlas, resource contract, or loader is
required.

| File | Implemented responsibility |
|---|---|
| `game/assets/scripts/creator/classic-scene-controller.ts` | Owns explicit active/suspended Classic navigation leases, rollback-safe fresh-run replacement, retained world-speed delay, BladeInput/Physics2D ownership, typed fatal settlement, and pending Physics restore retry. |
| `game/assets/scripts/creator/classic-gameplay-controller.ts` | Owns `BaseGameplayPausePresenter`, current objective card, exact Pause/Resume audio, transactional Pause Replay/Quit, retained failed cleanup, and pause quit/replay-failure events. |
| `game/assets/scripts/creator/recovered-app-shell-controller.ts` | Listens, validates, and settles Classic Pause Quit; activates Main Menu before commit; restores the exact reversible owner or enters the shell's fail-closed state after incomplete rollback. |

The reusable ports already exist:

- `ClassicGameplayController.sharedSettingsRuntime`
- `ClassicGameplayController.sharedObjectivesManager`
- `ClassicGameplayController.sharedBaseGameplayResources`
- `ClassicGameplayController.sharedAudioPresenter`
- `ClassicSceneController.resolutionSnapshot()`
- `BaseGameplayPausePresenter`

Replay and Quit must maintain exactly one current screen, active scene controller, BladeInput
lease, Physics2D lease, and pause presenter. A pre-commit failure restores the old root,
ownership, scene, input/physics, and paused overlay. If exact rollback fails, quiesce and report a
fatal lifecycle boundary; never continue with mixed owners. Publish logical commit before
best-effort destruction so cleanup errors cannot tear down the new screen.

### Focused verification

| Test file | Implemented assertions |
|---|---|
| `tests/reconstruction/vertical-slice/classic-retry-lifecycle-executable.test.ts` and existing Classic lifecycle tests | Pause tree ownership, objective text, director/audio order, mode-0 no-music-resume, fresh Replay ownership, injected rollback/fatal faults, retained cleanup retry, observer isolation, and Quit one-shot settlement. |
| `tests/reconstruction/vertical-slice/classic-scene-restart.test.ts` | Active/suspended/standby state, retained old session/world-speed delay, resume/finalize/release paths, pending Physics restore, typed fatal state, and no duplicate input/physics owner. |
| `tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts` | Event on/off, malformed/stale rejection, Main Menu activation-before-commit, current-screen identity, collision-filter rollback, commit/rollback, and fail-closed ownership. |
| `tests/reconstruction/vertical-slice/creator-composition-reconciliation.test.ts` and `creator-scene-integration.test.ts` | Exact scene topology/references, custom component order/token/UUID mapping, explicit no-prefab policy, runtime root/construction census, and Classic Pause -> Resume/Replay/Quit integration. |

Existing `base-gameplay-pause-state.test.ts`,
`base-gameplay-pause-presenter.test.ts`, audio presenter tests, resource loader tests, and
route-specific pause tests remain reusable and should not be duplicated.

### Docs/checkpoint closure

After the automated gates pass:

1. Update `docs/cocos-creator-contract-map.md` with the one-scene/code-built composition policy,
   this report, the new composition assertions, and completed Classic pause ownership. Remove
   stale statements that first-launch/resource consumers remain open.
2. Update
   `plans/260721-2253-pencil-blade-restoration/phase-06-recreate-full-game-content-and-progression.md`
   and `plan.md` only after the focused suite, full vertical slice, strict Creator TypeScript,
   and metadata audit pass.
3. Run the existing complete Phase 6 verification/review gate. No production asset generation
   belongs in this checkpoint.

### Catalog boundary, separate from composition

`assets/catalog/creator-staging-manifest.json` is the pre-import exact-byte/reconciliation
boundary. Its Creator metadata/UUID fields intentionally remain `pending` and are not the
post-import authority. The separate pinned Creator metadata validator covers the imported tree,
including exact sidecar counts, structural validity, and duplicate UUID detection. Do not use
the staging-only pending fields as a reason to create prefabs.

## Unresolved Questions

- The canonical sample-project root/completeness remains unresolved. That prevents claiming an
  external sample project had no additional authoring files; it does not create a target-runtime
  prefab requirement without evidence.
- The original intent behind Classic's pause-background-music/no-resume asymmetry is unknown.
  Its behavior is recovered and should remain unchanged.
- Release rights remain unresolved for all 862 recovered assets, and
  `Fonts/CooperBlackStd.otf` remains unsupported. Those are release-fidelity blockers, not
  scene-composition blockers.

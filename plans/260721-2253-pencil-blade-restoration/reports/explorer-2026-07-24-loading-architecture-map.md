# Loading surface architecture map

Date: 2026-07-24
Scope: read-only mapping of the current Creator boot path, the recovered native
`LoadingScene` contract, and the safest integration boundary
Safety: no APK, shared library, emulator, native runtime, or reconstructed game was
executed

## Outcome

The safest Creator integration is a **shell-owned transient Loading overlay inside the
existing serialized `classic.scene`**, not a second serialized Creator scene. This is a
target-engine adaptation of the recovered native flow:

```text
native:  AppDelegate -> runWithScene(LoadingScene) -> replaceScene(GameScene)
Creator: classic.scene -> RecoveredAppShell boot transaction
                    -> attach transient LoadingScene overlay
                    -> prepare GameScene/Main Menu behind it
                    -> commit Main Menu
                    -> synchronously hide and dispose Loading
```

This keeps the current one-scene architecture, preserves the exact four-raster composition,
dispatches the exact 62 indexed audio preload calls, prevents the existing first-bundle-load
race, and gives the shell one owner for teardown and failed boot cleanup.

The resource effect is larger than the four Loading raster names alone. Loading owns 70
canonical paths in the runtime registry:

- 8 tree-specific raster paths: four in `480x800`, four in `720x1280`.
- 62 canonical audio paths: indices `0..61`, comprising 3 background tracks and 59 effects.
- Of those 62 audio paths, 52 are already consumed by other live owners and 10 are currently
  unconsumed.
- Net new consumers: `8 + 10 = 18`, moving runtime coverage from `743/862` to `761/862`
  (`88.28%`) and unknown paths from `108` to `90`.

## Current facts

### Repository context

- The repository root has no `README.md`; the applicable context came from
  `forensics/README.md`, the restoration plan, Phase 6, and the current architecture,
  contract-map, PDR, and codebase-summary documents.
- Preview starts scene UUID `35e5417d-c3dd-4522-9339-99c81a0b9b4b` from
  `game/profiles/v2/packages/preview.json`.
- That UUID is `game/assets/scenes/classic.scene`.
- The scene has one persistent Canvas and Camera. Its 13 serialized application components
  are, in tested order:
  1. `BladeInputController`
  2. `ClassicSceneController`
  3. `ClassicGameplayController`
  4. `CrazySceneController`
  5. `CrazyGameplayController`
  6. `BirdInputController`
  7. `ClassicBirdSceneController`
  8. `ClassicBirdGameplayController`
  9. `ComboBirdSceneController`
  10. `ComboBirdGameplayController`
  11. `GnStyleSceneController`
  12. `GnStyleGameplayController`
  13. `RecoveredAppShellController`
- Route controllers stay passive until the shell activates them. The shell is the existing
  process-level route and resource owner.

### Current Creator boot sequence at `HEAD`

The established boot path before the concurrent Loading edits is:

| Order | Current owner | Current behavior |
|---:|---|---|
| 1 | Creator scene | Deserialize `classic.scene`, then call component `onLoad()` hooks. |
| 2 | `RecoveredAppShellController.onLoad()` | Resolve and bind the serialized controllers and shell-wide callbacks. |
| 3 | `RecoveredAppShellController.start()` | Call idempotent `bootRecoveredApp()`. The shell stores one `bootPromise`. |
| 4 | `ClassicSceneController` | `prepareSceneResolution()` selects the `480x800` or `720x1280` contract and applies the recovered viewport policy. |
| 5 | `createRecoveredAppViewport()` | Produce the deeply frozen float32-normalized viewport used by non-gameplay screens. |
| 6 | `ClassicGameplayController.prepareRecoveredRuntime()` | Perform the **first** `game` bundle load, load the Classic/base visual catalogs, then load `ClassicAudioPresenter`. |
| 7 | Shell optional preparation chain | Prepare Crazy, Classic Bird, Crazy Bird, Combo Bird, then GN Style serially for first access. Each optional destination catches its own preparation failure so Main Menu and already prepared routes remain available. |
| 8 | Shell foreground loaders | Load shared-scene, About, Leaderboard, Main Menu, Mode Select, Objectives, and Options resources in parallel after Classic established the bundle. |
| 9 | Shell shared owners | Create `SharedLeafPresenter`, `SharedGameScenePresenter`, the non-Classic collision filter, the achievement host, and the objectives manager. |
| 10 | Shell initial screen | Create detached Main Menu, attach it as `SharedGameScenePresenter.currentScreen`, activate it, set `activeMainMenu`, then set shell state to `main-menu`. |

Additional current invariants:

- The shell state union contains `booting` and route states, but no Loading route state.
- The current shell has no visual owner during the resource-loading interval; Preview goes
  from the serialized Canvas to Main Menu.
- `bootRecoveredApp()` normalizes a fatal initialization error, sets `failed`, emits
  `recovered-app-shell-boot-failed`, and logs the failure unless the shell was destroyed.
- `onDestroy()` invalidates the boot transaction and performs best-effort teardown of all
  process and screen owners.
- `loadGameResourceBundle()` returns an already registered bundle or calls
  `assetManager.loadBundle()`. It does **not** coalesce concurrent in-flight first-load
  requests. Loading therefore must establish the bundle before the current Classic and
  foreground loaders begin, unless that helper is separately redesigned.
- `ClassicGameplayController.prepareRecoveredRuntime()` already coalesces its own
  preparation promise, but that does not coalesce unrelated callers of
  `loadGameResourceBundle()`.
- `SharedGameScenePresenter` owns background, leaf, and theme at sibling indices `0`, `1`,
  and `2`; its current screen is index `3`.
- `createDetachedScreenRoot()` creates a detached root with the Canvas world transform and
  layer, which is the correct construction primitive for Loading.
- Existing menu transitions use `replaceCurrentScreen()`, source suspension, destination
  activation, rollback/rearm on reversible failure, and post-commit source disposal.
  Loading is different: there is no previously committed route to restore and no
  `SharedGameScenePresenter` when Loading first appears.

### Recovered native Loading contract

The static evidence report at
`plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-loading-static-contract.md`
recovers the following:

- The real native class is `LoadingScene`, not `LoadingLayer`.
- `AppDelegate::applicationDidFinishLaunching()` calls `LoadingScene::scene()` and then
  `CCDirector::runWithScene()`.
- `LoadingScene::onEnter()` creates exactly four sprites in this order:
  `backgroundLogo`, `loadbkback`, `loadprocess`, `loadbkfront`.
- `backgroundLogo` is centered.
- `loadbkback` is centered at `y = H * 0.25`.
- `loadprocess` uses anchor `(0, 0.5)` and starts at
  `center.x - loadprocess.width / 2`.
- `loadbkfront` is centered over the process sprite.
- `LoadingScene::update(float)` has **62 indexed preload cases**, `0..61` inclusive:
  3 background tracks followed by 59 effects in exact recovered order.
- Progress width is clamped to
  `min(fullWidth, fullWidth * counter / 61)`. The denominator is `61`; it must not be
  rewritten as a 62-step percentage formula.
- A `0.5` second tail precedes `finishLoading()`.
- `finishLoading()` purges native cached data, creates `GameScene`, and calls
  `replaceScene()` with no transition effect.
- No recovered percent-label asset or label construction is present.

The wording “61-step preload” is unsafe. There are 62 cases; `61` is the progress
denominator and final index.

### Exact Loading raster profiles

| Logical path | `480x800` dimensions; bytes; SHA-256 | `720x1280` dimensions; bytes; SHA-256 |
|---|---|---|
| `Loading/backgroundLogo.png` | `480x800`; `269888`; `f87874212a211ee638456720078ea53584568a7ea4f9649bc27f345909e26d8f` | `775x1280`; `379058`; `849003087172b8448318a991a6db94656213edb64d429980033bbd643350d0c2` |
| `Loading/loadbkback.png` | `193x24`; `509`; `c04709d69caab20c7b50961c61d47b100ba837826b9b258467ee79265fe7588b` | `275x35`; `702`; `e622f620535e7f610dfade3836283847ecf1754ce45e4f53a7a85bca638a26b0` |
| `Loading/loadbkfront.png` | `197x28`; `975`; `e23aef27163f179c8a873e74a1791446e28bfcf8edd4b214d56e1e2f4575295e` | `281x40`; `1330`; `bd56ca543c9b9851bfc4f7f4c3ce569054b53e29be6afde44e040655b754262d` |
| `Loading/loadprocess.png` | `185x20`; `2214`; `a1fba149efa7bc89f5ebabdc6078d10c44caae1d375d6de75363dddc9eedf068` | `265x27`; `2207`; `1b31334589e44850ba36eaa81642c5061212d5fd4b12bfe295e515128b04add9` |

The high-profile background is intentionally 775 pixels wide in a 720-wide logical
viewport. Centering at native size produces 27.5 pixels of horizontal bleed on each side.
Scaling it down to 720 would change the recovered composition.

### Concurrent workspace note

At the time of this map, another agent has uncommitted Loading work in:

- `game/assets/scripts/domain/loading-resource-contract.ts`
- `game/assets/scripts/domain/loading-state.ts`
- `game/assets/scripts/domain/loading-presentation.ts`
- `game/assets/scripts/creator/loading-resource-loader.ts`
- `game/assets/scripts/creator/loading-audio-preloader.ts`
- `game/assets/scripts/creator/loading-presenter.ts`
- `game/assets/scripts/creator/recovered-app-viewport.ts`
- `game/assets/scripts/creator/recovered-app-shell-controller.ts`

Those files align with the recommended boundaries below, but they are concurrent work, not
the established `HEAD` baseline. The patch changed while this report was being authored:
Creator `.meta` sidecars and initial pure-domain tests began arriving after the first
observation, while adapter, shell, registry, generated-catalog, and Preview verification
remained in flight. Integration must be judged only after its owner finishes and the gates
in this map pass.

## Recommended target architecture

### Ownership

| Owner | Responsibility | Must not own |
|---|---|---|
| `LoadingResourceContract` | Exact two-tree raster identities and exact 62-item ordered audio preload contract. | Creator nodes, bundle calls, timing, playback. |
| `LoadingState` | Pure `0..61` frame counter, `/61` progress clamp, `0.5s` tail, completion state. | Cocos imports or resource loading. |
| `LoadingPresentation` | Exact anchors, positions, dimensions, and insertion order for the selected viewport/tree. | Lifecycle or bundle loading. |
| `LoadingResourceLoader` | Register/load the `game` bundle first and validate the exact four selected-tree SpriteFrames. | Screen attachment or audio playback. |
| `LoadingAudioPreloader` | Dispatch the exact music/effect warm-up path for each recovered step. | `AudioSource`, volume, playback, or later mode ownership. |
| `LoadingPresenter` | Construct the detached four-node graph, attach it above the Canvas content, apply progress once per update, expose a minimum-display completion gate, and dispose idempotently. | Shell route state, Main Menu construction, cache eviction. |
| `RecoveredAppShellController` | Own the full boot transaction, `activeLoading`, underlay preparation, commit ordering, failed-boot cleanup, and destruction invalidation. | Pixel geometry or duplicate preload tables. |
| Asset-manager bundle cache | Retain warmed audio/resources for later live owners. | UI lifecycle. |
| Existing audio presenters | Load/retain the clips they need and own all actual playback. | Loading progress. |

Loading should remain a **boot sub-owner while shell state is `booting`**. Adding a public
`loading` route state is unnecessary unless an external contract requires it; it would
incorrectly imply Loading participates in normal screen navigation.

### Boot transaction

Recommended sequence:

1. Prepare resolution and create the shared viewport.
2. Derive the selected asset tree directly from the applied resolution.
3. Load and validate the four Loading rasters. This is the sole first request that registers
   the `game` bundle.
4. Create the audio preload adapter from the now-registered bundle.
5. Construct Loading detached, assign `activeLoading`, attach it directly to the Canvas as
   the highest sibling, then activate it.
6. Start the existing Classic and optional destination preparation flow underneath the
   overlay.
7. Each shell update advances exactly one native Loading preload case and updates progress.
   Do not dispatch multiple recovered cases in one frame to “catch up.”
8. Treat the recovered 62-case loop plus `0.5s` tail as a **minimum display gate**. Also wait
   for the existing shell resources and optional preparation chain. Whichever completes
   first waits for the other.
9. Construct shared scene owners and a detached Main Menu while Loading remains visible.
10. Attach and activate Main Menu behind Loading.
11. Commit `activeMainMenu` and shell state `main-menu`.
12. Synchronously set the Loading root inactive so no partial or duplicate frame can render,
    then dispose it best-effort and clear `activeLoading`.

Keeping Loading visible after its recovered minimum gate when Creator still prepares the
destination is an explicit target adaptation. Removing it at `0.5s` while Main Menu is not
ready would expose a blank or partially constructed persistent scene. Conversely, holding
the progress bar at full until destination commit preserves a coherent boot surface.

The shell can express the two gates as equivalent to:

```text
await both(
  exact Loading preload/tail completion,
  existing recovered runtime and foreground preparation
)
commit Main Menu
hide Loading
```

It is acceptable for the two gates to execute concurrently after Loading owns the screen,
provided Loading remains the only first bundle registrar.

### Audio preload semantics

- Preserve the recovered path order and the distinction between the first three background
  tracks and the following 59 effects.
- Use preload/cache-warm semantics. Loading must not create `AudioSource` nodes or produce
  audible output.
- Progress represents **dispatch of recovered preload cases**, matching the native call
  sequence. Do not block each frame on decode completion unless new evidence proves the
  native calls were synchronous.
- Later mode-specific presenters may request those clips again through their existing APIs;
  Creator's bundle cache should satisfy the repeated access. Do not broaden this checkpoint
  into a shared audio-catalog refactor.
- A synchronous adapter error must not escape from the component `update()` loop and leave
  boot hanging. The presenter should convert it into a rejected/failed completion signal
  consumed by the shell boot transaction.
- Cancellation/destruction must make later callbacks no-ops and must not reattach or commit
  a screen.

### Native cache purge adaptation

Do not literally map native `purgeCachedData()` to `assetManager.releaseUnusedAssets()`,
`bundle.releaseAll()`, `assetManager.removeBundle()`, or per-clip release during handoff.
The Creator application deliberately warms the same bundle that Classic and the optional
routes consume immediately afterward. A global purge would invalidate that ownership and
can reintroduce races or use-after-release behavior.

For this checkpoint, record the native purge as an engine-lifecycle difference and retain
the Creator bundle process-wide. A narrower cache policy should be added only with Creator
profiling evidence and explicit ownership tests.

## Commit, rollback, and teardown matrix

| Failure point | Required result |
|---|---|
| Resolution preparation fails | No Loading owner exists; existing shell boot failure contract applies. |
| Loading bundle or raster validation fails | Never attach a partial Loading graph. Dispose any constructed nodes, fail boot, emit the normalized shell failure. |
| Loading presenter construction/activation fails | Destroy the detached/partially attached graph; clear `activeLoading`; fail boot. |
| Audio preload dispatch fails synchronously | Stop Loading updates, reject its completion gate, clean the boot transaction, and fail closed. Never advance as if the step succeeded. |
| Classic/base required preparation fails | Tear down the required runtime's partial owners and Loading; fail boot. |
| Crazy/Bird/Combo/GN optional preparation fails | Preserve the existing isolated behavior. Loading and required Main Menu boot continue. |
| Shared-scene/Main Menu construction or attachment fails before commit | Dispose destination, achievement host, shared scene/leaf, collision filter, and required playback owners using the existing best-effort order; then dispose Loading and fail boot. There is no old route to restore. |
| Shell is destroyed during any await | Invalidate boot, stop updates, dispose Loading idempotently, and require every continuation to pass `assertBootStillCurrent()` before mutation. |
| Main Menu activates successfully | This is the destination commit. Store its owner and state before Loading teardown. |
| Loading teardown fails after Main Menu commit | Log/best-effort cleanup only. Do **not** roll back or destroy the committed Main Menu. The Loading root must already be synchronously inactive. |
| Repeated `bootRecoveredApp()` call | Return the same boot promise; never create a second Loading owner. |
| Repeated `dispose()` | Return an idempotent no-op result; never release the process bundle or another presenter's clips. |

The post-commit rule is important. `loading.dispose()` must not remain inside a catch region
that interprets a disposal exception as a failed Main Menu commit.

## Resource consumer promotion

### Registry change

Add a `loading` member to `ResourceConsumerId` and one source entry whose values include:

- both profiles of the Loading raster contract;
- all 62 canonical audio preload paths with string collection enabled.

Expected registry effect:

| Metric | Before | After |
|---|---:|---:|
| Consumer roots | 17 | 18 |
| Loading-owned canonical paths | 0 | 70 |
| Unique consumed paths | 743 | 761 |
| Unknown paths | 108 | 90 |
| Excluded paths | 10 | 10 |
| Unsupported paths | 1 | 1 |
| Disposition-expanded paths | 119 | 101 |
| Runtime consumer coverage | 86.19% | 88.28% |
| Reconciliation coverage | 100% | 100% |

The ten newly promoted audio paths are:

1. `Sounds/fruitfail.wav`
2. `Sounds/get_coins.wav`
3. `Sounds/juice1.wav`
4. `Sounds/juice2.wav`
5. `Sounds/juice3.wav`
6. `Sounds/juice4.wav`
7. `Sounds/kiwi.wav`
8. `Sounds/orange.wav`
9. `Sounds/pineapple.wav`
10. `Sounds/scorescreen.wav`

Remove the complete `loading-surface-not-yet-restored` and
`orphan-audio-play-sites-unrecovered` entries from
`forensics/resources/resource-disposition-map.json`. The first expands to the 8 Loading
rasters; the second contains exactly the 10 paths above. These are now proven Loading
preload consumers even though some paths' eventual playback event remains unknown.

The 52 audio paths already consumed elsewhere retain their existing owner IDs and gain
`loading`; they do not increase the unique consumed count.

No resource bytes need to be copied or renamed. All 70 Loading-owned paths are already in
the staged bundle. This checkpoint changes exact ownership and generated reconciliation
metadata.

## Exact file and test map

### Create

| File | Purpose |
|---|---|
| `game/assets/scripts/domain/loading-resource-contract.ts` + `.meta` | Exact four-raster profiles and ordered 62-audio contract. |
| `game/assets/scripts/domain/loading-state.ts` + `.meta` | Pure indexed preload/progress/tail state. |
| `game/assets/scripts/domain/loading-presentation.ts` + `.meta` | Exact native placement and insertion order. |
| `game/assets/scripts/creator/loading-resource-loader.ts` + `.meta` | Selected-tree exact raster loader and first-bundle boundary. |
| `game/assets/scripts/creator/loading-audio-preloader.ts` + `.meta` | Non-playing exact preload adapter. |
| `game/assets/scripts/creator/loading-presenter.ts` + `.meta` | Detached four-node overlay, update projection, completion gate, lifecycle. |
| `tests/reconstruction/vertical-slice/loading-resource-contract.test.ts` | Counts, order, music/effect split, identities, immutability, and `.meta` checks. |
| `tests/reconstruction/vertical-slice/loading-state.test.ts` | Cases `0..61`, denominator `61`, clamp, `0.5s` tail, invalid delta, terminal idempotence. |
| `tests/reconstruction/vertical-slice/loading-presentation.test.ts` | Compact/high geometry, anchors, insertion order, high-background bleed. |
| `tests/reconstruction/vertical-slice/loading-resource-loader.test.ts` | Exact path batch, geometry/identity validation, missing/duplicate/substitution/failure behavior. |
| `tests/reconstruction/vertical-slice/loading-audio-preloader.test.ts` | Exact canonical-to-bundle path dispatch, types, order validation, and no playback owner. |
| `tests/reconstruction/vertical-slice/loading-presenter.test.ts` | Detached construction, four-child order, top attachment, one step/update, failure signal, completion, hide/dispose/destruction behavior. |

Every new TypeScript file needs a valid unique Creator `.meta` sidecar matching the existing
`typescript` importer shape. The Loading contract test should enforce all six.

### Modify

| File | Required change |
|---|---|
| `game/assets/scripts/creator/recovered-app-shell-controller.ts` | Add shell-owned Loading boot transaction, update, failure cleanup, commit ordering, and destruction cleanup. |
| `game/assets/scripts/creator/recovered-app-viewport.ts` | Explicitly include the Loading viewport/point contract in the shared intersection and documentation. |
| `game/assets/scripts/domain/resource-consumer-registry.ts` | Add `loading` root, both raster trees, and all 62 preload audio strings. |
| `forensics/resources/resource-disposition-map.json` | Remove the two now-consumed 18-path disposition groups. |
| `scripts/generate-resource-reconciliation-ledger.mjs` | Update exact expected counts to `761` consumed and `101` disposition-expanded paths. |
| `tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts` | Prove order, two-gate boot, first-bundle ownership, failure cleanup, destroy-during-await, no duplicate Loading, and post-commit cleanup policy. |
| `tests/reconstruction/vertical-slice/recovered-app-viewport.test.ts` | Prove Loading is an explicit shared viewport contract and retain compact/high/offset cases. |
| `tests/reconstruction/vertical-slice/creator-scene-integration.test.ts` | Prove the serialized component order remains unchanged and Loading is dynamically shell-owned, not a second serialized route owner. |
| `tests/reconstruction/vertical-slice/resource-consumer-registry.test.ts` | Assert 18 roots, 761 unique paths, the Loading 70-path closure, ten audio promotions, and 101 remaining dispositions. |
| `tests/generate-resource-reconciliation-ledger-test.mjs` | Update exact summary, output, and disposition expansion expectations. |
| `tests/stage-creator-assets-test.mjs` | Update generated manifest counters and `consumer_coverage=88.28%`. |
| `plans/260721-2253-pencil-blade-restoration/plan.md` | Record the completed Loading checkpoint and exact new counts only after verification. |
| `plans/260721-2253-pencil-blade-restoration/phase-06-recreate-full-game-content-and-progression.md` | Replace the Loading next-step gap with verified status and reduce unknown count. |
| `docs/system-architecture.md` | Document transient Loading ownership, target adaptation, and handoff transaction. |
| `docs/cocos-creator-contract-map.md` | Add Loading contract/tests/Preview evidence and update ledger counts. |
| `docs/codebase-summary.md` | Add Loading implementation surface and update 18-root/761-path metrics and test evidence. |
| `docs/project-overview-pdr.md` | Update runtime-consumer metrics and Loading status. |
| `docs/evidence-register.md` | Recompute ledger/manifest hashes and byte sizes after deterministic regeneration. |

### Regenerate, never hand-edit

- `assets/catalog/resource-reconciliation-ledger.json`
- `assets/catalog/creator-staging-manifest.json`

Generate them into a temporary directory first, verify the diff and counts, then replace the
checked-in whole files through the repository's established workflow. Their evidence-register
hashes and sizes must describe the final generated bytes.

### Keep unchanged

- `game/assets/scenes/classic.scene`
- `game/assets/scenes/classic.scene.meta`
- `game/profiles/v2/packages/preview.json`
- `game/assets/scripts/creator/main-menu-presenter.ts`
- `game/assets/scripts/creator/shared-game-scene-presenter.ts`
- `game/assets/scripts/creator/detached-screen-root.ts`
- `game/assets/scripts/creator/classic-audio-presenter.ts`
- `game/assets/scripts/creator/game-resource-loader.ts`

The Loading presenter is created dynamically by the existing serialized shell, so no scene
UUID or Canvas component change is required. `game-resource-loader.ts` can remain unchanged
if Loading strictly establishes the bundle before every other caller. Adding general
in-flight bundle coalescing is useful hardening but outside the minimum Loading checkpoint.

## Test and verification gates

### Focused pure/adapter gates

```sh
node --test \
  tests/reconstruction/vertical-slice/loading-resource-contract.test.ts \
  tests/reconstruction/vertical-slice/loading-state.test.ts \
  tests/reconstruction/vertical-slice/loading-presentation.test.ts \
  tests/reconstruction/vertical-slice/loading-resource-loader.test.ts \
  tests/reconstruction/vertical-slice/loading-audio-preloader.test.ts \
  tests/reconstruction/vertical-slice/loading-presenter.test.ts
```

### Integration and ledger gates

```sh
node --test \
  tests/reconstruction/vertical-slice/recovered-app-viewport.test.ts \
  tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts \
  tests/reconstruction/vertical-slice/creator-scene-integration.test.ts \
  tests/reconstruction/vertical-slice/resource-consumer-registry.test.ts

node --test \
  tests/generate-resource-reconciliation-ledger-test.mjs \
  tests/stage-creator-assets-test.mjs \
  tests/validate-creator-resource-meta-test.mjs
```

### Full gates

```sh
node --test tests/reconstruction/vertical-slice/*.test.ts
node --test tests/*.mjs

node \
  /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js \
  -p game/tsconfig.json \
  --pretty false \
  --noEmit

git diff --check
```

Also run the existing production ledger `verify`, staging `verify`, and resource-meta audit
commands after regeneration. Expected final summary:

```text
staged=862 consumed=761 unknown=90 excluded=10 unsupported=1
consumer_coverage=88.28%
reconciliation_coverage=100%
```

No validation command in this checkpoint requires executing the APK, `.so`, emulator, or
legacy runtime.

## Creator Preview acceptance

Run fresh browser Preview starts at physical widths that select both profiles:

| Check | Compact branch | High branch |
|---|---|---|
| Physical selection | Width below `720`; acceptance target `480x800` | Width `720`; acceptance target `720x1280` |
| Logical center | `(240, 400)` | `(360, 640)` |
| Background | `480x800`, centered, no scaling | `775x1280`, centered at native size; 27.5 px bleed/crop each side |
| Bar Y | `200` | `320` |
| Back | `193x24`, centered | `275x35`, centered |
| Progress | `185x20`, anchor `(0, 0.5)`, left X `147.5` | `265x27`, anchor `(0, 0.5)`, left X `227.5` |
| Front | `197x28`, centered above progress | `281x40`, centered above progress |

Required behavior:

- Only the four recovered images appear; no spinner, percent label, invented copy, or
  fallback art.
- Layering is background, back, process, front.
- The process sprite fills left-to-right, never shrinks, reaches full width under the `/61`
  contract, and remains clamped on the last indexed case.
- Exactly one recovered preload case is dispatched per active update; the first three use
  background-track preload semantics and the remaining 59 use effect preload semantics.
- The surface remains for at least the recovered `0.5s` tail after the preload sequence.
- If destination preparation is slower, Loading stays visibly full until Main Menu commit.
- Shared background/theme/leaf and Main Menu never flash above Loading during preparation.
- Handoff has no fade, slide, or invented transition.
- Loading takes no input and produces no sound.
- Main Menu is active and interactive immediately after Loading disappears.
- Cold start, immediate reload, and repeated Preview start do not create duplicate Loading
  roots, duplicate Main Menus, or first-bundle race errors.
- Destroy/reload during boot leaves no updating orphan root.
- Browser console has no errors, promise rejections, missing-resource messages, or Creator
  invalid-node warnings.

Capture screenshots at initial Loading, partial progress, full/tail, and first Main Menu frame
for both profiles. Use the Creator hierarchy/Node inspector to confirm native dimensions,
anchors, sibling order, and absence of a second serialized scene component.

## Safe implementation slices and file ownership

| Slice | Owner boundary | Dependencies | May run in parallel |
|---:|---|---|---|
| 1 | Static contract review only; settle exact path order and native timing evidence | Checked-in forensic evidence | Complete before code claims are frozen |
| 2 | Loading domain files, their `.meta` files, and pure tests | Slice 1 | Yes, independent of ledger generation |
| 3 | Loading resource loader, audio preloader, presenter, `.meta` files, and adapter tests | Slice 2 contracts | Yes, while a different owner prepares registry inputs; do not edit shell |
| 4 | Resource registry, dispositions, generator expectations, generated ledger/manifest, and ledger tests | Slice 2 contract exports | Yes, but one owner must own all generated artifacts and counts |
| 5 | Shell and viewport integration plus shell/viewport/scene-integration tests | Slices 2 and 3 | No overlapping shell edits |
| 6 | Full gates, Preview at both profiles, and documentation/evidence hash synchronization | Slices 4 and 5 | Final single-owner integration |

Do not split ownership of:

- `recovered-app-shell-controller.ts`;
- `resource-consumer-registry.ts`;
- `resource-disposition-map.json`;
- either generated catalog artifact;
- the count-bearing docs.

Concurrent agents must not edit the same shared file or replace another agent's uncommitted
work. The integration owner should review the current in-flight Loading patch against this
map before continuing.

## Risks and unresolved questions

1. **Native-scene versus Creator-overlay adaptation.** Native replaces a real
   `LoadingScene` with `GameScene`; Creator keeps one serialized scene and replaces only a
   transient overlay. This is intentional and must be documented, not presented as byte-for-byte
   lifecycle equivalence.
2. **Native cache purge has no safe direct mapping yet.** Creator bundle ownership makes a
   global purge actively risky. Omit it until profiling proves a narrow safe policy.
3. **Preload dispatch is not playback ownership.** Promoting the ten orphan audio paths proves
   a Loading consumer, but does not recover their eventual audible gameplay events.
4. **Progress is frame-driven.** Slow or throttled browser frames stretch wall-clock display
   time. Advancing multiple cases per frame would be less faithful and should not be added
   without a product decision.
5. **Failure channel from `update()`.** A thrown preload-adapter error must reject the shell's
   boot gate instead of escaping the Creator update loop.
6. **Post-commit cleanup isolation.** A Loading destruction failure must not tear down an
   already committed Main Menu.
7. **High-profile intentional crop.** Generic fit-to-width helpers would incorrectly scale
   the 775-wide background.
8. **Resource rights remain unresolved.** Technical consumer recovery does not clear
   redistribution rights for the recovered art, fonts, or music.
9. **Concurrent implementation was still changing at the reporting cutoff.** Initial
   `.meta` files and pure-domain tests arrived during mapping, but registry promotion,
   generated catalogs, docs, full verification, and Preview evidence were not complete.
   Do not infer a passed checkpoint from the presence of uncommitted source files.

Status: DONE_WITH_CONCERNS
Summary: mapped the established shell boot path and the exact recovered Loading contract, defined a one-scene transient-overlay transaction, enumerated files/tests/Preview gates, and corrected promotion to 761 consumed paths with 90 unknowns and 88.28% coverage.
Concerns/Blockers: target adaptation differs from native scene replacement and cache purge; the concurrent Loading patch still requires metas, tests, registry/catalog regeneration, post-commit cleanup isolation, full gates, and two-profile Preview evidence.

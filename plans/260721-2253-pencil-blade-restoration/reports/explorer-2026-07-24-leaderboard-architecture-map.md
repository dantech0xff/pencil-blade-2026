---
title: Leaderboard six-mode architecture map
type: explorer
date: 2026-07-24
status: done
scope: static-only gap analysis and safest Creator integration for the standalone Leaderboard screen
baseline-head: 523e34114ca50df7b3d292f9e462654840c83c30
evidence-policy: current source, tests, extracted resources, symbols, and direct Thumb disassembly only
---

# Leaderboard Six-Mode Architecture Map

## Decision

Implement one dedicated, read-only `LeaderboardPresenter` on the existing detached-screen and
transactional app-shell seams. It should display the six process-owned Settings leaderboards in
native order and return immediately to a fresh Main Menu.

The implementation does **not** need another persistence owner, ranking algorithm, gameplay
controller, serialized scene component, physics lease, blade renderer, particle system, network
bridge, or platform bridge. Those additions would duplicate behavior already owned elsewhere or
invent behavior absent from the native screen.

The minimum production slice is:

1. a pure six-panel rail state;
2. a pure native layout/presentation snapshot;
3. an exact ten-raster/two-font resource contract and loader;
4. one Creator presenter using the existing global touch adapter with cutting disabled;
5. explicit Main Menu -> Leaderboard and Leaderboard -> Main Menu app-shell transactions.

The current production data is already sufficient. All six ordered top-three boards are loaded
into `ClassicSettingsState`, updated by their gameplay Result owners, retained in memory, and
saved by the process-owned runtime on app hide or Main Menu exit. The standalone Leaderboard must
only copy and render them.

## Evidence Boundary and Concurrent-Work Warning

The required root `README.md` does not exist. `forensics/README.md`, Phase 6, current docs, source,
tests, resources, and the native ELF supplied the needed context.

Native evidence is static:

```text
.forensics-work/phase-01/native/libgame.so
SHA-256 55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e
ELF 32-bit little-endian ARM, EABI5, stripped
```

No APK, original activity, emulator, native runtime, or original Leaderboard route was executed.

The companion evidence report is
[`researcher-2026-07-24-leaderboard-native-contract.md`](./researcher-2026-07-24-leaderboard-native-contract.md).
Its direct disassembly owns native claims; this report owns the target integration decision.

The working tree contains concurrent standard-blade work. In particular, these proposed shared
integration files are already modified by another worker:

```text
game/assets/scripts/creator/main-menu-presenter.ts
game/assets/scripts/creator/recovered-app-shell-controller.ts
tests/reconstruction/vertical-slice/main-menu-presenter.test.ts
tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts
tests/reconstruction/vertical-slice/creator-scene-integration.test.ts
docs/cocos-creator-contract-map.md
docs/codebase-summary.md
docs/project-overview-pdr.md
docs/system-architecture.md
plans/260721-2253-pencil-blade-restoration/plan.md
plans/260721-2253-pencil-blade-restoration/phase-06-recreate-full-game-content-and-progression.md
```

The Leaderboard implementer must merge into their current contents and must not restore them to
HEAD. New Leaderboard-owned files have distinct ownership and can be implemented independently
until the final shell/menu wiring step.

Confidence labels below:

- **Recovered**: direct native instruction, native string/symbol, extracted resource, or exact
  current persisted contract.
- **Existing**: already implemented and tested in the current Creator source.
- **Target decision**: the smallest integration adaptation consistent with recovered behavior
  and current ownership rules.

## Current Path and Exact Gap

The route is already recovered in the Main Menu domain:

- leaderboard FruitButton purpose uses target ID `13`;
- accepting it changes Main Menu navigation state to `2`;
- it disables cutting and waits `0.75s`;
- the delayed destination is `LeaderboardLayer`, attached to the captured parent at z-order `1`;
- after a successful destination callback, Main Menu stops background music when music is enabled.

`main-menu-state.ts`, its presentation contract, assets, and state tests already cover that
behavior. They do not need to change.

The route fails at the Creator boundary:

- `MainMenuPresenterLifecycle` has dedicated callbacks only for Mode Select and Options;
- `MainMenuUnsupportedDestination` still includes `LeaderboardLayer`;
- delayed Leaderboard navigation therefore calls `onUnsupportedDestinationRequested`;
- `RecoveredAppShellController` emits
  `RECOVERED_APP_SHELL_UNSUPPORTED_DESTINATION_EVENT`, returns `false`, and rearms Main Menu.

The shell also has no:

- `'leaderboard'` state;
- loaded Leaderboard resource catalog;
- active Leaderboard presenter owner;
- update or destroy forwarding;
- Main Menu -> Leaderboard transaction;
- Leaderboard -> Main Menu transaction.

This is a presentation/wiring gap, not a ranking or Settings gap.

## Existing Contracts to Reuse

| Existing owner | Reusable contract | Leaderboard use |
|---|---|---|
| `main-menu-state.ts` | target ID `13`, destination state `2`, `0.75s` delayed handoff, z-order `1`, post-commit music stop | Keep unchanged; route it to a dedicated lifecycle callback. |
| `classic-settings-state.ts` / `classic-settings-runtime.ts` | six ordered signed-int32 top-three boards and process-owned load/save | Read only. Never call a score-recording method or save from the screen. |
| six `*-result-ranking.ts` modules | board types plus `*LeaderboardPanelValues` helpers | Validate/copy the displayed `[first, second, third]` order without reimplementing ranking logic. |
| `recovered-result-ranking.ts` | shared ordered board validation and panel conversion for five modes | Reuse through the mode wrappers; do not invoke insertion/reward APIs. |
| `resolution-profile-service.ts` / `recovered-app-viewport.ts` | exact `480x800` or `720x1280` asset tree and logical/visible geometry | Build the layout from the already-selected process profile. |
| `classic-resource-contract.ts` | `ClassicRasterResource` and canonical bundle-path conversion | Use for the ten exact raster contracts. |
| `game-resource-loader.ts` | single game-bundle owner and exact raster loading | Load all Leaderboard assets during shell boot. |
| `detached-screen-root.ts` | detached foreground root matching Canvas world transform | Construct before the shell transaction; activate only after attachment. |
| `BladeInputController` | process-shared global touch subscription and began/moved/ended payloads | Acquire the single input lease, set cutting `false`, and translate raw movement into the recovered horizontal gesture callbacks. |
| Mode Select gesture bridge | horizontal classification `abs(dx) > abs(dy)` and last-segment flick threshold `> 1` | Use the same Creator replacement for the native shared `CCGesturesLayer`; render no blade and perform no raycast. |
| `SharedGameScenePresenter` | one foreground screen with replace/restore ownership checks | Replace Main Menu/Leaderboard roots transactionally. |
| `OptionsPresenter` + shell Options transitions | immediate Back transaction, suspend/rearm/dispose, rollback compensation | Use the same lifecycle shape, generalized to a third menu-like screen owner. |
| shared audio presenter | canonical one-shot and Main Menu background-music requests | Effects-gated Back click only; Main Menu constructor/activation owns restarting menu music. |

## Six Persisted Boards: One Explicit Mapping

The mapping must be encoded once as an immutable tuple or exhaustive record. Do not derive it
from filenames or property enumeration: the three Bird boards have different persisted key order
than their display order in the current Settings implementation.

| Native index | Mode | Read-only Settings source | Persisted keys | Existing panel helper | Header |
|---:|---|---|---|---|---|
| `0` | Classic | `state.snapshot.leaderboard` | `classic_best_1`, `classic_best_2`, `classic_best_3` | `classicLeaderboardPanelValues` | `leaderboard_classic.png` |
| `1` | Crazy | `state.snapshot.crazyLeaderboard` | `crazy_best_1`, `crazy_best_2`, `crazy_best_3` | `crazyLeaderboardPanelValues` | `leaderboard_crazy.png` |
| `2` | Gangnam Style | `state.gnStyleLeaderboard` | `gnstyle_best_1`, `gnstyle_best_2`, `gnstyle_best_3` | `gnStyleLeaderboardPanelValues` | `leaderboard_gnstyle.png` |
| `3` | Classic Bird | `state.birdClassicLeaderboard` | `bird_classic_best_1`, `bird_classic_best_2`, `bird_classic_best_3` | `classicBirdLeaderboardPanelValues` | `leaderboard_classic_bird.png` |
| `4` | Crazy Bird | `state.birdCrazyLeaderboard` | `bird_crazy_best_1`, `bird_crazy_best_2`, `bird_crazy_best_3` | `crazyBirdLeaderboardPanelValues` | `leaderboard_crazy_bird.png` |
| `5` | Combo Bird | `state.birdComboLeaderboard` | `bird_combo_best_1`, `bird_combo_best_2`, `bird_combo_best_3` | `comboBirdLeaderboardPanelValues` | `leaderboard_combo_bird.png` |

Current Settings tests already prove:

- all six key triples load and save;
- missing values default to `0`;
- each value is a signed int32;
- each triple remains ordered;
- the six boards remain independent;
- all 50 integers and 4 booleans retain their exact bulk order.

No Settings schema, runtime, storage port, load order, save order, or recovery behavior should
change for this screen.

## Recovered Native Screen Contract

### Construction and content

`LeaderboardLayer::onEnter` at `0x00159420` constructs exactly six `LeaderboardItem`s in the table
order above. Initial item world positions are:

```text
x(i) = (i + 0.5) * logicalWidth
y(i) = 0.475 * logicalHeight
currentIndex = 0
```

Each item contains:

- shared `Leaderboard/leaderboard_view_templete.png`;
- its mode-specific header centered at local `x = 0`,
  `y = 0.5 * 1.085 * templateHeight`;
- `Player 1`, `Player 2`, `Player 3` in `Fonts/Andyb.ttf`;
- scores formatted with `%d` in `Fonts/Century.ttf`;
- player point size `(logicalWidth / 480) * 30`;
- score point size `(logicalWidth / 480) * 40`.

Player and score labels are children of the template. Their local row positions use the template
content width and height, not screen dimensions:

```text
x = 0.45 * templateWidth
y = [0.85, 0.55, 0.275] * templateHeight
```

Player colors by rank are `(255,0,0)`, `(0,128,255)`, `(0,185,0)`.
Score colors are `(128,0,0)`, `(0,56,128)`, `(0,28,0)`.
The score anchor is `(1.25,-0.75)`. No native setter for the player anchor was found, so the
engine default is the only supportable target behavior.

The global title uses anchor `(0.5,1)`, starts at
`(visibleCenter.x, visibleTop.y + titleHeight)`, and moves to
`(visibleCenter.x, visibleTop.y)` over `1.0s`.

### Horizontal rail and snap

The layer uses the same `CCGesturesLayer` class as Mode Select:

1. each moved event emits drag first when `abs(deltaX) > abs(deltaY)`;
2. diagonal ties classify as vertical and do not reach Leaderboard;
3. touch end uses the retained **last move segment**, not total displacement;
4. if that segment's Euclidean length is strictly greater than `1.0`, horizontal flick fires;
5. the same physical move can therefore produce drag and then flick;
6. Leaderboard's flick callback adds no magnitude threshold and only checks `deltaX` sign.

Drag applies the complete event delta to all six items; it does not partially clamp:

- `deltaX < 0` is accepted while the last item's x is at or right of literal `0.0`;
- `deltaX > 0` is accepted while the first item's x is at or left of raw logical width `W`;
- zero or a rejected delta moves nothing;
- nearest-to-`0.5W` index recomputation still runs after every drag callback.

The native nearest scan starts with index `-1`, best distance `W`, and replaces the index only
for a strict smaller distance. A pathological single-segment overshoot can therefore leave the
native index at `-1`, after which native `update` performs an unsafe vector access. The target
model must retain the prior valid index when that scan finds no card. This is an explicit safety
hardening outside normal viewport-bounded gesture behavior, not a recovered native guard.

Flick changes the current index by sign and clamps to `0...5`:

```text
deltaX > 0  -> currentIndex - 1
deltaX < 0  -> currentIndex + 1
```

While the gesture is not pressed, every native update frame centers the current item. With:

```text
error = 0.5W - currentItemX
```

the applied translation for all items is:

```text
abs(error) > 2  -> 0.1 * error + abs(error) / error
0 < abs(error) <= 2 -> error
error == 0 -> 0
```

This is frame-based and ignores `deltaSeconds`. Do not normalize it by time, add easing, or suppress
the flick because drag already happened.

### Back and audio

The visible Back button uses:

- `Buttons/button-blue-back-normal.png`;
- `Buttons/button-back-selected.png`;
- initial center at
  `(visibleRect.left.x - 0.5 * buttonWidth, visibleRect.bottom.y + 0.5 * buttonHeight)`;
- simultaneous `1.0s` move right by one button width and `360deg` rotation;
- menu attachment at z-order `1`.

Mobile hardware Back calls the same navigation path. Native Back at `0x00158f20`:

1. captures the parent;
2. removes Leaderboard with cleanup;
3. constructs and attaches a fresh Main Menu at z-order `1`;
4. if effects are enabled, requests non-looping `Sounds/menubuttonclick.wav`.

The Main Menu constructor owns starting its looping music when enabled. Leaderboard itself owns no
background audio, particles, gameplay mutation, Settings write, network request, or platform call.

## Exact Resource Closure

All required files and Creator `.meta` sidecars are already staged under `game/assets/game`; no
asset copy or rename is needed.

The new contract should expose exactly ten profile rasters:

```text
Leaderboard/leaderboard_title.png
Leaderboard/leaderboard_view_templete.png
Leaderboard/leaderboard_classic.png
Leaderboard/leaderboard_crazy.png
Leaderboard/leaderboard_gnstyle.png
Leaderboard/leaderboard_classic_bird.png
Leaderboard/leaderboard_crazy_bird.png
Leaderboard/leaderboard_combo_bird.png
Buttons/button-blue-back-normal.png
Buttons/button-back-selected.png
```

| Resource family | `480x800` | `720x1280` |
|---|---:|---:|
| template | `540x586` | `773x844` |
| title | `552x118` | `793x159` |
| Classic/Crazy/Classic Bird/Combo Bird header | `466x115` | `663x137` |
| GN Style header | `466x115` | `663x138` |
| Crazy Bird header | `466x115` | `663x138` |
| Back normal | `144x124` | `180x150` |
| Back selected | `144x124` | `181x150` |

Shared file contracts:

| Resource | Bytes | SHA-256 |
|---|---:|---|
| `Fonts/Andyb.ttf` | `42,432` | `13cb6762ba5a38853bc338367178b1c7647ad3d2fc407e8953afdc42b1af12d6` |
| `Fonts/Century.ttf` | `165,248` | `21be61ff5289c2125dbb48e2a739fd4dd98c3e58b37abfc22cc0412dd8376d95` |
| `Sounds/menubuttonclick.wav` | `32,812` | `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e` |

The loader should use `loadGameResourceBundle()` once, then load the ten exact rasters and both
fonts concurrently. Audio remains a canonical-path request through the shared audio presenter,
matching Main Menu, Mode Select, and Options.

## Proposed Module Contracts

### `domain/leaderboard-state.ts`

Own only behavior that is independent of Creator:

- `LeaderboardModeId` and `LeaderboardIndex`;
- immutable native mode-order tuple;
- immutable six-board input/snapshot;
- copied/validated panel values using the existing six ranking helpers;
- six item x positions and `currentIndex`;
- whole-delta `drag(deltaX)`;
- sign-only, clamped `flick(deltaX)`;
- frame-based `updateFrame(pressed)` snap result.

Recommended invariants:

- exactly six boards and exactly three scores per board;
- finite positive logical width;
- only signed-int32 scores in descending order;
- finite drag/flick input;
- index always in `0...5`;
- all six x positions move by the identical float32 delta;
- `updateFrame(true)` never snaps;
- snapshots and returned command/result objects are deeply frozen.

Do not put audio, Nodes, resources, persistence, score insertion, reward calculation, or a
`deltaSeconds` multiplier into this model.

### `domain/leaderboard-presentation.ts`

Build one immutable snapshot from:

- asset tree;
- logical width/height plus visible rect;
- the six copied board values.

It should own:

- item, title, Back, header, template, player-label, and score-label geometry;
- point-size formulas, label text, colors, anchors, insertion order, z-orders;
- title and Back entry action plans;
- canonical fonts and Back-audio path;
- the exact resource selected for each native mode index.

The presentation builder must not read mutable Settings itself. That keeps layout tests pure and
prevents presentation construction from observing half of one Settings mutation and half of
another.

### `domain/leaderboard-resource-contract.ts`

Expose:

- `LEADERBOARD_RASTER_RESOURCE_COUNT = 10`;
- `LEADERBOARD_PLAYER_FONT_CANONICAL_PATH = 'Fonts/Andyb.ttf'`;
- `LEADERBOARD_SCORE_FONT_CANONICAL_PATH = 'Fonts/Century.ttf'`;
- `LEADERBOARD_BACK_AUDIO_CANONICAL_PATH = 'Sounds/menubuttonclick.wav'`;
- a profile with title, template, six explicitly named headers, and two-frame Back resources;
- exact dimensions and shared file hashes.

Keep header fields semantic and exhaustive. An array assembled by filename sorting is too easy to
mis-map.

### `creator/leaderboard-resource-loader.ts`

Return a frozen `LoadedLeaderboardResources` with:

- `assetTree`;
- `playerFont`;
- `scoreFont`;
- `rasterCount: 10`;
- exact-path `raster(resource)` lookup with dimension verification.

The collector should reject duplicates or a profile that does not contain exactly ten rasters.

### `creator/leaderboard-presenter.ts`

Recommended input ports:

```text
audio: { playOneShot(canonicalPath) }
bladeInput: { node, activateForClassicLayer, deactivateForNonClassicScreen, setCutEnabled }
canvas
lifecycle: { onMainMenuRequested(transaction) }
resources
settings: narrow read-only state port
viewport
```

The Settings port should expose only:

- contemporaneous `effectsEnabled`;
- Classic and Crazy snapshot boards;
- GN Style and three Bird read-only board getters.

It must expose no `save`, `writeInt32`, `record*ResultScore`, coin, selection, or reward method.
Copy all six boards exactly once during `create`; consult `effectsEnabled` again only when Back is
accepted.

Presenter lifecycle:

1. `create` validates inputs, copies all six boards, creates a detached inactive root, constructs
   all nodes, and registers no global listener.
2. `activate` requires a valid active host, activates the root, registers Back/key/blade events,
   acquires the shared `BladeInputController` lease, then calls `setCutEnabled(false)`.
3. began/moved/ended payloads track one active touch and implement the same horizontal
   classification and last-segment flick rules as Mode Select. No `StandardBladePresenter` is
   constructed and no raycast occurs.
4. `update` advances the `1.0s` title/Back entry actions and applies the pure frame snap exactly
   once per shell frame.
5. `suspendForTransition` unregisters every listener, deactivates the input owner, clears the
   gesture, marks suspended, and returns `false` if it did not own an active lease.
6. `rearmNavigationAfterFailure` requires the source root to be host-attached, reacquires input,
   keeps cutting disabled, restores listeners, clears `navigationPending`, and preserves the same
   board/rail instance.
7. `dispose` is idempotent, unregisters input/key/button listeners best-effort, releases the input
   lease once, destroys the root, and aggregates cleanup failures.

Back button touch start selects the pressed frame; end restores normal and requests Main Menu;
cancel restores normal without navigating. Mobile Back uses the same request method.

The navigation transaction should be:

```text
destination: 'MainMenuLayer'
root: presenter.root
timing: 'immediate'
zOrder: 1
```

Set `navigationPending` before calling the host so duplicate visible/hardware Back events cannot
race. On `false` or throw, restore/rearm the same source screen without replaying entry animation
or rereading boards. Only after the lifecycle callback confirms the fresh Main Menu was attached
may the effects-gated Back one-shot run; native `backCallback` performs the replacement first and
plays `menubuttonclick.wav` second. Treat that sound as post-commit work so a sound-port failure
cannot roll back an already committed screen replacement.

### Main Menu Presenter

Make Leaderboard an explicit supported route:

- add `onLeaderboardRequested(transaction)` to `MainMenuPresenterLifecycle`;
- redefine `MainMenuUnsupportedDestination` so it excludes both `ModeSelectLayer` and
  `LeaderboardLayer` from delayed destinations, while About remains unsupported;
- in `completeDelayedNavigation`, dispatch `LeaderboardLayer` to its callback;
- preserve the current delayed commit rule: only after the callback succeeds may Main Menu commit
  its consumed fruit and execute post-commit music stop.

Do not modify `main-menu-state.ts`, target ID `13`, the `0.75s` timer, or the recovered commands.

### App Shell

Add:

- `'leaderboard'` to `RecoveredAppShellState`;
- `leaderboard: LoadedLeaderboardResources` to `RecoveredAppResources`;
- `activeLeaderboard`;
- loader participation in the existing foreground-resource `Promise.all`;
- `createLeaderboardPresenter`;
- `activeLeaderboard?.update(deltaSeconds)`;
- best-effort teardown and reference clearing;
- `transitionMainMenuToLeaderboard`;
- `transitionLeaderboardToMainMenu`.

Both transactions should validate root identity, destination, timing, and z-order before entering
`runTransition`.

Use the existing replacement order:

1. create a detached destination presenter;
2. replace the current screen;
3. verify the returned root is the expected source;
4. suspend the source and require successful input surrender;
5. activate the destination;
6. only then assign active pointers and shell state;
7. dispose the committed source.

Generalize `compensateFailedMenuOptionsReplacement` and
`releaseFailedMenuOptionsScreenOwnership` to a menu-screen replacement helper that accepts
Main Menu, Options, or Leaderboard. Renaming is preferable to duplicating the same compensation
logic.

A fully successful rollback must:

- restore the old root as `SharedGameScenePresenter.currentScreen`;
- dispose the attempted presenter;
- let the caller/presenter rearm the source input transaction;
- leave shell state and active pointer on the source.

If root restoration or attempted-presenter disposal fails, release current-screen ownership,
dispose both presenters best-effort, clear whichever active pointer still owns the source, throw
the existing fatal navigation wrapper, and let `runTransition` move the shell to `'failed'`.

`onApplicationHidden` remains unchanged except that Leaderboard needs no reconciliation hook:
the process-owned runtime already saves all six boards. Never save merely because the user entered,
swiped, or left Leaderboard.

## Exact Proposed File List

### Create

Production:

```text
game/assets/scripts/domain/leaderboard-state.ts
game/assets/scripts/domain/leaderboard-state.ts.meta
game/assets/scripts/domain/leaderboard-presentation.ts
game/assets/scripts/domain/leaderboard-presentation.ts.meta
game/assets/scripts/domain/leaderboard-resource-contract.ts
game/assets/scripts/domain/leaderboard-resource-contract.ts.meta
game/assets/scripts/creator/leaderboard-resource-loader.ts
game/assets/scripts/creator/leaderboard-resource-loader.ts.meta
game/assets/scripts/creator/leaderboard-presenter.ts
game/assets/scripts/creator/leaderboard-presenter.ts.meta
```

Tests:

```text
tests/reconstruction/vertical-slice/leaderboard-state.test.ts
tests/reconstruction/vertical-slice/leaderboard-presentation.test.ts
tests/reconstruction/vertical-slice/leaderboard-resource-contract.test.ts
tests/reconstruction/vertical-slice/leaderboard-resource-loader.test.ts
tests/reconstruction/vertical-slice/leaderboard-presenter.test.ts
```

### Modify

Code and integration tests:

```text
game/assets/scripts/creator/main-menu-presenter.ts
game/assets/scripts/creator/recovered-app-shell-controller.ts
tests/reconstruction/vertical-slice/main-menu-presenter.test.ts
tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts
tests/reconstruction/vertical-slice/creator-scene-integration.test.ts
```

Documentation after behavior passes:

```text
docs/codebase-summary.md
docs/cocos-creator-contract-map.md
docs/system-architecture.md
docs/project-overview-pdr.md
plans/260721-2253-pencil-blade-restoration/plan.md
plans/260721-2253-pencil-blade-restoration/phase-06-recreate-full-game-content-and-progression.md
```

### Reuse unchanged

```text
game/assets/scripts/domain/main-menu-state.ts
game/assets/scripts/domain/main-menu-presentation.ts
game/assets/scripts/domain/classic-settings-state.ts
game/assets/scripts/creator/classic-settings-runtime.ts
game/assets/scripts/domain/classic-result-ranking.ts
game/assets/scripts/domain/crazy-result-ranking.ts
game/assets/scripts/domain/gn-style-result-ranking.ts
game/assets/scripts/domain/classic-bird-result-ranking.ts
game/assets/scripts/domain/crazy-bird-result-ranking.ts
game/assets/scripts/domain/combo-bird-result-ranking.ts
game/assets/scripts/domain/recovered-result-ranking.ts
game/assets/scripts/creator/blade-input-controller.ts
game/assets/scripts/creator/detached-screen-root.ts
game/assets/scripts/creator/game-resource-loader.ts
game/assets/scripts/creator/recovered-app-viewport.ts
game/assets/scripts/creator/shared-game-scene-presenter.ts
game/assets/game/{480x800,720x1280}/Leaderboard/*
game/assets/game/{480x800,720x1280}/Buttons/button-blue-back-normal.png
game/assets/game/{480x800,720x1280}/Buttons/button-back-selected.png
game/assets/game/Fonts/{Andyb,Century}.ttf
game/assets/game/Sounds/menubuttonclick.wav
```

No scene or prefab modification is required because the screen is a runtime-created foreground
presenter under the already-serialized app shell.

## Test and Acceptance Matrix

### Pure state

- six native indices begin at `(i + 0.5)W`, current index `0`;
- all six board mappings preserve exact values and stay deeply frozen;
- horizontal dominance is strict; diagonal tie does not drag/flick;
- negative/positive whole deltas honor the asymmetric native edge guards;
- a crossing event is not partially clamped;
- nearest-center recomputation occurs even after zero/rejected drag;
- drag and flick can both apply for one final segment;
- positive flick decrements, negative flick increments, endpoints clamp;
- pressed update never snaps;
- unpressed snap uses exactly `0.1 * error + abs(error)/error` above `2`;
- residual `<= 2` lands exactly; no `deltaSeconds` scaling.

### Presentation and resources

- exact native index -> header -> board mapping for all six modes;
- both profile dimensions, ten unique rasters, no fallback;
- exact two font paths and Back audio path;
- template-local rows, colors, anchors, point-size scaling, and integer formatting;
- title and Back initial/final geometry plus `1.0s` actions;
- loader requests ten rasters/two fonts once and rejects missing, duplicate, or changed resources.

### Presenter lifecycle

- detached/inactive construction and attach-before-activate guard;
- frozen all-six board snapshot at construction;
- one input lease, cutting disabled, no blade/raycast;
- raw began/moved/ended -> drag then flick ordering;
- button selected/normal/cancel frames and mobile Back parity;
- effects-off Back is silent; effects-on Back requests one non-looping click;
- duplicate Back suppressed while navigation is pending;
- successful suspend unregisters all listeners and releases input once;
- rejected/thrown navigation restores the same board positions/index and reacquires input with
  cutting disabled;
- activation failure and dispose aggregate cleanup without leaking a global input/key listener;
- idempotent dispose.

### Main Menu and shell

- Main Menu target ID `13` still waits exactly `0.75s`;
- Leaderboard uses the dedicated callback and no unsupported event;
- transaction requires `LeaderboardLayer`, delayed timing, z-order `1`, and exact source root;
- Main Menu -> Leaderboard updates active owner/state only after successful activation;
- Leaderboard -> Main Menu uses immediate timing and creates fresh Main Menu music behavior;
- both directions restore the source on create/replace/suspend/activate failure;
- rollback failure releases foreground ownership, clears active pointer, and leaves shell failed;
- successful commit disposes only the old presenter;
- shell update/destroy forwards to Leaderboard;
- app hide still saves the same six boards once through the shared runtime;
- About and Objectives remain unsupported as before.

Existing Settings tests should stay unchanged and pass. Add no test that calls storage or ranking
mutation from Leaderboard.

## Creator Preview Scenarios

Run these after automated tests and bundled strict TypeScript:

1. Seed six visibly distinct triples, boot Preview, cut the Leaderboard fruit, and verify the Main
   Menu remains for `0.75s` before the screen swap.
2. Verify index `0` is centered first and each swipe reaches the exact order:
   Classic, Crazy, Gangnam Style, Classic Bird, Crazy Bird, Combo Bird.
3. Verify all 18 displayed values match the seeded process Settings with no board crossed,
   reordered, rounded, or rewritten.
4. Slow-drag between panels, release, and observe frame-based centering; test overshoot at both
   edge guards.
5. Use a last horizontal segment over `1px` and verify drag then one sign-directed flick; use
   vertical/diagonal motion and verify no horizontal move.
6. Repeatedly swipe beyond index `0` and `5`; verify no out-of-range panel.
7. Press/cancel Back; selected frame must restore and no navigation occurs.
8. Press visible Back and Android/mobile Back separately; each creates a fresh Main Menu at z-order
   `1`.
9. With effects enabled, Back emits one click. With effects disabled, it emits none.
10. With music enabled, entering Leaderboard stops menu music only after successful handoff and
    returning restarts Main Menu music. With music disabled, both transitions remain silent.
11. Hide/resume on each panel and verify persisted board values remain intact.
12. Run both `480x800` and `720x1280` profiles; verify native rasters/fonts and visible-rect
    placement, especially the `137/138px` high-resolution header-height split.
13. Inject/reproduce a destination activation failure in the executable harness, then Preview the
    recovered source route: the old screen must remain usable with exactly one input owner.

## Implementation and Validation Order

1. Land the parallel native Leaderboard contract report and treat its direct disassembly as the
   authority for constants.
2. Add `leaderboard-state.ts` and focused tests.
3. Add resource and presentation contracts plus focused tests.
4. Add the resource loader and loader tests.
5. Add the presenter and lifecycle/gesture tests without touching shell/menu shared files.
6. Merge the current concurrent blade edits, then add the dedicated Main Menu lifecycle callback.
7. Generalize menu-screen rollback compensation and wire both shell transitions.
8. Run focused tests:

```text
node --test \
  tests/reconstruction/vertical-slice/leaderboard-*.test.ts \
  tests/reconstruction/vertical-slice/main-menu-presenter.test.ts \
  tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts \
  tests/reconstruction/vertical-slice/creator-scene-integration.test.ts
```

9. Run the full vertical slice, root audit/resource tests, Creator metadata validation, and Cocos
   Creator 3.8.8 bundled strict TypeScript.
10. Complete both resolution-profile Preview scenarios before updating docs/checklists.

## Risks and Rollback Rules

| Risk | Required control |
|---|---|
| Bird board swap | One explicit index/property/key/header mapping; six distinct-value tests. |
| Accidental score/reward replay | Read-only Settings port; import only panel-value helpers, never insertion functions. |
| Persistence corruption | No Leaderboard save/write/reload path; preserve app-hide/Main Menu exit ownership. |
| Two global input owners | Acquire/release `BladeInputController` transactionally; keep cutting disabled; no root-wide competing touch listener. |
| Gesture drift | Match shared native/Mode Select drag/flick classification and drag-before-flick order. |
| Frame-rate “improvement” changes fidelity | Keep native frame-based snap and ignore `deltaSeconds` for centering. |
| Source destroyed before destination is usable | Commit pointers/state and dispose source only after destination activation. |
| Failed rollback leaves ambiguous current root | Use generalized fatal menu-screen ownership release and shell `'failed'` state. |
| Main Menu music stopped on rejected handoff | Preserve existing post-success delayed commit boundary. |
| Dirty shared files overwritten | Implement new owned files first, then merge current menu/shell/tests/docs rather than restoring HEAD. |
| Resource substitution | Exact ten-raster/two-font contracts with profile dimensions and no fallback. |

The rollback unit is the screen replacement plus input lease, not Settings. A failed navigation
must not reload Settings or reconstruct ranking data. Rearm the same Leaderboard instance so its
selected panel and rail position survive.

## Documentation Impact

Docs impact: major.

This closes the currently named shared Leaderboard wiring gap, adds a production shell state, and
changes user-visible Main Menu behavior. After tests and Preview pass, update the six exact docs
and plan files listed above with actual—not projected—test counts and status.

## Unresolved Questions

None that block implementation.

The player-label anchor remains an explicit static evidence boundary: no native anchor setter was
found, so use the engine default and do not claim a recovered non-default value.

## Status

Status: DONE

Summary: Mapped the existing six-board data, native layout/input/back contract, exact resource
closure, reusable Creator owners, current unsupported-route gap, proposed files, tests, Preview
scenarios, dependency order, and transactional rollback rules.

Concerns/Blockers: No implementation blocker. Shared menu, shell, integration-test, docs, and plan
files contain concurrent standard-blade edits and must be merged rather than overwritten.

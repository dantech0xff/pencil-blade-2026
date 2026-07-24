# Options Screen Integration Map
---
date: 2026-07-24
status: done-with-concerns
scope: static-only codebase map for a production Creator Options screen
baseline-head: c42d7c66ff88c41c9f037061ece6abf376161d62
evidence-policy: no APK, native library, Creator Preview, game build, or runtime execution
---

## Decision

Add Options as a dynamically created screen presenter owned by
`RecoveredAppShellController`, using the same detached-root and transactional replacement
protocol as Main Menu <-> Mode Select. Do not serialize another scene component.

Keep three transactions separate:

1. **screen ownership**: Main Menu <-> Options root, input listeners, and presenter disposal;
2. **selection**: synchronize Settings with the persistent shared background/theme presenters;
3. **purchase**: affordability, coin debit, and price-`0` ownership through one Settings-runtime
   operation.

The separation matters. A failed screen transition must restore the previous foreground owner
without undoing a purchase already committed while Options was active. Conversely, a failed
purchase must not leave coins debited or UI showing an item as owned.

Current source already provides the shell, shared scene, Settings state, and exact resource-loader
patterns. It does **not** yet provide:

- an Options state, presentation, resource contract, loader, or presenter;
- an explicit Main Menu Options lifecycle callback;
- an `options` app-shell state or active presenter slot;
- a composite affordable-purchase operation;
- live Settings-to-shared-background/theme synchronization after boot;
- any standard-blade resource/presenter path beyond blade ID `0`.

Production Options therefore cannot be implemented as UI-only work. Background and theme selection
can become functional through existing shared presenters. Blade selection must remain unavailable
for any ID whose exact resource/presenter contract is not wired into all standard-blade consumers.

## Evidence Boundary

The requested repository-root `README.md` does not exist. `forensics/README.md`, phase 06, current
source/tests, and the parallel native contract were used instead.

Confidence terms:

- **current**: directly inspected in Creator TypeScript or tests;
- **recovered**: directly supported by the static native Options contract;
- **recommended**: target integration decision derived from those facts;
- **unknown**: evidence does not close the behavior.

Primary evidence:

- [Phase 06](../phase-06-recreate-full-game-content-and-progression.md)
- [Options native contract](./researcher-2026-07-24-options-native-contract.md)
- [Cosmetic economy native contract](./researcher-2026-07-24-cosmetic-economy-native-contract.md)
- `game/assets/scripts/creator/recovered-app-shell-controller.ts`
- `game/assets/scripts/creator/main-menu-presenter.ts`
- `game/assets/scripts/domain/main-menu-state.ts`
- `game/assets/scripts/domain/classic-settings-state.ts`
- `game/assets/scripts/creator/classic-settings-runtime.ts`
- `game/assets/scripts/creator/shared-game-scene-presenter.ts`
- `game/assets/scripts/creator/shared-background-presenter.ts`
- `game/assets/scripts/creator/shared-theme-presenter.ts`
- `game/assets/scripts/domain/shared-game-scene-resources.ts`
- `game/assets/scripts/creator/shared-game-resource-loader.ts`
- current vertical-slice tests under `tests/reconstruction/vertical-slice/`

The parallel resource audit remains authoritative for exact Options asset paths, dimensions, and
rights. This report maps ownership and runtime integration, not a second asset inventory.

## Current Runtime Topology

### Persistent owners

`RecoveredAppShellController` is the serialized process-screen owner
(`recovered-app-shell-controller.ts:145-173`). It currently owns:

- `activeMainMenu`;
- `activeModeSelect`;
- the persistent `SharedGameScenePresenter`;
- the process-owned `ClassicSettingsRuntime` through the Classic gameplay controller;
- shared audio, random, viewport, Physics2D adapter, and Blade input;
- all six gameplay controller routes.

Its state union has no `options` member (`recovered-app-shell-controller.ts:88-99`), and
`RecoveredAppResources` only contains Main Menu and Mode Select resources
(`recovered-app-shell-controller.ts:117-120`).

At boot, the shell loads shared-scene, Main Menu, and Mode Select resources together
(`recovered-app-shell-controller.ts:452-456`). It reads one Settings snapshot and seeds
`SharedGameScenePresenter` with `selectedBackground` and `selectedTheme`
(`recovered-app-shell-controller.ts:466-482`). No later code calls
`SharedBackgroundPresenter.select` or `SharedThemePresenter.select`. Mutating Settings after boot
therefore does not currently change the visible background or theme.

The shared scene survives foreground-screen replacements. Its child order is:

| sibling index | persistent child |
|---:|---|
| `0` | background |
| `1` | leaf |
| `2` | theme |
| `3` | current screen |

`SharedGameScenePresenter.replaceCurrentScreen()` owns exact detach/attach rollback and returns the
previous root (`shared-game-scene-presenter.ts:126-141`). Background and theme presenters expose
synchronous `select(index)` methods which retain their existing geometry and replace the sprite
resource (`shared-background-presenter.ts:75-85`,
`shared-theme-presenter.ts:75-85`).

### Main Menu Options route

Main Menu already treats Options as an immediate replacement destination:

- `MainMenuImmediateDestinationLayer` includes `OptionsLayer`
  (`main-menu-state.ts:24`);
- `optionsCommands()` builds capture/remove/fresh-construct/attach plus effect-gated menu-click
  commands (`main-menu-state.ts:334-336`, `437-457`);
- the Options control invokes `navigateImmediate('OptionsLayer')`
  (`main-menu-presenter.ts:689-697`).

However, `MainMenuPresenter` sends both About and Options through
`onUnsupportedDestinationRequested()` (`main-menu-presenter.ts:889-920`). The shell responds by
emitting `RECOVERED_APP_SHELL_UNSUPPORTED_DESTINATION_EVENT` and returning `false`
(`recovered-app-shell-controller.ts:2175-2185`). The presenter then rearms Main Menu input. This is
the exact current reason the Options button does not navigate.

Main Menu creates a detached `MainMenuRoot`, owns touch listeners and the Blade input lease, and
supports:

- `activate()` only after host attachment;
- `suspendForTransition()` to unregister input and release the blade lease;
- `rearmNavigationAfterFailure()` after host rejection;
- idempotent `dispose()`.

Options should implement the same lifecycle shape but normally will not acquire the gameplay Blade
input lease. It only needs its own button/selector listeners.

### Existing screen transaction

Main Menu -> Mode Select is the closest safe template
(`recovered-app-shell-controller.ts:591-625`):

1. validate the active presenter, exact root identity, and destination;
2. enter `runTransition(from, to, operation)`;
3. construct the next presenter detached;
4. `replaceCurrentScreen(next.root)`;
5. verify the returned root is the old root;
6. suspend the old presenter and release its input lease;
7. activate the new presenter;
8. on failure, restore the old root and dispose the attempted presenter;
9. after success, commit active fields and state;
10. best-effort dispose the old presenter.

Mode Select -> Main Menu mirrors that order
(`recovered-app-shell-controller.ts:627-662`). `runTransition()` rejects destroyed, re-entrant, or
wrong-source transitions (`recovered-app-shell-controller.ts:2126-2155`).

This protocol is suitable for Options, with one qualification: only
`ModeSelectFatalNavigationError` currently drives the shell to `failed`. A failed generic rollback
is otherwise reported and converted to `false`. Options must not leave the state saying
`main-menu` or `options` while neither exact root owns the foreground. Rollback should verify both
`sharedScene.currentScreen` and presenter/input postconditions; an unrecoverable mismatch needs a
general fatal-screen-ownership error or equivalent `failed` path.

## Recovered Options Lifecycle Contract

The parallel static native report establishes:

- entry creates title/coin/Back immediately; the randomized delay targets only the excluded ad
  callback;
- one chained surface reveals background, blade, then theme rows at `1.25`, `1.50`, and `1.75`
  seconds;
- theme selection immediately stores the index and refreshes the theme layer;
- background selection immediately stores the index, refreshes the background layer, and toggles
  owned/buy UI;
- blade selection immediately stores the index and toggles owned/buy UI;
- selection and Back sounds are gated by `enable_effect`;
- buying reads coins and selected price, rejects only when `coins < price`, allows equality, debits
  coins, then marks the item purchased;
- Back calls `CheckPurchaseItems()` before replacing Options with Main Menu;
- `CheckPurchaseItems()` resets a still-priced selected background to `0` and refreshes the
  background layer; it resets a still-priced selected blade to `0`;
- theme has no recovered purchase rollback;
- the ad callback is isolated from the core Options flow.

This is not a generic “preview then Save” screen. The recovered observable contract is:

| cosmetic | selection while Options is open | Back behavior |
|---|---|---|
| theme | Settings changes immediately; shared theme changes immediately | keep selected theme |
| owned background (`price === 0`) | Settings and shared background change immediately | keep selection |
| unowned background (`price > 0`) | temporary Settings/shared visual selection; buy UI shown | reset selection and shared visual to `0` unless bought |
| owned blade (`price === 0`) | Settings changes immediately | keep selection |
| unowned blade (`price > 0`) | temporary Settings selection; buy UI shown | reset selection to `0` unless bought |

A target-local draft model could avoid temporarily writing unowned selection into Settings, but that
would be an intentional behavioral variance. If fidelity is the goal, model the temporary selection
explicitly and perform the recovered reset before starting the Back screen transaction.

The native Options path does not establish an Options-exit `SaveData` call. Current target persistence
occurs on Main Menu exit and `Game.EVENT_HIDE`
(`recovered-app-shell-controller.ts:2198-2209`). Do not add a bulk save on Options Back without a
separate target decision.

The immediate Main Menu Options command does not stop background music, and native Options
entry/Back evidence contains no Options-owned music replacement. Selection and Back both use
`Sounds/menubuttonclick.wav`. Blade-row construction additionally uses `Sounds/mono1.wav`, and
theme-row construction uses `Sounds/mono2.wav`; all four paths are gated by the current effects
setting. The target constructs a fresh Main Menu on return, whose existing activation contract
requests its loop again. Whether the underlying audio engine restarts or deduplicates that request
remains a target-runtime verification item; this report does not claim uninterrupted ownership.

## Settings and Purchase Integration

### Existing state

`ClassicSettingsState` currently owns:

| field | allowed/current contract |
|---|---|
| selected theme | default `2`, indices `0..9` |
| selected background | default `0`, indices `0..8` |
| selected blade | default `0`, indices `0..17` |
| blade prices | 18 entries, index `0` price `0` |
| background prices | 8 entries, index `0` price `0` |

See `classic-settings-state.ts:101-150`.

Selection setters validate range but do not validate ownership
(`classic-settings-state.ts:452-469`). Price access and ownership mutation use separate bounds
(`classic-settings-state.ts:471-489`). `addTotalCoins()` mutates signed-int32 state after checking
overflow (`classic-settings-state.ts:491-503`).

`ClassicSettingsRuntime.purchaseBlade()` and `purchaseBackground()` write the selected price key as
`0` before marking the in-memory price as `0` (`classic-settings-runtime.ts:117-135`). They:

- do not check affordability;
- do not debit coins;
- do not select the item;
- do not bulk-save coins or selection;
- fail closed for a nonzero purchase after load recovery;
- are idempotent when the price is already `0`.

The current persistence port is per-key only. A price-ownership write can be immediate, while
`total_coins` and selected indices are not persisted until a later bulk save
(`classic-settings-state.ts:633-710`). Exact crash atomicity across price, coins, and selection is
impossible with this port.

### Required purchase boundary

Do not let `OptionsPresenter` perform:

```text
state.addTotalCoins(-price)
runtime.purchaseBlade(index)
```

If the storage write then throws, coins stay debited in memory and the item stays unowned.

Add one runtime-owned operation per purchasable family, or one typed family operation:

```text
tryPurchaseBlade(index)
tryPurchaseBackground(index)
```

The operation should:

1. validate the exact price index;
2. return an `already-owned` result for price `0`;
3. fail closed when Settings writes are disabled;
4. read the signed coin balance and reject when `coins < price`;
5. precompute/validate the exact next signed-int32 balance;
6. persist the price-`0` ownership key;
7. mark ownership and debit coins in memory in a non-throwing commit section;
8. return a frozen result containing family, index, price, previous/next coins, and status.

The recovered ordering is debit then `Purchase*`; the current target runtime deliberately writes
ownership before mutating in-memory state so storage failure is recoverable. Preserve the recovered
affordability and equality semantics while making this target transaction failure-safe. Document the
remaining crash window: ownership can survive process loss before the later bulk save of the debited
coin balance.

If durable all-or-nothing price + coin persistence is a product requirement, first extend the storage
contract with a versioned transaction/journal. It cannot be truthfully claimed using the current
independent `localStorage.setItem` writes.

### Recovered ranges and background-`8` compatibility

The exact recovered Options selectors contain:

- 8 background items, indices `0..7`;
- 18 blade items, indices `0..17`;
- 10 theme items, indices `0..9`.

Only the background contracts disagree: Settings/shared resources admit background index `8`, while
the recovered Options selector and price table stop at `7`. The target compatibility policy is:

- never call `backgroundPriceAt(8)` or `purchaseBackground(8)`;
- expose only the exact recovered Options background items `0..7`;
- when Options opens with saved/live background `8`, seed only the local selector display at `0`
  and retain Settings/shared background `8`;
- if the user leaves without selecting another background, retain `8`;
- once the user explicitly selects an Options background, clear the compatibility condition and use
  the recovered selection/purchase/Back-reset behavior for `0..7`.

This policy prevents an out-of-range price lookup without silently overwriting a valid legacy saved
selection. Blade IDs `0..17` are all valid Options selector and economy IDs. Their live gameplay
presentation remains a separate standard-blade runtime checkpoint; the selector must not claim that
checkpoint is complete.

## Shared Theme and Background Application

Pass Options a narrow visual port rather than the full shared scene:

```text
currentBackgroundIndex
currentThemeIndex
selectBackground(index)
selectTheme(index)
```

The shell can adapt this port directly to `sharedScene.background` and `sharedScene.theme`. Options
does not need authority to attach/detach screens or dispose persistent shared layers.

Use the already-loaded shared resource families. `loadSharedGameSceneResources()` eagerly loads all
9 backgrounds and all 10 themes, and each presenter can switch synchronously. Do not reload those
full-size resources in the Options loader. The Options loader should own selector/title/button
rasters and any exact thumbnail sheets established by the resource audit.

Selection coordination should prevalidate the index against both state and loaded visual contracts,
capture previous state/visual indices, update both, and restore both if synchronization fails. In
particular:

- theme: select shared theme and set Settings immediately;
- background: select shared background and set Settings immediately, even while its buy state is
  pending;
- Back: if current background price remains nonzero, restore Settings and shared background to
  index `0` before asking the shell to leave;
- activation failure: constructor/create/activate must not change Settings or persistent visuals;
- disposal after committed Back: do not restore a committed owned selection;
- failed Options -> Main Menu screen transaction: keep Options active with its already-committed
  Settings/visual state and rearm its listeners.

`select()` currently has no preview token or rollback object. Keep the captured previous indices in
the Options interaction operation; do not add cross-screen rollback behavior to the persistent
presenters.

## Blade Integration Gap

Every standard `ClassicBladePresenter` consumer is hardcoded to blade `0`:

| consumer | current hardcode |
|---|---|
| Main Menu | `main-menu-presenter.ts:268-272` |
| Mode Select | `mode-select-presenter.ts:306-310` |
| Classic gameplay | `classic-gameplay-controller.ts:1181-1185` |
| standard Crazy profile | `crazy-gameplay-controller.ts:1318-1324` |
| GN Style | `gn-style-gameplay-controller.ts:968-974` |
| Mode Select presentation contract | `mode-select-presentation.ts:430-439`, `605-615` |

The resource layer is also default-only:

- `ClassicDefaultBladeId` is the literal type `0`
  (`classic-resource-contract.ts:46`);
- only the default blade contract can be resolved
  (`classic-resource-contract.ts:273-278`, `346-357`);
- `LoadedClassicResourceCatalog` exposes `defaultBlade`;
- the loader key is `defaultBladeKey(0)`
  (`classic-resource-loader.ts:232`, `471-477`, `515-516`);
- `ClassicBladePresenterInput.selectedBladeId` is typed as `0`
  (`classic-blade-presenter.ts:33`).

Changing `ClassicSettingsState.selectedBlade` alone has no visual effect. A production blade choice
requires:

1. an exact audited resource/presentation contract per selectable standard blade;
2. a loaded catalog lookup by selected blade ID;
3. a blade presenter/factory that accepts the supported ID union;
4. all standard-blade consumers above to read the current Settings selection when constructing a
   fresh presenter;
5. tests for each supported resource/behavior family and for unsupported IDs.

Main Menu -> Options disposes the old Main Menu, and Options -> Main Menu constructs a fresh one.
That lifecycle is a clean point to apply the newly committed blade selection after the standard-blade
runtime catalog lands; no blade hot-swap is needed on the suspended old menu.

Do not route Bird modes through this work. Classic Bird, Crazy Bird, and Combo Bird use the separate
recovered `BirdBlade` types/resources and are not proven consumers of standard cosmetic
`selected_blade`.

Do not assume every standard blade is a texture-only `Blades/bladeN.png` variant. Keep a dedicated
standard-blade catalog/factory boundary because the audit shows heterogeneous visuals, trails,
slots, and behavior. The recovered Options surface may select and purchase all 18 economy entries,
but the separate blade-runtime checkpoint must wire every ID before Phase 6 can claim gameplay
fidelity.

## Exact Extension Points

### New production modules

Create each TypeScript file with a valid, unique Creator `.ts.meta`:

| file | responsibility |
|---|---|
| `game/assets/scripts/domain/options-resource-contract.ts` | immutable canonical Options raster/audio contracts; exact per-tree paths and dimensions |
| `game/assets/scripts/domain/options-state.ts` | pure chained selector/owned/buy-price/coin model; recovered selection and Back-reset commands; background-`8` compatibility; no Cocos imports |
| `game/assets/scripts/domain/options-presentation.ts` | deterministic layouts, z-order, selector/button presentation snapshots |
| `game/assets/scripts/creator/options-resource-loader.ts` | exact batch load and frozen catalog using `loadGameResourceBundle()` / `loadExactGameRasters()` |
| `game/assets/scripts/creator/options-presenter.ts` | detached `OptionsRoot`, UI construction, listeners, selection/purchase effects, Back lifecycle, suspend/rearm/dispose |

Keep purchase atomicity in `ClassicSettingsRuntime`, not in `options-state.ts` or the presenter. Keep
shared visual synchronization behind a narrow presenter input port. A small selector presenter is
justified here because each recovered row owns the same bounded previous/current/next listener
lifecycle and must suspend/rearm independently during screen rollback.

`OptionsPresenter` should mirror the current screen contract:

- `create()` is deterministic and side-effect-free outside its detached node tree;
- `activate()` requires the root to be host-attached, registers listeners once, and rolls back partial
  registration;
- `suspendForTransition()` unregisters listeners but preserves state/UI for rollback;
- `rearmNavigationAfterFailure()` re-registers listeners exactly once;
- `dispose()` is idempotent, best-effort, and never reverts committed purchases/selections;
- `update(deltaSeconds)` advances the recovered chained title/row reveal and purchase-particle
  lifetimes;
- Back emits one typed `OptionsNavigationTransaction` with root identity, immediate timing, and z-order
  `1`.

### Existing modules to modify

| file | bounded change |
|---|---|
| `creator/main-menu-presenter.ts` | add explicit `onOptionsRequested(transaction)`; route `OptionsLayer` there; keep About and other unsupported destinations on the existing port; aggregate host + rearm failures as delayed navigation already does |
| `creator/recovered-app-shell-controller.ts` | add `options` state, resources, active presenter, create/require methods, boot load, update/dispose coverage, and both transactional routes |
| `creator/classic-settings-runtime.ts` | add composite affordable purchase methods and frozen results |
| `domain/classic-settings-state.ts` | only add a prevalidated non-throwing coin/ownership commit helper if runtime cannot express it safely with current primitives; preserve public schema and keys |
| `creator/shared-game-scene-presenter.ts` | no required behavior change; expose only if a narrow read-only cosmetic adapter cannot be built from current public handles |
| standard blade contract/loader/presenter and consumers listed above | replace default-only lookup with audited selected standard-blade lookup |

### Scene impact

No `game/assets/scenes/classic.scene` change is recommended. Options is a pure dynamically created
presenter imported by the existing serialized app shell. Adding an `@ccclass` Options controller
would unnecessarily change the exact serialized component list and
`creator-scene-integration.test.ts`.

## Screen Transactions

### Main Menu -> Options

Recommended order:

1. Main Menu validates interaction and creates its immediate Options transaction.
2. Shell validates active Main Menu identity, `OptionsLayer`, `timing === 'immediate'`, and z-order.
3. `runTransition('main-menu', 'options', ...)` rejects stale/re-entrant calls.
4. Create Options detached from current Settings/resource snapshots; no persistent mutation.
5. Replace current screen with `options.root`; verify returned root is Main Menu root.
6. Suspend Main Menu; verify it surrendered Blade input/touch ownership.
7. Activate Options listeners.
8. Commit `activeMainMenu = null`, `activeOptions = next`, state `options`.
9. Dispose committed Main Menu.
10. Play effect-gated menu click through the existing Main Menu command after host success.

Failure before step 8:

- restore the exact Main Menu root;
- dispose attempted Options;
- return `false` so Main Menu rearms;
- verify `currentScreen === mainMenu.root`, Main Menu can reacquire Blade input, and Options has no live
  listeners.

Do not stop/restart menu music during this route.

### Options -> Main Menu

Recommended order:

1. Options runs recovered `CheckPurchaseItems` behavior:
   - reset still-priced selected background to `0` in Settings and shared visual;
   - reset still-priced selected blade to `0`;
   - retain theme and owned selections.
2. Options emits a typed Back transaction.
3. Shell validates active Options identity and enters
   `runTransition('options', 'main-menu', ...)`.
4. Create a fresh Main Menu from current committed Settings and selected standard-blade catalog entry.
5. Replace current screen; verify returned root is Options root.
6. Suspend Options listeners.
7. Activate Main Menu and acquire its Blade input lease.
8. Commit active fields/state.
9. Dispose Options.
10. Play the effect-gated Back/menu click at its recovered command point. Fresh Main Menu activation
    retains its existing loop-request behavior; Preview must verify that the audio backend does not
    produce overlapping playback.

Failure before step 8:

- restore exact Options root;
- dispose failed Main Menu, including any acquired Blade lease and partial music side effect;
- rearm Options listeners;
- keep the step-1 selection cleanup because it is an interaction commit, not screen ownership;
- verify `currentScreen === options.root`.

If preserving temporary unowned cursor state after a failed Back is considered important, move
`CheckPurchaseItems` to a reversible prepare/commit pair. Native order performs it before removing
Options, so retaining the cleanup is the closer recovered behavior.

### Disposal and application lifecycle

Add `activeOptions?.update(deltaSeconds)` only if needed, and always add
`activeOptions?.dispose()` to shell destruction. Clear `activeOptions` with the other active
presenters. App-hide save remains shell-owned and applies regardless of which screen is active.

Do not let presenter disposal call bulk Settings save. Disposal may run during failed construction,
screen rollback, shell destruction, or post-commit cleanup and is not a safe persistence boundary.

## Failure and Rollback Risks

| risk | consequence | required control |
|---|---|---|
| Options activation mutates shared visuals before host commit | failed Main -> Options changes the still-visible menu | creation/activation side-effect-free for cosmetics |
| generic shell rollback fails but `runTransition` returns `false` | state/root/input ownership diverge | verify rollback postconditions; use fatal ownership error and state `failed` |
| immediate Main Menu rearm throws after host failure | original transition failure is hidden | aggregate both failures, matching delayed-navigation cleanup |
| presenter debits coins before price persistence | write failure loses coins without ownership | runtime composite purchase |
| price persists but process exits before coin bulk save | purchased item survives with old balance | document target durability or add versioned journal |
| load recovered from corruption | Options appears writable although runtime disables durable writes | disable buy controls/fail closed and surface save failure |
| unowned selection is treated as committed on Back | user receives unpaid background/blade | recovered price check and reset-to-`0` before leaving |
| visual and Settings indices update separately | displayed cosmetic differs from saved selection | one guarded selection operation with both rollback values |
| background index `8` reaches price lookup | range exception during interaction/Back | selector exposes only audited priced indices |
| blade price slot exists without runtime resource | purchasable but unusable cosmetic | sell/select only exact wired blade IDs |
| screen rollback reverts purchase | durable ownership and UI disagree | never couple purchase rollback to root transaction |
| fresh Main Menu still hardcodes blade `0` | selected blade appears ignored | selected catalog lookup before claiming blade support |
| fresh Main Menu requests its track on return | duplicate music is possible if the audio backend does not deduplicate/restart cleanly | verify the existing activation contract in Preview; do not invent Options-owned music |

## Test Map

### New focused tests

Create under `tests/reconstruction/vertical-slice/`:

| test | minimum assertions |
|---|---|
| `options-resource-contract.test.ts` | exact canonical paths/dimensions/order for both asset trees; audio contracts; no duplicates; referenced asset/meta presence |
| `options-state.test.ts` | default selection; all exact selector bounds; owned price `0`; affordability uses `<`; equality purchase; insufficient/already-owned; recovered Back reset; background `8` compatibility; exact command order |
| `options-presentation.test.ts` | root names, visible-rect layouts, controls, z-order, animation endpoints |
| `options-resource-loader.test.ts` | complete exact batch, frozen catalog, reused bundle, missing/wrong-geometry failure |
| `options-presenter.test.ts` | detached create; host-before-activate; registration rollback; effects gating; theme/background synchronization; successful/failed purchase; unowned Back reset; suspend/rearm; failed Back; idempotent disposal; no pre-activation persistent mutation |

### Existing tests to extend

| test | required coverage |
|---|---|
| `main-menu-presenter.test.ts` | Options uses explicit lifecycle port; false/throw causes exact rearm; host + rearm failures aggregate; About remains unsupported |
| `main-menu-state.test.ts` | preserve exact immediate Options replacement and audio command sequence |
| `recovered-app-shell-controller.test.ts` | Options boot load; state/active slots; both route orderings; stale/re-entrant rejection; injected failures at replace/suspend/activate/dispose/rearm; exact rollback ownership; fatal incomplete rollback; Options removed from unsupported event |
| `classic-settings-runtime.test.ts` | insufficient/equality/success/already-owned; every boundary; storage failure leaves coins/price unchanged in memory; load-recovery write-disable; frozen result |
| `classic-settings-state.test.ts` | any new commit helper, signed-int32 boundaries, unchanged 50-int/4-bool schema |
| `shared-game-scene-presenter.test.ts` | selected background/theme changes retain geometry and sibling order; adapter cannot replace/dispose screen |
| `classic-resource-contract.test.ts` | exact supported standard-blade contracts and unsupported ID failure |
| `classic-blade-presenter.test.ts` | each supported blade presentation family; no implicit fallback to `0` |
| controller/presenter tests for Main Menu, Mode Select, Classic, Crazy, GN Style | fresh construction reads selected standard blade; BirdBlade profiles remain unchanged |
| `creator-scene-integration.test.ts` | exact serialized component list remains unchanged; replace hardcoded `selectedBladeId: 0` source assertion when selected-blade support lands |

The shell tests should execute the full transaction with injected failures, not only regex-match new
source. The current suite contains source-boundary assertions; retain them, but make ownership,
rearm, and Settings/visual rollback behavior executable.

### Integration gates

Run in this order during implementation:

1. Options state/resource/presenter focused tests;
2. Main Menu, Settings, shared-scene, and shell focused tests;
3. all vertical-slice tests;
4. resource/build/catalog and Creator metadata audits;
5. strict Cocos Creator TypeScript;
6. fresh browser preview:
   - Main Menu -> Options -> Main Menu repeatedly;
   - theme and owned background apply live;
   - unowned background/blade resets on Back;
   - equality and insufficient purchases;
   - relaunch persistence;
   - selected standard blade visible in every supported non-Bird consumer;
   - no duplicate audio, listeners, roots, or Blade input leases.

## Recommended Implementation Order

1. Land exact Options resource audit/contract and close the selector-range questions.
2. Add pure `options-state.ts` and Settings-runtime composite purchases with exhaustive focused tests.
3. Add Options presentation, loader, and side-effect-free presenter.
4. Add explicit Main Menu Options lifecycle port.
5. Add shell `options` resource/state/transactions and rollback-postcondition tests.
6. Wire shared theme/background selection.
7. Add the standard-blade catalog/factory and migrate each standard-blade consumer as the next
   checkpoint.
8. Reconcile every blade ID's exact presentation/behavior before claiming blade-runtime completion.
9. Run full vertical-slice, metadata, TypeScript, and fresh Preview gates.

This order lets the screen route land without falsely claiming blade coverage, while preventing the
UI from selling a cosmetic that no gameplay presenter can render.

## Unresolved Questions

- Why does Settings/shared background state admit index `8` while native Options and the price table
  expose only indices `0..7`?
- Is any native caller guaranteed to run `SaveData` immediately after an Options purchase or Back?
- Which standard blade IDs are texture-only variants, and which require distinct trail/slot/behavior
  presenters?
- Does the current audio backend restart, deduplicate, or overlap the fresh Main Menu loop request
  after returning from Options?

Status: DONE_WITH_CONCERNS
Summary: Mapped the production Options extension through explicit Main Menu lifecycle routing, app-shell screen ownership, process Settings, shared background/theme presenters, exact rollback boundaries, standard-blade consumers, recommended modules, and executable tests.
Concerns/Blockers: The origin of background index `8`, native bulk-save timing, fresh-menu music behavior, and exact live presentation contracts for nonzero blade IDs remain unresolved. Selector ranges, exact Options particles, and row audio are statically closed; blade-runtime fidelity remains the next checkpoint.

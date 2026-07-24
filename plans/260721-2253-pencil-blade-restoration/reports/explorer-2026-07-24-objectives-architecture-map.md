---
title: Objectives screen and progression architecture map
type: explorer
date: 2026-07-24
status: done-with-concerns
scope: static-only Creator architecture, persistence, producer, resource, and shell integration map
baseline-head: b11236e74b82a2db7f26893caaa2696b55b175aa
evidence-policy: current source, tests, extracted resources, and companion static native research only
---

# Objectives Screen and Progression Architecture Map

## Decision

Implement the standalone Objectives checkpoint as a dedicated detached-screen presenter on the
existing app-shell transaction seam. Reuse the current `ObjectivesManagerState`, Settings runtime,
objective tables, and achievement presentation. Do not create a second objective model or another
persistence owner.

Treat the checkpoint as two separately reviewable slices:

1. **Standalone screen:** 52-row vertical list, fixed current/next cards, Back, Skip, exact
   resources, Main Menu route, and achievement-popup lifetime.
2. **Fruit/combo progression producers:** close Main Menu plus mode ordinary/special fruit events
   and the Classic combo bridge.

That split is not optional project management. The screen can be visually and transactionally
correct while natural progression remains blocked. At baseline HEAD, production has no caller that
increments `fruitsCut` or dispatches selector `10`; therefore the third sequence position,
objective ID `8`, cannot complete without Skip. Concurrent implementation after this report's
baseline may close that gap and must be reviewed against the ordering below.

No Settings schema change is required. The recovered keys, defaults, signed-int32 behavior,
immediate indexed writes, and later bulk-save boundary already exist.

## Evidence Boundary

The required repository-root `README.md` does not exist. `forensics/README.md`, Phase 6, current
source/tests, staged resources, and the companion native investigation supplied the context.

The exact asset/layout evidence belongs to
[`researcher-2026-07-24-objectives-resource-map.md`](./researcher-2026-07-24-objectives-resource-map.md).
Direct native behavior/call-site evidence belongs to
[`researcher-2026-07-24-objectives-native-contract.md`](./researcher-2026-07-24-objectives-native-contract.md).
This report owns the Creator integration decision and the baseline current-code producer audit.

Confidence labels:

- **Recovered:** direct native static evidence or extracted asset identity.
- **Existing:** current Creator production source and tests.
- **Target decision:** smallest safe adaptation of recovered behavior to current ownership.
- **Open:** static evidence or current code does not yet close the claim.

No APK, native library, Creator Preview, emulator, game build, or runtime route was executed for this
report.

## Existing Domain Behavior Is Reusable

`game/assets/scripts/domain/objectives-manager-state.ts` already contains the full engine-independent
objective state machine:

- `52` objective IDs and the exact non-numeric sequence order;
- the 52 rewards, targets, and bundled descriptions;
- immediate `objectives_value_{id}` reads and writes;
- active objective, pause card, progress text, finished/lost state, skip, finish, and cycle reset;
- selector gates `0...21`;
- count, threshold, equality, and three-phase no-failure/no-bomb rules;
- signed-int32 wrapping through the Settings reward port;
- one synchronous immutable achievement event after an ordinary advance.

The sequence is:

```text
0,27,8,1,18,9,28,2,50,10,3,19,42,46,32,48,20,4,21,29,11,5,22,33,
51,34,23,12,24,36,13,25,37,38,14,41,26,15,35,47,6,30,40,49,45,39,
31,16,43,44,7,17
```

Screen code must use `OBJECTIVE_ORDER` and `objectiveDefinitionAt(sequencePosition)`. It must not
sort by objective ID, derive rewards by ID, normalize bundled spelling, or duplicate the tables.

The current public surface is sufficient for a read/present/skip screen:

| Existing API | Standalone-screen use |
|---|---|
| `activeObjective()` | Authoritative Skip target and fixed active card. |
| `pauseCard()` | Existing description/progress/reward projection for the active objective. |
| `value(id)` / `isFinished(id)` | Project the regular row style from immediate storage. |
| `skip(active.id)` | Exact no-reward, persist-then-advance mutation. |
| `objectiveDefinitionAt(position)` | Build all 52 rows and the fixed next card in sequence order. |
| popup callback supplied by `ClassicSettingsRuntime.createObjectivesManager()` | Synchronous bridge into the existing achievement presentation. |

Do not reuse a gameplay controller's retained manager instance. Those managers have callbacks bound
to gameplay-owned popup registries and presentation targets. Create a fresh manager from the same
process-owned `ClassicSettingsRuntime`; it will share Settings memory and indexed storage while
retaining correct screen-specific presentation ownership.

## Recovered Standalone Screen Contract

### Graph and rows

The native screen is a vertical gesture layer with exactly 52 regular `ObjectiveItem` rows in
`OBJECTIVE_ORDER`. On entry, local z-order `1` insertion order is:

1. full Objectives background;
2. regular rows `0...51`;
3. fixed header;
4. fixed footer;
5. fixed next-objective card;
6. menu, with Back inserted before Skip.

The header, footer, next card, and menu do not scroll.

Despite the filenames, the regular row uses:

- `objectives-active.png` when its stored value is exactly `-2`;
- `objectives-inactive.png` for every other stored value.

The fixed next-objective row uses `objectives-next.png`.

Each regular row shows the exact bundled description and:

```text
reward: %d coins
```

The description point size is `18 * logicalWidth / 400`; reward point size is
`20 * logicalWidth / 400`. Both use `Fonts/Arial.ttf`.

Both labels use anchor `(0, 0.5)`. For row center `(x,y)` and row dimensions `(w,h)`:

```text
description = (x - w / 3.5, y + 0.25h)
reward      = (x - 0.125w, y - 0.25h)
```

Construction-time colors are:

| Stored state at screen construction | Description | Reward |
|---|---|---|
| finished (`-2`) | RGB `(41,171,226)` | RGB `(252,238,33)` |
| every other value | RGB `(179,179,179)` | RGB `(255,255,255)` |

`UpdateBackground()` changes only the ordinary-row raster. Therefore, immediately after Skip, the
just-skipped row flips to `objectives-active.png` but retains its grey/white labels. Re-entering the
screen reconstructs that completed row with blue/yellow labels. Do not replace the native targeted
refresh with a full row re-render unless this visual quirk is deliberately rejected.

### Initial placement and vertical drag

Let:

```text
topBound    = visibleTopY - f32[0x3F8CCCCD] * headerHeight - 0.5 * rowHeight
bottomBound = visibleBottomY + f32[0x3F866666] * footerHeight + 0.5 * rowHeight
spacing     = 1.25 * rowHeight
```

Regular row sequence position `i` starts at:

```text
centerY(i) = topBound + (CurrentObjective - i) * spacing
```

The native drag callback translates all 52 regular rows by the full `-deltaY` only when its
pre-move endpoint predicate permits the direction. The accepted move is not partially clamped, so a
single move can overshoot a boundary. There is no snap, inertia, easing, frame update, drag audio,
or row-selection state.

The target state should preserve:

- full-event movement, not a normalized or time-scaled value;
- the native pre-move bound check;
- allowed one-event overshoot;
- fixed header/footer/menu;
- no meaning attached to whichever row is currently visible.

`BladeInputController` is the closest existing replacement for the native shared gesture layer.
The presenter should acquire its one process lease, force cutting `false`, use moved deltas only for
the vertical list, and release the lease on suspend/dispose. It must not raycast or render a blade.

Static root positions are:

```text
background        = visibleCenter
header            = (visibleCenterX, visibleTopY - 0.5 * headerHeight)
footer            = (visibleCenterX, visibleBottomY + 0.5 * footerHeight)
fixed current row = (0.5 * logicalWidth, 0.15 * logicalHeight)
menu              = (0,0)
```

Background, header, and footer each fade in over `1.0s`. Back starts at
`(visibleLeftX - 0.5w, visibleBottomY + h/2.5)` and concurrently rotates `+360deg` and moves right
by `1.05w` over `1.0s`. Skip starts at
`(visibleRightX + 0.5w, 0.05 * logicalHeight)` and moves over `1.0s` to
`(visibleRightX - 0.75w, sameY)`.

### Skip

Skip always targets:

```text
OBJECTIVE_ORDER[CurrentObjective]
```

It never targets the row under the finger, the row nearest the viewport center, or any scrolled
row. Recovered order is:

1. if effects are enabled, request non-looping `Sounds/menubuttonclick.wav`;
2. immediately persist the active indexed value as `-2`;
3. award zero coins;
4. increment `CurrentObjective` in process memory;
5. synchronously run `PopupAchievement`;
6. after popup construction returns, rebind only the fixed current card's sequence/text;
7. refresh only the just-skipped regular row's background.

For sequence position `51`, advance reaches transient position `52`, then synchronously:

1. set `CurrentObjective = 0`;
2. set `FruitsCut = 0`;
3. write `0` to all 52 indexed objective keys;
4. emit no cheer, banner, label, or particle event;
5. rebind the fixed card to sequence position `0`;
6. refresh regular row `0` only.

The other regular rows retain their already-presented completed rasters until screen reconstruction,
even though their stored values are now `0`. That is the native targeted-refresh result. A full
post-reset repaint would be a visible target hardening and must not be called recovered behavior.

Skip is an irreversible progression mutation, not part of a screen-navigation transaction. Once the
indexed `-2` write succeeds, presentation failure must not restore the old objective value or pretend
the button did nothing. Preflight resources/root validity, prevent re-entrant Skip, then refresh from
the manager after success or a post-commit presentation fault.

### Achievement lifetime

The current `ObjectiveAchievementPresentationState` and `ObjectiveAchievementPresenter` already
implement the recovered:

- completed banner ingress/hold/egress;
- delayed next banner;
- Arial labels;
- three equal-z emitters;
- deterministic particle construction from five random draws;
- `4.41s` cleanup.

Reuse them unchanged for Skip. Screen- and Main-Menu-originated presentations need an
app-shell-scoped owner, not a child of either foreground root, because native popup roots target the
persistent scene and can outlive a foreground screen replacement.

The host should:

- play effects-gated `Sounds/cheer.wav` before constructing the popup;
- create and attach all popup roots transactionally to the app-shell target;
- update active popup presenters from the shell;
- retain them across Objectives -> Main Menu;
- remove each after natural cleanup;
- dispose all on shell destruction;
- receive no callback for the final cycle reset.

For a nonterminal Skip, exact popup construction order is:

```text
effects-gated cheer
completed banner add at z1
next banner add at z1
particle emitter 1 add at z1
particle emitter 2 add at z1
particle emitter 3 add at z1
return to ObjectivesLayer local refresh
```

The existing presentation timings remain: completed banner `0...2.0s`; next banner delay to
`4.0s`, ingress by `4.5s`, hold to `7.0s`, egress by `7.5s`; particle-source cleanup begins at
`4.41s`. Equal-z add/sibling order is fidelity-significant.

The Classic gameplay controller already loads the exact base achievement rasters and Arial font
before app-shell boot completes. A read-only `sharedBaseGameplayResources` getter is preferable to
loading the pause/achievement catalog again. Existing gameplay callers remain structurally
unchanged.

### Back and music

The visible Back path is immediate:

1. effects-gated `Sounds/menubuttonclick.wav`;
2. remove/replace Objectives with a fresh Main Menu at z-order `1`.

Android hardware Back performs the same replacement without the click. Objectives owns no
background music.

Entry remains the current Main Menu delayed path. The Main Menu source stops background music only
after Objectives has attached successfully. Failed destination construction/attachment must leave
Main Menu active and its music untouched.

## Exact Resource Closure

All required screen rasters and their `.meta` files are already staged in both game trees. They are
also represented in the staging manifest. No copy, rename, fallback, or scene serialization is
needed.

| Logical role | Canonical suffix | `480x800` | `720x1280` |
|---|---|---:|---:|
| full background | `Objectives/objectives-background.png` | `496x872` | `752x1352` |
| completed regular row | `Objectives/objectives-active.png` | `375x81` | `563x122` |
| other regular row | `Objectives/objectives-inactive.png` | `375x81` | `563x122` |
| fixed header/footer panel | `Objectives/objectives-objectives-background.png` | `420x150` | `672x240` |
| fixed next panel | `Objectives/objectives-next-background.png` | `420x240` | `672x384` |
| fixed next row | `Objectives/objectives-next.png` | `375x81` | `563x122` |
| Skip normal | `Objectives/button-skip.png` | `149x110` | `189x129` |
| Skip selected | `Objectives/button-skip-selected.png` | `149x110` | `189x129` |
| Back normal | `Buttons/button-blue-back-normal.png` | `144x124` | `180x150` |
| Back selected | `Buttons/button-back-selected.png` | `144x124` | `181x150` |

Shared existing presentation resources:

| Role | Existing owner |
|---|---|
| `Fonts/Arial.ttf` | `BASE_GAMEPLAY_ARIAL_FONT_RESOURCE` / loaded base gameplay resources |
| `Objectives/objectives_message.png` | base objective-achievement resource profile |
| `Objectives/next_objectives_message.png` | base objective-achievement resource profile |
| `Blades/Particles/X-Mas/xmasfive.png` | base objective-achievement resource profile |
| `Blades/Particles/X-Mas/xmasfour.png` | base objective-achievement resource profile |
| `Sounds/menubuttonclick.wav` | shared Classic audio presenter |
| `Sounds/cheer.wav` | `CLASSIC_OBJECTIVE_CHEER_AUDIO_PATH` |

The new `objectives-resource-contract.ts` should own only the ten standalone-screen rasters and
their exact dimensions. The loader should use the existing game bundle and exact-raster loader.
Compose those results with the already loaded base achievement/font resources at presenter
construction; do not broaden the Objectives loader to all gameplay pause assets.

## Settings Keys, Schema, and Transaction Boundaries

### Existing schema

| Value | Key | Default | Target representation | Durability |
|---|---|---:|---|---|
| current sequence position | `current_objective` | `0` | process-owned signed int32, valid `0...52` transiently | later bulk save |
| total cut count | `fruits_cut` | `0` | process-owned signed int32 | later bulk save |
| per-ID state | `objectives_value_{id}` for `0...51` | `0` | canonical decimal signed int32 string | immediate write |
| reward balance | `total_coins` | current Settings value | process-owned signed int32 | later bulk save |

Stored objective values mean:

| Value | Meaning |
|---:|---|
| `0` or positive | progress or per-run violation count |
| `-1` | lost |
| `-2` | finished; skip and earned completion are intentionally indistinguishable |

`ClassicSettingsState.save()` already preserves the recovered bulk tail:

```text
... background_price_6
background_price_7
current_objective
fruits_cut
enable_music
enable_effect
network_available = false
rated
```

The complete implemented bulk contract remains exactly 50 integers plus 4 booleans. Indexed
objective values remain outside that bulk schema.

### Failure policy

`ClassicSettingsRuntime` disables all writes for the process after any load recovery. Its immediate
objective adapter also validates the `objectives_value_` prefix, zero default, canonical signed
decimal text, and signed-int32 range.

The standalone screen must use `createObjectivesManager()` rather than bypassing these checks. If
storage is in recovered/fail-closed state, Skip should fail without advancing the in-memory current
position. Do not add a UI-only fake completion.

The ordinary Skip partial-commit boundary is:

```text
indexed -2 durable
  -> CurrentObjective memory
  -> popup presentation
```

The final reset is 52 sequential immediate writes after resetting two process fields. A storage
exception partway through that native-shaped reset cannot be made atomic without changing the
persistence contract. Report the failure and stop accepting Skip; do not attempt an unverified
multi-key rollback.

## Main Menu and App-Shell Integration

### Existing route

The Main Menu domain/presentation/resource contracts are already complete:

- Objectives fruit/button target ID `7`;
- orange visual at the Objectives position;
- `Sounds/strawberry.wav` accepted-cut sound;
- navigation state `3`;
- cutting disabled during the source transition;
- `0.75s` delay;
- destination `ObjectivesLayer`;
- captured-parent attachment at z-order `1`.

`main-menu-state.ts` and its tests should remain unchanged.

All three Main Menu controls are real native `Fruit` cuts and participate in objective progression:

| Purpose | Fruit ID | Objective side effects after its destination/wrapper callback |
|---|---:|---|
| Leaderboard | electric apple `13` | global selector `10`; then per-type selector `14` |
| Objectives | orange `7` | global selector `10`; then per-type selector `17` |
| New Game | strawberry `2` | global selector `10`; then per-type selector `12` |

UI `FruitButton` ordering differs from gameplay `Fruit` ordering. Main Menu first runs its
destination/wrapper callback. Only after that callback returns does the remaining shared Fruit
notification run global selector `10`, an optional registered current-mode `FruitCut` callback, and
the per-type selector. Thus a menu button can schedule navigation first, then complete an objective
and start an achievement popup before its `0.75s` delayed foreground replacement.

The current `MainMenuFruitPresenter.cut()` owns the exact accepted-cut occurrence and fruit ID. Add
objective lifecycle hooks there:

```text
cut halves/preflight
Main Menu fruit audio + navigation callback
processGlobalFruitCut()
optional registered current-mode FruitCut callback
processFruitTypeCut(presentation.fruitId)
```

The app-shell-scoped achievement host must also serve these menu-originated events so the popup
survives Main Menu -> Mode Select/Leaderboard/Objectives.

Objective progression is already irreversible when a later destination transaction can fail. Do
not include it in `rollbackCut()`. Retain separate monotonic global and per-type emission latches on
the `MainMenuFruitPresenter` occurrence: a restored/re-cut visual may retry navigation, but it must
not repeat either objective phase. Preflight the popup host before the first dispatch; an observer
fault after a mutation is not permission to replay it.

Mode Select has the same UI-wrapper-first ordering. Every accepted unlocked card cut runs its
destination/wrapper callback, then global selector `10`, optional current-mode `FruitCut`, then the
listed per-type event:

| Mode Select card | Fruit ID | Objective events after its destination callback |
|---|---:|---|
| Classic | apple `0` | selector `10`; no per-type selector |
| Crazy | banana `1` | selector `10`, then selector `11` payload `1` |
| GN Style | strawberry `2` | selector `10`, then selector `12` payload `1` |
| Classic Bird | orange `7` | selector `10`, then selector `17` payload `1` |
| Crazy Bird | magnet strawberry `14` | selector `10`; no per-type selector |
| Combo Bird | kiwi `6` | selector `10`; no per-type selector |

Locked cards have no accepted `Fruit::Cut` and emit neither phase. Options uses image selectors,
not `Fruit`, so it emits no fruit objective event.

The current failure is at the presentation boundary:

- `MainMenuPresenterLifecycle` has no `onObjectivesRequested`;
- `ObjectivesLayer` remains an unsupported destination;
- the shell emits its unsupported event, returns `false`, and Main Menu rearms;
- shell state/resources/menu-owner unions have no Objectives member.

### Required Main Menu presenter change

Add:

```text
onObjectivesRequested(transaction)
```

to the lifecycle port. Route only `ObjectivesLayer` to it. Keep `AboutLayer` unsupported.

The delayed completion must preserve its current commit point:

1. emit the exact transaction `{destination, root, timing: 'delayed', zOrder: 1}`;
2. await/receive lifecycle acceptance;
3. if false or thrown, mark the attempt complete and rearm the same Main Menu;
4. only after success, commit irreversible source removal;
5. only after success, stop background music and commit the cut-fruit cleanup.

### Required shell topology

Extend:

- shell state with `'objectives'`;
- loaded resource object with `objectives`;
- menu presenter union and source labels with `ObjectivesPresenter`;
- active owners with `activeObjectives`;
- boot load, update forwarding, destroy cleanup, and fatal pointer clearing;
- factory `createObjectivesPresenter()`;
- `transitionMainMenuToObjectives()`;
- `transitionObjectivesToMainMenu()`.

No `.scene` component is needed. Construct a detached root under the existing serialized shell.

### Main Menu -> Objectives transaction

Mirror the proven delayed Leaderboard route:

1. validate state, exact active Main Menu instance, transaction root identity, destination,
   `'delayed'`, and z-order `1`;
2. create Objectives detached, including its manager and input lifecycle;
3. replace the shared foreground root;
4. verify the returned root is the exact old Main Menu root;
5. suspend Main Menu and release its input lease;
6. activate Objectives and acquire its input lease with cutting disabled;
7. commit `activeObjectives`, clear `activeMainMenu`, and set state `'objectives'`;
8. best-effort dispose old Main Menu.

On any pre-commit failure:

- restore the exact old Main Menu root;
- dispose the attempted Objectives presenter;
- rearm Main Menu navigation/input;
- return `false` so the delayed source keeps its music and source graph.

If the old root cannot be restored, use the generalized fatal screen-ownership path: release
foreground resources, clear both active pointers, dispose both presenters, and set shell state
`failed`. Do not claim the shell is on Main Menu when the shared current root disagrees.

### Objectives -> Main Menu transaction

The visible and hardware Back inputs share the same shell transaction; only the presenter's
pre-request audio differs.

1. validate state, active Objectives identity, exact root, immediate timing, and z-order `1`;
2. create a fresh Main Menu detached;
3. replace the foreground root and verify the exact returned Objectives root;
4. suspend Objectives and release its input lease;
5. activate Main Menu;
6. commit pointers and state;
7. best-effort dispose Objectives.

On failure, restore/rearm the existing Objectives presenter. The visible Back click has already
played by recovered design and is not rolled back. Shell-owned achievement presenters continue to
update regardless of this foreground transaction.

## Baseline Mode Event Producers

### Selector coverage

| Selector | Objective IDs | Meaning | Current production producer |
|---:|---|---|---|
| `0` | `0...7` | combo counts `3...10` | Crazy/Crazy Bird, Classic Bird, Combo Bird, and GN Style dispatch; Classic explicitly discards the command. |
| `1` | `27...31`, `44` | Classic Result score | Present after committed Result attach. |
| `2` | `42`, `43` | GN Style Result score | Present after committed Result attach. |
| `3` | `38`, `39` | Crazy Result score | Present after committed Result attach. |
| `4` | `46` | no-drop Crazy phase | Present in Crazy session profile. |
| `5` | `47` | no-drop Crazy Bird phase | Present through Crazy mode-4 profile. |
| `6` | `48` | no-drop GN phase | Present in GN session. |
| `7` | `49` | no-drop Combo Bird phase | Present in Combo Bird session. |
| `8` | `50` | no-bomb Crazy phase | Present in Crazy session profile. |
| `9` | `51` | no-bomb Crazy Bird phase | Present through Crazy mode-4 profile. |
| `10` | `8...17` | total fruits | **Missing; no production call and no `fruitsCut` increment.** |
| `11` | `18` | banana | **Missing.** |
| `12` | `19` | strawberry | **Missing.** |
| `13` | `20` | ice banana | **Missing.** |
| `14` | `21` | electric fruit | **Missing.** |
| `15` | `22`, `23` | Dragon fruit | Present in Crazy-family and Classic Bird Dragon hit paths. |
| `16` | `24` | papaya | **Missing.** |
| `17` | `25` | orange | **Missing.** |
| `18` | `26` | watermelon | **Missing.** |
| `19` | `32...35`, `45` | Classic Bird Result score | Present after committed Result attach. |
| `20` | `36`, `37` | Crazy Bird Result score | Present after committed Result attach. |
| `21` | `37`, `41` | Combo Bird Result score/native ID-37 quirk | Present after committed Result attach. |

`recovered-result-objective.ts` already encodes the exact six-route Result mapping:

```text
mode 0 -> selector 1
mode 1 -> selector 3
mode 2 -> selector 2
mode 3 -> selector 19
mode 4 -> selector 20
mode 5 -> selector 21
```

Those calls are deliberately latched after Result attachment/commit. Preserve that boundary.

The phase producers are also already correct:

- Crazy/Crazy Bird: session enter resets no-bomb then no-drop counters; fruit failure increments
  no-drop; bomb hit increments no-bomb; Time Up submits completion for both.
- GN: enter resets selector `6`; ordinary/bonus failure increments; Time Up completes.
- Combo Bird: enter resets selector `7`; failure increments; Time Up completes.
- combo service emits selector `0` only for counts at least `3`.

Do not rewrite these producers while adding the screen.

### Safest ordinary/special fruit ingress

The authoritative target callbacks run only after the entity registry has accepted a real cut:

| Route owner | Confirmed-cut callback |
|---|---|
| Main Menu | `MainMenuFruitPresenter.cut`, after `onNavigation` |
| Mode Select | `ModeSelectRopeButtonPresenter.cut`, after `onModeSelected` |
| Classic | `ClassicGameplayController.onFruitCut` |
| Crazy and Crazy Bird | `CrazyGameplayController.onOrdinaryFruitCut` / `onSpecialFruitCut` |
| Classic Bird | `ClassicBirdGameplayController.onOrdinaryFruitCut` / `onSpecialFruitCut` |
| Combo Bird | `ComboBirdGameplayController.onOrdinaryFruitCut` |
| GN Style | `GnStyleGameplayController.onOrdinaryFruitCut` |

These are the correct integration points. Do not count from touch began/moved, raycast results,
cut-dispatch commands, toss creation, cut-half presentation, or score changes; those layers can see
duplicates, rejected hits, critical score multipliers, or non-fruit entities.

Direct native call-site recovery closes gameplay ordinary/special Fruit orchestration:

1. `Fruit::CutNotification` enters `NotifycationManager::FruitCut`;
2. if the old global count is `<= 100000`, increment it once (so the retained ceiling is
   `100001`);
3. dispatch selector `10` with the retained updated global count;
4. invoke the mode's fruit-cut callback, which owns presentation, audio, score, and effects;
5. after that callback returns to `Fruit::Cut`, dispatch the per-type selector with payload `1`.

The global notification applies to every successfully cut native `Fruit`, including special fruit.
Only the seven listed IDs receive a per-type selector.

UI `FruitButton` wrappers add an earlier step:

```text
destination/wrapper callback
  -> global selector 10
  -> optional registered current-mode FruitCut
  -> per-type selector
```

Do not place Main Menu or Mode Select destination callbacks between global and per-type dispatch.

Current fruit IDs give the exact semantic mapping:

| Cut kind | Fruit ID | Objective selector |
|---|---:|---:|
| every successfully cut Fruit | ordinary or special | capped global increment, then selector `10` with the retained total |
| ordinary banana | `1` | `11` |
| ordinary strawberry | `2` | `12` |
| special ice banana / freeze fruit | `12` | `13` |
| special electric fruit | `13` | `14` |
| Dragon hit | dedicated Dragon path | `15` already present |
| ordinary papaya | `8` | `16` |
| ordinary orange | `7` | `17` |
| ordinary watermelon | `3` | `18` |

The safest domain boundary is two manager-owned operations:

```text
processGlobalFruitCut()
  -> cap/increment fruitsCut
  -> processGameEvent(10, retainedTotal)

processFruitTypeCut(fruitId)
  -> map the seven recovered IDs
  -> processGameEvent(mappedSelector, 1)
```

Each authoritative gameplay callback must call the global operation at its beginning and the
per-type operation at its end. Main Menu and Mode Select instead run their destination/wrapper
callback first, then both objective operations. This preserves the distinct native control flows.

The cascade is intentional. At sequence position `27`, a papaya cut can complete global objective
ID `12` first, advance to position `28`, then count the same cut as progress `1` for newly active
papaya objective ID `24`. Likewise, at positions `30 -> 31`, one orange cut can complete global
objective ID `13` and begin ID `25`.

Classic's combo gap is explicit in
`classic-gameplay-controller.ts`: its `process-objective` command case returns without calling the
manager. Replace only that no-op with the same dispatch used by the other route owners.

## Proposed Files and Ownership

Parallelize only new-file work. Serialize all shared shell/menu/controller edits against the current
Leaderboard and other checkpoint work.

### Owner A: pure screen contracts

May create/modify only:

```text
game/assets/scripts/domain/objectives-screen-state.ts
game/assets/scripts/domain/objectives-screen-state.ts.meta
game/assets/scripts/domain/objectives-presentation.ts
game/assets/scripts/domain/objectives-presentation.ts.meta
game/assets/scripts/domain/objectives-resource-contract.ts
game/assets/scripts/domain/objectives-resource-contract.ts.meta
tests/reconstruction/vertical-slice/objectives-screen-state.test.ts
tests/reconstruction/vertical-slice/objectives-presentation.test.ts
tests/reconstruction/vertical-slice/objectives-resource-contract.test.ts
```

Acceptance:

- 52 exact sequence rows;
- recovered stored-value-to-raster rule;
- both profile geometries;
- fixed versus scrolling nodes;
- native pre-move bounds/full overshoot;
- active-only Skip projection;
- no Settings, Cocos, audio, or shell dependency.

### Owner B: Creator presentation and exact loader

May create/modify only:

```text
game/assets/scripts/creator/objectives-resource-loader.ts
game/assets/scripts/creator/objectives-resource-loader.ts.meta
game/assets/scripts/creator/objectives-presenter.ts
game/assets/scripts/creator/objectives-presenter.ts.meta
game/assets/scripts/creator/objective-achievement-host.ts
game/assets/scripts/creator/objective-achievement-host.ts.meta
tests/reconstruction/vertical-slice/objectives-resource-loader.test.ts
tests/reconstruction/vertical-slice/objectives-presenter.test.ts
tests/reconstruction/vertical-slice/objective-achievement-host.test.ts
```

Acceptance:

- exact ten-raster load, no fallback;
- detached/inactive root;
- attach-before-activate;
- one input lease, cutting disabled, no raycast/blade;
- Back button and hardware Back are distinct audio paths into one transaction;
- Skip click/mutation/popup/refresh order;
- re-entrant Skip blocked;
- suspend/rearm/idempotent dispose;
- app-shell popup lifetime.

### Owner C: one shared integration owner

Must merge current contents and may modify:

```text
game/assets/scripts/creator/classic-gameplay-controller.ts
game/assets/scripts/creator/main-menu-fruit-presenter.ts
game/assets/scripts/creator/main-menu-presenter.ts
game/assets/scripts/creator/mode-select-rope-button-presenter.ts
game/assets/scripts/creator/mode-select-presenter.ts
game/assets/scripts/creator/recovered-app-shell-controller.ts
game/assets/scripts/creator/recovered-app-viewport.ts
tests/reconstruction/vertical-slice/main-menu-fruit-presenter.test.ts
tests/reconstruction/vertical-slice/main-menu-presenter.test.ts
tests/reconstruction/vertical-slice/mode-select-rope-button-presenter.test.ts
tests/reconstruction/vertical-slice/mode-select-presenter.test.ts
tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts
tests/reconstruction/vertical-slice/creator-scene-integration.test.ts
```

Acceptance:

- read-only base gameplay resource getter;
- process-shared objective manager/achievement host injected into Main Menu and Mode Select;
- all three Main Menu and six accepted Mode Select Fruit cuts dispatch
  destination/wrapper callback -> global -> optional current mode -> per-type exactly once;
- delayed-route rollback/re-cut cannot duplicate objective progress;
- exact delayed entry and immediate return;
- every attach/activate/suspend/dispose failure compensated;
- rollback failure fatal;
- update/destroy/resource boot coverage;
- popup host survives foreground replacement;
- no serialized Objectives component.

### Owner D: progression producer closure

May modify:

```text
game/assets/scripts/domain/objectives-manager-state.ts
game/assets/scripts/creator/classic-gameplay-controller.ts
game/assets/scripts/creator/crazy-gameplay-controller.ts
game/assets/scripts/creator/classic-bird-gameplay-controller.ts
game/assets/scripts/creator/combo-bird-gameplay-controller.ts
game/assets/scripts/creator/gn-style-gameplay-controller.ts
their directly corresponding objective/controller tests
```

This owner conflicts with Owner C on `classic-gameplay-controller.ts`; run it after shell
integration or let the same integrator own both changes. Do not assign multiple workers to that
file.

Acceptance:

- one count per confirmed cut;
- global -> mode callback -> per-type dispatch order;
- recovered `old <= 100000` increment guard and retained maximum `100001`;
- all ordinary/special Fruit cuts count globally; only seven IDs dispatch per-type;
- cascade into a newly active fruit-specific objective proved;
- Classic combo bridge active;
- no duplicate Dragon/result/phase events;
- popup completion remains synchronous and exactly once.

## Test Matrix and Quality Gates

| Layer | Required proof |
|---|---|
| objective manager regression | all 52 tables/order, values `-1/-2`, selector gates, thresholds/equality/phase rules, skip, finish/reward, last-item reset, ID-52 boundary |
| screen state | 52 row projections, current offset at `0`/middle/`51`, completed raster naming/color quirk, targeted post-Skip refresh, stale nonzero rows after final reset, bounds/full overshoot, fixed nodes |
| presentation | both profile geometry plans, exact add order/z-order, Arial sizes/content, Back/Skip placement, active/next rebinding |
| resource contract | ten exact paths/dimensions per tree, deterministic list, no duplicates, invalid tree rejection |
| loader | exact bundle paths and types, missing/undefined asset rejection, immutable grouped output |
| presenter | detached lifecycle, one input lease, cutting false, drag translation, no raycast, visible/hardware Back audio order, Skip preflight/re-entry, final reset |
| popup host | click before manager, cheer before popup roots, attach rollback, shell update, natural `4.41s` cleanup, survives Objectives -> Main, shell destruction |
| Main Menu route | exact Objectives transaction; false/throw rearms; music and cut cleanup only after acceptance |
| Main Menu objective events | IDs `13/7/2`; destination/wrapper callback before global; optional current mode then per-type; popup survives delayed route; rollback/re-cut stays at-most-once |
| Mode Select objective events | six exact IDs; locked cards inert; destination callback before global; optional current mode then mapped/no per-type event |
| shell route | both directions, exact root identity, re-entrant rejection, constructor/attach/suspend/activate/dispose faults, successful restore, fatal restore failure |
| settings | exact keys/defaults, immediate indexed durability, current/fruits/coins remain memory until save, recovery disables Skip writes |
| fruit producers | global count for every successful ordinary/special cut, `100001` cap behavior, seven-ID map, global -> mode -> per-type order, papaya/orange cascade |
| existing producers | no-drop/no-bomb reset/fail/complete, Dragon, combo, Result post-commit latching remain exactly once |
| integration | app-shell imports/wires Objectives resources and presenter; viewport includes Objectives point type; scene contains no new serialized component |

Run the narrowest tests first:

```text
objectives-manager-state
objectives-screen-state
objectives-presentation
objectives-resource-contract
objectives-resource-loader
objective-achievement-host
objectives-presenter
```

Then run Main Menu/shell/settings and per-mode focused tests, Creator bundled strict TypeScript,
scene integration, and finally the full vertical-slice suite. Static tests alone do not close the
checkpoint; Creator Preview must exercise entry, long drag, repeated Skip, final reset, Back during
an active popup, hardware Back, app hide/save, and re-entry.

## Risks and Non-Negotiable Guards

1. **Natural progression is blocked at baseline.** Existing selector unit tests call selector `10`
   synthetically; that is not production wiring. Review concurrent producer work separately.
2. **Skip is not rollback-safe.** Indexed completion is durable before presentation. Screen rollback
   and progression mutation must remain separate.
3. **Dispatch order changes progression.** Gameplay Fruit uses global -> mode -> per-type. UI
   FruitButton uses destination/wrapper callback -> global -> optional current mode -> per-type.
   A single cut intentionally can complete a global objective and then progress the newly active
   per-type objective.
4. **UI transaction rollback cannot undo progression.** Main Menu and Mode Select must latch
   objective emission per fruit occurrence so a failed route followed by a re-cut does not double
   count.
5. **Popup lifetime crosses screens.** Parenting or owning it under `ObjectivesRoot` can destroy the
   next banner on Back.
6. **Manager instances are callback-bound.** Sharing a gameplay instance can send screen Skip UI to
   a disposed mode target.
7. **Input is process-global.** Activating Objectives before suspending Main Menu, or failing to
   release on rollback, creates two gesture owners.
8. **Filename semantics are misleading.** `objectives-active.png` means stored `-2`; do not “correct”
   it by intuition.
9. **Current position `52` is transient.** It is permitted only between final advance and cycle
   reset; normal screen construction should observe `0...51`.
10. **Recovery is fail-closed.** Do not bypass Settings runtime writes to make Skip appear functional.
11. **Cycle reset is multi-write.** A mid-reset storage fault can expose partial indexed reset; do
    not invent an unverified atomic migration.
12. **Native quirks are contracts.** Preserve ID `37` in both selectors `20` and `21`, the ID-52
    `setLost` bound, and bundled description typos.
13. **Entry music has a post-commit boundary.** A failed Objectives handoff must not stop Main Menu
    music or commit its source cleanup.
14. **Back audio differs from Leaderboard.** Objectives visible Back plays before replacement;
    hardware Back is silent.
15. **No fallback resources.** Similar Icons/back art, pause objective panels, or generated shapes
    are not substitutes for the ten exact screen rasters.

## Recommendations

1. Land the pure screen/resource contracts first.
2. Land the presenter and app-shell popup host against those contracts.
3. Serialize Main Menu/shell integration with current shared-file work.
4. Land the two centralized manager fruit-cut operations. Use global -> mode -> per-type for
   gameplay Fruit, and destination/wrapper callback -> global -> optional current mode -> per-type
   for Main Menu and Mode Select FruitButton.
5. Add the Classic combo bridge without changing the other five producers.
6. Run focused, shell, mode, full-suite, TypeScript, and Creator Preview gates.
7. Update Phase 6/docs only after both the screen and natural progression producers pass; a
   Skip-only route is not “full objectives progression.”

## Unresolved Questions

No static architecture blocker remains.

Runtime validation still must settle:

1. pixel/kerning parity between legacy `CCLabelTTF` and Creator for the exact Arial bytes;
2. whether preserving the native unmasked row graph causes unacceptable draw bleed on target
   aspect ratios;
3. asset-rights clearance recorded as unresolved in the staging manifest.

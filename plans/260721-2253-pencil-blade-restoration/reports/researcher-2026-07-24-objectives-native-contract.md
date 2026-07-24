# Objectives Screen and Progression Native Contract

Date: 2026-07-24

Status: complete static contract

Scope: Main Menu entry into Objectives, `ObjectivesLayer`, `ObjectiveItem`, all 52 objective
definitions, Skip/Back/drag behavior, completion and reset semantics, persistence, popup
presentation, gameplay event producers, ordinary-fruit ordering, resources, and offline/platform
boundaries.

Evidence policy: static-only. The original APK/program was not installed, linked, loaded,
translated, emulated, or executed.

## Status legend

- **[RECOVERED]** Directly established by native symbol/body disassembly, immutable resource
  bytes, or a previously reviewed static contract.
- **[INFERRED]** Required engine/port interpretation supported by the recovered structure but
  not uniquely encoded by the application body.
- **[UNKNOWN]** Static evidence does not determine the value. No guessed value is presented as
  recovered.

Unless a paragraph is explicitly marked otherwise, the contract below is **[RECOVERED]**.

## Outcome

The Objectives route is a local, vertically draggable 52-row progression screen. It is not a
network achievement service and does not unlock game modes.

The screen has several non-obvious native behaviors that must remain explicit:

1. `CurrentObjective` is a sequence position, not an objective ID.
2. The raster named `objectives-active.png` means stored value `-2` (finished); the current
   unfinished objective uses `objectives-inactive.png`.
3. Skip has no price or confirmation, awards no coins, immediately commits `-2`, advances the
   process-only sequence position, and invokes the same completion popup as a successful finish.
4. Skip always acts on the global current objective, not the row nearest the viewport.
5. The last Skip resets all 52 stored values and the two process counters, but creates no cheer,
   banners, or particles.
6. Dragging has no inertia, clamp, page snap, or selection effect and can overshoot a bound by one
   input delta.
7. Ordinary `Fruit::Cut` dispatches the cumulative fruit event first, then the mode callback,
   then the per-type objective event. This exact order permits a single threshold papaya/orange
   cut to finish a total-fruit objective and immediately start the next per-type objective.
8. ID `40` is unreachable through `ProcessGameEvent`; ID `41` displays `> 500` but uses numeric
   target `350`; ID `37` is accepted by both Crazy Bird and Combo Bird result selectors.
9. Per-objective values commit immediately, while `CurrentObjective`, `FruitsCut`, and reward
   coins remain process state until a later bulk save.

## Evidence anchors and method

### Immutable inputs

| Evidence | Identity |
|---|---|
| Source APK | `Pencil+Blade_1.5_APKPure.apk` |
| Required APK SHA-256 | `95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa` |
| Native library | `.forensics-work/phase-01/native/libgame.so` |
| Native SHA-256 | `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e` |
| Staged resources | `.forensics-work/phase-01/jadx/resources/assets/` |
| Static symbol/resource corpus | `.forensics-work/phase-02/native/` |

The ignored working evidence is reproducible but not a versionable artifact. That boundary and
the source hash are defined in the [forensics workspace policy](../../../forensics/README.md#L1).
Static gameplay findings use recovered/inferred/unknown because original-runtime observation is
unavailable ([policy lines 101-111](../../../forensics/README.md#L101)).

The relevant curated native map covers `ObjectiveItem` at
`0x0015D0A8...0x0015D586` and `ObjectivesLayer` at
`0x0015D5E0...0x0015DFB0`
([function-map rows 566-601](../../../forensics/native/function-map.csv#L566)).
The already reviewed manager/popup recovery covers the state, arrays, dispatch, and popup bodies
([prior report](./researcher-2026-07-23-crazy-pause-objective.md#objectivesmanager-state-and-persistence)).

Static disassembly used the recorded Xcode LLVM `llvm-objdump` against only the hash-pinned
library. Important body anchors are:

| Native function | Thumb address | Contract contribution |
|---|---:|---|
| `Fruit::Cut` | `0x00150648` | per-type switch and ordering |
| `Fruit::CutNotification` | `0x00150B6E` | bridge into `NotifycationManager` |
| `NotifycationManager::FruitCut` | `0x0015CF3C` | cumulative cap, selector 10, mode-forward order |
| `ObjectiveItem::UpdateText` | `0x0015D16C` | description/reward rebinding |
| `ObjectiveItem::UpdateBackground` | `0x0015D208` | finished/inactive raster refresh |
| `ObjectiveItem::updatePosition` | `0x0015D264` | label geometry |
| `ObjectiveItem::onEnter` | `0x0015D394` | row construction, colors, typography |
| `ObjectivesLayer::keyBackClicked` | `0x0015D6A4` | silent hardware Back |
| `ObjectivesLayer::backCallback` | `0x0015D6EC` | click audio and Main Menu replacement |
| `ObjectivesLayer::UpdateCurrentIdx` | `0x0015D82C` | closest-row bookkeeping |
| `ObjectivesLayer::CanMoveBottom` | `0x0015D8BA` | first-row boundary |
| `ObjectivesLayer::CanMoveTop` | `0x0015D8E2` | last-row boundary |
| `ObjectivesLayer::ccVerticleDrag` | `0x0015D916` | direct row translation |
| `ObjectivesLayer::skipCakkback` | `0x0015D990` | Skip order and partial visual refresh |
| `ObjectivesLayer::onEnter` | `0x0015DAFC` | complete screen tree/layout/actions |
| `ObjectivesManager::PopupAchievement` | `0x0015E06C` | banners, particles, cycle reset |
| `ObjectivesManager::Achi_Skip` | `0x0015E674` | skip transition |
| `ObjectivesManager::Achi_SetFinish` | `0x0015E698` | reward transition |
| `ObjectivesManager::AchievementEvent` | `0x0015E6D8` | group rules |
| `ObjectivesManager::ProcessGameEvent` | `0x0015E794` | selector gates |

### Resource-string anchors

Direct native strings include:

```text
Sounds/menubuttonclick.wav                      0x003D05A0
Blades/Particles/X-Mas/xmasfive.png             0x003D0C9D
Blades/Particles/X-Mas/xmasfour.png             0x003D0CC1
Sounds/cheer.wav                                0x003D14FD
Objectives/button-skip.png                      0x003D1853
Objectives/button-skip-selected.png             0x003D186E
Objectives/objectives_message.png               0x003D1892
Objectives/next_objectives_message.png          0x003D18B4
Objectives/objectives-active.png                0x003E0760
Objectives/objectives-inactive.png              0x003E0781
Objectives/objectives-background.png            0x003E0894
Objectives/objectives-next.png                  0x003E08B9
Objectives/objectives-objectives-background.png 0x003E08D8
Objectives/objectives-next-background.png       0x003E0908
Buttons/button-blue-back-normal.png              0x003E0932
Buttons/button-back-selected.png                 0x003E0956
Fonts/Arial.ttf                                 0x003E0A5C
```

## Main Menu entry and lifecycle

The Objectives entry is the real orange `FruitButton`, fruit ID `7`, with circle art
`Buttons/button-circle-objectives.png`. Its position is:

```text
x = 0.75W
y = f32(0x3F228F5C)H ~= 0.6349999905H
```

The recovered Main Menu tree and button row identify this as the ninth menu-owned root
([tree lines 174-202](../../../forensics/contracts/main-menu-presentation-contract.md#L174)) and
the exact button profile is recorded in the
[FruitButton table](../../../forensics/contracts/main-menu-presentation-contract.md#L304).

First accepted cut order:

1. the shared Fruit cut route creates the halves and requests effects-gated, non-looping
   `Sounds/strawberry.wav`; the mismatched sound is exact;
2. if navigation state is `0`, Main Menu disables cutting, schedules
   `Delay(0.75) -> delayCallback`, and stores state `3`;
3. the wrapper removes its blur and scales the circle to zero over `0.75` seconds;
4. the remaining Fruit notification route runs;
5. the cumulative and per-type objective side effects described later occur before the delayed
   screen replacement;
6. at nominal `t=0.75`, capture the parent, remove Main Menu with cleanup, construct and add
   `ObjectivesLayer` to the same parent at z-order `1`;
7. only after Objectives is attached, if music is enabled, call
   `stopBackgroundMusic(false)`.

The source ordering is independently summarized in the
[Main Menu cut contract](../../../forensics/contracts/main-menu-presentation-contract.md#L344)
and [delayed navigation contract](../../../forensics/contracts/main-menu-presentation-contract.md#L407).
Repeated destination callbacks while state is nonzero do nothing.

`ObjectivesLayer` starts no music and has no entry sound. The shared `GameScene` siblings
`BackgroundLayer`, `LeafLayer`, and `ThemeLayer` remain; only the equal-z Main Menu child is
replaced by the equal-z Objectives child.

### Cross-screen fruit side effect

The three Main Menu navigation controls are ordinary Fruits, so their cuts count toward local
objectives:

| Main Menu control | Fruit ID | First cumulative event | Later per-type event |
|---|---:|---|---|
| Objectives | `7` orange | selector `10`, updated `FruitsCut` | selector `17`, payload `1` |
| Leaderboard | `13` electric | selector `10`, updated `FruitsCut` | selector `14`, payload `1` |
| New Game | `2` strawberry | selector `10`, updated `FruitsCut` | selector `12`, payload `1` |

The global increment does not depend on a registered gameplay-mode pointer. Consequently a menu
cut can finish or progress the active objective while navigation is already scheduled. Removing
this as “not gameplay” would be an intentional compatibility change, not recovered parity.

### Other UI Fruit ingress: Mode Select versus Options

All six Mode Select cards also contain the ordinary `Fruit` class. Their native ingress is:

```text
ModeSelectLayer::onEnter (0x0015C594)
  -> RopeButton::create (0x00161E28)
  -> FruitButton::onEnter (0x00150D88)
  -> first accepted blade cut
  -> Fruit::Cut (0x00150648)
```

The card's destination callback and then `FruitButton::fruitCutCallback` run before the remaining
shared Fruit notification ([Mode Select cut lines 467-475](../../../forensics/contracts/mode-select-presentation-contract.md#L467)).
That remaining route is the same objective route recovered below: cumulative selector `10`, then
the registered current-gameplay-mode `FruitCut` callback when one exists, then the per-type switch.
The Mode Select destination callback must not be confused with that optional middle callback: it
has already run before selector `10`.

| Mode Select card / destination | Fruit ID | Accepted-cut objective result |
|---|---:|---|
| Classic / `0` | `0` apple | selector `10`; no per-type selector |
| Crazy / `1` | `1` banana | selector `10`, then selector `11` payload `1` |
| GN Style / `2` | `2` strawberry | selector `10`, then selector `12` payload `1` |
| Classic Bird / `3` | `7` orange | selector `10`, then selector `17` payload `1` |
| Crazy Bird / `4` | `14` magnet strawberry | selector `10`; no per-type selector |
| Combo Bird / `5` | `6` kiwi | selector `10`; no per-type selector |

These IDs and destination states are direct card-construction values
([card table lines 300-307](../../../forensics/contracts/mode-select-presentation-contract.md#L300)).
Classic and Classic Bird are always cuttable. Crazy, GN Style, Crazy Bird, and Combo Bird enter
with their contained Fruit cut-disabled until the corresponding unlock state permits them; unlock
reenables that same Fruit rather than replacing it
([lock lines 491-521](../../../forensics/contracts/mode-select-presentation-contract.md#L491)).
Thus a locked card has no accepted `Fruit::Cut` ingress, while every accepted unlocked-card cut
increments the cumulative counter.

Options is the negative case. Its background, blade, and theme rows use `SelectItems` image
controls: Previous at `(-selectorBackground.width,0)`, backdrop/current at `(0,0)`, and Next at
`(selectorBackground.width,0)`
([Options lines 90-140](./researcher-2026-07-24-options-native-contract.md#L90)).
Those selectors instantiate no `Fruit`, `FruitButton`, or `CutObject`; therefore they have no fruit
ID, never enter `Fruit::Cut`, and emit neither selector `10` nor a per-type objective event.

## Screen tree and insertion order

`ObjectivesLayer` derives from `CCGesturesLayer`. Its `update(float)` only delegates to the
gesture base.

`onEnter` adds these roots to the Objectives layer, all at local z-order `1`, in exact order:

1. `Objectives/objectives-background.png`;
2. 52 regular `ObjectiveItem` roots, sequence positions `0...51`;
3. `Objectives/objectives-objectives-background.png` (header);
4. `Objectives/objectives-next-background.png` (footer panel);
5. one fixed `ObjectiveItem` using custom raster `Objectives/objectives-next.png`;
6. one `CCMenu`, containing Back then Skip, positioned at `(0,0)`.

The full background, header, and footer each independently run `FadeIn(1.0)`. Regular rows and
the fixed next card have no layer-owned fade or staged delay. Back and Skip are attached and
interactive while their one-second ingress actions run.

Equal-z insertion order is application-recovered. **[INFERRED]** Creator must assign explicit
sibling priorities because equal numeric priorities alone do not universally guarantee the
legacy renderer's stable insertion outcome.

## Layout and geometry

Let:

```text
W,H            = CCDirector::getWinSize()
C,L,R,T,B      = VisibleRect center/left/right/top/bottom points
headerH        = height(objectives-objectives-background.png)
footerH        = height(objectives-next-background.png)
rowW,rowH      = size(objectives-inactive.png)
Current        = CurrentObjective captured by the layer constructor
```

The screen computes:

```text
topBound    = T.y - f32(1.1 * headerH) - f32(0.5 * rowH)
bottomBound = B.y + f32(1.05 * footerH) + f32(0.5 * rowH)
spacing     = f32(1.25 * rowH)

regular row i center =
  (C.x, topBound + f32((Current - i) * spacing)), i = 0...51
```

The active sequence row therefore starts at `topBound`. Earlier/completed positions are above it;
later positions descend below it.

### Fixed shell

| Node | Position | Action |
|---|---|---|
| full background | `C` | `FadeIn(1.0)` |
| header | `(C.x, T.y - 0.5 * headerH)` | `FadeIn(1.0)` |
| footer panel | `(C.x, B.y + 0.5 * footerH)` | `FadeIn(1.0)` |
| fixed next card | `(0.5W, 0.15H)` | none |
| menu | `(0,0)` | none |

No anchor setter occurs for these sprites/items. **[INFERRED]** Their anchor is the engine's
default center anchor.

### Canonical profiles

| Quantity | 480x800 profile | 720x1280 profile |
|---|---:|---:|
| full background size | `496x872` | `752x1352` |
| regular/fixed-card size | `375x81` | `563x122` |
| header size / center | `420x150` / `(240,725)` | `672x240` / `(360,1160)` |
| footer size / center | `420x240` / `(240,120)` | `672x384` / `(360,192)` |
| `topBound` | `594.5` | `955` |
| `bottomBound` | `292.5` | `464.2` |
| row spacing | `101.25` | `152.5` |
| fixed next-card center | `(240,120)` | `(360,192)` |

The background intentionally exceeds both canonical design sizes.

## ObjectiveItem rendering

The `ObjectiveItem` constructor argument and `setID` value are sequence positions despite the
method name:

```text
activeId   = OBJECTIVE_ORDER[itemIndex]
description = OBJECTIVE_DESCRIPTIONS[activeId]
reward       = OBJECTIVE_REWARDS[itemIndex]
```

### Regular background and state

| Stored `objectives_value_{activeId}` | Semantic state | Regular raster |
|---:|---|---|
| `-2` | finished, including Skip | `Objectives/objectives-active.png` |
| `-1` | lost | `Objectives/objectives-inactive.png` |
| `0` or positive | unfinished/progress/violation count | `Objectives/objectives-inactive.png` |

There is no separate visual selection for the current row. The “active” filename is the completed
state, not the active objective.

The fixed footer card always uses the custom `Objectives/objectives-next.png`; it does not swap
between active/inactive rasters.

### Text, color, and placement

Both labels use `Fonts/Arial.ttf`.

| Label | Exact content | Font size | Anchor |
|---|---|---:|---|
| description | bundled description string | `18 * W / 400` | `(0,0.5)` |
| reward | `reward: %d coins` | `20 * W / 400` | `(0,0.5)` |

For an item center `(x,y)` and background size `(w,h)`:

```text
background = (x, y)
description = (x - w/3.5, y + 0.25h)
reward      = (x - 0.125w, y - 0.25h)
```

| State sampled during `ObjectiveItem::onEnter` | Description RGB | Reward RGB |
|---|---|---|
| finished (`-2`) | `(41,171,226)` | `(252,238,33)` |
| every other value | `(179,179,179)` | `(255,255,255)` |

Canonical font sizes are `21.6 / 24` at width `480`, and `32.4 / 36` at width `720`.

### Fixed next-objective card

The fixed card displays the active current sequence entry, not the row currently nearest the
viewport:

```text
description = descriptions[order[CurrentObjective]]
reward      = "reward: " + rewards[CurrentObjective] + " coins"
```

It has no `ExtraObjectivesString` progress line. In normal state it is unfinished, so its labels
are grey/white.

After Skip, native code invokes:

```text
fixedCard.setID(CurrentObjective)
fixedCard.UpdateText()
regularRows[max(CurrentObjective - 1, 0)].UpdateBackground()
```

`UpdateText` changes only the two strings. `UpdateBackground` changes only the raster. This
creates two exact same-screen quirks:

- a newly skipped regular row changes to `objectives-active.png`, but its description/reward
  remain grey/white until the screen is reconstructed;
- after terminal reset, only regular row `0` changes back to the inactive raster. Its labels stay
  blue/yellow and rows `1...51` retain their completed visuals until the user leaves/re-enters.

On a fresh screen entry, all rows resample storage and show internally consistent raster/colors.

## Back, Skip, and drag input

### Back image button

| Property | Contract |
|---|---|
| normal | `Buttons/button-blue-back-normal.png` |
| selected | `Buttons/button-back-selected.png` |
| initial center | `(L.x - 0.5w, B.y + h/2.5)` |
| ingress | concurrent `RotateBy(1.0,+360)` and `MoveBy(1.0,(1.05w,0))` |
| final center | `(L.x + 0.55w, B.y + h/2.5)` |

Canonical normal-raster placements:

| Profile | Initial | Final |
|---|---|---|
| 480x800 (`144x124`) | `(-72,49.6)` | `(79.2,49.6)` |
| 720x1280 (`180x150`) | `(-90,60)` | `(99,60)` |

Image-button callback order:

1. if effects are enabled, play `Sounds/menubuttonclick.wav`, non-looping;
2. `stopAllActions()` on Objectives;
3. capture current parent;
4. remove Objectives with cleanup;
5. construct and add a fresh `MainMenuLayer` to that parent at z-order `1`.

The new Main Menu constructor starts looping `Sounds/mainmenumusic.mp3` when music is enabled.
There is no delayed handoff and no save.

Hardware Back performs steps 2-5 and is silent. It does not synthesize the image-button click
effect.

### Skip image button

| Property | Contract |
|---|---|
| normal | `Objectives/button-skip.png` |
| selected | `Objectives/button-skip-selected.png` |
| initial center | `(R.x + 0.5w, 0.05H)` |
| ingress/final | `MoveTo(1.0,(R.x - 0.75w,0.05H))` |

Canonical placements:

| Profile | Initial | Final |
|---|---|---|
| 480x800 (`149x110`) | `(554.5,40)` | `(368.25,40)` |
| 720x1280 (`189x129`) | `(814.5,64)` | `(578.25,64)` |

Skip callback order:

1. if effects are enabled, play non-looping `menubuttonclick.wav`;
2. if `CurrentObjective <= 51`, resolve
   `activeId = OBJECTIVE_ORDER[CurrentObjective]`;
3. call `Achi_Skip(activeId)`;
4. after the manager and synchronous popup return, rebind/update the fixed card;
5. refresh only the just-skipped regular-row background.

There is no coin cost, affordability check, confirmation, cooldown, disabled state, or row
selection. A malformed negative `CurrentObjective` passes the native signed upper-bound test and
would index before the order table; valid reconstruction input must prevent that unsafe state
rather than emulate memory-unsafe behavior.

### Direct vertical drag

The gesture handler first delegates to `CCGesturesLayer::ccVerticleDrag`, then calculates:

```text
movement = -getDelta().y
```

Before moving:

- when `movement > 0`, require last regular row `y <= topBound`;
- when `movement < 0`, require first regular row `y >= bottomBound`;
- zero movement translates nothing.

If permitted, all 52 regular rows receive the full `(0,movement)` translation. The header,
footer, fixed next card, Back, and Skip stay fixed.

The bound is tested before applying the full delta, so one input segment can overshoot. There is
no partial clamp, scroll bar, inertia, deceleration, elastic return, flick, page snap, haptic, or
drag audio.

After every drag, including a rejected move, `UpdateCurrentIdx` finds the regular row whose y is
closest to the original row-0 anchor and records its index. That field is not consumed by Skip,
progression, footer text, or any other recovered `ObjectivesLayer` body. Scrolling is presentation
only.

## State, persistence, finish, Skip, and reset

The storage contract is already captured by the
[JNI/settings evidence](../../../forensics/native/java-jni-boundary.md#L141) and
[objective persistence report](./researcher-2026-07-23-crazy-pause-objective.md#keys-defaults-and-durability).

| State | Key/default | Native durability |
|---|---|---|
| per-ID value | `objectives_value_%d`, default `0` | immediate Java-backed synchronous commit |
| sequence position | `current_objective`, default `0` | process static until `Settings::SaveData()` |
| cumulative cuts | `fruits_cut`, default `0` | process static until `Settings::SaveData()` |
| total coins | `total_coins`, default `2014` | process static until `Settings::SaveData()` |

The Android legacy typed setters commit individually; native `flush()` is a no-op. A legacy
`UserDefault.xml` migration/read branch exists, but whether a historical user has such a file is
unknown ([JNI boundary lines 141-146](../../../forensics/native/java-jni-boundary.md#L141)).

### Stored values and bounds

| Value | Meaning |
|---:|---|
| `-2` | finished; successful completion and Skip are indistinguishable |
| `-1` | lost |
| `0` or positive | ordinary progress or per-run violation count |

Normal objective IDs are `0...51`.

- `Achi_SetValue`, `Achi_SetFinish`, and `Achi_Skip` accept signed values `<= 51`.
- `Achi_SetLose` has an off-by-one upper bound and accepts ID `52`.
- None rejects negative IDs.
- No in-APK native call site to `Achi_SetLose` was found; the lost writer is unreachable through
  recovered app call sites.

Negative IDs and malformed sequence positions are unsafe native inputs, not supported save-schema
values.

### Successful finish

`Achi_SetFinish(activeId)` synchronously:

1. immediately commits `objectives_value_{activeId} = -2`;
2. reads process `totalCoins`;
3. adds `OBJECTIVE_REWARDS[CurrentObjective]` with signed int32 behavior;
4. changes process coin state;
5. increments process `CurrentObjective`;
6. calls `PopupAchievement(CurrentObjective)`.

### Skip

`Achi_Skip(activeId)` synchronously:

1. immediately commits `objectives_value_{activeId} = -2`;
2. increments process `CurrentObjective`;
3. calls `PopupAchievement(CurrentObjective)`.

Skip adds no coins. Popup construction completes before `Achi_Skip` returns and before the
Objectives screen refreshes its footer/row.

### End-of-cycle reset

When the new sequence position is `52`, `PopupAchievement`:

1. sets process `CurrentObjective = 0`;
2. sets process `FruitsCut = 0`;
3. immediately commits value `0` to objective IDs `0...51` in ascending ID order;
4. creates no cheer, banner, label, or particle.

The just-completed/skipped `-2` write precedes the 52 zero writes. Successful completion still
adds the last reward before reset; Skip still adds none.

Pause, Replay, Quit, Back, Skip, and ordinary completion do not call `Settings::SaveData`.
Application background is the recovered bulk-save checkpoint
([persistence lines 450-484](./researcher-2026-07-23-crazy-pause-objective.md#bulk-save-ordering-relevant-to-completion)).

This creates a deliberate crash/lifecycle asymmetry: the per-ID `-2` can survive while the
corresponding sequence advance/reward does not.

## Complete 52-objective sequence

The current source port retains the exact order, rewards, targets, and bundled typo-bearing
strings ([tables lines 1-82](../../../game/assets/scripts/domain/objectives-manager-state.ts#L1)).
The table below combines the two indexing axes:

- position indexes order and reward;
- objective ID indexes description and target.

| Pos | ID | Exact bundled description | Target | Reward | Selector gate | Native rule |
|---:|---:|---|---:|---:|---|---|
| 0 | 0 | `15 times combo 3` | 15 | 99 | `0` (combo `3`) | +1; finish at target |
| 1 | 27 | `Score > 250 Classic Mode` | 250 | 111 | `1` | payload `>=` target |
| 2 | 8 | `1000 fruits total` | 1000 | 222 | `10` | payload `>=` target |
| 3 | 1 | `15 times combo 4` | 15 | 245 | `0` (combo `4`) | +1; finish at target |
| 4 | 18 | `Kill 50 bananas` | 50 | 333 | `11` | +1; finish at target |
| 5 | 9 | `2000 fruits total` | 2000 | 375 | `10` | payload `>=` target |
| 6 | 28 | `Score > 500 Classic Mode` | 500 | 444 | `1` | payload `>=` target |
| 7 | 2 | `15 times combo 5` | 15 | 555 | `0` (combo `5`) | +1; finish at target |
| 8 | 50 | `No bombs hit Crazy Mode` | 0 | 666 | `8` | phase `0/1/2` |
| 9 | 10 | `5000 fruits total` | 5000 | 695 | `10` | payload `>=` target |
| 10 | 3 | `15 times combo 6` | 15 | 750 | `0` (combo `6`) | +1; finish at target |
| 11 | 19 | `Kill 50 strawberries` | 50 | 805 | `12` | +1; finish at target |
| 12 | 42 | `Score > 500 Gangnam Style` | 500 | 870 | `2` | payload `>=` target |
| 13 | 46 | `No fruits drop Crazy Mode` | 0 | 935 | `4` | phase `0/1/2` |
| 14 | 32 | `Score > 50 Classic Bird` | 50 | 1000 | `19` | payload `>=` target |
| 15 | 48 | `No fruits drop Gangnam Style` | 0 | 1364 | `6` | phase `0/1/2` |
| 16 | 20 | `Kill 25 ice bananas` | 25 | 1437 | `13` | +1; finish at target |
| 17 | 4 | `15 times combo 7` | 15 | 1785 | `0` (combo `7`) | +1; finish at target |
| 18 | 21 | `Kill 25 electric ftuits` | 25 | 2000 | `14` | +1; finish at target |
| 19 | 29 | `Score > 1250 Classic Mode` | 1250 | 2320 | `1` | payload `>=` target |
| 20 | 11 | `10000 fruits total` | 10000 | 2495 | `10` | payload `>=` target |
| 21 | 5 | `15 tiems combo 8` | 15 | 2530 | `0` (combo `8`) | +1; finish at target |
| 22 | 22 | `Kill 50 dragon fruits` | 50 | 2635 | `15` | +1; finish at target |
| 23 | 33 | `Score > 150 Classic Bird` | 150 | 2840 | `19` | payload `>=` target |
| 24 | 51 | `No bombs hit Crazy Bird` | 0 | 3050 | `9` | phase `0/1/2` |
| 25 | 34 | `Score > 250 Classic Bird` | 250 | 3165 | `19` | payload `>=` target |
| 26 | 23 | `Kill 100 dragon fruits` | 100 | 3378 | `15` | +1; finish at target |
| 27 | 12 | `15000 fruits total` | 15000 | 3515 | `10` | payload `>=` target |
| 28 | 24 | `Kill 200 papaya` | 200 | 3676 | `16` | +1; finish at target |
| 29 | 36 | `Score > 250 Crazy Bird` | 250 | 3945 | `20` | payload `>=` target |
| 30 | 13 | `20000 fruits total` | 20000 | 4250 | `10` | payload `>=` target |
| 31 | 25 | `Kill 200 oranges` | 200 | 4268 | `17` | +1; finish at target |
| 32 | 37 | `Score > 500 Crazy Bird` | 500 | 4312 | `20` or `21` | payload `>=` target |
| 33 | 38 | `Score > 500 Crazy Mode` | 500 | 4320 | `3` | payload `>=` target |
| 34 | 14 | `25000 fruits total` | 25000 | 4425 | `10` | payload `>=` target |
| 35 | 41 | `Score > 500 Combo Bird` | **350** | 4450 | `21` | payload `>=` target |
| 36 | 26 | `Kill 200 watermelon` | 200 | 4469 | `18` | +1; finish at target |
| 37 | 15 | `37500 fruits total` | 37500 | 4475 | `10` | payload `>=` target |
| 38 | 35 | `Score > 500 Classic Bird` | 500 | 4500 | `19` | payload `>=` target |
| 39 | 47 | `No fruits drop Crazy Bird` | 0 | 4526 | `5` | phase `0/1/2` |
| 40 | 6 | `15 times combo 9` | 15 | 5055 | `0` (combo `9`) | +1; finish at target |
| 41 | 30 | `Score > 2500 Classic Mode` | 2500 | 5600 | `1` | payload `>=` target |
| 42 | 40 | `Score > 350 Combo Bird` | **500** | 5675 | **none** | unreachable through dispatcher |
| 43 | 49 | `No fruits drop Combo Bird` | 0 | 5700 | `7` | phase `0/1/2` |
| 44 | 45 | `Score = 123 Classic Bird` | 123 | 5777 | `19` | payload `==` target |
| 45 | 39 | `Score > 1000 Crazy Mode` | 1000 | 5850 | `3` | payload `>=` target |
| 46 | 31 | `Score > 3500 Classic Mode` | 3500 | 5915 | `1` | payload `>=` target |
| 47 | 16 | `50000 fruits total` | 50000 | 5937 | `10` | payload `>=` target |
| 48 | 43 | `Score > 750 Gangnam Style` | 750 | 5962 | `2` | payload `>=` target |
| 49 | 44 | `Score = 1437 Classic Mode` | 1437 | 6999 | `1` | payload `==` target |
| 50 | 7 | `15 times combo 10` | 15 | 7234 | `0` (combo `10`) | +1; finish at target |
| 51 | 17 | `70000 fruits total` | 70000 | 7500 | `10` | payload `>=` target |

`tiems` and `ftuits` are exact bundled typos. Do not silently correct them in a fidelity build.

Every description using `>` in IDs `27...43` actually finishes at equality because the body uses
`payload >= target`. IDs `44/45` use exact equality. The numeric ID `40/41` targets are effectively
swapped relative to their display text: ID `40` says `> 350` but has target `500` and no dispatcher
route; ID `41` says `> 500` but completes from Combo Bird selector `21` at `350`.

### Pause/progress strings

The standalone screen does not show these strings, but the same active objective appears on
gameplay Pause:

| Active ID | Exact progress text |
|---|---|
| `0...7` | `(%d times to go)` using target minus stored value |
| `8...17` | `(%d fruits to go)` using target minus process `FruitsCut` |
| `18...26` | `(%d to go)` using target minus stored value |
| `27...51` | empty |

Remaining values are not clamped, so corrupt/over-target state can display a negative number.

## Selector gates and progression algorithm

`ProcessGameEvent(selector,payload)`:

1. returns when `CurrentObjective > 51`;
2. resolves `activeId = OBJECTIVE_ORDER[CurrentObjective]`;
3. returns for selectors outside `0...21`;
4. invokes `AchievementEvent(activeId,true,payload)` only when that selector permits the active
   ID.

| Selector | Permitted active IDs / payload interpretation |
|---:|---|
| `0` | payload `3...10` maps to IDs `0...7`; forwarded payload becomes `1` |
| `1` | IDs `27...31`, `44` |
| `2` | IDs `42,43` |
| `3` | IDs `38,39` |
| `4` | ID `46` |
| `5` | ID `47` |
| `6` | ID `48` |
| `7` | ID `49` |
| `8` | ID `50` |
| `9` | ID `51` |
| `10` | IDs `8...17` |
| `11` | ID `18` |
| `12` | ID `19` |
| `13` | ID `20` |
| `14` | ID `21` |
| `15` | IDs `22,23` |
| `16` | ID `24` |
| `17` | ID `25` |
| `18` | ID `26` |
| `19` | IDs `32...35`, `45` |
| `20` | IDs `36,37` |
| `21` | IDs `37,41` |

The ID-`37` selector-`21` acceptance and absent ID-`40` route are direct switch results, not
inferences.

`AchievementEvent` first returns for `-2` or `-1`, then rejects objective sequence positions
earlier than `CurrentObjective`. Its groups are:

| IDs | Rule |
|---|---|
| `0...7`, `18...26` | add exactly one; on the final increment finish instead of storing target |
| `8...17`, `27...43` | finish when payload `>= target`; do not store payload |
| `44,45` | finish when payload `== target` |
| `46...51` | enabled phase rule: `0` stores zero; `1` stores `old+1`; `2` finishes iff old is zero |

All recovered `ProcessGameEvent` calls supply enabled `true`.

## Gameplay event producers

### Ordinary Fruit::Cut: exact objective-dispatch order

This ordering is resolved through the Fruit vtable, not inferred from source names:

1. `Fruit::Cut` `0x00150648` calls `CutObject::Cut` at `0x00150666`.
2. `CutObject::Cut` invokes object-vtable slot `+0x18C`.
3. Fruit vtable VA `0x004581A8` resolves that slot to
   `Fruit::CutNotification` `0x00150B6E`.
4. `Fruit::CutNotification` calls `NotifycationManager::FruitCut`
   `0x0015CF3C`.
5. `NotifycationManager::FruitCut` increments `FruitsCut` when the old signed value is
   `<= 100000`.
6. It immediately calls `ProcessGameEvent(10, updatedFruitsCut)`.
7. It then forwards `FruitCut(position,fruitId,score)` to the current gameplay mode if one is
   registered.
8. Control returns to `Fruit::Cut`.
9. `Fruit::Cut` dispatches the per-type selector below with payload `1`.

Therefore the exact objective order is:

```text
global selector 10 -> mode FruitCut callback -> per-type selector with payload 1
```

The increment ceiling means:

- old `100000` becomes `100001`;
- old `100001` stays `100001`;
- an already larger/corrupt value stays unchanged;
- selector `10` still receives the resulting current value even when no increment occurred.

The source port's helper methods preserve the mapping and cap
([manager lines 84-99 and 414-435](../../../game/assets/scripts/domain/objectives-manager-state.ts#L84)).
End-to-end orchestration must preserve the order above rather than treating the two helpers as
commutative.

### Per-type fruit switch

| `Fruit::getID()` | Fruit | Selector | Payload | Objective ID |
|---:|---|---:|---:|---:|
| `1` | banana | `11` | `1` | `18` |
| `2` | strawberry | `12` | `1` | `19` |
| `3` | watermelon | `18` | `1` | `26` |
| `7` | orange | `17` | `1` | `25` |
| `8` | papaya | `16` | `1` | `24` |
| `12` | ice banana | `13` | `1` | `20` |
| `13` | electric fruit | `14` | `1` | `21` |

Fruit IDs `4,5,6,9,10,11` and out-of-switch IDs have no per-type objective event, but still use
the preceding cumulative notification when they traverse ordinary `Fruit::Cut`.

### Same-cut cascades

Because selector `10` runs first and mutates `CurrentObjective` synchronously, the later per-type
dispatch sees the new active objective:

- at sequence position `27`, a papaya that changes `FruitsCut` to `15000` finishes ID `12`,
  advances to position `28` / ID `24`, then selector `16,1` records papaya progress `1`;
- at position `30`, an orange that changes `FruitsCut` to `20000` finishes ID `13`, advances to
  position `31` / ID `25`, then selector `17,1` records orange progress `1`.

This is recovered state-machine behavior. Reversing global/per-type order creates a different
cascade and is not native parity.

### Combo, Dragon, Result, and no-fail producers

| Producer | Event |
|---|---|
| `ComboManager::update` when a closed combo count is `> 2` | selector `0`, payload combo count |
| Dragon completion | selector `15`, payload `1` |
| `DisplayScoreLayer::onEnter`, mode `0` Classic | selector `1`, payload committed result score |
| mode `1` Crazy | selector `3`, result score |
| mode `2` GN Style | selector `2`, result score |
| mode `3` Classic Bird | selector `19`, result score |
| mode `4` Crazy Bird | selector `20`, result score |
| mode `5` Combo Bird | selector `21`, result score |

`DisplayScoreLayer`'s static mode switch is at `0x0014DA10...0x0014DA36`. Selector `21`
therefore can complete active ID `37` with a Combo Bird score, while ID `40` never receives the
result.

No-fail lifecycle events:

| Mode | Entry reset order | Violation | End-of-run pass order |
|---|---|---|---|
| Crazy | `(8,0)` then `(4,0)` | bomb `(8,1)`; ordinary/bonus miss `(4,1)` | `(8,2)` then `(4,2)` |
| Crazy Bird | `(5,0)` then `(9,0)` | ordinary/bonus miss `(5,1)`; bomb `(9,1)` | `(5,2)` then `(9,2)` |
| GN Style | `(6,0)` | ordinary/bonus miss `(6,1)` | `(6,2)` |
| Combo Bird | `(7,0)` | ordinary/bonus miss `(7,1)` | `(7,2)` |

The Crazy Bird order above is direct body recovery and supersedes the earlier candidate reversed
order in the preliminary Crazy Bird report. The exact mode functions are mapped at
[function-map lines 345-359](../../../forensics/native/function-map.csv#L345).

Only the currently active objective accepts each call.

## Completion popup

`ObjectivesManager::SetTargetLayer(CCScene*)` stores one global target. The popup body dereferences
it without a null guard for nonterminal completion. A reconstruction must bind a live popup root
before progression can finish.

### Synchronous order

For nonterminal finish or Skip:

1. objective `-2`, coin change if finishing, and `CurrentObjective++` have already occurred;
2. if effects are enabled, request non-looping `Sounds/cheer.wav` first;
3. construct/configure three particle objects;
4. construct, action, label, and add the completed banner at scene z `1`;
5. construct, action, labels, and add the next-objective banner at scene z `1`;
6. add particle 1, particle 2, then particle 3, each at scene z `1`;
7. return synchronously.

For Skip from the Objectives screen, `menubuttonclick.wav` precedes all manager mutation and the
cheer. Footer/row refresh follows the complete popup construction.

### Banners

Completed banner:

```text
resource = Objectives/objectives_message.png
initial  = (C.x, T.y + 0.5h)
visible  = (C.x, T.y - 0.5h)
action   = MoveTo(0.5,visible) -> Delay(1.0) -> MoveTo(0.5,initial)
text     = descriptions[order[CurrentObjective - 1]]
font     = Fonts/Arial.ttf, 24 * W / 400
local position = (0.5w,0.5h)
```

Timeline: visible at `t=0.5`, exit starts `t=1.5`, offscreen at `t=2.0`.

Next banner:

```text
resource = Objectives/next_objectives_message.png
initial  = (C.x, T.y + 0.5h)
visible  = (C.x, T.y - 0.5h)
action   = Delay(4.0) -> MoveTo(0.5,visible)
           -> Delay(2.5) -> MoveTo(0.5,initial)
description = descriptions[order[CurrentObjective]]
reward      = "reward: %d coins", rewards[CurrentObjective]
description font/position = 24 * W / 400, (0.5w,0.6h)
reward font/position      = 20 * W / 400, (0.625w,h/2.75)
```

Timeline: visible at `t=4.5`, exit starts `t=7.0`, offscreen at `t=7.5`.
Neither banner schedules removal; both remain offscreen scene children.

### Particles

| Emitter | Constructor `(width,durationMin,durationMax,count)` | Texture | Create | Position |
|---:|---|---|---|---|
| 1 | `(300,100,200,40)` | `xmasfive.png` | `(0.41,false,false)` | `(0.2W,0.9625H)` |
| 2 | `(300,100,200,50)` | `xmasfour.png` | `(0.41,false,false)` | `(0.5W,0.9625H)` |
| 3 | `(300,100,200,40)` | `xmasfive.png` | `(0.41,false,false)` | `(0.8W,0.9625H)` |

The current engine-independent presentation plan and tests encode the recovered banner/particle
timings ([presentation lines 3-15](../../../game/assets/scripts/domain/objective-achievement-presentation.ts#L3),
[tests lines 40-74](../../../tests/reconstruction/vertical-slice/objective-achievement-presentation.test.ts#L40)).

## Canonical resource closure

All SHA-256 values below are over immutable staged APK bytes. They identify evidence; they do not
grant redistribution rights.

### Direct Objectives screen PNGs

| Logical resource | 480x800 dimensions / SHA-256 | 720x1280 dimensions / SHA-256 |
|---|---|---|
| `Objectives/objectives-background.png` | `496x872` / `91df698b7f6c27cfc3b4b221596c20302ea28f98aa96896787a848a8d5f87dd6` | `752x1352` / `08eac19740445e86c5cd5214c97ef4d040653a0b833b652692441c5da75f6a22` |
| `Objectives/objectives-next.png` | `375x81` / `5160323b9aee164aa5f2052f3b1ada8f6af7a8165823a97173dbc1fcb13a3a90` | `563x122` / `190cf0426687217ded8dc79847e3b8ee380ea3c6936c34b59caebf620a6ae798` |
| `Objectives/objectives-objectives-background.png` | `420x150` / `3defe3ebf50d68c62612e7e77096d704c086a69cd37fd6efdad75ea8648a741d` | `672x240` / `0ff94e730b8854d0c499afcf18d4ba1911621b2fd582c8a10630cd1143899c5e` |
| `Objectives/objectives-next-background.png` | `420x240` / `82e4aaaed62fb74018efb45e386593db603083abfb365663f5c39f46d10668e9` | `672x384` / `14583a400588fc509e43bc00c821bfc4118f3760442acd3cbb3cced454a83d2b` |
| `Objectives/objectives-active.png` | `375x81` / `1d8431889001d991834046ae2ed32d644e883f32361acc0d3ededf27c1bd8a3c` | `563x122` / `61b86b3011c6bfb0638dd61351e601cd94031feea2fa5c0d4a1c0c75b1f8adfd` |
| `Objectives/objectives-inactive.png` | `375x81` / `f4dd59d8e1ab3390a0a27abc81e4dfd6fafef299dbf914f0eafd361c86bc7e89` | `563x122` / `5d5038952e6b367eaa3676ceaa8ec8e1b4bcca27e20d8256e64ef30a6132d495` |
| `Objectives/button-skip.png` | `149x110` / `de05d83e008a1b8d7eb8ab99d2309741fe9145ae5e658e3b8d25bf023d4c111f` | `189x129` / `071e74023f0004e9473db1d059e300055960b90eb31bb71d09136d5889b3a5a3` |
| `Objectives/button-skip-selected.png` | `149x110` / `4a24cf6a0db35c8d5114f3e5d5e69bb95bdb33afaca9554c797950ef77c39df2` | `189x129` / `8c411809d1f3ae4c219bf4113bb7f4935e23e42982778953232fd235017ab2ed` |
| `Buttons/button-blue-back-normal.png` | `144x124` / `a978ec6a5f7ee20f54c077bd13f94177e233dbb9cded18af239896e4a87066ef` | `180x150` / `451a19fde28ef07ce3df1991ab2adfb24e65a19279c0e59860ec5c6a67a9dbec` |
| `Buttons/button-back-selected.png` | `144x124` / `15afb10b1f0c49731a30ae9c1e1b1def410c55b4f9101e95b8ff6d4b190a8641` | `181x150` / `1b2bffab9db409a92ad97b8fae0a9d866fc6baaf49698e3ab97a38d5826d26ab` |

The high selected Back raster is one pixel wider than its normal raster. Button placement/action
math uses the normal item content geometry recovered above.

### Popup PNGs

| Logical resource | 480x800 dimensions / SHA-256 | 720x1280 dimensions / SHA-256 |
|---|---|---|
| `Objectives/objectives_message.png` | `552x138` / `98e2e5be34f722ccc0b596e165c0e57ca4c2f455de3b241c3ef652be43e89ba2` | `792x181` / `fbc6cd76fff4d9e0a14f66f05b539e92a69a3b4751141a08747d773511b6a741` |
| `Objectives/next_objectives_message.png` | `552x132` / `627ec979556cf5ff9b6b1dcd8f52d4904b7dd095f09235b9ebf88aff356b2174` | `792x180` / `dec3896378976676b9a0850d7c9a56cb9fdceda3528fe85916ca5ae88b1d2384` |
| `Blades/Particles/X-Mas/xmasfive.png` | `46x44` / `2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2` | `66x64` / `a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3` |
| `Blades/Particles/X-Mas/xmasfour.png` | `51x59` / `5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385` | `70x83` / `7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39` |

### Shared font/audio

| Logical resource | Size/format | SHA-256 |
|---|---|---|
| `Fonts/Arial.ttf` | `755624` bytes, TrueType | `b97a1e2bb9fedbf9aa99f6b14ef5a7f057c6611dd71698381cc44f77797a4223` |
| `Sounds/menubuttonclick.wav` | `32812` bytes, PCM 16-bit stereo 44100 Hz | `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e` |
| `Sounds/cheer.wav` | `188974` bytes, PCM 16-bit stereo 44100 Hz | `0310b925d91ddb256c75734f79cd87109c5418a702c9eaa458b59ac3a9aef7c0` |

The Main Menu entry art/sound dependencies remain owned by the already reviewed Main Menu
resource closure rather than duplicated into this screen-owned list.

## Offline and platform boundary

The complete `ObjectivesLayer`, `ObjectiveItem`, and `ObjectivesManager` native call closure has:

- no HTTP/network request;
- no platform achievement submission;
- no Google Play Games dependency;
- no leaderboard sync;
- no account/login;
- no ads;
- no analytics/tracking;
- no Facebook/social call;
- no review/store call;
- no feedback/email call;
- no purchase call.

`AchievementEvent` is a local progression method name, not a platform achievement API.
`network_available` is irrelevant to objective processing.

The objective manager never calls `getModeUnlock` or `setModeUnlock`. Those indexed keys are a
separate mode-selection economy in the JNI/settings inventory
([boundary lines 224-233](../../../forensics/native/java-jni-boundary.md#L224)).
Finishing or skipping an objective unlocks no mode.

The recreation must use a clean, versioned local persistence adapter. It must not copy JNI,
SharedPreferences implementation, legacy XML parser, native C++, or Cocos2d-x plumbing. Obsolete
ads, accounts, purchases, networking, and tracking remain explicitly excluded by the
[restoration boundary](../../../forensics/native/java-jni-boundary.md#L235).

No online replacement, cloud synchronization, server reconciliation, telemetry, or live
leaderboard behavior is implied by this local screen.

## Reconstruction invariants

Minimum implementation invariants:

1. Keep order/reward indexed by sequence position and text/target/value indexed by objective ID.
2. Render all 52 regular rows and the fixed current card from one immutable definition table.
3. Preserve float32 layout constants `1.1`, `1.05`, `1.25`, `0.15`, and `0.05`.
4. Preserve the exact z/insertion order and separate fixed versus scrollable ownership.
5. Do not turn scrolling into objective selection.
6. Keep Skip free, immediate, active-global, rewardless, and synchronous.
7. Keep per-ID commits distinct from later bulk-saved current/fruits/coins.
8. Preserve terminal reset write order and no-popup branch.
9. Preserve global Fruit -> mode callback -> per-type ordering.
10. Preserve ID `37/40/41` switch/target quirks instead of “correcting” them silently.
11. Bind popup ownership before any completion producer can execute.
12. Keep the route fully offline and independent of mode unlock state.

Failure-safe Creator replacement may be transactional so a destination-construction failure does
not strand the scene. That safety policy is an implementation adaptation; it must not reorder the
successful native path.

## Deterministic validation matrix

At minimum:

- initial position `0`: row 0 at `topBound`, fixed card shows ID0/reward99, regular row 0 inactive;
- completed storage: value `-2` alone selects active raster and finished colors;
- direct drag: translate every regular row by the full permitted delta, move no fixed roots, and
  demonstrate one-delta overshoot;
- viewed row versus active row: scroll away, Skip, and prove the global active objective was
  skipped;
- nonterminal Skip: click -> `-2` write -> current advance -> popup -> footer rebind -> raster-only
  row refresh, with no coin change;
- last Skip: one `-2` write, current/fruits reset, 52 ascending zero writes, no cheer/UI, and
  native same-screen partial refresh;
- successful finish: reward by sequence position, not active ID;
- pause strings for all four ID ranges;
- Fruit cap: `100000 -> 100001 -> 100001`;
- threshold papaya and orange cuts: global completion then same-cut per-type progress `1`;
- result mode mapping `0...5 -> 1,3,2,19,20,21`;
- ID41 completes at score `350`; ID40 receives no `ProcessGameEvent` route; selector21 accepts
  ID37;
- Main Menu orange/electric/strawberry cuts contribute cumulative and per-type objective events;
- Back image click audio versus silent hardware Back;
- both resource profiles resolve to the exact logical file/hash;
- no objective path calls mode unlock or an external service.

## Recovered, inferred, and unknown

### Recovered

- all 52 order, ID, text, target, reward, selector, and group-rule values;
- all direct screen resource paths, immutable dimensions, and hashes;
- screen child/add order, fixed-versus-scrollable split, z-orders, geometry, float constants, and
  action durations;
- row text, colors, anchors, font sizes, and update asymmetries;
- Back/Skip callback order and audio gates;
- drag sign, bound predicates, translation, overshoot, and non-selection;
- persistence keys/defaults/durability, finish/Skip/reset order;
- popup audio, tree, action timing, text, particle configuration, and no-terminal-popup branch;
- selector gates and gameplay/result/no-fail producers;
- Fruit global/mode/per-type order, cap, mapping, and cascade consequences;
- absence of objective-to-mode-unlock and external-service calls.

### Inferred

- default center anchors for sprites/items that receive no application-level anchor setter;
- stable legacy rendering for equal-z children; Creator should encode explicit order;
- failure-safe transactional replacement/rollback in a new engine, while preserving successful
  observable order.

### Unknown

- device-specific `VisibleRect` crop/origin beyond the two canonical profiles;
- exact historical/corrupt user save contents and whether legacy `UserDefault.xml` exists;
- safe observable behavior for negative IDs or out-of-range `CurrentObjective` in the original,
  because those paths are memory-unsafe;
- exact hit-test behavior during moving-button overlap on every historical device;
- runtime equal-z behavior under every historical renderer/device;
- ownership/license clearance for original art, audio, font, name, and trademarks.

No semantic unknown remains for the valid-state Objectives screen or progression algorithm.

## Rights boundary

Possession and hashes are not redistribution permission. Original artwork, audio, font, code,
product names, and trademarks remain unknown/not cleared until rights evidence is registered.
The public-release boundary is explicit in
[forensics policy lines 113-117](../../../forensics/README.md#L113) and Phase 6 requires replacing
or clearing every shipped item
([success criteria lines 164-173](../phase-06-recreate-full-game-content-and-progression.md#L164)).

## Sources

- [Phase 6 plan](../phase-06-recreate-full-game-content-and-progression.md)
- [Forensics workspace policy](../../../forensics/README.md)
- [Native function map](../../../forensics/native/function-map.csv)
- [Java/JNI boundary](../../../forensics/native/java-jni-boundary.md)
- [Main Menu presentation contract](../../../forensics/contracts/main-menu-presentation-contract.md)
- [Crazy Pause/ObjectivesManager static recovery](./researcher-2026-07-23-crazy-pause-objective.md)
- [GN Style native contract](./researcher-2026-07-24-gn-style-native-contract.md)
- [Combo Bird architecture map](./explorer-2026-07-24-combo-bird-architecture-map.md)
- [Current objective manager port](../../../game/assets/scripts/domain/objectives-manager-state.ts)
- [Current objective achievement presentation](../../../game/assets/scripts/domain/objective-achievement-presentation.ts)
- `.forensics-work/phase-01/native/libgame.so`
- `.forensics-work/phase-01/checksums.sha256`
- `.forensics-work/phase-01/jadx/resources/assets/`
- `.forensics-work/phase-02/native/symbols/dynamic-demangled.txt`
- `.forensics-work/phase-02/native/resource-looking-strings.txt`

## Open questions

None blocking. Device crop, malformed-save behavior, historical save presence, and content rights
remain explicitly unknown and do not prevent valid-state implementation.

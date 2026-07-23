# Crazy Pause UI and ObjectivesManager Static Recovery

Date: 2026-07-23

Status: complete static contract with one deterministic color inference

Scope: inherited Crazy Mode pause UI, pause/resume/replay/quit transitions, Crazy objective event pairs, objective progression/storage, and completion popups

Evidence policy: static-only; the original program was not installed, linked, loaded, translated, emulated, or executed

## Status legend

- **[RECOVERED]** Directly established by native symbols/body disassembly, immutable resource bytes, or an already reviewed static engine contract.
- **[INFERRED]** Deterministic implementation choice supported by the recovered structure, but not uniquely encoded by the native body.
- **[UNKNOWN]** Static evidence does not determine the value. No guessed value is presented as recovered.

Unless a paragraph is explicitly marked otherwise, the tables and procedural contracts below are **[RECOVERED]**.

## Outcome

Crazy Mode uses `BaseGameplayLayer`'s inherited pause implementation without a Crazy-specific override. The implementation is not an instantaneous pause:

1. the overlay and its three buttons become active immediately;
2. the buttons move in for `0.25f` while gameplay continues;
3. `CCDirector::pause()` runs only after that delay;
4. resume calls `CCDirector::resume()` first, hides the objective overlay immediately, and moves the three buttons out for `0.25f` while gameplay has already resumed.

Crazy's objective pairs are also fully identified:

| Pair family | Active objective gate | Exact bundled description | Payload `0` | Payload `1` | Payload `2` |
|---|---:|---|---|---|---|
| selector `4` | objective ID `46` | `No fruits drop Crazy Mode` | store `0` | increment stored value | finish only when stored value is `0` |
| selector `8` | objective ID `50` | `No bombs hit Crazy Mode` | store `0` | increment stored value | finish only when stored value is `0` |

These events are not analytics-only. A successful payload-`2` transition synchronously stores completion `-2`, awards coins, advances `CurrentObjective`, requests achievement UI, and can reset the entire objective cycle.

## Evidence anchors

### Immutable inputs

| Evidence | Location / identity |
|---|---|
| Native library | `.forensics-work/phase-01/native/libgame.so` |
| Native SHA-256 | `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e` |
| Staged APK resources | `.forensics-work/phase-01/jadx/resources/assets/` |
| Resource hashes | `.forensics-work/phase-01/checksums.sha256` |
| Phase-02 native inventory | `.forensics-work/phase-02/native/` |
| Existing Crazy call-site contract | `forensics/contracts/crazy-mode-contract.md` |

The native text virtual address equals its file offset. Writable data sections have a `0x1000` virtual-address/file-offset delta; where relevant, both forms are stated.

### Recovered function map

| Function | Normalized Thumb address | Relevant evidence |
|---|---:|---|
| `BaseGameplayLayer::PauseOutCallback()` | `0x00142678` | disables and hides options menu |
| `BaseGameplayLayer::PauseInCallback()` | `0x001426B6` | calls `CCDirector::pause()` |
| `BaseGameplayLayer::PauseOutAction()` | `0x001426C2` | director resume and `0.25f` egress |
| `BaseGameplayLayer::PauseInAction()` | `0x00142778` | UI ingress, objective refresh, delayed pause |
| `BaseGameplayLayer::QuitCallback()` | `0x00142994` | removes gameplay and adds Main Menu |
| `BaseGameplayLayer::ReplayCallback()` | `0x00142A0C` | removes gameplay and adds fresh replay instance |
| `BaseGameplayLayer::ResumeCallback()` | `0x00142A88` | resume UI/audio logic |
| `BaseGameplayLayer::InitPauseComponent()` | `0x00142AEC` | complete pause tree construction |
| `BaseGameplayLayer::PauseCallback()` | `0x00143244` | pause UI/audio entry |
| `ObjectivesManager::Achi_IsFinish()` | `0x0015E008` | value `-2` test |
| `ObjectivesManager::Achi_SetValue()` | `0x0015E016` | bounded objective-value write |
| `ObjectivesManager::Achi_IsLose()` | `0x0015E022` | value `-1` test |
| `ObjectivesManager::Achi_SetLose()` | `0x0015E038` | stores `-1` |
| `ObjectivesManager::Achi_Value()` | `0x0015E048` | bounded objective-value read |
| `ObjectivesManager::SetTargetLayer()` | `0x0015E05C` | stores popup target `CCScene*` |
| `ObjectivesManager::PopupAchievement()` | `0x0015E06C` | completion banners and particles |
| `ObjectivesManager::Achi_Skip()` | `0x0015E674` | skip transition |
| `ObjectivesManager::Achi_SetFinish()` | `0x0015E698` | finish/reward/advance transition |
| `ObjectivesManager::AchievementEvent()` | `0x0015E6D8` | objective-type progression rules |
| `ObjectivesManager::ProcessGameEvent()` | `0x0015E794` | selector-to-active-objective dispatch |
| `ObjectivesManager::ExtraObjectivesString()` | `0x0015E8C0` | pause progress string |
| `Settings::SaveData()` | `0x00163094` | bulk state checkpoint |
| `Settings::getObjectivesValue()` | `0x00163F0C` | immediate preference read |
| `Settings::setObjectivesValue()` | `0x00163F38` | immediate preference write |
| `AppDelegate::applicationDidEnterBackground()` | `0x00141D02` | stop director, save, pause music |

Crazy call-site addresses are:

| Function | Normalized Thumb address |
|---|---:|
| `CrazyModeLayer::TimeUpCallback()` | `0x0014B166` |
| `CrazyModeLayer::BonusFruitFail()` | `0x0014B200` |
| `CrazyModeLayer::BombHit()` | `0x0014B22E` |
| `CrazyModeLayer::FruitFail()` | `0x0014B270` |
| `CrazyModeLayer::onEnter()` | `0x0014B324` |

## Pause node and field contract

### Owned fields

| Offset in `BaseGameplayLayer` | Recovered role |
|---:|---|
| `+0x248` | one-item pause `CCMenu` |
| `+0x24C` | resume/replay/quit `CCMenu` |
| `+0x250` | dim `CCLayerColor` / objective overlay |
| `+0x254` | resume menu item |
| `+0x258` | replay menu item |
| `+0x25C` | quit menu item |
| `+0x260` | hidden resume point |
| `+0x268` | shown resume point |
| `+0x270` | hidden replay point |
| `+0x278` | shown replay point |
| `+0x280` | hidden quit point |
| `+0x288` | shown quit point |
| `+0x294` | objective pause-background sprite |
| `+0x298` | objective-description label |
| `+0x29C` | progress label |
| `+0x2A0` | reward label |

Crazy-owned fields begin at `+0x2A4`, so the pause fields belong to the shared base layer.

### Exact construction order

Let `W,H = CCDirector::getVisibleSize()`. Let `w,h` be the content size of the pause-background sprite.

`InitPauseComponent()` performs:

1. Store these six points:

   ```text
   resumeHidden = (-0.15W, 0.50H)
   resumeShown  = ( 0.35W, 0.50H)
   replayHidden = ( 1.25W, 0.50H)
   replayShown  = ( 0.65W, 0.50H)
   quitHidden   = ( 1.25W, 0.15H)
   quitShown    = ( 0.85W, 0.15H)
   ```

2. Create a `CCLayerColor`, set its content size to `(W,H)`, position it at `(0,0)`, and invoke a virtual byte setter with value `65`.
3. Create `Objectives/objectives-pause-background.png`.
4. Position the background at:

   ```text
   x = VisibleRect.center.x
   y = VisibleRect.top.y - 0.5h
   ```

5. Add the background to the overlay at z-order `1`.
6. Add the overlay to the gameplay layer at z-order `1`.
7. Resolve the active objective, progress string, and reward; create the three labels.
8. Add description, progress, then reward to the background, each at z-order `1`.
9. Hide the overlay.
10. Create the pause item and one-item pause menu; add that menu to gameplay at z-order `1`.
11. Create resume, replay, and quit items in that order, set their hidden positions, create one three-item menu, and add it to gameplay at z-order `1`.
12. Disable and hide the three-item menu.

Equal-z gameplay insertion order is therefore:

```text
objective overlay -> pause menu -> options menu
```

### Overlay color

- **[RECOVERED]** The native function explicitly initializes only the alpha byte of the input `ccColor4B` to `255`, then invokes a virtual setter with byte value `65`.
- **[RECOVERED]** The other three input color bytes are not initialized in the function body. Reproducing those indeterminate stack reads would reproduce undefined behavior.
- **[INFERRED]** The deterministic safe projection is black with effective opacity `65`: RGBA `(0,0,0,65)`. This matches the dim-overlay role but is not claimed as a recovered RGB triplet.

### Pause button

| Property | Exact value |
|---|---|
| Normal image | `Buttons/button-pause-normal.png` |
| Selected image | `Buttons/button-pause-selected.png` |
| Callback | `PauseCallback` |
| Position | `(0.075W * contentScaleFactor, 0.075W)` |
| Parent menu position | `(0,0)` |
| Gameplay z-order | `1` |

The asymmetric scale-factor use is recovered: it applies to the x coordinate, not the y coordinate.

### Overlay options

| Item | Normal image | Selected image | Initial position | Shown position | Callback |
|---|---|---|---|---|---|
| Resume | `Buttons/button-resume-normal.png` | `Buttons/button-resume-selected.png` | `(-0.15W,0.50H)` | `(0.35W,0.50H)` | `ResumeCallback` |
| Replay | `Buttons/button-replay-normal.png` | `Buttons/button-replay-selected.png` | `(1.25W,0.50H)` | `(0.65W,0.50H)` | `ReplayCallback` |
| Quit | `Buttons/button-quit-normal.png` | `Buttons/button-quit-selected.png` | `(1.25W,0.15H)` | `(0.85W,0.15H)` | `QuitCallback` |

The menu is positioned at `(0,0)`. Its variadic item order is resume, replay, quit.

## Pause objective text and layout

### Active-objective lookup

The native order table is at read-only VA/file offset `0x003E098C`. `CurrentObjective` is a sequence position, not an objective ID:

```text
activeId = objectiveOrder[CurrentObjective]
```

The exact 52-entry order is:

```text
[0,27,8,1,18,9,28,2,50,10,3,19,42,46,32,48,20,4,21,29,11,5,22,33,
 51,34,23,12,24,36,13,25,37,38,14,41,26,15,35,47,6,30,40,49,45,39,
 31,16,43,44,7,17]
```

Description pointers used by `PopupAchievement()` are at runtime VA `0x00448858`, file offset `0x00447858`. The same descriptions are duplicated in adjacent static pointer tables.

### Visible strings

| Label | Source |
|---|---|
| Description | `descriptions[activeId]` |
| Progress | `ExtraObjectivesString()` |
| Reward | `sprintf("reward: %d coins", rewards[CurrentObjective])` |

`reward` is indexed by sequence position. It is not indexed by `activeId`.

`ExtraObjectivesString()` returns:

| Active ID range | Exact result |
|---|---|
| `0...7` | `sprintf("(%d times to go)", targets[id] - objectiveValue(id))` |
| `8...17` | `sprintf("(%d fruits to go)", targets[id] - FruitsCut)` |
| `18...26` | `sprintf("(%d to go)", targets[id] - objectiveValue(id))` |
| `27...51` | empty string |
| `CurrentObjective > 51` | empty string |

The format strings are at `0x003D05FE`, `0x003D060F`, and `0x003D18DC`.

`InitPauseComponent()` contains a redundant manual progress-format block and then overwrites its buffer with `strcpy(buffer, ExtraObjectivesString())`. The observable initial text is therefore exactly the `ExtraObjectivesString()` result above.

### Typography

| Property | Exact value |
|---|---|
| Font | `Fonts/Arial.ttf` |
| All three initial label sizes | `24 * W / 400` |
| Progress anchor | `(0,0.5)` |
| Reward anchor | `(0,0.5)` |
| Description anchor | no explicit setter; engine default center anchor |

### Positions within pause background

The progress label always uses:

```text
(0.5w, 0.4335h)
```

When the progress string is empty:

```text
description = (0.5w, 0.5845h)
reward      = (0.4w, 0.3350h)
```

When it is non-empty:

```text
description = (0.5w, 0.6350h)
reward      = (0.4w, 0.2750h)
```

For active Crazy no-drop ID `46` or no-bomb ID `50`, progress is empty. Their pause cards are:

| Sequence position | Active ID | Description | Progress | Reward |
|---:|---:|---|---|---|
| `8` | `50` | `No bombs hit Crazy Mode` | empty | `reward: 666 coins` |
| `13` | `46` | `No fruits drop Crazy Mode` | empty | `reward: 935 coins` |

### Refresh-on-pause quirk

`PauseInAction()` refreshes description, progress, and reward strings synchronously after it has exposed the UI and scheduled the delayed director pause. It does not recompute label positions. A category change since construction can therefore update text while retaining the initial empty/non-empty layout branch.

## Pause state machine and call order

### Pause request

`PauseCallback(sender)`:

1. Dispatch virtual `PauseInAction()`.
2. If effects are enabled:
   1. request `Sounds/menubuttonclick.wav`, non-looping;
   2. call `pauseAllEffects()`.
3. If music is enabled, call `pauseBackgroundMusic()`.

The click is requested and then immediately included in the global effect pause.

`PauseInAction()`:

1. set objective overlay visible;
2. set options menu enabled;
3. set options menu visible;
4. set pause menu disabled;
5. set pause menu invisible;
6. run `MoveTo(0.25)` on resume to `(0.35W,0.50H)`;
7. run `MoveTo(0.25)` on replay to `(0.65W,0.50H)`;
8. run `MoveTo(0.25)` on quit to `(0.85W,0.15H)`;
9. run `Delay(0.25) -> PauseInCallback` on the gameplay layer;
10. refresh description, progress, and reward label strings.

`PauseInCallback()` then calls `CCDirector::pause()`.

### Resume request

`ResumeCallback(sender)`:

1. Dispatch virtual `PauseOutAction()`.
2. If effects are enabled:
   1. request `Sounds/menubuttonclick.wav`, non-looping;
   2. call `resumeAllEffects()`.
3. If music is enabled:
   1. call virtual `GetGameMode()`;
   2. call `resumeBackgroundMusic()` only when the result equals `2`.

Crazy returns mode `1`. Its background music can be paused by `PauseCallback` but is not resumed by `ResumeCallback`. This asymmetry is recovered.

`PauseOutAction()`:

1. call `CCDirector::resume()` first;
2. hide the objective overlay immediately;
3. enable the pause menu immediately;
4. show the pause menu immediately;
5. move resume to `(-0.15W,0.50H)` over `0.25`;
6. move replay to `(1.25W,0.50H)` over `0.25`;
7. move quit to `(1.25W,0.15H)` over `0.25`;
8. run `Delay(0.25) -> PauseOutCallback` on the gameplay layer.

`PauseOutCallback()` disables and hides the options menu.

During egress, the options menu remains enabled and visible while the pause menu is already enabled and visible.

### No debounce/cancellation

There is no pause-state guard and `PauseOutAction()` does not cancel the pending ingress sequence.

A resume tap during the `0.25`-second ingress can therefore:

1. call director resume before the director has paused;
2. schedule the egress callback;
3. leave the original ingress callback scheduled;
4. allow that original callback to pause the director afterward.

Likewise, repeated option input during egress can attach additional actions/callbacks. This is a recovered native race, not a recommended modern interaction model.

## Replay and quit from the pause menu

### Replay callback

`ReplayCallback(sender)` executes:

1. `SimpleAudioEngine::sharedEngine()`;
2. `stopBackgroundMusic(false)`;
3. `SimpleAudioEngine::sharedEngine()`;
4. `stopAllEffects()`;
5. dispatch virtual `PauseOutAction()`; this resumes the director first;
6. call `stopAllActions()` on the old gameplay layer, cancelling its pause ingress/egress sequences;
7. capture the old layer's parent;
8. call the parent's one-argument `removeChild(oldLayer)` virtual, whose bundled wrapper supplies cleanup `true`;
9. call virtual `GetReplayInstance()` on the old gameplay object;
10. add the returned fresh layer to the captured parent at z-order `1`;
11. if effects are enabled, request non-looping `Sounds/menubuttonclick.wav`.

For Crazy, `GetReplayInstance()` constructs a fresh `CrazyModeLayer`; its `onEnter()` runs on attachment and resets whichever Crazy no-drop/no-bomb objective is active.

Replay makes no Settings save call.

### Quit callback

`QuitCallback(sender)` executes:

1. dispatch virtual `PauseOutAction()`; this resumes the director first;
2. call `stopAllActions()` on the old gameplay layer;
3. capture the old layer's parent;
4. remove the old layer through the parent's one-argument `removeChild`, with bundled cleanup `true`;
5. allocate and construct `MainMenuLayer`;
6. add Main Menu to the captured parent at z-order `1`;
7. if effects are enabled, request non-looping `Sounds/menubuttonclick.wav`.

Quit does not stop background music or effects before replacement and makes no Settings save call. Any Main Menu `onEnter()` side effects caused synchronously by attachment occur before the callback's final click request.

## Scheduler, physics, time, and input effects

### Director behavior

The bundled engine bodies establish:

- `CCDirector::pause()` is idempotent, stores the old animation interval, selects a paused interval of `0.25`, and marks the director paused.
- `CCDirector::drawScene()` continues rendering but skips scheduler update while paused.
- `CCDirector::resume()` restores the interval, refreshes the wall-time sample, clears paused state, and zeros the next delta.

Consequences for Crazy:

| Phase | Scheduler/actions | Box2D step | `TimeManager` | Toss controllers | Blade cut policy |
|---|---|---|---|---|---|
| `0.25s` ingress | running | running | running | running | unchanged |
| fully paused | skipped | skipped because its scheduled update is skipped | preserved | elapsed/threshold preserved | unchanged |
| instant resume / `0.25s` egress | running, with first resumed delta zeroed | running | running | running | unchanged |

No pause callback calls `PhysicsLayer::FreezeeWorld()`, controller `Pause()`, `DisableCut()`, or a touch-unregister API. Physics state is preserved by the director scheduler gate, not by modifying bodies or world state.

### Input boundary

- **[RECOVERED]** The options menu is enabled before the director pause and remains the path that can deliver Resume while the director is paused.
- **[RECOVERED]** The gameplay touch delegates and blade cut flag are not disabled by these callbacks.
- **[RECOVERED]** During ingress, gameplay and menu input coexist while simulation still advances.
- **[UNKNOWN]** Static bodies alone do not prove which overlapping gameplay touches are swallowed by the menu dispatcher on every device/input ordering. A fidelity implementation must preserve the recovered enable/visible/cut states; it must not invent a global input lock and call that native behavior.

## ObjectivesManager state and persistence

### State representation

| Stored value | Meaning |
|---:|---|
| `0` or positive | ordinary progress / per-run violation counter |
| `-1` | lost |
| `-2` | finished; skip and successful finish are indistinguishable in this value |

`Achi_IsFinish(id)` is true exactly when the value is `-2`. `Achi_IsLose(id)` is true exactly when it is `-1`.

Normal objective IDs are `0...51`. `Achi_SetValue`, `Achi_SetFinish`, and `Achi_Skip` accept values up through ID `51`. `Achi_SetLose` has a recovered off-by-one boundary and also permits ID `52`.

### Keys, defaults, and durability

| State | Storage | Key | Default | Mutation durability |
|---|---|---|---:|---|
| Per-ID objective value | `CCUserDefault` integer | `objectives_value_%d` | `0` | immediate setter; Android adapter commits synchronously |
| Current sequence position | native static | `current_objective` on bulk save | `0` | process memory until `Settings::SaveData()` |
| Global fruit count | native static | `fruits_cut` on bulk save | `0` | process memory until `Settings::SaveData()` |
| Total coins | native static | `total_coins` on bulk save | `2014` | `setTotalCoins` changes static value and calls a no-op native `flush`; durable at later bulk save |

Static anchors are:

```text
CurrentObjective = 0x004823B4
FruitsCut        = 0x004822B0
totalCoins       = 0x00482474
```

The key literals are:

```text
current_objective  @ 0x003D1E88
fruits_cut         @ 0x003D1E9A
objectives_value_%d @ 0x003D1EF5
total_coins        @ 0x003D1B85
```

`getObjectivesValue(id)` formats the indexed key and reads `CCUserDefault` on every call with default `0`. `setObjectivesValue(id,value)` formats the same key and calls the integer setter immediately.

### Bulk save ordering relevant to completion

`Settings::SaveData()` writes `total_coins` first. Near the end of its 50-integer sequence it writes:

```text
background_price_6
background_price_7
current_objective
fruits_cut
enable_music
enable_effect
network_available = false
rated
flush()
```

The Java-backed typed setters commit individually; the final native `flush()` is a no-op.

`AppDelegate::applicationDidEnterBackground()` performs:

1. director stop-animation virtual call;
2. `Settings::SaveData()`;
3. `pauseBackgroundMusic()`.

Pause, Resume, Replay, Quit, and objective completion do not call `Settings::SaveData()`.

### Completion persistence asymmetry

On successful completion:

1. objective value `-2` is persisted immediately;
2. reward coins are changed only in the process-static total;
3. `CurrentObjective` is changed only in process-static memory;
4. the popup is created;
5. coins and current sequence position become durable only at a later bulk-save checkpoint.

This asymmetry must be explicit in a fidelity port. Treating every field as atomically persisted would be a product change.

## Objective arrays

### Rewards by sequence position

The reward table begins at `0x003E0A6C`:

```text
[99,111,222,245,333,375,444,555,666,695,750,805,870,935,1000,1364,
 1437,1785,2000,2320,2495,2530,2635,2840,3050,3165,3378,3515,3676,
 3945,4250,4268,4312,4320,4425,4450,4469,4475,4500,4526,5055,5600,
 5675,5700,5777,5850,5915,5937,5962,6999,7234,7500]
```

### Targets by objective ID

The target table begins at `0x003E0B44`:

```text
[15,15,15,15,15,15,15,15,
 1000,2000,5000,10000,15000,20000,25000,37500,50000,70000,
 50,50,25,25,50,100,200,200,200,250,500,1250,2500,3500,
 50,150,250,500,250,500,500,1000,500,350,500,750,1437,123,
 0,0,0,0,0,0]
```

IDs `46...51` use the phase/counter rule rather than their zero target.

### Exact descriptions by objective ID

| ID | Bundled string |
|---:|---|
| 0 | `15 times combo 3` |
| 1 | `15 times combo 4` |
| 2 | `15 times combo 5` |
| 3 | `15 times combo 6` |
| 4 | `15 times combo 7` |
| 5 | `15 tiems combo 8` |
| 6 | `15 times combo 9` |
| 7 | `15 times combo 10` |
| 8 | `1000 fruits total` |
| 9 | `2000 fruits total` |
| 10 | `5000 fruits total` |
| 11 | `10000 fruits total` |
| 12 | `15000 fruits total` |
| 13 | `20000 fruits total` |
| 14 | `25000 fruits total` |
| 15 | `37500 fruits total` |
| 16 | `50000 fruits total` |
| 17 | `70000 fruits total` |
| 18 | `Kill 50 bananas` |
| 19 | `Kill 50 strawberries` |
| 20 | `Kill 25 ice bananas` |
| 21 | `Kill 25 electric ftuits` |
| 22 | `Kill 50 dragon fruits` |
| 23 | `Kill 100 dragon fruits` |
| 24 | `Kill 200 papaya` |
| 25 | `Kill 200 oranges` |
| 26 | `Kill 200 watermelon` |
| 27 | `Score > 250 Classic Mode` |
| 28 | `Score > 500 Classic Mode` |
| 29 | `Score > 1250 Classic Mode` |
| 30 | `Score > 2500 Classic Mode` |
| 31 | `Score > 3500 Classic Mode` |
| 32 | `Score > 50 Classic Bird` |
| 33 | `Score > 150 Classic Bird` |
| 34 | `Score > 250 Classic Bird` |
| 35 | `Score > 500 Classic Bird` |
| 36 | `Score > 250 Crazy Bird` |
| 37 | `Score > 500 Crazy Bird` |
| 38 | `Score > 500 Crazy Mode` |
| 39 | `Score > 1000 Crazy Mode` |
| 40 | `Score > 350 Combo Bird` |
| 41 | `Score > 500 Combo Bird` |
| 42 | `Score > 500 Gangnam Style` |
| 43 | `Score > 750 Gangnam Style` |
| 44 | `Score = 1437 Classic Mode` |
| 45 | `Score = 123 Classic Bird` |
| 46 | `No fruits drop Crazy Mode` |
| 47 | `No fruits drop Crazy Bird` |
| 48 | `No fruits drop Gangnam Style` |
| 49 | `No fruits drop Combo Bird` |
| 50 | `No bombs hit Crazy Mode` |
| 51 | `No bombs hit Crazy Bird` |

Typos such as `tiems` and `ftuits` are exact bundled strings.

## ProcessGameEvent and progression algorithm

### Dispatch

`ProcessGameEvent(selector,payload)`:

1. load `CurrentObjective`; return when it is greater than `51`;
2. calculate `activeId = objectiveOrder[CurrentObjective]`;
3. switch on selectors `0...21`; return for any other selector;
4. gate the call by the selector's permitted active IDs;
5. invoke `AchievementEvent(activeId,true,payload)` when permitted.

The exact selector gates are:

| Selector | Permitted active objective IDs |
|---:|---|
| 0 | payload `3...10` maps respectively to IDs `0...7`; forwarded payload becomes `1` |
| 1 | `27...31`, `44` |
| 2 | `42...43` |
| 3 | `38...39` |
| 4 | `46` |
| 5 | `47` |
| 6 | `48` |
| 7 | `49` |
| 8 | `50` |
| 9 | `51` |
| 10 | `8...17` |
| 11 | `18` |
| 12 | `19` |
| 13 | `20` |
| 14 | `21` |
| 15 | `22...23` |
| 16 | `24` |
| 17 | `25` |
| 18 | `26` |
| 19 | `32...35`, `45` |
| 20 | `36...37` |
| 21 | `37` or `41` |

Selector `21`'s ID-`37`/ID-`41` combination is a recovered native quirk.

### AchievementEvent rules

`AchievementEvent(id,enabled,payload)`:

1. return if value is `-2`;
2. return if value is `-1`;
3. find `id` in `objectiveOrder`;
4. return when that sequence position is less than `CurrentObjective`;
5. read current value and target;
6. apply the objective-ID group rule:

| Objective IDs | Rule |
|---|---|
| `0...7`, `18...26` | increment by exactly one; if the increment reaches target, finish instead of storing the increment |
| `8...17`, `27...43` | finish when `payload >= target`; it does not store payload as progress |
| `44...45` | finish when `payload == target` |
| `46...51` | require `enabled=true`; payload `0` stores `0`; payload `1` stores `old+1`; payload `2` finishes only when `old==0`; other payloads do nothing |

`ProcessGameEvent` always supplies `enabled=true`.

### Finish and skip

`Achi_SetFinish(id)`:

1. if `id > 51`, return;
2. persist objective value `-2`;
3. read current total coins;
4. add `rewards[CurrentObjective]` using the native signed-int32 arithmetic behavior;
5. call `setTotalCoins(newTotal)`;
6. increment `CurrentObjective`;
7. call `PopupAchievement(CurrentObjective)`.

`Achi_Skip(id)`:

1. if `id > 51`, return;
2. persist objective value `-2`;
3. increment `CurrentObjective`;
4. call `PopupAchievement(CurrentObjective)`.

Skip awards no coins.

When the popup argument is greater than `51`, `PopupAchievement()`:

1. sets `CurrentObjective = 0`;
2. sets `FruitsCut = 0`;
3. writes value `0` to objective IDs `0...51`, one immediately committed indexed write at a time;
4. creates no audio, banner, label, or particles.

## Crazy call sites and exact effects

| Crazy callback | Event call and order | Objective effect |
|---|---|---|
| `onEnter()` | after `BaseGameplayLayer::onEnter()` and `BonusManager::Reset()`: `(8,0)`, then `(4,0)` | reset the active ID-50 or ID-46 violation counter |
| `FruitFail(position)` | inherited base no-op, then `(4,1)` | increment ID-46 counter only when ID46 is active |
| `BonusFruitFail(position)` | `(4,1)` | same |
| `BombHit()` | disable cut, base no-op, score `-10`, disable/flush double score, stop magnet toss, then `(8,1)` | increment ID-50 counter only when ID50 is active |
| immediate time-up | stop nine listed toss controllers, stop BombElectric, finish double score, then `(8,2)`, then `(4,2)` | complete active zero-violation Crazy objective |

Only one objective is active:

- at `CurrentObjective == 8`, active ID is `50`; selector `8` acts and selector `4` is a no-op;
- at `CurrentObjective == 13`, active ID is `46`; selector `4` acts and selector `8` is a no-op;
- at every other sequence position, all Crazy selector-`4`/selector-`8` calls are no-ops.

Replay or re-entering Crazy submits payload `0` again, so failed attempts do not carry a positive violation count into the next run.

### Successful no-bomb run

Starting at sequence position `8`:

1. `(8,0)` immediately persists `objectives_value_50 = 0`;
2. each bomb hit persists `old+1`;
3. time-up `(8,2)` checks the stored value;
4. if zero, persist `-2`, award `666`, set `CurrentObjective = 9`, and create completion UI;
5. subsequent `(4,2)` sees active ID `10` and does nothing.

The next-objective popup describes ID `10` and shows `reward: 695 coins`. The `695` is the next objective's reward; the completed run awarded `666`.

### Successful no-drop run

Starting at sequence position `13`:

1. `(4,0)` immediately persists `objectives_value_46 = 0`;
2. each ordinary or bonus fruit fail persists `old+1`;
3. time-up `(8,2)` is a no-op;
4. `(4,2)` checks ID46's stored value;
5. if zero, persist `-2`, award `935`, set `CurrentObjective = 14`, and create completion UI.

The next-objective popup describes ID `32` and shows `reward: 1000 coins`. The completed run awarded `935`.

## Achievement popup contract

### Required target

`SetTargetLayer(CCScene*)` stores one global target pointer. `PopupAchievement()` dereferences it without a null guard when adding banners and particles.

An implementation must bind a live popup root before a completion can occur. Silently discarding completion UI is not equivalent to the native route.

### Completion audio

If effects are enabled, completion first requests:

```text
Sounds/cheer.wav
```

non-looping.

### Completed-objective banner

1. Create `Objectives/objectives_message.png`.
2. Position it above the viewport:

   ```text
   x = VisibleRect.center.x
   y = VisibleRect.top.y + 0.5h
   ```

3. Run:

   ```text
   MoveTo(0.5, center.x, top.y - 0.5h)
   -> Delay(1.0)
   -> MoveTo(0.5, center.x, top.y + 0.5h)
   ```

4. Resolve completed description as:

   ```text
   descriptions[objectiveOrder[CurrentObjective - 1]]
   ```

5. Create that label with `Fonts/Arial.ttf` at `24 * winWidth / 400`.
6. Position the label at `(0.5w,0.5h)` inside the banner.
7. Add the label to the banner at z-order `1`.
8. Add the banner to the target scene at z-order `1`.

Nominal timeline:

```text
t=0.0 offscreen
t=0.5 fully visible
t=1.5 begins exit
t=2.0 offscreen
```

### Next-objective banner

1. Create `Objectives/next_objectives_message.png`.
2. Position it at `(center.x, top.y + 0.5h)`.
3. Run:

   ```text
   Delay(4.0)
   -> MoveTo(0.5, center.x, top.y - 0.5h)
   -> Delay(2.5)
   -> MoveTo(0.5, center.x, top.y + 0.5h)
   ```

4. Resolve next description as:

   ```text
   descriptions[objectiveOrder[CurrentObjective]]
   ```

5. Create description at `24 * winWidth / 400`.
6. Format the next sequence reward as `reward: %d coins`.
7. Create reward at `20 * winWidth / 400`.
8. Position description at `(0.5w,0.6h)`.
9. Position reward at `(0.625w,h/2.75)`.
10. Add both labels to the banner with the one-argument `addChild` overload.
11. Add the banner to the target scene at z-order `1`.

Nominal timeline:

```text
t=0.0...4.0 offscreen delay
t=4.5 fully visible
t=7.0 begins exit
t=7.5 offscreen
```

`PopupAchievement()` does not schedule banner removal after egress; they remain target children offscreen.

### Particle burst

Three `ParticleExplosion` objects are constructed and configured before the banners:

| Particle | Constructor `(count,width,min,max,last)` | Texture | `Create` parameters | Position |
|---:|---|---|---|---|
| 1 | `(50,300,100.0,200.0,40)` | `Blades/Particles/X-Mas/xmasfive.png` | `(0.41,false,false)` | `(0.2W,0.9625H)` |
| 2 | `(50,300,100.0,200.0,50)` | `Blades/Particles/X-Mas/xmasfour.png` | `(0.41,false,false)` | `(0.5W,0.9625H)` |
| 3 | `(50,300,100.0,200.0,40)` | `Blades/Particles/X-Mas/xmasfive.png` | `(0.41,false,false)` | `(0.8W,0.9625H)` |

After both banners are configured, target-scene add order is:

```text
next-objective banner -> particle 1 -> particle 2 -> particle 3
```

Each is added at z-order `1`. The completed banner was already added earlier at z-order `1`.

### Crazy time-up overlap

Crazy submits completion during the immediate expiry callback, before `TimeManager` begins its nominal three-second Time Up presentation.

Therefore:

- completed-objective banner motion occupies time-up `t=0...2`;
- Crazy's result replacement occurs at nominal `t=3`;
- next-objective banner begins ingress at nominal `t=4`, one second after the result transition;
- because the target is a `CCScene*`, this UI is not owned by the removed Crazy layer.

## Canonical resource inventory

All hashes below are SHA-256 over immutable staged APK bytes.

### Resolution-dependent PNGs

| Logical path | 480x800 dimensions / SHA-256 | 720x1280 dimensions / SHA-256 |
|---|---|---|
| `Buttons/button-pause-normal.png` | `38x38` / `898f029601abee4d2ecd4578db0dbbd2c9a4edd199275790fa1a2799e1f82955` | `57x57` / `4110130fbdc80b4afe527e71a2525db8c04aaf2567b49276ad19c69606a820ee` |
| `Buttons/button-pause-selected.png` | `38x38` / `c20b8de5c15dad58742d2fd1f236a5c6843d5bf7b8436bab6c996490cee95d6e` | `57x57` / `d9b4c69c2f302eaa73842689e1f158cb4c8952f9d2a8140fe73c25a7e1b38201` |
| `Buttons/button-resume-normal.png` | `92x89` / `4fc4fcfbb928279c4fa7ec67df66496022d68aa6368da5bbdc303952e8fe918d` | `137x134` / `22b85847e66bf81efd873d6c463c4f22cd6b0ff14b277918db1b2eb1f6d53030` |
| `Buttons/button-resume-selected.png` | `92x89` / `b40e4d656089818319d99cf16406421f3973dd92ce0c9da97b1d060cc3e0230c` | `137x134` / `34ae852826c656ed4389e79afb51a940b39d28c247f449e76eb01c7a60d44e4d` |
| `Buttons/button-replay-normal.png` | `92x89` / `658fa662e185b4180821314f4166797ce801c369329cf2cb8699718d04fd56b3` | `138x133` / `19989c8a1a2ae583e7dbdaef5b451918ad006a5c22476a62da3dad79766cf09e` |
| `Buttons/button-replay-selected.png` | `92x89` / `20c6ca783e59ea2f0796f1d25c13d5fdb16b58257f38874394e476104449f28c` | `138x133` / `785b36174817571e388208b455d07785d7a5d7575df1bf46a3ca2e6a37e5cfb8` |
| `Buttons/button-quit-normal.png` | `156x166` / `2ac6aa0a71e202805beaa0c28cddf5886289c99cfce70fde89071d626390e2b0` | `197x213` / `ffb5b49fbaeb43ca983c0136b78506c890db08e41fe5ec7036d0e4a47652dd09` |
| `Buttons/button-quit-selected.png` | `155x166` / `565cbe5c397cd29fbe0be12e9396289eedaa64b6c67a50cf657568b1c1e98a3f` | `197x213` / `2e694d146d7f58a126ba534f07a29a4b82a9e6e9c215e71c4ab748844608c79b` |
| `Objectives/objectives-pause-background.png` | `552x206` / `eecd45a1fd6cb445049ef03a7c1c00916dc4b476a6e8416a33ee4f6e405eb28a` | `792x291` / `a6a5e9521b14664942d1df259b0028dd9035706d967b7d892db363d9ef1c4800` |
| `Objectives/objectives_message.png` | `552x138` / `98e2e5be34f722ccc0b596e165c0e57ca4c2f455de3b241c3ef652be43e89ba2` | `792x181` / `fbc6cd76fff4d9e0a14f66f05b539e92a69a3b4751141a08747d773511b6a741` |
| `Objectives/next_objectives_message.png` | `552x132` / `627ec979556cf5ff9b6b1dcd8f52d4904b7dd095f09235b9ebf88aff356b2174` | `792x180` / `dec3896378976676b9a0850d7c9a56cb9fdceda3528fe85916ca5ae88b1d2384` |
| `Blades/Particles/X-Mas/xmasfive.png` | `46x44` / `2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2` | `66x64` / `a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3` |
| `Blades/Particles/X-Mas/xmasfour.png` | `51x59` / `5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385` | `70x83` / `7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39` |

### Shared files

| Logical path | Size / format | SHA-256 |
|---|---|---|
| `Fonts/Arial.ttf` | `755624` bytes, TrueType | `b97a1e2bb9fedbf9aa99f6b14ef5a7f057c6611dd71698381cc44f77797a4223` |
| `Sounds/cheer.wav` | `188974` bytes, PCM 16-bit stereo 44100 Hz | `0310b925d91ddb256c75734f79cd87109c5418a702c9eaa458b59ac3a9aef7c0` |
| `Sounds/menubuttonclick.wav` | `32812` bytes, PCM 16-bit stereo 44100 Hz | `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e` |

Native resource-string anchors include:

```text
Sounds/menubuttonclick.wav                  0x003D05A0
Objectives/objectives-pause-background.png 0x003D0632
Blades/Particles/X-Mas/xmasfive.png         0x003D0C9D
Blades/Particles/X-Mas/xmasfour.png         0x003D0CC1
Sounds/cheer.wav                            0x003D14FD
Objectives/objectives_message.png           0x003D1892
Objectives/next_objectives_message.png      0x003D18B4
Fonts/Arial.ttf                             0x003DF2C0
Buttons/button-pause-normal.png             0x003DF2D0
Buttons/button-pause-selected.png           0x003DF2F0
Buttons/button-resume-normal.png            0x003DF312
Buttons/button-resume-selected.png          0x003DF333
Buttons/button-replay-normal.png            0x003DF356
Buttons/button-replay-selected.png          0x003DF377
Buttons/button-quit-normal.png              0x003DF39A
Buttons/button-quit-selected.png            0x003DF3B9
```

## Implementation-ready invariants

The fidelity implementation should expose these contracts explicitly:

1. `processGameEvent(selector,payload)` remains numeric at the Crazy boundary.
2. It reads the active objective before applying selector gates.
3. Objective-value writes are immediate indexed persistence; reward coins and current sequence advancement are not.
4. Successful completion and popup construction occur synchronously before `processGameEvent` returns.
5. Popup target is bound before Crazy can expire.
6. Crazy calls `(8,0)` before `(4,0)` and `(8,2)` before `(4,2)`.
7. Pause ingress does not stop simulation until `0.25f`.
8. Resume restarts the director before UI egress and does not resume mode-1 background music.
9. Replay stops music/effects before resuming/removing the old layer; Quit does not.
10. The pause overlay, pause menu, and options menu are separate equal-z gameplay children.
11. Deterministic black `(0,0,0,65)` is recorded as the one safe color inference, not mislabeled as recovered RGB.

Minimum deterministic tests:

- sequence position `8`, zero bombs: award `666`, persist ID50 `-2`, advance to `9`, and show ID10/reward695 as next;
- sequence position `8`, one bomb: no reward and no advancement at time-up;
- sequence position `13`, zero fails: award `935`, persist ID46 `-2`, advance to `14`, and show ID32/reward1000 as next;
- sequence position `13`, ordinary or bonus fail: no completion;
- any other sequence position: Crazy selectors `4` and `8` are no-ops;
- last objective completion: reset current/fruits and immediately write all 52 objective values to zero, with no popup;
- pause at `t=0`: simulation runs through nominal `t=0.25`, then freezes;
- resume: first delta is zero, overlay hides immediately, gameplay advances during egress;
- Replay and Quit route order and audio asymmetry match the callback tables;
- all logical resources resolve to the correct resolution variant and immutable hash.

## Remaining unknown

Only the native pause overlay's RGB triplet is irrecoverable from this function because the source body passes three uninitialized stack bytes. The implementation must use the declared deterministic black inference rather than emulate undefined data.

No semantic unknown remains for Crazy selectors `4` and `8`: their exact bundled descriptions and call-site meanings are statically recovered.

## Sources

- `forensics/contracts/crazy-mode-contract.md`
- `forensics/contracts/classic-time-state-contract.md`
- `forensics/native/function-map.csv`
- `forensics/native/java-jni-boundary.md`
- `.forensics-work/phase-01/native/libgame.so`
- `.forensics-work/phase-01/checksums.sha256`
- `.forensics-work/phase-01/jadx/resources/assets/`
- `.forensics-work/phase-02/native/symbols/dynamic-demangled.txt`
- `.forensics-work/phase-02/native/resource-looking-strings.txt`

## Open questions

None blocking. The sole non-recovered RGB value has an explicit deterministic implementation decision above.

# Crazy Native Contract Recovery
---
date: 2026-07-23
status: done-with-concerns
scope: static-only native recovery for CrazyModeLayer / Crazy mode
evidence-policy: static-only
---

## Summary

Crazy mode is now substantially body-recovered from static native disassembly. `CrazyModeLayer::GetGameMode()` returns `1`; `CrazyBirdLayer::GetGameMode()` returns `4`. Both Crazy layers build the same timed controller graph, start it from the go callback, freeze and unfreeze physics through dedicated callbacks, and end by creating `DisplayScoreLayer`, setting the game mode type and score, removing the active mode layer, and attaching the result layer back to the parent.

The main remaining unknowns are narrow: the observable early `ActionGoCallback` operation is recovered as remove-child-with-cleanup while only the original source-level wrapper spelling remains unknown, and the exact meaning of the objective event IDs is not independently documented outside the call sites. Those gaps do not block the Crazy module boundary anymore. The implementation gate is now **green for the module contract**, with only minor semantic unknowns left for documentation.

## Evidence Quality

- High credibility: curated native symbol map plus cross-checked contracts derived from `DER-NATIVE-001` and `DER-NATIVE-CORPUS-001`.
- High credibility: direct Thumb disassembly of `libgame.so` for `CrazyModeLayer` and `CrazyBirdLayer` bodies, including `GetGameMode`, `onEnter`, `ActionGoCallback`, `Action60sCallback`, `TimeUpCallback`, `TimeUpFinishCallback`, `BombHit`, `AfterBombHit`, `FreezeStartCallback`, and `FreezeFinishCallback`.
- High credibility: the early `ActionGoCallback` removes its stored GO child with cleanup; only the source-level wrapper spelling remains unidentified.
- Low credibility / unknown: exact human meaning of some `ObjectivesManager::ProcessGameEvent` IDs, and whether the intro/body callback labels are the final user-facing names or internal transition names.

No committed raw Ghidra/radare/objdump text artifacts were found in-repo beyond the curated native docs:
`forensics/native/function-map.csv`, `forensics/native/subsystem-map.md`, and `forensics/native/java-jni-boundary.md`.

## Recovered Symbol Map

### CrazyModeLayer

| Symbol | Address | Status | Evidence |
|---|---:|---|---|
| `CrazyModeLayer::CrazyModeLayer()` | `0x0014b7ed` | recovered | [`forensics/native/function-map.csv` lines 390-392](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L390) |
| `CrazyModeLayer::~CrazyModeLayer()` | `0x0014b749` / `0x0014b7d9` | recovered | [`forensics/native/function-map.csv` lines 386-389](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L386) |
| `CrazyModeLayer::onEnter()` | `0x0014b325` | recovered | [`forensics/native/function-map.csv` lines 383-384](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L383) |
| `CrazyModeLayer::GetGameMode()` | `0x0014ae41` | recovered; returns `1` | [`forensics/native/function-map.csv` line 370](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L370) |
| `CrazyModeLayer::GetReplayInstance()` | `0x0014b87d` | recovered | [`forensics/native/function-map.csv` line 391](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L391) |
| `CrazyModeLayer::MagnetBeginCallback()` | `0x0014ae49` | recovered | [`forensics/native/function-map.csv` line 371](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L371) |
| `CrazyModeLayer::MagnetEndCallback()` | `0x0014aea9` | recovered | [`forensics/native/function-map.csv` line 372](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L372) |
| `CrazyModeLayer::ActionGoCallback()` | `0x0014af09` | recovered; starts time manager, enables play, starts controller graph | [`forensics/native/function-map.csv` line 373](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L373) |
| `CrazyModeLayer::Action60sCallback()` | `0x0014afad` | recovered; builds the pregame 60s intro sequence | [`forensics/native/function-map.csv` line 374](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L374) |
| `CrazyModeLayer::TimeUpFinishCallback()` | `0x0014b0ed` | recovered; builds the score/result transition | [`forensics/native/function-map.csv` line 375](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L375) |
| `CrazyModeLayer::TimeUpCallback()` | `0x0014b167` | recovered; stops controllers, ends double score, posts objective completion | [`forensics/native/function-map.csv` line 376](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L376) |
| `CrazyModeLayer::FreezeStartCallback()` | `0x0014b215` | recovered; calls `PhysicsLayer::FreezeeWorld()` | [`forensics/native/function-map.csv` line 379](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L379) |
| `CrazyModeLayer::FreezeFinishCallback()` | `0x0014b20d` | recovered; calls `PhysicsLayer::UnFreezeeWorld()` | [`forensics/native/function-map.csv` line 378](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L378) |
| `CrazyModeLayer::FruitCut()` | `0x0014b28d` | recovered | [`forensics/native/function-map.csv` line 383](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L383) |
| `CrazyModeLayer::FruitFail()` | `0x0014b271` | recovered | [`forensics/native/function-map.csv` line 382](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L382) |
| `CrazyModeLayer::BonusFruitFail()` | `0x0014b201` | recovered | [`forensics/native/function-map.csv` line 377](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L377) |
| `CrazyModeLayer::BombHit()` | `0x0014b22f` | recovered | [`forensics/native/function-map.csv` line 381](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L381) |
| `CrazyModeLayer::AfterBombHit()` | `0x0014b21d` | recovered | [`forensics/native/function-map.csv` line 380](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L380) |

### CrazyBirdLayer

| Symbol | Address | Status | Evidence |
|---|---:|---|---|
| `CrazyBirdLayer::CrazyBirdLayer()` | `0x0014ad39` | recovered | [`forensics/native/function-map.csv` lines 367-369](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L367) |
| `CrazyBirdLayer::onEnter()` | `0x0014a895` | recovered | [`forensics/native/function-map.csv` line 359](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L359) |
| `CrazyBirdLayer::GetGameMode()` | `0x0014a3b5` | recovered; returns `4` | [`forensics/native/function-map.csv` line 339](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L339) |
| `CrazyBirdLayer::GetReplayInstance()` | `0x0014adc9` | recovered | [`forensics/native/function-map.csv` line 368](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L368) |
| `CrazyBirdLayer::MagnetBeginCallback()` | `0x0014a3b9` | recovered | [`forensics/native/function-map.csv` line 340](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L340) |
| `CrazyBirdLayer::MagnetEndCallback()` | `0x0014a419` | recovered | [`forensics/native/function-map.csv` line 341](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L341) |
| `CrazyBirdLayer::ActionGoCallback()` | `0x0014a479` | recovered; starts time manager, enables play, starts controller graph | [`forensics/native/function-map.csv` line 342](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L342) |
| `CrazyBirdLayer::Action60sCallback()` | `0x0014a51d` | recovered; builds the pregame 60s intro sequence | [`forensics/native/function-map.csv` line 343](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L343) |
| `CrazyBirdLayer::TimeUpFinishCallback()` | `0x0014a65d` | recovered; builds the score/result transition | [`forensics/native/function-map.csv` line 344](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L344) |
| `CrazyBirdLayer::TimeUpCallback()` | `0x0014a6d7` | recovered; stops controllers, ends double score, posts objective completion | [`forensics/native/function-map.csv` line 345](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L345) |
| `CrazyBirdLayer::FreezeStartCallback()` | `0x0014a785` | recovered; calls `PhysicsLayer::FreezeeWorld()` | [`forensics/native/function-map.csv` line 350](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L350) |
| `CrazyBirdLayer::FreezeFinishCallback()` | `0x0014a77d` | recovered; calls `PhysicsLayer::UnFreezeeWorld()` | [`forensics/native/function-map.csv` line 348](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L348) |
| `CrazyBirdLayer::FruitCut()` | `0x0014a7fd` | recovered | [`forensics/native/function-map.csv` line 356](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L356) |
| `CrazyBirdLayer::FruitFail()` | `0x0014a7e1` | recovered | [`forensics/native/function-map.csv` line 355](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L355) |
| `CrazyBirdLayer::BonusFruitFail()` | `0x0014a771` | recovered | [`forensics/native/function-map.csv` line 347](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L347) |
| `CrazyBirdLayer::BombHit()` | `0x0014a79f` | recovered | [`forensics/native/function-map.csv` line 353](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L353) |
| `CrazyBirdLayer::AfterBombHit()` | `0x0014a78d` | recovered | [`forensics/native/function-map.csv` line 352](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L352) |

## Controller and Lifecycle Map

### What is directly recovered

- `CrazyModeLayer::onEnter` and `CrazyBirdLayer::onEnter` both directly create the same controller set: `FreeToss`, `ConcurrentToss`, `WaveToss`, `DoubleToss`, `BonusToss`, `TimeManager`, and the bomb/electric support object.
- `CrazyModeLayer::GetGameMode()` returns `1`; `CrazyBirdLayer::GetGameMode()` returns `4`.
- `CrazyModeLayer::onEnter` and `CrazyBirdLayer::onEnter` both pass a `60.0f` duration into `TimeManager::create` together with four callbacks: `TimeUpCallback`, `FreezeStartCallback`, `FreezeFinishCallback`, and `TimeUpFinishCallback`.
- `ActionGoCallback` starts the `TimeManager`, re-enables cutting policy through `PhysicsBladeLayer::DisableCut(false)`, and starts the controller graph.
- `TimeUpCallback` stops the controller graph, stops the electric/bomb support object, finishes double score, and posts objective-complete events.
- `TimeUpFinishCallback` disables cutting, stops audio effects, constructs `DisplayScoreLayer`, sets game mode type and score, removes the active mode layer, and adds the result layer to the parent.

Evidence:

- [`forensics/native/function-map.csv` lines 359-366](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L359)
- [`forensics/native/function-map.csv` lines 383-384](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv#L383)
- direct `libgame.so` disassembly at `0x0014b324`, `0x0014af08`, `0x0014afac`, `0x0014b166`, `0x0014b0ec`, `0x0014ae40`, `0x0014a894`, `0x0014a478`, `0x0014a51c`, `0x0014a6d6`, and `0x0014a65c`

### What remains unknown

- The first `ActionGoCallback` child-removal call uses a virtual slot at offset `+0xE8`.
  Its observable operation is recovered as remove-child-with-cleanup; only the exact
  source-level wrapper spelling remains unknown.
- The exact human description of each `ObjectivesManager::ProcessGameEvent(mode, state)` pair is not separately documented, even though the call pattern is fully recovered.
- The body of `CrazyBirdLayer::ActionGoCallback()` is only partially checked in this pass; its overall semantics mirror `CrazyModeLayer`, but the exact start order should still be verified if that branch is being ported verbatim.

These are semantic gaps only. The core Crazy module contract itself is body-recovered.

## Classic vs Crazy Differences

| Area | Classic | Crazy | Status |
|---|---|---|---|
| Mode-select destination | state `0` | state `1` | recovered |
| Unlock key | none | `mode_unlock_1` | recovered |
| Controller additions | no `DoubleToss`, no `BonusToss` | both present in `onEnter` call sites | recovered |
| Timed-mode symbol surface | no `ActionGo` / `Action60s` / `TimeUp*` / freeze callbacks | present on `CrazyModeLayer` and `CrazyBirdLayer` | recovered |
| Result path | Classic `DisplayScoreCallback` is fully recovered | Crazy result callback chain now recovered at body level | recovered |
| Numeric `GetGameMode()` value | `ClassicModeLayer` returns `0` | Crazy return values are `1` and `4` | recovered |

## Settings and Persistence

Recovered persistence keys that matter for Crazy:

- `mode_unlock_1` for `CrazyModeLayer`.
- `mode_unlock_4` for `CrazyBirdLayer`.
- `total_coins` defaults to `2014`.
- `crazy_best_1..3` exist and default to `0`.
- `bird_crazy_best_1..3` exist and default to `0`.
- `Settings::CrazyBest_1` is anchored at `0x00482438`.
- `Settings::BirdCrazyBest_1` is anchored at `0x00482450`.
- `CrazyModeLayer::onEnter` reads `Settings::CrazyBest_1`.
- `CrazyBirdLayer::onEnter` reads `Settings::BirdCrazyBest_1`.

Evidence:

- [`forensics/native/java-jni-boundary.md` lines 150-168](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/java-jni-boundary.md#L150)
- [`forensics/native/java-jni-boundary.md` lines 172-176](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/java-jni-boundary.md#L172)
- [`forensics/contracts/mode-select-presentation-contract.md` lines 300-311](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/mode-select-presentation-contract.md#L300)
- [`forensics/contracts/mode-select-presentation-contract.md` lines 601-608](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/mode-select-presentation-contract.md#L601)
- `dynamic-demangled.txt` lines `10780-10822`

Trade-off note:

- `mode_unlock_*` is recovered and safe to implement as persisted booleans.
- `crazy_best_*` and `bird_crazy_best_*` are now tied to the Crazy result path through `TimeUpFinishCallback`, so they should be written from that terminal transition, not from generic score logic.

## RNG, Timing, and Bonus Constants

Recovered controller-level constants relevant to Crazy are the shared `DoubleToss` and `BonusToss` contracts:

- `DoubleToss` is a 15-second guarded composite.
- Its internal child `FreeToss` controllers run at `0.75..1.5s`.
- `BonusToss` candidate vector is `[12, 10, 11]`.
- `BonusToss` direction draw uses `nextInt(0, 3)` with `0 -> Left`, `1 -> Right`, `2 -> Down`, `3 -> Down`.
- `BonusToss` is data-dependent in RNG consumption because it retries until it finds an enabled bonus.

Evidence:

- [`forensics/contracts/classic-toss-contract.md` lines 262-310](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/classic-toss-contract.md#L262)

What is not recovered:

- Exact Crazy-specific countdown mechanics inside `TimeManager` beyond the recovered `60.0f` create call.
- Exact shared-RNG interleaving between Crazy-only callbacks and engine/VFX consumers.

## Implementation Gate

**Recommendation: GREEN**

Why:

- Good enough to implement the Crazy mode module boundary, controller instantiation, unlock gating, score persistence, and the terminal result transition.
- The remaining unknowns are naming-level or documentation-level gaps, not contract blockers.

Risk trade-off:

- Starting now reduces schedule risk and keeps the implementation aligned with recovered bodies.
- Waiting for perfect semantic labeling would add delay without changing the port boundary.

Architectural fit:

- Safe fit for a Cocos Creator controller/service split.
- Direct port of the native callback tree is now acceptable for the Crazy result branch because the finish flow is body-recovered.

## Open Questions

1. What was the original source-level wrapper spelling for the recovered remove-child-with-cleanup call at offset `+0xE8`?
2. What human-readable meaning should be assigned to each `ObjectivesManager::ProcessGameEvent(mode, state)` pair for Crazy?
3. Should the partially checked `CrazyBirdLayer::ActionGoCallback()` be revalidated before porting that branch verbatim?

## Sources

- [`forensics/native/function-map.csv`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/function-map.csv)
- [`forensics/native/subsystem-map.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/subsystem-map.md)
- [`forensics/native/java-jni-boundary.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/native/java-jni-boundary.md)
- [`forensics/contracts/classic-toss-contract.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/classic-toss-contract.md)
- [`forensics/contracts/mode-select-presentation-contract.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/mode-select-presentation-contract.md)
- [`forensics/contracts/classic-time-state-contract.md`](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/forensics/contracts/classic-time-state-contract.md)

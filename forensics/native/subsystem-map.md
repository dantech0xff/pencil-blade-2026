# Native Subsystem Map

Initial static map for `DER-NATIVE-001`. This is an analysis queue, not a claim that every
listed class has been fully recovered.

## Binary Surface

- ELF32 little-endian ARM EABI5 / ARMv5TE, image base `0x0`.
- 16,516 named dynamic symbols: 16,173 defined and 343 undefined imports.
- Defined surface includes 13,948 functions and 2,222 objects, plus other symbol kinds.
- The conservative application allowlist currently selects 713 functions into
  `forensics/native/function-map.csv`; all remaining symbols stay engine, Box2D, vendor,
  compiler-runtime, or unknown until reviewed.
- 41,747 relocations.
- Needed libraries: `libGLESv2.so`, `liblog.so`, `libz.so`, `libstdc++.so`, `libm.so`,
  `libc.so`, and `libdl.so`.
- Rich symbols coexist with bundled Cocos2d-x, Box2D, OpenSSL, JSON/XML, audio, and runtime code;
  ownership classification is mandatory before contract recovery.

## App-Owned Analysis Queues

| Subsystem | Symbol anchors | Initial evidence | Next contract work |
|---|---|---|---|
| Boot/platform | `JNI_OnLoad`, `AppDelegate` | JNI and lifecycle entry points survive | Trace scene creation and Java bridges |
| Navigation/UI | `MainMenuLayer`, `ModeSelectLayer`, `OptionsLayer`, `AboutLayer`, `LeaderboardLayer` | Constructors/callback names and resource strings survive | Screen graph, anchors, transitions |
| Modes | `BaseGameplayLayer`, `ClassicModeLayer`, `CrazyModeLayer`, `BaseBirdLayer`, `ClassicBirdLayer`, `CrazyBirdLayer`, `ComboBirdLayer`, `GNStyleLayer` | Six modes named directly | Entry/update/end rules per mode |
| Physics | `PhysicsLayer`, `PhysicsBladeLayer`, `RaysCastCallback`, `b2World` call sites | Classic world, unit scale, speed-up activation, physics stop, core Fruit/Bomb/Electric fixtures, filters, contacts, and ray path cross-checked | Remaining entity fixtures and ambiguous contact-layout effects |
| Toss/spawn | `TossTurn`, `WaveToss`, `ConcurrentToss`, `FreeToss`, `DoubleToss`, `BonusToss` | RNG formulas, timer semantics, strategies, Classic graph, and spawn kinematics recovered | Remaining-mode factory tables and exact engine/VFX RNG interleaving |
| Entities | `CutObject`, `Fruit`, `CutFruit`, `DragonFruit`, `Bomb`, `BombElectric` | Classic Fruit/Bomb/Electric body and fixture formulas plus cut/explosion paths recovered | Remaining entities, disposal, and sprite/body synchronization |
| Blade/effects | `Blade`, `BasicBlade`, `BirdBlade`, `DragonBlade`, `CentipedeBlade`, `ParticleObject` | Four-slot input, post-step bidirectional ray, filters, and cut ordering recovered | Particle presentation, tag `1437`, and duplicate-fixture policy |
| Score/time/fail | `ScoreManager`, `ComboManager`, `TimeManager`, `FruitFailManager` | Classic fruit/special score, combo, double bucket, misses, bomb penalty, guarded game-over, pause/terminal clocks, and shared TimeManager recovered | Remaining-mode contracts |
| Progression/save | `Settings`, `ObjectivesManager`, `ObjectivesLayer`, `ObjectiveItem`, `SelectItems` | Prices, selections, coins, unlocks, objectives, best-score objects survive | Keys, defaults, prices, mutation rules |
| Presentation/audio | animation classes, `CocosDenshion`, 340 resource-looking native strings | Classic resolution profiles, minimum paired assets, logical layout, HUD/fail/bomb/terminal/result timelines, and bounded audio order recovered | Remaining screens/modes and unlinked literal ownership |

## Cross-Checked Physics Anchors

| Address | Symbol | Recovered fact |
|---|---|---|
| `0x00161558` | `PhysicsLayer::onEnter()` | Creates `b2World` with gravity `(0, -10)`; sleeping enabled |
| `0x001615FC` | `PhysicsLayer::update(float)` | Calls `b2World::Step(dt * worldSpeed, velocityIterations, positionIterations)` |
| `0x0016163C` | `PhysicsLayer::PhysicsLayer()` | Iterations `10/10`; initial world speed `1.0` |
| `0x001616BA` | `PhysicsLayer::FreezeeWorld()` | Writes world-speed `0.5` |
| `0x001616C4` | `PhysicsLayer::UnFreezeeWorld()` | Restores world-speed `1.0` |

GNU ARM and LLVM Thumbv5TE disassembly agree on these instruction streams and constants.

## Classic Contract Progress

- `../contracts/classic-physics-contract.md` records the world, Classic entity fixtures,
  collision filtering, contact path, and Creator Physics2D adapter boundary.
- `../contracts/classic-toss-contract.md` records RNG, timer/strategy semantics, nine Classic
  controllers, and four-direction spawn formulas.
- `../contracts/classic-cut-score-contract.md` records touch/ray-cut ordering, score/combo,
  special fruit, miss, bomb, and game-over behavior.
- `../contracts/classic-time-state-contract.md` records untimed Classic ownership,
  Good/Luck start, progressive physics speed, pause/director clocks, bomb/fail concurrency,
  terminal/result flow, and the shared TimeManager service.
- `../contracts/classic-presentation-contract.md` records resolution-tree selection, paired
  minimum assets, logical layout/anchors/z-order, HUD/fail/bomb/Game-Over/result timelines,
  and bounded audio order.

These are static reconstruction contracts, not observed traces. Apparent native defects in
fixture deduplication and an electric contact-listener layout are disclosed as unknown runtime
effects and are not silently promoted into Creator requirements.

## Ownership Rules

- `app`: explicit Pencil Blade class or app entry point.
- `box2d`: Box2D implementation symbol; use only to understand call contracts.
- `engine`: Cocos2d-x/CocosDenshion implementation.
- `vendor`: bundled JSON/XML/crypto/network/audio dependency.
- `compiler-runtime`: C/C++ ABI, standard library, libc/pthread, or compiler helper.
- `unknown`: not yet attributable; never promote automatically to application behavior.

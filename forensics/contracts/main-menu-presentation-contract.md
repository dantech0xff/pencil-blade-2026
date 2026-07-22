# Main Menu Presentation Contract

Status: statically recovered and independently cross-checked on 2026-07-23

Evidence: `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001`,
`DER-RESMAP-001`, `DER-CLASSIC-PRESENTATION-001`,
`DER-SHARED-GAME-SCENE-PRESENTATION-001`

This contract defines the recovered Main Menu shell, its entry actions, cut-driven navigation,
audio/toggle behavior, and repeating review-heart presentation for a clean-room Cocos Creator
3.8 implementation. It was recovered without installing or executing the original APK and
without loading, linking, or executing `libgame.so`. Targeted GNU ARM binutils 2.27 and LLVM
19.0.1 Thumb disassembly were compared against the immutable native hash
`55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`.

This is a static logical-presentation contract, not an authorization to redistribute the
original assets and not a pixel-golden claim. Asset rights remain unknown.

The green gate in this document covers only the foreground and interaction subtree owned by
`MainMenuLayer`. The shared `GameScene` `BackgroundLayer`, `LeafLayer`, and `ThemeLayer` are
dependencies outside this contract. Their root insertion order is recorded for integration
context, but their assets, layout, actions, and rendering are not curated here. They are now
accepted separately by `shared-game-scene-presentation-contract.md`; therefore the clean/default
complete boot logical composite is **GREEN across the two contracts**, while this document's
own claim remains foreground-only.

## Evidence and notation

| Handle | Static evidence |
|---|---|
| `E-NATIVE` | `DER-NATIVE-001`; immutable extracted native library and hash |
| `E-CORPUS` | `DER-NATIVE-CORPUS-001`; recorded commands/tool versions under `.forensics-work/phase-02/native/` |
| `E-FUNCS` | `forensics/native/function-map.csv` (`DER-FUNCMAP-001`) |
| `E-RES` | `forensics/resources/resource-usage-map.json` (`DER-RESMAP-001`) |
| `E-PROFILE` | `forensics/contracts/classic-presentation-contract.md`, bootstrap at `0x00141F50` and `GameScene::onEnter` at `0x00151536` |
| `E-SHARED` | `forensics/contracts/shared-game-scene-presentation-contract.md`; accepted Background/Leaf/Theme resources, behavior, and equal-z insertion |
| `E-MENU` | `E-NATIVE`, `MainMenuLayer::onEnter`, `0x0015ACB8..0x0015B968` |
| `E-FRUIT-BUTTON` | `E-NATIVE`, `FruitButton`, `0x00150C28..0x0015107E` |
| `E-FRUIT-CUT` | `E-NATIVE`, `Fruit::createWithTarget` `0x00150320`, `PlayCutSound` `0x001505A4`, `Cut` `0x00150648`, and `CutNotification` `0x00150B6E` |
| `E-RNG` | `E-NATIVE`, `RandomHelper::nextInt` `0x0016196C` and `nextFloat` `0x001619A0` |

The targeted ranges were regenerated from `E-NATIVE`; they are reproducible from the recorded
tools and command form but are not claimed to be among the four archived Phase 2 sample
disassemblies.

Definitions:

- `W`, `H`: logical `CCDirector::getWinSize()` width and height.
- `L`, `R`, `T`, `B`, `C`: `VisibleRect.left`, `right`, `top`, `bottom`, and `center`.
- `w(node)`, `h(node)`: selected-resolution content width and height in logical coordinates.
- `f32[bits]`: the float32 value represented by the hexadecimal bit pattern.
- `trunc32(x)`: native float32 calculation followed by truncation toward zero to signed int.
- `recovered`: directly supported by the covered static app/resource evidence.
- `inferred`: legacy-engine behavior/default needed to interpret an absent app-level setter.
- `Creator mapping`: new implementation choice required to preserve the recovered outcome.
- `unknown`: not safely determined by this evidence.

Unless identified as an integer, decimal constants in recovered formulas/actions denote the
nearest IEEE-754 binary32 value, with native float32 evaluation order. Hex bits are written
where a rounded decimal would obscure a recovered placement boundary.

The resolution branch remains the shared recovered profile: physical frame width below `720`
selects `480x800`, while width at least `720` selects `720x1280`; design-resolution policy
argument `2` and content scale `1.0` then determine logical `W/H` and the visible rectangle.
Raster dimensions below identify resource variants only. They are never runtime positions.

## Native anchors

| Address | Symbol | Contract surface |
|---|---|---|
| `0x00151536` | `GameScene::onEnter()` | root layer order and Main Menu z-order |
| `0x0015A9E8` | `MainMenuLayer::exitCallback(CCObject*)` | click, director end, save order |
| `0x0015AA1C` | `MainMenuLayer::delayCallback()` | delayed same-parent destination replacement |
| `0x0015AABC` | `MainMenuLayer::addHeartCallback()` | five-draw heart emission |
| `0x0015ABF0` | `MainMenuLayer::optionsCallback(CCObject*)` | immediate Options replacement and click |
| `0x0015AC54` | `MainMenuLayer::aboutCallback(CCObject*)` | immediate About replacement and click |
| `0x0015ACB8` | `MainMenuLayer::onEnter()` | exact shell construction, insertion, and actions |
| `0x0015B968` | `MainMenuLayer::reviewCallback(CCObject*)` | review JNI call and conditional coin reward |
| `0x0015B9BC` | `MainMenuLayer::objectivesCallback(CCObject*)` | state `3` and delayed Objectives handoff |
| `0x0015BA04` | `MainMenuLayer::leaderBoardCallback(CCObject*)` | state `2` and delayed Leaderboard handoff |
| `0x0015BA4C` | `MainMenuLayer::newGameCallback(CCObject*)` | state `1` and delayed Mode Select handoff |
| `0x0015BA94` | `MainMenuLayer::effectCallback(CCObject*)` | effects toggle/stop/click semantics |
| `0x0015BACC` | `MainMenuLayer::musicCallback(CCObject*)` | music toggle/stop/click semantics |
| `0x0015BB88` | `MainMenuLayer::MainMenuLayer()` | state zero, audio volumes, looping menu music |
| `0x00150C5A` | `FruitButton::fruitCutCallback(CCObject*)` | blur removal and circle scale-out |
| `0x00150C90` | `FruitButton::setPosition(CCPoint const&)` | post-entry transform and blur-offset branch |
| `0x00150D88` | `FruitButton::onEnter()` | local child order, entry fade, rotation, body state |

Recovered Settings data anchors are `EnableMusic` at `0x004822AC`, `EnableEffects` at
`0x004822AB`, `NetworkAvailable` at `0x004822AA`, and `Rated` at `0x004822A9`.

## Required resources

Every row is a direct consumer of the covered Main Menu/Fruit cut path. Dimensions and exact
paths are from `E-RES`.

### Shell and menu

| Logical asset | `480x800` variant | `720x1280` variant |
|---|---|---|
| `Interfaces/pencilbladebk.png` | `480x800/Interfaces/pencilbladebk.png` (`480x292`) | `720x1280/Interfaces/pencilbladebk.png` (`720x438`) |
| `Interfaces/pencilblade.png` | `480x800/Interfaces/pencilblade.png` (`454x233`) | `720x1280/Interfaces/pencilblade.png` (`667x342`) |
| `Interfaces/total-coins.png` | `480x800/Interfaces/total-coins.png` (`334x131`) | `720x1280/Interfaces/total-coins.png` (`464x160`) |
| `Buttons/button-music-normal.png` | `480x800/Buttons/button-music-normal.png` (`91x94`) | `720x1280/Buttons/button-music-normal.png` (`136x141`) |
| `Buttons/button-music-selected.png` | `480x800/Buttons/button-music-selected.png` (`91x95`) | `720x1280/Buttons/button-music-selected.png` (`136x141`) |
| `Buttons/button-music-disable.png` | `480x800/Buttons/button-music-disable.png` (`91x95`) | `720x1280/Buttons/button-music-disable.png` (`136x142`) |
| `Buttons/button-effects-normal.png` | `480x800/Buttons/button-effects-normal.png` (`80x100`) | `720x1280/Buttons/button-effects-normal.png` (`119x149`) |
| `Buttons/button-effects-selected.png` | `480x800/Buttons/button-effects-selected.png` (`80x99`) | `720x1280/Buttons/button-effects-selected.png` (`119x149`) |
| `Buttons/button-effects-disable.png` | `480x800/Buttons/button-effects-disable.png` (`80x99`) | `720x1280/Buttons/button-effects-disable.png` (`119x148`) |
| `Buttons/button-about-normal.png` | `480x800/Buttons/button-about-normal.png` (`87x116`) | `720x1280/Buttons/button-about-normal.png` (`125x139`) |
| `Buttons/button-about-selected.png` | `480x800/Buttons/button-about-selected.png` (`87x116`) | `720x1280/Buttons/button-about-selected.png` (`124x139`) |
| `Interfaces/reviewbutton.png` | `480x800/Interfaces/reviewbutton.png` (`70x66`) | `720x1280/Interfaces/reviewbutton.png` (`87x82`) |
| `Interfaces/reviewbuttonselected.png` | `480x800/Interfaces/reviewbuttonselected.png` (`70x66`) | `720x1280/Interfaces/reviewbuttonselected.png` (`87x82`) |
| `Buttons/button-blue-wheel-normal.png` | `480x800/Buttons/button-blue-wheel-normal.png` (`109x107`) | `720x1280/Buttons/button-blue-wheel-normal.png` (`161x160`) |
| `Buttons/button-blue-wheel-selected.png` | `480x800/Buttons/button-blue-wheel-selected.png` (`109x107`) | `720x1280/Buttons/button-blue-wheel-selected.png` (`161x160`) |
| `Buttons/button-orange-wheel-normal.png` | `480x800/Buttons/button-orange-wheel-normal.png` (`71x70`) | `720x1280/Buttons/button-orange-wheel-normal.png` (`105x104`) |
| `Buttons/button-black-wheel-normal.png` | `480x800/Buttons/button-black-wheel-normal.png` (`49x48`) | `720x1280/Buttons/button-black-wheel-normal.png` (`72x72`) |
| `Buttons/button-exit-normal.png` | `480x800/Buttons/button-exit-normal.png` (`141x184`) | `720x1280/Buttons/button-exit-normal.png` (`182x249`) |
| `Buttons/button-exit-selected.png` | `480x800/Buttons/button-exit-selected.png` (`141x184`) | `720x1280/Buttons/button-exit-selected.png` (`182x249`) |

### FruitButtons and review hearts

| Logical asset | `480x800` variant | `720x1280` variant |
|---|---|---|
| `Buttons/button-circle-blur.png` | `480x800/Buttons/button-circle-blur.png` (`235x250`) | `720x1280/Buttons/button-circle-blur.png` (`316x339`) |
| `Buttons/button-circle-leaderboard.png` | `480x800/Buttons/button-circle-leaderboard.png` (`237x256`) | `720x1280/Buttons/button-circle-leaderboard.png` (`319x347`) |
| `Buttons/button-circle-objectives.png` | `480x800/Buttons/button-circle-objectives.png` (`254x263`) | `720x1280/Buttons/button-circle-objectives.png` (`344x358`) |
| `Buttons/button-circle-newgame.png` | `480x800/Buttons/button-circle-newgame.png` (`254x263`) | `720x1280/Buttons/button-circle-newgame.png` (`344x358`) |
| `Fruits/fruit-electric-apple.png` | `480x800/Fruits/fruit-electric-apple.png` (`96x82`) | `720x1280/Fruits/fruit-electric-apple.png` (`143x122`) |
| `Fruits/fruit-electric-apple-cut-bottom.png` | `480x800/Fruits/fruit-electric-apple-cut-bottom.png` (`95x47`) | `720x1280/Fruits/fruit-electric-apple-cut-bottom.png` (`142x69`) |
| `Fruits/fruit-electric-apple-cut-top.png` | `480x800/Fruits/fruit-electric-apple-cut-top.png` (`88x50`) | `720x1280/Fruits/fruit-electric-apple-cut-top.png` (`130x74`) |
| `Fruits/fruit-orange.png` | `480x800/Fruits/fruit-orange.png` (`75x101`) | `720x1280/Fruits/fruit-orange.png` (`112x152`) |
| `Fruits/fruit-orange-cut-bottom.png` | `480x800/Fruits/fruit-orange-cut-bottom.png` (`73x53`) | `720x1280/Fruits/fruit-orange-cut-bottom.png` (`110x79`) |
| `Fruits/fruit-orange-cut-top.png` | `480x800/Fruits/fruit-orange-cut-top.png` (`74x80`) | `720x1280/Fruits/fruit-orange-cut-top.png` (`110x119`) |
| `Fruits/fruit-strawberry.png` | `480x800/Fruits/fruit-strawberry.png` (`83x64`) | `720x1280/Fruits/fruit-strawberry.png` (`125x96`) |
| `Fruits/fruit-strawberry-cut-bottom.png` | `480x800/Fruits/fruit-strawberry-cut-bottom.png` (`79x36`) | `720x1280/Fruits/fruit-strawberry-cut-bottom.png` (`118x54`) |
| `Fruits/fruit-strawberry-cut-top.png` | `480x800/Fruits/fruit-strawberry-cut-top.png` (`84x39`) | `720x1280/Fruits/fruit-strawberry-cut-top.png` (`125x58`) |
| `Interfaces/heart.png` | `480x800/Interfaces/heart.png` (`30x33`) | `720x1280/Interfaces/heart.png` (`44x50`) |

Shared direct resources have one catalog entry rather than paired resolution variants:

| Shared path | Bytes | SHA-256 |
|---|---:|---|
| `Fonts/SlabThing.ttf` | `161488` | `9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8` |
| `Sounds/mainmenumusic.mp3` | `718785` | `53378d6d153e22fa9b0b5a64c8c130e58f0c3ae649ad3750e921d839c45151a1` |
| `Sounds/menubuttonclick.wav` | `32812` | `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e` |
| `Sounds/strawberry.wav` | `10284` | `b612419c6046ebe49666788fbc84787494667bbfcc121f21a242d9e13bc69a59` |
| `Sounds/mangosteen.wav` | `11052` | `0e93927c2044446d69c8b591818cd54294dbf260454204bda5c32a7ade5128e6` |

The last two sound names are the exact `Fruit::PlayCutSound` branches reached by these IDs;
they are not semantic guesses from the fruit artwork.

The similarly named `Buttons/button-review-normal.png` and
`Buttons/button-review-selected.png` exist but are not Main Menu consumers in `E-MENU`.
Creator must use the two `Interfaces/reviewbutton*.png` paths above.

## Scene graph and equal-z insertion order

`GameScene::onEnter` recovers this parent order and tag assignment:

| Child | tag | z-order |
|---|---:|---:|
| `BackgroundLayer` | `0` | `1` |
| `LeafLayer` | `1` | `1` |
| `ThemeLayer` | `2` | `1` |
| `MainMenuLayer` | `3` | `1` |

The values `0,1,2,3` come from child vtable slot `+272`, resolved to
`CCNode::setTag(int)` at `0x001A3DA6`; they are not z-orders. Parent slot `+200` resolves to
`CCNode::addChild(child,int)` at `0x001A455C`, and every call supplies z-order `1`. Creator
must therefore preserve the equal-z insertion order above rather than model those tags as
render priorities.

`MainMenuLayer::onEnter` first invokes `PhysicsBladeLayer::onEnter`. Its four selected blade
children therefore precede every menu-owned child; default blade selection and geometry are
defined by `basic-blade-presentation-contract.md`. The exact menu-owned root additions that
follow are all z-order `1`, in this order:

1. `pencilbladebk`;
2. `pencilblade`;
3. total-coins panel;
4. total-coins label;
5. one `CCMenu` containing the six interactive image/toggle items below;
6. orange wheel;
7. black wheel;
8. leaderboard `FruitButton` (electric apple, ID `13`);
9. objectives `FruitButton` (orange, ID `7`);
10. new-game `FruitButton` (strawberry, ID `2`).

The `CCMenu` is explicitly positioned at the legacy shared zero point. Its item argument and
equal-z insertion order is:

1. about;
2. review;
3. music toggle;
4. effects toggle;
5. blue-wheel options;
6. exit.

Each `FruitButton::onEnter` adds its own children at z-order `1` in exact order: blur, circle
art, then intact `Fruit`. After all visible children, Main Menu adds a nonvisual
`CCGesturesLayer` with the one-argument `addChild` path (default z-order `0`).

Creator must assign explicit sibling priorities. Equal numeric z-order alone is insufficient
because Creator render/UI paths do not universally preserve the legacy insertion outcome.

## Recovered entry layout and actions

Unless noted otherwise, no anchor setter occurs. The center anchor for sprites and menu items
is a **legacy-engine inference**, not an app-level recovered setter. All actions in a row are
started synchronously in construction order; independent move/fade/rotation actions run
concurrently.

| Node | Initial position | Final position | Recovered action contract |
|---|---|---|---|
| `pencilbladebk` | `(C.x, T.y + 0.5h)` | `(C.x, T.y - 0.5h)` | `MoveTo(0.5)` then independent `FadeIn(0.5)`; later in construction the same node receives another independent `FadeIn(0.75)` |
| `pencilblade` | `(L.x - 0.5w, T.y - 0.5 * (1.25h))` | `(C.x, T.y - 0.5 * (1.25h))` | `Delay(0.25) -> MoveTo(0.5)`; no direct foreground fade call in `E-MENU` |
| total-coins panel | `(L.x - 0.5w, B.y + 0.05H)` | `(L.x + 0.30W, B.y + 0.05H)` | independent `MoveTo(1.75)` and `FadeIn(1.75)` |
| total-coins label | `(L.x - 0.5w(panel), B.y + 0.05H)` | `(L.x + f32[0x3E3D70A4]W, B.y + 0.05H)` | independent `MoveTo(1.75)` and `FadeIn(1.75)`; explicit anchor `(0, 0.5)` |
| music toggle | `(L.x - 0.5w, 0.175H)` | `(0.125W, 0.175H)` | independent `MoveTo(1.5)` and `FadeIn(1.25)` |
| effects toggle | `(L.x - 0.5w, 0.175H)` | `(f32[0x3EB33333]W, 0.175H)` | independent `MoveTo(1.0)` and `FadeIn(1.5)` |
| about | `(L.x - 0.5w, 0.30H)` | `(0.125W, 0.30H)` | independent `MoveTo(1.0)` and `FadeIn(1.0)` |
| blue-wheel options | `(f32[0x3F19999A]W, 0.175H - 300)` | `(f32[0x3F19999A]W, 0.175H)` | independent `MoveTo(1.25)`, `FadeIn(1.25)`, and `RepeatForever(RotateBy(12.5, +360))` |
| orange wheel | `(0.60W + 35, 0.175H - 335)` | `(0.60W + 35, 0.175H - 35)` | independent `MoveTo(1.25)`, `FadeIn(1.25)`, and `RepeatForever(RotateBy(12.5, -360))` |
| black wheel | `(0.60W - 6, 0.175H - 294)` | `(0.60W - 6, 0.175H + 6)` | independent `MoveTo(1.25)`, `FadeIn(1.25)`, and `RepeatForever(RotateBy(10.5, +360))` |
| exit | `(R.x + 0.5w, 0.175H)` | `(R.x - 0.5w, 0.175H)` | independent `MoveTo(1.0)` and `FadeIn(1.0)` |
| review | `(0.75W, -h)` | `(0.75W, f32[0x3D3851EC]H)` | independent `MoveTo(1.25)`, `FadeIn(1.0)`, and the pulse below |

The nontrivial float literals above are approximately `0.1850000024`,
`0.3499999940`, `0.6000000238`, and `0.04500000179`; implementation math must preserve
float32 order rather than replace them with raster-derived positions. The music/effects
initial half-width is measured before any disabled-state activation changes the toggle's
selected subitem.

Transform classification is strict:

- the total-coins label anchor `(0, 0.5)` is a recovered app setter; center anchors for the
  other visible shell/menu sprites, FruitButton art, and hearts are inferred legacy defaults
  that must be made explicit in Creator;
- no app-level initial visual rotation setter is present in the covered Main Menu paths.
  Initial zero rotation is inferred for sprite/menu art, while the native Fruit body angle
  `0` is a separate direct recovered physics write. Every `RotateBy` value above is a signed
  delta, not an absolute angle;
- no app-level visual scale setter precedes entry. Unit scale is inferred until an explicit
  review-pulse, emitted-heart, or cut-circle scale operation occurs. In particular, the
  `1.25h` multiplier in the `pencilblade` y formula is placement arithmetic and must **not**
  be converted into `setScale(1.25)`.

### Total-coins label

`Settings::getTotalCoins()` is formatted with `%d`. The label uses
`Fonts/SlabThing.ttf` and:

```text
pointSize = f32(f32(W / 480.0) * 34.0)
anchor = (0, 0.5)
```

The panel and label are root siblings, not a parent/child pair. Their equal-z insertion order
is panel then label. A second `getTotalCoins()` call occurs before label construction but its
return value is unused in the covered instruction stream. No app-level color setter is
present; white/default label modulation is an inference, not a recovered color constant.

### Review pulse and heart emission

The review item starts this independent repeating sequence immediately, while its entrance
move is still running:

```text
ScaleTo(0.45, 1.15, 1.15)
-> addHeartCallback
-> ScaleTo(0.45, 1.0, 1.0)
-> addHeartCallback
-> repeat forever
```

The first heart is therefore requested at nominal menu time `0.45`, the second at `0.90`,
then twice per `0.90`-second cycle. Initial review scale `1` is an inferred engine default;
all tween targets and durations are recovered.

Each `addHeartCallback` consumes exactly five shared RNG draws, in this order:

1. `x = nextInt(trunc32(W * f32[0x3F399999]), trunc32(W * 0.8))`;
2. `y = nextInt(trunc32(H * 0.025), trunc32(H * 0.075))`;
3. `qScale = nextFloat()`;
4. `qDuration = nextFloat()`;
5. `rise = nextInt(trunc32(H * 0.1), trunc32(H * 0.25))`.

`nextInt` is inclusive. Recovered `nextFloat` is not continuous: it returns
`(lrand48() % 10) / 10`, one of `{0.0, 0.1, ..., 0.9}`. The emitted heart receives:

```text
position = (x, y)
scale = f32(f32(qScale * 0.5) + 0.5)       // 0.50 through 0.95
duration = f32(qDuration + 1.0)             // 1.0 through 1.9 seconds
actions = FadeOut(duration) || MoveBy(duration, (0, rise))
root z-order = 1
```

Actions are started before the heart is added to Main Menu. No removal or cleanup action is
attached; completed hearts remain as invisible children until the Main Menu itself is
removed. Exact native PRNG seed/sequence parity is not claimed.

## FruitButton contract

The three buttons are recovered as real physics fruits inside a shared visual wrapper:

| Purpose | Fruit ID and intact resource | Circle resource | Position | Delayed state/destination |
|---|---|---|---|---|
| leaderboard | ID `13`, electric apple | `button-circle-leaderboard.png` | `(0.25W, f32[0x3F0CCCCD]H)` | `2` / `LeaderboardLayer` |
| objectives | ID `7`, orange | `button-circle-objectives.png` | `(0.75W, f32[0x3F228F5C]H)` | `3` / `ObjectivesLayer` |
| new game | ID `2`, strawberry | `button-circle-newgame.png` | `(f32[0x3F19999A]W, 0.375H)` | `1` / `ModeSelectLayer` |

The y literals are approximately `0.5500000119` and `0.6349999905`. These positions use raw
logical `W/H`; no visible-rectangle origin is added.

For each wrapper, `FruitButton::onEnter` recovers:

- blur at `(p.x - f32[0x3DB851EC] * w(blur), p.y - 0.05 * h(blur))`, then explicit opacity
  zero, `FadeIn(1.25)`, and add at local z `1`;
- circle art at `p`, then explicit opacity zero, `FadeIn(1.25)`, perpetual
  `RotateBy(15.0, -360)`, and add at local z `1`;
- native body transform `(p.x / 32, p.y / 32)` at angle `0`, gravity scale `0`, awake state,
  and angular velocity `+2.0` radians/second;
- intact fruit sprite opacity zero then `FadeIn(1.25)`, cut-event registration, and add at
  local z `1`.

If `FruitButton::setPosition` is called after entry, it updates the native body transform and
fruit position, but repositions the already-created blur with a distinct x offset:

```text
(p.x - f32[0x3DA3D70A] * w(blur), p.y - 0.05 * h(blur))
```

That is `~0.08w`, not the `~0.09w` used during `onEnter`. Main Menu sets each point before
attachment and never repositions it afterward, so its visible entry uses the `~0.09w`
branch. Collapsing these two recovered branches is not allowed.

Center anchors for blur, circle, intact fruit, and cut halves are inferred defaults. The
rotation values, gravity scale, body angle, and angular velocity above are direct recovered
writes/actions. Creator's physics adapter applies the policy's `32` world-unit conversion;
it must not expose the native metre-space division as a second visual offset.

### Cut callback and visual order

The Fruit's Main Menu target is registered during `Fruit::createWithTarget`; the wrapper's
`fruitCutCallback` is registered later during `FruitButton::onEnter`. `CutObject` iterates
registrations in insertion order. On the first accepted cut, the relevant covered order is:

1. `Fruit::Cut` creates/attaches bottom then top cut halves and requests its effects-gated
   fruit sound;
2. the Main Menu callback runs first: if navigation state is still `0`, disable cutting,
   start `Delay(0.75) -> delayCallback`, then store destination state;
3. `FruitButton::fruitCutCallback` runs second: mark the wrapper cut, remove the blur with
   cleanup, and run `ScaleTo(0.75, 0, 0)` on the circle art;
4. the remaining Fruit notification path continues as defined by the shared Fruit contract.

For these IDs the recovered `Fruit::PlayCutSound` switch requests
`Sounds/strawberry.wav` for IDs `2` and `7`, and the default `Sounds/mangosteen.wav` branch
for ID `13`; all are non-looping and gated by `EnableEffects`. The seemingly mismatched
filenames are recovered branch results and must not be normalized to artwork names. No
`menubuttonclick.wav` request occurs in the three Main Menu Fruit callbacks or
`delayCallback`.

## Toggle, button, audio, and navigation semantics

### Construction and toggle initialization

`MainMenuLayer` construction sets navigation state to `0`, sets background-music and effects
volume to `1.0`, and, only when `EnableMusic` is true, starts
`Sounds/mainmenumusic.mp3` with looping enabled.

Each toggle contains two items in order:

1. normal image with the selected image;
2. disabled image with the same selected image.

Both start at selected index `0`. When a recovered setting is false, `onEnter` invokes the
toggle's virtual `activate()` to select index `1`, then flips the Settings byte once more to
compensate for the callback's own flip:

- music false: call `stopBackgroundMusic(false)`, activate, then flip `EnableMusic` back to
  false;
- effects false: activate, then flip `EnableEffects` back to false.

This activation is not a side-effect-free visual setter. It runs the callbacks below and can
request `menubuttonclick.wav` according to the contemporaneous effects flag. Creator must
either reproduce that observable command order or record an explicit reviewed compatibility
decision; silently replacing it with a pure index assignment is not recovered behavior.

### Interactive callbacks

| Input | Recovered synchronous order |
|---|---|
| music toggle | flip `EnableMusic`; if now false, `stopBackgroundMusic(false)`; if `EnableEffects` is true, play non-looping `menubuttonclick.wav`; toggling music on does **not** restart menu music |
| effects toggle | flip `EnableEffects`; if now false, `stopAllEffects`; if now true, play non-looping `menubuttonclick.wav` |
| about | capture parent -> remove Main Menu with cleanup -> construct/add `AboutLayer` to same parent at z `1` -> effects-gated non-looping click |
| blue-wheel options | capture parent -> remove Main Menu with cleanup -> construct/add `OptionsLayer` to same parent at z `1` -> effects-gated non-looping click |
| review | always call `showReviewTaskJNI`; if not Rated and network is available, persist the rated flag, set it in memory, and add exactly `500` total coins; no direct audio request |
| exit | effects-gated non-looping click -> `CCDirector::end()` -> `Settings::SaveData()` |

The platform review JNI/store behavior is statically recovered legacy behavior but remains
outside the visible Main Menu implementation gate. A Creator platform adapter must not be
invented or enabled without a separate approved platform contract. The covered callback does
not update the already-created total-coins label after the conditional `+500` mutation.

### Delayed Fruit navigation

The first leaderboard/objectives/new-game callback accepted while state is `0` performs:

```text
DisableCut(true)
run Delay(0.75) -> delayCallback
store state 2 / 3 / 1
```

Later callbacks observe nonzero state and do nothing. At nominal `0.75` seconds,
`delayCallback` captures the current parent, removes Main Menu with cleanup, constructs the
state-selected destination, adds it to that same parent at z-order `1`, and only then, when
`EnableMusic` is true, calls `stopBackgroundMusic(false)`. The state mapping is `1` Mode
Select, `2` Leaderboard, `3` Objectives. No destination is added for another value.

Only this replacement graph, callback order, and timing are green-gated here. This contract
does not authorize an inferred visible Mode Select, Leaderboard, Objectives, About, or Options
screen. It also does not extend the foreground-only green gate to the shared `GameScene`
background, leaf, or theme presentation.

## Cocos Creator 3.8 mapping

| Recovered responsibility | Creator owner | Required mapping/boundary |
|---|---|---|
| profile and visible rectangle | `ResolutionProfileService` | reuse the reviewed `480x800`/`720x1280` profile; expose logical `W/H/L/R/T/B/C` |
| root shell | `MainMenuPresenter` | create nodes in the exact root order, make inferred center anchors explicit, and preserve each independent action |
| interactive menu | `MainMenuControlsPresenter` | use the exact six-item sibling order and selected/disabled resource pairs; keep menu origin at zero |
| wheels | `MainMenuWheelPresenter` | preserve blue/orange/black positions, entry deltas, periods, signs, and root-vs-menu ownership |
| total coins | `MainMenuCoinsPresenter` | root-sibling panel/label, signed `%d`, exact font, size formula, anchor, and insertion order |
| FruitButtons | `MainMenuFruitButtonPresenter` | exact IDs/resources/points/local order, cut-driven activation, blur branches, fades, and circle scale-out |
| fruit physics | existing Physics2D adapter | zero gravity scale, `+2` angular velocity, angle zero, and policy-owned native-to-Creator unit conversion |
| heart loop | `MainMenuReviewHeartPresenter` | injected clock/shared RNG, exact pulse and five-draw protocol, no per-heart cleanup before menu removal |
| navigation | `MainMenuFlowController` | single nonzero gate, cut disable, exact `0.75` delay, same-parent cleanup replacement, z `1`, then music stop |
| audio | existing audio service | constructor volume/music order, effects gates, toggle asymmetry, fruit-switch quirks, and click ordering |
| review platform call | isolated platform port | blocked outside this visible contract; no JNI bridge or legacy platform dependency |

Creator implementation names above are new architecture names, not recovered original
identifiers. A coordinate adapter may translate lower-left legacy coordinates into Canvas
space, but the formulas and sibling relationships remain authoritative. Rotation sign must be
mapped through an explicit legacy-to-Creator angle adapter and validated visually; the
recovered signed action values themselves cannot change.

## Deterministic/static validation

No validation step may execute the APK or native library.

1. Parse `E-RES`; assert every table path exists in both trees with exactly the listed
   dimensions, and assert the shared font/audio files exist with their catalog hashes.
2. Regenerate the allowlisted ranges from `E-NATIVE` with both recorded disassemblers; compare
   call targets, literal bits, branch directions, destination-state writes, and insertion calls.
3. Assert GameScene priorities and the exact ten-node menu-owned z-`1` root order; assert menu
   item and FruitButton local child orders independently.
4. Snapshot every initial/final formula under both canonical profiles and at a noncanonical
   visible rectangle. Reject raster dimensions or framebuffer pixels as layout inputs.
5. With a fake clock, assert every move/fade/delay/rotation duration and sign, including the
   second `pencilbladebk` fade, absence of a foreground fade call, and all three `300`-unit
   wheel entrance deltas.
6. Assert `%d`, `SlabThing.ttf`, float32 `34 * (W / 480)`, label anchor `(0, 0.5)`, and
   panel-before-label order.
7. Drive the review pulse through two cycles. Assert heart times, exactly five draws per
   emission, inclusive integer bounds, discrete tenths, shared duration, root z `1`, and no
   per-heart cleanup.
8. Assert the three exact Fruit IDs/resources/points; local blur -> circle -> fruit order;
   initial `0.09/0.05` and later `0.08/0.05` blur branches; `1.25` fades; `15/-360` circle
   rotation; body angle `0`, gravity scale `0`, and angular velocity `+2`.
9. Cut each button with a synthetic blade event. Assert effects-gated recovered fruit clip,
   Main Menu callback before wrapper callback, one navigation acceptance, blur removal,
   `0.75` circle scale-out, and exact delayed same-parent replacement/music-stop order.
10. Exercise all toggle initial states and user toggles. Assert activation side effects,
    stop semantics, click gates, and the no-resume music asymmetry.
11. Lint the presentation catalog so `Buttons/button-review-*.png`, replacement fruit sounds,
    inferred destination art, placeholder screens, or extra heart cleanup cannot enter without
    new evidence and contract review.
12. Run the prohibited original-runtime/source-boundary audit; no original executable,
    Cocos2d-x runtime, JNI compatibility bridge, or decompiler artifact may enter Creator.

## Status ledger

| Item | Status | Boundary |
|---|---|---|
| asset paths and paired-tree dimensions | recovered | high; `E-RES` |
| root/menu/FruitButton equal-z insertion orders | recovered | high; direct construction calls plus static legacy container path |
| all listed position formulas and action durations | recovered | high; dual targeted disassembly agreement |
| total-coins text, font, size, anchor, and sibling relation | recovered | high |
| Fruit IDs, art, blur offsets, fades, circle rotation, gravity, and angular velocity | recovered | high |
| review pulse, RNG draw order/ranges, discrete float values, and retained-heart lifetime | recovered | high |
| navigation state gate, `0.75` delay, replacement, and audio order | recovered | high |
| music/effects initialization and callback asymmetries | recovered | high |
| sprite/menu/heart center anchors where no setter appears | inferred | legacy engine defaults; set explicitly in Creator |
| initial default scale/rotation/opacity outside explicit setters/actions | inferred | do not upgrade to recovered app constants |
| Creator coordinate/rotation API choices | Creator mapping | adapter concern; recovered formulas/signs remain fixed |
| original pixel output, interpolation, blend/sampler state, font metrics, and device crop | unknown | no original-runtime observation |
| native RNG seed/shared-stream sequence parity | unknown/not claimed | draw protocol only |
| destination-screen visible presentation | outside scope | constructors/replacement graph do not prove complete layout |
| shared `GameScene` background/leaf/theme presentation | imported dependency | accepted separately by `E-SHARED`; not recovered by this foreground contract |
| clean/default complete boot logical composite | **GREEN across contracts** | this owned subtree plus `E-SHARED` |
| original-content rights | unknown/not cleared | blocks shipping original files |

## Strict non-claims and unresolved questions

- No original Main Menu frame, touch session, audio capture, store review flow, or device crop
  was observed.
- Static `FadeIn`/move/scale/rotation action construction does not establish pixel-identical
  legacy interpolation or rendering in Creator.
- No center-anchor app setter was recovered for the sprites/menu items/hearts listed as
  inferred; no other anchor value may be invented.
- No platform review implementation, store URL, reward-policy approval, or network behavior is
  authorized by the recovered JNI call.
- No placeholder destination screen or filename-based destination layout is permitted.
- The cited `GameScene` root order is not evidence that this foreground contract recovered
  `BackgroundLayer`, `LeafLayer`, or `ThemeLayer`; their accepted status comes only from the
  separate shared contract. Do not label the complete boot screen accepted from this contract
  alone.
- The CCGesturesLayer callback registration is recovered as part of the input shell, but exact
  gesture thresholds beyond the shared blade/cut contracts are not assigned here.
- Native `lrand48` algorithm state and seeding are outside Creator parity even though the five
  draw types and arithmetic are recovered.

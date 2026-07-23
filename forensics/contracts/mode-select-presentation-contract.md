# Mode Select Presentation Contract

Status: **GREEN for the `ModeSelectLayer`-owned subtree only**, statically recovered and
independently cross-checked on 2026-07-23

Evidence: `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001`,
`DER-RESMAP-001`, `DER-CLASSIC-PRESENTATION-001`,
`DER-SHARED-GAME-SCENE-PRESENTATION-001`

This contract defines the clean-room Mode Select foreground: its exact two-resolution
resources, construction and sibling order, entrance actions, six-card rope carousel,
lock/unlock behavior, particles, audio, and same-parent navigation. It was recovered without
installing or executing the original APK and without loading, linking, or executing
`libgame.so`. Targeted GNU ARM binutils 2.27 and LLVM 19.0.1 Thumb disassembly were compared
against the immutable native hash
`55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`.

The primary GREEN decision is deliberately scoped. It covers nodes constructed directly by
`ModeSelectLayer` and the `RopeButton`, `FruitButton`, Fruit-cut, and unlock-particle helpers
that it instantiates. The shared `BackgroundLayer` presentation and default blade trail are
imported from `classic-presentation-contract.md` and
`basic-blade-presentation-contract.md`; they are not re-curated here. The surviving
`LeafLayer` and `ThemeLayer` are now accepted separately by
`shared-game-scene-presentation-contract.md`. Consequently, the clean/default complete Mode
Select logical composite is also **GREEN across those contracts**, while this document's own
claim remains limited to the Mode Select-owned subtree.

This is a static logical-presentation contract. It is not a pixel-golden claim and does not
authorize redistribution of the original art, font, or audio. Asset rights remain unknown.

## Evidence and notation

| Handle | Static evidence |
|---|---|
| `E-NATIVE` | `DER-NATIVE-001`; immutable extracted native library and hash above |
| `E-CORPUS` | `DER-NATIVE-CORPUS-001`; recorded static tooling and commands |
| `E-FUNCS` | `forensics/native/function-map.csv` (`DER-FUNCMAP-001`) |
| `E-RES` | `forensics/resources/resource-usage-map.json` (`DER-RESMAP-001`) |
| `E-PROFILE` | `forensics/contracts/classic-presentation-contract.md`; resolution profile, `GameScene` order, and shared Background |
| `E-BLADE` | `forensics/contracts/basic-blade-presentation-contract.md`; inherited four-slot clean/default blade presentation |
| `E-SHARED` | `forensics/contracts/shared-game-scene-presentation-contract.md`; accepted Background/Leaf/Theme resources, equal-z order, shared dynamics, and default composite |
| `E-MODE` | `E-NATIVE`; `ModeSelectLayer` functions at `0x0015BCAC..0x0015CEB8` |
| `E-ROPE` | `E-NATIVE`; `RopeButton` at `0x00161C7E..0x00162412` |
| `E-FRUIT-BUTTON` | `E-NATIVE`; `FruitButton` at `0x00150C28..0x0015107E` |
| `E-FRUIT-CUT` | `E-NATIVE`; `Fruit::createWithTarget` `0x00150320`, `PlayCutSound` `0x001505A4`, `Cut` `0x00150648`, and `CutNotification` `0x00150B6E` |
| `E-SETTINGS` | `E-NATIVE`; `Settings::LoadData` `0x00163620`, total coins `0x00163EA4/0x00163EB4`, mode unlock `0x00163F64/0x00163F90`, and `SaveData` `0x00163094` |
| `E-PARTICLE` | `E-NATIVE`; `ParticleExplosion` `0x0015FD0C..0x0015FF4C` and `ParticleObject` `0x0015FFA8..0x0016025A` |
| `E-RNG` | `E-NATIVE`; `RandomHelper::nextInt` `0x0016196C` |

Definitions:

- `W`, `H`: logical `CCDirector::getWinSize()` width and height.
- `L`, `R`, `T`, `B`, `C`: `VisibleRect.left`, `right`, `top`, `bottom`, and `center`.
- `w(node)`, `h(node)`: selected-resolution content width and height in logical units.
- `f32(x)`: one IEEE-754 binary32 result at that native operation.
- `f32[bits]`: the binary32 value represented by the hexadecimal bit pattern.
- `trunc32(x)`: native binary32 calculation followed by truncation toward zero to signed int.
- `recovered`: directly supported by the covered static app/resource evidence.
- `inferred`: legacy-engine behavior/default needed where no app-level setter exists.
- `Creator mapping`: a new implementation choice required to preserve the recovered outcome.
- `unknown`: not safely determined by this evidence.

Unless identified as an integer, recovered arithmetic and action constants use native
binary32 evaluation. The resolution branch is the shared recovered profile: physical frame
width below `720` selects the `480x800` tree/design size; width at least `720` selects
`720x1280`. Content scale is `1.0` and the design-resolution policy argument is `2`.
Raster dimensions below identify resource variants; they are not runtime layout inputs.

## Native anchors

| Address | Symbol | Contract surface |
|---|---|---|
| `0x00151536` | `GameScene::onEnter()` | shared equal-z insertion and tags |
| `0x0015AA1C` | `MainMenuLayer::delayCallback()` | Mode Select same-parent entry |
| `0x0015BCAC` | `ModeSelectLayer::DelayCallback()` | delayed mode destination replacement |
| `0x0015BD60` | `ModeSelectLayer::backCallback(CCObject*)` | click, cancellation, and Main Menu replacement |
| `0x0015BDCC` | `ModeSelectLayer::onBackKeyPressed(CCObject*)` | back-key delegation |
| `0x0015BDD4` | `ModeSelectLayer::onHorizontalFlick(CCObject*)` | bounded index change |
| `0x0015BF28` | `ModeSelectLayer::ModeSelectLayer()` | initial index/state |
| `0x0015BF88` | `ModeSelectLayer::updateForCurrentIdx()` | drag-time current-index rule |
| `0x0015C028` / `0x0015C05E` | `canMoveLeft()` / `canMoveRight()` | rail bounds |
| `0x0015C08C` | `ModeSelectLayer::ModeSelected()` | selection effect and `0.75`-second delay |
| `0x0015C0E4..0x0015C142` | six mode callbacks | destination states `5,4,3,2,1,0` |
| `0x0015C164` | `ModeSelectLayer::unlockCallback(CCObject*)` | price, persistence, label, and burst |
| `0x0015C2D0` | `ModeSelectLayer::onHorizontalDrag(CCObject*)` | direct drag and index refresh |
| `0x0015C344` | `ModeSelectLayer::update(float)` | frame-based rail centering |
| `0x0015C594` | `ModeSelectLayer::onEnter()` | complete owned construction order |
| `0x0019CF06` / `0x0019D230` | `CCActionInterval::step(float)` / `startWithTarget(CCNode*)` | first-tick and normalized-time semantics |
| `0x0019DDCC` | `CCFadeIn::update(float)` | direct opacity write |
| `0x001A0A00` / `0x001A52D8` | `CCActionManager::addAction(...)` / `CCNode::runAction(...)` | synchronous action start and pre-entry pause |
| `0x00161CA8` | `RopeButton::update(float)` | wheel, FruitButton, and anchor synchronization |
| `0x00161E28` | `RopeButton::create(...)` | rope bodies, joints, and local node order |
| `0x001623CC` / `0x00162408` | `RopeButton::Move` / `Unlock` | anchor translation and lock release |
| `0x00150C90` / `0x00150D88` | `FruitButton::setPosition` / `onEnter` | steady/entry visual branches |
| `0x00150FB4` / `0x00151054` | `FruitButton::SetLockState` / `Unlock` | lock menu and cut gating |

The targeted ranges were regenerated from `E-NATIVE`. They are reproducible from the
recorded static tools but are not claimed to be among the four archived Phase 2 sample
disassemblies.

## Required resources

Every paired path below is a direct consumer of the covered Mode Select subtree. Dimensions
and hashes are from `E-RES`. The exact `E-RES` SHA-256 values, not filenames alone, are part
of validation.

### Shell, rope, card, and unlock resources

| Logical asset | `480x800` variant | `720x1280` variant |
|---|---|---|
| `Interfaces/modeselect.png` | `480x800/Interfaces/modeselect.png` (`552x118`) | `720x1280/Interfaces/modeselect.png` (`792x159`) |
| `Buttons/button-blue-back-normal.png` | `480x800/Buttons/button-blue-back-normal.png` (`144x124`) | `720x1280/Buttons/button-blue-back-normal.png` (`180x150`) |
| `Buttons/button-back-selected.png` | `480x800/Buttons/button-back-selected.png` (`144x124`) | `720x1280/Buttons/button-back-selected.png` (`181x150`) |
| `Interfaces/object-long-rope.png` | `480x800/Interfaces/object-long-rope.png` (`1515x77`) | `720x1280/Interfaces/object-long-rope.png` (`868x77`) |
| `Interfaces/object-rope-node.png` | `480x800/Interfaces/object-rope-node.png` (`7x14`) | `720x1280/Interfaces/object-rope-node.png` (`11x21`) |
| `Interfaces/object-des-shader.png` | `480x800/Interfaces/object-des-shader.png` (`217x267`) | `720x1280/Interfaces/object-des-shader.png` (`290x363`) |
| `Interfaces/object-wheel.png` | `480x800/Interfaces/object-wheel.png` (`30x30`) | `720x1280/Interfaces/object-wheel.png` (`45x44`) |
| `Interfaces/object-wheel-connect.png` | `480x800/Interfaces/object-wheel-connect.png` (`8x49`) | `720x1280/Interfaces/object-wheel-connect.png` (`12x73`) |
| `Buttons/button-circle-blur.png` | `480x800/Buttons/button-circle-blur.png` (`235x250`) | `720x1280/Buttons/button-circle-blur.png` (`316x339`) |
| `Buttons/button-unlock.png` | `480x800/Buttons/button-unlock.png` (`159x43`) | `720x1280/Buttons/button-unlock.png` (`238x64`) |
| `Buttons/button-unlock-selected.png` | `480x800/Buttons/button-unlock-selected.png` (`159x43`) | `720x1280/Buttons/button-unlock-selected.png` (`239x65`) |
| `Blades/Particles/X-Mas/xmasfive.png` | `480x800/Blades/Particles/X-Mas/xmasfive.png` (`46x44`) | `720x1280/Blades/Particles/X-Mas/xmasfive.png` (`66x64`) |
| `Interfaces/mode-classic.png` | `480x800/Interfaces/mode-classic.png` (`204x212`) | `720x1280/Interfaces/mode-classic.png` (`344x358`) |
| `Interfaces/mode-crazy.png` | `480x800/Interfaces/mode-crazy.png` (`205x206`) | `720x1280/Interfaces/mode-crazy.png` (`344x351`) |
| `Interfaces/mode-gnstyle.png` | `480x800/Interfaces/mode-gnstyle.png` (`216x225`) | `720x1280/Interfaces/mode-gnstyle.png` (`325x338`) |
| `Interfaces/mode-classic-bird.png` | `480x800/Interfaces/mode-classic-bird.png` (`254x263`) | `720x1280/Interfaces/mode-classic-bird.png` (`345x358`) |
| `Interfaces/mode-crazy-bird.png` | `480x800/Interfaces/mode-crazy-bird.png` (`254x263`) | `720x1280/Interfaces/mode-crazy-bird.png` (`345x358`) |
| `Interfaces/mode-combo-bird.png` | `480x800/Interfaces/mode-combo-bird.png` (`254x263`) | `720x1280/Interfaces/mode-combo-bird.png` (`344x358`) |
| `Interfaces/object-classic-des.png` | `480x800/Interfaces/object-classic-des.png` (`149x202`) | `720x1280/Interfaces/object-classic-des.png` (`223x301`) |
| `Interfaces/object-crazy-des.png` | `480x800/Interfaces/object-crazy-des.png` (`149x202`) | `720x1280/Interfaces/object-crazy-des.png` (`223x301`) |
| `Interfaces/object-combo-des.png` | `480x800/Interfaces/object-combo-des.png` (`149x202`) | `720x1280/Interfaces/object-combo-des.png` (`223x301`) |
| `Interfaces/object-classic-bird-des.png` | `480x800/Interfaces/object-classic-bird-des.png` (`149x202`) | `720x1280/Interfaces/object-classic-bird-des.png` (`223x301`) |
| `Interfaces/object-crazy-bird-des.png` | `480x800/Interfaces/object-crazy-bird-des.png` (`149x202`) | `720x1280/Interfaces/object-crazy-bird-des.png` (`223x301`) |
| `Interfaces/object-combo-bird-des.png` | `480x800/Interfaces/object-combo-bird-des.png` (`149x202`) | `720x1280/Interfaces/object-combo-bird-des.png` (`223x301`) |

There is no Mode Select use of an `object-gnstyle-des.png` path. The GN Style card
deliberately uses `Interfaces/object-combo-des.png`. This recovered mismatch must not be
normalized.

### Intact and cut fruit resources

| Logical asset | `480x800` variant | `720x1280` variant |
|---|---|---|
| `Fruits/fruit-apple.png` | `480x800/Fruits/fruit-apple.png` (`96x82`) | `720x1280/Fruits/fruit-apple.png` (`143x122`) |
| `Fruits/fruit-apple-cut-bottom.png` | `480x800/Fruits/fruit-apple-cut-bottom.png` (`95x47`) | `720x1280/Fruits/fruit-apple-cut-bottom.png` (`131x74`) |
| `Fruits/fruit-apple-cut-top.png` | `480x800/Fruits/fruit-apple-cut-top.png` (`87x50`) | `720x1280/Fruits/fruit-apple-cut-top.png` (`143x69`) |
| `Fruits/fruit-banana.png` | `480x800/Fruits/fruit-banana.png` (`60x154`) | `720x1280/Fruits/fruit-banana.png` (`89x231`) |
| `Fruits/fruit-banana-cut-bottom.png` | `480x800/Fruits/fruit-banana-cut-bottom.png` (`46x78`) | `720x1280/Fruits/fruit-banana-cut-bottom.png` (`68x117`) |
| `Fruits/fruit-banana-cut-top.png` | `480x800/Fruits/fruit-banana-cut-top.png` (`60x89`) | `720x1280/Fruits/fruit-banana-cut-top.png` (`90x134`) |
| `Fruits/fruit-strawberry.png` | `480x800/Fruits/fruit-strawberry.png` (`83x64`) | `720x1280/Fruits/fruit-strawberry.png` (`125x96`) |
| `Fruits/fruit-strawberry-cut-bottom.png` | `480x800/Fruits/fruit-strawberry-cut-bottom.png` (`79x36`) | `720x1280/Fruits/fruit-strawberry-cut-bottom.png` (`118x54`) |
| `Fruits/fruit-strawberry-cut-top.png` | `480x800/Fruits/fruit-strawberry-cut-top.png` (`84x39`) | `720x1280/Fruits/fruit-strawberry-cut-top.png` (`125x58`) |
| `Fruits/fruit-orange.png` | `480x800/Fruits/fruit-orange.png` (`75x101`) | `720x1280/Fruits/fruit-orange.png` (`112x152`) |
| `Fruits/fruit-orange-cut-bottom.png` | `480x800/Fruits/fruit-orange-cut-bottom.png` (`73x53`) | `720x1280/Fruits/fruit-orange-cut-bottom.png` (`110x79`) |
| `Fruits/fruit-orange-cut-top.png` | `480x800/Fruits/fruit-orange-cut-top.png` (`74x80`) | `720x1280/Fruits/fruit-orange-cut-top.png` (`110x119`) |
| `Fruits/fruit-magnetstrawberry.png` | `480x800/Fruits/fruit-magnetstrawberry.png` (`83x64`) | `720x1280/Fruits/fruit-magnetstrawberry.png` (`125x95`) |
| `Fruits/fruit-magnetstrawberry-cut-bottom.png` | `480x800/Fruits/fruit-magnetstrawberry-cut-bottom.png` (`79x44`) | `720x1280/Fruits/fruit-magnetstrawberry-cut-bottom.png` (`117x54`) |
| `Fruits/fruit-magnetstrawberry-cut-top.png` | `480x800/Fruits/fruit-magnetstrawberry-cut-top.png` (`83x39`) | `720x1280/Fruits/fruit-magnetstrawberry-cut-top.png` (`125x58`) |
| `Fruits/fruit-kiwi.png` | `480x800/Fruits/fruit-kiwi.png` (`63x81`) | `720x1280/Fruits/fruit-kiwi.png` (`94x121`) |
| `Fruits/fruit-kiwi-cut-bottom.png` | `480x800/Fruits/fruit-kiwi-cut-bottom.png` (`63x54`) | `720x1280/Fruits/fruit-kiwi-cut-bottom.png` (`93x79`) |
| `Fruits/fruit-kiwi-cut-top.png` | `480x800/Fruits/fruit-kiwi-cut-top.png` (`63x58`) | `720x1280/Fruits/fruit-kiwi-cut-top.png` (`93x87`) |

### Shared font and audio

| Shared path | Bytes | SHA-256 |
|---|---:|---|
| `Fonts/SlabThing.ttf` | `161488` | `9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8` |
| `Sounds/apple.wav` | `10364` | `7565f786f0bd0bbda14d646c2c33993941ee7869c588be836c1eaca96ba5cef8` |
| `Sounds/banana.wav` | `9964` | `f3ce9f1f6626b7657a7036fd96d8448ec1211ddc5f0102ddef327b66ef931d99` |
| `Sounds/strawberry.wav` | `10284` | `b612419c6046ebe49666788fbc84787494667bbfcc121f21a242d9e13bc69a59` |
| `Sounds/mangosteen.wav` | `11052` | `0e93927c2044446d69c8b591818cd54294dbf260454204bda5c32a7ade5128e6` |
| `Sounds/gameplayselected.wav` | `132344` | `b1826f8db97e2517363ce1f7a385181867be33ff55828fe1baca75d1227f9a84` |
| `Sounds/menubuttonclick.wav` | `32812` | `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e` |

No unlock-success, unlock-failure, or particle audio request occurs in `E-MODE`.

## Parent scene and ownership boundary

`GameScene::onEnter` assigns tags and adds all four initial children at z-order `1`:

| Initial child | tag | z-order | insertion |
|---|---:|---:|---:|
| `BackgroundLayer` | `0` | `1` | 1 |
| `LeafLayer` | `1` | `1` | 2 |
| `ThemeLayer` | `2` | `1` | 3 |
| `MainMenuLayer` | `3` | `1` | 4 |

The values `0,1,2,3` are recovered `CCNode::setTag(int)` arguments, not z-orders.
`MainMenuLayer::delayCallback` removes Main Menu with cleanup and adds Mode Select to the same
parent at z-order `1`. The surviving equal-z order is therefore:

```text
BackgroundLayer -> LeafLayer -> ThemeLayer -> ModeSelectLayer
```

Mode Select is the last equal-z sibling and renders above Theme under the recovered legacy
insertion path. Creator must encode this sibling priority explicitly; it must not reinterpret
the tags as z-order.

For a clean/no-save baseline, the recovered selections are background `0`, theme `2`, and
blade `0`. Existing persistence may override them. Background `0` and blade `0` are covered
by `E-PROFILE` and `E-BLADE`; Theme `2` and the full shared-root behavior are covered by
`E-SHARED`. This document does not extend those contracts to all saved selections.

After `PhysicsBladeLayer::onEnter`, four selected-blade children have already been inserted at
Mode Select local z-order `1`. Mode Select immediately removes the inherited
`ScoreManager` with cleanup. The four blade children remain and precede the directly owned
nodes below. Their behavior is imported from `E-BLADE` and is not part of this document's
GREEN surface.

## Exact Mode Select-owned root order

The directly owned additions occur in this order:

| Order | Node | local z | Notes |
|---:|---|---:|---|
| 1 | `CCGesturesLayer` | default `0` | nonvisual; horizontal drag, horizontal flick, and back-key delegates |
| 2 | title sprite | `1` | `Interfaces/modeselect.png` |
| 3 | one-item back `CCMenu` | `1` | menu position explicitly zero |
| 4 | decorative long-rope sprite | `1` | `Interfaces/object-long-rope.png` |
| 5 | Classic `RopeButton` | `1` | card index `0` |
| 6 | Crazy `RopeButton` | `1` | card index `1` |
| 7 | GN Style `RopeButton` | `1` | card index `2` |
| 8 | Classic Bird `RopeButton` | `1` | card index `3` |
| 9 | Crazy Bird `RopeButton` | `1` | card index `4` |
| 10 | Combo Bird `RopeButton` | `1` | card index `5` |
| 11 | insufficient-coins label | `1` | initially hidden |

The back menu contains exactly one `CCMenuItemImage`, using the normal/selected paths in the
resource table. No disabled-image path is supplied. Equal-z card and shell order is
authoritative.

## Shell layout and entrance actions

No anchor setter is present for the title, back item, or decorative rope. Their center
anchors are **inferred** legacy defaults and must be explicit Creator inputs without being
upgraded to recovered app calls.

| Node | Initial position | Recovered actions started independently | Final/steady position |
|---|---|---|---|
| title | `(T.x, T.y + 0.5h(title))` | `MoveBy(1.0, (0, -h(title)))` | `(T.x, T.y - 0.5h(title))` |
| back item | `(L.x - 0.5w(back), B.y + 0.5h(back))` | `RotateBy(1.0, +360)` and `MoveBy(1.0, (w(back), 0))` | `(L.x + 0.5w(back), B.y + 0.5h(back))` |
| long rope | `(C.x, 0.825H)` | `FadeIn(0.5)` | same position |

The title has no recovered fade or rotation. The back item has no recovered fade. The long
rope has no app-level pre-action opacity setter. `ModeSelectLayer::onEnter` calls
`runAction(FadeIn(0.5))` at `0x0015C7FE` before adding the sprite at
`0x0015C802..0x0015C80E`. Because the sprite is not yet running, `CCNode::runAction`
registers the action paused. `CCActionManager::addAction` immediately invokes the inherited
`CCActionInterval::startWithTarget`, which sets elapsed time to zero and the first-tick flag
without writing opacity. Adding the sprite to the already-running layer resumes its actions.
On the first manager step, `CCActionInterval::step` forces normalized `t = 0` and
`CCFadeIn::update` writes opacity `uint8(trunc(255 * t))`; subsequent steps use the clamped
normalized interval time through `t = 1`, reaching opacity `255` at `0.5` action-seconds.
The fade is therefore linear and independent of pre-action opacity. Opacity remains unchanged
between registration and that first manager step; no rendered-frame claim is made for that
pre-step interval.

No easing wrapper is present around the Mode Select-owned direct `MoveBy`, `RotateBy`,
`ScaleTo`, or fade actions in this contract. Their recovered signed endpoints are driven by
the same linear normalized interval time; frame sample times remain scheduler-dependent.

Canonical full-visible-rectangle fixtures:

| Node | `480x800` | `720x1280` |
|---|---|---|
| title initial -> final | `(240, 859) -> (240, 741)` | `(360, 1359.5) -> (360, 1200.5)` |
| back initial -> final | `(-72, 62) -> (72, 62)` | `(-90, 75) -> (90, 75)` |
| long rope | `(240, 660)` | `(360, 1056)` |
| insufficient label | `(240, 280)`, size `32` | `(360, 448)`, size `48` |
| unlock-particle container | `(240, 200)` | `(360, 320)` |

The label text is exactly `Not enough coins!`. It uses `Fonts/SlabThing.ttf` at
`f32(f32(W / 480) * 32)`, position `(C.x, 0.35H)`, and RGB `(250, 0, 0)`. It is added before
being set invisible. Its center anchor and legacy font metrics are inferred defaults.

## Six-card rail

### Card mapping and initial positions

Card `i` is requested at:

```text
p_i = (C.x - f32((5 - i) * W), 0.35H), i = 0..5
```

The card's static rope anchor uses `(p_i.x, 0.835H)`. Thus the initial anchor rail is:

| Profile | x positions for cards `0..5` | card y | rope-anchor y |
|---|---|---:|---:|
| `480x800` | `[-2160, -1680, -1200, -720, -240, 240]` | `280` | `668` |
| `720x1280` | `[-3240, -2520, -1800, -1080, -360, 360]` | `448` | `1068.8` |

Combo Bird, index `5`, is therefore visually centered at construction. The constructor's
`currentIdx` is nevertheless `0`, while its destination-state field is `-1`. On the first
unpressed update, the rail starts moving toward Classic, index `0`. Creator must preserve
this initially centered Combo -> Classic movement; pre-centering Classic at construction is
not equivalent.

| Index | Mode/destination | Fruit ID and intact art | circle art | description art | initial lock |
|---:|---|---|---|---|---|
| 0 | Classic / state `0` | `0` / `fruit-apple.png` | `mode-classic.png` | `object-classic-des.png` | always cuttable |
| 1 | Crazy / state `1` | `1` / `fruit-banana.png` | `mode-crazy.png` | `object-crazy-des.png` | locked unless `mode_unlock_1` |
| 2 | GN Style / state `2` | `2` / `fruit-strawberry.png` | `mode-gnstyle.png` | **`object-combo-des.png`** | locked unless `mode_unlock_2` |
| 3 | Classic Bird / state `3` | `7` / `fruit-orange.png` | `mode-classic-bird.png` | `object-classic-bird-des.png` | always cuttable |
| 4 | Crazy Bird / state `4` | `14` / `fruit-magnetstrawberry.png` | `mode-crazy-bird.png` | `object-crazy-bird-des.png` | locked unless `mode_unlock_4` |
| 5 | Combo Bird / state `5` | `6` / `fruit-kiwi.png` | `mode-combo-bird.png` | `object-combo-bird-des.png` | locked unless `mode_unlock_5` |

Only indices `1,2,4,5` query `Settings::getModeUnlock(index)`. The getter formats
`mode_unlock_%d` and defaults absent keys to `false`. Indices `0` and `3` do not query a
mode-unlock key.

### Drag, flick, bounds, and current index

Horizontal drag uses the gesture's recovered `delta.x` directly:

- if `delta.x < 0` and the last card's anchor x is at least `L.x`, move all six anchors by
  `(delta.x, 0)`;
- otherwise, if `delta.x > 0` and the first card's anchor x is at most raw logical `W`, move
  all six by `(delta.x, 0)`;
- a zero or rejected delta moves nothing;
- after every drag callback, including a rejected move, recompute `currentIdx`.

The bound is checked before applying the event, so one drag event may cross it. The right
bound is raw `W`, not `R.x`. There is no wrap.

`updateForCurrentIdx` sets the index to `-1`, scans cards `0..5` in insertion order, and for
every card satisfying the strict binary32 comparison
`cardAnchorX - 0.5W < W` overwrites the index with that card number. The last qualifying card
wins. The function also computes the absolute center distance for the qualifying card but
does not use it to choose a nearest card. Replacing this rule with a generic nearest-center
search changes threshold behavior.

On a horizontal flick:

- positive `delta.x` decrements `currentIdx` when it is greater than `0`;
- negative `delta.x` increments `currentIdx` when it is below `5`;
- zero or an outward flick at an endpoint does nothing.

The flick changes only the index. The scheduled centering rule moves the rail afterward.

The recovered `CCGesturesLayer` raw-touch bridge preserves both callbacks rather than treating
drag and flick as mutually exclusive:

- `ccTouchesMoved` at `0x001470E8` updates the retained previous/current touch positions,
  invokes the generic drag callback, then invokes the horizontal or vertical drag callback
  selected from the movement angle;
- the inclusive angle sectors `45..135` and `-135..-45` degrees are vertical; horizontal
  dispatch therefore requires `abs(delta.x) > abs(delta.y)`, with diagonal ties treated as
  vertical;
- `ccTouchesEnded` at `0x00146FF8` compares the Euclidean length of the retained last move
  segment (`previous - current`) against binary32 `1.0`; it does not sample a new end position
  or use the total begin-to-end displacement;
- when that distance is strictly greater than `1.0`, it invokes the generic flick callback
  and then the direction-specific flick callback before clearing the pressed state. The
  callback reads `getDelta()`, which returns `current - previous`;
- therefore a physical gesture can legitimately apply horizontal drag deltas and then a
  horizontal flick. A compatibility bridge must not suppress the flick merely because a drag
  callback already changed `currentIdx`.

Creator touch-cancel has no corresponding recovered callback in this binary. The Creator
adapter clears its owned gesture state without emitting a flick on cancel; that is an explicit
platform-lifecycle inference, not a recovered gameplay rule.

### Frame-based centering

`ModeSelectLayer::update` invokes `PhysicsBladeLayer::update` first. When the gesture is
pressed, no automatic rail move occurs. Otherwise define, in binary32:

```text
d = f32(0.5W - selectedAnchorX)
```

The same horizontal shift is sent to all six `RopeButton::Move` calls:

```text
if d == 0:
    dx = 0
else if abs(d) > 2:
    dx = f32(f32(0.1 * d) + f32(abs(d) / d))
else:
    dx = d
```

`abs(d)/d` is the recovered sign term. The strict threshold is `2.0`. The final
`0 < abs(d) <= 2` branch snaps exactly to center and prevents overshoot. This algorithm is
per scheduled frame and does not use the `update(float)` delta-time argument. A
time-normalized interpolation is not compatible.

## RopeButton composition and synchronization

Each `RopeButton` owns a static anchor body, seven dynamic rope-link bodies, and a jointed
Fruit body. The recovered body scale is `32` logical units per Box2D metre. The static anchor
is `(p.x / 32, 0.835H / 32)` at angle `0`. Rope link `j = 0..6` starts at:

```text
x_j = p.x
y_j = 0.835H - 0.5h(ropeNode) - j*h(ropeNode)
```

Each link displays `Interfaces/object-rope-node.png` and is joined in a seven-link revolute
chain from the static anchor to the Fruit body. `RopeButton::Move(dx,dy)` translates only
the static anchor body by `(dx/32,dy/32)` while preserving angle `0`; the jointed objects
follow through physics.

The exact equal-z local insertion order is:

1. seven rope-link `PhysicsObject` nodes, `j=0..6`;
2. one Fruit-body-attached `PhysicsObject` using `object-des-shader.png`;
3. one Fruit-body-attached `PhysicsObject` using that card's description resource;
4. the `FruitButton`;
5. upper `object-wheel.png`;
6. lower `object-wheel.png`;
7. `object-wheel-connect.png`.

All thirteen are added at local z-order `1`. The rope links, shader, description, and wheel
assembly have no recovered entrance fade or move action; wheel rotation/position is assigned
by the scheduled synchronization below. `RopeButton` schedules its own update. On each
scheduled frame it:

- reads the static anchor in body metres and converts it back by `32`;
- calls `FruitButton::setPosition((anchor.x, priorFruitPoint.y))`, retaining the requested
  `0.35H` y while forcing the Fruit body x to the anchor x;
- places the upper wheel at
  `(anchor.x, anchor.y + h(wheel)/1.5)` and the lower wheel at
  `(anchor.x, anchor.y - h(wheel)/1.5)`;
- places the connector at the anchor;
- sets each wheel's rotation from its current x using
  `f32(f32(x / f32[0x4196CBE4]) * f32[0x42652EE1])`, where the constants are approximately
  `18.84955597` and `57.29578018`.

The wheel formulas, including divisor `1.5`, are recovered. Sprite/body synchronization order
inside the legacy scheduler and exact joint integration across devices are not observed
frames; Creator must use a deterministic rope adapter and may not claim pixel-identical
legacy trajectories.

## FruitButton and cut presentation

For every card, `FruitButton::onEnter` inserts exactly three local children at z-order `1`:

1. blur;
2. circle art;
3. intact `Fruit`.

The recovered entry behavior is:

- blur position
  `(p.x - f32[0x3DB851EC] * w(blur), p.y - 0.05h(blur))`, explicit opacity `0`, and
  `FadeIn(1.25)`;
- circle at `p`, explicit opacity `0`, `FadeIn(1.25)`, and perpetual
  `RotateBy(15.0, -360)`;
- Fruit body transform `(p.x/32,p.y/32)` at angle `0`, gravity scale `0`, awake, and angular
  velocity `+2.0` radians/second;
- intact Fruit sprite opacity `0` and `FadeIn(1.25)`.

`f32[0x3DB851EC]` is the recovered approximately `0.09` entry offset. The first scheduled
`RopeButton` update calls `FruitButton::setPosition`. That path changes the blur x offset to:

```text
p.x - f32[0x3DA3D70A] * w(blur)
```

where `f32[0x3DA3D70A]` is approximately `0.08`; y remains
`p.y - 0.05h(blur)`. Thus Mode Select briefly constructs the `0.09` entry branch and then
uses the `0.08` steady branch. Collapsing them is not allowed.

The Fruit target callback is registered before the wrapper callback. On the first accepted
cut of a card:

1. `Fruit::Cut` attaches bottom then top cut halves and requests its effects-gated,
   non-looping fruit sound;
2. the Mode Select callback stores destination state `0..5` and invokes `ModeSelected`;
3. `FruitButton::fruitCutCallback` marks the wrapper cut, removes the blur with cleanup, and
   runs `ScaleTo(0.75, 0, 0)` on the circle;
4. the remaining shared Fruit notification path continues.

The exact Fruit sound branch is:

| Card/Fruit ID | Sound when effects are enabled |
|---|---|
| Classic / `0` | `Sounds/apple.wav` |
| Crazy / `1` | `Sounds/banana.wav` |
| GN Style / `2` | `Sounds/strawberry.wav` |
| Classic Bird / `7` | `Sounds/strawberry.wav` |
| Crazy Bird / `14` | default branch `Sounds/mangosteen.wav` |
| Combo Bird / `6` | `Sounds/apple.wav` |

The mismatches are recovered switch results, not semantic guesses. Center anchors for blur,
circle, intact Fruit, and cut halves are inferred legacy defaults.

## Lock and unlock contract

### Locked-card subtree

For a locked index, `FruitButton::SetLockState`:

1. calls the contained Fruit's cut-disable method with `true`;
2. creates one `CCMenuItemImage` using `button-unlock.png` and
   `button-unlock-selected.png`, targeting the Mode Select unlock callback;
3. positions the item at `(p.x, 0.5p.y)`;
4. puts it in a one-item `CCMenu` explicitly positioned at `(0,0)`;
5. adds that menu to the contained Fruit at z-order `1`.

The lock menu is not a Mode Select root child. Its item/menu center anchors are inferred.

The callback does not derive the card from its sender. It acts on the layer's current
`currentIdx`. Preserving that coupling matters if an off-center lock remains interactable.

### Successful unlock

Success uses the strict test `totalCoins > 2499`, equivalent to at least `2500`. Synchronous
order is:

1. read total coins again;
2. call `Settings::setTotalCoins(totalCoins - 2500)`;
3. call `Settings::setModeUnlock(currentIdx, true)`;
4. call `RopeButton::Unlock` for `currentIdx`;
5. construct, configure, position, and add the particle container at Mode Select z-order `1`.

`FruitButton::Unlock` calls the Fruit cut-disable method with `false` and sets the lock menu
invisible. It does not remove the menu.

Persistence has a recovered asymmetry. `setModeUnlock` writes
`mode_unlock_%d=true` to `CCUserDefault` and flushes immediately.
`setTotalCoins` changes only the process-static total and calls `flush()`; it does not write
the `total_coins` key in that function. Coin durability therefore depends on a later
`Settings::SaveData` checkpoint. A Creator port must not silently claim immediate native
coin persistence without an explicit product decision.

### Insufficient coins

For `totalCoins <= 2499`, the layer:

1. sets the insufficient label visible;
2. sets its opacity to `0`;
3. runs `FadeIn(0.5) -> Delay(1.0) -> FadeOut(0.5)`.

There is no `stopAllActions` call in this branch. Repeated failures can attach overlapping
sequences. No sound, coin mutation, unlock write, or particle is requested.

### Exact unlock burst

Define:

```text
minDistance = trunc32(f32(f32(W / 480) * 50))
maxDistance = trunc32(f32(f32(W / 480) * 150))
```

The layer constructs:

```text
ParticleExplosion(minDistance, maxDistance, 35.0, 70.0, 45)
position = (C.x, 0.25H)
Create("Blades/Particles/X-Mas/xmasfive.png", 0.05, false, false)
root z-order = 1
```

The canonical distance ranges are `[50,150]` at `480x800` and `[75,225]` at
`720x1280`.

The container timeline is:

```text
Delay(0.05) -> synchronous Explosion -> Delay(1.4) -> remove container with cleanup
```

At `0.05` seconds, the callback creates exactly `45` particles. Each consumes five inclusive
integer draws in this order:

1. duration hundredths in `[35,70]`, converted to `0.35` through `0.70` seconds;
2. horizontal sign in `[-1,1]`;
3. horizontal magnitude in `[minDistance,maxDistance]`;
4. vertical sign in `[-1,1]`;
5. vertical magnitude in `[minDistance,maxDistance]`.

The move delta is
`(horizontalSign * horizontalMagnitude, verticalSign * verticalMagnitude)`. A zero sign
produces no movement on that axis but still consumes its magnitude draw. The burst consumes
exactly `225` draws.

Each `ParticleObject` is added to the container at z-order `1` and creates one sprite child
at default z-order `0`. Concurrent per-particle actions are:

- `MoveBy(duration, delta)` followed by its finished callback;
- `ScaleTo(duration, 0, 0)`;
- `RotateBy(duration, 1, 1)` using the recovered three-argument overload.

Fade-out is disabled. Auto-delete is explicitly disabled, so the finished callback retains
the particle until the container removal at nominal unlock time `1.45` seconds. Both
`ParticleExplosion::Create` color flags are `false`, so no color draws or `SetColor` calls
occur. White modulation, center anchor, full initial opacity, and ordinary sprite blending
are inferred engine defaults. Native PRNG seed, algorithm parity, and shared-stream state are
not established; only the exact draw protocol is recovered.

## Selection and navigation

### Mode selection

Every available card callback first writes its fixed destination state and then invokes
`ModeSelected`. If effects are enabled, `ModeSelected` requests non-looping
`Sounds/gameplayselected.wav`. It then starts:

```text
Delay(0.75) -> ModeSelectLayer::DelayCallback
```

The Fruit cut sound is requested before this selection effect because the Fruit callback
precedes the Mode Select target notification. Both are independently gated by
`EnableEffects`.

There is no layer-wide navigation guard, no Mode Select `DisableCut(true)` call, and no
`stopAllActions` in `ModeSelected`. A different card can therefore cut during the `0.75`
window, overwrite the destination state, and attach another delayed sequence. Creator must
not invent debounce behavior as recovered parity.

At the delayed callback:

1. capture the current parent;
2. remove Mode Select from it with cleanup enabled;
3. read the stored destination state and construct the matching layer;
4. add that layer to the same parent at z-order `1`.

| State | Destination |
|---:|---|
| `0` | `ClassicModeLayer` |
| `1` | `CrazyModeLayer` |
| `2` | `GNStyleLayer` |
| `3` | `ClassicBirdLayer` |
| `4` | `CrazyBirdLayer` |
| `5` | `ComboBirdLayer` |

An out-of-range state adds no destination. No background-music stop/start, save call, or menu
click sound occurs in this delayed path. Destination-screen presentation is outside this
contract.

### Back item and back key

The back key delegates directly to the back-item callback. That callback:

1. if effects are enabled, requests non-looping `Sounds/menubuttonclick.wav`;
2. stops all Mode Select actions;
3. captures the current parent;
4. removes Mode Select with cleanup enabled;
5. constructs `MainMenuLayer`;
6. adds it to the same parent at z-order `1`.

This path is immediate; it has no delay. It does not save or change music.

## Creator implementation boundary

The bounded clean-room implementation may use new adapters, but their output contracts are:

| Concern | Required mapping |
|---|---|
| resolution | physical-width `720` branch, exact resource tree, logical `W/H`/VisibleRect formulas |
| sibling priority | explicit shared order and explicit Mode Select root/local orders; do not rely on editor coincidence |
| gesture rail | direct drag deltas, strict bounds, last-qualifying index rule, bounded flick, frame-based `2`-unit snap |
| rope | `32`-unit body adapter, seven-link revolute chain, anchor-only rail move, exact wheel/Fruit synchronization |
| FruitButton | exact entry/steady blur branches, three-child order, fades, circle rotation, body state, and callback order |
| locks | four persisted indices, current-index coupling, `2500` price, hide-not-remove menu, persistence asymmetry |
| particles | exact constructor/configuration, `0.05` burst, `45` particles, five-draw protocol, actions, `1.45` cleanup |
| navigation | effects-gated sound, no invented gate, `0.75` mode delay, immediate back, cleanup replacement at z `1` |

Creator coordinate and rotation adapters may account for lower-left legacy coordinates and
engine angle conventions. They may not alter the recovered formulas, signed action values,
or ordering. Exact legacy Box2D iteration, action frame-sampling, sampler/blend state, font
rasterization, and audio-device output are not claimed.

## Deterministic/static validation

No validation step may execute the APK or native library.

1. Parse `E-RES` and assert every paired path above has the listed dimensions and exact
   catalog SHA-256; assert every shared font/audio hash.
2. Regenerate the allowlisted `E-MODE`, `E-ROPE`, `E-FRUIT-BUTTON`, `E-PARTICLE`, and
   `E-SETTINGS` ranges from `E-NATIVE` with the recorded disassemblers. Compare call targets,
   float bits, branch directions, callback pointers, and child-add arguments.
3. Assert shared roots all use z-order `1` with tags `0,1,2,3`, then assert the surviving
   Background -> Leaf -> Theme -> Mode Select insertion order.
4. Assert four imported blade children remain, inherited ScoreManager is removed, and the
   exact eleven-node directly owned root order follows.
5. Snapshot shell and rail formulas at both canonical profiles and at a noncanonical visible
   rectangle. Reject raster width/height as a layout substitute.
6. Assert title/back/rope entrance durations and signs, rope run-before-add paused
   registration, first-step opacity `0`, linear `uint8(trunc(255 * t))` fade, exact label
   content/style, and absence of extra title/back fades.
7. Assert all six card IDs, paths, callbacks, states, lock queries, initial anchors, and the
   GN Style -> `object-combo-des` mismatch.
8. Assert each RopeButton's thirteen equal-z local children, seven-link positions/joints,
   `32` conversion, anchor-only move, wheel `h/1.5` offsets/rotation, and retained Fruit y.
9. Assert FruitButton blur -> circle -> Fruit order, `0.09` entry and `0.08` steady offsets,
   `1.25` fades, `15/-360` circle action, body angle/gravity/angular velocity, and cut callback
   order/sounds.
10. Drive scripted drag/flick input. Assert pre-checked bounds, last-qualifying index,
    initial Combo -> Classic motion, per-frame `0.1d + sign(d)` only above `2`, exact snap at
    `0 < |d| <= 2`, and no delta-time normalization.
11. Exercise all four locked indices. Assert `>2499` success, exact mutation/hide order,
    immediate unlock-key flush, deferred coin-key durability, and overlapping failure
    sequences without sound.
12. With a scripted RNG and fake clock, assert zero draws before `0.05`, then exactly `225`
    inclusive draws in the recovered order, all `45` concurrent particle action sets, no
    color/fade/auto-delete, and one container cleanup at `1.45`.
13. Cut each available mode with a synthetic blade event. Assert Fruit sound -> state write ->
    selection sound -> delayed sequence -> wrapper visual callback, no layer-wide navigation
    gate, and exact same-parent destination mapping.
14. Exercise button and back-key exits. Assert click-before-stop, immediate remove/new
    Main Menu/add order, cleanup, z `1`, and no save/music mutation.
15. Run the prohibited-boundary audit: no original executable, native library, legacy runtime,
    JNI compatibility bridge, or decompiler artifact may enter Creator.

## Status ledger

| Item | Status | Confidence / boundary |
|---|---|---|
| exact paired paths, dimensions, and catalog hashes | recovered | high; `E-RES` |
| resolution branch and logical coordinate profile | recovered | high; imported `E-PROFILE` |
| directly owned root and RopeButton/FruitButton local orders | recovered | high; direct add calls |
| title, back, long rope, label, card, wheel, and rail formulas/actions | recovered | high; dual targeted disassembly agreement |
| card IDs/resources/states and lock defaults | recovered | high |
| drag/flick bounds, last-qualifying index, frame rule, and `2`-unit snap | recovered | high |
| Fruit entry/steady branches, physics state, cut ordering, and audio switches | recovered | high |
| unlock price/order, label behavior, persistence asymmetry, and particle protocol | recovered | high |
| delayed mode and immediate back replacement | recovered | high |
| clean defaults background `0`, theme `2`, blade `0` | recovered | clean/no-save baseline; persisted overrides exist |
| center anchors and default white/opacity/blend where no setter occurs | inferred | explicit Creator inputs; not recovered app setters |
| exact legacy rope trajectory/action frame samples/font pixels/audio output | unknown/not claimed | no original-runtime observation |
| native RNG sequence parity | unknown/not required | draw count/order/ranges only |
| destination-mode presentation | outside scope | constructor mapping does not prove destination layout |
| shared Background and default blade | imported dependency | covered separately; not part of this GREEN claim |
| shared Leaf and Theme presentation | imported dependency | accepted separately by `E-SHARED` |
| clean/default complete Mode Select logical composite | **GREEN across contracts** | `E-PROFILE` + `E-SHARED` + `E-BLADE` + this owned subtree |
| Mode Select-owned subtree | **GREEN** | static implementation contract and deterministic checks above |
| original-content rights | unknown/not cleared | original files cannot be assumed shippable |

## Strict non-claims and unresolved questions

- No original Mode Select frame, gesture session, cut animation capture, audio capture, or
  device crop was observed.
- GREEN means the Mode Select-owned logical subtree is sufficiently specified for clean-room
  implementation and deterministic validation. It does not mean pixel identity.
- The shared layers are accepted by a separate contract; their GREEN status is not evidence
  that this Mode Select-owned contract independently recovered those implementations.
- Default center anchors and unmodified particle color/blend are engine-default inferences,
  not recovered app setters.
- Exact native physics solver integration and scheduler ordering are not a cross-device pixel
  promise; the recovered topology, inputs, and synchronization calls remain mandatory.
- Persisted non-default background/theme/blade presentation is not green-gated here.
- Native PRNG seed and global stream interleaving remain unknown.
- Asset ownership and redistribution permission remain unresolved.

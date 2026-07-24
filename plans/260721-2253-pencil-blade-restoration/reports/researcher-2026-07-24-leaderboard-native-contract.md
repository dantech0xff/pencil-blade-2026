# Leaderboard native and resource contract

Date: 2026-07-24
Scope: original Android `LeaderboardLayer` / `LeaderboardItem`, all six modes, static evidence only
Source APK identity: native `libgame.so` SHA-256 `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`

## Verdict

The original leaderboard is now directly resolved. It is a local, read-only, horizontally
swiped six-card screen. It is not a Result panel, an online service, or a platform leaderboard.
The item order is:

1. Classic
2. Crazy
3. Gangnam Style
4. Classic Bird
5. Crazy Bird
6. Combo Bird

Each item reads three process-owned `Settings` integers, formats them as decimal text, and
uses one mode-specific raster over the shared leaderboard template. Navigation is bounded,
non-wrapping, and frame-snapped. The only leaderboard-owned sound is the effects-gated back
click. No leaderboard function calls networking, Java platform services, particles, or a save.

This report corrects earlier resource-only reports that treated the six header rasters as
unresolved candidates and attributed `Fonts/Arial.ttf` to this screen. Direct
`LeaderboardItem::onEnter()` disassembly proves the raster consumer and proves that player
labels use `Fonts/Andyb.ttf`, while score labels use `Fonts/Century.ttf`.

## Evidence and certainty

### Static evidence used

- `.forensics-work/phase-01/native/libgame.so`
- `.forensics-work/phase-01/jadx/resources/assets/480x800/Leaderboard/**`
- `.forensics-work/phase-01/jadx/resources/assets/720x1280/Leaderboard/**`
- `.forensics-work/phase-01/jadx/resources/assets/{480x800,720x1280}/Buttons/**`
- `.forensics-work/phase-01/jadx/resources/assets/Fonts/{Andyb,Century}.ttf`
- `.forensics-work/phase-01/java/app-owned/PencilBlade.java`
- `forensics/native/java-jni-boundary.md`
- `forensics/contracts/main-menu-presentation-contract.md`
- `forensics/contracts/shared-game-scene-presentation-contract.md`
- the byte-identical staged resources under `game/assets/game/**`
- Creator `.meta` files beside the staged leaderboard images and fonts

GNU ELF/disassembly tools, string tables, section-relative reads, image metadata, file hashes,
and existing static contracts were used. The APK and native library were never launched,
loaded, linked, installed, or integrated.

### Certainty labels

- **[RECOVERED]** Direct native control flow, literal, asset byte, Java implementation, or
  project bootstrap evidence.
- **[INFERRED]** Required engine/default behavior or a restoration decision derived from the
  recovered calls.
- **[UNKNOWN]** Static evidence does not settle the fact.

Native addresses below are virtual addresses in the identified ARM ELF:

| Symbol | Address | Contract contribution |
|---|---:|---|
| `LeaderboardItem::onEnter()` | `0x001587e4` | six-mode dispatch, art, labels, scores, fonts, colors, geometry |
| `LeaderboardItem::LeaderboardItem(int)` | `0x00158dec` | item-index storage |
| `LeaderboardItem::Move(float,float)` | `0x00158e10` | whole-card translation |
| `LeaderboardLayer::backCallback(CCObject*)` | `0x00158f20` | return-to-menu lifecycle and click sound |
| `LeaderboardLayer::onHorizontalFlick(...)` | `0x00158f84` | bounded index change |
| `LeaderboardLayer::LeaderboardLayer()` | `0x00158fe0` | layer initialization |
| `LeaderboardLayer::canMoveRight()` | `0x00159088` | lower-bound query |
| `LeaderboardLayer::canMoveLeft()` | `0x001590ae` | upper-bound query |
| `LeaderboardLayer::updateForCurrentIdx()` | `0x001590de` | closest-card selection |
| `LeaderboardLayer::onHorizontalDrag(...)` | `0x0015916c` | direct rail translation and bounds |
| `LeaderboardLayer::update(float)` | `0x001591e0` | frame-based center snap |
| `LeaderboardLayer::onEnter()` | `0x00159420` | complete screen graph and entrance animation |
| `MainMenuLayer::leaderBoardCallback(CCObject*)` | `0x0015ba04` | delayed source transition |
| `MainMenuLayer::delayCallback(float)` | `0x0015aa1c` | source removal, target attach, music stop |
| `Settings::SaveData()` | `0x00163094` | external persistence boundary |
| `Settings::LoadData()` | `0x00163620` | local defaults and key loads |

## Six-mode data contract

### Order, headers, globals, and preference keys

All values below are **[RECOVERED]**. `LeaderboardLayer::onEnter()` constructs exactly six
items with indices `0..5`; `LeaderboardItem::onEnter()` dispatches on that same integer.
“Gangnam Style” is the visible mode name represented by the `gnstyle` header.

| Index | Visible mode | Header asset | Header-load branch | Native score globals, ranks 1/2/3 | Local preference keys, ranks 1/2/3 |
|---:|---|---|---:|---|---|
| `0` | Classic | `Leaderboard/leaderboard_classic.png` | `0x00158864` | `0x00482444`, `0x00482440`, `0x0048243c` | `classic_best_1`, `classic_best_2`, `classic_best_3` |
| `1` | Crazy | `Leaderboard/leaderboard_crazy.png` | `0x00158894` | `0x00482438`, `0x00482434`, `0x00482430` | `crazy_best_1`, `crazy_best_2`, `crazy_best_3` |
| `2` | Gangnam Style | `Leaderboard/leaderboard_gnstyle.png` | `0x001588ce`; path load `0x001588fc` | `0x0048242c`, `0x00482428`, `0x00482424` | `gnstyle_best_1`, `gnstyle_best_2`, `gnstyle_best_3` |
| `3` | Classic Bird | `Leaderboard/leaderboard_classic_bird.png` | `0x00158902`; path load `0x00158930` | `0x00482468`, `0x00482464`, `0x00482460` | `bird_classic_best_1`, `bird_classic_best_2`, `bird_classic_best_3` |
| `4` | Crazy Bird | `Leaderboard/leaderboard_crazy_bird.png` | `0x00158936`; path load `0x00158964` | `0x00482450`, `0x0048244c`, `0x00482448` | `bird_crazy_best_1`, `bird_crazy_best_2`, `bird_crazy_best_3` |
| `5` | Combo Bird | `Leaderboard/leaderboard_combo_bird.png` | `0x001589e0`; path load `0x00158a0e` | `0x0048245c`, `0x00482458`, `0x00482454` | `bird_combo_best_1`, `bird_combo_best_2`, `bird_combo_best_3` |

The item reads the three selected globals once during its `onEnter`, formats each through the
literal `"%d"`, and gives those strings to three score labels. Therefore:

- **[RECOVERED]** Decimal formatting is signed integer `%d`; there is no padding, grouping,
  suffix, placeholder, or alternate empty state.
- **[RECOVERED]** A clean/missing key loads as integer `0`; a clean board displays three
  literal zeroes.
- **[RECOVERED]** The screen snapshots the globals when each item enters. It has no live
  observer and no refresh call.
- **[RECOVERED]** The screen does not rank, insert, mutate, load, or save scores.
- **[INFERRED]** A recreation should pass an immutable six-board snapshot into the presenter,
  or rebuild the screen after a score commit. Binding live mutable state would be observably
  different.

## Profile selection and coordinate basis

The app bootstrap selects one of two complete asset search trees:

| Physical frame-width branch | Search tree | Design resolution | Canonical `W x H` used below |
|---|---|---|---|
| `< 720` | `480x800/` | `480 x 800` | `480 x 800` |
| `>= 720` | `720x1280/` | `720 x 1280` | `720 x 1280` |

The design-resolution policy argument is `2` and the content scale factor is `1.0`.
Coordinates below are Cocos logical coordinates. Canonical pixel values assume the reference
frame exactly matches its design resolution. `VisibleRect` still supplies title/back bounds,
so a different physical aspect ratio can change the visible origin or crop; the exact
device-by-device crop is **[UNKNOWN]** without an original runtime trace.

All calculations should retain IEEE-754 binary32 step ordering. The important literals are:

- item rail height: `0.475f` (`0x3ef33333`)
- header offset multiplier: `1.085f` (`0x3f8ae148`)
- snap proportional term: `0.1f` (`0x3dcccccd`)
- score anchor: `(1.25f, -0.75f)` (`0x3fa00000`, `0xbf400000`)

## Screen graph and lifecycle

### Entry from Main Menu

The following sequence is **[RECOVERED]**:

1. The leaderboard entry is Main Menu fruit/button ID `13`, the electric-apple visual.
2. A cut is accepted only while the menu navigation state is `0`.
3. The source menu invokes `DisableCut(true)`, schedules
   `Delay(0.75) -> MainMenuLayer::delayCallback`, and stores navigation state `2`.
4. The cut uses the effects-gated, non-looping source sound
   `Sounds/mangosteen.wav`. It does not use the normal menu-button click.
5. At `0.75` seconds the callback captures the parent, removes `MainMenuLayer` with cleanup,
   constructs `LeaderboardLayer`, and adds it to the same parent at local z `1`.
6. Only after the leaderboard is attached, the callback calls
   `stopBackgroundMusic(false)` when music is enabled.

Repeated cut/navigation callbacks during the delay are ignored by the nonzero navigation
state. The leaderboard itself does not own this delay or the fruit-cut sound.

The shared `GameScene` roots remain behind the replacement screen:

| Persistent sibling | Local z / tag | Leaderboard behavior |
|---|---|---|
| `BackgroundLayer` | z `1`, tag `0` | remains attached |
| `LeafLayer` | z `1`, tag `1` | remains attached and can continue its shared leaf animation |
| `ThemeLayer` | z `1`, tag `2` | remains attached |
| `LeaderboardLayer` | z `1` | replaces `MainMenuLayer`; inserted after persistent roots |

On a clean settings state the persistent background/theme selections are `0`/`2`; loaded
selections supersede those defaults. The shared leaf animation is not a leaderboard-owned
particle effect.

### Leaderboard root construction order

`LeaderboardLayer::onEnter()` performs these adds:

1. a `CCGesturesLayer` at default local z `0`;
2. the title sprite at local z `1`;
3. a one-item back `CCMenu` at local z `1`;
4. six `LeaderboardItem` roots, indices `0..5`, each at local z `1`.

Equal-z insertion order is therefore title, back menu, then cards `0..5`. Engine equal-z
stable rendering is **[INFERRED]** from Cocos2d-x behavior; the explicit z arguments and add
order are **[RECOVERED]**.

The current index starts at `0`, so Classic is the initially centered card.

### Back to Main Menu

Both the back menu item and the registered Android hardware-back callback invoke the same
`LeaderboardLayer::backCallback`:

1. capture the parent;
2. remove the leaderboard with cleanup;
3. construct `MainMenuLayer`;
4. add the new menu to the same parent at local z `1`;
5. if effects are enabled, play non-looping `Sounds/menubuttonclick.wav`.

`MainMenuLayer` starts looping `Sounds/mainmenumusic.mp3` from its construction path when
music is enabled, so that start occurs before the post-add back click. There is no return
delay and no leaderboard save.

Two integration substitutions are explicitly rejected by direct evidence:

- Existing `Icons/back-button.png` / `Icons/back-button-selected.png` are not the native
  leaderboard pair. The required files are the two `Buttons/**` paths documented below.
- Playing the click before requesting/replacing the screen does not match native order. The
  native callback removes Leaderboard and constructs/attaches Main Menu before it checks the
  effects flag and calls `playEffect`. A transactional recreation should emit the click only
  after successful destination attachment.

## Exact visual contract

### Card rail

For card index `i`:

```text
item.x = f32((i + 0.5f) * W)
item.y = f32(0.475f * H)
```

Canonical roots:

| Profile | Card root x values for indices `0..5` | Card root y |
|---|---|---:|
| `480x800` | `240, 720, 1200, 1680, 2160, 2640` | `380` |
| `720x1280` | `360, 1080, 1800, 2520, 3240, 3960` | `608` |

Only card `0` begins centered; the remaining cards form one offscreen rail to its right.
Moving the rail translates all six item roots by the same x delta.

### Card child order

Every item:

1. creates `Leaderboard/leaderboard_view_templete.png` and positions it at `(0,0)`;
2. creates its mode header and positions it at
   `(0, f32(f32(templateHeight * 1.085f) * 0.5f))`;
3. adds template and header to the item with the default local z;
4. creates player labels and score labels;
5. adds all six labels to the template at local z `1` in this order:
   `Player 1`, `Player 2`, `Player 3`, score 1, score 2, score 3.

The template filename's spelling, `templete`, is original and must remain exact in asset
lookups.

### Header and template placement

| Profile | Template size | Header-height cases | Header center y relative to item |
|---|---:|---:|---:|
| `480x800` | `540 x 586` | all six `115` | `317.9049988` |
| `720x1280` | `773 x 844` | `137`, except GN/Crazy Bird `138` | `457.8700256` |

The header formula uses the shared **template's** content height, not the mode header's own
height. The one-pixel high-profile header-height differences therefore do not alter header
center position.

No app-owned anchor setter appears for template or header. Their center-anchor use is
**[INFERRED]** from the Cocos sprite default. With that default, the centered template
extends 30 logical pixels beyond each side of a `480` design and 26.5 beyond each side of a
`720` design. That overflow is part of the recovered unscaled geometry.

### Player and score labels

The exact strings are:

```text
Player 1
Player 2
Player 3
```

Player labels:

- font: `Fonts/Andyb.ttf`
- size: `f32(f32(W / 480.0f) * 30.0f)` → `30` low, `45` high
- no app-owned anchor setter

Score labels:

- font: `Fonts/Century.ttf`
- size: `f32(f32(W / 480.0f) * 40.0f)` → `40` low, `60` high
- explicit anchor `(1.25, -0.75)`

Both player and score node positions use the template's content dimensions `tw, th`:

| Rank | Template-local position | Player RGB | Score RGB |
|---:|---|---|---|
| `1` | `(0.45 * tw, 0.85 * th)` | `(255,0,0)` / `#ff0000` | `(128,0,0)` / `#800000` |
| `2` | `(0.45 * tw, 0.55 * th)` | `(0,128,255)` / `#0080ff` | `(0,56,128)` / `#003880` |
| `3` | `(0.45 * tw, 0.275 * th)` | `(0,185,0)` / `#00b900` | `(0,28,0)` / `#001c00` |

Binary32 canonical template-local node positions:

| Profile | x | rank-1 y | rank-2 y | rank-3 y |
|---|---:|---:|---:|---:|
| `480x800`, `tw=540`, `th=586` | `243` | `498.1000061` | `322.3000183` | `161.1500092` |
| `720x1280`, `tw=773`, `th=844` | `347.8499756` | `717.4000244` | `464.2000122` | `232.1000061` |

These are child coordinates inside a center-anchored template, not item-root coordinates.
Under the inferred default template anchor, the centered card's label node x is `213` in the
low profile and `321.3499756` in the high profile. The unusual score anchor intentionally
changes how the glyph box extends from that node; do not normalize it to a conventional
right-center anchor.

Player-label default anchor/opacity and exact TTF raster metrics are **[INFERRED]** engine
behavior, not explicit app setters. The text, font path, font size, node position, colors,
score anchor, and child z are **[RECOVERED]**.

### Title

The title uses `Leaderboard/leaderboard_title.png`:

- explicit anchor `(0.5, 1.0)`;
- start position `(VisibleRect.center.x, VisibleRect.top.y + title.height)`;
- `CCMoveTo` duration `1.0` to `(VisibleRect.center.x, VisibleRect.top.y)`;
- root local z `1`;
- no fade.

Canonical positions:

| Profile | Size | Start | End |
|---|---:|---:|---:|
| `480x800` | `552 x 118` | `(240,918)` | `(240,800)` |
| `720x1280` | `793 x 159` | `(360,1439)` | `(360,1280)` |

The title is intentionally wider than the canonical design width in both profiles and is
not scaled by leaderboard code.

### Back button

The normal/selected pair is intentionally asymmetric:

```text
Buttons/button-blue-back-normal.png
Buttons/button-back-selected.png
```

The menu item starts at:

```text
(VisibleRect.left.x - 0.5 * normalWidth,
 VisibleRect.bottom.y + 0.5 * normalHeight)
```

It simultaneously runs:

- `CCRotateBy(1.0, +360 degrees)`;
- `CCMoveBy(1.0, (normalWidth, 0))`.

The one-item menu is explicitly positioned at `(0,0)`.

| Profile | Normal size | Selected size | Canonical start center | Canonical end center |
|---|---:|---:|---:|---:|
| `480x800` | `144 x 124` | `144 x 124` | `(-72,62)` | `(72,62)` |
| `720x1280` | `180 x 150` | `181 x 150` | `(-90,75)` | `(90,75)` |

Normal-sprite dimensions define the initial/final item geometry. The high selected raster is
one pixel wider and must not be silently resized in an exact recreation.

## Asset byte contract

Paths below are relative to each profile root in both the extracted APK and
`game/assets/game/<profile>/`. Dimensions, byte counts, and hashes are **[RECOVERED]**.

| Asset | `480x800`: dimensions; bytes; SHA-256 | `720x1280`: dimensions; bytes; SHA-256 |
|---|---|---|
| `Leaderboard/leaderboard_view_templete.png` | `540x586`; `32237`; `37ab4c425142a96e8cebd7187cb765dcc8ca72d38f1f573628850cc6f6877311` | `773x844`; `51495`; `047b9d88999ec7e6e5c3f335880fa0b807fa02b843aea7a47c62910dace44e5b` |
| `Leaderboard/leaderboard_classic.png` | `466x115`; `7091`; `7ad4928c709c28bc59de1d8408411ccd26a939bc43ec27e112032b20c976d7c3` | `663x137`; `10690`; `2cf754253fb2c69ceed5c3a62b789af2a463f3fc181ecc6f4b7304966d0ac57a` |
| `Leaderboard/leaderboard_crazy.png` | `466x115`; `6799`; `28193c7c454acbe7e806404c324bfc0e70b303193506e7a3ce205a29f5bd3282` | `663x137`; `10164`; `15f03045ee90138fc43753990ab1de3a007d61bab6d8af06ce8d3932e896edff` |
| `Leaderboard/leaderboard_gnstyle.png` | `466x115`; `8073`; `a8150f9fbca4b3824a684515db8b4e42808e212d4f988151b84e233e2a35a2d0` | `663x138`; `12309`; `c0ca921ff65d80d6cc0e6c011614e79cbd7f6b50153a9e7f181fdfa0f919c2a5` |
| `Leaderboard/leaderboard_classic_bird.png` | `466x115`; `7094`; `d959dd6755cfd7a666e8c8bd4d600c7e0b035eea9697cfcebc2358b7d077a66b` | `663x137`; `10933`; `d1037998bdc06f9aceba578002ee2094d7c67dbb45dc12fde8d372a1409df94f` |
| `Leaderboard/leaderboard_crazy_bird.png` | `466x115`; `7065`; `033addf4029874bc31e446fa88deaefa3de02a435639b1fe8be7177e286071bb` | `663x138`; `10850`; `432223981f8d3c0c4280a6b7dc59b48a0efdb1f54386bf565774624a43323af1` |
| `Leaderboard/leaderboard_combo_bird.png` | `466x115`; `6855`; `18d8815f0e793885a9530fc4c341e6455f4a0a3e698e1fd4ee2828cc3c824a26` | `663x137`; `10356`; `4b4ef14177494d438ba89715f42c19e9aaa778b3b55b9f16d8f717756462b04f` |
| `Leaderboard/leaderboard_title.png` | `552x118`; `26737`; `c7f7af4d248120b5ce6ad46d14001c4654c91cb1cb5d468360d8c0ccd7eb6095` | `793x159`; `50708`; `696ee696db62266e7c218d762c32f0fc22694b9551518f43402eb479b84ab104` |
| `Buttons/button-blue-back-normal.png` | `144x124`; `7691`; `a978ec6a5f7ee20f54c077bd13f94177e233dbb9cded18af239896e4a87066ef` | `180x150`; `12033`; `451a19fde28ef07ce3df1991ab2adfb24e65a19279c0e59860ec5c6a67a9dbec` |
| `Buttons/button-back-selected.png` | `144x124`; `6304`; `15afb10b1f0c49731a30ae9c1e1b1def410c55b4f9101e95b8ff6d4b190a8641` | `181x150`; `9445`; `1b2bffab9db409a92ad97b8fae0a9d866fc6baaf49698e3ab97a38d5826d26ab` |

Shared fonts:

| Font | Bytes | SHA-256 | Direct leaderboard use |
|---|---:|---|---|
| `Fonts/Andyb.ttf` | `42432` | `13cb6762ba5a38853bc338367178b1c7647ad3d2fc407e8953afdc42b1af12d6` | player labels |
| `Fonts/Century.ttf` | `165248` | `21be61ff5289c2125dbb48e2a739fd4dd98c3e58b37abfc22cc0412dd8376d95` | score labels |

Creator image metadata imports each PNG as image → texture → sprite-frame, with linear
minification/magnification, no mipmaps, clamp wrapping, no trim, and pivot `(0.5,0.5)`.
A reconstruction loader should request the `/spriteFrame` subasset. Creator TTF metadata uses
the TTF importer. These metadata settings describe the staged reconstruction; the direct
native anchor calls remain the authority for explicitly recovered node anchors.

Useful native string locations:

| Literal | Address |
|---|---:|
| `Leaderboard/leaderboard_view_templete.png` | `0x003d1305` |
| `Leaderboard/leaderboard_classic.png` | `0x003d132f` |
| `Leaderboard/leaderboard_crazy.png` | `0x003d1353` |
| `Leaderboard/leaderboard_gnstyle.png` | `0x003d1375` |
| `Leaderboard/leaderboard_classic_bird.png` | `0x003d1399` |
| `Leaderboard/leaderboard_crazy_bird.png` | `0x003d13c2` |
| `Leaderboard/leaderboard_combo_bird.png` | `0x003d13e9` |
| `Player 1`, `Player 2`, `Player 3` | `0x003d1410`, `0x003d1419`, `0x003d1422` |
| `Leaderboard/leaderboard_title.png` | `0x003d142b` |
| `Fonts/Andyb.ttf`, `Fonts/Century.ttf` | `0x003e0002`, `0x003e0012` |
| normal/selected back paths | `0x003e0036`, `0x003e005a` |
| `Sounds/menubuttonclick.wav` | `0x003d05a0` |

## Gesture and navigation state machine

### Gesture registration

The leaderboard creates a shared `CCGesturesLayer`, sets the leaderboard as its target, and
registers:

- horizontal drag;
- horizontal flick;
- hardware back.

Relevant shared gesture functions occupy `0x00146ff8..0x001472e0`; registration functions are
at `0x00146e9c`, `0x00146eb4`, `0x00146eea`, and `0x00146f0e`.

### Shared recognizer semantics

The following is **[RECOVERED]**:

- move dispatch is segment-based;
- a move is horizontal only when `abs(dx) > abs(dy)`;
- exact diagonal ties classify vertical because the vertical angular sectors include the
  `45`, `135`, `-45`, and `-135` degree boundaries;
- touch end tests the retained final move-segment vector, not the full touch displacement;
- a flick requires Euclidean segment length strictly greater than `1.0`;
- generic flick dispatch precedes directional flick dispatch;
- the recognizer sets pressed false after flick dispatch.

The leaderboard registers only horizontal drag/flick behavior. A physical gesture can first
translate the rail through drag callbacks and then change the index through the terminal
flick callback. No leaderboard touch-cancel callback was recovered.

### Horizontal drag

Let `dx` be the gesture layer's current segment delta:

- if `dx < 0` and the last card's x is `>= 0.0f`, apply the complete `dx` to every card;
- if `dx > 0` and the first card's x is `<= W`, apply the complete `dx` to every card;
- otherwise, including `dx == 0`, do not translate.

The leftward guard is a literal zero comparison; it does not query `VisibleRect.left.x`.
The checks are pre-move and there is no partial clamp. A single accepted delta can cross a
bound. After every drag callback, accepted or rejected, the screen recomputes current index.

### Closest-card selection

`updateForCurrentIdx()`:

1. stores current index `-1`;
2. starts best distance at `W`;
3. scans cards `0..5`;
4. selects a card only when
   `abs(card.x - 0.5 * W)` is strictly less than the prior best.

An exact equal-distance tie therefore keeps the earlier/lower item index. This differs from
mode-selection logic and should not be generalized into one shared selector without a
configurable tie rule.

**[RECOVERED]** There is one native unsafe edge: because the initial best distance is exactly `W` and the
comparison is strict, an extreme accepted overshoot can leave every distance `>= W`; current
index then remains `-1`. The following native frame indexes the item vector with that value
without a recovered guard. That is undefined/crash-prone behavior, not a useful presentation
feature. **[INFERRED]** A reconstruction should preserve the prior valid index when the scan finds no
candidate (or reject such an out-of-range gesture segment) and document this narrow safety
hardening rather than emulate undefined memory access.

### Horizontal flick

- terminal `dx > 0`: decrement current index when current index is greater than `0`;
- terminal `dx < 0`: increment current index when current index is less than `5`;
- `dx == 0`, right flick at index `0`, or left flick at index `5`: no-op.

The mutation is guarded, not “add sign then clamp.” If current index is `-1`, either flick
direction leaves it `-1`.

There is no wrapping. Flick updates the target index only; it does not immediately teleport
the rail.

### Frame snap

While the gesture layer reports pressed, `LeaderboardLayer::update(float)` does no centering.
When not pressed:

```text
d = f32(0.5f * W - currentCard.x)

if d == 0:
    move = 0
else if abs(d) > 2:
    move = f32(f32(0.1f * d) + f32(abs(d) / d))
else:
    move = d
```

The resulting x movement is applied to all six cards. The update argument `dt` is ignored, so
the easing is frame-based, not time-based. For positive `d`, the signed term contributes
`+1`; for negative `d`, it contributes `-1`. Within two logical units, the remaining distance
is closed exactly.

There is no mode-card tap action, detail screen, selection marker, selected color, page dot,
or scale change. The index exists only to choose the snap target.

## Persistence, offline, platform, audio, and particles

### Local persistence

All 18 keys are Android-local preferences:

```text
Settings process globals
    -> Settings::SaveData()
    -> cocos2d::CCUserDefault
    -> Cocos2dxHelper
    -> Android SharedPreferences ("Cocos2dxPrefsFile")
```

`Settings::LoadData()` uses `0` defaults for all 18 values. `Settings::SaveData()` includes
the 18 leaderboard integers within a wider bulk save of 50 integer settings. The Java
preference setters synchronously commit individual values; this is not an atomic 50-key
transaction.

The leaderboard screen calls neither function. Existing gameplay/Result and app-lifecycle
contracts own when process globals change and when the bulk save runs. A reconstruction must
not add a leaderboard-entry or leaderboard-back save merely because this screen displays
persistent values.

### Offline and platform boundary

`LeaderboardLayer` and `LeaderboardItem` contain no call to:

- network availability;
- HTTP;
- JNI;
- Google Play Games;
- account/authentication;
- Java leaderboard submission or retrieval.

`PencilBlade.java` exposes app-owned ads, email, review, Facebook, and network-sentinel
bridges, but no leaderboard native method. Bundled Google Play classes/resources prove only
vendor presence, not use by this screen.

Therefore the six boards are fully functional offline from local `Settings` state. The
`network_available` sentinel is irrelevant to screen entry, display, paging, and back.

### Audio ownership

| Event | Sound/music | Loop | Gate | Owner |
|---|---|---:|---|---|
| accepted source fruit cut | `Sounds/mangosteen.wav` | no | effects | Main Menu |
| delayed leaderboard attach | stop current background music with `false` | n/a | music | Main Menu transition |
| card drag/flick/snap | none | n/a | n/a | Leaderboard |
| back | `Sounds/menubuttonclick.wav` | no | effects | Leaderboard callback |
| returned menu construction | `Sounds/mainmenumusic.mp3` | yes | music | Main Menu |

No leaderboard entry sting, page-turn sound, card-selected sound, or continuous music call
was recovered.

### Particles and random behavior

No leaderboard function creates a particle system/emitter, consumes a particle resource, or
calls random-number generation. The persistent `LeafLayer` may remain visibly active behind
the screen, but that is a shared GameScene sibling and not leaderboard-owned behavior.

## Restoration contract

### Required implementation mapping

| Concern | Required behavior | Do not introduce |
|---|---|---|
| data | immutable snapshot of six ordered top-three integer boards | one shared/aliased board, online fetch, lazy mutation |
| item view | shared template + exact index header + six exact labels | text header substitute, `Arial.ttf`, localized player labels |
| rail | six roots spaced exactly one `W`, first centered | grid, vertical list, carousel wrap |
| drag | segment delta, pre-check bounds, no partial clamp | total-displacement drag or post-clamp |
| flick | final-segment threshold/sign; bounded index ±1 | velocity pages, multi-page skip, wrap |
| snap | binary32 frame rule; ignore `dt` | duration tween or `dt`-scaled interpolation |
| pathological overshoot | keep a valid prior index or reject the out-of-range segment | native `-1` vector access / undefined behavior |
| back | same callback for visual and hardware back | save, confirmation, platform exit |
| audio | back click only inside leaderboard ownership | paging sounds or leaderboard music |
| platform | local/offline only | Google Play Games/API dependency |
| profile | exact low/high sprite frames and font sizes | uniform scale from only one source profile |

### Suggested ownership seams

These are **[INFERRED]** implementation seams, not original class names:

- a process-owned settings snapshot exposes six distinct three-integer boards;
- a pure leaderboard catalog maps index to header sprite-frame and board key family;
- a presenter owns current index, six x positions, pressed state, drag, flick, and frame snap;
- a Cocos component owns resource loads, node construction, actions, and audio callbacks;
- a navigator owns the `0.75`-second Main Menu transition and same-parent screen replacement.

Do not make the shared presenter depend on Result internals. Results write/update the boards;
this screen only reads a snapshot.

### Implementation constants table

| Name | Exact value |
|---|---|
| item count | `6` |
| initial index | `0` |
| rail spacing | `W` |
| item y | `f32(0.475f * H)` |
| player labels | `Player 1`, `Player 2`, `Player 3` |
| player font size | `f32(f32(W/480) * 30)` |
| score font size | `f32(f32(W/480) * 40)` |
| row y fractions | `0.85`, `0.55`, `0.275` of template height |
| shared row x | `0.45` of template width |
| score anchor | `(1.25, -0.75)` |
| flick minimum | final-segment Euclidean length `> 1.0` |
| snap close threshold | `abs(d) <= 2` |
| snap far movement | `f32(f32(0.1*d) + sign(d))` |
| title/back action duration | `1.0` second |
| title motion | top + own height → top |
| back motion | +normal width on x, simultaneous +360° rotation |
| Main Menu entry delay | `0.75` second |

## Verification matrix

### Pure/state tests

1. Assert the catalog order and all 18 exact key strings.
2. With all values absent/defaulted, assert all six cards display `0`, `0`, `0`.
3. Seed distinct signed values in all 18 slots and prove no board/rank aliases another.
4. Assert `%d`-equivalent decimal output, including zero and negative signed values.
5. Assert initial roots for both profile widths and one-`W` spacing.
6. Drag left/right at interior and endpoints; prove the literal-zero last-card guard, raw-`W`
   first-card guard, complete-delta acceptance, and overshoot.
7. Put adjacent cards at equal center distance; prove the lower index wins.
8. Exercise the no-candidate overshoot: assert the documented safe reconstruction policy and
   never index a rail array with native `-1`.
9. Prove a horizontal move requires `abs(dx) > abs(dy)`.
10. Prove flick length `1.0` is rejected and a value strictly above `1.0` is accepted.
11. Prove a drag plus terminal flick can both affect one gesture.
12. Prove endpoint flicks do not wrap.
13. Prove pressed frames do not snap.
14. Prove far snap uses `0.1*d + sign(d)` with binary32 checkpoints and near snap closes exactly.
15. Prove `dt` changes do not alter one-frame movement.

### Scene/resource tests

1. Validate all profile-relative paths, dimensions, byte counts, and SHA-256 values above.
2. Validate all PNG imports resolve to `/spriteFrame`.
3. Validate `Andyb.ttf` is used only for the player labels in this screen and
   `Century.ttf` for scores.
4. Validate exact text, sizes, positions, colors, z values, and score anchors in both profiles.
5. Validate the high GN/Crazy Bird headers use height `138`; the other high headers use `137`.
6. Validate title start/end positions and absence of fade.
7. Validate simultaneous back translation/rotation and the high selected-image width `181`.
8. Validate card tap does nothing and no dots/selection visual is created.

### Lifecycle/audio/platform tests

1. Enter through ID `13`; assert one `mangosteen.wav`, cut disable, state `2`, and one
   `0.75`-second transition.
2. Assert Main Menu is removed with cleanup, persistent roots survive, and the leaderboard
   attaches before background music is stopped.
3. Return by visual back and hardware back; assert identical replacement behavior.
4. Assert returned Main Menu music starts when enabled and one effects-gated back click fires.
5. Assert drag, flick, snap, and item changes produce no sound.
6. Assert leaderboard entry/back performs no settings write.
7. Run the screen with network unavailable and no platform-services fixture; assert all six
   local boards remain browsable.
8. Assert no particle/emitter node is owned by the leaderboard.

An original-device pixel comparison, font raster comparison, and touch trace remain desirable
if lawful execution evidence ever becomes available. They are validation enhancements, not a
reason to invent behavior now.

## Recovered, inferred, and unknown ledger

### Recovered

- exact six-item order and direct header-raster consumers;
- all 18 process globals and preference keys;
- clean default `0` and decimal `%d` display;
- exact fonts, sizes, text, colors, score anchors, row formulas, z values, and child order;
- low/high asset bytes, dimensions, and hashes;
- title and back entrance actions;
- rail geometry, drag bounds, closest-index tie behavior, flick bounds, and frame snap;
- Main Menu entry delay/source sound/music-stop ordering;
- back replacement/click ordering;
- absence of leaderboard network, JNI, particle, RNG, and save calls.

### Inferred

- default center anchors for native sprites/player labels where the app makes no setter call;
- equal-z stable draw order from the matching Cocos2d-x engine behavior;
- retaining a valid index instead of reproducing native undefined access after pathological
  whole-segment overshoot;
- recommended immutable-snapshot/presenter/component boundaries;
- Creator import behavior as the restoration equivalent of original native path loading.

### Unknown

- exact original GPU/font raster output and device-specific crop on every supported Android
  frame/aspect ratio;
- whether the original engine delivered a distinct touch-cancel path not referenced by the
  leaderboard callbacks;
- original runtime timing under dropped/variable frames beyond the recovered frame-based
  update formula;
- external product intent for negative/corrupt leaderboard values, although `%d` rendering is
  settled;
- art/font/music naming and redistribution rights.

## Unresolved questions

No unresolved functional question blocks a static leaderboard recreation. If original-runtime
evidence becomes legally available, compare raster output, device crop, and touch-cancel
behavior; otherwise preserve the explicit inferred defaults above.

Status: DONE
Summary: Recovered the complete six-mode local leaderboard consumer, keys, exact dual-profile visual contract, gesture/navigation state machine, transition/audio ownership, persistence boundary, and offline/platform exclusions.
Concerns/Blockers: No functional blocker; exact original GPU/font raster output, non-reference-aspect crop, touch-cancel delivery, and asset rights remain unknown.

---
date: 2026-07-24
status: done
scope: Objectives screen resource closure and native presentation contract
evidence_policy: static-only; original APK and native code were never executed
---

# Objectives Screen Static Resource and Presentation Map

## Summary

The staged `Objectives/` corpus is a global subsystem closure, not one screen
closure. `ObjectivesLayer::onEnter()` and `ObjectiveItem` directly require eight
of its eleven logical rasters:

```text
Objectives/button-skip-selected.png
Objectives/button-skip.png
Objectives/objectives-active.png
Objectives/objectives-background.png
Objectives/objectives-inactive.png
Objectives/objectives-next-background.png
Objectives/objectives-next.png
Objectives/objectives-objectives-background.png
```

The screen also directly requires:

```text
Buttons/button-blue-back-normal.png
Buttons/button-back-selected.png
Fonts/Arial.ttf
Sounds/menubuttonclick.wav
```

The other three staged `Objectives/` rasters are real, but belong to already
separate flows:

- `objectives_message.png` and `next_objectives_message.png`: achievement
  popups.
- `objectives-pause-background.png`: gameplay pause objective card.

The Objective screen itself is not implemented in the current Creator
presentation/resource layer. The existing `ObjectivesManagerState` recovers the
52-entry semantic data and skip transition, while the current base-gameplay
resource/presenter code intentionally covers only achievement and pause
subsets.

All claims below are **recovered** from static bodies/resources unless marked
**inferred** or **unknown**.

## Evidence and confidence

### Immutable inputs

| Evidence | Identity |
|---|---|
| Native library | `.forensics-work/phase-01/native/libgame.so` |
| Native SHA-256 | `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e` |
| Native bytes | `4,734,880` |
| Native profile | ELF32 little-endian ARM EABI5, Thumb |
| Staged raster corpus | `game/assets/game/{480x800,720x1280}/Objectives/` |
| Staging catalog | `assets/catalog/creator-staging-manifest.json` |
| Native symbol inventory | `forensics/native/function-map.csv` |
| Existing objective semantics | `game/assets/scripts/domain/objectives-manager-state.ts` |
| Existing constrained resource contract | `game/assets/scripts/domain/base-gameplay-resource-contract.ts` |
| Existing popup presentation | `game/assets/scripts/domain/objective-achievement-presentation.ts`, `game/assets/scripts/creator/objective-achievement-presenter.ts` |

GNU ARM objdump 2.27 and LLVM objdump 19, both in Thumb mode, agree on the
covered instruction streams. Text virtual addresses equal file offsets.
Raster dimensions were read from immutable PNG headers; hashes and byte counts
were checked against both staged files and the manifest.

### Evidence status

| Claim family | Status | Confidence |
|---|---|---:|
| Paired paths, bytes, dimensions, hashes, logical aliases | recovered | 1.00 |
| Native resource consumers and unattached probes | recovered | 0.99 |
| Hierarchy, coordinates, f32 constants, colors, actions | recovered | 0.99 |
| Objective order/text/reward indexing | recovered | 0.99 |
| Creator implementation gap | recovered from repository inspection | 0.99 |
| Pixel-identical Creator font rendering | unknown until compatibility validation | — |

No APK, emulator, JNI bridge, translation layer, or native executable was run.

## Resolution-profile aliases and import policy

Native code names resources below the active search root, for example
`Objectives/objectives-active.png`. The recovered bootstrap chooses the
`480x800/` tree when physical frame width is below `720`, otherwise
`720x1280/`; it then uses the corresponding `480 x 800` or `720 x 1280`
design resolution, policy argument `2`, and content scale `1.0`.

The staging manifest gives each compact/high pair one logical alias:

```text
480x800/Objectives/objectives-active.png
720x1280/Objectives/objectives-active.png
    -> image:Objectives/objectives-active
```

The same rule applies to every paired raster below, including the shared Back
button pair. Profile aliases select exact source files; they do not authorize
resizing or substitution.

Every listed raster is `cc.ImageAsset` with
`mode=exact-source-byte-copy`. Decode/re-encode, resize, trim, alpha
modification, and substitution are forbidden. The manifest snapshot records
`rightsStatus=unresolved`, `consumerStatus=unmapped`, and Creator metadata/UUID
status `pending`; staged `.meta` files now being present does not retroactively
change those catalog fields.

## Exact staged `Objectives/` corpus

Each profile cell is `(width x height; bytes; SHA-256)`.

| Logical path / direct owner | `480x800` exact file | `720x1280` exact file |
|---|---|---|
| `Objectives/button-skip-selected.png` — screen | `149x110`; `4,035`; `4a24cf6a0db35c8d5114f3e5d5e69bb95bdb33afaca9554c797950ef77c39df2` | `189x129`; `7,056`; `8c411809d1f3ae4c219bf4113bb7f4935e23e42982778953232fd235017ab2ed` |
| `Objectives/button-skip.png` — screen | `149x110`; `6,284`; `de05d83e008a1b8d7eb8ab99d2309741fe9145ae5e658e3b8d25bf023d4c111f` | `189x129`; `11,510`; `071e74023f0004e9473db1d059e300055960b90eb31bb71d09136d5889b3a5a3` |
| `Objectives/next_objectives_message.png` — achievement popup | `552x132`; `36,482`; `627ec979556cf5ff9b6b1dcd8f52d4904b7dd095f09235b9ebf88aff356b2174` | `792x180`; `61,617`; `dec3896378976676b9a0850d7c9a56cb9fdceda3528fe85916ca5ae88b1d2384` |
| `Objectives/objectives-active.png` — screen row | `375x81`; `6,430`; `1d8431889001d991834046ae2ed32d644e883f32361acc0d3ededf27c1bd8a3c` | `563x122`; `11,070`; `61b86b3011c6bfb0638dd61351e601cd94031feea2fa5c0d4a1c0c75b1f8adfd` |
| `Objectives/objectives-background.png` — screen background | `496x872`; `4,907`; `91df698b7f6c27cfc3b4b221596c20302ea28f98aa96896787a848a8d5f87dd6` | `752x1352`; `8,235`; `08eac19740445e86c5cd5214c97ef4d040653a0b833b652692441c5da75f6a22` |
| `Objectives/objectives-inactive.png` — screen row | `375x81`; `4,535`; `f4dd59d8e1ab3390a0a27abc81e4dfd6fafef299dbf914f0eafd361c86bc7e89` | `563x122`; `7,624`; `5d5038952e6b367eaa3676ceaa8ec8e1b4bcca27e20d8256e64ef30a6132d495` |
| `Objectives/objectives-next-background.png` — screen footer | `420x240`; `9,415`; `82e4aaaed62fb74018efb45e386593db603083abfb365663f5c39f46d10668e9` | `672x384`; `17,008`; `14583a400588fc509e43bc00c821bfc4118f3760442acd3cbb3cced454a83d2b` |
| `Objectives/objectives-next.png` — screen fixed-current row | `375x81`; `4,732`; `5160323b9aee164aa5f2052f3b1ada8f6af7a8165823a97173dbc1fcb13a3a90` | `563x122`; `7,772`; `190cf0426687217ded8dc79847e3b8ee380ea3c6936c34b59caebf620a6ae798` |
| `Objectives/objectives-objectives-background.png` — screen header | `420x150`; `13,534`; `3defe3ebf50d68c62612e7e77096d704c086a69cd37fd6efdad75ea8648a741d` | `672x240`; `23,926`; `0ff94e730b8854d0c499afcf18d4ba1911621b2fd582c8a10630cd1143899c5e` |
| `Objectives/objectives-pause-background.png` — pause card | `552x206`; `51,762`; `eecd45a1fd6cb445049ef03a7c1c00916dc4b476a6e8416a33ee4f6e405eb28a` | `792x291`; `90,608`; `a6a5e9521b14664942d1df259b0028dd9035706d967b7d892db363d9ef1c4800` |
| `Objectives/objectives_message.png` — achievement popup | `552x138`; `45,107`; `98e2e5be34f722ccc0b596e165c0e57ca4c2f455de3b241c3ef652be43e89ba2` | `792x181`; `75,966`; `fbc6cd76fff4d9e0a14f66f05b539e92a69a3b4751141a08747d773511b6a741` |

Both header/footer backgrounds are 8-bit RGB PNGs without alpha. The other
nine `Objectives/` files in both profiles are 8-bit RGBA PNGs with alpha.

`Objectives/objectives-next.png` and
`Objectives/next_objectives_message.png` are distinct files, dimensions, hashes,
and native consumers. They are not aliases or valid substitutes.

## Shared screen dependencies outside `Objectives/`

### Back button rasters

| Logical path | `480x800` exact file | `720x1280` exact file |
|---|---|---|
| `Buttons/button-blue-back-normal.png` | `144x124`; `7,691`; `a978ec6a5f7ee20f54c077bd13f94177e233dbb9cded18af239896e4a87066ef` | `180x150`; `12,033`; `451a19fde28ef07ce3df1991ab2adfb24e65a19279c0e59860ec5c6a67a9dbec` |
| `Buttons/button-back-selected.png` | `144x124`; `6,304`; `15afb10b1f0c49731a30ae9c1e1b1def410c55b4f9101e95b8ff6d4b190a8641` | `181x150`; `9,445`; `1b2bffab9db409a92ad97b8fae0a9d866fc6baaf49698e3ab97a38d5826d26ab` |

The high selected Back frame is one pixel wider than its normal frame. The
archived Cocos engine's `CCMenuItemSprite::setNormalImage()` sets menu-item
content size from the normal node (`0x001BD2E8..0x001BD35C`), so Back layout
uses `180x150` in the high profile while the selected visual may extend one
pixel.

### Font and audio

| Resource | Logical ID / type | Exact identity | Native use |
|---|---|---|---|
| `Fonts/Arial.ttf` | `font:Fonts/Arial`; `cc.TTFFont` | `755,624` bytes; `b97a1e2bb9fedbf9aa99f6b14ef5a7f057c6611dd71698381cc44f77797a4223`; TrueType Arial Regular | both ObjectiveItem labels |
| `Sounds/menubuttonclick.wav` | `audio:Sounds/menubuttonclick`; `cc.AudioClip` | `32,812` bytes; `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e`; PCM stereo, 44,100 Hz, signed 16-bit, `0.185760 s`, `32,768` audio-data bytes | touch Back and Skip, non-looping, effects-enabled only |

Font rewrite/subsetting/substitution and audio
transcode/resample/channel-remap/substitution are forbidden by the exact-copy
manifest policy.

## Native function coverage

| Function | Normalized Thumb range | Recovered role |
|---|---:|---|
| `ObjectiveItem::UpdateText()` | `0x0015D16C..0x0015D208` | description and reward strings |
| `ObjectiveItem::UpdateBackground()` | `0x0015D208..0x0015D264` | active/inactive texture swap |
| `ObjectiveItem::updatePosition()` | `0x0015D264..0x0015D35C` | background and label coordinates |
| `ObjectiveItem::Move(float,float)` | `0x0015D36E..0x0015D392` | shared row translation |
| `ObjectiveItem::onEnter()` | `0x0015D394..0x0015D580` | row hierarchy, font, colors |
| `ObjectivesLayer::backCallback()` | `0x0015D6EC..0x0015D758` | click sound and Main Menu transition |
| `ObjectivesLayer::UpdateCurrentIdx()` | `0x0015D82C..0x0015D8BA` | nearest translated row |
| `ObjectivesLayer::CanMoveBottom()` | `0x0015D8BA..0x0015D8E2` | first-row boundary |
| `ObjectivesLayer::CanMoveTop()` | `0x0015D8E2..0x0015D916` | last-row boundary |
| `ObjectivesLayer::ccVerticleDrag()` | `0x0015D916..0x0015D990` | vertical list motion |
| `ObjectivesLayer::skipCakkback()` | `0x0015D990..0x0015DA04` | skip sound/state/local refresh |
| `ObjectivesLayer::onEnter()` | `0x0015DAFC..0x0015DFB0` | complete screen construction |

The two callback spellings `ccVerticleDrag` and `skipCakkback` are recovered
native symbol spellings, not corrected API names.

## ObjectiveItem contract

### Data and hierarchy

An item stores:

| Native offset | Role |
|---:|---|
| `+0xE4` | background sprite |
| `+0xE8` | optional custom background sprite |
| `+0xEC` | description label |
| `+0xF0` | reward label |
| `+0xF4` | sequence slot |
| `+0xF8` | logical item point `(x,y)` |

`ObjectiveItem::onEnter()` adds, in order, the background, description label,
and reward label to the item, each at z-order `1`. The item node itself is then
added by `ObjectivesLayer` at z-order `1`.

For an ordinary row:

```text
objectiveId = OBJECTIVE_ORDER[sequenceSlot]
background =
  isFinished(objectiveId)
    ? Objectives/objectives-active.png
    : Objectives/objectives-inactive.png
```

The separate fixed-current item receives an
`Objectives/objectives-next.png` custom sprite before it enters; that custom
sprite overrides the active/inactive selection.

`Achi_IsLose()` exists but is not called by these construction/background
paths. No distinct lost-row visual or color is recovered.

### Text sources

The exact 52-slot order used by the screen matches the current
`OBJECTIVE_ORDER`:

```text
[0,27,8,1,18,9,28,2,50,10,3,19,42,46,32,48,20,4,21,29,11,5,22,33,
 51,34,23,12,24,36,13,25,37,38,14,41,26,15,35,47,6,30,40,49,45,39,
 31,16,43,44,7,17]
```

For sequence slot `s`:

```text
description = OBJECTIVE_DESCRIPTIONS[OBJECTIVE_ORDER[s]]
reward      = sprintf("reward: %d coins", OBJECTIVE_REWARDS[s])
```

Rewards are indexed by sequence slot, not objective ID. The native description
bytes include the historical spelling mistakes already preserved in
`objectives-manager-state.ts`.

### Font, anchor, coordinates, and colors

Let:

- `W` be `CCDirector::getWinSize().width`;
- `p=(px,py)` be the item's stored point;
- `bw,bh` be the selected row background's content size.

Both labels use `Fonts/Arial.ttf`, anchor `(0,0.5)`, and these exact formulas:

| Label | Font size | Position |
|---|---:|---|
| Description | `18 * W / 400` | `(px - bw / 3.5, py + 0.25bh)` |
| Reward | `20 * W / 400` | `(px - 0.125bw, py - 0.25bh)` |

Relevant f32 literals are `18=0x41900000`, `20=0x41A00000`,
`400=0x43C80000`, `3.5=0x40600000`, `0.25=0x3E800000`,
and `0.125=0x3E000000`.

The active, inactive, and next row rasters have identical dimensions within
each profile, so the raw profile projections are:

| Profile | Description offset from `p` | Reward offset from `p` | Description / reward font |
|---|---:|---:|---:|
| `480x800` (`375x81` row) | `(-107.142857..., +20.25)` | `(-46.875, -20.25)` | `21.6 / 24` |
| `720x1280` (`563x122` row) | `(-160.857142..., +30.5)` | `(-70.375, -30.5)` | `32.4 / 36` |

Colors are explicit `ccColor3B` bytes:

| Finish state | Description | Reward |
|---|---|---|
| finished | RGB `(41,171,226)` / `#29ABE2` | RGB `(252,238,33)` / `#FCEE21` |
| unfinished | RGB `(179,179,179)` / `#B3B3B3` | RGB `(255,255,255)` / `#FFFFFF` |

`UpdateBackground()` changes only the ordinary row sprite texture. It does not
recompute either label color.

## ObjectivesLayer hierarchy and construction

### Equal-z insertion order

`ObjectivesLayer::onEnter()` constructs these visible descendants:

1. centered `objectives-background` sprite; `FadeIn(1.0)`;
2. 52 ordinary `ObjectiveItem` children, sequence slots `0..51`;
3. top `objectives-objectives-background` sprite; `FadeIn(1.0)`;
4. bottom `objectives-next-background` sprite; `FadeIn(1.0)`;
5. fixed-current `ObjectiveItem` using `objectives-next`;
6. zero-position `CCMenu` containing Back then Skip.

Every direct layer child is added at z-order `1`. Equal-z insertion order is
therefore fidelity-significant. Each ObjectiveItem's three children are also
equal-z `1` in background -> description -> reward insertion order.

No clip node, stencil, scissor call, or mask is constructed in the covered
range.

### Probe-only instances versus visible instances

Three logical rasters are created twice for different purposes:

| Raster | First instance | Later visible instance |
|---|---|---|
| `objectives-next.png` | `0x0015DB4E..0x0015DB68`: unattached `getContentSize()` probe; row height drives spacing and bounds | `0x0015DDA8..0x0015DDB6`: independent sprite assigned to the fixed-current ObjectiveItem |
| `objectives-objectives-background.png` | `0x0015DB72..0x0015DB8E`: unattached height probe for the top list bound | `0x0015DC96..0x0015DD02`: independent top sprite, positioned, faded, and attached |
| `objectives-next-background.png` | `0x0015DBB2..0x0015DBCC`: unattached height probe for the bottom list bound | `0x0015DD04..0x0015DD70`: independent bottom sprite, positioned, faded, and attached |

Thus `objectives-objectives-background` and
`objectives-next-background` are not “probe instead of UI” resources. Each has
one probe-only instance and a second attached visible instance. A Creator port
need not allocate throwaway nodes, but its layout must read the exact same
resource dimensions before producing the same bounds.

## Exact layout and list bounds

Define:

- `W,H`: `CCDirector::getWinSize()`;
- `C=(Cx,Cy)`: `VisibleRect::center()`;
- `Ty,By`: `VisibleRect::top().y`, `VisibleRect::bottom().y`;
- `Lx,Rx`: `VisibleRect::left().x`, `VisibleRect::right().x`;
- `rh`: `objectives-next` content height;
- `hh`: `objectives-objectives-background` content height;
- `fh`: `objectives-next-background` content height;
- `q`: `Settings::CurrentObjective`, a sequence position.

### Static roots

```text
screen background = C
header            = (Cx, Ty - 0.5hh)
footer            = (Cx, By + 0.5fh)
fixed current row = (0.5W, 0.15H)
```

The `0.15` literal is f32 `0x3E19999A`. The fixed row and footer intentionally
share the same center in canonical full-design rectangles:

```text
480x800:  footer center = fixed row = (240,120)
720x1280: footer center = fixed row = (360,192)
```

### Scroll bounds and row positions

```text
topBound    = Ty - f32[0x3F8CCCCD] * hh - 0.5rh
bottomBound = By + f32[0x3F866666] * fh + 0.5rh
spacing     = 1.25rh

base        = (Cx, topBound + q * spacing)
item[i]     = (base.x, base.y - i * spacing), i=0..51
```

The decimal readings of the two non-exact literals are approximately `1.10`
and `1.05`; the hexadecimal binary32 values above are normative. At index
`i=q`, the active sequence row begins on `topBound`.

For canonical full-design rectangles with staged raster pixels exposed at
content scale `1.0`, the profile arithmetic is:

| Profile | `topBound` | `bottomBound` | `spacing` |
|---|---:|---:|---:|
| `480x800` | approximately `594.5` | approximately `292.5` | `101.25` |
| `720x1280` | approximately `955.0` | approximately `464.2` | `152.5` |

Runtime code must retain the formulas in terms of `VisibleRect` and resource
content sizes; these projected numbers are not replacements for visible-rect
handling on differently shaped physical frames.

### Drag and guard behavior

`ccVerticleDrag()` first delegates to `CCGesturesLayer`, reads its delta, and
uses:

```text
moveY = -delta.y
```

For finite ordinary values the native sign-bit operation is equivalent to that
negation.

- If `moveY > 0`, movement is allowed only when the last row's y coordinate is
  `<= topBound`.
- If `moveY < 0`, movement is allowed only when the first row's y coordinate
  is `>= bottomBound`.
- If allowed, every one of the 52 ordinary rows receives `Move(0,moveY)`.
- The fixed-current row, header, footer, background, and buttons do not move.
- The guard is checked before applying the full delta, so a single delta may
  overshoot a bound; no clamp is present in this method.

After each drag call, `UpdateCurrentIdx()` scans the rows and selects the one
with the smallest absolute y distance from the stored initial base y, provided
the distance is below `H`. Its initial result is `-1` if no row qualifies. No
inertia, snap tween, or per-row easing is present in the recovered layer body.

## Button layout, timing, audio, and transitions

Let `bw,bh` be the Back menu item's content size (set from the normal Back
image), and `sw,sh` the Skip item size.

### Back item

```text
initial = (Lx - 0.5bw, By + bh / 2.5)
actions started concurrently:
  RotateBy(1.0, 360 degrees)
  MoveBy(1.0, (f32[0x3F866666] * bw, 0))
```

Its approximate final x is `Lx + 0.55bw`. The recovered literals are
`1.0=0x3F800000`, `360=0x43B40000`, and `2.5=0x40200000`.

Canonical profile projections:

| Profile / normal size | Initial | Approximate final |
|---|---:|---:|
| `480x800`, `144x124` | `(-72,49.6)` | `(79.2,49.6)` |
| `720x1280`, `180x150` | `(-90,60)` | `(99,60)` |

Touch Back:

1. requests non-looping `Sounds/menubuttonclick.wav` if effects are enabled;
2. stops this layer's actions;
3. removes the layer from its scene;
4. creates and adds `MainMenuLayer` at z-order `1`.

Hardware `keyBackClicked()` performs the same navigation but does not request
the click effect.

### Skip item

```text
initial = (Rx + 0.5sw, 0.05H)
target  = (Rx - 0.75sw, same y)
action  = MoveTo(1.0, target)
```

The x target is produced as `Rx - (1.5 * 0.5 * sw)`. The `0.05` literal is f32
`0x3D4CCCCD`.

Canonical profile projections:

| Profile / normal size | Initial | Final |
|---|---:|---:|
| `480x800`, `149x110` | `(554.5,40)` | `(368.25,40)` |
| `720x1280`, `189x129` | `(814.5,64)` | `(578.25,64)` |

Touch Skip:

1. requests the same non-looping click when effects are enabled;
2. if current sequence position is `<= 51`, calls
   `ObjectivesManager::Achi_Skip(OBJECTIVE_ORDER[current])`;
3. changes the fixed-current item's sequence slot to the advanced current
   position and refreshes its two strings;
4. refreshes the ordinary row at `max(current-1,0)` from inactive to the
   finished texture when appropriate.

Back and Skip are inserted into one `CCMenu` in that order. The menu position
is `CCPointZero`; the menu is then added to the layer at z-order `1`.

## Reconciliation with current Creator code

### Correctly implemented constrained subsets

| Current artifact | Proven scope | Relationship to this report |
|---|---|---|
| `objectives-manager-state.ts` and test | 52 order/descriptions/targets/rewards, storage, finish/skip semantics | semantic source can be reused by a future screen state |
| `base-gameplay-resource-contract.ts` and loader/test | `objectives_message`, `next_objectives_message`, `objectives-pause-background`, Arial, popup particles, pause controls | intentionally not an ObjectivesLayer screen closure |
| `objective-achievement-presentation.ts` / presenter/tests | completed/next popup labels, particles, `0.5/1/0.5` and delayed next-banner choreography | separate presentation; must not be projected onto ObjectivesLayer |
| base-gameplay pause state/presenter/tests | pause objective card | separate consumer of `objectives-pause-background` |
| `classic-audio-contract.ts` and presenter/test | shared `menubuttonclick.wav` identity/load | exact audio bytes/path can be reused |

### Missing screen surface

Repository search found no dedicated Objectives screen resource contract,
loader, presentation state, Creator presenter/controller, or screen-specific
tests. In particular, the current base-gameplay resource contract does not
load:

```text
button-skip-selected
button-skip
objectives-active
objectives-background
objectives-inactive
objectives-next-background
objectives-next
objectives-objectives-background
```

That is not a defect in the base-gameplay contract; it is evidence that the
separate screen closure remains unimplemented.

### Recommended implementation boundary

1. Add a dedicated Objectives screen resource contract containing exactly the
   eight screen-owned `Objectives/` pairs, two shared Back pairs, Arial, and
   the shared menu-click clip.
2. Keep the three popup/pause rasters in their present consumers; do not load
   them into the screen merely because they share a directory.
3. Implement an engine-independent presentation state for the 52 row points,
   bounds, fixed row, drag guard, nearest-index scan, and one-second ingress
   actions.
4. Reuse `ObjectivesManagerState` for sequence/data/skip behavior. Preserve
   slot-vs-ID indexing.
5. Build a Creator presenter with the recovered equal-z insertion order and
   explicit same-z sibling order.
6. Test both profiles for exact resource identities, label formulas/colors,
   list bounds/spacing, boundary overshoot behavior, probe-derived dimensions,
   Back/Skip ingress, effects gating, and hardware-Back silence.

## Unresolved questions

- Static evidence fixes the TTF bytes, sizes, colors, and anchors, but does not
  prove pixel-identical glyph rasterization/kerning between legacy
  `CCLabelTTF` and Creator. Compatibility screenshots remain a validation task,
  not a reason to substitute the font.
- The covered layer contains no clipping construct. Whether a clean Creator
  port should deliberately preserve unrestricted row drawing or add a
  fidelity-neutral mask requires visual validation; a mask cannot be claimed
  as recovered.
- The native gesture base implementation supplies touch deltas. This report
  recovers all ObjectivesLayer list response logic, but not a product-level
  decision about adapting physical touch units in Creator.
- Rights remain unresolved in the staging manifest.

Status: DONE

Summary: Exact compact/high resource closure, hashes, aliases, ObjectiveItem
typography/colors, ObjectivesLayer hierarchy/bounds/motion, probe semantics,
audio, and current implementation gaps are statically recovered.

Concerns/Blockers: No research blocker. Creator font-rendering compatibility,
mask policy, and asset rights remain explicit validation/product questions.

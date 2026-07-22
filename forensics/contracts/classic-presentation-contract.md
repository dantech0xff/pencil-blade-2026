# Classic Presentation Contract

Status: bounded recovery complete, static evidence only; shared-root dispatch corrected by
exact vtable resolution on 2026-07-23

This contract defines the minimum Classic-mode presentation needed for a clean-room Cocos
Creator 3.8 implementation. It covers resource selection, logical layout, anchors, z-order,
start gating, active-gameplay HUD, failure feedback, bomb feedback, terminal presentation,
result-screen handoff, result particles/reward, and the directly recovered audio order. It does
not authorize copying the original assets; asset rights remain unknown.

The APK and native library were never installed, loaded, linked, or executed. All claims are
from static resource metadata and static ARM/Thumb analysis. Native addresses below are
normalized image virtual addresses.

## Evidence and notation

| Handle | Evidence | Static support |
|---|---|---|
| `E-APK` | `SRC-APK-001` | immutable source APK |
| `E-NATIVE` | `DER-NATIVE-001` | extracted immutable `libgame.so` and its hash |
| `E-CORPUS` | `DER-NATIVE-CORPUS-001` | recorded GNU/LLVM versions, commands, strings, and representative disassembly |
| `E-FUNCS` | `DER-FUNCMAP-001` | allowlisted application function names, ranges, and sizes |
| `E-RES` | `DER-RESMAP-001` | `forensics/resources/resource-usage-map.json`, derived from `DER-WORK-001` and `DER-NATIVE-001`, including paired-tree PNG metadata, shared fonts/sounds, and native string matches |
| `E-BOOT` | `E-NATIVE`, `0x00141F50` | `AppDelegate::applicationDidFinishLaunching` resolution/tree selection |
| `E-BG` | `E-NATIVE`, `0x001421C8` | `BackgroundLayer::onEnter` |
| `E-GAME-SCENE` | `E-NATIVE`, `0x00151536` | `GameScene::onEnter` root layer order |
| `E-SELECT` | `E-NATIVE`, `0x0015BCAC`, `0x0015C08C` | mode-selected audio, delay, removal, and Classic insertion |
| `E-CLASSIC` | `E-NATIVE`, `0x00148B30`, `0x00148CDC` | Classic start callback and `onEnter` start gate |
| `E-HUD` | `E-NATIVE`, `0x001624F0` | `ScoreManager::onEnter` HUD creation |
| `E-FAIL` | `E-NATIVE`, `0x0014FC70`, `0x00151184`, `0x001512C4` | transient and persistent fail presentation |
| `E-BOMB` | `E-NATIVE`, `0x00145538`-`0x001465DC`, `0x00148C20`, `0x00149484` | bomb creation/cut, procedural explosion, Classic hit/finish callbacks |
| `E-GAME-OVER` | `E-NATIVE`, `0x00149204`, `0x001493F8` | terminal text timeline and score-screen replacement |
| `E-RESULT` | `E-NATIVE`, `0x0014CD2C`, `0x0014D034`, `0x0014D0D0` | result layout, rank update, and rank audio |
| `E-RESULT-NAV` | `E-NATIVE`, `0x0014CBB0`, `0x0014CC84` | `DisplayScoreLayer` Retry and Main Menu callbacks |
| `E-SETTINGS` | `E-NATIVE`, `0x00163620`, `0x00163094` | Classic-relevant Settings load/save order |
| `E-RESULT-REWARD` | `E-NATIVE`, `0x0014DADC` | `DisplayScoreLayer::TotalCoinsCallback` reward creation/accounting order |
| `E-RESULT-PARTICLE` | `E-NATIVE`, `0x0015FD0C`, `0x0015FD28`, `0x0015FE34`, `0x0015FED8`, `0x0015FF30` | `ParticleExplosion` cleanup, burst, entry timeline, construction, and creation |

The targeted presentation ranges were regenerated from `E-NATIVE` with GNU ARM binutils
2.27 and LLVM 19.0.1 forced to Thumbv5TE. The tools agree on the representative instruction
streams, call order, branch direction, and constants used here. These extra ranges are
reviewer-reproducible, but are not claimed to be part of the four archived sample slices in
`E-CORPUS`.

Definitions:

- `W`, `H`: `CCDirector::getWinSize()` logical width and height.
- `L`, `R`, `T`, `B`, `C`: `VisibleRect.left`, `right`, `top`, `bottom`, and `center`.
- `w(asset)`, `h(asset)`: selected sprite content width and height in logical coordinates.
- `f32[bits]`: the IEEE-754 float32 value represented by the hexadecimal bit pattern.
- `recovered`: directly supported by static code/resource evidence.
- `inferred`: required interpretation supported by engine defaults or structure, but not an
  explicit setter/call in the recovered range.
- `unknown`: not safely determined by the current static evidence.

This contract never uses physical display pixels. Raster dimensions below identify variant
files; they are not runtime positions and must not be substituted for `W`, `H`, or the visible
rectangle.

## Resolution and asset-tree selection

The bootstrap contract is recovered from `E-BOOT`:

| Physical-frame-width test | Search path added | Design resolution | Legacy policy argument |
|---|---|---:|---:|
| `frameWidth >= 720` | `720x1280` | `720 x 1280` | `2` |
| `frameWidth < 720` | `480x800` | `480 x 800` | `2` |

The content scale factor is then set to `1.0`. The numeric policy value `2` is recovered; its
source enum spelling is not required by this contract. Creator must reproduce the resulting
logical/visible-rectangle behavior, not blindly feed physical pixels into gameplay layout.

The branch constant and design sizes are initialized statically beside the strings
`720x1280` and `480x800`; this establishes the exact threshold-to-tree mapping. A high-tree
image may be `721` pixels wide or `1281` pixels tall, so neither tree is a promise that every
texture exactly equals the design resolution.

## Asset contract

### Background family

`BackgroundLayer` formats `Backgrounds/paperbackground%d.png`. All recovered paired files
are listed because the selected setting/index is not hard-coded in the layer itself.

| Logical asset | `480x800` raster | `720x1280` raster | Direct Classic-screen status |
|---|---:|---:|---|
| `Backgrounds/paperbackground0.png` | `480x800` | `720x1280` | formatted family member |
| `Backgrounds/paperbackground1.png` | `480x800` | `721x1281` | formatted family member |
| `Backgrounds/paperbackground2.png` | `480x800` | `720x1280` | formatted family member |
| `Backgrounds/paperbackground3.png` | `480x802` | `720x1280` | formatted family member |
| `Backgrounds/paperbackground4.png` | `481x801` | `721x1281` | formatted family member |
| `Backgrounds/paperbackground5.png` | `480x800` | `720x1280` | formatted family member |
| `Backgrounds/paperbackground6.png` | `480x800` | `721x1280` | formatted family member |
| `Backgrounds/paperbackground7.png` | `480x801` | `720x1281` | formatted family member |
| `Backgrounds/paperbackground8.png` | `481x800` | `721x1281` | formatted family member |

### Start, gameplay, fail, bomb, and terminal assets

| Logical asset | `480x800` raster | `720x1280` raster | Use |
|---|---:|---:|---|
| `Text/text-good.png` | `112x25` | `168x37` | Classic start gate, upper track |
| `Text/text-luck.png` | `112x33` | `168x50` | Classic start gate, lower track |
| `Interfaces/object-score-sprite.png` | `55x55` | `82x82` | live score icon |
| `Interfaces/object-score-best-cup.png` | `49x52` | `73x77` | best-score cup |
| `Interfaces/object-score-double.png` | `134x115` | `200x172` | double-score panel |
| `Interfaces/object-x-normal.png` | `49x48` | `72x71` | unfilled persistent strike marker |
| `Interfaces/object-x-filled.png` | `49x48` | `73x73` | filled/transient strike marker |
| `Buttons/button-pause-normal.png` | `38x38` | `57x57` | shared gameplay pause button |
| `Buttons/button-pause-selected.png` | `38x38` | `57x57` | selected pause state |
| `Bomb/bomb_X.png` | `80x108` | `121x161` | bomb ID `0` |
| `Bomb/bomb_10.png` | `79x105` | `118x158` | bomb ID `1` |
| `Text/text-game.png` | `269x51` | `404x76` | terminal upper track |
| `Text/text-over.png` | `216x85` | `324x126` | terminal lower track |

`Fonts/Linds.ttf` is shared by the live score labels. It exists once in the shared resource
set rather than once per resolution tree.

### Result-screen assets reached from Classic

| Logical asset | `480x800` raster | `720x1280` raster | Recovered use |
|---|---:|---:|---|
| `Interfaces/object-display-score-background.png` | `442x407` | `662x610` | score panel |
| `Interfaces/object-mode-results.png` | `552x118` | `792x159` | result header |
| `Interfaces/object-medal-none.png` | `104x209` | `154x314` | animated medal placeholder |
| `Buttons/button-retry-normal.png` | `111x105` | `167x158` | retry normal state |
| `Buttons/button-retry-selected.png` | `112x105` | `167x158` | retry selected state |
| `Buttons/button-menu-score-normal.png` | `134x129` | `201x194` | menu normal state |
| `Buttons/button-menu-score-selected.png` | `134x129` | `200x193` | menu selected state |
| `Interfaces/total-coins.png` | `334x131` | `464x160` | total-coins panel |
| `Interfaces/object-bonus-particle.png` | `48x46` | `71x68` | result particle texture |
| `Interfaces/object-bonus-coins-effect.png` | `229x229` | `342x342` | rotating reward effect |
| `Interfaces/object-coin.png` | `34x34` | `50x49` | reward coin/root sprite |
| `Interfaces/object-bonus-coins.png` | `130x129` | `159x157` | reward badge child |

The result labels use shared `Fonts/AgencyB.ttf` and `Fonts/SlabThing.ttf`.

The paired files `Interfaces/object-medal-1st.png`, `object-medal-2nd.png`,
`object-medal-3rd.png`, and `object-new-best.png` exist, but their exact paths are not direct
native string references in the recovered result function. Their presence does not prove
that Classic displays them. Likewise, `Bomb/bombsmoke.png` exists but is not referenced by
the recovered normal Classic bomb-cut path. These files are availability evidence only and
are not minimum required presentation nodes.

## Scene, parent, and z-order contract

`GameScene::onEnter` assigns tags and adds these children in order:

| Child | tag | z-order |
|---|---:|---:|
| `BackgroundLayer` | `0` | `1` |
| `LeafLayer` | `1` | `1` |
| `ThemeLayer` | `2` | `1` |
| `MainMenuLayer` | `3` | `1` |

The values `0,1,2,3` are `CCNode::setTag` arguments, not child z-orders. Exact vtable
resolution maps child slot `+272` to `CCNode::setTag(int)` at `0x001A3DA6` and parent slot
`+200` to `CCNode::addChild(child,int)` at `0x001A455C`. All four roots therefore share z-order
`1`; their recovered draw relationship depends on the insertion order above.

`BackgroundLayer` places the selected paper sprite at `C`, queues `FadeIn(0.5)`, and adds it
at local z-order `1`. It does not call `CCLayer::onEnter`. `CCNode::runAction` at `0x001A52D8`
passes `!m_bRunning` to the action manager, and adding the sprite cannot enter it because the
overridden layer remains non-running. The nominal fade therefore stays paused with no effective
opacity change; the paper renders immediately at its default full opacity. Creator preserves
the effective opaque frame and does not animate this inert action. No explicit anchor setter is
present, so the center anchor is inferred from the legacy `CCSprite` default.

When Classic is selected, the mode selector is removed from its current parent with cleanup
enabled. A new Classic layer is added to that same parent at z-order `1`. Because the removed
Mode Select and every surviving shared root use equal z-order `1`, the replacement is appended
after the surviving roots and renders above them. This recovered same-parent replacement does
not require inventing a separate native scene.

Within Classic, all nine toss controllers, the fail manager, start sprites, dynamic tossed
objects, bomb explosion node, terminal text, and the shared HUD presentation use z-order `1`
at their respective parents. Equal z-order therefore retains insertion/sibling order as a
compatibility concern. The exact order of every base-gameplay child is not fully recovered;
Creator should assign explicit priorities for the relationships specified below and avoid
depending on incidental editor hierarchy order.

## Presentation state and ordering

### Mode selection into Classic

Recovered order from `E-SELECT`:

1. If effects are enabled, request `Sounds/gameplayselected.wav` once, non-looping.
2. Wait exactly `0.75` seconds.
3. Remove the mode-selection layer from its parent with cleanup.
4. Create Classic and add it to that same parent at z-order `1`.

The audio request occurs before the delay. Effects-disabled execution consumes no audio
request.

### Start/countdown gate

Classic has no recovered numeral countdown and no recovered `GO` sprite. Its recovered start
gate is the concurrent `GOOD`/`LUCK` motion below. Although `Text/text-go.png` exists in the
resource trees, its native literal belongs to a following `ComboBird` symbol group and has no
recovered reference from `ClassicModeLayer::onEnter`; it must not be added to Classic on that
basis.

| Node | Initial position | Action sequence | z |
|---|---|---|---:|
| `GOOD` (`text-good`) | `(L.x - 0.25W, 0.525H)` | `MoveTo(0.5, (0.5W, 0.525H))` -> `Delay(0.5)` -> `MoveTo(0.5, (R.x + 0.25W, 0.525H))` | `1` |
| `LUCK` (`text-luck`) | `(R.x + 0.25W, 0.475H)` | `MoveTo(0.5, (0.5W, 0.475H))` -> `Delay(0.5)` -> `MoveTo(0.5, (L.x - 0.25W, 0.475H))` -> `StartGameCallback` | `1` |

Both sequences start together. `StartGameCallback` is attached only to the end of `LUCK`, so
the nominal action sum before start is exactly `1.5` seconds. Cutting is already enabled
throughout the intro; the callback's `DisableCut(false)` only reasserts that existing state.
It then starts all nine toss controllers in the recovered Classic order. No direct audio call
occurs in Classic's start gate or start callback.

No anchor setter is present for either sprite. Anchor `(0.5, 0.5)` is an engine-default
inference, not a recovered setter; Creator must set it explicitly for deterministic layout.

### Active-gameplay HUD

The shared score manager constructs this Classic-visible HUD from `E-HUD`:

| Node | Anchor | Position / child position | Initial action | z |
|---|---|---|---|---:|
| score icon | inferred center | `(f32[0x3DA3D70A] * W, 0.95H)`, approximately `(0.08W, 0.95H)` | `FadeIn(1.0)` | `1` |
| best-score cup | inferred center | `(f32[0x3DA3D70A] * W, 0.875H)`, approximately `(0.08W, 0.875H)` | `FadeIn(1.0)` | `1` |
| double-score panel | inferred center | `(-0.5w(panel), 0.75H)`; shown position is `(0.5w(panel), 0.75H)` | no automatic entrance in `onEnter` | `1` |
| live score label, initial `"0"` | explicit `(0, 0.5)` | `(0.085W + 0.5w(scoreIcon), 0.95H)` | none | `1` |
| best-score label, initial format `" %d"` | explicit `(0, -0.15)` | cup child at `(w(cup), 0)` | none | `1` |
| pending double label, initial `"0"` | inferred center | panel child at `(w(panel)/3, h(panel)/2)` | none | `1` |

The live label uses `Fonts/Linds.ttf` at `32 * (W / 480)` points; the pending label uses
`28 * (W / 480)`; the best label uses `30 * (W / 480)`. Label point sizes are logical-scale
formulas, not physical-pixel calculations. Double-score timing and score smoothing belong to
`classic-cut-score-contract.md`; the recovered presentation boundary here is the hidden/shown
panel position and label ownership.

The shared pause button uses the normal/selected assets above, inferred center anchor, a
zero-position menu parent, and z-order `1`. Let `VW` be the logical visible width and `s` the
content scale factor; its recovered item position is `(0.075 * VW * s, 0.075 * VW)`. Bootstrap
sets `s = 1.0`, but the formula boundary should remain explicit. The full pause/objectives
overlay is not part of the minimum Classic start-to-result contract.

### Miss/fail presentation

On fail-manager entry, three unfilled persistent markers using `object-x-normal` begin above
the viewport, fade in, and move concurrently for `1.0` second:

| Strike | x | initial y | target y | scale | anchor | z |
|---:|---:|---:|---:|---:|---|---:|
| `1` | `0.675W` | `1.125H` | `0.955H` | `0.64` | inferred center | `1` |
| `2` | `0.775W` | `1.125H` | `0.955H` | `0.8` | inferred center | `1` |
| `3` | `0.9W` | `1.125H` | `0.955H` | default `1` | inferred center | `1` |

Every missed fruit creates a transient fail-animation node at `(missPosition.x, 0.075H)`,
z-order `1`. It adds an `object-x-filled` child at `(0, 0)`, z-order `1`, waits `1.0` second,
then removes both sprite and animation node with cleanup. Its occasional RNG-driven marker
rotation is not needed to define the minimum fixed layout.

For each of the first three misses, the corresponding persistent marker changes to
`object-x-filled`, records its normal scale, becomes five times that scale with opacity `0`,
then runs `ScaleTo(0.25, normalScale)` and `FadeIn(0.25)` concurrently. The completion callback
checks the then-current fail count. Because the count increments after actions are queued and
callbacks are not individually consumed, more than one pending callback can request game
over after the count reaches exactly three. Classic's own game-over guard makes the terminal
presentation one-shot.

Neither `FruitFailManager` nor `FailAnimation` contains a direct audio call. The mere presence
of `Sounds/fruitfail.wav` in native strings and resources does not recover its use or timing.

### Bomb presentation and audio

Bomb ID `0` uses `Bomb/bomb_X.png`; ID `1` uses `Bomb/bomb_10.png`. Bomb creation explicitly
sets sprite anchor `(0.5, 0.4)`. The physics object adds its sprite at z-order `1`. Position is
dynamic and synchronized with its physics body, so there is no fixed Classic screen
coordinate to invent.

Recovered lifecycle/order from `E-BOMB`:

1. On bomb entry, if effects are enabled, request `Sounds/boomsound.wav` once, non-looping,
   and retain its effect handle.
2. A successful one-shot bomb cut stops the bomb's two retained effect handles when effects
   are enabled, zeroes linear/angular state, creates the explosion animation at the body
   position converted by `32` to legacy logical world units, and adds it at z-order `1`.
3. The bomb synchronously notifies Classic `BombHit`.
4. `ClassicModeLayer::BombHit` disables cutting, stops all nine toss controllers, stops
   `BombElectric`, calls `PhysicsLayer::StopPhysicsWorld(true)`, and submits score `-10` in
   that order.
5. After the synchronous `BombHit` notification returns, if effects are enabled, request
   `Sounds/boomexplosion.wav` once, non-looping.
6. Explosion presentation waits `0.25` seconds, enters state `2` and draws a solid white quad
   covering the full `VisibleRect` for `1.0` second, then enters state `1` and draws solid
   white triangles from the stored bomb point to generated points for `1.25` seconds.
7. After the nominal cumulative `2.5` seconds from explosion entry, the explosion removes
   itself and its completion path notifies `AfterBombHit`.
8. Classic `AfterBombHit` calls guarded `GameOver`, then calls
   `PhysicsLayer::StopPhysicsWorld(false)` to resume the physics world; the bomb is
   disposed/removed on its completion path.

The flash is procedural geometry, not a sprite asset. `bombsmoke.png` is therefore not a
substitute for the recovered full-quad/triangle sequence. `BombElectric` can use a separate
`boomhit` sound in its own bonus path; that must not be conflated with this normal bomb-cut
sequence.

### Guarded game-over presentation

`ClassicModeLayer::GameOver` first checks/sets an idempotence byte. On the first call it starts
the following two sequences concurrently:

| Node | Initial position | Action sequence | callback | z |
|---|---|---|---|---:|
| `GAME` (`text-game`) | `(C.x, T.y + 0.5h(GAME))` | `MoveTo(0.75, (C.x, 0.575H))` -> `Delay(1.0)` -> `MoveTo(0.75, (-0.5W, 0.575H))` | `DisplayScoreCallback` after final move | `1` |
| `OVER` (`text-over`) | `(C.x, B.y - 0.5h(OVER))` | `MoveTo(0.75, (C.x, 0.425H))` -> `Delay(1.0)` -> `MoveTo(0.75, (1.5W, 0.425H))` | none | `1` |

No anchor setter is present; center anchors are inferred from the legacy sprite default and
must be explicit in Creator. The callback is attached only to `GAME`; its exact nominal
action sum is `2.5` seconds. `GameOver` itself makes no direct audio request.

`DisplayScoreCallback` then performs this recovered order:

1. stop all currently playing effects;
2. create/configure `DisplayScoreLayer` with the current mode and the recovered
   ScoreManager-derived score value;
3. remove Classic from its parent with cleanup enabled;
4. add the result layer to that same parent at z-order `1`.

This is a layer replacement after terminal text exits, not a simultaneous overlay on live
Classic gameplay.

### Result navigation and Classic Settings subset

`DisplayScoreLayer::RetryCallback` at `0x0014CBB0` performs this synchronous order:

1. if `enable_effect` is true, request `Sounds/menubuttonclick.wav` once, non-looping;
2. capture the Result layer's current parent;
3. remove Result from that parent with cleanup enabled;
4. construct a fresh Classic layer for mode `0`;
5. add that Classic layer to the captured parent at z-order `1`.

`DisplayScoreLayer::MenuCallback` at `0x0014CC84` shares steps 1 through 3, then constructs a
fresh Main Menu layer and adds it to the captured parent at z-order `1`. Neither callback saves
Settings, reloads or replaces a scene, stops the Director, delays navigation, stops all effects,
or reseeds process-owned random state. Full Main Menu construction is not yet implemented in
Creator; its recovered command plan remains a deferred boundary.

Settings load at `0x00163620` and save at `0x00163094` access the implemented Classic subset in
this exact relative order: `total_coins`, `classic_best_1`, `classic_best_2`, `classic_best_3`,
then Boolean `enable_effect`. The recovered default for `enable_effect` is `true`.

Creator makes one explicit safety adaptation at the cleanup boundary. Result is detached from
its parent synchronously in the recovered order, but its presenter is retained for the rest of
that same callback until fresh Classic construction, physics restart, attachment, and commit
succeed. A pre-commit exception restores the identical Result and prior run/session/physics
state without replaying leaderboard, coin, or random work. Once commit publishes the fresh
state, engine cleanup is best-effort and any cleanup error is reported without rolling back the
new Classic layer. No frame or input is processed while the detached presenter is retained.
This delays disposal relative to native cleanup timing without changing the observable
successful order.

### Result screen reached from Classic

The shared result layer constructs these recovered presentation nodes:

| Node | Anchor | Initial position | Final/action | z |
|---|---|---|---|---:|
| score-panel background | inferred center | `(C.x, 1.1 * C.y)` | `FadeIn(0.75)` | `1` |
| `Score: %d` label | explicit `(0, 0.5)` | `(0.05W, 0.8H)` | no entrance tween | `1` |
| result header | inferred center | `(C.x, T.y + 0.5h(header))` | concurrent `FadeIn(1.0)` and `MoveTo(1.0, (C.x, 0.925H))` | `1` |
| retry button | inferred center | `(L.x - 0.5w(button), 0.075H)` | concurrent fade/move `1.0` to `(L.x + 0.5w(button), 0.075H)` | menu z `1` |
| menu button | inferred center | `(R.x + 0.5w(button), 0.075H)` | concurrent fade/move `1.0` to `(R.x - 0.5w(button), 0.075H)` | menu z `1` |
| `object-medal-none` | inferred center | `(0.8W, 0.75H)` | opacity `0`, scale `0.5`; concurrent `FadeIn(1.0)` and `ScaleTo(1.0, 1)` | `1` |
| total-coins panel | inferred center | `(L.x - 0.5w(panel), B.y + 0.2H)` | concurrent fade/move `1.75` to `(L.x + 0.3W, B.y + 0.2H)`, then total-coins callback | `1` |
| bonus-particle container | n/a | `(0.75W, 0.2H)` | wait `1.65`, synchronously create `100` moving sprites, wait `9.5`, remove container | `1` |

The main score label uses `Fonts/AgencyB.ttf`, point size `62 * (W / 480)`, and color
`rgb(102, 45, 145)`. Three white panel labels use the same font at
`32 * (W / 480)`. Their recovered population/visual order is `Best_1`, `Best_2`, then
`Best_3`; relative to the score-panel sprite they are:

1. `Best_1`: `(0.55 * panelWidth, 0.55 * panelHeight)`;
2. `Best_2`: `(0.225 * panelWidth, 0.3375 * panelHeight)`;
3. `Best_3`: `(0.875 * panelWidth, 0.1875 * panelHeight)`.

The total-coins label uses `Fonts/SlabThing.ttf` at `34 * (W / 480)`, explicit anchor
`(0, 0.45)`, and panel-local position `(0.375 * panelWidth, 0.5 * panelHeight)`.

After the background, main score, header, medal placeholder, and retry/menu nodes are
constructed, the rank/cup update can request exactly one of `Sounds/thirdplace.wav`,
`Sounds/secondplace.wav`, or `Sounds/firstplace.wav`, conditional on the achieved rank and
effects setting. This check occurs before the remaining panel labels and total-coins entrance
are constructed. No direct `Sounds/scorescreen.wav` call was recovered from
`DisplayScoreLayer::onEnter`; its literal/resource presence alone cannot assign it to this
transition.

#### Bonus-particle explosion

From `E-RESULT-PARTICLE`, the result particle container is added at z-order `1` and positioned
at `(0.75W, 0.2H)`.
Its recovered action sequence is `Delay(1.65)` -> synchronous burst callback -> `Delay(9.5)`
-> remove the container with cleanup, so removal occurs at nominal result time `11.15`
seconds. The plan/construction before the burst consumes no random draw.

At `1.65` seconds the callback creates exactly `100` `object-bonus-particle` sprites. Each
particle consumes exactly five inclusive integer draws, in this order:

1. duration hundredths in `[265, 475]`, converted to `2.65` through `4.75` seconds;
2. horizontal sign in `[-1, 1]`;
3. horizontal magnitude in `[trunc(0.25W), trunc(0.75W)]`;
4. vertical sign in `[-1, 1]`;
5. vertical magnitude in `[trunc(0.25W), trunc(0.75W)]`.

The local move delta is `(horizontalSign * horizontalMagnitude, verticalSign *
verticalMagnitude)`. A zero sign therefore produces no movement on that axis even though its
magnitude draw is still consumed. The burst consumes `500` draws total. Completed particle
sprites are not individually auto-deleted: they remain at their endpoints until the
container cleanup at `11.15` seconds. No fade or direct audio request is present in this
particle path. The two recovered constructor color flags are both `false`; their native
semantic names remain unknown.

The exact draw count, order, and inclusive ranges are recovered. Native PRNG algorithm,
seeding, and stream state are not recovered by this presentation contract, so matching this
draw protocol must not be described as native RNG sequence parity.

Particle center anchor, white color, full opacity, and ordinary sprite blend are **inferred**
legacy engine defaults because the recovered path contains no corresponding setters. Creator
must set these explicitly for deterministic rendering without upgrading them to recovered
calls.

#### Total-coins reward callback

From `E-RESULT-REWARD`, the total-coins entrance invokes its callback only after the recovered
`1.75`-second fade/move completes. The callback then performs this synchronous order:

1. create `object-bonus-coins-effect`, add it to the result layer at z-order `1` and
   `(0.675W, 0.2H)`, then run `RepeatForever(RotateBy(2.5, +360))`;
2. create `object-coin` and add it to the result layer after the effect, also at z-order `1`
   and `(0.675W, 0.2H)`;
3. create `object-bonus-coins` and add it to the coin at z-order `1`, at legacy lower-left
   content position `(w(badge) / 1.25, h(badge) / 1.25)`;
4. perform the Classic coin-accounting mutation; the bonus is signed truncation toward zero
   of float32 `score * 0.6`, and its addition to total coins uses signed 32-bit wraparound;
5. format that bonus with `%d`, create the `Fonts/SlabThing.ttf` label at
   `34 * (W / 480)` points with anchor `(0.5, -0.1)`, and add it to the coin after the badge
   at z-order `1` and legacy lower-left content position `(w(badge) / 1.25, 0)`.

The equal-z insertion order is therefore effect -> coin at the result root and badge -> label
inside the coin, with accounting specifically between badge and label creation. Creator-local
child positions must convert the recovered lower-left content coordinates by subtracting
`(0.5w(coin), 0.5h(coin))`. The two root positions are direct `W/H` products; no visible-rect
origin is added.

The effect rotation is perpetual until its owning result layer is cleaned up. The callback
contains no direct audio, fade, move, expiry, or removal for the effect, coin, badge, or bonus
label. Center anchors, opacity `255`, scale `1`, and initial rotation `0` for these three
sprites are **inferred** legacy defaults, not recovered setters.

## Audio ordering ledger

| Event | Recovered audio behavior | Status |
|---|---|---|
| choose Classic | effects-enabled `gameplayselected.wav`, then `0.75`-second handoff delay | recovered |
| `GOOD`/`LUCK` and `StartGameCallback` | no direct request | recovered absence in these ranges |
| active toss/cut/combo | governed by `classic-toss-contract.md` and `classic-cut-score-contract.md` | recovered in those contracts |
| missed fruit UI | no direct request in fail manager/animation; `fruitfail.wav` linkage/timing unknown | recovered absence plus unknown literal ownership |
| bomb entry | effects-enabled non-looping `boomsound.wav`; handle retained | recovered |
| bomb cut | stop retained handles -> synchronous Classic hit work -> effects-enabled non-looping `boomexplosion.wav` | recovered |
| `GAME`/`OVER` | no direct request | recovered absence in this range |
| result replacement | `stopAllEffects` before Classic removal/result insertion | recovered |
| result rank update | effects-enabled conditional third/second/first-place sound after header/medal/menu creation and before remaining labels/coins | recovered |
| result particle/reward callbacks | no direct request | recovered absence in these ranges |
| generic result ambience | `scorescreen.wav` use/order not linked | unknown |

An implementation must keep effects-disabled branches free of these audio requests. It must
not add a sound merely because a matching-looking WAV exists in the resource map.

## Cocos Creator 3.8 mapping

| Native responsibility | Creator owner | Required contract |
|---|---|---|
| bootstrap tree/design choice | `ResolutionProfileService` | select `480x800` or `720x1280` with the recovered `720` frame-width boundary; expose logical `W/H` and visible rect |
| logical resource names | `ClassicAssetCatalog` | map one logical key to the selected variant; never derive world positions from raster dimensions |
| paper background | `BackgroundRoot` + `PaperBackground` prefab | center on visible rect, center anchor, equal-z insertion before gameplay, default full opacity; do not animate the nominal paused `0.5` fade |
| Classic replacement | `ModeFlowController` | selection audio -> deterministic `0.75` delay -> same-container Classic replacement |
| start gate | `ClassicStartGate` prefab | explicit center anchors and two concurrent recovered tracks; keep cuts enabled and emit the controller-start command only from `LUCK` completion |
| live HUD | `ClassicHud` Canvas/prefab | explicit anchors, logical formulas, scale fonts from `W/480`; bind labels to score service |
| miss strikes | `ClassicFailPresenter` prefab | three persistent markers plus pooled transient marker; preserve callback/current-count behavior while mode controller guards terminal state |
| tossed bombs | `BombPresenter` component | explicit `(0.5, 0.4)` sprite anchor; physics-driven position; tracked effect handles |
| bomb physics gate | `PhysicsWorldGate` adapter | map `StopPhysicsWorld(true)` before `-10` to pause and `StopPhysicsWorld(false)` after the guarded game-over call to resume |
| bomb flash | `BombExplosionPresenter` | deterministic delay -> full-visible-rect white quad -> white triangle phases; do not replace with an unproved smoke sprite |
| terminal text | `ClassicGameOverPresenter` | one-shot guard, parallel `GAME`/`OVER` tracks, result event only from `GAME` completion |
| results | `DisplayScore` scene/prefab in the same gameplay container | stop effects, replace Classic, create fixed layout, then allow rank audio and timed result callbacks in recovered order |
| result particles | `ClassicResultParticleExplosionPresenter` | `1.65` delay, exact 100-sprite/five-draw burst protocol, retained children, and container cleanup at `11.15`; do not claim native RNG stream parity |
| total-coins reward | `ClassicResultRewardPresenter` | invoke after `1.75`; preserve effect -> coin -> badge -> accounting -> label order and perpetual effect rotation |
| audio | `EffectsAudioService` | effects gating, non-looping requests, retained bomb handles, and `stopAllEffects` boundary |

Recommended Creator hierarchy, where names are new implementation names rather than recovered
native class names:

```text
GameplayScene
  BackgroundRoot                 priority 0
    PaperBackground
  EnvironmentRoot               priorities 1..2
  MenuAndModeContainer           priority 3
    ClassicModeRoot              runtime z 1
      WorldRoot
        TossController[9]
        DynamicObjects
      HudCanvas
        ScoreHud
        FailMarkers
        PauseButton
      StartGate
      TerminalOverlay
    DisplayScoreRoot             replaces ClassicModeRoot, runtime z 1
      TotalCoinsPanel
      ResultParticleExplosion
      ResultRewardEffect
      ResultRewardCoin
        ResultRewardBadge
        ResultRewardBonusLabel
```

Creator's scene/UI sorting does not reproduce old equal-z sibling behavior automatically in
all render paths. Assign explicit sibling priorities for the relationships above, especially
HUD versus terminal overlays. Set every inferred default-center anchor explicitly rather
than relying on prefab defaults.

Use a testable timeline/command layer driven by an injected clock. Tween callbacks should
emit domain commands (`startGameplay`, `afterBombHit`, `showResults`) rather than directly
mutating unrelated services. This preserves recovered order while making static fixtures
deterministic.

## Deterministic/static validation

No validation step may execute the APK or native library. Phase 5 can satisfy this contract
with the following static and Creator-side tests:

1. Parse `resource-usage-map.json`; assert every required logical asset has both tree entries
   and exactly the raster dimensions in this contract. Assert shared fonts and recovered WAVs
   exist without copying them into a new repository location.
2. Regenerate the allowlisted ranges from `E-NATIVE` with both recorded disassemblers and
   compare call targets, literal values, and branch order. Do not claim unarchived target
   ranges are already covered by the Phase 2 checksum corpus.
3. Assert resolution profiles: widths `719` and `720` select `480x800` and `720x1280`
   respectively; content layout remains normalized to logical `W/H` and `VisibleRect` under
   both profiles. Reject use of `getWinSizeInPixels`, device framebuffer pixels, or raw raster
   dimensions in position formulas.
4. Assert background center/default opacity, queued-but-paused native fade classification,
   root tags `0,1,2,3`, and equal-z `1` insertion order.
5. With a fake clock, assert selection audio -> `0.75` delay -> same-parent Classic
   replacement at the captured parent. Effects off must emit no selection-audio command.
6. Assert `GOOD` and `LUCK` start concurrently with exact positions and three `0.5`-second
   segments. Assert cuts remain enabled throughout the intro; only `LUCK` completion at
   nominal `1.5` seconds reasserts `DisableCut(false)` and starts all nine controllers. Assert
   Classic creates no `text-go` node.
7. Snapshot the HUD's normalized formulas, explicit label anchors, selected-resolution asset
   keys, and font-size formulas without rendering original files. Assert the score icon and
   best cup use float32 `0x3DA3D70A` (`~0.08W`) while the live label retains its distinct
   `~0.085W + 0.5w(scoreIcon)` x formula.
8. Assert persistent fail-marker entrances, transient `(missX, 0.075H)` cleanup after `1.0`,
   and persistent filled-marker scale/fade after `0.25`. Multiple pending callbacks may ask
   for terminal state, but the Classic terminal timeline starts once.
9. Assert bomb order exactly: entry fuse request; on cut stop handles -> zero linear/angular state -> create
   explosion -> synchronous `BombHit` work including `StopPhysicsWorld(true)` before `-10` ->
   explosion sound -> `0.25` delay -> `1.0` full-visible-rect white quad -> `1.25` white
   triangles -> `AfterBombHit` -> guarded game over -> `StopPhysicsWorld(false)`. Assert
   `(0.5, 0.4)` anchor and that physics resumes only after the guarded game-over call.
10. Assert parallel `GAME`/`OVER` tracks and exact positions. Only `GAME` completion after
    nominal `2.5` seconds may emit `showResults`.
11. Assert result transition order `stopAllEffects -> configure result -> remove Classic ->
    add result(z=1)`, then validate fixed result layout, panel values in `Best_1`, `Best_2`,
    `Best_3` visual order, and conditional rank audio.
12. Execute the imported Creator Retry controllers against a targeted Creator lifecycle stub. Assert
    click gating, synchronous Result detach, fresh mode-0 construction, same-parent z-order `1`
    attach, exact state-identity rollback for construction/physics/attachment/commit failures,
    and post-commit cleanup isolation. Assert no repeated Settings or random work.
13. With a scripted random adapter and fake clock, assert zero draws before `1.65`, then
    exactly `500` draws for `100` particles in the recovered five-draw order/ranges. Assert
    per-particle move durations/deltas, no fades, retained completed children, and one container
    cleanup at `11.15`; this validates draw protocol, not native RNG sequence parity.
14. Assert the total-coins entrance invokes its callback only after `1.75`, then effect ->
    coin -> badge -> accounting -> label. Assert equal-z sibling order, coordinate conversion,
    float32 Classic bonus math, signed 32-bit total update, perpetual `2.5`-second `+360`
    rotation, and absence of callback-local audio, fade, move, expiry, or removal.
15. Lint the asset/audio catalog so `bombsmoke.png`, `text-go.png`, medal rank sprites,
    `object-new-best.png`, `fruitfail.wav`, and `scorescreen.wav` cannot silently become
    required Classic dependencies without new evidence and a contract update.

These are contract fixtures, not pixel-golden claims from an original runtime.

## Status ledger

| Item | Status | Confidence / boundary |
|---|---|---|
| `720` resolution threshold, two search paths, two design sizes, scale `1.0` | recovered | high; bootstrap code plus initialized constants/strings |
| paired raster metadata | recovered | high; `E-RES` metadata and hashes |
| logical placement uses `W/H` and `VisibleRect`, not physical pixels | recovered | high in the covered functions |
| root layer order and Classic same-parent replacement | recovered | high |
| background, start, HUD, fail, bomb, terminal, and result formulas/timings above | recovered | high; dual targeted disassembly agreement |
| cuts remain enabled through the intro; callback reasserts `false` and starts controllers | recovered | high; no intro disable call and direct callback order |
| bomb anchor `(0.5, 0.4)` and explicit label anchors | recovered | high; direct setters |
| center anchors where no setter exists | inferred | legacy `CCSprite`/label defaults; make explicit in Creator |
| equal-z rendering among every base-gameplay child | partially recovered | known additions use z `1`; complete insertion order of all base children remains unknown |
| `GOOD`/`LUCK` is Classic's only recovered countdown/start gate | recovered | high; direct Classic construction; no Classic `text-go` xref |
| result panel visual values `Best_1`, `Best_2`, `Best_3` | recovered | high; direct label population order |
| result particle timing, 100-sprite burst, draw protocol, and retained-child lifetime | recovered | high; direct constructor/callback/action order and constants |
| total-coins effect -> coin -> badge -> accounting -> label callback order | recovered | high; direct call/insertion order and constants |
| particle texture render defaults and reward sprite defaults without setters | inferred | legacy engine defaults; explicit Creator inputs, not recovered calls |
| original PRNG algorithm, seed, stream state, and exact sequence parity | unknown/not required | recovered draw protocol does not establish generator parity |
| `fruitfail.wav` and `scorescreen.wav` ownership/timing | unknown | resource/literal presence only |
| `bombsmoke`, rank medal sprites, and `object-new-best` Classic use | unknown/not required | paired availability without direct covered-path reference |
| bomb physics-world gate around terminal flow | recovered | `StopPhysicsWorld(true)` precedes `-10`; guarded game over precedes `StopPhysicsWorld(false)` |
| source enum name for design-resolution policy value `2` | unknown/non-blocking | numeric argument and resulting profile contract are recovered |
| original pixel-perfect rasterization, font metrics, and device crop | unknown | no runtime/golden evidence; validate logical contract only |

## Unresolved questions

- Which subsystem, if any, owns `fruitfail.wav` and `scorescreen.wav` in the original runtime?
- Are medal-rank and `object-new-best` sprites selected through a dynamically constructed path
  outside the recovered result range?
- What original PRNG algorithm, seed, and shared stream state supplied the result-particle
  draws?
- What are the complete equal-z insertion relationships among every base-gameplay child?

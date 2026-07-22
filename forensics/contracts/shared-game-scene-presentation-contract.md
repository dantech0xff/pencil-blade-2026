# Shared GameScene Presentation Contract

Status: statically recovered and independently cross-checked on 2026-07-23

Default clean-composite dependency for the accepted Main Menu contract: **GREEN**.

Evidence: `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001`,
`DER-RESMAP-001`, `DER-CLASSIC-PRESENTATION-001`, and the accepted
`main-menu-presentation-contract.md`.

This contract defines the shared `GameScene` presentation roots that sit behind the Main Menu:
`BackgroundLayer`, `LeafLayer`, and `ThemeLayer`. It covers exact root tags and equal-z insertion,
clean Settings defaults, paired resource families, background/theme selection behavior, the
independent seven-body leaf world, and the relevant embedded sprite render state. Together with
`main-menu-presentation-contract.md`, it closes the static logical-presentation dependency for the
default clean boot composite.

The APK and native library were never installed, loaded, linked, or executed. All claims come from
static resource metadata and static ARM/Thumb analysis. This is not an original-frame capture, a
pixel-golden claim, or permission to redistribute the original assets. Asset rights remain
unknown/not cleared.

## Evidence and notation

| Handle | Static evidence |
|---|---|
| `E-NATIVE` | `DER-NATIVE-001`; immutable `libgame.so`, SHA-256 `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e` |
| `E-CORPUS` | `.forensics-work/phase-02/native/`; recorded commands, GNU/LLVM versions, symbols, strings, and immutable corpus hashes |
| `E-FUNCS` | `forensics/native/function-map.csv` plus the immutable full function inventory in `E-CORPUS` |
| `E-RES` | `forensics/resources/resource-usage-map.json` (`DER-RESMAP-001`) |
| `E-ROOT` | `GameScene::onEnter`, `0x00151536..0x001515F6` |
| `E-BACKGROUND` | `BackgroundLayer::onEnter` `0x001421C8`, constructor `0x0014224C`, `SelectBackground` `0x0014228C` |
| `E-LEAF` | `LeafLayer::update` `0x0015994C`, `onEnter` `0x00159968`, constructor `0x00159B28` |
| `E-LEAVE` | `Leave::RandomPosition` `0x00159C14`, `Leave::update` `0x00159CFC` |
| `E-PHYSICS-OBJECT` | `PhysicsObject::onEnter` `0x001617B4`, `draw` `0x001617D4`, `update` `0x00161898` |
| `E-THEME` | `ThemeLayer::onEnter` `0x001647E4`, constructor `0x00164868`, `SelectTheme` `0x001648A8` |
| `E-SETTINGS` | `Settings::LoadData` `0x00163620`; selected-theme/background getters at `0x00163ECC`/`0x00163EEC` |
| `E-ACTION` | `CCNode::runAction` `0x001A52D8`; paused flag is `!m_bRunning` |
| `E-SPRITE` | `CCNodeRGBA::init` `0x001A4854`; PNG decode `0x001CB268`; `CCSprite::setTexture` `0x001CF9E0`; blend update `0x001CFAF0`; texture upload/sampler `0x001DD3DC` |

Targeted ranges were regenerated from `E-NATIVE` with GNU ARM binutils
2.27.0.20170315 and LLVM 19.0.1 forced to `thumbv5te-none-linux-android`. Both views agree on
instruction bytes, call order, branches, literal bits, resource pointers, and vtable offsets used
below. These ranges are reproducible from the recorded command form; they are not claimed to be
among the four archived Phase 2 sample slices.

Definitions:

- `W`, `H`: logical `CCDirector::getWinSize()` width and height.
- `L`, `R`, `T`, `B`, `C`: `VisibleRect.left`, `right`, `top`, `bottom`, and `center`.
- `trunc32(x)`: conversion to signed integer by truncation toward zero.
- `idiv32(n)`: signed integer division of integer `n` by `32`, truncated toward zero.
- `nextInt(a,b)`: the recovered inclusive integer RNG call over `[a,b]`.
- `f32[bits]`: the IEEE-754 binary32 value represented by the hexadecimal bits.
- `recovered`: directly supported by the covered static app/resource/engine evidence.
- `inferred`: legacy default or interpretation required where no app-level setter exists.
- `Creator mapping`: clean-room implementation choice that must preserve the recovered outcome.
- `unknown`: not safely determined by this static evidence.

Raster dimensions identify exact files. They are not physical-frame coordinates. The shared
resolution profile remains: physical frame width below `720` selects the `480x800` tree; width at
least `720` selects `720x1280`; design-resolution policy argument `2` and content scale `1.0` then
define logical layout.

## Clean Settings and default composite

`Settings::LoadData` resolves the key strings and explicit defaults in this order near its entry:

| Key | Default argument | Shared consumer |
|---|---:|---|
| `selected_theme` | `2` | `ThemeLayer` |
| `selected_background` | `0` | `BackgroundLayer` |

Thus a clean Settings store constructs `paperbackground0` and `theme2`. Persisted values replace
those defaults. Neither shared selector range performs an index bound check; behavior for a corrupt
or out-of-catalog persisted integer is unknown and must fail safely in Creator rather than inventing
a fallback while claiming native parity.

The default clean logical composite is:

1. centered `Backgrounds/paperbackground0.png`, opaque at node modulation `255`;
2. seven independently simulated leaf sprites at explicit opacity `32`;
3. centered `Themes/theme2.png`, node modulation `255` with its recovered transparent pixels;
4. the accepted Main Menu foreground subtree.

The dependency status is **GREEN** because all three formerly external shared roots now have exact
static construction, resources, ordering, dynamics boundaries, and explicit unknowns. GREEN does
not claim a deterministic original screenshot: leaf RNG is time-seeded in the legacy code, the
runtime frame/delta sequence was not observed, and Creator rendering still requires compatibility
validation.

## Exact paired resources

Each resource cell gives `(raster width x height; bytes; SHA-256)`. Paths are logical paths beneath
the selected `480x800/` or `720x1280/` search tree.

### Background family

`BackgroundLayer` formats `Backgrounds/paperbackground%d.png`. These are the exact cataloged
paired members; the layer itself accepts an unchecked integer.

| Index | `480x800` tree | `720x1280` tree |
|---:|---|---|
| `0` | `Backgrounds/paperbackground0.png` (`480x800`; `161538`; `d634be5b392cc1b36c18403addfa7d2794b0f637596b637704d11b2c7acf6283`) | `Backgrounds/paperbackground0.png` (`720x1280`; `197452`; `5ee663012fe0b67e35fd44dd9023ddad673cca7bbaa016baeaa0e80eed84f622`) |
| `1` | `Backgrounds/paperbackground1.png` (`480x800`; `780605`; `516df505b71cd29f9abeaace661c98a3a71baa9f2b2391a30eac50c3f47403aa`) | `Backgrounds/paperbackground1.png` (`721x1281`; `958353`; `156198a9c1ad6bd7934b91c6fe481cd8eafffcca658f0e619ecae9996714fa8c`) |
| `2` | `Backgrounds/paperbackground2.png` (`480x800`; `461631`; `0199ca3eef3477a4dba41611ca020db637cf2d19858706c08c133caec2490744`) | `Backgrounds/paperbackground2.png` (`720x1280`; `824287`; `ae14a1ac62a293ce1023be3defcb0f8bf5660af34c5d1690635a4e8ef5cce555`) |
| `3` | `Backgrounds/paperbackground3.png` (`480x802`; `576735`; `c062fa0fcea9bebaa5e74d3ce035b253836ca06d4ee7df8b89ae9e236fd52cad`) | `Backgrounds/paperbackground3.png` (`720x1280`; `1177571`; `78d7196cc10f9aa5ba2a78492b02cea65fdcab3ffe56acf38d9f9d713c348c44`) |
| `4` | `Backgrounds/paperbackground4.png` (`481x801`; `479539`; `8c8a55083c1a43cbb6d5e9222a51548d4debd79c915f5a710a44261485f08f93`) | `Backgrounds/paperbackground4.png` (`721x1281`; `1040557`; `9c42b14ba55895a527bc62b7d3d645f4151f4e9e581a8dca21842833c42c5535`) |
| `5` | `Backgrounds/paperbackground5.png` (`480x800`; `356514`; `ad94de28151fd06f21c8fb35c820ed5f907eb0a031556927548309fd71af1eb4`) | `Backgrounds/paperbackground5.png` (`720x1280`; `444778`; `ce1af64fc3d206e4a02ac75b808983b0cff65f6a972806e6cc1fbc7e34b4bc2d`) |
| `6` | `Backgrounds/paperbackground6.png` (`480x800`; `291277`; `c89a368a04d5b4006a98abcbd8ff9116893ce134cc70bc78a945841c1d9b4428`) | `Backgrounds/paperbackground6.png` (`721x1280`; `634890`; `739f61c110c0bd2a0fe64afa118525998a782f356abf4617bb481a1a65875aa2`) |
| `7` | `Backgrounds/paperbackground7.png` (`480x801`; `711080`; `9cde53b4dcea87de5dae2a76f8c11448de2bad87cd7ac48668a06d40146a8bbe`) | `Backgrounds/paperbackground7.png` (`720x1281`; `1671368`; `7d84c39ef517eb55d973c3ac69a73d5e6f02f3a9d28c5d561dd505ea371d535d`) |
| `8` | `Backgrounds/paperbackground8.png` (`481x800`; `511050`; `2482355de6e2408b113bdede9a173e7602bdcde0efc2d4d9ae710e6506bd324b`) | `Backgrounds/paperbackground8.png` (`721x1281`; `1002071`; `cdec39865f994e3a9b61b997b015f998d011919849d946a37cb78b6b43ddc6fa`) |

PNG metadata records no alpha for low-tree indices `0,2,5,6` and high-tree indices `0,2,5`;
the other background variants have alpha. In particular, clean default `0` is opaque RGB in both
trees.

### Theme family

`ThemeLayer` formats `Themes/theme%d.png`. These are the exact cataloged paired members; every file
has an alpha channel.

| Index | `480x800` tree | `720x1280` tree |
|---:|---|---|
| `0` | `Themes/theme0.png` (`480x800`; `2655`; `bcb7ea9a57bd2540ce3a47cc6c2d0f344dc3b784dc5c266217bfe9d6ad5a81fe`) | `Themes/theme0.png` (`720x1280`; `5693`; `6ebe1c974279189ac08a752b1d605031dd6126bf832e5a38c616c7c7cbc6557a`) |
| `1` | `Themes/theme1.png` (`482x802`; `39019`; `ba12da2ab46f6f1c141cc83cf6661a82d14c6a29a0d2d16b635d48cc4f5ed778`) | `Themes/theme1.png` (`720x1280`; `98661`; `eecc8944cd7911562d8e4ece3ec2434e2c71ef5c947737d97a48ff0916cf6912`) |
| `2` | `Themes/theme2.png` (`482x802`; `29809`; `69c50b8a2f93fcf1474c99706f320a539714eab1976f010e0074d8f6dc00aad8`) | `Themes/theme2.png` (`720x1280`; `99072`; `6096db1dfcaba4d0c787ad6330806fa1464aaf67c4b0be6880c1ef9668f7a3f7`) |
| `3` | `Themes/theme3.png` (`480x800`; `41586`; `3b990eab59980a5a1ba17363345784a0327dc1056919869abcfe01979d62f4d7`) | `Themes/theme3.png` (`720x1280`; `73310`; `af47d9f631c5eb062e74387b14fa2ec59c5a069863713db9b92d1d43b5c5a44f`) |
| `4` | `Themes/theme4.png` (`480x800`; `42901`; `3e57af3ca605531afb20bd207fe715f94b2cb7d53dedbc7bf65e00a86b7add88`) | `Themes/theme4.png` (`720x1280`; `82971`; `a2fa5dfd5b795c251b868f92ab9705a43350b20705393034f51101471dfc6b2b`) |
| `5` | `Themes/theme5.png` (`480x800`; `58290`; `c26bb488987290e2c3dd1e6882ffd4fdaf9cdf458ee2e893da2d0dd1775dc7a1`) | `Themes/theme5.png` (`720x1280`; `102866`; `6dcce23f49c1876667f67c6a9008215f8a9953d6057bf25212ade1439e9f2aa9`) |
| `6` | `Themes/theme6.png` (`480x800`; `57876`; `26fbf327fa5e448be5e8b05bd5e345a7329e2ed3dc1026e951ab2e096951eae0`) | `Themes/theme6.png` (`720x1280`; `101175`; `3e5dfa9b74b099c91a557b5ac1ef4cba72e2badeb8fb07f24ba78e0cfec872db`) |
| `7` | `Themes/theme7.png` (`480x800`; `41359`; `457c0299e86eddd3a757807bc2891bab92e372536ae1b23f9cda21cc92baa88e`) | `Themes/theme7.png` (`720x1280`; `81689`; `b63b32714088c963f55aba7298133c58e1bb3b3ff4758fff1fe2d3712ac95be9`) |
| `8` | `Themes/theme8.png` (`480x800`; `41389`; `b5e40e016748894cf272dec8f15cc35c0164dfae1bf1296cc6325c5d7f0438e5`) | `Themes/theme8.png` (`720x1280`; `81645`; `0c670aff9aee6bb8edded64d0049af2bc178967f9c4c29c5f8febc7d3d85d596`) |
| `9` | `Themes/theme9.png` (`480x800`; `57025`; `f504a59f7c25cd5bb8783cfc069da26e0ab502dccfb895d7bd60614f5e06938e`) | `Themes/theme9.png` (`720x1280`; `103925`; `0daeaaf2ffb40b80a6854faae545c52ee6af9883769de048ba1aff2b38505264`) |

### Leaf array

The native pointer array at `0x004790F8` resolves the exact construction order below. Each logical
path exists under both search trees with identical dimensions, byte count, and SHA-256. These are
not scaled-up high-profile variants.

| Construction order | Path in both trees | Raster | Bytes | SHA-256 | Pair relation |
|---:|---|---:|---:|---|---|
| `1` | `Leaf/leave7.png` | `75x71` | `5506` | `81e0350dbab6ce33a172bdb30549e57f8dec687c432168e97d66ca404f0c1359` | exact byte identity |
| `2` | `Leaf/leave1.png` | `84x79` | `3515` | `64a7a8d44208ed22bf14c903b0e1faf8264aec9dfdc1eb8dfc0fa22b001a1bfa` | exact byte identity |
| `3` | `Leaf/leave2.png` | `69x64` | `4415` | `994bcebea40a2e375a6d4ba9119c7ab256323041777ce5900b39dd24588edf9e` | exact byte identity |
| `4` | `Leaf/leave3.png` | `51x91` | `7136` | `cfc6f0b49b0461a3cb49fb10e822f909701cc5f282e18d7670f82176ac0c066d` | exact byte identity |
| `5` | `Leaf/leave4.png` | `74x71` | `3815` | `c091aace9ebe3038d51a975584e3845fd65a17d7574e6087b90eadfe8bee2846` | exact byte identity |
| `6` | `Leaf/leave5.png` | `79x69` | `3992` | `afce7fbd41f9be4c06d84244714ce76d474994829aa78d84612156b42184dd34` | exact byte identity |
| `7` | `Leaf/leave6.png` | `66x70` | `5069` | `d51294f17f57343b045d0ee0692c88970c5a26d2b631ccde5101c07c093de1ff` | exact byte identity |

All seven are RGBA PNGs. The bare strings `leave0.png` through `leave6.png` and
`Images/Themes/them2.png` belong to other static symbol groups; they are not resources selected by
the covered `LeafLayer`/`ThemeLayer` paths.

## GameScene root insertion boundary

`GameScene::onEnter` calls its base entry, then creates, tags, and attaches these roots in order:

| Insertion | Child | tag | parent z-order |
|---:|---|---:|---:|
| `1` | `BackgroundLayer` | `0` | `1` |
| `2` | `LeafLayer` | `1` | `1` |
| `3` | `ThemeLayer` | `2` | `1` |
| `4` | `MainMenuLayer` | `3` | `1` |

The child call through vptr slot `+272` resolves to `CCNode::setTag(int)` at `0x001A3DA6`.
The parent call through slot `+200` resolves to `CCNode::addChild(child,int)` at `0x001A455C`.
Therefore `0,1,2,3` are tags, not render priorities, and every root is inserted with z-order `1`.
The legacy equal-z draw relation is insertion order. Creator must assign explicit sibling
priorities in this exact order; setting Creator z values to the native tags is wrong.

Background and Theme each add their sole sprite at local z-order `1`. Leaf adds each `Leave` at
local z-order `1` in the resource-array order, and each `PhysicsObject::onEnter` adds its sprite at
local z-order `1`. Equal-z sibling order remains part of the contract at each boundary.

## BackgroundLayer contract

### Initial entry

`BackgroundLayer::onEnter` does not call `CCLayer::onEnter`. It performs:

1. get `Settings::getSelectedBackground()`;
2. format `Backgrounds/paperbackground%d.png` into a fixed local buffer;
3. create and retain the sprite pointer in the layer field;
4. set sprite position to `C`;
5. queue `FadeIn(f32[0x3F000000])`, exactly `0.5` seconds;
6. add the sprite at local z-order `1`.

There is no app-level anchor, scale, opacity, rotation, or texture-rect setter in this path. Center
anchor `(0.5,0.5)` is an inferred legacy `CCSprite` default and must be explicit in Creator.
Default node opacity `255` is recovered from `CCNodeRGBA::init`.

The fade is nominal only. The layer override omits base entry, so the layer never becomes running.
The sprite action is queued before attachment; `CCNode::runAction` passes `!m_bRunning` to the
action manager, and adding the sprite to the still-non-running layer cannot enter/resume it. Static
engine resolution therefore recovers the effective frame as immediately full opacity, with no
visible `0.5` transition. Creator must preserve the effective opaque result and must not animate
the inert fade.

On the clean profile, default index `0` exactly fills the canonical logical raster in either tree
when centered. Other family members keep their listed native dimensions; no cover scaling or
dimension-derived repositioning is present.

### Live selection

`BackgroundLayer::SelectBackground` re-reads the current setting, formats the same family path,
loads the texture through `CCTextureCache::addImage`, and invokes the existing sprite's virtual
`CCSprite::setTexture` slot. It then queues `FadeIn(0.75)`. Because this layer still never became
running, that action is also paused and has no effective opacity transition.

`CCSprite::setTexture` changes the texture, shader, and blend state but does not call
`setTextureRect`. The existing sprite therefore retains its prior texture rect, content size, and
geometry after a live swap. This is recovered engine behavior, including when source dimensions
differ. Creator may not silently resize the node on selection while claiming exact compatibility;
the clean default path is unaffected because its sprite is created directly from index `0`.

## ThemeLayer contract

### Initial entry

`ThemeLayer::onEnter` is structurally parallel to Background entry and also omits
`CCLayer::onEnter`. It performs:

1. get `Settings::getSelectedTheme()`;
2. format `Themes/theme%d.png`;
3. create/store the sprite;
4. set sprite position to `C`;
5. queue `FadeIn(f32[0x3F400000])`, exactly `0.75` seconds;
6. add the sprite at local z-order `1`.

The inferred anchor is `(0.5,0.5)`; no app-level scale, rotation, opacity, or alternate anchor is
present. Like Background, the omitted base entry plus `CCNode::runAction` pause rule leaves this
fade inert. Theme renders immediately at default node opacity `255`, modulated by the texture's
alpha.

Clean default index `2` is `482x802` in the low tree and `720x1280` in the high tree. Centering the
low asset on the `480x800` logical profile extends its unscaled rect by one logical unit on every
side. Creator must not coerce it to `480x800` or infer an alternate offset.

### Live selection and retained-rect caveat

`ThemeLayer::SelectTheme` re-reads the setting, loads the formatted texture, calls only
`CCSprite::setTexture` on the existing sprite, and queues another paused `FadeIn(0.75)`. It does not
recenter, recreate, rescale, or call `setTextureRect`.

The original entry texture rect is therefore retained across selection. This matters in the low
tree: switching between the `482x802` members (`1`,`2`) and `480x800` members (`0`,`3`-`9`) retains
the old rect/UV geometry rather than adopting the new texture dimensions. Clamp-to-edge sampling
then governs any coordinates beyond the replacement texture. Creator selection must preserve this
boundary or document a reviewed compatibility divergence; replacing the whole `SpriteFrame` and
letting it resize is not the recovered behavior.

## LeafLayer contract

Unlike Background and Theme, `LeafLayer::onEnter` calls `CCLayer::onEnter`, so the leaf root and its
children enter the running lifecycle. The `LeafLayer` constructor schedules its update; each
`Leave` inherits a `PhysicsObject` constructor that independently schedules its own update.

### Independent world and creation loop

Leaf creates its own `b2World`, separate from gameplay physics:

| Property | Recovered value |
|---|---|
| gravity | `(0, f32[0xBE19999A])` = `(0,-0.15000000596046448)` |
| allow sleeping | `true` via `b2World::SetAllowSleeping(true)` |
| continuous physics | `true` via the inlined world byte at offset `0x19251` |
| per-update step | `world.Step(dt, 5, 5)` |

`LeafLayer::update(dt)` first invokes `CCNode::update(dt)`, then steps this world once with the
supplied scheduler `dt`, velocity iterations `5`, and position iterations `5`. The layer was
scheduled before its children, so the recovered normal frame order is parent step, child
`Leave::update` checks, then render/draw synchronization. A respawn caused by a child update is
therefore visible in that same rendered frame.

The exact Box2D solver's internal arithmetic, damping/clamp order, and the original device's `dt`
sequence are not promoted into this presentation contract. The recovered boundary is the
independent world plus exact `Step(dt,5,5)` call. Creator must not couple leaf motion to the
gameplay world or to gameplay-world stop/resume commands.

`LeafLayer::onEnter` iterates exactly seven times in the array order above. For each entry it:

1. creates a `Leave` and the exact sprite;
2. sets sprite opacity to `32` through the vtable slot resolving to
   `CCSprite::setOpacity(unsigned char)` at `0x001D1900`;
3. creates a dynamic body from the profile below;
4. creates the box fixture from the unscaled sprite content size;
5. associates the body with the `Leave`;
6. invokes `RandomPosition`;
7. adds the `Leave` at local z-order `1`.

No app-level sprite anchor setter is present. Center anchor `(0.5,0.5)` and initial unit visual
scale are inferred legacy defaults and must be explicit in Creator.

### Body and fixture profile

| Surface | Recovered value |
|---|---|
| body type | dynamic (`2`) |
| body-def position, angle | `(0,0)`, `0` before `RandomPosition` |
| body-def linear/angular velocity | `(0,0)`, `0` before `RandomPosition` |
| linear/angular damping | `0`, `0` |
| allowSleep / awake / active | `true / true / true` |
| fixedRotation / bullet | `false / false` |
| gravity scale | `1.0` |
| shape | axis-aligned box |
| box half extents | `(spriteContentWidth * 0.015625, spriteContentHeight * 0.015625)`, equivalently `(w/64,h/64)` world units |
| density | `1.0` |
| friction | `0.5` |
| restitution | `0.0` |
| sensor | `false` |
| category bits | `0x0000` |
| mask bits | `0xFFFF` |
| group index | `0` |

Category bits `0` make these fixtures contact-ineligible under the recovered Box2D filter test.
The world remains a required independent simulation boundary even though normal leaf trajectories
are contact-free.

### RandomPosition and RNG consumption

`RandomPosition` consumes exactly three global `RandomHelper` draws in this order. All
`nextInt` bounds are inclusive:

```text
xPixel = nextInt(10, trunc32(W - 10.0))
xWorld = float(idiv32(xPixel))

yPixel = nextInt(trunc32(T.y + 50.0), trunc32(T.y + H))
yWorld = float(idiv32(yPixel))

angularDelta = nextInt(-25, 25)
```

The division by `32` is signed integer division before conversion back to float. It is not a
continuous `pixel / 32.0` result. A call to `CCDirector::convertToGL((xWorld,yWorld))` occurs, but
its returned point is discarded; the body transform uses the unconverted quantized pair.

After the third draw, if the body is dynamic, the function wakes it whenever it is sleeping by
setting the awake flag and zeroing sleep time, even when `angularDelta == 0`. It then adds
`float(angularDelta)` to the existing angular velocity, calls
`SetTransform((xWorld,yWorld), currentAngle)`, and finally sets linear velocity to `(0,0)`.
Angular velocity is accumulated across respawns, not reset.

Initial creation therefore consumes exactly `21` draws: three for each leaf in construction order.
The body-def starts at zero, but `RandomPosition` runs before scene-graph attachment, so the
effective initial body position and angular velocity are randomized. The legacy RNG lazily seeds
the shared `lrand48` stream from `time()` on first use. Exact seed, sequence values, and parity
with a Creator PRNG are unknown; deterministic tests must inject a seeded source while preserving the shared
draw protocol and order.

### Update, respawn, and body-to-visual mapping

Each `Leave::update(dt)` first invokes `PhysicsObject::update(dt)`, then applies the strict test:

```text
if body.position.y * 32.0 < B.y - 100.0:
    RandomPosition()
```

Equality does not respawn. A respawn consumes the same three draws and performs the same wake,
angular accumulation, transform, and zero-linear-velocity order above.

The `PhysicsObject::draw` path, not `Leave::update`, synchronizes the sprite from the body before
the sprite child renders:

```text
sprite.rotationDegrees = -(body.angleRadians * f32[0x42652EE1])
                       = -(body.angleRadians * 57.295780181884766)
sprite.position = (body.position.x * 32.0, body.position.y * 32.0)
```

The sign inversion is recovered. A Creator angle adapter must preserve it rather than assuming its
native rotation convention matches Cocos2d-x.

## Shared embedded sprite render state

Static engine paths bound the compatibility target more tightly than filename/dimension evidence:

- alpha-bearing Theme/Leaf/background PNGs are decoded to premultiplied RGBA bytes and, under the
  unchanged default alpha format, uploaded as RGBA8888;
- those premultiplied textures select blend `GL_ONE, GL_ONE_MINUS_SRC_ALPHA`;
- opaque RGB background members upload through the RGB888/non-premultiplied branch and select
  `GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA`; source alpha is effectively one;
- textured sprites select `ShaderPositionTextureColor`;
- texture minification and magnification are `GL_LINEAR`;
- wrap S and T are `GL_CLAMP_TO_EDGE`;
- no app-level sampler override, mipmap request, sprite trimming, atlas rotation, or alternate
  blend call occurs in the covered shared paths;
- content scale factor is `1.0`; default sprite/node opacity is `255`, except the explicit leaf
  opacity `32`.

Creator must import these files losslessly and use untrimmed sprite geometry. For alpha textures it
must pair premultiplication and blending consistently; otherwise leaf/theme edges will differ even
when resource bytes match. Original GPU precision, color-space behavior, framebuffer format,
device crop, and final pixel output remain unknown without an original-runtime observation.

## Cocos Creator 3.8 mapping

| Recovered responsibility | Creator owner | Required mapping/boundary |
|---|---|---|
| logical profile | `ResolutionProfileService` | select the exact resource tree and expose logical `W/H/L/R/T/B/C`; never use physical pixels in formulas |
| equal-z shared roots | `SharedGameScenePresenter` | explicit sibling order Background -> Leaf -> Theme -> Main Menu; keep native tags as identifiers only |
| background | `SharedBackgroundPresenter` | exact family/default `0`, centered unscaled sprite, explicit center anchor, effective immediate opacity, retained rect on live texture swap |
| theme | `SharedThemePresenter` | exact family/default `2`, centered unscaled sprite, explicit center anchor, effective immediate opacity, retained rect/UV geometry on live swap |
| leaf resources | `SharedLeafPresenter` | exact seven paths/order, untrimmed size, center anchor, opacity `32`, local sibling order |
| leaf simulation | isolated `SharedLeafPhysicsPort` | independent contact-free world semantics, exact body/fixture profile, one `Step(dt,5,5)` command, no gameplay-world coupling |
| leaf random | shared injected RNG service | exact 21-draw initial protocol, inclusive bounds, integer division, wake/add/transform/velocity order; deterministic seed only in tests |
| leaf render adapter | `SharedLeafPresenter` | apply body-to-visual `*32` mapping and negative radians-to-degrees conversion after step/respawn |
| texture compatibility | shared resource/material adapter | lossless untrimmed import, linear/clamp sampler, premultiplied-alpha-compatible material/blend, no invented fade |

Creator 3.8 may not expose a second public Physics2D world matching the legacy object directly. If
the implementation uses a project-owned contact-free leaf simulation instead, that is a reviewed
Creator mapping: it must preserve the recovered port, constants, order, and visual mapping, while
keeping unverified Box2D arithmetic parity explicitly non-recovered.

## Deterministic/static validation

No validation step may execute the APK or native library.

1. Verify the immutable native SHA-256, recorded tool versions, and both-tree resource-map input
   hashes before comparing targeted disassembly.
2. Regenerate every app/engine range named above with both recorded disassemblers; assert call
   targets, float bits, direct stores, branches, and vtable slots agree.
3. Resolve `Settings::LoadData` key literals; assert clean defaults theme `2` and background `0`.
4. Parse `E-RES`; assert every background/theme row exists in both trees with the exact dimensions,
   bytes, and hashes, and every leaf pair is byte-identical as listed.
5. Assert GameScene tags `0,1,2,3`, all four parent z arguments `1`, and exact insertion order.
   Independently resolve `+272` to `setTag` and `+200` to two-argument `addChild`.
6. Assert Background creation path, center, local z `1`, `0.5` queued fade, missing base entry, and
   effective full-opacity frame. Assert `SelectBackground` uses `setTexture` only and queues paused
   `0.75`.
7. Assert Theme creation path/default, center, local z `1`, missing base entry, and paused `0.75`.
   Swap `482x802` and `480x800` low-tree textures in an adapter test and assert the original rect,
   content size, and UV geometry are retained.
8. Assert leaf pointer-array order, seven additions, opacity `32`, exact initial `21` RNG draws,
   body/fixture fields, and unscaled `(w/64,h/64)` half extents under both profiles.
9. With a fake shared RNG, assert inclusive bounds and signed integer division; assert sleeping
   dynamic bodies wake even for delta zero; assert angular addition precedes transform and zero
   linear velocity.
10. Drive a fake physics port; assert parent `Step(dt,5,5)` occurs before child threshold checks,
    strict `< B.y-100`, three-draw respawn, and same-frame body-to-visual mapping.
11. Statically inspect the engine render anchors; assert RGBA premultiplication, alpha-dependent
    blend branch, shader key, linear filtering, clamp wrap, default opacity `255`, and leaf override
    `32`.
12. Snapshot default logical geometry at `480x800` and `720x1280`, including the low default theme's
    one-unit overhang. Reject framebuffer pixels and raster-derived scaling as layout inputs.
13. Run the prohibited original-runtime/source-boundary audit; no original executable, Cocos2d-x
    runtime, JNI compatibility bridge, or decompiler artifact may enter Creator.

## Status ledger

| Item | Status | Boundary |
|---|---|---|
| root tags, all-root z `1`, insertion order | recovered | high; dual `E-ROOT` plus exact vtable resolution |
| clean background/theme defaults | recovered | high; key-string and explicit default arguments in `E-SETTINGS` |
| paired resource paths, dimensions, bytes, hashes | recovered | high; `E-RES` |
| background/theme center and selection calls | recovered | high; direct app calls |
| effective paused fades | recovered | app lifecycle plus static `CCNode::runAction` pause path |
| retained texture rect on selection | recovered | selector invokes `setTexture`; engine implementation has no rect mutation |
| leaf count/order, opacity, world/body/fixture constants | recovered | high; `E-LEAF` and resolved vtable/data pointers |
| leaf draw protocol, bounds, wake/add/transform order | recovered | high; `E-LEAVE` |
| leaf position/rotation render mapping | recovered | high; `E-PHYSICS-OBJECT` |
| PNG premultiplication, sprite shader/blend, sampler | recovered | covered embedded engine paths |
| center sprite anchors and unit scale without setters | inferred | legacy engine defaults; make explicit in Creator |
| independent Creator leaf-world implementation | Creator mapping | must preserve recovered port/order and remain separate from gameplay |
| exact Box2D internal integration arithmetic | unknown/not claimed | only app-level `Step(dt,5,5)` boundary is curated |
| legacy RNG seed and concrete random sequence | unknown/not claimed | time-seeded shared draw protocol only |
| original scheduler `dt`/frame sequence | unknown | no runtime trace |
| invalid selected-index behavior | unknown | native path has no guard; Creator must fail safely |
| GPU precision, color space, framebuffer/device crop, pixel output | unknown | no original-runtime observation |
| original-content rights | unknown/not cleared | release blocker for original files |
| default clean logical composite dependency | **GREEN** | shared contract plus accepted Main Menu contract; static scope only |

## Strict non-claims and unresolved questions

- No original boot frame, leaf trajectory, settings-change capture, device crop, or GPU output was
  observed.
- GREEN means the static default logical composite is implementable without inventing shared-layer
  presentation. It does not mean pixel-golden equivalence is proven.
- No visible fade may be added merely because `CCFadeIn` objects are constructed; both affected
  layer overrides remain non-running.
- No leaf resource may be substituted from the bare `leave*.png` string group, reordered, scaled by
  profile, made opaque, or attached to gameplay physics.
- No continuous random position or floating `/32.0` conversion may replace the recovered inclusive
  integer draw plus integer division.
- No exact solver trace may be claimed from the app's `b2World::Step` call alone.
- No Creator texture swap may silently adopt a new Theme rect while claiming native SelectTheme
  parity; the retained-rect caveat remains until an explicit compatibility decision is reviewed.
- Exact behavior after corrupt selected indices, failed texture creation, or memory allocation
  failure remains unresolved by the covered successful paths.

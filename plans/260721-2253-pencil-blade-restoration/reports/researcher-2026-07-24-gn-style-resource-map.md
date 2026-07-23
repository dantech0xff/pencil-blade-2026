# GN Style Mode 2 Exact Resource and Particle Choreography Map

Date: 2026-07-24  
Scope: native mode `2` / `GNStyleLayer`; static evidence only  
Root: `/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026`

## Verdict

The clean-install GN Style route has a closed, byte-verified resource contract:

- **103 logical profile rasters**, each present in both recovered profiles, for **206
  `cc.ImageAsset` source files**;
- **29 `cc.AudioClip` source files**;
- **6 `cc.TTFFont` source files**;
- **241 exact staged source files total**, plus a present `.meta` beside every source;
- **439 recovered direct particle calls**, represented below without approximation by 47
  scalar templates, 23 normalized positions, six exact raster codes, exact float32 delay bits,
  and source-call order.

Every one of the 241 source files was reread from `game/assets/game`, rehashed, and compared
with `assets/catalog/creator-staging-manifest.json`: **zero missing files, zero byte-count
mismatches, zero SHA-256 mismatches, and zero missing `.meta` files**. The manifest itself
reports 862/862 recovered APK assets staged and `byteMismatches: 0`; this report narrows that
larger availability corpus to the exact mode-2 cross-screen route.

The contract is implementable without resource substitutions for the restoration's bounded
clean-install blade selection (`blade0`). It covers Mode Select, gameplay, timer, HUD, pause,
objective/reward presentation, result, and leaderboard. It does **not** claim that an arbitrary
legacy save selecting an advanced blade is closed; that explicit unknown is retained below.

Certainty labels used here:

- **recovered**: direct native body/string/callsite, reviewed committed contract, staged file,
  or recomputed file evidence proves the claim;
- **inferred**: a conclusion follows from recovered facts but was not directly represented by
  an original runtime observation;
- **unknown**: evidence is insufficient and no replacement is assigned.

No APK, native library, or original runtime was executed, loaded, linked, translated, or
emulated. Static bytes and committed text/code evidence were read only.

## Exact Closure and Ownership

### Raster denominator

Counts below are logical paths; each resolves under both `480x800/` and `720x1280/`.
Overlaps are removed before the total.

| Owner / surface | Logical rasters | Closure rule | Certainty |
|---|---:|---|---|
| configurable environment | 26 | nine paper backgrounds, seven leaves, ten themes | recovered shared loader |
| ordinary fruits | 27 | intact/top/bottom triples for fruit IDs `0..8` | recovered shared standard gameplay |
| score/combo HUD | 3 | best cup, double-score panel, score icon | recovered shared gameplay |
| critical cut particles | 4 | `Criticles/criticle1..4.png` | recovered shared gameplay |
| clean-install blade | 1 | `Blades/blade0.png` | recovered bounded default |
| pause/objective base | 13 | nine pause rasters, two objective messages, xmas five/four | recovered shared base |
| result/reward shell | 12 | score background, reward art, menu/retry states | recovered shared result |
| GN intro and timer | 7 | five GN instruction rasters plus time-up/freeze indicator | recovered mode/transitive timer |
| GN choreography additions | 4 | hexa, circle, stars, VN star; xmas five/four already counted | recovered mode-specific calls |
| Mode Select GN card | 3 | GN circle, native-selected combo description, description overlay | recovered card index `2` |
| leaderboard | 3 | shared template/title plus GN header | recovered item index `2` |
| **deduplicated total** | **103** | **206 canonical profile files** | **recovered** |

The six direct choreography rasters are
`Blades/Particles/X-Mas/xmas{five,four,hexa,circle}.png`,
`Blades/Particles/stars.png`, and
`Blades/Particles/VN Flag/vnflagstar.png`. `xmasfive` and `xmasfour` are also
objective-achievement dependencies, hence only four are additive in the deduplicated count.

### Audio and font denominator

| Kind | Count | Owners |
|---|---:|---|
| audio | 29 | Mode Select handoff; ordinary toss/cut/swishes/critical/combo; timer; GN music; objective; navigation; result ranks; shared app-shell music |
| fonts | 6 | score HUD, combo, timer, pause/objectives/leaderboard, Mode Select/result, result |
| **global-path total** | **35** | paths have no resolution prefix |

`mainmenumusic.mp3` is included because this is a cross-screen route closure: it belongs to the
shared app shell around Mode Select, not to `GNStyleLayer::StartGameCallback`.

### Stable integrity fingerprints

- manifest file SHA-256:
  `9462b09d39004366269b215e25ce61829cf9982d668d79c1940c0fbe10e4e2c2`;
- manifest-declared immutable source-manifest SHA-256:
  `0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3`;
- GN closure SHA-256:
  `594246573f86dbe37735db3339bee2141a71ff6c09a4bef34617c5e2778de3a3`.

The closure fingerprint is reproducible: sort the 241 canonical paths bytewise, encode each
record as
`canonicalPath + NUL + decimalBytes + NUL + lowercaseSha256 + NUL + cocosType`, join records
with one LF and no trailing LF, then hash the resulting UTF-8 bytes.

## Recovered Consumer and Lifecycle Contract

### Mode Select and handoff

Mode Select item `2` uses:

- the strawberry ID-2 intact/top/bottom triple already in the ordinary-fruit closure;
- `Interfaces/mode-gnstyle.png`;
- `Interfaces/object-combo-des.png`;
- `Interfaces/object-des-shader.png`;
- `Fonts/SlabThing.ttf`;
- the strawberry cut cue `Sounds/strawberry.wav`;
- `Sounds/gameplayselected.wav`;
- preference key `mode_unlock_2`.

The description path is not a typo in this report: the recovered native item-2 branch requests
`object-combo-des.png`; there is no staged `object-gnstyle-des.png`. The file named
`object-des-shader.png` is an ordinary PNG overlay, not shader source.

### Entry, instructions, and start

Recovered mode identity is `GetGameMode() == 2` at `0x0015166c`.
`GNStyleLayer::onEnter` at `0x00151a0c`:

1. enters the shared `BaseGameplayLayer`;
2. submits objective event `(6, 0)`;
3. constructs only `FreeToss`, `WaveToss`, and `ConcurrentToss`, all using ordinary object type
   `0` and direction `0`;
4. constructs a `TimeManager` with total `150.0f` (`0x43160000`);
5. creates the three simultaneous instruction sprites
   `Text/text-nobomb.png`, `Text/text-gnstyle.png`, and `Text/text-nolive.png`;
6. runs their recovered `0.25`-second move / `0.25`-second delay / `0.25`-second move actions;
   completion of the center GN card invokes `TotalTimeCallback` (`0x00151830`), which creates
   `Text/text-150s.png` with a `0.35`-second move / `0.25`-second delay / `0.35`-second move
   sequence;
7. completion of `150s` invokes `GoCallback` (`0x00151728`), which creates
   `Text/text-go.png` with a `0.325`-second move / `0.25`-second delay / `0.325`-second move
   sequence;
8. completion of `GO` invokes `StartGameCallback` (`0x001584bc`).

The initial cards occupy Y positions `0.6H`, `0.5H`, and `0.4H`; `NO BOMB` and `NO LIVE`
move left -> center -> right, while `GN STYLE` moves right -> center -> left. `150s` and `GO`
each move left -> center -> right. Nominal entry-to-start time is exactly **2.60 scheduler
seconds** (`0.75 + 0.95 + 0.90`); pause may extend wall-clock time.

At the start callback, in exact order:

1. `stopBackgroundMusic(false)` is called unconditionally;
2. if `enable_music` is true,
   `playBackgroundMusic("Sounds/GangnamStyle.mp3", false)` is called—**loop is false**;
3. `FreeToss`, `WaveToss`, and `ConcurrentToss` are started in that order;
4. `TimeManager` is started;
5. `InitParticlesExplosion` is called.

The staged MP3 is 1,791,164 bytes,
SHA-256 `00527f519dbed9df8eb046248557c75af46e52cc6a08dea9f9a00748fc7c2835`.
Static media inspection reports MP3, 22,050 Hz, mono, approximately 96 kb/s, duration
149.263667 seconds. It is therefore about 0.736333 seconds shorter than the nominal timer.
That it will audibly end before time-up is **inferred**, not asserted as runtime fact, because
the original action and audio clocks were not observed.

### Gameplay, timer, and music lifecycle

- Fruit IDs are the ordinary `0..8` set. Their cut cues are recovered as
  `apple`, `banana`, `strawberry`, `waterfruit`, `waterfruit`, `mangosteen`,
  `apple`, `strawberry`, `apple` respectively; a critical cut then adds
  `critical.wav`.
- The shared blade path uses `swoosh1.wav` through `swoosh9.wav`; combo tiers use
  `compo1.wav` through `compo3.wav`.
- `tossfruit.wav` is the shared ordinary/bonus toss dependency.
- There is no bomb controller, special-fruit controller, freeze trigger, or terminal life
  counter in this mode. Bomb rasters/audio, `freeze.wav`, Crazy special assets, strike markers,
  and Classic `GOOD/LUCK/GAME/OVER` rasters are excluded.
- `TimeManager::onEnter` still loads `Interfaces/object-time-freeze.png` and
  `Fonts/MotorwerkOblique.ttf`; the warning/expiry cues are `timetick.wav` and `timeup.wav`.
  This is a transitive timer load, not proof that GN can trigger a freeze.
- Pause calls `pauseBackgroundMusic()` when music is enabled. Shared resume calls
  `resumeBackgroundMusic()` only when virtual `GetGameMode() == 2`, so GN music resumes.
- `TimeUpCallback` at `0x001519ac` stops Free, Wave, and Concurrent in that order and submits
  objective event `(6, 2)`.
- `FruitFailCallback` and `BonusFruitFailCallback` each submit `(6, 1)` and do not end the run.
- `TimeUpFinishCallback` at `0x00151938` calls `stopAllEffects()` and hands off to the shared
  score display. It does **not** explicitly stop background music.
- There is no native loop/restart of the MP3. Replay reaches the next start callback, which
  first stops any existing background music and starts the non-looping track again if enabled.
  The exact quit/scene-destruction release behavior beyond these recovered calls is unknown.

### HUD, pause, objectives, reward, result, and leaderboard

| Surface | Recovered contract |
|---|---|
| score HUD | `Interfaces/object-score-{best-cup,double,sprite}.png`; `Fonts/Linds.ttf`; shared combo label uses `Fonts/GroBold.ttf` |
| pause | shared pause background and pause/quit/replay/resume normal/selected buttons; `Fonts/Arial.ttf`; navigation cue `menubuttonclick.wav` |
| objective events | selector `6`: enter `(6,0)`, miss `(6,1)`, time-up `(6,2)` |
| GN objectives | ID `42` “Score > 500 Gangnam Style”, sequence position 13/reward 870; ID `48` “No fruits drop Gangnam Style”, position 16/reward 1364; ID `43` “Score > 750 Gangnam Style”, position 49/reward 5962 |
| objective presentation | `objectives_message.png`, `next_objectives_message.png`, xmas five/four, `Fonts/Arial.ttf`, `Sounds/cheer.wav`; no GN-only objective raster |
| result/reward | generic 12-raster result shell, `Fonts/AgencyB.ttf` and `Fonts/SlabThing.ttf`, rank cues, reward factor `0.6`, persistence keys `gnstyle_best_1..3` |
| leaderboard | shared template/title plus item-index-2 branch `0x001588ce` -> path load at `0x001588fc` -> `Leaderboard/leaderboard_gnstyle.png`; `Fonts/Arial.ttf` |

The three reward values above are recovered by pairing the static objective-order array with
the same-index reward array; positions are one-based for readability. No separate GN reward
art exists. `object-medal-none.png` is the proved result medal resource; staged numbered medal
variants and `object-new-best.png` must not be substituted without new consumer evidence.

## Exact Raster Fingerprint Inventory

For every row, the exact target is
`game/assets/game/<profile>/<logical path>`. Every source is `cc.ImageAsset`.
Its checked Creator metadata uses importer `image`, texture min/mag filters `linear`,
`mipfilter: none`, wrap S/T `clamp-to-edge`, sprite-frame `trimType: none`, and a
`spriteFrame` subasset. A loader must request the sprite-frame subasset (the project convention
is the path plus `/spriteFrame`), not cast the raw image or texture to `SpriteFrame`.

### Environment and ordinary-fruit foundation (53 logical paths)

| Logical path | `480x800` dimensions; bytes; SHA-256 | `720x1280` dimensions; bytes; SHA-256 |
|---|---|---|
| `Backgrounds/paperbackground0.png` | 480x800; 161538; `d634be5b392cc1b36c18403addfa7d2794b0f637596b637704d11b2c7acf6283` | 720x1280; 197452; `5ee663012fe0b67e35fd44dd9023ddad673cca7bbaa016baeaa0e80eed84f622` |
| `Backgrounds/paperbackground1.png` | 480x800; 780605; `516df505b71cd29f9abeaace661c98a3a71baa9f2b2391a30eac50c3f47403aa` | 721x1281; 958353; `156198a9c1ad6bd7934b91c6fe481cd8eafffcca658f0e619ecae9996714fa8c` |
| `Backgrounds/paperbackground2.png` | 480x800; 461631; `0199ca3eef3477a4dba41611ca020db637cf2d19858706c08c133caec2490744` | 720x1280; 824287; `ae14a1ac62a293ce1023be3defcb0f8bf5660af34c5d1690635a4e8ef5cce555` |
| `Backgrounds/paperbackground3.png` | 480x802; 576735; `c062fa0fcea9bebaa5e74d3ce035b253836ca06d4ee7df8b89ae9e236fd52cad` | 720x1280; 1177571; `78d7196cc10f9aa5ba2a78492b02cea65fdcab3ffe56acf38d9f9d713c348c44` |
| `Backgrounds/paperbackground4.png` | 481x801; 479539; `8c8a55083c1a43cbb6d5e9222a51548d4debd79c915f5a710a44261485f08f93` | 721x1281; 1040557; `9c42b14ba55895a527bc62b7d3d645f4151f4e9e581a8dca21842833c42c5535` |
| `Backgrounds/paperbackground5.png` | 480x800; 356514; `ad94de28151fd06f21c8fb35c820ed5f907eb0a031556927548309fd71af1eb4` | 720x1280; 444778; `ce1af64fc3d206e4a02ac75b808983b0cff65f6a972806e6cc1fbc7e34b4bc2d` |
| `Backgrounds/paperbackground6.png` | 480x800; 291277; `c89a368a04d5b4006a98abcbd8ff9116893ce134cc70bc78a945841c1d9b4428` | 721x1280; 634890; `739f61c110c0bd2a0fe64afa118525998a782f356abf4617bb481a1a65875aa2` |
| `Backgrounds/paperbackground7.png` | 480x801; 711080; `9cde53b4dcea87de5dae2a76f8c11448de2bad87cd7ac48668a06d40146a8bbe` | 720x1281; 1671368; `7d84c39ef517eb55d973c3ac69a73d5e6f02f3a9d28c5d561dd505ea371d535d` |
| `Backgrounds/paperbackground8.png` | 481x800; 511050; `2482355de6e2408b113bdede9a173e7602bdcde0efc2d4d9ae710e6506bd324b` | 721x1281; 1002071; `cdec39865f994e3a9b61b997b015f998d011919849d946a37cb78b6b43ddc6fa` |
| `Leaf/leave7.png` | 75x71; 5506; `81e0350dbab6ce33a172bdb30549e57f8dec687c432168e97d66ca404f0c1359` | 75x71; 5506; `81e0350dbab6ce33a172bdb30549e57f8dec687c432168e97d66ca404f0c1359` |
| `Leaf/leave1.png` | 84x79; 3515; `64a7a8d44208ed22bf14c903b0e1faf8264aec9dfdc1eb8dfc0fa22b001a1bfa` | 84x79; 3515; `64a7a8d44208ed22bf14c903b0e1faf8264aec9dfdc1eb8dfc0fa22b001a1bfa` |
| `Leaf/leave2.png` | 69x64; 4415; `994bcebea40a2e375a6d4ba9119c7ab256323041777ce5900b39dd24588edf9e` | 69x64; 4415; `994bcebea40a2e375a6d4ba9119c7ab256323041777ce5900b39dd24588edf9e` |
| `Leaf/leave3.png` | 51x91; 7136; `cfc6f0b49b0461a3cb49fb10e822f909701cc5f282e18d7670f82176ac0c066d` | 51x91; 7136; `cfc6f0b49b0461a3cb49fb10e822f909701cc5f282e18d7670f82176ac0c066d` |
| `Leaf/leave4.png` | 74x71; 3815; `c091aace9ebe3038d51a975584e3845fd65a17d7574e6087b90eadfe8bee2846` | 74x71; 3815; `c091aace9ebe3038d51a975584e3845fd65a17d7574e6087b90eadfe8bee2846` |
| `Leaf/leave5.png` | 79x69; 3992; `afce7fbd41f9be4c06d84244714ce76d474994829aa78d84612156b42184dd34` | 79x69; 3992; `afce7fbd41f9be4c06d84244714ce76d474994829aa78d84612156b42184dd34` |
| `Leaf/leave6.png` | 66x70; 5069; `d51294f17f57343b045d0ee0692c88970c5a26d2b631ccde5101c07c093de1ff` | 66x70; 5069; `d51294f17f57343b045d0ee0692c88970c5a26d2b631ccde5101c07c093de1ff` |
| `Themes/theme0.png` | 480x800; 2655; `bcb7ea9a57bd2540ce3a47cc6c2d0f344dc3b784dc5c266217bfe9d6ad5a81fe` | 720x1280; 5693; `6ebe1c974279189ac08a752b1d605031dd6126bf832e5a38c616c7c7cbc6557a` |
| `Themes/theme1.png` | 482x802; 39019; `ba12da2ab46f6f1c141cc83cf6661a82d14c6a29a0d2d16b635d48cc4f5ed778` | 720x1280; 98661; `eecc8944cd7911562d8e4ece3ec2434e2c71ef5c947737d97a48ff0916cf6912` |
| `Themes/theme2.png` | 482x802; 29809; `69c50b8a2f93fcf1474c99706f320a539714eab1976f010e0074d8f6dc00aad8` | 720x1280; 99072; `6096db1dfcaba4d0c787ad6330806fa1464aaf67c4b0be6880c1ef9668f7a3f7` |
| `Themes/theme3.png` | 480x800; 41586; `3b990eab59980a5a1ba17363345784a0327dc1056919869abcfe01979d62f4d7` | 720x1280; 73310; `af47d9f631c5eb062e74387b14fa2ec59c5a069863713db9b92d1d43b5c5a44f` |
| `Themes/theme4.png` | 480x800; 42901; `3e57af3ca605531afb20bd207fe715f94b2cb7d53dedbc7bf65e00a86b7add88` | 720x1280; 82971; `a2fa5dfd5b795c251b868f92ab9705a43350b20705393034f51101471dfc6b2b` |
| `Themes/theme5.png` | 480x800; 58290; `c26bb488987290e2c3dd1e6882ffd4fdaf9cdf458ee2e893da2d0dd1775dc7a1` | 720x1280; 102866; `6dcce23f49c1876667f67c6a9008215f8a9953d6057bf25212ade1439e9f2aa9` |
| `Themes/theme6.png` | 480x800; 57876; `26fbf327fa5e448be5e8b05bd5e345a7329e2ed3dc1026e951ab2e096951eae0` | 720x1280; 101175; `3e5dfa9b74b099c91a557b5ac1ef4cba72e2badeb8fb07f24ba78e0cfec872db` |
| `Themes/theme7.png` | 480x800; 41359; `457c0299e86eddd3a757807bc2891bab92e372536ae1b23f9cda21cc92baa88e` | 720x1280; 81689; `b63b32714088c963f55aba7298133c58e1bb3b3ff4758fff1fe2d3712ac95be9` |
| `Themes/theme8.png` | 480x800; 41389; `b5e40e016748894cf272dec8f15cc35c0164dfae1bf1296cc6325c5d7f0438e5` | 720x1280; 81645; `0c670aff9aee6bb8edded64d0049af2bc178967f9c4c29c5f8febc7d3d85d596` |
| `Themes/theme9.png` | 480x800; 57025; `f504a59f7c25cd5bb8783cfc069da26e0ab502dccfb895d7bd60614f5e06938e` | 720x1280; 103925; `0daeaaf2ffb40b80a6854faae545c52ee6af9883769de048ba1aff2b38505264` |
| `Fruits/fruit-apple.png` | 96x82; 2639; `6f47c1c82009e90e3bc90715d7b6ee1184883612c3574b3c9f224ab18cfc4141` | 143x122; 4153; `ba4b4a535637f558eee04c4afee0b4632366edaa9eb235e3957c965b74ded7fe` |
| `Fruits/fruit-apple-cut-top.png` | 87x50; 2335; `440870fefa4db756f5c3f187760ba8530ba1668ee0b310215c79529467481d4d` | 143x69; 4220; `6077fbfdaa76ed8a7b7c4d2cdcc3b96168f3437692957930c060c453288b8767` |
| `Fruits/fruit-apple-cut-bottom.png` | 95x47; 2748; `c4783047e149dbf2a58d0908910934280377033398139cf71ce5b332e0518de0` | 131x74; 3625; `01570fa99230bb994466c036d8735f529044184eac643dac9b140c344c57f72f` |
| `Fruits/fruit-banana.png` | 60x154; 3709; `23889a19a75593747249c9aefb2a6effa9fe895f54c2c5ffe413401d99b59f52` | 89x231; 5855; `8de4a62343f9cff24ebe93a66ba07b6d5d245c145d5aa4544fd63663507baca0` |
| `Fruits/fruit-banana-cut-top.png` | 60x89; 2532; `8dfbe1ccea6da7a51db359728eac3ed791bf0f43a1592083a24e12af2089bfdc` | 90x134; 3953; `26e0544c13a22c166b7026630cbfafc437f52ef43dd050ce5d72fbe6f791ece9` |
| `Fruits/fruit-banana-cut-bottom.png` | 46x78; 2134; `051f40d6e745a656194ebcfbc8083fdf0125db518ee3c6617d16200ba67ab516` | 68x117; 3336; `762ca10d38058a0de40565d24c929d5770dd9b1082270f4ee3717ba4bf1a9a65` |
| `Fruits/fruit-strawberry.png` | 83x64; 5026; `1991fd57ae00c6fe41b5083ce03cc376774a42b7ef74f02cd06d22ca510a7a8e` | 125x96; 8044; `89e61c143c3d84000fb9e6ce85a9934d14e4460e59cf4bdc224187e51ab4123a` |
| `Fruits/fruit-strawberry-cut-top.png` | 84x39; 3112; `f38d739c92eab9b7dc469b5f242bae5d5f10aff00bb0c53609e25e14127691b7` | 125x58; 4757; `69eadcbd9b60c837b722c392b531c941bd1879011e4698158426e3316dac3b4f` |
| `Fruits/fruit-strawberry-cut-bottom.png` | 79x36; 2882; `c379b74512416c95ced17050894c2e1e25210376fe3fcb6413f28d98b75ff5b1` | 118x54; 4433; `3118848ec358a426f5803824ab8922bb48f6eb274c5e70aac7c063cb0e5bd042` |
| `Fruits/fruit-watermelon.png` | 109x144; 11141; `4e558ce59353d7a70731ff9c6046515cf4057e1dc4c91eeb470475505b41d2ae` | 163x216; 18819; `9bee3f34a2b11de7fce343f3ff0e9839513e92e1c2363ab4435c19fdcf794b9b` |
| `Fruits/fruit-watermelon-cut-top.png` | 107x87; 9059; `59cdc11746a82335d1b408b1f793e9c8177326f2ebb3f1a23bb75e21a4e8109e` | 128x136; 13667; `78c7bd5aea44709cb0aeb4923018274bc70dbd6c332aacc3465fcbc33a5c9259` |
| `Fruits/fruit-watermelon-cut-bottom.png` | 77x77; 7366; `5051fba2b9f9be09ba5253221bea2215e9fc9151996d167015375f5db5686f6a` | 130x88; 11244; `5784d73b543f95e0e1eb0e332c0047f8022ecd3c0fc3a95f8685280971e06bcd` |
| `Fruits/fruit-pineapple.png` | 84x158; 7060; `e76de820e59c05cef76bd3320953ae52f6a555b93ca6b74eac303862130524d8` | 124x235; 11127; `0702274c4b3e191eed71472856230af776491089cfeeff41f1a04119944f8bea` |
| `Fruits/fruit-pineapple-cut-top.png` | 84x123; 5012; `5379782e4b47d9f860eb13d9987aecb8be8d8ed5db1fe9df077aceb6187e4a3c` | 125x184; 7765; `de832ceaa3a99d374551db3a7cdf77ce8571212211337a3711a48276b9108fc9` |
| `Fruits/fruit-pineapple-cut-bottom.png` | 80x56; 3539; `14cdc9baeddda234fb69925c642fc95ea257a4c94bf2dce5d50b3e012af688fd` | 121x85; 5585; `2126d60d8b3fd3aabf58b58f416fcd18a2980492a45bf5e9cbcb4d6d9b4deb64` |
| `Fruits/fruit-mangosteen.png` | 67x95; 3632; `e5541d9f44b189e57309b68ab71f63ca9fe98a4a43a9eb1c93a6c3767207591c` | 98x142; 5944; `64f450a386da3c1053706f2467935145f33f8438472544cfe13c63b790f13b46` |
| `Fruits/fruit-mangosteen-cut-top.png` | 66x78; 4767; `c640e3ae04fbb425bd55b90198f8bd261b26ed726b421eaf1ad9e5e94d172367` | 97x115; 7695; `41e7b878fef8d7a7c9f8678c06e252c7ab15aeb7d9d52cfec7a2e812b5da6426` |
| `Fruits/fruit-mangosteen-cut-bottom.png` | 64x46; 2795; `40b43e4555752524884740336f8faf76fa2e8c046e35310a1b1cf5b9e74baf1c` | 95x67; 4216; `ce15aa4cf47370a7fd9ebfbf26de41ebe2b240cad3137ed20d33aba77eb7e8bd` |
| `Fruits/fruit-kiwi.png` | 63x81; 1845; `bb8beb412e0930f18aa173b7ee7ff7d816851cbf155944ab08e337904b33135d` | 94x121; 2846; `2bc35448efd47d9759407dfa737b7e57e0f9229b42a8b54c60fc6e4d1192dfd6` |
| `Fruits/fruit-kiwi-cut-top.png` | 63x58; 2547; `b33292604c112cc8ee5c5fb9f72d0009590638ca61a85e65905ec4e0f002ac63` | 93x87; 3758; `d9b8af8c090a450367c42ff37a1e0177d1fb842af7275eb14b371981bdbee876` |
| `Fruits/fruit-kiwi-cut-bottom.png` | 63x54; 2403; `72f93f63d4cfa15f40c90d4fbffafd243258fdf47f63db9a562ab0b311944f8d` | 93x79; 3698; `83f4ef05958ab955a90973573db51188b1beb48bfbc8d24e9a11d83e9c3f8a2f` |
| `Fruits/fruit-orange.png` | 75x101; 3672; `8caf426c186bd196e9b399a595d4785c9e8d3eedc8ad52b71613744b0672dca0` | 112x152; 5789; `fa33effb649262118d2cf76568ca5e1709af99bee294d8e77decb308aaac4eda` |
| `Fruits/fruit-orange-cut-top.png` | 74x80; 3996; `1e10a0d6093f6e762ee16bdb6412194e556a58813c42d4bd1c3521d31e7a31bf` | 110x119; 6184; `1283c20035ce66fc90acf60da526245ede386ae5dfd58cd519e5dc82ca098104` |
| `Fruits/fruit-orange-cut-bottom.png` | 73x53; 2586; `6dc54537c738298510f8ac4b86ab36bdfbab2b2c5e850f44326cb7c097d89f93` | 110x79; 3961; `05abb81a30cc533ac762683f1a88bc509d1b240df1e6dedf149659891536a56c` |
| `Fruits/fruit-papaya.png` | 138x67; 2413; `f23e647a8dd8d9faa6fe708083f7b2a9f57272143a581819aa76c0dd9cde5a8b` | 206x100; 3695; `fc84de59c9926212e53b36644b1356aa8081bcfe2df2e60ed127fc5cdda11abf` |
| `Fruits/fruit-papaya-cut-top.png` | 138x44; 3059; `d16fc51b7e7864242db32a766dd82314d8a0f7e4d1d67bcfbbedf7e9ffdd0536` | 206x65; 4685; `c41b1fd5f895ed07704115794362d093d3786e5aaa5cfe8caec5744ab36f0862` |
| `Fruits/fruit-papaya-cut-bottom.png` | 138x44; 3076; `358eb745e96ebb9cc3e1da5af016b069c49541b64eb185b723c3026c6a0ad245` | 207x65; 4764; `b8a8d33e40d074fa19b5441916ed97fecd8eb282eb80fee69e9491cbe999f229` |

### HUD, base, result, GN, choreography, Mode Select, and leaderboard (50 logical paths)

| Logical path | `480x800` dimensions; bytes; SHA-256 | `720x1280` dimensions; bytes; SHA-256 |
|---|---|---|
| `Interfaces/object-display-score-background.png` | 442x407; 86845; `860962affe9635df45f2ca7441a3116dc6a2b0015068f4983413e5693fae569f` | 662x610; 145560; `fdaad0e3fe4919cf6427e5e2288ab0c20b89f0aa325e02a6eb36aa29e69277c5` |
| `Interfaces/object-bonus-coins.png` | 130x129; 7871; `cede63fa0fe6576c97fe158c24811ddcc4c874f0c3e39ca652b9e47acc60b848` | 159x157; 11977; `e222cb70d479fec385a25f5abeecda28be72ae7ac6b69ac996acb5059fdb45b1` |
| `Interfaces/object-bonus-coins-effect.png` | 229x229; 18658; `ffc86db1583dcef64d49e5ad57d099a171e67776f32c83ebfb0d61f1d5d3ce3f` | 342x342; 28832; `709ecf0bb139fdde865d335ddf05da90169c5069a53c06ede1b174b0cd262779` |
| `Interfaces/object-bonus-particle.png` | 48x46; 1698; `b884e721f43845248978b005ecc9cf380d03a00422638930ee5ffedc32a7d525` | 71x68; 2664; `7463f20e40c08301ad0e793200873b7bec30afcefab8c635fed3afae61fa066b` |
| `Interfaces/object-coin.png` | 34x34; 2108; `b90cda92dd9d39dd58a7b7b5a3f6b22198ef5fea5bc684fd422c3a7cb73b43d9` | 50x49; 3491; `9d0449891a3b6c0f59da1a7081a44bd5158eb26be31bd0570393bf8929fa836a` |
| `Interfaces/object-mode-results.png` | 552x118; 24455; `d74878218b7fd3c34944d13eefbe0d2998fb4fb1d93adfe7d00a199842631059` | 792x159; 41496; `17959f2648d116ef6249d5f2fbce992a1970cdbff3a16e5eaee91c2c5e71e5b4` |
| `Interfaces/object-medal-none.png` | 104x209; 5514; `1e35b3588afb2df023a4e1d4d8ef773f39613d87943025c3cb864d5e91a4a09e` | 154x314; 8193; `234f4eb01c0fea19bea6c2f17b54cacbf8c5fd7da722303bcf66878560e42d2e` |
| `Buttons/button-menu-score-normal.png` | 134x129; 22572; `6b0d4944955dc73d958b2593f9d45a154687ce0df0e75a5cd978da7724a23de0` | 201x194; 40631; `6a07698f971dc0e6168ad2e503233cd77a00d8ceb5eef237c05cdbec619ddbbd` |
| `Buttons/button-menu-score-selected.png` | 134x129; 18848; `234b511f543be468e5030ec1d626d88fec5643a403347ff2a4ace25c9cbe69f9` | 200x193; 34787; `ad7476c7254079ac0f4309f77804d872ee89bf2244b746051d95bbf3a351aa6f` |
| `Buttons/button-retry-normal.png` | 111x105; 21043; `e9d1354254cae0d93da13538bc75cbd68cc562b19a00d85f3045b64ef8df084c` | 167x158; 40754; `fc93fe200ee5ad3df927e94b814d59c8cf510637f4ce601aed7d7a5eaf72fdbd` |
| `Buttons/button-retry-selected.png` | 112x105; 22527; `9f1c50de8ac404083e6a7a3c08a328f8747b06327503a84f8c2c97418b34e391` | 167x158; 43117; `4b4b1c9b14f78b77be93922b8eecfa931d9afca52c4fe985e86df2da45926f11` |
| `Interfaces/total-coins.png` | 334x131; 17406; `1deacc8db298095825586bb60857d6c6e70894f6f4783de81967bdce517ced30` | 464x160; 27907; `0254cb29e6b68f2ed13903803f2415e1808265e5798a39352ad015a1ec69cab1` |
| `Criticles/criticle1.png` | 35x35; 1205; `795fdc1cc67d166c0303b5836a5dfed5e555cb2ae008288c04fe2cbd28295d13` | 52x52; 1772; `9368f56bebb80bfa850470fb4d8e2f53a05d4438e0c8c1cdea19ea6562a0551d` |
| `Criticles/criticle2.png` | 51x51; 1768; `5bfe7d3ac2db922d68c915f83cca4c2e0deb2d4200d8bf07c1a8020c0a4b3cab` | 77x76; 2880; `0b62903f2a1528106f82f32cc6ac54b4fcb61c7b80945a09831f4bebc781de4f` |
| `Criticles/criticle3.png` | 44x44; 1488; `279f81edf1e9b7f48c835813531655a07dee00da48a88b32f8c9774a57a5b37f` | 65x66; 2391; `3e47e74684265d910905217dce8687239a55879bd88b1ab1443c13333bbf3e36` |
| `Criticles/criticle4.png` | 52x51; 1774; `9a4d9a905842c72f52938ec42839ce4e845ce4c6a8a7e85e730928e01e1b929e` | 77x76; 2919; `1041c00291902141beca15da254f8aa21e4992dd71063aaea764d7df7a55abdf` |
| `Blades/blade0.png` | 256x256; 634; `32713af6c40cf4e9a0b48e87fed53c37cb32818b14143020db22787c336559d8` | 256x256; 634; `32713af6c40cf4e9a0b48e87fed53c37cb32818b14143020db22787c336559d8` |
| `Objectives/objectives-pause-background.png` | 552x206; 51762; `eecd45a1fd6cb445049ef03a7c1c00916dc4b476a6e8416a33ee4f6e405eb28a` | 792x291; 90608; `a6a5e9521b14664942d1df259b0028dd9035706d967b7d892db363d9ef1c4800` |
| `Buttons/button-pause-normal.png` | 38x38; 723; `898f029601abee4d2ecd4578db0dbbd2c9a4edd199275790fa1a2799e1f82955` | 57x57; 969; `4110130fbdc80b4afe527e71a2525db8c04aaf2567b49276ad19c69606a820ee` |
| `Buttons/button-pause-selected.png` | 38x38; 681; `c20b8de5c15dad58742d2fd1f236a5c6843d5bf7b8436bab6c996490cee95d6e` | 57x57; 909; `d9b4c69c2f302eaa73842689e1f158cb4c8952f9d2a8140fe73c25a7e1b38201` |
| `Buttons/button-quit-normal.png` | 156x166; 10279; `2ac6aa0a71e202805beaa0c28cddf5886289c99cfce70fde89071d626390e2b0` | 197x213; 20648; `ffb5b49fbaeb43ca983c0136b78506c890db08e41fe5ec7036d0e4a47652dd09` |
| `Buttons/button-quit-selected.png` | 155x166; 10348; `565cbe5c397cd29fbe0be12e9396289eedaa64b6c67a50cf657568b1c1e98a3f` | 197x213; 20658; `2e694d146d7f58a126ba534f07a29a4b82a9e6e9c215e71c4ab748844608c79b` |
| `Buttons/button-replay-normal.png` | 92x89; 2183; `658fa662e185b4180821314f4166797ce801c369329cf2cb8699718d04fd56b3` | 138x133; 3119; `19989c8a1a2ae583e7dbdaef5b451918ad006a5c22476a62da3dad79766cf09e` |
| `Buttons/button-replay-selected.png` | 92x89; 1906; `20c6ca783e59ea2f0796f1d25c13d5fdb16b58257f38874394e476104449f28c` | 138x133; 2710; `785b36174817571e388208b455d07785d7a5d7575df1bf46a3ca2e6a37e5cfb8` |
| `Buttons/button-resume-normal.png` | 92x89; 1190; `4fc4fcfbb928279c4fa7ec67df66496022d68aa6368da5bbdc303952e8fe918d` | 137x134; 1633; `22b85847e66bf81efd873d6c463c4f22cd6b0ff14b277918db1b2eb1f6d53030` |
| `Buttons/button-resume-selected.png` | 92x89; 1100; `b40e4d656089818319d99cf16406421f3973dd92ce0c9da97b1d060cc3e0230c` | 137x134; 1486; `34ae852826c656ed4389e79afb51a940b39d28c247f449e76eb01c7a60d44e4d` |
| `Objectives/objectives_message.png` | 552x138; 45107; `98e2e5be34f722ccc0b596e165c0e57ca4c2f455de3b241c3ef652be43e89ba2` | 792x181; 75966; `fbc6cd76fff4d9e0a14f66f05b539e92a69a3b4751141a08747d773511b6a741` |
| `Objectives/next_objectives_message.png` | 552x132; 36482; `627ec979556cf5ff9b6b1dcd8f52d4904b7dd095f09235b9ebf88aff356b2174` | 792x180; 61617; `dec3896378976676b9a0850d7c9a56cb9fdceda3528fe85916ca5ae88b1d2384` |
| `Text/text-go.png` | 70x31; 1672; `f21d11c77a670ef73bf765b87f87df77aa061fdddb461d6b5b6e17054c8f636a` | 106x47; 2371; `f1f217f37199b736465fd392339fc6f4611591eddd5d16faa198b9bbe3f6191c` |
| `Text/text-150s.png` | 192x34; 3327; `3f18081e5b65cbaf8eba004ac713a79b45715c1ade45a2a8bb83daeca1cb150d` | 288x51; 4878; `568410a8718058a24a6c6e3da0398d339cc168d5a47804213488342713e12520` |
| `Text/text-nobomb.png` | 231x34; 3693; `b6a8f50b6ff0cd90f2d20a729f0e50929f440de8880b6da8354a2498a6090cf9` | 347x51; 5397; `2f369a6a895540b822432d72077ac59859541ab8c3d788410cdc25b5c824a412` |
| `Text/text-gnstyle.png` | 342x43; 4502; `02f0307644639c0268d61961821dc5de82800b851b174edf5b9c582806944f68` | 512x64; 5474; `75da38521f9a4912d3de3dc3814ae39e5a9709d618a2f1774b6b10a0dc51aaed` |
| `Text/text-nolive.png` | 190x32; 2914; `a4a089e70fb0c59d6744bc8119321285fb06e43ae01037b7b3734a1ea4013848` | 285x47; 4101; `3e4307e819db38c31130e84054bbf4ed77cac121fa067d9268be179444648dea` |
| `Text/text-time-up.png` | 345x135; 13675; `64459f6fe18b22f35269adf3f27a01a369fee4899a5437f132545bbdcf8f9980` | 481x165; 19750; `4a0f07207a1e5c34c5e374a56537cd0b7415f9fa9ec32763c43b5284844fdac2` |
| `Interfaces/object-time-freeze.png` | 148x85; 7711; `1370c725709262023dfae741844ddd55b7574f39527aacb1206a27c4a21b2446` | 222x127; 11914; `7c92dc89735e21af9cd74ef3e9ef3035707e8356e07e25a443e78c79610537a1` |
| `Blades/Particles/X-Mas/xmasfive.png` | 46x44; 1029; `2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2` | 66x64; 1408; `a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3` |
| `Blades/Particles/X-Mas/xmasfour.png` | 51x59; 914; `5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385` | 70x83; 1216; `7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39` |
| `Blades/Particles/X-Mas/xmashexa.png` | 32x36; 800; `36f8ce97327c768fe14e1169672bf5a53147fdb314b086d9559a38631710bef9` | 47x53; 957; `cc4217637576b6c7bb0c92d400905058e952c8bcded9fa90ea4423637d5a89ab` |
| `Blades/Particles/X-Mas/xmascircle.png` | 34x34; 869; `97f32efcd79fd577a2a23bede4724f8df0e6ccf4a331fdb481b9bad8622525c8` | 49x50; 1196; `a5f33bf414f4e4c31fe2bea1ea66fbc6f52a8f495ac1436fb0e6a237b515719e` |
| `Blades/Particles/stars.png` | 32x32; 1082; `dc6d968ce3bb0dfa70bb0a05da6833056698343f934a240357615beaea78cc0a` | 48x48; 1238; `b51b643f7d012dd964443f9193a0a4c555a59580091208fc0d1fa9c2b4ed9072` |
| `Blades/Particles/VN Flag/vnflagstar.png` | 54x52; 2992; `c6f7e09500a94361ba7bf91d4839690c7dd2b29d1e49190609fa2af5301c7174` | 78x74; 4595; `9c2faaba7057d5fc012add2a7f2f17a341858165daa28d56b70b0a0a9c23ded0` |
| `Interfaces/object-score-best-cup.png` | 49x52; 4203; `00c231bb956b8c72b6c85fa4677f8b05d0e8e70b7f04d27cd20fefeda52860dd` | 73x77; 8092; `ceabdb8a482553fcf128ca634bfc466bb50ab66ba93333c709a369777a6b9aff` |
| `Interfaces/object-score-double.png` | 134x115; 8540; `06dd5803cfa178111dd58fbdcbae9f69f0fbed76e578c3ddeacaf277dbb50682` | 200x172; 13564; `ca2be40ffda0618813566fe77b3c73a5622c56cd8b57dd940952c162954da6fe` |
| `Interfaces/object-score-sprite.png` | 55x55; 4695; `cd84d48eb064f7827b238f0b30b6eff9d12c573c9dc2b15dfd137c8590d049a8` | 82x82; 8220; `0aedc989c27f1f80398389ac11da65e82cbd4990747d8fc16207702636b74f39` |
| `Interfaces/mode-gnstyle.png` | 216x225; 36942; `927c7948fd98d1ba0227ba48ab19879d59454e5969be49eef22cd497664b5616` | 325x338; 60869; `c77627821bb9cace2b3be128932d48b3ee001bd0c0e0af8ca25ca4c81a26bc9d` |
| `Interfaces/object-combo-des.png` | 149x202; 18692; `0e2f624a5303602024969707b38530fbf4c1e9744e06b7f96dcc78c4c0a765b5` | 223x301; 30464; `ecc6f167f4ea74f75bba105a3ec39c109c2b381755d18f1b4e263927f719f37b` |
| `Interfaces/object-des-shader.png` | 217x267; 4255; `f0683301f7ee1357eef5d94242d230aa6c95774316d32bccf18c22047eee3408` | 290x363; 5442; `ee6f6f5a019d9108a9d832c4a1efed41b56de1c73421eb9e865c54b82bf9e079` |
| `Leaderboard/leaderboard_view_templete.png` | 540x586; 32237; `37ab4c425142a96e8cebd7187cb765dcc8ca72d38f1f573628850cc6f6877311` | 773x844; 51495; `047b9d88999ec7e6e5c3f335880fa0b807fa02b843aea7a47c62910dace44e5b` |
| `Leaderboard/leaderboard_title.png` | 552x118; 26737; `c7f7af4d248120b5ce6ad46d14001c4654c91cb1cb5d468360d8c0ccd7eb6095` | 793x159; 50708; `696ee696db62266e7c218d762c32f0fc22694b9551518f43402eb479b84ab104` |
| `Leaderboard/leaderboard_gnstyle.png` | 466x115; 8073; `a8150f9fbca4b3824a684515db8b4e42808e212d4f988151b84e233e2a35a2d0` | 663x138; 12309; `c0ca921ff65d80d6cc0e6c011614e79cbd7f6b50153a9e7f181fdfa0f919c2a5` |

## Exact Audio and Font Inventory

Audio and font paths are global under `game/assets/game/`; dimensions are not applicable.
Checked `.meta` importers are `audio-clip` and `ttf-font` respectively.

| Exact logical path | Bytes | SHA-256 | Creator type |
|---|---:|---|---|
| `Sounds/gameplayselected.wav` | 132344 | `b1826f8db97e2517363ce1f7a385181867be33ff55828fe1baca75d1227f9a84` | `cc.AudioClip` |
| `Sounds/tossfruit.wav` | 34256 | `02f50b86a21d27380bd8507fe784eb03d4ab7676177289e51ede140dfd3008ec` | `cc.AudioClip` |
| `Sounds/swoosh1.wav` | 8130 | `d67be303b242ad8b7ce65ee32803307ea5de2639ef66482cb35f68dfc9959645` | `cc.AudioClip` |
| `Sounds/swoosh2.wav` | 11760 | `512cf09e1662a949dcde847a13a70d1ae963ff1e8a424e16d6f8c06d9cf5a806` | `cc.AudioClip` |
| `Sounds/swoosh3.wav` | 7934 | `169e9140ef37f4387b9075e463957a4d6ed67c5693dd35f1f537e3a7dbe74d65` | `cc.AudioClip` |
| `Sounds/swoosh4.wav` | 13044 | `96b78ac722d24ac5f6cd111a38273cc4c61d72f36f61781c205bebfb3effa8b8` | `cc.AudioClip` |
| `Sounds/swoosh5.wav` | 8790 | `8a54a959f01ca5bc0a74d9fc2c890be8720a0aa5f4b7caf6b973720fdf51fe63` | `cc.AudioClip` |
| `Sounds/swoosh6.wav` | 9120 | `a2dae1bc753734a08e5ccaa54ebbe27d8bfa50cc28bf52fe903c686e41ea0005` | `cc.AudioClip` |
| `Sounds/swoosh7.wav` | 9318 | `4e59b6c040248fc4b1ec80e8e67cf9a2cfa9725cc59fa9f382d3491b50671c14` | `cc.AudioClip` |
| `Sounds/swoosh8.wav` | 6678 | `4b25e4148721eeb4ccf340086f7ac91693366930928aab757ea3ec8e97bdff83` | `cc.AudioClip` |
| `Sounds/swoosh9.wav` | 8064 | `3652ee7698bf4d138dc0eceeb07a0de4e9530304f71047301850b5fd20f03be9` | `cc.AudioClip` |
| `Sounds/apple.wav` | 10364 | `7565f786f0bd0bbda14d646c2c33993941ee7869c588be836c1eaca96ba5cef8` | `cc.AudioClip` |
| `Sounds/banana.wav` | 9964 | `f3ce9f1f6626b7657a7036fd96d8448ec1211ddc5f0102ddef327b66ef931d99` | `cc.AudioClip` |
| `Sounds/strawberry.wav` | 10284 | `b612419c6046ebe49666788fbc84787494667bbfcc121f21a242d9e13bc69a59` | `cc.AudioClip` |
| `Sounds/waterfruit.wav` | 21230 | `3bfb719eceec48c72d46b41c9f104bf64be208867ed65e118d12fdaa22e1122d` | `cc.AudioClip` |
| `Sounds/mangosteen.wav` | 11052 | `0e93927c2044446d69c8b591818cd54294dbf260454204bda5c32a7ade5128e6` | `cc.AudioClip` |
| `Sounds/critical.wav` | 67556 | `7d52ee66628f1c68b20e91e8951907a0ba752e3962926c9aa7bc8a6b6fea6274` | `cc.AudioClip` |
| `Sounds/compo1.wav` | 100396 | `8e0c323412ef2cc3533ad01d2c4b581fd70d39591d64a6bed2e1ab409f8573e6` | `cc.AudioClip` |
| `Sounds/compo2.wav` | 108588 | `1dccd63d5245ba4571cf5fbd7e76ef92577b6e848fcc4f654a539aa1b94674cd` | `cc.AudioClip` |
| `Sounds/compo3.wav` | 111012 | `1cd9b381083cf58149884fa17c13bbca9748545c6dfb9019b5c33fea5274800d` | `cc.AudioClip` |
| `Sounds/menubuttonclick.wav` | 32812 | `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e` | `cc.AudioClip` |
| `Sounds/cheer.wav` | 188974 | `0310b925d91ddb256c75734f79cd87109c5418a702c9eaa458b59ac3a9aef7c0` | `cc.AudioClip` |
| `Sounds/mainmenumusic.mp3` | 718785 | `53378d6d153e22fa9b0b5a64c8c130e58f0c3ae649ad3750e921d839c45151a1` | `cc.AudioClip` |
| `Sounds/firstplace.wav` | 132740 | `d43b5ebe31e29731663e9ab59c58999aebdb878f45a05494db497e68ce4042ce` | `cc.AudioClip` |
| `Sounds/secondplace.wav` | 132440 | `46a4c7592b76f43ae27e5f1c1d26c375cd5932ba6d05c1b4faf424e23845f75e` | `cc.AudioClip` |
| `Sounds/thirdplace.wav` | 135516 | `0c99344e9fef8ec77908b1a0359e4723b340b46b28de27483e8c1bc117406fac` | `cc.AudioClip` |
| `Sounds/timetick.wav` | 2750 | `acf564fde19b01789be4edfd563e5f35ddd09300658152a30bcb0c352eb89f31` | `cc.AudioClip` |
| `Sounds/timeup.wav` | 92584 | `6f0d4f2dbaf882087694191c72cf386f86671a5d754b4c6605b1474c5c24ff81` | `cc.AudioClip` |
| `Sounds/GangnamStyle.mp3` | 1791164 | `00527f519dbed9df8eb046248557c75af46e52cc6a08dea9f9a00748fc7c2835` | `cc.AudioClip` |
| `Fonts/Linds.ttf` | 67068 | `1b2b53f71f90afe4465d22ee31537adbd5d30285145419508f6202a2f1797729` | `cc.TTFFont` |
| `Fonts/GroBold.ttf` | 25388 | `98e9c349709da1cd410d65b2954d30e355c154a8ea52004ecbe6eb0d8205d040` | `cc.TTFFont` |
| `Fonts/AgencyB.ttf` | 60656 | `4fde694cc486b55266f7561c685fbd9153ea0003f0c0c39fc744b132051d40c5` | `cc.TTFFont` |
| `Fonts/SlabThing.ttf` | 161488 | `9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8` | `cc.TTFFont` |
| `Fonts/Arial.ttf` | 755624 | `b97a1e2bb9fedbf9aa99f6b14ef5a7f057c6611dd71698381cc44f77797a4223` | `cc.TTFFont` |
| `Fonts/MotorwerkOblique.ttf` | 21908 | `79e1421be053bcbdcbb729f1757c68e063da4790fe4bd2862db3b7cdad348a34` | `cc.TTFFont` |

## Exact 439-Call Particle Choreography

### Native model and decoder boundary

`GNStyleLayer::InitParticlesExplosion` starts at `0x00151f74` and is 25,926 bytes.
Its static body contains exactly **439 direct calls** to
`GNStyleLayer::AddParticle` (`0x00151eca`). The first callsite is `0x001522d8`; the
last is `0x001583ee`. A comma-joined lowercase-hex vector of all 439 callsite addresses has
SHA-256:

`2cd164dba6dac91553f05205105bb0eb02b1534756c16fefd1e1fe1582672e31`

The recovered helper signature is:

```text
AddParticle(
  int moveMin,
  int moveMax,
  float lifeMinHundredths,
  float lifeMaxHundredths,
  int baseCount,
  float delaySeconds,
  CCPoint position,
  const char* rasterPath,
  bool perParticleRandomColor,
  bool batchRandomColor
)
```

Recovered behavior:

- multiply `moveMin` and `moveMax` by the mode's movement-scale field;
- multiply `baseCount` by the mode's count-factor field and truncate toward zero;
- construct the custom app class `ParticleExplosion`, set its position, call
  `Create(path, delay, flagA, flagB)`, and add it at z-order `1`;
- equal-z child insertion order is call order, so this fixture's order is material;
- after the delay, create the scaled sprite count;
- each `ParticleObject` receives duration
  `RandomHelper::nextInt(int(lifeMin), int(lifeMax)) / 100`;
- x and y movement independently choose a sign and a magnitude in the scaled
  `[moveMin, moveMax]` interval through `RandomPositionData`;
- rotation is enabled;
- the two stripped `Create` booleans are preserved as opaque `flagA` and `flagB`; native calls
  never set both, and this resource contract does not assign semantic/color names to them;
- every root runs `Delay(delaySeconds) -> synchronous Explosion ->
  Delay(2 * trunc(lifeMaxHundredths) / 100) -> remove with cleanup`.

Twelve recovered roots remain scheduled beyond active-play `t=153.0` (the 150-second timer
plus three-second TIME UP sequence): fixture rows 428..437 would remove at `t=153.5`, and
rows 438..439 at `t=155.5`. GN layer teardown owns them first. Replacing the dynamic cleanup
with a fixed delay changes that lifecycle.

This is a custom sprite-node choreography. It is **not** a Cocos particle-emitter file and
does not consume a `.plist`.

### Path codes and call statistics

| Code | Exact logical raster path | Direct calls |
|---|---|---:|
| `F5` | `Blades/Particles/X-Mas/xmasfive.png` | 223 |
| `F4` | `Blades/Particles/X-Mas/xmasfour.png` | 128 |
| `HX` | `Blades/Particles/X-Mas/xmashexa.png` | 17 |
| `CI` | `Blades/Particles/X-Mas/xmascircle.png` | 9 |
| `ST` | `Blades/Particles/stars.png` | 32 |
| `VN` | `Blades/Particles/VN Flag/vnflagstar.png` | 30 |
| **total** |  | **439** |

There are 237 unique delays from 3.0 through 146.5 seconds. Flag-pair call counts are
`0/0: 341`, `0/1: 34`, `1/0: 64`. Base-count call frequencies are
`25: 123`, `35: 145`, `50: 117`, `57: 2`, `75: 27`, `100: 25`.

### Scalar templates

Life columns preserve the exact float32 bits and show their decoded raw hundredths. `flagA`
and `flagB` are raw recovered booleans whose semantic names remain unknown.

| ID | move min | move max | life min bits (raw) | life max bits (raw) | base count | flagA | flagB |
|---|---:|---:|---|---|---:|---:|---:|
| `T00` | 50 | 300 | `0x42480000` (50) | `0x43160000` (150) | 50 | 0 | 0 |
| `T01` | 50 | 300 | `0x42480000` (50) | `0x43160000` (150) | 50 | 0 | 1 |
| `T02` | 50 | 300 | `0x42480000` (50) | `0x43160000` (150) | 50 | 1 | 0 |
| `T03` | 50 | 300 | `0x41c80000` (25) | `0x42960000` (75) | 50 | 0 | 0 |
| `T04` | 50 | 300 | `0x42480000` (50) | `0x43160000` (150) | 35 | 0 | 0 |
| `T05` | 50 | 300 | `0x42480000` (50) | `0x43160000` (150) | 35 | 0 | 1 |
| `T06` | 50 | 400 | `0x42c80000` (100) | `0x43480000` (200) | 100 | 1 | 0 |
| `T07` | 50 | 300 | `0x42480000` (50) | `0x43160000` (150) | 25 | 0 | 0 |
| `T08` | 50 | 400 | `0x42480000` (50) | `0x43160000` (150) | 75 | 0 | 0 |
| `T09` | 50 | 400 | `0x42480000` (50) | `0x43160000` (150) | 75 | 1 | 0 |
| `T0a` | 50 | 250 | `0x42480000` (50) | `0x42c80000` (100) | 25 | 0 | 0 |
| `T0b` | 50 | 250 | `0x42480000` (50) | `0x42c80000` (100) | 75 | 0 | 0 |
| `T0c` | 50 | 450 | `0x43160000` (150) | `0x43c80000` (400) | 100 | 1 | 0 |
| `T0d` | 50 | 250 | `0x42480000` (50) | `0x43160000` (150) | 35 | 0 | 0 |
| `T0e` | 50 | 350 | `0x42c80000` (100) | `0x437a0000` (250) | 100 | 1 | 0 |
| `T0f` | 50 | 250 | `0x41c80000` (25) | `0x42960000` (75) | 50 | 0 | 0 |
| `T10` | 50 | 150 | `0x41c80000` (25) | `0x42960000` (75) | 35 | 0 | 0 |
| `T11` | 50 | 150 | `0x41c80000` (25) | `0x42960000` (75) | 100 | 1 | 0 |
| `T12` | 50 | 200 | `0x42480000` (50) | `0x43160000` (150) | 50 | 0 | 0 |
| `T13` | 50 | 200 | `0x42480000` (50) | `0x43160000` (150) | 50 | 1 | 0 |
| `T14` | 50 | 250 | `0x42480000` (50) | `0x43480000` (200) | 75 | 0 | 1 |
| `T15` | 50 | 250 | `0x42480000` (50) | `0x43480000` (200) | 50 | 0 | 1 |
| `T16` | 150 | 250 | `0x42c80000` (100) | `0x43960000` (300) | 100 | 0 | 0 |
| `T17` | 50 | 100 | `0x42480000` (50) | `0x43480000` (200) | 50 | 0 | 0 |
| `T18` | 50 | 250 | `0x42480000` (50) | `0x43480000` (200) | 50 | 0 | 0 |
| `T19` | 150 | 350 | `0x42c80000` (100) | `0x43960000` (300) | 100 | 0 | 1 |
| `T1a` | 50 | 350 | `0x43160000` (150) | `0x43af0000` (350) | 100 | 0 | 0 |
| `T1b` | 50 | 300 | `0x42480000` (50) | `0x43160000` (150) | 75 | 0 | 0 |
| `T1c` | 50 | 150 | `0x41700000` (15) | `0x420c0000` (35) | 25 | 0 | 0 |
| `T1d` | 50 | 250 | `0x42c80000` (100) | `0x43480000` (200) | 75 | 0 | 0 |
| `T1e` | 50 | 150 | `0x420c0000` (35) | `0x42480000` (50) | 25 | 0 | 0 |
| `T1f` | 50 | 350 | `0x42c80000` (100) | `0x43480000` (200) | 25 | 0 | 0 |
| `T20` | 50 | 350 | `0x42c80000` (100) | `0x43480000` (200) | 25 | 0 | 1 |
| `T21` | 50 | 150 | `0x420c0000` (35) | `0x42960000` (75) | 25 | 0 | 0 |
| `T22` | 50 | 350 | `0x43160000` (150) | `0x437a0000` (250) | 100 | 1 | 0 |
| `T23` | 50 | 250 | `0x42480000` (50) | `0x43160000` (150) | 75 | 0 | 0 |
| `T24` | 50 | 250 | `0x42480000` (50) | `0x43160000` (150) | 75 | 1 | 0 |
| `T25` | 50 | 350 | `0x42480000` (50) | `0x437a0000` (250) | 75 | 0 | 0 |
| `T26` | 50 | 150 | `0x41c80000` (25) | `0x42480000` (50) | 25 | 0 | 0 |
| `T27` | 50 | 350 | `0x43160000` (150) | `0x43af0000` (350) | 75 | 0 | 0 |
| `T28` | 50 | 400 | `0x42480000` (50) | `0x43160000` (150) | 57 | 0 | 0 |
| `T29` | 50 | 400 | `0x42480000` (50) | `0x43160000` (150) | 57 | 1 | 0 |
| `T2a` | 50 | 100 | `0x41200000` (10) | `0x41c80000` (25) | 35 | 0 | 0 |
| `T2b` | 50 | 100 | `0x42480000` (50) | `0x42960000` (75) | 35 | 1 | 0 |
| `T2c` | 50 | 350 | `0x43160000` (150) | `0x43af0000` (350) | 35 | 0 | 0 |
| `T2d` | 50 | 350 | `0x43160000` (150) | `0x43e10000` (450) | 75 | 1 | 0 |
| `T2e` | 50 | 450 | `0x43160000` (150) | `0x43e10000` (450) | 75 | 0 | 0 |

### Normalized positions

`W` and `H` are the active framebuffer width and height. Coefficient bits are retained to
avoid decimal-rounding drift.

| ID | x coefficient | y coefficient |
|---|---|---|
| `P00` | `0x3f000000` (0.5 W) | `0x3ee00000` (0.4375 H) |
| `P01` | `0x3dd70a3d` (0.105 W) | `0x3f500000` (0.8125 H) |
| `P02` | `0x3f651eb8` (0.89499998 W) | `0x3f500000` (0.8125 H) |
| `P03` | `0x3dd70a3d` (0.105 W) | `0x3d800000` (0.0625 H) |
| `P04` | `0x3f651eb8` (0.89499998 W) | `0x3d800000` (0.0625 H) |
| `P05` | `0x3f000000` (0.5 W) | `0x3f500000` (0.8125 H) |
| `P06` | `0x3dd70a3d` (0.105 W) | `0x3ee00000` (0.4375 H) |
| `P07` | `0x3f000000` (0.5 W) | `0x3d800000` (0.0625 H) |
| `P08` | `0x3f651eb8` (0.89499998 W) | `0x3ee00000` (0.4375 H) |
| `P09` | `0x3f000000` (0.5 W) | `0x3f200000` (0.625 H) |
| `P0a` | `0x3f000000` (0.5 W) | `0x3e800000` (0.25 H) |
| `P0b` | `0x3dd70a3d` (0.105 W) | `0x3f200000` (0.625 H) |
| `P0c` | `0x3f651eb8` (0.89499998 W) | `0x3f200000` (0.625 H) |
| `P0d` | `0x3dd70a3d` (0.105 W) | `0x3e800000` (0.25 H) |
| `P0e` | `0x3f651eb8` (0.89499998 W) | `0x3e800000` (0.25 H) |
| `P0f` | `0x3f000000` (0.5 W) | `0x3f580000` (0.84375 H) |
| `P10` | `0x3f000000` (0.5 W) | `0x3e9020c5` (0.28150001 H) |
| `P11` | `0x3f000000` (0.5 W) | `0x3ef00000` (0.46875 H) |
| `P12` | `0x3f000000` (0.5 W) | `0x3f280000` (0.65625 H) |
| `P13` | `0x3f000000` (0.5 W) | `0x3ef66666` (0.48124999 H) |
| `P14` | `0x3e800000` (0.25 W) | `0x3f700000` (0.9375 H) |
| `P15` | `0x3dd70a3d` (0.105 W) | `0x3e900000` (0.28125 H) |
| `P16` | `0x3f651eb8` (0.89499998 W) | `0x3e900000` (0.28125 H) |

### Ordered fixture

Token grammar is `template/path/position/delayFloat32Bits`. Token ordinal is call ordinal
`1..439`; read left-to-right, top-to-bottom. The exact single-space-joined token stream has
SHA-256:

`a49125aae2041644a652cd9fea516ae04c72e3f87ce64c68e00f4ab06d084e7d`

```text
T00/F5/P00/40400000 T01/ST/P01/40400000 T01/ST/P02/40400000 T01/ST/P03/40400000 T01/ST/P04/40400000 T00/VN/P00/41240000 T00/VN/P05/4124cccd T00/VN/P06/4124cccd T00/VN/P07/4124cccd T00/VN/P08/4124cccd
T00/HX/P01/41180000 T00/F4/P02/410c0000 T00/F5/P03/41140000 T00/CI/P04/411c0000 T00/HX/P00/41c80000 T01/VN/P05/41b80000 T01/VN/P06/41bc0000 T01/VN/P07/41c00000 T01/VN/P08/41c40000 T00/HX/P01/41c80000
T00/F4/P02/41c80000 T00/F5/P03/41c80000 T00/CI/P04/41c80000 T02/ST/P09/42150000 T02/ST/P0a/4215999a T02/ST/P06/42163333 T02/ST/P08/4216999a T00/HX/P0b/42180000 T00/F4/P0c/42180000 T00/F5/P0d/42180000
T00/CI/P0e/42180000 T00/VN/P05/421e0000 T00/VN/P06/421e0000 T00/VN/P07/421e0000 T00/VN/P08/421e0000 T00/HX/P00/421e0000 T00/HX/P01/42210000 T00/F4/P02/421f0000 T00/F5/P03/42200000 T00/CI/P04/42220000
T02/VN/P00/42230000 T02/ST/P09/42230000 T02/ST/P06/42230000 T02/ST/P08/42230000 T02/ST/P0a/42230000 T00/F5/P01/42260000 T00/F5/P02/42260000 T00/F5/P0b/42270000 T00/F5/P0c/42270000 T00/F5/P06/42280000
T00/F5/P08/42280000 T00/F5/P0d/42290000 T00/F5/P0e/42290000 T00/F5/P03/422a0000 T00/F5/P04/422a0000 T00/F5/P07/422c0000 T00/F5/P0a/422d0000 T00/F5/P00/422e3333 T00/F5/P09/422f0000 T00/F5/P0f/42300000
T00/F5/P05/42310000 T00/F4/P01/42320000 T00/VN/P05/42320000 T00/F4/P02/42320000 T00/F5/P04/42340000 T00/F5/P03/42340000 T00/F5/P0d/42350000 T00/F5/P0e/42350000 T00/F5/P06/42360000 T00/F5/P08/42360000
T00/F5/P0b/42370000 T00/F5/P0c/42370000 T00/F5/P01/42380000 T00/F5/P02/42380000 T00/F5/P05/42390000 T00/F5/P09/423a0000 T00/F5/P00/423b0000 T00/F5/P0a/423c0000 T03/CI/P10/423d0000 T03/CI/P07/423e0000
T00/F4/P03/423f0000 T00/VN/P07/423f0000 T00/F4/P04/423f0000 T00/F4/P01/42400000 T00/VN/P05/42400000 T00/F4/P02/42400000 T04/F4/P0d/42420000 T04/F4/P0c/42440000 T04/F4/P0e/42460000 T04/F4/P0b/42480000
T04/VN/P00/424c0000 T05/ST/P09/424a0000 T05/ST/P06/424a0000 T05/ST/P08/424a0000 T05/ST/P0a/424a0000 T05/F4/P01/424b0000 T05/F4/P04/424b0000 T05/F4/P02/424b0000 T05/F4/P03/424b0000 T04/F4/P02/424c0000
T04/F4/P05/424d0000 T04/F4/P01/424e0000 T04/F4/P0b/424f0000 T04/F4/P06/42500000 T04/F4/P0d/42510000 T04/F4/P0a/42520000 T04/F4/P11/42530000 T06/F5/P00/42540000 T04/F4/P03/42540000 T04/F4/P07/42550000
T04/F4/P04/42560000 T04/F4/P0e/42570000 T04/F4/P08/42580000 T04/F4/P0c/42590000 T04/F4/P09/425a0000 T04/F4/P12/425b0000 T06/F5/P00/425c0000 T07/F4/P01/425d999a T07/F4/P05/425e6666 T07/F4/P02/425f3333
T07/F4/P0c/42600000 T07/F4/P08/4260cccd T07/F4/P0e/4261999a T07/F4/P0a/42626666 T07/F4/P13/42633333 T07/F4/P04/425d999a T07/F4/P07/425e6666 T07/F4/P03/425f3333 T07/F4/P0d/42600000 T07/F4/P06/4260cccd
T07/F4/P0b/4261999a T07/F4/P09/42626666 T07/F4/P12/42633333 T08/VN/P00/42640000 T08/HX/P00/42660000 T09/F5/P00/42680000 T0a/F5/P03/42686666 T0a/F5/P0d/4268cccd T0a/F5/P06/42693333 T0a/F5/P0b/4269999a
T0a/F5/P01/426a0000 T0a/F5/P14/426a6666 T0a/F5/P04/42686666 T0a/F5/P0e/4268cccd T0a/F5/P08/42693333 T0a/F5/P0c/4269999a T0a/F5/P02/426a0000 T0a/F5/P14/426a6666 T0a/F5/P05/426a6666 T0a/F5/P09/426acccd
T0a/F5/P00/426b3333 T0a/F5/P0a/426c0000 T0b/F5/P05/426d0000 T0c/F5/P03/426e0000 T0c/F5/P07/426e0000 T0c/F5/P04/426e0000 T0d/HX/P01/427c0000 T0d/F5/P0b/427c0000 T0d/CI/P06/427c0000 T0d/F5/P0d/427c0000
T0d/HX/P03/427c0000 T0d/HX/P02/427c0000 T0d/F5/P0c/427c0000 T0d/CI/P08/427c0000 T0d/F5/P0e/427c0000 T0d/HX/P04/427c0000 T0e/F4/P00/427c0000 T0f/F4/P07/4281999a T0f/F4/P0a/42820000 T0f/F4/P00/42826666
T0f/F4/P09/4282cccd T0f/F4/P05/42833333 T0f/F4/P01/4283999a T0f/F4/P02/4283999a T0e/F5/P0b/4283999a T0e/F5/P0c/4283999a T10/F4/P01/42960000 T10/F4/P02/42960000 T10/F4/P0b/42966666 T10/F4/P0c/42966666
T10/F4/P06/4296cccd T10/F4/P08/4296cccd T10/F4/P0d/42973333 T10/F4/P0e/42973333 T10/F4/P15/4297999a T10/F4/P16/4297999a T0e/ST/P03/42980000 T0e/ST/P07/42980000 T0e/ST/P04/42980000 T10/F4/P07/429a3333
T10/F4/P0a/429a6666 T0b/HX/P00/429a999a T10/F4/P09/429acccd T11/F5/P01/429b0000 T11/F5/P05/429b0000 T11/F5/P02/429b0000 T12/F5/P01/42a60000 T12/F5/P04/42a70000 T12/F5/P02/42a80000 T12/F5/P03/42a90000
T13/ST/P06/42aa0000 T13/ST/P08/42aa0000 T13/ST/P09/42aa0000 T13/ST/P0a/42aa0000 T12/CI/P00/42a98000 T14/F5/P09/42b40000 T15/F5/P0a/42b48000 T15/F5/P06/42b50000 T15/F5/P08/42b58000 T16/VN/P00/42b60000
T17/F4/P0b/42b70000 T17/F4/P0c/42b70000 T17/F4/P0d/42b70000 T17/F4/P0e/42b70000 T18/HX/P01/42b80000 T18/HX/P02/42b80000 T18/HX/P03/42b80000 T18/HX/P04/42b80000 T19/VN/P00/42b80000 T1a/VN/P00/42d40000
T01/ST/P05/42d50000 T01/ST/P06/42d50000 T01/ST/P07/42d50000 T01/ST/P08/42d50000 T1b/F5/P01/42d20000 T1b/F5/P02/42d10000 T1b/F5/P03/42d18000 T1b/F5/P04/42d28000 T1c/F5/P03/42ee0000 T1c/F5/P04/42ee0000
T1c/F5/P0d/42ee6666 T1c/F5/P0e/42ee6666 T1c/F5/P06/42eecccd T1c/F5/P08/42eecccd T1c/F5/P0b/42ef3333 T1c/F5/P0c/42ef3333 T1d/F5/P01/42f00000 T1d/F5/P05/42f00000 T1d/F5/P02/42f00000 T1e/F5/P05/42f03333
T1e/F5/P09/42f06666 T1e/F5/P00/42f0999a T1e/F5/P0a/42f0cccd T1e/F5/P07/42f10000 T1e/F5/P03/42f13333 T1e/F5/P04/42f13333 T1e/F5/P0d/42f16666 T1e/F5/P0e/42f16666 T1e/F5/P06/42f1999a T1e/F5/P08/42f1999a
T1e/F5/P0b/42f1cccd T1e/F5/P0c/42f1cccd T1f/VN/P01/42f20000 T1f/VN/P05/42f20000 T1f/VN/P02/42f20000 T1f/F5/P03/42f20000 T20/VN/P07/42f20000 T1f/F5/P04/42f20000 T21/F5/P03/42f23333 T21/F5/P04/42f23333
T21/F5/P0d/42f2999a T21/F5/P0e/42f2999a T21/F5/P06/42f36666 T21/F5/P08/42f36666 T21/F5/P0b/42f40000 T21/F5/P0c/42f40000 T21/F5/P01/42f46666 T21/F5/P02/42f46666 T21/F5/P05/42f4999a T21/F5/P09/42f4cccd
T22/F5/P00/42f50000 T23/F5/P06/42f80000 T23/F5/P08/42f88000 T23/F5/P07/42f90000 T23/F5/P05/42f98000 T24/F5/P00/42fa0000 T21/F5/P00/42fa8000 T21/F5/P06/42fb0000 T21/F5/P08/42fb0000 T21/F5/P0b/42fb8000
T21/F5/P0c/42fb8000 T21/F5/P0d/42fb8000 T21/F5/P0e/42fb8000 T25/F5/P01/42fc0000 T25/F5/P02/42fc0000 T25/F5/P03/42fc0000 T25/F5/P04/42fc0000 T26/F4/P01/42ff0000 T26/F4/P02/42ff0000 T26/F4/P0b/42ff8000
T26/F4/P0c/42ff8000 T26/F4/P06/43000000 T26/F4/P08/43000000 T26/F4/P0d/43004000 T26/F4/P0e/43004000 T26/F4/P03/43008000 T26/F4/P04/43008000 T26/F4/P0a/4300c000 T26/F4/P00/43010000 T26/F4/P09/43014000
T1a/F5/P01/43018000 T27/VN/P05/43018000 T1a/F5/P02/43018000 T04/F4/P0d/43028000 T04/F4/P0c/43030000 T04/F4/P0e/43038000 T04/F4/P0b/43040000 T04/VN/P00/43050000 T05/ST/P09/43048000 T05/ST/P06/43048000
T05/ST/P08/43048000 T05/ST/P0a/43048000 T05/F4/P01/4304c000 T05/F4/P04/4304c000 T05/F4/P02/4304c000 T05/F4/P03/4304c000 T04/F4/P02/43050000 T04/F4/P05/43054000 T04/F4/P01/43058000 T04/F4/P0b/4305c000
T04/F4/P06/43060000 T04/F4/P0d/43064000 T04/F4/P0a/43068000 T04/F4/P11/4306c000 T06/F5/P00/43070000 T04/F4/P03/43070000 T04/F4/P07/43074000 T04/F4/P04/43078000 T04/F4/P0e/4307c000 T04/F4/P08/43080000
T04/F4/P0c/43084000 T04/F4/P09/43088000 T04/F4/P12/4308c000 T06/F5/P00/43090000 T07/F4/P01/43096666 T07/F4/P05/4309999a T07/F4/P02/4309cccd T07/F4/P0c/430a0000 T07/F4/P08/430a3333 T07/F4/P0e/430a6666
T07/F4/P0a/430a999a T07/F4/P13/430acccd T07/F4/P04/43096666 T07/F4/P07/4309999a T07/F4/P03/4309cccd T07/F4/P0d/430a0000 T07/F4/P06/430a3333 T07/F4/P0b/430a6666 T07/F4/P09/430a999a T07/F4/P12/430acccd
T08/VN/P00/430b0000 T28/HX/P00/430b8000 T29/F5/P00/430c0000 T0a/F5/P03/430c199a T0a/F5/P0d/430c3333 T0a/F5/P06/430c4ccd T0a/F5/P0b/430c6666 T0a/F5/P01/430c8000 T0a/F5/P14/430c999a T0a/F5/P04/430c199a
T0a/F5/P0e/430c3333 T0a/F5/P08/430c4ccd T0a/F5/P0c/430c6666 T0a/F5/P02/430c8000 T0a/F5/P14/430c999a T0a/F5/P05/430c999a T0a/F5/P09/430cb333 T0a/F5/P00/430ccccd T0a/F5/P0a/430d0000 T0b/F5/P07/430d4000
T0c/F5/P03/430d8000 T0c/F5/P07/430d8000 T0c/F5/P04/430d8000 T2a/F5/P01/430eb333 T2a/F5/P05/430ecccd T2a/F5/P02/430ee666 T2a/F5/P0c/430f0000 T2a/F5/P06/430f4ccd T2a/F5/P00/430f3333 T2a/F5/P08/430f199a
T2a/F5/P0e/430f0000 T2a/F5/P03/430eb333 T2a/F5/P07/430ecccd T2a/F5/P04/430ee666 T2b/F5/P01/430f8000 T2b/F5/P05/430f8000 T2b/F5/P02/430f8000 T2b/F5/P09/430f8000 T2b/F5/P06/430f8000 T2b/F5/P00/430f8000
T2b/F5/P08/430f8000 T2b/F5/P0e/430f87ae T2b/F5/P03/430f8000 T2b/F5/P07/430f8000 T2b/F5/P04/430f8000 T2a/F5/P01/430fcccd T2a/F5/P05/430fe666 T2a/F5/P02/43100000 T2a/F5/P09/4310199a T2a/F5/P08/43103333
T2a/F5/P00/43104ccd T2a/F5/P06/43103333 T2a/F5/P0d/4310199a T2a/F5/P03/43100000 T2a/F5/P07/430fe666 T2a/F5/P04/430fcccd T2b/F5/P01/43108000 T2b/F5/P05/43108000 T2b/F5/P02/43108000 T2b/F5/P09/43108000
T2b/F5/P08/43108000 T2b/F5/P00/43108000 T2b/F5/P06/43108000 T2b/F5/P0d/43108000 T2b/F5/P03/43108000 T2b/F5/P07/43108000 T2b/F5/P04/43108000 T2a/F5/P05/4311199a T2a/F5/P09/43113333 T2a/F5/P00/43114ccd
T2a/F5/P0a/43113333 T2a/F5/P07/4311199a T2b/F5/P05/43118000 T2b/F5/P09/43118000 T2b/F5/P00/43118000 T2b/F5/P0a/43118000 T2b/F5/P07/43118000 T2c/F5/P01/43128000 T2c/F5/P02/43128000 T2c/F5/P0b/43128000
T2c/F5/P0c/43128000 T2c/F5/P08/43128000 T2c/F5/P06/43128000 T2c/F5/P0d/43128000 T2c/F5/P0e/43128000 T2c/F5/P03/43128000 T2c/F5/P04/43128000 T2d/ST/P00/43128000 T2e/VN/P00/43128000
```

### Profile scaling and emitted-child totals

Recovered scale policy, with float32 boundaries preserved:

```text
widthScale = float32(frameWidth / 480.0)

if 720.0 <= frameWidth <= 1136.0:
    countScale = float32(0.45)
else:
    countScale = min(
      float32(float32(frameWidth * frameHeight) * 2^-20),
      float32(1.0)
    )

scaledMin   = truncTowardZero(moveMin * widthScale)
scaledMax   = truncTowardZero(moveMax * widthScale)
scaledCount = truncTowardZero(baseCount * countScale)
```

For the two recovered framebuffer profiles:

| Profile | width scale | count scale | base `25/35/50/57/75/100` becomes | Total children across 439 roots |
|---|---:|---:|---|---:|
| `480x800` | `1.0` | `0.3662109375` | `9/12/18/20/27/36` | 6622 |
| `720x1280` | `1.5` | `0.45` | `11/15/22/25/33/45` | 8168 |

The profile labels are inferred from the paired resource trees, while the width/count formulas
are recovered native behavior. Positions use the same normalized coefficients in both
profiles. Do not scale from PNG dimensions; use active framebuffer `W/H`.

## Low/High Profile Differences

- All 103 logical raster names exist in both profiles; there is no GN filename alias between
  low and high.
- Dimensions, bytes, and hashes must be selected as a profile tuple from the inventory, not
  mixed independently.
- The seven leaf rasters and `Blades/blade0.png` are byte-identical between profiles. Every
  other raster in this closure has profile-specific bytes.
- Audio and fonts are global and identical regardless of profile.
- GN particle movement uses width scale `1.0` vs `1.5`; count scaling uses
  `0.3662109375` vs `0.45`, producing the totals above.
- Several nominal profile images are deliberately off by one or two pixels
  (`paperbackground1`, `3`, `4`, `6`, `7`, `8`, and some theme files). Preserve the decoded
  dimensions; do not normalize them to the directory label.

## Shader, Material, Emitter, and Animation Findings

Static corpus enumeration found **no** `.effect`, `.material`, `.mtl`, `.plist`, `.fnt`,
`.atlas`, `.prefab`, `.anim`, or `.animation` source under `game/assets/game`.

- `Interfaces/object-des-shader.png` is a regular raster overlay with ordinary image/sprite
  metadata.
- GN choreography uses custom `ParticleExplosion` / `ParticleObject` sprite nodes and the six
  PNGs listed above; no emitter configuration file is missing.
- The original default `BasicBlade` path uses the stock position/texture/color textured path
  and a triangle strip. The current compatibility path can create a runtime `builtin-unlit`
  material; that is an implementation mechanism, not evidence for an omitted external
  material asset.
- Exact original non-default blade effects, numeric blend factors, and material state beyond
  the recovered source/meta evidence remain unknown. Do not invent an effect or material file
  to fill that gap.
- Intro, TIME UP, objective, and result movement are action-code choreography; there is no
  external animation clip to load.

## Loader and Implementation Checklist

An implementation is complete only when all items below hold.

1. Select `480x800` or `720x1280` before resolving any profile raster; reject any other
   unresolved profile rather than silently substituting.
2. Represent all 103 logical raster resources and both profile fingerprints. Resolve them to
   `cc.SpriteFrame` subassets; assert recovered dimensions in tests.
3. Represent the 29 audio and six font paths exactly, using `AudioClip` and `Font`/TTF loader
   types. Do not add bomb/freeze/special/Bird sounds to the GN contract.
4. Compose shared resource providers for environment, ordinary fruit, HUD, pause/objective,
   result, and navigation. Add a GN-owned supplement for five instruction/time rasters,
   Gangnam music, six choreography rasters, and the 439-call fixture.
5. Bind Mode Select ID `2` to strawberry ID `2`, `mode-gnstyle.png`,
   `object-combo-des.png`, `object-des-shader.png`, `SlabThing.ttf`, strawberry cut audio,
   gameplay-selected audio, and `mode_unlock_2`.
6. Build the initial three cards simultaneously, then `150s`, then `GO`, using the recovered
   positions/directions and action durations. Start active play only at nominal `t=2.60`.
7. At active start, stop current background music first; if music is enabled, play
   `GangnamStyle.mp3` once with loop `false`; then start Free, Wave, Concurrent, the
   150-second timer, and particle initialization in that order.
8. Preserve pause/resume music asymmetry for mode `2`. Do not insert an unproved time-up music
   stop; replay's next start performs the recovered stop/restart.
9. Load `MotorwerkOblique.ttf`, `text-time-up.png`, `object-time-freeze.png`,
   `timetick.wav`, and `timeup.wav` with the shared `TimeManager`, even though GN has no
   freeze trigger.
10. Materialize the token stream as immutable generated data. Validate 439 rows, six path
    counts, 47 templates, 23 position tuples, exact delay bits, exact order, and token-stream
    SHA before accepting generated output.
11. Apply float32 width/count formulas and truncation exactly. Preserve raw `flagA/flagB`
    values, dynamic `2 * trunc(maxDurationHundredths) / 100` root cleanup, equal-z insertion
    order, and layer-owned teardown.
12. At timer expiry stop Free/Wave/Concurrent, submit `(6,2)`, keep existing in-flight
    gameplay semantics, run the shared three-second TIME UP sequence, then commit the
    mode-2 result.
13. Bind result to `gnstyle_best_1..3`, factor `0.6f`, generic result resources, rank sounds,
    and the shared post-commit selector-2 objective update. Bind the objective selector-6
    no-drop path and generic reward presentation exactly once.
14. Bind leaderboard item index `2` to `leaderboard_gnstyle.png` and retain the shared
    template/title/Arial dependencies.
15. Fail preparation transactionally if any required source/subasset is missing or wrong.
    Release prepared ownership on rollback, retry, menu, or scene teardown; never replace an
    absent exact resource with a similarly named candidate.

## Explicit Exclusions

The following staged families are not part of the proved mode-2 closure:

- `Bomb/bomb_X.png`, `Bomb/bombsmoke.png`, and ordinary bomb audio;
- `Sounds/freeze.wav` and Crazy special-fruit/electric/magnet/Dragon resources;
- `Text/text-good.png`, `text-luck.png`, `text-game.png`, `text-over.png`;
- `Interfaces/object-x-normal.png`, `object-x-filled.png`;
- Bird blades, bird frames, and bird-only particles;
- `Fonts/Razing.ttf`;
- `Sounds/scorescreen.wav`;
- `Interfaces/object-new-best.png` and numbered medal variants;
- any guessed `object-gnstyle-des.png`, particle `.plist`, shader, material, or animation file.

Availability elsewhere in the manifest is not consumer proof.

## Unknowns and Release Risks

1. **Saved selected blade:** the bounded restoration uses clean default ID `0`. Native standard
   selection can request indexed blades, while the recovered low/high catalog coverage differs
   for higher IDs and IDs `13..17` route into Dragon/Centipede families. A legacy nonzero
   selection needs a separate exact blade/effect closure. Do not substitute `blade0` while
   claiming that save is preserved.
2. **Particle flags:** raw values and branches are recoverable, but stripped source semantics
   for `flagA`/`flagB` remain unknown in this resource contract.
3. **Random parity:** call order and per-child draw shape are recovered; original process seed,
   exact RNG state entering the route, and equal-deadline scheduler ordering remain unknown.
4. **Material parity:** no external file is missing, but exact original runtime blend/material
   state for all possible selected blades is not completely recovered.
5. **Audio teardown:** recovered start, pause, resume, replay, and result calls are explicit;
   any additional engine-driven destruction/release behavior is unobserved.
6. **Rights:** staged presence is not publication clearance. `GangnamStyle.mp3`, fonts, and
   extracted visual/audio assets require provenance, trademark, attribution, and redistribution
   review before release.
7. **Visual/runtime parity:** the report proves static resources and action inputs, not
   frame-perfect rendering, decoder latency, or device scheduler behavior. Runtime validation
   remains a later implementation task and was prohibited for this research task.

## Evidence and Validation Sources

- `assets/catalog/creator-staging-manifest.json`
- `game/assets/game/` source files and Creator `.meta` files
- `game/assets/scripts/domain/classic-resource-contract.ts`
- `game/assets/scripts/domain/base-gameplay-resource-contract.ts`
- `game/assets/scripts/domain/shared-game-scene-resources.ts`
- `game/assets/scripts/domain/classic-audio-contract.ts`
- `forensics/resources/resource-usage-map.json`
- `forensics/contracts/basic-blade-presentation-contract.md`
- `forensics/contracts/mode-select-presentation-contract.md`
- `forensics/contracts/shared-game-scene-presentation-contract.md`
- `.forensics-work/phase-02/native/strings/all-offsets.txt`
- `.forensics-work/phase-02/native/app-function-inventory.csv`
- `.forensics-work/phase-02/native/function-inventory.csv`
- immutable native evidence `.forensics-work/phase-01/native/libgame.so`
  (SHA-256 `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`)
- `plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-23-remaining-mode-order.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-resource-map.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-audio-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-pause-objective.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-bird-resource-map.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-gn-style-native-contract.md`,
  with the superseding direct Thumb recheck values recorded in this report for intro timing and
  particle cleanup.

The repository root has no `README.md`; no missing README assumption was used.

## Unresolved Questions

- What exact resource/effect closure should be supported for each nonzero blade ID restored
  from a legacy save?
- What approved replacement/equivalence policy applies if `GangnamStyle.mp3` or another
  extracted asset cannot obtain publication clearance?
- Should a later runtime-parity phase target original equal-deadline/RNG behavior, or only the
  recovered deterministic call/data contract?

Status: DONE  
Summary: Exact GN mode-2 cross-screen closure is 103 logical dual-profile rasters, 29 audio
clips, six fonts, and a hash-locked 439-call particle choreography; all 241 staged sources and
metadata were present and byte-verified, with lifecycle, profile scaling, loader ownership,
result/objective/leaderboard, and exclusions specified.  
Concerns/Blockers: Clean-default blade closure is complete, but legacy nonzero blade saves,
particle flag semantics/RNG parity, runtime pixel timing, and publication rights remain
explicitly unresolved.

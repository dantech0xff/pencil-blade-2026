# Research Report: Crazy Resource / Consumer Map

Date: 2026-07-23
Scope: Pencil Blade 1.5 static-only Crazy checkpoint
Root: `/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026`

## Executive Summary

This revision corrects reviewer finding M1. The prior report incorrectly treated Classic-only
`GOOD` / `LUCK`, `GAME` / `OVER`, and strike-marker rasters as Crazy consumers. Those six logical
paths are no longer in the proven Crazy surface:

- `Text/text-good.png`
- `Text/text-luck.png`
- `Text/text-game.png`
- `Text/text-over.png`
- `Interfaces/object-x-normal.png`
- `Interfaces/object-x-filled.png`

Their files remain available in the staging manifest, but availability is not consumer proof.
Crazy uses `60s` then `GO`, ends through `TimeManager`'s `text-time-up` path, and records misses
without strike markers.

The five special-fruit raster triples, the complete `Electric/*.png` set used by
`BombElectric`, and the raster/audio set used by `MagnetAnimation` are enumerated below with
exact staging-manifest bytes, full SHA-256 values, and dimensions read from the staged PNGs.

The previous `70 proven transitive dependencies` / `86 canonical paths` denominator is
withdrawn. There is no defensible GREEN numeric Crazy denominator until the exact per-path
consumer map is complete. Overall checkpoint: **AMBER**.

## Evidence Boundary and Method

- Asset availability, target path, byte count, and SHA-256 authority:
  `assets/catalog/creator-staging-manifest.json`.
- PNG dimensions: read-only inspection of the staged files under `game/assets/game/`.
- Integrity check: every file enumerated in the special-fruit, electric, and magnet tables had
  its staged byte count and SHA-256 recomputed; all matched the manifest.
- Consumer authority: only the reviewed static Crazy contract and direct native resource
  bindings. The manifest's `consumerStatus: "unmapped"` is never treated as consumer proof.
- Classification:
  - **proven Crazy consumer**: the reviewed static flow binds the path to a Crazy-owned or
    Crazy-required runtime component;
  - **available shared asset**: staged and manifest-backed, but not counted as a proven Crazy
    consumer here;
  - **unresolved**: availability is known, exact consumer linkage is not.
- No APK or `libgame.so` execution, loading, linking, translation, or emulation was performed.

All target paths below are exact manifest `targetPath` values.

## Proven Crazy Consumers

### Intro and TimeManager

| Target path | Dimension / type | Bytes | SHA-256 | Static consumer |
|---|---:|---:|---|---|
| `game/assets/game/480x800/Text/text-60s.png` | `167x35` | `3136` | `d33358778b45cec2a742f3237a96cc7ae1fbc3e603434a6ca3d15a8819197754` | `CrazyModeLayer::onEnter()` |
| `game/assets/game/720x1280/Text/text-60s.png` | `249x51` | `4619` | `1cabd816a88d3c8d8ebe33e2791fbc204e1d44bff43ccfa9ef45287415c7a551` | `CrazyModeLayer::onEnter()` |
| `game/assets/game/480x800/Text/text-go.png` | `70x31` | `1672` | `f21d11c77a670ef73bf765b87f87df77aa061fdddb461d6b5b6e17054c8f636a` | `CrazyModeLayer::Action60sCallback()` |
| `game/assets/game/720x1280/Text/text-go.png` | `106x47` | `2371` | `f1f217f37199b736465fd392339fc6f4611591eddd5d16faa198b9bbe3f6191c` | `CrazyModeLayer::Action60sCallback()` |
| `game/assets/game/480x800/Text/text-time-up.png` | `345x135` | `13675` | `64459f6fe18b22f35269adf3f27a01a369fee4899a5437f132545bbdcf8f9980` | Crazy-bound `TimeManager::update()` |
| `game/assets/game/720x1280/Text/text-time-up.png` | `481x165` | `19750` | `4a0f07207a1e5c34c5e374a56537cd0b7415f9fa9ec32763c43b5284844fdac2` | Crazy-bound `TimeManager::update()` |
| `game/assets/game/480x800/Interfaces/object-time-freeze.png` | `148x85` | `7711` | `1370c725709262023dfae741844ddd55b7574f39527aacb1206a27c4a21b2446` | Crazy-bound `TimeManager::onEnter()` / freeze presentation |
| `game/assets/game/720x1280/Interfaces/object-time-freeze.png` | `222x127` | `11914` | `7c92dc89735e21af9cd74ef3e9ef3035707e8356e07e25a443e78c79610537a1` | Crazy-bound `TimeManager::onEnter()` / freeze presentation |
| `game/assets/game/Fonts/MotorwerkOblique.ttf` | font | `21908` | `79e1421be053bcbdcbb729f1757c68e063da4790fe4bd2862db3b7cdad348a34` | Crazy-bound `TimeManager` label |
| `game/assets/game/Sounds/timetick.wav` | audio | `2750` | `acf564fde19b01789be4edfd563e5f35ddd09300658152a30bcb0c352eb89f31` | Crazy-bound timer warning |
| `game/assets/game/Sounds/timeup.wav` | audio | `92584` | `6f0d4f2dbaf882087694191c72cf386f86671a5d754b4c6605b1474c5c24ff81` | Crazy-bound timer expiry |
| `game/assets/game/Sounds/freeze.wav` | audio | `78202` | `c1f11032a8d6a122557b1d5b8560006b8ce8495b92dd8128fbe5a4a25d5884b7` | Crazy ID `12` through `TimeManager::Freeze()` |

### Five special-fruit raster triples

The Crazy cut dispatch binds IDs `10...14` to these logical fruit families, and the reviewed
fruit contract requires each intact, `-cut-bottom`, and `-cut-top` raster. These rows enumerate
both staged resolution variants; no family summary substitutes for an individual path.

| ID | Effect | Target path | Dimension | Bytes | SHA-256 |
|---:|---|---|---:|---:|---|
| `10` | double score | `game/assets/game/480x800/Fruits/fruit-bdouble.png` | `60x154` | `9734` | `059e924b6635eefaa1c68a8cc7dfd45ea063f885cff3aa49361deb23239f73e7` |
| `10` | double score | `game/assets/game/480x800/Fruits/fruit-bdouble-cut-bottom.png` | `46x79` | `4708` | `34ece18c092324c5c29c97252ebff6a14f628ef585f6debdfcaf9263838221f5` |
| `10` | double score | `game/assets/game/480x800/Fruits/fruit-bdouble-cut-top.png` | `60x85` | `5348` | `5cb82b26c18112b871b432bba214b18f27675c4b7aca4d682e9503b4db7ef1fb` |
| `10` | double score | `game/assets/game/720x1280/Fruits/fruit-bdouble.png` | `90x231` | `16607` | `e5fd6e261f2deb042b3b90790dcb4154da2ddbef5b7acc1a8924e9b862e8ab55` |
| `10` | double score | `game/assets/game/720x1280/Fruits/fruit-bdouble-cut-bottom.png` | `68x119` | `7873` | `f48d097f52b14c5c3412cfa3aa675f6e1d0b22c9254c8d4456a9564cc762eb37` |
| `10` | double score | `game/assets/game/720x1280/Fruits/fruit-bdouble-cut-top.png` | `91x128` | `9287` | `4507ac045f09727e197a7f46ad73d13fc1d62db81738e7285112a24d19e5a35f` |
| `11` | double toss | `game/assets/game/480x800/Fruits/fruit-b2toss.png` | `60x154` | `9579` | `3303aed9fc7d01b12dd24fc3be75b564a2b26d7c9fae82b8f4b03dfb7a944e4c` |
| `11` | double toss | `game/assets/game/480x800/Fruits/fruit-b2toss-cut-bottom.png` | `46x75` | `4413` | `2cfdc9fa7eb692bb330316ef7cb4e3f2f526a887bf489df1e38254b84fec5e8e` |
| `11` | double toss | `game/assets/game/480x800/Fruits/fruit-b2toss-cut-top.png` | `60x89` | `5607` | `2081739ad85dfec0efa685788802771137e6e2ccfc8253a9e022aea1ca302dc7` |
| `11` | double toss | `game/assets/game/720x1280/Fruits/fruit-b2toss.png` | `89x231` | `16463` | `4cc0d6048ca81fbd464c3d74d6ec1dd826933e0779163f08548b13a70ad962e4` |
| `11` | double toss | `game/assets/game/720x1280/Fruits/fruit-b2toss-cut-bottom.png` | `68x111` | `7293` | `4df60c8d24db2a9aebbebac78f9f463b9f2540c4802ec07150a1f21434e23f98` |
| `11` | double toss | `game/assets/game/720x1280/Fruits/fruit-b2toss-cut-top.png` | `90x132` | `9575` | `77de6045777fd1b180c20e5d54fc0c21d277672d3583edaea2823c062f36c0b7` |
| `12` | freeze | `game/assets/game/480x800/Fruits/fruit-bfreezy.png` | `60x154` | `3710` | `85aae38f2961c58568a18db9b72d9379729e82d00cf059a99c40fe6a8f148335` |
| `12` | freeze | `game/assets/game/480x800/Fruits/fruit-bfreezy-cut-bottom.png` | `47x80` | `2085` | `b589f131152d6e79c894ca3eed8570f977b24582a3ca16801ee991f7ae0824c8` |
| `12` | freeze | `game/assets/game/480x800/Fruits/fruit-bfreezy-cut-top.png` | `60x88` | `2456` | `e689214b7c88c523a4494a12621c9075ac3a5b35c5f49bcb1a69492a6ae88f0b` |
| `12` | freeze | `game/assets/game/720x1280/Fruits/fruit-bfreezy.png` | `89x231` | `5871` | `e28a0b1cb5f14a6723fea102fb97a7ab1abdf183d1215dba7ba84a88d44ce585` |
| `12` | freeze | `game/assets/game/720x1280/Fruits/fruit-bfreezy-cut-bottom.png` | `69x121` | `3280` | `d7df46b02a7fa3ce8a50d206ef83a763eb0c4ad0e1486a813992e58c7945e62a` |
| `12` | freeze | `game/assets/game/720x1280/Fruits/fruit-bfreezy-cut-top.png` | `89x131` | `3814` | `91ca394658c7091e7779d4fbe12229b734f31ba66d243cafcbaaae796bfafa7a` |
| `13` | electric field | `game/assets/game/480x800/Fruits/fruit-electric-apple.png` | `96x82` | `3883` | `a9240b499a30bb8c749a7aeacb4732301071824909ab25f170b440d0b041efa4` |
| `13` | electric field | `game/assets/game/480x800/Fruits/fruit-electric-apple-cut-bottom.png` | `95x47` | `3309` | `8c53d27143cc89520381ac382bb10f8090a38b756b6186adae1fe9c416ebbd58` |
| `13` | electric field | `game/assets/game/480x800/Fruits/fruit-electric-apple-cut-top.png` | `88x50` | `2847` | `e3484189b7cefd020da16947dfce71ec4c040e99485d8ed90143cc328a40ada2` |
| `13` | electric field | `game/assets/game/720x1280/Fruits/fruit-electric-apple.png` | `143x122` | `5759` | `9a3420595cf919e9e33bca7c37631426103eedbded22594c1abdf78e01c627dc` |
| `13` | electric field | `game/assets/game/720x1280/Fruits/fruit-electric-apple-cut-bottom.png` | `142x69` | `4922` | `f5ea394653cdc19d4add32a0ce37c7b6834c3e6f32d5bdb7a2e0f71b4bad70e5` |
| `13` | electric field | `game/assets/game/720x1280/Fruits/fruit-electric-apple-cut-top.png` | `130x74` | `4269` | `953643fbbd5984489716e9a89221a907ea907cd0fe0808cb25e8cf054d2c7c8d` |
| `14` | magnet | `game/assets/game/480x800/Fruits/fruit-magnetstrawberry.png` | `83x64` | `5911` | `b8fab709ca973e11dbf5392b79f7613095a84afc26c763083d2bb9b8a24ab0c3` |
| `14` | magnet | `game/assets/game/480x800/Fruits/fruit-magnetstrawberry-cut-bottom.png` | `79x44` | `3682` | `e823aa72af3f4fa820bb614666f7f8241b657cb72d716ae382f381d897156379` |
| `14` | magnet | `game/assets/game/480x800/Fruits/fruit-magnetstrawberry-cut-top.png` | `83x39` | `3584` | `5efc020cee9eda910528e07e470dc57f5fa2037d49e962fb794c5fe2b34bdb9d` |
| `14` | magnet | `game/assets/game/720x1280/Fruits/fruit-magnetstrawberry.png` | `125x95` | `9632` | `8bc5a9a8a0b5847eda4cf405fcad4f8df7b0be11e8f13ab6ca4e1e129470fcea` |
| `14` | magnet | `game/assets/game/720x1280/Fruits/fruit-magnetstrawberry-cut-bottom.png` | `117x54` | `5485` | `b8ceef1fcafb9151b4d5e7effe81f31b3b658b7ed5033a31e4ca544e9dc4ae99` |
| `14` | magnet | `game/assets/game/720x1280/Fruits/fruit-magnetstrawberry-cut-top.png` | `125x58` | `5812` | `3fea82af68bc48cfe146c2d6948b4fec68a9873b3aac5fa4f6564b4c720e8718` |

### DragonFruit raster set

Crazy's Down-toss controller `ad` constructs `DragonFruit`. Static factory and cut bodies bind
the intact fruit, the vertical hit-splash strip, and four terminal cut pieces below. All twelve
staged profile paths are therefore direct Crazy consumers rather than filename-inferred
candidates.

| Target path | Dimension | Bytes | SHA-256 | Static consumer |
|---|---:|---:|---|---|
| `game/assets/game/480x800/Fruits/dragon-fruit.png` | `118x101` | `8636` | `e5857e259765a6000deca84219ae11bd8ebeae57db522c5973e7116639d8a76b` | `DragonFruit::create()` |
| `game/assets/game/480x800/Fruits/dragon-splash.png` | `13x401` | `1058` | `7c71bfe6f39977cb675a7ac020f973875b94cb7e2e2f458f2a3a89e122bd692d` | `DragonFruit::onEnter()` / hit animation |
| `game/assets/game/480x800/Fruits/dragon-fruit-topleft.png` | `48x43` | `1973` | `88dcefce9c59b44138045a896699c1e3a7c25b393be7e8c65308751007f2c2ce` | `DragonFruit::EndHitAnimation()` |
| `game/assets/game/480x800/Fruits/dragon-fruit-topright.png` | `68x48` | `2746` | `3865c38b4dd1ee9fd41957bc5495209be4802cf4588449ad3979941142d51eee` | `DragonFruit::EndHitAnimation()` |
| `game/assets/game/480x800/Fruits/dragon-fruit-bottomright.png` | `59x55` | `2536` | `91f003e7b6868cee6ce34a055eb4470822ae3a0f003b05fe4ef8081836b2694b` | `DragonFruit::EndHitAnimation()` |
| `game/assets/game/480x800/Fruits/dragon-fruit-bottomleft.png` | `60x45` | `2344` | `d1d3fcec1a6641ebd251121cc7ce69e860829e4d612e3acbbe389efe5123aeb4` | `DragonFruit::EndHitAnimation()` |
| `game/assets/game/720x1280/Fruits/dragon-fruit.png` | `177x153` | `10348` | `732896881a7e1a7f09c64785b575b0a8af8206b8cfedd0641171d38c7c8905f3` | `DragonFruit::create()` |
| `game/assets/game/720x1280/Fruits/dragon-splash.png` | `21x601` | `1585` | `ef26e694a93c906814a2dba82b40df33f91e08d837df9ca3aa7e34a5ef1a990e` | `DragonFruit::onEnter()` / hit animation |
| `game/assets/game/720x1280/Fruits/dragon-fruit-topleft.png` | `73x66` | `2385` | `d7d8ee43543dd5f1150383bc3e0749f81c5141a3e22fdaa833e6bdc083512ea5` | `DragonFruit::EndHitAnimation()` |
| `game/assets/game/720x1280/Fruits/dragon-fruit-topright.png` | `103x73` | `3300` | `d5894dbc3b8bd49e097780095bafe015bba257f1ea5048ee258dd847187e7cea` | `DragonFruit::EndHitAnimation()` |
| `game/assets/game/720x1280/Fruits/dragon-fruit-bottomright.png` | `89x84` | `3013` | `f86449cf1a7b3fdf48767ac1c795bd2267762d4e44ac67946227795c9da75ad2` | `DragonFruit::EndHitAnimation()` |
| `game/assets/game/720x1280/Fruits/dragon-fruit-bottomleft.png` | `91x68` | `2968` | `052cf5615974e3042a7648a9fed7b5243c66de60353454f8c61dbe2568647fe5` | `DragonFruit::EndHitAnimation()` |

### BombElectric raster set

Crazy constructs `BombElectric` on entry and ID `13` starts it. Static
`BombElectric::TurnOnElectric()` binds the indexed `Electric/electric%d.png` frames for
indices `0...7`; `BombElectric::onEnter()` binds the left and right node rasters.

| Target path | Dimension | Bytes | SHA-256 |
|---|---:|---:|---|
| `game/assets/game/480x800/Electric/electric0.png` | `447x57` | `31243` | `3b80c32fd64aa149bfc81196d62c603f0f0447dc678620a95f94844464b2bf71` |
| `game/assets/game/480x800/Electric/electric1.png` | `453x74` | `23673` | `ce7b1751c5c42fe2abe9356d627481ea82f98e7d4b9b58b45e7cc59ceaf61f56` |
| `game/assets/game/480x800/Electric/electric2.png` | `441x52` | `26331` | `79deca2f8ae6508d35a74bfe1bd057bd17ff01b78a670a562400c3b75c950fae` |
| `game/assets/game/480x800/Electric/electric3.png` | `459x73` | `22064` | `dbbda0fab640f2c24afd30bfbc6b376ea2d7fcc142e251279cf486b9bc332c13` |
| `game/assets/game/480x800/Electric/electric4.png` | `453x72` | `21451` | `465f514ce5133f2d8404591d3a0e1aff1b3356a264e05bd0258bf11ebb7b9543` |
| `game/assets/game/480x800/Electric/electric5.png` | `447x65` | `21555` | `2f1c0543e3275a2eaaef801c5d983f3074a4d320d41537aaa2f5dd6dfdb85f8d` |
| `game/assets/game/480x800/Electric/electric6.png` | `453x65` | `22624` | `3695c71da340a298593d3806b2d7bbd6e39ace581e22bd0fcbd3dcad10970577` |
| `game/assets/game/480x800/Electric/electric7.png` | `453x76` | `31139` | `280e4e5cf8433e5d37ba2c875bc961670664a992fef059a4664e4fd6092d7878` |
| `game/assets/game/480x800/Electric/left-electric-node.png` | `38x30` | `601` | `b52e87aaf9f5f6fe7228317bd317fdf40e82eb3bb93bd4623a1fefa2d5bec760` |
| `game/assets/game/480x800/Electric/right-electric-node.png` | `39x31` | `720` | `7807f1898cfc76cd3f2b3e4dd414cb54a704ee186250b01967dcfa1826f6880a` |
| `game/assets/game/720x1280/Electric/electric0.png` | `655x70` | `48373` | `98b755be9905205bf9ee5973088a155ccf900d1f3998e86b995417b5255f581b` |
| `game/assets/game/720x1280/Electric/electric1.png` | `660x92` | `35593` | `6d10717d1687bc52d2fba7cfc7f4fa6e39de375c736fd465fb55d83aae013bf0` |
| `game/assets/game/720x1280/Electric/electric2.png` | `649x64` | `40707` | `cbe17525a3b30bac5895ef1da89d5617bbadfdce8f93028e13ac5ed733cd736c` |
| `game/assets/game/720x1280/Electric/electric3.png` | `666x86` | `31942` | `24af9f6b3b063d8eac96bfe303b0237f714c184f471702fb5549eb83a287078b` |
| `game/assets/game/720x1280/Electric/electric4.png` | `661x89` | `31791` | `de35b8587a66da81ed4e9c9ab98fa264b248a3d9a4c3e56d283aa9b8da08e887` |
| `game/assets/game/720x1280/Electric/electric5.png` | `655x80` | `31171` | `50ced3f57e863f624a435637e484c6016746b2fead0bf97f239b5c40424a4135` |
| `game/assets/game/720x1280/Electric/electric6.png` | `661x81` | `35540` | `c9f9b9744767ce438ae2c04c0c10b99ed8a887fab5786237cc1b604e06312dfc` |
| `game/assets/game/720x1280/Electric/electric7.png` | `660x94` | `47805` | `87a8fcfe1e6ac8fa2094a749d50ab772e933c6665ddfd26c0b55b58c4ee7d91b` |
| `game/assets/game/720x1280/Electric/left-electric-node.png` | `57x45` | `788` | `cea96a279f2b2e3ade31bbf43371e5852539f5772f2105311478541361c723fe` |
| `game/assets/game/720x1280/Electric/right-electric-node.png` | `58x46` | `928` | `d75a1d1ae3d87eeeea757e687aff878a3a6c375b1695e325cd21171afe4bef9d` |

### MagnetAnimation raster and audio set

Crazy ID `14` creates `MagnetAnimation`. Its static body binds `Interfaces/magnet.png`,
creates the animated line from `Interfaces/magnet-line.png`, and requests looping
`Sounds/magnet.wav` when effects are enabled.

| Target path | Dimension / type | Bytes | SHA-256 |
|---|---:|---:|---|
| `game/assets/game/480x800/Interfaces/magnet.png` | `139x142` | `9301` | `9d10fa1a8c5580e15a6ca94165b97405dc272368b14bf00c78e7349eb908db95` |
| `game/assets/game/720x1280/Interfaces/magnet.png` | `170x175` | `13974` | `789e9c21ec2024878ce9d156196bc25b9808eae183f2776549b72fd577b278f1` |
| `game/assets/game/480x800/Interfaces/magnet-line.png` | `105x34` | `2327` | `d1d807675b0d90a352ec9f0f26452eeb15c233fd03af7ba66408932318e550b1` |
| `game/assets/game/720x1280/Interfaces/magnet-line.png` | `157x51` | `3462` | `6406fa75db124d2c331cb085e6134c2ea740e83786dbf3f157bd0bb6345d6edf` |
| `game/assets/game/Sounds/magnet.wav` | audio | `645166` | `f7d73451db61258e80543cb1667a675f17b6f71fa8f67a831e5e90f7aa9746ac` |

## Available Shared Assets, Not a Proven Crazy Denominator

The manifest contains the shared normal-fruit triples, standard bomb rasters, critical
particles, score and pause UI, result presentation, reward sprites, result buttons, and the
shared cut/combo/bomb/rank/swish/navigation audio families described by the contracts.
Availability is verified, but this revision does not promote a family summary into an exact
per-path Crazy consumer claim.

Mode Select also directly consumes the staged Crazy and Crazy Bird card/description assets.
That is a Mode Select consumer relationship, not proof that `CrazyModeLayer` consumes those
rasters.

The six corrected Classic-only logical paths remain staged in both resolution trees, but are
explicitly excluded from the Crazy consumer surface:

| Available paths | Crazy verdict | Static reason |
|---|---|---|
| `Text/text-good.png`, `Text/text-luck.png` | excluded | Crazy owns the `60s` then `GO` gate |
| `Text/text-game.png`, `Text/text-over.png` | excluded | Crazy ends through `text-time-up`, not Classic `GAME` / `OVER` |
| `Interfaces/object-x-normal.png`, `Interfaces/object-x-filled.png` | excluded | Crazy misses submit `(4, 1)` without fail markers |

## Unresolved Availability / Consumer Links

| Canonical path | Availability | Consumer status |
|---|---|---|
| `Text/text-nobomb.png` | staged in both resolution trees | unresolved; do not claim as Crazy |
| `Leaderboard/leaderboard_crazy.png` | staged | inferred candidate only; no exact consumer proven here |
| `Leaderboard/leaderboard_crazy_bird.png` | staged | inferred candidate only; no exact consumer proven here |

## Coverage and Gate

- The prior `70` transitive / `86` total figures are invalid and withdrawn.
- No replacement numeric denominator is asserted.
- A GREEN numeric denominator requires an exact canonical-path-to-consumer map for every
  Crazy-owned and shared mandatory dependency, including all required audio and result paths.
- The manifest-backed special-fruit, `BombElectric`, and `MagnetAnimation` inventories above
  are exact and integrity-verified.
- Overall Crazy resource checkpoint: **AMBER**.

## Limitations

- No original runtime execution or pixel/audio timing observation.
- No claim that manifest presence alone establishes reachability.
- No claim that the shared presentation/audio family map is exhaustive.
- No rights decision for reuse or redistribution.

## References

- `assets/catalog/creator-staging-manifest.json`
- `forensics/contracts/crazy-mode-contract.md`
- `forensics/contracts/classic-toss-contract.md`
- `forensics/contracts/classic-time-state-contract.md`
- `forensics/contracts/classic-cut-score-contract.md`
- `forensics/contracts/classic-presentation-contract.md`
- `forensics/resources/resource-usage-map.json`
- `.forensics-work/phase-01/native/strings.txt`
- `.forensics-work/phase-01/native/dynamic-symbols.txt`
- `plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-23-crazy-mode-contract.md`

## Unresolved Questions

- What is the exact per-path consumer map for the remaining shared Crazy result, presentation,
  and audio dependencies?

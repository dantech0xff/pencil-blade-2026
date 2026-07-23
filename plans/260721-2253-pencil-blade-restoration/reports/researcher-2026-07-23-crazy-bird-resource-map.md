# Crazy Bird resource delta map

Date: 2026-07-24
Scope: native mode `4` / `CrazyBirdLayer`, static evidence only

## Verdict

Crazy Bird is the existing Crazy graph plus `BirdBlade::createWithType(2)`. Its
additive staged-resource delta over the restored Crazy and Classic Bird
foundations is exactly **15 rasters per resolution profile**:

- 12 gameplay rasters: ten type-2 bird animation frames and the type-2
  left/right direction sprites;
- 2 Mode Select rasters: the Crazy Bird card circle and description;
- 1 leaderboard raster: the Crazy Bird leaderboard header.

There is no Crazy-Bird-only audio, font, particle, shader, material, or result
asset. The mode reuses all 37 Crazy rasters, the five common Bird rasters, the
shared result closure, and existing shared audio/fonts.

Certainty vocabulary follows `forensics/README.md`: **recovered** means a
native body, native path, staged file, or committed contract proves the
relationship; **inferred** means composition is strongly supported but the
original consumer was not recovered; **unknown** is deliberately unassigned.

## Exact 15-raster delta

Each profile column is `width x height; bytes; SHA-256`. Paths are logical
paths below `480x800/` or `720x1280/`.

| Path | 480x800 | 720x1280 | Consumer certainty |
|---|---|---|---|
| `Birds/bird-anim-2-0.png` | `140x116; 6774; 79ea774f7ee26fe3ddf75a2f01e12c89dd879b7a686e60a694fe94db27f6b72f` | `172x138; 11230; 4112eb49e352635de9a6a54a2ed4ca561beb0d184543959966d2721c5f09159e` | recovered |
| `Birds/bird-anim-2-1.png` | `138x118; 6890; c7d41c5fb53f307b9f73b2a573c31aa756620110a6097ae254dc4eb4a2a97b4e` | `171x141; 11311; 2bbe07ee81671b3c5ea1d961fe51afc5515c1862a4f29174440deee59319eb83` | recovered |
| `Birds/bird-anim-2-2.png` | `138x122; 7177; 1e003f3d89d2df21453d2fd335cc337a24400920f140860de6cdf94bb76bc402` | `171x146; 11659; 75bc9e8cfd2de90eb4e7cbf5c9564403eedcf268da419b2f77383df3a3509a59` | recovered |
| `Birds/bird-anim-2-3.png` | `138x118; 6827; 5354b766439900acb8b66dc0dbf85689c4d1b09ac5b08e09b3791cc7a9481c3f` | `172x142; 11185; a1aaf2767c929d280dc0e4cb91ba7d8946a4ecf42d9da907891443b2af6c18fc` | recovered |
| `Birds/bird-anim-2-4.png` | `140x116; 6775; cf4ae5fc7aa4a5df94d34543bd20d31d4a5ca5eda62282dedb000fe076d80426` | `172x138; 11113; feedff6857db3497b186edb4b8dd56e68d1bffae50137d8bc5ab0a18c8636410` | recovered |
| `Birds/bird-anim-2-5.png` | `139x111; 6437; db95abb39b5770900bb9d61bb1fc924cb67ec6987514b3b75b11ef175728b9ff` | `172x130; 10578; 2553b01d5718b0b0cb8d538fe4987ca5f132fbe4714de13a9dcaad77efeee7b8` | recovered |
| `Birds/bird-anim-2-6.png` | `137x108; 6310; 3dcfb70c8ea7bffa71bb3385afee66ef56305c8025cafb15068c2f20fee29eb9` | `168x129; 10427; e4a59fa97ca1aa1771897e5c9160cd273a3206edecf726713ee898fd0a7b2a35` | recovered |
| `Birds/bird-anim-2-7.png` | `130x104; 5786; ac7bb046f611d652953e9f6f867b8f196842502035c98c58deee3eb95eca666a` | `159x129; 9760; b9f47276aeeb186732f0e3db2fe06655c2545e1ebfb955fa9a38998badb7d97e` | recovered |
| `Birds/bird-anim-2-8.png` | `137x108; 6321; 31a95f0589b685faca868a4327bae6c33acf015e876f3c7e4cf5eafde08329ec` | `168x129; 10381; 0c8c68494fc668599bfccddd619aaa063af8fc7b175fd103d8abf2bd8ea242ee` | recovered |
| `Birds/bird-anim-2-9.png` | `139x111; 6399; 271651c0017c450474eb4aef874c15b5603029d7c589df93098b45573f7dfff8` | `172x130; 10577; 3ca325520f3eded01581993f52c972781e1c152fdb0b49d86cbeba278d8866b8` | recovered |
| `Birds/bird-left-2.png` | `110x101; 4047; 54ac2cbb114af96ba779151cd80931bef3b40e3bfa87768101926fa67737f842` | `129x115; 5913; bdfce0532c972e53d13761a566efe3148bf2737caaab86c7b901221dd922ff9a` | recovered |
| `Birds/bird-right-2.png` | `111x101; 4120; 3500fa3802c38091111ad1391dfba7d130ad231ad820cb683bf2398d9aa25e9a` | `129x115; 5889; 9b48afdec7baca3aad5b9c439c95e51b96299a68c955bb2c6d43f16894d3fab1` | recovered |
| `Interfaces/mode-crazy-bird.png` | `254x263; 31958; a91aa29a3194e934692e0b4f4115f7ae881fdc14e2a754fe80672c753c8eb775` | `345x358; 51728; dcc815e260c895199d1df3044a2b33322b0bcc45c84fd048bab3ceb04c3a4b63` | recovered card index 4 |
| `Interfaces/object-crazy-bird-des.png` | `149x202; 17863; bf8c5f5a7e02c637dd07d5f7d1d7f257dabffe2bce05fd8a232a69ab35728851` | `223x301; 28891; 6f722fe0cb00b00b1a672224db380d2ffb4b3e50921914ce46cbbd6988e65be4` | recovered card index 4 |
| `Leaderboard/leaderboard_crazy_bird.png` | `466x115; 7065; 033addf4029874bc31e446fa88deaefa3de02a435639b1fe8be7177e286071bb` | `663x138; 10850; 432223981f8d3c0c4280a6b7dc59b48a0efdb1f54386bf565774624a43323af1` | recovered leaderboard index 4 |

The type-2 contract cannot be implemented as a path-only replacement for type
1. Direction geometry differs: type 2 is `110x101` / `111x101` at 480 and
`129x115` / `129x115` at 720; type 1 is `110x102` / `110x102` and
`129x116` / `129x116`.

## Shared versus mode-specific closure

| Owner | Exact resources per profile | Crazy Bird use | Certainty |
|---|---:|---|---|
| Crazy supplement | 37 | five special-fruit triples; six Dragon Fruit rasters; `Text/text-60s.png`, `Text/text-go.png`, `Text/text-time-up.png`, `Interfaces/object-time-freeze.png`; eight `Electric/electric{0..7}.png`; two electric nodes; `Interfaces/magnet.png`, `magnet-line.png` | recovered, reused unchanged |
| Bird common | 5 | `Blades/testblade7.png`; `Blades/Particles/X-Mas/xmas{five,four,hexa,circle}.png` | recovered |
| Bird type 2 | 12 | exact delta table above | recovered |
| Classic gameplay foundation actually consumed | 49 | 27 ordinary-fruit rasters; background/cup/double-score/score-icon; 12 result rasters; bomb and smoke; four critical particles | recovered/shared |
| Base gameplay | 13 | nine pause rasters, two objective-message rasters, xmas five/four | recovered; two overlap Bird common |
| Configurable scene catalog | 26 | `Backgrounds/paperbackground{0..8}.png`, `Leaf/leave{7,1,2,3,4,5,6}.png`, `Themes/theme{0..9}.png` | recovered shared loader; one background overlap |
| Mode Select card | 5 | two unique card rasters plus the existing Crazy ID-14 magnet-strawberry triple | recovered |
| Leaderboard item/layer | 3 | unique Crazy Bird header plus shared template/title | recovered |

The mode session (gameplay, pause, objectives, configurable environment, and
results) has 139 unique raster paths per profile after removing the
`paperbackground0` and xmas-five/four overlaps. Only 12 of those are new for
mode 4. The Mode Select and leaderboard mode-specific additions bring the
additive cross-screen delta to 15; generic screen scaffolding is already shared.

Classic loader availability is broader than Crazy Bird consumption. Do not
make these Classic-only assets mode-4 requirements:
`Text/text-good.png`, `text-luck.png`, `text-game.png`, `text-over.png`,
`Interfaces/object-x-normal.png`, `object-x-filled.png`, and
`Blades/blade0.png`.

The five shared Bird rasters are fingerprinted as follows:

| Path | 480x800 | 720x1280 |
|---|---|---|
| `Blades/testblade7.png` | `64x65; 2122; 2da2bf2b18fa27a049189003d03de4756424d664a41ef94869485ee998fc976f` | identical |
| `Blades/Particles/X-Mas/xmasfive.png` | `46x44; 1029; 2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2` | `66x64; 1408; a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3` |
| `Blades/Particles/X-Mas/xmasfour.png` | `51x59; 914; 5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385` | `70x83; 1216; 7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39` |
| `Blades/Particles/X-Mas/xmashexa.png` | `32x36; 800; 36f8ce97327c768fe14e1169672bf5a53147fdb314b086d9559a38631710bef9` | `47x53; 957; cc4217637576b6c7bb0c92d400905058e952c8bcded9fa90ea4423637d5a89ab` |
| `Blades/Particles/X-Mas/xmascircle.png` | `34x34; 869; 97f32efcd79fd577a2a23bede4724f8df0e6ccf4a331fdb481b9bad8622525c8` | `49x50; 1196; a5f33bf414f4e4c31fe2bea1ea66fbc6f52a8f495ac1436fb0e6a237b515719e` |

The full 37-raster Crazy fingerprint table is unchanged from
`researcher-2026-07-23-crazy-resource-map.md`; the authoritative source for
both profiles remains `forensics/resources/resource-usage-map.json`.

## Mode card, leaderboard, and result closure

Mode Select index 4 uses fruit ID 14 and destination `CrazyBirdLayer`, reads
`mode_unlock_4`, cuts with `Sounds/mangosteen.wav`, then hands off with
`Sounds/gameplayselected.wav`. Its three fruit rasters are not a delta:

| Path | 480x800 | 720x1280 |
|---|---|---|
| `Fruits/fruit-magnetstrawberry.png` | `83x64; 5911; b8fab709ca973e11dbf5392b79f7613095a84afc26c763083d2bb9b8a24ab0c3` | `125x95; 9632; 8bc5a9a8a0b5847eda4cf405fcad4f8df7b0be11e8f13ab6ca4e1e129470fcea` |
| `Fruits/fruit-magnetstrawberry-cut-top.png` | `83x39; 3584; 5efc020cee9eda910528e07e470dc57f5fa2037d49e962fb794c5fe2b34bdb9d` | `125x58; 5812; 3fea82af68bc48cfe146c2d6948b4fec68a9873b3aac5fa4f6564b4c720e8718` |
| `Fruits/fruit-magnetstrawberry-cut-bottom.png` | `79x44; 3682; e823aa72af3f4fa820bb614666f7f8241b657cb72d716ae382f381d897156379` | `117x54; 5485; b8ceef1fcafb9151b4d5e7effe81f31b3b658b7ed5033a31e4ca544e9dc4ae99` |

`Interfaces/object-des-shader.png` is a shared raster overlay, not shader
source.

Leaderboard ownership is now recovered, not inferred. In
`LeaderboardItem::onEnter()` the six-entry case table at `0x15885a` maps item
index 4 to the branch at `0x158936`; the sprite path loaded at
`0x158964` resolves to `Leaderboard/leaderboard_crazy_bird.png`.
`LeaderboardLayer::onEnter()` constructs item indices 0 through 5 and directly
loads `Leaderboard/leaderboard_title.png`. Shared leaderboard resources:

| Path | 480x800 | 720x1280 |
|---|---|---|
| `Leaderboard/leaderboard_view_templete.png` | `540x586; 32237; 37ab4c425142a96e8cebd7187cb765dcc8ca72d38f1f573628850cc6f6877311` | `773x844; 51495; 047b9d88999ec7e6e5c3f335880fa0b807fa02b843aea7a47c62910dace44e5b` |
| `Leaderboard/leaderboard_title.png` | `552x118; 26737; c7f7af4d248120b5ce6ad46d14001c4654c91cb1cb5d468360d8c0ccd7eb6095` | `793x159; 50708; 696ee696db62266e7c218d762c32f0fc22694b9551518f43402eb479b84ab104` |

Crazy Bird reuses the generic 12-raster result profile:
`Interfaces/object-display-score-background.png`, `object-bonus-coins.png`,
`object-bonus-coins-effect.png`, `object-bonus-particle.png`,
`object-coin.png`, `object-mode-results.png`, `object-medal-none.png`,
`total-coins.png`, and the menu/retry normal/selected button pairs. It uses
`Fonts/AgencyB.ttf`, `Fonts/SlabThing.ttf`, rank sounds
`firstplace.wav`/`secondplace.wav`/`thirdplace.wav`, reward factor `0.8`, and
mode-4 best-score storage. No mode-specific result art was recovered.
`object-new-best.png` and medal variants remain staged candidates without a
proved result consumer and must not replace `object-medal-none.png`.

## Audio cue map

The exact unique staged audio union is 49 paths: 29 shared Classic-core paths
plus 24 Crazy paths, with four overlaps (`mangosteen`, `critical`,
`tossfruit`, `strawberry`).

| Event | Canonical path(s) | Certainty |
|---|---|---|
| Bird touch began | `Sounds/swoosh1.wav` … `swoosh9.wav` | recovered; plays before the busy guard, 0.5 s lock |
| Ordinary fruit IDs 0..8 | `apple`, `banana`, `strawberry`, `waterfruit`, `waterfruit`, `mangosteen`, `apple`, `strawberry`, `apple` `.wav` | recovered |
| Critical cut | base cut then `Sounds/critical.wav` | recovered |
| Combo tiers | `Sounds/compo1.wav` … `compo3.wav` | recovered |
| Ordinary bomb toss/entry/explosion | `boomtoss.wav`, `boomsound.wav`, `boomexplosion.wav` | recovered |
| Special IDs 10..14 base/critical | `mangosteen.wav`, optionally `critical.wav` | recovered |
| ID 10 double score | `doublepoint.wav` | recovered |
| ID 11 double toss | `doubletosstrum.wav`, looping `doubletoss.wav` | recovered |
| ID 12 freeze | `freeze.wav` | recovered |
| ID 13 electric | `powerup.wav`; after 1 s `electricexplose.wav` and looping background `electric.mp3`; contacts choose `ehit1.wav` … `ehit4.wav` | recovered |
| ID 14 magnet | looping `magnet.wav`, starts at 2 s and stops at 12.5 s | recovered |
| Bonus toss | `tossfruit.wav` | recovered |
| Timer | `timetick.wav`, then `timeup.wav` | recovered |
| Dragon Fruit | first hit `hitmusic.wav`; accepted hit `strawberry.wav`; finish `finishhitmusic.wav` | recovered |
| Objective/result/navigation | `cheer.wav`; rank paths; `menubuttonclick.wav` | recovered shared |
| Mode card | `mangosteen.wav`, then `gameplayselected.wav` | recovered shared |
| Crazy preload-only | `boomhit.wav`, `eapplecut.wav`, `lightning1.wav`, `lightning2.wav` | recovered preload; play consumer unknown |

`mainmenumusic.mp3` is part of the shared app-shell preload, not a Crazy
Bird-owned music start. No new mode-4 sound should be invented for it.

## Fonts, particles, and materials

| Font | Bytes | SHA-256 | Consumer |
|---|---:|---|---|
| `Fonts/Linds.ttf` | 67068 | `1b2b53f71f90afe4465d22ee31537adbd5d30285145419508f6202a2f1797729` | score HUD |
| `Fonts/GroBold.ttf` | 25388 | `98e9c349709da1cd410d65b2954d30e355c154a8ea52004ecbe6eb0d8205d040` | combo |
| `Fonts/AgencyB.ttf` | 60656 | `4fde694cc486b55266f7561c685fbd9153ea0003f0c0c39fc744b132051d40c5` | results |
| `Fonts/SlabThing.ttf` | 161488 | `9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8` | Mode Select/results |
| `Fonts/Arial.ttf` | 755624 | `b97a1e2bb9fedbf9aa99f6b14ef5a7f057c6611dd71698381cc44f77797a4223` | pause/objectives/leaderboard |
| `Fonts/MotorwerkOblique.ttf` | 21908 | `79e1421be053bcbdcbb729f1757c68e063da4790fe4bd2862db3b7cdad348a34` | Crazy timer |
| `Fonts/Razing.ttf` | 26032 | `b8625e4ffae84cc83aea4d067cfe0c315562289f3ed1205d1522c93609b715b7` | Dragon counter |

Particle-like visuals are ordinary staged rasters: the four X-Mas Bird
particles, `Criticles/criticle{1..4}.png`, `Bomb/bombsmoke.png`,
`Interfaces/object-bonus-particle.png`, and the Crazy electric frames/nodes.
No `.effect`, `.material`, `.mtl`, `.plist`, or `.fnt` asset exists in either
profile. The current Bird presenter builds a runtime material using
`builtin-unlit`, vertex color/texture defines, a triangle strip, disabled
depth, and `Blades/testblade7.png`; that is implementation evidence, not an
original external shader asset.

## Missing-consumer blockers

- `bird-resource-contract.ts` and `loadBirdResources` are hardcoded to type 1;
  mode 4 needs an explicit type-2 profile and its different direction geometry.
- A Crazy Bird loader/controller must compose Crazy + Bird resources instead
  of duplicating either graph.
- The four Crazy preload-only sounds have no recovered play call; keep them
  staged but unassigned.
- No direct consumer was recovered for `object-new-best.png` or medal variants.
- There is no missing shader/material file: the blade material is runtime-built.

Unresolved questions: none that block the exact resource delta. The explicitly
unknown consumers above should remain unknown until new native evidence exists.

Status: DONE
Summary: Exact 480x800/720x1280 Crazy Bird delta is 15 rasters per profile—12 type-2 Bird gameplay rasters, two Mode Select rasters, and one recovered leaderboard raster; all audio, fonts, effects, result assets, and remaining rasters are shared.
Concerns/Blockers: Preload-only Crazy sounds and optional result art must not be assigned without additional consumer evidence.

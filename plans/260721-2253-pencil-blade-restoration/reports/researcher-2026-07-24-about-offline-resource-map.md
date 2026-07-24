---
date: 2026-07-24
role: researcher
scope: About screen resources and retired-service offline boundary
evidence_mode: static-only
---

# About and offline resource map

## Summary

The recovered Android About screen has a closed ten-raster visual set:

- `Backgrounds/aboutbackground.png`;
- normal/selected pairs for Main Menu, review, email, and like;
- `Interfaces/heart.png`.

It uses the shared `Sounds/menubuttonclick.wav` only when entering from Main Menu and when
returning to Main Menu. The already-running `Sounds/mainmenumusic.mp3` is not stopped by the
native About transition and is not an About-owned load.

Both `480x800` and `720x1280` trees contain exact logical counterparts. There is no
About-specific font, particle system, particle texture, shader, material, unavailable-state
raster, or offline badge. All visible credits and labels are baked into the background.

The direct About set is staged with exact bytes but has no Creator contract, loader,
presentation, presenter, or shell route. Main Menu already consumes its separate About-entry
pair and separate review pair, while the shell deliberately rejects `AboutLayer`.

## Evidence and confidence

- [Resource usage map](../../../forensics/resources/resource-usage-map.json): canonical paths,
  dimensions, byte counts, SHA-256 values, exact tree pairings, native resource strings.
- [Creator staging manifest](../../../assets/catalog/creator-staging-manifest.json): exact target
  paths and exact-source-byte import policy. It records all 862 recovered assets as byte
  verified with zero mismatches, although its historical consumer and metadata counters are
  not current.
- [Main Menu presentation contract](../../../forensics/contracts/main-menu-presentation-contract.md):
  current About-entry/review resources, resolution branch, navigation, and platform boundary.
- [Java/JNI boundary](../../../forensics/native/java-jni-boundary.md): recovered review, email,
  Facebook, ads, network sentinel, and persistence behavior.
- [Native function map](../../../forensics/native/function-map.csv): `AboutLayer` anchors
  `0x001416D8..0x00141B44`.
- [Phase 6](../phase-06-recreate-full-game-content-and-progression.md): retired services require
  intentional offline behavior; obsolete ads/analytics must not be restored.
- [Reconstruction policy](../../../reference/reconstruction-policy.yaml): exact geometry/bytes,
  no trim, recompression, audio resampling, font substitution, or unknown-rights shipping.

GNU 2.27 and LLVM 19.0.1 Thumb disassembly were cross-checked read-only for
`AboutLayer::addHeartCallback`, `likeCallback`, `emailCallback`, `menuCallback`, `onEnter`, and
`reviewCallback`. No APK, native library, activity, network service, or external intent was
executed. Resource identity and direct call sites below are **recovered**. Proposed Creator
ownership is a target requirement. Retired-service replacement policy remains a product
decision.

## Exact Android About raster closure

Each profile cell is `dimensions; bytes; SHA-256`. Prefix each logical path with the tree name
to obtain the canonical bundle path and with `game/assets/game/` to obtain the staged file.

| Role / logical path | `480x800` | `720x1280` |
|---|---|---|
| background — `Backgrounds/aboutbackground.png` | `481x801`; `500401`; `584698d06da37717f7273d8a84cb022e991596b086c3e9dda2344cb7894c47b1` | `721x1281`; `589728`; `eacf6a7f6ec933d09a7c0ff3afb171b91181e476a6a3cd02d273ff34c776c9ab` |
| Main Menu normal — `Buttons/button-menu-normal.png` | `91x87`; `7747`; `243d2e150e62898c09a6ba77c89d61ed3968f9ea54ce90e90f27d04c5c5c6c93` | `137x129`; `12700`; `abac9c8686c9ea40064ab07fdbe14caa5b6bcea8bc9146a4c2723a70a7fddf96` |
| Main Menu selected — `Buttons/button-menu-selected.png` | `91x87`; `7503`; `ea26ea4b7fe9b3aa81724d9e00fd13b9c4b587fc9b61c881ae66d14e77d4a8db` | `137x129`; `12383`; `6ab583b99d119ad69efb2c2e7d990f154996d3863ba53b8298a1ea1e79793558` |
| review normal — `Buttons/button-review-normal.png` | `105x96`; `12734`; `d78957b90a4f09f2866addaba19a7361d4b225f64c974cef6d4782aa9dc4c7c4` | `156x142`; `24496`; `c292b590a6442d86cf452204bb79b490321913a0aa7bbed59b46e3aa7a371704` |
| review selected — `Buttons/button-review-selected.png` | `105x95`; `13331`; `ad839c70a4887165372824cfbfb2b0880fe1303288fdcde0cbd7cc62b7e3925e` | `156x141`; `25073`; `7127fa1b06e56c973e41dbbd975fc876e9839c1c6495937b2b1728f870d19d11` |
| email normal — `Buttons/button-email-normal.png` | `91x65`; `5142`; `b753b91e7ffb9f0fb20f34ed1e9ac8bb11b2f39429e22dbdfc47dae999a2e989` | `135x97`; `7977`; `d27d3fc3bc97eb6f0175bf97d6b0564f26857cde30c447b2b1e9c2b45f6ae4c8` |
| email selected — `Buttons/button-email-selected.png` | `91x65`; `4471`; `53ac04ac61e7c53d0b26c90b1c9eb87c0d7eb74a00600a85914b2b93660d1a05` | `136x97`; `7062`; `dc1b5c6ba627acddbc02a0e79ef4acaf9c534927120be467aaa002ffd3b537ba` |
| Facebook-like normal — `Buttons/button-like-normal.png` | `134x133`; `4086`; `7ee31e494f5adc6067ab8df6615901f08943a523794b1854e9bfaee359011e32` | `166x164`; `4990`; `fd63c38bf5afa5165287814646836f5d8d2f922477a4163b3f5c6428fb939dd5` |
| Facebook-like selected — `Buttons/button-like-selected.png` | `134x133`; `3940`; `f420810263ee555b5ad3b9310c9c280a42d1d73e715206e1f7d5526b63ad4496` | `166x164`; `4932`; `c6f8f86545317b318593b8150732f5b53edf22e32511a9d7704e83544ce69aa4` |
| review-heart sprite — `Interfaces/heart.png` | `30x33`; `1450`; `0964ff4e27f16bd1563ea8740580e71e27d7cd342eaf3c75e0120594a485731f` | `44x50`; `2108`; `3329a1cde82e888e06fbb497579cc7dea391b56d4da322868698291665702254` |

The Android native body names every row except the selected profile prefix, which is supplied
by the shared resolution selection. It directly names `Backgrounds/aboutbackground.png`; it
does not name the `-ios` variant.

## Main Menu entry and offline-service rasters

These are related to reaching About or to the same retired review service, but they are not
aliases for the direct About controls.

| Role / logical path | `480x800` | `720x1280` | Current consumer |
|---|---|---|---|
| Main Menu About normal — `Buttons/button-about-normal.png` | `87x116`; `6980`; `ae37fca1dd8a9259470fd49fc17a2fe7148a8c69203b0cb38829bf877afd98e0` | `125x139`; `10731`; `d51ada56f87850c80e89d0bcbb66dd757d7c166bebab8a864a08a27087b0c27f` | `main-menu-resource-contract` / `MainMenuPresenter` |
| Main Menu About selected — `Buttons/button-about-selected.png` | `87x116`; `6491`; `8d7d1e5d7ecbd5f2f915e66e9e737eb6d87cb5f61929408ccccaa7c1072f941a` | `124x139`; `10176`; `29b80ffaa405cca8c1bb56faae398dc31509485d0a76734861d95e24af4fdcc3` | `main-menu-resource-contract` / `MainMenuPresenter` |
| Main Menu review normal — `Interfaces/reviewbutton.png` | `70x66`; `4877`; `ebd96588441ec23b88211997b14ad08a43cae1cd18dcfcb185bbf6e78357e37b` | `87x82`; `9025`; `fe454071c7ae4b1eedf518033ebe3e2f8c17cf156ce32d9393f395c9730bb504` | `main-menu-resource-contract` / `MainMenuPresenter` |
| Main Menu review selected — `Interfaces/reviewbuttonselected.png` | `70x66`; `5144`; `21a805d780a05ed5d5bce0610861dd978883a26e441ce2e710e82c4cd2f05692` | `87x82`; `9460`; `261c8783cc6e0f0593657bdf868197f98ee301b8080b633cba354eb76d660b23` | `main-menu-resource-contract` / `MainMenuPresenter` |

Current Main Menu explicitly prohibits `Buttons/button-review-normal.png` and
`Buttons/button-review-selected.png` because those belong to About. Conversely,
`Interfaces/reviewbutton.png` and `Interfaces/reviewbuttonselected.png` must not be reused for
About.

## Audio, fonts, particles, and shaders

| Resource | Bytes | SHA-256 | Exact relationship |
|---|---:|---|---|
| `Sounds/menubuttonclick.wav` | `32812` | `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e` | PCM, stereo, `44100Hz`, 16-bit. Effects-gated one-shot after successful Main Menu -> About attachment and after successful About -> fresh Main Menu attachment. Already in `CLASSIC_CORE_AUDIO_PATHS`. |
| `Sounds/mainmenumusic.mp3` | `718785` | `53378d6d153e22fa9b0b5a64c8c130e58f0c3ae649ad3750e921d839c45151a1` | Main Menu-owned looping track. Immediate About navigation does not stop it. About must not start a second independent music owner. |

- **Fonts:** none. The background raster bakes the version, purchase thanks, credits, support,
  and Facebook-page copy. No `CCLabel` or font resource is created in `AboutLayer::onEnter`.
- **Particles:** none. Hearts are ordinary `CCSprite` children with scale/fade/move actions,
  not a particle system.
- **Shaders/materials:** none are named or constructed by the reviewed About body.
- **Extra sounds:** review, email, and like callbacks make no direct audio request.

## Resolution profile and exact Creator presentation

The existing recovered branch remains authoritative:

- physical frame width `< 720` selects `480x800`;
- width `>= 720` selects `720x1280`;
- layout uses the selected logical design `W/H` and visible-rectangle center;
- rasters retain natural dimensions, full rectangles, center pivots, and no trim or resize.

The one-pixel oversize Android backgrounds (`481x801`, `721x1281`) are evidence, not errors to
crop. The Creator contract must pass all ten selected rasters through
`loadExactGameRasters`, whose geometry check requires both original size and sprite-frame rect
to match exactly.

Recovered About construction:

1. Create `Backgrounds/aboutbackground.png`, position at `VisibleRect::center`, add at z `1`.
2. Create menu items in order: Main Menu, review, email, like.
3. Use the normal and selected raster from the same selected profile; no disabled frames exist.
4. Position the menu container at legacy zero and use these logical item centers:

   | Item | Position |
   |---|---|
   | Main Menu | `(0.50W, 0.10H)` |
   | review | `(0.15W, 0.10H)` |
   | email | `(0.85W, 0.10H)` |
   | like | `(0.75W, 0.335H)` |

5. Add the menu at z `1` after the background. Creator must preserve explicit sibling order;
   equal numeric z alone is insufficient.
6. Add the nonvisual gesture layer after the menu and bind the background as its gesture
   target. It adds no resource.

The current Main Menu About entry is already exact: it moves/fades for `1.0s` from
`(visibleLeft - 0.5 * normalWidth, 0.30H)` to `(0.125W, 0.30H)`. Its accepted immediate
callback must transactionally replace Main Menu with a fresh About root at shell z `1`, then
request the effects-gated click.

## Review pulse and heart consumer

About calls `Settings::RefreshNetworkConnection()` twice. Only when the recovered
`network_available` value is true and `rated` is false does the About review item run:

```text
ScaleTo(0.45, 1.15, 1.15)
-> addHeartCallback
-> ScaleTo(0.45, 1.0, 1.0)
-> addHeartCallback
-> repeat forever
```

Each callback creates one `Interfaces/heart.png` sprite, with recovered float32/random
boundaries:

- position `x = randomInt(0.10W, 0.20W)`,
  `y = randomInt(0.10H, 0.15H)`;
- initial scale `0.5 + randomFloat() * 0.5`;
- action duration `1.0 + randomFloat()`;
- independent fade-out over that duration;
- independent vertical move over that duration by
  `randomInt(0.10H, 0.25H)`;
- attach to About at z `1`.

This is a distinct About consumer even though Main Menu already loads and presents the same
heart resource around its own review control. A future About presenter should share the
process-owned gameplay RNG and the loaded profile frame, not Main Menu's position plan.

## Retired-service and offline boundary

Recovered legacy callbacks:

| Control | Legacy target | Recovered local behavior |
|---|---|---|
| review | Android market page for the current package | Always request the store intent. Only when `!rated && network_available`, persist `rated = true`, set memory true, and add `500` coins. |
| email | Android send chooser to `uitdev@outlook.com`, subject `About Pencil Blade on Android!` | No network/rated gate and no coin mutation. The background's baked `uit-dev@live.com` text does not override the Java target. |
| like | `fb://profile/525673680830818`, falling back to `http://www.facebook.com/uitdev.pencilblade` | No network/rated gate and no local reward. |
| Main Menu review | same market bridge | Same conditional `rated`/network `+500` reward, already isolated behind a synchronous shell approval event. |
| interstitial ads | obsolete Google Mobile Ads bridge from Options/DisplayScore | No About raster consumer. Excluded from About and prohibited by Phase 6 security guidance unless separately replaced and approved. |

There is no recovered visual offline state. Therefore a target must not silently map any
other button, font, icon, ad/vendor resource, or invented disabled raster. The safe Creator
boundary is:

- preserve local About/Main Menu navigation and exact visual resources offline;
- isolate review/email/like behind explicit platform ports;
- let unavailable or declined ports return without rated/coin mutation;
- report or present any new unavailable-state UX as an intentional compatibility decision,
  not recovered fidelity;
- never restore the obsolete Google Ads SDK as part of this checkpoint.

Current Creator behavior already follows half of this rule: Main Menu review requires an
explicit synchronous `recovered-app-shell-platform-review-requested` approval, otherwise it
fails closed without reward. About has no equivalent ports because no About route exists yet.

## Current consumers and missing consumers

| Surface | Current state | Required next consumer |
|---|---|---|
| Main Menu About pair | Loaded by `main-menu-resource-loader`, presented by `MainMenuPresenter` | Keep unchanged; route the existing immediate transaction to About. |
| Main Menu review pair | Loaded and presented; platform action isolated by shell event | Keep distinct from About review pair. |
| shared heart | Loaded/presented by Main Menu | Reuse the selected profile frame in a separate About heart plan. |
| click + menu music | Loaded by `ClassicAudioPresenter`; Main Menu uses both | Reuse the shared audio presenter; About owns no new audio loader/source. |
| ten direct About rasters | Exact files and `.meta` sidecars exist under both trees | Add an About domain resource contract, exact loader, presentation, and presenter. |
| app-shell resources | No About field; boot loads Main Menu, Mode Select, Leaderboard, Objectives, Options | Add About as an essential menu-screen resource load with failed-boot cleanup. |
| app-shell state | No `'about'`; `AboutLayer` reaches `rejectUnsupportedDestination` and returns false | Add transactional Main Menu -> About and About -> fresh Main Menu ownership. |
| shared viewport | Combines Main Menu, Mode Select, Leaderboard, Objectives, Options | Add the About viewport shape or use the same logical `W/H` and visible center contract explicitly. |
| platform ports | Main Menu review only | Add separate review/email/like ports; keep failures and unavailable results non-mutating. |

No fallback asset is needed. Every direct raster exists in both selected trees and the shared
audio already exists in the game bundle.

## Aliases, exclusions, and unknowns

### Explicitly excluded

- `Backgrounds/aboutbackground-ios.png` is staged in both trees but is not named by the
  Android `AboutLayer::onEnter` body:

  | Profile | Dimensions | Bytes | SHA-256 |
  |---|---:|---:|---|
  | `480x800` | `481x803` | `493349` | `38898d3ba9955bc5475f74292b430065b4d96a7732ce4224e4a84e382b4d8d93` |
  | `720x1280` | `721x1201` | `565118` | `44e7ea2e5a066644d7367392839c6b3263cce2b7221eb61c8831383a388d1ad6` |

  It is a separate logical pair, not an alias or fallback for
  `Backgrounds/aboutbackground.png`.
- `Buttons/button-about-*` is the Main Menu entry, not a control within About.
- `Interfaces/reviewbutton*` is Main Menu review; `Buttons/button-review-*` is About review.
- `Buttons/button-menu-score-*`, `Buttons/button-back-*`, `Buttons/button-blue-back-*`, and
  `Icons/back-button*` belong to other screens and are not About substitutes.
- The resource map classifies all 107 Android `res/` PNGs as launcher/vendor UI and zero as
  game content. Google service artwork must not enter the About game bundle.
- The only cross-tree near match is the unrelated Combo Bird
  `text-juscombo`/`text-justcombo` typo; About has no tree-name mismatch.

### Unknown or decision-bound

- Whether the product should expose inert legacy review/email/Facebook buttons, hide them,
  replace their endpoints, or show a new offline message is not recoverable from resource
  evidence and requires explicit approval.
- The nonvisual `CCGesturesLayer` receives the About background, but this resource pass does
  not establish any additional visible gesture outcome.
- Original runtime pixels, external intent success, network availability, email-client
  behavior, store availability, and Facebook fallback behavior were not observed.
- All recovered artwork/audio rights remain unresolved; exact staging does not make these
  assets ship-ready.
- The staging manifest's global `consumerStatus: unmapped` and metadata counters predate the
  current Creator consumers/sidecars; it must not be treated as a live consumer audit.

## Verification

- Selected manifest entries checked against staged bytes: `32/32`, zero size/hash mismatch
  (`15` logical raster candidates across two profiles plus two shared audio files).
- Resource-map pairing: every relevant logical raster is an exact cross-tree pair; no About
  unmatched or near-match row.
- Current source search: direct About paths have no production consumer; the four Main Menu
  pairs/heart/audio consumers above are present.
- Static body cross-check: GNU and LLVM agree on the six reviewed About functions and their
  direct resource/platform calls.
- No production code, asset, source manifest, APK, or native file was modified or executed.

## Unresolved questions

1. Which approved target behavior should replace review, feedback email, and Facebook when
   their legacy endpoints are unavailable or retired?
2. Should the Android target deliberately omit the staged iOS background permanently, or
   retain it only as non-consumed evidence?

## Status

Status: DONE_WITH_CONCERNS
Summary: Exact dual-profile About/offline resource closure and Creator consumer gaps mapped;
all staged candidate bytes verified without substitution.
Concerns/Blockers: Retired-service replacement UX/endpoints and permanent disposition of the
unused iOS background require explicit product decisions; recovered-content rights remain
unresolved.

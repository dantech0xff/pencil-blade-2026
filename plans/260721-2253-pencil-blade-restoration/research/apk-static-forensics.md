# APK Static Forensics

## Summary

Read-only analysis of Pencil+Blade_1.5_APKPure.apk on 2026-07-21.

## Verified Findings

- SHA-256: 95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa
- ZIP: 985 files, 41,007,977 bytes uncompressed; integrity check passed.
- Package: uit.dev.pencilblade
- Version: 1.5, versionCode 6
- Android: min SDK 9, target SDK 19, portrait, OpenGL ES 2.0
- Permissions: INTERNET and ACCESS_NETWORK_STATE
- Components: launcher PencilBlade plus Google Ads AdActivity; no declared service,
  receiver, or provider.
- App Java: PencilBlade, BuildConfig, and R. PencilBlade loads game and provides ads,
  email, review, Facebook, and network-state bridge behavior.
- Native: one lib/armeabi/libgame.so, ELF32 little-endian ARM EABI5. The
  .ARM.attributes CPU name is 5TE.
- Engine fingerprint: embedded paths name Cocos2d-X/cocos2d-x-2.1.4/PencilBlade.
- Core gameplay is native C++. Dynamic symbols expose many app class/method names.
- Game assets: 784 PNG under assets/, 59 WAV, 3 MP3, 15 TTF, 1 OTF.
- Android resources: 107 additional PNG under res/ (mostly launcher/vendor UI);
  classify rather than silently include/exclude them.
- Resolution trees: 392 files under 480x800 and 392 under 720x1280.
- No asset-level plist, JSON, XML, TMX, CCBI, Lua, JS, CSV, or similar level data found.

## Recovered Product Surface

ModeSelectLayer exposes Classic, Crazy, Classic Bird, Crazy Bird, Combo Bird, and GN Style.
Native systems include BaseGameplayLayer, PhysicsBladeLayer, TossTurn, WaveToss,
ConcurrentToss, FreeToss, DoubleToss, Fruit, CutFruit, DragonFruit, Bomb, ScoreManager,
ComboManager, TimeManager, FruitFailManager, ObjectivesLayer, and Settings.

Settings symbols expose persistent coins, selected blade/background/theme, objectives,
mode unlocks, best scores, 18 blade price slots, and background price slots.

## Inference

Because no external gameplay data files exist and named native mode/toss/settings methods
survive, screen composition, progression, spawn scheduling, and most rules are likely
hard-coded in C++.

## Risks

- The regular ELF symbol table is stripped, but the dynamic symbol table is unusually rich.
- Decompiled Java is mostly legacy Google Play Services noise; app-owned Java is tiny.
- GangnamStyle.mp3 and bundled fonts/music require explicit rights review before release.
- The APK uses a legacy signing scheme/algorithm that current Java treats as weak.

## Unresolved Questions

- Which statically identified states depend on retired online services or pre-existing save data?
- Which unresolved behaviors can be corroborated by authentic historical media or user memory?
- Are any assets or source rights owned or licensed by the current project owner?

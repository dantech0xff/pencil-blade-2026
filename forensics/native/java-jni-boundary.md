# Java, JNI, and Persistence Boundary Map

Static-only boundary map for the Pencil Blade 1.5 evidence. No APK or native code was
executed. `recovered` means directly present in decompiled Java, symbols, strings, or checked
instructions; `inferred` means the evidence supports a likely relationship but not its runtime
occurrence; `unknown` means the static corpus does not settle it.

Registered evidence used here:

- `SRC-APK-001`: immutable APK.
- `DER-INV-001`: verified APK/manifest inventory.
- `DER-WORK-001`: extracted Java, manifest, and other working evidence.
- `DER-NATIVE-001`: exact `libgame.so`, SHA-256
  `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`.
- `DER-NATIVE-CORPUS-001`: reproducible Phase 2 symbol, string, relocation, ownership, and
  dual-disassembly indexes over `DER-NATIVE-001`.

Native conclusions below cite the immutable binary, registered Phase 2 corpus, and exact
symbols, addresses, or string offsets.

## Ownership boundary

| Surface | Ownership | Recovered static facts | Evidence |
|---|---|---|---|
| `uit.dev.pencilblade.BuildConfig` | generated app Java | Only `DEBUG = false`; no behavior | `DER-WORK-001`; `.forensics-work/phase-01/java/app-owned/BuildConfig.java:1-5` |
| `uit.dev.pencilblade.R` | generated app resource index | Contains `attr`, `color`, `drawable`, `id`, `integer`, `layout`, `string`, `style`, and `styleable` IDs | `DER-WORK-001`; `.forensics-work/phase-01/java/app-owned/R.java:1-218` |
| `uit.dev.pencilblade.PencilBlade` | app Java/platform shell | Launcher activity, native library load, initial network preference write, and legacy ad/email/review/social bridges | `DER-WORK-001`; `.forensics-work/phase-01/java/app-owned/PencilBlade.java:14-91`; `CLM-JAVA-BOUNDARY` |
| `org.cocos2dx.lib.*` | bundled Cocos2d-x engine Java | Activity, GL surface, renderer, input, audio, sensors, assets, and preferences adapter | `DER-WORK-001`; `.forensics-work/phase-01/jadx/sources/org/cocos2dx/lib/` |
| `libgame.so` app symbols | native application | `AppDelegate`, `Settings`, menus, modes, score/progression, and product callback code | `DER-NATIVE-001`; `DER-NATIVE-CORPUS-001`; `.forensics-work/phase-02/native/symbols/dynamic-demangled.txt` |
| `libgame.so` Cocos/Box2D/vendor/runtime symbols | bundled engine/vendor/runtime | Framework implementation, not automatically app behavior | `DER-NATIVE-001`; `forensics/native/subsystem-map.md` |
| Google Mobile Ads Java | vendor integration | Legacy `InterstitialAd` construction/load/show and manifest `AdActivity` | `DER-WORK-001`; `PencilBlade.java:8-9,21-26,75-84`; `.forensics-work/phase-01/manifest/apkanalyzer.xml:46-48` |

`R.java` includes Google Play Services names for ads, maps, wallet, and sign-in. Generated
resource IDs alone do not prove that maps, wallet, purchases, or sign-in were application
features. The manifest declares only the launcher and Google Ads activity, with no service,
receiver, or provider (`CLM-MANIFEST-SURFACE`).

## Recovered lifecycle flow

1. `PencilBlade` class initialization calls `System.loadLibrary("game")`
   (`PencilBlade.java:89-91`). The loader invokes `JNI_OnLoad` at `0x001415a4`, which stores
   the `JavaVM` through `cocos2d::JniHelper::setJavaVM` and returns JNI 1.4.
2. Android calls `PencilBlade.onCreate` (`PencilBlade.java:19`). It first calls the Cocos
   superclass. `Cocos2dxActivity.onCreate` establishes static activity/context references,
   creates the GL surface and `Cocos2dxRenderer`, then calls `Cocos2dxHelper.init`
   (`Cocos2dxActivity.java:31-38,94-109`).
3. `Cocos2dxHelper.init` records package/files/assets state, calls native
   `nativeSetApkPath`, and creates sensor/audio helpers (`Cocos2dxHelper.java:42-55`).
4. Control returns to `PencilBlade.onCreate`. It attempts to construct and load a legacy
   interstitial; if the inherited Android connectivity check is true, it writes only
   `network_available = true`; finally it stores `_appActivity`
   (`PencilBlade.java:21-30`). There is no Java-side false write in this method.
5. GL surface creation calls `Cocos2dxRenderer.nativeInit(width, height)`
   (`Cocos2dxRenderer.java:49-53`). Native entry `0x001415b4` configures the Cocos GL view,
   constructs `AppDelegate`, and calls `CCApplication::run` when no GL view is already
   attached.
6. Draw frames call `nativeRender`; UI input is queued to the GL thread and forwarded through
   the touch/key/text exports. Activity pause/resume calls the Cocos helper and GL surface;
   the GL surface queues `nativeOnPause`/`nativeOnResume`
   (`Cocos2dxActivity.java:59-70`; `Cocos2dxGLSurfaceView.java:107-125`; renderer lines 59-101).

These call edges are recovered. Actual frame counts, timing, process-death behavior, and
device-dependent lifecycle interleavings remain unobserved.

## Java-to-native declarations and exports

No class in app-owned package `uit.dev.pencilblade` declares a Java `native` method. Its only
direct native action is loading `game`. All named Java JNI declarations are in bundled Cocos
engine classes and match these exported symbols:

| Java declaration | Native export | Address |
|---|---|---:|
| `Cocos2dxAccelerometer.onSensorChanged(float,float,float,long)` | `Java_org_cocos2dx_lib_Cocos2dxAccelerometer_onSensorChanged` | `0x001ccab0` |
| `Cocos2dxBitmap.nativeInitBitmapDC(int,int,byte[])` | `Java_org_cocos2dx_lib_Cocos2dxBitmap_nativeInitBitmapDC` | `0x001cbee8` |
| `Cocos2dxETCLoader.nativeSetTextureInfo(int,int,byte[],int)` | `Java_org_cocos2dx_lib_Cocos2dxETCLoader_nativeSetTextureInfo` | `0x001dfffc` |
| `Cocos2dxHelper.nativeSetApkPath(String)` | `Java_org_cocos2dx_lib_Cocos2dxHelper_nativeSetApkPath` | `0x001cc138` |
| `Cocos2dxHelper.nativeSetEditTextDialogResult(byte[])` | `Java_org_cocos2dx_lib_Cocos2dxHelper_nativeSetEditTextDialogResult` | `0x001cc15c` |
| `Cocos2dxRenderer.nativeDeleteBackward()` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeDeleteBackward` | `0x001cca2e` |
| `Cocos2dxRenderer.nativeGetContentText()` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeGetContentText` | `0x001cca3c` |
| `Cocos2dxRenderer.nativeInit(int,int)` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeInit` | `0x001415b4` |
| `Cocos2dxRenderer.nativeInsertText(String)` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeInsertText` | `0x001cc9f0` |
| `Cocos2dxRenderer.nativeKeyDown(int)` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeKeyDown` | `0x001cd0d4` |
| `Cocos2dxRenderer.nativeOnPause()` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeOnPause` | `0x001cc9b8` |
| `Cocos2dxRenderer.nativeOnResume()` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeOnResume` | `0x001cc9d8` |
| `Cocos2dxRenderer.nativeRender()` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeRender` | `0x001cc9a8` |
| `Cocos2dxRenderer.nativeTouchesBegin(int,float,float)` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeTouchesBegin` | `0x001ccf20` |
| `Cocos2dxRenderer.nativeTouchesCancel(int[],float[],float[])` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeTouchesCancel` | `0x001cd018` |
| `Cocos2dxRenderer.nativeTouchesEnd(int,float,float)` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeTouchesEnd` | `0x001ccf3e` |
| `Cocos2dxRenderer.nativeTouchesMove(int[],float[],float[])` | `Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeTouchesMove` | `0x001ccf5c` |

Java declaration sources are `Cocos2dxAccelerometer.java:20`, `Cocos2dxBitmap.java:28`,
`Cocos2dxETCLoader.java:18`, `Cocos2dxHelper.java:37-40`, and
`Cocos2dxRenderer.java:16-38` under `.forensics-work/phase-01/jadx/sources/org/cocos2dx/lib/`.
Exports are `DER-NATIVE-001` addresses indexed at
`.forensics-work/phase-02/native/symbols/dynamic-demangled.txt:1589-1606`.

## Native-to-Java product bridges

GNU ARM and LLVM Thumbv5TE disassembly agree that these helpers perform static Java method
lookups and calls. Their target strings occur at native string offsets `0x3d81bc-0x3d8254`.

| Native helper | Java target | Recovered direct native callers |
|---|---|---|
| `cocos2d::JniHelper::isNetworkAvailableJNI()` `0x001ccc34` | `org/cocos2dx/lib/Cocos2dxActivity.isNetworkAvailable()` | No direct `bl` xref found in the full named disassembly; indirect/unreferenced status unknown |
| `followFacebookJNI()` `0x001ccc78` | `uit/dev/pencilblade/PencilBlade.followFacebook()` | `AboutLayer::likeCallback` `0x00141808` |
| `showReviewTaskJNI()` `0x001cccac` | `PencilBlade.showReviewTask()` | `AboutLayer::reviewCallback` `0x00141af0`; `MainMenuLayer::reviewCallback` `0x0015b968` |
| `sendFeedbackEmailJNI()` `0x001ccce0` | `PencilBlade.sendFeedbackEmail()` | `AboutLayer::emailCallback` `0x00141810` |
| `showInterstitialAdsJNI()` `0x001ccd14` | `PencilBlade.showInterstitialAds()` | `DisplayScoreLayer::ShowAdsCallback` `0x0014ccec`; `OptionsLayer::ShowAdsCallback` `0x0015fafc` |

The four `PencilBlade` methods marshal Android UI work onto `_appActivity`'s UI thread. They
open email, market, and Facebook intents or invoke the obsolete Google interstitial API
(`PencilBlade.java:33-87`). Static presence and direct call edges do not establish successful
external launches, ad delivery, or user interaction.

Recovered anomaly: `isNetworkAvailableJNI` looks up its Java method with the `()V` descriptor
but then invokes `CallStaticBooleanMethod`; the Java declaration returns boolean (`()Z`). The
runtime consequence is unknown, and no direct native caller was found. The app's launch-time
network write does not use this native helper.

## Persistence boundary

### Storage path

The active Android path is recovered as:

`Settings` -> `cocos2d::CCUserDefault` -> typed `*ForKeyJNI` helper ->
`org.cocos2dx.lib.Cocos2dxHelper` -> Android `SharedPreferences("Cocos2dxPrefsFile")`.

`Cocos2dxHelper.java:226-284` proves the preference file and typed operations. Every setter
uses synchronous `editor.commit()`. The double adapter stores and retrieves a Java `float`, so
it is not double-precision storage. Native typed helpers are:

| Type | Get helper | Set helper |
|---|---:|---:|
| bool | `getBoolForKeyJNI` `0x001cc55c` | `setBoolForKeyJNI` `0x001cc798` |
| integer | `getIntegerForKeyJNI` `0x001cc5bc` | `setIntegerForKeyJNI` `0x001cc7f0` |
| float | `getFloatForKeyJNI` `0x001cc618` | `setFloatForKeyJNI` `0x001cc848` |
| double | `getDoubleForKeyJNI` `0x001cc684` | `setDoubleForKeyJNI` `0x001cc8b0` |
| string | `getStringForKeyJNI` `0x001cc6e0` | `setStringForKeyJNI` `0x001cc90c` |

`CCUserDefault` also contains a legacy XML read/migration path around `0x001d51fc-0x001d53f2`
and the string `UserDefault.xml` at `0x3db0fd`. Its typed setters at
`0x001d5408-0x001d5464` ultimately call the Java JNI setters; getters at
`0x001d547c-0x001d56e0` consult XML when present and otherwise call Java. `flush()` at
`0x001d547a` is a no-op because Java setters commit individually. Whether any user device
actually had a legacy XML file is not recoverable from the APK.

### Settings save contract

Direct disassembly of `Settings::SaveData()` `0x00163094` and `Settings::LoadData()`
`0x00163620`, cross-checked with GNU and LLVM, recovers these keys and load defaults:

| State | Preference key(s) | Load default(s) | Native state anchors |
|---|---|---|---|
| Currency | `total_coins` | `2014` | `_total_coins` `0x00482474`; get/set `0x00163ea4`/`0x00163eb4` |
| Selections | `selected_theme`, `selected_background`, `selected_blade` | `2`, `0`, `0` | `0x00482470`, `0x0048246c`, `0x00482420` |
| Best scores | `classic_best_1..3`, `crazy_best_1..3`, `gnstyle_best_1..3`, `bird_classic_best_1..3`, `bird_crazy_best_1..3`, `bird_combo_best_1..3` | all `0` | 18 named objects in `0x00482424-0x00482468` |
| Blade prices | `blade_price_0..17` | `[0,100,200,300,400,500,600,700,800,900,250,1500,2000,2500,2500,2500,2500,5000]` by index | `BladePrice_0` `0x0048241c` through `_17` `0x004823d8` |
| Background prices | `background_price_0..7` | `[0,500,250,250,2000,2000,2500,4500]` by index | `BackgroundPrice_0` `0x004823d4` through `_7` `0x004823b8` |
| Objective progress | `current_objective`, `fruits_cut` | `0`, `0` | `CurrentObjective` `0x004823b4`; `FruitsCut` `0x004822b0` |
| Options/status | `enable_music`, `enable_effect`, `network_available`, `rated` | `true`, `true`, `false`, `false` | `0x004822ac`, `0x004822ab`, `0x004822aa`, `0x004822a9` |

The exact key corpus is also present at native string offsets `0x3d1b85-0x3d1ed1`, except
`rated` at `0x3d05bb`. `SaveData` writes 50 integers and four booleans, then calls the no-op
native `flush`. It deliberately writes `network_available = false`, while Java launch code
writes it true only after a connected-network check. `Settings::RefreshNetworkConnection()`
`0x00163c44` reloads that key with false as its default. This makes the preference a launch
hand-off/sentinel, not proof of durable connectivity.

Indexed persistence also survives outside the bulk save keys:

- `objectives_value_%d` through `Settings::getObjectivesValue` `0x00163f0c` and
  `setObjectivesValue` `0x00163f38`.
- `mode_unlock_%d` through `Settings::getModeUnlock` `0x00163f64` and
  `setModeUnlock` `0x00163f90`.
- `ScoreManager::getBestScore` `0x00162914`, `setBestScore` `0x001628e4`, and
  `getTotalScore` `0x00162ac0`; `SelectItems::getSelectedItem` `0x00162f06` and
  `setSelectedItem` `0x00162f00` are app-side state consumers, not additional storage
  backends.

## Restoration boundary

- Preserve the recovered key names/defaults in a versioned save-schema contract until Phase 4
  decides migrations and valid ranges. Implement storage through a clean Cocos Creator
  adapter; do not copy JNI, Java, or native implementation code.
- Treat lifecycle, input, asset-path, and preference calls as old engine/platform plumbing.
  The restored gameplay core should depend on explicit platform interfaces, not Cocos2d-x JNI.
- Ads, Facebook, market review, feedback email, and live network behavior are legacy external
  integrations, not gameplay-core dependencies. Phase 2 security scope explicitly excludes
  restoring obsolete ad, account, purchase, network, or tracking behavior.
- Do not migrate the hard-coded legacy ad, social, or contact identifiers. Any later approved
  integration needs current SDKs, fresh configuration, consent/privacy review, and separate
  product acceptance criteria.

## Unresolved questions

- Which app call sites invoke `Settings::LoadData` and `SaveData`, and at exactly which scene or
  lifecycle transitions?
- What valid index ranges and mutation rules apply to `objectives_value_%d`, `mode_unlock_%d`,
  selections, and price arrays?
- Is `isNetworkAvailableJNI` dead code, indirectly called, or affected by the recovered method
  descriptor mismatch?
- Did any historical installation contain `UserDefault.xml`, and if so, what migration state
  could reach the Android preference backend? The APK alone cannot answer this.
- Which legacy external integrations, if any, are intentionally in scope for a modern product?

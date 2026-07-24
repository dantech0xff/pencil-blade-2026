# About screen and retired-platform static contract

Date: 2026-07-24
Scope: static native, Java, manifest, and resource evidence only
Native artifact: `.forensics-work/phase-01/native/libgame.so`
SHA-256: `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`

No APK, shared library, emulator, device, or reconstructed game runtime was installed or
executed for this report. Image copy was read directly from the extracted PNG evidence.

## Contract verdict

The legacy About screen is a single `CCLayer` with:

- one centered, unscaled raster background;
- one zero-origin `CCMenu` containing Menu, Review, Email, and Like image items in that order;
- one nonvisual gesture layer that maps Android Back to the same callback as Menu;
- no entry move/fade animation;
- no About-owned music;
- an effects-gated click only on the immediate return-to-Main-Menu path;
- a Review pulse and five-draw heart emission loop only when the persisted launch network
  sentinel is true and `rated` is false at entry;
- three direct retired platform actions: Facebook, feedback email, and market review;
- a one-time `500`-coin review reward gated only by `!rated && networkAvailable`, with no
  confirmation that a review was completed.

The old platform actions are separable from the presentation. Phase 6 explicitly requires
obsolete online features to remain outside core gameplay and asks for intentional offline
replacement behavior
(`phase-06-recreate-full-game-content-and-progression.md:66-73,153-185`).

**Recommended offline target decision, not a recovered legacy fact:** implement the About
presentation and local Menu/Back route without any network probe, JNI/native bridge, Android
intent, review store, Facebook URL, feedback recipient, ad SDK, ad timer, or review reward.
Keep compatibility save fields if the existing save schema requires them, but treat
`network_available` as permanently false and both fields as inert platform-history state.
The legacy external controls and baked legacy contact/social copy require an explicit visual
product decision; static evidence cannot make them safe or current.

## Evidence and classification

Primary static evidence:

- `forensics/native/function-map.csv:4-20,517-528`;
- `forensics/resources/resource-usage-map.json`;
- `.forensics-work/phase-01/native/libgame.so`;
- `.forensics-work/phase-01/native/strings.txt:42314-42326,43435-43442`;
- `.forensics-work/phase-02/native/strings/all-offsets.txt:42314-42326,43435-43442`;
- `.forensics-work/phase-01/java/app-owned/PencilBlade.java:14-91`;
- `.forensics-work/phase-01/jadx/sources/org/cocos2dx/lib/Cocos2dxActivity.java:19-57`;
- `.forensics-work/phase-01/manifest/apkanalyzer.xml:1-49`;
- `forensics/native/java-jni-boundary.md:97-118,120-168,235-259`;
- `forensics/contracts/main-menu-presentation-contract.md:67-90,264-302,391-405`;
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-options-native-contract.md:60-88,212-216`;
- both extracted `Backgrounds/aboutbackground.png` variants, identified below by catalog
  SHA-256.

The native hash is registered at
`.forensics-work/phase-02/native/checksums.sha256:1`. GNU ARM objdump 2.27 and LLVM objdump
19.0.1 were independently used with the recorded static commands and tool versions
(`.forensics-work/phase-02/native/commands.txt`;
`.forensics-work/phase-02/native/tool-versions.txt:1-8`). Both decoders agree on the
instructions, branches, call targets, and literal bits cited here.

Labels:

- **[RECOVERED]**: directly present as a symbol, instruction, literal, resource, Java body,
  manifest entry, or checked call edge.
- **[INFERRED]**: required interpretation of an engine default or composition of separately
  recovered facts.
- **[UNKNOWN]**: not settled by the static corpus.
- **[TARGET DECISION]**: recommended new offline behavior; never legacy evidence.

## Complete About function surface

All named application functions in the static inventory are covered:

| Address | Function | Recovered responsibility |
|---:|---|---|
| `0x001416d8` | `AboutLayer::addHeartCallback()` | create and animate one heart |
| `0x00141808` | `AboutLayer::likeCallback(CCObject*)` | tail-call Facebook JNI helper |
| `0x00141810` | `AboutLayer::emailCallback(CCObject*)` | tail-call feedback-email JNI helper |
| `0x00141818` | `AboutLayer::menuCallback(CCObject*)` | immediate same-parent Main Menu replacement and optional click |
| `0x0014187c` | `AboutLayer::onEnter()` | complete screen construction and conditional pulse |
| `0x00141af0` | `AboutLayer::reviewCallback(CCObject*)` | market-review JNI call and conditional local reward |
| `0x00141b44` | `AboutLayer::AboutLayer()` | base-layer/vtable construction |

The destructor symbols are at `0x00141660-0x001416c4`. There is no named About update loop,
delayed-navigation callback, label callback, or separate offline callback
(`function-map.csv:4-20`).

## State contract

### Recovered state read or changed by About

| State | Native anchor | About behavior |
|---|---:|---|
| `Settings::NetworkAvailable` | `0x004822aa` | refreshed twice on entry, gates only the pulse and `500`-coin reward |
| `Settings::Rated` | `0x004822a9` | gates pulse/reward; set true and persisted on the first eligible Review tap |
| `Settings::EnableEffects` | `0x004822ab` | gates only the return Menu/Back click |
| total coins | getter `0x00163ea4`, setter `0x00163eb4` | incremented by exactly `500` on the first eligible Review tap |
| gesture-layer pointer | About object `+0x108` | assigned during entry and used for Back registration |

The four Settings booleans load with defaults `music=true`, `effects=true`,
`network_available=false`, and `rated=false`
(`java-jni-boundary.md:150-168`).

**[RECOVERED]** About has no independent navigation state. Menu and Back replace the layer
immediately. It has no About-specific timer except actions owned by the conditional Review
pulse/hearts.

### Network sentinel, not live connectivity

The old network flow is:

1. Java `PencilBlade.onCreate()` calls the inherited connectivity method. If any enumerated
   `NetworkInfo` is `CONNECTED`, it writes `network_available=true`; it does not write false
   on the disconnected branch (`PencilBlade.java:19-30`;
   `Cocos2dxActivity.java:46-57`).
2. Native `Settings::SaveData()` deliberately stores `network_available=false`.
3. `Settings::RefreshNetworkConnection()` at `0x00163c44` reads the preference with false as
   its default and copies the result to `Settings::NetworkAvailable`.
4. `AboutLayer::onEnter()` calls that refresh function **twice consecutively** at
   `0x0014193a` and `0x0014193e`, then reads the in-memory byte.

The Java launch write and native save/reset make this a launch hand-off sentinel, not a live
network observer (`java-jni-boundary.md:163-168`). About does not call
`isNetworkAvailableJNI()`.

**[UNKNOWN]** The APK cannot establish all crash/process-death sequences in which a stale true
preference might survive. The duplicate refresh has no distinguishable side effect in the
recovered getter path; its original source-level rationale is unknown.

## Presentation resources

### Directly consumed resources

`AboutLayer::onEnter()` resolves the exact strings at native offsets `0x3d0458-0x3d055d`;
`addHeartCallback()` resolves `Interfaces/heart.png` at `0x3d058b`; Menu/Back resolves
`Sounds/menubuttonclick.wav` at `0x3d05a0`
(`all-offsets.txt:42314-42325`).

| Resource | `480x800` PNG | `720x1280` PNG |
|---|---:|---:|
| `Backgrounds/aboutbackground.png` | `481x801` | `721x1281` |
| `Buttons/button-menu-normal.png` | `91x87` | `137x129` |
| `Buttons/button-menu-selected.png` | `91x87` | `137x129` |
| `Buttons/button-review-normal.png` | `105x96` | `156x142` |
| `Buttons/button-review-selected.png` | `105x95` | `156x141` |
| `Buttons/button-email-normal.png` | `91x65` | `135x97` |
| `Buttons/button-email-selected.png` | `91x65` | `136x97` |
| `Buttons/button-like-normal.png` | `134x133` | `166x164` |
| `Buttons/button-like-selected.png` | `134x133` | `166x164` |
| `Interfaces/heart.png` | `30x33` | `44x50` |

Catalog locations are
`resource-usage-map.json:70,2470-2486,2534-2550,2566-2614,2870-2886,4678` and
`:6742,9142-9158,9206-9222,9238-9286,9542-9558,11350`.

The shared click clip is:

```text
Sounds/menubuttonclick.wav
bytes = 32812
sha256 = 3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e
PCM stereo, 44100 Hz, 16-bit
```

Evidence: `resource-usage-map.json:13957-13972`.

**[RECOVERED]** `Backgrounds/aboutbackground-ios.png` also exists in both asset trees
(`481x803` and `721x1201`; catalog lines `54` and `6726`), but the Android native About body
references only `Backgrounds/aboutbackground.png`. No Android About consumer for the `-ios`
file is recovered. Its intended platform selection is **[UNKNOWN]** and it is excluded from
this Android contract.

### Rasterized visible copy

The two directly consumed `aboutbackground.png` variants contain the same readable copy:

```text
Pencil Blade
Version 1.0.0
FULL
Thank you for your purchase!
Special thanks: Cocos2dx
Developed by: Tam. Nguyen Minh
Published by: UITDEV
Support: uit-dev@live.com
Fackbook page:
facebook.com/uitdev.pencilblade
Rate Us
Main Menu
Contact Us
```

`Fackbook` is the exact rasterized misspelling. The bottom `Rate Us`, `Main Menu`, and
`Contact Us` text is part of the background bitmap, not text in the overlaid icon resources.
There are no `CCLabel` construction calls in `AboutLayer::onEnter()`.

Static image identity:

| Variant | SHA-256 |
|---|---|
| `480x800/Backgrounds/aboutbackground.png` | `584698d06da37717f7273d8a84cb022e991596b086c3e9dda2344cb7894c47b1` |
| `720x1280/Backgrounds/aboutbackground.png` | `eacf6a7f6ec933d09a7c0ff3afb171b91181e476a6a3cd02d273ff34c776c9ab` |

Two static inconsistencies must not be silently normalized:

- the About artwork says `Version 1.0.0`, while the Android manifest records
  `versionName="1.5"` (`apkanalyzer.xml:4-6`);
- the artwork advertises `uit-dev@live.com`, while the Email action addresses
  `uitdev@outlook.com` (`PencilBlade.java:33-45`).

The visual Facebook path matches the Java HTTP fallback account name, but the primary Java
action uses a numeric `fb://` profile.

## Exact scene graph and layout

Notation:

- `W`, `H`: `CCDirector::getWinSize()` width and height;
- `C`: `VisibleRect::center()`;
- multiplication is native float32 arithmetic;
- raster dimensions identify variants, never layout inputs.

### Construction and insertion order

**[RECOVERED]** `AboutLayer::onEnter()` performs this synchronous order:

1. call `CCLayer::onEnter()`;
2. create `Backgrounds/aboutbackground.png`;
3. set it to `C`;
4. add it to About at z-order `1`;
5. read `W/H`;
6. create and position Menu;
7. create and position Review;
8. refresh the network preference twice;
9. if network is true and rated is false, start Review's repeating pulse;
10. create and position Email;
11. create and position Like;
12. create one `CCMenu` with items Menu, Review, Email, Like in that argument order;
13. set the menu to `(0,0)`;
14. add the menu to About at z-order `1`;
15. create a `CCGesturesLayer`, set About as its target, register
    `AboutLayer::menuCallback` for Back, and add the gesture layer through the one-argument
    `addChild` path (default z-order `0`).

The exact native entry range is `0x0014187c-0x00141a98`. Callback GOT entries resolve to
Menu `0x00141819`, Review `0x00141af1`, Email `0x00141811`, Like `0x00141809`, and
heart emission `0x001416d9`.

Equal-z visible insertion is therefore background, then menu, then later emitted hearts.
Hearts are About-root children, not menu children.

### Control formulas

| Control | Normal / selected assets | Position | Callback |
|---|---|---|---|
| Menu | `button-menu-normal/selected.png` | `(f32(0.5) * W, f32(0.1) * H)` | `menuCallback` |
| Review | `button-review-normal/selected.png` | `(f32(0.15) * W, f32(0.1) * H)` | `reviewCallback` |
| Email | `button-email-normal/selected.png` | `(f32(0.85) * W, f32(0.1) * H)` | `emailCallback` |
| Like | `button-like-normal/selected.png` | `(f32(0.75) * W, f32(0.335) * H)` | `likeCallback` |

Exact nontrivial float32 values are:

```text
0.1   = f32[0x3dcccccd] = 0.10000000149011612
0.15  = f32[0x3e19999a] = 0.15000000596046448
0.85  = f32[0x3f59999a] = 0.8500000238418579
0.335 = f32[0x3eab851f] = 0.33500000834465027
```

The background uses `VisibleRect::center`, while controls use raw `W/H`; no visible-rectangle
origin is added to the control formulas.

**[RECOVERED]** No background or control entry move, fade, rotation, opacity, anchor, or scale
setter occurs. The only control transform action is Review's conditional pulse.

**[INFERRED]** Center anchors and initial unit scale/zero rotation/default opacity follow the
legacy sprite/menu-item defaults because no app setter appears. A Creator implementation must
make any chosen defaults explicit without upgrading them to recovered app constants.

**[UNKNOWN]** Original sampler/blend behavior, device crop, pixel rounding, touch hit slop, and
pixel-identical output were not observed.

## Timing and heart animation

### Conditional Review pulse

**[RECOVERED]** The Review item is always created and remains clickable. Only its animation is
gated:

```text
if NetworkAvailable && !Rated:
    RepeatForever(
        ScaleTo(f32(0.45), f32(1.15), f32(1.15))
        -> addHeartCallback
        -> ScaleTo(f32(0.45), 1.0, 1.0)
        -> addHeartCallback
    )
```

Exact float32 values are `0x3ee66666 = 0.44999998807907104` and
`0x3f933333 = 1.149999976158142`.

The first heart is requested at nominal About action time `0.45`, the second at `0.90`, then
twice per `0.90`-second cycle. The pulse begins before Email, Like, and the menu container are
constructed, but all later construction is synchronous. Initial Review scale `1` is
**[INFERRED]** from the engine default.

If Review sets `Rated=true` after the action has started, the callback contains no stop-action
call: the pulse and hearts continue until About is removed. On a later About entry, rated true
prevents a new pulse.

### One About heart emission

**[RECOVERED]** Each `addHeartCallback()` consumes exactly five shared RNG draws:

1. `x = nextInt(trunc32(W * f32(0.1)), trunc32(W * f32(0.2)))`;
2. `y = nextInt(trunc32(H * f32(0.05)), trunc32(H * f32(0.15)))`;
3. `qScale = nextFloat()`;
4. `qDuration = nextFloat()`;
5. `rise = nextInt(trunc32(H * f32(0.1)), trunc32(H * f32(0.25)))`.

`RandomHelper::nextInt` is inclusive. `nextFloat()` is discrete:

```text
(lrand48() % 10) / 10  ->  {0.0, 0.1, ..., 0.9}
```

The emitted `Interfaces/heart.png` receives:

```text
position = (x, y)
scale = f32(f32(qScale * 0.5) + 0.5)  // 0.50 through 0.95
duration = f32(qDuration + 1.0)        // 1.0 through 1.9 seconds
actions = FadeOut(duration) || MoveBy(duration, (0, rise))
About root z-order = 1
```

Both actions are started before the heart is added. No remove/cleanup action is attached, so
completed invisible hearts remain children until About is removed. This matches the shared
five-draw mechanics documented for Main Menu but uses distinct About x/y bounds
(`main-menu-presentation-contract.md:264-302`).

**[UNKNOWN]** Exact native PRNG seed/state parity and resulting historical heart coordinates
are not claimed.

## Input, navigation, and audio

### Main Menu to About

**[RECOVERED]** `MainMenuLayer::aboutCallback()`:

```text
capture parent
-> remove MainMenuLayer with cleanup
-> construct AboutLayer
-> add AboutLayer to the same parent at z-order 1
-> if EnableEffects, play Sounds/menubuttonclick.wav once, non-looping
```

Evidence:
`main-menu-presentation-contract.md:391-405`;
`function-map.csv:521-528`.

### About to Main Menu

**[RECOVERED]** either the Menu image item or registered Android Back callback invokes
`AboutLayer::menuCallback()`:

```text
capture parent
-> remove AboutLayer
-> construct MainMenuLayer
-> add MainMenuLayer to the same parent at z-order 1
-> if EnableEffects, play Sounds/menubuttonclick.wav once, non-looping
```

There is no delay, scene reload, transition action, save call, explicit music stop, or
About-owned destination state. The click request occurs after destination insertion.

### Audio ledger

| Event | Recovered About audio |
|---|---|
| About entry | none |
| Review pulse / heart | none |
| Like | none |
| Email | none |
| Review | none |
| Menu / Android Back | effects-gated, non-looping `menubuttonclick.wav` after replacement |

About does not start or stop background music. Main Menu's own constructor behavior remains a
separate dependency; no About callback should invent an extra music command.

## Review action and local reward

Both About `0x00141af0` and Main Menu `0x0015b968` recover the same callback contract:

1. always invoke `JniHelper::showReviewTaskJNI()`;
2. if `Rated` is already true, return;
3. if `NetworkAvailable` is false, return;
4. write preference `rated=true`;
5. call native `flush()` (a no-op on this Android backend because the setter commits);
6. set the in-memory `Rated` byte true;
7. read total coins;
8. add `245 + 255`, exactly `500`;
9. write the in-memory total coins.

The Android bool setter commits synchronously
(`java-jni-boundary.md:124-146`). The coin setter at `0x00163eb4` only changes native
in-memory state; later bulk save is required for persistence. Therefore the recovered order
can persist `rated=true` before the `500` coins are durably saved.

There is:

- no success/result callback from the store;
- no proof that the market Intent opens;
- no check that the user submitted a review;
- no immediate About coin label;
- no direct audio;
- no suppression of later market launches after rated becomes true.

Only the local reward is one-time gated. Every later Review tap still invokes the store JNI
helper. The Main Menu's already-created total-coins label is not updated by its Review
callback (`main-menu-presentation-contract.md:399-405`). **[INFERRED]** After an eligible
About review and return, a newly constructed Main Menu would read and display the changed
in-memory total.

Java marshals the store Intent to `runOnUiThread`, so the native JNI invocation precedes the
local reward code, but the static corpus cannot establish when the actual UI-thread Intent
runs relative to that mutation.

## Complete retired platform action inventory

This table covers every product-facing native-to-Java bridge recovered in the curated JNI
boundary, plus the generic URL bridge so it cannot be mistaken for an unlisted product
feature.

| Native surface | Java target / direct old caller | Recovered behavior | Status |
|---|---|---|---|
| `isNetworkAvailableJNI()` `0x001ccc34` | `Cocos2dxActivity.isNetworkAvailable()`; no direct native caller found | looks up a static method with descriptor `()V` but calls it as boolean; Java actually returns boolean | **[RECOVERED]** mismatch; reachability/runtime consequence **[UNKNOWN]** |
| `followFacebookJNI()` `0x001ccc78` | `PencilBlade.followFacebook()`; About Like `0x00141808` | static void Java call | **[RECOVERED]** |
| `showReviewTaskJNI()` `0x001cccac` | `PencilBlade.showReviewTask()`; About Review `0x00141af0`, Main Menu Review `0x0015b968` | static void Java call followed by native local gating/reward | **[RECOVERED]** |
| `sendFeedbackEmailJNI()` `0x001ccce0` | `PencilBlade.sendFeedbackEmail()`; About Email `0x00141810` | static void Java call | **[RECOVERED]** |
| `showInterstitialAdsJNI()` `0x001ccd14` | `PencilBlade.showInterstitialAds()`; Display Score `0x0014ccec`, Options `0x0015fafc` | static void Java call | **[RECOVERED]** |
| `openURLJNI(char const*)` `0x001ccd48` | `Cocos2dxActivity.openURL(String)` through engine `CCApplication::openURL` `0x001caba4` | converts supplied C string to Java String and starts generic VIEW Intent | engine capability **[RECOVERED]**; app-product reachability **[UNKNOWN]** |

Direct caller evidence:
`java-jni-boundary.md:97-118`. Method-name strings are at
`.forensics-work/phase-02/native/strings/all-offsets.txt:43435-43442`.

### Exact Java platform actions and strings

#### Feedback email

`PencilBlade.sendFeedbackEmail()` (`PencilBlade.java:33-48`) queues:

```text
Intent action: android.intent.action.SEND
MIME type: plain/text
android.intent.extra.EMAIL: ["uitdev@outlook.com"]
android.intent.extra.SUBJECT: "About Pencil Blade on Android!"
android.intent.extra.TEXT: ""
chooser title: "Send mail..."
```

It catches and ignores `ActivityNotFoundException`. It does not use the rasterized
`uit-dev@live.com` address.

#### Market review

`PencilBlade.showReviewTask()` (`PencilBlade.java:50-59`) queues:

```text
Intent action: android.intent.action.VIEW
URI: "market://details?id=" + _appActivity.getPackageName()
```

With the recovered manifest package this composes
`market://details?id=uit.dev.pencilblade`. There is no web fallback and no local exception
handler in the runnable.

#### Facebook

`PencilBlade.followFacebook()` (`PencilBlade.java:61-73`) queues:

```text
primary:  VIEW "fb://profile/525673680830818"
fallback: VIEW "http://www.facebook.com/uitdev.pencilblade"
```

Any exception from the primary attempt selects the HTTP fallback. The fallback itself is not
inside a second catch.

#### Interstitial ad

At launch, `PencilBlade.onCreate()` attempts to construct and load an
`InterstitialAd` with:

```text
ca-app-pub-5527750179537481/5119462451
```

That preload occurs before the Java connectivity test and is wrapped in a broad ignored
`Exception` catch (`PencilBlade.java:19-30`).

`showInterstitialAds()` (`PencilBlade.java:75-87`) queues UI-thread work. If the stored
interstitial reports loaded, it shows it, constructs a replacement, assigns the same unit,
and loads again. The method has no null guard or exception handler.

Recovered native scheduling:

- Options consumes one discrete `nextFloat()` and schedules its one-shot ad callback after
  `2.75 + 4*r`, exactly `2.75..6.35` seconds
  (`options-native-contract.md:78-88,212-216`);
- Display Score consumes one discrete `nextFloat()` and schedules its one-shot ad callback
  after `0.75 + 3*r`, exactly `0.75..3.45` seconds
  (`DisplayScoreLayer::onEnter` `0x0014d0d0-0x0014d126`, literal
  `0x40400000`, plus `0x3f400000`);
- each callback body only calls `showInterstitialAdsJNI()`.

#### Manifest and generic network surface

The old manifest requests:

```text
android.permission.INTERNET
android.permission.ACCESS_NETWORK_STATE
```

and declares `com.google.android.gms.ads.AdActivity`
(`apkanalyzer.xml:12-16,42-48`).

The shared native library also embeds Cocos extension HTTP/WebSocket, libcurl, socket, and SSL
capabilities. Their presence proves bundled engine capacity, not an app-owned Pencil Blade
network action. No product endpoint or additional app-owned Java class is recovered from the
About/JNI call graph. The only app-owned Java behavior class is `PencilBlade`; `BuildConfig`
and `R` are generated surfaces (`java-jni-boundary.md:21-35`).

## Recommended no-integration offline target

Everything in this section is **[TARGET DECISION]**, not recovered legacy behavior.

### Platform boundary

- Do not port `JNI_OnLoad`, any `JniHelper::*JNI` product bridge, `PencilBlade.java`, the
  Cocos2d-x Android shell, or an equivalent compatibility bridge.
- Do not add an Android/iOS/web network service for About.
- Do not request Internet or network-state permission for these retired features.
- Do not include Google Mobile Ads, an ad activity, ad preload, ad timer, or ad callback.
- Do not open `market://`, `fb://`, HTTP, email, or generic external URLs.
- Do not copy the legacy ad unit, Facebook profile ID, Facebook URL, or either email address
  into runtime configuration.
- Do not report or simulate platform success.

This follows the curated restoration boundary
(`java-jni-boundary.md:235-247`) and Phase 6 security rule
(`phase-06-recreate-full-game-content-and-progression.md:182-185`).

### About behavior

- Keep background/menu layout, resource provenance, z-order, formulas, and local
  Menu/Android-Back route as the recoverable visual/navigation contract.
- Model offline availability explicitly as false. The legacy condition then starts no Review
  pulse and emits no About hearts.
- Do not mutate `rated`.
- Do not award `500` coins. Awarding without a review would invent a fake completion signal;
  awarding on tap would preserve an exploit whose external precondition has been retired.
- Like, Email, and Review must have no external side effect.
- If legacy icons remain for internal fidelity, mark them non-interactable and
  accessibility-disabled. The old resource set has normal/selected art only, so any visible
  disabled treatment is new design work and must not be labeled recovered.
- Do not add a replacement toast, modal, URL, copied contact address, or selected-state click
  feedback without approved product copy and acceptance criteria.

### Baked-copy constraint

The exact `aboutbackground.png` embeds obsolete contact/social identifiers and labels that
promise active `Rate Us` and `Contact Us` actions. Therefore production has two honest
choices:

1. retain the exact bitmap only after rights, identity, and product approval, while clearly
   treating the external controls as unavailable; or
2. create a clean-room About background that removes/replaces those identifiers and record
   the copy/layout delta as an intentional compatibility decision.

Static evidence cannot determine which legacy identity remains valid. Silently shipping the
old bitmap while removing its actions would preserve misleading promises; silently editing
the extracted bitmap would violate both provenance and recovered-copy reporting.

### Save compatibility

If the versioned save contract still carries the four recovered booleans:

- preserve the `network_available` and `rated` keys only for schema compatibility;
- normalize `network_available=false` and never refresh it from live platform state;
- retain an imported `rated` value without giving it runtime authority;
- never couple either key to currency in the restored offline game.

Removing the keys is a separate save-migration decision, not authorized by this report.

### Other review/ad surfaces

- Main Menu Review must not call a platform port or award `500`; its legacy callback remains
  static evidence only.
- Decide separately whether Main Menu's unconditional decorative pulse/hearts remain. Keeping
  them while disabling the control is visually faithful but potentially misleading; removing
  them is an intentional presentation delta.
- Remove Options and Display Score ad schedules rather than retaining dead timers whose only
  destination is a retired integration. Their removed RNG draws are an intentional
  retired-platform parity break and must not share a gameplay-critical RNG stream.

## Static and deterministic validation

No validation below requires or permits original APK/native execution.

1. Parse `resource-usage-map.json`; assert every direct About resource exists in both trees
   with the dimensions above, and assert `aboutbackground-ios.png` is not in the Android
   consumer allowlist.
2. Re-disassemble `0x001416d8-0x00141b44` with both recorded decoders; assert exact call
   targets, literal bits, branches, item order, callback pointers, and duplicate network
   refresh.
3. Assert background at `VisibleRect.center`, the four raw-`W/H` formulas, zero-origin menu,
   background/menu equal-z insertion, heart root ownership, and default-z gesture insertion.
4. Assert no entry tween or About audio command exists outside Menu/Back click.
5. Exercise network/rated legacy fixtures:
   - false/false: no pulse;
   - true/true: no pulse;
   - false/true: no pulse;
   - true/false: exact `0.45/0.90` repeating sequence.
6. For one legacy heart, assert five draws in order, inclusive integer bounds, discrete
   tenths, shared fade/move duration, z `1`, and no cleanup.
7. Assert Menu item and registered Back both produce immediate same-parent Main Menu
   replacement and one effects-gated post-insertion click.
8. In the offline target, assert Like/Email/Review produce zero platform, network, URL,
   message, persistence, currency, and audio calls.
9. Scan Creator source, Android manifest/build output, and catalogs for:
   `JniHelper`, `market://`, `fb://`, `uitdev`, the ad unit ID, Google Mobile Ads,
   `INTERNET`, and `ACCESS_NETWORK_STATE`; allow occurrences only in quarantined forensic
   evidence/reports.
10. Assert Options and Display Score contain no ad platform dependency or dead ad callback.

## Classification ledger

| Fact | Classification | Static basis |
|---|---|---|
| complete About named function set and direct calls | **[RECOVERED]** | function map plus dual disassembly |
| exact direct asset paths, paired dimensions, hashes | **[RECOVERED]** | native string offsets plus resource catalog |
| exact rasterized visible copy, including typo and legacy identifiers | **[RECOVERED]** | two extracted PNGs with catalog hashes |
| background center, item formulas, menu/item order, z-order | **[RECOVERED]** | `onEnter` instruction/literal range |
| no entry animations or entry audio | **[RECOVERED]** | complete `onEnter` call set |
| Menu and Android Back share `menuCallback` | **[RECOVERED]** | gesture vtable target and callback pointer |
| immediate same-parent return, click gate/order | **[RECOVERED]** | `menuCallback` `0x00141818-0x00141872` |
| duplicate network refresh and pulse condition | **[RECOVERED]** | `0x0014193a-0x00141954` |
| pulse timing and five-draw About heart protocol | **[RECOVERED]** | `0x001416d8-0x00141806`, `0x00141956-0x001419a8` |
| Facebook/email/review/ad Java literals and intent order | **[RECOVERED]** | app-owned `PencilBlade.java` |
| review call and one-time conditional `500` mutation | **[RECOVERED]** | both native review callbacks |
| live success of any external action | **[UNKNOWN]** | no runtime observation or result callback |
| center anchors/default opacity/unit scale/zero rotation | **[INFERRED]** | legacy engine defaults; no app setter |
| exact original pixels/device crop/touch hit behavior | **[UNKNOWN]** | no runtime/frame capture |
| stale-sentinel historical device outcomes | **[UNKNOWN]** | lifecycle/process timing not observable statically |
| `isNetworkAvailableJNI` runtime consequence/reachability | **[UNKNOWN]** | descriptor mismatch and no direct caller |
| app-product use of generic `openURL` or bundled HTTP/WebSocket | **[UNKNOWN]** | engine capability without recovered product call |
| current validity of old support/social identities | **[UNKNOWN]** | APK is historical evidence only |
| original asset redistribution rights | **[UNKNOWN]** | no rights evidence |
| zero-integration offline behavior above | **[TARGET DECISION]** | Phase 6 boundary and security policy |

## Unresolved questions

1. Should the production About screen retain disabled legacy external icons, omit them, or use
   approved replacement copy/art?
2. Is either legacy support address or the historical Facebook identity still authorized?
   Static evidence cannot establish ownership or current validity.
3. Are the original About raster/button assets cleared for redistribution?
4. Should imported `rated` state remain visible only to save migration tooling, or be removed
   in a later versioned schema migration?
5. Should Main Menu retain its decorative Review pulse after the Review action is retired?
6. Does product want a new support/review/social feature later? If yes, it requires a separate
   current platform/privacy/security contract and is outside this report.
7. Was `isNetworkAvailableJNI()` dead code, indirectly invoked, or broken by the recovered
   `()V`/boolean mismatch?

Status: DONE
Summary: Exact static About presentation, state, timing, audio, navigation, JNI, network, review, social, email, URL, and ad contracts recovered; a zero-runtime-integration offline boundary is proposed separately from legacy facts.
Concerns/Blockers: Production visual treatment and original-asset/legacy-identity rights require product approval; static evidence cannot resolve them.

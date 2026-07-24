# OptionsLayer Native Contract
---
date: 2026-07-24
status: done
scope: static-only recovery of `OptionsLayer` entry flow, chained row construction, selection state, purchases, rollback, and effect gating
evidence-policy: no APK, no `libgame.so` execution, no emulator, no runtime reconstruction
---

## Summary

The native `OptionsLayer` is not a tabbed screen. It is one vertically chained selector
surface with three rows:

- background row, 8 items, `Icons/background-icon-%d.png`, seeded from `Settings::getSelectedBackground()`
- blade row, 18 items, `Icons/blade-icon-%d.png`, seeded from `Settings::getSelectedBlade()`
- theme row, 10 items, `Icons/theme-icon-%d.png`, seeded from `Settings::getSelectedTheme()`

The callback names are historical and misleading:

- `OptionsTitleCallback()` creates the background row
- `BackgroundsCallback()` creates the blade row
- `BladesCallback()` creates the theme row

Recovered behavior is stable enough to treat as a contract:

- `onEnter()` animates the title, which then starts the row chain, and independently schedules
  the excluded ad callback after a randomized delay.
- Selection changes mutate `Settings` immediately; there is no draft buffer.
- Buy callbacks debit coins only when affordable, then mark the purchased item owned by zeroing its price.
- Leaving the screen runs `CheckPurchaseItems()` first, so unaffordable background/blade selections are rolled back before returning to the main menu.
- UI sounds are gated by `Settings::enable_effect`.
- Selection and Back use `Sounds/menubuttonclick.wav`; blade/theme row creation uses
  `Sounds/mono1.wav`/`Sounds/mono2.wav`.
- A purchase burst exists and uses `Blades/Particles/X-Mas/xmasfive.png`.
- An ad bridge exists, but it is a separate callback and not part of the core options path.

## Evidence

Primary static sources:

- `forensics/native/function-map.csv`
- `.forensics-work/phase-02/native/symbols/dynamic-demangled.txt`
- `.forensics-work/phase-02/native/strings/all-offsets.txt`
- `forensics/native/java-jni-boundary.md`
- `forensics/resources/resource-usage-map.json`
- direct static Thumb disassembly of the recovered option-related addresses

Cross-contract support:

- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-cosmetic-economy-native-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-gn-style-resource-map.md`

Confidence labels:

- **[RECOVERED]** direct symbol, string, branch, store, or call evidence
- **[INFERRED]** semantic meaning supported by code paths, but not named by a dedicated schema
- **[UNKNOWN]** static evidence does not settle runtime timing, exact coordinates, or ownership intent

## Recovered Function Map

| Function | Address | Role |
|---|---:|---|
| `OptionsLayer::onEnter` | `0x0015f668` | builds title/coin/back, starts chained rows, schedules excluded ad callback, attaches gestures layer |
| `OptionsLayer::OptionsTitleCallback` | `0x0015f338` | creates the background row |
| `OptionsLayer::BackgroundsCallback` | `0x0015efb0` | creates the blade row |
| `OptionsLayer::BladesCallback` | `0x0015edb4` | creates the theme row |
| `OptionsLayer::SelectedThemeChanged` | `0x0015fb7c` | persists theme selection immediately |
| `OptionsLayer::SelectedBackgroundChanged` | `0x0015ed04` | persists background selection immediately |
| `OptionsLayer::SelectedBladeChanged` | `0x0015ec50` | persists blade selection immediately |
| `OptionsLayer::BuyBackgroundCallback` | `0x0015eb20` | purchase/debit path for backgrounds |
| `OptionsLayer::BuyBladeCallback` | `0x0015e9f0` | purchase/debit path for blades |
| `OptionsLayer::CheckPurchaseItems` | `0x0015fc04` | rolls back unaffordable background/blade selections before exit |
| `OptionsLayer::BackButtonCallback` | `0x0015fc48` | exits to main menu after rollback check |
| `OptionsLayer::ShowAdsCallback` | `0x0015fafc` | JNI interstitial-ad bridge |

## Contract

### Screen entry

**[RECOVERED]** `OptionsLayer::onEnter()` calls `CCLayer::onEnter()`, creates the title,
coin panel/label, and back control, then starts the row chain from the title's completion
callback. An independent `CCDelayTime` + `CCCallFunc` + `CCSequence` targets
`ShowAdsCallback()`, not the first row. `RandomHelper::nextFloat()` returns one of
`0.0, 0.1, ..., 0.9`; the excluded ad delay is therefore `2.75 + 4*r`, or
`2.75..6.35` seconds.

**[RECOVERED]** The same function creates a `CCGesturesLayer`, stores it in the layer object,
and adds it to the scene at z-order `1`.

### Chained rows

**[RECOVERED]** The screen is one vertical chain, not independent tabs. The active rows are:

1. background row from `OptionsTitleCallback()`
2. blade row from `BackgroundsCallback()`
3. theme row from `BladesCallback()`

**[RECOVERED]** Background row:

- header string/resource: `Options/options-backgrounds.png`
- item count: `8`
- item rasters: `Icons/background-icon-%d.png`
- selection seed: `Settings::getSelectedBackground()`

**[RECOVERED]** Blade row:

- header string/resource: `Options/options-blade.png`
- item count: `18`
- item rasters: `Icons/blade-icon-%d.png`
- selection seed: `Settings::getSelectedBlade()`

**[RECOVERED]** Theme row:

- header string/resource: `Options/options-themes.png`
- item count: `10`
- item rasters: `Icons/theme-icon-%d.png`
- selection seed: `Settings::getSelectedTheme()`

**[RECOVERED]** The row and selector formulas are:

- title: anchor `(0.5, 0)`, initial `(VisibleRect.center.x, VisibleRect.top.y)`, then
  `MoveBy(1.25s, 0, -title.height)`
- background header: `y = 0.75*H`
- blade header: `y = 0.475*H`, entering from `x = 3*VisibleRect.center.x`
- theme header: `y = 0.2*H`
- each final header `x = VisibleRect.center.x`
- each selector `y = header.y - header.height*1.1*0.5`
- each selector starts at that same final point and explicitly runs a no-distance
  `MoveTo(0.25s, finalPoint)`
- `SelectItems::onEnter()` places Previous at local `(-selectorBackground.width, 0)`,
  the backdrop/current item at `(0,0)`, and Next at
  `(selectorBackground.width, 0)`
- each buy control `y = selector.y - icon-background.height*1.1*0.5`
- each row header/selector move duration is `0.25s`
- price font size is `16*W/480`; its buy-control-local position is
  `(0.4*buy.width, 0.5*buy.height)`

The title completion creates the background row; background completion creates the blade row;
blade completion creates the theme row. Their reveal boundaries are therefore approximately
`1.25s`, `1.50s`, and `1.75s` after entry.

**[RECOVERED]** Coin/back formulas:

- coin panel initial `(left.x - 0.5*panel.width, bottom.y + 0.835*H)`, final
  `(left.x + 0.285*W, same y)`, move/fade `0.75s`
- coin label anchor `(0, 0.5)`, font `Fonts/SlabThing.ttf`, size `34*W/480`,
  initial at the panel's initial position, final `(left.x + 0.185*W, same y)`,
  move/fade `0.75s`
- back initial `(2.5*VisibleRect.center.x, 0.835*H)`, final `(0.85*W, 0.835*H)`,
  `MoveTo(0.85s)`

### Selection changes

**[RECOVERED]** `SelectedThemeChanged()`:

1. reads the current selected item from the theme row
2. stores it through `Settings::setSelectedTheme()`
3. refreshes the theme layer
4. plays `Sounds/menubuttonclick.wav` when `Settings::enable_effect` is enabled

**[RECOVERED]** `SelectedBackgroundChanged()`:

1. plays `Sounds/menubuttonclick.wav` when effects are enabled
2. reads the selected background index
3. stores it through `Settings::setSelectedBackground()`
4. refreshes the background layer
5. checks the selected background price and toggles the menu state for owned vs purchasable

**[RECOVERED]** `SelectedBladeChanged()`:

1. plays `Sounds/menubuttonclick.wav` when effects are enabled
2. reads the selected blade index
3. stores it through `Settings::setSelectedBlade()`
4. checks the blade price and toggles the menu state for owned vs purchasable

### Purchase semantics

**[RECOVERED]** `BuyBladeCallback()` and `BuyBackgroundCallback()` share the same structure:

1. read `Settings::getTotalCoins()`
2. read the current selector index
3. load the selected item price through `Settings::GetBladePrice()` or `Settings::GetBackgroundPrice()`
4. return immediately if `total_coins < price`
5. subtract the price from the in-memory coin total
6. call `Settings::setTotalCoins()`
7. call the matching `Settings::Purchase*()` function

The equality case is allowed. I did not find a separate negative-price or overflow guard in
these callbacks.

**[RECOVERED]** After a successful buy, the native code spawns a particle burst:

- `ParticleExplosion::ParticleExplosion(int, int, float, float, int)` is constructed with
  distance bounds `70` and `35`
- `ParticleExplosion::Create(char const*, float, bool, bool)` is invoked with delay `0.05`
- the effect uses `Blades/Particles/X-Mas/xmasfive.png`
- the effect is attached to the layer as a child
- cleanup occurs at about `1.4s`

### Exit and rollback

**[RECOVERED]** `CheckPurchaseItems()` performs exit-time cleanup:

- if the selected background still has a price greater than zero, it resets the selected
  background to `0`
- if the selected blade still has a price greater than zero, it resets the selected blade to `0`

**[RECOVERED]** `BackButtonCallback()` optionally plays `Sounds/menubuttonclick.wav`, calls
`CheckPurchaseItems()`, removes the current layer, constructs `MainMenuLayer`, and adds it
back to the parent at z-order `1`.

### Ads and effects

**[RECOVERED]** `ShowAdsCallback()` only calls `JniHelper::showInterstitialAdsJNI()`. It is
present in the options native surface, but it is not part of the main selection/purchase flow
recovered above.

**[RECOVERED]** `Sounds/menubuttonclick.wav` is used for all three selection changes and
Back/menu navigation. Creating the blade row plays `Sounds/mono1.wav`; creating the theme row
plays `Sounds/mono2.wav`. All five call sites are effect-gated.

## Recovered vs Unknown

### Recovered

- one vertically chained screen
- callback-name mismatch versus actual row order
- immediate `Settings` mutation for selection changes
- price-gated purchases
- owned-item rollback to `0`
- back navigation order
- effect-gated audio
- purchase burst presence after successful purchase

### Inferred

- price `0` means owned/selectable
- background and blade rows use the same active owned/purchasable UI contract
- the options scene is responsible for keeping selector state consistent before exit

### Unknown

- exact label color (the recovered code does not call a color setter)
- exact `Settings::Purchase*` durability timing relative to later bulk save
- whether invalid selector indices are clamped, rejected, or left undefined by higher-level UI code
- whether `MainMenuLayer` continues, restarts, or preserves music after the options exit

## Implementation Implications

- Preserve the `Buy*` contract: affordability check, debit, then purchase-zeroing.
- Preserve the exit rollback: `CheckPurchaseItems()` runs before returning to main menu.
- Keep effect-gated audio on the same branches.
- Keep the ad bridge isolated from core selection logic.
- Treat the particle burst as a visible success effect, and keep the recovered asset path.

## Unresolved Questions

- Does `MainMenuLayer` inherit or restart music after `BackButtonCallback()`?
- Are invalid selector indices impossible by construction, or only unsupported?

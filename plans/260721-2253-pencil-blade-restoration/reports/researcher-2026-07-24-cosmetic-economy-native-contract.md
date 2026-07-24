# Cosmetic Economy Native Contract
---
date: 2026-07-24
status: done
scope: static-only recovery of blade/background price defaults, purchase state, and persistence
evidence-policy: no APK, shared-library, emulator, or reconstructed runtime execution
---

## Summary

The native cosmetic economy has 18 blade price keys and eight background price keys. Their
missing-key defaults are:

```text
blades      [0,100,200,300,400,500,600,700,800,900,1000,1500,2000,2500,2500,2500,2500,5000]
backgrounds [0,500,1000,1000,2000,2000,2500,4500]
```

The previous `250` entries for `blade_price_10`, `background_price_2`, and
`background_price_3` were incorrect. The Thumb code constructs `1000` as `250 << 2` and
reuses that value for all three defaults.

A successful UI purchase first subtracts the selected price from in-memory coins.
The matching `Settings::Purchase*` function then writes the selected indexed price key to
`0`, mirrors `0` into the corresponding in-memory price slot, and calls native `flush`.
Android preference setters commit synchronously; native `flush` is a no-op on this backend.

## Evidence and confidence

Native artifact: `.forensics-work/phase-01/native/libgame.so`

SHA-256:
`55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`

Primary evidence:

- `forensics/native/function-map.csv`;
- `.forensics-work/phase-02/native/symbols/dynamic-demangled.txt`;
- `.forensics-work/phase-02/native/strings/all-offsets.txt`;
- `.forensics-work/phase-02/native/tool-versions.txt`;
- direct GNU Binutils 2.27 and LLVM 19.0.1 Thumb disassembly of the addresses below;
- decompiled Cocos preference adapter cited by `forensics/native/java-jni-boundary.md`.

Confidence labels:

- **[RECOVERED]**: direct key string, immediate, shift, branch, call, store, or symbol.
- **[INFERRED]**: semantic meaning supported by recovered consumers but not named by a
  dedicated source enum or schema.
- **[UNKNOWN]**: static evidence does not establish runtime occurrence or lifecycle timing.

This audit disassembled the ELF only. It did not load or execute the APK or `libgame.so`.

## Recovered function map

| Function | Address | Recovered role |
|---|---:|---|
| `OptionsLayer::BuyBladeCallback` | `0x0015e9f0` | affordability check, coin subtraction, selected-index purchase |
| `OptionsLayer::BuyBackgroundCallback` | `0x0015eb20` | affordability check, coin subtraction, selected-index purchase |
| `OptionsLayer::CheckPurchaseItems` | `0x0015fc04` | rejects selected items whose current price is greater than zero |
| `Settings::SaveData` | `0x00163094` | bulk-writes 50 integers, including coins and all 26 price keys |
| `Settings::LoadData` | `0x00163620` | loads all price keys with the exact defaults below |
| `Settings::GetBladePrice` | `0x00163c68` | formats `blade_price_%d`, reads integer with default zero |
| `Settings::GetBackgroundPrice` | `0x00163ca8` | formats `background_price_%d`, reads integer with default zero |
| `Settings::PurchaseBackground` | `0x00163ce8` | writes selected background price key and in-memory slot to zero |
| `Settings::PurchaseBlade` | `0x00163d98` | writes selected blade price key and in-memory slot to zero |
| `Settings::setTotalCoins` | `0x00163eb4` | changes in-memory coins and calls native `flush` |
| `CCUserDefault::flush` | `0x001d547a` | no-op on the recovered Android path |

The symbol addresses and sizes are independently indexed in `forensics/native/function-map.csv`
and the GNU/LLVM-derived Phase 2 inventories.

## Exact price schema

**[RECOVERED]** Exact indexed keys and missing-key defaults:

| Index | Blade key | Blade default | String offset | Background key | Background default | String offset |
|---:|---|---:|---:|---|---:|---:|
| 0 | `blade_price_0` | `0` | `0x3d1cec` | `background_price_0` | `0` | `0x3d1df0` |
| 1 | `blade_price_1` | `100` | `0x3d1cfa` | `background_price_1` | `500` | `0x3d1e03` |
| 2 | `blade_price_2` | `200` | `0x3d1d08` | `background_price_2` | `1000` | `0x3d1e16` |
| 3 | `blade_price_3` | `300` | `0x3d1d16` | `background_price_3` | `1000` | `0x3d1e29` |
| 4 | `blade_price_4` | `400` | `0x3d1d24` | `background_price_4` | `2000` | `0x3d1e3c` |
| 5 | `blade_price_5` | `500` | `0x3d1d32` | `background_price_5` | `2000` | `0x3d1e4f` |
| 6 | `blade_price_6` | `600` | `0x3d1d40` | `background_price_6` | `2500` | `0x3d1e62` |
| 7 | `blade_price_7` | `700` | `0x3d1d4e` | `background_price_7` | `4500` | `0x3d1e75` |
| 8 | `blade_price_8` | `800` | `0x3d1d5c` | — | — | — |
| 9 | `blade_price_9` | `900` | `0x3d1d6a` | — | — | — |
| 10 | `blade_price_10` | `1000` | `0x3d1d78` | — | — | — |
| 11 | `blade_price_11` | `1500` | `0x3d1d87` | — | — | — |
| 12 | `blade_price_12` | `2000` | `0x3d1d96` | — | — | — |
| 13 | `blade_price_13` | `2500` | `0x3d1da5` | — | — | — |
| 14 | `blade_price_14` | `2500` | `0x3d1db4` | — | — | — |
| 15 | `blade_price_15` | `2500` | `0x3d1dc3` | — | — | — |
| 16 | `blade_price_16` | `2500` | `0x3d1dd2` | — | — | — |
| 17 | `blade_price_17` | `5000` | `0x3d1de1` | — | — | — |

Static global anchors are `Settings::BladePrice_0` `0x0048241c` through
`Settings::BladePrice_17` `0x004823d8`, and `Settings::BackgroundPrice_0` `0x004823d4`
through `Settings::BackgroundPrice_7` `0x004823b8`.

## Why the three corrected defaults are 1000

GNU and LLVM produce the same Thumb instructions and opcodes:

```text
0x00163636  movs r6, #250
0x0016363a  lsls r6, r6, #2
```

The second instruction is part of the value construction. It changes `r6` from `250` to
`1000`. `r6` is callee-saved and then copied into the default argument register at:

```text
0x001638c4  adds r2, r6, #0    blade_price_10
0x00163aec  adds r2, r6, #0    background_price_2
0x00163b00  adds r2, r6, #0    background_price_3
```

Each block immediately calls
`CCUserDefault::getIntegerForKey(char const*, int)` at `0x001d5618`; its PC-relative key
reference resolves to the key shown above. Reading only the `movs #250` instruction and
ignoring the following `lsls` caused the former erroneous defaults.

Other synthesized defaults use the same Thumb-1 pattern: `150 << 1 = 300`,
`200 << 1 = 400`, `250 << 1 = 500`, `150 << 2 = 600`, `175 << 2 = 700`,
`200 << 2 = 800`, `225 << 2 = 900`, and `250 << 3 = 2000`. Literal-pool values supply
`1500`, `2500`, `4500`, and `5000`.

## Purchase and persistence contract

### Affordability and debit

**[RECOVERED]** `BuyBladeCallback` `0x0015e9f6-0x0015ea2a` and
`BuyBackgroundCallback` `0x0015eb26-0x0015eb5a` perform the same sequence:

1. read `total_coins`;
2. read the UI's selected item index;
3. read that index's persisted price through `Settings::Get*Price`;
4. return without purchase when signed `total_coins < price`;
5. otherwise compute `total_coins - price`;
6. pass the result to `Settings::setTotalCoins`;
7. pass the selected index to `Settings::Purchase*`.

The equality case is affordable. No separate negative-price or overflow guard is visible in
these callbacks.

### Selected price key becomes zero

**[RECOVERED]** `PurchaseBackground(index)` formats `background_price_%d` using the supplied
index, sets argument `r2 = 0`, and calls `setIntegerForKey` at
`0x00163d12-0x00163d1a`. It then sets the corresponding in-memory price slot to zero for
indices `0..7` and calls `CCUserDefault::flush` at `0x00163d54-0x00163d58`.

**[RECOVERED]** `PurchaseBlade(index)` does the same with `blade_price_%d` at
`0x00163dc2-0x00163dca`, updates the in-memory slot for indices `0..17`, and calls `flush`
at `0x00163e36-0x00163e3a`.

Both functions format and persist the indexed key before their in-memory range check. Actual
UI call sites supply a selected item index; reachability of an invalid index is unknown.

### Bulk save and Android adapter

**[RECOVERED]** `Settings::SaveData` writes `total_coins`, every explicit
`blade_price_0` through `blade_price_17`, every explicit `background_price_0` through
`background_price_7`, the other saved integers/booleans, then calls native `flush`.

**[RECOVERED]** The Android `Cocos2dxHelper` setter calls `SharedPreferences.Editor.commit()`
for each integer write. Native `CCUserDefault::flush` at `0x001d547a` is a no-op on this
backend.

**[RECOVERED]** `Settings::setTotalCoins` only updates the in-memory global and calls the
no-op native `flush`; it does not itself call `setIntegerForKey("total_coins", ...)`.
Therefore the selected price-key transition is committed immediately, while the debit reaches
`total_coins` persistence when a later `SaveData` occurs.

## Inferred meaning and unknown runtime behavior

- **[INFERRED]** Price `0` is the owned/selectable sentinel. Evidence: purchase changes the
  selected price to zero, and `OptionsLayer::CheckPurchaseItems` `0x0015fc04` resets a
  selected blade/background when its current price is greater than zero.
- **[UNKNOWN]** Exact lifecycle call sites and timing for `SaveData`, including whether every
  successful purchase is followed by a bulk save before process death.
- **[UNKNOWN]** Real crash consistency. Static order exposes a window in which the selected
  price key is committed but the coin debit is only in memory; the APK cannot show whether a
  device ever terminated in that window.
- **[UNKNOWN]** Whether malformed or external state can cause an out-of-range selected index.
- **[UNKNOWN]** Historical device contents, including values outside defaults or a migrated
  `UserDefault.xml`, are not recoverable from the APK.

## Recommendations

- Use the exact 26 keys and corrected defaults as the legacy versioned save-schema fixture.
- Test missing-save initialization, partial saves, already-zero prices, affordability
  equality, insufficient coins, and all valid boundary indices.
- Preserve the recovered observable rule that purchase changes the selected price to zero.
- Define an intentional atomic transaction for the restored implementation instead of
  copying the legacy price/coin persistence window.
- Keep runtime claims separate from this static contract until an approved reconstructed
  implementation supplies tests or traces.

## Unresolved questions

- Where are all native `SaveData` call sites, and which scene/lifecycle transitions reach them?
- Should restoration migrate legacy partial-purchase states atomically on first load?
- Should invalid, negative, or oversized stored values be clamped, rejected, or preserved for
  compatibility?

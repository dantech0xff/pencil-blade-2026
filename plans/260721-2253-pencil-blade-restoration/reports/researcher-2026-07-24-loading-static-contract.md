# Loading surface static contract

Date: 2026-07-24
Scope: static native strings, dynamic symbols, resource catalogs, and existing forensic reports only
Safety: no APK, shared library, emulator, or reconstructed runtime was executed

## Summary

The native loading surface is **not** named `LoadingLayer` in the recovered binary text.
The static corpus names a real `LoadingScene` class instead, with recovered factory,
enter, update, exit, and finish callbacks:

- `LoadingScene::scene()`
- `LoadingScene::onEnter()`
- `LoadingScene::update(float)`
- `LoadingScene::finishLoading()`
- `LoadingScene::onExit()`

`AppDelegate::applicationDidFinishLaunching()` calls `LoadingScene::scene()` and then
`CCDirector::runWithScene(CCScene*)`, so the boot entry into Loading is recovered.
`LoadingScene::finishLoading()` purges cached data, constructs `GameScene`, and calls
`CCDirector::replaceScene(CCScene*)` with no transition. The destination scene is therefore
recovered, not inferred.

The four Loading rasters are recovered exactly in both resolution trees. Their bytes,
hashes, and dimensions are known and should be treated as the authoritative catalog until
the actual Creator-side contract is written.

## Verdict Matrix

| Item | Status | Evidence | Notes |
|---|---|---|---|
| `LoadingScene` class | recovered | `.forensics-work/phase-01/native/strings.txt:243,1309-1327,44312`; `.forensics-work/phase-01/native/dynamic-symbols.txt:1311-1329`; `.forensics-work/phase-02/native/gnu/dynamic-symbols.txt:1315-1333`; `.forensics-work/phase-02/native/llvm/dynamic-symbols.txt:11808-11970` | The native binary names `LoadingScene` directly. |
| `LoadingScene::scene()` | recovered | `.forensics-work/phase-01/native/strings.txt:243`; `.forensics-work/phase-02/native/gnu/dynamic-symbols.txt:1315`; `.forensics-work/phase-02/native/llvm/dynamic-symbols.txt:2196` | Scene factory survives in the symbol table. |
| `AppDelegate::applicationDidFinishLaunching()` | recovered | `.forensics-work/phase-01/native/strings.txt:1309-1316`; `.forensics-work/phase-02/native/gnu/dynamic-symbols.txt:1315-1322`; `.forensics-work/phase-02/native/llvm/dynamic-symbols.txt:11808-11871` | Boot entry calls `LoadingScene::scene()` and `CCDirector::runWithScene(CCScene*)`. |
| `LoadingScene::onEnter()` / `update(float)` / `onExit()` | recovered | `.forensics-work/phase-01/native/strings.txt:1312-1316`; `.forensics-work/phase-02/native/gnu/dynamic-symbols.txt:1318-1322`; `.forensics-work/phase-02/native/llvm/dynamic-symbols.txt:11835-11871` | Lifecycle callbacks are explicit. `onEnter()` builds the exact four-sprite layout; `update` is the preload loop. |
| `LoadingScene::finishLoading()` | recovered | `.forensics-work/phase-01/native/strings.txt:1309`; `.forensics-work/phase-02/native/gnu/dynamic-symbols.txt:1315`; `.forensics-work/phase-02/native/llvm/dynamic-symbols.txt:11808` | Handoff callback exists; it purges cache, creates `GameScene`, and replaces the scene with no transition. |
| `CCDirector::replaceScene(CCScene*)` | recovered | `.forensics-work/phase-01/native/strings.txt:1311`; `.forensics-work/phase-02/native/gnu/dynamic-symbols.txt:1317`; `.forensics-work/phase-02/native/llvm/dynamic-symbols.txt:11826` | Destination mechanism is explicit and used directly by `finishLoading()`. |
| `LoadingLayer` | unknown / absent | repo-wide static search; no hit in extracted native strings or dynamic symbols | The earlier gap-map wording is a placeholder for the loading surface, not a recovered native class name. |
| exact destination scene | recovered | `LoadingScene::finishLoading()` constructs `GameScene` then calls `replaceScene` | Destination is explicit in disassembly evidence. |
| exact progress threshold / visibility interval | recovered | `LoadingScene::update(float)` cases `0..61` and `DelayTime(.5)` tail | Counter runs to 61, width scales by `counter/61`, then a 0.5 second delay precedes `finishLoading()`. |

## Exact Loading Resources

The Loading family is the strongest unresolved screen-resource cluster in the catalog
because the native strings are exact and the asset metadata is exact in both profile trees.

| Logical path | `480x800` bytes / SHA-256 / dimensions | `720x1280` bytes / SHA-256 / dimensions |
|---|---|---|
| `Loading/backgroundLogo.png` | `269888`; `f87874212a211ee638456720078ea53584568a7ea4f9649bc27f345909e26d8f`; `480x800` | `379058`; `849003087172b8448318a991a6db94656213edb64d429980033bbd643350d0c2`; `775x1280` |
| `Loading/loadbkback.png` | `509`; `c04709d69caab20c7b50961c61d47b100ba837826b9b258467ee79265fe7588b`; `193x24` | `702`; `e622f620535e7f610dfade3836283847ecf1754ce45e4f53a7a85bca638a26b0`; `275x35` |
| `Loading/loadbkfront.png` | `975`; `e23aef27163f179c8a873e74a1791446e28bfcf8edd4b214d56e1e2f4575295e`; `197x28` | `1330`; `bd56ca543c9b9851bfc4f7f4c3ce569054b53e29be6afde44e040655b754262d`; `281x40` |
| `Loading/loadprocess.png` | `2214`; `a1fba149efa7bc89f5ebabdc6078d10c44caae1d375d6de75363dddc9eedf068`; `185x20` | `2207`; `1b31334589e44850ba36eaa81642c5061212d5fd4b12bfe295e515128b04add9`; `265x27` |

Supporting native string evidence:

- `.forensics-work/phase-01/native/strings.txt:42522-42525`
- `.forensics-work/phase-02/native/resource-looking-strings.txt:129-132`
- `forensics/resources/resource-usage-map.json:5606-5656`
- `forensics/resources/resource-usage-map.json:12278-12328`
- `forensics/resources/resource-usage-map.json:16819-16842`
- `forensics/resources/resource-usage-map.json:20418-20433`
- `forensics/resources/resource-usage-map.json:22640-22670`

The extracted string dump lists the four paths explicitly in the binary:

```text
Loading/backgroundLogo.png
Loading/loadbkback.png
Loading/loadprocess.png
Loading/loadbkfront.png
```

That is evidence of exact native ownership, not just catalog presence.

## Lifecycle / Transition Contract

### Recovered

1. `LoadingScene::scene()` exists as the scene factory.
2. `AppDelegate::applicationDidFinishLaunching()` starts the app with `LoadingScene::scene()`
   and `CCDirector::runWithScene(CCScene*)`.
3. `LoadingScene::onEnter()` exists as the entry lifecycle hook.
4. `LoadingScene::update(float)` exists and is the heavy body, 1148 bytes in the GNU
   symbol table.
5. `LoadingScene::finishLoading()` exists as the loading-complete handoff callback.
6. `CCDirector::replaceScene(CCScene*)` exists as the scene transition primitive.
7. `LoadingScene::onExit()` exists as the exit lifecycle hook.
8. `LoadingScene::onEnter()` builds the exact four-image composition:
   `backgroundLogo` centered, `loadbkback` centered at `y = H * 0.25`,
   `loadprocess` anchored at `(0, 0.5)` with left edge at `center.x - width / 2`,
   and `loadbkfront` overlayed on top.
9. `LoadingScene::update(float)` runs cases `0..61`, preloads 3 background tracks first,
   then 59 effects in the recovered order, and scales the process width as
   `min(fullWidth, fullWidth * counter / 61)`.
10. `finishLoading()` targets `GameScene` directly with no transition effect.

### Inferred

- Whether the counter is intended to be shown as a percent label or just used internally.
- Whether the 0.5-second tail is purely cosmetic or a deliberate minimum display window.
- Any exact z-order beyond the explicit overlay order recovered from `onEnter()`.

### Unknown

- None for the recovered boot path and layering contract.

## Reproducible Static Checks

Use these commands against the checked-in forensic evidence:

```sh
rg -n "LoadingScene|LoadingLayer|backgroundLogo|loadbkback|loadbkfront|loadprocess|preloadEffect|boomhit.wav" \
  .forensics-work/phase-01/native/strings.txt \
  .forensics-work/phase-02/native/resource-looking-strings.txt

nl -ba .forensics-work/phase-01/native/strings.txt | sed -n '1306,1328p'
nl -ba .forensics-work/phase-02/native/gnu/dynamic-symbols.txt | sed -n '1315,1328p'
nl -ba .forensics-work/phase-02/native/llvm/dynamic-symbols.txt | sed -n '11808,11970p'
nl -ba forensics/resources/resource-usage-map.json | sed -n '5606,5656p'
nl -ba forensics/resources/resource-usage-map.json | sed -n '12278,12328p'
nl -ba .forensics-work/phase-02/native/resource-looking-strings.txt | sed -n '129,132p'
```

The strongest cross-check is the loading-string cluster in `strings.txt` plus the matching
dynamic symbols for `LoadingScene` and `CCDirector::replaceScene`.

## Conclusion

The loading surface is recovered enough to write a real Creator contract around
`LoadingScene`, not `LoadingLayer`. The boot entry, four-image composition, 61-step preload
loop, 0.5-second completion tail, and `GameScene` handoff are recovered. The remaining
uncertainty is only how the counter should be surfaced to users, not how the boot flow works.

## Unresolved Questions

1. Does the `update(float)` counter map directly to a percent label, or is it only an
   internal preload index?
2. Is the 0.5-second tail purely cosmetic or is it intended as a minimum display window?
3. Is the `LoadingScene` name the original source name, or a decompiler-visible rename of a
   class that the recovered Creator code should model under a different namespace?

Status: DONE
Summary: recovered the static Loading surface as `LoadingScene`, cataloged the exact
four-image resource set for both profiles, and recovered the boot entry, update loop,
and `GameScene` handoff.
Concerns/Blockers: only the user-facing interpretation of the counter remains open in the
checked-in static evidence.

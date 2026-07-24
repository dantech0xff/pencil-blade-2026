---
type: tester
date: 2026-07-24
status: complete
---

# Loading final checkpoint

## Outcome

Recovered Loading is integrated before Main Menu without using the original runtime:

- exact four-raster selected-profile composition and insertion order
- exact 62-step native audio preload order, one request per update
- incremented-counter progress divided by `61`, clamped at full width
- next-update delay entry and exact `0.5`-second finish tail
- Main Menu activation beneath the still-visible overlay, then best-effort Loading retirement
- Creator bundle/runtime readiness in place of the obsolete native cache purge
- immediate observation of optional-preparation rejection during slow foreground loading
- complete transient-node cleanup for raster, component, and attachment construction failures
- executable same-Canvas z-order and post-commit retirement-failure coverage

## Verification

| Gate | Result |
|---|---|
| Loading domain/loader/audio/presenter focused tests | `19/19` pass |
| Loading presenter plus full app-shell controller tests | `129/129` pass |
| Full deterministic vertical slice | `1520/1520` pass |
| Top-level resource/build/catalog/tooling tests | `61/61` pass |
| Cocos Creator 3.8.8 bundled strict TypeScript | pass, zero diagnostics |
| Ledger generation and canonical verification | `761` consumed, `90` unknown, `10` excluded, `1` unsupported |
| Creator staging verification | `862/862`, `0` byte mismatches, `934/934` expected metadata sidecars |
| Metadata audit through top-level suite | zero structural errors, zero duplicate UUIDs; only preserved unsupported OTF blocker |
| Independent follow-up review | approved; no open P0-P2 finding |
| Diff hygiene | `git diff --check` pass |

Generated authority:

| Artifact | SHA-256 | Bytes |
|---|---|---:|
| `assets/catalog/resource-reconciliation-ledger.json` | `2985194b3fd6611228e18b3947c0c307538b98b54507da221d0f048b4faaefc6` | 269,528 |
| `assets/catalog/creator-staging-manifest.json` | `bb778780ac465ebc824cf5345c1cd419807a999d05c46a8d478ace9827c9d1f1` | 872,447 |

Runtime consumer coverage rises from `743/862` (`86.19%`) to `761/862`
(`88.28%`). Loading owns 70 paths: eight profile rasters, 62 audio files, and 18
new unique consumers after overlap with existing owners.

## Creator Preview

- Compact physical `360x800` selects logical/resource tree `480x800`.
- High Design Resolution selects logical/resource tree `720x1280`.
- Compact Preview visibly renders recovered Loading logo and progress bar, then stable Main Menu.
- Both branches reach stable Main Menu; high layout uses the high resource tree.
- Final Cocos Editor log, warning, and error counters: `0 / 0 / 0`.

The Cocos Preview wrapper's own engine splash can appear before the first scene. It is
editor-owned and not counted as recovered game behavior; production splash policy remains a
Phase 7 build/configuration gate.

## Commands

```text
node --test tests/reconstruction/vertical-slice/loading-*.test.ts
node --test tests/reconstruction/vertical-slice/*.test.ts
node --test --test-reporter=dot tests/*.mjs
node .../typescript/lib/tsc.js -p game/tsconfig.json --pretty false --noEmit
node scripts/generate-resource-reconciliation-ledger.mjs verify ...
node scripts/stage-creator-assets.mjs verify ...
git diff --check
```

No APK or native shared library was executed.

## Unresolved questions

None for this checkpoint.

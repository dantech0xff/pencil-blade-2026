---
date: 2026-07-24
status: done
scope: About domain presentation and exact Creator resource loading
evidence_policy: static-only; original APK and native library were not executed
---

# About Domain and Resource Foundation

## Outcome

Implemented the pure About presentation contract and its exact Creator raster
boundary:

- pins the complete ten-raster Android closure for both recovered resolution
  profiles with canonical dimensions, byte counts, and SHA-256 identities;
- preserves purpose-local normal/selected pairs for Menu, Review, Email, and
  Like;
- explicitly excludes `Backgrounds/aboutbackground-ios.png` from the Android
  closure;
- preserves background, zero-origin menu, item, gesture-layer, and later-heart
  insertion/draw order;
- applies raw logical `W/H` item formulas and visible-rectangle center only to
  the background;
- records that About has no entry actions;
- exposes the exact two-leg `0.45s` Review pulse and two emissions per `0.9s`
  cycle;
- consumes exactly five ordered heart RNG draws with inclusive integer bounds,
  discrete deciles, shared fade/move duration, root z-order `1`, and no
  per-heart cleanup;
- uses the authoritative native heart y lower bound `trunc(H * 0.05)`. The
  resource-map report's `0.10H` line is treated as a documentation discrepancy,
  not implementation authority;
- accepts pulse eligibility only as an explicit caller-provided local
  compatibility snapshot and reports that neither live connectivity nor an
  external action was requested;
- loads exactly one selected-profile ten-raster batch and validates profile
  shape, every identity field, uniqueness, density, order, returned path, and
  returned geometry;
- reports contract, load, catalog, and lookup failures through
  `AboutResourceLoaderError` codes.

No About state wrapper was added because this foundation has no independent
mutable state. No network, native bridge, URL, messaging, ad, analytics, or
external identity was added to runtime source. Shared menu-click audio remains
owned by the existing audio runtime and is referenced only as immutable
metadata.

## Files

- `game/assets/scripts/domain/about-resource-contract.ts`
- `game/assets/scripts/domain/about-resource-contract.ts.meta`
- `game/assets/scripts/domain/about-presentation.ts`
- `game/assets/scripts/domain/about-presentation.ts.meta`
- `game/assets/scripts/creator/about-resource-loader.ts`
- `game/assets/scripts/creator/about-resource-loader.ts.meta`
- `tests/reconstruction/vertical-slice/about-resource-contract.test.ts`
- `tests/reconstruction/vertical-slice/about-presentation.test.ts`
- `tests/reconstruction/vertical-slice/about-resource-loader.test.ts`

## Verification

| Gate | Result |
|---|---|
| Focused About contract, presentation, and loader tests | `18/18` pass |
| Staged PNG dimensions, bytes, hashes, and manifest identities | both profiles pass |
| Local-only trust-boundary source scan | pass |
| Cocos Creator 3.8.8 bundled strict TypeScript, `-p game/tsconfig.json --noEmit` | pass, zero diagnostics |
| `git diff --check` | pass |
| Scoped trailing-whitespace scan | pass |

## Docs impact

None. This restores an already researched contract and records the implementation
in this report. Shell routing and presenter lifecycle are separate owned work.

## Unresolved questions

None in the assigned static foundation. Production must continue to supply
ineligible local compatibility state unless a separately approved product
contract authorizes different behavior; rights and copy approval for recovered
art remain outside this implementation.

Status: DONE
Summary: Exact dual-profile About resources, pure layout/pulse/heart presentation, and typed staged loader implemented and verified.
Concerns/Blockers: No blocker in assigned scope; production policy and recovered-art approval remain separate decisions.

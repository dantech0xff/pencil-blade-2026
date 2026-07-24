# About Presenter Implementation

Date: 2026-07-24
Scope: standalone Creator presenter and focused tests
Evidence mode: static repository evidence and deterministic local tests only

## Result

Implemented the detached About Creator presenter against the new About presentation,
resource-contract, and resource-loader public APIs.

## Owned Files

- `game/assets/scripts/creator/about-presenter.ts`
- `game/assets/scripts/creator/about-presenter.ts.meta`
- `tests/reconstruction/vertical-slice/about-presenter.test.ts`

## Behavior

- Constructs the exact background, zero-origin menu, and nonvisual gesture hierarchy.
- Preserves Menu, Review, Email, Like order and exact dual-profile normal/selected rasters,
  positions, anchors, and selected-frame dimensions.
- Registers only direct touch and `MOBILE_BACK` input after host attachment. It has no
  `BladeInput` dependency.
- Routes Menu and `MOBILE_BACK` through one frozen immediate `MainMenuLayer` transaction.
- Restores the exact source parent/sibling and rearms listeners after false or throwing
  pre-commit routes.
- Reads effects and plays the shared Menu click only after a successful route commit.
  Settings and audio failures are distinct typed post-commit errors and never restore a
  disposed About source.
- Makes activation, suspension, navigation rearm, and disposal explicit and idempotent;
  partial listener cleanup poisons uncertain ownership and disposal retries cleanup.
- Emits Review, Email, and Like only as frozen local events:
  `{ action: 'review'|'feedback'|'social', reason: 'retired-offline' }`.
  Observer exceptions are contained.
- Exposes no currency, save, platform, URL, JNI, ads, analytics, or live-network port.
  Retired controls do not read settings, navigate, or play audio.
- Accepts the domain-required local compatibility snapshot only. The production shell
  supplies `localCompatibilityAvailable: false`, so it performs no Review pulse, random
  draw, or heart allocation.
- Deterministic fixture eligibility preserves the exact two-leg pulse, five random draws
  per heart, large-delta catch-up, suspension pause, and retained invisible-heart lifetime.
- Owns no background-music start or stop.

## Verification

| Gate | Result |
|---|---|
| Focused About presenter suite | `8/8` passed |
| About/domain/Main Menu/shell integration suite | `166/166` passed |
| Full vertical-slice suite | `1492/1492` passed |
| Cocos Creator 3.8.8 bundled strict TypeScript | passed with zero diagnostics |
| `git diff --check` | passed |
| Independent presenter/test review | PASS; no P0, P1, or P2 finding (`206/206` reviewer integration tests) |

The Node runs emitted only the repository's existing module-type and experimental
TypeScript-strip warnings. No test failed, skipped, cancelled, or remained todo.

## Evidence Boundary

No original APK or shared library was executed. No APK was built or installed, no
device/emulator was used, and no network, URL, email, social, review-store, JNI, ad, or
analytics action was invoked.

Docs impact: none. This slice adds an internal presenter behind already documented Phase 6
restoration work; shell/roadmap ownership remains with the controller.

## Unresolved Questions

None within this standalone presenter scope.

## Status

Status: DONE

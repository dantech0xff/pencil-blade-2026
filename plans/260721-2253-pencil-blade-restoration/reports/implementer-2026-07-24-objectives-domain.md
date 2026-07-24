---
date: 2026-07-24
status: done
scope: Objectives screen pure domain state, presentation, and resource contracts
evidence_policy: static-only; original APK/runtime was not executed
---

# Objectives Screen Domain Implementation

## Outcome

Implemented the engine-independent Objectives screen boundary:

- exact constrained closure: ten compact/high rasters, `Fonts/Arial.ttf`, and
  `Sounds/menubuttonclick.wav`;
- explicit unattached-probe plus visible-use classification for
  `objectives-next`, header, and footer resources;
- canonical 52-row snapshots reused from `objectives-manager-state.ts`;
- exact ordinary/fixed row text, reward indexing, completion textures,
  construction-time colors, Arial sizes, anchors, and float32 positions;
- compact/high visible-rect bounds, spacing, background/header/footer roots,
  equal-z insertion order, and Back/Skip ingress actions;
- authoritative vertical drag with `movementY=-deltaY`, full-delta precheck,
  boundary overshoot, nearest viewed-row scan, and no clamp/snap/inertia;
- Skip targets the manager's active objective, refreshes authoritative
  completion/card state, and preserves scroll coordinates plus item colors;
- visible Back and Skip request effects-gated non-looping click audio;
  hardware Back shares navigation while remaining silent.

No Creator import, renderer behavior, mask, stencil, scissor, persistence
owner, or original-runtime bridge was added to the domain.

## Files

- `game/assets/scripts/domain/objectives-screen-state.ts`
- `game/assets/scripts/domain/objectives-screen-presentation.ts`
- `game/assets/scripts/domain/objectives-screen-resource-contract.ts`
- matching Creator TypeScript metadata
- three focused `tests/reconstruction/vertical-slice/objectives-screen-*.test.ts`

## Verification

| Gate | Result |
|---|---|
| New resource/state/presentation tests plus existing manager tests | `37/37` pass |
| Isolated strict Creator TypeScript for three domain entry files | pass, zero diagnostics |
| Scoped `git diff --check` | pass |
| Full-project strict Creator TypeScript | concurrent shell integration blocker outside ownership |

Full-project TypeScript currently reports
`recovered-app-shell-controller.ts:573` missing the newly required
`MainMenuPresenterLifecycle.onObjectivesRequested` callback. The three domain
files compile cleanly in isolation; the shell/Creator owner was notified.

## Unresolved questions

None in the pure domain scope. Legacy-vs-Creator glyph raster identity,
asset rights, and live Creator integration remain their existing separate
validation gates.

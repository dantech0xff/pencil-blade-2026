# Phase 5A Blade and Navigation Foundations Checkpoint

Date: 2026-07-23

## Outcome

The existing Phase 5A plan remains the correct execution path. This checkpoint completes the
default BasicBlade presentation and establishes reviewed pure-domain foundations for Mode Select
and the shared Leaf layer. It does not yet make Main Menu or Mode Select visible in Creator.

## Completed

- Registered reviewed BasicBlade, Main Menu, Mode Select, and shared GameScene contracts.
- Corrected shared-root interpretation: `0/1/2/3` are tags, every root uses z-order `1`, and
  rendering follows Background → Leaf → Theme → current-screen append order.
- Corrected Background/Theme entry behavior: their queued fades stay paused, so the default
  background is immediately opaque.
- Implemented four independent default BasicBlade slots using the exact paired `blade0.png`,
  recovered float32 geometry/UV/disposal rules, and four persistent fixed-capacity meshes.
- Implemented Mode Select rail, drag/flick/centering, six destinations, lock and persistence
  rules, navigation commands, and the exact 45-particle burst with 225 ordered shared-RNG draws.
- Implemented the exact seven-leaf resource/body/RNG/display model behind an independent physics
  port. Same-frame respawn commands preserve wake → angular increment → transform → zero-linear
  order after `Step(dt,5,5)` and before display synchronization.

## Review Corrections

- Review found that Mode Select initially modeled only the unlock container. Added all 45
  immutable per-particle action plans and five validated draws per particle.
- Review found that Leaf respawn initially changed only local model state. Added an ordered
  production-port callback and creation-order event tests.
- Canonicalized native signed integer division so negative near-zero coordinates become `+0`,
  and guarded the external physics callback against synchronous model re-entry.

## Validation

- Vertical-slice TypeScript: `282/282` pass.
- Source/staging/archive tests: `38/38` pass.
- Cocos Creator 3.8.8 bundled strict TypeScript: pass.
- Reconstruction policy and evidence hashes: pass.
- `git diff --check`: pass.
- Independent re-review: BasicBlade, Mode Select burst, and Shared Leaf closures pass with no
  remaining Critical, High, Medium, or Low findings.

No APK or `libgame.so` was executed.

## Explicit Non-Claims

- Main Menu, shared roots, and Mode Select are not yet attached as Creator presenters.
- RopeButton/FruitButton physics, destination-mode screens, and the persistent app shell remain
  open.
- No original-runtime, pixel-golden, historical RNG-sequence, or legacy Box2D-solver identity is
  claimed.

## Next Work

Refactor Classic boot behind one persistent app-shell host, construct Background → Leaf → Theme →
Main Menu in recovered append order, then attach the reviewed Main Menu and Mode Select presenters.
Keep Classic controllers passive until the recovered `0.75`-second Mode Select handoff and preserve
the current Result/Retry transaction.

## Unresolved Questions

None for this checkpoint. The remaining items are explicitly bounded implementation work.

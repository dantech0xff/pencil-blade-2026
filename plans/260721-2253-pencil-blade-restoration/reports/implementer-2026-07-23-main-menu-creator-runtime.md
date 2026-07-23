---
role: implementer
date: 2026-07-23
scope: main-menu-creator-runtime
status: complete
---

# Main Menu Creator Runtime

## Summary

Implemented detached Main Menu foreground, exact loaded art/font binding, controls, retained heart effects, three actual physics FruitButtons, cut halves, blade/raycast integration, settings/audio actions, and lifecycle navigation ports.

## Findings

- Shared BladeInput uses explicit acquired/suspended lease state; never-activated or suspended disposal cannot release a newer owner.
- Failed routes restore every fruit cut by one ray batch and permit recut. Successful lifecycle callback is irreversible before fallible post-commit effects.
- Activation, attachment, post-physics cleanup, immediate/delayed route rollback, and disposal cover failure paths.
- Completed retained hearts leave the nodes intact but exit the active action list.
- Unsupported destinations stay isolated behind lifecycle callback; no placeholder screen/art added.

## Verification

- Main Menu focused cluster: `44/44` pass.
- Creator 3.8.8 strict TypeScript: no owned Main Menu errors; root owns final global rerun after concurrent Mode Select stabilization.

## Recommendations

- Exercise the integrated app-shell Main Menu ↔ Mode Select atomic transition in Creator Preview.

## Unresolved Questions

None.

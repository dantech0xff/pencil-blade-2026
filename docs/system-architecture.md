# System Architecture

## Current State

Pencil Blade is being rebuilt as a static-evidence, clean-room Cocos Creator 3.8.8 project.
The workspace now contains a Creator foundation under `game/`, pure TypeScript domain modules,
Creator-facing adapters, deterministic contract tests, and an Editor-authored `classic.scene`.
The first Canvas bridge is live; the full gameplay/presentation scene layer remains incomplete.

## Dependency Direction

```text
Creator scenes / components / prefabs
               |
               v
Creator adapters and ports
               |
               v
pure TypeScript domain modules
```

The dependency direction is one-way. Domain modules do not import `cc`. Creator code adapts
the domain to scene lifecycle, rendering, audio, storage, and Physics2D.

## Layer Map

| Layer | Owned By | Notes |
|---|---|---|
| Evidence and docs | `docs/`, `forensics/`, `reference/`, `plans/` | Static evidence, contracts, and progress records. |
| Pure gameplay domain | `game/assets/scripts/domain/` | Session, physics, score, combo, fail, toss, random, and input logic. |
| Creator boundary | `game/assets/scripts/creator/` | Unit conversion and unresolved Creator-specific integration. |
| Initial scene bridge | `game/assets/scenes/classic.scene` | Editor-serialized Canvas with blade input and Classic session/resolution components. |
| Verification | `tests/reconstruction/vertical-slice/` | Deterministic contract tests and boundary audits. |
| Build audit | `scripts/audit-creator-build.mjs` | Post-build APK/AAB inspection for prohibited payloads. |

## Current Domain Boundaries

| Boundary | Current rule |
|---|---|
| Physics2D | Recovered gravity, body and fixture values, ray-order behavior, and several contract details are encoded in pure modules. The first scene holds automatic simulation off and resets its accumulator; timestep equivalence remains an explicit unresolved adapter decision. |
| Spawn and toss | Spawn ordering, intervals, fruit selection, and controller sequencing live in pure modules. |
| Score, combo, fail | Score, combo window, double-score behavior, and three-indicator fail flow are modeled independently of Creator presentation. |
| Cut handling | Blade tracking and bidirectional ray planning are pure and testable before they reach Creator. |
| Resolution and input | The recovered `720` physical-width profile branch is pure; Creator applies its Show All policy and routes scene-wide touch input into four blade slots. |
| Build boundary | Source-boundary tests reject trackable legacy integration. The separate fail-closed archive audit hashes every entry, parses ZIP records exactly, and inspects nested archives/ELF payloads; a real Creator artifact is still pending. |

## Open Architectural Gaps

- Scene, prefab, and serialized component ownership is established only for the first Canvas bridge.
- Creator Physics2D timestep policy is still unresolved.
- Electric-field compatibility remains an unresolved adapter decision.
- Rights for legacy art, music, fonts, name, and trademarks are still unknown.

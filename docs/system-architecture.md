# System Architecture

## Current State

Pencil Blade is being rebuilt as a static-evidence, clean-room Cocos Creator 3.8.8 project.
The workspace now contains a Creator foundation under `game/`, pure TypeScript domain modules,
Creator-facing adapters, deterministic contract tests, and an Editor-authored `classic.scene`.
All 862 recovered APK game assets are staged byte-for-byte in the Creator `game` bundle.
The Canvas now runs a bounded Classic loop using exact recovered background, text, fail-marker,
ordinary fruit/cut-half, critical-particle, and core-audio resources. The full gameplay and
presentation layer remains incomplete.

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
The current scene and gameplay controllers are enabled together for the Canvas lifetime;
component enable/disable is not the pause boundary.

## Layer Map

| Layer | Owned By | Notes |
|---|---|---|
| Evidence and docs | `docs/`, `forensics/`, `reference/`, `plans/` | Static evidence, contracts, and progress records. |
| Pure gameplay domain | `game/assets/scripts/domain/` | Session, physics, score, combo, fail, toss, random, and input logic. |
| Creator boundary | `game/assets/scripts/creator/` | Unit conversion, manual variable-step lifecycle, and Creator-specific integration. |
| Creator resource bundle | `game/assets/game/` | Exact staged bytes for all 862 recovered APK game assets; only a reviewed Classic subset has runtime consumers so far. |
| Initial scene bridge | `game/assets/scenes/classic.scene` | Editor-serialized Canvas with blade input, Classic session/resolution, and bounded gameplay components. |
| Verification | `tests/reconstruction/vertical-slice/` | Deterministic contract tests and boundary audits. |
| Build audit | `scripts/audit-creator-build.mjs` | Post-build APK/AAB inspection for prohibited payloads. |

## Current Domain Boundaries

| Boundary | Current rule |
|---|---|
| Physics2D | Recovered gravity, body and fixture values, ray-order behavior, and variable `frameDt * worldSpeed` stepping are encoded in pure modules. Automatic simulation stays off; a project-owned `System.postUpdate` performs one synchronized manual step and flushes project lifecycle mutations only after Box2D unlocks. |
| Spawn and toss | Spawn ordering, intervals, fruit selection, and controller sequencing live in pure modules. |
| Score, combo, fail | Score, combo window, double-score behavior, and the three-miss state are pure. A dedicated Creator presenter owns the exact normal/filled marker rasters, recovered entry/activation/transient action timings, and completion callbacks. |
| Cut handling | Blade tracking and bidirectional ray planning are pure; the Creator gameplay bridge executes two ordered post-step raycasts and preserves repeated fixture dispatch until batch disposal. |
| Cut presentation | Ordinary cuts instantiate exact bottom/top rasters, recovered body/fixture/impulse values, action-clock fade, and deferred disposal. Critical halves may emit exact recovered particle rasters with shared RNG ordering. |
| Audio | A Creator adapter preloads 20 core recovered clips and interprets toss, swish, cut, critical, and combo commands without moving draw/order rules out of the domain. |
| Resource import | Staging and metadata validators prove exact bytes and current Creator raster/audio import geometry for the recovered APK corpus. Per-asset consumer and UUID coverage is not yet backfilled into the manifest. |
| Resolution and input | The recovered `720` physical-width profile branch is pure; Creator applies its Show All policy and routes scene-wide touch input into four blade slots. |
| Build boundary | Source-boundary tests reject trackable legacy integration. The separate fail-closed archive audit hashes every entry, parses ZIP records exactly, and inspects nested archives/ELF payloads; a real Creator artifact is still pending. |

## Open Architectural Gaps

- Scene and serialized component ownership is established for the first Canvas bridge; the
  remaining scene/prefab/presenter map is open.
- Dynamic-body trajectory, ray ordering, and deferred lifecycle behavior still need live Box2D validation on the custom variable-step boundary.
- Exact recovered APK resources are imported and the first Classic consumers are integrated;
  most of the 862 assets still need consumer mapping. The canonical sample-project root remains
  unresolved, so corpus completeness and the final fidelity denominator are still open.
- Electric-field compatibility remains an unresolved adapter decision.
- Rights for legacy art, music, fonts, name, and trademarks are still unknown.

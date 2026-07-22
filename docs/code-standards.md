# Code Standards

## Purpose

This repository uses a clean-room TypeScript core with Creator-specific adapters at the edge.
The standards below reflect the code that already exists in the workspace and the boundaries
the restoration plan depends on.

## Repository Layout

| Path | Standard |
|---|---|
| `game/assets/scripts/domain/` | Keep gameplay rules, state machines, and contract logic pure and testable. Do not import `cc`. |
| `game/assets/scripts/creator/` | Keep Creator-only lifecycle, scene, audio, and Physics2D integration here. |
| `tests/reconstruction/vertical-slice/` | Keep recovered-contract regression tests here. |
| `scripts/` | Keep repo-level audits and verification utilities here. |
| `docs/` | Keep decision records, architecture notes, and project summaries here. |
| `game/library/` | Treat as generated Creator cache, not hand-authored source. |

## Domain Rules

- Keep domain modules deterministic and side-effect free unless a contract explicitly requires state mutation.
- Use explicit inputs for clock, random, viewport, and input seams.
- Return command objects at the boundary instead of reaching into Creator objects from domain logic.
- Preserve recovered, inferred, and unknown labels in prose and tests when evidence is incomplete.
- Prefer frozen values for command snapshots and exported contract constants.

## Creator Adapter Rules

- Keep Creator scene, node, prefab, audio, and Physics2D calls at the adapter boundary.
- Convert units explicitly at the boundary. Do not hide world-unit conversions inside domain logic.
- Never route gameplay through the original APK, `libgame.so`, JNI, JSB, or a compatibility bridge.
- Keep the resolved `public-manual-variable-step` mapping at the adapter boundary; treat
  unvalidated backend behavior such as contact lifecycle and ray ordering as explicit gates.
- Route every project-owned physics create/destroy/enable/disable/apply mutation through the
  adapter's after-step boundary when it may originate during a manual step callback.
- Use exact staged resources when a reviewed contract identifies them; do not substitute
  generated graphics or default fonts silently. Do not document the current subset as
  presentation-complete until the canonical technical resource manifest passes 100% inventory,
  staging, and consumer coverage. Track release rights separately.
- Keep generated Creator cache files out of hand-authored logic.

## Testing Rules

- Add or update a focused contract test whenever a recovered rule changes.
- Prefer narrow regression coverage before broader integration checks.
- Keep boundary tests for prohibited runtime paths, bridge imports, and build audits.
- Use deterministic fixtures for time, random, and input where the contract is known.

## Documentation Rules

- Document only what is verified in the workspace.
- Mark unknowns explicitly instead of inflating recovered coverage.
- Keep file links current and point to existing paths only.
- Update phase reports and architecture notes when the workspace state changes in a user-visible way.

## Build And Release Rules

- Audit APK/AAB outputs with `node scripts/audit-creator-build.mjs <build.apk|build.aab>`.
- Fail any build that contains the original APK, `libgame.so`, legacy Cocos2d-x runtime, decompiler output, or a native compatibility bridge.
- Keep release authorization separate from technical reconstruction completion.

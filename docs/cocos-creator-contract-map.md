# Cocos Creator Contract Map

## Purpose

This map connects the recovered Classic contracts to the current TypeScript owners,
their verification tests, and the current implementation status.

## Map

| Contract | Primary owner | Verification tests | Status | Notes |
|---|---|---|---|---|
| Resolution profile | `game/assets/scripts/domain/resolution-profile-service.ts`, `game/assets/scripts/creator/classic-resolution-adapter.ts` | `tests/reconstruction/vertical-slice/resolution-profile-service.test.ts`, Creator bundled strict TypeScript | Integrated in `classic.scene` | Selects `480x800` below physical width `720`, otherwise `720x1280`; applies the public Show All policy and exposes the visible rect. |
| Physics boundary | `game/assets/scripts/domain/classic-physics-rules.ts`, `game/assets/scripts/creator/classic-physics-adapter.ts` | `tests/reconstruction/vertical-slice/classic-fixtures-bounds.test.ts`, `tests/reconstruction/vertical-slice/classic-blade-physics.test.ts`, `tests/reconstruction/vertical-slice/creator-scene-integration.test.ts`, `tests/reconstruction/vertical-slice/source-boundary.test.ts` | Resolved properties integrated; automatic simulation held pending timestep/electric decisions | Encodes gravity, unit conversion, fixtures, filters, and adapter seams without adopting Creator's default fixed step. |
| Blade tracking and cut rays | `game/assets/scripts/domain/blade-tracks.ts`, `game/assets/scripts/domain/classic-cut-query.ts`, `game/assets/scripts/creator/blade-input-controller.ts` | `tests/reconstruction/vertical-slice/classic-blade-physics.test.ts`, `tests/reconstruction/vertical-slice/classic-cut-session.test.ts`, Creator bundled strict TypeScript | Input integrated; post-physics cut execution pending | Covers the four-slot blade buffer, global touch adapter, and bidirectional ray planning without choosing a timestep. |
| Session lifecycle | `game/assets/scripts/domain/classic-session.ts`, `game/assets/scripts/creator/classic-scene-controller.ts` | `tests/reconstruction/vertical-slice/classic-cut-session.test.ts`, Creator bundled strict TypeScript | Command bridge integrated; presenters/toss factories pending | Owns intro, running, terminal, and retry commands. The scene component does not auto-complete intro. |
| World speed | `game/assets/scripts/domain/classic-world-speed.ts` | `tests/reconstruction/vertical-slice/classic-world-speed.test.ts` | Implemented | Models the recovered 30-second speed-up and freeze/unfreeze commands. |
| Spawn planning and toss timers | `game/assets/scripts/domain/classic-spawn-planner.ts`, `game/assets/scripts/domain/classic-toss-config.ts`, `game/assets/scripts/domain/classic-toss-strategies.ts`, `game/assets/scripts/domain/toss-timer.ts`, `game/assets/scripts/domain/spawn-kinematics.ts`, `game/assets/scripts/domain/gameplay-random.ts` | `tests/reconstruction/vertical-slice/classic-toss-foundation.test.ts`, `tests/reconstruction/vertical-slice/classic-spawn-strategies.test.ts` | Implemented | Covers the fixed controller table, random draws, and timer behavior. |
| Score, combo, and fail flow | `game/assets/scripts/domain/score-service.ts`, `game/assets/scripts/domain/combo-service.ts`, `game/assets/scripts/domain/fail-service.ts`, `game/assets/scripts/domain/classic-fruit-cut.ts` | `tests/reconstruction/vertical-slice/classic-score-fail.test.ts`, `tests/reconstruction/vertical-slice/classic-cut-session.test.ts` | Implemented | Captures score accumulation, combo windows, double-score presentation, and fail indicators. |
| Build and boundary audit | `scripts/audit-creator-build.mjs`, `tests/audit-creator-build-test.mjs`, `tests/reconstruction/vertical-slice/source-boundary-audit.ts` | `tests/audit-creator-build-test.mjs`, `tests/reconstruction/vertical-slice/source-boundary.test.ts` | Implemented and independently reviewed; awaiting a real Creator artifact | Source checks plus extension-independent archive hashing, exact ZIP parsing, nested archive inspection, and pinned ELF policy. |

## Current Status Summary

- The core Classic contracts are represented in pure TypeScript.
- Creator has imported the exact `game/` root and serialized the first Canvas component map.
- Remaining Creator work includes the full scene/prefab map, post-physics cut execution,
  presenters, factories, and rights-reviewed assets.
- The build audit exists, but the real APK/AAB post-build check remains a later gate.

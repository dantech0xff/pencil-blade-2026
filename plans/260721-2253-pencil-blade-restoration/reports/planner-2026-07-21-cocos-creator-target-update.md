---
type: planner
date: 2026-07-21
status: superseded
updated: 2026-07-22
---

# Cocos Creator Target Update

> **Historical report — superseded 2026-07-22.** Its remaining reference-device question
> is closed as unavailable and is not an active requirement. Follow the
> [static-only revision](./planner-2026-07-22-static-only-revision.md) and current phase files.

## Decision Applied

- Fixed production target to the latest stable Cocos Creator.
- Verified current baseline as Cocos Creator 3.8.8 / 3.8 LTS from official Cocos sources.
- Fixed implementation style to TypeScript, Creator components/scenes/prefabs/assets,
  with Android as primary target.
- Restricted APK, extracted resources, Java, and libgame.so to evidence/analysis use.
- Prohibited original binary/runtime reuse, wrapping, calling, C++ application porting,
  JNI/JSB legacy gameplay bridges, APK emulation, and decompiler artifacts in builds.
- Recorded the unavoidable Android platform-envelope change from original min SDK 9
  to Creator 3.8's API 21+ minimum.

## Consistency Sweep

- Renamed Phase 5 and updated all inbound links.
- Replaced engine comparison/approval work with Creator version pinning, project layout,
  C++-to-TypeScript mapping, vertical-slice conformance, and artifact auditing.
- Added lossless Creator resource staging to Phase 3 and native-contract mapping to Phase 4.
- Updated Phases 6-7 with Creator paths and prohibited-runtime release checks.
- Updated restoration research, red-team review, and validation gates.
- Searched the plan tree for superseded selection terminology, former Phase 5 paths,
  generic project placeholders, and nonphysical capture language; no active instruction remains.
- Read all phase, research, and report files after editing.

## Validation

- `plan.md` length: 79 lines.
- `ck plan validate ... --strict`: 7 phases, 0 errors, 0 warnings.
- `ck plan status`: 0/7 completed, all phases pending as expected.
- Remaining Cocos2d-x references describe the verified source artifact, translation map,
  or explicit prohibited-runtime boundary; none select it as the production engine.

## Unresolved Questions

- Availability of a compatible physical 32-bit ARM reference device.
- Private preservation, source publication, or public store release scope.
- Rights/permissions for name, artwork, fonts, music, and other third-party assets.

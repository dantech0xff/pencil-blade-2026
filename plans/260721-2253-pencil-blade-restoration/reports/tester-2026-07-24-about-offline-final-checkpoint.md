---
type: tester
date: 2026-07-24
status: checkpoint-pass
scope: About screen and retired-platform offline boundary
evidence_mode: static tests and Creator Preview; original APK/native runtime not executed
---

# About / Offline Final Checkpoint

## Summary

The narrow About/offline code checkpoint passes. The integrated review has no open
P0-P2 finding, and the Main Menu idempotent-rearm correction is covered by fresh
post-fix focused tests. About preserves the recovered local presentation and two-way
route while Review, Email, and Social terminate as local `retired-offline` events.

## Verification Gates

| Gate | Result | Timing |
|---|---|---|
| About domain/resource focused suites | `18/18` pass | implementation checkpoint |
| About presenter focused suite | `8/8` pass | implementation checkpoint |
| Full focused Main Menu/About set | `206/206` pass | before review fix |
| Reviewer fresh integrated set | `169/169` pass | after review fix |
| Root Main Menu + shell focused set | `140/140` pass | after review fix |
| Full vertical-slice suite | `1494/1494` pass | final root run after review fix |
| Top-level `tests/*.mjs` suite | `43/43` pass | final root run after review fix |
| Cocos Creator 3.8.8 strict TypeScript | pass; zero diagnostics | after review fix |
| Local-only runtime trust scan | pass; no prohibited live-integration match | current checkpoint |

## Creator Preview

- High `720x1280` and compact `480x800` / OPPO physical `360x800` profiles pass.
- `Main Menu -> About -> Main Menu` completes in both profiles.
- Review, Email, and Social leave the active route unchanged.
- The `999999` balance remains unchanged after all retired actions.
- Preview console records zero errors and zero warnings.

## Boundary and Release Note

Production supplies `localCompatibilityAvailable: false`; no review pulse, random
heart allocation, reward, save, network, URI, JNI/platform, advertising, or
music-control path is reachable from About's retired actions. The shell reconstructs
their payloads as fixed local `retired-offline` events.

Rights clearance for the recovered bitmaps and approval or replacement of baked legacy
version/contact/social copy remain release concerns. They are not code blockers for this
checkpoint.

## Unresolved Questions

- Release owner must decide whether the recovered bitmap rights and baked legacy copy
  are approved or require clean-room replacement.

Status: DONE_WITH_CONCERNS
Summary: About/offline focused code, trust boundary, strict TypeScript, and two-profile Preview pass; no open P0-P2 issue remains.
Concerns/Blockers: Static rights and baked-copy approval remain release concerns, not code blockers.

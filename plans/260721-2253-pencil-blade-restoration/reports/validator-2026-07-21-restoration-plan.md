---
type: validator
date: 2026-07-21
status: superseded
updated: 2026-07-22
---

# Restoration Plan Validation

> **Historical report — superseded 2026-07-22.** Its reference-device, runtime-capture,
> and original-runtime comparison assumptions are not active requirements. Follow the
> [static-only validation](./validator-2026-07-22-static-only-revision.md) and current phase files.

## Summary

Phase 1 is safe to start. The roadmap now fixes the implementation target to the latest
stable Cocos Creator and retains explicit evidence, implementation, fidelity, and release gates.

## Validation

- APK hash, ZIP count, asset counts, manifest facts, native ABI, engine fingerprint,
  and surviving dynamic-symbol claims were checked against the provided APK.
- Phase 1 does not depend on the target implementation and needs no release decision.
- Phase 2 requires a compatible physical 32-bit ARM reference device; emulated evidence
  is excluded from the canonical capture set.
- Phase 5 requires official stable-version revalidation, a pinned Creator/editor/Android
  toolchain, and completed Classic capture/presentation/native-contract readiness gates.
- Cocos Creator, TypeScript/components/scenes, and Android as primary target are fixed;
  engine comparison and approval are no longer open decisions.
- Phase 7 requires private-preservation versus public-release scope and rights evidence.
- Workspace is not a Git repository. Offline evidence capture may proceed; VCS init and
  commits wait for curated/ignored boundary approval.

## Unresolved Questions

- Is a compatible physical 32-bit ARM Android device available?
- Is the intended outcome private preservation, source publication, or public store release?
- What rights or permissions exist for the name, artwork, fonts, and music?

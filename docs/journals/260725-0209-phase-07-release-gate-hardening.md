---
date: 2026-07-25 02:09 +08
session: phase-07-release-gate-hardening
---

# Phase 07 Release Gate Hardening

## Context

Phase 07 was the last technical checkpoint before release, but the boundary stayed split in two: local technical artifacts passed, public release stayed blocked. We hardened the debug APK and Web Mobile gates against the exact failure modes that already hurt us: spoofed signer identity, sloppy ABI parsing, bad rights exceptions, invalid approval dates, and loose web sink resolution. No original APK/native execution happened here, and no Pages deployment was attempted because the rights gate is still closed.

## What Happened

The final checkpoint landed with `1749/1749` tests passing across the Node and vertical-slice suites, and the reviewer reported zero P0-P3 findings. That is the only reason the build feels credible. The debug signer now binds to the exact certificate digest instead of trusting `CN=Android Debug` text, the ABI gate accepts only a singleton `arm64-v8a` token, the rights verifier fails closed on pending exceptions and impossible calendar dates, and the web prefix verifier now has coverage for alias resolution, ASI, and lexical control-flow boundaries that previously let bad sinks slip past review. The current Android APK hash and private H5 tree are still valid as technical artifacts, but they are not public-release proof.

## Reflection

This was exhausting because the bugs were not glamorous; they were boring validation mistakes that only looked small until they let the wrong thing through. The painful part is that each one needed a separate hardening step, and the web verifier in particular needed iterative review before it stopped being naive about JavaScript control flow. The good news is that the gate now fails closed instead of pretending uncertainty is safety.

## Decisions Made

| Decision | Why |
|---|---|
| Bind Android acceptance to exact signer digest | A subject DN alone is spoofable and was already proven insufficient. |
| Parse ABI as one exact singleton | Substring matching accepted bogus extra ABI content. |
| Fail closed on pending rights and invalid dates | Public release cannot tolerate permissive approval parsing. |
| Cover web sink resolution with alias/ASI/control-flow tests | Static analysis missed indirect and syntax-sensitive cases without them. |
| Keep public release blocked | Rights approval, Pages deployment, Android runtime-device proof, canonical denominator closure, Physics2D parity, and the final `>=99%` score are still open. |

## Next Steps

Keep the technical artifact set frozen, continue the runtime/device and fidelity work, and do not treat the local APK or private H5 build as public release authorization. The remaining owner is the phase lead: close the denominator, finish the Android and H5 proof matrix, and resolve rights before any deployment claim.

## Unresolved Questions

- What is the frozen denominator for the final fidelity score?
- Which Android devices and H5 browser rows are actually in scope?
- When does public rights approval become real instead of hypothetical?

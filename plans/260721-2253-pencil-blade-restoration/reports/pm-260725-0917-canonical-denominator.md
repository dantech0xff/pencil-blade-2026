---
type: project-manager
date: 2026-07-25
status: complete-with-concerns
scope: canonical-resource-denominator
---

# Canonical Resource Denominator Decision

## Decision

Project owner confirmed the APK is the only extant Pencil Blade source. No external sample
project, source project, or supplemental resource archive exists.

Approved canonical game-resource denominator:

| Fact | Value |
|---|---:|
| APK SHA-256 | `95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa` |
| Game assets | `862` |
| Bytes | `32,945,747` |
| Staged byte-for-byte | `862/862` |
| Reconciled | `862/862` |
| Dispositions | `761` consumed, `100` excluded, `1` unsupported, `0` unknown |
| Android `res/` PNG | `107`: `3` launcher, `104` vendor UI, `0` game |

Decision record:
[`docs/decisions/apk-corpus-canonical-denominator.md`](../../../docs/decisions/apk-corpus-canonical-denominator.md)

## Plan Sync

- Closed Phase 03 canonical-source checkbox.
- Closed Phase 07 canonical-source todo and matching success criterion.
- Plan moved from `102/130` to `105/130` checked (`80.77%`).
- Plan and Phases 03, 05, and 07 remain in progress.
- Historical reports were not rewritten.

## Validation

- focused manifest/staging tests: `27/27` pass
- complete top-level Node suite: `182/182` pass
- staging-manifest and decision-record hashes match the recovered manifest
- docs validation: `89` internal links working
- `git diff --check`: pass
- public-rights gate: expected `BLOCKED`; canonical-denominator approval does not authorize release

## Remaining Root Gates

1. Define five-domain contract units, weighting, residual ledger, and reach `>=99%`.
2. Prove pinned Physics2D trajectory/ray/contact/lifecycle equivalence.
3. Freeze Android runtime and H5 browser/version rows.
4. Complete rights review, including `Fonts/CooperBlackStd.otf`.
5. Configure and verify public GitHub Pages after rights approval.
6. Complete two offline APK backups and Phase 02 function-map enrichment.

## Unresolved Questions

- Which domain weights and contract units govern the final fidelity score?
- What public-release treatment is authorized for `Fonts/CooperBlackStd.otf`?
- Which Android device/API and H5 browser/version rows are supported?
- Where will the two hash-verified offline APK backups be stored?

Status: DONE_WITH_CONCERNS
Summary: APK-only corpus promoted to the approved canonical resource denominator; three plan checkboxes closed.
Concerns/Blockers: Fidelity scoring, Physics2D/runtime matrix, rights, Pages, backup custody, and function-map enrichment remain open.

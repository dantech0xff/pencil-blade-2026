---
type: debugger
date: 2026-07-25
status: done-with-concerns
scope: technical-closeout-audit
---

# Technical Closeout Audit

## Executive Summary

Verdict: closeout evidence is not technically self-consistent.

Two repository-controlled defects remain:

1. `P1` fidelity scoring is inflated to `100.00%` by counting inference-only and resource-consumer-only units as recovered credit.
2. `P2` artifact provenance drift leaves current Phase 07 docs/checkpoints split across two different Android/H5 artifact identities.

External gates were checked separately and are not the defects here: rights remain blocked, Pages infrastructure is absent, and the local Creator bundle still fails strict signature verification.

## Timeline

- `2026-07-25 01:46:30` tester checkpoint written:
  `plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-25-phase7-final-checkpoint.md`
- `2026-07-25 02:01:01` reviewer checkpoint written:
  `plans/260721-2253-pencil-blade-restoration/reports/reviewer-2026-07-25-phase7-final-checkpoint.md`
- `2026-07-25 09:20:57` Phase 07 plan still cites Android APK SHA-256 `1a4d96...`:
  `plans/260721-2253-pencil-blade-restoration/phase-07-validate-fidelity-and-prepare-release.md:32`
- `2026-07-25 11:24:49` current Android artifact updated:
  `game/build/artifacts/android/pencil-blade-debug.apk`
- `2026-07-25 11:24:52` current sidecar updated:
  `game/build/artifacts/android/pencil-blade-debug.apk.sha256`
- `2026-07-25 11:42:49` H5 runtime matrix written with Web tree digest `90f0fed3...` and `39,613,694` bytes:
  `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json:9-14`
- `2026-07-25 11:48:02` Android runtime matrix written with APK SHA-256 `e313e149...`:
  `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json:4-9`
- `2026-07-25 11:51:11` Physics2D backend probe written:
  `forensics/runtime/physics2d-backend-equivalence.json`
- `2026-07-25 12:06:22` fidelity artifacts/docs generated and now claim `100.00%` pass:
  `forensics/fidelity/fidelity-report-v1.json:23-26`, `docs/fidelity-report.md:5-17`

## Hypotheses Tested

1. The new fidelity report only counts fully recovered units.
   - Eliminated.
   - The generator accepts non-null audio evidence and any non-`unknown` rendering/progression status as recovered pass credit.

2. The hash drift is limited to historical reports and does not affect the current closeout record.
   - Eliminated.
   - Current closeout docs are split: some cite the new Android/H5 identities, others still cite older ones.

3. The underlying runtime/physics evidence is missing, so the closeout issue is only absent evidence.
   - Eliminated.
   - Runtime-matrix and Physics2D reports exist and are fresh; the defects are metric semantics and provenance reconciliation.

## Findings

### P1 - Fidelity generator counts non-recovered units as recovered, producing a false `100.00%` gate pass

Evidence chain:

- The metric itself says residuals cannot raise recovered coverage:
  `reference/fidelity-metric-v1.json:12-17`
- The published report repeats that rule:
  `docs/fidelity-report.md:21-25`
- The generator still counts all audio cues with any non-null `eventEvidenceStatus`:
  `scripts/generate-fidelity-report.mjs:260-264`
- Ten cues are explicitly only `resource-consumer-contract`, not native-string or reconstructed event recovery:
  `assets/catalog/audio-cue-map.json:766,824,879,901,923,945,967,1351,1373,1420`
- The residual ledger says those ten cues "cannot-add-event-linkage-credit":
  `forensics/fidelity/residual-gap-ledger.json:133-140`
- The generator also counts any rendering/progression contract whose status is merely not `unknown`:
  `scripts/generate-fidelity-report.mjs:282-286`, `306-310`
- The counted contract set includes explicit inference-bearing statuses:
  `assets/catalog/presentation-contract-map.json:6`, `17`, `65`
- The residual ledger separately states the blade material inference does not add recovered credit:
  `forensics/fidelity/residual-gap-ledger.json:144-153`
- Despite that, the generated outputs claim all domains passed with zero failed units:
  `forensics/fidelity/fidelity-report-v1.json:23-26`, `docs/fidelity-report.md:13-17`, `docs/reconstruction-report.md:60-67`
- The test suite codifies this inflated result as expected behavior:
  `tests/generate-fidelity-report.test.mjs:15-25`

Confirmed impact:

- At least `10` audio units are counted despite being only `resource-consumer-contract`.
- At least `3` contract units are counted despite explicit compatibility/inference status:
  `stock-textured-sprite-rendering`, `basic-blade-textured-strip`, `code-driven-toss-and-timing`.
- This makes the `100.00%` closeout claim untrustworthy. By direct count, the affected audio/rendering/progression groups would fall below the `99%` floor if those units were excluded per the metric rule.

Root cause:

- The metric policy and the implementation disagree.
- `scripts/generate-fidelity-report.mjs` treats "has any evidence/status" as equivalent to "is recovered credit", but the metric text says inference/unknown/compatibility residuals must remain outside the recovered numerator.

Recommended fix:

1. Tighten pass predicates in `scripts/generate-fidelity-report.mjs` to require recovered-only status classes.
2. Exclude `resource-consumer-contract` cues from recovered audio credit until promoted to versioned recovered units.
3. Exclude `recovered-with-*` inference/compatibility statuses from recovered rendering/progression credit unless the metric explicitly redefines them.
4. Regenerate `forensics/fidelity/*`, `docs/fidelity-report.md`, and `docs/reconstruction-report.md`.
5. Replace `tests/generate-fidelity-report.test.mjs` assertions that currently lock in the false `100.00%`.

### P2 - Phase 07 provenance drift leaves current closeout docs split across old and new artifact identities

Evidence chain:

- Current Android artifact and sidecar now resolve to SHA-256 `e313e149164eec8664b934a16e3c14b3a0f0265f9c7bb6306375a08a7cb5c37d`:
  - `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json:4-9`
  - shell check during this audit:
    `cat game/build/artifacts/android/pencil-blade-debug.apk.sha256`
    -> `e313e149164eec8664b934a16e3c14b3a0f0265f9c7bb6306375a08a7cb5c37d  pencil-blade-debug.apk`
- Current H5 runtime matrix records `39,613,694` bytes and tree digest `90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54`:
  `plans/260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json:9-14`
- Current compatibility/reconstruction docs use those new values:
  `docs/compatibility-matrix.md:28-32`, `docs/reconstruction-report.md:94-98`
- But other current closeout docs still cite the older Android/H5 identities:
  - old Android APK hash in build audit:
    `docs/cocos-creator-build-audit.md:64`
  - old Web byte count/digest in build audit:
    `docs/cocos-creator-build-audit.md:112`
  - old Android APK hash in Phase 07 checkpoint:
    `plans/260721-2253-pencil-blade-restoration/phase-07-validate-fidelity-and-prepare-release.md:32`
  - tester checkpoint claims `cat game/build/artifacts/android/pencil-blade-debug.apk.sha256` returned the old hash:
    `plans/260721-2253-pencil-blade-restoration/reports/tester-2026-07-25-phase7-final-checkpoint.md:67`

Confirmed impact:

- The repository no longer has a single artifact identity for the claimed Phase 07 closeout.
- Readers cannot tell which Android APK and which H5 tree were actually audited when they compare the plan, build audit, tester checkpoint, compatibility matrix, and reconstruction report.
- This is exactly the provenance class of failure the closeout was supposed to prevent.

Root cause:

- The Android/H5 artifact set changed after the earlier checkpoint docs were written.
- Later runtime-matrix/fidelity outputs were generated against the newer artifacts, but dependent closeout docs were not regenerated or marked superseded.

Recommended fix:

1. Pick one canonical Android APK SHA-256 and one canonical H5 tree digest for the closeout.
2. Regenerate every dependent Phase 07 record from that same artifact set, or mark older records historical/superseded in-place.
3. Add one machine-readable closeout manifest that binds:
   - APK path + SHA-256
   - H5 file count + bytes + tree digest
   - runtime-matrix report hashes
   - fidelity-report hash
4. Fail the closeout docs sync when any referenced artifact digest no longer matches the current workspace artifact set.

## Non-Defects Confirmed

- Rights gate is still fail-closed.
- Public GitHub Pages remains blocked by missing approvals/infrastructure.
- Local Creator strict code-signature failure is still fail-closed, not bypassed.
- Fresh runtime-matrix and Physics2D evidence files exist; the issue is how closeout logic consumes and reconciles them.

## Unresolved Questions

- Which Android APK hash is the intended canonical Phase 07 artifact: historical `1a4d96...` or current `e313e149...`?
- Was the post-checkpoint artifact rebuild intentional and approved, or incidental workspace drift?
- Should `recovered-absence` remain numerator credit in the fidelity metric, or should absence-only assertions move fully to residual accounting?

Status: DONE_WITH_CONCERNS
Summary: The current closeout has two repository-controlled defects: the fidelity generator inflates recovered credit to a false `100.00%`, and the Android/H5 provenance chain is split across old and new artifact hashes/digests.
Concerns/Blockers: Rights, Pages infrastructure, and offline custody remain external blockers, but they are separate from the two internal defects above.

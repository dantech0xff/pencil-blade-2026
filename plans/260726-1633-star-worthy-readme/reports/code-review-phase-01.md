# Phase 1 Code Review

Date: 2026-07-26
Review mode: pre-landing, two-pass critical + informational
Verdict: **ACCEPTABLE WITH P3 FOLLOW-UP**

## Code Review Summary

### Scope

- Files: `scripts/capture-readme-gallery.mjs`; capture manifest and three report PNGs; three exact-byte display PNGs; `docs/release-rights-checklist.md`; the academic decision, public-source catalog, and publication manifest; English hero SVG/PNG; manifest-version test.
- Contracts inspected: publication/content validators, publication loader, audited Web-build checker, `RecoveredAppShellController`, and `release/public-release-variant-manifest.json`.
- Text delta: 953 changed/new lines in the core Phase 1 implementation artifacts (268 additions and 25 deletions in tracked text plus 660 new capture-script/manifest lines), plus seven binary PNGs.
- Focus: capture truthfulness, provenance, rights separation, path/network trust boundaries, error cleanup, backwards compatibility, and Phase 1 scope.
- Scout findings: output-path traversal, unbounded off-origin browser traffic, controller-state proof weaker than the published claim, and alt text inconsistent with the captured pixels. No database, auth, query, shared-state, or N+1 surface exists in this bounded CLI/media change.

### Overall Assessment

The initial review blocked Phase 1 on two P1 and two P2 defects. The remediation re-review confirms all four blockers are closed: output paths are validated before writes, network access is fail-closed, state proof is bound to exactly one `RecoveredAppShellController` immediately before capture, and the bilingual Classic-ready alt text matches the pixels. One low-priority cleanup error-reporting edge remains.

Pre-Landing Review after remediation: 1 issue (0 critical, 1 informational).

### Critical Issues

#### [P1][RESOLVED] Caller-controlled output paths can overwrite files outside the repository

- Evidence: [`scripts/capture-readme-gallery.mjs:127`](../../../scripts/capture-readme-gallery.mjs) resolves `--display-dir` and `--report-dir` without containment validation. The script creates and writes those paths at lines 328-355 and 534-538. `repositoryPath()` is called only after screenshot/copy/manifest writes, so its line 152 check cannot prevent damage. Its lexical check also does not stop an in-repository symlink from escaping the repository.
- Impact: a malformed CI invocation such as an absolute path or `../../...` can create directories and overwrite the fixed capture filenames or manifest anywhere the process can write.
- Fix: validate both output directories before `mkdirSync` using repository containment plus realpath/lstat-based symlink rejection. Validate each final output path before the first write. Keep machine-local browser/module inputs separate from repository-bound output inputs.

#### [P1][RESOLVED] Capture success does not prove the runtime was same-origin/offline

- Evidence: [`scripts/capture-readme-gallery.mjs:391`](../../../scripts/capture-readme-gallery.mjs) intercepts only `favicon.ico`. Lines 403-409 reject HTTP responses only when status is `>= 400`; a successful off-origin request is accepted and omitted from the provenance report.
- Impact: a dynamically constructed URL that escapes static Web-build auditing can supply media or behavior to a capture while the runner still emits a passing, supposedly self-contained audited-H5 record. This violates the no-hidden-network/external-media contract and makes captures environment-dependent.
- Fix: install a catch-all route before navigation, allow only the loopback capture origin (and the intentional local favicon response), abort and record every other scheme/origin, then fail if any off-origin request was attempted.

### High Priority

#### [P2][RESOLVED] Published controller-state provenance is stronger than the runner proves

- Evidence: [`scripts/capture-readme-gallery.mjs:220`](../../../scripts/capture-readme-gallery.mjs) collects every Cocos component with any string-valued `state`; lines 244-250 accept a match without requiring `className === "RecoveredAppShellController"`. The runner waits before the 3/4-second settling windows at lines 424-438 and does not re-check `classic` after the two action swipes at lines 446-455. The manifest nevertheless claims the exact `RecoveredAppShellController` state at [`reference/case-study-publication-manifest.json:1450`](../../../reference/case-study-publication-manifest.json), 1476, and 1502.
- Impact: future components or a state transition during a settling/input window can produce a capture whose published state proof is false while all current checks pass.
- Fix: resolve exactly one `RecoveredAppShellController`, reject zero or multiple matches, and assert its exact state immediately before each screenshot, after all settling delays and action gestures.

#### [P2][RESOLVED] Classic-ready alt text does not match the image

- Evidence: visual inspection of `readme-720-classic-ready.png` shows one strawberry in the playfield. The raw record says “two strawberries” at [`reference/case-study-publication-manifest.json:1468`](../../../reference/case-study-publication-manifest.json), with the same Vietnamese claim at line 1469. The exact-byte derivative repeats it at lines 1887-1888.
- Impact: GitHub/site accessibility text presents a factual visual claim that the artifact does not support.
- Fix: change both raw and derivative English/Vietnamese alt pairs to one strawberry, or use a stable generic description such as “fruit in play.”

### Medium Priority

None.

### Low Priority

#### [P3][RESOLVED IN MAIN CLEANUP] Cleanup failures can leak resources and mask the primary error

- Evidence: [`scripts/capture-readme-gallery.mjs:544`](../../../scripts/capture-readme-gallery.mjs) awaits context, browser, and server cleanup sequentially. If `context.close()` or `browser.close()` rejects, later cleanup is skipped and the cleanup error replaces the original capture failure. CDP sessions at lines 259-326 are likewise detached only on the success path.
- Impact: exceptional runs can leave the loopback server/browser alive and emit a less useful error.
- Fix: put CDP detach in `finally`; use nested cleanup `try/finally` blocks or `Promise.allSettled`, preserving the primary error while reporting cleanup failures separately.

### Edge Cases Found by Scout

- Absolute and traversal output-directory arguments.
- In-repository symlink targeting an external directory.
- Successful off-origin requests that evade static literal analysis.
- Another component exposing the same string `state`.
- Controller state changing during the fixed settle/action interval.
- Cleanup rejection preventing remaining resources from closing.
- Accessibility copy drifting from immutable capture pixels.

### Checklist a-e

| Check | Result | Evidence |
|---|---|---|
| a. Correctness | **PASS** | H5 identity and hashes align; state proof now requires exactly one named controller and is reasserted after settle/action delays; both alt pairs say one strawberry. |
| b. Regression/security | **PASS** | Output targets reject traversal and symlink escape before writes; off-origin HTTP is aborted, WebSockets are blocked, and the commercial record remains fail-closed. |
| c. Contracts | **PASS** | Publication `1.3.0`, source-catalog hash, decision `1.1.0`, and test expectation are coherent. `release/public-release-variant-manifest.json` is untouched and remains `blocked`. |
| d. Maintainability | **PASS WITH P3 FOLLOW-UP** | Runner polling is bounded, negative paths have focused tests, CDP sessions detach in `finally`, and context/browser/server cleanup attempts all resources. A teardown error can still mask the original CDP input error. |
| e. Scope | **PASS** | Changes remain in Phase 1 media/provenance/rights/test scope. `README.md` is untouched; Phase 2 was not implemented prematurely. |

### Positive Observations

- The audited H5 identity is consistently `2539` files, `39,613,694` bytes, digest `90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54`.
- The three report/display pairs are registered as exact-byte derivatives with matching source IDs.
- The 1200x630 English hero is project-authored SVG/PNG in the required cream/ink/yellow direction; the SVG contains no external reference or script.
- Rights expansion is explicitly academic/noncommercial and does not mutate the blocked commercial verdict.

### Recommended Actions

1. Do not block Phase 1 on the remaining P3.
2. In a follow-up, preserve an `Input.dispatchTouchEvent` failure if `session.detach()` also rejects.
3. Keep the accepted PNGs immutable unless a deliberate recapture is separately reviewed and re-registered.

### Metrics

- Type coverage: N/A; new implementation is JavaScript.
- Test coverage: not collected. Fresh reviewer verification records 6/6 capture-remediation tests and 37/37 publication/content tests passing.
- Linting issues: no dedicated lint result available.
- Fresh reviewer verification: script syntax, 6 capture-remediation tests, publication validation with snapshot verification, 37 publication/content tests, and `git diff --check` passed. The capture runner was not rerun.

### Residual Risks

- Existing publication validators check media record shape; capture semantics and runtime-origin policy remain enforced by the separate capture test/runner boundary.
- Fixed wall-clock settle intervals can still produce frame-timing variation; accepted artifacts remain hash-bound, and determinism should be re-demonstrated before any future recapture is accepted.
- Commercial release remains intentionally blocked; this review does not alter that owner decision.

### Unresolved Questions

None.

## Remediation Re-review

Date: 2026-07-26

### Prior Finding Resolution

| Prior finding | Result | Current evidence |
|---|---|---|
| P1 output containment | **RESOLVED** | [`scripts/capture-readme-gallery.mjs:175`](../../../scripts/capture-readme-gallery.mjs) rejects targets outside the repository and every symlink segment. Lines 205-237 enumerate both directories, the manifest, and all six PNG destinations. Line 512 runs this validation before the first `mkdirSync` or file write. Negative traversal and symlink tests pass at `tests/capture-readme-gallery.test.mjs:23-80`. |
| P1 off-origin/network blocking | **RESOLVED** | [`scripts/capture-readme-gallery.mjs:239`](../../../scripts/capture-readme-gallery.mjs) permits only the exact loopback HTTP origin; lines 256-280 abort off-origin HTTP and close WebSockets. Lines 552-568 install both policies before page creation/navigation, and lines 671-684 fail the run if any attempt was recorded. HTTP, redaction, and WebSocket tests pass at `tests/capture-readme-gallery.test.mjs:82-155`. |
| P2 exact controller-state proof | **RESOLVED** | [`scripts/capture-readme-gallery.mjs:368`](../../../scripts/capture-readme-gallery.mjs) requires exactly one `RecoveredAppShellController`; lines 380-410 bind assertions/waits to it. Lines 598-626 reassert the exact controller state after each settle window and after action gestures, immediately before screenshots. Zero/one/multiple-controller cases pass at `tests/capture-readme-gallery.test.mjs:157-182`. |
| P2 Classic-ready alt text | **RESOLVED** | Raw English/Vietnamese records say one strawberry at [`reference/case-study-publication-manifest.json:1468`](../../../reference/case-study-publication-manifest.json); the derivative copies match at lines 1887-1888. |
| P3 context/browser/server cleanup | **RESOLVED** | [`scripts/capture-readme-gallery.mjs:723`](../../../scripts/capture-readme-gallery.mjs) preserves the primary capture error, attempts all three cleanup operations independently, and reports aggregate cleanup failure when the capture itself succeeded. |

### Remaining Finding

#### [P3] CDP detach failure can replace the original input failure

- Evidence: [`scripts/capture-readme-gallery.mjs:412`](../../../scripts/capture-readme-gallery.mjs) and line 451 create CDP sessions, then unconditionally `await session.detach()` in `finally` at lines 446-448 and 482-484. If a preceding `session.send()` rejects and `detach()` also rejects, JavaScript propagates the detach failure instead of the original input failure. The six focused tests do not exercise this dual-failure path.
- Impact: capture still fails closed and outer cleanup still runs, but the diagnostic can report teardown rather than the input failure that caused the run to abort.
- Fix: retain the primary dispatch error and suppress or attach the detach error when one already exists; add a dual-failure unit test.
- Severity: P3, non-blocking.

### Immutable Artifact and Contract Checks

- Capture manifest remains `c4a04db76fff13f539b106ff5e7b6e3b86efe3001bf5ecb68a3ba3c63d6ae5e9`.
- Report/display hashes remain exact pairs:
  - Mode Select: `da0383da6b768bf049ea93840f22d1566c0883094724e9db89bc304257c4b75e`.
  - Classic ready: `0b57f56e22b17eb11bfbb31ae56386c81293cf5dd8bfaad7fc69137755ca39b6`.
  - Classic action: `2af52d4d647e402a30fa569d15a5097c3af680c7cbc38cde8a4365b36e37dbe0`.
- No capture PNG was regenerated and no registered media hash drifted.
- `release/public-release-variant-manifest.json` has no diff, hashes to `eadf75a39d0d7eb6ee9451718e13452586ffc42683ef6a38534d96a776a1daa6`, and remains `blocked`.
- `README.md` has no diff.

### Final Verdict

No P0-P2 findings remain. Phase 1 may proceed to Phase 2 with the P3 diagnostic issue tracked as a non-blocking follow-up.

Status: DONE_WITH_CONCERNS
Summary: All prior P1/P2 blockers and the main P3 cleanup defect are resolved and freshly verified; accepted PNGs, README, and the blocked commercial manifest remain unchanged.
Concerns/Blockers: No landing blocker. One P3 dual-failure diagnostic edge remains in CDP session detach.

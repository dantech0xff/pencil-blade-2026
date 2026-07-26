# Phase 1 manifestVersion mismatch investigation

## Executive Summary
- Issue: `tests/generate-case-study-data.test.mjs` fails because it expects `manifestVersion` `1.2.0` while the reviewed manifest now says `1.3.0`.
- Impact: 1 focused test red; loader/validator behavior unchanged.
- Root cause: stale hardcoded expectation in the test, not a loader or media-schema regression.
- Status: confirmed
- Fix: change [tests/generate-case-study-data.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/generate-case-study-data.test.mjs:140) from `1.2.0` to `1.3.0`.

## Timeline
- 2026-07-26 08:44:18 +0700: `reference/case-study-publication-manifest.json` introduced at `manifestVersion` `1.2.0` in commit `5f9b2bc`.
- 2026-07-26 08:44:38 +0700: `tests/generate-case-study-data.test.mjs` added in commit `d60c89f`; line 140 asserted `1.2.0`.
- 2026-07-26 13:07:48 +0700: commit `10851ab` changed `releaseInputs` structure in the publication manifest but kept `manifestVersion` at `1.2.0`.
- 2026-07-26 current workspace: [reference/case-study-publication-manifest.json](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/reference/case-study-publication-manifest.json:4) changed to `1.3.0` and added three new README runtime captures plus three exact-byte derivatives at lines 1431-1506 and 1850-1915.
- 2026-07-26 current workspace: [reference/case-study-academic-display-decision.json](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/reference/case-study-academic-display-decision.json:3) advanced to new decision ID/date/version and expanded scope for the README runtime gallery at lines 65-90.
- 2026-07-26 17:37:25 +0700: `node --test tests/generate-case-study-data.test.mjs` reproduced exactly one failure at [tests/generate-case-study-data.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/generate-case-study-data.test.mjs:140): actual `1.3.0`, expected `1.2.0`.

## Hypotheses

### H1. New media records require a new loader/schema contract
Rejected.

Evidence:
- [scripts/generate-case-study-data.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/generate-case-study-data.mjs:318) returns the manifest after validation only; it does not branch on `manifestVersion`.
- [scripts/validate-case-study-publication.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/validate-case-study-publication.mjs:494) validates media by required fields/locales/transform history only; no version gate.
- The added README records reuse existing shapes and existing kinds: `runtime-capture` and `runtime-display-derivative` were already present before this workspace change. The diff is additive inventory, not new schema.

Conclusion:
- `1.3.0` is not required by code to make the new media records valid.

### H2. `manifestVersion` bump is accidental and should be reverted to `1.2.0`
Rejected as primary fix.

Evidence:
- The workspace change is not a trivial typo. It adds six media records, updates social asset hashes, and expands the paired academic display decision to a new dated/versioned reviewed scope.
- [reference/case-study-academic-display-decision.json](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/reference/case-study-academic-display-decision.json:4) moved from `1.0.0` to `1.1.0` specifically because scope expanded on 2026-07-26. The publication manifest changed in the same review window.
- Reverting only manifest line 4 would make the manifest content materially different while still advertising the old revision identifier.

Conclusion:
- Evidence supports `1.3.0` as an intentional reviewed manifest revision marker, even if not technically required by schema.

### H3. The test is stale
Confirmed.

Evidence:
- Only one repo location still asserts `1.2.0`: [tests/generate-case-study-data.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/generate-case-study-data.test.mjs:140).
- The current manifest value is `1.3.0` at [reference/case-study-publication-manifest.json](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/reference/case-study-publication-manifest.json:4).
- Narrow repro shows the exact mismatch and no secondary failure.

## Root Cause
The Phase 1 failure is caused by a stale literal in the test. The publication manifest was revised from `1.2.0` to `1.3.0` during the README runtime-media registration work, alongside expanded academic-display approval and six additive media records. Loader and validator code accept the manifest unchanged; only the test still pins the old revision string.

## Recommendation

### Immediate (P0)
- Edit [tests/generate-case-study-data.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/generate-case-study-data.test.mjs:140): change `assert.equal(loaded.manifestVersion, '1.2.0');` to `assert.equal(loaded.manifestVersion, '1.3.0');`

Why this is the minimal correct fix:
- 1 line
- restores the focused test
- preserves the reviewed manifest revision already recorded in the workspace
- avoids emitting an older version identifier for materially newer publication content

### Short-term (P1)
- Document `manifestVersion` policy. Today the repo does not state whether it tracks schema, reviewed content revision, or both. That ambiguity caused this drift.

## Risks
- Low if test is updated: no behavior change, only expectation sync.
- Medium if manifest is reverted instead: downstream release metadata generated from `publication.manifestVersion` would lose the explicit 2026-07-26 content revision signal.

## Supporting Evidence
- Repro command: `node --test tests/generate-case-study-data.test.mjs`
- Repro result: 8 pass, 1 fail, failing subtest at `tests/generate-case-study-data.test.mjs:140`
- Loader path: `scripts/generate-case-study-data.mjs:300-320`
- Media validation path: `scripts/validate-case-study-publication.mjs:494-531`
- Current manifest version: `reference/case-study-publication-manifest.json:4`
- Current expanded academic decision: `reference/case-study-academic-display-decision.json:3-12,65-90`

## Unresolved Questions
- None blocking. Non-blocking follow-up: define whether future `manifestVersion` bumps are schema-only or reviewed-content revisions.

Status: DONE
Summary: Root cause is a stale test literal at `tests/generate-case-study-data.test.mjs:140`; update expected `manifestVersion` to `1.3.0`.
Concerns/Blockers: Versioning policy is implicit, not documented, but it does not block the Phase 1 fix.

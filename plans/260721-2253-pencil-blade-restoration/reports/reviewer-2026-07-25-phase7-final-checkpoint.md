---
type: reviewer
date: 2026-07-25
status: complete-with-concerns
scope: phase-07-final-checkpoint
---

# Phase 07 Final Checkpoint Code Review

## Findings by Severity

### P0 / Critical

None.

### P1 / High

None.

### P2 / Medium

None.

### P3 / Low

None.

Severity counts: **P0 `0`; P1 `0`; P2 `0`; P3 `0`.**

## Code Review Summary

### Overall Assessment

**PASS — repository-controlled technical checkpoint only.** The current tree closes all four
findings from the prior failed review and the later Web ASI, loop-scope, unbraced-statement, and
`if`/`else` false-positive regressions. Fresh reviewer validation found no remaining P0-P3
implementation defect in the accepted Phase 07 boundary.

This is not public-release approval. The live rights gate remains blocked, the reviewed workflow
is not present on remote `main`, required GitHub infrastructure is absent, the local Creator
bundle fails strict signature verification, and runtime/fidelity acceptance remains open. Those
external gates are separated below and Phase 07 remains **in progress**.

### Scope

- Focus: final whole-checkpoint review of release scripts/tests, workflow, build configs,
  manifests, Phase 07 release docs/reports, and the current gameplay iterable remediation.
- Candidate footprint: `80` paths (`48` tracked modifications and `32` untracked files).
- Tracked worktree diff: `983` additions and `309` deletions.
- Untracked candidate LOC: `9,801` lines.
- Scout findings: affected gameplay dependents, collection mutation/order boundaries, release
  authorization transitions, malformed ABI metadata, Web alias/ASI/control-flow boundaries,
  artifact symlink/traversal limits, loopback behavior, and remote deployment prerequisites were
  all traced before the final quality pass.

## Historical Remediation Trace

| Prior issue | Current implementation evidence | Fresh verification | Status |
|---|---|---|---|
| P1 pending release exceptions ignored | `scripts/verify-release-rights.mjs:51,109-179` requires both ledgers, rejects any non-empty pending list, validates stable IDs and complete approved-exception evidence | `tests/verify-release-rights.test.mjs:102-232`; live repository gate returns `BLOCKED`, including `releaseExceptions.pending must be empty before public release` | CLOSED |
| P1 indirect off-origin Web alias bypass | `scripts/audit-web-build.mjs:543-624` resolves supported sink values; lines `629-735` retain ASI line-break state; lines `999-1108` delimit braced/unbraced loop bodies and nested `if`/`else` statements | `tests/audit-web-build.test.mjs:200-318`; `tests/verify-web-mobile-build.test.mjs:165-287`; independent exact-source probes `4/4` | CLOSED |
| P1 arm64 substring check accepted extra ABIs | `scripts/build-android-debug.sh:774-803` accepts exactly one `native-code:` line containing exactly one quoted `arm64-v8a` token | `tests/build-android-debug-script.test.mjs:329-373` rejects extra, missing, duplicate, malformed, unquoted, and lookalike values before artifact commit | CLOSED |
| P2 impossible approval dates accepted | `scripts/verify-release-rights.mjs:201-225` round-trips year/month/day through UTC instead of relying on normalized parsing | `tests/verify-release-rights.test.mjs:235-265` rejects invalid month/day and non-leap dates while accepting `2028-02-29` on every approval surface | CLOSED |
| Earlier Android signer subject-name spoof | `scripts/build-android-debug.sh:153-184,807-860` derives trusted debug-keystore certificate digests and requires exactly one APK signer with one matching SHA-256 digest | Full release suite covers spoofed DN, signer count/digest, missing/malformed metadata, and trusted-keystore failures | CLOSED |
| Final Web follow-ups: semicolonless declarations, loop-head shadowing, unbraced bodies, dangling `else` | Token line-break state and recursive statement-end discovery now keep lexical scope active for the exact JavaScript statement only | Exact probes recover all three unsafe outer endpoints and preserve the expected single relative endpoint for the loop/`if`/`else` documentation case | CLOSED |

## Acceptance Matrix

| Area | Result | Evidence / boundary |
|---|---|---|
| Exact target configs | PASS | Android debug and Web Mobile configs pin the accepted package, SDK/toolchain, `arm64-v8a`, portrait scene, production Web target, and Pages prefix without credentials or machine-local user paths. |
| Gameplay iterable remediation | PASS | Eighteen production files replace unsafe Set/Map iterator spreads with `Array.from` snapshots. This preserves insertion order, fresh-snapshot mutation isolation, exported shapes, and asymptotic cost. |
| Gameplay contracts | PASS | Changed suites `214/214`; additional affected-dependent suites `56/56`; strict Creator TypeScript has zero diagnostics. |
| Iterable compatibility gate | PASS | Current project audit: 166 array spreads, 29 call spreads, no unsafe operand, no compiler diagnostic, TypeScript `5.8.2`. |
| Android wrapper certification | PASS | Exact ABI and signer regressions are negatively covered. Current artifact SHA-256 matches its sibling record, ZIP layout contains only `lib/arm64-v8a/libcocos.so`, and the prohibited-runtime static audit passes. No artifact rebuild or APK/native execution was performed in this review. |
| Private Web artifact | PASS | Static audit passes; verifier serves `2539` files at `/pencil-blade-2026/`; direct unsafe/allowed resolver probes pass. |
| Web performance and arbitrary-execution boundary | PASS | File traversal is capped at 50,000 files, 256 MiB/file, and 1 GiB total; static analysis has explicit token/binding/depth/string/property limits; prefix checks run at concurrency 16. Source review found no `eval`, `Function`, or `node:vm` execution path in the audits. |
| Workflow definition | PASS LOCALLY | Manual `main` only, no PR trigger, least-privilege job permissions, bounded timeouts, serialized deploys, rights gate before build/upload, audit before upload, and separate deploy permissions. Remote availability/protection is an external gate. |
| Rights authorization behavior | PASS FAIL-CLOSED | An otherwise approved manifest with a live pending exception is rejected. The live repository manifest remains blocked for the expected missing approvals/evidence plus its pending font decision. |
| Documentation/report claims | PASS | Release docs separate configured/tested/built/audited/published states, retain the historical artifact facts, and keep Pages, runtime matrix, canonical denominator, rights, and `>=99%` fidelity unproven. Dated `2026-07-24` evidence remains historical rather than being presented as a fresh run. |
| Repository boundary | PASS | Generated `game/build/` and `game/native/` outputs are ignored; neither path has tracked files. Candidate release files contain no credential/private-key finding. No original application artifact or native payload was executed. |

## Edge Cases Found by Scout

- Collection mutation: `Array.from` retains the old spread operation's one-time snapshot, so
  deletions during cleanup and additions during ray-query completion cannot perturb the current
  pass. Insertion-order and mutation behavior is exercised directly.
- Web ASI/scope: semicolonless `const`, braced and unbraced `for` heads, nested `if`/`else`,
  aliases, object properties, templates, XHR, workers, dynamic imports, navigation, and
  documentation-only URLs were all included in positive/negative checks.
- Input shape: extra/missing/duplicate/malformed ABI lines, spoofed signer names, missing or
  malformed signer metadata, invalid dates, duplicate exception IDs, unsafe/missing/symlink
  evidence, build-tree symlinks/traversal, unsupported file types, and post-audit file mutation
  fail closed.
- False positives: the supported relative-alias fixture remains under the Pages prefix and
  reports zero off-origin requests; the nested loop/`if`/`else` documentation case resolves only
  its intended local asset.
- Concurrency/bounds: gameplay snapshots isolate same-callback mutation, the workflow serializes
  Pages deployments, the verifier caps concurrent requests at 16, and supported build entry
  points retain a serial contract.

## Production-Readiness Checklist

| Check | Result |
|---|---|
| Concurrency / shared mutable state | PASS within accepted serial-build contract; snapshot mutation behavior and verifier request concurrency are bounded. |
| Error boundaries | PASS; release CLIs fail nonzero, Web server cleanup is in `finally`, gameplay cleanup failures retain or propagate ownership according to existing tests, and no new catch-and-swallow path was introduced. |
| API contracts / backwards compatibility | PASS; no exported gameplay signature, collection shape, nullability, package ID, Pages prefix, or target contract changed. |
| External input validation | PASS for the reviewed boundaries; strict dates, exceptions, signer/ABI metadata, repository-relative evidence, build-root containment, symlinks, routes, MIME types, and content hashes are checked. |
| Auth / authorization | PASS in code; manual-main dispatch, job-level permissions, release approval records, and pending exceptions are enforced. Remote branch/environment/runner controls remain externally absent. |
| N+1 / query efficiency | Not applicable; no database or remote-query loop is in scope. File and HTTP loops are explicitly bounded. |
| Data exposure | PASS in current artifact/source; no off-origin sink was found, machine-local paths are prohibited from Web output, and no secret/private-key finding was found in candidate release material. |
| Plan fact-check | PASS; paths, symbols, ordering, target values, artifact claims, checked items, and open gates were verified against current source, tests, artifacts, reports, and read-only GitHub state. |

## Fresh Validation

| Check | Result |
|---|---|
| `node --test tests/*.mjs` | `182/182` PASS |
| Changed gameplay suites | `214/214` PASS |
| Additional gameplay dependents | `56/56` PASS |
| Direct Web endpoint probes | `4/4` PASS |
| Creator strict TypeScript | exit `0`, zero diagnostics |
| Creator iterable-spread audit | PASS; 166 array / 29 call spreads; zero findings |
| Real private Web tree audit | PASS |
| Real Pages-prefix verifier | PASS; `2539` files |
| Current Android artifact static audit/hash/ZIP layout | PASS |
| Reconstruction policy positive/negative | PASS; negative suite `4/4` |
| JSON parse | `5/5` PASS |
| Docs links | 11 files; 88 internal links valid |
| Shell syntax / diff hygiene | PASS |
| Public rights gate | expected `BLOCKED` |

The independent tester checkpoint records the broader current corpus as `1749/1749` PASS,
including actual APK package/signature metadata checks. This review did not rerun the full
Creator build or execute an original/recovered APK.

## External Gates — Not Code Findings

Fresh read-only checks on 2026-07-25 confirm:

- repository visibility is `PUBLIC`, default branch `main`;
- Pages API returns `404`;
- repository Actions runners: `0`;
- repository environments: `0`;
- `main` branch protection: absent;
- the reviewed Pages workflow is absent from remote `main`;
- local Creator `3.8.8` strict code-signature verification fails;
- the public rights manifest remains blocked, including the pending
  `Fonts/CooperBlackStd.otf` treatment;
- no public Pages deployment or production-URL verification exists;
- Android runtime-device coverage and the frozen H5 browser/version matrix remain unproven;
- canonical denominator closure and the final cross-domain `>=99%` fidelity score remain open.

None of these gates authorizes weakening the current fail-closed workflow or rights verifier.

## Metrics

- Reviewer Node cases: `452/452` PASS across release, changed-gameplay, and affected-dependent
  commands; direct Web probes: `4/4`.
- Independent full Node checkpoint: `1749/1749` PASS.
- Type coverage: not instrumented; strict TypeScript reports zero diagnostics.
- Test coverage: not instrumented.
- Linting issues: no dedicated linter configured; `git diff --check` and shell syntax report
  zero issues. `shellcheck` is unavailable in the review environment.
- Severity: P0 `0`; P1 `0`; P2 `0`; P3 `0`.

## Recommended Actions and Plan Follow-ups

1. Accept the four prior remediation items and final Web follow-ups as technically closed.
2. Keep Phase 07 **in progress** and do not publish while the live rights gate is blocked.
3. Before registering a self-hosted Creator runner, protect `main`; then configure the
   `github-pages` environment and Pages source, and use a Creator installation that passes the
   strict signature preflight.
4. Land/version the reviewed configs, workflow, manifests, scripts, tests, docs, and reports
   through the normal lead-controlled process before attempting remote dispatch.
5. Preserve the unchecked plan items for runtime/device/browser validation, canonical
   denominator closure, residual reconciliation, public rights, and the `>=99%` fidelity score.

At review time, the build configs and workflow are still untracked checkpoint candidates. The
plan's checked “versioned” item is therefore contingent on the lead-controlled checkpoint commit
succeeding. Runner, Pages, environment, runtime, rights, denominator, and fidelity items remain
unchecked; the local audit and output-format items remain supported by fresh evidence. No plan
file or task state was changed by this review.

Docs impact: none beyond this checkpoint report. Existing release docs already state the current
technical and external boundaries accurately.

## Unresolved Questions

- What authorized release treatment will be recorded for `Fonts/CooperBlackStd.otf`?
- What canonical denominator and weighting will govern the final fidelity score?
- Which Android devices and H5 browser/version rows will become the supported runtime matrix?
- When will branch protection, the signed Creator runner, Pages, and the deployment environment
  be provisioned after rights approval?

Status: DONE_WITH_CONCERNS
Summary: The final repository-controlled Phase 07 technical checkpoint passes with P0/P1/P2/P3 all zero; all four prior findings, Android signer hardening, and final Web ASI/control-flow regressions are closed by current code and fresh tests.
Concerns/Blockers: Public rights, the pending font decision, remote workflow/infrastructure, valid Creator signature, runtime matrices, canonical denominator, and final `>=99%` fidelity remain external blockers; Phase 07 stays in progress.

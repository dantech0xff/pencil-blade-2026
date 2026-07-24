# About / Offline Integration Code Review

## Code Review Summary

### Findings

No open P0–P2 findings remain in the reviewed checkpoint.

#### Resolved during review — pre-suspension replacement rollback

The initial review found that `RecoveredAppShellController` replaces the screen before suspending
Main Menu (`game/assets/scripts/creator/recovered-app-shell-controller.ts:875-892`) and then
requires source rearm during compensation (`:2812-2838`). The real shared-scene implementation can
restore the original root and still throw (`game/assets/scripts/creator/shared-game-scene-presenter.ts:103-140`).
Main Menu previously rejected rearm while already active, idle, and unsuspended, which converted a
recoverable replacement error into fatal cleanup.

That mismatch was fixed before this report was finalized. Main Menu now rejects detached or
inactive ownership but treats an attached, active, idle, unsuspended source as already rearmed
without mutating the input lease (`game/assets/scripts/creator/main-menu-presenter.ts:536-573`).
The focused real-presenter regression at
`tests/reconstruction/vertical-slice/main-menu-presenter.test.ts:367-385` proves that the call
returns `true`, preserves idle/unsuspended state, and emits no BladeInput operations. The shell's
replacement-failure matrix continues to prove destination disposal, retained source ownership,
non-fatal state, and one failure report. Fresh focused tests and strict TypeScript both pass after
the correction.

### Scope

- Focus: pending About/offline checkpoint, two-pass critical then informational review.
- Production files: `about-resource-contract.ts`, `about-presentation.ts`,
  `about-resource-loader.ts`, `about-presenter.ts`, `main-menu-presenter.ts`,
  `recovered-app-shell-controller.ts`, and `recovered-app-viewport.ts`.
- Test files: the four `about-*.test.ts` suites plus `main-menu-presenter.test.ts`,
  `recovered-app-shell-controller.test.ts`, and `recovered-app-viewport.test.ts`.
- Scouted dependency: `shared-game-scene-presenter.ts`.
- Size inspected: 17,112 lines across the 14 checkpoint files, plus the 234-line shared-scene
  dependency.
- Scout focus: affected dependents, route transaction ordering, rollback/fatal ownership,
  lifecycle cleanup, Back/audio behavior, offline trust boundaries, and test doubles.

### Overall Assessment

Review-pass for the About/offline code checkpoint. The implementation matches the recovered
resource, presentation, input, audio, transaction, and local/offline boundaries inspected here,
including the corrected pre-suspension rollback contract.

The exact ten-raster profile and native child order are asserted against the imported resources;
the heart pulse remains a test-only fixture; `localCompatibilityAvailable` is wired as `false`;
and About's review, email, and like actions terminate in fixed local events. No About path reaches
currency, save, network, URI, JNI/platform, advertising, or music-control ports.

### Critical Issues

- P0: none found.

### High Priority

- P1: none open. The rollback-contract defect found during review was fixed and reverified.

### Medium Priority

- P2: none found.

### Edge Cases Found by Scout

- A replacement failure before Main Menu suspension restores or preserves the source but the
  source must accept idempotent rearm. This was the resolved defect described above.
- Reverse About → Main Menu ownership recovery, stale and reentrant route guards, keyboard Back,
  post-commit audio failure, listener teardown, pause/resume pulse behavior, and retired-action
  observer failures were checked; no additional P0–P2 issue was found.

### Behavioral Checklist

- Concurrency: synchronous route reentrancy and asynchronous resource boot ordering checked.
- Error boundaries: the discovered propagation/compensation mismatch is fixed; About observer and
  post-commit audio errors otherwise remain contained or explicitly propagated.
- API contracts: presenter lifecycle, shared-scene replacement, route transaction, settings, and
  audio contracts checked, including the corrected idempotent Main Menu rearm behavior.
- Backwards compatibility: no exported contract or schema break found in the checkpoint.
- Input validation: transaction identity/timing/z-order, local retired-event payloads, and resource
  profiles checked at their boundaries.
- Auth/authz: not applicable to this local read-only screen; no sensitive operation is reachable.
- N+1/query efficiency: not applicable; the implementation performs no database or network query.
- Data leaks: no PII, secret, internal stack trace, network, JNI, URI, or ad path found.
- Plan fact-check: Phase 6 still marks About and retired-service offline behavior open; paths,
  symbols, and claimed behavior were verified against source rather than inferred from plan text.

### Recommended Actions

1. Accept the About/offline code checkpoint; the discovered rollback defect is fixed and verified.
2. Keep broader Phase 6 content reconciliation and release-rights clearance open; they are outside
   this code checkpoint.

### Verification

- Focused Node test run after the rollback fix: 169 passed, 0 failed, skipped, cancelled, or todo.
- Creator TypeScript: `tsc --noEmit --pretty false -p game/tsconfig.json` passed with zero
  diagnostics.
- Patch hygiene: `git diff --check` passed after the production fix; the untracked report was
  checked separately for trailing whitespace.
- Static-only constraint respected: no APK, shared object, device, network, or runtime-native
  execution was performed.

### Metrics

- Type coverage: no instrumented percentage configured; strict checkpoint compilation has zero
  diagnostics.
- Test coverage: no instrumented percentage configured; 169/169 focused tests pass.
- Linting issues: no separate lint gate was available in scope; `git diff --check` reported zero
  whitespace errors.

### Plan Follow-ups

The About-specific resource, presentation, presenter, local retired-action, and shell-host work
appears implemented and review-passed. The lead can mark the narrow About/offline checkpoint
complete. The phase-level `Full content/cosmetics`, `Remaining menu/settings/results fidelity,
including About`, and `Offline behavior for retired services` tasks cover broader non-About scope
and should remain open until that scope is separately reconciled.

### Unresolved Questions

- Do the exact About bitmap and baked-in copy have release approval? The implementation correctly
  preserves the requested recovered surface, but source inspection cannot establish usage rights
  or approve obsolete baked identities for publication.

Status: DONE
Summary: No open P0–P2 findings remain; the rollback mismatch found during review was fixed, and 169 focused tests plus strict TypeScript pass.
Concerns/Blockers: No code blocker for this checkpoint; exact bitmap rights and baked copy remain an external release decision.

# Options Runtime Production Review

## Code Review Summary

### Scope

- Files: Options domain/presenters/resources/tests; Settings, audio, Main Menu, recovered shell, and viewport integration
- Focus: current uncommitted Options checkpoint, including the three previously corrected failure paths
- Review mode: static production-readiness review; original APK runtime comparison was unavailable by constraint
- Spec source: `plan.md`, `phase-06-recreate-full-game-content-and-progression.md`, and existing Options research/explorer reports
- Repository note: root `README.md` and the requested `phase-06-restore-menu-progression-and-resource-coverage.md` path do not exist

### Overall Assessment

**BLOCKED — one P1 lifecycle/persistence defect.** The Options implementation passes its focused checks, but an app-hide checkpoint can persist an unpaid cosmetic selection before Options Back performs its ownership rollback.

Pre-landing two-pass result: 1 blocking issue; 0 additional informational findings.

### Critical Issues

None at P0.

### High Priority

#### [P1] App hide persists unpaid background/blade selections

Selecting a background or blade updates shared Settings immediately, including when its configured price is non-zero:

- `game/assets/scripts/creator/options-presenter.ts:774`
- `game/assets/scripts/creator/options-presenter.ts:790`
- `game/assets/scripts/creator/options-presenter.ts:824`

Ownership reconciliation currently runs only through Options Back:

- `game/assets/scripts/creator/options-presenter.ts:943`
- `game/assets/scripts/creator/options-presenter.ts:989`

The shell independently saves Settings on every app-hide event:

- `game/assets/scripts/creator/recovered-app-shell-controller.ts:2420`

Settings serialization writes the selected background and blade:

- `game/assets/scripts/domain/classic-settings-state.ts:633`

Production failure sequence:

1. Enter Options and select an unowned background or blade.
2. Hide/lock/background the app before pressing Back.
3. Shell saves the still-unreconciled selection.
4. Process is killed while hidden.
5. Next boot loads and applies the persisted unpaid cosmetic.

Impact: entitlement/progression bypass across a normal mobile lifecycle boundary.

Required fix: reconcile the active Options selection before the shell hide-save checkpoint, preserving the established background-8 compatibility rule and retained theme behavior. Do not write a save if reconciliation fails. Add an executable hide/restart-equivalent regression test with an unowned selection. The current shell test at `tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts:2719` only proves that a save call exists; Back-path tests do not exercise app hide.

### Medium Priority

None.

### Low Priority

None.

### Edge Cases and Prior Fix Verification

- Exact sibling rollback: closed. Failed navigation restores and verifies the prior parent and sibling index (`options-presenter.ts:952`, `options-presenter.ts:1387`; regression at `options-presenter.test.ts:656`).
- Partial listener registration: closed. Global, Buy, and item-selector cleanup removes every possibly registered callback even after mid-registration failure (`options-presenter.ts:1071`, `options-presenter.ts:1130`, `options-item-selector-presenter.ts:179`; focused failure tests pass).
- Failed purchase-burst attachment: closed. The failed burst is disposed while the already committed purchase remains reflected (`options-presenter.ts:892`; regression at `options-presenter.test.ts:494`).
- Concurrency/ordering: the blocking hide-save ordering defect above is the material race-like lifecycle path.
- Error boundaries/API contracts: reviewed across Options attach, navigation, listeners, purchase effects, and shell save integration; no additional blocker found.
- Input/auth/query/data exposure: local trusted game configuration and local settings only; no remote auth, database query, PII, or secret boundary exists in this scope.

### Recommended Actions

1. Block landing until app-hide reconciliation is implemented.
2. Add the unowned-selection hide/restart regression test.
3. Re-run the focused suite and strict Cocos TypeScript compile.

### Verification

- Focused Node test run: **140/140 passed**
- Cocos-bundled strict TypeScript compile: **passed**, no diagnostics
- `git diff --check HEAD`: **passed**
- Options resource contract: exact required raster/audio/font checks passed
- Original APK runtime: not run, per review constraint

### Metrics

- Type coverage: percentage unavailable; strict project compile passed
- Test coverage: percentage unavailable; 140 relevant tests passed
- Linting issues: no dedicated lint run configured for this checkpoint; diff whitespace check passed

### Plan Follow-up

The Options implementation and the three requested corrective paths appear complete. The checkpoint is not production-ready until lifecycle persistence applies the same unpaid-selection invariant as Options Back.

### Unresolved Questions

None.

## Resolution

The P1 finding is fixed. `OptionsPresenter.reconcileSelectionsForPersistence()` now applies
the compensated unowned background/blade rollback without navigation, audio, purchase, or
coin mutation. `RecoveredAppShellController` calls it before the app-hide save; failure
suppresses the save and leaves reconciliation retryable. Executable tests cover unpaid,
owned, theme, background-index-`8`, idempotent, reconciliation-failure, retry, and
save-failure paths.

Follow-up review found no remaining P0, P1, or P2 issue. Final gates passed:

- focused Options/Settings/Main Menu/shell/audio tests: `143/143`
- full vertical slice: `1212/1212`
- resource/build/catalog tests: `43/43`
- Cocos Creator 3.8.8 strict TypeScript and diff hygiene

Final assessment: **READY for the Options checkpoint.**

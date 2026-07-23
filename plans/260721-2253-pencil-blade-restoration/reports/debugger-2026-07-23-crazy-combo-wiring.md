# Crazy + Shared ComboItem Wiring Investigation

## Executive Summary
- **Issue:** Read-only diagnostic for Crazy mode's shared `ComboItem` and objective popup wiring, including prep, active play, Pause Replay, Pause Quit, Time-Up -> Result, Result Retry, and shell Main Menu return.
- **Impact:** No blocking runtime wiring fault proven in current workspace. Shared `GroBold` combo font is prepared before every observed ComboItem construction path. ComboItem ownership is retired/drained correctly across Crazy lifecycle seams. Objective processing and popup creation stay live across Result replacement.
- **Root cause:** No crash/root-cause found. One latent contract concern remains: Crazy emits combo gameplay commands before applying them, while Classic emits the same family after applying them.
- **Status:** Verified read-only on 2026-07-23 against source plus focused tests.
- **Fix:** None applied. Recommend aligning Crazy combo event timing with Classic, or document the divergence if event consumers are intentionally pre-commit in Crazy.

## Scope And Evidence
- Files read:
  - `game/assets/scripts/domain/combo-item-presentation.ts`
  - `game/assets/scripts/creator/combo-item-presenter.ts`
  - `game/assets/scripts/creator/classic-resource-loader.ts`
  - `game/assets/scripts/creator/classic-gameplay-controller.ts`
  - `game/assets/scripts/creator/crazy-gameplay-controller.ts`
  - `game/assets/scripts/domain/objectives-manager-state.ts`
  - `game/assets/scripts/creator/objective-achievement-presenter.ts`
  - `game/assets/scripts/creator/crazy-scene-controller.ts`
  - `game/assets/scripts/creator/recovered-app-shell-controller.ts`
  - Related vertical-slice tests
- Verification commands:
  - `node --test tests/reconstruction/vertical-slice/combo-item-presentation.test.ts tests/reconstruction/vertical-slice/combo-item-presenter.test.ts tests/reconstruction/vertical-slice/objectives-manager-state.test.ts tests/reconstruction/vertical-slice/objective-achievement-presenter.test.ts tests/reconstruction/vertical-slice/classic-resource-contract.test.ts tests/reconstruction/vertical-slice/crazy-gameplay-controller.test.ts`
  - `node --test tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts`
- Result:
  - `60/60` tests passed in the first batch.
  - `14/14` tests passed in the shell batch.

## Investigation Timeline
- 2026-07-23: Confirmed repo context from `docs/codebase-summary.md` and plan.
- 2026-07-23: Checked recent/worktree changes. Current uncommitted delta is in `classic-resource-loader.ts`, `classic-gameplay-controller.ts`, `recovered-app-shell-controller.ts`, and `classic-resource-contract.test.ts`.
- 2026-07-23: Traced shared combo font load path and Crazy prep dependency on Classic prep.
- 2026-07-23: Traced `create-combo-item` -> attach -> update -> dispose in Classic and Crazy.
- 2026-07-23: Traced Crazy objective `process-objective` -> `ObjectivesManagerState.processGameEvent()` -> popup callback -> `ObjectiveAchievementPresenter`.
- 2026-07-23: Traced Pause Replay, Pause Quit, Time-Up Finish, Result Retry, Result Menu, and shell Main Menu transitions.
- 2026-07-23: Ran focused vertical-slice tests and shell tests. No failing evidence reproduced.

## Hypotheses

### Hypothesis 1
Shared combo font/resource could be unavailable in Crazy at runtime, especially on first Crazy entry or replay/retry.

**Test**
- Checked Classic catalog load order and combo font load.
- Checked Crazy prep dependency on Classic prep.
- Checked Crazy combo construction callsites.

**Evidence**
- Classic catalog now loads `comboFont` alongside sprite frames, score font, and result fonts at [classic-resource-loader.ts:157](../../../../game/assets/scripts/creator/classic-resource-loader.ts#L157) and resolves `Fonts/GroBold.ttf` fail-closed at [classic-resource-loader.ts:318](../../../../game/assets/scripts/creator/classic-resource-loader.ts#L318).
- Crazy prep blocks on `await classic.prepareRecoveredRuntime()` and then captures `classic.sharedResourceCatalog` before loading Crazy supplements at [crazy-gameplay-controller.ts:621](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L621).
- App shell boot prepares Classic first, then starts Crazy prep opportunistically, isolated from menu/classic availability, at [recovered-app-shell-controller.ts:243](../../../../game/assets/scripts/creator/recovered-app-shell-controller.ts#L243).
- Classic combo creation uses `this.sharedResourceCatalog.comboFont` at [classic-gameplay-controller.ts:924](../../../../game/assets/scripts/creator/classic-gameplay-controller.ts#L924).
- Crazy combo creation uses `classic.sharedResourceCatalog.comboFont` at [crazy-gameplay-controller.ts:2398](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L2398).

**Result**
- Eliminated. No source path constructs a Crazy ComboItem before Classic prep exposes `comboFont`.

### Hypothesis 2
ComboItem presenters could leak or be left attached/orphaned across Pause Replay, Pause Quit, Time-Up -> Result, or Result Retry.

**Test**
- Traced presenter lifecycle and all Crazy cleanup seams.
- Checked retired-run drain path and shell transitions.

**Evidence**
- `ComboItemPresenter.attach()` requires a valid active parent and `dispose()` destroys label then owner, notifying exactly once, at [combo-item-presenter.ts:104](../../../../game/assets/scripts/creator/combo-item-presenter.ts#L104) and [combo-item-presenter.ts:152](../../../../game/assets/scripts/creator/combo-item-presenter.ts#L152).
- Crazy updates ComboItems only while gameplay remains attached, at [crazy-gameplay-controller.ts:435](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L435).
- Crazy combo presenters are part of captured run ownership and drained in `disposeCrazyModePresentation()` and `drainRetiredCrazyRunOwnership()`, at [crazy-gameplay-controller.ts:820](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L820) and [crazy-gameplay-controller.ts:1026](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L1026).
- Time-Up Finish is transactional in the scene owner and rolls back scene leases on failure at [crazy-scene-controller.ts:387](../../../../game/assets/scripts/creator/crazy-scene-controller.ts#L387).
- Shell Main Menu transitions for Crazy Pause Quit and Crazy Result enforce source-screen ownership and rollback detached roots if activation fails at [recovered-app-shell-controller.ts:620](../../../../game/assets/scripts/creator/recovered-app-shell-controller.ts#L620).

**Result**
- Eliminated for ComboItem ownership. I found no path that leaves ComboItems attached without either active-frame updates or explicit disposal/drain on the next cleanup boundary.

### Hypothesis 3
Crazy objective processing or popup ownership could break across Result replacement because popups are not children of the Crazy gameplay root.

**Test**
- Traced `process-objective` dispatch into `ObjectivesManagerState`.
- Traced popup callback target root creation and update/disposal behavior.

**Evidence**
- Crazy combo batch handles `process-objective` before ComboItem creation at [crazy-gameplay-controller.ts:2402](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L2402).
- Objective selector routing and terminal reward/popup logic live in `ObjectivesManagerState.processGameEvent()` at [objectives-manager-state.ts:321](../../../../game/assets/scripts/domain/objectives-manager-state.ts#L321).
- Crazy preparation creates a persistent `ObjectiveAchievementTargetRoot` under the controller node, not the ephemeral Crazy gameplay root, at [crazy-gameplay-controller.ts:679](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L679).
- Popup callback creates and attaches `ObjectiveAchievementPresenter` to that persistent target at [crazy-gameplay-controller.ts:1609](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L1609).
- Crazy updates objective presenters even when gameplay is not attached, before the early-return on detached gameplay, at [crazy-gameplay-controller.ts:435](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L435).

**Result**
- Eliminated as a fault. This seam is intentionally process-owned so banners survive Crazy-to-Result replacement. No missing target-root construction path found.

## Findings

### Finding 1
No blocking Crazy/shared-ComboItem runtime wiring fault was proven in the current workspace.

**Evidence**
- Shared combo font is prepared once in Classic and reused by Crazy.
- Crazy activation/replay/retry all require an empty host and transactional rollback.
- ComboItem presenter attachment/disposal is strict and idempotent.
- Focused tests covering combo, objectives, Crazy lifecycle, and shell transitions all pass.

### Finding 2
There is one verified contract divergence: Crazy emits combo gameplay commands before applying them; Classic emits after applying them.

**Evidence**
- Classic:
  - processes create/attach/score/audio first at [classic-gameplay-controller.ts:924](../../../../game/assets/scripts/creator/classic-gameplay-controller.ts#L924)
  - then emits commands at [classic-gameplay-controller.ts:962](../../../../game/assets/scripts/creator/classic-gameplay-controller.ts#L962)
- Crazy:
  - emits commands first at [crazy-gameplay-controller.ts:2398](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L2398)
  - then mutates objectives/score/UI in the same method.
- `rg` found no current in-repo consumer of `CRAZY_GAMEPLAY_COMMAND_EVENT`, so blast radius is latent today.

**Impact**
- If any future observer assumes gameplay-command events mean "state already committed", Classic and Crazy will disagree. That is a public-contract regression risk, not an active crash.

### Finding 3
Objective-achievement presenters are intentionally long-lived process owners, not per-run owners.

**Evidence**
- They are stored in `objectiveAchievementPresenters` and updated every frame at [crazy-gameplay-controller.ts:437](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L437).
- They are disposed only in Crazy preparation teardown at [crazy-gameplay-controller.ts:3282](../../../../game/assets/scripts/creator/crazy-gameplay-controller.ts#L3282).
- The presenter test explicitly encodes this: particle cleanup removes only emitters, banners persist until owner disposal.

**Impact**
- Not a checkpoint blocker. Max accumulation is bounded by objective completions, but these owners do stay resident longer than ComboItems.

## Lifecycle Trace

### ComboItem
- Pure plan:
  - `createComboItemPresentationPlan()` builds text/color/font-size/z=1 in `combo-item-presentation.ts`.
- Classic runtime:
  - `combo.update()` produces `create-combo-item` / `attach-combo-item`.
  - `ClassicGameplayController.applyComboCommands()` creates `ComboItemPresenter`, attaches it to `worldPresentationRoot`, updates it each frame, and disposes it on natural completion or mode teardown.
- Crazy runtime:
  - `this.requireCombo().update()` feeds `CrazyGameplayController.applyComboCommands()`.
  - Crazy creates `ComboItemPresenter` with Classic's shared `comboFont`, attaches it to Crazy `worldPresentationRoot`, updates it while gameplay is attached, and retires/drains it across replay/quit/result cleanup.

### Objective
- `process-objective` in Crazy combo batch calls `ObjectivesManagerState.processGameEvent()`.
- If a completion occurs, `popupAfterAdvance()` synchronously invokes `onObjectiveAchievement`.
- Crazy allocates `ObjectiveAchievementPresenter` against `ObjectiveAchievementTargetRoot`, not the ephemeral gameplay root.
- That target survives Result replacement and shell transitions until controller teardown.

## Recommendations

### Immediate (P1)
- Align combo gameplay-command timing between Classic and Crazy.
- Preferred direction: move Crazy `emitCommands(commands)` to the post-apply position used by Classic unless there is a documented need for pre-commit events.
- Effort: low.

### Short-term (P1)
- Add one test that asserts command-event timing semantics across both Classic and Crazy.
- Effort: low.

### Long-term (P2)
- If objective popups are expected to self-retire after their visible lifecycle, add an explicit completion/disposal seam and a bounded-owner test. If persistence is intentional, document that contract near `ObjectiveAchievementPresenter`.
- Effort: low-medium.

## Unresolved Questions
- Is `CRAZY_GAMEPLAY_COMMAND_EVENT` intentionally a pre-commit observer seam, or should it match Classic's post-commit semantics?
- Are persistent objective-achievement banners desired across the entire app-shell session, or only until their animation ends?

Status: DONE_WITH_CONCERNS
Summary: No blocking Crazy/shared-ComboItem wiring fault found; focused tests are green and resource/lifecycle seams are coherent. One latent contract concern remains: Crazy emits combo gameplay commands before applying them, unlike Classic.
Concerns/Blockers: Latent event-order divergence only; no active blocker reproduced.

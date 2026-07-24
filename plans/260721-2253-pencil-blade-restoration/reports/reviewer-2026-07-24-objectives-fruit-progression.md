## Code Review Summary

### Scope

- Focus: recent Objectives fruit-progression producers, persistence, popup failure boundaries, and popup lifetime.
- Production paths reviewed:
  - `game/assets/scripts/domain/objectives-manager-state.ts`
  - `game/assets/scripts/creator/classic-gameplay-controller.ts`
  - `game/assets/scripts/creator/crazy-gameplay-controller.ts`
  - `game/assets/scripts/creator/classic-bird-gameplay-controller.ts`
  - `game/assets/scripts/creator/combo-bird-gameplay-controller.ts`
  - `game/assets/scripts/creator/gn-style-gameplay-controller.ts`
  - `game/assets/scripts/creator/main-menu-fruit-presenter.ts`
  - `game/assets/scripts/creator/main-menu-presenter.ts`
  - `game/assets/scripts/creator/mode-select-rope-button-presenter.ts`
  - `game/assets/scripts/creator/mode-select-presenter.ts`
  - `game/assets/scripts/creator/objective-achievement-presenter.ts`
  - `game/assets/scripts/creator/objectives-screen-presenter.ts`
  - `game/assets/scripts/creator/recovered-app-shell-controller.ts`
- Tests reviewed: manager, all Fruit/FruitButton integration, Main Menu, Mode Select, Objectives screen, shell, Crazy result, and GN Style result tests.
- Fruit-progression diff size: 10 production files and 6 tests, approximately `+462/-4` including the new 191-line integration test.
- Scout result: every current `isFruit: true` ingress is accounted for. They are ordinary generated Fruit, generated special Fruit, Main Menu FruitButton, and Mode Select RopeButton/FruitButton. Dragon and bomb are `isFruit: false`; Options uses its item-selector path and has no fruit notification.
- Repository `README.md` is absent. Review rules came from `docs/code-standards.md`, `docs/system-architecture.md`, the phase plan, and the two Objectives research/architecture reports.

### Overall Assessment

Not production-ready. The happy-path progression contract is accurate and all selected checks pass, but two High-severity popup boundary/lifetime defects remain. Both can pass CI because the new cross-controller integration test checks source-text order rather than executing production callbacks under failure.

### Critical Issues

None found. Strict TypeScript currently passes.

### High Priority

#### H1 — A popup presentation exception splits one accepted Fruit cut after objective state commits

`ObjectivesManagerState.finish()` durably writes `-2`, awards coins, advances the process-owned current position, then synchronously calls the popup callback (`objectives-manager-state.ts:266-276,438-465`). The four real popup owners can throw while playing cheer audio, creating the presenter, attaching it, or rolling attachment back; each currently rethrows (`classic-gameplay-controller.ts:1846-1880`, `crazy-gameplay-controller.ts:1893-1929`, `combo-bird-gameplay-controller.ts:2891-2927`, `gn-style-gameplay-controller.ts:3019-3055`).

Every new gameplay Fruit path calls global progression first, performs the mode cut second, and performs per-type progression last. Representative examples are Classic at `classic-gameplay-controller.ts:908-928`, Crazy ordinary/special at `crazy-gameplay-controller.ts:2322-2359`, and Classic Bird ordinary/special at `classic-bird-gameplay-controller.ts:1304-1349`. Therefore, when selector `10` completes a global objective and popup construction throws:

- the Fruit entity has already accepted/finalized the cut;
- the objective value, reward, current position, and global fruit count may already be committed;
- the mode score/audio/presentation stage is skipped;
- the per-type selector is skipped;
- the exception escapes the Creator event callback.

The UI paths have the same partial-tail problem after their destination callback. Main Menu schedules navigation before the global call (`main-menu-fruit-presenter.ts:344-355`), while Mode Select schedules mode navigation first (`mode-select-rope-button-presenter.ts:541-551`). A popup exception can therefore leave navigation pending while the type objective was never attempted. The new latches prevent replay after explicit host rollback, but they cannot complete a tail that was aborted before the type call.

The standalone Skip path is also affected: the manager can commit before the callback throws, after which `ObjectivesScreenPresenter.requestSkip()` treats the error as uncertain ownership, disables input, inactivates the screen, and rethrows (`objectives-screen-presenter.ts:636-668,912-924`). That is a user-visible soft lock for a rendering/audio fault.

Narrow fix:

1. Make popup presentation a non-throwing observer boundary in the four `onObjectiveAchievement` owners listed above. Catch, transactionally dispose any partial presenter/target, report the rendering/audio failure through the controller's existing diagnostic channel, and return normally.
2. Do not catch every `processGlobalFruitCut()` error at Fruit call sites; preference/state failures are not equivalent to an optional presentation failure and must remain explicit.
3. Do not reorder global → mode → per-type and do not change result transaction semantics. Crazy and GN Style deliberately contain `processGameEvent()` failures after commit (`crazy-gameplay-controller.ts:3178-3218`, `gn-style-gameplay-controller.ts:2510-2573`). Their executable tests inject failures at the manager port (`crazy-gameplay-controller.test.ts:614-632`, `gn-style-gameplay-controller.test.ts:1065-1089`); preserve those tests and the existing cleanup/report behavior.
4. Add executable tests for cheer failure, presenter creation/attach failure, and rollback failure. Prove a popup observer failure is reported once and does not escape, while manager/preference failures still propagate according to the caller's existing contract.

#### H2 — Popup ownership violates the architecture decision and retains completed presenters forever

The architecture report explicitly requires a fresh manager with an app-shell-scoped popup host for Objectives/Main Menu events and requires each presenter to be removed after natural cleanup. The implementation instead passes the Classic gameplay manager into the Objectives screen (`recovered-app-shell-controller.ts:654-673`) and into Main Menu/Mode Select (`recovered-app-shell-controller.ts:613,709`). Its callback is bound to the Classic gameplay popup registry and target.

There is no natural retirement signal:

- `ObjectiveAchievementPresenter.updateAction()` removes only particle containers at `4.41s`; `dispose()` is the only full teardown and its comment says banners otherwise persist offscreen (`objective-achievement-presenter.ts:208-253`).
- The completed banner ends at `2.0s` and the next banner ends at `7.5s`, but `ObjectiveAchievementPresentationState` never marks the presentation complete.
- Classic, Crazy, Combo Bird, and GN Style iterate their retained popup sets every frame (`classic-gameplay-controller.ts:581-584`, `crazy-gameplay-controller.ts:519-521`, `combo-bird-gameplay-controller.ts:457-459`, `gn-style-gameplay-controller.ts:463-465`) and only clear them during controller teardown.

Repeated free Skip cycles can therefore add 51 retained presenters per cycle. At minimum, two offscreen banner nodes and one per-frame update entry remain for every nonterminal completion. This is unbounded scene-node, object, and CPU growth.

Fix:

1. Add the architecture-specified app-shell-scoped achievement host. Construct a fresh `ObjectivesManagerState` from the shared settings runtime with that host's non-throwing callback; pass that manager to Objectives, Main Menu, and Mode Select instead of `gameplay.sharedObjectivesManager`.
2. Give the presentation state/presenter an explicit natural-completion signal at the exact next-banner egress end (`7.5s`). The owner must dispose and remove the presenter from its registry immediately after that update.
3. Keep the shell host attached across foreground replacements, dispose all retained presenters on shell destruction, and preserve the exact cheer/add order and `4.41s` particle cleanup.
4. Apply bounded retirement to gameplay-owned registries too, or route all popup managers through the same persistent host. Do not leave Classic/Crazy/Combo/GN registries with indefinite per-frame entries.
5. Add tests proving survival across Main Menu/Objectives replacement, retirement at `7.5s`, no subsequent updates or set growth, attach-failure containment, and complete shell teardown.

### Medium Priority

#### M1 — The cross-mode integration test is a source-shape test, not behavioral coverage

`tests/reconstruction/vertical-slice/objectives-fruit-cut-integration.test.ts` reads TypeScript files as strings and checks marker order. It does not instantiate any gameplay controller, execute a generated Fruit cut, validate mutation counts, or exercise exceptions. It can remain green when the first call throws and the later stages never execute—the exact production failure in H1.

Keep the source-shape assertions if they are useful as reconstruction guards, but add executable controller-level tests that prove:

- exactly one global call for each ordinary/special accepted Fruit;
- mode callback between global and per-type;
- exactly one mapped per-type payload;
- no Dragon global/type calls and no Options fruit calls;
- same-cut global completion followed by progress on the newly active per-type objective;
- failure behavior from H1.

### Low Priority

None worth blocking on. The comment at `objectives-manager-state.ts:414-417` says the global notification is “later,” although every gameplay route now calls it first; clean it up when touching that helper.

### Edge Cases Found by Scout

- Exact global counter boundary is preserved: old `100000` advances to `100001`; later calls retain `100001` and still dispatch selector `10`.
- A cut that completes a global objective can immediately progress the newly active per-type objective; the manager test covers this.
- Only fruit IDs `1→11`, `2→12`, `3→18`, `7→17`, `8→16`, `12→13`, and `13→14` emit per-type selector payload `1`.
- Crazy/Crazy Bird share ordinary and special Fruit ingress. Classic Bird also accepts special Fruit. Combo Bird and GN Style accept ordinary Fruit only.
- Recovered repeated ray-query dispatch is batch-finalized and was not misclassified as a duplicate-cut defect.
- Main Menu IDs `13/7/2` and Mode Select IDs `0/1/2/7/14/6` are wired; locked Mode Select cards remain inert.
- Dragon remains dedicated selector `15` without global or per-type accounting. Options remains outside Fruit accounting.
- UI rollback/re-cut latches now keep already-processed global/type notifications at most once.
- Final sequence reset still resets current position and fruit count before 52 immediate indexed writes and emits no popup.

### Positive Observations

- `OBJECTIVE_ORDER` exactly matches the 52-entry recovered static sequence.
- Global and per-type mappings, payloads, cap behavior, and happy-path callback order match the native contract.
- Per-objective values remain immediate-storage writes; current objective, fruit count, and coins retain their process-memory/bulk-save boundary.
- No shared-thread concurrency race, auth/authz path, database N+1 query, secret, PII, or external-input trust boundary exists in this slice.
- Dragon and Options exclusions were verified from production source rather than inferred from the plan.

### Recommended Actions

1. Fix H1 by making the four popup callbacks non-throwing presentation observers while retaining explicit manager/storage failures.
2. Implement the app-shell popup host and natural `7.5s` retirement from H2.
3. Replace the fault-sensitive portion of the static integration test with executable production-callback coverage.
4. Rerun strict TypeScript, focused tests, controller result tests, and `git diff --check`.

### Metrics

- Type coverage: percentage not configured; strict project TypeScript `--noEmit` passes.
- Test coverage: line/branch percentage not configured; selected Objectives/Main Menu/Mode Select/shell suite passes `194/194`.
- Linting issues: no standalone lint command identified; `git diff --check` reports `0`.
- Build validation: strict Cocos TypeScript project check passes.

### Plan Follow-up

- Exact objective tables, fruit mappings, persistence boundaries, Main Menu/Mode Select wiring, all six mode happy paths, Dragon exclusion, Options exclusion, Objectives screen, and shell routes appear implemented.
- The phase must remain in progress until popup error containment, app-shell ownership, natural retirement, and executable fault coverage are complete.
- No plan file or task state was modified by this review.

### Unresolved Questions

None. The architecture report already resolves the only apparent fidelity trade-off: although native banner nodes remain offscreen, this reconstruction is required to retire each popup after natural cleanup.

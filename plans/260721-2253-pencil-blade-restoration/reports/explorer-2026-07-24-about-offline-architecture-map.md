---
type: explorer
date: 2026-07-24
---

# About and Offline-Action Architecture Map

## Summary

This is a prospective integration map, not an implementation report. No About route,
platform adapter, resource contract, scene, prefab, or runtime source was changed while
preparing it.

The safe fit is:

1. Add About as a shell-owned, dynamically constructed immediate screen after the
   Objectives work has settled.
2. Reuse the Options route topology for both directions, but reuse Leaderboard's
   post-commit audio/error treatment for About -> Main Menu.
3. Give About direct button input only. It must not acquire the shared `BladeInput`
   lease.
4. Keep review behind the existing synchronous, default-deny shell approval boundary.
   Move the reward transaction into one domain-anchored owner before Main Menu and
   About can diverge.
5. Treat feedback/email and social/follow as retired offline actions: visible controls
   may preserve recovered presentation and selected-state feedback, but they must not
   open a URI, invoke JNI, perform network I/O, or mutate settings.
6. Do not classify Exit as a retired platform service. It is a local lifecycle action,
   but its existing `director.end()` semantics and save-failure behavior require an
   explicit pre-ship decision.

The current working tree already contains Objectives integration that is not present in
`HEAD` (`b11236e74b82a2db7f26893caaa2696b55b175aa`). All touchpoints below were mapped
against the working tree and must be rechecked after that checkpoint lands.

### Evidence labels

- **Implemented fact**: behavior present in current Creator TypeScript or tests.
- **Recovered evidence**: behavior observed in read-only analysis of the preserved
  native artifact or staged source resources; it is not yet Creator behavior.
- **Planning recommendation**: proposed implementation shape.
- **Open decision**: product, fidelity, security, or lifecycle choice that the repo does
  not settle.

## Findings

### 1. Existing route and ownership patterns

#### Main Menu

**Implemented fact:** `domain/main-menu-state.ts` classifies `AboutLayer` and
`OptionsLayer` as immediate routes. `aboutCommands()` already emits the recovered
replace/attach/audio command sequence. `reviewCommands()` always requests a platform
review, but adds the one-time `+500` reward only when `networkAvailable && !rated`.
`exitCommands()` orders effects-gated click audio, director end, then settings save.

**Implemented fact:** `creator/main-menu-presenter.ts` still routes About through
`onUnsupportedNavigationRequested`, while Options has an explicit
`onOptionsRequested` lifecycle callback. Its immediate-route transaction:

- marks navigation pending;
- calls the shell lifecycle boundary;
- rearms the current screen if the host returns `false` or throws; and
- plays the route click only after the host accepts the replacement.

The presenter owns the Main Menu `BladeInput` lease with cutting enabled. Its review
handler calls the platform boundary first and does not mutate reward state when approval
is absent, false, or throws.

#### Options

**Implemented fact:** Options is the closest route-topology template:

- the presenter is constructed detached;
- listeners are registered only during activation;
- Main Menu <-> Options uses immediate replacement at z-order `1`;
- failure restores the previous root, disposes the attempted presenter, and rearms the
  source presenter;
- fatal compensation failure disposes both sides and moves the shell to `failed`; and
- Options does not own `BladeInput`.

Options has settings-preview reconciliation that About does not need. Options also plays
its recovered back sound before requesting navigation; that audio ordering must not be
copied to About.

#### Leaderboard and Objectives

**Implemented fact:** Leaderboard and Objectives establish the shell's full transactional
screen pattern and own `BladeInput` with cutting disabled for drag behavior. Their leases
are released on suspension and reacquired on rollback.

**Implemented fact:** Leaderboard's back route treats settings/audio work after a
successful host replacement as post-commit work. It raises typed post-commit errors
without attempting to roll back a route that has already committed. This is the correct
audio model for About's recovered menu callback.

### 2. Recovered About contract inputs relevant to architecture

The following is **recovered evidence**, not implemented Creator behavior:

- About is a dynamically created layer attached at z-order `1`.
- It uses `Backgrounds/aboutbackground.png`.
- It creates four button pairs in menu order: menu, review, email, like.
- Button anchor positions are:
  - menu: `(0.50 * width, 0.10 * height)`;
  - review: `(0.15 * width, 0.10 * height)`;
  - email: `(0.85 * width, 0.10 * height)`; and
  - like: `(0.75 * width, 0.335 * height)`.
- The Menu callback removes About, constructs Main Menu, attaches it at z-order `1`,
  then conditionally plays `Sounds/menubuttonclick.wav`.
- Review always invokes the legacy store-review boundary. The `+500` reward is applied
  only when the stored network flag is true and the rated flag is false.
- Email invokes a legacy feedback boundary. Like invokes a legacy social boundary.
- Review, email, and like have no recovered click sound.
- The screen performs two legacy network-refresh calls before deciding whether to pulse
  Review.
- When eligible, Review pulses forever in two `0.45` second scale phases and emits one
  heart in each phase.
- Each heart consumes five random draws/ranges for position, scale, duration, and rise.
  Hearts fade and rise but remain attached, invisible, until screen cleanup.

The exact raster closure is ten files per asset tree:

1. `Backgrounds/aboutbackground.png`
2. `Buttons/button-menu-normal.png`
3. `Buttons/button-menu-selected.png`
4. `Buttons/button-review-normal.png`
5. `Buttons/button-review-selected.png`
6. `Buttons/button-email-normal.png`
7. `Buttons/button-email-selected.png`
8. `Buttons/button-like-normal.png`
9. `Buttons/button-like-selected.png`
10. `Interfaces/heart.png`

The shared Menu audio is already in `CLASSIC_CORE_AUDIO_PATHS`.
`Backgrounds/aboutbackground-ios.png` is staged but has no recovered Android consumer
and must not be silently substituted into the contract.

### 3. Prospective file and symbol touchpoints

Everything in this section is a **planning recommendation**.

| File | Exact prospective touchpoint | Required responsibility |
|---|---|---|
| `game/assets/scripts/domain/about-resource-contract.ts` + `.meta` | New About-specific resource contract | Pin the ten canonical paths, per-tree dimensions, manifest bytes/hashes, selected/normal pairings, and shared audio reference. Reject the iOS-only background from the Android contract. |
| `game/assets/scripts/domain/about-presentation.ts` + `.meta` | New pure presentation contract | Own logical layout, draw order, pulse timing, heart random-draw order/ranges, and audio metadata. No Cocos imports, network API, or platform identifiers. |
| `game/assets/scripts/domain/about-state.ts` + `.meta` | Create only if it owns real state | Own navigation-pending, review eligibility/pulse state, and retired-action enum only if those invariants do not fit the presenter/presentation model. Do not add an empty wrapper. |
| `game/assets/scripts/domain/review-reward-policy.ts` + `.meta` | Narrow shared policy, if reward logic is extracted | Compute eligibility and int32 coin result for both Main Menu and About. Keep `MainMenuState.reviewCommands()` compatible by delegating or preserving its exported behavior. |
| `game/assets/scripts/creator/about-resource-loader.ts` + `.meta` | New loader | Reuse exact-manifest validation used by recent recovered screens: tree completeness, duplicates, dimensions, bytes/hashes, and typed load failures. |
| `game/assets/scripts/creator/about-presenter.ts` + `.meta` | New presenter | Construct detached; activate/suspend/rearm/dispose direct button listeners; schedule pulse/hearts; request Main Menu transaction; invoke review approval plus shared reward transaction; report retired feedback/social actions. Never acquire `BladeInput`. |
| `game/assets/scripts/creator/review-reward-transaction.ts` + `.meta` | Preferred narrow shared mutation helper if a settings-runtime method is not a better local fit | Apply one approved review reward transaction for both presenters, return a committed outcome for screen models, and centralize failure resynchronization. This must be domain-named, not a generic platform manager. |
| `game/assets/scripts/creator/main-menu-presenter.ts` | `MainMenuPresenterLifecycle`, `navigateImmediate()`, and `requestReview()` | Add explicit `onAboutRequested(transaction)`. Stop sending normal About navigation through the unsupported callback. Reuse the shared review transaction without breaking current command behavior. |
| `game/assets/scripts/creator/recovered-app-shell-controller.ts` | event payload/constants; `RecoveredAppShellState`; `RecoveredAppShellResources`; `MenuScreenPresenter`/label unions; active fields; `update()`; `onDestroy()`; `boot()`; `createMainMenuPresenter()`; new `createAboutPresenter()`; new `transitionMainMenuToAbout()`/`transitionAboutToMainMenu()`; `compensateFailedMenuScreenReplacement()`; `runTransition()`; `requestPlatformReview()` | Add About as a first-class state and resource/presenter owner; create both route directions; add sanitized retired-action reporting; include About in fatal cleanup. Reuse current synchronous review approval. |
| `game/assets/scripts/creator/recovered-app-viewport.ts` | imported viewport/point intersections and returned facade type | Add About viewport/point types only if the About domain introduces distinct branded types. Do not change runtime viewport math. |
| `game/assets/scripts/creator/classic-settings-runtime.ts` | rated/coin mutation seam | Prefer one process-level reviewed-reward commit seam if it can preserve the current settings port contract. Define partial-write behavior; do not claim disk atomicity the storage layer cannot provide. |
| `game/assets/scripts/domain/main-menu-state.ts` | `reviewCommands()` implementation only if sharing policy | Delegate shared reward math while preserving the current public command sequence and tests. About route commands already exist; do not duplicate them. |
| `tests/reconstruction/vertical-slice/about-*.test.ts` and existing presenter/shell/settings tests in that directory | New focused contracts plus integration assertions | Cover the matrix below. Extend existing tests rather than replacing behavior assertions with construction-only tests. |

No `.scene` or prefab edit is needed. The recovered shell already constructs menu screens
dynamically.

`MainMenuUnsupportedDestination` is exported and currently includes `AboutLayer`.
Removing that member while adding the explicit route would be a silent TypeScript
contract break. Keep the exported union compatible for this checkpoint, while asserting
that normal About input never reaches the unsupported callback. Deprecation/removal can
be a separately accepted compatibility change.

### 4. Transaction design

#### Main Menu -> About

**Planning recommendation:** mirror `transitionMainMenuToOptions()`:

1. Validate the active Main Menu presenter/root and exact transaction fields:
   destination `AboutLayer`, timing `immediate`, z-order `1`.
2. Enter `runTransition('main-menu', ...)` so destroyed, failed, reentrant, stale-source,
   and wrong-state requests fail closed.
3. Construct About detached from already validated boot resources.
4. Replace the exact current root with About.
5. Verify the replaced node is the expected Main Menu root.
6. Suspend Main Menu, unregister its listeners, and release its cutting-enabled
   `BladeInput` lease.
7. Activate About's direct button listeners.
8. On any pre-commit failure, call the existing menu-screen compensation helper:
   restore Main Menu, dispose attempted About, and rearm Main Menu.
9. Only after success, swap active presenter fields/state and dispose committed Main
   Menu.
10. Allow `MainMenuPresenter` to perform its existing effects-gated route sound after
    the host returns success.

#### About -> Main Menu

**Planning recommendation:** use the same shell transaction in reverse:

1. About marks navigation pending and snapshots its parent/sibling index.
2. It submits an immutable transaction with destination `MainMenuLayer`, timing
   `immediate`, z-order `1`, and its exact root.
3. The shell constructs Main Menu detached, replaces the exact About root, suspends
   About listeners, activates Main Menu, and reacquires `BladeInput` with cutting
   enabled.
4. A pre-commit failure restores/rearms About and disposes attempted Main Menu.
5. A successful commit updates active fields/state, disposes About, and returns success.
6. About then reads effects settings and plays `Sounds/menubuttonclick.wav`.
   Settings/audio failure at this point is a typed post-commit failure; it must never
   restore the disposed About root.

About must be included in:

- `RecoveredAppShellState`;
- the menu presenter and presenter-label unions;
- active presenter/resource fields;
- `update()` and `onDestroy()`;
- boot resource loading;
- `clearActivePresenter()`/fatal compensation cleanup; and
- any exhaustive state/presenter switches.

Omitting About from fatal cleanup can leave the shell in `failed` while an active About
root and listeners remain reachable.

#### Lifecycle invariants

- Construction is detached and side-effect free.
- Activation occurs only after successful root replacement.
- Only an active, non-pending presenter accepts input.
- Suspension unregisters all node/keyboard listeners and stops About-owned scheduling.
- Rearm restores exactly the prior listeners/scheduling after rollback.
- Dispose is idempotent and owns all About nodes/actions.
- A stale, disposed, or wrong-root transaction is rejected.
- External-action failure never sets route navigation pending.
- A successful route is never rolled back because post-commit audio fails.

### 5. Input, animation, audio, and settings ownership

#### Input

**Planning recommendation:** About uses direct node touch controls. It must not acquire
the shared `BladeInput` lease because no recovered About drag/flick handler was found.
Main Menu releases its lease before About activates and reacquires it only when Main Menu
is restored or reconstructed.

The visible Menu button is recovered. `KeyCode.MOBILE_BACK` support is consistent with
newer screen usability patterns, but no About-specific native back-key symbol was found.
It must therefore be labeled an inference rather than recovered coverage.

#### Animation

**Planning recommendation:** About owns its pulse timer/action and every heart node.
Scheduling begins on activation, pauses/stops on suspension, resumes deterministically
on rearm, and is destroyed on disposal. Tests must prove the five-draw random contract
and large-delta emission count.

**Production risk:** exact recovered lifetime retains invisible heart nodes at roughly
two nodes per `0.9` seconds for as long as the eligible screen remains open. This is
unbounded allocation within one screen lifetime. Cleaning or pooling completed hearts is
visually equivalent but is a fidelity deviation from recovered node lifetime. This
requires an explicit decision; it must not be silently optimized or silently accepted.

#### Audio

**Implemented fact:** Main Menu/shared audio owns background music, and the existing
immediate About command does not stop it.

**Planning recommendation:** About does not start or stop background music. Only the
About -> Main Menu Menu action plays the shared menu click, effects-gated and
post-commit. Review, feedback, and social actions remain silent.

#### Settings and review reward

**Implemented fact:** `ClassicSettingsRuntime.persistRatedFlag()` immediately writes the
rated flag when writes are enabled. `setRated()` and `addCoins()` change runtime state;
bulk persistence follows through normal save boundaries. Main Menu currently persists
rated, then updates rated state, then adds coins.

**Planning recommendation:** establish one shared, domain-anchored review transaction
used by both presenters:

1. Ask the shell platform-review boundary.
2. If it does not synchronously approve, return with no reward mutation.
3. Evaluate the stored compatibility snapshot: reward only when
   `networkAvailable && !rated`.
4. Compute the same int32 `+500` result.
5. Apply the existing recovered persistence/memory order once.
6. Return a committed outcome so the active screen model mirrors settings state.
7. On error, rebuild the screen's cached model from the settings snapshot and propagate
   a typed failure.

Do not copy Main Menu's mutation sequence into About. Two copies would create a
double-reward and partial-failure divergence risk.

The current storage order is not crash-atomic: the rated flag can become durable before
the coin balance is bulk-saved. A thrown port call can also leave a durable rated flag
with no completed reward. A helper can centralize and test this behavior, but cannot
honestly promise rollback of an already-written preference. Persisting coins first or
persisting both in one new record would be a save-contract/fidelity change and needs
explicit acceptance.

About otherwise owns no settings writes. App hide remains the global save boundary; no
Options-style selection reconciliation belongs in About.

### 6. Offline and trust-boundary policy

#### Review

**Implemented fact:** the shell emits a platform-review event with a synchronous
`approve()` closure and returns `false` unless a listener calls it before event dispatch
returns.

**Planning recommendation:**

- Reuse this one boundary for Main Menu and About.
- No listener, listener rejection, listener throw, or late/asynchronous approval means
  no reward mutation and the current screen stays interactive.
- Multiple `approve()` calls remain idempotent.
- An approved request may earn the reward only under the stored
  `networkAvailable && !rated` compatibility rule.
- Do not pass a raw store URI, package name, activity, or account identifier through the
  payload.
- A future asynchronous store API needs a new Promise/token contract, cancellation, and
  idempotency. It must not be disguised as the current synchronous approval.

The stored network flag is a recovered compatibility input, not proof of live
connectivity and never an authorization/security decision.

#### Feedback/email and social/follow

**Planning recommendation:** preserve the visible controls and selected sprites, then
emit a local, sanitized retired-action notification such as:

```ts
type RecoveredRetiredPlatformAction = 'feedback' | 'social';

type RecoveredRetiredPlatformActionEvent = Readonly<{
  action: RecoveredRetiredPlatformAction;
  reason: 'retired-offline';
}>;
```

This is a diagnostic/UI boundary, not an approval hook. It must:

- contain observer exceptions so About remains usable;
- expose only the fixed enum and reason;
- perform no navigation, settings mutation, audio, network request, or URI launch; and
- never reproduce historical email addresses, social profile identifiers, store
  packages, or hardcoded URLs found in archival Java/native evidence.

If the product wants a toast or modal explaining unavailability, copy and presentation
need separate design approval. There is no recovered message contract, so inventing one
would be inferred behavior.

#### Network, ads, and analytics

**Planning recommendation:**

- Do not restore either legacy network-refresh call as a live probe.
- Do not add `fetch`, XHR, connectivity listeners, remote configuration, or a persisted
  always-true network flag.
- Read the migrated compatibility snapshot only for local recovered eligibility and
  fixture coverage.
- Add no ads or analytics port, SDK, placeholder manager, event transport, or gameplay
  dependency.
- The recovered local leaderboard remains local state; it is not authorization for an
  external leaderboard service.

This follows Phase 6's requirement to keep obsolete online features outside core
gameplay and to define intentional replacement behavior. Any future external link or
service requires a separately approved implementation, current endpoint/configuration,
consent/privacy review, and security testing.

#### Exit

**Implemented fact:** Exit is local and currently orders click audio, `director.end()`,
then `settings.save()`. It does not use a network/platform-service adapter.

**Verified engine fact:** in the pinned Cocos Creator 3.8.8 source,
`Director.end()` schedules `purgeDirector()` at `END_FRAME`; it does not close the system
window. `Game.end()` calls `systemInfo.close()`. Therefore the existing symbol named
Exit currently means “end/purge the director,” not verified Android application exit.
The following synchronous settings save ordinarily runs before the end-frame callback.

**Open decision:** choose and test the intended product behavior:

- preserve the recovered/current director-end semantics;
- use the engine's actual close boundary; or
- treat Android back/system lifecycle as the only supported app exit.

Do not fold Exit into the retired-action enum. If `settings.save()` throws after
`director.end()` has scheduled purge, the purge still proceeds and the failure is not
transactionally recoverable. The desired failure reporting and save-versus-exit order
must be decided before calling this production-ready.

### 7. Test matrix

All rows are **planning recommendations**.

| Area | Required executable checks |
|---|---|
| Resource contract | Exact ten-file closure in both trees; no duplicates/extras; exact canonical paths; per-tree dimensions; bytes/hashes match the staging manifest; iOS background excluded; shared audio path/hash unchanged. |
| Resource loader | Complete success; sparse tree; swapped selected/normal frames; wrong dimension/hash; duplicate path; typed load error; boot destruction/late resolution cannot attach a screen. |
| Presentation | Exact draw/menu order and normalized positions; selected/normal pairs; pulse only for stored `networkAvailable && !rated`; two `0.45s` phases; one heart each phase; large-delta catch-up; exact five RNG draws and inclusive ranges; heart ownership through dispose. |
| Presenter lifecycle | Detached construction has no listeners/actions; activate exactly once; failed activation cleanup; suspend/rearm/dispose idempotency; no `BladeInput` acquisition; inactive/pending/stale input ignored. |
| About controls | Menu touch begin/end/cancel frames; optional hardware Back explicitly labeled inferred; feedback/social selected feedback then sanitized retired event; event listener throw/reentrancy does not disable the screen; no audio/settings/network/route mutation for retired actions. |
| Review boundary | No listener, explicit rejection, throw, async/late approve, approve once/multiple times; offline stored flag; already rated; eligible exact `+500`; int32 overflow parity; repeated taps cannot double reward; no mutation before synchronous approval. |
| Review settings failures | Failure at persisted-rated, set-rated, and add-coins seams; write-disabled mode; active model resync; explicit fixture showing durable-rated/unsaved-coins limitation; Main Menu and About produce identical outcomes. |
| Main Menu presenter | About uses explicit lifecycle callback; unsupported callback is not invoked; false/throw restores interaction and the cutting-enabled `BladeInput` lease; accepted route plays click after commit only. |
| Shell route | Boot resource inclusion/failure; Main Menu -> About -> Main Menu state/field/root ownership; wrong destination/timing/z-order/root; stale source; reentrant request; replace/suspend/activate failure injection; rollback failure enters `failed` and clears About; committed presenter cleanup errors do not undo route. |
| About back audio | Rejected route has no post-commit sound; successful route effects on/off; settings read failure and audio failure raise typed post-commit errors without restoring About. |
| Exit | Assert actual pinned-engine boundary selected by the open decision; save ordering; save throw; repeated input; app-hide interaction. A regex for `director.end()` is not a behavioral exit test. |
| Trust boundary audit | No JNI/native application import; no `libgame.so` runtime dependency; no `openURL`, raw URI/email/profile/package identifiers, `fetch`, XHR, ads, analytics, or external leaderboard SDK in ship-ready source. Event payload contains only fixed enums. |
| Regression gates | Focused Node tests, complete deterministic suite, strict TypeScript compile, resource/build/catalog checks, then Creator Preview smoke validation when route implementation is authorized. No APK execution is required. |

Tests that only instantiate the presenter or regex-match callback names are insufficient.
They must prove state, ownership, mutation ordering, and rollback behavior.

### 8. Risks and priority

#### Blocking before route implementation

1. **Review reward has no shared transactional owner.** Duplicating Main Menu code in
   About risks double rewards and divergent partial-write recovery.
2. **Exit semantics are mislabeled unless explicitly accepted.** `director.end()` is not
   the pinned engine's window-close API.
3. **Heart lifetime is unbounded while eligible About remains open.** Exact lifetime
   fidelity conflicts with production memory safety.
4. **The hardware Back contract is unknown.** It may be implemented as a reviewed
   usability inference, but not counted as recovered behavior.

#### High risk during integration

- Implementing against the uncommitted Objectives overlay can omit newly added shell
  union/cleanup paths.
- Forgetting `activeAboutPresenter` in fatal compensation can leave live listeners or a
  root after shell failure.
- Acquiring `BladeInput` in About can conflict with Main Menu ownership on rollback.
- Treating post-commit audio failure as a route failure can resurrect a disposed screen.
- Treating the stored network sentinel as live connectivity can accidentally re-enable
  retired services.
- An asynchronous review adapter cannot satisfy the current synchronous approval
  contract and may award or deny inconsistently.
- External event payloads can leak archival identifiers if they are copied from JNI/Java
  evidence.
- Eager boot loading makes any corrupt About asset fail the whole shell before the route
  is opened. This matches current menu-screen policy; lazy loading would require a new
  asynchronous transition contract.

#### Medium risk

- Visible but unavailable feedback/social controls may confuse users. Any explanatory UI
  is a product/design decision.
- Removing `AboutLayer` from the exported unsupported-destination union would break
  callers even though the runtime path becomes explicit.
- Copying Options reconciliation or pre-route audio into About would introduce behavior
  not present in the recovered callback.
- Silently using `aboutbackground-ios.png` would corrupt the Android resource contract.

### 9. Recommended implementation order

1. Let the Objectives checkpoint settle; re-run the shell union/transition/cleanup map.
2. Resolve the three product decisions: heart cleanup policy, About hardware Back, and
   actual Exit semantics/save failure.
3. Freeze and review the About resource and presentation contracts.
4. Extract or establish the shared approved-review reward transaction while preserving
   Main Menu's public command contract.
5. Implement/test About presenter and loader without shell route wiring.
6. Add explicit Main Menu -> About and About -> Main Menu shell transactions plus
   compensation tests.
7. Add sanitized retired feedback/social reporting and trust-boundary scans.
8. Run focused tests, full deterministic suite, strict TypeScript, resource/build audits,
   and later Creator Preview smoke validation.
9. Update Phase 6/docs only after executable behavior and policy decisions are verified.

## Recommendations

- Adopt Options' immediate-screen transaction topology, Leaderboard's post-commit audio
  semantics, and no `BladeInput` owner for About.
- Reuse the current default-deny platform-review event; do not add a platform SDK in this
  checkpoint.
- Centralize review reward eligibility and settings mutation before About calls it.
- Define feedback/social as sanitized, local retired-action notifications with no
  external side effects.
- Keep network, ads, analytics, and historical identifiers outside ship-ready runtime.
- Treat Exit as a separate lifecycle review item, not part of retired online services.
- Do not mark About recovered or production-ready until the open decisions and
  executable transaction tests are resolved.

## Unresolved Questions

1. Should visually completed hearts be removed/pooled for production safety, recorded as
   an intentional deviation from recovered node lifetime, or should exact retained-node
   fidelity be accepted?
2. Should `MOBILE_BACK` return from About as a reviewed usability inference?
3. What must Exit mean on Android: purge the director, close the application through the
   engine boundary, or defer entirely to system navigation?
4. If exit-time save fails, should the app remain active, continue exiting with an
   internal error report, or retry through another owned save boundary?
5. Should unavailable feedback/social controls remain interactive with selected-frame
   feedback only, or should approved explanatory copy/UI be added?
6. Is the recovered rated-first persistence order mandatory, despite its durable
   rated/unsaved-coin crash window, or may the save contract be made atomic?

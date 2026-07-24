---
type: implementer
date: 2026-07-24
---

# Main Menu About Lifecycle Boundary

## Summary

Main Menu now exposes a required, explicit `onAboutRequested(transaction)` lifecycle
boundary. The existing About button command calls that boundary directly and never uses
`onUnsupportedDestinationRequested`.

This checkpoint changes only the Main Menu presenter, its focused test, and this report.
It does not implement the shell route or change About resources, review rewards, domain
commands, or the exported unsupported-destination union.

## Findings

### Runtime change

- Added required `onAboutRequested(transaction)` to `MainMenuPresenterLifecycle`.
- Added the callback to runtime lifecycle-port validation.
- Routed `AboutLayer` to `onAboutRequested` and `OptionsLayer` to the existing
  `onOptionsRequested`.
- Left `MainMenuUnsupportedDestination` unchanged, so its exported type remains
  source-compatible.
- Preserved the existing immutable transaction:
  - destination `AboutLayer`;
  - current Main Menu root;
  - timing `immediate`; and
  - z-order `1`.
- Preserved transaction failure handling. A `false` return or thrown host error rearms a
  host-suspended presenter and reacquires the cutting-enabled `BladeInput` lease.
- Preserved the commit boundary. Menu click audio runs only after the host callback
  accepts the route; rejected and thrown transactions do not play it.

### Focused tests

Coverage now proves:

- accepted About routes call only `onAboutRequested`;
- the exact transaction reaches the callback;
- host commit occurs before click audio;
- `false` and thrown failures do not call the unsupported callback;
- both failures restore the input lease with exact
  `cut:false -> deactivate -> activate -> cut:true` ordering;
- ordinary false/thrown host failures with successful rearm do not play click audio or
  poison the presenter; and
- presenter construction rejects a missing About lifecycle function.

### Verification

| Check | Result |
|---|---|
| Baseline focused test | Passed: 17/17 |
| Updated focused test | Passed: 19/19 |
| Creator 3.8.8 strict TypeScript | Expected integration failure: one `TS2741` because the deferred shell consumer does not yet provide required `onAboutRequested` |
| APK/native execution | Not run; prohibited and unnecessary |

Strict TypeScript command:

```sh
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript/bin/tsc \
  --noEmit --pretty false -p game/tsconfig.json
```

Current diagnostic:

```text
game/assets/scripts/creator/recovered-app-shell-controller.ts(639,7):
error TS2741: Property 'onAboutRequested' is missing ...
```

That consumer is intentionally outside this checkpoint's file ownership. The focused
presenter test passes independently; repository strict TypeScript remains red until the
shell supplies the new required lifecycle callback.

### Review

- No asynchronous or shared mutable state was introduced.
- Error propagation remains unchanged: host throws are rethrown after successful rearm;
  host and rearm failures remain aggregated by `MainMenuCleanupError`.
- No review-reward, settings, network, authorization, storage, or external platform path
  changed.
- No exported union member was removed.
- Scouting found one affected runtime consumer: the deferred recovered app shell.

## Recommendations

1. Add the shell-owned `onAboutRequested` implementation and transactional About route
   before merging or claiming a green TypeScript build.
2. Re-run the focused Main Menu test, shell integration test, and strict Creator
   TypeScript after that callback lands.
3. Keep About resource/presenter/review work in its separately reviewed checkpoint.

## Unresolved Questions

- None within this boundary. The known TypeScript failure is the explicitly deferred
  shell integration handoff.

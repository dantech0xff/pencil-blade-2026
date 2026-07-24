---
type: implementer
date: 2026-07-24
status: done
scope: About shell transactions and shared viewport facade
---

# About Shell Host Integration

## Summary

The recovered application shell now loads About as an essential boot resource,
owns it as a first-class foreground state, and performs exact immediate z-order
`1` Main Menu-to-About and About-to-fresh-Main-Menu transactions.

About is created with production-local review eligibility disabled, the shared
gameplay RNG required by its presenter, and a live effects-settings getter. Its
review, feedback, and social controls terminate at one sanitized shell-local
event; no live network, URI, platform bridge, currency, persistence, or legacy
identity crosses this boundary.

## Findings

### Shell ownership and boot

- Added About resource loading to the essential `Promise.all` boot closure.
- Added `about` to shell state and resource contracts.
- Added one nullable About presenter owner to update, teardown, failed-boot,
  and fatal menu-screen cleanup paths.
- Wired Main Menu's required `onAboutRequested` callback.
- Preserved `MainMenuUnsupportedDestination`; no exported compatibility member
  changed.

### Transaction boundary

- Main Menu accepts only its current root, destination `AboutLayer`, timing
  `immediate`, and z-order `1`.
- About accepts only its current root, destination `MainMenuLayer`, timing
  `immediate`, and z-order `1`.
- Both paths construct the destination detached, replace the current screen,
  suspend the source, activate the destination, then commit shell ownership.
- About back always constructs a fresh Main Menu presenter.
- Both paths reuse the existing reversible menu-screen compensation and fatal
  cleanup path, including poisoned-source handling.
- Shared `runTransition` rejects destroyed, stale-state, and reentrant requests.

### Local retired-action boundary

- Added `RECOVERED_APP_SHELL_RETIRED_PLATFORM_ACTION_EVENT`.
- Reconstructs a frozen payload containing only:
  - action `review`, `feedback`, or `social`; and
  - reason `retired-offline`.
- Ignores unknown actions, strips caller extras, and fixes the reason locally.
- Contains shell-event observer exceptions, including logging failure, so they
  cannot escape into the About presenter.
- Source scans cover historical URI, package, contact, and network surfaces.

### Shared viewport

- `RecoveredAppViewport` now explicitly intersects `AboutViewport`.
- Shared points now explicitly intersect `AboutPoint`.
- Runtime geometry remains the existing deeply frozen float32-normalized
  viewport.

### Verification

| Check | Result |
|---|---|
| Shell and viewport tests | `123/123` pass |
| Full Main Menu/About focused slice | `206/206` pass |
| About presenter peer review | PASS; no P0-P2 findings |
| Creator 3.8.8 strict TypeScript | pass; zero diagnostics |
| `git diff --check` for owned files | pass |
| APK/native execution | not run; prohibited and unnecessary |

Coverage includes exact guards, stale and reentrant rejection, accepted two-way
ownership, fresh Main Menu reconstruction, destination creation/replacement/
activation/disposal failures, reversible source rearm, poisoned and incomplete
rollback fatal cleanup, About resource loading, update/teardown/failed-boot
ownership, and exact sanitized event payloads.

## Recommendations

1. Keep production `localCompatibilityAvailable` false unless a separately
   approved product contract restores an external review service.
2. Keep any future support, social, or store integration outside the gameplay
   shell and require fresh identifiers, consent/privacy review, and dedicated
   acceptance criteria.
3. Retain the executable transaction-failure matrix when adding another
   foreground menu screen.

## Unresolved Questions

- Recovered About bitmap rights and baked legacy copy approval remain product
  decisions outside this shell integration.

Status: DONE
Summary: Essential About boot ownership, exact two-way shell transactions, shared viewport typing, and sanitized retired-action reporting implemented and verified.
Concerns/Blockers: No code blocker; recovered-art rights and copy approval remain external product decisions.

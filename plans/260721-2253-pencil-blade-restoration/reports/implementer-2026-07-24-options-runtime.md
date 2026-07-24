# Options Runtime Production Checkpoint

## Outcome

The recovered Options screen is integrated into the persistent Cocos Creator shell.
Main Menu enters Options transactionally, Back returns to the same parent/sibling position,
and failed handoffs restore the prior screen or fail closed.

## Implemented Contract

- One chained screen with recovered row reveal boundaries at `1.25`, `1.50`, and `1.75`
  seconds.
- Eight backgrounds, eighteen blades, and ten themes with previous/next selectors.
- Exact per-tree set of 51 direct rasters, `Fonts/SlabThing.ttf`,
  `Sounds/menubuttonclick.wav`, `Sounds/mono1.wav`, and `Sounds/mono2.wav`.
- Live background/theme preview and Settings-backed background/blade/theme selection.
- Price `0` ownership, exact affordability behavior, storage-first ownership purchase,
  one debit, Buy-state refresh, and the recovered 45-particle `xmasfive` burst.
- Back rolls an unowned background or blade preview to index `0`; themes and purchased
  selections remain. Persisted background index `8` stays compatible until the player
  explicitly selects another background.
- App-hide applies the same reconciliation before save. A reconciliation failure prevents
  the save and remains retryable.
- Missing, corrupt, or unreadable coin storage starts at `999999`; every valid persisted
  balance, including `0`, remains authoritative.

## Resource and Runtime Boundaries

The implementation reuses recovered resources directly from both staged resolution trees.
Pure domain modules own selection, affordability, purchase intent, rollback, particle
planning, presentation geometry, and resource contracts. Creator adapters own nodes,
sprites, labels, audio, storage, lifecycle, and shell integration.

## Verification

- Focused Options/Settings/Main Menu/shell/audio tests: `143/143`
- Full deterministic vertical slice: `1212/1212`
- Resource/build/catalog tests: `43/43`
- Cocos Creator 3.8.8 bundled strict TypeScript: passed
- Diff hygiene and metadata/resource contracts: passed
- Fresh Preview:
  - compact `360x800` physical profile using the internal `480x800` resource/design branch
  - high `720x1280` profile
  - Main Menu, Options, selection preview, Buy state, purchase persistence, and Back flow
  - Cocos Editor console: zero information, warning, and error entries after final reload

Browser Preview did not expose a reliable app-hide lifecycle event when the browser tab or
application changed focus. That invariant is certified by executable shell/presenter tests
and independent source review, not claimed as a direct Preview observation.

## Remaining Work

- BasicBlade gameplay rendering for selected IDs `1` through `17`
- Blade-specific particle/runtime behavior
- Remaining menu states, objectives, leaderboard, About/offline behavior, and global
  resource-consumer reconciliation

## Unresolved Questions

None for the Options checkpoint.

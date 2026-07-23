# Mode Select resource and presentation contracts

## Outcome

- Added pure, deeply immutable Mode Select resource and presentation contracts.
- Encoded both staged asset profiles, 42 raster consumers, seven shared files, six exact card definitions, unlock rules, navigation destinations, RopeButton physics/sync structure, cut plans, blade dependency, and the 45-particle unlock burst.
- Preserved the authoritative first-frame state: Combo is initially centered while `currentIndex` is `0`, then the presentation advances toward Classic.
- Kept `totalCoins` as validated unlock-state input only; Mode Select has no total-coins label. The sole visible coin-related label is `Not enough coins!`.
- Destination mappings are declarations only. No placeholder gameplay destination presentation was added.

## Files

- `game/assets/scripts/domain/mode-select-resource-contract.ts`
- `game/assets/scripts/domain/mode-select-resource-contract.ts.meta`
- `game/assets/scripts/domain/mode-select-presentation.ts`
- `game/assets/scripts/domain/mode-select-presentation.ts.meta`
- `tests/reconstruction/vertical-slice/mode-select-resource-contract.test.ts`
- `tests/reconstruction/vertical-slice/mode-select-presentation.test.ts`

## Public handoff API

- `getModeSelectRasterResources(assetTree)`
- `getModeSelectCardDefinition(index)`
- `getModeSelectCardDefinitionByFruitId(fruitId)`
- `getModeSelectCardResources(index, assetTree)`
- `createModeSelectPresentation(assetTree, viewport, totalCoins, persistedUnlocks?)`
- `createModeSelectFruitCutPresentationPlan(index, assetTree, effectsEnabled)`
- `createModeSelectUnlockBurstPresentation(assetTree, viewport, random)`

## Verification

- Creator 3.8.8 bundled TypeScript: strict `tsc --noEmit` passed.
- Focused Mode Select resource, presentation, and existing state suites: 36/36 tests passed.
- Tests verify staged bytes/SHA-256/dimensions, prohibited semantic substitution, both profiles, viewport offsets, child order, float32 values, physics topology, motion/actions, all cut destinations, unlock burst RNG consumption/timeline, validation-before-RNG, and deep freezing.
- Static clean-room analysis only; APK and native library were not executed.

## Limits

- Exact solver trajectories, pixel output, and decoded audio output remain outside this pure-contract phase.

## Unresolved questions

None.

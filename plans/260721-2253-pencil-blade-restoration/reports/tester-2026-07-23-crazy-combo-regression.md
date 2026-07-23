---
type: tester
date: 2026-07-23
status: pass
scope: crazy-combo-regression
---

# Test Report: Crazy Combo Regression

## Summary

PASS. Focused ComboItem/resource/Crazy controller tests passed, the full vertical-slice suite passed, the bundled Cocos Creator 3.8.8 TypeScript check passed, the reconstruction policy positive and negative fixtures passed, and `git diff --check` passed.

No implementation files were changed in this validation run.

## Test Results

### Focused gate

- Start: `2026-07-23T10:44:03Z`
- End: `2026-07-23T10:44:03Z`
- Command:

```sh
node --test \
  tests/reconstruction/vertical-slice/combo-item-presentation.test.ts \
  tests/reconstruction/vertical-slice/combo-item-presenter.test.ts \
  tests/reconstruction/vertical-slice/classic-resource-loader.test.ts \
  tests/reconstruction/vertical-slice/crazy-resource-loader.test.ts \
  tests/reconstruction/vertical-slice/classic-gameplay-controller.test.ts \
  tests/reconstruction/vertical-slice/crazy-gameplay-controller.test.ts
```

- Result: `30` tests, `30` passed, `0` failed, `0` skipped, `0` todo
- Duration: `199.352125 ms`
- Diagnostics:
  - Repeated `MODULE_TYPELESS_PACKAGE_JSON` warnings from Node while loading TypeScript ES module sources
  - One `ExperimentalWarning: stripTypeScriptTypes`

### Full vertical-slice suite

- Start: `2026-07-23T10:44:09Z`
- End: `2026-07-23T10:44:12Z`
- Command:

```sh
node --test tests/reconstruction/vertical-slice/*.test.ts
```

- Result: `728` tests, `728` passed, `0` failed, `0` skipped, `0` todo
- Duration: `3138.362625 ms`
- Diagnostics:
  - Repeated `MODULE_TYPELESS_PACKAGE_JSON` warnings
  - One `ExperimentalWarning: stripTypeScriptTypes`

### Bundled TypeScript check

- Start: `2026-07-23T10:44:17Z`
- End: `2026-07-23T10:44:20Z`
- Command:

```sh
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js -p game/tsconfig.json --pretty false --noEmit
```

- Result: exit `0`
- Diagnostics: `0`

### Reconstruction policy gates

- Positive policy check
  - Start: `2026-07-23T10:44:27Z`
  - End: `2026-07-23T10:44:27Z`
  - Command:

```sh
sh tests/reconstruction-policy-test.sh
```

  - Result: `PASS reconstruction policy`

- Negative fixtures
  - Start: `2026-07-23T10:44:27Z`
  - End: `2026-07-23T10:44:27Z`
  - Command:

```sh
sh tests/reconstruction-policy-negative-test.sh
```

  - Result: `4` passed, `0` failed
  - Fixtures:
    - `missing-open-decisions`
    - `contract-path-traversal`
    - `swapped-claim-contract`
    - `duplicate-contract-id`

### Diff check

- Start: `2026-07-23T10:44:32Z`
- End: `2026-07-23T10:44:32Z`
- Command:

```sh
git diff --check
```

- Result: exit `0`
- Findings: none

## Coverage Metrics

- Not generated in this validation run.
- Test scope was diff-aware and targeted at the ComboItem, resource-loader, and Crazy controller surfaces, then broadened to the full vertical-slice suite.

## Build Status

- Bundled Cocos Creator 3.8.8 `tsc --noEmit`: pass
- Reconstruction policy: pass
- Negative policy fixtures: pass
- `git diff --check`: pass

## Critical Issues

- None found in this checkpoint.

## Recommendations

1. Keep the current combo/shared-resource/Crazy controller regression tests in the vertical-slice suite.
2. If the Node warnings become noisy in CI, consider normalizing module typing for the `game/` package, but only if that matches the intended project setup.

## Unresolved Questions

- None.

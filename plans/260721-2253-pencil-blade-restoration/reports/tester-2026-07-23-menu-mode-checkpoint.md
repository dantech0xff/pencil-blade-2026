# Tester Report: Menu/Mode Checkpoint Verification

Date: 2026-07-23
Scope: Boot -> Main Menu -> Mode Select -> Classic -> Result -> Menu/Retry checkpoint

## Summary

Verification passed.

- Strict Creator TypeScript compiled cleanly with the installed Cocos Creator 3.8.8 TypeScript 5.8.2 toolchain.
- Full vertical-slice suite passed: 410/410.
- `git diff --check` passed with no whitespace or patch-format issues.
- The `classic.scene` Canvas script components resolve to the expected imported Creator metas.
- Forbidden original-runtime / decompiler / bridge / fake-mode strings were not found in the changed Creator/domain/scene files.

## Exact Commands And Results

### Creator TypeScript

Command:

```bash
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js -v
```

Result:

```text
Version 5.8.2
```

Command:

```bash
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js -p game/tsconfig.json --pretty false
```

Result:

- Exit code `0`
- No diagnostics printed

### Vertical Slice Suite

Command:

```bash
node --test tests/reconstruction/vertical-slice/*.test.ts
```

Result:

- Tests: `410`
- Passed: `410`
- Failed: `0`
- Skipped: `0`
- Duration: `2032.7075 ms`

Observed non-failing warnings:

- `MODULE_TYPELESS_PACKAGE_JSON` warnings from Node because `game/package.json` does not declare `"type": "module"`
- One `ExperimentalWarning: stripTypeScriptTypes`

### Diff Hygiene

Command:

```bash
git diff --check
```

Result:

- Exit code `0`
- No output

### Scene / Meta Resolution

Checked `game/assets/scenes/classic.scene` Canvas component references against the imported metas for:

- `game/assets/scripts/creator/blade-input-controller.ts.meta`
- `game/assets/scripts/creator/classic-scene-controller.ts.meta`
- `game/assets/scripts/creator/classic-gameplay-controller.ts.meta`
- `game/assets/scripts/creator/recovered-app-shell-controller.ts.meta`

Observed scene script UUIDs:

- `0fd52CUC6dHJoHuZBe9rtQd` -> `0fd52094-0ba7-4726-81ee-6417bdaed41d`
- `a32bcWc/1BL/JJe8ANXLHNT` -> `a32bc59c-ff50-4bfc-925e-f003572c7353`
- `52b0feMbANGmYv0vsXyCMvX` -> `52b0f78c-6c03-4699-8bf4-bec5f208cbd7`
- `12e4e2CzjtIza21IDsQPWH2` -> `12e4ed82-ce3b-48cd-adb5-203b103d61f6`

The Canvas component chain is consistent with the recovered Boot -> Menu -> Mode Select -> Classic shell wiring.

### Forbidden-String Audit

Command:

```bash
rg -n "(libgame\\.so|cocos2d-x|cocos2dx|decompiler|jadx|apktool|ghidra|showReviewTaskJNI|legacy-runtime|original runtime|fake mapping|mode\\s*1|mode\\s*2|destination-mode)" game/assets/scripts/creator game/assets/scripts/domain game/assets/scenes/classic.scene
```

Result:

- No matches

## Coverage / Quality Notes

- The full vertical-slice suite already covers the checkpoint behavior end-to-end and passed.
- The repository-wide source-boundary audit tests also passed in the suite run.
- No additional failing tests or regressions were observed.

## Concrete Blocker

None.

## Repo Gap

- `README.md` is missing at the repository root, so the required root-read step could not be satisfied literally. I used the phase plan and repository-local files instead.

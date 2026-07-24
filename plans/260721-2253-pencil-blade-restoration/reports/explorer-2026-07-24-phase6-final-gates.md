---
type: explorer
date: 2026-07-24
status: complete
scope: phase-6-final-verification-command-map
---

# Phase 6 Final Verification Gates

## Summary

Run from the repository root. This is a command map only; no test, Preview, APK,
or native-library command was executed during this investigation.

The current final checkpoint should run the new Classic pause/composition tests
first, then the full deterministic slice, top-level tooling tests, Creator
3.8.8's bundled strict TypeScript, canonical ledger/staging checks, boundary
audits, and documentation/diff hygiene. The historical pre-closure baseline is
`1520/1520` vertical-slice tests and `61/61` top-level `.mjs` tests; final totals
will increase when the new tests land, so do not hard-code those totals as the
new acceptance threshold.

## Findings: Copy-Paste Gate

### 1. Focused Classic pause and composition

Run this after the Classic pause implementation and focused lifecycle assertions
are present:

```sh
node --test \
  tests/reconstruction/vertical-slice/base-gameplay-pause-state.test.ts \
  tests/reconstruction/vertical-slice/base-gameplay-pause-presenter.test.ts \
  tests/reconstruction/vertical-slice/base-gameplay-resource-loader.test.ts \
  tests/reconstruction/vertical-slice/classic-audio-presenter.test.ts \
  tests/reconstruction/vertical-slice/classic-cut-session.test.ts \
  tests/reconstruction/vertical-slice/classic-scene-restart.test.ts \
  tests/reconstruction/vertical-slice/classic-app-shell-boundary.test.ts \
  tests/reconstruction/vertical-slice/recovered-app-shell-controller.test.ts \
  tests/reconstruction/vertical-slice/creator-scene-integration.test.ts \
  tests/reconstruction/vertical-slice/creator-composition-reconciliation.test.ts
```

The final implementation extends the existing Classic session, scene-restart,
app-shell-boundary, and recovered-shell tests. No separate
`classic-pause-lifecycle.test.ts` or `classic-gameplay-controller.test.ts` is
needed.

### 2. Complete deterministic and tooling suites

These are the latest command forms recorded by the Loading checkpoint:

```sh
node --test tests/reconstruction/vertical-slice/*.test.ts
node --test --test-reporter=dot tests/*.mjs
```

Node 22.21.0 is the recorded host runtime. Older reports sometimes spell the
first command as `node --experimental-strip-types --test ...`; current reports
use plain `node --test`, which already handles these TypeScript tests on the
recorded runtime.

### 3. Cocos Creator 3.8.8 bundled strict TypeScript

```sh
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js \
  -p game/tsconfig.json \
  --pretty false \
  --noEmit
```

The exact bundled compiler path and Creator executable are present on this
host. Do not replace this with an unpinned global `tsc`.

### 4. Resource ledger, staging, and metadata

Focused contract tests:

```sh
node --test \
  tests/reconstruction/vertical-slice/resource-consumer-registry.test.ts \
  tests/generate-resource-reconciliation-ledger-test.mjs \
  tests/stage-creator-assets-test.mjs \
  tests/catalog-static-resources-test.mjs \
  tests/validate-creator-resource-meta-test.mjs
```

Deterministic ledger verification:

```sh
node scripts/generate-resource-reconciliation-ledger.mjs verify \
  --resource-map forensics/resources/resource-usage-map.json \
  --registry game/assets/scripts/domain/resource-consumer-registry.ts \
  --dispositions forensics/resources/resource-disposition-map.json \
  --ledger assets/catalog/resource-reconciliation-ledger.json
```

Exact-byte staging verification:

```sh
node scripts/stage-creator-assets.mjs verify \
  --source .forensics-work/phase-01/jadx/resources/assets \
  --resource-map forensics/resources/resource-usage-map.json \
  --reconciliation assets/catalog/resource-reconciliation-ledger.json \
  --target game/assets/game \
  --manifest assets/catalog/creator-staging-manifest.json
```

The preserved extracted source tree required by `stage-creator-assets verify`
is present at the path above. The command is read-only in `verify` mode.

Use `tests/validate-creator-resource-meta-test.mjs` as the CI-style metadata
gate. It creates the transient pinned editor-info input and asserts:

- zero structural errors;
- zero duplicate UUIDs;
- exact asset, metadata, and importer counts; and
- exactly the known `Fonts/CooperBlackStd.otf` fidelity blocker.

The standalone metadata CLI intentionally exits `2` when those structural
checks pass because the preserved OTF has no supported Creator font consumer.
Treating any nonzero standalone exit as an ordinary failure would incorrectly
reject the known checkpoint.

### 5. Source and build boundary

```sh
node --test tests/reconstruction/vertical-slice/source-boundary.test.ts
node --test tests/audit-creator-build-test.mjs
```

The source test audits trackable `game/` files and rejects APK/native payloads,
legacy Cocos source, decompiler output, native bridges, and emulation code. The
build-audit suite creates synthetic APK/AAB archives; it reads the preserved APK
and `libgame.so` as exact-byte rejection fixtures but never installs, loads, or
executes either one.

Do not run the post-build entry point against the original source APK. When
Phase 7 produces a real Creator artifact, its separate command is:

```sh
node scripts/audit-creator-build.mjs path/to/creator-build.apk
```

The positive and negative reconstruction-policy gates do not execute native
content and remain safe to include in a broad final run:

```sh
sh tests/reconstruction-policy-test.sh
sh tests/reconstruction-policy-negative-test.sh
```

The historical `tests/inventory-apk-test.sh` and
`tests/analyze-native-static-test.sh` baselines remain `14/14` and `7/7`.
They inspect the preserved evidence corpus and are not needed to prove this
pause/composition-only change; rerun them only if the evidence, inventory, or
static-analysis contracts changed.

### 6. Documentation and diff hygiene

```sh
node "$HOME/.claude/scripts/validate-docs.cjs" docs/
git diff --check
git status --short
git diff --name-only
```

The documentation validator is present at the recorded path. Existing reports
allow its known heuristic code-reference warnings, but internal-link validation
must pass. Review `git status --short` and `git diff --name-only` rather than
assuming a clean worktree: this checkpoint is being assembled in a shared,
already-dirty workspace.

## Recommendations: Creator 3.8.8 Browser Preview Workflow

### Established launch path

Repository evidence supports this workflow:

1. Use the already-open Cocos Creator 3.8.8 project rooted at `game/`.
2. Open `game/assets/scenes/classic.scene`.
3. Let Creator finish source import/reimport. If the served bundle is older than
   the source changes, refresh the Asset Database before claiming a fresh run.
4. Launch Creator's Browser Preview from the editor.
5. Use a normal existing Chrome profile/tab for the served Preview.

No repository report records a stable standalone Preview URL, port, or
headless/CLI launch command. No Creator command is on `PATH`. Earlier successful
runs were explicitly Creator-served, and the final Crazy Bird run used the
existing normal Chrome profile rather than an isolated profile. Browser or CUA
inspection therefore depends on Creator already running, the project being
open, the scene being current, and the editor having started the Preview
server. Starting browser automation alone is insufficient.

### Profile pair

- Compact: physical `360x800` device preset; runtime must select logical and
  resource profile `480x800`.
- High: physical/design profile `720x1280`; runtime must select logical and
  resource profile `720x1280`.

The reports do not establish whether the physical viewport was selected through
Creator's Preview controls or Chrome responsive controls. Verify the runtime's
selected logical/resource tree rather than inferring it from browser pixels.

### Final runtime-visible smoke

Run in both profiles after a fresh reimport:

1. Recovered Loading renders and hands off to one stable Main Menu.
2. Main Menu -> Mode Select -> Classic.
3. Classic reaches live gameplay and exposes the recovered Pause surface.
4. Pause -> Resume returns to the same run.
5. Pause -> Replay installs one fresh Classic root/session and resets pause
   ownership.
6. Pause -> Quit commits one Main Menu and retires Classic ownership.
7. Repeat Classic entry once to catch stale input, Physics2D, screen, listener,
   or pause-presenter leases.

Before the smoke, clear pre-existing browser DevTools and Cocos Editor console
output. Inspect both after the run:

- zero game/application runtime errors;
- zero Cocos Editor warnings/errors and preferably `0 / 0 / 0` counters;
- exactly one current screen;
- no stale navigation/result request or fatal lifecycle capture; and
- one expected active input/physics owner in Classic, none after Main Menu
  commit.

An unrelated `chrome-extension://.../share-modal.js` error has appeared in the
user's normal profile and must be attributed separately from game output.
Creator's own engine splash may appear before Loading and is editor-owned.
Browser focus changes have not reliably emitted Cocos app-hide, so app-hide save
ordering remains a test/source-review gate rather than Preview evidence.

## Evidence Used

- `phase-06-recreate-full-game-content-and-progression.md`
- `docs/cocos-creator-contract-map.md`
- `explorer-2026-07-24-scene-composition-reconciliation-map.md`
- `tester-2026-07-24-loading-final-checkpoint.md`
- `tester-2026-07-24-zero-unknown-resource-closure.md`
- route, Options, Objectives, About, Leaderboard, and standard-blade tester
  checkpoints dated 2026-07-24
- current script CLI parsers and test sources

## Unresolved Questions

- The exact Creator UI control sequence and Preview URL/port were not recorded;
  only the editor-open, scene-open, Creator-served Browser Preview workflow is
  evidenced. Refresh the already-open editor Preview after reimport.
- Release rights for recovered content and the unsupported Cooper Black OTF
  remain Phase 7/release blockers, not pause/composition regressions.

Status: DONE
Summary: Exact Phase 6 command gate and the established two-profile,
Creator-served Preview workflow are mapped without executing tests or native
content.
Concerns/Blockers: Preview inspection depends on an already-running Creator UI;
the exact Preview URL/port is not repository-recorded.

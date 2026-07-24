# Phase 6 Zero-Unknown Resource Closure Review

Date: 2026-07-24
Review type: pre-landing, two pass (blocking then informational)
Verdict: **APPROVE the resource-classification checkpoint; no blocking findings**

## Code Review Summary

### Scope

- Core artifacts: `forensics/resources/resource-disposition-map.json`,
  `scripts/generate-resource-reconciliation-ledger.mjs`,
  `tests/generate-resource-reconciliation-ledger-test.mjs`,
  `assets/catalog/resource-reconciliation-ledger.json`, and
  `assets/catalog/creator-staging-manifest.json`.
- Evidence reviewed:
  `explorer-2026-07-24-advanced-blade-architecture-map.md`,
  `researcher-2026-07-24-advanced-blade-native-contract.md`, and
  `researcher-2026-07-24-nonblade-unused-resource-contract.md`.
- Static corroboration: full recovered `libgame.so` `.text`, raw string table, dynamic
  symbols, relocations, constructor-pointer bytes, and APK data inventory. The APK and
  `libgame.so` were never executed.
- Diff size for the five core artifacts: 677 additions, 491 deletions, 1,168 changed
  lines.
- Focus: whether all 100 `excluded` entries and the one `unsupported` entry have a
  defensible recovered-Android disposition, generated artifacts are internally
  consistent, and no runtime consumer was invented.
- Scout result: four apparent evidence gaps were challenged with full-image scans and
  resolved. No contrary static evidence remains.

### Overall Assessment

The `862/862` resource ledger is closed correctly for its declared scope,
`recovered-apk-assets-without-current-consumers`: `761 consumed`, `0 unknown`,
`100 excluded`, and `1 unsupported`. The 100 exclusions are supported by recovered
Android reachability evidence, not merely by absence from the current TypeScript
registry. The generated ledger and manifest reproduce the source hashes and each
other's classifications. No application runtime file changed and no excluded asset was
added to the consumer registry.

This approval is limited to resource classification. It does not establish broader
Phase 6 scene/composition completeness, release rights, or historical intent for assets
that the recovered Android binary cannot reach.

## Blocking Pass

### Critical Issues

None.

### High Priority

None.

## Informational Pass

### Medium Priority

1. **The checked state-completeness criterion is broader than this checkpoint proves.**
   `forensics/resources/resource-disposition-map.json:3` limits the authority to assets
   without current consumers, while
   `phase-06-recreate-full-game-content-and-progression.md:230` still leaves
   scene/prefab/composition reconciliation open. Therefore the checked statement at
   `phase-06-recreate-full-game-content-and-progression.md:235`—“Every statically
   identified state…”—does not follow from zero-unknown resource closure alone.
   Leave that criterion open, or cite a separate exhaustive state inventory before
   treating it as complete. This does not invalidate the resource ledger.

### Low Priority

1. **The added tests verify disposition projection, not native reachability.**
   `tests/generate-resource-reconciliation-ledger-test.mjs:217-225` proves that the ten
   declared groups generate as `excluded`; because the disposition map is the input
   authority, this assertion cannot detect a semantically wrong exclusion. Native
   reachability is supported by the static reports and the independent full-image
   checks below. Describe these as ledger-integrity tests rather than native
   reachability tests, particularly where `docs/evidence-register.md:55` summarizes the
   verification.

## Exclusion Evidence

The 100 excluded physical entries reconcile exactly:

| Group | Excluded entries | Static closure |
|---|---:|---|
| About iOS raster | 2 | Android About loads only `aboutbackground.png`; no iOS-path consumer |
| Advanced Bolts | 12 | No path, pattern, symbol, relocation, selector ID, data owner, or callback |
| Alternate Centipede | 6 | ID 17 loads only the unnumbered triplet; no later lifecycle load |
| Named Dragon aliases | 24 | IDs 13–16 format only generic Dragon paths; named trees are byte aliases |
| Guidtar family | 14 | No Guidtar/Guitar path, pattern, symbol, relocation, ID, or data owner |
| Lightning clouds | 10 | Particle dispatch has no cloud path/emitter; only lightning audio literals exist |
| Bomb ID 1 | 2 | Type 2 is the sole route; exhaustive production factory calls use only 0, 1, 3, 4, 5, 6 |
| Orange back button | 2 | No native/Java literal, format path, or owner |
| Options index extras | 8 | Recovered loops are background 0–7 and blade 0–17 |
| Rank/new-best art | 8 | `CheckForMedal` directly creates only `object-medal-none.png` |
| Packaged Test family | 6 | Test constructors have no call, relocation, or stored function-pointer path |
| Unowned TTF fonts | 6 | Raw ELF and app-owned Java contain only the nine live font names and no formatter |
| **Total** | **100** | |

`Fonts/CooperBlackStd.otf` is the single `unsupported` entry. It remains byte-preserved
but has no supported Cocos Creator font consumer; it is not hidden inside the excluded
count.

## Edge Cases Found by Scout

- **Bomb ID 1 / mutable toss type:** full `.text` scanning found exactly four calls to
  `TossTurn::setType(int)`, all in the four toss factories. Exhaustive calls to those
  factories pass only types `{0,1,3,4,5,6}`. No direct write to the `+0x104` type field
  exists elsewhere. `GetNewTossObject` is the sole type-2-to-`Bomb::create(world, 1)`
  branch, so the branch is unreachable from every production scheduler.
- **Compiled Test layers / indirect construction:** there is no `BL`/`BLX` call or
  relocation to `AnimationTestLayer`, `BladeTestLayer`, `DrawPrimitiesTest`, or
  `TestBox2DLayer`. Each Thumb constructor address appears only twice, both inside
  `.dynsym`, and nowhere in a factory/callback table. Startup calls
  `LoadingScene::scene()` and then `runWithScene()`.
- **Uppercase font names / parser sensitivity:** a raw, case-insensitive
  `/usr/bin/strings` scan independently found exactly the nine live font names. The six
  excluded names and any generic `Fonts` formatter are absent from the ELF and
  app-owned Java. This conclusion does not depend on the catalog parser.
- **Bolts, Guidtar, and Lightning clouds / non-blade owners:** full uncurated raw
  strings, dynamic symbols, both relocation tables, selector code, particle dispatch,
  and APK data files were searched. No path-building pattern or indirect owner exists.
- **Rank art:** `DisplayScoreLayer::CheckForMedal` unconditionally selects
  `object-medal-none.png`; numbered medals and new-best art have no native or Java path.

## Generated-Artifact Verification

- Ledger: 862 unique, sorted entries; `761/0/100/1` consumed/unknown/excluded/unsupported.
- Manifest: 862 unique entries with zero ledger/manifest projection mismatches.
- Source hashes embedded in the ledger match current bytes:
  - disposition map:
    `0f35b71edf6ad61c2d2d12259ca6ee10f454dc3f281a2aae899fd5f5cdf9b81f`
  - consumer registry:
    `d4fb8486b10f245fdf6b9883453fa8b9a8c0d3cff2a5778d86ac4a8643c5913f`
  - resource usage map:
    `165238f13f4186a9ab429c9c5a8bab07b4a42e941d0608f757d9e41a44d2ce67`
- Ledger hash:
  `18ea8ef7ae3fb3751d530dd89426979d601fd8e918d5e9b539a1b8d969daacae`;
  the manifest's reconciliation authority matches it.
- Manifest hash:
  `a2697c58152451e8a234a39404191263c9d60c2eba1fb1f352722816b1cdd606`.
- `761` consumer-registry paths and the `101` reviewed disposition paths do not overlap.
  The checkpoint diff contains no `game/assets/scripts` change, so it invents no runtime
  consumer.
- Fresh focused verification passed `41/41` tests:
  `node --test tests/generate-resource-reconciliation-ledger-test.mjs
  tests/stage-creator-assets-test.mjs
  tests/reconstruction/vertical-slice/resource-consumer-registry.test.ts`.
- `git diff --check` reported no scoped whitespace errors.

## Behavioral Checklist

- Concurrency: no new shared mutable runtime state; deterministic generation and stale
  write/race rejection remain covered.
- Error boundaries: generator invariants fail closed on missing paths, overlaps, count
  drift, hash drift, and stale output.
- API contracts: ledger/manifest schema and status vocabulary are unchanged.
- Backwards compatibility: no runtime export, save schema, or database change.
- Input validation: disposition paths and statuses are validated at the generator
  boundary; omitted paths do not silently become `unknown`.
- Auth/authz: not applicable to local, deterministic build artifacts.
- N+1/query efficiency: no database or remote query path.
- Data exposure: generated artifacts contain source-relative evidence, not secrets,
  credentials, PII, or stack traces.
- Fact-check: counts, group membership, hashes, native call paths, and open Phase 6
  tasks were checked against current files rather than plan prose.

## Recommended Actions

1. Land the disposition map, generator, tests, both generated artifacts, and referenced
   evidence reports atomically.
2. Accept the zero-unknown resource checkpoint.
3. Correct or separately substantiate the broader checked state-completeness criterion.
4. Keep native reachability evidence distinct from ledger-integrity test evidence.
5. Continue the still-open scene/prefab/composition and final Phase 6 verification
   gates; do not infer their completion from this approval.

## Plan Follow-ups

- Complete: global `862`-asset consumer/disposition ledger and schema-v2 staging
  manifest; asset/audio classification success criterion.
- Still open: scene/prefab/composition reconciliation, recovered-versus-inferred
  reporting, all mode/progression fixtures, save corruption/reset coverage, public-build
  rights clearance, and the final new-TypeScript/no-original-runtime audit.

## Metrics

- Type Coverage: not applicable to this JSON/Node artifact checkpoint.
- Test Coverage: no line/branch percentage collected; focused result `41/41` passing.
- Linting Issues: dedicated lint count not collected; `git diff --check` found 0
  whitespace errors.

## Unresolved Questions

- Historical intent for unreachable packaged assets remains unknown by policy. This is
  not a recovered-Android runtime-classification blocker.
- Public redistribution rights remain a separate, explicitly open Phase 6 gate.

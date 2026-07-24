---
type: explorer
date: 2026-07-24
status: complete
---

# Resource ledger implementation map

## Summary

`scripts/stage-creator-assets.mjs` is the sole authority that generates
`assets/catalog/creator-staging-manifest.json`. Its `verify` path rebuilds the
expected JSON and compares the entire serialization byte-for-byte, so changing
`consumerStatus` in the manifest directly is both unsafe and guaranteed to fail.

Implement the ledger as a second validated input to that generator:

```text
current domain contracts + reviewed non-consumer dispositions
  -> generated resource-reconciliation-ledger.json
  -> stage-creator-assets.mjs
  -> generated creator-staging-manifest.json
```

The current live set is reproducible without filename inference: **654** unique
paths from explicit feature contract roots, plus **88** new paths from the two
50-raster Standard Blade enumerations, plus the explicit Crazy Dragon
`Fonts/Razing.ttf` consumer = **743 exact canonical paths**. All 743 occur in the
862-row staging inventory.

## Current authority and integration points

### Generator chain

| Artifact | Current authority | Role | Slice 1 action |
|---|---|---|---|
| `forensics/resources/resource-usage-map.json` | `scripts/catalog-static-resources.mjs` | Immutable recovered-corpus inventory and static native-string correlations | No schema or generator change. Runtime consumer knowledge does not belong in the forensic map. |
| `assets/catalog/creator-staging-manifest.json` | `scripts/stage-creator-assets.mjs` | Deterministic exact-byte staging manifest | Add the generated consumer ledger as a required input and regenerate; never hand-edit. |
| Creator metadata audit | `scripts/validate-creator-resource-meta.mjs` | Staged bytes, sidecars, importers, UUIDs, trim state | Stop pinning the complete mutable manifest serialization; validate the immutable inventory projection and schema instead. |

`stage-creator-assets.mjs` integration points:

- `flattenResourceMap()` creates and sorts all 862 base entries. It currently
  hard-codes `consumerStatus: "unmapped"`.
- `buildManifest()` hard-codes `summary.consumers` to `0/862`.
- `serializedManifest()` is the only serializer.
- `verifyAssets()` recreates that serialization and byte-compares it with the
  checked-in manifest.
- `parseCli()` currently accepts only `--source`, `--resource-map`, `--target`,
  and `--manifest`.
- `formatResult()` also hard-codes `consumer_coverage=0%`.

The stage script already provides the required safety primitives: exact path and
hash validation, stable reads, case/NFC collision rejection, sorted entries,
write-to-absent publication, and deterministic JSON.

### Current manifest schema

Schema version 1 contains:

- immutable entry identity: `canonicalPath`, `targetPath`, `logicalId`, `bytes`,
  `sha256`, `extension`, `cocosType`, `importPolicy`;
- unresolved independent concerns: `rightsStatus`, `creatorMetaStatus`,
  `creatorUuidStatus`;
- stale consumer field: `consumerStatus: "unmapped"`;
- stale counter:
  `summary.consumers = { mapped: 0, total: 862, coveragePercent: 0, status: "unmapped" }`.

Do not fold rights, metadata, UUID, or sample-project completeness into consumer
closure. They have different authorities and remain separate gates.

## Exact 743-path registry

Create
`game/assets/scripts/domain/resource-consumer-registry.ts` as the explicit,
Cocos-free aggregate. It should collect only the approved roots below, attach a
stable consumer owner to each path, deduplicate by exact `canonicalPath`, and sort
with ordinal text comparison.

| Registry owner | Exact existing roots to enumerate | Raw paths | New paths in this fixed order | Cumulative |
|---|---|---:|---:|---:|
| `about` | `ABOUT_SHARED_RESOURCES`; `collectAboutRasterResources(tree)` for both trees | 21 | 21 | 21 |
| `base-gameplay` | `BASE_GAMEPLAY_ARIAL_FONT_RESOURCE`; `listBaseGameplayRasterResources(tree)` | 27 | 27 | 48 |
| `bird` | `listBirdRasterResources(tree, type)` for both trees and types `1,2,3` | 82 | 78 | 126 |
| `classic-audio` | result-rank, ordinary-bomb, swish, fruit-cut, combo, and core audio exported collections | 31 | 30 | 156 |
| `classic-presentation` | the four font roots plus normal-fruit, presentation, result, bomb, bomb-smoke, default-blade, and critical-particle exported roots | 116 | 116 | 272 |
| `combo-bird` | `COMBO_BIRD_TIME_MANAGER_FONT_RESOURCE`; `listComboBirdSupplementalRasterResources(tree)` | 15 | 15 | 287 |
| `crazy-audio` | `CRAZY_REQUIRED_STAGED_AUDIO_PATHS` | 24 | 20 | 307 |
| `crazy-presentation` | `CRAZY_TIME_MANAGER_FONT_RESOURCE`, `CRAZY_SPECIAL_FRUIT_RESOURCES`, `getCrazySupplementalRasterResources(tree)` | 75 | 68 | 375 |
| `gn-style` | `GN_STYLE_BACKGROUND_MUSIC_PATH`; `listGnStyleSupplementalRasterResources(tree)` | 23 | 9 | 384 |
| `leaderboard` | `LEADERBOARD_SHARED_RESOURCES`; `getLeaderboardRasterResources(tree)` | 23 | 22 | 406 |
| `main-menu` | `MAIN_MENU_SHARED_RESOURCES`; `getMainMenuRasterResources(tree)` | 71 | 44 | 450 |
| `mode-select` | `MODE_SELECT_SHARED_RESOURCES`; `getModeSelectRasterResources(tree)` | 91 | 40 | 490 |
| `objectives` | `OBJECTIVES_SCREEN_SHARED_RESOURCES`; `collectObjectivesScreenRasterResources(tree)` | 22 | 16 | 506 |
| `options` | `OPTIONS_SHARED_RESOURCES`; `getOptionsRasterResources(tree)` | 106 | 98 | 604 |
| `shared-scene` | `SHARED_BACKGROUND_RESOURCES`, `SHARED_THEME_RESOURCES`, `SHARED_LEAF_RESOURCES` | 52 | 50 | 654 |
| `standard-blade` | `getStandardBladeRasterResources(tree)` for both trees | 100 | 88 | 742 |
| `crazy-dragon-counter` | `CRAZY_DRAGON_COUNTER_FONT_PATH` from `crazy-dragon-fruit-state.ts` | 1 | 1 | **743** |

The Standard Blade call must be explicit: that module exports generated functions,
not a complete static resource object. `Fonts/Razing.ttf` is the only live
production resource not covered by the 16 resource/audio/shared modules; it is
already an explicit domain constant and loaded by `crazy-dragon-font-loader.ts`.

The generator must not recursively inspect entire module namespaces. That would
eventually misclassify prohibited paths, excluded paths, or evidence-only
constants. It should recursively extract `canonicalPath` only from the explicit
roots above, while accepting direct canonical strings from the approved audio/font
roots.

A source-literal scan may remain an audit backstop. Today it finds exactly one path
outside the contract union—`Fonts/Razing.ttf`—and should fail if a future live
literal is absent from the explicit registry. It must not become generation
authority.

## Reviewed dispositions and schema v2

Create a small human-reviewed input:
`forensics/resources/resource-disposition-map.json`. It contains only paths with
no live consumer. The generator must not default missing paths to `unknown`.

Recommended baseline after reviewing the existing gap map:

| Status | Count | Meaning |
|---|---:|---|
| `consumed` | 743 | Exact path is emitted by at least one approved live consumer root. Derived only; never hand-declared. |
| `unknown` | 108 | No live owner is proven and no stronger exclusion/unsupported decision exists. Includes the prior 18 documented unknowns plus the 90 unclassified gaps. |
| `excluded` | 10 | Two Android About-iOS paths and eight Options extras are deliberately outside current runtime iteration. |
| `unsupported` | 1 | `Fonts/CooperBlackStd.otf` is preserved but not a supported Creator Font consumer. |
| **Total** | **862** | Every path has exactly one status. |

Promoting the 90 unclassified gaps to `unknown` must be an explicit reviewed input
change, not generator fallback. `unknown` closes classification, not runtime
coverage.

Recommended manifest schema version 2:

```json
{
  "summary": {
    "consumers": {
      "consumed": 743,
      "total": 862,
      "coveragePercent": 86.19,
      "status": "partial"
    },
    "reconciliation": {
      "classified": 862,
      "consumed": 743,
      "unknown": 108,
      "excluded": 10,
      "unsupported": 1,
      "total": 862,
      "coveragePercent": 100,
      "status": "complete"
    }
  },
  "entries": [
    {
      "canonicalPath": "…",
      "consumerStatus": "consumed",
      "consumerIds": ["…"]
    }
  ]
}
```

Rules:

- `consumed` requires at least one sorted, unique `consumerIds` value.
- `unknown`, `excluded`, and `unsupported` require a non-empty reviewed reason
  and must not carry consumer owners.
- A path emitted by both the live registry and dispositions is a hard conflict.
- A staged path emitted by neither is a hard omission.
- A registry/disposition path absent from the 862-file inventory is a hard error.
- Status totals are derived from entries, never independently authored.
- Percent is derived as `round(count / total * 100, 2)`; counts remain the
  authoritative comparison.
- `rightsStatus`, `creatorMetaStatus`, and `creatorUuidStatus` remain unchanged in
  this slice.

The generated `assets/catalog/resource-reconciliation-ledger.json` should contain the
862 sorted `{canonicalPath, consumerStatus, consumerIds/reason}` records plus
the status summary. The staging manifest merges those records into the immutable
inventory entries and records the ledger schema/hash in `source`.

## Edge cases and invariants

| Edge | Required behavior |
|---|---|
| Resolution profiles | Consumer enumerators run separately for `480x800` and `720x1280`. Disposition source may use `{logicalPath, trees:[…]}`, but the generator must expand to exact canonical paths and prove each exists. Never infer a missing partner. |
| Shared resources | `Sounds/**` and `Fonts/**` are exact shared paths; never prepend a tree. |
| Intentional logical-ID duplicates | Profile pairs share `logicalId`; ledger identity is `canonicalPath`, not `logicalId`. |
| Case and Unicode | Compare exact POSIX paths. Use the existing lowercase+NFC key only to reject collisions, never to resolve a match. `Comic Book.ttf`, `BOD_B.TTF`, and other case/space spellings remain exact. |
| Extensions | Preserve canonical extension spelling even though importer classification lowercases it. |
| Hash aliases | Never consume, merge, or classify by SHA-256. Named Dragon copies, Test aliases, and identical audio clips remain distinct canonical rows. |
| Multiple consumers | Union and sort owners; summary counts one file, not owner references. |
| Excluded/prohibited constants | They are not consumers. Only explicit approved resource roots feed the live registry. |
| Future implementation | Moving a path from `unknown` to `consumed` requires adding a real contract owner and removing its disposition in the same change. |
| Determinism | Sort canonical paths and owner IDs ordinally; omit timestamps and absolute paths; serialize with two-space JSON plus one trailing newline. |

## Exact implementation surface

### Create

| File | Responsibility |
|---|---|
| `game/assets/scripts/domain/resource-consumer-registry.ts` | Explicit 743-path aggregate and owner map. No Cocos imports. |
| `tests/reconstruction/vertical-slice/resource-consumer-registry.test.ts` | Assert exact `743`, all paths staged, fixed source-root coverage, no case collisions, no source-literal escape, and deterministic ordering. |
| `forensics/resources/resource-disposition-map.json` | Reviewed non-consumer decisions only; 108 unknown, 10 excluded, 1 unsupported after expansion. |
| `scripts/generate-resource-reconciliation-ledger.mjs` | Load the TypeScript aggregate under Node 22, byte-pin the resource map, validate/expand dispositions, and write one deterministic absent ledger. It never publishes the staging manifest. |
| `tests/generate-resource-reconciliation-ledger-test.mjs` | Determinism, curated-output parity, map-byte drift, missing/conflicting/invalid status, profile expansion, overlap, and stale-output fixtures. |
| `assets/catalog/resource-reconciliation-ledger.json` | Generated 862-row ledger; never hand-edited. |

### Modify

| File | Exact change |
|---|---|
| `scripts/stage-creator-assets.mjs` | Require `--reconciliation` for canonical staging; stable-read and validate it; merge by exact canonical path in `flattenResourceMap()`/`buildManifest()`; emit schema v2 summaries; update `formatResult()`; make `verify` rederive the ledger-backed serialization. Add a read-only `render-manifest` mode that validates source and target and writes only to an absent manifest path. |
| `tests/stage-creator-assets-test.mjs` | Replace `0/862` expectations; assert 743/108/10/1 counters; add ledger tamper/conflict/omission/extra/collision tests; retain the post-generation manifest-tamper rejection. Cover `render-manifest` non-mutation and no-overwrite behavior. |
| `assets/catalog/creator-staging-manifest.json` | Regenerate through the stage script only. |
| `scripts/validate-creator-resource-meta.mjs` | Remove the full mutable staging-manifest SHA pin as metadata authority. Validate schema v2, the immutable source manifest digest, counts/bytes, and entry projection; let `stage-creator-assets verify` own exact manifest serialization. |
| `tests/validate-creator-resource-meta-test.mjs` | Assert schema-v2 acceptance and immutable-inventory rejection without coupling metadata validity to consumer-status churn. |
| `docs/evidence-register.md` | Update generated manifest hash/size and describe ledger-backed consumer closure after implementation. |
| `docs/cocos-creator-contract-map.md`, `docs/codebase-summary.md`, `docs/project-overview-pdr.md` | Replace the stale global consumer-coverage claim only after tests and regenerated artifacts agree. |

### Deliberately unchanged

- `scripts/catalog-static-resources.mjs`
- `tests/catalog-static-resources-test.mjs`
- `forensics/resources/resource-usage-map.json`
- existing feature loaders and contracts, except adding future real consumers

The forensic catalog remains the physical/static authority. Mixing current
application ownership into it would make recovered evidence depend on mutable
reconstruction code.

## Safe generation and migration

Add `render-manifest` because current `stage` requires both target and manifest to
be absent, while the checked-in Creator target already exists. The mode should
reuse `loadAuthority()`, `verifyDestination()`, ledger validation, and
`serializedManifest()`, write only to an absent output, and never mutate the
target.

Expected commands after implementation:

```sh
resource_ledger_tmp_dir="$(mktemp -d)"

node scripts/generate-resource-reconciliation-ledger.mjs write \
  --resource-map forensics/resources/resource-usage-map.json \
  --registry game/assets/scripts/domain/resource-consumer-registry.ts \
  --dispositions forensics/resources/resource-disposition-map.json \
  --ledger "$resource_ledger_tmp_dir/resource-reconciliation-ledger.json"

node scripts/stage-creator-assets.mjs render-manifest \
  --source .forensics-work/phase-01/jadx/resources/assets \
  --resource-map forensics/resources/resource-usage-map.json \
  --reconciliation "$resource_ledger_tmp_dir/resource-reconciliation-ledger.json" \
  --target game/assets/game \
  --manifest "$resource_ledger_tmp_dir/creator-staging-manifest.json"
```

Compare generated temporary files with the curated/generated targets, then replace
the two generated repository artifacts as whole files. Do not edit JSON fields by
hand. After replacement:

```sh
node scripts/stage-creator-assets.mjs verify \
  --source .forensics-work/phase-01/jadx/resources/assets \
  --resource-map forensics/resources/resource-usage-map.json \
  --reconciliation assets/catalog/resource-reconciliation-ledger.json \
  --target game/assets/game \
  --manifest assets/catalog/creator-staging-manifest.json

node --test \
  tests/reconstruction/vertical-slice/resource-consumer-registry.test.ts \
  tests/generate-resource-reconciliation-ledger-test.mjs \
  tests/stage-creator-assets-test.mjs \
  tests/catalog-static-resources-test.mjs \
  tests/validate-creator-resource-meta-test.mjs
```

Then run `node --test tests/*.mjs`, the complete vertical-slice suite, strict
Creator TypeScript, and `git diff --check` because the manifest schema is a shared
contract.

## Non-overlapping implementation slices

| Order | Owner | Files | Dependency |
|---:|---|---|---|
| 1 | Domain registry | `resource-consumer-registry.ts`, its vertical-slice test, dispositions JSON | Existing contracts and approved 743-path map |
| 2 | Ledger generator | generator script/test and generated ledger JSON | Slice 1 schema and counts fixed |
| 3 | Stage integration | stage script/test and generated staging manifest | Slice 2 generated ledger |
| 4 | Metadata decoupling | metadata validator/test only | Schema v2 from Slice 3 |
| 5 | Evidence/docs closeout | evidence register and three status docs | All tests and final hashes |

Slices 1 and metadata research can proceed independently. Generated ledger and
manifest publication remain serial to prevent two owners changing derived
artifacts.

## Recommendations

1. Make the explicit domain aggregate—not a source-text scan—the live consumer
   authority.
2. Require reviewed non-consumer dispositions and prohibit implicit `unknown`.
3. Separate **86.19% runtime consumption** from **100% reconciliation
   classification** in counters and release claims.
4. Keep exact-path identity stronger than logical IDs, case folding, or hashes.
5. Preserve `stage-creator-assets verify` as the final byte-for-byte authority and
   add only a safe write-to-absent render mode for migration.

## Delivery status

Status: DONE

Summary: exact generator authority, 743-path registry inputs, schema/status
migration, file/test surface, commands, edge cases, and non-overlapping slices
mapped.

Concerns/Blockers: none for the implementation map; the reviewed disposition
authority explicitly retains the 90 previously unclassified paths as `unknown`.

## Unresolved questions

None. The initial migration explicitly records the 90 paths as `unknown`, and
the curated registry uses stable feature-level `consumerIds`.

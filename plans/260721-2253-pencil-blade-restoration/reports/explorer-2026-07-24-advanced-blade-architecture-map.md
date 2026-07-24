---
type: explorer
date: 2026-07-24
status: done
scope: Creator standard-blade architecture and the 66 advanced-blade-adjacent staged resources
method: repository and static-native evidence review only
---

# Advanced Blade Architecture and Resource Gap Map

## Outcome

The 66 staged files are 33 logical resources copied into both resolution trees. They are not one
implementable advanced-blade closure:

- **[RECOVERED]** the native standard-blade constructor boundary is closed to Basic IDs `0..12`,
  Dragon IDs `13..16` with variant `id - 13`, and Centipede ID `17`. An out-of-range selected ID
  constructs no standard blade. See
  `explorer-2026-07-24-advanced-blade-static-contract.md:94-103` and the current matching Creator
  contract at `game/assets/scripts/domain/standard-blade-resource-contract.ts:4-19`.
- **[RECOVERED]** native Dragon loads only
  `Blades/Dragon/dragon-{head,body,tail}-%d.png`; native Centipede loads only the unnumbered
  `Blades/Centipede/{head,body,tail}.png`. Construction eagerly creates one head, 15/20 bodies,
  and one tail per slot, with four slots and `InitializeWithMaximumPoint(32)`. No later
  update/draw/dispose load expands that resource closure.
- **[RECOVERED]** the 24 named Dragon files are compact-resolution alias copies, not another
  native family. Both named-tree copies are byte-identical to the matching `480x800` generic
  variant, while neither named copy matches the scaled `720x1280` generic variant. Mapping:
  Blue/water -> variant 0 / ID 13, Black -> variant 1 / ID 14, Red -> variant 2 / ID 15, and
  Gold -> variant 3 / ID 16.
- **[RECOVERED RUNTIME EXCLUSION]** an exhaustive audit of the complete 315-entry native
  resource-string corpus has zero target paths or target filename patterns, and the binary has
  zero Bolt, Guidtar, Lightning, or Cloud classes. Combined with the exhaustive closed
  `PhysicsBladeLayer::onEnter` dispatch, this proves that all 66 files are outside the recovered
  Android runtime contract.
- **[UNKNOWN HISTORICAL MECHANICS]** the original purpose of Bolts, alternate Centipede,
  Guidtar, and Lightning clouds remains unknown. They may be abandoned, removed, cross-platform,
  or pre-release data. That historical uncertainty does not change their recovered-runtime
  exclusion and does not authorize a speculative implementation.

### Concrete recommendation

The next production slice should be **classification-only for all 66 files**:

1. Reclassify all five scoped disposition groups from `unknown` to `excluded`, citing the
   exhaustive native string/class/dispatch audit. Preserve the family-specific reasons and the
   named Dragon SHA-256 alias evidence.
2. Regenerate the resource reconciliation ledger and staging manifest.
3. Do not add any of the 66 paths to the standard-blade resource contract, loader, registry, or
   any presenter.
4. Keep unknown historical mechanics explicitly documented; `excluded` is a recovered-runtime
   reconciliation status, not a claim that the assets never had an intended feature.

That slice changes no runtime consumer and no gameplay behavior. Expected reconciliation after
the slice:

| Metric | Current | Recommended slice |
|---|---:|---:|
| Staged | 862 | 862 |
| Consumed | 761 | 761 |
| Unknown | 90 | 24 |
| Excluded | 10 | 76 |
| Unsupported | 1 | 1 |
| Disposition paths | 101 | 101 |
| Runtime coverage | 761/862 (88.28%) | 761/862 (88.28%) |
| Reconciliation coverage | 862/862 | 862/862 |

No runtime implementation is warranted. If new primary evidence later contradicts the exhaustive
audit and recovers a complete owner and behavior contract, the affected family can be
reclassified and implemented then. Filename proximity, directory names, shared dimensions, and
byte identity across the two packaged trees remain insufficient consumer evidence.

## Evidence Boundary

- No APK, `libgame.so`, or game runtime was executed.
- Static-native addresses, symbols, and resource strings come from
  `plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-advanced-blade-static-contract.md`.
- The exhaustive 315-string corpus audit, class/symbol audit, closed constructor dispatch, and
  per-family disposition verdict come from
  `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-advanced-blade-native-contract.md`.
- Exact packaged paths, dimensions, and SHA-256 values come from
  `forensics/resources/resource-usage-map.json`.
- Current classifications come from `forensics/resources/resource-disposition-map.json`.
- Current generated status and ownership come from
  `assets/catalog/resource-reconciliation-ledger.json`.
- The disposition policy defines `excluded` as preserved exactly but intentionally outside the
  recovered Android runtime contract. It does not require proof of historical product intent.
- `forensics/README.md` keeps gameplay conclusions separated as recovered, inferred, or unknown
  and records that redistribution rights remain unresolved. Classification does not clear those
  rights.

## Exact 66-File Gap

Every row below is a logical-path group expanded into `480x800/` and `720x1280/` canonical paths.
All 66 current ledger entries have status `unknown`; the exhaustive runtime audit now makes that
classification stale.

| Disposition ID | Logical paths | Canonical files | Static result | Decision |
|---|---:|---:|---|---|
| `advanced-blade-bolts-unowned` | 6 | 12 | No target string/class; no selected ID, constructor, sequence, or consumer | Change to `excluded` |
| `alternate-centipede-unowned` | 3 | 6 | Closed native ID 17 branch loads only the unnumbered triplet | Change to `excluded` |
| `named-dragon-duplicates-unowned` | 12 | 24 | Compact aliases of already-live generic variants; native loads only generic paths | Change to `excluded` |
| `guidtar-family-unowned` | 7 | 14 | No target string/class or resource/state/presentation owner; preserve canonical misspelling | Change to `excluded` |
| `lightning-cloud-particles-unowned` | 5 | 10 | No target string/class, emitter, blade ID, or mode owner | Change to `excluded` |
| **Total** | **33** | **66** | Exhaustively absent from recovered runtime | Exclude; no runtime promotion |

### Bolts

The corresponding low/high files are byte-identical, but no other resource uses those hashes.
That proves package duplication only.

| Logical path under `Blades/Bolts/` | Dimensions in both trees |
|---|---:|
| `MainBolt4.png` | 81 x 81 |
| `MainBolts.png` | 23 x 23 |
| `MainBolts1.png` | 23 x 23 |
| `MainBolts2.png` | 79 x 79 |
| `MainBolts3.png` | 80 x 80 |
| `SubBolts.png` | 7 x 7 |

### Alternate Centipede

All six hashes are distinct from each other and from the live unnumbered Centipede triplet.
The small dimension differences do not establish compatible topology.

| Logical path under `Blades/Centipede/` | `480x800` | `720x1280` | Live unnumbered comparison |
|---|---:|---:|---:|
| `body1.png` | 13 x 41 | 18 x 62 | 12 x 40 / 18 x 61 |
| `head1.png` | 48 x 44 | 71 x 66 | 47 x 44 / 70 x 66 |
| `tail1.png` | 51 x 15 | 76 x 21 | 51 x 14 / 76 x 22 |

There is no recovered second Centipede ID or variant index. Reusing ID 17's 20-body model for
these files would be an unsupported filename inference.

### Named Dragon aliases

Each named triplet is 21 x 17 body, 92 x 63 head, and 53 x 22 tail in **both** trees.

| Named directory and stem | Live generic mapping | Exact byte relation |
|---|---|---|
| `BlueDragon/water_dragon_*` | variant 0 / ID 13 | both named copies equal generic `480x800` variant 0 |
| `BlackDragon/black_dragon_*` | variant 1 / ID 14 | both named copies equal generic `480x800` variant 1 |
| `RedDragon/red_dragon_*` | variant 2 / ID 15 | both named copies equal generic `480x800` variant 2 |
| `GoldDragon/gold_dragon_*` | variant 3 / ID 16 | both named copies equal generic `480x800` variant 3 |

The generic high-tree files are genuinely scaled (body about 33 x 27/28, head 139/140 x 95,
tail 80 x 33/34) and have different hashes. Treating the high-tree named copies as high-profile
resources would therefore regress geometry. Exclusion preserves the files without creating a
false canonical consumer.

### Guidtar

The corresponding files in both trees are byte-identical; no other path shares their hashes.

| Logical path under `Blades/Guidtar/` | Dimensions in both trees |
|---|---:|
| `guidtar.png` | 112 x 39 |
| `guidtar_line.png` | 256 x 256 |
| `nodes0.png` | 28 x 43 |
| `nodes1.png` | 40 x 36 |
| `nodes2.png` | 26 x 43 |
| `nodes3.png` | 35 x 44 |
| `nodes4.png` | 25 x 70 |

There is no recovered ordering, attachment graph, input model, state machine, or selected ID.
The `Guidtar` spelling is canonical package evidence and must not be silently corrected.

### Lightning clouds

The corresponding files in both trees are byte-identical; no other path shares their hashes.

| Logical path under `Blades/Particles/Lightning/` | Dimensions in both trees |
|---|---:|
| `cloud0.png` | 110 x 113 |
| `cloud1.png` | 121 x 124 |
| `cloud2.png` | 136 x 140 |
| `cloud3.png` | 104 x 106 |
| `cloud4.png` | 121 x 124 |

Recovered `Sounds/lightning1.wav` and `Sounds/lightning2.wav` strings do not establish a raster
emitter or blade owner. Audio-name proximity is not a consumption contract.

## Current Creator Architecture

### Closed resource and presentation path

| Layer | Current contract | Extension implication |
|---|---|---|
| Domain resource contract | `standard-blade-resource-contract.ts:4-19,267-402` defines exactly 18 IDs, 50 rasters per tree, Basic `0..12`, Dragon `13..16`, Centipede `17`, exact dimensions, and fail-closed lookup | Do not widen IDs or resource kinds without a recovered constructor branch |
| Pure advanced state | `standard-advanced-blade-state.ts:3-97` owns four slots, Dragon/Centipede-only family metadata, separate base/waved paths, 15/20 body pools, 20/10 sampling, and capacity 32 | A proven new behavior family should get its own pure state/plan unless native evidence proves identical semantics |
| Basic composition | `standard-basic-blade-presenter.ts` composes the classic trail with recovered particle presentation | Lightning cannot enter this composition without an exact basic ID and emitter contract |
| Advanced presenter | `standard-advanced-blade-presenter.ts:70-209` validates the exact multipart profile and allocates head/body/tail owners transactionally | Alternate Centipede may reuse it only if a native branch proves the same topology and lifecycle |
| Facade/dispatch | `standard-blade-presenter.ts:79-158` exhaustively dispatches `0..12`, `13..16`, and `17`; invalid or mismatched profiles fail | This is the single shared dispatch edit after, not before, a new ID/family contract exists |
| Resource catalog | `standard-blade-resource-loader.ts:181` eagerly loads the exact ordered 50-raster closure and rejects missing, reordered, duplicate, or mismatched resources | Never add quarantined files merely because they are already staged |
| Shared Classic catalog | `classic-resource-loader.ts` owns one `standardBlades` catalog used by menus and gameplay | A real closure change propagates to every standard-blade route |
| Consumer registry | `resource-consumer-registry.ts:235-237` registers the exact two-tree standard-blade closure | Named aliases stay absent because they are excluded, not consumed |

The existing state/presenter topology already matches the recovered live native constructors:

| Family | IDs | Slots | Bodies/slot | Sampling step | Waved cap | Configured points |
|---|---|---:|---:|---:|---:|---:|
| Dragon | 13..16 | 4 | 15 | 20 | 15 | 32 |
| Centipede | 17 | 4 | 20 | 10 | 20 | 32 |

### Route owners

All current standard-blade routes consume the same facade and catalog:

- Main Menu: `main-menu-presenter.ts:300-303`
- Mode Select: `mode-select-presenter.ts:320-323`
- Classic: `classic-gameplay-controller.ts:1201-1203`
- Crazy standard branch: `crazy-gameplay-controller.ts:1326-1328`
- GN Style: `gn-style-gameplay-controller.ts:976-978`
- Shell selection injection into fresh Main Menu and Mode Select owners:
  `recovered-app-shell-controller.ts:708-745,840-877`

Each route delegates begin/move/moved-segment/end/update/dispose through the facade. The proposed
classification-only slice affects none of them. If a future recovered ID changes selection
semantics, all five route suites plus shell and scene integration become mandatory gates.

## Surfaces Affected by the Recommended Slice

### Curated and generated data

1. Edit `forensics/resources/resource-disposition-map.json`: change all five scoped group
   statuses to `excluded`, replace absence-of-review reasons with recovered-runtime exclusion
   reasons, and add the exhaustive native-contract report to their evidence refs. Keep all 33
   logical paths unchanged.
2. Update `scripts/generate-resource-reconciliation-ledger.mjs:31-38` expected counts to
   `unknown: 24`, `excluded: 76`; leave `staged: 862`, `consumed: 761`,
   `unsupported: 1`, and `dispositions: 101`.
3. Update `tests/generate-resource-reconciliation-ledger-test.mjs:50-68,285-302` summary and CLI
   expectations, plus add a direct assertion that all 66 scoped files are excluded and absent
   from the consumer registry.
4. Regenerate `assets/catalog/resource-reconciliation-ledger.json`.
5. Regenerate `assets/catalog/creator-staging-manifest.json` using the staging script's
   `render-manifest` publication path. Do not restage asset bytes.
6. Refresh hashes and byte sizes for both generated artifacts in
   `docs/evidence-register.md:55,66`.

The source assets and existing `.meta` files do not change. `forensics/resources/resource-usage-map.json`
also does not change: it records recovered package facts, not consumer classification.

### Documentation counters

Update only claims made stale by the status change:

- `docs/cocos-creator-contract-map.md:38`
- `docs/project-overview-pdr.md:62-64`
- `docs/codebase-summary.md:91`
- generated-artifact hashes/sizes in `docs/evidence-register.md:55,66`

`docs/system-architecture.md:113` remains true because consumed coverage and complete
classification do not change. No runtime architecture document should claim a new consumer.

### Verification

Run the focused reconciliation gate:

```sh
node --test \
  tests/generate-resource-reconciliation-ledger-test.mjs \
  tests/stage-creator-assets-test.mjs \
  tests/validate-creator-resource-meta-test.mjs \
  tests/reconstruction/vertical-slice/resource-consumer-registry.test.ts
```

Also verify the generated ledger and manifest deterministically and run `git diff --check`.
The registry test must continue to prove:

- registry size `761`;
- disposition expansion size `101`;
- disjoint union size `862`;
- all 66 target files have reconciliation status `excluded`;
- all 66 target files remain absent from live consumers.

No Creator Preview is required for a pure classification change because no runtime bundle,
contract, or code changes. A preview would not add evidence about unreferenced paths.

## Surfaces for a Future Evidence-Backed Runtime Family

These are conditional, not authorization to implement any of the 66 excluded files. A future
runtime family first requires new primary evidence that overturns the recovered-runtime exclusion.

### Production

- `game/assets/scripts/domain/standard-blade-resource-contract.ts`
- a family-specific pure state/plan under `game/assets/scripts/domain/`
- a family-specific presenter under `game/assets/scripts/creator/`
- `game/assets/scripts/creator/standard-blade-resource-loader.ts`
- `game/assets/scripts/creator/standard-blade-presenter.ts`
- `game/assets/scripts/domain/resource-consumer-registry.ts`
- route controllers/presenters only if the recovered selection or lifecycle contract differs

### Tests

- `standard-blade-resource-contract.test.ts`
- `standard-blade-resource-loader.test.ts`
- `standard-blade-presenter.test.ts`
- a new family-specific state/plan test
- a new family-specific presenter fault/lifecycle test
- `main-menu-presenter.test.ts`
- `mode-select-presenter.test.ts`
- `crazy-gameplay-controller.test.ts`
- `gn-style-gameplay-controller.test.ts`
- `recovered-app-shell-controller.test.ts`
- `creator-scene-integration.test.ts`

There is no dedicated `classic-gameplay-controller.test.ts`; Classic ownership is presently
covered through scene integration and the shared resource/presenter tests. A future public
Classic routing change should add a focused controller regression rather than relying only on the
large integration suite.

Any consumed promotion would additionally require serial updates to the disposition map,
generator counts, ledger, manifest, documentation counters, and evidence-register hashes.

## Safe File-Ownership Boundaries

Parallel work is safe only before shared integration:

| Owner | May modify | Must not modify concurrently |
|---|---|---|
| Static evidence | plan-scoped reports only | Production or classifications |
| One proven family domain owner | new family-specific state/plan and its tests | Shared facade, loader, registry |
| One proven family presenter owner | new family-specific presenter and its tests | Shared facade, loader, registry |
| Shared integration owner | standard resource contract, loader, facade, route tests | Any second owner of those files |
| Reconciliation owner | disposition map, generator/test, ledger, manifest, docs counters/hashes | Runtime implementation files |

The standard resource contract, standard loader, standard facade, consumer registry,
disposition map, generator counts, ledger, and manifest are serialization points. Do not split
those files across agents.

For the recommended classification-only slice, use one reconciliation owner. No runtime owner is
needed.

## Staged Plan for Any Remaining Family

1. **Static owner gate.** Recover an exact selected ID or non-standard mode owner, constructor,
   canonical-path load, lifecycle calls, and any branch/variant mapping. Stop if any is missing.
2. **Closure gate.** Prove the complete resource set for both resolution trees, dimensions,
   ordering, aliases, and whether any resource is actually compact-only data copied into both
   trees.
3. **Behavior gate.** Recover sequencing, point/body topology, update cadence, disposal, emitter
   timing, blend, RNG order, and attachment depth as applicable. Keep unknowns explicit.
4. **Pure model first.** Implement and exhaustively test state/plan behavior without Cocos nodes.
5. **Transactional presenter.** Validate exact loaded resources before allocation; test partial
   construction, attach rollback, disposal, four-slot isolation, and invalid profiles.
6. **Shared dispatch last.** Extend the standard facade only when a recovered standard ID exists.
   A mode-owned effect should remain outside that facade.
7. **Route integration.** Exercise every actual owner and selection path. Do not infer all-route
   ownership merely because current IDs `0..17` are shared.
8. **Reconciliation serial pass.** Remove only proved consumed paths from dispositions, update
   exact counts, regenerate artifacts, refresh docs/evidence hashes, and run focused then broad
   tests.

This process promotes one complete recovered closure at a time. It never promotes any excluded
family merely because it shares an “advanced blade” directory neighborhood or because historical
mechanics remain unknown.

## Unresolved Questions

- Do Bolts, Guidtar, alternate Centipede, or Lightning clouds belong to a removed feature,
  another platform, or pre-release content? The exhaustive recovered Android runtime audit
  excludes them from this runtime but cannot distinguish those historical possibilities.
- Is there a separate binary, data table, or archived source outside the reviewed native corpus
  that supplies those 42 resources' owners and behavior?
- Redistribution rights for all recovered assets remain unresolved independently of technical
  classification.

Status: DONE
Summary: Current Creator architecture is closed and faithful for standard IDs 0..17. Reclassify all 66 scoped files as recovered-runtime excluded, regenerate reconciliation artifacts, and make no runtime extension.
Concerns/Blockers: None for the classification-only slice. Historical mechanics remain unknown and block any future runtime implementation absent new primary evidence.

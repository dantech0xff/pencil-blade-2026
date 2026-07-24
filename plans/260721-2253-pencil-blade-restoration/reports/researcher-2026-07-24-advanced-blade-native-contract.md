# Advanced Blade Native Ownership Contract
---
date: 2026-07-24
status: done-with-concerns
scope: static-only native reachability and resource ownership for the remaining advanced-blade families
evidence-policy: no APK, shared-library, emulator, device, or reconstructed runtime execution
---

## Summary

The recovered Android standard-blade runtime has exactly two advanced multipart owners:

- blade IDs `13..16` construct `DragonBlade(selectedId - 13)` and load only
  `Blades/Dragon/dragon-{head,body,tail}-%d.png`;
- blade ID `17` constructs the no-argument `CentipedeBlade` and loads only
  `Blades/Centipede/{head,body,tail}.png`.

The exhaustive `PhysicsBladeLayer::onEnter()` selector has no branch after ID `17`.
The complete 315-entry native resource-string corpus has no path or format pattern for
`Blades/Bolts/*`, `Blades/Guidtar/*`, `Blades/Particles/Lightning/cloud*`, the
Centipede `*1` triplet, or the named Dragon directories. The app-symbol map likewise has
no Bolt, Guidtar/Guitar, Lightning, or Cloud class.

That combined evidence is sufficient to classify all **33 logical / 66 physical target
rasters as excluded from the recovered standard-blade runtime**. In the
`resource-disposition-map.json` policy vocabulary, the five groups can move from
`unknown` to `excluded`: preserve the files, but do not give them a production loader or
presenter. “Dead-packaged” is safe only with that scope; the static evidence cannot prove
that the art was never used by an older build, unrecovered mode, or abandoned source branch.

The named Dragon files have the strongest closure. Every named triplet in both asset trees
is a compact-resolution copy of the corresponding `480x800` generic Dragon variant:
Blue/water -> variant `0` / ID `13`, Black -> variant `1` / ID `14`, Red -> variant `2` /
ID `15`, and Gold -> variant `3` / ID `16`. They are art aliases, not native path aliases:
the `720x1280` generic files are separately scaled and have different hashes. The safest
first implementation closure is therefore to record the named files as excluded compact
duplicate aliases and load none of them.

## Evidence and confidence

Native artifact: `.forensics-work/phase-01/native/libgame.so`

SHA-256:
`55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`

Primary evidence:

- `forensics/native/function-map.csv`;
- `forensics/resources/resource-usage-map.json`;
- `forensics/resources/resource-disposition-map.json`;
- `.forensics-work/phase-02/native/strings/all-offsets.txt`;
- `.forensics-work/phase-02/native/tool-versions.txt`;
- LLVM 19.0.1 static Thumb disassembly of the exact ranges below;
- `game/assets/scripts/domain/standard-blade-resource-contract.ts`;
- `game/assets/scripts/domain/standard-blade-particle-plan.ts`;
- `game/assets/scripts/domain/standard-advanced-blade-state.ts`;
- `game/assets/scripts/creator/standard-blade-resource-loader.ts`;
- `game/assets/scripts/creator/standard-advanced-blade-presenter.ts`;
- `plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-24-blade-runtime-gap-map.md`;
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-24-cosmetic-economy-native-contract.md`.

Confidence labels:

- **[RECOVERED]**: direct native string, symbol, instruction, branch, call, immediate,
  asset metadata, or exact hash equality.
- **[INFERRED]**: the most conservative meaning supported by multiple recovered facts.
- **[UNKNOWN]**: the reviewed static corpus does not establish the behavior.

This audit disassembled the ELF as data only. It did not load or execute the APK,
`libgame.so`, a device, or an emulator.

## Decisive native reachability boundary

### Exhaustive standard-blade selection

**[RECOVERED]** `PhysicsBladeLayer::onEnter()` is indexed at `0x001612c0`, size `448`.
Its selected-blade dispatch is exhaustive:

| Thumb site | Recovered decision |
|---:|---|
| `0x00161322` | compare selected ID with `12`; IDs `0..12` enter the four-slot `BasicBlade` loop |
| `0x00161380` | subtract `13` from the selected ID |
| `0x00161384` | compare the result with `3`; only IDs `13..16` enter the Dragon loop |
| `0x00161398` | call `DragonBlade::DragonBlade(int)` with variant `selectedId - 13` |
| `0x001613d0` | compare the original selected ID with `17` |
| `0x001613d2` | branch to `0x00161416` when the ID is not `17` |
| `0x001613e0` | call the no-argument `CentipedeBlade::CentipedeBlade()` for ID `17` |

Each accepted branch constructs four blade slots. No ID `18+` constructor exists in this
dispatch. The persisted economy also ends at `blade_price_17`; packaged
`blade-icon-{19,20,21}.png` files are explicitly outside the Options `0..17` iteration.
Therefore those icon numbers are contrary packaging signals, not evidence assigning Bolts,
Guidtar, Lightning, or alternate Centipede art to a blade ID.

### Complete native resource-string boundary

**[RECOVERED]** `resource-usage-map.json` indexes 315 resource-looking native strings:
282 exact logical matches, 17 `printf` patterns, and 16 unmatched strings. Filtering the
complete set for the relevant advanced directories returns exactly:

```text
Blades/Centipede/body.png
Blades/Centipede/head.png
Blades/Centipede/tail.png
Blades/Dragon/dragon-body-%d.png
Blades/Dragon/dragon-head-%d.png
Blades/Dragon/dragon-tail-%d.png
```

Their raw string offsets are:

| Native offset | String |
|---:|---|
| `0x003d0ef1` | `Blades/Centipede/head.png` |
| `0x003d0f0b` | `Blades/Centipede/body.png` |
| `0x003d0f25` | `Blades/Centipede/tail.png` |
| `0x003d10cd` | `Blades/Dragon/dragon-head-%d.png` |
| `0x003d10ee` | `Blades/Dragon/dragon-body-%d.png` |
| `0x003d110f` | `Blades/Dragon/dragon-tail-%d.png` |

There are zero strings containing the target Bolt, Guidtar, cloud, Centipede `*1`, or
named Dragon paths, and no broader format string that can synthesize them.

### Symbol boundary and contrary evidence

**[RECOVERED]** `function-map.csv` contains the full `DragonBlade` and `CentipedeBlade`
method families but zero app-symbol matches for `Bolt`, `Guidtar`, `Guitar`, `Lightning`,
or `Cloud`.

The only native “lightning” resource strings are audio paths
`Sounds/lightning1.wav` at `0x003d15d8` and `Sounds/lightning2.wav` at `0x003d15ee`.
Their names do not reference the cloud PNGs, and reviewed audio evidence establishes only
preload, not a play consumer. They are not contrary cloud ownership evidence.

Directory placement, filenames, and numbered sequences are real packaging evidence, but
none creates a call site. There is also no recovered particle/emitter `.plist`, `.json`,
or equivalent configuration that could indirectly name these PNGs.

## Recovered live advanced-blade contract

The live constructors are important negative evidence: they fully construct their sprite
pools up front, and later lifecycle methods do not load replacement art.

### Construction and resource sequence

| Owner | Constructor | Input | Initialization | Exact load sequence |
|---|---:|---|---|---|
| `DragonBlade` | `0x0014e26c`, size `388` | variant `0..3` | `InitializeWithMaximumPoint(32)` at `0x0014e2c2..0x0014e2c6` | formatted head once -> formatted body 15 times -> formatted tail once |
| `CentipedeBlade` | `0x00147734`, size `316` | none | `InitializeWithMaximumPoint(32)` at `0x00147778..0x0014777c` | unnumbered head once -> unnumbered body 20 times -> unnumbered tail once |

**[RECOVERED]** Dragon formats and creates the head at `0x0014e2ca..0x0014e2d2`,
the body at `0x0014e2f6..0x0014e300`, and the tail at
`0x0014e34e..0x0014e356`. The body loop counter is `15`. Every sprite starts hidden
and is added as a child at z-order `1`. The width of body sprite `0` is retained for
layout.

**[RECOVERED]** Centipede creates the head at `0x00147780..0x0014779e`, runs a
20-iteration body loop at `0x001477a0..0x001477ec`, and creates the tail at
`0x001477ee..0x0014780c`. These sprites also start hidden at z-order `1`, and body
sprite `0` supplies the retained body width.

The Centipede constructor takes no variant or suffix argument. The Dragon constructor's only
variant input is applied to the three generic `%d` strings. Those facts close both plausible
late-selection routes for the alternate and named files.

### Push, update, draw, and disposal

| Behavior | Dragon | Centipede |
|---|---:|---:|
| `Push(CCPoint)` | `0x0014e8a8`, size `400` | `0x00147cc8`, size `400` |
| subdivision step | `20.0f` (`0x41a00000`) | `10.0f` (`0x41200000`) |
| retained waved-point capacity | `15` | `20` |
| configured base capacity | `32` | `32` |
| active base overflow check | `>= 11` points, then erase one | same |
| wave | `sin(phase * 5) * 15` | same numeric form |
| `draw()` | `0x0014e3f0`, size `1208` | `0x00147870`, size `1112` |
| visible threshold | at least 3 waved points | at least 3 waved points |
| disposal opacity | `239` | `244` |

**[RECOVERED]** `Push` appends the first point to the straight and waved paths. Later
inputs are subdivided by the family step; a sub-step input produces no point. The waved
path drops its oldest entry after exceeding the capacity above. The scheduled `update(float)`
removes one oldest straight-path entry when an active path reaches 11 points.

**[RECOVERED]** `draw()` hides the whole multipart pool below three waved points.
Otherwise it positions body pieces at adjacent-point midpoints, rotates them to the path
angle, offsets the head and tail using sprite widths, applies current opacity, and uses
Dragon-specific body tapering. Neither draw function calls `CCSprite::create` or changes
the resource family.

**[RECOVERED]** `SetToDisposeState()` enters state `4`. A disposal update with at
least two straight anchors clears the waved path and applies opacity `239` for Dragon or
`244` for Centipede. With at most one anchor it calls `SetNew()`, which clears paths and
phase, restores opacity `255`, and hides the sprite pool. Destructors release the three
vector buffers and then call the base destructor. No update, draw, reset, disposal, or
destructor range contains a resource load.

**[UNKNOWN]** The exact wall-clock frequency of scheduled updates and draw calls is not
established by these class-local methods. Their `float dt` argument does not provide a
resource animation clock, and no target family can inherit timing from this evidence.

## Per-family ownership verdicts

| Family | Package evidence | Recovered standard-runtime verdict | Historical mechanic |
|---|---|---|---|
| `Blades/Bolts/*` | 6 logical / 12 physical PNGs; `MainBolts1..3` is a numeric sequence | **EXCLUDED**: no ID, branch, string, symbol, constructor, or config owner | **UNKNOWN** |
| `Blades/Guidtar/*` | 7 logical / 14 physical PNGs; exact misspelling preserved; `nodes0..4` sequence | **EXCLUDED**: no ID, branch, string, symbol, constructor, or config owner | **UNKNOWN** |
| Lightning `cloud0..4` | 5 logical / 10 physical RGBA PNGs; numeric sequence | **EXCLUDED**: no particle dispatch, string, emitter, blade ID, or mode owner | **UNKNOWN** |
| Centipede `body1/head1/tail1` | 3 logical / 6 physical, distinct from live triplet | **EXCLUDED**: ID `17` has one no-arg constructor using only unnumbered paths | **UNKNOWN** |
| named Dragon triplets | 12 logical / 24 physical compact alias copies | **EXCLUDED**: IDs `13..16` format only generic paths | intended path naming is **UNKNOWN**; art-role equivalence is recovered |

### Bolts

**[RECOVERED]** The files are:

```text
MainBolt4.png       81x81
MainBolts.png       23x23
MainBolts1.png      23x23
MainBolts2.png      79x79
MainBolts3.png      80x80
SubBolts.png         7x7
```

Both tree copies have identical dimensions and SHA-256 values. The resource map recognizes
only `MainBolts1..3` as a numeric sequence; `MainBolts.png`, singular `MainBolt4.png`, and
`SubBolts.png` are not members of that sequence.

**[INFERRED]** The names suggest main/sub effect parts, but they do not establish order,
concurrency, spawn counts, attachment points, animation, or blade ownership.

**[UNKNOWN]** No construction, update, draw, disposal, timing, blend, or ID contract is
recoverable. Implementing even a static Bolt sprite would invent behavior.

### Guidtar

**[RECOVERED]** `guidtar.png` is `112x39`, `guidtar_line.png` is `256x256`, and
`nodes0..4` range from `25x70` to `40x36`. Both tree copies are byte-identical. The exact
packaged spelling is `Guidtar` / `guidtar`; changing it to “Guitar” would not preserve the
resource path.

**[INFERRED]** The main, line, and five node names suggest a composite effect. They do not
prove whether nodes are frames, simultaneous controls, path markers, or UI decoration.

**[UNKNOWN]** There is no provable blade ID, selector branch, state machine, construction
order, node count at runtime, line transform, disposal rule, timing, or blend function.

### Lightning clouds

**[RECOVERED]** `cloud0..4.png` form a five-member numeric sequence. Compact dimensions are
`110x113`, `121x124`, `136x140`, `104x106`, and `121x124`; the other tree copies are
byte-identical. All ten physical PNGs have alpha.

**[RECOVERED]** `PhysicsBladeLayer::ccTouchesMoved()` at `0x00160640` dispatches
standard particle effects only for blade IDs `7..12`. IDs `13..17` use no standard
particle plan. The current `standard-blade-particle-plan.ts` preserves that exact union,
and `StandardAdvancedBladePresenter` rejects any Dragon or Centipede profile with a
non-empty particle list.

**[INFERRED]** `cloud0..4` may be animation frames or a simultaneous sprite set, but the
integer suffix alone cannot select between those models.

**[UNKNOWN]** Frame order, frame duration, randomization, position, scale, opacity curve,
emission count, lifetime, source/destination blend factors, and blade or mode ownership.
RGBA alpha is not blend-function evidence. The similarly named audio files do not close
any of these gaps.

### Alternate Centipede triplet

**[RECOVERED]** The alternate files are not aliases of the live unnumbered triplet:

| Tree | Alternate body / head / tail | Live body / head / tail |
|---|---|---|
| `480x800` | `13x41` / `48x44` / `51x15` | `12x40` / `47x44` / `51x14` |
| `720x1280` | `18x62` / `71x66` / `76x21` | `18x61` / `70x66` / `76x22` |

Compact alternate SHA-256 values are:

```text
body1.png  299360f40bb7878eae5d51d74712190200c536b4d94bc8baded81a9fd123d4ed
head1.png  34dc2233120ac111b874dbb90ad323b85b6dcf1d5b681037a13fc22ff96ef703
tail1.png  5b5a22a29da8bb09ca1d8885752b4637fcdbc3ef4047fe5252aa4d93f4e68782
```

**[RECOVERED]** ID `17` reaches only `CentipedeBlade::CentipedeBlade()`. That no-argument
constructor has no suffix branch and eagerly creates only the unnumbered 1+20+1 sprite
pool. No later method loads a texture.

**[INFERRED]** The close dimensions and suffix suggest alternate Centipede art, but do not
establish a selectable variant, state-dependent swap, or legacy replacement.

**[UNKNOWN]** Any ID, unlock rule, load sequence, body count, swap trigger, or runtime
consumer for the `*1` files.

### Named Dragon duplicates

**[RECOVERED]** Exact byte-role mapping:

| Named triplet | Generic compact variant | Standard blade ID | body / head / tail SHA-256 prefixes |
|---|---:|---:|---|
| `BlueDragon/water_dragon_*` | `0` | `13` | `0d796b11252a` / `9f07492c0d78` / `1ef56898ed0f` |
| `BlackDragon/black_dragon_*` | `1` | `14` | `faabd4a6f109` / `8deb80d733c9` / `0e9fc8967685` |
| `RedDragon/red_dragon_*` | `2` | `15` | `82bf5e837a4d` / `2b95b3adf4bb` / `60f5eaf4f946` |
| `GoldDragon/gold_dragon_*` | `3` | `16` | `63360fab1fd9` / `c52d240e4e7b` / `89c9e4de2479` |

For each named path, its `480x800` and `720x1280` physical copies have the same hash.
That hash equals the corresponding `480x800` generic variant component. The scaled
`720x1280` generic variants have different dimensions and hashes, so the named files are
compact-resolution duplicate copies, not tree-local aliases.

**[RECOVERED]** The ID-to-variant mapping comes from the selector, but the native
constructor formats only `dragon-{head,body,tail}-%d.png`. No named directory or basename
appears in the native corpus.

**[INFERRED]** Color names document the likely art label for each generic variant. They do
not make the named path canonical.

**[UNKNOWN]** Why compact copies were retained in both trees and whether an earlier build
ever loaded the named paths. Neither question blocks exclusion from the recovered runtime.

## Current Creator closure

**[RECOVERED]** `standard-blade-resource-contract.ts` models exactly:

- IDs `0..12` as Basic;
- IDs `13..16` as generic Dragon variants `0..3`;
- ID `17` as the unnumbered Centipede;
- particles only for Basic IDs `7..12`;
- 15 Dragon bodies, 20 Centipede bodies, and point capacity 32.

`getStandardBladeRasterResources()` returns exactly
`STANDARD_BLADE_RASTER_RESOURCE_COUNT = 50` resources for one selected asset tree.
`LoadedStandardBladeResources` rejects a count mismatch, duplicate canonical paths, missing
resources, or dimension mismatch. `StandardAdvancedBladePresenter` accepts only exact
Dragon/Centipede profiles and requires an empty particle list.

Therefore the current Creator loader already has the correct negative ownership behavior:
none of the 33 target logical paths can enter through fallback, directory enumeration, or
an extra profile. Adding them to the 50-resource closure would weaken the recovered
contract.

## Disposition and first safely implementable closure

The current five entries in `forensics/resources/resource-disposition-map.json` remain
`unknown`. This investigation adds enough reachability evidence to recommend the following
status-only decisions:

1. change `named-dragon-duplicates-unowned` to `excluded`, documenting the four compact
   hash-alias mappings above;
2. change the Bolt, Guidtar, Lightning cloud, and alternate Centipede groups to `excluded`
   **from the recovered standard Android runtime**, while retaining their historical
   mechanic fields as unknown;
3. preserve all 66 physical files as forensic inputs; do not copy them into the 50-resource
   runtime closure and do not delete them;
4. keep negative contract tests that reject IDs outside `0..17`, advanced particles, and
   non-generic Dragon or suffixed Centipede paths.

Item 1 is the first safely implementable closure because it resolves redundant path
ownership without inventing visual behavior. Items 2–4 are also safe as quarantine and
negative-validation work. No positive Bolt, Guidtar, Lightning-cloud, or alternate
Centipede feature implementation is evidence-safe.

## Blockers to any future positive implementation

- A recovered source branch, executable build, or data file that names the exact paths.
- A selector or mode branch assigning a family to an ID or non-blade owner.
- Constructor topology: simultaneous sprites versus ordered frames, counts, z-order, and
  attachment rules.
- Update and disposal state transitions.
- Timing, randomization, interpolation, and lifetime.
- Position, scale, rotation, opacity, and blend policy.
- For Lightning, an emitter definition or exact code consumer.
- For alternate Centipede, a suffix-selection rule and body-pool contract.

Absent one of those artifacts, visual similarity, folder names, and numeric suffixes are
insufficient to turn preserved evidence into a production consumer.

## Unresolved questions

- Were these families reachable in an older or different Pencil Blade binary?
- Do the extra blade icons `19..21` belong to any of these families in another build?
- Was `Guidtar` intended as an effect, a blade, or an unused experiment?
- Are `cloud0..4` animation frames or simultaneously emitted sprites?
- Was the alternate Centipede triplet a replacement, skin, or abandoned revision?
- Why were compact named Dragon copies duplicated into the high-resolution tree?

Status: DONE_WITH_CONCERNS
Summary: Standard native reachability is closed to generic Dragon IDs 13–16 and unnumbered Centipede ID 17; all 66 target rasters are safely excluded from that runtime, with named Dragons recovered as compact duplicate aliases.
Concerns/Blockers: Historical intent, positive consumers, timing, blend, and lifecycle remain unrecoverable for Bolts, Guidtar, Lightning clouds, and alternate Centipede without another artifact.

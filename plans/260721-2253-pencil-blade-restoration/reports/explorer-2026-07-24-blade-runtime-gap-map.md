# Standard Blade Runtime Gap Map

---
date: 2026-07-24
phase: 6
scope: standard cosmetic blade IDs 0 through 17
method: static ELF/resource/source inspection only
---

## Outcome

Phase 6 can implement the standard blade range without guessing its top-level dispatch:

- **[RECOVERED]** IDs `0..12` are four-slot `BasicBlade` trails using
  `Blades/blade<ID>.png`.
- **[RECOVERED]** IDs `13..16` are four-slot `DragonBlade` trails using variant
  `ID - 13`.
- **[RECOVERED]** ID `17` is a four-slot `CentipedeBlade`.
- **[RECOVERED]** only IDs `7..12` add move-time particles.
- **[GAP]** production Settings and Options cover all 18 IDs, but every standard-blade scene
  consumer still renders ID `0`.
- **[BLOCKER]** the compact tree has no native-path `blade11.png` or `blade12.png`; byte-identical
  aliases exist, but adopting them is an explicit restoration decision.
- **[BLOCKER]** Dragon/Centipede resource topology is recovered, but their exact draw, point-spacing,
  overflow, and disposal behavior is not yet a curated implementation contract.

No APK or native library was loaded or executed. Evidence came from disassembly, ELF strings,
curated reports/contracts, staged resources, and TypeScript source.

## Confidence Labels

- **[RECOVERED]** direct branch, immediate, string, resource, or existing curated contract.
- **[INFERRED]** clean-room integration choice supported by current architecture.
- **[UNKNOWN]** evidence inspected here is insufficient for an implementation claim.

## Exact ID Map

All prices are the recovered missing-key defaults. `Basic` means the already recovered
`BasicBlade` geometry/lifecycle, not a texture-only sprite.

| ID | Price | Native runtime and exact resource family | Move particle | Current production state |
|---:|---:|---|---|---|
| 0 | 0 | `BasicBlade`; `Blades/blade0.png` | none | implemented and hardcoded everywhere |
| 1 | 100 | `BasicBlade`; `Blades/blade1.png` | none | resource staged; no catalog/runtime selection |
| 2 | 200 | `BasicBlade`; `Blades/blade2.png` | none | resource staged; no catalog/runtime selection |
| 3 | 300 | `BasicBlade`; `Blades/blade3.png` | none | resource staged; no catalog/runtime selection |
| 4 | 400 | `BasicBlade`; `Blades/blade4.png` | none | resource staged; no catalog/runtime selection |
| 5 | 500 | `BasicBlade`; `Blades/blade5.png` | none | resource staged; no catalog/runtime selection |
| 6 | 600 | `BasicBlade`; `Blades/blade6.png` | none | resource staged; no catalog/runtime selection |
| 7 | 700 | `BasicBlade`; `Blades/blade7.png` | VN flag star | trail resource staged; particle runtime absent |
| 8 | 800 | `BasicBlade`; `Blades/blade8.png` | Ice: snowflake/star/circle | trail resource staged; particle runtime absent |
| 9 | 900 | `BasicBlade`; `Blades/blade9.png` | X-Mas: five/four/hexa/circle | trail resource staged; particle runtime absent |
| 10 | 1000 | `BasicBlade`; `Blades/blade10.png` | Butterfly `0..5` | trail resource staged; particle runtime absent |
| 11 | 1500 | `BasicBlade`; native path `Blades/blade11.png` | Fire: circle/particle/smoke | large tree complete; compact path decision blocked |
| 12 | 2000 | `BasicBlade`; native path `Blades/blade12.png` | Rainbow star `0..4` | large tree complete; compact path decision blocked |
| 13 | 2500 | `DragonBlade(0)`; `Blades/Dragon/dragon-{head,body,tail}-0.png` | none | resources staged; advanced trail absent |
| 14 | 2500 | `DragonBlade(1)`; `Blades/Dragon/dragon-{head,body,tail}-1.png` | none | resources staged; advanced trail absent |
| 15 | 2500 | `DragonBlade(2)`; `Blades/Dragon/dragon-{head,body,tail}-2.png` | none | resources staged; advanced trail absent |
| 16 | 2500 | `DragonBlade(3)`; `Blades/Dragon/dragon-{head,body,tail}-3.png` | none | resources staged; advanced trail absent |
| 17 | 5000 | `CentipedeBlade`; `Blades/Centipede/{head,body,tail}.png` | none | resources staged; advanced trail absent |

Primary static anchors:

- `PhysicsBladeLayer::onEnter()` `0x001612c0` performs the `0..12`, `13..16`, `17`
  dispatch and constructs exactly four children at z-order `1`.
- `PhysicsBladeLayer::ccTouchesMoved()` `0x00160640` updates the selected trail, applies the
  common swish test, then dispatches particle cases `7..12`.
- Price/key evidence is
  `researcher-2026-07-24-cosmetic-economy-native-contract.md:55-66,72-127`.
- Resource paths, dimensions, bytes, and SHA-256 values are
  `explorer-2026-07-24-options-resource-audit.md:323-410`.
- Exact Basic behavior is
  `forensics/contracts/basic-blade-presentation-contract.md:12-75,167-200`.

## Common Trail, Cut, and Audio Behavior

**[RECOVERED]**

- Every standard ID owns four touch slots. Begin claims the first free slot; move updates that
  slot's trail; end frees it and starts that renderer's disposal state.
- Cut rays remain the shared `BladeTracks`/post-physics path. Blade presentation strategy does
  not change collision or scoring.
- Swish is requested only when segment length is strictly greater than
  `viewportWidth * float32(0.0825)`. The common bank is `Sounds/swoosh1.wav` through
  `Sounds/swoosh9.wav`.
- IDs `0..12` use the same Basic lifecycle: ten-point maximum, transient `11 -> 9` overflow,
  frame-count state-`4` disposal, float32 width, textured triangle strip, 20-byte vertex stride,
  and 500-byte persistent capacity per slot.
- Dragon constructors initialize a 32-point renderer with one head, 15 body sprites, and one
  tail. Centipede initializes 32 points with one head, 20 body sprites, and one tail. All start
  hidden and attach at z-order `1`.

**[UNKNOWN / must recover before implementation]**

- Exact Dragon/Centipede draw placement, angle/spacing math, visible-segment thresholds, overflow,
  and disposal transitions. Relevant bodies are:
  `DragonBlade::{DisposeStateUpdate,SetToDisposeState,update,SetNew,draw,Push}`
  `0x0014dfb8..0x0014ea38`, and
  `CentipedeBlade::{DisposeStateUpdate,SetToDisposeState,update,SetNew,draw,Push}`
  `0x00147350..0x00147e58`.
- Reusing `BasicBladeTrailModel` for IDs `13..17` would be an unsupported approximation.

## Exact Particle Dispatch for IDs 7–12

`RandomHelper::nextInt(min,max)` is inclusive (`0x0016196c`). Particles are evaluated on every
accepted moved event, independently of whether the swish threshold was crossed. No
`enable_effect` check surrounds the visual-particle switch.

`signed(a,b)` below is native `ParticleObject::RandomPositionData`: for each axis independently,
draw sign `[-1,1]` and magnitude
`[trunc(viewportWidth*a), trunc(viewportWidth*b)]`. The particle starts at the current touch
position and moves by that signed vector. Every spawned node is attached at z-order `1` and
auto-deletes after its lifetime.

| ID | Inclusive gate and selection | Exact path/lifetime/offset | Actions |
|---:|---|---|---|
| 7 | gate `nextInt(0,5)==0` | `VN Flag/vnflagstar.png`; `nextInt(50,75)/100`; `signed(.1,.35)` | rotate, scale-out, fade-out |
| 8 | gate `0..5==0`; select `0..2` | snowflake `1.0`, `signed(.2,.415)`; star `.75`, `signed(.156,.3125)`; circle `.5`, `signed(.1,.25)` | all rotate, scale-out, fade-out |
| 9 | gate `0..5==0`; select `0..3` | xmasfive `1.0`, `signed(.2,.415)`; xmasfour `.75`, `signed(.156,.3125)`; xmashexa `.5`, `signed(.1,.25)`; xmascircle `.5`, `signed(.05,.156)` | all rotate, scale-out, fade-out |
| 10 | gate `0..5==0`; select `0..5` | `Butterfly/butterfly<selection>.png`; `nextInt(50,75)/100`; `signed(.1,.4156)` | rotate, scale-out, fade-out; initial rotation follows movement vector |
| 11 | gate `nextInt(0,4)==0`; select `0..2` | see Fire branches below | branch-specific |
| 12 | gate `nextInt(0,6)==0`; select `0..4` | `Rainbow/rainbowstar<selection>.png`; `nextInt(50,150)/100`; `signed(.1,.2)` | rotate, scale-out, fade-out; initial rotation follows movement vector |

Fire selection details:

| Selection | Spawn | Lifetime | Integer offset bounds scaled by viewport width | Actions |
|---:|---|---|---|---|
| 0 | one `Fire/firecircle.png` | `nextInt(25,125)/100` | X `[-.2W,.2W]`; Y `[.05W,.2W]` | fade-out only |
| 1 | one `Fire/fireparticle.png` | `nextInt(25,125)/100` | X `[-.2W,.2W]`; Y `[.05W,.2W]` | scale/fade; one initial rotation in `[-45,+45]` |
| 2 | three independent `Fire/smoke.png` objects | independent `nextInt(25,125)/100` each | X `[-.1W,.1W]`; Y `[0,.2W]` each | fade-out only |

Static ranges are `0x00160736..0x00160ede`. Particle lifecycle helpers are
`ParticleObject::onEnter` `0x0015ffa8`, constructor `0x001600cc`,
`RandomPositionData` `0x0016017e`, axis helpers `0x001601cc/0x001601e2`, and
`SetVectorRotation` `0x001601f8`. Exact path strings occur at ELF offsets
`0x003d12b3` and `0x003d19d1..0x003d1ac9`.

## Both Staged Resource Trees

| Runtime family | `480x800` | `720x1280` | Decision |
|---|---|---|---|
| Basic IDs `0..10` | exact `blade0.png..blade10.png` present | exact paths present | ready |
| Basic ID `11` | native `blade11.png` missing; `firebladetexture.png` has the large-tree file's exact SHA-256 | exact `blade11.png` present | explicit alias/failure policy required |
| Basic ID `12` | native `blade12.png` missing; `rainbow.png` has the large-tree file's exact SHA-256 | exact `blade12.png` present | explicit alias/failure policy required |
| Dragon IDs `13..16` | all 12 head/body/tail variant rasters present | all 12 present | resource-ready |
| Centipede ID `17` | all 3 rasters present | all 3 present | resource-ready |
| Particle IDs `7..12` | all 22 rasters present | all 22 present | resource-ready |

The recovered native constructor always requests `Blades/blade%d.png`. Therefore the compact
aliases must not be silently relabeled as recovered behavior. Choose one before exposing IDs
`11/12` there:

1. preserve native-path failure and prevent purchase/selection;
2. adopt and document a compatibility alias; or
3. obtain stronger platform-specific rename evidence.

All scoped bytes are already under both `game/assets/game/<tree>/` trees with Creator metadata.
The full audit found no staged byte mismatch or duplicate UUID; redistribution rights remain
unresolved (`options-resource-audit.md:491-545`).

## Current Consumers and Exact Gaps

| Surface | What works now | Gap |
|---|---|---|
| Settings/economy | `selected_blade` range `0..17`; 18 exact prices; price `0` ownership | complete for storage/economy |
| Options | 18 exact `Icons/blade-icon-<ID>.png` rows; selection/purchase model | icon/economy only; no live trail resource |
| Resource catalog | only `defaultBlade`, ID `0` | no standard ID lookup or particle/multipart closure |
| Blade presenter | exact four-slot Basic ID `0` | input type is literal `0`; no factory or particle/advanced renderer |
| Main Menu | renders standard blade | hardcoded `0` at `main-menu-presenter.ts:272-276` |
| Mode Select | renders standard blade | hardcoded `0` at `mode-select-presenter.ts:306-310`; domain snapshot also pins `0` |
| Classic | renders standard blade | hardcoded `0` at `classic-gameplay-controller.ts:1181-1185` |
| standard Crazy | renders standard blade | hardcoded `0` at `crazy-gameplay-controller.ts:1318-1324` |
| GN Style | renders standard blade | hardcoded `0` at `gn-style-gameplay-controller.ts:968-974` |

Changing Settings selection currently has no visual effect. Fresh construction after returning
from Options is the clean integration point; no suspended-screen hot swap is required.

## Standard Blade 0 Is Not BirdBlade Type 1

These numeric domains must remain separate:

| Standard cosmetic blades | BirdBlade |
|---|---|
| saved key `selected_blade`; IDs `0..17` | mode profile type `1 | 2 | 3`; not a cosmetic selection |
| four touch-owned trails | one autonomous Bird blade |
| ID `0` uses `Blades/blade0.png` | all types use shared trail texture `Blades/testblade7.png` plus type-specific Bird sprites |
| standard consumers: Main Menu, Mode Select, Classic, standard Crazy, GN Style | Classic Bird type `1`, Crazy Bird type `2`, Combo Bird type `3` |
| particles only standard IDs `7..12` and use the table above | always-updating Bird X-Mas plan uses a different `0..4` gate, lifetimes, offsets, and ownership |

Evidence: `bird-blade-state.ts:7-15`, `bird-resource-contract.ts:265-300`,
`classic-bird-session.ts:18-20`, `crazy-gameplay-controller.ts:750-791`, and
`combo-bird-session.ts:27-43`. Bird resource/presenter tests must remain unchanged as negative
separation gates.

## Smallest Safe Implementation Order and Ownership

1. **Evidence owner, no production edits:** curate exact Dragon and Centipede presentation
   contracts from the bodies above; record the compact ID `11/12` decision.
2. **Resource owner:** expand `classic-resource-contract.ts` and
   `classic-resource-loader.ts` to an ID-indexed standard-blade catalog, with exact per-tree
   closures and no fallback to `0`. Own only their resource tests.
3. **Basic/particle owner:** reuse the existing Basic model for `0..12`; add a pure deterministic
   standard-particle plan and Creator particle adapter for `7..12`. Do not edit Dragon/Centipede
   files.
4. **Advanced-renderer owners:** implement Dragon and Centipede in separate domain/presenter/test
   files after their contracts are approved. Their ownership must not overlap the Basic presenter.
5. **Factory/integration owner, sequential after 2–4:** expose one common standard-blade
   presenter interface/factory; then replace all five hardcodes with
   `settings.state.snapshot.selectedBlade`. This owner alone edits shared controllers and shell
   plumbing.
6. **Verification owner:** extend integration tests without changing production behavior.

This order permits IDs `1..6` first, then particle IDs `7..12`, then advanced IDs `13..17`,
while keeping the final claim at `0..17` only after every family passes.

## Required Tests and Preview Gates

Focused automated gates:

- replace `classic-resource-contract.test.ts`'s current “ID `1` throws” assertion with exact
  ID/tree/resource closures, including the chosen compact `11/12` policy;
- extend `basic-blade-trail.test.ts` and `classic-blade-presenter.test.ts` across IDs `0..12`;
- add exhaustive deterministic particle RNG/order/range/action tests for IDs `7..12`, especially
  Fire's three independent smoke objects;
- add contract-derived Dragon/Centipede geometry, overflow, and disposal tests;
- assert factory strategy `0..12 / 13..16 / 17`, four slots, z-order `1`, and no fallback;
- update Main Menu, Mode Select, Classic, standard Crazy, GN Style, shell, and
  `creator-scene-integration.test.ts` so fresh construction reads Settings;
- retain Bird type `1/2/3`, resource, particle, presenter, and route tests as strict non-consumers
  of `selected_blade`;
- run `node --test tests/reconstruction/vertical-slice/*.test.ts`,
  `node --test tests/*.mjs`, Creator metadata validation, and Creator 3.8.8 bundled strict
  `tsc -p game/tsconfig.json --noEmit`.

Fresh Preview must cover both asset trees and:

- select every owned ID `0..17`, return to a fresh Main Menu, then exercise Mode Select,
  Classic, standard Crazy, and GN Style;
- visibly confirm Basic, all six particle families, four Dragon variants, and Centipede;
- verify the chosen compact `11/12` behavior explicitly;
- verify unowned selection resets, owned selection persists after relaunch, and effects-off
  silences swish without suppressing the recovered visual-particle branch;
- enter all three Bird modes after a nonzero standard selection and confirm their unchanged
  type `1/2/3` `testblade7` runtimes;
- confirm no duplicate roots, listeners, audio loops, input leases, runtime errors, or stale
  standard-blade resources after repeated Options round trips.

Preview is a smoke/visual gate; deterministic tests remain the authority for RNG probabilities,
draw order, geometry, and frame-count disposal.

## Unresolved Questions

1. Which explicit compact-tree policy is approved for IDs `11` and `12`?
2. What are the exact Dragon/Centipede draw, overflow, and disposal contracts after dual-toolchain
   curation?
3. Redistribution rights remain unresolved for the staged recovered assets.

Status: DONE_WITH_CONCERNS

Summary: Closed the actionable standard ID/resource/price/particle/consumer map for `0..17`,
separated standard blade `0` from BirdBlade types `1..3`, and defined the smallest implementation,
ownership, test, and Preview sequence.

Concerns/Blockers: explicit compact `11/12` alias decision; uncurated Dragon/Centipede
draw/disposal behavior; unresolved recovered-asset rights.

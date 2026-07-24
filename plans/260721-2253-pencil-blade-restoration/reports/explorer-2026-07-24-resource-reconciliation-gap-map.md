# Phase 6 resource reconciliation gap map

Date: 2026-07-24

Scope: static reconciliation of the recovered APK game-resource corpus against current Creator consumers

Safety: APK and `libgame.so` were not executed; no device or runtime assumptions are used

## Result

The recovered game-resource denominator is **862 files**: 784 PNG, 59 WAV,
3 MP3, 15 TTF, and 1 OTF. A union of the current domain resource-contract
enumerators, Creator resource loaders, and literal production resource references
accounts for **743 current consumers (86.19%)**. The remaining **119 files
(13.81%) have no current consumer**.

The staging manifest cannot answer this question by itself: its
`consumerStatus: "unmapped"` values and `0/862` counters predate the implemented
resource contracts. Physical presence, byte identity, valid `.meta` files, or a
passing import audit do not establish a runtime consumer.

| Resource class | Staged | Current consumer | No consumer | Explicit disposition among gaps | No explicit disposition |
|---|---:|---:|---:|---:|---:|
| PNG | 784 | 682 | 102 | 18 | 84 |
| Audio (WAV/MP3) | 62 | 52 | 10 | 10 | 0 |
| Font (TTF/OTF) | 16 | 9 | 7 | 1 | 6 |
| **Total** | **862** | **743** | **119** | **29** | **90** |

The 29 already-disposed files are the two excluded Android About-iOS copies,
eight Options extras, eight unresolved result candidates, ten presence-only audio
candidates, and the unsupported Cooper Black OTF. Their disposition still needs
to be represented in a global machine-checked ledger. The other 90 files need
either a proven consumer or an explicit `unknown`, `excluded`, or `unsupported`
decision.

### Counting rules

- In the tables below, `T/<path>` expands to both exact canonical files:
  `game/assets/game/480x800/<path>` and
  `game/assets/game/720x1280/<path>`.
- “None” means no current production contract/loader/source reference owns that
  canonical path. A hash-identical file used through another path is not counted
  as its consumer.
- Android `res/` contributes 107 additional PNG files, but only three launcher
  icons and 104 vendor UI assets. It contains no game-resource candidate and is
  outside the 862-file denominator.
- The native-string evidence below comes from the checked-in static
  `resource-usage-map.json`; it is not runtime evidence.

## Graphics: all 102 files without consumers

| Exact canonical paths | Files | Current consumer / disposition | Static evidence and missing closure |
|---|---:|---|---|
| `T/Backgrounds/aboutbackground-ios.png` | 2 | None; **explicitly excluded** from the Android About contract | `ABOUT_EXCLUDED_ANDROID_LOGICAL_PATHS` and focused tests preserve the exclusion. The Android native About evidence names only `aboutbackground.png`; substituting the iOS image would change the contract. No runtime work is needed, but the global ledger must record the exclusion. |
| `T/Blades/Bolts/{MainBolt4,MainBolts,MainBolts1,MainBolts2,MainBolts3,SubBolts}.png` | 12 | None; no disposition | Corpus-only: no exact native resource string and no contract, loader, presenter, or focused test. Recover the owning blade type and bolt sequencing before implementation. |
| `T/Blades/Centipede/{body1,head1,tail1}.png` | 6 | None; no disposition | The unnumbered Centipede triplet is consumed; this alternate triplet has no exact native resource string or branch/index owner. No positive or exclusion test exists. |
| `T/Blades/Dragon/BlackDragon/{black_dragon_body,black_dragon_head,black_dragon_tail}.png` | 6 | None; no disposition | Hash-equivalent generic Dragon variant content is already consumed, but the named-color paths are not. The static duplicate is alias evidence only; it does not prove a canonical-path consumer. |
| `T/Blades/Dragon/BlueDragon/{water_dragon_body,water_dragon_head,water_dragon_tail}.png` | 6 | None; no disposition | Same gap as BlackDragon; content corresponds to a consumed generic Dragon variant, with no named-path owner. |
| `T/Blades/Dragon/GoldDragon/{gold_dragon_body,gold_dragon_head,gold_dragon_tail}.png` | 6 | None; no disposition | Same gap as BlackDragon; content corresponds to a consumed generic Dragon variant, with no named-path owner. |
| `T/Blades/Dragon/RedDragon/{red_dragon_body,red_dragon_head,red_dragon_tail}.png` | 6 | None; no disposition | Same gap as BlackDragon; content corresponds to a consumed generic Dragon variant, with no named-path owner. |
| `T/Blades/Guidtar/{guidtar,guidtar_line,nodes0,nodes1,nodes2,nodes3,nodes4}.png` | 14 | None; no disposition | Corpus-only: no exact native string and no resource/state/presentation contract. The spelling is canonical and must not be normalized. |
| `T/Blades/Particles/Lightning/{cloud0,cloud1,cloud2,cloud3,cloud4}.png` | 10 | None; no disposition | These are the only unconsumed particle-named source rasters. No emitter/config file exists in the recovered corpus, and no current particle plan owns them. Recover emitter order, timing, blend, and blade/mode ownership first. |
| `T/Bomb/bomb_10.png` | 2 | None; no disposition | Strong direct evidence: the recovered native bomb factory maps bomb ID `1` to this path. Current `ClassicBombId` supports only `0`; the resource-contract and generated-bomb tests deliberately reject ID `1`/`bomb_10`. Recover whether any original scheduler can reach ID `1` before widening the runtime contract. |
| `T/Buttons/button-orange-back-normal.png` | 2 | None; no disposition | No exact native resource string, contract, loader, or test. The native map contains `button-orange-wheel-normal.png`, which is a different canonical file and cannot be used as ownership evidence. |
| `T/Icons/background-icon-8.png`; `T/Icons/blade-icon-{19,20,21}.png` | 8 | None; **explicit Options extras** | Static Options bounds iterate background icons `0..7` and blade icons `0..17`; the focused audit marks these files “extra; not iterated.” `paperbackground8.png` is live, but that does not make its thumbnail live. Keep the exact gaps rather than normalizing the index ranges. |
| `T/Interfaces/object-medal-{1st,2nd,3rd}.png`; `T/Interfaces/object-new-best.png` | 8 | None; **explicitly unknown result candidates** | Current result presentation consumes `object-medal-none.png`. Existing mode/resource reports found no direct owner for the numbered medals or new-best image. A positive result-state branch and ordering contract are missing. |
| `T/Loading/{backgroundLogo,loadbkback,loadbkfront,loadprocess}.png` | 8 | None; no disposition | All four logical paths are exact native strings, making this the strongest missing screen-resource family. No Loading contract, loader, presenter, lifecycle test, or shell boot-order test exists. Static recovery of `LoadingLayer` ownership and timing is the dependency. |
| `T/Test/{box,face}.png`; `T/Test/bar.png` | 6 | None; no disposition | `Test/box.png` and `Test/face.png` are exact native strings; `Test/bar.png` is corpus-only. `Test/box.png` is hash-identical to the compact-tree Classic Bird description image, but that live image does not consume the Test path. Classify the family as reachable production, debug-only, or packaged dead data. |
| **Graphics total** | **102** |  |  |

The named-color Dragon copies map by content to the consumed generic variants
(Blue → 0, Black → 1, Red → 2, Gold → 3). This supports an explicit alias or
duplicate-data disposition after static confirmation; it does not justify silently
dropping their paths from coverage.

## Sounds: all 10 files without consumers

| Exact canonical paths | Files | Current consumer / disposition | Static evidence and missing closure |
|---|---:|---|---|
| `game/assets/game/Sounds/fruitfail.wav` | 1 | None; **presence-only / unknown** | Exact native string, but no direct fail-manager or fail-animation call site was recovered. No event/audio contract owns it. |
| `game/assets/game/Sounds/get_coins.wav` | 1 | None; **presence-only / unknown** | Exact native string, but no result/reward callback owner or ordering evidence was recovered. |
| `game/assets/game/Sounds/juice{1,2,3,4}.wav` | 4 | None; **presence-only / unknown** | Exact native strings, but no verified fruit-cut switch or event owner. `juice4.wav` is hash-identical to consumed `waterfruit.wav`; content identity is not a trigger contract. |
| `game/assets/game/Sounds/{kiwi,orange,pineapple}.wav` | 3 | None; **presence-only / unknown** | Exact native strings, but the recovered ordinary-fruit sound switch does not assign these canonical paths. `orange.wav` and `pineapple.wav` are hash-identical to consumed `mangosteen.wav`; no alias branch is proven. |
| `game/assets/game/Sounds/scorescreen.wav` | 1 | None; **presence-only / unknown** | Exact native string, but no covered result-screen callback owns it. |
| **Audio total** | **10** |  |  |

The classic audio report already warns against attaching these sounds by filename
semantics. The missing evidence is an exact call site, event boundary, overlap
policy, and route/mode owner. Metadata tests prove that the clips import; they do
not prove when they play.

## Fonts: all 7 files without consumers

| Exact canonical paths | Files | Current consumer / disposition | Static evidence and missing closure |
|---|---:|---|---|
| `game/assets/game/Fonts/BOD_B.TTF` | 1 | None; no disposition | No exact native resource string, label owner, font contract, or focused usage test. |
| `game/assets/game/Fonts/BRLNSR.TTF` | 1 | None; no disposition | Same gap. |
| `game/assets/game/Fonts/BuxtonSketch.ttf` | 1 | None; no disposition | Same gap. |
| `game/assets/game/Fonts/COOPBL.TTF` | 1 | None; no disposition | Same gap. |
| `game/assets/game/Fonts/Comic Book.ttf` | 1 | None; no disposition | Same gap; preserve the canonical space and case. |
| `game/assets/game/Fonts/onthemove.ttf` | 1 | None; no disposition | Same gap. |
| `game/assets/game/Fonts/CooperBlackStd.otf` | 1 | None; **explicitly unsupported** | Preserved source bytes, but the current Creator metadata/import policy cannot establish a supported Font consumer. This is the known global fidelity blocker; replacement, conversion, or unsupported retention needs an explicit decision. |
| **Font total** | **7** |  |  |

The nine fonts with current consumers are `AgencyB.ttf`, `Andyb.ttf`, `Arial.ttf`,
`Century.ttf`, `GroBold.ttf`, `Linds.ttf`, `MotorwerkOblique.ttf`, `Razing.ttf`,
and `SlabThing.ttf`. Global metadata coverage of all 16 fonts must not be reported
as usage coverage.

## Shaders, materials, animations, emitters, and level data

There is no missing staged-file consumer in these categories because the recovered
862-file corpus contains **zero** `.effect`, `.material`, `.mtl`, `.plist`, `.fnt`,
`.atlas`, `.anim`, `.animation`, `.prefab`, `.json`, or equivalent level/config
files. In particular:

- `Interfaces/object-des-shader.png` is an ordinary raster with a current Mode
  Select consumer; its filename does not make it shader source.
- The ten Lightning cloud PNGs above are source imagery, not a complete particle
  emitter. All other recovered particle rasters have current mode/blade consumers.
- `game/assets/scenes/classic.scene` is reconstruction output, not a recovered
  original level file. No original prefab was staged.
- Recovered choreography and gameplay arrays encoded from native static evidence
  are code contracts, not omitted APK resource files.

Phase 6 still needs a scene/prefab/composition map and material/blend parity work,
but those are separate from the 119-file consumer ledger.

## Evidence hierarchy and test gap

The gap list was derived in this order:

1. Use the staging manifest/resource map as the physical 862-file denominator.
2. Union exact resource paths returned by all current domain contract enumerators
   and paths referenced by production loaders/presenters.
3. Remove the deliberate Android About exclusion from the live-consumer set.
4. Compare canonical paths exactly, preserving case, spaces, spelling, resolution
   tree, and extensions.
5. Use native strings, existing static reports, and hashes only to classify the
   strength of missing evidence.

Current catalog and `.meta` tests cover preservation and importer structure.
Feature contract/loader tests cover only their enumerated subsets. There is no
test that fails when one of the 862 files has neither a consumer nor an explicit
status. That missing global invariant is why the stale manifest can coexist with
substantial live coverage.

## Ordered, non-overlapping implementation slices

The following ownership keeps resource families and likely code surfaces separate.
Research/classification may run in parallel after the ledger schema is fixed;
runtime implementation must wait for the listed positive evidence.

| Order | Slice and exclusive resource ownership | Dependency before implementation | Exit contract |
|---:|---|---|---|
| 1 | **Global ledger scaffold**: new reconciliation status model/test plus staging-manifest consumer fields; no feature contracts | Agree exact statuses: `consumed`, `unknown`, `excluded`, `unsupported`; allow path-level consumers and profile expansion | Test rejects every staged file lacking either a live exact-path consumer or explicit status. Do not bulk-mark current gaps “unknown” without evidence review. |
| 2A | **Loading surface**: only `T/Loading/**` and new Loading contract/loader/presenter/boot tests | Recover `LoadingLayer` construction, four-image layering, progress semantics, visibility interval, and shell transition | Eight paths gain a real boot consumer, or an explicit unreachable/excluded disposition. Shell integration should be scheduled to avoid concurrent shell-controller edits. |
| 2B | **Bomb ID 1**: only `T/Bomb/bomb_10.png` and bomb-specific Classic contract/entity/tests | Prove an original scheduler/mode can emit bomb ID `1`; factory support alone is insufficient | Either reachable ID `1` loads/renders with exact profile assets and tests, or both paths receive an explicit unreachable/unknown disposition. |
| 2C | **Advanced blade and particle families**: only Bolts, alternate Centipede, named-color Dragons, Guidtar, and Lightning cloud paths (66 files) | Recover blade-type/index ownership, alias rules, component order, emitter timing/blend, and route reachability | One owner handles the shared standard-blade resource/presentation surface, preventing overlap between geometry and particle changes. Each canonical path is consumed or explicitly classified. |
| 2D | **Orphan audio**: only the ten listed `Sounds/**` paths and audio-specific contracts/presenters/tests | Recover exact call sites, event owner, route, loop/overlap policy, and ordering | Implement only proven events; otherwise retain named per-file `unknown` statuses. Do not deduplicate hash-identical clips silently. |
| 2E | **Unowned fonts**: only the seven listed `Fonts/**` paths and font-loading/label tests | Recover exact label owners and metrics; separately decide the unsupported OTF policy | Six TTFs are consumed or explicitly classified. Cooper Black has a user-approved supported replacement/conversion or remains explicitly unsupported. |
| 2F | **Result candidates**: only numbered medals and `object-new-best` (8 files) and result presentation/resource tests | Recover the result-state branch, rank/new-best predicates, z-order, and timing | Positive state tests consume exact assets, or the existing unknown disposition remains explicit. |
| 2G | **UI/debug/exclusion closure**: About-iOS, extra Options icons, orange-back button, and `Test/**` (18 files); status work only unless new evidence appears | About and Options already have bounds; recover reachability for orange-back and Test resources | Record existing exclusions exactly; classify orange-back/Test as live, debug-only, dead-packaged, or unknown. No speculative UI is added. |
| 3 | **Serial ledger closeout**: global ledger/manifest owner only | All 2A–2G decisions merged; feature owners no longer edit the ledger | Recompute to `862 = consumed + explicit status`, regenerate counts, and make the global invariant a release gate. |

Loading, bomb ID 1, advanced blade/particles, audio, fonts, and results are
independent resource families. The only intentionally serial work is shell
integration for Loading and the final global ledger/manifest update.

## Source anchors

- [Restoration plan](../plan.md) and
  [Phase 6](../phase-06-recreate-full-game-content-and-progression.md)
- [Creator staging manifest](../../../assets/catalog/creator-staging-manifest.json)
  and [resource usage map](../../../forensics/resources/resource-usage-map.json)
- [Creator contract map](../../../docs/cocos-creator-contract-map.md) and
  [codebase summary](../../../docs/codebase-summary.md)
- Current contracts under
  [`game/assets/scripts/domain`](../../../game/assets/scripts/domain) and loaders
  under [`game/assets/scripts/creator`](../../../game/assets/scripts/creator)
- Focused resource tests under
  [`tests/reconstruction/vertical-slice`](../../../tests/reconstruction/vertical-slice),
  plus [catalog staging](../../../tests/catalog-static-resources-test.mjs) and
  [Creator metadata](../../../tests/validate-creator-resource-meta-test.mjs)
- [Options resource audit](./explorer-2026-07-24-options-resource-audit.md),
  [About resource map](./researcher-2026-07-24-about-offline-resource-map.md),
  [Classic audio contract](./explorer-2026-07-22-classic-audio-contract.md), and
  [standard bomb evidence](./researcher-2026-07-23-standard-bomb-explosion.md)

## Delivery status

Status: DONE

Summary: all 119 staged files without current consumers are enumerated and split
into explicit-status versus unclassified gaps, with dependency-safe work slices.

Concerns/Blockers: the disposition authority now explicitly records all gaps,
including the 90 retained as `unknown`; all 862 asset rights remain unresolved;
Cooper Black remains unsupported.

## Unresolved questions

1. Which recovered `LoadingLayer` functions establish the four-image draw order,
   progress behavior, and handoff into the current shell?
2. Is bomb ID `1` reachable from any original scheduler or mode, rather than only
   constructible by the recovered bomb factory?
3. Are the Bolts, alternate Centipede, named-color Dragon, Guidtar, and Lightning
   families live blade variants, compatibility aliases, or packaged dead data?
4. Which exact callbacks own the ten orphan sounds and six unowned TTFs?
5. Are the numbered medals/new-best image and `Test/**` resources reachable
   production content, debug content, or dead packaging?

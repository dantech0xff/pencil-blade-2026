# Phase 6 non-blade unused-resource contract

Date: 2026-07-24

Scope: static Android reachability review for the 24 unresolved non-blade resource files

Safety: the original APK and `libgame.so` were not executed. Evidence comes from the extracted
archive, Java sources, complete native string/symbol inventories, targeted disassembly, and the
already-reviewed six-mode construction contracts.

## Decision

All 24 files are preserved byte-for-byte in the Creator project, but none belongs in the
recovered Android production runtime:

| Disposition group | Physical files | Android reachability conclusion |
|---|---:|---|
| `bomb-id-one-reachability-unproven` | 2 | Excluded: factory capability exists, but no production scheduler supplies toss type `2` |
| `orange-back-button-unowned` | 2 | Excluded: packaged raster has no native/Java path or format-string consumer |
| `result-rank-art-unowned` | 8 | Excluded: the live result code creates only `object-medal-none.png` |
| `packaged-test-family-unclassified` | 6 | Excluded: debug/test-only residue; the owning test classes have no production constructor call |
| `unowned-ttf-label-sites-unrecovered` | 6 | Excluded: the complete native font-path set names the other nine TTF files only |
| **Total** | **24** | **Retained, not loaded by production** |

`excluded` describes reachability in this recovered Android binary. It does not claim that the
files were never used by an earlier source revision or another unrecovered build.

## Bomb ID 1

`Bomb::create(b2World*, int)` at `0x001456C0` maps ID `1` to
`Bomb/bomb_10.png`. `TossTurn::GetNewTossObject()` at `0x001650A4` can request
that ID only when its stored toss type equals `2`.

The live mode constructors never supply type `2`:

- Classic's exhaustive nine-controller table uses `0`, `1`, `6`, `4`, and `3`.
- Crazy's exhaustive eleven-controller table uses `0`, `1`, `3`, `4`, `6`, and the
  composite strategy type `5`.
- GN Style constructs only ordinary type `0`.
- Classic Bird, Crazy Bird, and Combo Bird reuse their reviewed Classic/Crazy/ordinary
  construction profiles and add no type-`2` scheduler.

Factory support is therefore dormant capability, not production reachability. Creator must
keep `ClassicBombId` at `0` and must not invent a second bomb scheduler just to consume the
raster.

Evidence:

- `forensics/contracts/classic-toss-contract.md`
- `forensics/contracts/crazy-mode-contract.md`
- `forensics/contracts/gn-style-mode-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-standard-bomb-explosion.md`

## Result rank art

The complete native resource-string inventory contains
`Interfaces/object-medal-none.png` and no numbered medal or new-best path/pattern.

`DisplayScoreLayer::CheckForMedal()` at `0x0014D034` directly creates the exact
`object-medal-none.png` sprite, configures its position/opacity/scale/actions, and attaches
it. There is no rank switch in that function. The four candidate filenames are also absent
from Java.

Therefore these packaged files are not a missing Result branch:

- `Interfaces/object-medal-1st.png`
- `Interfaces/object-medal-2nd.png`
- `Interfaces/object-medal-3rd.png`
- `Interfaces/object-new-best.png`

Creator correctly keeps the live `object-medal-none.png` presentation and excludes the four
unreachable candidates in both resolution trees.

Evidence:

- `forensics/contracts/classic-presentation-contract.md`
- `.forensics-work/phase-02/native/resource-looking-strings.txt`
- `DisplayScoreLayer::CheckForMedal()` disassembly range `0x0014D034..0x0014D0D0`

## Packaged Test family

The archive contains `Test/bar.png`, `Test/box.png`, and `Test/face.png` in both trees.

- `Test/box.png` and `Test/face.png` are native literals inside compiled test/debug code.
- `Test/bar.png` has no native or Java literal.
- The binary exposes `AnimationTestLayer`, `BladeTestLayer`, `DrawPrimitiesTest`, and
  `TestBox2DLayer`; the source-path literal explicitly names
  `PencilBlade/Classes/DrawPrimitiesTest.cpp`.
- A full symbolized `.text` scan finds no branch/link call to the four test-layer
  constructors from production code. Their constructor symbols only appear as their own
  function definitions; the app boot path enters `LoadingScene`.

The exact literals prove historical test ownership, while the absent constructor calls prove
the test layers are not reachable from this production build. Porting these screens would add
non-production behavior.

Evidence:

- `.forensics-work/phase-02/native/symbols/functions-raw.tsv`
- `.forensics-work/phase-02/native/strings/all-offsets.txt`
- `AppDelegate::applicationDidFinishLaunching()` at `0x00141F50`
- `LoadingScene::scene()` at `0x0015A46C`

## Unowned fonts

The complete native `Fonts/` literal set is:

```text
Fonts/AgencyB.ttf
Fonts/Andyb.ttf
Fonts/Arial.ttf
Fonts/Century.ttf
Fonts/GroBold.ttf
Fonts/Linds.ttf
Fonts/MotorwerkOblique.ttf
Fonts/Razing.ttf
Fonts/SlabThing.ttf
```

Those are the nine current Creator consumers. The six unresolved TTF filenames are absent
from native strings and Java:

```text
Fonts/BOD_B.TTF
Fonts/BRLNSR.TTF
Fonts/BuxtonSketch.ttf
Fonts/COOPBL.TTF
Fonts/Comic Book.ttf
Fonts/onthemove.ttf
```

The binary contains no generic `Fonts/%s` or `Fonts/%d` format path that could construct them.
They are retained package residue, not missing label sites. This conclusion is separate from
the already-preserved unsupported `Fonts/CooperBlackStd.otf`.

## Orange back raster

The live native back-button literals are `Buttons/button-blue-back-normal.png` and
`Buttons/button-back-selected.png`. The corpus also names
`Buttons/button-orange-wheel-normal.png`, which is a different resource.

`Buttons/button-orange-back-normal.png` has no native literal, format path, Java reference,
or recovered menu branch. It remains retained but excluded from the Android runtime.

## Creator action

1. Change these five disposition groups from `unknown` to `excluded`.
2. Keep every exact source file and `.meta`; do not delete, alias, rename, or preload them.
3. Keep runtime consumer coverage at `761/862` (`88.28%`).
4. Recompute reconciliation as `862 = 761 consumed + 100 excluded + 1 unsupported` if the
   separately reviewed 66-file advanced-blade decision is also accepted.
5. Add ledger tests that distinguish preserved exclusion from live consumption.

## Unresolved questions

- Historical intent for these files outside this recovered Android binary is unknown.
- Original-content redistribution rights remain unresolved and are independent of runtime
  reachability.

Status: DONE

Summary: all 24 unresolved non-blade files have sufficient static evidence for retained
runtime exclusion; no speculative Creator consumer is justified.

Concerns/Blockers: the final `100 excluded` count depends on the separate 66-file
advanced-blade review.

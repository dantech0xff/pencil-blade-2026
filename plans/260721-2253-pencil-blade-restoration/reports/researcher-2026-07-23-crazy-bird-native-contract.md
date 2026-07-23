# Crazy Bird Mode-4 Static Native Contract

---
date: 2026-07-24
status: done-with-concerns
scope: CrazyBirdLayer mode 4 gameplay, timed lifecycle, result, and persistence
evidence-policy: static-only; no original runtime use
implementation-gate: green-with-tracked-inferences
fidelity-proof-gate: amber
---

## Summary

Crazy Bird is implementable as a composition of two already recovered boundaries:

- the Crazy timed-mode graph, timer, special-fruit, non-terminal miss/bomb, and result lifecycle;
- the shared Bird layer and a single `BirdBlade` created with bird type `2`.

Direct static evidence recovers mode ID `4`, the complete Crazy-family callback surface,
the same timed controller family as Crazy, `60.0f` `TimeManager` ownership, `BirdBlade`
type `2`, `Settings::BirdCrazyBest_1`, mode-4 result/replay dispatch, the
`bird_crazy_best_1..3` triplet, and the float32 `0.8f` reward branch.

The implementation gate is **green with tracked inferences**. The exact Crazy-mode table and
callback sequence below are the best implementation contract, but some mode-4 operand/order
details are inferred from the recovered structural counterpart rather than independently
published instruction traces. The most important unresolved item is the exact internal
controller start order in `CrazyBirdLayer::ActionGoCallback`; both earlier reports explicitly
call for its narrow static revalidation before a verbatim port.

Do not describe this report as runtime-observed. No APK, activity, native library, or original
gameplay path was installed, loaded, linked, emulated, instrumented, launched, or executed.

## Contents

- [Evidence Boundary and Status Legend](#evidence-boundary-and-status-legend)
- [Native Surface](#native-surface)
- [Identity, Entry, and Mode-Owned Composition](#identity-entry-and-mode-owned-composition)
- [Timed Lifecycle](#timed-lifecycle-60s-go-time-up-result)
- [Cut, Fail, Bonus, Bomb, Freeze, and Magnet](#cut-fail-bonus-bomb-freeze-and-magnet)
- [Result, Rank, Reward, Replay, and Persistence](#result-rank-reward-replay-and-persistence)
- [Differences From Crazy and Classic Bird](#differences-from-crazy-and-classic-bird)
- [Current Committed Source Seams](#current-committed-source-seams)
- [Implementation-Ready Invariants](#implementation-ready-invariants)
- [Static Closure Blockers](#static-closure-blockers)
- [Non-Blocking Unknowns and Safety Decisions](#non-blocking-unknowns-and-safety-decisions)
- [Recommended Static Acceptance Fixtures](#recommended-static-acceptance-fixtures)
- [Unresolved Questions](#unresolved-questions)

## Evidence Boundary and Status Legend

The requested root `README.md` is absent. The available repository context was
`forensics/README.md`, especially its recovered/inferred/unknown policy and prohibition on
runtime claims.

Primary evidence:

- `forensics/native/function-map.csv:339-369`;
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-native-contract.md:50-97`;
- `plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-23-remaining-mode-order.md:203-261`;
- `forensics/contracts/crazy-mode-contract.md:75-358`;
- `forensics/contracts/classic-toss-contract.md:94-131,214-391`;
- `forensics/contracts/classic-time-state-contract.md:364-530`;
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-classic-bird-contract.md:59-110,197-402`;
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-pause-objective.md:515-633`;
- `forensics/native/java-jni-boundary.md:148-175`;
- current committed Crazy/Bird domain sources cited below.

Classification:

| Status | Meaning in this report |
|---|---|
| **Recovered** | Directly stated by a reviewed static contract/body report, symbol body, call-site scan, or settings/result branch. |
| **Inferred** | Composition or operand parity supported by recovered neighboring contracts, but no independently published Crazy Bird instruction trace proves the exact detail. |
| **Unknown** | Existing curated text does not establish the detail. Targeted static inspection is required before calling it exact. |

Function presence or equal byte size alone is not treated as behavioral proof.

## Native Surface

All addresses below are normalized by clearing the Thumb low bit. Sizes come from
`forensics/native/function-map.csv:339-369`.

| Function | Range | Size | Published recovery |
|---|---:|---:|---|
| `GetGameMode` | `0x0014A3B4...0x0014A3B7` | `4` | returns `4` |
| `MagnetBeginCallback` | `0x0014A3B8...0x0014A417` | `96` | callback body recovered |
| `MagnetEndCallback` | `0x0014A418...0x0014A477` | `96` | callback body recovered |
| `ActionGoCallback` | `0x0014A478...0x0014A51B` | `164` | high-level start recovered; exact controller order explicitly not closed |
| `Action60sCallback` | `0x0014A51C...0x0014A65B` | `320` | builds the `60s`/`GO` intro chain |
| `TimeUpFinishCallback` | `0x0014A65C...0x0014A6D5` | `122` | creates/configures mode-4 Result and swaps layers |
| `TimeUpCallback` | `0x0014A6D6...0x0014A76F` | `154` | stops graph/electric, finishes double score, posts objectives |
| `BonusFruitFail` | `0x0014A770...0x0014A77B` | `12` | body recovered |
| `FreezeFinishCallback` | `0x0014A77C...0x0014A783` | `8` | calls `UnFreezeeWorld` |
| `FreezeStartCallback` | `0x0014A784...0x0014A78B` | `8` | calls `FreezeeWorld` |
| `AfterBombHit` | `0x0014A78C...0x0014A79D` | `18` | body recovered |
| `BombHit` | `0x0014A79E...0x0014A7DF` | `66` | body recovered |
| `FruitFail` | `0x0014A7E0...0x0014A7FB` | `28` | body recovered |
| `FruitCut` | `0x0014A7FC...0x0014A893` | `152` | body recovered |
| `onEnter` | `0x0014A894...0x0014ACBD` | `1066` | complete timed family recovered |
| constructor | `0x0014AD38...0x0014ADC7` | `144` | class construction recovered |
| `GetReplayInstance` | `0x0014ADC8...0x0014ADE5` | `30` | creates a fresh Crazy Bird layer |

Corroborating call-site anchors:

- `DoubleToss::create` from Crazy Bird entry at `0x0014A9E0`;
- `BonusToss::create` from Crazy Bird entry at `0x0014AA7E`;
- `TimeManager::create` at `0x00164CC6`;
- `DisplayScoreLayer::RetryCallback` at `0x0014CBB0`;
- `DisplayScoreLayer::CheckCupAchievement` at `0x0014CD2C`;
- `DisplayScoreLayer::getSavedBestScore` at `0x0014DA6C`;
- `DisplayScoreLayer::getPercentScore` at `0x0014DAC0`.

The two direct Crazy Bird toss factory calls are independently recorded in
`forensics/contracts/classic-toss-contract.md:359-370`.

## Identity, Entry, and Mode-Owned Composition

### Identity table

| Property | Value | Status | Evidence |
|---|---|---|---|
| mode-select index/state | `4` | recovered | `mode-select-presentation-contract.md:300-311,624-631` |
| destination | `CrazyBirdLayer` | recovered | same |
| `GetGameMode()` | `4` | recovered | `0x0014A3B4`; function-map line 339 |
| unlock key/default | `mode_unlock_4`, `false` | recovered | `mode-select-presentation-contract.md:306,309-311` |
| unlock price | `2500` | recovered | `mode-select-presentation-contract.md:509-526` |
| base/input topology | `BaseBirdLayer`, no ordinary blade initialization | recovered | `remaining-mode-order.md:85-100` |
| blade | `CreateBirdBlade("Blades/testblade7.png", 2)` | recovered | `remaining-mode-order.md:122-129` |
| timer | `TimeManager(60.0f)` | recovered | Crazy native report lines 76-81 |
| initial best-score source | `Settings::BirdCrazyBest_1` | recovered | Crazy native report lines 118-122 |
| replay | fresh `CrazyBirdLayer` | recovered | `0x0014ADC8`; result dispatch in remaining-mode report lines 408-423 |

### Externally relevant `onEnter` sequence

The following table distinguishes what is safe to implement from what is safe to label
instruction-exact.

| Step | Implementation contract | Status | Basis / remaining check |
|---:|---|---|---|
| 1 | call `BaseBirdLayer::onEnter()` | inferred | all Bird modes share `BaseBirdLayer`; exact mode-4 call order is not published |
| 2 | reset `BonusManager` | inferred | required by the recovered Crazy timed graph |
| 3 | submit `(9,0)`, then `(5,0)` | inferred | selectors `9`/`5` map to Crazy Bird no-bomb/no-drop IDs `51`/`47`; exact mode-4 call operands need body trace |
| 4 | read logical director size and physics world | inferred | both source halves require them |
| 5 | construct and attach eleven toss controllers at z-order `1` in the table below | controller family recovered; row operands/order inferred | same timed graph is published, but the mode-4 literal trace is not |
| 6 | construct `TimeManager(60.0f, target=this, freeze-start, freeze-finish, time-up, time-up-finish)` and attach at z `1` | recovered at family/callback level | native report lines 76-81; shared setter order in time contract lines 393-397 |
| 7 | create and arm `Text/text-60s.png` at z `1` | recovered | remaining-mode report lines 219-227 |
| 8 | construct and attach `BombElectric` at z `1` | recovered at family level | native report lines 76-81 |
| 9 | call `CreateBirdBlade("Blades/testblade7.png", 2)` | recovered; exact placement inferred | shared Bird report lines 122-129; Classic Bird places blade after electric and before pause |
| 10 | initialize inherited pause UI | inferred | composition of recovered Crazy and Bird entry contracts |
| 11 | initialize score comparison baseline from `BirdCrazyBest_1` | recovered | Crazy native report lines 118-122 |
| 12 | do not enable the Classic Bird `45.0f` world-speed ramp | inferred | Crazy timed graph has no ramp; no mode-4 absence trace is published |

The likely order puts Bird blade construction after `BombElectric` and before pause/best-score
initialization, matching Classic Bird entry
(`researcher-2026-07-23-classic-bird-contract.md:94-107`). Keep that placement configurable
until `0x0014A894...0x0014ACBD` is independently traced.

### Candidate exact controller table

This is the audited Crazy table from `forensics/contracts/crazy-mode-contract.md:96-123`,
applied to Crazy Bird because the native report calls the two layers the same timed controller
graph. Presence of Free/Concurrent/Wave/Double/Bonus, `TimeManager`, and `BombElectric` is
**recovered**. Exact mode-4 add order, interval literals, counts, and active windows remain
**inferred** until the Crazy Bird entry body is published at operand level.

The `ab...b5` names are implementation role IDs borrowed from the Crazy contract. They are not
claims about Crazy Bird member offsets.

| Add order | Role ID | Controller | Type / direction | Bounds | Extra | Mode-4 status |
|---:|---|---|---|---|---|---|
| 1 | `ab` | Free | normal fruit `0`, Up | `[0.5,3]` | — | inferred exact row |
| 2 | `b0` | Concurrent | normal fruit `0`, Up | `[7,18]` | ctor `(1,3)`, actual `1...4` | inferred exact row |
| 3 | `b2` | Wave | normal fruit `0`, Up | outer `[6,18]` | child `[0.25,0.75]`, active `[1.5,3]` | inferred exact row |
| 4 | `ac` | Free | bomb `1`, Up | `[7,24]` | — | inferred exact row |
| 5 | `b1` | Concurrent | bomb `1`, Up | `[15,30]` | ctor `(1,2)`, actual `1...3` | inferred exact row |
| 6 | `b3` | Wave | bomb `1`, Up | outer `[15,35]` | child `[0.25,0.75]`, active `[0.75,1.5]` | inferred exact row |
| 7 | `b4` | DoubleToss | type `0`, Left then Right | child `[0.75,1.5]` | guarded `15.0s` | presence recovered; row inferred |
| 8 | `af` | Free | electric `3` / fruit ID `13`, Down | `[30,45]` | no base toss sound | inferred exact row |
| 9 | `ae` | Free | magnet `4` / fruit ID `14`, Down | `[20,45]` | no base toss sound | inferred exact row |
| 10 | `ad` | Free | DragonFruit `6`, Down | `[15,60]` | dragon factory | inferred exact row |
| 11 | `b5` | BonusToss | type `5`, dynamic direction | `[5,30]` | candidates `[12,10,11]` | presence recovered; row inferred |

Shared recovered strategy invariants still apply:

- interval sampling is `low + k * (high-low)/10`, `k=0...9`;
- `Start()` samples without resetting elapsed;
- `Pause`/`Resume`/`Stop` preserve elapsed and threshold;
- strict `elapsed > threshold`, discarded overshoot, rearm before turn RNG;
- Concurrent can produce `countMax + 1`;
- Wave starts/samples/pauses its child on entry and retains child progress;
- Double is guarded for `15.0s`, starts Left then Right, and perturbs the RNG with its
  zero-interval base scheduler;
- Bonus candidates are `[12,10,11]`, retries enabled candidates, maps direction draws
  `[Left,Right,Down,Down]`, and orders `attach -> enable -> sound`.

These service rules are recovered in `forensics/contracts/classic-toss-contract.md:94-131,
214-310`.

## Timed Lifecycle: `60s`, `GO`, Time Up, Result

### Exactness table

| Phase | Implementation contract | Status |
|---|---|---|
| scene entry | timer exists with total/remaining `60.0f` but is not scheduled | recovered |
| `60s` card | `text-60s`, centered vertically, left by half its width; concurrent move/fade `0.25 in -> 0.5 hold -> 0.25 out` | inferred exact choreography from Crazy |
| `60s` completion | remove `60s` with cleanup; construct `text-go` with the same action | high-level recovered; geometry inferred |
| intro cut input | Bird blade exists before the first frame and cuts remain enabled; GO redundantly writes enabled again | inferred from recovered Bird entry plus Crazy cut gate |
| `GO` completion | remove GO with cleanup; start timer; `DisableCut(false)`; start the graph | recovered high-level |
| candidate GO start order | `ab,b0,b2,ac,b1,b3,ad,b5,ae,af`; omit `b4` | **unknown as exact mode-4 order**; explicit static blocker |
| countdown | shared `TimeManager` unscaled scheduler delta and exact warning/freeze rules | recovered |
| expiry | effects-gated time-up sound; unschedule; synchronous mode callback; create/attach `text-time-up`; update final label | recovered shared service |
| Time Up presentation | move in `1.0`, hold `1.0`, move out `1.0`; then finish callback | recovered shared service |
| immediate mode callback | candidate stop `ab,ad,ae,af,b0,b2,ac,b1,b3`; stop electric; finish double score; `(9,2)`, then `(5,2)` | high-level recovered; exact order/operands inferred |
| three-second overlap | cuts, `DoubleToss b4`, and `BonusToss b5` remain active until layer cleanup | inferred parity with Crazy |
| finish callback | disable cuts; stop effects; create Result; set mode `4` and authoritative score; remove gameplay cleanup; attach Result at z `1` | recovered |
| excluded terminal flow | no Classic Bird `GAME`/`OVER` chain | recovered timed-family distinction |

Crazy's exact intro choreography is reviewed at
`forensics/contracts/crazy-mode-contract.md:125-162`. The Crazy Bird report recovers the same
`text-60s`/`text-go` resources and callbacks but does not publish the mode-4 literal loads.
Therefore the `2.0`-action-second intro is the implementation contract but remains inferred for
mode 4.

The shared TimeManager behavior is directly recovered at
`forensics/contracts/classic-time-state-contract.md:373-530`:

- factory callback setter order is freeze-start, freeze-finish, time-up, time-up-finish;
- `Start()` only schedules; it does not reset;
- non-frozen update subtracts float32 `dt`, formats before expiry dispatch, and does not clamp;
- warning ticks use displayed-second equality;
- immediate time-up precedes `text-time-up` creation;
- the finish callback is nominally three action seconds later;
- there is no terminal guard or automatic cancellation of older time-up actions.

Creator phase names such as `intro`, `running`, `time-up`, and `result-transition` are inferred
architecture names, not recovered native enum constants.

## Cut, Fail, Bonus, Bomb, Freeze, and Magnet

### Fruit cuts

`CrazyBirdLayer::FruitCut` is recovered as a dedicated 152-byte body at
`0x0014A7FC...0x0014A893`. The exact operand-level table below is inferred from its Crazy
structural counterpart because the existing mode-4 report does not publish the switch trace.

| Fruit ID | Implementation order | Confidence |
|---:|---|---|
| all IDs except `10...14` | `ScoreManager::AddScore(suppliedScore)` | inferred exact parity |
| `10` | enable double score; add no cut score | inferred exact parity |
| `11` | start `DoubleToss`; then add `10` | inferred exact parity |
| `12` | `TimeManager::Freeze()`; then add `10` | inferred exact parity |
| `13` | `BombElectric::Start()`; then add `10` | inferred exact parity |
| `14` | create/attach `MagnetAnimation` with mode callbacks; then add `10` | inferred exact parity |

The function size, complete special callback surface, and prior direct-body recovery make this a
high-confidence implementation inference. Do not relabel it recovered for mode 4 until
`0x0014A7FC...0x0014A893` is independently tabulated.

### Misses and objective selectors

The objective manager mapping itself is recovered:

| Selector | Active objective | Bundled description |
|---:|---:|---|
| `5` | ID `47` | `No fruits drop Crazy Bird` |
| `9` | ID `51` | `No bombs hit Crazy Bird` |
| `20` | IDs `36...37` | `Score > 250/500 Crazy Bird` |

Evidence:
`researcher-2026-07-23-crazy-pause-objective.md:515-633`.

Candidate mode-owned calls:

| Callback | Candidate event | Behavior | Status |
|---|---|---|---|
| entry | `(9,0)`, then `(5,0)` | reset active no-bomb/no-drop counter | inferred call operands/order |
| `FruitFail(position)` | inherited base hook, then `(5,1)` | no strike, score mutation, controller stop, or terminal flow | callback recovered; exact selector inferred |
| `BonusFruitFail(position)` | `(5,1)` | same | callback recovered; exact selector inferred |
| `BombHit()` | `(9,1)` after gameplay mutations | increments active no-bomb counter | callback recovered; exact selector inferred |
| immediate time-up | `(9,2)`, then `(5,2)` | finish zero-violation objective | callback recovered; exact selector/order inferred |

IDs `47` and `51` use the recovered phase/counter rule:

- payload `0` stores `0`;
- payload `1` stores `old + 1`;
- payload `2` completes only when `old == 0`;
- successful completion writes `-2`, awards the reward for the current objective-order slot,
  advances the current objective, and builds completion UI synchronously.

### Bomb

Candidate exact Crazy-family sequence:

1. disable cuts;
2. invoke inherited base bomb hook;
3. add score `-10`;
4. disable double score and flush any pending bucket;
5. stop magnet-fruit FreeToss;
6. submit `(9,1)`.

`AfterBombHit` invokes the inherited hook and re-enables cuts. The hit is non-terminal and does
not stop the physics world. The function bodies are recovered at `0x0014A79E...0x0014A7DF`
and `0x0014A78C...0x0014A79D`; exact mode-4 operands are inferred from Crazy parity.

The standard bomb's independent nominal `2.5s` explosion action still owns the delayed
`AfterBombHit` call. This is different from Classic Bird, where bomb hit stops all tosses,
stops electric, freezes physics, applies no score penalty, and enters guarded Game/Over.

### Freeze

Recovered mode-4 callbacks:

- `FreezeStartCallback` at `0x0014A784` calls `PhysicsLayer::FreezeeWorld()`;
- `FreezeFinishCallback` at `0x0014A77C` calls `PhysicsLayer::UnFreezeeWorld()`.

Recovered shared `TimeManager::Freeze()` behavior:

- repeated freeze calls restart, not stack, the `15.0f` hold;
- remaining time does not decrease while frozen;
- freeze-start callback occurs before showing the freeze clock;
- toss schedulers continue on their ordinary scheduler clock;
- at `>=15.0f`, the service calls freeze-finish, hides the clock, and disables bonus ID `12`;
- the thaw tick does not subtract its `dt` from remaining.

See `forensics/contracts/classic-time-state-contract.md:480-530`.

### Magnet

Candidate Crazy-family behavior:

| Callback | Candidate exact behavior | Status |
|---|---|---|
| begin | mutate normal Free bounds `[0.5,3] -> [0.25,0.5]`; pause bomb Free, Concurrent, Wave in that order | inferred |
| end | restore `[0.5,3]`; resume the same three bomb controllers in the same order | inferred |

Changing bounds must not resample the current normal threshold. Paused bomb controllers retain
elapsed time and threshold. These scheduler effects are recovered shared behavior.

Exact Crazy Bird bounds cannot be derived from the callback's 96-byte size: Classic,
Classic Bird, Crazy, and Crazy Bird magnet callbacks all have the same size while known literal
values differ between Classic and Classic Bird. Therefore
`0x0014A3B8...0x0014A477` requires operand-level inspection before the Crazy values can be
called recovered for mode 4.

## Result, Rank, Reward, Replay, and Persistence

### Recovered mode-4 result contract

| Concern | Recovered mode-4 value |
|---|---|
| Result mode ID | `4` |
| score handed to Result | authoritative completed score from `ScoreManager::getBestScore()` call site; not the persisted baseline |
| first/second/third keys | `bird_crazy_best_1`, `bird_crazy_best_2`, `bird_crazy_best_3` |
| native globals | `BirdCrazyBest_1` `0x00482450`; `_2` `0x0048244C`; `_3` `0x00482448` |
| load defaults | all `0` |
| rank insertion | inclusive `>=`; ties promote |
| reward factor | float32 `0.8f` (`0x3F4CCCCD`) |
| retry | fresh `CrazyBirdLayer`, same captured parent, z-order `1` |
| menu | fresh Main Menu, same captured parent, z-order `1` |
| implicit scene reload/reseed/save | none |

Ranking:

```text
if score >= first:
  third = second
  second = first
  first = score
  rank = 1
else if score >= second:
  third = second
  second = score
  rank = 2
else if score >= third:
  third = score
  rank = 3
else:
  unchanged; no cup
```

Reward accounting:

```text
reward = truncTowardZero(float32(score) * float32(0.8))
newTotal = signedArmInt32Add(currentTotal, reward)
```

Static support:

- `remaining-mode-order.md:408-447` recovers mode-4 retry and `0.8` factor;
- `researcher-2026-07-23-classic-bird-contract.md:349-402` recovers the shared Bird rank,
  float32 reward, and durability rules;
- `java-jni-boundary.md:150-175` recovers all preference keys/defaults and save boundaries;
- the Crazy native report lines 114-135 recovers `BirdCrazyBest_1` binding.

### Durability boundaries

Do not promise immediate persistence for every mutation:

- `mode_unlock_4=true` is an indexed preference write and flushes immediately;
- the 2500-coin unlock deduction changes the process-static total and relies on a later bulk save;
- result rank setters update native globals;
- result coin accounting updates process-static total coins;
- `Settings::setTotalCoins` calls a native flush wrapper whose body is a no-op;
- Retry and Menu do not call `Settings::SaveData`;
- durable rank and total-coin storage waits for the later bulk-save boundary.

The shared result sequence applies the accounting callback after nominal `1.75` action seconds,
before the total-coin label update. This timing comes from the shared Result contract, not a
Crazy Bird-specific runtime observation.

`Leaderboard/leaderboard_crazy_bird.png` exists, but its direct Result consumer has not been
statically pinned. Asset presence is not proof of use.

## Differences From Crazy and Classic Bird

### Crazy Bird versus Crazy

| Concern | Crazy mode `1` | Crazy Bird mode `4` | Status |
|---|---|---|---|
| base/blade | standard gameplay/blade path | `BaseBirdLayer`; one `BirdBlade` type `2`; ordinary blades suppressed | recovered |
| timed controller family | eleven controllers plus TimeManager/electric | same published timed family | recovered at family level |
| exact controller rows/order | audited table | candidate same table | inferred for mode 4 |
| intro | `60s -> GO` | `60s -> GO` | recovered high-level; mode-4 literal choreography inferred |
| no-drop objective | selector `4`, ID `46` | selector `5`, ID `47` | manager mapping recovered; mode-4 call sites inferred |
| no-bomb objective | selector `8`, ID `50` | selector `9`, ID `51` | same |
| result mode | `1` | `4` | recovered |
| best keys | `crazy_best_1..3` | `bird_crazy_best_1..3` | recovered |
| reward | float32 `0.6` | float32 `0.8` | recovered |
| replay | fresh Crazy | fresh Crazy Bird | recovered |
| pre-GO RNG | ordinary Crazy intro consumers | Bird blade idle particles can consume shared RNG before GO | inferred consequence of recovered Bird update contract |

The Bird particle/update stream means equal controller start order does not guarantee an equal
global RNG state at GO.

### Crazy Bird versus Classic Bird

| Concern | Classic Bird mode `3` | Crazy Bird mode `4` | Status |
|---|---|---|---|
| blade | Bird type `1` | Bird type `2` | recovered |
| terminal rule | untimed; three misses/bomb -> guarded Game/Over | `60.0f` timer -> Time Up -> Result | recovered |
| controller graph | nine Bird-specific controllers | Crazy-family eleven-controller graph with Double/Bonus | family recovered; mode-4 rows inferred |
| intro | GOOD/LUCK, nominal `1.5s` | `60s`/GO, candidate nominal `2.0s` | recovered high-level |
| misses | `FruitFailManager`, terminal at three | `(5,1)`, non-terminal | selector call inferred |
| bomb | stop all; stop electric; freeze physics; no score change; terminal | disable cut; `-10`; flush double; stop magnet; `(9,1)`; later re-enable | mode-4 exact operands inferred |
| special IDs | `13`, `14` only | `10...14` | structural Crazy-family recovery |
| freeze | absent | ID `12`, `15.0s` TimeManager freeze | recovered |
| world speed | `EnableWorldSpeedUp(45.0f)` | candidate no progressive ramp | mode-4 absence inferred |
| result keys | `bird_classic_best_1..3` | `bird_crazy_best_1..3` | recovered |
| reward | float32 `0.8` | float32 `0.8` | recovered |
| result presentation | shared Result after Game/Over | shared Result after Time Up | recovered |

Do not reuse Classic Bird toss constants, terminal/fail service, bomb policy, or speed ramp in
Crazy Bird. Reuse the Bird blade/input/ray mechanics and shared mode-neutral toss primitives.

## Current Committed Source Seams

Current code already contains most reusable pieces, but several types are mode-1 or
type-1-specific:

| Source | Current boundary | Required mode-4 change |
|---|---|---|
| `game/assets/scripts/domain/crazy-toss-config.ts:1-217` | declares mode IDs `1` and `4`, but rows/slot offsets are the audited Crazy-mode table | share behavioral rows only after accepting/closing mode-4 inference; do not reuse native mode-1 offsets as mode-4 memory claims |
| `game/assets/scripts/domain/crazy-session.ts:18-21,118-347` | hardcodes mode `1`, `crazy_best_1`, objectives `8/4`, and Crazy result commands | inject mode ID, best key, objective selectors, base/blade entry commands, and result identity |
| `game/assets/scripts/domain/crazy-session.ts:173-236,294-330` | already centralizes entry, GO, time-up, and result command order | reuse with a mode-4 configuration after the GO/order inference is explicitly tracked |
| `game/assets/scripts/domain/crazy-fruit-cut.ts:1-75` | pure Crazy special dispatch | reusable if mode-4 operand parity is accepted/closed |
| `game/assets/scripts/domain/bird-blade-state.ts:7-50,90-97` | hardcodes Bird type `1` in state shape/docs | parameterize bird type while preserving recovered movement/RNG mechanics |
| `game/assets/scripts/domain/bird-resource-contract.ts:148-188` | hardcodes type-1 animation and left/right paths | add type-2 profile using `bird-anim-2-*`, `bird-left-2`, and `bird-right-2` |
| `game/assets/scripts/domain/recovered-result-ranking.ts:19-85` | already supports shared inclusive ranking and both `0.6`/`0.8` factors | add a thin mode-4 binding with Bird Crazy keys and the high factor |
| `game/assets/scripts/domain/classic-bird-session.ts:18-27` | owns type `1`, Classic Bird terminal policy, and `45s` ramp | reuse no terminal/fail/speed policy; only reuse Bird substrate |

Preferred boundary: a configured timed Bird session over the existing mode-neutral
`TimeManagerService`, Crazy toss strategies, score service, Bird blade service, and shared
Result ranking. Do not subclass Classic Bird behavior or branch inside Classic Bird's terminal
service.

## Implementation-Ready Invariants

1. Public/native mode identity is `4`; retry also creates mode `4`.
2. Unlock uses `mode_unlock_4`, default false, price `2500`.
3. Use the shared Bird input/ray pipeline and exactly one Bird blade with type `2`.
4. Do not initialize ordinary blades.
5. Keep Bird movement, cached-ray, particle, and shared-RNG behavior; parameterize visual type.
6. Compose the eleven-controller Crazy family, TimeManager, BonusManager, and BombElectric.
7. Until static closure says otherwise, use the candidate Crazy construction table above and
   record it as inferred mode-4 parity.
8. Construct but do not start the timer/controllers on scene entry.
9. Create `Text/text-60s.png`, then `Text/text-go.png`.
10. Use the candidate `0.25/0.5/0.25` action for each card and a nominal `2.0s` intro.
11. Preserve enabled Bird cut input during the intro unless B2 proves an entry disable.
12. GO removes its child with cleanup before timer/cut/controller work.
13. GO starts `TimeManager` before re-enabling cuts.
14. Keep the candidate start order
    `ab,b0,b2,ac,b1,b3,ad,b5,ae,af`; never start `b4` from GO.
15. Treat that GO order as a fidelity-release blocker until `0x0014A478...0x0014A51B`
    is revalidated.
16. ID `10` enables double score and contributes no cut score.
17. IDs `11...14` execute their effect before adding `10`.
18. Fruit and bonus misses are non-terminal and use candidate selector `5`.
19. Bomb is non-terminal: disable cut, `-10`, flush double, stop magnet, candidate selector
    `9`, delayed re-enable.
20. Freeze delegates physics start/finish to `FreezeeWorld`/`UnFreezeeWorld`.
21. Freeze restarts the shared `15.0s` hold; toss scheduler clocks continue.
22. Preserve threshold state through magnet pause/resume and do not resample on bound changes.
23. At immediate time-up, use the candidate stop order, stop electric, finish double score,
    then candidate `(9,2)`, `(5,2)`.
24. Preserve the inferred native overlap: cuts and `b4/b5` remain active through the
    three-second Time Up action.
25. Finish disables cuts and effects, configures Result with mode `4` and authoritative score,
    removes gameplay with cleanup, then attaches Result at z `1`.
26. Do not create GOOD/LUCK, strike markers, GAME/OVER, or the Classic Bird world-speed ramp.
27. Rank with inclusive `>=` using `bird_crazy_best_1..3`.
28. Reward with float32 `0.8`, truncation toward zero, then signed-int32 addition.
29. Do not save/reseed/reload a scene during Result Retry/Menu.
30. Keep rank/coin durability deferred to the existing bulk-save boundary.
31. Implement electric contacts through the reviewed type-safe Creator adaptation; do not
    reproduce the unsafe native layout.

## Static Closure Blockers

These are blockers to a claim of exact native parity. Only the first is already called out by
the prior native report as a verbatim-port blocker; the rest close inferred operands that an
implementation can keep behind explicit configuration.

| ID | Required static inspection | Exact range / anchor | Why it matters |
|---|---|---|---|
| B1 | trace `ActionGoCallback` call order and field/slot targets | `0x0014A478...0x0014A51B` | resolves exact start order and `b4` omission for mode 4 |
| B2 | tabulate every `onEnter` constructor literal, add order, field target, BirdBlade placement, pause/best calls, and any speed-ramp call/absence | `0x0014A894...0x0014ACBD`; Double call `0x0014A9E0`; Bonus call `0x0014AA7E` | promotes the candidate eleven-row table and entry sequence from inferred to recovered |
| B3 | resolve both magnet callbacks' float literals and controller field targets | `0x0014A3B8...0x0014A477` | equal function size cannot distinguish Crazy versus Bird bounds |
| B4 | trace immediate time-up field targets and objective immediates | `0x0014A6D6...0x0014A76F` | proves stop order, `b4/b5` omissions, and `(9,2)->(5,2)` |
| B5 | tabulate objective immediates and special switch operands | `0x0014A770...0x0014A893` | promotes `(5,1)`, `(9,1)`, bomb order, and IDs `10...14` from parity inference |
| B6 | archive reviewer-reproducible text slices for B1-B5 in the curated corpus | derived text only; never ship the binary | prevents future reports from depending on uncommitted targeted disassembly |

No runtime inspection is required or authorized for these items. They are static body/literal
checks against the registered evidence process, to be performed only under the repository's
approved forensic workflow.

## Non-Blocking Unknowns and Safety Decisions

- The original source-level wrapper spelling for the recovered remove-child-with-cleanup
  virtual remains unknown. Observable behavior is known.
- Native shared-RNG seed width/state transition and frame-level interleaving with Cocos/VFX
  consumers remain unresolved
  (`forensics/contracts/classic-toss-contract.md:543-552`).
- Bird idle particles and touch/swish activity during the intro make exact session RNG streams
  frame/input dependent.
- The direct consumer of `Leaderboard/leaderboard_crazy_bird.png` is unresolved.
- Native electric contact layout is unsafe; its exact player-visible failure mode is not a
  restoration target. A type-safe adaptation is mandatory.
- Exact native member offsets/allocation layout are unnecessary for Creator composition and
  must not leak into public service contracts.
- Asset presence and hash fidelity do not establish redistribution rights.
- Pixel, audio-latency, and original-frame parity cannot be claimed without a lawful supported
  reference; deterministic contract tests remain the validation boundary.

## Recommended Static Acceptance Fixtures

- Snapshot identity `4`, unlock key/default/price, Bird type `2`, and Bird Crazy best keys.
- Snapshot the candidate eleven-row table separately from its confidence metadata.
- Assert entry emits mode-4 objective resets before controller construction.
- Assert timer callback setter order and no start at entry.
- Assert `60s -> GO` resources and candidate `2.0s` action plan.
- Assert GO timer/cut/controller order with a test name that does not call the mode-4 order
  recovered until B1 closes.
- Assert exact TimeManager warning, freeze, and Time Up service behavior.
- Assert IDs `10...14` effect-before-score, ID `10` no-score, and supplied-score fallback.
- Assert candidate `(5,1)` misses and candidate bomb `(9,1)`.
- Assert candidate time-up stop order, candidate `(9,2)->(5,2)`, and `b4/b5` overlap.
- Assert Result mode `4`, authoritative score, cleanup swap, and z-order `1`.
- Assert inclusive ranking, `0.8f` reward, signed-int32 addition, and deferred durability.
- Assert retry reconstructs Crazy Bird and never Crazy mode or Classic Bird.
- Assert the Bird type-2 resource profile uses type-2 frame/left/right paths without changing
  shared Bird movement/particle rules.

## Unresolved Questions

1. Do the B1-B5 static slices confirm operand-for-operand parity with Crazy, or does mode 4 use
   Bird-specific toss/magnet bounds?
2. Is Bird blade creation placed after `BombElectric` and before pause initialization, as in
   Classic Bird?
3. Does Crazy Bird omit `EnableWorldSpeedUp` completely, as expected from the Crazy timed graph?
4. Which component directly consumes `Leaderboard/leaderboard_crazy_bird.png`?
5. Should the implementation expose fidelity metadata so candidate parity can be promoted
   without changing gameplay service APIs after B1-B5 close?

Status: DONE_WITH_CONCERNS

Summary: Mode-4 implementation contract closed as recovered Crazy timed lifecycle plus recovered
Bird type-2 substrate, with exact candidate controller/event tables and confidence boundaries.

Concerns/Blockers: Native-exact promotion requires static operand/order inspection of
`0x0014A3B8...0x0014ACBD`, especially `ActionGoCallback`; no original runtime use is authorized.

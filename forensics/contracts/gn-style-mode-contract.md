# GN Style Mode 2 Contract

Status: production implementation integrated; Creator 3.8.8 Browser Preview passed

## Scope and evidence policy

This clean-room contract specifies the original `GNStyleLayer`, Mode Select index `2`.
The original APK cannot run on any available current Android device. It was not installed,
linked, translated, emulated, or executed while deriving this contract.

Evidence comes from:

- immutable `libgame.so`, SHA-256
  `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`;
- registered ARM/Thumb static disassembly and symbol/string inventories;
- the exact packaged `480x800` and `720x1280` resource trees;
- the generated 439-call choreography artifact pinned to the native function;
- shared Classic physics, ordinary-fruit, score, pause, objective, TimeManager, and Result
  contracts.

Unless marked otherwise, behavior below is recovered from static evidence. This file contains
no native code or mechanically translated disassembly.

## Identity and high-level rules

| Property | Recovered value |
|---|---|
| Mode Select index | `2` |
| Destination | `GNStyleLayer` |
| `GetGameMode()` | `2` |
| Unlock key | `mode_unlock_2` |
| Unlock default | `false` |
| Unlock price | `2500` coins |
| Blade | standard selected blade; clean default is `BasicBlade` |
| Clock total | `150.0` seconds |
| Best-score keys | `gnstyle_best_1`, `gnstyle_best_2`, `gnstyle_best_3` |
| Initial leaderboard | `0, 0, 0` |
| Result selector | `2` |
| Result reward factor | float32 `0.6`, truncated toward zero |
| Background track | `Sounds/GangnamStyle.mp3`, non-looping |

GN Style is an ordinary-fruit-only timed mode. It does not use BirdBlade, lives, bombs,
bonus fruit, double score, freeze, electric, magnet, or Dragon fruit.

## Entry, intro, and start order

Scene entry creates the three ordinary toss controllers, TimeManager, intro cards, particle
choreography, standard score/combo/fruit presentation, pause UI, and mode-2 leaderboard
baseline. Objective selector `6` receives payload `0`.

The detached presentation is attached before actions or pause input start. The intro is:

1. construct `text-nobomb`, `text-gnstyle`, `text-nolive`;
2. attach at equal z-order in order `text-gnstyle`, `text-nobomb`, `text-nolive`;
3. start all three slides in the same frame;
4. after `0.75s`, replace them with `text-150s`;
5. after another `0.95s`, replace it with `text-go`;
6. after another `0.90s`, enter gameplay.

The three instruction slides use move `0.25s`, hold `0.25s`, move `0.25s`.
The `150s` slide uses move `0.35s`, hold `0.25s`, move `0.35s`.
The `GO` slide uses move `0.325s`, hold `0.25s`, move `0.325s`.
Nominal StartGame time is therefore `2.60s`.

At StartGame, commit in this order:

1. stop shared background music;
2. play the dedicated GN track once when music is enabled;
3. start Free;
4. start Wave;
5. start Concurrent;
6. start TimeManager;
7. initialize the 439 prepared particle parents in source order.

Preparation must not acquire input/physics/audio clocks or start particle actions.

## Toss graph

All controllers produce ordinary fruit type `0`, direction `0`, at z-order `1`.
Shared interval sampling and RNG ownership follow `classic-toss-contract.md`.

| Order | Slot | Controller | Outer interval | Additional parameters |
|---:|---:|---|---|---|
| 1 | `+0x2AC` | Free | `[0.5, 3]` | — |
| 2 | `+0x2B0` | Wave | `[3.5, 8]` | child `[0.25, 0.75]`, active `[1.5, 6]` |
| 3 | `+0x2B4` | Concurrent | `[3, 9]` | constructor `(3, 6)`, actual inclusive count `3...7` |

Creation, equal-z attachment, start, and Time Up outer-stop all use
`Free -> Wave -> Concurrent`.

Coordinator updates run before TimeManager each active frame. At Time Up only the three outer
controllers stop. An armed Wave pause callback and Wave child remain live during the three-second
Time Up presentation, as do input, Physics2D, existing entities, score, and combo.

## Time Up, Result, and objectives

The clock reaches zero at nominal mode time `152.60s`. The immediate callback:

1. stops only Free, Wave, and Concurrent outer schedulers, in that order;
2. dispatches objective selector `6`, payload `2`;
3. begins the shared three-second Time Up presentation.

At nominal `155.60s`, sample the final score after the late-cut window and transactionally:

1. construct Result for mode `2` using the sampled score;
2. prepare the leaderboard mutation;
3. remove/release GN gameplay ownership;
4. attach Result;
5. irreversibly commit the ranking and Result owner;
6. attempt the recovered final objective dispatch exactly once using selector `2` and the
   completed score.

The objective selector-6 payloads are:

| Boundary | Payload |
|---|---:|
| entry | `0` |
| fruit fail | `1` |
| timer reaches zero | `2` |

Result ties use the shared recovered `>=` insertion semantics. Coin math is float32 multiply,
truncation toward zero, then signed-int32 wrapping.

Retry constructs a fresh mode-2 owner at z-order `1` under the captured Result parent. Result
Menu and Pause Quit use the persistent app shell's transactional Main Menu route. Native
navigation has no save call, delay, scene reload, RNG reseed, or shared-state reset.

## Music ownership

GN owns one dedicated non-looping `AudioSource`.

- start stops shared background first, then plays GN music only if enabled;
- pause pauses the same source;
- resume continues the same source;
- disabling music quiesces it;
- natural completion does not restart it;
- retry, Quit, Result Menu, failed activation, replacement, and destruction stop it
  idempotently;
- shared background and GN music may never play simultaneously.

TimeManager tick/time-up effects use the shared exact effect owner and remain governed by the
effects setting.

## Particle choreography

`GNStyleLayer::InitParticlesExplosion` contains exactly 439 direct `AddParticle` calls.
The canonical generated artifact is:

`forensics/native/gn-style-particle-choreography.json`

Its ordered row payload hash is:

`6c8dd814fb776e15507c2f42081b315bd410ea5b9a9156a4726c186504507c97`

Family counts are:

| Family raster | Parents |
|---|---:|
| `xmasfive.png` | 223 |
| `xmasfour.png` | 128 |
| `stars.png` | 32 |
| `VN Flag/vnflagstar.png` | 30 |
| `xmashexa.png` | 17 |
| `xmascircle.png` | 9 |

Every row has a unique source ordinal/call site. The extractor pins the native artifact hash,
function bounds, 439-call cardinality, and generated-table hash.

Width scale is float32 `frameWidth / 480`. Count scale is float32 `0.45` for widths
`720...1136`; otherwise it is
`min(float32(float32(width * height) * 2^-20), float32(1))`.
Scaled count/min/max values truncate toward zero.

Each parent preserves the native RNG call protocol, family flags, child construction order,
delay, position, scale, rotation, opacity, motion, and lifetime. Parent cleanup occurs at:

```text
delay + 2 * maxDurationHundredths / 100
```

It is not a fixed duration. Twelve parents outlive the nominal Result boundary and are removed
by GN owner teardown. A generic Creator particle emitter is not a valid substitute.

## Resource closure and release gate

The route consumes the shared standard-gameplay resources plus five exact intro rasters,
six particle-family rasters, the exact GN track, shared audio, and shared fonts. Both resolution
profiles are staged with their original bytes and matching metadata.

Technical reconstruction does not establish redistribution rights. Public release remains
blocked until the name/music/art/font rights are cleared or the user explicitly chooses a
different licensed release policy.

## Acceptance

GN Style is production-complete only when deterministic contracts, extractor verification,
strict Creator TypeScript, all shared regressions, serialized scene integration, and a fresh
Cocos Creator 3.8.8 Browser Preview pass. Preview must prove one current screen, one standard
input owner, one gameplay physics owner, at most one GN music source, no shared/GN music
overlap, and no pending cleanup/fatal lifecycle capture across entry, pause/resume, replay,
retry, Pause Quit, Result Menu, and repeated re-entry.

The 2026-07-24 production checkpoint satisfies this technical gate: `1151/1151`
vertical-slice tests and `43/43` script/resource tests pass with strict Creator TypeScript,
clean diff hygiene, zero duplicate asset UUIDs, and no structural metadata error. Fresh
Preview exercised entry, the `2.60s` intro, live ordinary-fruit cuts, score, the 439-parent
effect, Pause/Resume, Replay, Pause Quit, repeated entry, natural Time Up, Result Retry, and
Result Menu. DevTools reported zero application/runtime errors; one unrelated Chrome
extension error remained outside the game. Global consumer coverage, Android build audit,
and release rights remain separate open gates.

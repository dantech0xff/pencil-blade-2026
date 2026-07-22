---
title: Classic playable-slice audio consumer contract
date: 2026-07-22
status: complete
evidence_mode: static-only
scope: recovered audio inventory, Classic event ownership, deterministic selection, Cocos Creator 3.8.8 loading contract
---

# Classic playable-slice audio consumer contract

## Summary

The recovered corpus contains exactly **62 audio files** under `Sounds/`: 59 PCM WAV files and 3 MP3 files. Static consumer evidence assigns only a subset to the standard Classic slice. The strongest recovered Classic mappings are:

- mode selection -> `Sounds/gameplayselected.wav`;
- normal fruit toss -> `Sounds/tossfruit.wav`;
- bomb toss -> `Sounds/boomtoss.wav`;
- accepted, unlocked swipe -> one shared-RNG selection from `Sounds/swoosh1.wav` through `Sounds/swoosh9.wav`;
- fruit cut -> an ID-dependent base clip, followed by `Sounds/critical.wav` when the fruit's stored critical flag is true;
- eligible combo close -> one shared-RNG selection from `Sounds/compo1.wav` through `Sounds/compo3.wav`;
- bomb entry/cut -> `Sounds/boomsound.wav`, then `Sounds/boomexplosion.wav` after the bomb-hit notification;
- pause/resume controls -> `Sounds/menubuttonclick.wav` in the recovered ordering;
- result rank update -> at most one of `Sounds/thirdplace.wav`, `Sounds/secondplace.wav`, or `Sounds/firstplace.wav`.

There is **no direct audio request** in the recovered GOOD/LUCK start callback, normal miss animation, `ClassicModeLayer::GameOver`, or result-layer `onEnter` ranges. At the result handoff, the original requests `stopAllEffects`. Therefore this contract does not invent an intro sting, miss sound, GAME/OVER sound, score-screen sound, or Classic background track from filenames alone.

This is an evidence-backed implementation contract, not a claim of runtime observation or 99% audiovisual fidelity. The original APK and `libgame.so` were never run, loaded, or linked during this investigation.

## Scope, method, and evidence strength

The required repository-root `README.md` is absent. `forensics/README.md` was read as the available repository overview; that missing root document is a documentation limitation, not evidence about audio behavior.

Static-only sources used:

| Source | Use |
|---|---|
| `assets/catalog/creator-staging-manifest.json` | Exact canonical audio paths, bytes, hashes, declared `cc.AudioClip` type |
| `forensics/resources/resource-usage-map.json` (`DER-RESMAP-001`) | Recovered path/string presence and WAV header metadata |
| `forensics/native/function-map.csv` (`DER-FUNCMAP-001`) | Native symbol boundaries and addresses |
| `forensics/contracts/classic-toss-contract.md` (`DER-CLASSIC-TOSS-001`) | Toss controller membership, spawn ordering, type-to-sound behavior |
| `forensics/contracts/classic-cut-score-contract.md` (`DER-CLASSIC-CUT-SCORE-001`) | Swipe, cut, critical, combo, bomb, miss, and score ordering |
| `forensics/contracts/classic-time-state-contract.md` (`DER-CLASSIC-TIME-STATE-001`) | Standard Classic has no owned `TimeManager`; game-over timing |
| `forensics/contracts/classic-presentation-contract.md` (`DER-CLASSIC-PRESENTATION-001`) | Selection, intro, pause, GAME/OVER, and result-layer presentation order |
| `game/assets/game.meta` and all 62 `Sounds/*.meta` files | Creator bundle/importer status (`isBundle: true`, `audio-clip`, imported, `downloadMode: 0`) |
| `game/assets/scripts/domain/classic-resource-contract.ts` | Canonical-path normalization/extension stripping contract |
| `game/assets/scripts/creator/classic-resource-loader.ts` | Current `game` bundle acquisition pattern and raster-only `/spriteFrame` behavior |
| Local pinned Cocos Creator 3.8.8 engine source | `Bundle.load` overloads/path semantics and `AudioSource.playOneShot` API contract |

Additional checks used two independent static disassemblers over the already-hashed native artifact and agreed on the relevant ranges: `PhysicsBladeLayer::PlaySwoshSound` (`0x001605A0..0x0016062C`), `PhysicsBladeLayer::DelayCallback` (`0x001602B4`), `Fruit::PlayCutSound` (`0x001505A4..0x00150644`), `Fruit::Cut` (`0x00150648..0x00150B60`), `ComboManager::PlayRandomComboSound` (`0x0014A11C..0x0014A170`), and `TossTurn::PlayTossSound` (`0x00165228..0x00165270`). The native library SHA-256 remains the registered `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e` `DER-NATIVE-001` artifact. These were read as data only.

Evidence labels in this report:

- **Direct**: a recovered call site and literal/switch/array establish the event-to-path request.
- **Negative-in-range**: the bounded recovered function range has no direct audio request; this does not prove no indirect sound elsewhere.
- **Presence-only**: the asset/path exists, but standard Classic ownership or trigger timing is not recovered.
- **Implementation recommendation**: a clean-room design needed to preserve known behavior; not a recovered original fact.

## Exact recovered audio inventory

Every canonical path below physically exists at `game/assets/game/<canonical-path>`. Durations, sample rates, channels, and codecs were obtained by read-only `ffprobe` inspection of the recovered files. WAV files are PCM signed 16-bit little-endian (`pcm_s16le`). MP3 durations are container/header-derived approximations, not playback measurements. No file was played.

### MP3 files (3)

| Canonical path | Codec | Sample rate | Channels | Duration (s) |
|---|---:|---:|---:|---:|
| `Sounds/electric.mp3` | MP3, 96 kb/s | 22,050 Hz | 1 | 8.411417 |
| `Sounds/GangnamStyle.mp3` | MP3, 96 kb/s | 22,050 Hz | 1 | 149.263667 |
| `Sounds/mainmenumusic.mp3` | MP3, 96 kb/s | 22,050 Hz | 1 | 59.898750 |

### WAV files (59)

| Canonical path | Codec | Sample rate | Channels | Duration (s) |
|---|---:|---:|---:|---:|
| `Sounds/apple.wav` | PCM s16le | 22,050 Hz | 1 | 0.234014 |
| `Sounds/banana.wav` | PCM s16le | 22,050 Hz | 1 | 0.224943 |
| `Sounds/boomexplosion.wav` | PCM s16le | 22,050 Hz | 1 | 4.394376 |
| `Sounds/boomhit.wav` | PCM s16le | 22,050 Hz | 1 | 1.110159 |
| `Sounds/boomsound.wav` | PCM s16le | 22,050 Hz | 1 | 6.207755 |
| `Sounds/boomtoss.wav` | PCM s16le | 22,050 Hz | 1 | 0.518322 |
| `Sounds/cheer.wav` | PCM s16le | 44,100 Hz | 2 | 1.071020 |
| `Sounds/compo1.wav` | PCM s16le | 44,100 Hz | 1 | 1.137778 |
| `Sounds/compo2.wav` | PCM s16le | 44,100 Hz | 1 | 1.230658 |
| `Sounds/compo3.wav` | PCM s16le | 44,100 Hz | 1 | 1.258141 |
| `Sounds/critical.wav` | PCM s16le | 22,050 Hz | 1 | 1.530884 |
| `Sounds/doublepoint.wav` | PCM s16le | 22,050 Hz | 1 | 0.935057 |
| `Sounds/doubletoss.wav` | PCM s16le | 22,050 Hz | 2 | 3.428571 |
| `Sounds/doubletosstrum.wav` | PCM s16le | 22,050 Hz | 2 | 1.204535 |
| `Sounds/eapplecut.wav` | PCM s16le | 22,050 Hz | 1 | 0.773061 |
| `Sounds/ehit1.wav` | PCM s16le | 22,050 Hz | 1 | 0.390023 |
| `Sounds/ehit2.wav` | PCM s16le | 22,050 Hz | 1 | 0.395057 |
| `Sounds/ehit3.wav` | PCM s16le | 22,050 Hz | 1 | 0.371882 |
| `Sounds/ehit4.wav` | PCM s16le | 22,050 Hz | 1 | 0.415329 |
| `Sounds/electricexplose.wav` | PCM s16le | 48,000 Hz | 2 | 1.334667 |
| `Sounds/finishhitmusic.wav` | PCM s16le | 22,050 Hz | 2 | 1.204535 |
| `Sounds/firstplace.wav` | PCM s16le | 22,050 Hz | 1 | 3.008980 |
| `Sounds/freeze.wav` | PCM s16le | 22,050 Hz | 1 | 1.772290 |
| `Sounds/fruitfail.wav` | PCM s16le | 22,050 Hz | 1 | 0.380952 |
| `Sounds/gameplayselected.wav` | PCM s16le | 22,050 Hz | 1 | 3.000000 |
| `Sounds/get_coins.wav` | PCM s16le | 44,100 Hz | 1 | 3.709388 |
| `Sounds/hitmusic.wav` | PCM s16le | 22,050 Hz | 1 | 2.431746 |
| `Sounds/juice1.wav` | PCM s16le | 22,050 Hz | 1 | 0.609887 |
| `Sounds/juice2.wav` | PCM s16le | 22,050 Hz | 1 | 0.566531 |
| `Sounds/juice3.wav` | PCM s16le | 22,050 Hz | 1 | 0.977778 |
| `Sounds/juice4.wav` | PCM s16le | 22,050 Hz | 1 | 0.480408 |
| `Sounds/kiwi.wav` | PCM s16le | 22,050 Hz | 1 | 0.330567 |
| `Sounds/lightning1.wav` | PCM s16le | 22,050 Hz | 1 | 2.612245 |
| `Sounds/lightning2.wav` | PCM s16le | 22,050 Hz | 1 | 3.735510 |
| `Sounds/magnet.wav` | PCM s16le | 44,100 Hz | 2 | 3.657143 |
| `Sounds/mangosteen.wav` | PCM s16le | 22,050 Hz | 1 | 0.249615 |
| `Sounds/menubuttonclick.wav` | PCM s16le | 44,100 Hz | 2 | 0.185760 |
| `Sounds/mono1.wav` | PCM s16le | 22,050 Hz | 1 | 0.750975 |
| `Sounds/mono2.wav` | PCM s16le | 22,050 Hz | 1 | 0.749660 |
| `Sounds/orange.wav` | PCM s16le | 22,050 Hz | 1 | 0.249615 |
| `Sounds/pineapple.wav` | PCM s16le | 22,050 Hz | 1 | 0.249615 |
| `Sounds/powerup.wav` | PCM s16le | 44,100 Hz | 2 | 1.097143 |
| `Sounds/scorescreen.wav` | PCM s16le | 22,050 Hz | 1 | 0.745714 |
| `Sounds/secondplace.wav` | PCM s16le | 22,050 Hz | 1 | 3.002177 |
| `Sounds/strawberry.wav` | PCM s16le | 22,050 Hz | 1 | 0.232200 |
| `Sounds/swoosh1.wav` | PCM s16le | 22,050 Hz | 1 | 0.183356 |
| `Sounds/swoosh2.wav` | PCM s16le | 22,050 Hz | 1 | 0.265669 |
| `Sounds/swoosh3.wav` | PCM s16le | 22,050 Hz | 1 | 0.178912 |
| `Sounds/swoosh4.wav` | PCM s16le | 22,050 Hz | 1 | 0.294785 |
| `Sounds/swoosh5.wav` | PCM s16le | 22,050 Hz | 1 | 0.198322 |
| `Sounds/swoosh6.wav` | PCM s16le | 22,050 Hz | 1 | 0.205805 |
| `Sounds/swoosh7.wav` | PCM s16le | 22,050 Hz | 1 | 0.210295 |
| `Sounds/swoosh8.wav` | PCM s16le | 22,050 Hz | 1 | 0.150431 |
| `Sounds/swoosh9.wav` | PCM s16le | 22,050 Hz | 1 | 0.181859 |
| `Sounds/thirdplace.wav` | PCM s16le | 22,050 Hz | 1 | 3.071927 |
| `Sounds/timetick.wav` | PCM s16le | 22,050 Hz | 1 | 0.061361 |
| `Sounds/timeup.wav` | PCM s16le | 22,050 Hz | 1 | 2.098413 |
| `Sounds/tossfruit.wav` | PCM s16le | 22,050 Hz | 1 | 0.775782 |
| `Sounds/waterfruit.wav` | PCM s16le | 22,050 Hz | 1 | 0.480408 |

The manifest hashes establish three byte-identical groups. Preserve canonical path identity even when bytes match:

- `Sounds/mangosteen.wav`, `Sounds/orange.wav`, and `Sounds/pineapple.wav`;
- `Sounds/juice4.wav` and `Sounds/waterfruit.wav`;
- `Sounds/doubletosstrum.wav` and `Sounds/finishhitmusic.wav`.

Do not deduplicate these into one public resource key. Native code selects canonical names, and later consumer evidence may distinguish semantically named copies.

## Classic event-to-audio contract

All recovered calls in this section request non-looping effects unless explicitly described as a global pause/resume/stop operation. The original effects-enabled setting gates playback at the locations described below.

### Event matrix

| Classic event | Recovered audio request | Gate/order/selection | Evidence |
|---|---|---|---|
| Classic chosen on mode-select screen | `Sounds/gameplayselected.wav` | If effects enabled; one request, then the exact 0.75 s handoff delay begins. The 3.0 s clip can therefore overlap the transition. | Direct |
| GOOD/LUCK entry/start callback | None in covered ranges | Cutting remains enabled and gameplay starts after the recovered start delay, but no intro clip is requested by the bounded callbacks. | Negative-in-range |
| Toss type 0 | `Sounds/tossfruit.wav` | If effects enabled; request occurs after kinematics and before z-order attachment. | Direct |
| Toss type 1 | `Sounds/boomtoss.wav` | If effects enabled; same per-entity ordering. | Direct |
| Toss type 2 | `Sounds/boomtoss.wav` | Recovered base toss mapping, but type 2 is absent from the standard Classic nine-controller table. | Direct, outside current Classic table |
| Toss type 5 | `Sounds/tossfruit.wav` | Recovered base toss mapping, but type 5 is absent from the standard Classic nine-controller table. | Direct, outside current Classic table |
| Toss type 3 or 4 | No base toss request | Standard Classic includes electric (3) and magnet (4); do not add a generic toss sound. | Direct negative branch |
| Toss type 6 | No base toss request | DragonFruit bypasses the base toss-sound path. | Direct negative branch |
| Accepted, unlocked swipe | One of `Sounds/swoosh1.wav` ... `Sounds/swoosh9.wav` | Strict segment threshold, shared RNG, effects gate, then 0.5 action-second lock described below. | Direct |
| Ordinary fruit cut | ID-dependent base clip | Base cut clip is requested late in `Fruit::Cut`, after cut-piece/critical presentation creation and before the notification. | Direct |
| Critical fruit cut | Base clip, then `Sounds/critical.wav` | Critical flag is stored on the fruit. If effects enabled, critical follows the base request in the same call. | Direct |
| Eligible combo closes | One of `Sounds/compo1.wav`, `Sounds/compo2.wav`, `Sounds/compo3.wav` | Cluster count >= 3 and close after `> 0.25` s; sound occurs after combo UI attach/score add and before reset. | Direct |
| Bomb enters | `Sounds/boomsound.wav` | If effects enabled; non-looping request with a retained effect handle. | Direct |
| Bomb is first cut | `Sounds/boomexplosion.wav` | Stop retained bomb-effect handles; build explosion; synchronously notify `BombHit`; only after notification returns, request explosion if effects enabled. | Direct |
| Normal fruit miss / miss mark | None in covered fail-manager and fail-animation ranges | `Sounds/fruitfail.wav` exists, but no direct ownership/timing was recovered. | Negative-in-range + presence-only |
| `ClassicModeLayer::GameOver` / GAME then OVER | None in covered ranges | Do not attach a GAME/OVER sting from a filename. | Negative-in-range |
| Result handoff after GAME/OVER | `stopAllEffects` | Unconditional, immediately before removing Classic and inserting the result layer at nominal 2.5 s after GAME. | Direct control operation |
| Result-layer `onEnter` | None in covered range | `Sounds/scorescreen.wav` exists but is not directly requested here. | Negative-in-range + presence-only |
| Result rank update | At most one of `thirdplace.wav`, `secondplace.wav`, `firstplace.wav` | If effects enabled and the corresponding recovered rank branch is taken; requested after header/medal/menu creation and before remaining labels/coins. | Direct |
| Pause button callback | `Sounds/menubuttonclick.wav`, then `pauseAllEffects` | If effects enabled, click request precedes global effects pause. If music enabled, background music is also paused. | Direct |
| Resume button callback | `Sounds/menubuttonclick.wav`, then `resumeAllEffects` | If effects enabled, click request precedes resume. Background-music resume is guarded by game mode `== 2`; recovered Classic reports mode `0`. | Direct |

### Swipe selection and cooldown

The recovered swipe sound contract is exact enough to implement without choosing a new policy:

1. Compute the segment length and accept only when it is strictly greater than `float32(0.0825 * viewportWidth)`.
2. If the swish lock is already set, return without an RNG draw or audio request.
3. Otherwise call the shared `RandomHelper::nextInt(0, 8)` and map 0..8 in order to `Sounds/swoosh1.wav` .. `Sounds/swoosh9.wav`. The native pointer table at VMA `0x4792C4` contains those nine paths in that order.
4. Check the effects-enabled setting. If enabled, request the selected clip once. If disabled, suppress playback **but retain the RNG draw**.
5. Set the swish lock and clear it from `DelayCallback` after a 0.5 s action. This is an action-clock cooldown; pause behavior should follow the slice's action-clock contract rather than an independent wall timer.

The effects-off RNG behavior is important: moving the gate before selection changes subsequent shared-RNG outcomes.

### Fruit ID-to-cut mapping

`Fruit::PlayCutSound` uses a direct ID switch. Filename intuition is not a substitute for this table.

| Fruit ID | Recovered base cut clip |
|---:|---|
| 0 | `Sounds/apple.wav` |
| 1 | `Sounds/banana.wav` |
| 2 | `Sounds/strawberry.wav` |
| 3 | `Sounds/waterfruit.wav` |
| 4 | `Sounds/waterfruit.wav` |
| 5 | `Sounds/mangosteen.wav` |
| 6 | `Sounds/apple.wav` |
| 7 | `Sounds/strawberry.wav` |
| 8 | `Sounds/apple.wav` |
| default branch (> 8 in the recovered switch) | `Sounds/mangosteen.wav` |

Consequences:

- Do **not** map `Sounds/kiwi.wav`, `Sounds/orange.wav`, or `Sounds/pineapple.wav` to ordinary cuts merely because their names resemble fruit identities; the recovered switch contradicts that guess.
- IDs 13/14 would reach the default clip only when their concrete cut path delegates to unchanged `Fruit::Cut`; do not generalize the default to special-object implementations whose delegation is not established.
- No random draw occurs inside `Fruit::PlayCutSound`.
- When the stored critical flag is true, `Sounds/critical.wav` follows the base clip. The nominal critical assignment is the normal-fruit `nextInt(0, 24) == 0` branch (1/25 for an isolated uniform draw), but the exact global sequence remains interleaved with other shared RNG consumers.

### Combo selection

On an eligible combo close and with effects enabled, call shared `RandomHelper::nextInt(1, 3)` and map 1/2/3 directly to `Sounds/compo1.wav`, `Sounds/compo2.wav`, and `Sounds/compo3.wav`. With effects disabled, the original branch performs **neither the draw nor playback**. This differs from swipe handling and must remain event-specific.

### Bomb sequencing and controllable effects

The standard Classic controller table includes type 1/ID 0 bomb tosses, so `Sounds/boomtoss.wav` is the base toss request. Bomb entry separately requests `Sounds/boomsound.wav` and retains an effect handle. On the first cut, the bomb path stops its retained effect handles before constructing the explosion. It synchronously notifies Classic `BombHit`, whose gameplay mutations happen before control returns, and only then requests `Sounds/boomexplosion.wav` when effects are enabled.

`Sounds/boomhit.wav` belongs to a distinct BombElectric bonus path in the static corpus. It is not the ordinary Classic bomb-cut sound and must not be substituted for `Sounds/boomexplosion.wav`.

### Game over and background music

Standard Classic has no owned `TimeManager`, so `Sounds/timetick.wav`, `Sounds/timeup.wav`, and `Sounds/freeze.wav` must not be attached to its loop simply because they exist. Likewise, no recovered call site assigns `Sounds/mainmenumusic.mp3`, `Sounds/GangnamStyle.mp3`, or `Sounds/electric.mp3` as Classic background music. The recovered pause/resume music asymmetry does not establish a Classic music-start consumer.

## Presence-only and out-of-slice assets

The inventory is broader than the playable Classic contract. Until a direct call site is recovered, the following must not be assigned new Classic triggers:

- presentation/result candidates with unresolved ownership: `Sounds/cheer.wav`, `Sounds/fruitfail.wav`, `Sounds/get_coins.wav`, `Sounds/scorescreen.wav`;
- fruit/effect candidates contradicted or unsupported for ordinary cuts: `Sounds/eapplecut.wav`, `Sounds/kiwi.wav`, `Sounds/orange.wav`, `Sounds/pineapple.wav`, `Sounds/juice1.wav`, `Sounds/juice2.wav`, `Sounds/juice3.wav`, `Sounds/juice4.wav`;
- electric/magnet/power candidates whose standard Classic trigger sequence is not fully established here: `Sounds/boomhit.wav`, `Sounds/ehit1.wav`, `Sounds/ehit2.wav`, `Sounds/ehit3.wav`, `Sounds/ehit4.wav`, `Sounds/electricexplose.wav`, `Sounds/lightning1.wav`, `Sounds/lightning2.wav`, `Sounds/magnet.wav`, `Sounds/powerup.wav`;
- other mode/power/time candidates: `Sounds/doublepoint.wav`, `Sounds/doubletoss.wav`, `Sounds/doubletosstrum.wav`, `Sounds/finishhitmusic.wav`, `Sounds/freeze.wav`, `Sounds/hitmusic.wav`, `Sounds/mono1.wav`, `Sounds/mono2.wav`, `Sounds/timetick.wav`, `Sounds/timeup.wav`;
- music candidates with no recovered Classic assignment: `Sounds/electric.mp3`, `Sounds/GangnamStyle.mp3`, `Sounds/mainmenumusic.mp3`.

This classification is deliberately conservative. “Presence-only” means “not assigned by this contract,” not “unused by the original product.”

## Deterministic consumer design

Recommended clean-room design:

1. Represent each proven request as a typed gameplay/presentation event whose payload carries the canonical path or the inputs needed by an exact table (`fruitId`, `critical`, toss type, rank).
2. Use the slice's injected **shared RNG** for recovered random audio selections. Do not create an independent audio RNG when parity is the goal.
3. Preserve call order relative to gameplay RNG. In particular, swish draws before its effects gate; combo selection is wholly inside its effects gate.
4. Preserve recovered cooldowns and explicit global operations. Do not add voice stealing, debouncing, gain changes, pitch variation, or concurrency limits without new evidence.
5. Log deterministic audio commands in tests as `(sequence, event, canonicalPath, operation)`. Assert ordered commands rather than depending on decoder/playback timing.
6. Keep canonical paths even for byte-identical files. A path substitution would erase evidence and make later reconciliation harder.
7. Treat effects-enabled state as a request gate, not a resource-loading gate: preloading can be deterministic regardless of the setting, while event draw/request semantics remain exact.

An implementation can expose operations such as `playOneShot(path)`, `playTracked(channel, path)`, `stopTracked(channel)`, `pauseAllEffects()`, `resumeAllEffects()`, and `stopAllEffects()`. These names are recommendations; the event order above is the contract.

## Cocos Creator 3.8.8 `Bundle.load` contract

### Canonical path conversion

The `game` directory is an asset bundle because `game/assets/game.meta` sets `userData.isBundle: true`. For audio:

```ts
const canonicalPath = 'Sounds/tossfruit.wav';
const bundlePath = canonicalResourceToBundlePath(canonicalPath);
// bundlePath === 'Sounds/tossfruit'
```

`Bundle.load` receives a path relative to the bundle root with the filename extension omitted. Audio clips are main assets, so **do not append `/spriteFrame`**. That suffix is only for raster `SpriteFrame` sub-assets in the current loader.

The pinned Creator 3.8.8 source declares the typed overload:

```ts
bundle.load<AudioClip>(paths: string[], AudioClip, onComplete);
```

The loading sequence should be:

```ts
const bundle = assetManager.getBundle('game') ?? await loadGameBundle();
const paths = descriptors.map(({ canonicalPath }) =>
  canonicalResourceToBundlePath(canonicalPath),
);

bundle.load(paths, AudioClip, (error, clips) => {
  // Reject an error, null/undefined result, or incomplete result set.
  // Index the validated clips by their original canonical paths.
});
```

Preload the exact proven Classic subset before its first possible trigger, then resolve synchronously from a canonical-path map during gameplay. Avoid just-in-time lookup on swipe/cut/toss events because load latency is not part of the recovered timing contract.

All 62 source `.meta` files currently declare the `audio-clip` importer, imported state, and `downloadMode: 0`. The staging manifest still reports pending Creator metadata/UUID work and zero mapped consumers; that catalog is stale relative to the present `.meta` files and must be regenerated/reconciled before claiming catalog completeness.

### Playback API implications

`AudioSource.playOneShot(clip, volumeScale)` is suitable for untracked one-shots and returns `void` in Creator 3.8.8. It cannot reproduce native effect-handle stops by itself. Use a dedicated retained `AudioSource` or equivalent controllable channel for bomb effects whose handles are explicitly stopped. Do not infer original gain, voice count, priority, mixing, or attenuation from file metadata; those remain unknown.

Source preservation remains mandatory. Do not resample or re-encode recovered audio during staging. Creator may decode to a platform representation at runtime, so validate canonical source hashes separately from imported `AudioClip` availability/duration.

## Validation checklist

- Assert all 62 canonical inventory paths exist and still match the staging-manifest hash/byte record.
- Assert all WAV headers remain PCM s16le with the sample rate/channel/duration values above; probe MP3 headers without playback.
- Assert the required Classic preload set resolves as `AudioClip` from bundle `game` using extensionless paths.
- Assert no audio path receives `/spriteFrame`.
- Unit-test the fruit ID table, toss type table, rank table, and swish/combo random bounds.
- With a scripted shared RNG, assert effects-off swipe consumes a draw while effects-off combo does not.
- Assert the swish strict threshold and 0.5 action-second lock.
- Assert critical order is base cut then `critical.wav`.
- Assert bomb order is tracked-stop -> explosion construction -> `BombHit` notification -> `boomexplosion.wav` request.
- Assert game-over/result handoff emits `stopAllEffects` and does not invent a GAME/OVER or score-screen clip.
- Test pause/resume command ordering independently from actual audible completion.

No playback test against the original APK/library is authorized by this contract. Any future audible comparison requires a separate provenance-safe, user-approved observation source.

## Recommendations

1. Implement only the direct mappings above for the first Classic slice; keep presence-only assets staged but unowned.
2. Add a typed `ClassicAudioCue`/effects service and preload map beside the existing resource loader, while preserving canonical path keys.
3. Route all recovered random selection through the shared injected RNG with the event-specific effects-gate ordering.
4. Give tracked bomb effects a controllable channel; use `playOneShot` for untracked requests.
5. Regenerate the Creator staging manifest so importer/UUID status and consumer ownership reflect the actual project.
6. Resolve asset rights before distribution; the restoration plan currently marks recovered resource rights unresolved.

## Unresolved questions

- What call sites, if any, own `Sounds/fruitfail.wav` and `Sounds/scorescreen.wav` in the original product?
- Which electric, magnet, double-point, time-mode, result, and music assets are reachable from the exact standard Classic slice rather than adjacent modes/features?
- What were the original per-effect gains, mixer policy, simultaneous-voice limits, and tracked-handle channel assignments?
- Does every special fruit ID above 8 delegate to the base `Fruit::Cut` audio switch, or do some override/bypass it?
- Is the recovered Classic background-music resume asymmetry intentional or an artifact of shared pause-layer code?
- Can distribution rights be established for every recovered audio file?

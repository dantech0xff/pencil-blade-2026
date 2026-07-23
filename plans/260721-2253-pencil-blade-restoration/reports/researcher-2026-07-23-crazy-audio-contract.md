# Crazy Audio and Effect Contract Recovery

---
date: 2026-07-23
status: done
scope: static-only Crazy-mode audio/effect recovery
evidence-policy: no APK execution; no inferred consumers
---

## Result

The assigned Crazy audio surface is body-recovered.

The most important implementation facts are:

- `Bomb::HitElectric()` selects one of four non-looping `ehit` effects, but only
  draws RNG when effects are enabled.
- `BombElectric` starts with a non-looping `powerup` cue, then one second later
  plays a non-looping `electricexplose` cue and starts looping `electric.mp3`
  on the **background-music channel**. It does not retain an effect handle.
- `BombElectric::TurnOffElectric()` stops that background channel with
  `stopBackgroundMusic(false)`. Both start and stop are gated by
  `Settings::EnableEffects`, not `EnableMusic`.
- `MagnetAnimation` retains the handle returned by looping
  `playEffect("Sounds/magnet.wav", true)` and stops it at the end of its
  10.5-second active phase.
- `DoubleToss` retains its looping `doubletoss.wav` effect handle, stops it in
  `Stop()`, and uses `doubletosstrum.wav` as both entry and exit one-shots.
- `BonusToss` has no bonus-specific cue. Its shared toss type is `5`, which
  maps to the ordinary non-looping `tossfruit.wav` route.
- `Freeze`, double score, timer tick, and time-up cues are non-looping,
  untracked effects. Final Crazy cleanup unconditionally calls
  `stopAllEffects()`, but that API does not stop `BombElectric`'s background
  channel.
- DragonFruit type `6` uses three non-looping, untracked effects:
  `hitmusic.wav` once on the first cut, `strawberry.wav` on each accepted
  `nextInt(0, 1) == 0` hit, and `finishhitmusic.wav` after the completion
  notification and dispose call.
- `boomhit.wav`, `eapplecut.wav`, `lightning1.wav`, and `lightning2.wav` have
  proven preload references but no recovered play call. They must not be
  assigned to Crazy electric or special-fruit behavior.

## Evidence and Method

Primary native evidence:

- `.forensics-work/phase-01/native/libgame.so`
- SHA-256:
  `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`
- ELF: 32-bit little-endian ARM, Thumb code
- symbols and sizes:
  `forensics/native/function-map.csv` and
  `.forensics-work/phase-02/native/symbols/dynamic-demangled.txt`
- literal/string corpus:
  `.forensics-work/phase-02/native/strings/all-offsets.txt`
- direct GNU ARM objdump of every method and call site named below

All named audio files were also verified present under:

`game/assets/game/Sounds/`

Interpretation rules used throughout:

- `playEffect(path, false)` = a non-looping effect request.
- `playEffect(path, true)` = a looping effect request whose returned handle can
  be passed to `stopEffect`.
- `playBackgroundMusic(path, true)` = looping playback on the single
  background-music channel, not an effect handle.
- A returned handle is called **retained** only where the native body stores it
  and later reads it for a stop call.
- `RandomHelper::nextInt(a, b)` uses the recovered inclusive contract.
- A preload reference is not promoted into a runtime play consumer.

No APK or native code was executed.

## Proven Crazy Dispatch Matrix

### Special-fruit and timed-mode requests

| Crazy trigger | Native owner | Audio call | Loop | Retained / stop | Direct evidence |
|---|---|---|---:|---|---|
| Any generic special Fruit ID `10...14`, before mode notification | `Fruit::PlayCutSound()` `0x001505A4` from `Fruit::Cut()` `0x00150648` | `playEffect("Sounds/mangosteen.wav", false)` | no | ignored; no per-cue stop | default `id > 8` branch in `PlayCutSound` |
| Same generic Fruit cut when its stored critical flag is true | `Fruit::PlayCutSound()` after the base clip | `playEffect("Sounds/critical.wav", false)` | no | ignored; no per-cue stop | flag check `0x0015060C...0x0015061C` |
| ID `10`, double-score activation | `ScoreManager::EnableDoubleScore()` `0x00162B80` | `playEffect("Sounds/doublepoint.wav", false)` | no | ignored; no per-cue stop | call `0x00162B90...0x00162B9A` |
| ID `11`, first inactive start | `DoubleToss::Start()` `0x0014DE60` | `playEffect("Sounds/doubletosstrum.wav", false)` | no | ignored | call `0x0014DE82...0x0014DE8C` |
| ID `11`, immediately after entry strum | `DoubleToss::Start()` | `playEffect("Sounds/doubletoss.wav", true)` | yes | handle stored at `DoubleToss + 0x120`; stopped by `DoubleToss::Stop()` | play/store `0x0014DE90...`; stop `0x0014DD5A...0x0014DD60` |
| ID `11`, stop after loop stop | `DoubleToss::Stop()` `0x0014DD28` | `playEffect("Sounds/doubletosstrum.wav", false)` | no | ignored | call `0x0014DD64...0x0014DD6E` |
| ID `12`, every `Freeze()` invocation | `TimeManager::Freeze()` `0x00164B9C` | `playEffect("Sounds/freeze.wav", false)` | no | ignored; `DisableFreeze()` has no sound | call `0x00164BB4...0x00164BBE` |
| ID `13`, start | `BombElectric::Start()` `0x00146140` | `playEffect("Sounds/powerup.wav", false)` | no | ignored | call `0x001462CA...0x001462D4` |
| ID `13`, turn-on after entry crossing | `BombElectric::TurnOnElectric()` `0x00145CF0` | `playEffect("Sounds/electricexplose.wav", false)` | no | ignored | call `0x00145D0E...0x00145D18` |
| ID `13`, immediately after explosion | `BombElectric::TurnOnElectric()` | `playBackgroundMusic("Sounds/electric.mp3", true)` | yes | background channel; `stopBackgroundMusic(false)` in turn-off | start `0x00145D1C...0x00145D26`; stop `0x00145C3E...0x00145C44` |
| Bomb contacts powered electric sensor | `Bomb::HitElectric()` `0x001458EC` | one of `Sounds/ehit1.wav` ... `ehit4.wav`, `playEffect(..., false)` | no | ignored | complete body; direct calls from `BombContactListener::BeginContact()` `0x00145B9A` at `0x00145BB0` / `0x00145BC6` |
| ID `14`, magnet active phase | `MagnetAnimation::BeginCallback()` `0x0015A6BC` | `playEffect("Sounds/magnet.wav", true)` | yes | handle stored at `MagnetAnimation + 0x100`; stopped in `EndCallback()` | play/store `0x0015A7BA...0x0015A7C4`; stop `0x0015A66E...0x0015A678` |
| BonusToss successful spawn | `BonusToss::OnTossTurn()` `0x00146AB8` -> `TossTurn::PlayTossSound()` `0x00165228` | `playEffect("Sounds/tossfruit.wav", false)` | no | ignored | type-`5` jump-table branch in `PlayTossSound` |
| Timer warning equality | `TimeManager::update(float)` `0x00164D48` | `playEffect("Sounds/timetick.wav", false)` | no | ignored | zero-minute / exact-warning-second branch |
| Timer reaches `remaining <= 0` | `TimeManager::update(float)` | `playEffect("Sounds/timeup.wav", false)` | no | ignored; later covered by global stop | time-up branch before `TimeManager::Stop()` and immediate callback |

Every request in this table except the final global cleanup is conditional on
the current `Settings::EnableEffects` byte.

### DragonFruit type-6 requests

| Trigger | Native owner | Audio call | Loop | Retained / stop | Direct evidence |
|---|---|---|---:|---|---|
| First unfinished cut only | `DragonFruit::Cut()` `0x0014EB24` | `playEffect("Sounds/hitmusic.wav", false)` | no | return ignored; no stop | `0x0014EB5C...0x0014EB66` |
| An accepted hit where `nextInt(0, 1) == 0` | `DragonFruit::Cut()` | `playEffect("Sounds/strawberry.wav", false)` | no | return ignored; no stop | `0x0014EDA0...0x0014EDAA` |
| Scheduled hit completion | `DragonFruit::HitFinishedCallback()` `0x0014F5A0` | `playEffect("Sounds/finishhitmusic.wav", false)` | no | return ignored; no stop | `0x0014F5D2...0x0014F5DC` |

DragonFruit does not call `Fruit::PlayCutSound()`, and shared
`TossTurn::PlayTossSound()` has no type-`6` sound branch. The three rows above
are therefore its complete recovered direct sound set.

## Bomb Electric Exact Contract

### `Bomb::HitElectric()`

`Bomb::HitElectric()` at `0x001458EC` performs:

1. Read `Settings::EnableEffects`.
2. If false, return immediately. No random draw occurs.
3. Draw `RandomHelper::nextInt(0, 3)`.
4. Map the inclusive result:

   | Draw | Path |
   |---:|---|
   | `0` | `Sounds/ehit1.wav` |
   | `1` | `Sounds/ehit2.wav` |
   | `2` | `Sounds/ehit3.wav` |
   | `3` | `Sounds/ehit4.wav` |

5. Request `playEffect(selectedPath, false)` and discard its handle.

The method has no score, destroy, physics, or state mutation. Its only
behavior is this gated audio request. The gate-before-RNG ordering is
fidelity-significant because effect settings change the shared RNG stream.

`BombContactListener::BeginContact()` at `0x00145B9A` calls it from both
fixture orderings (`0x00145BB0` and `0x00145BC6`).

### `BombElectric::onEnter()`

`BombElectric::onEnter()` at `0x00145EA4` does not play audio. It proves the
field geometry used by the later lifecycle:

- cache window width at `+0x100`;
- cache `0.25 * windowHeight` at `+0x104`;
- add `Electric/left-electric-node.png` and
  `Electric/right-electric-node.png` at z-order `10`;
- initially place the left node at
  `(VisibleRect.left.x - 0.5 * left.width, 0.25H)`;
- initially place the right node at
  `(VisibleRect.right.x + 0.5 * right.width, 0.25H)`;
- construct the initially inactive electric sensor/contact listener.

The constructor at `0x001460CC` initializes the off flag at `+0x108` to `1`.

### `BombElectric::Start()`

`Start()` at `0x00146140`:

1. Sets the off flag to `0`; there is no already-active guard.
2. Stops all actions on the owner and both node sprites.
3. Resets both node positions through `(0, 0)` and then back to the half-width
   offscreen positions above.
4. Moves both nodes across the screen for exactly `1.0f`:
   - left to `VisibleRect.right.x + 0.5 * left.width`;
   - right to `VisibleRect.left.x - 0.5 * right.width`.
5. The left sequence then invokes `TurnOnElectric()`.
6. If effects are enabled, immediately requests non-looping
   `Sounds/powerup.wav`.

The callback resolution is direct: the member-function pointer loaded through
GOT slot `0x00477324` resolves to Thumb address `0x00145CF1`,
`BombElectric::TurnOnElectric()`.

Thus `powerup.wav` begins at start time; it is not delayed until field
activation.

### `BombElectric::TurnOnElectric()`

At `T = Start + 1.0s`, `TurnOnElectric()` at `0x00145CF0`:

1. If effects are enabled:
   - request `electricexplose.wav` as a non-looping effect;
   - then start `electric.mp3` with `playBackgroundMusic(path, true)`.
2. Build frames `Electric/electric0.png` through
   `Electric/electric7.png`.
3. Create the electric sprite at
   `(0.5 * windowWidth, 0.25 * windowHeight)`, z-order `1`.
4. Animate the eight frames forever with exact frame delay
   `0x3D888889 = 0.06666667014360428f`.
5. Schedule `TurnOffElectric()` after exactly `15.0f`.
6. Activate the electric sensor body.

The turn-off callback GOT slot `0x00477318` resolves to Thumb address
`0x00145C25`, `BombElectric::TurnOffElectric()`.

The nominal powered window is 15 seconds from turn-on, or 16 seconds from
start through automatic turn-off.

### `BombElectric::TurnOffElectric()` and `Stop()`

`TurnOffElectric()` at `0x00145C24`:

1. Sets the off flag to `1`.
2. If effects are enabled at **turn-off time**, calls
   `stopBackgroundMusic(false)`.
3. Moves nodes outward for `1.0f`:
   - left to `VisibleRect.left.x - left.width`;
   - right to `VisibleRect.right.x + right.width`.
4. Immediately removes the animated electric sprite with cleanup.
5. Immediately deactivates the sensor body.

There is no exit effect, `stopEffect`, music restoration, or `EnableMusic`
check.

`Stop()` at `0x001462E8` checks the off flag and calls
`TurnOffElectric()` only when the flag is `0`. Since `Start()` sets it to
`0` before the one-second entry crossing, `Stop()` during that lead-in
immediately runs turn-off behavior, but it does **not** cancel the entry
sequence running on the left node.

Native edge behavior that an exact port must decide whether to preserve:

- `Start()` has no active guard and does not first remove an already-created
  electric sprite or stop already-playing background music.
- A lead-in `Stop()` does not call `stopAllActions()` on the node sprites.
  The left node's original `MoveTo(1s) -> TurnOnElectric()` sequence can
  therefore still complete after turn-off, reactivate the sensor, start the
  electric background loop, and schedule a new 15-second turn-off while the
  off flag remains `1`. A subsequent `Stop()` sees that `1` and returns.
- Once `TurnOnElectric()` has scheduled its 15-second callback, an early
  `Stop()` also does not cancel that owner action. The later callback invokes
  `TurnOffElectric()` again even though the off flag is already `1`.
- The background stop is itself effects-gated. If effects are switched off
  after the loop starts, native `TurnOffElectric()` skips the stop call.
- `stopAllEffects()` at Crazy finish does not cover this background channel.
  Crazy's immediate time-up callback calls `BombElectric::Stop()` first.

## MagnetAnimation Exact Lifecycle

### Geometry and timing

`CrazyModeLayer::FruitCut()` at `0x0014B28C` creates and attaches
`MagnetAnimation` for ID `14`, then adds score `10`.

`MagnetAnimation::onEnter()` at `0x0015A81C`:

1. Creates `Interfaces/magnet.png`.
2. Places it at
   `(VisibleRect.center.x, VisibleRect.top.y + 0.5 * magnet.height)`.
3. Moves it by `(0, -magnet.height)` over exactly `2.0f`.
4. Calls `BeginCallback()` at the end.

The resulting active position is
`(center.x, top.y - 0.5 * magnet.height)`. GOT resolution confirms the
callback as Thumb `0x0015A6BD`, `MagnetAnimation::BeginCallback()`.

At `T = 2.0s`, `BeginCallback()`:

1. Schedules `EndCallback()` after exactly `10.5f`.
2. Creates `Interfaces/magnet-line.png`.
3. Positions the line at:

   ```text
   x = magnet.x
   y = magnet.y - 0.5 * line.height - 0.5 * magnet.height
   ```

4. Starts a `0.5f` fade-out, then the randomized flicker callbacks.
5. If effects are enabled, starts looping `Sounds/magnet.wav`, storing the
   returned effect handle at object offset `+0x100`.
6. Invokes the registered Crazy magnet-begin callback.

Flicker is exact and consumes the shared RNG independently of audio:

- `FadeOutCallback()` schedules fade-in duration
  `nextInt(50, 75) / 100.0f`;
- `FadeInCallback()` schedules fade-out with the same formula;
- inclusive duration grid: `0.50...0.75s` in `0.01s` steps.

At `T = 12.5s`, `EndCallback()` at `0x0015A5F8`:

1. Stops the line's actions and removes the line with cleanup.
2. Schedules the magnet sprite to move by `(0, +magnet.height)` over `2.0f`.
3. If effects are enabled at end time, reads the retained handle and calls
   `stopEffect(handle)`.
4. Invokes the registered Crazy magnet-end callback immediately.

At `T = 14.5s`, `DisposeCallback()` at `0x0015A53C` removes the
`MagnetAnimation` node from its parent with cleanup.

Therefore:

- visual lifetime: nominally `14.5s`;
- Crazy gameplay-active callback window: `10.5s`, from `T=2.0` to `T=12.5`;
- magnet audio loop: nominally the same `10.5s`, not the full visual lifetime;
- end callback and audio stop occur before the two-second exit animation;
- fade callbacks and dispose contain no sound requests.

### Crazy begin/end effects

The registered Crazy callbacks are:

- begin `0x0014AE48`: set normal `FreeToss` limits to `[0.25, 0.5]`, then
  pause bomb Free, Concurrent, and Wave controllers in that order;
- end `0x0014AEA8`: restore `[0.5, 3.0]`, then resume those three bomb
  controllers in the same order.

The constants are stored as doubles in the callback bodies.

Crazy has no recovered external Magnet cancel/stop method. Its immediate
time-up callback does not invoke `MagnetAnimation::EndCallback()`. If the
loop remains active, `CrazyModeLayer::TimeUpFinishCallback()` eventually
stops it through the unconditional global `stopAllEffects()` call, but that
global stop does not synthesize the registered magnet-end callback.

As with BombElectric, the per-handle stop is gated by the current effects
setting. The constructor does not initialize the `+0x100` handle slot, and
`BeginCallback()` writes it only when effects are enabled. Effects OFF at
begin followed by effects ON at end can therefore pass an uninitialized or
stale value to `stopEffect`; effects ON at begin followed by OFF at end skips
the stop. Native does not provide a settings-toggle-safe cleanup path.

## DoubleToss and BonusToss

### DoubleToss

`DoubleToss::Start()` at `0x0014DE60` first tests its active flag. When
already active it returns without restarting, replaying cues, or consuming a
new loop handle.

The first inactive start performs this audio order under the effects gate:

1. request non-looping `doubletosstrum.wav`;
2. request looping `doubletoss.wav`;
3. retain the second call's effect handle at `+0x120`.

It then starts its left and right child tossers and schedules
`DelayCallback()` after exactly `15.0f`. `DelayCallback()` invokes the
virtual `Stop()`.

`DoubleToss::Stop()` at `0x0014DD28`:

1. clears active state;
2. stops the base and both children;
3. if effects are enabled:
   - `stopEffect(retainedDoubleTossHandle)`;
   - request non-looping `doubletosstrum.wav`;
4. disables bonus type `11`.

`Pause()` and `Resume()` forward to scheduler/children only. They do not
pause, resume, restart, or replace the audio handle.

The scheduled 15-second action is not explicitly canceled by an early
`Stop()`. With no restart, the delayed callback calls `Stop()` again,
repeating `stopEffect` and the exit-strum request when effects are enabled.
If the object is restarted before the older delay completes, that older
callback can instead stop the new run.

The constructor initializes children and active state but not the `+0x120`
audio-handle slot. `Start()` writes the slot only under the effects gate,
while `Stop()` reads it whenever effects are enabled at stop time. Effects
OFF at start followed by effects ON at stop can therefore submit an
uninitialized or stale handle to `stopEffect`; the inverse toggle skips
stopping a loop that did start.

Crazy immediate time-up does not call `DoubleToss::Stop()`. Consequently an
active loop can continue through the nominal three-second time-up
presentation unless its own 15-second stop fires. The final unconditional
`stopAllEffects()` covers any remaining effect loop.

### BonusToss

`BonusToss::OnTossTurn()` at `0x00146AB8`:

1. returns without audio when all bonus candidates are already enabled;
2. otherwise chooses an available candidate and direction;
3. creates and adds the bonus Fruit;
4. enables the selected bonus flag;
5. calls shared `TossTurn::PlayTossSound()`.

The shared sound switch at `0x00165228` maps toss type `5` to non-looping
`Sounds/tossfruit.wav`. Thus the sound occurs only after a successful spawn
and flag enable. There is no `bonus`, power-specific, or candidate-specific
toss cue.

Crazy immediate time-up also does not stop `BonusToss`, so a pending turn can
still request this shared toss cue during the time-up presentation. Final
`stopAllEffects()` covers playing effects.

## Double Score, Freeze, Tick, and Time-Up

### Double score

For Crazy ID `10`, `CrazyModeLayer::FruitCut()` calls
`ScoreManager::EnableDoubleScore()` before returning without the ordinary
supplied-score addition.

`EnableDoubleScore()` at `0x00162B80` requests non-looping
`doublepoint.wav` under the effects gate, discards the handle, and then
continues the double-score state/presentation path. No stop is paired with
this cue.

### Freeze

For ID `12`, Crazy calls `TimeManager::Freeze()` and then adds score `10`.

`Freeze()` at `0x00164B9C`:

1. sets frozen state true;
2. under the effects gate, requests non-looping `freeze.wav`;
3. resets freeze elapsed time;
4. initializes the clock presentation;
5. invokes the registered freeze-start callback;
6. shows the freeze clock.

There is no already-frozen guard. Every invocation can request the cue and
restart the exact 15-second freeze window. `DisableFreeze()` at
`0x00164C2C` has no sound call.

### Timer warning and time-up order

`TimeManager` initializes `warningSecond = 10`. On each non-frozen
`update(float)` at `0x00164D48`, it subtracts `dt`, formats the displayed
time, and checks:

```text
minutes == 0 && displayedIntegerSeconds == warningSecond
```

When equal it requests non-looping `timetick.wav` under the effects gate and
decrements `warningSecond`. With ordinary small deltas, a 60-second Crazy
timer therefore requests ticks for displayed seconds `10` through `0`
inclusive. Equality is not threshold crossing; a large delta can skip a
warning value and strand the cursor.

When remaining time is `<= 0`, the same update performs:

1. if the zero-second warning equality matched, request `timetick.wav`;
2. request non-looping `timeup.wav` under the effects gate;
3. call `TimeManager::Stop()`;
4. synchronously invoke `CrazyModeLayer::TimeUpCallback()`;
5. build the three-second time-up presentation;
6. invoke the registered finish callback after
   `MoveTo(1s) -> Delay(1s) -> MoveTo(1s)`.

The immediate Crazy callback at `0x0014B166` calls
`BombElectric::Stop()`, so an active electric background loop is asked to
stop after the `timeup.wav` request.

The finish callback at `0x0014B0EC`:

1. disables cutting;
2. unconditionally calls `SimpleAudioEngine::stopAllEffects()`
   at `0x0014B0F6...0x0014B0FA`;
3. continues the score/result transition.

No `stopBackgroundMusic` occurs in the finish callback.

## DragonFruit Type-6 Exact Order

### `DragonFruit::Cut()`

State fields used by `Cut()` at `0x0014EB24`:

- `+0x124`: hit sequence finished;
- `+0x118`: first hit sequence started;
- `+0x12C`: accepted-hit count.

The method order is:

1. If `finished != 0`, return with no audio or RNG.
2. If `started == 0`:
   - set `started = 1`;
   - if effects are enabled, request
     `playEffect("Sounds/hitmusic.wav", false)`;
   - perform the initial physics setup;
   - schedule `HitFinishedCallback()` after exact float
     `0x40066666 = 2.0999999046325684f`;
   - finish the first-hit presentation setup, including
     `nextInt(-30, 30)` for the counter rotation.
3. On that first call and every subsequent unfinished call, draw
   `RandomHelper::nextInt(0, 1)`.
4. If the result is `1`, return with no accepted-hit cue.
5. If the result is `0`:
   - increment `acceptedHitCount`;
   - draw `nextInt(-45, 45)` for accepted-hit rotation;
   - consume two additional bounded `nextInt` draws for position jitter;
   - apply the accepted-hit body transform;
   - if effects are enabled, request
     `playEffect("Sounds/strawberry.wav", false)`;
   - update the hit counter/presentation.

Consequences:

- the first Cut always reaches the hit RNG after first-hit setup;
- when effects are enabled, the first Cut can request `hitmusic.wav` and then
  `strawberry.wav` in the same call;
- later unfinished Cuts never replay `hitmusic.wav`;
- first-Cut audio/RNG order is:
  `hitmusic` gate -> `nextInt(-30,30)` -> `nextInt(0,1)` ->, when accepted,
  `nextInt(-45,45)` -> two position draws -> `strawberry` gate;
- later unfinished-Cut order begins at `nextInt(0,1)` and uses the same three
  accepted-branch draws before the `strawberry` gate;
- every listed DragonFruit RNG draw occurs regardless of the effects setting;
- none of these effect handles is retained or explicitly stopped.

The scheduled member pointer resolves through GOT slot `0x0047746C` to
Thumb `0x0014F5A1`, `DragonFruit::HitFinishedCallback()`.

### `DragonFruit::HitFinishedCallback()`

At approximately `2.1s` after the first Cut,
`HitFinishedCallback()` at `0x0014F5A0` performs:

1. set `finished = 1`;
2. call `DragonFruit::EndHitAnimation()` at `0x0014F0B0`;
3. call `NotifycationManager::DragonFruitFinished(acceptedHitCount)` at
   `0x0015D030`;
4. call the virtual slot at vptr offset `+0x188`;
5. if effects are enabled, request non-looping
   `finishhitmusic.wav`;
6. start the hit-counter fade and submit the objective event.

The virtual slot is not unresolved: the DragonFruit vtable slot at
`0x00457BB8` contains Thumb pointer `0x0016179B`, resolving to
`PhysicsObject::Dispose()` at `0x0016179A`.

Therefore the proven completion order is:

```text
finish flag
-> EndHitAnimation
-> DragonFruitFinished(count) notification
-> PhysicsObject::Dispose
-> finishhitmusic.wav request
-> counter fade/objective event
```

`EndHitAnimation()` has no direct sound call. There is no explicit stop for
`hitmusic`, `strawberry`, or `finishhitmusic`, so native does not prevent
overlap through retained-handle management.

## Shared/Base Audio Versus Crazy-Owned Audio

### Shared/base behavior used unchanged

- Generic Fruit IDs `10...14` first use the shared default
  `mangosteen.wav` cut route before their Crazy mode notification and
  downstream special-effect audio.
- `BonusToss` uses shared `TossTurn::PlayTossSound()` and therefore
  `tossfruit.wav`; it owns no unique bonus toss cue.
- `ScoreManager`, `TimeManager`, `DoubleToss`, `BombElectric`, and
  `MagnetAnimation` are shared component owners. Crazy proves their runtime
  use through its ID dispatch and controller graph.
- Normal fruit cut/critical/combo/swipe and ordinary Bomb entity audio remain
  shared behavior. This report does not duplicate the whole Classic audio
  table.
- `CrazyModeLayer::BombHit()` and `AfterBombHit()` contain no sound call.
  Ordinary bomb sound remains owned by the Bomb entity path; it is not
  `boomhit.wav`.

### Crazy-specific orchestration

- Exact special-ID order is:

  | ID | Ordered cut/audio consequence |
  |---:|---|
  | `10` | base `mangosteen.wav` [then `critical.wav` when its stored flag is true] -> Crazy notification -> `EnableDoubleScore()` requests `doublepoint.wav`; no ordinary supplied-score addition |
  | `11` | base `mangosteen.wav` [then conditional `critical.wav`] -> Crazy notification -> `DoubleToss::Start()` requests entry strum then loop -> add score `10` |
  | `12` | base `mangosteen.wav` [then conditional `critical.wav`] -> Crazy notification -> `TimeManager::Freeze()` sets frozen and requests `freeze.wav` -> add score `10` |
  | `13` | base `mangosteen.wav` [then conditional `critical.wav`] -> Crazy notification -> `BombElectric::Start()` installs entry actions and requests `powerup.wav` -> add score `10` |
  | `14` | base `mangosteen.wav` [then conditional `critical.wav`] -> Crazy notification -> create/attach `MagnetAnimation` -> add score `10`; magnet loop begins only at its `T=2s` begin callback |

- The exception is DragonFruit type `6`, whose custom `Cut()` bypasses the
  generic Fruit cut-sound method and uses only its recovered three-cue hit
  sequence.
- Crazy immediate time-up stops BombElectric but deliberately omits
  DoubleToss, BonusToss, and existing MagnetAnimation instances.
- Crazy finish supplies the eventual unconditional `stopAllEffects()` safety
  net for effect-channel loops and one-shots.

## Proven Negative and Preload-Only Findings

| Path / method | Static verdict | Evidence |
|---|---|---|
| `Sounds/boomhit.wav` | preload proven; no recovered `playEffect` consumer | only direct string reference found at `LoadingScene::update(float)` `0x00159EA4`, flowing to `preloadEffect` at `0x0015A0CE` |
| `Sounds/eapplecut.wav` | preload proven; no recovered play consumer | loading reference `0x00159F12` -> `preloadEffect` |
| `Sounds/lightning1.wav` | preload proven; no recovered play consumer | loading reference `0x00159FBC` -> `preloadEffect` |
| `Sounds/lightning2.wav` | preload proven; no recovered play consumer | loading reference `0x00159FC6` -> `preloadEffect` |
| `BombElectric::onEnter()` | no sound | complete body `0x00145EA4...0x0014608B` |
| `BombElectric::Stop()` | no direct sound; delegates to turn-off only when on | complete body `0x001462E8...0x001462F9` |
| `MagnetAnimation::{FadeInCallback, FadeOutCallback, DisposeCallback}` | no sound | complete bodies at `0x0015A558`, `0x0015A5A8`, `0x0015A53C` |
| `TimeManager::DisableFreeze()` | no sound | complete body `0x00164C2C...0x00164C6B` |
| `DragonFruit::EndHitAnimation()` | no direct sound | complete body `0x0014F0B0...0x0014F59F` |
| `CrazyModeLayer::{BombHit, AfterBombHit}` | no sound | complete bodies `0x0014B22E` / `0x0014B21C` |

The four preload-only paths are intentionally not called “runtime-unused”:
static direct-xref evidence proves loading but cannot rule out every possible
indirect string construction. The safe contract is narrower: no recovered
runtime play path exists, so these files must not be attached to the
reconstructed Crazy behavior.

This corrects the earlier suggestion that `boomhit.wav` belonged to a
BombElectric play path. The executable proves `boom*` preload availability,
not a `boomhit.wav` play call. Electric contacts use only `ehit1...4`.

## Implementation-Critical Cleanup Matrix

| Loop | Channel | Start gate | Native stop | Stop gate | Crazy terminal coverage |
|---|---|---|---|---|---|
| `electric.mp3` | background music | `EnableEffects` | `stopBackgroundMusic(false)` in `TurnOffElectric()` | `EnableEffects` | immediate `BombElectric::Stop()` only; `stopAllEffects()` does not cover it |
| `magnet.wav` | effect handle at `+0x100` | `EnableEffects` | `stopEffect(handle)` in `EndCallback()` | `EnableEffects` | final unconditional `stopAllEffects()` |
| `doubletoss.wav` | effect handle at `+0x120` | `EnableEffects` | `stopEffect(handle)` in `DoubleToss::Stop()` | `EnableEffects` | final unconditional `stopAllEffects()` |

This settings asymmetry is native behavior, not a recommendation. A modern
port may choose safer unconditional cleanup, but doing so is an intentional
behavioral correction rather than an exact transcription.

## Sources

- `forensics/contracts/crazy-mode-contract.md`
- `forensics/contracts/classic-toss-contract.md`
- `forensics/contracts/classic-time-state-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-native-contract.md`
- `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-resource-map.md`
- `plans/260721-2253-pencil-blade-restoration/reports/explorer-2026-07-22-classic-audio-contract.md`
- `forensics/native/function-map.csv`
- `.forensics-work/phase-02/native/symbols/dynamic-demangled.txt`
- `.forensics-work/phase-02/native/strings/all-offsets.txt`
- `.forensics-work/phase-01/native/libgame.so`
- `game/assets/game/Sounds/`

## Open Questions

None in the assigned audio/effect surface.

Status: DONE

Summary: Exact Crazy electric, magnet, double/bonus, freeze/time-up, and
DragonFruit type-6 audio contracts recovered from static native bodies,
including loop flags, retained handles, stop channels, trigger order, timing,
geometry, RNG gates, and terminal cleanup.

Concerns/Blockers: No blocker. Native settings-toggle cleanup is asymmetric,
and four tempting electric/special-fruit files are preload-only with no
recovered play consumer.

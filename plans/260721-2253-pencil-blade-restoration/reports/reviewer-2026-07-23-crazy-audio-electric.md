# Crazy Audio and BombElectric Production-Readiness Review

## Code Review Summary

### Scope

- Verdict: **CHANGES_REQUIRED**
- Review mode: static-only, two-pass production-readiness review; no APK, device, Preview, or
  original-runtime execution.
- Implementation:
  - `game/assets/scripts/domain/crazy-audio-contract.ts`
  - `game/assets/scripts/creator/crazy-audio-presenter.ts`
  - `game/assets/scripts/creator/crazy-bomb-electric-presenter.ts`
- Tests:
  - `tests/reconstruction/vertical-slice/crazy-audio-contract.test.ts`
  - `tests/reconstruction/vertical-slice/crazy-audio-presenter.test.ts`
  - `tests/reconstruction/vertical-slice/crazy-bomb-electric-presenter.test.ts`
- Evidence:
  - `plans/260721-2253-pencil-blade-restoration/reports/researcher-2026-07-23-crazy-audio-contract.md`
  - `forensics/contracts/crazy-mode-contract.md`
  - local Cocos Creator 3.8.8 engine source for `AudioSource` and `Node`
- Scout scope: all production importers, Crazy session/scene command consumers, physics adapter,
  viewport handling, and Creator audio/layer semantics.
- Size: 1,502 implementation lines and 1,154 focused test lines.

### Overall Assessment

The canonical paths, preload/direct-play partition, ordinary effects gates, electric 1-second
entry plus 15-second active timing, normal endpoint motion, frame cadence, and the recovered
lead-in Stop reactivation quirk match the static evidence. Those checks do not make the slice
production-ready. Creator's real `AudioSource` semantics invalidate the claimed final
`stopAllEffects()` behavior, active BombElectric disposal leaks its background channel, the
advertised type-safe contact adaptation is not implemented or wired, and the RNG-plan API cannot
be executed in its documented order. The passing tests use stubs/data comparisons that do not
exercise those failures.

### Critical Issues

None.

### High Priority

#### `stopAllEffects()` does not stop any `playOneShot()` voice in Cocos Creator 3.8.8

`CrazyAudioPresenter.playOneShot()` delegates to `AudioSource.playOneShot()`
(`game/assets/scripts/creator/crazy-audio-presenter.ts:108-110`), while
`stopAllEffects()` only calls `this.effectsSource.stop()`
(`game/assets/scripts/creator/crazy-audio-presenter.ts:155-161`).

Those operations do not own the same player in the pinned engine:

- Creator 3.8.8 `AudioSource.stop()` stops only `this._player`
  (`.../engine/cocos/audio/audio-source.ts:410-419`);
- `playOneShot()` asynchronously creates a separate `OneShotAudio`, starts it, and registers it
  with the global audio manager (`.../engine/cocos/audio/audio-source.ts:430-451`).

Therefore the terminal method named `stopAllEffects()` cannot stop a Crazy one-shot already
playing, and a one-shot whose asynchronous load completes after cleanup can start after the
Result boundary. This violates the recovered unconditional final effect stop and permits timer,
fruit, or electric cues to bleed into Result/Menu.

The test double records one-shots in an array and increments an unrelated `stopCalls` counter
(`tests/reconstruction/vertical-slice/crazy-audio-presenter.test.ts:29-43`). The assertion at
lines 202-208 proves only that the stub's `stop()` was called; it does not prove a one-shot was
cancelled. This is a phantom behavioral test.

Recommended fix: own every effect voice through a cancelable registry. For example, use pooled or
per-voice `AudioSource.clip + play()` nodes, remove completed voices on `ENDED`, and destroy/stop
all registered and pending voices at the terminal boundary. Test both an already-playing one-shot
and a delayed-start race against cleanup using semantics faithful to Creator 3.8.8.

#### BombElectric teardown can leave `electric.mp3` playing and can fail before sensor cleanup

Turn-on starts the global background channel at
`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:310-315`. `dispose()` deactivates
the sensor and destroys visual nodes but never calls `stopBackgroundMusic()`
(`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:284-307`). The audio presenter
explicitly excludes the background channel from `stopAllEffects()`
(`game/assets/scripts/creator/crazy-audio-presenter.ts:155-165`). Any rollback, owner destruction,
or error path that disposes an active electric presenter without a successful preceding `stop()`
leaves the loop alive across screens.

Cleanup also does not converge after a port failure:

- `turnOffElectric()` calls the audio port before removing the field or disabling the sensor
  (`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:340-364`);
- `dispose()` marks itself permanently disposed before calling `sensor.setActive(false)`
  (`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:284-307`).

If either external port throws, the electric collision boundary or nodes can remain active and a
second `dispose()` refuses to retry. The disposal test deliberately uses effects disabled
(`tests/reconstruction/vertical-slice/crazy-bomb-electric-presenter.test.ts:251-260`), so it
cannot detect the background leak.

Recommended fix: track whether this presenter started the background channel; on explicit
teardown stop that channel unconditionally as a documented safety adaptation. Make sensor,
field, audio, and node cleanup best-effort, converge state first, then report aggregated failures.
Preserve the effects-gated native behavior for ordinary `TurnOffElectric()` separately. Add active
effects-on disposal and throwing-port tests.

#### The type-safe electric contact adaptation and both production presenters are unimplemented at the runtime boundary

Repository-wide symbol scouting found no production importer of `CrazyAudioPresenter` or
`CrazyBombElectricPresenter`. The proposed sensor boundary exposes only `active` and
`setActive()` (`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:37-41`); it has no
typed contact event or hit callback. `CrazyPhysicsAdapter` contains no electric collider/contact
implementation, and `CrazySceneController.applyResolvedCommand()` ignores the construction,
start, and stop electric commands along with audio commands
(`game/assets/scripts/creator/crazy-scene-controller.ts:220-240`).

Consequently direct test construction is the only executable path. No player contact can reach
the recovered both-fixture-ordering hit behavior, no gate-before-RNG electric hit can run, and
special ID `13` cannot start this presenter in production. An interface that toggles a boolean is
not the required type-safe replacement for the native unsafe contact cast.

Recommended fix: wire these owners through the planned `CrazyGameplayController`; implement a
concrete Physics2D electric sensor adapter with typed fixture/entity discrimination and symmetric
contact ordering; route a valid electric Bomb contact through the effects gate, one inclusive
`0...3` draw, and the selected `ehit` cue. Add an end-to-end deterministic test from Crazy session
command through contact, audio, time-up, rollback, and teardown. If this wiring is intentionally a
later slice, keep it as an explicit non-landing dependency and keep the Crazy route fail-closed.

#### The RNG plans require the result before the plan's own draw, so they cannot preserve shared RNG order

`getCrazyBombElectricHitAudioPlan()` requires `drawResult` to choose the returned path
(`game/assets/scripts/domain/crazy-audio-contract.ts:421-437`), but the returned plan then includes
the `electric-hit-sound` draw as its first executable step
(`game/assets/scripts/domain/crazy-audio-contract.ts:326-335`). A caller must either consume RNG
before requesting the plan and then consume it again while executing the plan, or treat the draw
step as non-executable metadata. Neither behavior matches the API's plan-step type or the recovered
single draw.

DragonFruit has the same defect: the caller must provide `acceptanceDraw`
(`game/assets/scripts/domain/crazy-audio-contract.ts:205-211,514-535`) before receiving a plan
whose documented executable order performs counter rotation and only then the acceptance draw
(`game/assets/scripts/domain/crazy-audio-contract.ts:538-562`). The comment explicitly says
consumers execute every RNG/audio step in order (`game/assets/scripts/domain/crazy-audio-contract.ts:510-513`).

The tests supply literal outcomes and compare arrays
(`tests/reconstruction/vertical-slice/crazy-audio-contract.test.ts:219-241,401-453`); they never
execute a stateful shared RNG, so they cannot catch pre-consumption, duplication, or a mismatch
between the actual draw and selected audio branch.

Recommended fix: use a two-stage transition API: emit the next RNG request, accept its result,
then emit the dependent branch without another draw; or let the operation consume an injected RNG
port internally and return a transcript after execution. Verify exact call order and total draw
count with a stateful RNG spy.

### Medium Priority

#### Audio loading has a parent-destruction race and no rollback after partial attachment

`CrazyAudioPresenter.load()` validates the parent once, awaits bundle and clip loads, then mutates
the original parent without revalidation
(`game/assets/scripts/creator/crazy-audio-presenter.ts:61-66,87-105`). A navigation or rollback
can destroy the node during either await. The continuation can then throw while adding components
to an invalid node or leave audio components/nodes attached to an orphaned owner. An error after
the effects component is added also has no cleanup for that partial commit.

The bundle stub invokes its callback synchronously
(`tests/reconstruction/vertical-slice/crazy-audio-presenter.test.ts:49-53`), and there is no load
failure or destroyed-during-load test despite the architecture test plan requiring load failure.

Recommended fix: revalidate after every asynchronous boundary and before attachment; build on a
detached owner and commit once, or clean all partially created nodes/components on failure. Test a
deferred bundle callback after parent destruction and every reject branch.

#### Offset-viewport geometry and float32 input safety are not exact

The recovered field center is raw `0.5 * windowWidth`, while the implementation uses
`leftX + width * 0.5`
(`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:323-327`). Those are equal only when
`leftX` is zero. The repository already models offset visible rectangles, but the electric test
uses only `leftX = 0` (`tests/reconstruction/vertical-slice/crazy-bomb-electric-presenter.test.ts:142-147`),
masking the error.

Input validation accepts any finite JavaScript number
(`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:498-510`), although constructor
math immediately narrows height and field coordinates with `Math.fround`
(`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:119-120,323-327`). Values such as
`Number.MAX_VALUE` pass validation and become infinite Creator coordinates. The check also does
not establish which supplied width is the raw window width versus the visible span.

Recommended fix: model raw logical `windowWidth/windowHeight` separately from
`VisibleRect.left/right`, normalize and reject non-finite float32 inputs/derived coordinates, and
test a non-zero visible origin plus overflow boundaries.

### Low Priority

#### Sibling indices do not preserve both endpoint nodes above the electric field

Both endpoint nodes are appended and assigned sibling index `10`
(`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:132-135`). The field is appended
later and moved to index `1` (`game/assets/scripts/creator/crazy-bomb-electric-presenter.ts:319-323`).
Creator 3.8.8's `setSiblingIndex()` clamps an oversized index by appending, so the resulting order
is left endpoint, field, right endpoint. Only the right endpoint is above the z-1 field; native
places both endpoints at z-order `10`.

Recommended fix: preserve the relative group order explicitly, for example field first followed
by both endpoints, and assert `root.children` ordering in the presenter test.

### Edge Cases Found by Scout

- Effects disabled before `HitElectric` correctly consumes no RNG.
- A Stop during the one-second lead-in correctly preserves delayed turn-on and leaves the off flag
  set, but no test covers the separate recovered edge where Stop after turn-on leaves the pending
  15-second automatic turn-off alive.
- Repeated Start while a field exists is unguarded by contract and can retain an older field;
  the `fields` set appears designed for that native orphan lifecycle, but no test proves it.
- Effects ON at electric start/turn-on followed by OFF at turn-off deliberately skips the native
  background stop. Explicit disposal still needs a separate safety cleanup.
- A throwing audio port during turn-off currently prevents sensor deactivation.
- A throwing sensor port during disposal currently prevents visual cleanup and cannot be retried.
- Parent destruction during async clip loading is not covered.
- Offset viewports, float32 overflow, endpoint/field sibling order, load errors, and real
  one-shot cancellation are not covered.

### Contract Verification

The following reviewed details match the static contract:

- all 20 direct-play and four preload-only paths, exact casing/extensions, staged metadata, hashes,
  and no invented consumer for `boomhit`, `eapplecut`, or either `lightning` file;
- base special-fruit `mangosteen`, conditional `critical`, and downstream ID `10...14` cue paths;
- `powerup` at Start; `electricexplose` then looping `electric.mp3` after one second;
- effects gate re-read at Start, turn-on, and turn-off; normal background stop remains separate
  from effect-channel stop;
- HitElectric mapping `0...3 -> ehit1...4` and disabled-effects no-draw contract as static data;
- initial endpoint formulas, one-second crossing, eight frames at float32 `1/15`, 15-second active
  window, immediate field/sensor removal, and one-second exit;
- recovered early-Stop delayed reactivation and unchanged off flag;
- retained magnet/double-toss handles, bonus toss cue, freeze/timer/time-up paths, and Dragon audio
  path/order data.

### Recommended Actions

1. Replace untracked `playOneShot()` use with cancelable owned effect voices and prove terminal
   cancellation against Creator 3.8.8 semantics.
2. Make BombElectric explicit disposal stop its owned background and converge sensor/visual
   cleanup despite port failures.
3. Implement and wire the concrete typed electric contact adapter and both presenters before the
   Crazy route can open.
4. Redesign branch-dependent RNG plans so callers consume every shared RNG draw exactly once in
   recovered order.
5. Close the async parent race and add executable load failure/rollback tests.
6. Correct raw-window versus VisibleRect geometry, float32 validation, and child layering.
7. Re-run focused tests, strict TypeScript, the full Crazy slice, and then the route integration
   gate.

### Metrics

- Type coverage: not instrumented.
- Test coverage: not instrumented.
- Focused verification:
  `node --test tests/reconstruction/vertical-slice/crazy-audio-contract.test.ts tests/reconstruction/vertical-slice/crazy-audio-presenter.test.ts tests/reconstruction/vertical-slice/crazy-bomb-electric-presenter.test.ts`
  passed 19/19.
- Strict TypeScript:
  Creator 3.8.8 `tsc -p game/tsconfig.json --pretty false --noEmit` passed.
- Focused test warnings: three Node `MODULE_TYPELESS_PACKAGE_JSON` warnings; no test failure.
- Lint issues: no project lint command identified; not measured.
- Concurrency: asynchronous load/destroy and delayed action/cleanup ordering reviewed.
- Error boundaries: port failures and partial cleanup are findings above.
- API/backwards compatibility: new unconsumed exports; no established public caller to break.
- Auth, query efficiency, and data leakage: not applicable; these local game modules have no
  identity, database, network, PII, or secret boundary.

### Plan Follow-up

Phase 5 remains in progress and Phase 6 remains pending. The Phase 6 audio/electric and
asset/audio-reconciliation tasks are not complete. These files are partial contract/presenter
evidence, not a production Crazy-mode completion signal. Keep route activation fail-closed and do
not mark the plan tasks complete until the High findings and executable integration tests pass.

### Unresolved Questions

- Is the concrete sensor/contact and presenter wiring intentionally owned by the future
  `CrazyGameplayController` slice? If yes, it remains an explicit landing dependency rather than a
  reason to downgrade this production-readiness verdict.

# Static Reconstruction Unknowns

Unknowns are preserved instead of being filled with convenient behavior. Closing an item
requires immutable static evidence, cross-tool corroboration, or an explicit reviewed
inference. No item may depend on running the original APK.

## P0 — Blocks Classic Vertical Slice Contract

| Unknown | Static route | Closure condition |
|---|---|---|
| Remaining entity body/fixture fields | Trace constructors and every `b2BodyDef`/`b2FixtureDef`, shape, material, damping, sensor, group, and mask write | Every Classic entity field is either recovered or explicitly absent |
| Exact native RNG interleaving | Trace scheduler registration plus every direct `lrand48` consumer in engine/VFX paths | Same-frame consumer order is statically provable, or retained as an unobservable native-sequence unknown |
| Player-visible effect of repeated blade fixtures and tag `1437` rationale | Trace all relevant tag setters/cut guards and model the statically recovered no-dedup path | Compatibility choice is reviewed; excluded entity semantics are named without runtime assumptions |
| Electric-bomb contact defect impact | Preserve the degenerate fixture formula and incompatible `PreSolve` layout as evidence; trace every activation/callback caller | Type-safe Creator behavior selected without pretending the unavailable native runtime was observed |

## P1 — Blocks Full Content/Progression

| Unknown | Static route | Closure condition |
|---|---|---|
| Per-mode differences | Compare six mode constructors/update/callback call graphs | Contract delta for every mode |
| Bonus effects and durations | Trace freeze, magnet, double score, special toss, electric paths | Start/end conditions, multipliers, duration/order |
| Save keys/defaults/migrations | Trace `Settings::LoadData/SaveData` and UserDefault calls | Key table, types, defaults, invalid-data behavior |
| Prices/unlocks/objectives | Trace static objects and mutation methods | Complete data/condition table |
| Remaining-mode animation/audio timing | Correlate string loads with actions/callbacks/delays | Event and ordering contract per remaining screen/mode; unresolved timing labeled |

## P2 — Release/Presentation Decisions

- Exact font rasterization under current Creator.
- Retired leaderboard/social/review behavior.
- Rights and replacement policy for artwork, fonts, music, name, and trademarks.
- Supporting historical media provenance.
- User-memory decisions used to close player-visible gaps.

## Resolved Static Facts

- Original runtime capture is unavailable and not a project gate.
- Creator Physics2D is the target simulation layer.
- Box2D gravity `(0, -10)`, sleeping enabled, iterations `10/10`, initial world speed `1.0`.
- `FreezeeWorld` uses a `0.5` speed multiplier; `UnFreezeeWorld` restores `1.0`.
- Spawn and blade coordinate paths use exactly
  `32 legacy Cocos world units = 1 Box2D metre`; physical display pixels are not assumed.
- Classic Fruit, Bomb, and BombElectric body/fixture formulas, material values, category/mask
  filters, and deferred body destruction are recorded in
  `contracts/classic-physics-contract.md`.
- The Classic toss graph has nine fixed concurrent controllers. Their intervals, strict
  timer expiry, direction formulas, object selection, and recovered RNG distributions are
  recorded in `contracts/classic-toss-contract.md`.
- Blade input uses four touch slots and performs the extended, bidirectional cut ray after
  the physics step. The native callback performs no value-level fixture deduplication. Its
  recovered filters and event order are recorded in
  `contracts/classic-cut-score-contract.md`.
- Classic fruit scores, special IDs `13`/`14`, the `0.25`-second combo window, double-score
  bucket, three-miss failure, bomb `-10`, and idempotent game-over path are recovered.
- Standard Classic is untimed. Its Good/Luck start gate, cut-enabled intro, exact toss-start
  order, scene-entry `30.0s` world-speed ramp, pause/resume clock ordering, and result handoff
  are recorded in `contracts/classic-time-state-contract.md`.
- The bomb Boolean virtual resolves to `PhysicsLayer::StopPhysicsWorld(bool)`. Terminal guard,
  pending miss callbacks, and same-query multi-bomb explosions are independent; the native
  physics-stop field is last-writer rather than reference-counted.
- Shared `TimeManager` schedule, countdown, warning, expiry, freeze, thaw, callbacks, and UI
  lifecycle are recovered, while standard Classic owns no `TimeManager` instance.
- Classic resolution profiles, paired minimum assets, logical layout, HUD/fail/bomb/terminal/
  result presentation, and bounded audio ordering are recorded in
  `contracts/classic-presentation-contract.md`. Unlinked sounds/assets remain unknown rather
  than being assigned by filename.

# Phase 3 Classic Presentation Progress — 2026-07-22

## Status

In progress overall; the Classic vertical-slice presentation subset and reconstruction
policy are reviewed, registered, and executable. Full catalog enrichment, remaining screens,
rights, staging, and Creator import metadata remain open.

## Delivered

- `DER-RESMAP-001`: 862-resource catalog with 389 exact two-resolution pairs, per-file
  hashes/PNG metadata, native string correlation, and shared font/audio inventory.
- `DER-CLASSIC-PRESENTATION-001`: exact `720` frame-width profile branch, paired minimum
  assets, logical coordinates, anchors, z-order, mode handoff, Good/Luck start, HUD/fail,
  bomb flash, Game/Over, result layout, and bounded audio order.
- `reference/reconstruction-policy.yaml`: JSON-syntax YAML 1.2 policy pinning immutable
  source and five contract tuples, 17 recovered claims, Creator Physics2D unit mappings,
  compatibility choices, clean-room exclusions, exact asset rules, and open decisions.
- `tests/reconstruction-policy-test.sh`: checks fixed invariants, source/contract hashes and
  byte counts, evidence-register rows, exact policy claim set, clean-room restrictions,
  null visual/audio tolerances, and rights defaults.

## Review Corrections Incorporated

- Bomb flash is `0.25s` delay, `1.0s` full white visible-rect quad, then `1.25s` white
  triangles; the earlier reversed state order was rejected by dual disassembly.
- The bomb virtual resolves to `PhysicsLayer::StopPhysicsWorld(true/false)`.
- Cutting is already enabled during the intro; Luck completion only reasserts it before toss
  start.
- Score icon and best cup use float32 literal `0x3DA3D70A` (approximately `0.08W`), distinct
  from the live label's approximately `0.085W` base.
- Resource dimensions, paired paths, fonts, and WAV names were checked against the registered
  resource map. Presence-only assets/sounds remain unknown rather than assigned by name.

## Static Fidelity Boundary

- Runtime layout uses legacy logical `W/H` and `VisibleRect`, never physical pixels or raster
  dimensions.
- Default-center anchors are labeled inferred where no native setter exists; Creator sets
  them explicitly for deterministic output.
- Original visual/audio tolerances cannot be invented without runtime samples. The policy
  requires exact source bytes/geometry and preserves unknowns.
- Asset ownership and redistribution rights remain unknown; no original byte is ship-ready
  until separately cleared.

## Verification

- Presentation contract independently reviewed; all implementation-blocking findings fixed.
- Contract evidence hash test passes for all five registered Classic contracts.
- Claims schema/ledger focused test passes.
- Reconstruction-policy focused test passes.
- Full inventory/evidence suite passes 14/14 in 136 seconds, including strict plan validation,
  malformed-ledger rejection, and reconstruction-policy negative cases.

## Remaining

- Ship-ready asset schema/catalog and rights status per logical asset.
- Full animation and audio maps outside the Classic minimum path.
- Creator staging/import manifest, UUID/meta records, and source/render reconciliation.
- Remaining-screen layout and equal-z relationships not closed by the Classic contract.

## Unresolved Questions

- Which subsystem, if any, owns `fruitfail.wav` and `scorescreen.wav`?
- Are medal-rank and new-best sprites selected through dynamic paths outside the bounded result
  range?
- What rights permit private reuse, source publication, or public redistribution of each
  original asset, font, sound, name, and trademark?

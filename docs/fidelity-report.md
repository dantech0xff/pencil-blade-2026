# Fidelity Report v1

Metric: `pencil-blade-maximal-recoverable-fidelity@1.1.0`

Outcome: **100.00% — pass**.

This is maximal recoverable fidelity: conformance to the frozen static contract corpus,
not a claim of empirical identity with an executing original. The overall score is the
minimum domain score. Weighting and averaging are forbidden.

| Domain | Passed / frozen units | Score | Status |
|---|---:|---:|---|
| Visuals, layout, and animation | 813 / 813 | 100.00% | pass |
| Audio | 55 / 55 | 100.00% | pass |
| Shader, material, and rendering | 6 / 6 | 100.00% | pass |
| Level, mode, and progression | 61 / 61 | 100.00% | pass |
| Gameplay, physics, timing, input, and state | 33 / 33 | 100.00% | pass |

## Denominator and anti-hiding rules

- Each frozen recovered-contract unit is binary: pass only with cited executable or exact-byte evidence; otherwise fail.
- passed units divided by frozen units, rounded down to two decimals.
- The overall score is the minimum of the five domain scores. No average or weight can hide a weak domain.
- Inferences, unknowns, exceptions, rights decisions, and platform divergences are recorded outside the recovered-unit numerator and denominator. Adding or closing one cannot raise a domain score unless it becomes a new versioned recovered-contract unit with evidence.
- Any unexplained contradiction against a recovered contract fails the affected unit and the release gate.

The recovered-unit denominator is intentionally narrower than the complete catalog where
event linkage or implementation detail remains an inference. This is disclosed, not hidden:

| Scope | Catalog assertions | Recovered scored units | Residual units outside score |
|---|---:|---:|---:|
| Audio event linkage | 62 | 52 | 10 |
| Rendering | 4 | 3 | 1 |
| Level/progression | 4 | 3 | 1 |

## Residual ledger

25 inference/unknown/exception/divergence/release records are
listed in `forensics/fidelity/residual-gap-ledger.json`. None can raise recovered coverage.
0 unexplained divergences remain.
4 external/rights/user-decision blockers remain; they do not
lower the technical contract score, but they keep the public-release and program closeout
gates closed.

## Frozen evidence and fixtures

The exact static-evidence and reconstruction-fixture file set is recorded in
`forensics/fidelity/frozen-evidence-fixture-manifest.json`. File hashes and deterministic aggregate hashes expose any
denominator or regression-suite drift for explicit review.

## Physics2D decision

The selected Cocos Box2D backend passes measured trajectory, forward/reverse raycast,
bilateral contact filtering, world-lock rejection, and deferred-destruction probes. Adapter
tests independently cover Creator world-unit/PTM boundaries, variable step synchronization,
iterations, input dispatch, and lifecycle restoration. The original-runtime observation flag
remains false.

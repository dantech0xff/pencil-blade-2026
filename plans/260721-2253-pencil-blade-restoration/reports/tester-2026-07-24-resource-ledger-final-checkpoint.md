---
type: tester
date: 2026-07-24
status: complete
---

# Resource reconciliation ledger final checkpoint

## Outcome

The recovered APK asset corpus now has an exact, deterministic reconciliation
authority without overstating runtime coverage:

- `743/862` exact runtime consumers (`86.19%`)
- `108` reviewed `unknown`
- `10` reviewed `excluded`
- `1` reviewed `unsupported`
- `862/862` classified (`100%`)

Unknown classification is not a live consumer. Rights clearance remains a
separate unresolved release gate.

## Generated artifacts

| Artifact | SHA-256 | Bytes |
|---|---|---:|
| `assets/catalog/resource-reconciliation-ledger.json` | `df1e39eb9f3e333ad95bc07d2a7661f49864800865bea47be471b92d8bccfa9c` | 262,543 |
| `assets/catalog/creator-staging-manifest.json` | `66f7d16ba3b6632991b2fa1f3db2664ff3608fe9ed35b119f5ae3ce8151ae1b8` | 862,944 |

The ledger generator writes only the ledger. The staging script remains the
sole manifest publisher and requires the ledger for canonical stage, verify,
and render operations. It validates the immutable source, current Creator
target, exact ledger serialization, provenance digests, and absent-output
publication before emitting schema v2.

## Verification

| Gate | Result |
|---|---|
| Ledger generator + registry | `18/18` pass |
| Staging + Creator metadata | `33/33` pass |
| Top-level `tests/*.mjs` | `61/61` pass |
| Full vertical slice | `1498/1498` pass |
| Cocos Creator 3.8.8 bundled strict TypeScript | pass, zero diagnostics |
| Canonical stage verification | `862/862`, `0` byte mismatches, `934/934` metadata sidecars |
| Inventory/staging coverage | `100% / 100%` |
| Consumer/reconciliation coverage | `86.19% / 100%` |
| Documentation validator | pass; only pre-existing `docs/system-architecture.md` symbol warnings |
| Diff hygiene | `git diff --check` pass |
| Independent integration review | no open P0-P2 findings |

The focused hardening fixtures reject resource-map byte drift, registry
read/import drift, missing provenance digests, canonical staging without the
ledger, implicit unknown fallback, registry/disposition overlap, partial
profile literal ownership, stale generated output, and manifest overwrite.

## Preview scope

No Creator runtime, scene, UI, save, or gameplay consumer changed in this
checkpoint. A new two-profile Preview run was therefore not used as evidence;
the previously certified compact/high route previews remain unchanged. The
next runtime-visible surface must pass fresh `480x800` and `720x1280` Preview.

## Remaining work

- Recover real consumers for the `108` unknown paths where static evidence
  supports them; otherwise retain their explicit unknown disposition.
- Build the scene/prefab/composition map.
- Recover the Loading surface next.
- Keep the unsupported Cooper Black OTF preserved without substitution.
- Resolve original-content redistribution rights before any public build.

No APK or native shared library was executed.

## Unresolved questions

None for this checkpoint.

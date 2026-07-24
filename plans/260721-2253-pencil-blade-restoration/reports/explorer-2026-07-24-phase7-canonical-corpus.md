---
type: explorer
date: 2026-07-24
status: complete-with-concerns
scope: phase-7-canonical-corpus
---

# Phase 7 Canonical Corpus Scout

## Summary

The separately inspected `ac-java-game` workspace is not the Pencil Blade
canonical sample source. It is an unrelated static reconstruction of *Assassin's Creed:
Brotherhood* for Java ME. The only authoritative Pencil Blade resource baseline
currently present is the recovered-APK `assets/` tree:

`.forensics-work/phase-01/jadx/resources/assets`

That APK-only baseline is completely inventoried, byte-verified, staged, and
reconciled. No external user-supplied Pencil Blade sample-project root or
manifest exists in either inspected workspace. Therefore the final external
resource denominator and cross-domain `>=99%` fidelity score cannot yet be
frozen.

This investigation was static and read-only. Neither an APK, `libgame.so`, JAR,
MIDlet, emulator, nor reconstructed application was executed.

## `ac-java-game` Verdict

Evidence excluding the unrelated `ac-java-game` workspace:

- Its root README identifies *Assassin's Creed Java ME Static Reconstruction*.
- Its Git remote is
  `https://github.com/dantech0xff/ac-brother-hood-mobile-port.git`.
- Its source is `assassins_creed_-_br_320x240_136711.jar`, SHA-256
  `711e0b1063725f99439f59579977f5001d0665c9bf9fe7f7615c0e10937aa383`.
- Its resource model is a 320x240 Java ME pack corpus: 17 packs, 260 indexed
  entries, 18 WAV, 13 MIDI, and 12,102 decoded sprite PNG variants.
- It contains no Pencil Blade title, package, resource-path, viewport, or Cocos
  project reference.
- The existing Pencil Blade report
  `researcher-2026-07-23-standard-bomb-explosion.md` already records this exact
  path as unrelated and excludes it from evidence.
- Exact SHA-256 comparison found zero shared unique hashes between all 862
  staged Pencil Blade assets and all 12,570 files under
  `ac-java-game/reconstructed-project/resources`.

The separate workspace has valid authorities for its own title:

| Assassin's Creed artifact | SHA-256 |
|---|---|
| `reconstructed-project/reconstruction-manifest.json` | `363ff0b5b882c2dfe8a64dd909d06bb151ac35d1edd3ff74584afd7ddff15917` |
| `reconstructed-project/verification-report.json` | `b87364eb4f3fb5e3c317cb281c6fb756db1a26481f9b3a4d1ee1160d50baf132` |
| `reconstructed-project/resources/levels-decoded/manifest.json` | `75ff246a5aa567a1f9cb7b8f2b58978305d88750f8bbef1589fe722c5f0f0648` |

None is a Pencil Blade or sample-project authority.

## Authoritative APK-Only Baseline

The immutable extraction root contains:

| Class | Count |
|---|---:|
| `480x800` PNG | 392 |
| `720x1280` PNG | 392 |
| WAV | 59 |
| MP3 | 3 |
| TTF | 15 |
| OTF | 1 |
| **Total** | **862** |

Total source bytes are `32,945,747`. The canonical path-plus-file-hash tree
digest is:

`0143473b21e56525cde92163f72fd49b2a898ab70ef2b224cdad00eaba9238e3`

The extracted root is ignored working evidence. The tracked exact-byte mirror is
`game/assets/game/`.

### Authority chain

| Artifact | Authority | SHA-256 |
|---|---|---|
| `forensics/resources/resource-usage-map.json` | Recovered-APK paths, bytes, hashes, geometry, resolution relationships, Android `res/` classification, and native-string correlation | `165238f13f4186a9ab429c9c5a8bab07b4a42e941d0608f757d9e41a44d2ce67` |
| `game/assets/scripts/domain/resource-consumer-registry.ts` | 761 exact production-consumer paths and owners | `d4fb8486b10f245fdf6b9883453fa8b9a8c0d3cff2a5778d86ac4a8643c5913f` |
| `forensics/resources/resource-disposition-map.json` | Reviewed dispositions for 100 excluded paths and one unsupported path | `0f35b71edf6ad61c2d2d12259ca6ee10f454dc3f281a2aae899fd5f5cdf9b81f` |
| `assets/catalog/resource-reconciliation-ledger.json` | Complete 862-row consumer/disposition projection | `18ea8ef7ae3fb3751d530dd89426979d601fd8e918d5e9b539a1b8d969daacae` |
| `assets/catalog/creator-staging-manifest.json` | Schema-v2 exact-byte staging projection | `a2697c58152451e8a234a39404191263c9d60c2eba1fb1f352722816b1cdd606` |

The staging manifest correctly limits itself to
`recovered-apk-assets` and states:

`Complete for recovered APK assets only; canonical sample-project completeness is unresolved.`

### Fresh verification

Read-only ledger verification reported:

- staged: `862`
- consumed: `761`
- unknown: `0`
- excluded: `100`
- unsupported: `1`
- reconciliation coverage: `100%`

Read-only source/staging verification reported:

- assets: `862/862`
- bytes: `32,945,747`
- missing or extra files: `0`
- byte/hash mismatches: `0`
- metadata sidecars beneath `game/assets/game`: `934/934`
- runtime consumer coverage: `88.28%`
- disposition reconciliation coverage: `100%`

The `88.28%` value is physical resource-consumer coverage. It is not the
five-domain Phase 7 fidelity score.

## Creator Metadata Status

The current separate metadata audit proves:

- 862 assets and `32,945,747` source bytes;
- 935 sidecars including root `game.meta`;
- 73 directories;
- 2,503 metadata/UUID records;
- zero duplicate UUIDs;
- UUID manifest SHA-256
  `dc0dd3fd998723388b45f84eaeea734ac786eea66ecb7c8f877b0f94dfea0cc8`;
- all 784 SpriteFrames use untrimmed exact geometry;
- all 62 audio assets use the expected importer;
- all 15 TTF files use the expected font importer.

The audit has zero structural errors but returns `fidelity-blocked` because
`Fonts/CooperBlackStd.otf` has no supported Cocos Creator 3.8.8 font consumer.
The exact OTF bytes remain staged and its ledger status is `unsupported`; no
substitution is made.

The staging manifest still records `creatorMetaStatus: pending` and
`creatorUuidStatus: pending` for all 862 entries. The separate audit proves the
live metadata tree, but a versioned per-entry metadata/UUID projection or audit
reference remains to be captured for the final reconstruction manifest.

All 862 staging-manifest rights records remain `unresolved`.

## External Denominator Blocker

The plan and project docs refer specifically to a canonical user-supplied or
external sample project. No such root or manifest is present.

Consequences:

- The 862-entry recovered-APK denominator can be frozen.
- It cannot prove whether an original sample project also contained authored
  shaders, materials, effects, animations, atlases, layouts, level data,
  progression resources, or other non-APK artifacts.
- The final canonical resource denominator cannot be frozen from the available
  workspaces.
- Declaring the recovered APK extraction to be the final canonical denominator
  would change an explicit program decision and requires user approval.
- `ac-java-game` must not be merged into the denominator.

The current resource tools cannot absorb later canonical additions without
work. They pin the 862 counts, total bytes, source-map hash, source-tree digest,
consumer/disposition counts, and the PNG/WAV/MP3/TTF/OTF extension set.

## Remaining Fidelity and Resource Closure

### Can proceed without user input

1. Preserve the verified 862-row corpus as an explicitly APK-only
   recovered-reconstruction manifest.
2. Capture the existing Creator metadata/UUID audit in a versioned artifact and
   reconcile the staging manifest's pending metadata fields.
3. Generalize catalog, staging, and reconciliation schemas so a future external
   manifest can add resource classes and rows without hardcoded counts.
4. Define the fidelity-metric schema before scoring: fixed domain units,
   declared weights, evidence status, implementation/test links, and residual
   gaps.
5. Expand `reference/reconstruction-policy.yaml`. Its passing positive and
   negative tests currently cover nine registered contracts and 21 primarily
   Classic/menu claims, not the promised complete five-domain score.
6. Reconcile or formally supersede the absent Phase 3 deliverables:
   `asset-catalog.json`, `asset-schema.json`, presentation spec, audio cue map,
   and font/rights register.
7. Preserve the OTF as an explicit unsupported technical residual until an
   authorized release decision exists.

### Requires user or external authority

1. Supply the actual Pencil Blade sample-project root/archive and any original
   resource manifest, or explicitly approve APK-only scope as the final
   denominator.
2. Confirm provenance and inclusion rules for authored versus generated
   sample-project resources.
3. Clear artwork, audio, font, trademark, code, and product-name rights.
4. Decide whether `CooperBlackStd.otf` remains a disclosed release residual or
   receives an explicitly approved substitution/conversion.
5. Approve any metric weighting that represents product judgment rather than an
   evidence-derived rule.

Current valid measurements remain separate:

| Measure | Current result |
|---|---:|
| APK inventory coverage | 100% |
| APK exact-byte staging coverage | 100% |
| APK disposition reconciliation | 100% |
| Live resource-consumer coverage | 88.28% |
| Recorded rights resolution | 0% |
| Final cross-domain fidelity score | Not computable |

## Unresolved Questions

- Where is the actual user-supplied Pencil Blade sample project?
- If it no longer exists, should the verified APK extraction become the
  explicitly approved final canonical denominator?
- What release treatment is authorized for `CooperBlackStd.otf` and the other
  unresolved-rights resources?

Status: DONE_WITH_CONCERNS
Summary: Excluded `ac-java-game`, identified and freshly verified the complete APK-only authority chain, and isolated the absent external sample-project denominator as the blocker to final scoring.
Concerns/Blockers: Final denominator, `>=99%` cross-domain score, rights clearance, and OTF release treatment cannot be closed from the available workspaces alone.

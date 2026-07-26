---
phase: 1
title: "Establish Public Narrative and Evidence Contract"
status: complete
priority: P1
dependencies: []
effort: "4-5 days"
---

# Phase 1: Establish Public Narrative and Evidence Contract

## Context Links

- [Project README](../../README.md)
- [Static reconstruction method](../../docs/static-reconstruction-method.md)
- [Evidence register](../../docs/evidence-register.md)
- [Reconstruction report](../../docs/reconstruction-report.md)
- [Release rights checklist](../../docs/release-rights-checklist.md)
- [Completed restoration plan](../260721-2253-pencil-blade-restoration/plan.md)
- [Content evidence source map](./reports/content-evidence-source-map.md)

## Overview

Freeze the public story, field-level authority map, canonical-claim projection, AI disclosure
rules, media/source policy, rights dimensions, release inputs, and bilingual terminology before
writing pages. Turn those rules into fail-closed manifests and one publication-domain validator
so the site cannot silently fork canonical evidence, link private material, or inflate fidelity
claims.

## Key Insights

- The original runtime was never executed or observed. “Recovered” means conformance to static
  evidence, not measured identity with the historical application.
- No single document order is authoritative for every field. Structured counters own counts,
  the canonical claim ledger owns claim state, runtime reports own observations, rights ledgers
  own commercial status, and prose is explanatory.
- `862/862` classification, `761` consumed assets, five-domain `100%`, and `1760/1760` tests
  describe different denominators. Never combine them into one “100% restored” slogan.
- The academic Pages waiver is a frozen owner decision for the existing audited H5 demonstration.
  This case-study plan also records its hashed reconstructed-runtime captures inside that same
  academic documentary scope. It does not resolve commercial rights for art, audio, fonts,
  identity, or generated runtime.
- Raw chats are poor evidence. AI Lab episodes must be edited from repository reports and cite
  the evidence/test that accepted or rejected each hypothesis. A phase label or automatic review
  state does not prove a human decision.

## Requirements

### Functional

- Define the seven narrative chapters:
  1. The Lost Game.
  2. Reading a Game That Cannot Run.
  3. Reconstructing the Rules.
  4. Clean-room Rebuild.
  5. How AI Participated.
  6. Proof, Not Claims.
  7. Play the Reconstruction.
- Define `recovered`, `inferred`, and `unknown` with public display rules.
- Define a field-level authority map:
  - canonical claim status/tier/confidence/refs/contradictions:
    `forensics/claims.jsonl` + schema;
  - native counters: `forensics/native/function-enrichment-summary.json`;
  - resource/fidelity/runtime counters: their structured ledgers/reports;
  - commercial rights: `release/public-release-variant-manifest.json`;
  - academic display scope: the owner-decision record created here;
  - prose reports: explanatory context only.
- Fail closed on conflicting values instead of selecting a whole-document winner.
- Freeze an evidence snapshot ID with the reviewed repository commit plus SHA-256 for every
  authoritative JSON/report input. Source changes require an explicit manifest-version review;
  a routine site rebuild must not silently rewrite historical claims.
- Define a bilingual `claimPresentation` keyed by `canonicalClaimId`, with required `en` and `vi`
  public copy, order, redaction, display qualifier, and public excerpt. Canonical status, tier,
  confidence, contradictions, evidence refs, and contract eligibility are derived and cannot be
  author-overridden.
- Project all 39 canonical claims one-to-one into public-safe presentations or record an explicit
  non-public redaction reason; reject duplicate/unknown IDs and any missing reviewed locale.
- Define a media record with provenance, alt text, caption, locale, transformation history,
  `academicDisplayDecisionRef`, and `commercialRightsRecordRef`; ban generic
  `approvalState`/`rightsState`.
- Define a publication source catalog with exact source ID, file hash, public-safe excerpt,
  optional line range, transitive links, and `publicLinkAllowed`. A source file containing private
  paths/raw evidence or unsafe links is cited only through a sanitized site excerpt, not a direct
  GitHub permalink.
- Record the exact existing H5 tree digest and the six tracked production-runtime capture IDs as
  covered by the owner academic case-study waiver; do not re-open per-asset commercial approval.
- Keep separately extracted/recovered art, audio, and fonts excluded by default even when those
  bytes also appear inside the already-waived H5 demonstration.
- Define an AI episode with question, evidence, hypothesis, review decision, `decisionActorKind`
  (`human | automation | mixed | unknown`), decision reference, accountable role when public-safe,
  implementation, verification, failure/lesson, and report refs. “Human reviewed/accepted/rejected”
  copy requires an actual public-safe human sign-off reference.
- Define English↔Vietnamese glossary for engine, ARM/Thumb, contract, clean-room, fidelity,
  recovered/inferred/unknown, runtime, and rights language.
- Fail validation if content references the APK/native binary, ignored analysis output, raw
  chats, machine-local paths, or unapproved media as a downloadable/public asset.
- Freeze the accountable release owner, public correction/contact channel, Vietnamese factual
  reviewer role, attribution/non-affiliation template, and working title. These may be role IDs
  rather than personal data, but empty values block candidate approval.

### Non-functional

- All facts remain reproducible from tracked repository sources.
- No duplicated hardcoded metrics when an authoritative JSON source exists.
- Policy is machine-readable and human-readable.
- Validation uses Node built-ins and adds no runtime dependency.
- Public copy remains understandable to a non-specialist without weakening technical accuracy.

## Architecture

```text
tracked evidence/docs/reports
          │
          v
authority + public-safety policy
          │
          ├── claimPresentations[]
          ├── sources[]
          ├── media[]
          ├── aiEpisodes[]
          ├── academicDisplayDecision
          └── glossary/releaseInputs
          │
          v
reference/case-study-publication-manifest.json
          │
          v
fail-closed validator ──> Astro content pipeline in Phase 2
```

The publication manifest does not replace evidence. It projects canonical claims, records
public-safe summaries, and binds each planned media item to two independent rights dimensions.
The source catalog decides whether a commit-pinned repository link is safe or whether only a
sanitized local excerpt may be exposed.

## File Inventory

All paths are repository-relative.

| Action | Path | Purpose | Test impact |
|---|---|---|---|
| Create | `docs/case-study-editorial-policy.md` | Narrative promise, field authority, labels, AI disclosure, bilingual glossary, rights language | Manual editorial review + policy test |
| Create | `reference/case-study-publication-manifest.json` | Machine-readable claims/media/source allowlist and launch decisions | New schema/negative fixtures |
| Create | `reference/case-study-public-source-catalog.json` | Exact hashed public-safe source/excerpt catalog and link decision | Citation/transitive-link fixtures |
| Create | `reference/case-study-academic-display-decision.json` | Formalize the existing owner-approved H5 + six-capture academic scope without changing commercial rights | Rights-dimension tests |
| Create | `scripts/validate-case-study-publication.mjs` | Fail-closed manifest/source/media validator | Direct Node tests |
| Create | `tests/case-study-publication-policy.test.mjs` | Positive and negative publication-policy coverage | Added to portable Node suite |
| Read only | `docs/**`, `forensics/**`, `release/**`, completed plan reports | Authoritative inputs | No mutation |
| Delete | None | — | — |

## Function and Interface Checklist

- [ ] `validatePublicationManifest(manifest, options)` returns deterministic findings.
- [ ] `validateClaimPresentation(record, canonicalClaim)` requires both locales and rejects every
      canonical-field override.
- [ ] `resolveFieldAuthority(fieldId)` returns the typed owner for that field and reports conflicts
      with both source pointers.
- [ ] `validatePublicSource(record)` verifies source hash, scans the whole linkable file/excerpt
      and transitive Markdown destinations, and rejects private/raw/unsafe content.
- [ ] `validateMediaRecord(record)` requires provenance, alt text, exact academic-decision ref,
      and unchanged commercial-rights ref.
- [ ] `validateAiEpisode(record)` rejects raw transcript/prompt payloads and unsupported human
      attribution.
- [ ] `validateEvidenceSnapshot(snapshot)` rejects missing/drifted input hashes and an unreviewed
      snapshot-version change.
- [ ] CLI accepts
      `--manifest <path> [--verify-snapshot]`; snapshot mode is read-only, validates frozen
      path/hash/schema/status records (including technical closeout), never invokes historical
      generators or owner-held workspace-artifact checks, exits non-zero on any finding, and
      prints public-safe repository-relative diagnostics.

## Implementation Steps

1. Inventory candidate claims, sources, and media from the research report. Recheck each against the
   current authoritative file; do not import its prose blindly.
2. Write the human editorial policy:
   - audience and narrative promise;
   - chapter arc and CTA progression;
   - evidence status definitions;
   - field-level authority and conflict behavior;
   - AI/human responsibility language;
   - clean-room and rights disclaimer templates;
   - bilingual glossary and translation rules.
3. Formalize the already-approved academic display decision in a dedicated record:
   - evidence source `docs/release-rights-checklist.md`;
   - owner role and decision date `2026-07-25`;
   - exact H5 tree digest/count/bytes;
   - exact six production-capture IDs/hashes;
   - academic/noncommercial case-study scope;
   - explicit pointer to the unchanged commercial fail-closed manifest.
   This is a machine-readable projection of the user decision, not a new license review.
4. Create publication manifest version `1.0.0` with:
   - repository identity/base URL;
   - reviewed evidence snapshot ID, repository commit, and authoritative input hashes;
   - supported locales `en` and `vi`;
   - field-level authority map and canonical-ledger snapshot/count;
   - localized presentations for the 39 canonical claims;
   - exact source-catalog record IDs;
   - denied raw/private roots and extensions;
   - media candidates, defaulting to excluded except the exact audited H5 tree and six hashed
     production-runtime captures recorded under the frozen academic case-study waiver;
   - separate academic/commercial rights references;
   - AI episode source report IDs;
   - current academic/noncommercial release decision and required release-input roles.
5. Build the public source catalog. Full-file scan any directly linkable source; scan the exact
   excerpt and every Markdown destination; convert unsafe historical reports into authored,
   hash-bound sanitized excerpts with `publicLinkAllowed: false`.
6. Mark the July 25 earlier “blocked” journal as historical context only. It cannot override a
   structured field authority and may not receive a public link until it passes source safety.
7. Implement the validator using repository-relative containment and real file existence checks.
   Never follow symlinks or accept `..`.
8. Add negative fixtures in tests:
   raw APK/native paths, ignored analysis roots, absolute local paths, missing source, invalid
   canonical override, claim ID collision, inferred claim counted as recovered, unsafe content
   hidden behind a safe relative citation, transitive private link, raw transcript, unsupported
   human-review wording, collapsed rights state, and unapproved media.
9. Add a policy check to the existing portable Node suite without changing game behavior.
10. Review public terminology in both languages with a side-by-side table. Resolve semantic
   drift before Phase 2.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Claim says original runtime was observed | Validator rejects |
| Critical | Manifest exposes `.apk`, `.so`, raw decompiler output, or absolute local path | Validator rejects |
| Critical | Presentation overrides a canonical claim field or omits one of 39 canonical IDs | Validator rejects |
| Critical | Safe relative citation targets a report/file with private paths or raw transitive links | Direct link rejected; sanitized excerpt required |
| Critical | Unapproved recovered asset is marked publishable | Validator rejects |
| High | `inferred` claim contributes to recovered coverage | Validator rejects |
| High | Explanatory report conflicts with its field's structured authority | Conflict failure with both pointers |
| High | Authoritative input changes without publication snapshot/version review | Validator rejects |
| High | AI episode contains raw transcript or hidden prompt content | Validator rejects |
| High | Copy says “human reviewed” with automation/mixed/unknown actor or no sign-off | Validator rejects |
| High | Academic approval is displayed as commercial clearance | Rights-dimension validation fails |
| Medium | English claim has no Vietnamese counterpart | Locale parity failure |
| Medium | Media lacks alt text/caption/provenance | Validator rejects |
| Medium | Valid final closeout metric resolves to tracked JSON/docs | Pass |
| Medium | External historical media lacks registered provenance | Validator rejects |

## Todo List

- [ ] Approve working title and one-sentence narrative promise.
- [ ] Freeze seven chapters and field-level authority.
- [ ] Freeze claim/media/AI episode records.
- [ ] Freeze exact public source catalog and sanitized-excerpt policy.
- [ ] Formalize the existing academic-display decision separately from commercial rights.
- [ ] Record owner/contact/Vietnamese-review release inputs.
- [ ] Write bilingual technical glossary.
- [ ] Create publication manifest and validator.
- [ ] Pass all policy positive/negative tests.
- [ ] Record the frozen H5/runtime-capture waiver scope; keep all other unapproved items excluded.

## Success Criteria

- [ ] Editorial policy distinguishes technical completion, original-runtime identity, and rights.
- [ ] Every launch fact has an authoritative repository-relative source.
- [ ] All 39 canonical claims have one bilingual presentation/redaction record and no duplicated
      canonical fields.
- [ ] No public source link exposes a file that fails private/raw/transitive-link scanning.
- [ ] Both languages use the same evidence status and legal meaning.
- [ ] Validator fails all raw/private/unapproved fixtures and accepts the reviewed manifest.
- [ ] AI disclosure names AI as an assistant to evidence processing, implementation, testing,
  and review—not as authority or autonomous restorer.
- [ ] No implementation phase needs to invent claim, media, or citation rules.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Marketing copy inflates “100%” | Credibility/legal harm | Denominator-specific copy and automated fact source |
| Academic waiver described as a license | Rights misrepresentation | Fixed disclaimer plus independent academic/commercial references |
| Stale progress report overrides a structured field | Contradictory site | Field-level authority and conflict failure |
| Publication manifest becomes a second claim ledger | Two systems pass while disagreeing | Projection-only model keyed to canonical IDs |
| Academic waiver is shown as commercial approval | Rights misrepresentation | Two mandatory independent decision references |
| Raw evidence leaks through an attractive visual | Clean-room/privacy failure | Denied paths/extensions plus media allowlist |
| Translation changes technical meaning | False claim in one locale | Shared claim ID/status and glossary review |
| AI story becomes prompt theater | Misleading case study | Episode contract requires evidence, decision, and verification |

## Security and Rights Considerations

- Never copy the APK, `libgame.so`, analysis databases, raw disassembly dumps, tokens, runner
  paths, or machine-local logs into `site/`.
- Do not use recovered game fonts in the editorial shell.
- Reconstructed runtime screenshots require exact IDs/hashes in the media manifest. The six
  tracked production captures use the frozen academic waiver; this is scope recording, not new
  commercial clearance.
- Source links may point only to cataloged files that pass full public-link scanning. Unsafe
  tracked reports are represented by sanitized, hash-bound excerpts with no direct link.
- Treat external media and user memory as supporting inference only until registered.

## Rollback

This phase creates policy artifacts only. Roll back by reverting the six new files as one unit.
Do not delete or alter the completed reconstruction evidence.

## Next Steps

Phase 2 consumes the approved manifest and glossary to create typed Astro collections and
generated metrics. Any unresolved publication-policy finding blocks all content authoring.

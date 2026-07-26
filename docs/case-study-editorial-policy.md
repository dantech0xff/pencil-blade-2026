# Pencil Blade Case-Study Editorial Policy

## Purpose and release boundary

Working title: **Pencil Blade: Reconstructing a Lost Game**.

The case study is a bilingual engineering documentary for international developers. Its
promise is: **show how a non-runnable Android game was reconstructed from static evidence into
a clean-room Cocos Creator implementation, with every conclusion labeled and every limit left
visible**.

The English route is the default. Every launch claim, caption, disclosure, and legal qualifier
must have semantically equivalent English (`en`) and Vietnamese (`vi`) copy. This policy
authorizes no new publication. The existing academic, noncommercial GitHub Pages decision is
recorded in `reference/case-study-academic-display-decision.json`; commercial distribution
remains fail-closed under `release/public-release-variant-manifest.json`.

The original APK was not installed, executed, or observed. The documentary must never describe
the reconstruction as recovered original source, an emulator, a port of the original binary, or
proof of pixel-, waveform-, frame-, or trajectory-level identity with the historical runtime.

## Seven-chapter narrative and calls to action

| Order | Chapter | Reader promise | Next action |
|---:|---|---|---|
| 1 | The Lost Game | Establish the sole surviving APK, unknown acquisition history, and static-only constraint. | Inspect the evidence boundary. |
| 2 | Reading a Game That Cannot Run | Explain the ARM/Thumb, Java/JNI, resource, and symbol views without publishing raw binaries or decompiler output. | Follow one registered claim. |
| 3 | Reconstructing the Rules | Show how facts become reviewed contracts and how unknowns remain explicit. | Compare a claim with its contract. |
| 4 | Clean-room Rebuild | Explain the TypeScript/Cocos reconstruction and the prohibition on original executable code. | Inspect the rebuilt architecture. |
| 5 | How AI Participated | Present edited, source-backed investigation episodes; AI assists evidence processing, implementation, testing, and review but is never the authority. | Open an evidence-backed episode. |
| 6 | Proof, Not Claims | Separate canonical-claim coverage, resource reconciliation, fidelity domains, runtime rows, rights, and production deployment. | Verify a frozen metric and its denominator. |
| 7 | Play the Reconstruction | Offer the exact audited H5 demonstration only after explicit reader action and restate its academic/noncommercial boundary. | Launch or leave the player. |

The chapter arc progresses from uncertainty to method, implementation, verification, and a
bounded playable proof. It must not progress from uncertainty to a marketing claim of
historical identity.

## Evidence labels

| Label | Public definition | Display rule |
|---|---|---|
| `recovered` / `đã phục hồi` | Directly supported by registered immutable static evidence and the required cross-checks. | May be stated plainly with the canonical claim ID. Only this status may add recovered-coverage credit. |
| `inferred` / `suy luận` | The best reviewed explanation of multiple clues, not a directly recovered fact. | Always show the inference qualifier. Never count it as recovered. |
| `unknown` / `chưa xác định` | Evidence is missing, conflicting, unsafe to publish, or insufficient for one conclusion. | Keep the gap visible. Do not fill it with copy, generated media, or memory. |

Current reconstruction-runtime observations are not canonical APK-derived claims. They must be
described as observations of the supported reconstruction build and tied to their runtime
report. “Verified runtime” means the rebuilt runtime passed its matrix, not that the original
runtime was observed.

## Field-level authority

There is no whole-document precedence rule. Authority is resolved per field:

| Field | Authoritative owner | Explanatory only |
|---|---|---|
| Canonical claim text, status, evidence tier, confidence, evidence references, contradictions, and contract eligibility | `forensics/claims.jsonl` validated against `forensics/claims.schema.json` | All prose reports and presentation copy |
| Native-function counts | `forensics/native/function-enrichment-summary.json` | Narrative summaries |
| Resource inventory and classification | `forensics/resources/resource-usage-map.json`, `assets/catalog/creator-staging-manifest.json`, and `assets/catalog/resource-reconciliation-ledger.json`, according to the field being shown | Prose totals |
| Fidelity domains, scores, residuals, and unexplained divergences | `forensics/fidelity/fidelity-report-v1.json` and `forensics/fidelity/residual-gap-ledger.json` | “100%” prose |
| Physics2D backend observations | `forensics/runtime/physics2d-backend-equivalence.json` | Contract explanation |
| Android, H5, and production runtime observations | The matching tracked runtime-matrix JSON | Screenshots and captions |
| Technical closeout status and canonical artifact facts | `plans/260721-2253-pencil-blade-restoration/reports/technical-closeout-manifest.json` | Closeout prose |
| Commercial distribution rights | `release/public-release-variant-manifest.json` | README, checklists, and page copy |
| Academic case-study display scope | `reference/case-study-academic-display-decision.json` | Captions and badges |
| Historical context and rationale | Tracked prose reports | Never authoritative for a structured field |

When two values disagree, validation fails with both source pointers. Authors may not choose the
more recent-looking report, silently rewrite the presentation, or treat an old phase/journal
state as authority. In particular, the July 25 earlier “blocked” journal is historical context
only; it cannot override a structured closeout, runtime, fidelity, or rights field and is not a
direct public link unless separately cataloged and scanned.

The metrics `862/862` classified assets, `761` consumed assets, five fidelity domains at
`100.00%`, and `1760/1760` tests have different denominators. They must remain separate and may
not be compressed into “100% restored.”

## Canonical claim presentations

`reference/case-study-publication-manifest.json` contains exactly one `claimPresentations`
record for each of the 39 canonical IDs. A presentation owns only:

- display order;
- complete `en` and `vi` public copy;
- complete `en` and `vi` public excerpt;
- localized display qualifier;
- public/redacted disposition and, if redacted, a concrete reason.

The presentation must not contain author-owned copies of `status`, `evidenceTier`,
`confidence`, `evidenceRefs`, `contradictionIds`, `contractEligible`, canonical review fields,
or native addresses. Those fields are joined from the canonical ledger during validation and
build. Duplicate, missing, and unknown IDs fail closed. A redacted record still occupies its
one-to-one canonical slot.

## Source and redaction policy

Every public citation resolves through
`reference/case-study-public-source-catalog.json`. A tracked path is not automatically safe.

- Direct repository links require an exact file SHA-256 and a full-file scan.
- Every relative Markdown destination is resolved under the repository root, contained there,
  and scanned transitively. Symlinks and `..` segments are rejected.
- Files or excerpts containing raw APK/native/decompiler material, ignored analysis roots, raw
  conversations/prompts, credentials, machine-local absolute paths, or unsafe transitive links
  receive no direct link.
- Unsafe source context may be represented only by a cataloged, hash-bound, authored sanitized
  excerpt. The excerpt itself is scanned and its direct-link decision remains `false`.
- Missing files and hash drift fail validation. Routine builds never update a hash.

Denied public/download surfaces include `.apk`, `.so`, raw disassembly, analyzer databases,
`.forensics-work/`, ignored extraction/cache roots, raw chat or prompt logs, and machine-local
paths. Repository-relative mention of a denied artifact for explanatory redaction is permitted
only as plain text, never as a public/download asset.

## Media and rights

Every media record has provenance, transformation history, localized alt text and caption,
locale coverage, an exact `academicDisplayDecisionRef`, and an exact
`commercialRightsRecordRef`. Generic `approvalState` and `rightsState` fields are forbidden
because they collapse independent decisions.

The academic record covers only:

- the exact audited H5 tree identified by its file count, byte count, and tree digest; and
- the six exact, tracked production-runtime captures identified by path and SHA-256.

Recovered/extracted PNG, WAV, MP3, and font files remain excluded as standalone editorial media
by default, even when identical bytes occur inside the covered H5 build. Academic display is
not a license, commercial clearance, trademark approval, or permission to republish extracted
assets. Commercial status remains the unchanged blocked decision in
`release/public-release-variant-manifest.json`.

## AI episodes and accountable decisions

An AI episode must include a question, evidence IDs, hypothesis, review decision,
`decisionActorKind` (`human`, `automation`, `mixed`, or `unknown`), decision reference,
implementation, verification, failure/lesson, and report references. It may identify a stable
accountable role when public-safe.

Raw conversations, chat exports, hidden/system prompts, chain-of-thought, and transcript
payloads are prohibited. “Human reviewed,” “human accepted,” or “human rejected” is allowed
only when `decisionActorKind` is `human` and a public-safe human sign-off reference exists.
Automation, mixed, and unknown decisions use “review decision” or describe the verified test.
A phase status, generated report, automated review, or role name alone does not prove a human
decision.

## Release inputs and correction channel

Phase 1 does not invent people, approvals, or personal contact data. Stable role IDs are used:

- `accountable-release-owner`;
- `public-corrections-owner`;
- `vietnamese-factual-reviewer`.

Their accountable owner/contact/sign-off evidence is currently absent, so the publication
manifest marks candidate approval `blocked-pending-evidence`. The repository origin makes the
GitHub Issues URL mechanically derivable; it is recorded only as a proposed, unconfirmed public
correction channel until the accountable role confirms it.

The attribution template must say the reconstruction is unofficial, not affiliated with the
original owner/developer/publisher, and does not claim ownership of recovered third-party
content. The non-affiliation text and every correction/contact value require exact-candidate
review before release.

## Bilingual glossary

| English | Vietnamese | Translation rule |
|---|---|---|
| engine | công cụ game | Use for Cocos/Cocos Creator runtime and tooling; do not translate as a physical motor. |
| ARM/Thumb | ARM/Thumb | Keep architecture names unchanged; explain Thumb as the compact instruction state when needed. |
| contract | hợp đồng hành vi | In this case study, means a reviewed behavioral specification, not a legal contract. |
| clean-room reconstruction | phục dựng clean-room | Keep `clean-room`; explain that production code is rewritten from reviewed evidence without original executable code. |
| fidelity | độ trung thực phục dựng | Tie every percentage to its named versioned denominator; never imply original-runtime identity. |
| recovered | đã phục hồi | Direct registered evidence only. |
| inferred | suy luận | Always visibly qualified and excluded from recovered coverage. |
| unknown | chưa xác định | Preserve the gap; never translate as “not yet implemented” unless that is the sourced fact. |
| runtime | môi trường chạy | Distinguish original runtime (`môi trường chạy gốc`) from reconstruction runtime (`môi trường chạy của bản phục dựng`). |
| academic display decision | quyết định hiển thị học thuật | A bounded owner decision, not a license. |
| commercial rights | quyền sử dụng thương mại | Keep separate from academic display and technical completion. |
| rights unresolved | quyền chưa được làm rõ | Never soften to “free to use” or “open source.” |
| source-available, noncommercial | mã nguồn được công khai có điều kiện, phi thương mại | Do not translate as open source. |

Vietnamese copy must preserve numbers, identifiers, paths, hash values, evidence labels, and
rights limits from English. Reviewers may improve idiom but may not change the technical or
legal proposition. Any semantic mismatch blocks the candidate.

## Required disclaimer templates

**Clean-room / identity**

> This unofficial reconstruction was rewritten from reviewed static evidence. The original APK
> was never executed or embedded, and the project does not claim recovered original source or
> identity with the historical runtime.

> Bản phục dựng không chính thức này được viết lại từ bằng chứng tĩnh đã qua rà soát. APK gốc
> chưa từng được chạy hay nhúng vào sản phẩm, và dự án không tuyên bố đã phục hồi mã nguồn gốc
> hoặc giống hệt môi trường chạy lịch sử.

**Rights / non-affiliation**

> The academic demonstration does not grant commercial rights to the name, artwork, audio,
> fonts, identity, or generated runtime. The project is unofficial and is not affiliated with
> the original owner, developer, or publisher.

> Bản trình diễn học thuật không cấp quyền thương mại đối với tên gọi, hình ảnh, âm thanh, phông
> chữ, nhận diện hoặc môi trường chạy được tạo ra. Dự án không chính thức và không liên kết với
> chủ sở hữu, nhà phát triển hoặc nhà phát hành ban đầu.


---
phase: 2
title: "Build Astro Platform and Content Pipeline"
status: complete
priority: P1
dependencies: [1]
effort: "5-7 days"
---

# Phase 2: Build Astro Platform and Content Pipeline

## Context Links

- [Phase 1 publication contract](./phase-01-establish-public-narrative-and-evidence-contract.md)
- [Code standards](../../docs/code-standards.md)
- [Codebase summary](../../docs/codebase-summary.md)
- [Recovered reconstruction manifest](../../release/recovered-reconstruction-manifest.json)
- [Fidelity report JSON](../../forensics/fidelity/fidelity-report-v1.json)
- [Native function summary](../../forensics/native/function-enrichment-summary.json)
- [Technical closeout manifest](../260721-2253-pencil-blade-restoration/reports/technical-closeout-manifest.json)
- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro i18n API](https://docs.astro.build/en/reference/modules/astro-i18n/)
- [Astro GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/)
- [Site/H5/Pages architecture report](./reports/site-h5-pages-architecture.md)

## Overview

Create an isolated Astro static project under `site/`, configure the repository Pages base,
define typed bilingual content collections, enforce an AST-level MDX policy, and generate metrics
from the named restoration snapshot. Deliver a minimal buildable shell with no dependency on the
Cocos runtime and fixed extension fragments that let Phases 4–6 work without sharing files.

## Key Insights

- The repository has no root web package; a separate `site/package.json` avoids mixing Astro
  dependencies with the pinned `game/package.json`.
- Static output is sufficient. No server adapter, API, CMS, search service, or database is needed.
- Base path `/pencil-blade-2026` affects every asset, locale, canonical, sitemap, and iframe URL.
  Centralize URL generation; never hand-concatenate root-relative links in content.
- The current Web audit is game-specific and rejects case-study vocabulary/paths. Do not run it
  against Astro output; Phase 7 adds a separate composite policy.
- Metrics must be built from the Phase 1 hash-frozen JSON/report snapshot. MDX owns narrative,
  not counters, and a rebuild never follows “latest” evidence silently.
- The publication layer is a localized projection of the canonical claim ledger, not a new claim
  system. Evidence status/source/confidence fields are generated and read-only.
- Browser tooling belongs to the isolated `site/` package. Root portable game tests stay
  Node-built-in-only and never resolve dependencies through a developer's home directory.
- Use standard Astro components and small client scripts first. Add a UI framework only after a
  measured interaction proves vanilla code inadequate.

## Requirements

### Functional

- Create static Astro site with `site`, `base`, `trailingSlash`, and `output` configured for
  `https://dantech0xff.github.io/pencil-blade-2026/`.
- Support English default routes and Vietnamese `/vi/` routes.
- Define authored collections for `chapters` and `aiEpisodes`, plus a read-only generated
  `claimPresentations` collection loaded from the Phase 1 publication manifest.
- Define typed fields per contract. Authored chapter/episode records own locale/copy/order;
  generated claim records own derived canonical status/source/confidence fields and cannot accept
  those fields from MDX.
- Generate a public facts data file only from the named `restorationEvidenceSnapshot`.
- Verify all source bytes against the publication snapshot before generation; require an explicit
  manifest version bump and editorial review for an evidence refresh.
- Resolve a repository citation to a commit-pinned GitHub link only when its Phase 1 source-catalog
  record has `publicLinkAllowed: true`; otherwise resolve to the sanitized local excerpt.
- Validate internal links, source refs, locale parity, evidence status, and media IDs before build.
- Emit canonical URLs, `hreflang`, sitemap, robots, 404, and JSON-LD hooks.
- Provide minimal root/404 pages proving Pages-base-safe links and assets.
- Create fixed route/data/validator fragment interfaces for Chapters, AI Lab, and Play; their
  aggregator files are owned by this phase and may not be edited by Phases 4–6.

### Non-functional

- Static HTML by default; zero client JavaScript on the minimal shell.
- Select one currently supported Node LTS from official release data during implementation,
  freeze its exact patch in repository config, use it in local/CI commands, and reject drift.
- Locked npm dependencies and reproducible `npm ci --ignore-scripts`.
- No generated output or caches tracked.
- No external font/image/script request.
- Reject MDX ESM/import/export, JS expressions, raw HTML, expression/spread attributes, event
  attributes, unsafe schemes, and non-allowlisted elements/components at the syntax-tree boundary.
- Local and CI builds use the same commands.

## Architecture

```text
publication/source manifests ───┐
canonical claim ledger ─────────┼─> generate-case-study-data.mjs
restorationEvidenceSnapshot ────┘              │
                                               v
                                  site/src/generated/facts.json
                                               │
MDX + content schemas ─────────────────────────┼─> Astro static build
                                               │
locale + route helpers ────────────────────────┘
                                               v
                                            site/dist
```

Recommended build scripts:

```text
npm run prepare:data
npm run validate:content
npm run check
npm run build
```

`prepare:data` always regenerates ignored derived data. The build never trusts a stale committed
metrics snapshot.

## Content Contracts

### Chapter

`id`, `locale`, `order`, `slug`, `title`, `dek`, `summary`, `chapterKind`, `evidenceRefs`,
`mediaRefs`, `nextId`, `seoTitle`, `seoDescription`, `draft`.

### Claim presentation

One record per canonical claim: `canonicalClaimId`, required `copy.en` and `copy.vi`,
`publicExplanation.en` and `.vi`, `displayQualifier`, `order`, `tags`, `redaction`, and
`publicSourceIds`. The generated join supplies canonical `status`, `evidenceTier`, `confidence`,
`evidenceRefs`, `contradictionIds`, and proof links. There is no fallback to English on `/vi/`;
an unreviewed/missing Vietnamese field blocks the route and candidate.

### AI Episode

`id`, `locale`, `order`, `question`, `evidence`, `hypothesis`, `reviewDecision`,
`decisionActorKind`, `decisionRef`, `implementation`, `verification`, `failureLesson`,
`agentRoles`, `publicSourceIds`.

## File Inventory

| Action | Path | Purpose | Test impact |
|---|---|---|---|
| Create | `site/package.json`, `site/package-lock.json` | Isolated locked Astro toolchain and scripts | `npm ci`, script contract |
| Create | `.node-version` | Exact Node patch shared by local work and both workflows | Runtime/version contract |
| Create | `site/astro.config.mjs`, `site/tsconfig.json` | Static output, Pages base, i18n, MDX, sitemap | Config tests/build |
| Create | `site/src/content.config.ts` | Zod-backed content collection schemas | Schema negative fixtures |
| Create | `site/src/lib/restricted-mdx-policy.ts` | Reject executable/unsafe MDX AST nodes and component/URL violations | Adversarial MDX fixtures |
| Create | `site/src/data/locales.ts`, `site/src/data/routes.ts` | Locale and base-safe route aggregator | Unit tests |
| Create | `site/src/data/route-fragments/chapters.ts` | Chapter-owned route fragment with typed empty initial export | Merge/route tests |
| Create | `site/src/data/route-fragments/ai-lab.ts` | AI Lab-owned route fragment with typed empty initial export | Merge/route tests |
| Create | `site/src/data/route-fragments/play.ts` | Play-owned route fragment with typed empty initial export | Merge/route tests |
| Create | `site/src/layouts/base-layout.astro` | Minimal semantic HTML/meta shell; styling follows in Phase 3 | Build smoke |
| Create | `site/src/pages/index.astro`, `site/src/pages/vi/index.astro`, `site/src/pages/404.astro` | Minimal English/Vietnamese roots and not-found output | Route smoke |
| Create | `scripts/generate-case-study-data.mjs` | Read authoritative JSON and emit deterministic public facts | Generator tests |
| Create | `scripts/validate-case-study-content.mjs` | Cross-collection, citation, locale, and media validation | Positive/negative tests |
| Create | `scripts/case-study-validation/chapters.mjs` | Chapter-owned rule fragment composed by the fixed validator | Merge/negative fixtures |
| Create | `scripts/case-study-validation/ai-lab.mjs` | AI Lab-owned rule fragment composed by the fixed validator | Merge/negative fixtures |
| Create | `scripts/case-study-validation/play.mjs` | Play-owned rule fragment composed by the fixed validator | Merge/negative fixtures |
| Create | `tests/generate-case-study-data.test.mjs` | Determinism, snapshot hashes, field authority, canonical joins | Portable Node suite |
| Create | `tests/case-study-content.test.mjs` | Schema, links, locale parity, public refs | Portable Node suite |
| Modify | `.gitignore` | Ignore `site/node_modules/`, `site/dist/`, `site/src/generated/`, final composed build | Ignore contract test |
| Delete | None | — | — |

## Function and Interface Checklist

- [ ] `withBase(path)` returns exactly one Pages base and preserves trailing-slash policy.
- [ ] `localizedPath(locale, route)` produces English default and Vietnamese-prefixed routes.
- [ ] `alternateLocalePath(locale, route)` preserves the current page on language switch.
- [ ] `resolvePublicCitation(sourceId, sourceCatalog, commit)` emits a commit-pinned URL only for
      an approved linkable source; otherwise it emits the sanitized site-excerpt route.
- [ ] `generatePublicFacts(inputs, evidenceSnapshot)` verifies input hashes, maps only allowlisted
      fields, and returns deterministic JSON.
- [ ] `loadPublicationManifest()` validates Phase 1 before content build.
- [ ] `validateCollectionParity(entries)` requires locale pairs for launch content.
- [ ] `validateContentReferences(entries, manifest)` resolves claim/media/source IDs.
- [ ] `validateInternalLinks(distOrRouteManifest)` rejects missing/base-bypassing routes.
- [ ] `restrictedMdxPolicy()` rejects `mdxjsEsm`, flow/text expressions, HTML, expression/spread
      attributes, event handlers, dangerous schemes, and unknown JSX nodes before compilation.
- [ ] `mergeRouteFragments()` rejects duplicate route IDs/paths, missing locale pairs, and missing
      required launch routes.

## Implementation Steps

1. Verify the supported Node LTS against official Node release data, select one exact patch, and
   commit it in `.node-version`; mirror it in `site/package.json` engines. Phase 7 applies the
   same value to `game/package.json` and both workflows.
   Initialize `site/` with the current stable Astro version and commit its lockfile. Add only
   Astro/MDX/sitemap, TypeScript-required packages, and the AST tooling used by the policy.
2. Configure:
   - static output;
   - `site: https://dantech0xff.github.io`;
   - `base: /pencil-blade-2026`;
   - directory output/trailing slash;
   - locales `en`, `vi`, default `en`, no default-locale prefix.
3. Implement one base-aware route helper and prohibit literal root-relative internal URLs in
   components/MDX.
4. Define the two authored collections and the read-only generated claim-presentation loader.
   Load the single bilingual `claimPresentation` record per canonical claim from the Phase 1
   manifest so routes remain stable while copy is complete in both locales; do not create a
   second site-authored copy or duplicate canonical status/evidence fields.
5. Register `restrictedMdxPolicy()` in Astro before content compilation. Reject executable MDX,
   unsafe attributes/URLs, and unknown components rather than attempting to sanitize generated
   output. Add fixtures for imports/exports, expressions, event handlers, `javascript:`, raw HTML,
   Astro raw directives, and spread attributes.
6. Implement the data generator:
   - verify every input against the Phase 1 snapshot commit/path/SHA-256;
   - read resource counts/classification from the preservation manifest;
   - read five-domain scores and residual counts from fidelity JSON;
   - read all four native-function counters from the native summary (`713` auto-indexed total,
     `553` with direct calls, `684` with numeric constants, `91` with string xrefs);
   - read historical tests/build/runtime facts from the frozen closeout/runtime JSON and label
     them `restorationEvidenceSnapshot`, never current case-study production;
   - join all 39 claim presentations to canonical ledger records without allowing overrides;
   - include source path + field pointer with every fact;
   - write sorted deterministic JSON to ignored `site/src/generated/`.
7. Implement content validation against the Phase 1 publication/source manifests. Compose the
   three domain validator fragments through a fixed finding shape and fixed aggregator.
8. Create typed empty route fragments for Chapters, AI Lab, and Play, then make `routes.ts` the
   sole aggregator. Phase 3 adds fixed metadata/layout slots; later parallel phases edit only
   their own fragments.
9. Create a minimal semantic layout with canonical/alternate metadata slots, skip link, main
   landmark, and no design assumptions beyond Phase 3 hooks.
10. Build English root and 404 pages. Generate Vietnamese root route through the shared locale
   contract.
11. Add npm scripts and Node tests. Prove a clean checkout can run
   `npm ci --ignore-scripts` → prepare → validate → check → build on the exact Node patch.
12. Confirm generated `site/dist/` contains no Cocos/game payload and issues no network requests.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Base omitted or duplicated in generated URL | Test/build fails |
| Critical | Content source ref escapes repo or targets denied raw path | Validation fails |
| Critical | Safe relative citation points to unsafe tracked content/transitive private path | Direct citation fails; sanitized excerpt required |
| Critical | Generated metric differs from authoritative JSON | Generator test fails |
| Critical | Presentation duplicates/overrides canonical status, refs, confidence, or contradictions | Validation fails |
| Critical | MDX contains ESM, JS expression, raw HTML, spread/expression attribute, or event handler | AST policy fails before build |
| High | English launch entry lacks Vietnamese pair | Validation fails |
| High | Unknown evidence/media ID in MDX | Validation fails |
| High | Raw HTML, unsafe URL, or non-allowlisted MDX component | Build/validation fails |
| High | Site build makes external network request | Build smoke fails |
| Medium | Locale switch loses current route | Route helper test fails |
| Medium | Canonical or `hreflang` omits Pages base | HTML test fails |
| Medium | 404 asset/link bypasses base | Route test fails |
| Medium | Repeated generation changes bytes without source change | Determinism test fails |
| High | Evidence input changes while snapshot version stays fixed | Generation fails closed |
| High | Phase 4–6 route fragments collide or an expected fragment is missing | Merge acceptance fails |

## Todo List

- [ ] Pin Astro/MDX/sitemap dependencies and lockfile.
- [ ] Configure static Pages base and locale routing.
- [ ] Define three typed content collections.
- [ ] Pin exact Node patch and enforce it in package/workflow contracts.
- [ ] Add the restricted-MDX AST policy and adversarial fixtures.
- [ ] Create fixed route and validator aggregators plus three domain-owned fragments.
- [ ] Implement generated facts and source pointers.
- [ ] Implement content/citation/locale validators.
- [ ] Add minimal root, Vietnamese root, and 404 outputs.
- [ ] Update ignore rules.
- [ ] Pass clean-install, check, validate, and build gates.

## Success Criteria

- [ ] `site/` builds deterministically with `npm ci --ignore-scripts` and no Cocos dependency.
- [ ] All routes/assets include exactly one `/pencil-blade-2026` base.
- [ ] Generated facts match the named frozen snapshot/manifests and carry source pointers.
- [ ] Invalid claim/media/locale/link fixtures fail closed.
- [ ] Every canonical claim presentation has reviewed `en` and `vi` copy with derived,
      non-authorable canonical state.
- [ ] English and Vietnamese content contracts are identical in shape/status.
- [ ] Minimal output is semantic, crawlable, and functional with JavaScript disabled.
- [ ] No site output, cache, or generated facts are tracked.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Astro package churn | Non-reproducible build | Lockfile; exact package versions; official-doc check at implementation |
| Two package roots confuse CI | Wrong install/build | Explicit working directories and workflow tests |
| Base-path bugs appear only on Pages | Broken production links | Central helper + exact-prefix local server |
| MDX becomes executable content | Build compromise/persistent XSS | AST rejection of executable nodes/attributes plus adversarial fixtures |
| Parallel phases overwrite shared contracts | Missing routes or policy | Fixed aggregators and domain-owned fragments created before parallel work |
| Generated metrics become another truth source | Stale claims | Ignore output and regenerate on every build |
| i18n doubles copy but not evidence | Locale inconsistency | Shared claim IDs/status and parity validator |

## Security and Privacy Considerations

- Do not expose environment variables to public client bundles.
- Do not fetch remote content during build; all source data is tracked and reviewed.
- Permit only source-catalog-approved `https:` citations rendered as normal anchors with safe
  `rel`; never treat them as runtime fetch endpoints. Unsafe tracked reports resolve to local
  sanitized excerpts.
- No third-party analytics, remote fonts, comments, forms, service worker, or localStorage in this
  phase.
- `site/` must not import from `game/assets/game/`; curated media gets its own manifest and path.

## Rollback

Delete `site/`, `.node-version`, the root case-study generators/validators/tests, and restore
`.gitignore`. Existing game builds, workflow, Pages site, and reconstruction docs remain
untouched until Phase 7.

## Next Steps

Phase 3 replaces the minimal shell with the editorial design system. Phases 4-6 must consume the
typed collections and route helpers rather than creating parallel content/data conventions.

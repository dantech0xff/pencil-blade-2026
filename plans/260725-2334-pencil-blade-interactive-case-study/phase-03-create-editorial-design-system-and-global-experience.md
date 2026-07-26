---
phase: 3
title: "Create Editorial Design System and Global Experience"
status: complete
priority: P1
dependencies: [1, 2]
effort: "7-9 days"
---

# Phase 3: Create Editorial Design System and Global Experience

## Context Links

- [Case-study plan](./plan.md)
- [Phase 1 publication contract](./phase-01-establish-public-narrative-and-evidence-contract.md)
- [Phase 2 Astro platform](./phase-02-build-astro-platform-and-content-pipeline.md)
- [Editorial experience specification](./reports/editorial-experience-spec.md)
- [Content evidence source map](./reports/content-evidence-source-map.md)
- [Project code standards](../../docs/code-standards.md)
- [Presentation/resource specification](../../docs/presentation-resource-spec.md)
- [Astro testing](https://docs.astro.build/en/guides/testing/)

## Overview

Replace the minimal Astro shell with a recognizable editorial system: forensic laboratory ×
restoration workshop × pencil sketchbook. Establish shared tokens, layout, navigation, evidence
states, figures, disclosures, safe metadata/CSP, final About/SEO/social surfaces, and
motion/accessibility behavior before chapter teams work in parallel. All launch-source routes and
global media must exist before the release-candidate phase.

The design must feel authored around the Pencil Blade investigation, not like a SaaS landing page
or generic documentation theme. It uses project-authored linework and evidence geometry; recovered
game art remains inside captioned, approved evidence frames and never becomes site chrome.

## Key Insights

- The recurring visual unit is an evidence chain—question → artifact → contract → implementation
  → proof—not a feature card.
- `recovered`, `measured`, `inferred`, `unknown`, scope decisions, academic-display scope, and
  commercial-rights status must use text, shape, and pattern; color alone is insufficient.
- System font stacks are the safest launch default. Remote fonts are prohibited; a later
  self-hosted font requires an OFL/license record and full Vietnamese glyph proof.
- Regular Astro multipage navigation keeps focus/history and the game iframe lifecycle simple.
  Do not enable a global client router merely for transition effects.
- Core content and evidence must remain useful without JavaScript. Enhancement may reveal,
  filter, or replay; it may not own meaning.
- GitHub Pages cannot provide project-specific response headers. Editorial documents therefore
  emit a route-appropriate CSP meta policy and safely serialized JSON-LD; the separately navigated
  H5 document retains its own runtime needs.

## Requirements

### Functional

- Create a shared shell with skip link, header, compact chapter rail, locale switcher, footer,
  main landmark, and next-chapter navigation.
- Create reusable evidence primitives: status legend/badge, evidence reference, accessible
  drawer/inline fallback, proof figure, metric ledger, rights boundary, code/evidence lane, and
  source link.
- Build the bilingual Home page as a documentary trailer: cold open, transformation claim, APK
  cutaway, scope correction, chapter rail, proof ledger, playable glimpse, rights boundary.
- Build the bilingual `/about/` route with method, scope, credits, attribution/non-affiliation,
  academic/commercial rights distinction, correction/contact surface, and translation-review
  accountability from Phase 1 release inputs.
- Preserve route/anchor when switching language; do not auto-redirect by browser locale.
- Define responsive editorial, lab/workbench, figure, code, table, and playable-frame layouts.
- Define focus, hover, active, error, loading, empty, and reduced-motion states.
- Provide print styling that retains prose, qualifiers, citations, figure captions, and URLs.
- Emit consistent canonical/locale/social metadata through the shared layout.
- Emit final sitemap/robots, reciprocal `hreflang`, safe structured data, favicon, and
  project-authored route/social previews before candidate composition.
- Update the publication manifest with exact hashes/dimensions/locale-route mappings for every
  generated brand/social asset; unresolved or unregistered media must never enter `site/dist/`.

### Non-functional

- WCAG 2.2 AA target; `44×44px` minimum touch controls, visible `2px` focus ring, semantic HTML
  first, and no hover-only information.
- Work from `320px` through wide desktop without page-level horizontal scroll.
- Reading measure `720–780px`; 4/6/12-column progression; maximum composition width `1440px`.
- Initial route JavaScript target ≤ `120 KB` gzip, with zero JavaScript required for core prose.
- No gradients, glow/orbs, stock icons, generic bento/three-card feature rows, custom cursor,
  scroll hijack, perpetual animation, or continuous scroll-state rendering.
- No external font, image, script, analytics, or CDN request.
- All motion is interruptible and becomes an informative static end state under reduced motion.
- JSON-LD serialization escapes `<`, `>`, `&`, U+2028, and U+2029 and is the only narrowly
  approved raw-script-text path. No caller passes pre-serialized HTML.
- Editorial CSP defaults to `default-src 'self'`, denies object/base/form/connect capabilities,
  permits only the same-origin game frame on `/play/`, and uses per-document hashes for required
  inline JSON-LD. Any deviation is route-specific, tested, and documented.

## Architecture

```text
design tokens ───────────────┐
semantic Astro primitives ──┼─> BaseLayout + route composition
locale/route helpers ───────┤                │
generated facts ────────────┘                v
                                     static bilingual HTML
                                               │
                              optional local enhancement scripts
```

Visual tokens:

| Role | Token/value |
|---|---|
| Paper | `#F4F0E6`, secondary `#E5DED0` |
| Graphite | `#171A18`, secondary `#515750` |
| Lab surface | `#16211E` |
| Pencil accent | `#F2C94C` |
| Recovered | `#1B6B4B` + solid/check shape |
| Measured | `#006C7A` + ruler shape |
| Inferred | `#8A4B00` + hatched/triangle shape |
| Exception/blocked | `#A13A2B` + cross/stop shape |

Every token must pass its intended contrast pairing. Status text remains authoritative if styles
or color are unavailable.

## File Inventory

| Action | Path | Purpose | Test impact |
|---|---|---|---|
| Create | `site/src/styles/tokens.css` | Color, type, spacing, grid, radius, shadow, z-index, and motion tokens | Token/contrast tests |
| Create | `site/src/styles/global.css`, `site/src/styles/editorial.css` | Reset, typography, semantic content, lab/workbench compositions | Responsive/visual tests |
| Create | `site/src/styles/motion.css`, `site/src/styles/print.css` | Enhancement/reduced-motion and evidence-preserving print rules | Reduced-motion/print tests |
| Create | `site/src/components/shell/site-header.astro`, `site-footer.astro`, `chapter-rail.astro`, `locale-switcher.astro` | Global bilingual navigation and orientation | Keyboard/route tests |
| Create | `site/src/components/evidence/evidence-status.astro`, `evidence-ref.astro`, `evidence-drawer.astro`, `status-legend.astro` | Shared public evidence vocabulary and inspection | A11y/content tests |
| Create | `site/src/components/editorial/proof-figure.astro`, `metric-ledger.astro`, `rights-boundary.astro`, `code-lens.astro`, `next-chapter.astro` | Shared documentary grammar | Component/visual tests |
| Create | `site/src/scripts/evidence-drawer.ts`, `site/src/scripts/observe-reveal.ts` | Small progressive-enhancement controllers | Browser/unit tests |
| Create | `site/src/assets/brand/case-study-mark.svg`, `site/src/assets/brand/lab-linework.svg` | Clean-room, project-authored visual identity | Media/policy tests |
| Create | `site/src/pages/about/index.astro`, `site/src/pages/vi/about/index.astro` | Scope, credits, method, non-affiliation, rights, correction/contact | Route/content QA |
| Create | `site/src/data/seo.ts`, `site/src/pages/robots.txt.ts` | Canonical, social, structured-data, sitemap/robots mappings | SEO/route tests |
| Create | `site/src/lib/serialize-json-ld.ts`, `site/src/lib/editorial-csp.ts` | Safe JSON-in-script serialization and per-route CSP generation | Injection/CSP tests |
| Create | `site/public/social/*`, `site/public/favicon.*` | Project-authored rights-safe route previews and identity assets | Media/hash/size tests |
| Create | `site/src/assets/media/shared/play-preview.png` | Shared display derivative from one exact waiver-scoped capture for Home/Play fallback | Media/hash/scope tests |
| Modify | `reference/case-study-publication-manifest.json` | Final exact records for project-authored brand/social media | Publication validation |
| Modify | `site/src/layouts/base-layout.astro` | Apply shell, tokens, metadata, skip/focus contracts | Full route smoke |
| Modify | `site/src/pages/index.astro`, `site/src/pages/vi/index.astro`, `site/src/pages/404.astro` | Home trailer and designed fallback | Route/visual tests |
| Modify | `site/package.json`, `site/package-lock.json` | Pin Playwright/axe tooling required for shell validation | Clean install |
| Create | `site/playwright.config.ts`, `site/tests/shell-accessibility.spec.ts`, `site/tests/shell-responsive.spec.ts` | Keyboard, semantics, viewport, reduced-motion, print, and visual smoke | Browser suite |
| Create | `tests/case-study-design-system.test.mjs` | Token, external-request, asset-policy, and static HTML contracts | Portable Node suite |
| Delete | None | — | — |

## Function and Interface Checklist

- [ ] `BaseLayout` accepts locale, route ID, title, description, alternates, structured JSON-LD,
      and optional surface variant; only `serializeJsonLd` may produce the final script text.
- [ ] `ChapterRail` derives order/current/next state from the shared route table.
- [ ] `LocaleSwitcher` links only reviewed route pairs and preserves a valid evidence anchor.
- [ ] `EvidenceStatus` renders fixed label, icon/shape, definition, and machine-readable status.
- [ ] `EvidenceRef` links to a stable `/evidence/#id` fallback before enhancement.
- [ ] `EvidenceDrawer` traps focus when modal, closes on Escape, returns focus, and keeps the
      cited content inline/linkable without JavaScript.
- [ ] `ProofFigure` requires alt/long description, caption, provenance, media ID, and dimensions.
- [ ] `MetricLedger` prints numerator, denominator, metric version/date, qualifier, and source.
- [ ] `RightsBoundary` visually and semantically separates technical proof from release rights.
- [ ] `observeReveal()` performs no work under reduced motion and never hides initial content.
- [ ] `serializeJsonLd(value)` accepts structured data only, performs the five required escapes,
      and cannot accept a raw/pre-serialized string.
- [ ] `buildEditorialCsp(route, inlineHashes)` denies network/script capability by default,
      permits only required same-origin assets, and limits `frame-src 'self'` to `/play/`.
- [ ] `AboutPage` consumes frozen release-input roles/contact/attribution and both rights
      dimensions; it never invents missing names or imply commercial clearance.

## Implementation Steps

1. Implement tokens and test intended color pairs before component styling. Use system serif,
   sans, and monospace stacks that cover English and Vietnamese without network loading.
2. Build the semantic base layout and shell. Keep DOM order equal to reading/focus order; add
   skip link, one `h1`, main landmark, route context, footer scope, and locale alternates.
3. Build the chapter rail:
   - desktop contextual rail;
   - compact mobile top bar and accessible navigation sheet;
   - active chapter text, not color alone;
   - no aggressive double-sticky layout with an evidence rail.
4. Build evidence/status primitives against Phase 1 records. The non-JavaScript state uses
   normal links or `details`; the enhanced drawer opens the cited node, contains focus, and
   restores it on close.
5. Build proof figures, metric ledger, rights boundary, code lens, and continuation controls.
   Require dimensions/captions/qualifiers so later chapters cannot render ambiguous visuals.
6. Compose English and Vietnamese Home pages from shared facts:
   - “one non-runnable APK” cold open;
   - static-analysis → clean-room reconstruction transformation;
   - scope/identity correction adjacent to fidelity;
   - evidence-led chapter map;
   - five-domain metric with residual and `0/862` rights context;
   - static play preview that links to `/play/` without loading H5.
7. Build both About routes from Phase 1 release inputs. If owner/contact/Vietnamese reviewer
   fields are not final, render an explicit non-production draft flag and make candidate
   validation fail; do not defer source creation until after deploy.
8. Implement canonical/social/structured metadata, sitemap, robots, project-authored favicon,
   and `1200×630` top-level route-preview family. Produce one shared Play/Home fallback derivative
   from an exact Phase 1 capture record. Register exact hashes/dimensions/locales/provenance and
   transformation history in the publication manifest before assets may be emitted.
9. Implement the JSON-LD serializer and route-appropriate editorial CSP. Add injection fixtures
   for `</script>`, `<`, `&`, U+2028/U+2029, malicious URLs, and pre-serialized input. Verify the
   H5 iframe navigates as a separate document and is not subjected to an incompatible parent CSP.
10. Add restrained motion tokens and a single reveal helper using `IntersectionObserver`. Avoid
   layout animation; under reduced motion, render the final informative state immediately.
11. Add responsive, landscape, 200%-zoom, print, and no-JavaScript styling. Wide tables receive
   semantic summaries and explicitly labeled overflow regions, never page-level overflow.
12. Add Playwright/axe and portable tests. Validate all shell controls at `320`, `375`, `768`,
   `1024`, and `1440` widths and both locales.
13. Run publication/content validation before visual snapshots so no prohibited media becomes a
    baseline.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Fidelity appears without denominator, residuals, identity, or rights qualifier | Content/component test fails |
| Critical | Recovered art/font is used as global chrome without approved media record | Publication/design test fails |
| Critical | Core evidence disappears with JavaScript or reduced motion disabled | Browser test fails |
| Critical | About/credits/contact/translation-review input is empty at candidate mode | Candidate validation fails |
| Critical | JSON-LD payload can close the script element or inject markup | Serializer fixture fails |
| Critical | Social/favicon file lacks exact project-authored manifest record | Publication validation fails |
| High | Drawer loses focus, cannot Escape, or lacks stable fallback URL | A11y test fails |
| High | Locale switch lands on wrong/incomplete route or loses valid anchor | Route test fails |
| High | 320 px or 200% zoom creates page-level horizontal scroll | Responsive test fails |
| High | Status relies on color alone or contrast misses AA | Token/a11y test fails |
| High | Home or shell requests a remote font/script/image or any game file | Network test fails |
| High | Editorial CSP permits unexpected script/connect/object/base/form capability | CSP test fails |
| High | Canonical, sitemap, robots, social, or `hreflang` route is absent before Phase 7 | Route/SEO test fails |
| Medium | Print hides citations, qualifiers, captions, or URLs | Print snapshot fails |
| Medium | Motion continues under `prefers-reduced-motion` | Browser test fails |
| Medium | Route has multiple `h1`s or skipped heading structure | Axe/semantic test fails |

## Todo List

- [ ] Freeze token and status vocabulary.
- [ ] Build global shell and responsive chapter rail.
- [ ] Build all shared evidence/editorial primitives.
- [ ] Compose both Home routes from generated facts.
- [ ] Add clean-room brand SVGs and publication validation.
- [ ] Build both About routes and freeze global SEO/robots/social/favicon output.
- [ ] Register exact project-authored media hashes in the publication manifest.
- [ ] Add safe JSON-LD serialization, editorial CSP, and adversarial injection tests.
- [ ] Add motion, reduced-motion, no-JS, and print modes.
- [ ] Pass browser, axe, contrast, network, and responsive gates.

## Success Criteria

- [ ] Five-second review reads “forensic lab × restoration workshop × sketchbook,” not generic
      SaaS/docs/AI landing page.
- [ ] All shared components are bilingual, semantic, base-path safe, and usable without JS.
- [ ] Home communicates artifact, static-only method, clean-room build, proof, and limits in the
      first narrative sequence.
- [ ] All fixed status/metric/rights vocabulary renders with text + shape and AA contrast.
- [ ] Shell passes keyboard, reduced-motion, 320 px, 200% zoom, print, and remote-request tests.
- [ ] About, canonical, reciprocal `hreflang`, sitemap, robots, JSON-LD, favicon, and social
      previews are final before Phases 4–6 branch and before candidate composition.
- [ ] Non-play routes make zero requests for the H5 subtree.
- [ ] Phases 4, 5, and 6 can work concurrently using only Phase 3 shared primitives.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Art direction becomes decorative | Evidence loses credibility | Every visual primitive owns a claim/proof function |
| Shared components over-abstract chapter needs | Slow authoring | Keep semantic props narrow; chapter-specific interactions stay local |
| Animation hides information | A11y/no-JS failure | Informative default DOM; motion only changes presentation |
| Typography adds a rights/dependency problem | Blocked launch or layout shift | System stacks; optional licensed self-hosting is stretch |
| Late title/credits change invalidates media | Candidate mismatch | Phase 1 release inputs + exact Phase 3 media hashes; rebuild candidate on change |
| Metadata introduces persistent XSS | Reader compromise | Structured-only serializer, CSP hash, adversarial fixtures |
| Bilingual strings break layout | Overflow and hierarchy drift | Vietnamese first-class fixtures at every breakpoint |
| Evidence drawer becomes an SPA | State/history/focus complexity | Stable links and inline fallback; tiny controller only |

## Security and Rights Considerations

- SVG assets must be project-authored, sanitized, script-free, and contain no embedded external
  image/font references.
- Social/favicon assets are project-authored and receive exact publication records; recovered
  artwork is not used as brand/preview chrome.
- Do not expose private/local paths in captions, metadata, errors, source maps, or visual tests.
- Evidence links are source-catalog-approved `https:` anchors or base-safe sanitized excerpt
  routes; no third-party embed.
- The same-origin game frame is not part of this phase and no global shell state may assume it.
- Design tokens and icons never imply rights approval through “success” color alone.

## Rollback

Revert Phase 3 styles, shared components, About/SEO/CSP/metadata, brand/social/shared-preview
assets, publication-media records, browser tests, and Home/layout changes as one unit. Phase 2's
minimal semantic shell remains buildable; no game or restoration evidence artifact is modified.

## Next Steps

Phase 4 builds only chapter-specific content/interactions. Phases 5 and 6 reuse these shared
primitives but remain independent of Phase 4 so all three can execute in parallel.

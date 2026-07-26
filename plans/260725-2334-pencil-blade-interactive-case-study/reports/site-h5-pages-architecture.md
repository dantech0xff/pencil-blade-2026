---
title: "Pencil Blade Interactive Case Study H5 Pages Architecture"
date: "2026-07-25"
status: research
source_scope: "local repo evidence only; no web research"
---

# Pencil Blade Interactive Case Study H5 Pages Architecture

## Summary

The best fit is a single GitHub Pages artifact assembled from two static subtrees: an Astro/MDX case-study site at the root, and the existing Cocos H5 build mounted under `/play/h5/`, with `/play/` as the launcher page that embeds the game in an iframe. That keeps the editorial site and the clean-room game in one deployable artifact without turning the game into a runtime dependency of the content site.

Do not replace the current game audits. Keep the existing Cocos build audit and exact-prefix verifier as the gate for the raw game subtree, then add a second final-artifact verification pass for the merged Pages tree. The current workflow, verifier, and H5 matrix are all root-prefix and game-tree centric, so the rollout will invalidate those assumptions and needs explicit route and artifact changes rather than a light edit.

## Sources Consulted

- [README.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/README.md)
- [docs/project-overview-pdr.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/project-overview-pdr.md)
- [docs/codebase-summary.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/codebase-summary.md)
- [docs/code-standards.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/code-standards.md)
- [docs/system-architecture.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/system-architecture.md)
- [docs/compatibility-matrix.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/compatibility-matrix.md)
- [docs/cocos-creator-build-audit.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/cocos-creator-build-audit.md)
- [.github/workflows/deploy-web-mobile-pages.yml](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.github/workflows/deploy-web-mobile-pages.yml)
- [scripts/audit-web-build.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/audit-web-build.mjs)
- [scripts/verify-web-mobile-build.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/verify-web-mobile-build.mjs)
- [scripts/run-h5-runtime-matrix.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/run-h5-runtime-matrix.mjs)
- [scripts/verify-release-rights.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/verify-release-rights.mjs)
- [tests/github-pages-workflow.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/github-pages-workflow.test.mjs)
- [tests/audit-web-build.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/audit-web-build.test.mjs)
- [tests/verify-web-mobile-build.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/verify-web-mobile-build.test.mjs)
- [tests/release-manifests.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/release-manifests.test.mjs)
- [plans/260725-2334-pencil-blade-interactive-case-study/plan.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/plans/260725-2334-pencil-blade-interactive-case-study/plan.md)
- [plans/260725-2334-pencil-blade-interactive-case-study/phase-02-build-astro-platform-and-content-pipeline.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/plans/260725-2334-pencil-blade-interactive-case-study/phase-02-build-astro-platform-and-content-pipeline.md)
- [plans/260725-2334-pencil-blade-interactive-case-study/phase-06-integrate-playable-h5-game-experience.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/plans/260725-2334-pencil-blade-interactive-case-study/phase-06-integrate-playable-h5-game-experience.md)
- [plans/260725-2334-pencil-blade-interactive-case-study/phase-07-unify-testing-build-and-github-pages-deployment.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/plans/260725-2334-pencil-blade-interactive-case-study/phase-07-unify-testing-build-and-github-pages-deployment.md)

## Table Of Contents

- [Recommendation](#recommendation)
- [Target Routes](#target-routes)
- [Artifact Shape](#artifact-shape)
- [CI Boundaries](#ci-boundaries)
- [Comparative Analysis](#comparative-analysis)
- [Test Strategy](#test-strategy)
- [Invalidated Assumptions](#invalidated-assumptions)
- [Security Privacy Performance](#security-privacy-performance)
- [File Inventory](#file-inventory)
- [Dependency Map](#dependency-map)
- [Open Questions](#open-questions)

## Recommendation

Ranked choice:

| Rank | Approach | Fit | Complexity | Risk | Verdict |
|---|---|---|---|---|---|
| 1 | Single Pages artifact assembled from Astro root + copied Cocos subtree at `/play/h5/` | High | Medium | Medium | Recommended |
| 2 | Keep the game at the root prefix and tuck Astro under a subpath | Medium | Low | Low | Rejected: wrong route shape for this brief |
| 3 | Split into separate sites or repos | Low | High | Low-Medium | Rejected: violates the one-artifact goal |

Why the top choice wins:

- It matches the requested routes: `/` for the editorial home, content pages under a dedicated content subtree, `/play/` as the launcher, and `/play/h5/` as the isolated runtime entry.
- It preserves the current Cocos build as a clean subtree instead of making the site generator understand game internals.
- It keeps the current release audits useful by running them on the raw game subtree before merge, then adding a final merged-artifact gate.
- It fits the repo structure better than forcing the game to remain the root site. The current docs explicitly say the Web Mobile H5 lives at the repository prefix `/pencil-blade-2026/` and is deployed at the root URL today, so the root-route assumption must change for this rollout. See [docs/project-overview-pdr.md:69](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/project-overview-pdr.md#L69) and [docs/compatibility-matrix.md:14](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/compatibility-matrix.md#L14).

## Target Routes

Recommended route map:

| Route | Purpose | Notes |
|---|---|---|
| `/` | Astro home / case-study entry | Editorial hero, project summary, CTA to `/play/` |
| `/case-studies/` | MDX article index | Static list of chapters and evidence-backed articles |
| `/case-studies/<slug>/` | Individual case-study pages | Each page links to evidence and source notes |
| `/play/` | Game launcher page | Explains controls, embeds the runtime, can lazy-load the iframe |
| `/play/h5/` | Isolated H5 runtime mount | Direct entry point for the copied Cocos web tree |
| `/play/h5/index.html` | Shareable runtime URL | Same mount, direct navigation target for tests and sharing |

Implementation note:

- Keep the game mount path self-contained. The current Cocos web tree is already verified as a static prefix-served tree, so the safest plan is to copy the raw build into `/play/h5/` without rewriting the game files.
- The launcher page should load the game in an iframe and communicate only through `postMessage` if it needs any telemetry back to the site shell.
- Treat any parent-to-child DOM coupling as a bug.

## Artifact Shape

Recommended composition:

```text
final Pages artifact
├── /index.html                 Astro home
├── /case-studies/...           Astro/MDX content
├── /play/index.html            launcher page
└── /play/h5/                   copied Cocos web-mobile-pages tree
    ├── index.html
    ├── assets/...
    ├── cocos-js/...
    └── src/...
```

Build order:

1. Build Astro into a staging directory.
2. Build the Cocos H5 tree on the self-hosted Creator runner.
3. Run the existing raw game audits on `game/build/web-mobile-pages`.
4. Copy the audited Cocos tree into the staged site at `/play/h5/`.
5. Run the final merged-artifact verifier against the staged Pages tree.
6. Upload only the merged tree to Pages.

Base-path handling:

- Astro must emit asset URLs under the repository Pages base.
- The game subtree should stay relative inside `/play/h5/`; do not make the site shell rewrite game internals unless a later audit proves the tree is not self-contained.
- If a later Creator version emits root-absolute URLs, add a post-build rewrite step, but keep that isolated to the game staging job, not the Astro site job.

This is an inference from the current verifier behavior: the existing web build audit and prefix verifier prove the Cocos tree is self-contained under a mount point, but they do not yet prove nested mounting under `/play/h5/`. That should be covered by a new final-artifact verifier.

## CI Boundaries

Keep three distinct job boundaries:

| Job | Runner | Purpose | Why separate |
|---|---|---|---|
| Content build/test | GitHub-hosted Linux | Astro build, MDX/content schema, link/citation, a11y, unit, visual, Playwright | Cheap, cacheable, no Creator dependency |
| Game build/audit | Self-hosted macOS ARM64 Creator 3.8.8 runner | Cocos Creator build, raw H5 audit, exact-prefix verification, H5 runtime matrix | Must stay on the pinned Creator toolchain |
| Artifact assembly/deploy | GitHub-hosted Linux | Copy raw game subtree into the Astro dist tree, run final merged-artifact verify, upload Pages artifact, deploy | No reason to spend Creator runner time on file copying |

Boundary rule:

- The self-hosted Creator runner should touch only `game/` and the raw `game/build/web-mobile-pages` subtree.
- The final deployment job should not rebuild either product; it should assemble immutable outputs only.
- Preserve the current release-rights separation. `scripts/verify-release-rights.mjs` remains a distinct gate for any future commercial/public-rights decision, not a substitute for the academic Pages deployment flow. See [scripts/verify-release-rights.mjs:25](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/verify-release-rights.mjs#L25) and [docs/code-standards.md:16](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/code-standards.md#L16).

Caching:

- Cache Astro package install artifacts and content build intermediates only.
- Cache game package installs only if the lockfile and runtime stay pinned.
- Never cache `game/build/`, `site/dist/`, or the merged Pages artifact.
- GitHub Pages gives you no custom cache-header control, so rely on hashed filenames and immutable deployments, not mutable URLs.

Rollback:

- If Astro build, content tests, or merge verification fail, do not redeploy.
- If the game build fails, keep the last successful Pages deployment intact.
- Keep the last-good artifact digest and deployment run id so rollback is a redeploy of a known artifact, not a rebuild under time pressure.

## Comparative Analysis

### 1. Astro root + copied game subtree

Pros:

- Best fit for the requested `/`, content pages, `/play/`, and `/play/h5/` route shape.
- Cleanest separation between editorial content and runtime.
- Preserves the game as a static subtree with a single responsibility.

Cons:

- Invalidates the current assumption that the game is the root site.
- Requires new merged-artifact verification.
- Same-origin site + game means localStorage and cookies are shared unless the site avoids them.

Adoption risk:

- Medium. Astro/MDX is straightforward for static editorial work, but the routing and storage model change is real.

### 2. Game stays at the root, Astro lives under a subpath

Pros:

- Minimal change to the current Cocos build and its verifier.
- Lowest engineering churn.

Cons:

- Does not satisfy the requested route hierarchy.
- Makes the case-study feel secondary to the game, not the other way around.

Adoption risk:

- Low operationally, but high product mismatch risk.

### 3. Separate sites or repos

Pros:

- Strongest isolation between the editorial site and the game.
- Simplest mental model for storage and deploy rollback.

Cons:

- Violates the one-GitHub-Pages-artifact requirement.
- Adds operational overhead for two deploys and cross-site navigation.
- Breaks the goal of a single public surface.

Adoption risk:

- Low technical risk, high coordination cost.

Source credibility weighting:

- Highest weight: workflow, verifier, test, and audit scripts because they encode enforced behavior.
- Medium weight: docs/architecture notes because they describe the intended boundary.
- Lowest weight: empty plan phase stubs because they currently show intent only, not implementation detail. See [plans/260725-2334-pencil-blade-interactive-case-study/phase-02-build-astro-platform-and-content-pipeline.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/plans/260725-2334-pencil-blade-interactive-case-study/phase-02-build-astro-platform-and-content-pipeline.md) and the other phase files; they are placeholders.

## Test Strategy

Keep the current game tests, and add site-specific coverage.

| Layer | What to test | Proposed mechanism |
|---|---|---|
| Unit | route helpers, iframe config, layout toggles, no external links, no raw HTML injection | Node test files under `tests/site-*.test.mjs` |
| Content schema | MDX frontmatter, required fields, evidence refs, internal link shape | Astro content collections + schema tests |
| Link/citation | every local file link resolves, every evidence citation exists, no off-origin URLs | static link validator using the same fail-closed style as the current web audit |
| Accessibility | heading order, landmarks, alt text, contrast on launcher pages | Playwright plus axe or equivalent |
| Visual | hero, case-study cards, `/play/` launcher, embedded iframe shell | screenshot tests with stable viewports |
| Playwright | navigation, iframe load, back/forward, no console errors, no external network | browser smoke on final merged artifact |
| H5 runtime matrix | keep the existing game runtime matrix on the raw Cocos subtree, then add a merged-artifact smoke for `/play/` | reuse the current matrix script for the raw game and add a site-aware wrapper |
| Workflow contract | job ordering, runner boundary, artifact path, upload/deploy separation | update the current workflow contract tests |

Recommended split:

- Do not widen the current game verifier into a site verifier.
- Add a second verifier for the merged Pages tree.
- Keep the current H5 runtime matrix as the raw-game proof and add one more smoke that exercises the final `/play/` route.

## Invalidated Assumptions

These current assumptions will be false once the case-study site owns `/`:

| Current assumption | Evidence | Why it breaks |
|---|---|---|
| Web Mobile H5 is the only root Pages surface | [docs/project-overview-pdr.md:69](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/project-overview-pdr.md#L69), [docs/compatibility-matrix.md:14](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/compatibility-matrix.md#L14) | `/` becomes Astro, not the game |
| The deployed artifact is the raw Cocos web tree | [.github/workflows/deploy-web-mobile-pages.yml:143](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.github/workflows/deploy-web-mobile-pages.yml#L143) | final artifact must be merged content + game |
| The verifier only needs one fixed Pages prefix | [scripts/verify-web-mobile-build.mjs:19](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/verify-web-mobile-build.mjs#L19), [scripts/verify-web-mobile-build.mjs:66](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/verify-web-mobile-build.mjs#L66), [scripts/verify-web-mobile-build.mjs:197](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/verify-web-mobile-build.mjs#L197) | final artifact needs at least two mount points |
| The H5 matrix only needs the game build directory | [scripts/run-h5-runtime-matrix.mjs:24](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/run-h5-runtime-matrix.mjs#L24), [scripts/run-h5-runtime-matrix.mjs:369](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/run-h5-runtime-matrix.mjs#L369) | final artifact smoke needs `/play/` too |
| Workflow tests only check the Cocos build output path | [tests/github-pages-workflow.test.mjs:84](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/github-pages-workflow.test.mjs#L84) | they need to assert Astro build, merge, and final verify steps |
| The Web audit/upload path is the raw game tree | [docs/cocos-creator-build-audit.md:100](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/cocos-creator-build-audit.md#L100) | deployment becomes a two-subtree artifact, not a raw tree |
| Generated build output set only includes game artifacts | [.gitignore:18](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.gitignore#L18) | new site output needs its own ignore entry |

Additional assumption to call out:

- `README.md` and the code standards keep the clean-room boundary strict: no original APK, no `libgame.so`, and no native bridge. That remains unchanged and should be reasserted in the site build, not relaxed for convenience. See [README.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/README.md) and [docs/code-standards.md:21](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/code-standards.md#L21).

## Security Privacy Performance

| Risk | Impact | Recommended mitigation |
|---|---|---|
| Same-origin iframe shares storage with the site | Site and game can see the same cookies/localStorage | Namespace all site keys, keep the site free of persistent storage unless necessary, and keep iframe communication one-way by default |
| Parent page can reach the iframe DOM on the same origin | Clean-room boundary can be weakened by accidental coupling | Do not expose DOM handles to the game frame; use `postMessage` only when needed |
| External content in MDX | Privacy leak and supply-chain risk | No third-party scripts/CDNs/fonts/images; validate local links only |
| Large initial payload | Slow first paint and heavy memory use | Lazy-load the iframe, show a static launcher first, and avoid loading the game until the user intends to play |
| Mutable URLs with GitHub Pages caching | Stale content and brittle rollbacks | Use immutable filenames and deployment versioning; avoid relying on custom cache headers |
| Accidental reintroduction of legacy runtime references | Violates the clean-room boundary | Keep the existing audit rules that reject `libgame.so`, decompiler output, and native bridge references |

Performance call:

- This is a content-first site with a large embedded game. If the game frame loads immediately above the fold, the site will feel heavy. Make `/play/` a launch page, not a direct autoplay embed.

## File Inventory

Expected create/modify set for the implementation phase:

### Create

- `site/package.json`
- `site/astro.config.mjs`
- `site/src/layouts/base.astro`
- `site/src/components/game-embed.astro`
- `site/src/components/evidence-citation.astro`
- `site/src/pages/index.astro`
- `site/src/pages/case-studies/index.astro`
- `site/src/pages/case-studies/[slug].astro`
- `site/src/pages/play/index.astro`
- `site/src/pages/play/h5/index.astro`
- `site/src/content/config.ts`
- `site/src/content/case-studies/*.mdx`
- `scripts/build-pages-artifact.mjs`
- `scripts/audit-site-build.mjs`
- `scripts/verify-pages-artifact.mjs`
- `tests/site-content-schema.test.mjs`
- `tests/site-link-citation.test.mjs`
- `tests/site-accessibility.test.mjs`
- `tests/site-visual.test.mjs`
- `tests/site-playwright.test.mjs`
- `tests/site-workflow.test.mjs`

### Modify

- [.github/workflows/deploy-web-mobile-pages.yml](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.github/workflows/deploy-web-mobile-pages.yml)
- [tests/github-pages-workflow.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/github-pages-workflow.test.mjs)
- [tests/verify-web-mobile-build.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/verify-web-mobile-build.test.mjs)
- [tests/audit-web-build.test.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/tests/audit-web-build.test.mjs)
- [scripts/run-h5-runtime-matrix.mjs](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/scripts/run-h5-runtime-matrix.mjs)
- [docs/project-overview-pdr.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/project-overview-pdr.md)
- [docs/compatibility-matrix.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/compatibility-matrix.md)
- [docs/system-architecture.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/system-architecture.md)
- [docs/cocos-creator-build-audit.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/docs/cocos-creator-build-audit.md)
- [README.md](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/README.md)
- [.gitignore](/Users/dan/Desktop/Development/cocos-games/pencil-blade-2026/.gitignore)

Note:

- If you want the launcher page to deep-link directly into gameplay state, that needs a separate game-side contract and test, not just a route change.

## Dependency Map

```text
docs/evidence + forensics
        |
        v
site/src/content/*.mdx ----> site/src/components/evidence-citation.astro
        |                                 |
        v                                 v
site/src/pages/case-studies/*      site/src/layouts/base.astro
        |                                 |
        v                                 v
site/src/pages/index.astro -----> site/src/pages/play/index.astro
                                           |
                                           v
                                     iframe /play/h5/
                                           |
                                           v
                         copied game/build/web-mobile-pages/
                                           |
                                           v
          scripts/audit-web-build.mjs + scripts/verify-web-mobile-build.mjs
                                           |
                                           v
                  scripts/build-pages-artifact.mjs + scripts/verify-pages-artifact.mjs
                                           |
                                           v
                         .github/workflows/deploy-web-mobile-pages.yml
```

The key dependency rule is simple:

- Content can reference the game mount by URL.
- The game must not depend on Astro runtime code.
- The final deploy job must depend on both outputs, but neither output should depend on the deploy job.

## Open Questions

1. Should `/play/` be only a launcher page, or should it also expose a lightweight stats/article panel beside the iframe?
2. Do you want the game mount to be `/play/h5/` exactly, or should `/play/game/` be the public mount with `/play/h5/` reserved for tests?
3. Should the merged artifact keep the current game-only verifier name, or should the final merged check get a new `verify-pages-artifact` wrapper and leave the current verifier untouched?

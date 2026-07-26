---
phase: 6
title: "Integrate Playable H5 Game Experience"
status: complete
priority: P1
dependencies: [1, 2, 3]
effort: "6-8 days"
---

# Phase 6: Integrate Playable H5 Game Experience

## Context Links

- [Case study plan](./plan.md)
- [Phase 1 publication contract](./phase-01-establish-public-narrative-and-evidence-contract.md)
- [Phase 2 Astro platform and content pipeline](./phase-02-build-astro-platform-and-content-pipeline.md)
- [Phase 5 AI Lab and evidence explorer](./phase-05-build-ai-lab-and-evidence-explorer.md)
- [Content evidence source map](./reports/content-evidence-source-map.md)
- [Editorial experience specification](./reports/editorial-experience-spec.md)
- [Site/H5/Pages architecture](./reports/site-h5-pages-architecture.md)
- [Compatibility matrix](../../docs/compatibility-matrix.md)
- [Reconstruction report](../../docs/reconstruction-report.md)
- [Release rights checklist](../../docs/release-rights-checklist.md)
- [Technical closeout](../../docs/journals/260725-1248-pencil-blade-technical-closeout.md)
- [Production Pages runtime matrix](../260721-2253-pencil-blade-restoration/reports/runtime-matrix/production-pages/production-pages-runtime.json)
- [Android runtime matrix](../260721-2253-pencil-blade-restoration/reports/runtime-matrix/android-runtime-matrix.json)
- [H5 runtime matrix](../260721-2253-pencil-blade-restoration/reports/runtime-matrix/h5-runtime-matrix.json)

## Overview

Integrate the playable H5 experience as an explicit, disclosure-first proof step. The game must remain
an independently built Cocos output, copied into the composed Pages artifact only after the user clicks
the play entry point. The launcher page owns the narrative, preflight, fullscreen affordance, screenshot
fallback, and verification bridge. It must not preload the game tree, autoplay audio, or mutate game
source on first pass.

The launch path is intentionally conservative: no localStorage.clear, no hidden preload, no anonymous
network fetches, no runtime claim beyond repo evidence, and no assumption that the game and site share
the same build lifecycle. The play route is a public demonstration shell around the audited H5 subtree.
Because GitHub Pages serves both documents from one origin, the iframe is lifecycle/performance
containment only and provides no security boundary.

## Key Insights

| Topic | Decision |
|---|---|
| Load model | Copy the audited H5 tree into the composed Pages artifact, then mount it only after explicit user action |
| Route shape | `/play/` is the launcher; `/pencil-blade-2026/play/game/` is the embedded game mount |
| Disclosure | Show size, runtime source, rights scope, and the original-runtime limitation before loading |
| Safety | No autoplay, no preloading, no localStorage.clear, no parent/top DOM coupling, no direct source editing as part of this phase |
| Fallback | Static screenshot, text summary, and verification notes must work when iframe or JS is unavailable |

## Functional Requirements

| ID | Requirement |
|---|---|
| F-1 | Render a `/play/` launcher page that explains what the user is about to load and why |
| F-2 | Mount the copied H5 build under `/pencil-blade-2026/play/game/` only after explicit user click |
| F-3 | Keep the game subtree isolated from the editorial shell; do not rewrite game internals unless a later verified audit requires it |
| F-4 | Provide a fullscreen control, screenshot fallback, and readable error state |
| F-5 | Disclose the loaded H5 tree size, frozen academic-waiver scope, and unresolved commercial rights before interaction |
| F-6 | Preserve touch and mouse gameplay; make launcher controls keyboard accessible without claiming the canvas itself is keyboard accessible |
| F-7 | Prevent autoplay and other eager media behavior on the launcher |
| F-8 | Ship no parent↔game bridge and verify the audited runtime does not access parent DOM, top navigation, opener, or site-owned state |
| F-9 | Support a direct-open fallback path for testing and verification |
| F-10 | Preserve the current default runtime prefix while allowing configurable prefix/runtime scripts |
| F-11 | Provide an alternative textual walkthrough and approved verified captures for visitors who cannot use the canvas |

## Non-functional Requirements

| ID | Requirement |
|---|---|
| N-1 | Launcher HTML must remain understandable with JavaScript disabled |
| N-2 | No game payload should be requested on initial site load |
| N-3 | Embedded experience must remain responsive at the supported desktop and mobile viewports |
| N-4 | No remote fonts, analytics, or third-party scripts at launch |
| N-5 | No localStorage.clear or global storage wipe is allowed |
| N-6 | Any screenshot or fallback copy must be public-safe and rights-scoped |
| N-7 | The play flow must not claim original-runtime identity or unobserved behavior |
| N-8 | The same composed artifact must work for local verification and Pages deployment |
| N-9 | Runtime audio, storage, resume visibility, geometry, fullscreen return, and network/error predicates are hard pass/fail assertions, never informational fields attached to `pass` |

## Architecture

```text
site shell /play/
   │
   ├─ static preflight, disclosure, fallback, fullscreen
   │
   └─ explicit user click
           │
           v
   iframe or direct-open launcher bridge
           │
           v
   copied audited H5 subtree at /pencil-blade-2026/play/game/
```

The launcher is a composition/disclosure boundary, not a security boundary. It may display the
audited H5 subtree, but it must not become a second build system for the game. The merged Pages
artifact remains a composition step, not a rebuild. The site stores no secrets or launch
localStorage; future site storage must use a reserved `pencil-blade-case-study:*` namespace and
pass a collision test against the game's existing keys.

## File Inventory

| Action | Path | Purpose | Test impact |
|---|---|---|---|
| Create | `site/src/pages/play/index.astro` | Play launcher page with disclosure and click-to-load flow | Route smoke, interaction smoke |
| Create | `site/src/pages/vi/play/index.astro` | Vietnamese launcher using the same build facts and controls | Locale/parity smoke |
| Create | `site/src/components/play/*.astro` | Preflight card, launcher controls, fullscreen button, fallback states | Accessibility and visual tests |
| Create | `site/src/components/play/*.ts` | Narrow frame lifecycle/fullscreen handlers; no bridge | Browser tests |
| Create | `site/src/data/play.ts` | Read-only projection of frozen H5 facts and the two rights references | Content smoke |
| Modify | `site/src/data/route-fragments/play.ts` | Domain-owned play and nested-mount route helpers | Route merge tests |
| Modify | `scripts/case-study-validation/play.mjs` | Domain-owned no-preload, parent-coupling, and two-rights-dimension rules | Negative fixtures |
| Modify | `scripts/verify-web-mobile-build.mjs` | Accept an explicit mount prefix while retaining `/pencil-blade-2026/` as the default | Prefix verifier tests |
| Modify | `scripts/run-h5-runtime-matrix.mjs` | Invocation-scoped config, explicit CI browser/module inputs, hard runtime assertions, total cleanup | Runtime matrix tests |
| Modify | `tests/verify-web-mobile-build.test.mjs` | Prove current root prefix and new nested prefix behave identically | Portable Node suite |
| Modify | `tests/runtime-matrix-runner.test.mjs` | Replace source-regex checks with behavioral CLI/config/failure fixtures or retire it in favor of the new suite | Portable Node suite |
| Create | `tests/play-launcher.test.mjs` | Click-to-load, no-preload, fallback, accessibility, no-bridge/coupling behavior | Browser/unit suite |
| Create | `tests/run-h5-runtime-matrix.test.mjs` | Behavioral CLI/options, cleanup, hard-failure, raw/direct and nested-mount contracts | Portable Node suite |

## Function And Interface Checklist

- [ ] `resolvePlayMount(prefix)` returns the nested game URL with exactly one Pages base.
- [ ] `buildPlayDisclosure(metadata)` derives published size/runtime plus separate academic-display
      and commercial-rights notices; authors cannot hand-copy these states.
- [ ] `shouldLoadGame(interactionState)` stays false until explicit user action.
- [ ] `renderFallbackState(reason)` exposes screenshot/text fallback when iframe fails.
- [ ] `toggleFullscreen(frame)` only affects the embedded game container.
- [ ] `verifyNoPreload(document)` confirms no eager game requests on initial render.
- [ ] `validatePlayRights(metadata)` requires both decision references and rejects any media/copy
      outside the exact academic scope without changing the commercial verdict.
- [ ] `createWebBuildVerificationConfig({ pagesPrefix, entryPath, buildDirectory })` normalizes
      and freezes one invocation-scoped config.
- [ ] `verifyWebMobileBuild(buildDirectory, config)`, `createPagesPrefixServer(audit, config,
      requests)`, `pagesUrlForPath(path, config)`, the private route mapper, negative-route
      checks, outside-prefix filter, result/report generator, and CLI all consume that config.
- [ ] `runH5RuntimeMatrix(options)` threads the same immutable config through `runViewport`,
      navigation, request filters, report output, and the server. The current prefix exists only
      as a public-entry default, never mutable module state.
- [ ] In CI mode, `runH5RuntimeMatrix` requires explicit build/prefix/entry/report/module inputs,
      resolves the Playwright-managed Chromium executable privately, and rejects all `/Users/...`
      or machine-default fallbacks. Public/tracked output records only Playwright package,
      Chromium revision/product/version, and platform—not the absolute executable path.
- [ ] Server creation/listen, Playwright import, browser launch, contexts, and pages share one
      nullable `try/finally` cleanup boundary so every partial initialization closes.
- [ ] Runtime row status is `pass` only when post-input audio is running/verified, the storage
      sentinel survives lifecycle, the resumed canvas is visible with correct geometry,
      fullscreen enter/exit returns correctly, and all error/request/bad-response sets are empty.
- [ ] Runtime evidence writes into a fresh sibling temporary directory, completes browser/server
      cleanup, writes JSON through temp-file + atomic rename, and promotes the whole report
      directory only after every row passes. Failure removes the temporary directory and cannot
      leave mixed-run screenshots or a plausible partial report.

## Implementation Steps

1. Freeze the launcher contract. Document the explicit click requirement, the `/play/` vs `/play/game/`
   route split, the no-preload rule, and the rights disclosure text before building components.
2. Define the artifact-boundary input expected from Phase 7: a previously audited raw Cocos tree
   will be mounted byte-for-byte at `/pencil-blade-2026/play/game/`. Do not copy build output into
   `site/src/` and do not change game source in this phase.
3. Build the launcher page with a static preflight state that shows the H5 tree size, runtime
   provenance, rights scope, and original-runtime limitation.
4. Add explicit user-driven load controls. The frame should stay unloaded until click or equivalent
   activation, and audio must never start before that click.
5. Add fallback states for iframe failure, blocked embedding, and JavaScript-disabled browsing.
   Reuse Phase 3's already-registered shared Play preview plus text proof; Phase 6 does not create
   or register new media and therefore does not contend with Phase 4's publication-manifest
   ownership.
6. Treat the same-origin iframe as lifecycle/performance containment with **no security
   isolation**. The child inherently has same-origin `window.parent` capability. Keep the parent
   secret-free/stateless, reserve a future site storage namespace, ship no bridge, audit for
   `parent`/`top`/`opener` coupling, and run a browser test that the game does not mutate parent
   DOM/navigation or collide with storage keys. If a later bridge is approved, it must use a
   versioned schema, exact origin/source checks, and a read-only allowlist first.
7. Replace module-global prefix behavior with one immutable invocation config and update every
   consumer: top-level verifier, server, URL mapper, private route inverse, negative routes,
   outside-prefix filter, runtime `runViewport`, navigation, report writer, both CLIs, all direct
   tests, and the workflow command. Preserve the old prefix only as the default when no option is
   passed. Add two simultaneous verifier runs with different prefixes to prove no shared state.
8. Define and test the exact CLI contracts:
   - `verify-web-mobile-build <build-dir> [--pages-prefix <prefix>] [--entry-path <path>]`;
   - `run-h5-runtime-matrix --build-dir <dir> --pages-prefix <prefix> --entry-path <path>
     --report-dir <dir> --playwright-module-dir <dir> [--browser-executable <path>] --ci`.
   Unknown/missing/invalid options exit non-zero with public-safe help.
9. Make the runtime gate behavioral. Assert audio after explicit input, storage persistence,
   page hide/show and resume canvas/geometry, iframe reload/removal, fullscreen enter/exit,
   orientation/viewport restoration, and zero console/page/request/bad-response errors. Add
   failure-injection fixtures for every predicate and for missing module/bad executable/browser
   launch failure; no row becomes `pass` unconditionally.
10. Put server/import/browser initialization under one cleanup boundary and verify no open handle
    remains after every injected failure.
11. Stage every report in a new sibling temporary directory. Keep screenshots and JSON private to
    that staging root until all assertions and cleanup succeed; atomically write the final JSON,
    then rename/promote the directory. Delete staging on any failure. Strip absolute build,
    module, report, home, and browser executable paths from the public schema; record only package/
    revision/product/version/platform identity.
12. Prove the untouched raw build
   can be served at both the existing default prefix and the nested mount because all discovered
   internal references remain relative and pass the strict raw audit.
13. Emit the new nested/launcher result as a separately versioned case-study runtime report.
    Never overwrite or reinterpret the historical reconstruction
    `h5-runtime-matrix.json`; fidelity/technical-closeout consumers stay unchanged.
14. Add play-specific validation for route shape, nested mount path, no eager requests, fullscreen
   behavior, and rights-scoped copy.
15. Re-run the raw game audit on the audited H5 subtree, then add a composed Pages smoke for `/play/`
   and `/play/game/`.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Game requests fire before explicit user click | Validation or browser smoke fails |
| Critical | `/play/` exposes raw game payload without disclosure or fallback | Validation fails |
| Critical | Launcher claims original-runtime identity or unverified behavior | Content validation fails |
| Critical | `localStorage.clear` or equivalent global wipe appears in launcher flow | Test fails |
| Critical | Runtime row says pass while audio is suspended, storage is lost, or resumed canvas is hidden | Runtime gate fails |
| Critical | Child mutates parent DOM/top navigation or site/game storage keys collide | Browser/security test fails |
| High | `/pencil-blade-2026/play/game/` mount path is wrong | Route/assembly test fails |
| High | Raw Cocos file references resolve at the old root but not the nested mount | Nested-prefix verifier fails |
| High | Two concurrent verifier invocations leak prefixes across each other | Config/concurrency test fails |
| High | Missing Playwright module/bad Chromium path leaves an open server or hangs | Failure fixture exits cleanly non-zero |
| High | Failed run leaves screenshots/JSON from mixed attempts or exposes an absolute executable path | Staging is removed; public report is absent |
| High | Iframe fullscreen control affects the wrong document or container | Interaction test fails |
| High | Launcher lacks screenshot/text fallback when embedding fails | Accessibility/browser smoke fails |
| Medium | Direct-open test path does not match composed Pages route | Verification test fails |
| Medium | Configurable prefix changes the default behavior | Route helper test fails |
| Medium | Public rights copy omits academic-scope qualifier | Content validation fails |

## Todo List

- [ ] Freeze play-route disclosure copy and no-preload rule.
- [ ] Implement the launcher page and fallback states.
- [ ] Define and test the audited H5 subtree input/mount contract consumed by Phase 7.
- [ ] Parameterize prefix verification and runtime-matrix inputs without changing the legacy defaults.
- [ ] Thread immutable config through every current helper/caller/CLI and add concurrent-prefix tests.
- [ ] Turn audio/storage/resume/fullscreen/network observations into hard pass predicates.
- [ ] Pin the Linux browser through the `site/` lockfile and remove machine defaults from CI.
- [ ] Make report-directory promotion atomic and tracked output free of absolute machine paths.
- [ ] Add fullscreen and direct-open controls.
- [ ] Add route and artifact verification for `/play/` and `/play/game/`.
- [ ] Keep the default prefix configurable without changing the current public URL.
- [ ] Confirm no game source changes are required for initial integration.

## Success Criteria

- [ ] A visitor sees clear play disclosure before the game loads.
- [ ] The game subtree loads only after explicit user action.
- [ ] The launcher works with touch/mouse gameplay, keyboard-operable launcher controls, and a
      JS-off direct-link/text/capture fallback; canvas accessibility limitations are explicit.
- [ ] No preload or autoplay behavior appears on the page.
- [ ] The composed Pages artifact exposes the correct nested mount path and current rights scope.
- [ ] The play route remains a proof surface, not a source rewrite.
- [ ] The legacy raw-H5 report remains immutable historical evidence; nested launcher runtime has
      its own schema/path/lifetime.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Play route preloads too much | Slow home page, wasted bandwidth | Explicit click-to-load and no eager request tests |
| Same-origin iframe is mistaken for a security sandbox | False isolation assumptions | Explicitly state no isolation; stateless parent; coupling/key-collision tests |
| Partial prefix parameterization | False pass or nested 404 | Immutable config threaded through every caller/helper and concurrent tests |
| CI browser dependency drifts to a workstation path | Linux hang/failure | Exact Node + locked site Playwright/Chromium + explicit CI paths + total cleanup |
| Failed runtime run looks like coherent evidence | False proof | Fresh temporary report root + cleanup-first atomic promotion |
| Route rewrite breaks nested mount | 404 or broken asset loading | Configurable prefix helpers and direct-open tests |
| Rights copy becomes overconfident | Legal/reputational harm | Fail-closed disclosure language and manifest binding |
| Fallback is ornamental instead of useful | Poor accessibility and trust | Screenshot/text fallback required in acceptance criteria |

## Security And Rights Considerations

- Do not expose APK, `libgame.so`, decompiler output, or raw analysis data in the play route.
- Do not autoplay audio or preload the H5 subtree before user intent.
- Do not clear localStorage or shared browser state as part of the launcher.
- Do not call the same-origin frame a security boundary. Audit and test parent/top/opener access;
  the site has no secrets/storage at launch.
- Do not add media outside the exact H5/runtime-capture academic waiver or project-authored set in
  the publication manifest.
- Keep every play-page media item within the current academic noncommercial rights scope.
- Treat the launcher as a disclosure boundary, not a permissions bypass.

## Rollback

This phase is reversible by removing the launcher page and helpers and reverting the configurable
verifier/runtime-matrix interfaces together with their tests. No nested build output is committed in
this phase. The currently deployed game-only Pages artifact remains live until Phase 8 approves
the Phase 7 candidate.

## Next Steps

Phase 7 should verify the immutable candidate end to end, including the editorial site, nested game
mount, launcher path, runtime rows, provenance, and protected deployment boundary.

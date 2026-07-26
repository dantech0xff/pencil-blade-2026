# Route/content graph research: reduce site to Home, Forensics, Play only

## Recommendation

Keep `Home`, `Forensics`, and `Play` in both `en` and `vi`. Defer or delete `Story`, `Reconstruction`, `AI Lab`, `Evidence`, and `About` only after removing their page routes, content entries, and shell links together. The route graph is centralized enough that these sections are not independent; nav/shell code still points at `/about/`, and chapter navigation still points across the removed chapter chain.

## Evidence

### Route owner map

- `site/src/data/routes.ts:185-209` is the source of truth for the public route graph. It currently merges `coreRouteFragment`, `chaptersRouteFragment`, `aiLabRouteFragment`, and `playRouteFragment`, and only requires `home.en` and `home.vi`.
- `site/src/data/route-fragments/chapters.ts:3-54` owns the three chapter pairs:
  - `story.en` / `story.vi`
  - `forensics.en` / `forensics.vi`
  - `reconstruction.en` / `reconstruction.vi`
- `site/src/data/route-fragments/play.ts:3-16` owns `play.en` / `play.vi`.
- `site/src/data/route-fragments/ai-lab.ts:3-52` owns `ai-lab`, `evidence`, and their detail routes in both locales.
- `site/src/data/locales.ts:1-13` hard-codes the bilingual set to `en` and `vi`, so scope reduction should keep locale parity for whatever remains.

### Home / chapter coupling

- `site/src/pages/index.astro:19-27` and `site/src/pages/vi/index.astro:19-27` are the English/Vietnamese home entries. Both are fixed to `routeId="home.en"` / `home.vi` and already present the three-step story the scope reduction wants to preserve.
- `site/src/pages/index.astro:36-42` and `site/src/pages/vi/index.astro:36-42` expose the home walk-through as three anchored sections, not as separate public routes.
- `site/src/pages/forensics/index.astro:24-44` and `site/src/pages/vi/forensics/index.astro:24-44` are the kept forensics route pair. Each page injects `ChapterPage` and passes `nextPath` to the removed reconstruction route, so this dependency must be cut if reconstruction is dropped.
- `site/src/pages/play/index.astro:12-37` and `site/src/pages/vi/play/index.astro:12-37` are self-contained and only depend on `data/play.ts` plus the play components.

### Shell coupling

- `site/src/components/shell/site-header.astro:17-29` hard-links the header to `/about/` and the locale switcher.
- `site/src/components/shell/site-footer.astro:12-21` also hard-links `/about/`.
- `site/src/components/shell/locale-switcher.astro:15-23` derives alternate locale paths from the current route, so route removals must preserve valid bilingual targets for the surviving pages.

### Content coupling

- `site/src/content/chapters/en/story.mdx:1-27` and `site/src/content/chapters/vi/story.mdx:1-27` define the story chapter pair. They are not needed if home absorbs the intro and the scope stays at three public sections.
- `site/src/content/chapters/en/forensics.mdx:1-27` and `site/src/content/chapters/vi/forensics.mdx:1-27` define the forensics chapter pair and should be preserved.
- `site/src/content/chapters/en/reconstruction.mdx:1-35` and `site/src/content/chapters/vi/reconstruction.mdx:1-35` define the reconstruction chapter pair. These are the clearest delete candidates because they are the third step after forensics and duplicate the “try the game” outcome already owned by `/play/`.

## Candidate deletions

1. `Story` chapter pages and content: likely delete if home keeps the intro narrative. Strong candidate because home already covers the three-step arc and `story` is not required by `play`.
2. `Reconstruction` chapter pages and content: strongest delete candidate. `play` already owns the playable proof, and `forensics` currently points forward to reconstruction only via `nextPath`.
3. `AI Lab`, `Evidence`, and detail routes: delete if the scope truly means only Home/Forensics/Play. These routes are orthogonal but not part of the requested three-section site.
4. `About` pages: delete only after removing header/footer links or replacing them with a different kept destination. As written, they are still shell-linked.

## Preserved dependencies

- Keep `site/src/data/routes.ts`, `site/src/data/locales.ts`, and `site/src/data/route-fragments/play.ts` unchanged unless the route graph itself is being rewritten.
- Keep `site/src/components/shell/locale-switcher.astro:15-23` and the locale paths for all remaining routes, because bilingual navigation is still part of the public contract.
- Keep `site/src/pages/forensics/index.astro:33-44` and `site/src/pages/vi/forensics/index.astro:33-44` if the chapter chain remains, but remove their `nextPath` handoff if reconstruction is removed.

## Bottom line

Best fit for the reduced scope is a three-route public surface: Home, Forensics, Play, each in `en` and `vi`. That keeps the current bilingual contract intact while eliminating the extra chapter chain and AI/evidence surface area that would otherwise remain half-alive.

Status: DONE
Summary: Mapped route ownership and coupling for a Home/Forensics/Play-only site; identified story, reconstruction, AI Lab, evidence, and about as delete candidates only if their page, content, and shell references are removed together.
Concerns/Blockers: `site/src/components/shell/site-header.astro:27-28` and `site/src/components/shell/site-footer.astro:19-21` still hard-link `/about/`, so about cannot be deleted without changing shell navigation too.

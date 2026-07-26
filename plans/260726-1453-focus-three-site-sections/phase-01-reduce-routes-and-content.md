# Phase 1: Reduce Routes and Content

## Context

- [Plan](./plan.md)
- [Route research](./research/researcher-01-routes.md)
- `docs/code-standards.md`

## Requirements

- Preserve Home, Forensics, and Play in EN/VI.
- Preserve `/play/game/` and the explicit-load launcher.
- Remove all other public page families and unused presentation-only dependencies.

## Files

- Modify `site/src/data/routes.ts` and retained page/shell components.
- Delete removed route entries under `site/src/pages/`.
- Delete removed content and components only when no retained consumer remains.
- Update content schema/config when a removed collection or enum is no longer used.

## Implementation

- [x] Limit the route registry and chapter sequence to Home, Forensics, and Play.
- [x] Remove Story, Reconstruction, AI Lab, Evidence Explorer, and About pages in both locales.
- [x] Remove shell links and next-page links targeting removed routes.
- [x] Remove orphaned content, data modules, components, scripts, and assets.
- [x] Confirm retained pages have no imports or URLs for removed sections.

## Validation

- [x] Run Astro type/check after the route graph compiles.
- [x] Search source for removed public URLs and stale page imports.

## Risks and Rollback

- Forensics uses shared evidence UI; retain claim data and drawer behavior unless proven
  orphaned.
- Roll back the phase as a single route/content slice if the retained Forensics page cannot
  build independently.

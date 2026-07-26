---
type: project-management
date: 2026-07-26
---

# Plan Complete: Focus the Public Site on Three Sections

## Summary

| Metric | Result |
|---|---|
| Phases | 2/2 complete |
| Public sections | Home, Forensics, Play |
| Locales | EN, VI |
| Direct game route | `/play/game/` retained |
| Focused Node tests | 105/105 pass |
| Browser tests | 42/42 pass |
| Astro diagnostics | 0 errors, 0 warnings, 0 hints |
| Production build | Pass |
| Code review | No remaining blockers |

## Achievements

- Removed Story, Reconstruction, AI Lab, Evidence Explorer, and About public routes.
- Kept source forensic evidence while removing unrelated public presentation surfaces.
- Added exact HTML and sitemap allowlists across release generation, candidate verification,
  and production smoke.
- Added mutation coverage for legacy routes, arbitrary routes, nested game HTML, and `.htm`
  bypasses.

## Documentation Updates

- `docs/case-study-editorial-policy.md`
- `docs/deployment.md`
- `docs/journals/260726-1535-focus-three-public-sections.md`

## Known Limitations

- Changes are verified locally but not deployed.

## Unresolved Questions

- None.

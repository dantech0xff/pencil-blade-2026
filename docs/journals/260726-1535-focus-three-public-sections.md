---
title: Focus Three Public Sections
date: 2026-07-26 15:35 +0700
severity: Medium
component: Public site routes and publication gates
status: Resolved
---

# Focus Three Public Sections

## Context

We cut the public Astro site down to the three intended flows: Home, Forensics, and Play. The visible surface is now EN/VI Home, EN/VI Forensics, EN/VI Play, plus the explicit `/play/game/` mount. The source forensic record is still preserved in-repo; we did not delete the evidence, only the public routes that used to expose extra narrative branches.

## What Happened

The old Story, Reconstruction, AI Lab, Evidence Explorer, and About route families were removed from the build, sitemap, release manifest, and navigation. The publication gates now use an exact allowlist and reject both named legacy routes and any arbitrary extras that slip into candidate files, sitemap URLs, or release metadata. That is the important part: the site is no longer “mostly narrowed.” It is actually constrained.

Verification finished with `105/105` focused Node tests after we closed the nested `play/game` HTML and `.htm` bypasses. The site also passed Astro `check` and `build`, the route/sitemap audit, and the earlier Playwright suite already stood at `42/42`. Deployment was not performed.

## Reflection

This was annoying in the exact way route-surface work usually is: the code looks simple, then the contracts spread out everywhere and punish any lazy assumption. The frustrating bit was not deleting pages. It was making the gates strict enough that a stray legacy route cannot sneak back in through a manifest or sitemap hole.

## Decisions Made

- Keep the public site to Home, Forensics, and Play only.
- Preserve source forensic evidence in the repository instead of publishing extra sections.
- Treat `/play/game/` as an explicit-load boundary, not a general navigation target.
- Enforce exact route membership instead of loose “contains the right pages” checks.

## Next Steps

- Keep the route allowlist and forbidden-route checks in sync with any future public-surface change.
- If deployment is resumed, rerun the same route, sitemap, and browser gates before approving release.

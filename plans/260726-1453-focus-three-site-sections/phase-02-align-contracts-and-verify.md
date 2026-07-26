# Phase 2: Align Contracts and Verify

## Context

- [Plan](./plan.md)
- [Phase 1](./phase-01-reduce-routes-and-content.md)

## Requirements

- Publication tooling must require exactly the retained route set.
- Tests must prove both retained routes and removed-route absence.
- Documentation must describe the new three-flow public scope.

## Files

- Modify route arrays in `scripts/generate-case-study-release-manifest.mjs`,
  `scripts/verify-case-study-pages.mjs`, and `scripts/run-case-study-production-smoke.mjs`.
- Update matching tests in `tests/` and `site/tests/`.
- Update `docs/case-study-editorial-policy.md` and `docs/deployment.md`.

## Implementation

- [x] Align release, verification, and smoke route contracts with the retained surface.
- [x] Define forbidden Story, Reconstruction, AI Lab, Evidence Explorer, and About route
      families and fail when they occur in candidate files, tree/release manifests, sitemap
      URLs, or deployed responses.
- [x] Remove obsolete chapter/AI/evidence/about assertions and add removed-route checks.
- [x] Update browser journeys and accessibility coverage for Home, Forensics, and Play.
- [x] Update user-visible route and deployment documentation.
- [x] Build and inspect the exact generated route/sitemap set.

## Validation

- [x] Run focused Node tests for route/release/verifier behavior.
- [x] Run mutation tests proving each publication gate rejects a reintroduced forbidden route.
- [x] Run `npm run check` and `npm run build` in `site/`.
- [x] Run relevant Playwright tests.
- [x] Verify removed route directories are absent from `site/dist/`.

## Risks and Rollback

- Release manifest changes intentionally break the previous broad public-route contract.
- If production smoke behavior changes beyond route membership, restore the script logic and
  narrow only its required-route constant.

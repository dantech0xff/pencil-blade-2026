# Pencil Blade Case Study Launch QA Report

Status: **released and production-verified** on 2026-07-26.

## Release Identity

| Item | Verified value |
|---|---|
| Production URL | <https://dantech0xff.github.io/pencil-blade-2026/> |
| Candidate commit | `10851abb9499a439c099bc427fffe165c54840e1` |
| Workflow run | [`30190536530`](https://github.com/dantech0xff/pencil-blade-2026/actions/runs/30190536530), attempt `1` |
| Candidate artifact | `case-study-candidate-30190536530-1` |
| Approval request | `case-study-approval-f2a57de46e2d0a49` |
| Content-tree digest | `f8951b611c2edf86ebeb209075378df7088cb691657016cbe669580bf1b88419` |
| Tree-manifest digest | `a410f6d9fe3a16a75621bd2a0edc591c58009a40ffd09b6aefe35a7788372821` |
| Deployment | `5607847060`, state `success` |
| Production tree | `2,668` files; `43,622,567` bytes verified |
| Raw game input | `2,539` files; `39,613,694` bytes; digest `90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54` |
| Site input | `128` files; `4,001,746` bytes; digest `10e37146a45355cfef9bb8829e2737e345929e19703602d3de411216e5aaa593` |

The live `case-study-release.json`, downloaded candidate, approval request, authenticated
approval evidence, GitHub deployment, and production-smoke report all matched this identity.
A separate direct HTTP check returned `200` and the production About page contained the confirmed
sole-owner review and GitHub Issues correction channel with no draft label.

## Approval

The repository has one accountable project owner and no independent launch reviewer. The owner
explicitly selected the tracked `solo-owner-self-review` policy. GitHub authenticated
`dantech0xff` as the `github-pages` environment reviewer at
`2026-07-26T06:20:16.360Z`; the approval was bound to the request, candidate, commit, and both
digests above.

Under that disclosed policy, `dantech0xff` completed the owner, editorial, Vietnamese factual,
rights/attribution, accessibility, and performance checks. This is a sole-owner sign-off and is
not represented as independent review. GitHub Issues is the confirmed public correction channel.

Repository controls were verified through the GitHub API:

- Pages build type is `workflow`, HTTPS is enforced, and no custom domain is configured.
- `github-pages` accepts protected branches only and requires reviewer `dantech0xff`;
  `prevent_self_review` is `false`.
- `main` enforces administrators, linear history, conversation resolution, and disables force
  pushes and deletion.

## Validation

- Local release-source verification: publication snapshot valid; `104` relevant Node tests
  passed; Astro check reported `0` diagnostics; Astro generated `107` pages; `52` Playwright/axe
  launch checks passed.
- Workflow run `30190536530`: raw Cocos build/audit, deterministic site build, immutable
  composition/audit, protected Pages deployment, authenticated approval evidence, and
  production smoke all completed successfully.
- Raw and nested H5 runtime matrices: `pass` at `480x800` and `720x1280`; input, audio, storage,
  background/resume, fullscreen, orientation, offline, and geometry assertions passed with no
  console errors, page errors, request failures, bad responses, or unexpected requests.
- Candidate smoke: all `17` required routes, all `2,668` files, and all `43,622,567` bytes
  verified before publication.
- Production smoke: the same `17` routes, `2,668` files, and `43,622,567` bytes verified after
  deployment. Launcher no-preload, activation, parent integrity, storage preservation, iframe
  reload/removal, embedded-game, and direct-game journeys all passed at both viewports.
- Non-play routes and the unopened `/play/` launcher issued no game requests.
- No analytics, tracker, custom domain, remote font, backend, database, or parent↔game
  `postMessage` bridge shipped.

## Live Lighthouse Measurement

Lighthouse `13.4.1` was run against the final production release:

| Route | Performance | Accessibility | Best Practices | SEO | FCP | LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | 100 | 100 | 100 | 92 | 1.1 s | 1.1 s | 0 | 0 ms |
| `/play/` | 100 | 100 | 100 | 92 | 0.8 s | 0.8 s | 0 | 0 ms |

The only failed weighted SEO audit was Lighthouse's origin-root `robots.txt` diagnostic:
Chrome reported a CSP violation while Lighthouse tried to load the GitHub user-site origin root.
This project is hosted at `/pencil-blade-2026/`, where its project-owned `robots.txt`, sitemap,
canonical URLs, reciprocal `hreflang`, metadata, and crawlability checks passed. Controlling the
origin-root file would require the explicitly deferred custom-domain or user-site scope. The
launch therefore records SEO `92` as a GitHub Project Pages measurement limitation instead of
weakening CSP or silently changing the no-custom-domain decision.

## Rights and Release Boundaries

- The release remains the owner-approved academic, noncommercial case study.
- The exact audited H5 tree and project-authored capture scope remain bound to the frozen
  academic display decision.
- Commercial distribution status is unchanged and fail-closed.
- The public copy retains the clean-room, static-only, unofficial, original-runtime-unobserved,
  and source-recovery limitations.
- No APK, native binary, raw decompiler output, private evidence path, or unapproved recovered
  asset was added to the public tree.

## Conclusion

All hard build, content, rights, accessibility, runtime, immutable-candidate, authenticated
approval, deployment, and production-byte gates passed. The release is complete with one
documented non-blocking measurement exception: Lighthouse SEO `92` on GitHub Project Pages due
to the origin-root robots diagnostic. No unresolved launch blocker remains.

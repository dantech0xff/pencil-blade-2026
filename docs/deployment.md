# GitHub Pages Deployment

## Production

| Item | Value |
|---|---|
| Platform | GitHub Pages |
| URL | <https://dantech0xff.github.io/pencil-blade-2026/> |
| Source branch | Protected `main` |
| Workflow | [`.github/workflows/deploy-web-mobile-pages.yml`](../.github/workflows/deploy-web-mobile-pages.yml) |
| Environment | Protected `github-pages` |
| Runtime configuration | Static site; no runtime environment variables or secrets |

The public site is the owner-approved academic, noncommercial release. Deployment does not
change the separate commercial-rights state recorded in
[`release/public-release-variant-manifest.json`](../release/public-release-variant-manifest.json).

## Prerequisites

- GitHub Pages must use GitHub Actions as its build source.
- `main` must remain protected.
- The `github-pages` environment must allow only protected branches and require the
  repository owner `dantech0xff`. The current solo-owner policy permits that authenticated
  owner to review their own deployment.
- The repository-scoped self-hosted runner must be online with labels `self-hosted`, `macOS`,
  `ARM64`, and `cocos-creator-3.8.8`.
- Cocos Creator `3.8.8` must match the executable SHA-256 pinned in
  [`reference/case-study-build-toolchain.json`](../reference/case-study-build-toolchain.json).
- Node, npm, Playwright, package locks, workflow actions, and build configuration must match
  the same tracked toolchain record.

The workflow uses the short-lived GitHub Actions token supplied by GitHub. It requires no
repository secret, deploy key, `.env` file, database, or production runtime variable.

## Deploy

Dispatch the workflow manually from protected `main`:

```bash
gh workflow run deploy-web-mobile-pages.yml --ref main
```

Follow the run until `Compose and audit immutable Pages candidate` succeeds. Before approving,
download and inspect these run-scoped artifacts:

- `case-study-approval-<run-id>-<candidate-attempt>`
- `case-study-qa-<run-id>-<candidate-attempt>`
- `case-study-candidate-<run-id>-<candidate-attempt>`

The approval request, QA report, and candidate release record must agree on the commit SHA,
workflow run/attempt, content-tree digest, tree-manifest digest, and candidate artifact name.
The candidate smoke and both raw/nested H5 runtime rows must report `pass`.

Approve the pending `github-pages` deployment as the authenticated repository owner. Record
`solo-owner-self-review` in the approval comment together with the request ID, candidate name,
commit SHA, and both digests. Do not approve a different or unverified artifact.

The remaining workflow jobs must all succeed:

1. `Deploy protected Pages candidate`
2. `Record authenticated environment approval`
3. `Verify deployed bytes and launch journeys`

The last job verifies every manifest-listed production file, all required English and
Vietnamese routes, launcher isolation, iframe load/reload/removal, storage preservation, and
direct plus embedded game canvases at `480x800` and `720x1280`.

The required public route set is `/`, `/forensics/`, `/play/`, `/vi/`,
`/vi/forensics/`, `/vi/play/`, and `/play/game/`. Candidate, sitemap, release-manifest,
tree-manifest, and live-production checks fail if Story, Reconstruction, AI Lab, Evidence
Explorer, or About routes reappear in either locale.

## Verify

The workflow uploads two final nondeployable evidence artifacts:

- `deployment-approval-evidence-<run-id>-<attempt>`
- `case-study-production-smoke-<run-id>-<attempt>`

The approval evidence must show `authorizationMode: "solo-owner-self-review"`, an approved
review, a successful deployment, and the expected production URL. The production report must
show `status: "pass"` and the same identity as the approved candidate.

Independent reachability and identity checks:

```bash
curl -fsSI https://dantech0xff.github.io/pencil-blade-2026/
curl -fsS https://dantech0xff.github.io/pencil-blade-2026/case-study-release.json
```

The release record on the live site is authoritative for the deployed commit, workflow run,
content digest, input-tree digests, route list, and frozen toolchain.

## Rollback

The workflow deploys only the exact candidate built from protected `main`; it does not accept
an arbitrary local directory. To roll back:

1. Identify the last known-good deployed commit from its production-smoke evidence.
2. Revert the faulty change on `main` with a normal reviewable commit. Do not force-push or
   rewrite protected history.
3. Push `main`, dispatch a new deployment, review the new candidate and digests, then approve
   it through the same protected environment.
4. Require the new production-smoke job to pass before declaring rollback complete.

If only a post-deploy transient provider check failed and the candidate is unchanged, rerun
the failed jobs in the same workflow run. The workflow keeps the immutable candidate attempt
identity. Any source or workflow change requires a new commit and a new full deployment.

## Troubleshooting

| Symptom | Action |
|---|---|
| Raw H5 job is queued | Confirm the repository runner service is online, idle, and has all four required labels. |
| Creator preflight fails | Restore the exact Creator `3.8.8` executable and verify its pinned SHA-256; do not weaken the check. |
| Candidate composition fails | Inspect the site/raw-game artifact identities and the candidate audit; rerun the full workflow after fixing source. |
| Deployment waits indefinitely | Check the pending `github-pages` environment review and verify the current user is the configured reviewer. |
| Production returns transient `429`, `502`, `503`, or `504` | The smoke test retries those responses four times with bounded backoff. Rerun failed jobs if the immutable candidate is unchanged. |
| Production smoke still fails | Treat persistent HTTP, MIME, byte, digest, route, console, request, or browser-journey errors as release failures. Fix the cause and deploy a new candidate. |

Use the GitHub Actions run as the primary log. Keep approval, QA, approval-evidence, and
production-smoke artifacts together by run ID; they are intentionally excluded from the
published Pages tree.

## Current Verified Release

Run [`30195473067`](https://github.com/dantech0xff/pencil-blade-2026/actions/runs/30195473067),
attempt `1`, deployed commit `7e73a2712b15401808c545a76a1de6218da0fa8a` as deployment
`5608809377`. Production verification passed `2,560` files and `40,243,610` bytes, including
all required routes and both embedded/direct browser journeys at both supported viewports.
Authenticated environment evidence records reviewer `dantech0xff` under
`solo-owner-self-review`; the run retains the candidate, approval request, QA, approval
evidence, and production-smoke artifacts under the same run ID.

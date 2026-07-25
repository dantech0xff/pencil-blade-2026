# GitHub Infrastructure Checkpoint

Captured: `2026-07-25T12:16:46+07:00`

Repository: `dantech0xff/pencil-blade-2026`

## Verified GitHub state

The GitHub REST API and local service state were queried after authenticating `gh` through the
macOS keyring.

| Gate | Verified state |
|---|---|
| Repository | Public; default branch `main`; authenticated actor has admin permission |
| `main` protection | Enabled and enforced for administrators |
| Pull-request boundary | Required; zero approvals because this is a single-owner repository |
| History and review hygiene | Linear history and resolved conversations required |
| Destructive branch operations | Force pushes and branch deletion disabled |
| Actions runner | Repository-scoped runner ID `2`, name `pencil-blade-macbookpro-arm64`, version `2.336.0`; online and idle at the captured API checkpoint |
| Runner labels | `self-hosted`, `macOS`, `ARM64`, `cocos-creator-3.8.8` |
| Runner service | LaunchAgent installed, enabled, and active under the local user |
| Pages site | Absent; Pages API returns `404` |
| Environments | Zero; `github-pages` has not been created |
| Deployment workflow | Active, manual-only workflow ID `320010269` |

The runner was installed from the official
`actions/runner` release `v2.336.0`. The downloaded macOS ARM64 archive matched GitHub's
published SHA-256:

```text
8e8839c49b7060b6b2154f4931f815df330c27f167d53ef2239ee3dfce28b079
```

No registration token or runner credential is stored in the repository or this report.

## Creator runner preflight

| Check | Result |
|---|---|
| Creator executable | Present at the pinned path |
| `CFBundleShortVersionString` | `3.8.8` |
| GNU tar | `1.35` |
| Node | `v22.21.0` |
| Creator strict code-signature validation | **FAIL** |

The workflow version probe was corrected from `defaults read` to deterministic `plutil`
extraction and its focused tests pass. Cocos Dashboard `2.2.1` then reinstalled Creator
`3.8.8` from its official version catalog. The freshly installed, never-launched bundle still
fails:

```text
/Applications/Cocos/Creator/3.8.8/CocosCreator.app: invalid signature
(code or signature have been modified)
In architecture: arm64
```

The fresh binary SHA-256 is
`3a8452496c03e85f2784e64679a1fd203701b0b245125efee02c7923f2bd3464`.
Its embedded signature metadata reports identifier `com.cocos.creator`, team
`NQ596S94Q5`, and full candidate CD hash
`0a3dae9d9f87f61d96d379b00c86ebf2ba0cf9df8fbfe40449700d834c24b88c`,
but those metadata values do not make an invalid signature trustworthy.

Therefore the repository-scoped runner registration, labels, service, and required tool versions
are configured, but the checklist item **Protected Creator 3.8.8 self-hosted runner ready**
remains open. Dispatch would fail at the intentional signature gate, so no workflow was
dispatched.

### Final-review availability incident

During final review the runner REST endpoint first reported the runner offline while the runner
log showed repeated `500 InternalServerError` responses from
`broker.actions.githubusercontent.com`. The LaunchAgent remained active but its listener was
stuck in the broker request. A scoped `launchctl kickstart -k` created a fresh listener session;
the local diagnostic log then recorded `Session created` and `Listening for Jobs` at
`2026-07-25T19:50:11+07:00`. Subsequent runner REST reads returned GitHub `502`/`504`, so the
post-recovery state was temporarily unavailable. A final REST read at
`2026-07-25T20:02:22+07:00` confirmed runner ID `2` online, idle, and carrying the exact four
labels. The runner-ready check therefore remains open only on the deterministic signature
failure.

## Verification

- `node --test --test-concurrency=1 tests/*.mjs`: `192/192` pass.
- `node --test --test-concurrency=1 tests/reconstruction/vertical-slice/*.test.ts`:
  `1568/1568` pass; combined Node coverage is `1760/1760`.
- The isolated `TERM during Creator` regression: `1/1` pass. An earlier concurrent full-suite
  attempt reached the test's 15-second timeout under load; the bounded sequential rerun removed
  that scheduling ambiguity.
- Creator-bundled strict TypeScript: pass with zero diagnostics.
- Workflow Creator version probe: `3.8.8`.
- Strict Creator signature probe: fail with the error recorded above.

## Fail-closed decisions

- `github-pages` environment and Pages source remain unconfigured because the plan requires
  public-rights approval first.
- No Pages artifact was uploaded and no production deployment was attempted.
- The user confirmed that no external offline APK backups exist. The backup checksum checklist
  item remains open; absence is documented rather than replaced by two same-disk copies.

## Unresolved questions

- Will the project owner accept a separately reviewed exact-bundle hash pin as the runner
  trust control, or require a Cocos-distributed bundle that passes macOS signature validation?
- What rights evidence and accountable approval apply to code, images, audio, fonts, game
  identity, and Cocos Web runtime?
- What is the authorized public treatment of `Fonts/CooperBlackStd.otf`?

# Release Rights Checklist

## Current Verdict

**Public Web release blocked.**

This checklist mirrors [`release/public-release-variant-manifest.json`](../release/public-release-variant-manifest.json) and keeps the fail-closed release gate explicit.

The GitHub repository was verified as public on 2026-07-24. That existing repository
visibility is not rights evidence and does not authorize a Pages deployment. The gate below
prevents creating the additional public H5 distribution surface; it does not retroactively
make already-published repository content private.

## Current Records

| Record | Category | Current rights state | Current release state |
|---|---|---|---|
| `clean-room-source` | Code | `unreviewed` | `not ship-ready` |
| `recovered-png-assets` | Graphics, 784 entries | `unresolved` | `not ship-ready` |
| `recovered-audio-assets` | Audio, 62 entries | `unresolved` | `not ship-ready` |
| `recovered-font-assets` | Fonts, 16 entries | `unresolved` | `not ship-ready` |
| `pencil-blade-identity` | Name / trademark, 1 identity | `unresolved` | `not ship-ready` |
| `cocos-generated-web-runtime` | Engine runtime | `unreviewed` | `not ship-ready` |

## Approval Requirements

Every included record needs all of the following before it can be marked ship-ready:

- exact included scope and origin
- `rightsStatus: approved`
- named license or permission basis
- at least one safe repository-relative evidence file
- accountable approver
- valid `YYYY-MM-DD` approval date
- `shipReady: true`
- explicit treatment of modifications, attribution, notices, trademarks, and distribution channel where applicable

The overall release decision also needs a separately approved manifest-level verdict. Record-level approval is not enough by itself.

## Evidence Rules

- Use [`scripts/verify-release-rights.mjs`](../scripts/verify-release-rights.mjs) as the enforcement gate.
- The current manifest requires all six categories plus a separately approved overall decision.
- The enforcement script rejects any non-empty `releaseExceptions.pending` array and validates approval dates as real calendar dates, not just `YYYY-MM-DD` strings.
- The recovered reconstruction manifest remains a preservation record, not a shipping approval, even if a future public variant is created.
- Any omission, replacement, font conversion, asset substitution, or identity change requires an explicit user decision and a versioned public-variant record.
- The public-variant manifest currently has no approved release exception. Its only pending
  exception decision is the release treatment for `Fonts/CooperBlackStd.otf`.
- Rights approval never increases recovered fidelity.

## Special Notes

| Item | Current treatment |
|---|---|
| `Fonts/CooperBlackStd.otf` | Byte-preserved but unsupported; it needs an explicit release decision. |
| Approved release exceptions | None. The manifest's `releaseExceptions.approved` list is empty. |
| Public Pages deployment | Blocked until the public release variant is approved. |
| Clean-room source | Still unreviewed for public distribution purposes. |
| Cocos-generated Web runtime | Unreviewed; engine runtime is not implicitly cleared by technical build success. |

## Required Decision Flow

1. Keep the release manifest blocked until every included record has documented approval.
2. Attach evidence files for each approval, not just a generic statement.
3. Record the approver and approval date at the manifest level and for each included record when required.
4. Re-run `scripts/verify-release-rights.mjs` against the approved manifest.
5. Only then allow the Pages deploy job to consume the artifact.

## Current Blockers

- rights evidence is missing for the recovered art, audio, fonts, and identity
- the overall public decision is blocked
- the public Pages deployment has not been approved
- `CooperBlackStd.otf` still lacks an authorized release treatment
- the public repository itself does not supply or replace any missing license evidence

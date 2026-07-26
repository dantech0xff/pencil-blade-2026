# Phase 1 Test Report

Date: 2026-07-26
Scope: README runtime media capture registration, publication/content validation, exact-byte derivative checks
Retest status: PASS

## Checks Run

- `node --test --test-name-pattern "Phase 1 loader validates and returns the reviewed publication manifest" tests/generate-case-study-data.test.mjs`
- `node --check scripts/capture-readme-gallery.mjs`
- `node --check scripts/validate-case-study-publication.mjs`
- `node --check scripts/validate-case-study-content.mjs`
- `node scripts/validate-case-study-publication.mjs --manifest reference/case-study-publication-manifest.json --verify-snapshot`
- `node --test tests/case-study-content.test.mjs`
- `node --test tests/generate-case-study-data.test.mjs tests/case-study-publication-policy.test.mjs tests/case-study-content.test.mjs`
- `shasum -a 256 ...` on the capture manifest, 3 report PNGs, 3 runtime PNGs, hero SVG, hero PNG
- `sips -g pixelWidth -g pixelHeight ...` on the 3 report PNGs, 3 runtime PNGs, hero PNG
- `file site/public/social/pencil-blade-en.svg`
- `git diff --check`

## Evidence

- Audited H5 identity matched the decision record: `2539` files, `39613694` bytes, tree digest `90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54`.
- Capture manifest hash matched `reference/case-study-academic-display-decision.json`.
- Capture gallery test now proves containment, traversal rejection, symlink rejection, off-origin HTTP abort, WebSocket blocking, and exactly-one `RecoveredAppShellController`.
- 3 report captures checked.
- 3 display derivatives checked.
- 3 exact-byte pairs matched by SHA-256.
- All 6 PNGs in the capture/derivative set were `720x1280`.
- Both raw and derivative `en`/`vi` alt texts for the Classic-ready media now say `one strawberry in play`.
- Hero PNG was `1200x630`.
- Hero SVG SHA-256 matched manifest and showed no external `href`, `xlink:href`, or `script` references.
- `release/public-release-variant-manifest.json` stayed blocked and unchanged by validation.

## Results

- `node --check`: 3/3 passed.
- Publication validator: 1/1 passed.
- Content validator suite: 1/1 passed.
- Targeted manifestVersion subtest: 1/1 passed.
- Capture gallery test file: 6/6 passed.
- Full Node test suite: 37/37 passed.
- Hash/dimension checks: 8/8 SHA-256 checks passed, 7/7 dimension checks passed.
- `git diff --check`: passed.

## Remediation Status

- P1 output containment: PASS
- P1 off-origin/network blocking: PASS
- P2 controller-state proof: PASS
- P2 Classic-ready alt text: PASS

## Notes

- No capture runner was rerun.
- No implementation or generated media files were modified by this test pass.

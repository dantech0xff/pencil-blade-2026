# Phase 2 Test Report

Date: 2026-07-26
Scope: README publication/content/build verification, source-catalog hash/link closure, gallery media checks
Retest status: PASS
Remediation status: PASS

## Checks Run

- `node scripts/validate-case-study-publication.mjs --manifest reference/case-study-publication-manifest.json --verify-snapshot`
- `node scripts/validate-case-study-content.mjs`
- `npm --prefix site run build`
- `node --test tests/generate-case-study-data.test.mjs tests/case-study-publication-policy.test.mjs tests/case-study-content.test.mjs tests/capture-readme-gallery.test.mjs`
- `git diff --check`
- README hash/link/media audit via `node -e ...`

## Evidence

- `README.md` SHA-256 matched `SRC-PUBLIC-README` in `reference/case-study-public-source-catalog.json`.
- README line 4 hero alt matched `MEDIA-SOCIAL-EN-PNG`.
- README line 41 Main Menu alt matched `MEDIA-CHAPTER-RUNTIME-720-MAIN-MENU`.
- `SRC-PUBLIC-README` sanitized excerpt no longer says `unofficial` inside its `lineRange` `1-34`.
- README local destinations were all present in the source-catalog `transitiveLinks` set.
- No README local destination hit denied/private/machine-local patterns.
- Gallery files existed at the exact repo-relative paths used by README:
  - `site/public/social/pencil-blade-en.png`
  - `site/src/assets/media/runtime/readme-720-mode-select-settled.png`
  - `site/src/assets/media/runtime/readme-720-classic-ready.png`
  - `site/src/assets/media/runtime/readme-720-classic-action.png`
- Gallery media hashes matched the publication manifest records.
- README legal language includes the required bounded statements: unofficial, noncommercial, source-available, not OSI open source, original APK never executed or embedded, no historical identity claim, and commercial release remains blocked.
- Publication manifest release decision stayed `blocked`.

## Results

- Publication validator: 1/1 passed.
- Content validator: 1/1 passed.
- Site build: passed.
- Focused Node suite: 43/43 passed.
- `git diff --check`: passed.
- README hash/link/media audit: passed.

## Notes

- No implementation or media file was modified by this retest.
- The site build reran `prepare:data`, `validate:content`, and `astro build` successfully.

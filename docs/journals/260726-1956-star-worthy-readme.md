---
date: 2026-07-26
session: star-worthy-readme
---

# Journal: 2026-07-26 - Star-Worthy README

## Context
We turned the README into an English-first landing page for the Pencil Blade reconstruction without changing gameplay, routes, or the blocked commercial-release state. The job was mostly discipline: make the page sharper and more convincing without slipping into fantasy, especially around provenance and rights.

## What Happened
- Rebuilt the hero around an evidence-first visual direction: clear CTA hierarchy, proof points, and a runtime gallery that reads on GitHub instead of looking like marketing sludge.
- Bound the gallery to exact-byte README capture derivatives and their recorded source hashes, not loose screenshots or ad hoc exports.
- Expanded the academic-display decision explicitly for the three README runtime captures while keeping the commercial verdict blocked and separate.
- Tightened the copy around contract-bound accessibility and legal limits: source-available, noncommercial, not OSI open source, original APK never executed or embedded, no historical-identity claim.
- Review found and we fixed state/origin/output-path hardening in the capture pipeline, plus the controller-state and alt-text gaps that would have made the provenance story dishonest.

## Reflection
The frustrating part was how easy it would have been to make the page look complete while quietly weakening the evidence trail. We did not have a design problem; we had a truthfulness problem. The README only works because every visual claim is tied back to a manifest entry, and every rights claim stays bounded instead of bleeding into commercial clearance.

## Decisions
| Decision | Rationale | Impact |
|---|---|---|
| English-first README | Better GitHub scanability and contributor reach | More direct landing page, less local-first friction |
| Exact-byte derivative gallery | Preserves capture provenance and avoids fake polish | Public images remain auditable |
| Separate academic expansion from commercial rights | Owner-approved display scope is not a license | README can show the captures without implying release rights |
| Keep accessibility copy contract-bound | Alt/caption text must match the registered media meaning | Reduced drift between visual and textual claims |

## Next
- Keep the blocked commercial manifest untouched.
- Leave the P3 CDP detach diagnostic as a follow-up; it is annoying, but it is not a landing blocker.
- If the README changes again, re-run the publication/content/build gates and re-check the hash/link closure before shipping.

Status: DONE
Summary: README, media provenance, academic-display scope, and rights language are now aligned and verified; the page is sharper without pretending the project has rights it does not have.
Concerns: One nonblocking P3 remains in capture teardown: CDP detach can still replace the original input failure in a dual-error path.

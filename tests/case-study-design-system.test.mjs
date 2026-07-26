import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { buildEditorialCsp, hashInlineScript } from "../site/src/lib/editorial-csp.ts";
import { serializeJsonLd } from "../site/src/lib/serialize-json-ld.ts";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("design tokens freeze the reviewed evidence palette and interaction sizes", async () => {
  const tokens = await read("site/src/styles/tokens.css");
  const global = await read("site/src/styles/global.css");
  const expected = [
    "#f4f0e6", "#e5ded0", "#171a18", "#515750", "#16211e",
    "#f2c94c", "#1b6b4b", "#006c7a", "#8a4b00", "#a13a2b",
  ];
  expected.forEach((token) => assert.match(tokens.toLowerCase(), new RegExp(token)));
  assert.match(global, /min-height:\s*2\.75rem/u);
});

test("editorial styles use no gradients, glow, custom cursor, or remote fonts", async () => {
  const paths = [
    "site/src/styles/tokens.css",
    "site/src/styles/global.css",
    "site/src/styles/editorial.css",
    "site/src/styles/motion.css",
    "site/src/styles/print.css",
  ];
  const source = (await Promise.all(paths.map(read))).join("\n").toLowerCase();
  assert.doesNotMatch(source, /gradient\s*\(|text-shadow|cursor:\s*(?:url|none)/u);
  assert.doesNotMatch(source, /@import\s+url|https?:\/\//u);
});

test("JSON-LD serialization rejects strings and escapes script-sensitive characters", () => {
  assert.throws(() => serializeJsonLd("</script>"), /structured data/u);
  const payload = serializeJsonLd({ value: "</script>&>\u2028\u2029" });
  assert.equal(payload.includes("<"), false);
  assert.equal(payload.includes(">"), false);
  assert.equal(payload.includes("&"), false);
  assert.match(payload, /\\u003c\/script\\u003e\\u0026\\u003e\\u2028\\u2029/u);
});

test("editorial CSP grants frame capability only to localized Play routes", () => {
  const hash = hashInlineScript("{}");
  const home = buildEditorialCsp("/", [hash]);
  const play = buildEditorialCsp("/play/", [hash]);
  const viPlay = buildEditorialCsp("/vi/play/", [hash]);
  for (const csp of [home, play, viPlay]) {
    assert.match(csp, /default-src 'self'/u);
    assert.match(csp, /object-src 'none'/u);
    assert.match(csp, /connect-src 'none'/u);
    assert.match(csp, /form-action 'none'/u);
    assert.match(csp, new RegExp(hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(home, /frame-src 'none'/u);
  assert.match(play, /frame-src 'self'/u);
  assert.match(viPlay, /frame-src 'self'/u);
});

test("all new publication media bytes match their exact manifest records", async () => {
  const manifest = JSON.parse(await read("reference/case-study-publication-manifest.json"));
  const records = manifest.media.filter((record) => record.provenance?.path?.startsWith("site/"));
  const expectedDesignMedia = new Set([
    "MEDIA-BRAND-CASE-STUDY-MARK",
    "MEDIA-BRAND-LAB-LINEWORK",
    "MEDIA-PLAY-PREVIEW-SHARED",
    "MEDIA-FAVICON-SVG",
    "MEDIA-SOCIAL-EN-SVG",
    "MEDIA-SOCIAL-VI-SVG",
    "MEDIA-SOCIAL-EN-PNG",
    "MEDIA-SOCIAL-VI-PNG",
  ]);
  assert.ok(
    [...expectedDesignMedia].every((mediaId) =>
      records.some((record) => record.mediaId === mediaId)),
  );
  for (const record of records) {
    const bytes = await readFile(resolve(root, record.provenance.path));
    assert.equal(sha256(bytes), record.provenance.sha256, record.mediaId);
    assert.equal(record.publishable, true);
    assert.ok(record.provenance.width > 0);
    assert.ok(record.provenance.height > 0);
    assert.ok(record.academicDisplayDecisionRef);
    assert.ok(record.commercialRightsRecordRef);
  }
});

test("project-authored SVG assets are script-free and self-contained", async () => {
  const manifest = JSON.parse(await read("reference/case-study-publication-manifest.json"));
  const svgRecords = manifest.media.filter((record) =>
    record.provenance?.path?.startsWith("site/") && record.provenance.path.endsWith(".svg")
  );
  for (const record of svgRecords) {
    const source = await read(record.provenance.path);
    assert.doesNotMatch(source, /<(?:script|foreignObject)|on\w+\s*=|(?:href|src)="https?:|xlink:href/u);
  }
});

test("Home and About expose qualifiers, rights separation, and human-input blockers", async () => {
  const home = await read("site/src/pages/index.astro");
  const viHome = await read("site/src/pages/vi/index.astro");
  const about = await read("site/src/pages/about/index.astro");
  assert.match(home, /39[\s\S]*862[\s\S]*25[\s\S]*Commercial clearance/u);
  assert.match(viHome, /39[\s\S]*862[\s\S]*25[\s\S]*Quyền thương mại/u);
  assert.match(home, /not the original runtime/u);
  assert.match(about, /Non-production draft/u);
  assert.match(about, /commercial distribution clearance is asserted/u);
});

test("browser tooling is exactly pinned", async () => {
  const packageJson = JSON.parse(await read("site/package.json"));
  assert.equal(packageJson.devDependencies["@playwright/test"], "1.61.1");
  assert.equal(packageJson.devDependencies["@axe-core/playwright"], "4.12.1");
});

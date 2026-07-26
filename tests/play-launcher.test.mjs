import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildPlayDisclosure,
  playFacts,
  renderFallbackState,
  resolvePlayMount,
  shouldLoadGame,
  validatePlayRights,
} from "../site/src/data/play.ts";
import { validatePlay, validatePlaySource } from "../scripts/case-study-validation/play.mjs";
import { playRouteFragment } from "../site/src/data/route-fragments/play.ts";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");

test("play routes are paired and the mount has exactly one Pages base", () => {
  assert.deepEqual(playRouteFragment.map((route) => route.path), ["/play/", "/vi/play/"]);
  assert.equal(resolvePlayMount(), "/pencil-blade-2026/play/game/");
  assert.equal(resolvePlayMount("/pencil-blade-2026/"), "/pencil-blade-2026/play/game/");
  assert.equal(resolvePlayMount("/preview/"), "/preview/play/game/");
  assert.throws(() => resolvePlayMount("https://example.com"), /Invalid Pages prefix/u);
});

test("game loading stays false until explicit interaction", () => {
  assert.equal(shouldLoadGame("idle"), false);
  assert.equal(shouldLoadGame("failed"), false);
  assert.equal(shouldLoadGame("requested"), true);
  assert.equal(shouldLoadGame("loaded"), true);
});

test("play disclosure binds exact H5 facts and separate rights dimensions", () => {
  const disclosure = buildPlayDisclosure("en");
  assert.equal(disclosure.files, 2539);
  assert.equal(disclosure.bytes, 39613694);
  assert.equal(disclosure.treeDigestSha256, "90f0fed3042364f02cfb6dbe888d32561c71ca9a2218d4316f2ae8a879cb2b54");
  assert.equal(disclosure.originalRuntimeObserved, false);
  assert.equal(disclosure.previewMediaId, "MEDIA-PLAY-PREVIEW-SHARED");
  assert.doesNotThrow(() => validatePlayRights(disclosure));
  assert.notEqual(disclosure.academicDisplayDecisionRef, disclosure.commercialRightsRecordRef);
  assert.equal(playFacts.en.gameUrl, playFacts.vi.gameUrl);
});

test("fallback copy stays useful without a frame", () => {
  for (const reason of ["javascript", "frame-error", "unsupported"]) {
    assert.ok(renderFallbackState(reason).length > 30);
  }
});

test("launcher source contains no eager frame, bridge, autoplay, or storage wipe", async () => {
  const astro = await read("site/src/components/play/play-launcher.astro");
  const controller = await read("site/src/components/play/play-controller.ts");
  assert.deepEqual(validatePlaySource(astro), []);
  assert.deepEqual(validatePlaySource(controller), []);
  assert.doesNotMatch(astro, /<iframe/u);
  assert.doesNotMatch(`${astro}\n${controller}`, /autoplay|localStorage\s*\.\s*clear|\bpostMessage\s*\(/u);
  assert.match(controller, /addEventListener\("click"/u);
  assert.match(controller, /document\.createElement\("iframe"\)/u);
});

test("play validator fails closed on eager loading and coupling", () => {
  const findings = validatePlaySource(`
    <iframe src="/pencil-blade-2026/play/game/"></iframe>
    <script>localStorage.clear(); window.parent.postMessage("x", "*")</script>
  `);
  assert.deepEqual(
    findings.map((entry) => entry.code).sort(),
    ["EAGER_GAME_IFRAME", "GLOBAL_STORAGE_WIPE", "PARENT_GAME_COUPLING"],
  );
  assert.deepEqual(validatePlay({ publicationManifest: { media: [playFacts.h5Tree, playFacts.preview] } }), []);
});

test("both launcher pages disclose no security isolation and original-runtime limits", async () => {
  const en = await read("site/src/pages/play/index.astro");
  const vi = await read("site/src/pages/vi/play/index.astro");
  assert.match(en, /not a security\s+boundary/u);
  assert.match(en, /no parent↔game bridge/u);
  assert.match(vi, /không phải ranh giới bảo mật/u);
  assert.match(vi, /không có bridge parent↔game/u);
});

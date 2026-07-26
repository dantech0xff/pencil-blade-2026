import { expect, test } from "@playwright/test";

test("APK dissection supports keyboard selection, Escape, and complete static fallback", async ({ page }) => {
  await page.goto("story/");
  const dissection = page.locator("[data-apk-dissection]");
  await expect(dissection).toHaveAttribute("data-enhanced", "true");
  await expect(dissection.locator("[data-apk-layer]:visible")).toHaveCount(1);

  const first = dissection.locator("[data-apk-layer-button]").first();
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dissection).toHaveAttribute("data-selected-layer", "1");
  await page.keyboard.press("Escape");
  await expect(dissection).toHaveAttribute("data-selected-layer", "all");
  await expect(dissection.locator("details[open] ol > li")).toHaveCount(5);
});

test("contract trace works by touch/click and exposes all lanes on request", async ({ page }) => {
  await page.goto("forensics/");
  const trace = page.locator("[data-contract-trace]");
  await trace.locator("[data-trace-tab]").nth(2).click();
  await expect(trace).toHaveAttribute("data-selected-step", "2");
  await expect(trace.locator("[data-trace-step]:visible")).toHaveCount(1);

  await trace.locator("[data-trace-show-all]").click();
  await expect(trace).toHaveAttribute("data-selected-step", "all");
  await expect(trace.locator("[data-trace-step]:visible")).toHaveCount(4);
  await expect(trace.locator("details[open] tbody tr")).toHaveCount(4);
});

test("reduced motion starts interactions in complete informative states", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/pencil-blade-2026/story/");
  await expect(page.locator("[data-apk-dissection]")).toHaveAttribute(
    "data-selected-layer",
    "all",
  );
  await page.goto("/pencil-blade-2026/forensics/");
  await expect(page.locator("[data-contract-trace]")).toHaveAttribute(
    "data-selected-step",
    "all",
  );
  await context.close();
});

test("chapter meaning and figures remain available when JavaScript is disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/pencil-blade-2026/story/");
  await expect(page.locator("[data-apk-layer]")).toHaveCount(5);
  await expect(page.locator("[data-apk-dissection] details[open]")).toBeVisible();
  await page.goto("/pencil-blade-2026/forensics/");
  await expect(page.getByRole("heading", { name: "Reading a Game That Cannot Run" })).toBeVisible();
  await expect(page.locator("[data-trace-step]")).toHaveCount(4);
  await expect(page.locator("[data-contract-trace] details[open]")).toBeVisible();
  await context.close();
});

for (const viewport of [
  { width: 320, height: 800 },
  { width: 720, height: 1280 },
]) {
  test(`chapters avoid page-level horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("reconstruction/");
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
    await expect(page.locator(".runtime-proof-matrix img").first()).toBeVisible();
  });
}

test("English and Vietnamese chapter routes expose reciprocal navigation and evidence", async ({ page }) => {
  for (const path of ["story/", "forensics/", "reconstruction/", "vi/story/", "vi/forensics/", "vi/reconstruction/"]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main")).toContainText(/CLM-|evidence|bằng chứng/iu);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
  }
});

import { expect, test } from "@playwright/test";

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

test("reduced motion starts the retained trace in its complete state", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/pencil-blade-2026/forensics/");
  await expect(page.locator("[data-contract-trace]")).toHaveAttribute(
    "data-selected-step",
    "all",
  );
  await context.close();
});

test("Forensics remains meaningful when JavaScript is disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
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
  test(`Forensics avoids page-level overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("forensics/");
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  });
}

test("English and Vietnamese Forensics expose reciprocal navigation and evidence", async ({ page }) => {
  for (const path of ["forensics/", "vi/forensics/"]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main")).toContainText(/CLM-|evidence|bằng chứng/iu);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
  }
});

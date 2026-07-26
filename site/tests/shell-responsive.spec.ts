import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`home has no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("");
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("reduced motion leaves evidence visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("");
  await expect(page.locator("[data-reveal]").first()).toBeVisible();
  const duration = await page.locator("[data-reveal]").first().evaluate((node) =>
    getComputedStyle(node).transitionDuration
  );
  expect(["0s", "0.001ms", "1e-06s"]).toContain(duration);
});

test("core Home copy remains available with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4321/pencil-blade-2026/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One APK");
  await expect(page.getByText("Commercial clearance")).toBeVisible();
  await context.close();
});

test("print preserves citations and rights boundaries", async ({ page }) => {
  await page.goto("");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".rights-boundary")).toBeVisible();
  await expect(page.locator(".evidence-ref").first()).toBeVisible();
});

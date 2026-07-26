import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const representativeRoutes = [
  "",
  "forensics/",
  "play/",
  "vi/",
  "vi/forensics/",
  "vi/play/",
] as const;

for (const route of representativeRoutes) {
  test(`${route || "home"} has zero serious or critical axe findings`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical");
    expect(severe).toEqual([]);
  });
}

test("launch shell remains keyboard-usable at 200% zoom and 320 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("forensics/");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  const bounds = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("play launcher exposes disclosure and accessible controls before creating a frame", async ({ page }) => {
  await page.goto("play/");
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("[data-play-load]")).toHaveAccessibleName(/load|game/iu);
  await expect(page.locator("[data-play-direct]")).toHaveAccessibleName(/open|direct/iu);
  await expect(page.locator("main")).toContainText(/same origin|not a security boundary/iu);
  await expect(page.locator("main")).toContainText(/original runtime/iu);
});

test("reduced motion and print retain the complete evidence alternatives", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/pencil-blade-2026/forensics/");
  await expect(page.locator("[data-contract-trace]")).toHaveAttribute(
    "data-selected-step",
    "all",
  );
  await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
  await expect(page.locator("[data-contract-trace] details[open] table")).toBeVisible();
  await expect(page.locator("[data-contract-trace] details[open] table")).toContainText(
    "originalRuntimeObservation = false",
  );
  await context.close();
});

import { expect, test } from "@playwright/test";

test("skeptical engineer can reach Forensics and inspect canonical evidence IDs", async ({ page }) => {
  await page.goto("");
  await page.getByRole("link", { name: /detailed forensics/i }).click();
  await expect(page).toHaveURL(/\/forensics\/$/u);
  await expect(page.getByRole("heading", { name: "Reading a Game That Cannot Run" })).toBeVisible();
  await expect(page.locator('[data-evidence-ref="CLM-NATIVE-PROFILE"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Tiếng Việt" })).toBeVisible();
  await page.getByRole("link", { name: "Tiếng Việt" }).click();
  await expect(page).toHaveURL(/\/vi\/forensics\/$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test("player-first journey has zero eager game requests and one explicit launcher frame", async ({ page }) => {
  const gameRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/play/game/")) {
      gameRequests.push(request.url());
    }
  });
  await page.goto("play/");
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(gameRequests).toEqual([]);

  await page.route("**/play/game/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Audited game fixture</title><canvas></canvas>",
    });
  });
  await page.locator("[data-play-load]").click();
  await expect(page.locator("[data-play-launcher] iframe")).toHaveCount(1);
  expect(gameRequests).toHaveLength(1);
  await expect(page.locator("[data-play-direct]")).toHaveAttribute(
    "href",
    "/pencil-blade-2026/play/game/",
  );
});

test("non-play documentary routes never request the game subtree", async ({ page }) => {
  const gameRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/play/game/")) {
      gameRequests.push(request.url());
    }
  });
  for (const path of [
    "",
    "forensics/",
    "vi/",
    "vi/forensics/",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
  }
  expect(gameRequests).toEqual([]);
});

test("every launch route publishes canonical, reciprocal locale, and x-default metadata", async ({ page }) => {
  for (const path of [
    "",
    "forensics/",
    "play/",
    "vi/",
    "vi/forensics/",
    "vi/play/",
  ]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    const alternates = page.locator('link[rel="alternate"][hreflang]');
    await expect(alternates).toHaveCount(3);
    await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('link[hreflang="vi"]')).toHaveCount(1);
    await expect(page.locator('link[hreflang="x-default"]')).toHaveCount(1);
  }
});

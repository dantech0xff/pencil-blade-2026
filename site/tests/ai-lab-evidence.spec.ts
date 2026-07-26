import { expect, test } from "@playwright/test";

test("AI Lab exposes six curated episodes and stable evidence joins", async ({ page }) => {
  await page.goto("ai-lab/");
  const cards = page.locator(".ai-lab__episodes article");
  await expect(cards).toHaveCount(6);
  const detailLink = cards.first().getByRole("link").first();
  const href = await detailLink.getAttribute("href");
  expect(href).toMatch(/^\/pencil-blade-2026\/ai-lab\/[^/]+\/$/u);
  await detailLink.click();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Canonical claim joins" })).toBeVisible();
  await expect(page.locator('a[href*="/evidence/"]').first()).toBeVisible();
});

test("evidence filters are URL-serializable and reset without losing static records", async ({ page }) => {
  await page.goto("evidence/?q=CLM-APK-BYTES");
  const explorer = page.locator("[data-evidence-explorer]");
  await expect(explorer.locator('[name="q"]')).toHaveValue("CLM-APK-BYTES");
  await expect(explorer.locator("[data-explorer-count]")).toHaveText("1");
  await expect(explorer.locator("[data-explorer-card]:visible")).toHaveCount(1);

  await explorer.locator("[data-explorer-reset]").click();
  await expect(explorer.locator("[data-explorer-count]")).toHaveText("39");
  await expect(page).toHaveURL(/\/evidence\/$/u);
});

test("evidence explorer remains complete with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/pencil-blade-2026/evidence/?q=CLM-APK-BYTES");
  await expect(page.locator("[data-explorer-card]")).toHaveCount(39);
  await expect(
    page.getByText(/complete evidence list remains available below/iu),
  ).toBeVisible();
  await context.close();
});

test("English and Vietnamese AI/evidence routes preserve stable detail paths", async ({ page }) => {
  for (const path of ["ai-lab/", "evidence/", "vi/ai-lab/", "vi/evidence/"]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
  }
  await page.goto("vi/evidence/CLM-APK-BYTES/");
  await expect(page.getByRole("heading", { name: "CLM-APK-BYTES" })).toBeVisible();
  await expect(page.locator("main")).toContainText(/quyền thương mại|commercial/iu);
});

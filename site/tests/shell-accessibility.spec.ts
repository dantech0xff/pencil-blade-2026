import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["", "vi/", "forensics/", "vi/forensics/"] as const;

for (const route of routes) {
  test(`${route || "home"} has a semantic, keyboard-safe shell`, async ({ page }) => {
    const gameRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/play/game/")) gameRequests.push(request.url());
    });
    await page.goto(route);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("main h1")).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(gameRequests).toEqual([]);
  });
}

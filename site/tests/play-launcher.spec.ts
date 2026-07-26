import { expect, test } from "@playwright/test";

test("Play makes no game request before explicit activation", async ({ page }) => {
  const gameRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/play/game/")) gameRequests.push(request.url());
  });
  await page.goto("play/");
  await expect(page.locator("[data-play-launcher] iframe")).toHaveCount(0);
  expect(gameRequests).toEqual([]);
  await expect(page.getByRole("button", { name: "Load the H5 reconstruction" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the audited H5 directly" })).toHaveAttribute(
    "href",
    "/pencil-blade-2026/play/game/",
  );
});

test("explicit activation creates one frame and enables fullscreen", async ({ page }) => {
  await page.route("**/play/game/", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>Audited test mount</title><canvas></canvas>",
  }));
  await page.goto("play/");
  await page.getByRole("button", { name: "Load the H5 reconstruction" }).click();
  await expect(page.locator("[data-play-launcher] iframe")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Enter fullscreen" })).toBeEnabled();
});

test("same-origin frame leaves parent state and namespaced storage intact", async ({ page }) => {
  await page.route("**/play/game/", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><title>Audited test mount</title>
      <script>localStorage.setItem("Cocos2dxPrefsFile:fixture", "game")</script>
      <canvas></canvas>`,
  }));
  await page.goto("play/");
  await page.evaluate(() => {
    document.body.dataset.parentGuard = "unchanged";
    localStorage.setItem("pencil-blade-case-study:fixture", "site");
  });
  await page.getByRole("button", { name: "Load the H5 reconstruction" }).click();
  await expect(page.locator("[data-play-launcher] iframe")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("Cocos2dxPrefsFile:fixture"))).toBe("game");
  expect(await page.evaluate(() => ({
    guard: document.body.dataset.parentGuard,
    site: localStorage.getItem("pencil-blade-case-study:fixture"),
    pathname: location.pathname,
  }))).toEqual({
    guard: "unchanged",
    site: "site",
    pathname: "/pencil-blade-2026/play/",
  });
  await page.evaluate(() => {
    localStorage.removeItem("pencil-blade-case-study:fixture");
    localStorage.removeItem("Cocos2dxPrefsFile:fixture");
  });
});

test("Vietnamese launcher has equivalent controls and JS-off fallback", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4321/pencil-blade-2026/vi/play/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chơi bản phục dựng");
  await expect(page.getByText("Nếu canvas không dùng được")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mở trực tiếp bản H5 đã kiểm toán" })).toBeVisible();
  await context.close();
});

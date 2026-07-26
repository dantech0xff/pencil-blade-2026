import { expect, test } from "@playwright/test";

for (const localePath of ["", "vi/"] as const) {
  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`${localePath || "English"} Home has no page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(localePath);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("From an old APK");
  await expect(page.locator("[data-home-part]")).toHaveCount(3);
  await expect(page.getByText("the reconstruction runs in the browser")).toBeVisible();
  await context.close();
});

for (const home of [
  {
    path: "",
    headings: [
      "What do we get from the APK?",
      "Read libgame.so and connect it to resources",
      "Try the game",
    ],
    playLabel: "Try the game",
    playPath: "/pencil-blade-2026/play/",
  },
  {
    path: "vi/",
    headings: [
      "APK cho chúng ta những gì?",
      "Đọc libgame.so và nối với resource",
      "Chơi thử game",
    ],
    playLabel: "Chơi thử",
    playPath: "/pencil-blade-2026/vi/play/",
  },
] as const) {
  test(`${home.path || "English"} Home keeps the reconstruction to three concrete parts`, async ({ page }) => {
    await page.goto(home.path);
    await expect(page.locator("[data-home-part]")).toHaveCount(3);
    await expect(page.locator("[data-raw-sample]")).toHaveCount(3);
    await expect(page.locator(".chapter-rail")).toHaveCount(0);
    await expect(page.locator(".metric-grid")).toHaveCount(0);
    for (const heading of home.headings) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: home.playLabel, exact: true })).toHaveAttribute(
      "href",
      home.playPath,
    );
  });
}

test("print preserves retained evidence and rights boundaries", async ({ page }) => {
  await page.goto("forensics/");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".evidence-ref").first()).toBeVisible();
  await page.goto("play/");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".rights-boundary")).toBeVisible();
});

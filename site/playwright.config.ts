import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4321/pencil-blade-2026/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "ASTRO_DEV_BACKGROUND=0 npm run dev -- --host 127.0.0.1 --ignore-lock",
    url: "http://127.0.0.1:4321/pencil-blade-2026/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

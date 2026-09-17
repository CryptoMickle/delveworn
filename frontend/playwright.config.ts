import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1365, height: 900 } } },
    { name: "android-chromium", use: { ...devices["Pixel 7"] } },
    { name: "small-iphone-webkit", use: { ...devices["iPhone SE"] } },
    { name: "iphone-11-pro-webkit", testMatch: /(?:descent|weekly-grid|experience)\.spec\.ts/, use: { ...devices["iPhone 11 Pro"] } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_DEPLOYMENT: "somniaShannon",
      NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS: "0x07c5D071132ae95C3708031790b3feC740F4c292",
      NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED: "false",
    },
  },
});

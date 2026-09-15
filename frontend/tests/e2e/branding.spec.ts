import { expect, test } from "@playwright/test";
import { PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

test("Onchain identifies the configured Somnia Shannon Testnet before wallet connection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("WALLET · SOMNIA SHANNON TESTNET", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Onchain", exact: true }).click();
  await expect(page.getByText("WALLET · SOMNIA SHANNON TESTNET", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "ENTER DUNGEON", exact: true }).click();
  await expect(page.getByRole("button", { name: /CONNECT WALLET TO ENTER/ })).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".practice-header")).toContainText("LIVE ON SOMNIA SHANNON TESTNET");
  await expect(page.locator(".practice-header")).toContainText("CHAIN ID 50312");
});

test("the illustrated logo returns home without replacing a saved local run", async ({ page }) => {
  await page.goto("/practice");
  await page.getByRole("button", { name: /START LOCAL RUN/ }).click();
  await expect(page.getByRole("button", { name: /⚔️ ATTACK/ })).toBeEnabled();
  const saved = await page.evaluate(key => localStorage.getItem(key), PRACTICE_RUN_STORAGE_KEY);
  expect(saved).not.toBeNull();
  const home = page.getByRole("link", { name: "Delveworn home" });
  const logo = home.locator("img");
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await home.evaluate(link => link.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await home.click();
  await expect(page.getByRole("heading", { name: "Your call. Your way in." })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), PRACTICE_RUN_STORAGE_KEY)).toBe(saved);
  const practice = page.getByRole("button", { name: "Practice", exact: true });
  await practice.click();
  await expect(practice).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Delveworn home" }).click();
  await expect(practice).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Onchain", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "CHOOSE A MODE", exact: true })).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), PRACTICE_RUN_STORAGE_KEY)).toBe(saved);
  await practice.click();
  await page.getByRole("button", { name: "ENTER DUNGEON", exact: true }).click();
  await expect(page.getByText(/Local run restored/)).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), PRACTICE_RUN_STORAGE_KEY)).toBe(saved);
});

test("the dark plum background stays consistent in light and dark system modes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const colors = () => page.evaluate(() => ({
    canvas: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    scheme: getComputedStyle(document.documentElement).colorScheme,
    backdrop: getComputedStyle(document.querySelector("main")!).backgroundImage,
  }));
  const light = await colors();
  expect(light.canvas).toBe("rgb(9, 9, 9)");
  expect(light.body).toBe("rgb(9, 9, 9)");
  expect(light.scheme).toBe("dark");
  expect(light.backdrop).toContain("rgb(41, 27, 50)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await colors()).toEqual(light);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "ENTER DUNGEON", exact: true }).click();
  await page.getByRole("button", { name: /START LOCAL RUN/ }).click();
  await expect(page.getByRole("button", { name: /⚔️ ATTACK/ })).toBeEnabled();
  expect(await page.locator("main").evaluate(main => getComputedStyle(main).backgroundImage)).toContain("rgb(38, 24, 43)");
});

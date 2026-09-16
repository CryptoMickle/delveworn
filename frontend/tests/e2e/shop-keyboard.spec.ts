import { expect, test, type Page } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { isStoredPracticeGame, PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

async function seedShop(page: Page) {
  const game: PracticeGame = {
    ...EMPTY_GAME,
    hasStarted: true,
    active: true,
    hp: 60,
    monsterHp: 0,
    monsterMaxHp: 75,
    roomsCleared: 9,
    gold: 200,
    weaponLevel: 2,
    armorLevel: 2,
    log: [],
  };
  expect(isStoredPracticeGame(game)).toBe(true);
  await page.addInitScript(({ key, game }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, game }));
  }, { key: PRACTICE_RUN_STORAGE_KEY, game });
  await page.goto("/practice");
  await expect(page.getByText(/Local run restored/)).toBeVisible();
}

const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).game as PracticeGame, PRACTICE_RUN_STORAGE_KEY);

test("Kevin's modal keeps the original painting and owns arrow navigation without leaking game keys", async ({ page }) => {
  await seedShop(page);
  await page.getByRole("button", { name: "Dismiss restore notice" }).click();
  await page.getByRole("button", { name: "Visit Kevin" }).click();
  const shop = page.getByRole("dialog", { name: "Kevin's shop" });
  await expect(shop).toBeVisible();

  const painting = shop.getByRole("img", { name: "Quartermaster Kevin with his wagon and no-refunds sign" });
  await expect(painting).toHaveAttribute("width", "1672");
  await expect(painting).toHaveAttribute("height", "941");
  await expect(shop.locator(".dungeon-shop-keeper-art > summary > svg")).toBeVisible();

  const artwork = shop.getByRole("button", { name: "View full Quartermaster Kevin artwork" });
  await artwork.focus();
  await page.keyboard.press("Enter");
  const closeArtwork = shop.getByRole("button", { name: "Close full Quartermaster Kevin artwork" });
  await expect(closeArtwork).toBeVisible();
  await closeArtwork.focus();
  await page.keyboard.press("Enter");
  await expect(closeArtwork).not.toBeVisible();

  const close = shop.getByRole("button", { name: "Close Kevin's shop" });
  await expect(close).toBeFocused();
  const before = await stored(page);
  const avatar = await page.locator("[data-avatar-position]").getAttribute("data-avatar-position");
  for (const key of ["k", "j", "m", "w", "a", "s", "d"]) await page.keyboard.press(key);
  expect(await stored(page)).toEqual(before);
  await expect(page.locator("[data-avatar-position]")).toHaveAttribute("data-avatar-position", avatar!);

  await page.keyboard.press("ArrowDown");
  const selected = shop.locator("button:focus");
  await expect(selected).toHaveCount(1);
  await expect(close).not.toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await stored(page)).gold).toBeLessThan(before.gold);
  const afterPurchase = await stored(page);
  await expect(shop).toBeVisible();

  await close.click();
  await expect(shop).not.toBeVisible();
  await page.evaluate(() => {
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Wallet approval");
    const button = document.createElement("button");
    button.textContent = "Approve wallet";
    modal.append(button);
    document.body.append(modal);
    document.body.tabIndex = -1;
    document.body.focus();
  });
  const wallet = page.getByRole("button", { name: "Approve wallet" });
  await page.keyboard.press("ArrowRight");
  await expect(wallet).not.toBeFocused();
  expect(await stored(page)).toEqual(afterPurchase);
});

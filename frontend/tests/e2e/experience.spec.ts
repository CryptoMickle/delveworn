import { expect, test, type Page } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { isStoredPracticeGame, PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

const base: PracticeGame = { ...EMPTY_GAME, hasStarted: true, active: true, hp: 60, monsterHp: 30, monsterMaxHp: 30, gold: 100, log: [] };
const playerHud = (page: Page) => page.locator(".dungeon-original-hud .practice-hud:visible");

async function seed(page: Page, overrides: Partial<PracticeGame>) {
  const game = { ...base, ...overrides };
  expect(isStoredPracticeGame(game)).toBe(true);
  await page.addInitScript(({ key, game }) => {
    if (!sessionStorage.getItem("experience-fixture")) {
      localStorage.setItem(key, JSON.stringify({ version: 1, game }));
      sessionStorage.setItem("experience-fixture", "1");
    }
  }, { key: PRACTICE_RUN_STORAGE_KEY, game });
  await page.goto("/practice");
  await expect(page.locator(".endless-room")).toBeVisible();
  const restored = page.locator(".practice-storage-banner:visible").filter({ hasText: /Local run restored/ });
  if (await restored.count() > 0) await expect(restored.first()).toBeVisible();
  else await expect(page.getByRole("button", { name: "Run status · view details" })).toBeVisible();
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function waitForPhase(page: Page, phase: string) {
  await expect(page.locator(".endless-room")).toHaveAttribute("data-descent-phase", phase);
}

async function clickRoomPoint(page: Page, point: { x: number; y: number }) {
  const floor = page.locator("svg.dungeon-scene");
  await floor.scrollIntoViewIfNeeded();
  const screen = await floor.evaluate((element, target) => {
    const matrix = (element as SVGSVGElement).getScreenCTM();
    if (!matrix) throw new Error("Room floor has no screen transform");
    const transformed = new DOMPoint(target.x, target.y).matrixTransform(matrix);
    return { x: transformed.x, y: transformed.y };
  }, point);
  await page.mouse.click(screen.x, screen.y);
}

async function passLootAtDoor(page: Page, phase: string) {
  await clickRoomPoint(page, { x: 450, y: 65 });
  await waitForPhase(page, phase);
}

async function walkThrough(page: Page, name: RegExp, phase: string) {
  await page.getByRole("button", { name }).click();
  await waitForPhase(page, phase);
}

async function openRelics(page: Page) {
  await page.locator(".dungeon-relic-menu:visible").click();
  await expect(page.getByRole("dialog", { name: "Your relics" })).toBeVisible();
}

test("neutral home waits for a mode choice before routing into a dungeon", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Your call. Your way in.", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your way into the dungeon.", level: 2 })).toBeVisible();
  const modes = page.getByRole("group", { name: "Choose your dungeon" });
  const practice = modes.getByRole("button", { name: "Practice", exact: true });
  const challenge = modes.getByRole("button", { name: "Weekly Challenge", exact: true });
  const onchain = modes.getByRole("button", { name: "Onchain", exact: true });
  await expect(practice).toHaveAttribute("aria-pressed", "false");
  await expect(challenge).toHaveAttribute("aria-pressed", "false");
  await expect(onchain).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "CHOOSE A MODE", exact: true })).toBeDisabled();
  await noOverflow(page);
  await practice.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(practice).toHaveAttribute("aria-pressed", "true");
  await expect(onchain).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "ENTER DUNGEON", exact: true }).click();
  await expect(page.getByRole("button", { name: /START LOCAL RUN/ })).toBeEnabled();
  await page.getByRole("link", { name: "Delveworn home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "CHOOSE A MODE", exact: true })).toBeDisabled();
  await challenge.click();
  await expect(challenge).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("WEEKLY · SAME SEED FOR EVERYONE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ENTER DUNGEON", exact: true }).click();
  await expect(page.getByRole("button", { name: /START \d{4}-W\d{2}/ })).toBeEnabled();
  await page.getByRole("link", { name: "Delveworn home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "CHOOSE A MODE", exact: true })).toBeDisabled();
  await onchain.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(practice).toHaveAttribute("aria-pressed", "false");
  await expect(onchain).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("WALLET · SOMNIA SHANNON TESTNET", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ENTER DUNGEON", exact: true }).click();
  await expect(page.getByRole("button", { name: /CONNECT WALLET TO ENTER/ })).toBeVisible({ timeout: 40_000 });
  await noOverflow(page);
});

test("potion preserves combat layout, shows net HP and survives reload", async ({ page }) => {
  await seed(page, {});
  const hp = playerHud(page).getByRole("progressbar", { name: "Player health" });
  await expect(hp).toHaveAttribute("aria-valuenow", "60");
  const dock = page.getByLabel("Combat actions");
  await expect(dock).toContainText("60/100");
  await page.getByRole("button", { name: /POTION · 3\/5/ }).click();
  await expect(page.getByRole("button", { name: /POTION · 2\/5/ })).toBeVisible();
  await expect(dock).not.toHaveAttribute("aria-busy", "true");
  const healed = Number(await hp.getAttribute("aria-valuenow"));
  expect(healed).toBeGreaterThan(60);
  expect(healed).toBeLessThan(85);
  await expect(page.getByRole("button", { name: /POTION · 2\/5/ })).toBeVisible();
  await noOverflow(page);
  await page.reload();
  await expect(hp).toHaveAttribute("aria-valuenow", String(healed));
  await expect(page.getByRole("button", { name: /POTION · 2\/5/ })).toBeVisible();
});

test("Enter and pointer attacks share the guarded result path", async ({ page }) => {
  await seed(page, { monsterHp: 1 });
  const attack = page.getByRole("button", { name: /⚔️ ATTACK/ });
  await attack.focus();
  await page.keyboard.press("Enter");
  await waitForPhase(page, "loot");
  await expect(playerHud(page).getByRole("progressbar", { name: "Player health" })).toHaveAttribute("aria-valuenow", "60");
  await passLootAtDoor(page, "explore");
  await walkThrough(page, /^Approach /, "combat");
  await expect(page.getByRole("button", { name: /⚔️ ATTACK/ })).toBeEnabled();
  await page.getByRole("button", { name: /⚔️ ATTACK/ }).click();
  await expect(page.getByLabel("Combat actions")).not.toHaveAttribute("aria-busy", "true");
  await noOverflow(page);
});

test("Kevin keeps inventory visible through purchase and enters boss", async ({ page }) => {
  await seed(page, { roomsCleared: 9, monsterHp: 0, weaponLevel: 2, armorLevel: 2 });
  await expect(page.getByRole("heading", { name: "Kevin is here." })).toBeVisible();
  const hud = playerHud(page);
  await expect(hud).toContainText("60/100");
  await expect(hud).toContainText("3/5");
  await expect(hud).toContainText("100");
  await page.getByRole("button", { name: "Visit Kevin" }).click();
  const shop = page.getByRole("dialog", { name: "Kevin's shop" });
  await expect(shop).toBeVisible();
  await shop.getByRole("button", { name: /WEAPON/ }).click();
  if (page.viewportSize()!.width < 768) {
    await expect(hud.getByRole("button", { name: "Gear details: weapon 3, armor 2" })).toBeVisible();
  } else {
    await expect(hud.locator(".practice-hud-desktop-loadout")).toContainText("Lv 3 · +6 damage");
  }
  await expect(hud.getByRole("progressbar", { name: "Player health" })).toHaveAttribute("aria-valuenow", "60");
  await shop.getByRole("button", { name: "Close Kevin's shop" }).click();
  await walkThrough(page, /Enter room 10/, "explore");
  await expect(page.getByRole("heading", { name: "Room 10 · The Dungeon Lord" })).toBeVisible();
  await noOverflow(page);
});

test("boss reward retains HUD and progression, relic survives reload", async ({ page }) => {
  await seed(page, { roomsCleared: 9, monsterType: 3, monsterHp: 1, monsterMaxHp: 90 });
  await page.getByRole("button", { name: /⚔️ ATTACK/ }).click();
  await waitForPhase(page, "loot");
  await passLootAtDoor(page, "reward");
  await expect(page.getByRole("heading", { name: "MANAGEMENT DEFEATED" })).toBeVisible();
  await expect(playerHud(page)).toBeVisible();
  await page.getByRole("button", { name: "KEEP NO RELIC" }).click();
  await waitForPhase(page, "recovery");
  await openRelics(page);
  await expect(page.getByRole("heading", { name: "RELIC LOADOUT" })).toBeVisible();
  await expect(page.locator(".relic-collection")).toContainText("1/15 UNIQUE");
  await page.getByRole("button", { name: "Close Your relics" }).click();
  await page.reload();
  await expect(page.locator(".relic-collection")).not.toBeVisible();
  await openRelics(page);
  await expect(page.locator(".relic-collection")).toContainText("1/15 UNIQUE");
  await noOverflow(page);
});

test("blocked storage and invalid saves remain playable without overwrite", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
  });
  await page.goto("/practice");
  await expect(page.getByText("Browser saving is unavailable", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /START LOCAL RUN/ }).click();
  await waitForPhase(page, "explore");
  await walkThrough(page, /^Approach /, "combat");
  await expect(page.getByRole("button", { name: /⚔️ ATTACK/ })).toBeEnabled();
  await noOverflow(page);
});

test("unknown save version is preserved during session-only play", async ({ page }) => {
  await page.addInitScript(({ key }) => localStorage.setItem(key, '{"version":999,"game":{}}'), { key: PRACTICE_RUN_STORAGE_KEY });
  await page.goto("/practice");
  await expect(page.getByText("Saved run kept unchanged", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /START WITHOUT SAVING/ }).click();
  await waitForPhase(page, "explore");
  await walkThrough(page, /^Approach /, "combat");
  await expect(page.getByRole("button", { name: /⚔️ ATTACK/ })).toBeEnabled();
  expect(await page.evaluate(key => localStorage.getItem(key), PRACTICE_RUN_STORAGE_KEY)).toBe('{"version":999,"game":{}}');
});

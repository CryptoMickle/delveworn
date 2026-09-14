import { expect, test, type Locator, type Page } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { isStoredPracticeGame, PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

async function seed(page: Page, overrides: Partial<PracticeGame>) {
  const game: PracticeGame = { ...EMPTY_GAME, hasStarted: true, active: true, hp: 60, monsterHp: 30, monsterMaxHp: 30, gold: 100, ...overrides };
  expect(isStoredPracticeGame(game)).toBe(true);
  await page.addInitScript(({ key, game }) => {
    if (!sessionStorage.getItem("practice-regression-fixture")) {
      localStorage.setItem(key, JSON.stringify({ version: 1, game }));
      sessionStorage.setItem("practice-regression-fixture", "1");
    }
  }, { key: PRACTICE_RUN_STORAGE_KEY, game });
  await page.goto("/practice");
  await expect(page.getByText(/Local run restored/)).toBeVisible();
}

async function savedGame(page: Page): Promise<PracticeGame> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).game, PRACTICE_RUN_STORAGE_KEY);
}

async function zeroLocalRolls(page: Page) {
  await page.addInitScript(() => {
    const random = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, "getRandomValues", { configurable: true, value: (array: Uint32Array) => {
      if (array instanceof Uint32Array && array.length === 1) { array.fill(0); return array; }
      return random(array);
    } });
  });
}

async function clickAndRead(button: Locator): Promise<PracticeGame> {
  return button.evaluate((element: HTMLButtonElement, key) => {
    element.click();
    // Read in the same call stack: a delayed commit cannot pass this check.
    return JSON.parse(localStorage.getItem(key)!).game;
  }, PRACTICE_RUN_STORAGE_KEY);
}

test("ended local run offers a copyable fallback when clipboard permission is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); },
    } });
  });
  await seed(page, { active: false, hp: 0, roomsCleared: 13, gold: 92 });
  await expect(page.getByRole("heading", { name: "You cleared 13 rooms.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "COPY LOCAL RESULT", exact: true }).click();
  const fallback = page.getByRole("textbox", { name: "Local practice result to copy" });
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveValue(/13 rooms cleared · 1 boss defeated · 92 gold remaining/);
  await expect(fallback).toHaveValue(/Browser-only simulation\. Self-reported result; no onchain record or rewards/);
  await fallback.focus();
  await expect.poll(() => fallback.evaluate((field: HTMLTextAreaElement) => field.selectionEnd - field.selectionStart)).toBeGreaterThan(100);
  await page.reload();
  await expect(page.getByRole("heading", { name: "You cleared 13 rooms.", exact: true })).toBeVisible();
  expect((await savedGame(page)).roomsCleared).toBe(13);
});

test("same-tick pointer and keyboard dispatch resolve one combat action", async ({ page }) => {
  await zeroLocalRolls(page);
  await seed(page, {});
  const result = await page.getByRole("button", { name: /⚔️ ATTACK/ }).evaluate(async (button: HTMLButtonElement, key) => {
    const read = () => JSON.parse(localStorage.getItem(key)!).game as PracticeGame;
    button.click();
    const first = read();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    button.click();
    const duplicates = read();
    // The event's microtasks finish before any timer may run. A fresh action
    // must work here without a simulated loading period or an elapsed-time test.
    await Promise.resolve();
    const nextDisabled = button.disabled;
    button.click();
    return { first, duplicates, nextDisabled, next: read() };
  }, PRACTICE_RUN_STORAGE_KEY);
  expect(result.first.monsterHp).toBe(14);
  expect(result.first.hp).toBe(56);
  expect(result.first.lastPlayerDamage).toBe(16);
  expect(result.first.potions).toBe(3);
  expect(result.first.combatPotionsUsed).toBe(0);
  expect(result.first.roomsCleared).toBe(0);
  expect(result.duplicates).toEqual(result.first);
  expect(result.nextDisabled).toBe(false);
  expect(result.next.monsterHp).toBe(0);
  expect(result.next.roomsCleared).toBe(1);
  expect(result.next.hp).toBe(56);
  await expect(page.locator(".recovery-panel").getByText("ROOM 1 CLEARED", { exact: true })).toBeVisible();
});

test("own potion heals safely between rooms, commits immediately and survives reload", async ({ page }) => {
  await seed(page, { roomsCleared: 1, monsterHp: 0, hp: 60, potions: 3, combatPotionsUsed: 2, lastMonsterDamage: 9 });
  const heal = page.getByRole("button", { name: /USE OWN POTION SAFELY/ });
  await expect(heal).toBeEnabled();
  const healed = await clickAndRead(heal);
  expect(healed.hp).toBe(85);
  expect(healed.potions).toBe(2);
  expect(healed.lastMonsterDamage).toBe(0);
  expect(healed.combatPotionsUsed).toBe(2);
  expect(healed.monsterHp).toBe(0);
  expect(healed.roomsCleared).toBe(1);
  expect(healed.gold).toBe(100);
  await expect(page.locator(".recovery-resources")).toContainText("85/100");
  await expect(heal).toContainText("2/5");
  await expect(page.getByRole("button", { name: "ENTER ROOM 2", exact: true })).toBeEnabled();
  await page.reload();
  expect(await savedGame(page)).toEqual(healed);
  await expect(page.getByRole("progressbar", { name: "Player health" })).toHaveAttribute("aria-valuenow", "85");
  const full = await clickAndRead(heal);
  expect(full.hp).toBe(100);
  expect(full.potions).toBe(1);
  expect(full.lastMonsterDamage).toBe(0);
  await expect(heal).toBeDisabled();
});

test("same-tick shop dispatch charges once and the next event can enter immediately", async ({ page }) => {
  await seed(page, { roomsCleared: 9, monsterHp: 0, gold: 200, weaponLevel: 2, armorLevel: 2 });
  const result = await page.getByRole("button", { name: /⚔️ WEAPON/ }).evaluate(async (button: HTMLButtonElement, key) => {
    const read = () => JSON.parse(localStorage.getItem(key)!).game as PracticeGame;
    button.click();
    const first = read();
    button.click();
    const duplicates = read();
    await Promise.resolve();
    const enter = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find(control => control.textContent?.includes("ENTER BOSS ROOM 10"))!;
    const nextDisabled = enter.disabled;
    enter.click();
    return { first, duplicates, nextDisabled, next: read() };
  }, PRACTICE_RUN_STORAGE_KEY);
  expect(result.first.gold).toBe(140);
  expect(result.first.weaponLevel).toBe(3);
  expect(result.duplicates).toEqual(result.first);
  expect(result.nextDisabled).toBe(false);
  expect(result.next.monsterHp).toBeGreaterThan(0);
  expect(result.next.monsterType).toBe(3);
  expect(result.next.gold).toBe(140);
  await expect(page.locator(".practice-hud")).toContainText("Lv 3 · +6 damage");
  await expect(page.getByRole("heading", { name: "The Dungeon Lord", exact: true })).toBeVisible();
});

test("Storm, Potion, encounter and relic decisions commit locally without a loading phase", async ({ page }) => {
  await zeroLocalRolls(page);
  await seed(page, {});
  const storm = await clickAndRead(page.getByRole("button", { name: /⚡ STORM/ }));
  expect(storm.monsterHp).toBe(30);
  expect(storm.hp).toBe(56);
  expect(storm.lastCritical).toBe(false);
  const potion = await clickAndRead(page.getByRole("button", { name: /POTION ·/ }));
  expect(potion.hp).toBe(79);
  expect(potion.potions).toBe(2);
  expect(potion.combatPotionsUsed).toBe(1);
  await clickAndRead(page.getByRole("button", { name: /⚔️ ATTACK/ }));
  const clear = await clickAndRead(page.getByRole("button", { name: /⚔️ ATTACK/ }));
  expect(clear.roomsCleared).toBe(1);
  const encounter = await clickAndRead(page.getByRole("button", { name: /ENTER ROOM 2/ }));
  expect(encounter.monsterHp).toBeGreaterThan(0);
  expect(encounter.combatPotionsUsed).toBe(0);
  await expect(page.getByText(/LOCAL ROLL|ROLLING ATTACK|ROLLING ENCOUNTER|Resolving action/)).toHaveCount(0);

  const rewardPage = await page.context().newPage();
  await seed(rewardPage, { roomsCleared: 10, monsterType: 3, monsterHp: 0, relicOfferAvailable: true, relicOfferId: 1, relicOfferRarity: 1 });
  const relic = await rewardPage.getByRole("button", { name: "KEEP NO RELIC", exact: true }).evaluate(async (button: HTMLButtonElement, key) => {
    const read = () => JSON.parse(localStorage.getItem(key)!).game as PracticeGame;
    button.click();
    const first = read();
    button.click();
    const duplicates = read();
    await Promise.resolve();
    const enter = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find(control => control.textContent?.includes("ENTER ROOM 11"))!;
    const nextDisabled = enter.disabled;
    enter.click();
    return { first, duplicates, nextDisabled, next: read() };
  }, PRACTICE_RUN_STORAGE_KEY);
  expect(relic.first.ownedRelics).toEqual([1]);
  expect(relic.first.relicCounts[1]).toBe(1);
  expect(relic.first.relicOfferAvailable).toBe(false);
  expect(relic.duplicates).toEqual(relic.first);
  expect(relic.nextDisabled).toBe(false);
  expect(relic.next.monsterHp).toBeGreaterThan(0);
  await expect(rewardPage.getByText(/LOCAL ROLL|ROLLING ENCOUNTER|Resolving action/)).toHaveCount(0);
  await rewardPage.close();
});

test("failed local randomness shows a visible entry error and leaves storage untouched", async ({ page }) => {
  await page.addInitScript(() => {
    const random = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, "getRandomValues", { configurable: true, value: (array: Uint32Array) => {
      if (array instanceof Uint32Array && array.length === 1) throw new DOMException("Unavailable", "OperationError");
      return random(array);
    } });
  });
  await page.goto("/practice");
  await page.getByRole("button", { name: /START LOCAL RUN/ }).click();
  await expect(page.getByText("The dungeon could not open", { exact: true })).toBeVisible();
  await expect(page.getByText(/Local randomness is unavailable/)).toBeVisible();
  await expect(page.getByRole("button", { name: /START LOCAL RUN/ })).toBeEnabled();
  expect(await page.evaluate(key => localStorage.getItem(key), PRACTICE_RUN_STORAGE_KEY)).toBeNull();
});

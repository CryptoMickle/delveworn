import { expect, test, type Page } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { isStoredPracticeGame, PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

type KeyboardAudioWindow = typeof window & {
  __keyboardAttackCues: number;
  __nativeTabs: Array<{ shift: boolean; prevented: boolean }>;
};
const attack = (page: Page) => page.getByRole("button", { name: /⚔️ ATTACK/ });
const storm = (page: Page) => page.getByRole("button", { name: /⚡ STORM/ });
const potion = (page: Page) => page.getByRole("button", { name: /POTION ·/ });
const dock = (page: Page) => page.getByLabel("Combat actions");
const storedRun = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).game as PracticeGame, PRACTICE_RUN_STORAGE_KEY);

async function seed(page: Page, overrides: Partial<PracticeGame> = {}) {
  const game: PracticeGame = {
    ...EMPTY_GAME, hasStarted: true, active: true, hp: 60,
    monsterHp: 9999, monsterMaxHp: 9999, armorLevel: 5, gold: 100, log: [], ...overrides,
  };
  expect(isStoredPracticeGame(game)).toBe(true);
  await page.addInitScript(({ key, game }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, game }));
    const audioWindow = window as KeyboardAudioWindow;
    audioWindow.__keyboardAttackCues = 0;
    const Context = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Context) {
      const oscillator = Context.prototype.createOscillator;
      Context.prototype.createOscillator = function () {
        const node = oscillator.call(this);
        const setValue = node.frequency.setValueAtTime.bind(node.frequency);
        node.frequency.setValueAtTime = (value, time) => {
          if (value === 920) audioWindow.__keyboardAttackCues += 1;
          return setValue(value, time);
        };
        return node;
      };
    }
  }, { key: PRACTICE_RUN_STORAGE_KEY, game });
  await page.goto("/practice");
  await expect(page.getByText(/Local run restored/)).toBeVisible();
}

test("arrows and Enter reach Practice from Home and start the local run", async ({ page }) => {
  await page.goto("/");
  const practice = page.getByRole("button", { name: "Practice", exact: true });
  await page.keyboard.press("ArrowRight");
  await expect(practice).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(practice).toHaveAttribute("aria-pressed", "true");
  const enter = page.getByRole("button", { name: "ENTER DUNGEON", exact: true });
  await expect(enter).toBeEnabled();
  await page.keyboard.press("ArrowDown");
  await expect(enter).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/practice$/);
  const start = page.getByRole("button", { name: /START LOCAL RUN/ });
  await expect(start).toBeEnabled();
  await page.keyboard.press("ArrowDown");
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");
  const approach = page.getByRole("button", { name: /^Approach / });
  await page.keyboard.press("ArrowLeft");
  await expect(approach).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(attack(page)).toBeEnabled();
  await expect(attack(page)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(storm(page)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(attack(page)).toBeFocused();
});

test("battle arrows follow Storm/Attack/Potion geometry, preserve the vertical lane and native Tab", async ({ page, browserName }) => {
  await seed(page);
  await page.keyboard.press("ArrowRight");
  await expect(attack(page)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(storm(page)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(attack(page)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(potion(page)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(attack(page)).toBeFocused();
  expect(await attack(page).evaluate(button => getComputedStyle(button).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(attack(page)).toBeFocused();
  await page.evaluate(() => {
    const records: KeyboardAudioWindow["__nativeTabs"] = [];
    (window as KeyboardAudioWindow).__nativeTabs = records;
    document.addEventListener("keydown", event => {
      if (event.key === "Tab") queueMicrotask(() => records.push({ shift: event.shiftKey, prevented: event.defaultPrevented }));
    });
  });
  await page.keyboard.press("Tab");
  // Mobile WebKit follows platform keyboard-access settings for native Tab.
  // Verify our handler leaves it untouched in every browser, and verify the
  // desktop button order where the browser enables native button traversal.
  if (browserName !== "webkit") await expect(potion(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  if (browserName !== "webkit") await expect(attack(page)).toBeFocused();
  expect(await page.evaluate(() => (window as KeyboardAudioWindow).__nativeTabs)).toEqual([
    { shift: false, prevented: false }, { shift: true, prevented: false },
  ]);
});

test("letter keys do nothing while arrows and Enter resolve one selected battle action", async ({ page }) => {
  await seed(page);
  const initial = await storedRun(page);
  for (const key of ["k", "K", "j", "J", "m", "M"]) await page.keyboard.press(key);
  expect(await storedRun(page)).toEqual(initial);

  await page.keyboard.press("ArrowRight");
  await expect(attack(page)).toBeFocused();
  await page.keyboard.down("Enter");
  await expect.poll(async () => (await storedRun(page)).monsterHp).toBeLessThan(9999);
  const attacked = await storedRun(page);
  const cues = await page.evaluate(() => (window as KeyboardAudioWindow).__keyboardAttackCues);
  expect(cues).toBe(1);
  await page.keyboard.down("Enter");
  await page.waitForTimeout(350);
  expect(await storedRun(page)).toEqual(attacked);
  expect(await page.evaluate(() => (window as KeyboardAudioWindow).__keyboardAttackCues)).toBe(cues);
  await page.keyboard.up("Enter");

  await page.keyboard.press("ArrowLeft");
  await expect(storm(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => JSON.stringify(await storedRun(page))).not.toBe(JSON.stringify(attacked));
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  const stormed = await storedRun(page);

  await page.keyboard.press("ArrowDown");
  await expect(potion(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await storedRun(page)).potions).toBe(stormed.potions - 1);
  await expect(dock(page)).toHaveAttribute("aria-busy", "false");
  const healed = await storedRun(page);

  for (const key of ["w", "a", "s", "d"]) await page.keyboard.press(key);
  await page.waitForTimeout(350);
  expect(await storedRun(page)).toEqual(healed);
});

test("disabled actions, editable controls and dialogs isolate keyboard navigation", async ({ page }) => {
  await seed(page, { hp: 100, potions: 0 });
  await expect(potion(page)).toBeDisabled();
  const before = await storedRun(page);
  await page.keyboard.press("m");
  expect(await storedRun(page)).toEqual(before);

  await page.locator(".endless-room").evaluate(main => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "Keyboard isolation field");
    main.append(input);
  });
  const input = page.getByRole("textbox", { name: "Keyboard isolation field" });
  await input.focus();
  await page.keyboard.type("kjmwasd");
  await expect(input).toHaveValue("kjmwasd");
  expect(await storedRun(page)).toEqual(before);

  await page.getByRole("button", { name: "Open dungeon log" }).click();
  const dialog = page.getByRole("dialog", { name: "Dungeon log", exact: true });
  await expect(dialog).toBeVisible();
  const close = page.getByRole("button", { name: "Close dungeon log" });
  await expect(close).toBeFocused();
  for (const key of ["k", "j", "m", "w", "a", "s", "d"]) await page.keyboard.press(key);
  expect(await storedRun(page)).toEqual(before);
  await page.keyboard.press("ArrowLeft");
  await expect(close).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  expect(await storedRun(page)).toEqual(before);
});

test("site navigation keeps native Enter and cannot replay the selected game action", async ({ page }) => {
  await seed(page);
  await page.keyboard.press("ArrowRight");
  await expect(attack(page)).toBeFocused();
  const home = page.getByRole("link", { name: "Delveworn home" });
  await home.focus();
  await expect(home).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  expect((await storedRun(page)).monsterHp).toBe(9999);
});

test("native relic disclosure opens with Enter and supports keyboard equip and unequip", async ({ page }) => {
  const relicCounts = Array<number>(16).fill(0);
  relicCounts[1] = 1;
  await seed(page, { roomsCleared: 11, monsterHp: 0, ownedRelics: [1], relicCounts });
  const disclosure = page.locator(".recovery-relics");
  const summary = disclosure.locator("summary");
  const collection = disclosure.locator(".relic-collection");
  await expect(summary).toContainText("CHANGE / UNEQUIP RELIC");
  await expect(collection).not.toBeVisible();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(collection).toBeVisible();
  const equip = collection.getByRole("button", { name: /Blood Price/ });
  await equip.focus();
  await page.keyboard.press("Enter");
  await expect(equip).toHaveAttribute("aria-pressed", "true");
  expect((await storedRun(page)).equippedRelic).toBe(1);
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(collection).not.toBeVisible();
  await page.keyboard.press("Enter");
  await expect(collection).toBeVisible();
  const unequip = collection.getByRole("button", { name: /No Relic/ });
  await unequip.focus();
  await page.keyboard.press("Enter");
  await expect(unequip).toHaveAttribute("aria-pressed", "true");
  const result = await storedRun(page);
  expect(result.equippedRelic).toBe(0);
  expect(result.roomsCleared).toBe(11);
  expect(result.monsterHp).toBe(0);
  expect(result.hp).toBe(60);
  expect(result.potions).toBe(3);
});

test("camp equipment, next room and a boss relic can be selected with arrows and Enter", async ({ page }) => {
  await seed(page, { roomsCleared: 9, monsterHp: 0, weaponLevel: 2, armorLevel: 2 });
  const weapon = page.getByRole("button", { name: /⚔️ WEAPON/ });
  const armor = page.getByRole("button", { name: /🛡️ ARMOR/ });
  await expect(weapon).toBeEnabled();
  await weapon.focus();
  const weaponBox = await weapon.boundingBox();
  const armorBox = await armor.boundingBox();
  await page.keyboard.press(armorBox!.x > weaponBox!.x + 10 ? "ArrowRight" : "ArrowDown");
  await expect(armor).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await storedRun(page)).armorLevel).toBe(3);
  const next = page.getByRole("button", { name: /ENTER BOSS ROOM/ });
  await expect(next).toBeEnabled();
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(attack(page)).toBeEnabled();

  // Start a separate controlled page state for the boss reward. The game still
  // resolves its actual local combat and relic rules through the same callback.
  const rewardPage = await page.context().newPage();
  await seed(rewardPage, { roomsCleared: 9, monsterType: 3, monsterHp: 1 });
  await attack(rewardPage).click();
  const keep = rewardPage.getByRole("button", { name: "KEEP NO RELIC" });
  await expect(keep).toBeEnabled();
  await keep.focus();
  const equip = rewardPage.getByRole("button", { name: /^EQUIP / });
  const keepBox = await keep.boundingBox();
  const equipBox = await equip.boundingBox();
  await rewardPage.keyboard.press(equipBox!.x > keepBox!.x + 10 ? "ArrowRight" : "ArrowDown");
  await expect(equip).toBeFocused();
  await rewardPage.keyboard.press("Enter");
  await expect.poll(async () => (await storedRun(rewardPage)).equippedRelic).toBeGreaterThan(0);
  const enterRoomEleven = rewardPage.getByRole("button", { name: /Enter room 11/ });
  await expect(enterRoomEleven).toBeFocused();
  await rewardPage.keyboard.press("Enter");
  const approachRoomEleven = rewardPage.getByRole("button", { name: /^Approach / });
  await expect(approachRoomEleven).toBeFocused();
  await rewardPage.keyboard.press("Enter");
  await expect(attack(rewardPage)).toBeEnabled();
  await expect(attack(rewardPage)).toBeFocused();
  await rewardPage.close();
});

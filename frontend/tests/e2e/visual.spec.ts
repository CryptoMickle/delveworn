import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { createPracticeGrid, type PracticeGridState } from "../../app/practice/grid-state";
import { PRACTICE_RUN_STORAGE_KEY, savePracticeRun } from "../../app/practice/storage";

const base: PracticeGame = {
  ...EMPTY_GAME,
  hasStarted: true,
  active: true,
  hp: 60,
  monsterHp: 30,
  monsterMaxHp: 30,
  gold: 100,
  log: [],
};

async function restoreFixture(page: Page, overrides: Partial<PracticeGame>, grid?: PracticeGridState) {
  let serialized = "";
  expect(savePracticeRun({
    getItem: () => null,
    setItem: (_key, value) => { serialized = value; },
  }, { ...base, ...overrides }, grid)).toBe("saved");
  await page.evaluate(({ key, serialized }) => localStorage.setItem(key, serialized), {
    key: PRACTICE_RUN_STORAGE_KEY,
    serialized,
  });
  await page.goto("/practice");
  const rewardDialog = page.getByRole("dialog", { name: "Boss relic reward" });
  const dismiss = page.locator('button[aria-label="Dismiss restore notice"]:visible');
  if (await rewardDialog.isVisible()) {
    await rewardDialog.getByRole("button", { name: "Dismiss restore notice" }).click();
  } else if (await dismiss.count() === 0) {
    await page.getByRole("button", { name: "Run status · view details" }).click();
    await page.locator('button[aria-label="Dismiss restore notice"]:visible').first().click();
  } else {
    await dismiss.first().click();
  }
  const status = page.getByRole("dialog", { name: "Run status" });
  if (await status.isVisible()) await status.getByRole("button", { name: "Close Run status" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  if ((await page.locator(".endless-room").count()) > 0) await expect(page.locator(".endless-room")).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  // The development framework indicator is not part of the shipped game.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Hidden responsive artwork can remain lazily unloaded. Wait for the
    // images included in this capture, then verify the recovery asset below.
    await Promise.all(Array.from(document.images)
      .filter(image => image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0)
      .map(image => image.decode().catch(() => undefined)));
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const filename = `${name}${fullPage ? "-full" : ""}.png`;
  const screenshotDir = process.env.DELVEWORN_SCREENSHOT_DIR;
  const path = screenshotDir ? join(screenshotDir, testInfo.project.name, filename) : testInfo.outputPath(filename);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: "disabled" });
  await testInfo.attach(filename, { path, contentType: "image/png" });
  return page.evaluate(() => {
    const bounds = (selector: string) => {
      const matches = Array.from(document.querySelectorAll(selector));
      const element = matches.find(match => {
        const rect = match.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ?? matches[0];
      if (!element) return null;
      const { x, y, width, height, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, bottom };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollY,
      homeLogo: bounds('header[data-keyboard-exclude] a[aria-label="Delveworn home"] img'),
      homeSound: bounds("main > button[data-keyboard-exclude]"),
      homeChoices: bounds('[role="group"][aria-label="Choose your dungeon"]'),
      homePanel: bounds('section[aria-label="Selected dungeon"]'),
      homeArt: bounds("[data-home-art]"),
      homeCopy: bounds("[data-home-copy]"),
      header: bounds(".endless-room > .descent-header"),
      hud: bounds(".descent-hud"),
      progress: bounds(".descent-mobile-progress"),
      scene: bounds("[data-room-scene]"),
      floor: bounds("svg.dungeon-scene"),
      monster: bounds(".dungeon-enemy"),
      monsterName: bounds(".descent-mobile-room, .descent-enemy-card"),
      enemyHp: bounds('.descent-enemy-card [role="progressbar"]'),
      dock: bounds(".practice-action-dock"),
      storm: bounds(".practice-storm-action"),
      attack: bounds(".practice-attack-action"),
      potion: bounds(".practice-potion-action"),
      loot: bounds("[data-room-loot]"),
      floorControls: bounds(".dungeon-floor-controls"),
      recoveryPanel: bounds(".descent-recovery-potion"),
      merchant: bounds(".descent-merchant"),
      shop: bounds(".practice-kevin-shop"),
      reward: bounds(".boss-reward-view"),
      result: bounds(".practice-result-view"),
      runEndSummary: bounds(".run-end-summary"),
      runEndLog: bounds(".run-end-log"),
      runCard: bounds(".run-card-panel"),
    };
  });
}

async function expectRoomLayout(page: Page, layout: Awaited<ReturnType<typeof capture>>) {
  await expect(page.locator("[data-room-scene]")).toBeVisible();
  await expect(page.locator("svg.dungeon-scene")).toBeVisible();
  expect(layout.floor!.width).toBeGreaterThan(0);
  expect(layout.floor!.height).toBeGreaterThan(0);
  expect(layout.floorControls!.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
  if (layout.viewport.width > 760) {
    expect(layout.scene!.x + layout.scene!.width).toBeLessThanOrEqual(layout.monsterName!.x + 1);
  } else {
    expect(layout.floor!.width).toBeLessThanOrEqual(layout.viewport.width + 1);
  }
}

test("capture six representative local experience states", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const measurements: Record<string, Awaited<ReturnType<typeof capture>>> = {};
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your call. Your way in." })).toBeVisible();
  await expect(page.getByRole("button", { name: "CHOOSE A MODE", exact: true })).toBeDisabled();
  const home = await capture(page, testInfo, "home");
  measurements.home = home;
  expect(home.homeLogo!.x + home.homeLogo!.width).toBeLessThanOrEqual(home.homeSound!.x);
  expect(home.homeChoices!.bottom).toBeLessThanOrEqual(home.homePanel!.y);
  if (testInfo.project.name === "desktop-chromium") {
    expect(home.homeArt!.x + home.homeArt!.width).toBeLessThanOrEqual(home.homeCopy!.x);
    expect(home.homeCopy!.y).toBeLessThan(home.homeArt!.bottom);
  } else {
    expect(home.homeCopy!.y).toBeGreaterThanOrEqual(home.homeArt!.bottom);
  }
  await capture(page, testInfo, "home", true);

  await restoreFixture(page, { log: ["Grave Belle has noticed your excellent collection of brains."] });
  const combat = await capture(page, testInfo, "combat");
  measurements.combat = combat;
  await expectRoomLayout(page, combat);
  expect(combat.monster!.height).toBeGreaterThan(0);
  expect(combat.storm!.x).toBeLessThan(combat.attack!.x);
  expect(combat.potion!.y).toBeGreaterThanOrEqual(Math.max(combat.storm!.bottom, combat.attack!.bottom));
  expect(Math.abs(combat.potion!.x - combat.storm!.x)).toBeLessThan(1);
  expect(Math.abs(combat.potion!.width - (combat.attack!.x + combat.attack!.width - combat.storm!.x))).toBeLessThan(1);
  if (testInfo.project.name !== "desktop-chromium") {
    expect(combat.monsterName!.bottom).toBeLessThanOrEqual(combat.dock!.y);
    expect(combat.dock!.bottom).toBeLessThanOrEqual(combat.viewport.height + 1);
  }

  await restoreFixture(
    page,
    { roomsCleared: 3, monsterHp: 0, lastLootType: 3, lastLootAmount: 1, weaponLevel: 0, lastPlayerDamage: 14, log: ["Room 3 cleared. A weapon upgrade is waiting on the floor."] },
    { ...createPracticeGrid(73), engaged: false, pendingLoot: { gold: 12, potions: 0, weapon: 1, armor: 0 }, roomTurns: 2 },
  );
  await expect(page.locator(".endless-room")).toHaveAttribute("data-descent-phase", "loot");
  await expect(page.getByRole("img", { name: /Loot on the floor: 12 gold · Weapon \+1/ })).toBeVisible();
  measurements.loot = await capture(page, testInfo, "loot");
  await expectRoomLayout(page, measurements.loot);
  expect(measurements.loot.loot).not.toBeNull();

  await restoreFixture(page, { roomsCleared: 9, monsterHp: 0, weaponLevel: 2, armorLevel: 2, gold: 155, log: ["Kevin offers preparation. Receipts remain a mystery."] });
  await page.getByRole("button", { name: "Visit Kevin" }).click();
  const shop = page.getByRole("dialog", { name: "Kevin's shop" });
  await expect(shop).toBeVisible();
  const weapon = shop.getByRole("button", { name: /WEAPON/ });
  await expect(weapon).toBeVisible();
  await expect(weapon).toBeInViewport();
  measurements["kevin-camp"] = await capture(page, testInfo, "kevin-camp");
  const priceLines = await shop.locator(".practice-kevin-shop").getByText(/^\d+ GOLD$/).evaluateAll(prices => prices.map(price => ({
    height: price.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(price).lineHeight),
  })));
  expect(priceLines).toHaveLength(4);
  for (const price of priceLines) expect(price.height).toBeLessThanOrEqual(price.lineHeight + 1);

  const relicCounts = Array<number>(16).fill(0);
  relicCounts[7] = 1;
  await restoreFixture(page, { roomsCleared: 10, monsterType: 3, monsterHp: 0, monsterMaxHp: 90, hp: 38, gold: 170, weaponLevel: 3, armorLevel: 2, ownedRelics: [7], relicCounts, equippedRelic: 7, relicOfferAvailable: true, relicOfferId: 13, relicOfferRarity: 5, lastPlayerDamage: 18, log: ["Management defeated. A legendary relic joins the compensation discussion."] });
  await expect(page.getByRole("heading", { name: "MANAGEMENT DEFEATED" })).toBeVisible();
  measurements["boss-reward"] = await capture(page, testInfo, "boss-reward");
  await capture(page, testInfo, "boss-reward", true);

  await restoreFixture(page, { roomsCleared: 13, hp: 0, active: false, monsterType: 2, monsterHp: 20, monsterMaxHp: 75, gold: 38, weaponLevel: 3, armorLevel: 2, ownedRelics: [7], relicCounts, equippedRelic: 7, log: ["The dungeon has declined your request for an extension."] });
  await expect(page.getByRole("heading", { name: "You cleared 13 rooms.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "SAVE IMAGE", exact: true })).toBeEnabled();
  const cardPreview = page.getByRole("img", { name: /^Delveworn Practice run card\./ });
  await expect(cardPreview).toBeVisible();
  await expect.poll(() => cardPreview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1200 && image.naturalHeight === 675)).toBe(true);
  const ended = await capture(page, testInfo, "ended-result");
  measurements["ended-result"] = ended;
  expect(ended.runEndLog!.y).toBeGreaterThanOrEqual(ended.runEndSummary!.bottom - 1);
  expect(Math.abs(ended.runEndLog!.x - ended.runEndSummary!.x)).toBeLessThanOrEqual(1);
  if (ended.viewport.width > 900) {
    expect(ended.runEndSummary!.x + ended.runEndSummary!.width).toBeLessThanOrEqual(ended.runCard!.x);
    expect(ended.runEndLog!.x + ended.runEndLog!.width).toBeLessThanOrEqual(ended.runCard!.x);
  } else {
    expect(ended.runCard!.y).toBeGreaterThanOrEqual(ended.runEndSummary!.bottom - 1);
    expect(ended.runCard!.width).toBeLessThanOrEqual(ended.viewport.width);
    expect(ended.runEndLog!.y).toBeGreaterThanOrEqual(ended.runCard!.bottom - 1);
  }
  await capture(page, testInfo, "ended-result", true);

  const screenshotDir = process.env.DELVEWORN_SCREENSHOT_DIR;
  const path = screenshotDir ? join(screenshotDir, testInfo.project.name, "layout-measurements.json") : testInfo.outputPath("layout-measurements.json");
  await writeFile(path, JSON.stringify({ syntheticPracticeFixtures: true, profile: testInfo.project.name, states: measurements }, null, 2));
  await testInfo.attach("layout-measurements", { path, contentType: "application/json" });
});

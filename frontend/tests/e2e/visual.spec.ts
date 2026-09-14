import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
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

async function restoreFixture(page: Page, overrides: Partial<PracticeGame>) {
  let serialized = "";
  expect(savePracticeRun({
    getItem: () => null,
    setItem: (_key, value) => { serialized = value; },
  }, { ...base, ...overrides })).toBe("saved");
  await page.evaluate(({ key, serialized }) => localStorage.setItem(key, serialized), {
    key: PRACTICE_RUN_STORAGE_KEY,
    serialized,
  });
  await page.goto("/practice");
  await page.getByRole("button", { name: "Dismiss restore notice" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".practice-hud")).toBeInViewport();
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
      const element = document.querySelector(selector);
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
      header: bounds(".practice-header"),
      hud: bounds(".practice-hud"),
      progress: bounds(".practice-room-progress"),
      monster: bounds(".practice-monster-stage"),
      monsterName: bounds(".practice-monster-heading"),
      enemyHp: bounds(".practice-enemy-hp-label"),
      dock: bounds(".practice-action-dock"),
      storm: bounds(".practice-storm-action"),
      attack: bounds(".practice-attack-action"),
      potion: bounds(".practice-potion-action"),
      recoveryArt: bounds(".recovery-art"),
      recoveryDetails: bounds(".recovery-details"),
      recoveryPanel: bounds(".recovery-panel"),
      recoveryNext: bounds(".recovery-next"),
      recoveryResources: bounds(".recovery-resources"),
      recoveryHeal: bounds(".recovery-heal"),
      recoveryRelics: bounds(".recovery-relics"),
      recoveryLog: bounds(".recovery-log"),
      recoveryThumbnail: bounds(".recovery-thumbnail"),
      shop: bounds(".practice-kevin-shop"),
      reward: bounds(".boss-reward-view"),
      result: bounds(".practice-result-view"),
      runEndSummary: bounds(".run-end-summary"),
      runEndLog: bounds(".run-end-log"),
      runCard: bounds(".run-card-panel"),
    };
  });
}

async function expectRecoveryLayout(page: Page, layout: Awaited<ReturnType<typeof capture>>, artwork: RegExp) {
  const recovery = page.locator(".dungeon-recovery");
  const details = recovery.locator(".recovery-details");
  const art = recovery.locator(".recovery-art");
  const thumbnail = recovery.locator(".recovery-thumbnail");
  await expect(details.locator(".recovery-panel")).toBeVisible();
  await expect(details.locator(".recovery-next")).toBeVisible();
  await expect(details.locator(".recovery-resources")).toBeVisible();
  await expect(details.locator(".recovery-heal")).toBeVisible();
  await expect(details.locator(".recovery-log")).toBeVisible();
  const controls = [layout.recoveryPanel!, layout.recoveryNext!, layout.recoveryResources!, layout.recoveryHeal!, layout.recoveryLog!];
  if (layout.shop) controls.push(layout.shop);
  if (layout.recoveryRelics) {
    controls.push(layout.recoveryRelics);
    await expect(details.locator(".relic-collection")).not.toBeVisible();
  }
  for (const control of controls) {
    expect(control.x).toBeGreaterThanOrEqual(layout.recoveryDetails!.x - 1);
    expect(control.x + control.width).toBeLessThanOrEqual(layout.recoveryDetails!.x + layout.recoveryDetails!.width + 1);
  }
  expect(layout.recoveryLog!.y).toBeGreaterThanOrEqual(layout.recoveryPanel!.bottom - 1);
  if (layout.viewport.width > 800) {
    await expect(art).toBeVisible();
    await expect(thumbnail).not.toBeVisible();
    expect(layout.recoveryArt!.width).toBeGreaterThanOrEqual(300);
    expect(layout.recoveryArt!.height).toBeGreaterThanOrEqual(300);
    expect(layout.recoveryArt!.x + layout.recoveryArt!.width).toBeLessThanOrEqual(layout.recoveryDetails!.x + 1);
    expect(layout.recoveryNext!.bottom).toBeLessThanOrEqual(layout.recoveryResources!.y + 1);
  } else {
    await expect(art).not.toBeVisible();
    if (layout.recoveryThumbnail) {
      await expect(thumbnail).toBeVisible();
      expect(layout.recoveryThumbnail.width).toBeLessThanOrEqual(65);
    } else {
      await expect(recovery.locator(".recovery-merchant img")).toBeVisible();
    }
    expect(layout.recoveryNext!.y).toBeGreaterThanOrEqual(layout.recoveryHeal!.bottom - 1);
    expect(layout.recoveryNext!.bottom).toBeLessThanOrEqual(layout.recoveryLog!.y + 1);
  }
  const visibleArt = layout.viewport.width > 800
    ? art.locator("img")
    : recovery.locator(layout.recoveryThumbnail ? ".recovery-thumbnail img" : ".recovery-merchant img");
  await expect(visibleArt).toBeVisible();
  await expect(visibleArt).toHaveAttribute("src", artwork);
  expect(await visibleArt.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
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
  expect(combat.monster?.height).toBeGreaterThanOrEqual(testInfo.project.name === "desktop-chromium" ? 200 : 150);
  expect(combat.enemyHp!.bottom).toBeLessThanOrEqual(combat.dock!.y);
  expect(combat.storm!.x).toBeLessThan(combat.attack!.x);
  expect(combat.potion!.y).toBeGreaterThanOrEqual(Math.max(combat.storm!.bottom, combat.attack!.bottom));
  expect(Math.abs(combat.potion!.x - combat.storm!.x)).toBeLessThan(1);
  expect(Math.abs(combat.potion!.width - (combat.attack!.x + combat.attack!.width - combat.storm!.x))).toBeLessThan(1);
  if (testInfo.project.name === "desktop-chromium") {
    expect(combat.dock!.x).toBeGreaterThanOrEqual(combat.monster!.x + combat.monster!.width);
  }
  if (testInfo.project.name !== "desktop-chromium") {
    expect(combat.monsterName!.y).toBeGreaterThanOrEqual(combat.hud!.bottom);
    expect(combat.monsterName!.bottom).toBeLessThanOrEqual(combat.dock!.y);
    expect(combat.dock!.bottom).toBeLessThanOrEqual(combat.viewport.height + 1);
    const clearArtTop = Math.max(combat.monster!.y, combat.enemyHp!.bottom);
    const clearArtBottom = Math.min(combat.monster!.bottom, combat.dock!.y);
    expect(clearArtBottom - clearArtTop).toBeGreaterThanOrEqual(150);
  }

  await restoreFixture(page, { roomsCleared: 3, monsterHp: 0, lastLootType: 3, lastLootAmount: 1, weaponLevel: 1, lastPlayerDamage: 14, log: ["Room 3 cleared. A weapon upgrade survived the paperwork."] });
  await expect(page.getByRole("heading", { name: "Loot secured: Weapon +1", exact: true })).toBeVisible();
  measurements.loot = await capture(page, testInfo, "loot");
  await expectRecoveryLayout(page, measurements.loot, /\/assets\/loot\/weapon-v1\.webp$/);

  await restoreFixture(page, { roomsCleared: 9, monsterHp: 0, weaponLevel: 2, armorLevel: 2, gold: 155, log: ["Kevin offers preparation. Receipts remain a mystery."] });
  const weapon = page.getByRole("button", { name: /WEAPON/ });
  await expect(weapon).toBeVisible();
  await expect(weapon).toBeInViewport();
  await expect(page.getByRole("progressbar", { name: "Player health" })).toBeInViewport();
  measurements["kevin-camp"] = await capture(page, testInfo, "kevin-camp");
  await expectRecoveryLayout(page, measurements["kevin-camp"], /\/characters\/merchant-quartermaster-kevin\.webp/);
  const priceLines = await page.locator(".practice-kevin-shop").getByText(/^\d+ GOLD$/).evaluateAll(prices => prices.map(price => ({
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

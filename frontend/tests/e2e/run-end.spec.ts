import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { isStoredPracticeGame, PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

async function seedEndedRun(page: Page) {
  const relicCounts = Array<number>(16).fill(0);
  relicCounts[7] = 3;
  const game: PracticeGame = {
    ...EMPTY_GAME, hasStarted: true, active: false, hp: 0, roomsCleared: 13,
    monsterType: 2, monsterHp: 20, monsterMaxHp: 75, gold: 92,
    weaponLevel: 3, armorLevel: 2, ownedRelics: [7], relicCounts, equippedRelic: 7,
    log: ["The dungeon has declined your request for an extension."],
  };
  expect(isStoredPracticeGame(game)).toBe(true);
  // Every Playwright test starts with its own browser context. The session flag
  // makes reload exercise the app's persisted result instead of reseeding it.
  await page.addInitScript(({ key, game }) => {
    if (!sessionStorage.getItem("run-end-fixture")) {
      localStorage.setItem(key, JSON.stringify({ version: 1, game }));
      sessionStorage.setItem("run-end-fixture", "1");
    }
  }, { key: PRACTICE_RUN_STORAGE_KEY, game });
  await page.goto("/practice");
  await page.getByRole("button", { name: "Dismiss restore notice", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You cleared 13 rooms.", exact: true })).toBeVisible();
  return game;
}

const storedRun = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).game as PracticeGame, PRACTICE_RUN_STORAGE_KEY);

test("ended run exports the displayed branded PNG and preserves its saved result", async ({ page }, testInfo) => {
  const game = await seedEndedRun(page);
  const end = page.locator(".dungeon-run-end");
  const card = page.getByRole("region", { name: "Shareable Delveworn run card", exact: true });
  const preview = card.getByRole("img", { name: /^Delveworn Practice run card\./ });
  await expect(end.getByText("RUN ENDED", { exact: true })).toBeVisible();
  await expect(end.locator(".run-end-log")).toContainText(game.log[0]);
  await expect(page.locator(".relic-collection")).not.toBeVisible();
  await expect(page.locator(".practice-run-summary")).not.toBeVisible();
  const save = card.getByRole("button", { name: "SAVE IMAGE", exact: true });
  await expect(save).toBeEnabled();
  await expect(preview).toBeVisible();
  const description = await preview.getAttribute("alt");
  for (const statistic of ["Room reached 14", "enemies defeated 13", "bosses defeated 1", "gold remaining 92",
    "weapon level 3", "armor level 2", "relic Gilded Hunger", "1 unique relic", "3 total relic drops",
    "LOCAL PRACTICE", "SELF-REPORTED", "NO ONCHAIN REWARDS"]) expect(description).toContain(statistic);
  const dataUrl = await preview.getAttribute("src");
  expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1200 && image.naturalHeight === 675)).toBe(true);

  const downloadEvent = page.waitForEvent("download");
  await save.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("delveworn-practice-room-14.png");
  expect(await download.failure()).toBeNull();
  const file = await download.path();
  expect(file).not.toBeNull();
  const png = await readFile(file!);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(675);
  expect(png.subarray(-8, -4).toString("ascii")).toBe("IEND");
  expect(png.byteLength).toBeGreaterThan(10_000);
  expect(png.equals(Buffer.from(dataUrl!.split(",")[1], "base64"))).toBe(true);
  await testInfo.attach("practice-run-card.png", { body: png, contentType: "image/png" });
  const exportDirectory = process.env.DELVEWORN_RUN_CARD_DIR;
  if (exportDirectory && testInfo.project.name === "desktop-chromium") {
    await mkdir(exportDirectory, { recursive: true });
    await download.saveAs(join(exportDirectory, "practice-example.png"));
  }
  expect(await storedRun(page)).toEqual(game);
  await page.reload();
  await expect(page.getByRole("heading", { name: "You cleared 13 rooms.", exact: true })).toBeVisible();
  await expect(save).toBeEnabled();
  await expect(preview).toHaveAttribute("alt", description!);
  expect(await storedRun(page)).toEqual(game);
});

test("missing run-card artwork reports a retry without blocking the next run", async ({ page }) => {
  const artwork = "**/assets/delveworn-tier2-party-hero.webp";
  let blockedRequests = 0;
  await page.route(artwork, route => { blockedRequests += 1; return route.abort("failed"); });
  const game = await seedEndedRun(page);
  const card = page.getByRole("region", { name: "Shareable Delveworn run card", exact: true });
  await expect(card.getByRole("status")).toHaveText("The run card could not be created. Your result is safe; retry the image below.");
  expect(blockedRequests).toBeGreaterThan(0);
  await expect(card.getByRole("button", { name: "SAVE IMAGE", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "BEGIN NEW RUN", exact: true })).toBeEnabled();
  expect(await storedRun(page)).toEqual(game);

  await page.unroute(artwork);
  await card.getByRole("button", { name: "RETRY IMAGE", exact: true }).click();
  const save = card.getByRole("button", { name: "SAVE IMAGE", exact: true });
  await expect(save).toBeEnabled();
  await expect(card.getByRole("button", { name: "RETRY IMAGE", exact: true })).not.toBeVisible();
  const preview = card.getByRole("img", { name: /^Delveworn Practice run card\./ });
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1200)).toBe(true);
  const downloadEvent = page.waitForEvent("download");
  await save.click();
  const download = await downloadEvent;
  expect(await download.failure()).toBeNull();
  const file = await download.path();
  expect(file).not.toBeNull();
  const png = await readFile(file!);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.equals(Buffer.from((await preview.getAttribute("src"))!.split(",")[1], "base64"))).toBe(true);
  expect(await storedRun(page)).toEqual(game);
});

test("keyboard selects BEGIN NEW RUN and immediately saves a fresh playable run", async ({ page }) => {
  await seedEndedRun(page);
  const begin = page.getByRole("button", { name: "BEGIN NEW RUN", exact: true });
  await expect(begin).toBeEnabled();
  await page.keyboard.press("ArrowRight");
  await expect(begin).toBeFocused();
  await page.keyboard.press("Enter");
  const started = await storedRun(page);
  expect(started.hasStarted).toBe(true);
  expect(started.active).toBe(true);
  expect(started.hp).toBe(100);
  expect(started.maxHp).toBe(100);
  expect(started.roomsCleared).toBe(0);
  expect(started.monsterHp).toBeGreaterThan(0);
  expect(started.gold).toBe(0);
  expect(started.potions).toBe(3);
  expect(started.weaponLevel).toBe(0);
  expect(started.armorLevel).toBe(0);
  expect(started.equippedRelic).toBe(0);
  expect(started.ownedRelics).toEqual([]);
  expect(started.relicCounts.every(count => count === 0)).toBe(true);
  await expect(page.getByRole("button", { name: /⚔️ ATTACK/ })).toBeEnabled();
  await expect(page.locator(".dungeon-run-end")).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /⚔️ ATTACK/ })).toBeEnabled();
  expect(await storedRun(page)).toEqual(started);
});

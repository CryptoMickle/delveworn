import { expect, test, type Locator, type Page } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { createPracticeGrid, type PracticeGridState } from "../../app/practice/grid-state";
import { isStoredPracticeGame, PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

async function restore(page: Page, overrides: Partial<PracticeGame> = {}, dismiss = true, grid?: PracticeGridState) {
  const game = { ...EMPTY_GAME, hasStarted: true, active: true, hp: 60, monsterHp: 9999, monsterMaxHp: 9999, armorLevel: 5, gold: 200, log: [], ...overrides };
  expect(isStoredPracticeGame(game)).toBe(true);
  await page.goto("/practice");
  // This is a fresh Playwright context, never the user's saved browser session.
  await page.evaluate(({ key, game, grid }) => localStorage.setItem(key, JSON.stringify({ version: 1, game, ...(grid ? { grid } : {}) })), { key: PRACTICE_RUN_STORAGE_KEY, game, grid });
  await page.reload();
  await expect(page.locator(".endless-room, .practice-result-view").first()).toBeVisible();
  if (dismiss) {
    const visibleDismiss = page.locator('button[aria-label="Dismiss restore notice"]:visible');
    if (await visibleDismiss.count() === 0) await page.getByRole("button", { name: "Run status · view details" }).click();
    await page.locator('button[aria-label="Dismiss restore notice"]:visible').first().click();
    const status = page.getByRole("dialog", { name: "Run status" });
    if (await status.isVisible()) await status.getByRole("button", { name: "Close Run status" }).click();
  }
}

const storedRun = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).game as PracticeGame, PRACTICE_RUN_STORAGE_KEY);
const attack = (page: Page) => page.getByRole("button", { name: /⚔️ ATTACK/ });
const storm = (page: Page) => page.getByRole("button", { name: /⚡ STORM/ });
const potion = (page: Page) => page.getByRole("button", { name: /POTION ·/ });
const resetFocus = (page: Page) => page.locator(".endless-room, main").first().evaluate(element => { (element as HTMLElement).tabIndex = -1; (element as HTMLElement).focus({ preventScroll: true }); });

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

async function expectVisibleFocus(control: Locator) {
  await expect(control).toBeFocused();
  await expect.poll(() => control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(centerX, centerY);
    return centerX >= 0 && centerX < innerWidth && centerY >= 0 && centerY < innerHeight && Boolean(hit && element.contains(hit));
  })).toBe(true);
}

test("recovery WASD walks the floor and E uses the door only after arrival", async ({ page }, info) => {
  const viewport = page.viewportSize()!;
  const widths = info.project.name === "desktop-chromium" ? [820, 1365, 1920] : [viewport.width];
  for (const width of widths) {
    await page.setViewportSize({ width, height: viewport.height });
    await restore(page, { roomsCleared: 3, monsterHp: 0 });
    const before = await storedRun(page);
    const avatar = page.locator("[data-avatar-position]");
    const start = await avatar.getAttribute("data-avatar-position");
    await page.keyboard.down("a");
    try { await expect.poll(() => avatar.getAttribute("data-avatar-position")).not.toBe(start); }
    finally { await page.keyboard.up("a"); }
    expect(await storedRun(page)).toEqual(before);
    await page.keyboard.press("e");
    await expect(page.locator(".endless-room")).toHaveAttribute("data-descent-phase", "explore");
    expect((await storedRun(page)).roomsCleared).toBe(3);
    const enteredAt = await avatar.getAttribute("data-avatar-position");
    await page.keyboard.down("d");
    try { await expect.poll(() => avatar.getAttribute("data-avatar-position")).not.toBe(enteredAt); }
    finally { await page.keyboard.up("d"); }
    expect((await storedRun(page)).roomsCleared).toBe(3);
  }
});

test("WASD moves from page focus while arrows focus Approach and Enter walks there", async ({ page }) => {
  await restore(page, {}, true, createPracticeGrid(91));
  const before = await storedRun(page);
  await expect(page.getByLabel("Combat actions")).toHaveCount(0);
  const floor = page.getByRole("group", { name: /Room 1 floor/ });
  const avatar = page.locator("[data-avatar-position]");
  const start = await avatar.getAttribute("data-avatar-position");
  await page.keyboard.down("a");
  try { await expect.poll(() => avatar.getAttribute("data-avatar-position")).not.toBe(start); }
  finally { await page.keyboard.up("a"); }
  expect(await storedRun(page)).toEqual(before);
  const moved = await avatar.getAttribute("data-avatar-position");
  await page.keyboard.press("ArrowRight");
  const approach = page.getByRole("button", { name: /^Approach / });
  await expectVisibleFocus(approach);
  await page.waitForTimeout(120);
  await expect(avatar).toHaveAttribute("data-avatar-position", moved!);

  // A focused floor uses the same focus-only arrow contract as page focus.
  await floor.focus();
  await page.keyboard.press("ArrowLeft");
  await expectVisibleFocus(approach);
  await page.keyboard.press("Enter");
  await expect(page.locator(".endless-room")).toHaveAttribute("data-descent-phase", "combat");
  await expect(attack(page)).toBeEnabled();
});

test("battle arrows stay in the action field and retain the selected vertical lane", async ({ page, browserName }) => {
  await restore(page);
  await resetFocus(page);
  await page.keyboard.press("ArrowRight");
  await expectVisibleFocus(attack(page));
  if (browserName !== "webkit") {
    // Desktop pointer focus anchors the following arrow; mobile WebKit keeps
    // its native touch-focus behavior, which Market Dungeon does not override.
    await attack(page).click();
  }
  await page.keyboard.press("ArrowLeft");
  await expectVisibleFocus(storm(page));
  await page.keyboard.press("ArrowUp");
  await expectVisibleFocus(storm(page));
  await expect(page.getByRole("button", { name: "Open dungeon log" })).not.toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expectVisibleFocus(attack(page));
  await page.keyboard.press("ArrowDown");
  await expectVisibleFocus(potion(page));
  await page.keyboard.press("ArrowUp");
  await expectVisibleFocus(attack(page));
});

test("boss reward arrows enter KEEP from above and EQUIP from below", async ({ page }) => {
  await restore(page, { roomsCleared: 9, monsterType: 3, monsterHp: 1 });
  await resetFocus(page);
  await page.keyboard.press("k");
  await expect(page.locator(".endless-room")).toHaveAttribute("data-descent-phase", "loot");
  await clickRoomPoint(page, { x: 450, y: 65 });
  await expect(page.locator(".endless-room")).toHaveAttribute("data-descent-phase", "reward");
  await expect(page.getByRole("heading", { name: "MANAGEMENT DEFEATED" })).toBeVisible();
  const before = await storedRun(page);
  await page.keyboard.press("ArrowDown");
  await expectVisibleFocus(page.getByRole("button", { name: /^EQUIP / }));
  await resetFocus(page);
  await page.keyboard.press("ArrowUp");
  await expectVisibleFocus(page.getByRole("button", { name: "KEEP NO RELIC" }));
  expect(await storedRun(page)).toEqual(before);
});

test("room entry keeps exploration separate and action focus survives combat mount", async ({ page }) => {
  await restore(page, { roomsCleared: 3, monsterHp: 0 });
  await page.getByRole("button", { name: /Enter room 4/ }).click();
  await expect(page.locator(".endless-room")).toHaveAttribute("data-descent-phase", "explore");
  await expect(page.getByLabel("Combat actions")).toHaveCount(0);
  await page.getByRole("button", { name: /^Approach / }).click();
  await expect(page.locator(".endless-room")).toHaveAttribute("data-descent-phase", "combat");
  await resetFocus(page);
  await page.keyboard.press("ArrowRight");
  await expectVisibleFocus(attack(page));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(attack(page)).toBeFocused();
  const before = await storedRun(page);
  await page.keyboard.press("Enter");
  expect((await storedRun(page)).monsterHp).toBeLessThan(before.monsterHp);
});

test("priority overlay owns arrows and Enter while wallet controls and inputs keep native keys", async ({ page }) => {
  await restore(page);
  await resetFocus(page);
  await page.keyboard.press("ArrowRight");
  await expect(attack(page)).toBeFocused();
  const before = await storedRun(page);
  await page.locator(".endless-room").evaluate(main => {
    const overlay = document.createElement("div");
    overlay.id = "navigation-test-overlay";
    overlay.dataset.keyboardActionScope = "overlay";
    overlay.dataset.keyboardActions = "true";
    overlay.style.cssText = "position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:#090909dd";
    const retry = document.createElement("button");
    retry.textContent = "Retry test action";
    retry.dataset.keyboardDefault = "true";
    retry.dataset.clicks = "0";
    retry.style.cssText = "width:220px;min-height:48px;background:#342243;color:white";
    retry.addEventListener("click", () => { retry.dataset.clicks = String(Number(retry.dataset.clicks) + 1); });
    overlay.append(retry); main.append(overlay);
  });
  await page.keyboard.press("Enter");
  expect(await storedRun(page)).toEqual(before);
  await page.keyboard.press("ArrowRight");
  const retry = page.getByRole("button", { name: "Retry test action" });
  await expectVisibleFocus(retry);
  await page.keyboard.press("Enter");
  await expect(retry).toHaveAttribute("data-clicks", "1");
  expect(await storedRun(page)).toEqual(before);
  await page.locator("#navigation-test-overlay").evaluate(element => element.remove());
  await page.locator(".endless-room").evaluate(main => {
    const wallet = document.createElement("div");
    wallet.dataset.walletControls = "true";
    const button = document.createElement("button");
    button.textContent = "Native wallet test control"; button.dataset.clicks = "0";
    button.addEventListener("click", () => { button.dataset.clicks = String(Number(button.dataset.clicks) + 1); });
    const input = document.createElement("input");
    input.setAttribute("aria-label", "Native editable test field"); input.value = "abcd";
    wallet.append(button); main.append(wallet, input);
  });
  const wallet = page.getByRole("button", { name: "Native wallet test control" });
  await wallet.focus();
  await page.keyboard.press("ArrowRight");
  await expect(wallet).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(wallet).toHaveAttribute("data-clicks", "1");
  const input = page.getByRole("textbox", { name: "Native editable test field" });
  await input.focus();
  await input.evaluate((field: HTMLInputElement) => field.setSelectionRange(2, 2));
  await page.keyboard.press("ArrowLeft");
  await expect(input).toBeFocused();
  expect(await input.evaluate((field: HTMLInputElement) => field.selectionStart)).toBe(1);
  expect(await storedRun(page)).toEqual(before);
});

test("ended-run arrows reach restart, save and copy without entering the long log", async ({ page }) => {
  await restore(page, {
    active: false, hp: 0, roomsCleared: 13,
    log: Array.from({ length: 6 }, (_, index) => `Resolved entry ${index + 1}`),
  });
  const before = await storedRun(page);
  const begin = page.getByRole("button", { name: "BEGIN NEW RUN", exact: true });
  const save = page.getByRole("button", { name: "SAVE IMAGE", exact: true });
  const copy = page.getByRole("button", { name: "COPY LOCAL RESULT", exact: true });
  await expect(save).toBeEnabled();
  await expect.poll(() => page.locator(".run-card-panel img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1200)).toBe(true);
  const earlier = page.getByText("Earlier entries", { exact: true });
  await earlier.click();
  await resetFocus(page);
  await page.keyboard.press("ArrowRight");
  await expectVisibleFocus(begin);
  await page.keyboard.press(page.viewportSize()!.width > 900 ? "ArrowRight" : "ArrowDown");
  await expectVisibleFocus(save);
  const saveBox = (await save.boundingBox())!;
  const copyBox = (await copy.boundingBox())!;
  await page.keyboard.press(copyBox.y >= saveBox.y + saveBox.height - 1 ? "ArrowDown" : "ArrowRight");
  await expectVisibleFocus(copy);
  await page.keyboard.press("ArrowDown");
  await expect(copy).toBeFocused();
  await expect(earlier).not.toBeFocused();
  expect(await storedRun(page)).toEqual(before);
});

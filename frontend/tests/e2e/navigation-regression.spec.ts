import { expect, test, type Locator, type Page } from "@playwright/test";
import { EMPTY_GAME, type PracticeGame } from "../../app/practice/engine";
import { isStoredPracticeGame, PRACTICE_RUN_STORAGE_KEY } from "../../app/practice/storage";

async function restore(page: Page, overrides: Partial<PracticeGame> = {}, dismiss = true) {
  const game = { ...EMPTY_GAME, hasStarted: true, active: true, hp: 60, monsterHp: 9999, monsterMaxHp: 9999, armorLevel: 5, gold: 200, log: [], ...overrides };
  expect(isStoredPracticeGame(game)).toBe(true);
  await page.goto("/practice");
  // This is a fresh Playwright context, never the user's saved browser session.
  await page.evaluate(({ key, game }) => localStorage.setItem(key, JSON.stringify({ version: 1, game })), { key: PRACTICE_RUN_STORAGE_KEY, game });
  await page.reload();
  await expect(page.getByRole("button", { name: "Dismiss restore notice" })).toBeVisible();
  if (dismiss) await page.getByRole("button", { name: "Dismiss restore notice" }).click();
}

const storedRun = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).game as PracticeGame, PRACTICE_RUN_STORAGE_KEY);
const attack = (page: Page) => page.getByRole("button", { name: /⚔️ ATTACK/ });
const storm = (page: Page) => page.getByRole("button", { name: /⚡ STORM/ });
const potion = (page: Page) => page.getByRole("button", { name: /POTION ·/ });
const resetFocus = (page: Page) => page.locator("main").evaluate(element => { element.tabIndex = -1; element.focus({ preventScroll: true }); });

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

test("recovery arrows enter the requested edge and traverse actions without entering log history", async ({ page }, info) => {
  const viewport = page.viewportSize()!;
  const widths = info.project.name === "desktop-chromium" ? [820, 1365, 1920] : [viewport.width];
  const relicCounts = Array<number>(16).fill(0); relicCounts[1] = 1;
  for (const width of widths) {
    await page.setViewportSize({ width, height: viewport.height });
    await restore(page, { roomsCleared: 3, monsterHp: 0, ownedRelics: [1], relicCounts, log: Array.from({ length: 6 }, (_, index) => `Resolved entry ${index + 1}`) });
    const before = await storedRun(page);
    // Opening a long log can scroll the first action under the sticky HUD.
    await page.getByText("Earlier entries", { exact: true }).click();
    await page.mouse.move(0, 0);
    const panel = page.locator(".recovery-panel");
    const controls = await panel.locator("button:visible:enabled, summary:visible").all();
    const positions = await Promise.all(controls.map(async item => ({ item, box: (await item.boundingBox())! })));
    positions.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
    expect(positions).toHaveLength(3);
    for (const direction of ["ArrowDown", "ArrowUp"]) {
      await resetFocus(page);
      await page.keyboard.press(direction);
      const selected = positions[direction === "ArrowUp" ? 0 : 2].item;
      await expectVisibleFocus(selected);
      if (width === 1920 && direction === "ArrowUp") {
        const placement = await selected.evaluate(element => ({
          top: element.getBoundingClientRect().top,
          hudBottom: document.querySelector("[data-keyboard-scroll-header]")!.getBoundingClientRect().bottom,
        }));
        expect(placement.top).toBeGreaterThanOrEqual(placement.hudBottom + 7);
      }
    }
    for (const position of positions.slice(1)) {
      await page.keyboard.press("ArrowDown");
      await expectVisibleFocus(position.item);
    }
    await page.keyboard.press("ArrowDown");
    await expect(positions[2].item).toBeFocused();
    await expect(page.getByText("Earlier entries", { exact: true })).not.toBeFocused();
    expect(await storedRun(page)).toEqual(before);
  }
});

test("arrows re-enter gameplay after restore, sound, HUD and home controls without activating a move", async ({ page }) => {
  await restore(page, {}, false);
  const before = await storedRun(page);
  const dismiss = page.getByRole("button", { name: "Dismiss restore notice" });
  await dismiss.focus();
  await page.keyboard.press("ArrowDown");
  await expectVisibleFocus(attack(page));
  await dismiss.click();
  await page.locator(".delveworn-sound").click();
  await page.keyboard.press("ArrowRight");
  await expectVisibleFocus(attack(page));
  const roomControl = page.locator(".practice-room-status button:visible, .practice-mobile-room button:visible").first();
  await roomControl.focus();
  await page.keyboard.press("ArrowDown");
  await expectVisibleFocus(attack(page));
  const gear = page.locator(".practice-mobile-gear button");
  if (await gear.isVisible()) {
    await gear.focus();
    await page.keyboard.press("ArrowRight");
    await expectVisibleFocus(attack(page));
  }
  await page.getByRole("link", { name: "Delveworn home" }).focus();
  await page.keyboard.press("ArrowRight");
  await expectVisibleFocus(attack(page));
  await expect(page).toHaveURL(/\/practice$/);
  expect(await storedRun(page)).toEqual(before);
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
  await page.keyboard.press("a");
  await expect(page.getByRole("heading", { name: "MANAGEMENT DEFEATED" })).toBeVisible();
  const before = await storedRun(page);
  await page.keyboard.press("ArrowDown");
  await expectVisibleFocus(page.getByRole("button", { name: /^EQUIP / }));
  await resetFocus(page);
  await page.keyboard.press("ArrowUp");
  await expectVisibleFocus(page.getByRole("button", { name: "KEEP NO RELIC" }));
  expect(await storedRun(page)).toEqual(before);
});

test("a first arrow during encounter and boss transitions survives the next frame and Enter still acts", async ({ page }) => {
  for (const phase of ["encounter", "boss-reward"]) {
    await restore(page, phase === "encounter"
      ? { roomsCleared: 3, monsterHp: 0 }
      : { roomsCleared: 9, monsterType: 3, monsterHp: 1 });
    const trigger = page.getByRole("button", { name: phase === "encounter" ? /ENTER ROOM 4/ : /⚔️ ATTACK/ });
    const result = await trigger.evaluate((button: HTMLButtonElement, { selector, arrow }) => new Promise<{ immediately: string | null; afterFrames: string | null }>(resolve => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector(selector)) return;
        observer.disconnect();
        // This delivers the first arrow after the new controls mount but before
        // a previously scheduled animation-frame focus callback could run.
        document.dispatchEvent(new KeyboardEvent("keydown", { key: arrow, bubbles: true }));
        const selected = document.activeElement;
        const immediately = selected instanceof HTMLButtonElement ? selected.textContent : null;
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({
          immediately, afterFrames: document.activeElement === selected ? immediately : null,
        })));
      });
      observer.observe(document.body, { childList: true, subtree: true });
      button.click();
    }), { selector: phase === "encounter" ? ".practice-attack-action" : ".practice-boss-relic-actions", arrow: phase === "encounter" ? "ArrowRight" : "ArrowDown" });
    expect(result.immediately).toMatch(phase === "encounter" ? /ATTACK/ : /EQUIP /);
    expect(result.afterFrames).toBe(result.immediately);
    const before = await storedRun(page);
    await page.keyboard.press("Enter");
    const after = await storedRun(page);
    if (phase === "encounter") expect(after.monsterHp).toBeLessThan(before.monsterHp);
    else {
      expect(after.relicOfferAvailable).toBe(false);
      expect(after.equippedRelic).toBeGreaterThan(0);
    }
  }
});

test("priority overlay owns arrows and Enter while wallet controls and inputs keep native keys", async ({ page }) => {
  await restore(page);
  await resetFocus(page);
  await page.keyboard.press("ArrowRight");
  await expect(attack(page)).toBeFocused();
  const before = await storedRun(page);
  await page.locator("main").evaluate(main => {
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
  await page.locator("main").evaluate(main => {
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

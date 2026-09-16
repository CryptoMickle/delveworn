import { expect, test, type Page } from "@playwright/test";
import {
  applyChallengeAction,
  challengeResult,
  createChallengeProof,
  getChallengeDefinition,
  isChallengeComplete,
  startChallengeRun,
  type ChallengeAction,
  type ChallengeRun,
} from "../../app/challenge/core";

const CHALLENGE_ID = "2026-W38";
const MERCHANT_NAME = "Quartermaster Kevin";

function definition() {
  const value = getChallengeDefinition(CHALLENGE_ID);
  if (!value) throw new Error("Challenge fixture is invalid.");
  return value;
}

function nextAction(run: ChallengeRun): ChallengeAction {
  const game = run.game;
  if (game.monsterHp > 0) {
    const potionLimit = game.monsterType === 3 ? 3 : 2;
    if (game.hp <= 30 && game.potions > 0 && game.combatPotionsUsed < potionLimit) return "potion";
    return "attack";
  }
  if (game.roomsCleared === 5 && !game.supplyBandageUsed && game.hp < game.maxHp && game.gold >= 14) return "supply-bandage";
  if (game.roomsCleared === 5 && game.potions < 3 && game.supplyPotionsBought < 2 && game.gold >= 20) return "supply-potion";
  if (game.roomsCleared === 9 && !game.campRestUsed && game.hp < game.maxHp && game.gold >= 45) return "camp-rest";
  if (game.roomsCleared === 9 && game.potions < 3 && game.campPotionsBought < 2 && game.gold >= 26) return "camp-potion";
  return "next-room";
}

async function clickAction(page: Page, action: ChallengeAction) {
  const button = action === "attack" ? page.getByRole("button", { name: /ATTACK/ })
    : action === "storm" ? page.getByRole("button", { name: /STORM/ })
      : action === "potion" ? page.getByRole("button", { name: /POTION ·/ })
        : action === "next-room" ? page.getByRole("button", { name: /ENTER (?:BOSS )?ROOM/ })
          : action === "supply-bandage" ? page.getByRole("button", { name: /BANDAGE/ })
            : action === "camp-rest" ? page.getByRole("button", { name: /REST/ })
              : action === "camp-weapon" ? page.getByRole("button", { name: /WEAPON/ })
                : action === "camp-armor" ? page.getByRole("button", { name: /ARMOR/ })
                  : page.getByRole("button", { name: /POTION · \d\/2 LEFT/ });
  await expect(button).toBeEnabled();
  await button.click();
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("a player completes the weekly run without a wallet and receives a replay proof", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The full deterministic run only needs one browser engine.");
  await page.goto(`/challenge/${CHALLENGE_ID}`);
  await expect(page.getByText("No wallet · no transaction · one controlled weekly seed")).toBeVisible();
  await page.getByRole("button", { name: `⚔️ START ${CHALLENGE_ID}` }).click();

  let run = startChallengeRun(definition());
  let checkedStandardRecovery = false;
  let checkedSupplyStop = false;
  let checkedBossCamp = false;
  while (!isChallengeComplete(run)) {
    if (run.game.monsterHp === 0) {
      await expect(page.locator(".dungeon-recovery")).toBeVisible();
      await expect(page.locator(".recovery-panel")).toContainText(`ROOM ${run.game.roomsCleared} CLEARED`);
      await expect(page.locator(".recovery-resources")).toBeVisible();
      await expect(page.locator(".recovery-heal")).toBeVisible();
      await expect(page.locator(".recovery-log")).toBeVisible();
      checkedStandardRecovery = true;
      if (run.game.roomsCleared === 5) {
        await expect(page.getByText("SUPPLY STOP · ROOM 5", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: MERCHANT_NAME })).toBeVisible();
        checkedSupplyStop = true;
      }
      if (run.game.roomsCleared === 9) {
        await expect(page.getByText("CAMP BEFORE ROOM 10", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: MERCHANT_NAME })).toBeVisible();
        checkedBossCamp = true;
      }
    }
    const action = nextAction(run);
    await clickAction(page, action);
    run = applyChallengeAction(run, action);
  }

  const result = challengeResult(run);
  expect(checkedStandardRecovery).toBe(true);
  expect(checkedSupplyStop).toBe(true);
  expect(checkedBossCamp).toBe(true);
  await expect(page.getByText("✓ VERIFIED BY DETERMINISTIC REPLAY")).toBeVisible();
  await expect(page.getByRole("heading", { name: `${result.score.toLocaleString("en-US")} points` })).toBeVisible();
  await expect(page.getByRole("link", { name: /Optional Somnia onchain mode/ })).toBeVisible();
  await noOverflow(page);
});

test("two isolated players receive the same encounter and first combat result", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Cross-context determinism only needs one browser engine.");
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  try {
    await Promise.all([
      first.goto(`http://127.0.0.1:3100/challenge/${CHALLENGE_ID}`),
      second.goto(`http://127.0.0.1:3100/challenge/${CHALLENGE_ID}`),
    ]);
    await Promise.all([
      first.getByRole("button", { name: `⚔️ START ${CHALLENGE_ID}` }).click(),
      second.getByRole("button", { name: `⚔️ START ${CHALLENGE_ID}` }).click(),
    ]);
    await expect(first.getByRole("heading", { name: "Grave Belle" })).toBeVisible();
    await expect(second.getByRole("heading", { name: "Grave Belle" })).toBeVisible();
    await Promise.all([
      first.getByRole("button", { name: /ATTACK/ }).click(),
      second.getByRole("button", { name: /ATTACK/ }).click(),
    ]);
    const [firstExchange, secondExchange, firstEnemyHp, secondEnemyHp] = await Promise.all([
      first.getByRole("status", { name: "Last combat exchange" }).innerText(),
      second.getByRole("status", { name: "Last combat exchange" }).innerText(),
      first.getByRole("progressbar", { name: "Enemy health" }).getAttribute("aria-valuenow"),
      second.getByRole("progressbar", { name: "Enemy health" }).getAttribute("aria-valuenow"),
    ]);
    expect(secondExchange).toBe(firstExchange);
    expect(secondEnemyHp).toBe(firstEnemyHp);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});

test("a valid shared link opens the verified result and starts the same challenge", async ({ page }) => {
  let run = startChallengeRun(definition());
  while (!isChallengeComplete(run)) run = applyChallengeAction(run, nextAction(run));
  const verified = await createChallengeProof(run);

  await page.goto(`/challenge/${CHALLENGE_ID}?r=${verified.proof}&ref=${verified.runId}`);
  await expect(page.getByText("✓ VERIFIED BY DETERMINISTIC REPLAY")).toBeVisible();
  await expect(page.getByRole("heading", { name: `${verified.result.score.toLocaleString("en-US")} points` })).toBeVisible();
  await page.getByRole("button", { name: "PLAY THIS CHALLENGE" }).click();
  await expect(page).toHaveURL(new RegExp(`/challenge/${CHALLENGE_ID}\\?ref=${verified.runId}$`));
  await expect(page.getByRole("heading", { name: "Grave Belle" })).toBeVisible();
  await noOverflow(page);
});

test("a changed result payload is rejected before any score is shown", async ({ page }) => {
  let run = startChallengeRun(definition());
  while (!isChallengeComplete(run)) run = applyChallengeAction(run, nextAction(run));
  const verified = await createChallengeProof(run);
  const last = verified.proof.at(-1);
  const tampered = `${verified.proof.slice(0, -1)}${last === "A" ? "B" : "A"}`;

  await page.goto(`/challenge/${CHALLENGE_ID}?r=${tampered}&ref=${verified.runId}`);
  await expect(page.locator(".challenge-error")).toContainText("RESULT REJECTED");
  await expect(page.getByText("✓ VERIFIED BY DETERMINISTIC REPLAY")).not.toBeVisible();
  await expect(page.getByRole("button", { name: `PLAY THE VALID ${CHALLENGE_ID} CHALLENGE` })).toBeEnabled();
  await noOverflow(page);
});

test("a referral without its matching verified result is discarded", async ({ page }) => {
  await page.goto(`/challenge/${CHALLENGE_ID}?ref=012345abcdef`);
  await page.getByRole("button", { name: `⚔️ START ${CHALLENGE_ID}` }).click();
  await expect(page).toHaveURL(new RegExp(`/challenge/${CHALLENGE_ID}$`));
  await expect(page.getByRole("heading", { name: "Grave Belle" })).toBeVisible();
});

test("entry and first combat fit every configured mobile and desktop viewport", async ({ page }) => {
  await page.goto(`/challenge/${CHALLENGE_ID}`);
  await expect(page.getByRole("heading", { name: "The Dungeon Awaits" })).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: `⚔️ START ${CHALLENGE_ID}` }).click();
  await expect(page.getByRole("heading", { name: "Grave Belle" })).toBeVisible();
  let run = startChallengeRun(definition());
  while (run.game.monsterHp > 0) {
    await page.getByRole("button", { name: /ATTACK/ }).click();
    run = applyChallengeAction(run, "attack");
  }
  await expect(page.locator(".dungeon-recovery")).toBeVisible();
  await expect(page.locator(".recovery-panel").getByText("ROOM 1 CLEARED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ENTER ROOM 2" })).toBeVisible();
  await noOverflow(page);
});

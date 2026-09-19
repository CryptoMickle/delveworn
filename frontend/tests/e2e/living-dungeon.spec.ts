import { expect, test, type Page } from "@playwright/test";
import {
  availableLivingDungeonActions,
  createLivingDungeon,
  transitionLivingDungeon,
} from "../../app/living-dungeon/engine";
import type { LivingDungeon, LivingDungeonCommand } from "../../app/living-dungeon/model";
import { LIVING_DUNGEON_SAVE_KEY, isLivingDungeon } from "../../app/living-dungeon/storage";

const initialRun = () => createLivingDungeon(12_345, "living-e2e", "ai");

function apply(run: LivingDungeon, command: LivingDungeonCommand): LivingDungeon {
  const next = transitionLivingDungeon(run, command, run.revision);
  if (next === run) throw new Error(`Living Dungeon fixture rejected ${command.type} during ${run.roomId}/${run.phase}`);
  return next;
}

function bossFixture(): LivingDungeon {
  let run = initialRun();
  const defeat = () => {
    run = apply(run, { type: "engage" });
    while (run.phase === "combat") {
      run = apply(run, run.player.hp <= 35 && run.player.potions > 0 ? { type: "potion" } : { type: "attack" });
    }
  };
  defeat();
  run = apply(run, { type: "continue" });
  run = apply(run, {
    type: "prepare-pact",
    offerSeed: 4,
    intent: {
      desiredBoon: "DEFENSE",
      offeredSacrifice: "NO_STORM",
      durationPreference: "UNTIL_BOSS",
      breachTolerance: "HIGH",
      needsClarification: false,
    },
  });
  run = apply(run, { type: "accept-pact", pactId: run.pendingOffer!.terms.pactId });
  defeat();
  run = apply(run, { type: "continue" });
  run = apply(run, { type: "engage" });
  while (run.phase === "combat" && !availableLivingDungeonActions(run).includes("spare-witness")) {
    run = apply(run, { type: "attack" });
  }
  run = apply(run, { type: "spare-witness" });
  run = apply(run, { type: "continue" });
  run = apply(run, { type: "camp-skip" });
  if (run.roomId !== "boss" || run.phase !== "explore") throw new Error("Boss fixture did not reach the boss entrance");
  return run;
}

async function seed(page: Page, run = initialRun()) {
  expect(isLivingDungeon(run)).toBe(true);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: LIVING_DUNGEON_SAVE_KEY,
    value: JSON.stringify(run),
  });
  await page.goto("/living-dungeon");
  await expect(page.locator("main.living-dungeon")).toBeVisible();
  await expect(page.getByRole("group", { name: new RegExp(`Room ${run.stageIndex + 1} floor`) })).toBeVisible();
}

async function enterThrough(page: Page, name: RegExp, next: RegExp) {
  await page.getByRole("button", { name }).click();
  await expect(page.getByRole("button", { name: next })).toBeVisible();
}

async function resolveCombat(page: Page) {
  const main = page.locator("main.living-dungeon");
  const enemyHealth = page.locator(".living-enemy-status [role='progressbar']");
  for (let turn = 0; turn < 32 && await main.getAttribute("data-descent-phase") === "combat"; turn++) {
    const hp = Number(await main.getAttribute("data-player-hp"));
    const potion = page.getByRole("button", { name: /POTION ·/ });
    if (hp <= 35 && await potion.isEnabled()) {
      const before = await main.getAttribute("data-player-hp");
      await potion.click();
      await expect(main).not.toHaveAttribute("data-player-hp", before!);
    } else {
      const before = await enemyHealth.getAttribute("aria-valuenow");
      await page.getByRole("button", { name: /^⚔️ ATTACK/ }).click();
      await expect.poll(async () => ({
        phase: await main.getAttribute("data-descent-phase"),
        hp: await enemyHealth.getAttribute("aria-valuenow"),
      })).not.toEqual({ phase: "combat", hp: before });
    }
  }
  await expect(main).not.toHaveAttribute("data-descent-phase", "combat");
}

test("home introduces the experiment and opens its separate local run", async ({ page }) => {
  await page.goto("/");
  const mode = page.getByRole("button", { name: "The Living Dungeon · Experimental", exact: true });
  await mode.click();
  await expect(mode).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Make a promise. See who remembers." })).toBeVisible();
  await page.getByRole("button", { name: "ENTER THE LIVING DUNGEON", exact: true }).click();
  await expect(page).toHaveURL(/\/living-dungeon$/);
  await expect(page.getByRole("button", { name: /Approach Grave Attendant/ })).toBeVisible();
});

test("arrow selection and Enter use the same guarded room and combat actions", async ({ page, isMobile }) => {
  test.skip(isMobile, "Hardware-keyboard navigation is covered in the desktop presentation.");
  await seed(page);
  const approach = page.getByRole("button", { name: /Approach Grave Attendant/ });
  await page.keyboard.press("ArrowRight");
  await expect(approach).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main.living-dungeon")).toHaveAttribute("data-descent-phase", "combat");

  const attack = page.getByRole("button", { name: /^⚔️ ATTACK/ });
  await page.keyboard.press("ArrowRight");
  await expect(attack).toBeFocused();
  const enemy = page.locator(".living-enemy-status [role='progressbar']");
  const before = await enemy.getAttribute("aria-valuenow");
  await page.keyboard.press("Enter");
  await expect(enemy).not.toHaveAttribute("aria-valuenow", before!);
});

test("menu fallback completes all six scenes and a forbidden action warns before it happens", async ({ page, isMobile }) => {
  await page.route("**/api/living-dungeon/interpret", async route => {
    const request = route.request().postDataJSON() as { runRevision: number; stateDigest: string; offerSeed: number };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "fallback",
        source: "menu_fallback",
        reason: "not_configured",
        binding: {
          runRevision: request.runRevision,
          stateDigest: request.stateDigest,
          offerSeed: request.offerSeed,
        },
      }),
    });
  });
  await seed(page);

  await enterThrough(page, /Approach Grave Attendant/, /^⚡ STORM/);
  await resolveCombat(page);
  await page.getByRole("button", { name: /Enter room 2/ }).click();
  await expect(page.getByRole("heading", { name: "Shape the rule you must survive" })).toBeVisible();

  await page.getByRole("button", { name: "More protection" }).click();
  await page.getByRole("button", { name: "PROPOSE PACT" }).click();
  await expect(page.getByText("Interpretation is unavailable, so every legal written option is ready below.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose clear terms" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /A ward for a silent storm/ }).click();
  await expect(page.getByRole("region", { name: "Pact terms preview" })).toContainText("Do not use Storm");
  await page.getByRole("button", { name: "ACCEPT THESE TERMS" }).click();

  await enterThrough(page, /Approach Oath Hound/, /^⚡ STORM/);
  const enemyBeforeWarning = await page.locator(".living-enemy-status [role='progressbar']").getAttribute("aria-valuenow");
  await page.getByRole("button", { name: /^⚡ STORM/ }).click();
  const warning = page.getByRole("dialog", { name: "This breaks your promise" });
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "KEEP THE PACT" }).click();
  await expect(page.locator(".living-enemy-status [role='progressbar']")).toHaveAttribute("aria-valuenow", enemyBeforeWarning!);
  await resolveCombat(page);

  await page.getByRole("button", { name: /Enter room 4/ }).click();
  await expect(page.getByRole("button", { name: /Approach Dungeon Scrivener/ })).toBeVisible();
  await enterThrough(page, /Approach Dungeon Scrivener/, /^⚡ STORM/);
  for (let turn = 0; turn < 5 && !await page.getByRole("button", { name: /LET THE SCRIVENER LEAVE/ }).count(); turn++) {
    await page.getByRole("button", { name: /^⚔️ ATTACK/ }).click();
  }
  await page.getByRole("button", { name: /LET THE SCRIVENER LEAVE/ }).click();
  await page.getByRole("button", { name: /Enter room 5/ }).click();
  await expect(page.getByRole("heading", { name: "The stall is open. So is the loophole." })).toBeVisible();
  await page.getByRole("button", { name: "BUY NOTHING · CONTINUE" }).click();

  await expect(page.getByRole("button", { name: /Approach Keeper of Conclusions/ })).toBeVisible();
  await expect(page.locator(isMobile ? ".living-mobile-clue" : ".living-clue")).toContainText(/Fresh iron plates cover the throne|Crimson conductors frame the throne|A row of hooked flasks hangs/);
  await enterThrough(page, /Approach Keeper of Conclusions/, /^⚡ STORM/);
  await resolveCombat(page);
  await expect(page.getByRole("heading", { name: "The dungeon heard you." })).toBeVisible();
  await expect(page.getByText("You reached the end without breaking the promise you chose.")).toBeVisible();
});

test("the boss preparation clue remains readable on a phone without covering the room", async ({ page, isMobile }) => {
  test.skip(!isMobile, "This assertion targets the compact phone HUD.");
  const run = bossFixture();
  await seed(page, run);
  const clue = page.locator(".living-mobile-clue");
  await expect(clue).toBeVisible();
  await expect(clue).toContainText("Fresh iron plates cover the throne");
  await expect(page.getByRole("group", { name: /Room 6 floor/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

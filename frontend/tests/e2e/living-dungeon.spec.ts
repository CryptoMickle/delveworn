import { expect, test, type Page } from "@playwright/test";
import {
  availableLivingDungeonActions,
  createLivingDungeon,
  transitionLivingDungeon,
} from "../../app/living-dungeon/engine";
import {
  improvisationRequestDigest,
  type PlanImprovisationRequest,
  type ShapeWorldRequest,
} from "../../app/living-dungeon/improvisation-ai-contract";
import type { LivingDungeon, LivingDungeonCommand } from "../../app/living-dungeon/model";
import { LIVING_DUNGEON_SAVE_KEY, isLivingDungeon } from "../../app/living-dungeon/storage";

const initialRun = () => createLivingDungeon(12_345, "living-e2e", "ai");

const PROTECTION_SUGGESTION = "Protect me from the boss's first hit; I won't use Storm.";

function apply(run: LivingDungeon, command: LivingDungeonCommand): LivingDungeon {
  const next = transitionLivingDungeon(run, command, run.revision);
  if (next === run) throw new Error(`Living Dungeon fixture rejected ${command.type} during ${run.roomId}/${run.phase}`);
  return next;
}

function pactRoomFixture(): LivingDungeon {
  let run = initialRun();
  run = apply(run, { type: "engage" });
  while (run.phase === "combat") run = apply(run, { type: "attack" });
  run = apply(run, { type: "continue" });
  if (run.roomId !== "pact-room" || run.phase !== "pact") throw new Error("Pact fixture did not reach the Pact Room");
  return run;
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
  await expect(page.getByRole("heading", { name: "Name the victory. The room changes around it." })).toBeVisible();
  await page.getByRole("button", { name: "ENTER THE LIVING DUNGEON", exact: true }).click();
  await expect(page).toHaveURL(/\/living-dungeon\?entry=home$/);
  await expect(page.getByRole("heading", { name: "What kind of victory are you after?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fight normally instead" })).toBeVisible();
});

test("a desired victory reshapes the Witness Gate and compiles prose into an exact playable maneuver", async ({ page, isMobile }) => {
  await page.route("**/api/living-dungeon/shape", async route => {
    const request = route.request().postDataJSON() as ShapeWorldRequest;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "interpreted",
        source: "ai",
        shape: { objective: "RESCUE", method: "CUNNING", boundary: "NO_KILLING", needsClarification: false },
        binding: {
          runRevision: request.runRevision,
          stateDigest: request.stateDigest,
          requestDigest: improvisationRequestDigest(request),
        },
      }),
    });
  });
  await page.route("**/api/living-dungeon/plan", async route => {
    const request = route.request().postDataJSON() as PlanImprovisationRequest;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "interpreted",
        source: "ai",
        plan: { manoeuvreId: "RESCUE_BELL_FEINT", needsClarification: false },
        binding: {
          runRevision: request.runRevision,
          stateDigest: request.stateDigest,
          requestDigest: improvisationRequestDigest(request),
        },
      }),
    });
  });
  await seed(page);

  await page.getByRole("button", { name: "Rescue someone" }).click();
  const intent = page.getByRole("textbox", { name: "Describe your intended victory" });
  await expect(intent).toHaveValue(/free the prisoner/);
  await intent.press("Enter");

  await expect(page.getByRole("heading", { name: "How will you make it happen?" })).toBeVisible();
  await expect(page.getByRole("figure", { name: "The Witness Gate" }).getByText("Free the witness", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Brass tithe bell/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Chained cartographer/ })).toBeVisible();

  const maneuver = page.getByRole("textbox", { name: "Describe your maneuver" });
  await maneuver.fill("I roll gold beneath the brass bell, then free the cartographer while the warden counts it.");
  await page.getByRole("button", { name: "Preview the plan" }).click();

  await expect(page.getByText("Exact compiled preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Buy a false opening" })).toBeVisible();
  await expect(page.getByLabel("Cost")).toContainText("4");
  await expect(page.getByLabel("Success chance")).toContainText("74%");
  await expect(page.getByText("The warden concludes that you create openings through misdirection.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Planned path" })).toBeAttached();

  await page.getByRole("button", { name: "Play this maneuver" }).click();
  await expect.poll(async () => page.locator("main.living-dungeon").getAttribute("data-descent-phase"))
    .toMatch(/^(combat|recovery)$/);
  if (isMobile) {
    await expect(page.locator(".living-mobile-improvisation-outcome")).toContainText(/room accepts your maneuver|maneuver meets resistance/i);
  }
});

test("the Pact Keeper turns a natural-language request into a reviewable exact rule", async ({ page }) => {
  await page.route("**/api/living-dungeon/interpret", async route => {
    const request = route.request().postDataJSON() as { runRevision: number; stateDigest: string; offerSeed: number };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "interpreted",
        source: "ai",
        intent: {
          desiredBoon: "DEFENSE",
          offeredSacrifice: "NO_STORM",
          durationPreference: "UNTIL_BOSS",
          breachTolerance: "HIGH",
          needsClarification: false,
        },
        binding: {
          runRevision: request.runRevision,
          stateDigest: request.stateDigest,
          offerSeed: request.offerSeed,
        },
      }),
    });
  });
  await seed(page, pactRoomFixture());

  await expect(page.getByRole("heading", { name: "Speak your bargain. Check the rule." })).toBeVisible();
  await expect(page.getByText("I can change one rule until the boss falls.")).toBeVisible();

  const composer = page.getByRole("textbox", { name: "What do you want to try?" });
  await page.getByRole("button", { name: PROTECTION_SUGGESTION }).click();
  await expect(composer).toHaveValue(PROTECTION_SUGGESTION);
  await expect(composer).toBeFocused();

  await composer.press("Shift+Enter");
  await expect(composer).toHaveValue(`${PROTECTION_SUGGESTION}\n`);
  await composer.press("Enter");

  const rule = page.locator(".living-exact-rule");
  await expect(rule).toBeVisible();
  await expect(rule).toContainText("PACT OFFER · EXACT GAME RULE");
  await expect(rule).toContainText("Do not use Storm");
  await expect(page.getByRole("list", { name: "Conversation with the Pact Keeper" }).getByText(PROTECTION_SUGGESTION, { exact: true })).toBeVisible();

  await rule.getByRole("button", { name: "CHANGE MY REQUEST" }).click();
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue(`${PROTECTION_SUGGESTION}\n`);

  await rule.getByRole("button", { name: "SEE EVERY POSSIBLE PACT" }).click();
  const readyMade = page.getByRole("region", { name: "Build the pact yourself" });
  await expect(readyMade).toBeVisible();
  await expect(readyMade.getByRole("button", { name: /A ward for a silent storm/ })).toBeVisible();
  await expect(readyMade.getByRole("button", { name: /Power carried through pain/ })).toBeVisible();
  await expect(readyMade.getByRole("button", { name: /Mercy beyond the empty stall/ })).toBeVisible();
});

test("arrow selection and Enter use the same guarded room and combat actions", async ({ page, isMobile }) => {
  test.skip(isMobile, "Hardware-keyboard navigation is covered in the desktop presentation.");
  await seed(page);
  const firstIntent = page.getByRole("button", { name: "Rescue someone" });
  const approach = page.getByRole("button", { name: "Fight normally instead" });
  await page.keyboard.press("ArrowRight");
  await expect(firstIntent).toBeFocused();
  await page.keyboard.press("ArrowDown");
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

  await page.getByRole("button", { name: "Fight normally instead" }).click();
  await expect(page.getByRole("button", { name: /^⚡ STORM/ })).toBeVisible();
  await resolveCombat(page);
  await page.getByRole("button", { name: /Enter room 2/ }).click();
  await expect(page.getByRole("heading", { name: "Speak your bargain. Check the rule." })).toBeVisible();

  await page.getByRole("button", { name: PROTECTION_SUGGESTION }).click();
  await page.getByRole("textbox", { name: "What do you want to try?" }).press("Enter");
  await expect(page.getByText("The Keeper could not shape that request right now. Your words are still here, and every legal pact is available below.")).toBeVisible();
  await page.getByRole("button", { name: /A ward for a silent storm/ }).click();
  await expect(page.locator(".living-exact-rule")).toContainText("Do not use Storm");
  await page.getByRole("button", { name: "ACCEPT PACT" }).click();

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
  await expect(page.getByText("You kept the promise through the final fight.")).toBeVisible();
});

test("the pact composer remains usable without horizontal overflow on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "This assertion targets the compact phone conversation shell.");
  await seed(page, pactRoomFixture());

  const composer = page.getByRole("textbox", { name: "What do you want to try?" });
  await expect(composer).toBeVisible();
  const fontSize = await composer.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
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

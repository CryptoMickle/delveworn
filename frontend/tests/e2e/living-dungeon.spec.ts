import { expect, test, type Page } from "@playwright/test";
import type { MindRequest } from "../../app/living-dungeon/mind/ai-contract";

async function begin(page: Page) {
  await page.goto("/living-dungeon");
  await page.getByRole("button", { name: "◇ Protect the innocent before me", exact: true }).click();
  await expect(page.getByText("THIS IS HOW I UNDERSTAND IT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yes. Remember it that way →", exact: true }).click();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", "1");
}
async function commit(page: Page) {
  await expect(page.getByRole("button", { name: "Execute the plan →", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Execute the plan →", exact: true }).click();
  await expect(page.getByText("PLAN IN MOTION", { exact: true })).toBeVisible();
  await expect(page.getByText("PLAN IN MOTION", { exact: true })).not.toBeVisible({ timeout: 25000 });
}
async function rescue(page: Page, learned: boolean) {
  if (learned) {
    await page.getByRole("tab", { name: "The relic", exact: true }).click();
    await page.getByRole("button", { name: "Use in this room ↗", exact: true }).click();
  } else await page.getByRole("button", { name: /01 Create a hidden opening/ }).click();
  await commit(page);
}
async function descend(page: Page, room: number) {
  const walk = page.getByRole("button", { name: "Go to the stairs →", exact: true });
  if (await walk.isVisible()) { await walk.click(); await commit(page); }
  await page.getByRole("button", { name: "Go deeper ↓", exact: true }).click();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-room", String(room + 1));
}

test("first lesson, visible future, physical rescue, custom maneuver and reload", async ({ page }) => {
  await begin(page);
  await rescue(page, false);
  await expect(page.getByRole("heading", { name: "Who gets to tell the story?", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "The relic", exact: true }).click();
  await page.getByLabel("Name your maneuver").fill("A Door Without Blood");
  await page.getByRole("button", { name: "Remember the maneuver", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A Door Without Blood", exact: true })).toBeVisible();
  const revision = await page.getByTestId("mind-game").getAttribute("data-revision");
  await page.reload();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", revision!);
  await page.getByRole("tab", { name: "The relic", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A Door Without Blood", exact: true })).toBeVisible();
  await descend(page, 0);
  await rescue(page, true);
  await page.getByRole("tab", { name: "The relic", exact: true }).click();
  await expect(page.getByText("2 USES · 2 ROOM TYPES", { exact: true })).toBeVisible();
});

test("keyboard, mouse or touch target, mobile layout and reduced motion", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await begin(page);
  const game = page.getByTestId("mind-game"), before = Number(await game.getAttribute("data-revision"));
  await page.getByRole("group", { name: /^Dungeon floor/ }).press("w");
  await expect(game).toHaveAttribute("data-revision", String(before + 1));
  await page.getByRole("group", { name: /^Dungeon floor/ }).press("ArrowDown");
  await expect(game).toHaveAttribute("data-revision", String(before + 2));
  const bell = page.locator('[data-entity="distraction"]');
  if (isMobile) await bell.tap(); else await bell.click();
  await expect(page.getByRole("heading", { name: "The Tithe Bell", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Distract ＋", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const rect = await page.getByTestId("mind-board").boundingBox();
  expect(rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const animations = await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running").length);
  expect(animations).toBe(0);
});

test("AI timeout/failure leaves immediate movement and authored plans available", async ({ page }) => {
  await page.route("**/api/living-dungeon/mind", route => route.fulfill({ status: 503, body: "unavailable" }));
  await begin(page);
  await page.locator("summary").filter({ hasText: "Describe your own plan" }).click();
  await page.getByLabel("What are you trying to do?").fill("Use the bell to free the captive without harming the guard.");
  await page.getByRole("button", { name: "Show a possible future ↗", exact: true }).click();
  await expect(page.getByText(/The words cannot reach me just now/)).toBeVisible();
  await rescue(page, false);
});

test("stale AI reply cannot replace a plan after the player moves", async ({ page }) => {
  let release: (() => void) | undefined;
  let received = false;
  await page.route("**/api/living-dungeon/mind", async route => {
    const request = route.request().postDataJSON() as MindRequest;
    received = true;
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ source: "ai", binding: request.binding, plan: null, teaching: null, family: null, line: "An old future.", reason: null, usage: null }) });
  });
  await begin(page);
  await page.locator("summary").filter({ hasText: "Describe your own plan" }).click();
  await page.getByLabel("What are you trying to do?").fill("Create a distraction.");
  await page.getByRole("button", { name: "Show a possible future ↗", exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await page.getByRole("group", { name: /^Dungeon floor/ }).press("w");
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", "2");
  release!();
  await expect(page.getByRole("button", { name: "Show a possible future ↗", exact: true })).toBeEnabled();
  await expect(page.getByText("An old future.", { exact: true })).not.toBeVisible();
});

test("full expedition: public Storm, private maneuver, corrected learning, Echo and continuation", async ({ page }, testInfo) => {
  test.setTimeout(240000);
  await begin(page);
  for (let room = 0; room < 12; room++) {
    await expect(page.locator('[data-room-art]')).toHaveAttribute("href", /\/(dungeon)\/.+\.webp$/);
    if (room === 4 || room === 11) await page.getByTestId("mind-board").screenshot({ path: testInfo.outputPath(`painted-room-${room}.png`) });
    if (room === 2) {
      await page.getByRole("tab", { name: "The relic", exact: true }).click();
      await page.getByRole("button", { name: "No. The captive must actually go free.", exact: true }).click();
      await page.getByRole("tab", { name: "Possibilities", exact: true }).click();
    }
    if ([4, 5, 7, 10].includes(room)) {
      for (let i = 0; i < 2; i++) {
        const before = Number(await page.getByTestId("mind-game").getAttribute("data-revision"));
        await page.getByRole("button", { name: "ϟ Storm 4 energy", exact: true }).click();
        const approve = page.getByRole("button", { name: "Execute the plan →", exact: true });
        await expect.poll(async () => Number(await page.getByTestId("mind-game").getAttribute("data-revision")) > before || await approve.isVisible()).toBe(true);
        if (await approve.isVisible()) await commit(page);
      }
    }
    if (room === 11) {
      // Two physical turns allow the relic to make its independent, learned opening.
      await page.getByRole("group", { name: /^Dungeon floor/ }).press("w");
      await expect(page.getByTestId("mind-board")).toHaveAttribute("data-turn", "1");
      await page.getByRole("group", { name: /^Dungeon floor/ }).press("s");
      await expect(page.getByTestId("mind-board")).toHaveAttribute("data-turn", "2");
    }
    await rescue(page, room > 0);
    if (room === 0) {
      await page.getByRole("tab", { name: "The relic", exact: true }).click();
      await page.getByRole("button", { name: "Remember the maneuver", exact: true }).click();
      const beforeCorrection = Number(await page.getByTestId("mind-game").getAttribute("data-revision"));
      await page.getByRole("button", { name: "Correct: Freedom, without harming the guard", exact: true }).click();
      await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", String(beforeCorrection + 1));
      await expect(page.getByText("The relic learned this boundary.", { exact: true })).toBeVisible();
    }
    if (room === 11) {
      for (let i = 0; i < 10 && !await page.getByRole("heading", { name: "It was certain. You were not finished.", exact: true }).isVisible(); i++) {
        await page.getByRole("button", { name: "◐ Hide 1 turn", exact: true }).click();
        await page.getByRole("button", { name: "╱ Attack 1 turn", exact: true }).click();
        const approve = page.getByRole("button", { name: "Execute the plan →", exact: true });
        if (await approve.isVisible()) await commit(page);
      }
      await expect(page.getByRole("heading", { name: "It was certain. You were not finished.", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Traces", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Why the Echo broke", exact: true })).toBeVisible();
      await expect(page.getByText(/The relic used the principle behind/).first()).toBeVisible();
      await expect(page.getByText(/The Echo guards your public strategy/).first()).toBeVisible();
    }
    await descend(page, room);
  }
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-room", "12");
  await rescue(page, true);
  const guide = page.getByRole("region", { name: "Next step", exact: true });
  for (let turn = 0; turn < 16; turn++) {
    if (await guide.getByRole("heading", { name: "Room complete", exact: true }).isVisible()) break;
    await guide.getByRole("button", { name: /^(Show a suggested plan|Show the way to the stairs|Preview a turn at the stairs) →$/ }).click();
    await commit(page);
  }
  await expect(guide.getByRole("heading", { name: "Room complete", exact: true })).toBeVisible();
  await descend(page, 12);
  await page.reload();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-room", "13");
});

test("painted art loads and floor hit targets still match movement", async ({ page, isMobile }, testInfo) => {
  const artLoaded = Promise.all(["/living-dungeon/mind-atlas-v1.webp", "/dungeon/adventurer.webp", "/dungeon/stone-room.webp"].map(path => page.waitForResponse(response => response.url().endsWith(path) && response.ok())));
  await begin(page);
  await artLoaded;
  await expect(page.getByTestId("mind-board")).toHaveAttribute("data-art-version", "painted-1");
  const game = page.getByTestId("mind-game"), revision = Number(await game.getAttribute("data-revision"));
  const north = page.locator('[data-cell="2,5"]');
  if (isMobile) await north.tap(); else await north.click();
  await expect(game).toHaveAttribute("data-revision", String(revision + 1));
  await page.locator('[data-entity="player"]').click();
  await expect(page.getByRole("heading", { name: "You", exact: true })).toBeVisible();
  await page.getByRole("region", { name: "Next step", exact: true }).getByRole("button", { name: "Show a rescue plan →", exact: true }).click();
  await expect(page.getByRole("button", { name: "Execute the plan →", exact: true })).toBeEnabled();
  await page.getByTestId("mind-board").screenshot({ path: testInfo.outputPath("painted-plan.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("home and other mode links remain available", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "The Living Dungeon · Experimental", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Teach the relic. Deceive the dungeon.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ENTER THE LIVING DUNGEON", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The Mind Beneath.", exact: true })).toBeVisible();
});


test("next-step guide carries a new player through rescue, memory, exit and correction", async ({ page }) => {
  test.setTimeout(90000);
  await begin(page);
  const guide = page.getByRole("region", { name: "Next step", exact: true });
  await expect(guide.getByRole("heading", { name: "Preview a rescue", exact: true })).toBeVisible();
  await expect(page.getByLabel("What are you trying to do?")).not.toBeVisible();
  await guide.getByRole("button", { name: "Show a rescue plan →", exact: true }).click();
  await expect(guide.getByText("This is only a preview", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mind-board")).toHaveAttribute("data-turn", "0");
  await expect(page.getByLabel("Map key")).toContainText("Amber: someone can see you");
  await commit(page);
  await expect(guide).toContainText("The rescue can become your own ability");
  await page.reload();
  await guide.getByRole("button", { name: "Remember “Quiet Mercy” →", exact: true }).click();
  await expect(guide).toContainText("First room complete");
  await guide.getByRole("button", { name: "Show the way to the stairs →", exact: true }).click();
  await commit(page);
  await guide.getByRole("button", { name: "Continue to the next room →", exact: true }).click();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-room", "1");
  await guide.getByRole("button", { name: "Try your maneuver here →", exact: true }).click();
  await commit(page);
  await descend(page, 1);
  await expect(guide).toContainText("The relic misunderstood");
  await guide.getByRole("button", { name: "Correct the lesson →", exact: true }).click();
  await expect(guide).toContainText("Find a way through the room");
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.getByRole("heading", { name: "One room. One plan. Who saw it?", exact: true })).toBeVisible();
  const revision = await page.getByTestId("mind-game").getAttribute("data-revision");
  await page.locator("#mind-how-to > summary").press("ArrowDown");
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", revision!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("an existing Norwegian memory resumes its approved plan in English", async ({ page }) => {
  const { createRun, transition } = await import("../../app/living-dungeon/mind/legacy-v2/engine");
  const { bind, hash } = await import("../../app/living-dungeon/mind/legacy-v2/protocol");
  let old = transition(createRun(31, "browser-legacy-memory"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
  old = transition(old, { type: "commit", plan: { id: "old-approved-plan", name: "En mulig framtid", binding: bind(old), boundary: "none", steps: [{ verb: "WAIT" }, { verb: "WAIT" }] } });
  old = transition(old, { type: "step" });
  const data = { version: 2, rules: "mind-beneath-1", runId: old.runId, seed: old.seed, revision: old.revision, journal: old.journal };
  await page.addInitScript(save => localStorage.setItem("delveworn:mind-beneath:v2", save), JSON.stringify({ ...data, checksum: hash(data) }));
  await page.goto("/living-dungeon");
  await expect(page.getByTestId("mind-game")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", "3");
  await expect(page.getByRole("heading", { name: "The plan is paused", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue here", exact: true }).click();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", "4");
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("delveworn:mind-beneath:v2")!).version)).toBe(4);
});


test("choosing a local preview cancels an older AI future at the same world revision", async ({ page }) => {
  let release: (() => void) | undefined;
  let received = false;
  await page.route("**/api/living-dungeon/mind", async route => {
    const request = route.request().postDataJSON() as MindRequest; received = true;
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ source: "ai", binding: request.binding, plan: { id: "late", name: "The overwritten choice", binding: request.binding, boundary: "none", steps: [{ verb: "WAIT" }] }, teaching: null, family: null, line: "An old future.", reason: null, usage: null }) });
  });
  await begin(page);
  await page.locator("summary").filter({ hasText: "Describe your own plan" }).click();
  await page.getByLabel("What are you trying to do?").fill("Think of an opening.");
  await page.getByRole("button", { name: "Show a possible future ↗", exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await page.getByRole("button", { name: /01 Create a hidden opening/ }).click();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", "1");
  release!();
  await expect(page.getByRole("heading", { name: "Create a hidden opening", exact: true })).toBeVisible();
  await expect(page.getByText("The overwritten choice", { exact: true })).not.toBeVisible();
  await commit(page);
  await expect(page.getByRole("button", { name: "Release ＋", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "First room complete", exact: true })).toHaveCount(0);
  await expect(page.getByText("The rescue can become your own ability", { exact: true })).toBeVisible();
});

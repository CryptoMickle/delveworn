import { expect, test } from "@playwright/test";
import { phase } from "../../app/descent/model";
import { createWeeklyDescent, createWeeklyDescentProof, getWeeklyDescentDefinition, isWeeklyDescentComplete, replayWeeklyDescent, transitionWeeklyDescent, weeklyDescentShareUrl } from "../../app/descent/weekly";
import { weeklyDescentSaveKey } from "../../app/descent/weekly-storage";
import { informedPolicy } from "../helpers/descent-policy";

const id = "2026-W38";
const href = `/challenge/${id}?v=2`;

async function finished() {
  let run = createWeeklyDescent(getWeeklyDescentDefinition(id)!, "weekly-ui-fixture");
  for (let step = 0; step < 320 && !isWeeklyDescentComplete(run); step++) {
    run = transitionWeeklyDescent(run, informedPolicy(run));
  }
  if (!isWeeklyDescentComplete(run)) throw new Error("Fixture did not finish");
  return { run, verified: await createWeeklyDescentProof(run) };
}

test("weekly grid starts wallet-free, accepts Enter and replays the saved actions", async ({ page }) => {
  const forbidden: string[] = [];
  page.on("request", request => {
    if (/somnia|thirdweb|walletconnect|eth_(call|send)/i.test(request.url() + (request.postData() ?? ""))) forbidden.push(request.url());
  });
  await page.goto(href);
  await page.getByRole("button", { name: /Start run/ }).press("Enter");
  const main = page.locator("main[data-challenge-id]");
  await expect(main).toHaveAttribute("data-rules-version", "2");
  await expect(main).toHaveAttribute("data-descent-phase", "explore");
  await page.getByRole("button", { name: /Approach/ }).press("Enter");
  await expect(main).toHaveAttribute("data-descent-phase", "combat");
  const before = await main.getAttribute("data-descent-revision");
  await page.getByRole("button", { name: /^⚔️ ATTACK/ }).click();
  await expect(main).not.toHaveAttribute("data-descent-revision", before!);
  const revision = await main.getAttribute("data-descent-revision");
  await page.reload();
  await expect(main).toHaveAttribute("data-descent-phase", "combat");
  await expect(main).toHaveAttribute("data-descent-revision", revision!);
  await expect(page.getByRole("button", { name: /HP AFTER POTION/ })).toBeVisible();
  expect(forbidden).toEqual([]);
});

test("door bypass records the missed reward and enters the next room", async ({ page }) => {
  await page.goto(href);
  await page.getByRole("button", { name: /Start run/ }).click();
  await page.getByRole("button", { name: /Approach/ }).click();
  const main = page.locator("main[data-challenge-id]");
  await expect(main).toHaveAttribute("data-descent-phase", "combat");
  for (let turn = 0; turn < 8 && await main.getAttribute("data-descent-phase") === "combat"; turn++) {
    const before = await main.getAttribute("data-descent-revision");
    await page.getByRole("button", { name: /^⚔️ ATTACK/ }).click();
    await expect(main).not.toHaveAttribute("data-descent-revision", before!);
  }
  await expect(main).toHaveAttribute("data-descent-phase", "loot");
  const floor = page.getByRole("group", { name: /Room 1 floor/ });
  await floor.getByText("NEXT ROOM ↑", { exact: true }).click();
  await expect(page.getByRole("group", { name: /Room 2 floor/ })).toBeVisible();
  const snapshot = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), weeklyDescentSaveKey(id));
  expect(snapshot.actions).toContain("X");
  // The replayed result, not a guessed local gold value, proves forfeiture.
  expect(replayWeeklyDescent(getWeeklyDescentDefinition(id)!, snapshot.runId, [...snapshot.actions]).game.gold).toBe(0);
});

test("shared result preserves the friend's target after a reload", async ({ page }) => {
  const { verified } = await finished();
  const link = weeklyDescentShareUrl("http://127.0.0.1:3100", verified);
  await page.goto(link);
  await expect(page.getByText("✓ Verified by replay", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try to beat this", exact: true }).click();
  await page.getByRole("button", { name: /Start run/ }).click();
  await page.reload();
  await expect(page.locator("main[data-challenge-id]")).toHaveAttribute("data-descent-phase", "explore");
  // The target is in the desktop heading and the mobile menu.
  await expect(page.locator("main")).toContainText(verified.result.score.toLocaleString("en-US"));
});

test("tampered and wrong-version shared results never display a verified score", async ({ page }) => {
  const { verified } = await finished();
  const invalid = `${verified.proof.slice(0, -1)}!`;
  await page.goto(`${href}&r=${encodeURIComponent(invalid)}`);
  await expect(page.getByRole("heading", { name: "This result could not be verified." })).toBeVisible();
  await expect(page.getByText("✓ Verified by replay", { exact: true })).toHaveCount(0);
  await page.goto(`/challenge/${id}?v=99&r=${encodeURIComponent(verified.proof)}`);
  await expect(page.getByText("✓ Verified by replay", { exact: true })).toHaveCount(0);
});

test("only a fully settled ten-room run offers Practice continuation", async ({ page }) => {
  const { run } = await finished();
  test.skip(phase(run) !== "won", "This week's test-player policy did not clear the dungeon.");
  await page.addInitScript(({ key, run }) => {
    if (sessionStorage.getItem("weekly-fixture")) return;
    localStorage.setItem(key, JSON.stringify({ id: run.weekly.challengeId, runId: run.runId, actions: run.weekly.actions.join("") }));
    sessionStorage.setItem("weekly-fixture", "1");
  }, { key: weeklyDescentSaveKey(id), run });
  await page.goto(href);
  await expect(page.getByText("✓ Verified by replay", { exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Continue to Room 11 in Practice", exact: true }).click();
  await expect(page.getByRole("group", { name: /Room 11 floor/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: /Room 11 floor/ })).toBeVisible();
});

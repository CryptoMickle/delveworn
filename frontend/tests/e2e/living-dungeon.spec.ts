import { expect, test, type Page } from "@playwright/test";
import type { MindRequest } from "../../app/living-dungeon/mind/ai-contract";

async function begin(page: Page) {
  await page.goto("/living-dungeon");
  await page.getByRole("button", { name: "◇ Beskytt uskyldige før meg", exact: true }).click();
  await expect(page.getByText("SLIK FORSTÅR JEG DET", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ja. Husk det slik →", exact: true }).click();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", "1");
}
async function commit(page: Page) {
  await expect(page.getByRole("button", { name: "Utfør planen →", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Utfør planen →", exact: true }).click();
  await expect(page.getByText("PLANEN SKJER", { exact: true })).toBeVisible();
  await expect(page.getByText("PLANEN SKJER", { exact: true })).not.toBeVisible({ timeout: 25000 });
}
async function rescue(page: Page, learned: boolean) {
  if (learned) {
    await page.getByRole("tab", { name: "Relikvien", exact: true }).click();
    await page.getByRole("button", { name: "Bruk i dette rommet ↗", exact: true }).click();
  } else await page.getByRole("button", { name: /01 Skap en skjult åpning/ }).click();
  await commit(page);
}
async function descend(page: Page, room: number) {
  const walk = page.getByRole("button", { name: "Gå til trappen →", exact: true });
  if (await walk.isVisible()) { await walk.click(); await commit(page); }
  await page.getByRole("button", { name: "Gå dypere ↓", exact: true }).click();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-room", String(room + 1));
}

test("first lesson, visible future, physical rescue, custom maneuver and reload", async ({ page }) => {
  await begin(page);
  await rescue(page, false);
  await expect(page.getByRole("heading", { name: "Hvem får fortelle historien?", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Relikvien", exact: true }).click();
  await page.getByLabel("Gi manøveren et navn").fill("En dør uten blod");
  await page.getByRole("button", { name: "Bevar manøveren", exact: true }).click();
  await expect(page.getByRole("heading", { name: "En dør uten blod", exact: true })).toBeVisible();
  const revision = await page.getByTestId("mind-game").getAttribute("data-revision");
  await page.reload();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", revision!);
  await page.getByRole("tab", { name: "Relikvien", exact: true }).click();
  await expect(page.getByRole("heading", { name: "En dør uten blod", exact: true })).toBeVisible();
  await descend(page, 0);
  await rescue(page, true);
  await page.getByRole("tab", { name: "Relikvien", exact: true }).click();
  await expect(page.getByText("2 BRUK · 2 SLAGS ROM", { exact: true })).toBeVisible();
});

test("keyboard, mouse or touch target, mobile layout and reduced motion", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await begin(page);
  const game = page.getByTestId("mind-game"), before = Number(await game.getAttribute("data-revision"));
  await page.getByRole("group", { name: /^Dungeonens gulv/ }).press("w");
  await expect(game).toHaveAttribute("data-revision", String(before + 1));
  await page.getByRole("group", { name: /^Dungeonens gulv/ }).press("ArrowDown");
  await expect(game).toHaveAttribute("data-revision", String(before + 2));
  const bell = page.locator('[data-entity="distraction"]');
  if (isMobile) await bell.tap(); else await bell.click();
  await expect(page.getByRole("heading", { name: "Tiendeklokken", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Avled ＋", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const rect = await page.getByTestId("mind-board").boundingBox();
  expect(rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const animations = await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running").length);
  expect(animations).toBe(0);
});

test("AI timeout/failure leaves immediate movement and authored plans available", async ({ page }) => {
  await page.route("**/api/living-dungeon/mind", route => route.fulfill({ status: 503, body: "unavailable" }));
  await begin(page);
  await page.locator("summary").filter({ hasText: "Beskriv en egen plan" }).click();
  await page.getByLabel("Hva prøver du å få til?").fill("Bruk klokken til å hjelpe fangen uten at vokteren skades.");
  await page.getByRole("button", { name: "Vis en mulig framtid ↗", exact: true }).click();
  await expect(page.getByText(/Ordene når ikke fram akkurat nå/)).toBeVisible();
  await rescue(page, false);
});

test("stale AI reply cannot replace a plan after the player moves", async ({ page }) => {
  let release: (() => void) | undefined;
  let received = false;
  await page.route("**/api/living-dungeon/mind", async route => {
    const request = route.request().postDataJSON() as MindRequest;
    received = true;
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ source: "ai", binding: request.binding, plan: null, teaching: null, family: null, line: "En gammel framtid.", reason: null, usage: null }) });
  });
  await begin(page);
  await page.locator("summary").filter({ hasText: "Beskriv en egen plan" }).click();
  await page.getByLabel("Hva prøver du å få til?").fill("Lag en avledning.");
  await page.getByRole("button", { name: "Vis en mulig framtid ↗", exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await page.getByRole("group", { name: /^Dungeonens gulv/ }).press("w");
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", "2");
  release!();
  await expect(page.getByText("Rommet endret seg mens jeg tenkte. Velg en ny åpning.", { exact: true })).toBeVisible();
  await expect(page.getByText("En gammel framtid.", { exact: true })).not.toBeVisible();
});

test("full expedition: public Storm, private maneuver, corrected learning, Echo and continuation", async ({ page }) => {
  test.setTimeout(240000);
  await begin(page);
  for (let room = 0; room < 12; room++) {
    if (room === 2) {
      await page.getByRole("tab", { name: "Relikvien", exact: true }).click();
      await page.getByRole("button", { name: "Nei. Personen må faktisk komme fri.", exact: true }).click();
      await page.getByRole("tab", { name: "Muligheter", exact: true }).click();
    }
    if ([4, 5, 7, 10].includes(room)) {
      for (let i = 0; i < 2; i++) {
        const before = Number(await page.getByTestId("mind-game").getAttribute("data-revision"));
        await page.getByRole("button", { name: "ϟ Storm 4 energi", exact: true }).click();
        const approve = page.getByRole("button", { name: "Utfør planen →", exact: true });
        await expect.poll(async () => Number(await page.getByTestId("mind-game").getAttribute("data-revision")) > before || await approve.isVisible()).toBe(true);
        if (await approve.isVisible()) await commit(page);
      }
    }
    if (room === 11) {
      // Two physical turns allow the relic to make its independent, learned opening.
      await page.getByRole("group", { name: /^Dungeonens gulv/ }).press("w");
      await expect(page.getByTestId("mind-board")).toHaveAttribute("data-turn", "1");
      await page.getByRole("group", { name: /^Dungeonens gulv/ }).press("s");
      await expect(page.getByTestId("mind-board")).toHaveAttribute("data-turn", "2");
    }
    await rescue(page, room > 0);
    if (room === 0) {
      await page.getByRole("tab", { name: "Relikvien", exact: true }).click();
      await page.getByRole("button", { name: "Bevar manøveren", exact: true }).click();
      await page.getByRole("button", { name: "Korriger: Frihet, uten å skade vokteren", exact: true }).click();
    }
    if (room === 11) {
      for (let i = 0; i < 10 && !await page.getByRole("heading", { name: "Den var sikker. Du var ikke ferdig.", exact: true }).isVisible(); i++) {
        await page.getByRole("button", { name: "◐ Skjul 1 tur", exact: true }).click();
        await page.getByRole("button", { name: "╱ Attack 1 tur", exact: true }).click();
        const approve = page.getByRole("button", { name: "Utfør planen →", exact: true });
        if (await approve.isVisible()) await commit(page);
      }
      await expect(page.getByRole("heading", { name: "Den var sikker. Du var ikke ferdig.", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Spor", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Hvorfor ekkoet brast", exact: true })).toBeVisible();
      await expect(page.getByText(/Relikvien brukte prinsippet i/).first()).toBeVisible();
      await expect(page.getByText(/Ekkoet vokter den offentlige strategien/).first()).toBeVisible();
    }
    await descend(page, room);
  }
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-room", "12");
  await rescue(page, true);
  const guide = page.getByRole("region", { name: "Neste steg", exact: true });
  for (let turn = 0; turn < 16; turn++) {
    if (await guide.getByRole("heading", { name: "Rommet er løst", exact: true }).isVisible()) break;
    await guide.getByRole("button", { name: /^(Vis et planforslag|Vis veien til trappen|Se én tur ved trappen) →$/ }).click();
    await commit(page);
  }
  await expect(guide.getByRole("heading", { name: "Rommet er løst", exact: true })).toBeVisible();
  await descend(page, 12);
  await page.reload();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-room", "13");
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
  const guide = page.getByRole("region", { name: "Neste steg", exact: true });
  await expect(guide.getByRole("heading", { name: "Se en redningsplan", exact: true })).toBeVisible();
  await expect(page.getByLabel("Hva prøver du å få til?")).not.toBeVisible();
  await guide.getByRole("button", { name: "Vis en redningsplan →", exact: true }).click();
  await expect(guide.getByText("Dette er bare en forhåndsvisning", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mind-board")).toHaveAttribute("data-turn", "0");
  await expect(page.getByLabel("Tegnforklaring")).toContainText("Ravfarget: noen kan se deg");
  await commit(page);
  await expect(guide).toContainText("Redningen kan bli din egen evne");
  await page.reload();
  await guide.getByRole("button", { name: "Bevar «Stille nåde» →", exact: true }).click();
  await expect(guide).toContainText("Første rom er løst");
  await guide.getByRole("button", { name: "Vis veien til trappen →", exact: true }).click();
  await commit(page);
  await guide.getByRole("button", { name: "Fortsett til neste rom →", exact: true }).click();
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-room", "1");
  await guide.getByRole("button", { name: "Prøv manøveren her →", exact: true }).click();
  await commit(page);
  await descend(page, 1);
  await expect(guide).toContainText("Relikvien har misforstått");
  await guide.getByRole("button", { name: "Korriger lærdommen →", exact: true }).click();
  await expect(guide).toContainText("Finn en vei gjennom rommet");
  await page.getByRole("button", { name: "Slik spiller du", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Et rom. En plan. Hvem så det?", exact: true })).toBeVisible();
  const revision = await page.getByTestId("mind-game").getAttribute("data-revision");
  await page.locator("#mind-how-to > summary").press("ArrowDown");
  await expect(page.getByTestId("mind-game")).toHaveAttribute("data-revision", revision!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

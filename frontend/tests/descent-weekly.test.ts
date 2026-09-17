import assert from "node:assert/strict";
import test from "node:test";
import { campPrices, supplyPrices } from "../app/practice/engine";
import { phase, type DescentAction } from "../app/descent/model";
import { DESCENT_SAVE_KEY } from "../app/descent/storage";
import { CHALLENGE_RUN_STORAGE_PREFIX } from "../app/challenge/storage";
import {
  WEEKLY_DESCENT_ACTIONS,
  WEEKLY_DESCENT_MAX_ACTIONS,
  createWeeklyDescent,
  createWeeklyDescentProof,
  getWeeklyDescentDefinition,
  isWeeklyDescentComplete,
  replayWeeklyDescent,
  transitionWeeklyDescent,
  verifyWeeklyDescentProof,
  weeklyDescentIdForDate,
  weeklyDescentResult,
  weeklyDescentScore,
  weeklyDescentShareUrl,
  type WeeklyDescent,
  type WeeklyDescentActionCode,
} from "../app/descent/weekly";
import {
  loadWeeklyDescent,
  saveWeeklyDescent,
  weeklyDescentSaveKey,
} from "../app/descent/weekly-storage";

function definition(id = "2026-W38") {
  const value = getWeeklyDescentDefinition(id);
  assert.ok(value);
  return value;
}

function nextWinningAction(run: WeeklyDescent): DescentAction {
  const current = phase(run);
  const game = run.game;
  if (current === "explore") return "engage";
  if (current === "loot") return "collect";
  if (current === "reward") return "claim-equip";
  if (current === "recovery") {
    if (game.roomsCleared === 5) {
      const prices = supplyPrices(game);
      if (!game.supplyBandageUsed && game.hp < game.maxHp && game.gold >= prices.bandage) return "supply-bandage";
      if (game.supplyPotionsBought < 2 && game.potions < 3 && game.gold >= prices.potion) return "supply-potion";
    }
    if (game.roomsCleared === 9) {
      const prices = campPrices(game);
      if (!game.campRestUsed && game.hp < game.maxHp && game.gold >= prices.rest) return "camp-rest";
      if (game.weaponLevel < 2 && game.gold >= prices.weapon) return "camp-weapon";
      if (game.armorLevel < 1 && game.gold >= prices.armor) return "camp-armor";
      if (game.campPotionsBought < 2 && game.potions < 3 && game.gold >= prices.potion) return "camp-potion";
    }
    if (game.hp <= game.maxHp - 25 && game.potions > 0) return "potion";
    return "enter";
  }
  if (game.hp <= 32 && game.potions > 0
    && game.combatPotionsUsed < (game.monsterType === 3 ? 3 : 2)) return "potion";
  return "attack";
}

function completeWinningRun(id = "2026-W38", runId = "local-run"): WeeklyDescent {
  let run = createWeeklyDescent(definition(id), runId);
  for (let step = 0; step < WEEKLY_DESCENT_MAX_ACTIONS && !isWeeklyDescentComplete(run); step += 1) {
    const next = transitionWeeklyDescent(run, nextWinningAction(run));
    assert.notStrictEqual(next, run, `winning policy stalled in ${phase(run)}`);
    run = next;
  }
  assert.equal(phase(run), "won");
  return run;
}

function completeLosingRun(): WeeklyDescent {
  let run = createWeeklyDescent(definition(), "loss-run");
  while (!isWeeklyDescentComplete(run)) {
    const current = phase(run);
    const action: DescentAction = current === "explore" ? "engage"
      : current === "loot" ? "collect"
        : current === "recovery" ? "enter"
          : "attack";
    run = transitionWeeklyDescent(run, action);
  }
  return run;
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    source: () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    }),
    values,
  };
}

async function proofWithActions(id: string, actionString: string): Promise<string> {
  const canonical = JSON.stringify(["delveworn-weekly-proof", 2, id, actionString]);
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const digest = Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
  return Buffer.from(JSON.stringify([2, id, actionString, digest])).toString("base64url");
}

test("weekly v2 uses the V1 ISO calendar window with its own stable seed", () => {
  assert.equal(weeklyDescentIdForDate(new Date("2026-09-20T23:59:59.999Z")), "2026-W38");
  assert.deepEqual(definition(), {
    id: "2026-W38",
    rulesVersion: 2,
    seed: 505350170,
    startsAt: "2026-09-14T00:00:00.000Z",
    endsAt: "2026-09-21T00:00:00.000Z",
    targetRooms: 10,
  });
  assert.equal(getWeeklyDescentDefinition("2026-W54"), null);
  assert.equal(getWeeklyDescentDefinition("week-38"), null);
  assert.notEqual(definition().seed, definition("2026-W39").seed);
});

test("accepted descent actions are compactly traced and rejected actions preserve identity", () => {
  const started = createWeeklyDescent(definition(), "trace-run");
  assert.strictEqual(transitionWeeklyDescent(started, "attack"), started);
  const engaged = transitionWeeklyDescent(started, "engage");
  const attacked = transitionWeeklyDescent(engaged, "attack");
  assert.deepEqual(attacked.weekly.actions, ["E", "A"]);
  assert.deepEqual(replayWeeklyDescent(definition(), "trace-run", attacked.weekly.actions), attacked);
  assert.throws(
    () => replayWeeklyDescent(definition(), "trace-run", ["N"]),
    /illegal in this state/i
  );
  assert.throws(
    () => replayWeeklyDescent(definition(), "trace-run", ["?"] as unknown as WeeklyDescentActionCode[]),
    /unknown action/i
  );

  const capped: WeeklyDescent = {
    ...started,
    weekly: { ...started.weekly, actions: Array(WEEKLY_DESCENT_MAX_ACTIONS).fill("E") },
  };
  assert.strictEqual(transitionWeeklyDescent(capped, "engage"), capped);
  assert.deepEqual(new Set(Object.values(WEEKLY_DESCENT_ACTIONS)), new Set<DescentAction>([
    "engage", "attack", "storm", "potion", "enter", "collect", "skip-loot",
    "claim", "claim-equip", "supply-bandage", "supply-potion", "camp-rest",
    "camp-potion", "camp-weapon", "camp-armor",
  ]));
});

test("a weekly run ends only after death or the boss loot and relic decisions resolve", () => {
  const won = completeWinningRun();
  assert.equal(won.game.roomsCleared, 10);
  assert.equal(phase(won), "won");
  assert.ok(won.weekly.actions.includes("L"), "loot collection is in the replay trace");
  assert.ok(won.weekly.actions.includes("Q"), "the relic decision is in the replay trace");

  const lost = completeLosingRun();
  assert.equal(phase(lost), "lost");
  assert.deepEqual(weeklyDescentResult(lost).outcome, "defeated");
  assert.strictEqual(transitionWeeklyDescent(lost, "attack"), lost);
});

test("the exact score formula charges combat turns rather than interaction actions", () => {
  const run = completeWinningRun();
  const game = run.game;
  const exact = Math.max(0,
    game.roomsCleared * 10_000
      + 5_000
      + Math.max(0, game.hp) * 20
      + game.gold * 5
      + game.potions * 100
      + (game.weaponLevel + game.armorLevel) * 250
      - run.turns * 10
  );
  assert.equal(weeklyDescentScore(run), exact);
  assert.equal(weeklyDescentResult(run).score, exact);
  assert.equal(weeklyDescentScore({
    ...run,
    weekly: { ...run.weekly, actions: [...run.weekly.actions, "E", "L", "N"] },
  }), exact, "extra interaction trace entries do not affect score");
  assert.equal(weeklyDescentScore({ ...run, turns: run.turns + 1 }), exact - 10);
});

test("proofs rebuild the v2 run, reject schema and action tampering, and make v2 share URLs", async () => {
  const completed = completeWinningRun();
  const created = await createWeeklyDescentProof(completed);
  assert.deepEqual(created.result, {
    challengeId: "2026-W38", rulesVersion: 2, seed: 505350170, score: 107190,
    outcome: "cleared", roomsCleared: 10, hp: 50, gold: 104, potions: 1,
    weaponLevel: 2, armorLevel: 2, relicId: 9, combatTurns: 43, actionCount: 80,
  });
  assert.equal(completed.weekly.actions.join(""), "EAAALNEAALNEAAAAAALPPNEAAALNEAAALBNEAAALNEAAALPNEAAAAALPNEAAAAALRCNEAAAAAAPAPALQ");
  assert.equal(created.runId, "6d1d6bc9cd73");
  assert.equal(created.proof, "WzIsIjIwMjYtVzM4IiwiRUFBQUxORUFBTE5FQUFBQUFBTFBQTkVBQUFMTkVBQUFMQk5FQUFBTE5FQUFBTFBORUFBQUFBTFBORUFBQUFBTFJDTkVBQUFBQUFQQVBBTFEiLCI2ZDFkNmJjOWNkNzM3MGJiYzM0MWZlM2M1YjEyMWY2YTljMTkxYzMxZWJjM2FmNzBhM2I5OGJjNjFmYjI2Y2U2Il0");
  const verified = await verifyWeeklyDescentProof("2026-W38", created.proof);
  assert.deepEqual(verified, created);
  assert.equal(created.run.runId, created.runId);
  assert.equal(created.runId.length, 12);

  const url = new URL(weeklyDescentShareUrl("https://delveworn.app", created));
  assert.equal(url.pathname, "/challenge/2026-W38");
  assert.equal(url.searchParams.get("v"), "2");
  assert.equal(url.searchParams.get("r"), created.proof);
  assert.equal(url.searchParams.get("ref"), created.runId);

  const last = created.proof.at(-1);
  const tampered = `${created.proof.slice(0, -1)}${last === "A" ? "B" : "A"}`;
  await assert.rejects(() => verifyWeeklyDescentProof("2026-W38", tampered));
  await assert.rejects(
    () => verifyWeeklyDescentProof("2026-W39", created.proof),
    /different weekly challenge/i
  );
  await assert.rejects(
    () => verifyWeeklyDescentProof("2026-W38", Buffer.from(JSON.stringify([2, "2026-W38", "", "0".repeat(64), "extra"])).toString("base64url")),
    /unsupported schema/i
  );
  const illegalStart = await proofWithActions("2026-W38", "N");
  await assert.rejects(
    () => verifyWeeklyDescentProof("2026-W38", illegalStart),
    /illegal in this state/i
  );
  const postTerminal = `${completed.weekly.actions.join("")}A`;
  const postTerminalProof = await proofWithActions("2026-W38", postTerminal);
  await assert.rejects(
    () => verifyWeeklyDescentProof("2026-W38", postTerminalProof),
    /illegal in this state/i
  );
});

test("weekly storage persists only replay inputs and rejects stale, malformed, or illegal saves", () => {
  const storage = memoryStorage();
  const id = definition().id;
  const v1Descent = "existing first descent";
  const v1Challenge = "existing weekly v1";
  storage.values.set(DESCENT_SAVE_KEY, v1Descent);
  storage.values.set(`${CHALLENGE_RUN_STORAGE_PREFIX}${id}`, v1Challenge);

  const started = createWeeklyDescent(definition(), "save-run");
  assert.equal(saveWeeklyDescent(storage.source, started, null), "saved");
  assert.deepEqual(JSON.parse(storage.values.get(weeklyDescentSaveKey(id))!), {
    id,
    runId: "save-run",
    actions: "",
  });
  assert.deepEqual(loadWeeklyDescent(storage.source, id), { status: "restored", run: started });
  assert.equal(storage.values.get(DESCENT_SAVE_KEY), v1Descent);
  assert.equal(storage.values.get(`${CHALLENGE_RUN_STORAGE_PREFIX}${id}`), v1Challenge);

  const engaged = transitionWeeklyDescent(started, "engage");
  assert.equal(saveWeeklyDescent(storage.source, engaged, started), "saved");
  assert.equal(saveWeeklyDescent(storage.source, engaged, started), "conflict");
  assert.deepEqual(loadWeeklyDescent(storage.source, id), { status: "restored", run: engaged });

  const key = weeklyDescentSaveKey(id);
  storage.values.set(key, JSON.stringify({ id, runId: "save-run", actions: "N" }));
  assert.equal(loadWeeklyDescent(storage.source, id).status, "invalid");
  assert.equal(saveWeeklyDescent(storage.source, started, null), "conflict");
  assert.equal(JSON.parse(storage.values.get(key)!).actions, "N");
  assert.equal(saveWeeklyDescent(storage.source, started, null, true), "saved");

  storage.values.set(key, JSON.stringify({ id, runId: "save-run", actions: "", score: 999999 }));
  assert.equal(loadWeeklyDescent(storage.source, id).status, "invalid");
  assert.equal(loadWeeklyDescent(() => { throw new Error("blocked"); }, id).status, "unavailable");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  applyChallengeAction,
  challengeIdForDate,
  challengeShareUrl,
  createChallengeProof,
  getChallengeDefinition,
  isChallengeComplete,
  replayChallenge,
  startChallengeRun,
  verifyChallengeProof,
  type ChallengeAction,
  type ChallengeRun,
} from "./core";
import { loadChallengeRun, saveChallengeRun } from "./storage";
import { registerChallengeCompletion, registerChallengeStart } from "./analytics";

function definition(id = "2026-W38") {
  const value = getChallengeDefinition(id);
  assert.ok(value);
  return value;
}

function actionFor(run: ChallengeRun): ChallengeAction {
  const game = run.game;
  if (game.monsterHp > 0) {
    const limit = game.monsterType === 3 ? 3 : 2;
    if (game.hp <= 30 && game.potions > 0 && game.combatPotionsUsed < limit) return "potion";
    return "attack";
  }
  if (game.roomsCleared === 5 && !game.supplyBandageUsed && game.hp < game.maxHp && game.gold >= 14) {
    return "supply-bandage";
  }
  if (game.roomsCleared === 5 && game.potions < 3 && game.supplyPotionsBought < 2 && game.gold >= 20) {
    return "supply-potion";
  }
  if (game.roomsCleared === 9 && !game.campRestUsed && game.hp < game.maxHp && game.gold >= 45) {
    return "camp-rest";
  }
  if (game.roomsCleared === 9 && game.potions < 3 && game.campPotionsBought < 2 && game.gold >= 26) {
    return "camp-potion";
  }
  return "next-room";
}

function completeRun(id = "2026-W38"): ChallengeRun {
  let run = startChallengeRun(definition(id));
  while (!isChallengeComplete(run)) run = applyChallengeAction(run, actionFor(run));
  return run;
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
    values,
  };
}

test("ISO challenge IDs use a Monday-to-Monday UTC window and stable seed", () => {
  assert.equal(challengeIdForDate(new Date("2026-09-14T00:00:00.000Z")), "2026-W38");
  assert.equal(challengeIdForDate(new Date("2026-09-20T23:59:59.999Z")), "2026-W38");
  assert.equal(challengeIdForDate(new Date("2026-09-21T00:00:00.000Z")), "2026-W39");
  const first = definition();
  assert.equal(first.startsAt, "2026-09-14T00:00:00.000Z");
  assert.equal(first.endsAt, "2026-09-21T00:00:00.000Z");
  assert.equal(first.seed, definition().seed);
  assert.notEqual(first.seed, definition("2026-W39").seed);
  assert.equal(getChallengeDefinition("2026-W54"), null);
  assert.equal(getChallengeDefinition("week-38"), null);
});

test("the same challenge and action trace reproduces the exact final state", () => {
  const run = completeRun();
  assert.equal(isChallengeComplete(run), true);
  assert.equal(run.game.roomsCleared, 10);
  const replayed = replayChallenge(run.definition, run.actions);
  assert.deepEqual(replayed, run);

  const alternate = applyChallengeAction(startChallengeRun(run.definition), "storm");
  const steady = applyChallengeAction(startChallengeRun(run.definition), "attack");
  assert.notDeepEqual(alternate.game, steady.game);
});

test("a proof is replay verified, links to its challenge and rejects changed bytes", async () => {
  const created = await createChallengeProof(completeRun());
  const verified = await verifyChallengeProof("2026-W38", created.proof);
  assert.deepEqual(verified.result, created.result);
  assert.deepEqual(verified.run, created.run);
  assert.equal(verified.runId.length, 12);

  const url = new URL(challengeShareUrl("https://delveworn.app", created));
  assert.equal(url.pathname, "/challenge/2026-W38");
  assert.equal(url.searchParams.get("r"), created.proof);
  assert.equal(url.searchParams.get("ref"), created.runId);

  const last = created.proof.at(-1);
  const tampered = `${created.proof.slice(0, -1)}${last === "A" ? "B" : "A"}`;
  await assert.rejects(
    verifyChallengeProof("2026-W38", tampered),
    (error: unknown) => error instanceof Error && /changed|JSON|decoded|schema|integrity/i.test(error.message)
  );
  await assert.rejects(
    verifyChallengeProof("2026-W39", created.proof),
    (error: unknown) => error instanceof Error && /different weekly challenge/.test(error.message)
  );
});

test("the published V1 week 38 replay fixture keeps its exact result and proof", async () => {
  const created=await createChallengeProof(completeRun());
  assert.deepEqual(created.result,{
    challengeId:"2026-W38",rulesVersion:1,seed:3678871334,outcome:"cleared",
    roomsCleared:10,hp:18,gold:145,potions:0,weaponLevel:1,armorLevel:0,
    relicId:0,actionCount:64,score:105695,
  });
  assert.equal(created.run.actions.join(""),"AAANAAANAAANAAAAANAAAPABTNAAAANAAAPAAPAANAAPANAAARCCNAAAAAPAPAAA");
  assert.equal(created.runId,"f8d0f0c9f20c");
  assert.equal(created.proof,"WzEsIjIwMjYtVzM4IiwiQUFBTkFBQU5BQUFOQUFBQUFOQUFBUEFCVE5BQUFBTkFBQVBBQVBBQU5BQVBBTkFBQVJDQ05BQUFBQVBBUEFBQSIsImY4ZDBmMGM5ZjIwY2Q2MmUwYWEwYmI2NTgxZTE0MDBmMDcwOGQ1NDRkOTEyMmM0YTYyOTlhM2FjNWNkNWQ3ZGQiXQ");
  const verified=await verifyChallengeProof("2026-W38",created.proof);
  assert.deepEqual(verified.result,created.result);
});

test("illegal and post-completion actions are rejected instead of becoming a score", () => {
  const started = startChallengeRun(definition());
  assert.throws(() => applyChallengeAction(started, "next-room"), /next room cannot be entered/i);
  assert.throws(() => applyChallengeAction(started, "camp-weapon"), /between rooms/i);
  const completed = completeRun();
  assert.throws(() => applyChallengeAction(completed, "attack"), /already complete/i);
});

test("stored runs contain only the action trace and are rebuilt before use", () => {
  const storage = memoryStorage();
  const run = applyChallengeAction(startChallengeRun(definition()), "attack");
  assert.equal(saveChallengeRun(storage, run, "012345abcdef"), true);
  assert.deepEqual(loadChallengeRun(storage, "2026-W38"), {
    run,
    referral: "012345abcdef",
  });
  const [key] = storage.values.keys();
  const stored = JSON.parse(storage.values.get(key)!);
  assert.deepEqual(Object.keys(stored).sort(), ["a", "c", "ref", "v"]);
  stored.a = "N";
  storage.values.set(key, JSON.stringify(stored));
  assert.equal(loadChallengeRun(storage, "2026-W38"), null);
});

test("analytics markers count one starter per week and a later-week return", () => {
  const storage = memoryStorage();
  assert.deepEqual(registerChallengeStart(storage, "2026-W38"), {
    uniqueStart: true,
    returnVisit: false,
  });
  assert.deepEqual(registerChallengeStart(storage, "2026-W38"), {
    uniqueStart: false,
    returnVisit: false,
  });
  assert.deepEqual(registerChallengeStart(storage, "2026-W39"), {
    uniqueStart: true,
    returnVisit: true,
  });
  assert.equal(registerChallengeCompletion(storage, "2026-W39", "012345abcdef"), true);
  assert.equal(registerChallengeCompletion(storage, "2026-W39", "012345abcdef"), false);
  assert.equal(registerChallengeCompletion(storage, "2026-W39", "fedcba543210"), true);
});

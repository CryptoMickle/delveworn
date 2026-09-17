import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { campPrices, supplyPrices } from "../app/practice/engine";
import { phase, type DescentAction } from "../app/descent/model";
import {
  WEEKLY_DESCENT_MAX_ACTIONS,
  createWeeklyDescent,
  createWeeklyDescentProof,
  getWeeklyDescentDefinition,
  isWeeklyDescentComplete,
  transitionWeeklyDescent,
  type WeeklyDescent,
  type WeeklyDescentResult,
} from "../app/descent/weekly";
import {
  leaderboardMemberId,
  leaderboardWindow,
  normalizeLeaderboardNickname,
  rankLeaderboardEntries,
  weeklyLeaderboardKey,
  type StoredLeaderboardEntry,
} from "../app/leaderboard/core";
import { createLeaderboardBackend, type LeaderboardBackend } from "../app/leaderboard/config";
import { LocalFileLeaderboardStore } from "../app/leaderboard/local-store";
import { RedisRestLeaderboardStore } from "../app/leaderboard/redis-store";
import {
  LEADERBOARD_GUEST_COOKIE,
  handleLeaderboardGet,
  handleLeaderboardPost,
  leaderboardGuest,
} from "../app/leaderboard/server";
import { MemoryLeaderboardStore } from "../app/leaderboard/store";

const NOW = new Date("2026-09-17T12:00:00.000Z");

function definition(id = "2026-W38") {
  const value = getWeeklyDescentDefinition(id);
  assert.ok(value);
  return value;
}

function nextAction(run: WeeklyDescent): DescentAction {
  const current = phase(run), game = run.game;
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
    }
    if (game.hp <= game.maxHp - 25 && game.potions > 0) return "potion";
    return "enter";
  }
  if (game.hp <= 32 && game.potions > 0
    && game.combatPotionsUsed < (game.monsterType === 3 ? 3 : 2)) return "potion";
  return "attack";
}

async function verifiedProof(): Promise<string> {
  let run = createWeeklyDescent(definition(), "leaderboard-test");
  for (let step = 0; step < WEEKLY_DESCENT_MAX_ACTIONS && !isWeeklyDescentComplete(run); step += 1) {
    run = transitionWeeklyDescent(run, nextAction(run));
  }
  assert.equal(phase(run), "won");
  return (await createWeeklyDescentProof(run)).proof;
}

function result(score: number): WeeklyDescentResult {
  return {
    challengeId: "2026-W38",
    rulesVersion: 2,
    seed: definition().seed,
    score,
    outcome: "cleared",
    roomsCleared: 10,
    hp: 1,
    gold: 0,
    potions: 0,
    weaponLevel: 0,
    armorLevel: 0,
    relicId: 1,
    combatTurns: 50,
    actionCount: 80,
  };
}

function entry(guestId: string, score: number, index: number, nickname: string | null = null): StoredLeaderboardEntry {
  const achievedAt = new Date(NOW.getTime() + index * 1_000).toISOString();
  const entryId = index.toString(16).padStart(12, "0");
  return {
    guestId,
    entryId,
    memberId: leaderboardMemberId(achievedAt, entryId, guestId),
    nickname,
    nicknameHidden: false,
    achievedAt,
    result: result(score),
  };
}

function readyBackend(store = new MemoryLeaderboardStore()): LeaderboardBackend {
  return {
    status: { enabled: true, mode: "local", reason: "ready" },
    store,
    cookieSecret: "leaderboard-test-secret-that-is-at-least-32-characters",
  };
}

test("competition ranks use 1,2,2,4 and the window contains top ten plus own neighbors", () => {
  const tied = [entry("a", 100, 0), entry("b", 90, 1), entry("c", 90, 2), entry("d", 80, 3)];
  assert.deepEqual(rankLeaderboardEntries(tied).map(row => row.position), [1, 2, 2, 4]);

  const many = Array.from({ length: 20 }, (_, index) => entry(`guest-${index}`, 1_000 - index, index));
  const window = leaderboardWindow(many, "guest-15");
  assert.equal(window.totalEntries, 20);
  assert.deepEqual(window.entries.map(row => row.entry.guestId), [
    ...Array.from({ length: 10 }, (_, index) => `guest-${index}`),
    "guest-13", "guest-14", "guest-15", "guest-16", "guest-17",
  ]);
});

test("equal and lower submissions retain the first row while a higher best replaces it", async () => {
  const store = new MemoryLeaderboardStore();
  const board = weeklyLeaderboardKey("2026-W38");
  const first = entry("guest", 100, 0, "First");
  assert.equal((await store.submitBest(board, "guest", first)).status, "inserted");
  assert.deepEqual(await store.submitBest(board, "guest", entry("guest", 100, 1, "Changed")), {
    status: "retained",
    entry: first,
  });
  assert.equal((await store.submitBest(board, "guest", entry("guest", 99, 2))).status, "retained");
  const improved = entry("guest", 101, 3, "Best");
  assert.deepEqual(await store.submitBest(board, "guest", improved), { status: "improved", entry: improved });
});

test("nickname validation hides moderated names without storing the submitted text", () => {
  assert.deepEqual(normalizeLeaderboardNickname("  Rune   Fox  "), {
    nickname: "Rune Fox",
    nicknameHidden: false,
  });
  assert.deepEqual(normalizeLeaderboardNickname("Delveworn Admin"), {
    nickname: null,
    nicknameHidden: true,
  });
  assert.throws(() => normalizeLeaderboardNickname("x"), /2–20/);
  assert.throws(() => normalizeLeaderboardNickname("name<script>"), /2–20/);
});

test("guest identity is server-signed, HttpOnly, and a forged identity receives a new secret", () => {
  const secret = "leaderboard-test-secret-that-is-at-least-32-characters";
  const first = leaderboardGuest(new Request("https://delveworn.app/api/leaderboard/2026-W38"), secret);
  assert.ok(first.setCookie?.includes("HttpOnly"));
  assert.ok(first.setCookie?.includes("SameSite=Strict"));
  assert.ok(first.setCookie?.includes("Secure"));
  const cookie = first.setCookie!.split(";", 1)[0];
  const restored = leaderboardGuest(new Request("https://delveworn.app/api/leaderboard/2026-W38", {
    headers: { cookie },
  }), secret);
  assert.equal(restored.guestId, first.guestId);
  assert.equal(restored.setCookie, null);

  const value = cookie.slice(`${LEADERBOARD_GUEST_COOKIE}=`.length);
  const forgedId = `${value[0] === "a" ? "b" : "a"}${value.slice(1)}`;
  const forged = leaderboardGuest(new Request("https://delveworn.app/api/leaderboard/2026-W38", {
    headers: { cookie: `${LEADERBOARD_GUEST_COOKIE}=${forgedId}` },
  }), secret);
  assert.notEqual(forged.guestId, first.guestId);
  assert.ok(forged.setCookie);
});

test("route logic verifies v2 proofs, enforces current-week writes, and keeps archives readable", async () => {
  const store = new MemoryLeaderboardStore();
  const backend = readyBackend(store);
  const proof = await verifiedProof();
  const url = "https://delveworn.app/api/leaderboard/2026-W38";
  const post = new Request(url, {
    method: "POST",
    headers: { origin: "https://delveworn.app", "content-type": "application/json" },
    body: JSON.stringify({ proof, nickname: "Rune Fox" }),
  });
  const posted = await handleLeaderboardPost(post, "2026-W38", backend, { now: () => NOW });
  assert.equal(posted.status, 428, "a write cannot mint and immediately use a new guest credential");
  const cookie = posted.headers.get("set-cookie")!.split(";", 1)[0];
  const accepted = await handleLeaderboardPost(new Request(url, {
    method: "POST",
    headers: { origin: "https://delveworn.app", "content-type": "application/json", cookie },
    body: JSON.stringify({ proof, nickname: "Rune Fox" }),
  }), "2026-W38", backend, { now: () => NOW });
  assert.equal(accepted.status, 200);
  const postedBody = await accepted.json();
  assert.equal(postedBody.submission.status, "inserted");
  assert.equal(postedBody.rows[0].own, true);
  assert.equal(postedBody.rows[0].nickname, "Rune Fox");
  const persisted = [...store.boards.get(weeklyLeaderboardKey("2026-W38"))!.values()][0];
  assert.equal(persisted.proof, proof, "the verified proof remains available for private replay audits");
  assert.equal("proof" in postedBody.rows[0], false);
  assert.equal("guestId" in postedBody.rows[0], false);
  assert.equal(JSON.stringify(postedBody).includes(proof), false);

  const localProxy = await handleLeaderboardPost(new Request(
    "http://localhost:3100/api/leaderboard/2026-W38",
    {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3100",
        host: "127.0.0.1:3100",
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ proof }),
    }
  ), "2026-W38", backend, { now: () => NOW });
  assert.equal(localProxy.status, 200, "Next may expose localhost internally while the browser uses 127.0.0.1");

  const forwardedProxy = await handleLeaderboardPost(new Request(
    "http://localhost:3000/api/leaderboard/2026-W38",
    {
      method: "POST",
      headers: {
        origin: "https://delveworn.app",
        host: "delveworn.app",
        "x-forwarded-proto": "https",
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ proof }),
    }
  ), "2026-W38", backend, { now: () => NOW });
  assert.equal(forwardedProxy.status, 200, "the public HTTPS origin survives an internal HTTP proxy URL");

  const retained = await handleLeaderboardPost(new Request(url, {
    method: "POST",
    headers: { origin: "https://delveworn.app", "content-type": "application/json", cookie },
    body: JSON.stringify({ proof, nickname: "Changed Name" }),
  }), "2026-W38", backend, { now: () => NOW });
  assert.equal((await retained.json()).submission.status, "retained");

  const claimedScore = await handleLeaderboardPost(new Request(url, {
    method: "POST",
    headers: { origin: "https://delveworn.app", "content-type": "application/json", cookie },
    body: JSON.stringify({ proof, score: 999_999_999 }),
  }), "2026-W38", backend, { now: () => NOW });
  assert.equal(claimedScore.status, 400, "claimed result fields fail the strict proof-only schema");

  const oversized = await handleLeaderboardPost(new Request(url, {
    method: "POST",
    headers: {
      origin: "https://delveworn.app",
      "content-type": "application/json",
      "content-length": "5000",
      cookie,
    },
    body: JSON.stringify({ proof }),
  }), "2026-W38", backend, { now: () => NOW });
  assert.equal(oversized.status, 413);

  const board = await handleLeaderboardGet(new Request(url, { headers: { cookie } }), "2026-W38", backend, { now: () => NOW });
  const boardBody = await board.json();
  assert.equal(boardBody.rows[0].nickname, "Rune Fox", "an equal replay does not replace the first row");

  const crossOrigin = await handleLeaderboardPost(new Request(url, {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      host: "delveworn.app",
      "x-forwarded-host": "attacker.example",
      "content-type": "application/json",
    },
    body: JSON.stringify({ proof }),
  }), "2026-W38", backend, { now: () => NOW });
  assert.equal(crossOrigin.status, 403, "client-supplied forwarded hosts cannot authorize a cross-site write");

  const archiveUrl = "https://delveworn.app/api/leaderboard/2026-W37";
  const archiveWrite = await handleLeaderboardPost(new Request(archiveUrl, {
    method: "POST",
    headers: { origin: "https://delveworn.app", "content-type": "application/json" },
    body: JSON.stringify({ proof }),
  }), "2026-W37", backend, { now: () => NOW });
  assert.equal(archiveWrite.status, 409);
  const archiveRead = await handleLeaderboardGet(new Request(archiveUrl), "2026-W37", backend, { now: () => NOW });
  assert.equal(archiveRead.status, 200);
  assert.equal((await archiveRead.json()).archived, true);
});

test("the same proof posted by two guests receives distinct opaque public row IDs", async () => {
  const backend = readyBackend();
  const proof = await verifiedProof();
  const url = "https://delveworn.app/api/leaderboard/2026-W38";

  async function submitAsNewGuest(nickname: string): Promise<{ body: string; guestId: string }> {
    const opened = await handleLeaderboardGet(new Request(url), "2026-W38", backend, { now: () => NOW });
    const cookie = opened.headers.get("set-cookie")!.split(";", 1)[0];
    const guestId = cookie.slice(`${LEADERBOARD_GUEST_COOKIE}=`.length).split(".", 1)[0];
    const posted = await handleLeaderboardPost(new Request(url, {
      method: "POST",
      headers: {
        origin: "https://delveworn.app",
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ proof, nickname }),
    }), "2026-W38", backend, { now: () => NOW });
    assert.equal(posted.status, 200);
    return { body: await posted.text(), guestId };
  }

  const first = await submitAsNewGuest("First Guest");
  const second = await submitAsNewGuest("Second Guest");
  const board = JSON.parse(second.body);
  assert.equal(board.totalEntries, 2);
  assert.equal(new Set(board.rows.map((row: { entryId: string }) => row.entryId)).size, 2);
  assert.ok(board.rows.every((row: { entryId: string }) => /^[0-9a-f]{24}$/.test(row.entryId)));
  assert.equal(first.body.includes(first.guestId), false);
  assert.equal(second.body.includes(first.guestId), false);
  assert.equal(second.body.includes(second.guestId), false);
});

test("submission budgets reset rather than limiting lifetime attempts", async () => {
  let now = 1_000;
  const store = new MemoryLeaderboardStore({ now: () => now });
  assert.equal(await store.consumeRateLimit("guest", 2, 60), true);
  assert.equal(await store.consumeRateLimit("guest", 2, 60), true);
  assert.equal(await store.consumeRateLimit("guest", 2, 60), false);
  now += 60_001;
  assert.equal(await store.consumeRateLimit("guest", 2, 60), true);
});

test("production is honestly disabled without storage and a signing secret", () => {
  assert.deepEqual(createLeaderboardBackend({
    NODE_ENV: "development",
    DELVEWORN_LEADERBOARD_ENABLED: "false",
  }), {
    status: { enabled: false, mode: "disabled", reason: "disabled_by_config" },
    store: null,
    cookieSecret: null,
  });
  assert.deepEqual(createLeaderboardBackend({
    NODE_ENV: "production",
    DELVEWORN_LEADERBOARD_ENABLED: " FALSE ",
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "token",
    DELVEWORN_LEADERBOARD_COOKIE_SECRET: "x".repeat(32),
  }).status, {
    enabled: false,
    mode: "disabled",
    reason: "disabled_by_config",
  });
  assert.deepEqual(createLeaderboardBackend({ NODE_ENV: "production" }).status, {
    enabled: false,
    mode: "disabled",
    reason: "missing_storage",
  });
  assert.deepEqual(createLeaderboardBackend({
    NODE_ENV: "production",
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "token",
  }).status, {
    enabled: false,
    mode: "disabled",
    reason: "missing_cookie_secret",
  });
  assert.equal(createLeaderboardBackend({ NODE_ENV: "development" }).status.mode, "local");
  assert.equal(createLeaderboardBackend({
    NODE_ENV: "production",
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "token",
    DELVEWORN_LEADERBOARD_COOKIE_SECRET: "x".repeat(32),
  }).status.mode, "redis");
});

test("Redis REST keeps its token in the authorization header and rate limits atomically", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return new Response(JSON.stringify({ result: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const store = new RedisRestLeaderboardStore({
    url: "https://redis.example/",
    token: "private-token",
    fetcher,
  });
  assert.equal(await store.consumeRateLimit("guest:key", 20, 60), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "https://redis.example");
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer private-token");
  assert.equal(String(calls[0].init?.body).includes("private-token"), false);
  assert.match(String(calls[0].init?.body), /^\["EVAL",/);
});

test("the nonproduction file store persists replayed rows and atomically retains equal scores", async () => {
  const directory = await mkdtemp(join(tmpdir(), "delveworn-leaderboard-test-"));
  const file = join(directory, "leaderboard.json");
  try {
    const store = new LocalFileLeaderboardStore(file);
    const board = weeklyLeaderboardKey("2026-W38");
    const first = entry("guest", 100, 0);
    assert.equal((await store.submitBest(board, "guest", first)).status, "inserted");
    assert.equal((await store.submitBest(board, "guest", entry("guest", 100, 1))).status, "retained");
    assert.deepEqual((await store.getWindow(board, "guest")).entries[0].entry, first);
    const persisted = JSON.parse(await readFile(file, "utf8"));
    assert.equal(persisted.boards[board].length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

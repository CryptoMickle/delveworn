import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { leaderboardMemberId, leaderboardWindow, type StoredLeaderboardEntry } from "../app/leaderboard/core";
import { createLeaderboardBackend } from "../app/leaderboard/config";
import { RedisRestLeaderboardStore } from "../app/leaderboard/redis-store";

const exec = promisify(execFile);

// Real Redis evaluates production Lua. Only the REST envelope is substituted;
// all data belongs to this temporary, Unix-socket-only test server.
test("real Redis: empty boards, concurrent best updates, ties, neighbors and expiry", { timeout: 20_000 }, async t => {
  const directory = await mkdtemp(join(process.platform === "darwin" ? "/tmp" : tmpdir(), "dw-redis-"));
  const socket = join(directory, "redis.sock");
  const server = spawn(process.env.REDIS_SERVER_BIN ?? "redis-server", [
    "--port", "0", "--unixsocket", socket, "--unixsocketperm", "700",
    "--save", "", "--appendonly", "no", "--dir", directory,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const stopped = new Promise<void>(resolve => server.once("close", () => resolve()));
  try {
    await new Promise<void>((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error(`Test Redis did not start: ${output}`)), 5_000);
      const fail = (error: Error) => { clearTimeout(timeout); reject(error); };
      server.once("error", fail);
      server.once("exit", code => fail(new Error(`Test Redis exited before ready: ${code}: ${output}`)));
      server.stderr.on("data", data => { output += String(data); });
      server.stdout.on("data", data => {
        output += String(data);
        if (output.toLowerCase().includes("ready to accept connections")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    const command = async (args: Array<string | number>) => {
      const { stdout } = await exec(process.env.REDIS_CLI_BIN ?? "redis-cli", [
        "-s", socket, "--json", ...args.map(String),
      ], { maxBuffer: 4_000_000 });
      return JSON.parse(stdout) as unknown;
    };
    const fetcher = (async (_input: unknown, init: RequestInit) => {
      const args = JSON.parse(String(init.body)) as Array<string | number>;
      return Response.json({ result: await command(args) });
    }) as typeof fetch;
    const store = new RedisRestLeaderboardStore({ url: "https://local-redis.invalid", token: "test-only", fetcher });
    const entry = (guestId: string, score: number, index: number): StoredLeaderboardEntry => {
      const entryId = index.toString(16).padStart(24, "0");
      const achievedAt = "2026-09-17T12:00:00.000Z"; // Deliberate timestamp ties.
      return {
        guestId, entryId, memberId: leaderboardMemberId(achievedAt, entryId, guestId),
        nickname: null, nicknameHidden: false, achievedAt,
        result: { challengeId: "2026-W38", rulesVersion: 2, seed: 1, score, outcome: "cleared",
          roomsCleared: 10, hp: 50, gold: 20, potions: 1, weaponLevel: 1, armorLevel: 1,
          relicId: 1, combatTurns: 40, actionCount: 70 },
      };
    };
    await t.test("new week is a readable empty board", async () => {
      assert.deepEqual(await store.getWindow("empty", "guest"), { totalEntries: 0, entries: [] });
    });
    await t.test("concurrent retries keep exactly one highest result", async () => {
      await Promise.all([200, 100, 300, 250, 300].map((score, i) => store.submitBest("race", "a", entry("a", score, i))));
      const window = await store.getWindow("race", "a");
      assert.equal(window.totalEntries, 1);
      assert.equal(window.entries[0].entry.result.score, 300);
      const before = window.entries[0].entry;
      assert.equal((await store.submitBest("race", "a", entry("a", 300, 99))).status, "retained");
      assert.deepEqual((await store.getWindow("race", "a")).entries[0].entry, before);
    });
    await t.test("tie order, competition ranks and neighbors match the reference store", async () => {
      const entries = Array.from({ length: 20 }, (_, i) => entry(`guest-${i}`, 1_000 - Math.floor(i / 2), i));
      await Promise.all(entries.map(item => store.submitBest("window", item.guestId, item)));
      for (const guest of ["absent", "guest-0", "guest-15", "guest-19"]) {
        assert.deepEqual(await store.getWindow("window", guest), leaderboardWindow(entries, guest));
      }
      assert.deepEqual((await store.getWindow("window", "absent")).entries.slice(0, 4).map(row => row.position), [1, 1, 3, 3]);
    });
    await t.test("capacity and expired rate windows behave correctly", async () => {
      const tiny = new RedisRestLeaderboardStore({ url: "https://local-redis.invalid", token: "test-only", fetcher, maxEntries: 1 });
      assert.equal((await tiny.submitBest("full", "a", entry("a", 100, 0))).status, "inserted");
      assert.equal((await tiny.submitBest("full", "b", entry("b", 200, 1))).status, "full");
      assert.equal((await tiny.submitBest("full", "a", entry("a", 101, 2))).status, "improved");
      assert.equal(await store.consumeRateLimit("short", 1, 60), true);
      assert.equal(await store.consumeRateLimit("short", 1, 60), false);
      await command(["PEXPIRE", "dw:lb:rate:short", 0]);
      assert.equal(await store.consumeRateLimit("short", 1, 60), true);
    });
    await t.test("production and default namespaces isolate best scores, reads and rate limits for the same guest", async () => {
      const production = createLeaderboardBackend({
        NODE_ENV: "production",
        KV_REST_API_URL: "https://local-redis.invalid",
        KV_REST_API_TOKEN: "test-only",
        DELVEWORN_LEADERBOARD_COOKIE_SECRET: "x".repeat(32),
        DELVEWORN_LEADERBOARD_NAMESPACE: "production",
      }, { fetcher }).store;
      assert.ok(production);
      const board = "weekly:2026-W38:v2";
      const guest = "shared-guest";
      const previewEntry = entry(guest, 200, 0);
      // The same member ID also verifies isolation of the stored entry hash.
      const productionEntry = entry(guest, 100, 0);
      assert.equal((await store.submitBest(board, guest, previewEntry)).status, "inserted");
      assert.deepEqual(await production.getWindow(board, guest), { totalEntries: 0, entries: [] });
      assert.equal((await production.submitBest(board, guest, productionEntry)).status, "inserted");
      assert.deepEqual((await store.getWindow(board, guest)).entries[0].entry, previewEntry);
      assert.deepEqual((await production.getWindow(board, guest)).entries[0].entry, productionEntry);
      const improvedProduction = entry(guest, 150, 1);
      assert.equal((await production.submitBest(board, guest, improvedProduction)).status, "improved");
      assert.equal((await store.submitBest(board, guest, entry(guest, 150, 1))).status, "retained");
      assert.deepEqual(await store.getWindow(board, guest), leaderboardWindow([previewEntry], guest));
      assert.deepEqual(await production.getWindow(board, guest), leaderboardWindow([improvedProduction], guest));

      const rateKey = `guest:${guest}`;
      assert.equal(await store.consumeRateLimit(rateKey, 1, 60), true);
      assert.equal(await store.consumeRateLimit(rateKey, 1, 60), false);
      assert.equal(await production.consumeRateLimit(rateKey, 1, 60), true);
      assert.equal(await production.consumeRateLimit(rateKey, 1, 60), false);
      await command(["PEXPIRE", `dw:lb:rate:${rateKey}`, 0]);
      assert.equal(await store.consumeRateLimit(rateKey, 1, 60), true);
      assert.equal(await production.consumeRateLimit(rateKey, 1, 60), false);
      assert.equal(await command(["EXISTS",
        `dw:lb:${board}:scores`, `dw:lb:${board}:guests`, `dw:lb:${board}:entries`, `dw:lb:rate:${rateKey}`,
        `dw:lb:ns:production:${board}:scores`, `dw:lb:ns:production:${board}:guests`,
        `dw:lb:ns:production:${board}:entries`, `dw:lb:ns:production:rate:${rateKey}`,
      ]), 8);
    });
  } finally {
    server.kill("SIGTERM");
    await stopped;
    await rm(directory, { recursive: true, force: true });
  }
});

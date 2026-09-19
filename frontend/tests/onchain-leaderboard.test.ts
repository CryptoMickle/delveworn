import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  parseAbiItem,
  parseAbiParameters,
} from "viem";
import {
  onchainLeaderboardWindow,
  rankOnchainLeaderboard,
  type OnchainLeaderboardEvent,
} from "../app/onchain-leaderboard/core";
import {
  COMBAT_RESOLVED_TOPIC,
  MONSTER_SPAWNED_TOPIC,
  fetchOnchainLeaderboardSnapshot,
  type OnchainLeaderboardSourceConfig,
} from "../app/onchain-leaderboard/source";
import { onchainLeaderboardReply } from "../app/onchain-leaderboard/server";

const PLAYER_A = "0x1111111111111111111111111111111111111111" as const;
const PLAYER_B = "0x2222222222222222222222222222222222222222" as const;
const HASH_A = `0x${"a".repeat(64)}` as const;
const HASH_B = `0x${"b".repeat(64)}` as const;

function event(
  kind: "spawn" | "combat",
  player: typeof PLAYER_A | typeof PLAYER_B,
  blockNumber: number,
  details: { room?: number; monsterDefeated?: boolean } = {},
): OnchainLeaderboardEvent {
  return {
    kind,
    player,
    blockNumber,
    logIndex: 1,
    transactionHash: blockNumber % 2 === 0 ? HASH_A : HASH_B,
    timestamp: new Date(blockNumber * 1_000).toISOString(),
    ...details,
  };
}

test("canonical events keep one deepest run per gameplay account and share tie ranks", () => {
  const rows = rankOnchainLeaderboard([
    event("spawn", PLAYER_A, 1, { room: 1 }),
    event("combat", PLAYER_A, 2, { monsterDefeated: true }),
    event("spawn", PLAYER_A, 3, { room: 2 }),
    event("combat", PLAYER_A, 4, { monsterDefeated: true }),
    event("spawn", PLAYER_A, 5, { room: 1 }),
    event("combat", PLAYER_A, 6, { monsterDefeated: true }),
    event("spawn", PLAYER_B, 7, { room: 1 }),
    event("combat", PLAYER_B, 8, { monsterDefeated: true }),
    event("spawn", PLAYER_B, 9, { room: 2 }),
    event("combat", PLAYER_B, 10, { monsterDefeated: true }),
  ]);
  assert.deepEqual(rows.map(row => ({ player: row.player, rooms: row.roomsCleared, rank: row.position })), [
    { player: PLAYER_A, rooms: 2, rank: 1 },
    { player: PLAYER_B, rooms: 2, rank: 1 },
  ]);
  assert.equal(rows[0].proofTransactionHash, HASH_A, "the victorious combat transaction proves the best depth");
});

test("a later room spawn proves the previous clear and the player window adds nearby rows", () => {
  const events = Array.from({ length: 30 }, (_, index) => {
    const player = `0x${(index + 1).toString(16).padStart(40, "0")}` as `0x${string}`;
    return event("spawn", player as typeof PLAYER_A, index + 1, { room: 31 - index });
  });
  const rows = rankOnchainLeaderboard(events);
  assert.equal(rows[0].roomsCleared, 30);
  assert.equal(rows[0].proofTransactionHash, HASH_B);
  const own = rows[29].player;
  const window = onchainLeaderboardWindow(rows, own);
  assert.equal(window.length, 28);
  assert.ok(window.some(row => row.player === own));
  const reply = onchainLeaderboardReply({
    version: 1,
    boardId: "board",
    chainId: 50_312,
    chainName: "Somnia Testnet",
    contractAddress: PLAYER_A,
    deploymentBlock: 1,
    indexedThroughBlock: 99,
    generatedAt: "2026-09-19T12:00:00.000Z",
    stale: false,
    totalPlayers: rows.length,
    rows,
  }, own);
  assert.equal(reply.rows.filter(row => row.own).length, 1);
});

test("the source reads only finalized indexed logs and decodes spawn and victory events", async () => {
  const spawnAbi = parseAbiItem("event MonsterSpawned(address indexed player, uint256 indexed room, uint8 monsterType, uint256 hp)");
  const combatAbi = parseAbiItem("event CombatResolved(address indexed player, uint8 action, uint256 playerDamage, uint256 monsterDamage, bool critical, bool monsterDefeated)");
  const spawnTopics = encodeEventTopics({ abi: [spawnAbi], eventName: "MonsterSpawned", args: { player: PLAYER_A, room: BigInt(1) } });
  const combatTopics = encodeEventTopics({ abi: [combatAbi], eventName: "CombatResolved", args: { player: PLAYER_A } });
  const normalizedTopics = (topics: readonly (string | readonly string[] | null)[]) => topics.flatMap(topic =>
    typeof topic === "string" ? [topic] : Array.isArray(topic) ? [...topic] : []
  );
  const raw = (topics: readonly (string | readonly string[] | null)[], data: string, block: number, transactionHash: string) => ({
    blockNumber: `0x${block.toString(16)}`,
    data,
    logIndex: "0x1",
    timeStamp: "0x68cd4f80",
    topics: normalizedTopics(topics),
    transactionHash,
  });
  const spawn = raw(
    spawnTopics,
    encodeAbiParameters(parseAbiParameters("uint8 monsterType, uint256 hp"), [0, BigInt(30)]),
    101,
    HASH_A,
  );
  const combat = raw(
    combatTopics,
    encodeAbiParameters(
      parseAbiParameters("uint8 action, uint256 playerDamage, uint256 monsterDamage, bool critical, bool monsterDefeated"),
      [2, BigInt(30), BigInt(0), false, true],
    ),
    102,
    HASH_B,
  );
  const requested = [] as URL[];
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    if (typeof input === "string" && input === "https://rpc.invalid") {
      assert.match(String(init?.body), /eth_blockNumber/);
      return Response.json({ jsonrpc: "2.0", id: 1, result: "0xc8" });
    }
    const url = input instanceof URL ? input : new URL(String(input));
    requested.push(url);
    const topic = url.searchParams.get("topic0");
    return Response.json({ status: "1", message: "OK", result: topic === MONSTER_SPAWNED_TOPIC ? [spawn] : [combat] });
  }) as typeof fetch;
  const config: OnchainLeaderboardSourceConfig = {
    chainId: 50_312,
    chainName: "Somnia Testnet",
    contractAddress: getAddress(PLAYER_A),
    deploymentBlock: 100,
    rpcUrl: "https://rpc.invalid",
    indexerApiUrl: "https://indexer.invalid/api",
    finalityBufferBlocks: 10,
  };
  const snapshot = await fetchOnchainLeaderboardSnapshot({
    config,
    fetcher,
    now: () => new Date("2026-09-19T12:00:00.000Z"),
  });
  assert.equal(snapshot.indexedThroughBlock, 190);
  assert.equal(snapshot.rows[0].roomsCleared, 1);
  assert.equal(snapshot.rows[0].proofTransactionHash, HASH_B);
  assert.deepEqual(requested.map(url => ({
    from: url.searchParams.get("fromBlock"),
    to: url.searchParams.get("toBlock"),
    topic: url.searchParams.get("topic0"),
  })), [
    { from: "100", to: "190", topic: MONSTER_SPAWNED_TOPIC },
    { from: "100", to: "190", topic: COMBAT_RESOLVED_TOPIC },
  ]);
});

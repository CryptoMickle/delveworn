import {
  decodeEventLog,
  isAddress,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { activeDeployment } from "../chain-config";
import {
  ONCHAIN_LEADERBOARD_VERSION,
  rankOnchainLeaderboard,
  type OnchainLeaderboardEvent,
  type OnchainLeaderboardSnapshot,
} from "./core";

const SOMNIA_CHAIN_ID = 50_312;
const SOMNIA_DUNGEON = "0x07c5D071132ae95C3708031790b3feC740F4c292";
const SOMNIA_DUNGEON_DEPLOYMENT_BLOCK = 476_477_529;
const SOMNIA_INDEXER_API = "https://somnia.w3us.site/api";
const FINALITY_BUFFER_BLOCKS = 64;
const LOG_PAGE_SIZE = 1_000;
const MAX_LOG_PAGES = 100;

const monsterSpawnedEvent = parseAbiItem(
  "event MonsterSpawned(address indexed player, uint256 indexed room, uint8 monsterType, uint256 hp)",
);
const combatResolvedEvent = parseAbiItem(
  "event CombatResolved(address indexed player, uint8 action, uint256 playerDamage, uint256 monsterDamage, bool critical, bool monsterDefeated)",
);

export const MONSTER_SPAWNED_TOPIC = "0x68607a26e97a92d7792e1e3d11937dc6b9ffa96a1520c5cf31cd2bca146351cc";
export const COMBAT_RESOLVED_TOPIC = "0x2cf829836b03d260a8345fa7931ff533a330edd16300e2b325a3bc9df2c35148";

type SourceEnvironment = Record<string, string | undefined>;

export type OnchainLeaderboardSourceConfig = Readonly<{
  chainId: number;
  chainName: string;
  contractAddress: Address;
  deploymentBlock: number;
  rpcUrl: string;
  indexerApiUrl: string;
  finalityBufferBlocks: number;
}>;

type RpcReply = { result?: unknown; error?: { message?: string } };
type ExplorerLog = {
  blockNumber?: string;
  data?: string;
  logIndex?: string;
  timeStamp?: string;
  topics?: Array<string | null>;
  transactionHash?: string;
};
type ExplorerReply = { message?: string; result?: ExplorerLog[] | string; status?: string };

function integerSetting(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Invalid onchain leaderboard block setting.");
  return parsed;
}

export function createOnchainLeaderboardSourceConfig(
  environment: SourceEnvironment = process.env,
): OnchainLeaderboardSourceConfig | null {
  if (activeDeployment.chain.id !== SOMNIA_CHAIN_ID) return null;
  const address = activeDeployment.dungeonAddress;
  const configuredBlock = environment.DELVEWORN_ONCHAIN_LEADERBOARD_DEPLOYMENT_BLOCK;
  if (!configuredBlock && address.toLowerCase() !== SOMNIA_DUNGEON.toLowerCase()) return null;
  return {
    chainId: activeDeployment.chain.id,
    chainName: activeDeployment.chain.name,
    contractAddress: address,
    deploymentBlock: integerSetting(configuredBlock, SOMNIA_DUNGEON_DEPLOYMENT_BLOCK),
    rpcUrl: activeDeployment.rpcUrl,
    indexerApiUrl: environment.DELVEWORN_ONCHAIN_LEADERBOARD_INDEXER_URL?.trim() || SOMNIA_INDEXER_API,
    finalityBufferBlocks: integerSetting(
      environment.DELVEWORN_ONCHAIN_LEADERBOARD_FINALITY_BLOCKS,
      FINALITY_BUFFER_BLOCKS,
    ),
  };
}

async function responseJson<T>(response: Response, limit: number): Promise<T> {
  const text = await response.text();
  if (!response.ok || text.length > limit) throw new Error("Onchain leaderboard source request failed.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Onchain leaderboard source returned invalid JSON.");
  }
}

async function latestBlock(config: OnchainLeaderboardSourceConfig, fetcher: typeof fetch): Promise<number> {
  const response = await fetcher(config.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
    cache: "no-store",
  });
  const reply = await responseJson<RpcReply>(response, 100_000);
  if (reply.error || typeof reply.result !== "string" || !/^0x[0-9a-f]+$/i.test(reply.result)) {
    throw new Error("Somnia RPC did not return a block number.");
  }
  const value = Number(BigInt(reply.result));
  if (!Number.isSafeInteger(value)) throw new Error("Somnia block number is outside the supported range.");
  return value;
}

function asHex(value: string | null | undefined, label: string): Hex {
  if (!value || !/^0x[0-9a-f]*$/i.test(value)) throw new Error(`Invalid ${label} in indexed chain log.`);
  return value as Hex;
}

function numericHex(value: string | undefined, label: string): number {
  const hex = asHex(value, label);
  const number = Number(BigInt(hex));
  if (!Number.isSafeInteger(number)) throw new Error(`Invalid ${label} in indexed chain log.`);
  return number;
}

function decodeLog(log: ExplorerLog, kind: "spawn" | "combat"): OnchainLeaderboardEvent {
  if (!Array.isArray(log.topics)) throw new Error("Indexed chain log is missing topics.");
  const topics = log.topics.filter((topic): topic is string => Boolean(topic)).map(topic => asHex(topic, "topic"));
  const timestampSeconds = numericHex(log.timeStamp, "timestamp");
  const common = (player: string) => ({
    player: player.toLowerCase() as `0x${string}`,
    blockNumber: numericHex(log.blockNumber, "block number"),
    logIndex: numericHex(log.logIndex, "log index"),
    transactionHash: asHex(log.transactionHash, "transaction hash"),
    timestamp: new Date(timestampSeconds * 1_000).toISOString(),
  } as const);
  if (kind === "spawn") {
    const decoded = decodeEventLog({
      abi: [monsterSpawnedEvent],
      data: asHex(log.data, "data"),
      topics: topics as [Hex, ...Hex[]],
    });
    const player = decoded.args.player;
    if (!isAddress(player)) throw new Error("Indexed chain log has an invalid player.");
    const room = Number(decoded.args.room);
    if (!Number.isSafeInteger(room) || room < 1) throw new Error("Indexed spawn log has an invalid room.");
    return { kind, ...common(player), room };
  }
  const decoded = decodeEventLog({
    abi: [combatResolvedEvent],
    data: asHex(log.data, "data"),
    topics: topics as [Hex, ...Hex[]],
  });
  const player = decoded.args.player;
  if (!isAddress(player)) throw new Error("Indexed chain log has an invalid player.");
  return { kind, ...common(player), monsterDefeated: decoded.args.monsterDefeated === true };
}

async function eventLogs(
  config: OnchainLeaderboardSourceConfig,
  topic: string,
  kind: "spawn" | "combat",
  toBlock: number,
  fetcher: typeof fetch,
): Promise<OnchainLeaderboardEvent[]> {
  const events: OnchainLeaderboardEvent[] = [];
  for (let page = 1; page <= MAX_LOG_PAGES; page += 1) {
    const url = new URL(config.indexerApiUrl);
    url.search = new URLSearchParams({
      module: "logs",
      action: "getLogs",
      fromBlock: String(config.deploymentBlock),
      toBlock: String(toBlock),
      address: config.contractAddress,
      topic0: topic,
      page: String(page),
      offset: String(LOG_PAGE_SIZE),
    }).toString();
    const response = await fetcher(url, { cache: "no-store" });
    const reply = await responseJson<ExplorerReply>(response, 20_000_000);
    if (!Array.isArray(reply.result)) {
      if (page === 1 && reply.status === "0" && /no (records|logs)/i.test(String(reply.message))) return [];
      throw new Error("Somnia indexer rejected the event query.");
    }
    events.push(...reply.result.map(log => decodeLog(log, kind)));
    if (reply.result.length < LOG_PAGE_SIZE) return events;
  }
  throw new Error("Somnia event history exceeded the configured page limit.");
}

export async function fetchOnchainLeaderboardSnapshot(options: {
  config?: OnchainLeaderboardSourceConfig;
  fetcher?: typeof fetch;
  now?: () => Date;
} = {}): Promise<OnchainLeaderboardSnapshot> {
  const config = options.config ?? createOnchainLeaderboardSourceConfig();
  if (!config) throw new Error("Onchain leaderboard is not configured for this deployment.");
  const fetcher = options.fetcher ?? fetch;
  const head = await latestBlock(config, fetcher);
  const indexedThroughBlock = Math.max(
    config.deploymentBlock,
    head - config.finalityBufferBlocks,
  );
  const [spawns, combats] = await Promise.all([
    eventLogs(config, MONSTER_SPAWNED_TOPIC, "spawn", indexedThroughBlock, fetcher),
    eventLogs(config, COMBAT_RESOLVED_TOPIC, "combat", indexedThroughBlock, fetcher),
  ]);
  const rows = rankOnchainLeaderboard([...spawns, ...combats]);
  return {
    version: ONCHAIN_LEADERBOARD_VERSION,
    boardId: `somnia-shannon:${config.contractAddress.toLowerCase()}:v${ONCHAIN_LEADERBOARD_VERSION}`,
    chainId: config.chainId,
    chainName: config.chainName,
    contractAddress: config.contractAddress.toLowerCase() as `0x${string}`,
    deploymentBlock: config.deploymentBlock,
    indexedThroughBlock,
    generatedAt: (options.now?.() ?? new Date()).toISOString(),
    stale: false,
    totalPlayers: rows.length,
    rows,
  };
}

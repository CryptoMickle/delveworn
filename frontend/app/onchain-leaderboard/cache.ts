import { isValidLeaderboardNamespace } from "../leaderboard/redis-store";
import {
  ONCHAIN_LEADERBOARD_VERSION,
  type OnchainLeaderboardSnapshot,
} from "./core";

type RedisResponse = { result?: unknown; error?: string };
type CacheEnvironment = Record<string, string | undefined>;

const FRESH_TTL_SECONDS = 30;
const STALE_TTL_SECONDS = 86_400;

function isSnapshot(value: unknown): value is OnchainLeaderboardSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OnchainLeaderboardSnapshot>;
  return candidate.version === ONCHAIN_LEADERBOARD_VERSION
    && typeof candidate.boardId === "string"
    && Number.isSafeInteger(candidate.chainId)
    && typeof candidate.contractAddress === "string"
    && Number.isSafeInteger(candidate.indexedThroughBlock)
    && typeof candidate.generatedAt === "string"
    && Number.isSafeInteger(candidate.totalPlayers)
    && Array.isArray(candidate.rows);
}

export class OnchainLeaderboardRedisCache {
  private readonly url: string;
  private readonly token: string;
  private readonly fetcher: typeof fetch;
  private readonly keyPrefix: string;

  constructor(options: {
    url: string;
    token: string;
    fetcher?: typeof fetch;
    namespace?: string;
  }) {
    if (!isValidLeaderboardNamespace(options.namespace)) {
      throw new Error("Leaderboard namespace must contain only letters, numbers, hyphens or underscores.");
    }
    this.url = options.url.replace(/\/+$/, "");
    this.token = options.token;
    this.fetcher = options.fetcher ?? fetch;
    this.keyPrefix = options.namespace
      ? `dw:lb:ns:${options.namespace}:onchain`
      : "dw:lb:onchain";
  }

  private async command(command: readonly (string | number)[]): Promise<unknown> {
    const response = await this.fetcher(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok || text.length > 4_000_000) throw new Error("Onchain leaderboard cache request failed.");
    let payload: RedisResponse;
    try {
      payload = JSON.parse(text) as RedisResponse;
    } catch {
      throw new Error("Onchain leaderboard cache returned invalid JSON.");
    }
    if (payload.error || !("result" in payload)) throw new Error("Onchain leaderboard cache rejected the operation.");
    return payload.result;
  }

  private key(boardId: string, freshness: "fresh" | "stale"): string {
    const safeBoard = boardId.replace(/[^a-zA-Z0-9:_-]/g, "_");
    return `${this.keyPrefix}:${safeBoard}:${freshness}:v${ONCHAIN_LEADERBOARD_VERSION}`;
  }

  async get(boardId: string, freshness: "fresh" | "stale"): Promise<OnchainLeaderboardSnapshot | null> {
    const result = await this.command(["GET", this.key(boardId, freshness)]);
    if (result === null) return null;
    if (typeof result !== "string") throw new Error("Onchain leaderboard cache returned an invalid value.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(result);
    } catch {
      throw new Error("Onchain leaderboard cache returned invalid snapshot JSON.");
    }
    if (!isSnapshot(parsed) || parsed.boardId !== boardId) {
      throw new Error("Onchain leaderboard cache returned an incompatible snapshot.");
    }
    return parsed;
  }

  async set(snapshot: OnchainLeaderboardSnapshot): Promise<void> {
    const value = JSON.stringify(snapshot);
    await Promise.all([
      this.command(["SET", this.key(snapshot.boardId, "fresh"), value, "EX", FRESH_TTL_SECONDS]),
      this.command(["SET", this.key(snapshot.boardId, "stale"), value, "EX", STALE_TTL_SECONDS]),
    ]);
  }
}

export function createOnchainLeaderboardCache(
  environment: CacheEnvironment = process.env,
  fetcher?: typeof fetch,
): OnchainLeaderboardRedisCache | null {
  const url = environment.KV_REST_API_URL ?? environment.UPSTASH_REDIS_REST_URL;
  const token = environment.KV_REST_API_TOKEN ?? environment.UPSTASH_REDIS_REST_TOKEN;
  const namespace = environment.DELVEWORN_LEADERBOARD_NAMESPACE;
  if (!url || !token || !isValidLeaderboardNamespace(namespace)) return null;
  return new OnchainLeaderboardRedisCache({ url, token, namespace, fetcher });
}

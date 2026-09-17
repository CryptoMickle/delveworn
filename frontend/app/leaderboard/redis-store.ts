import {
  LEADERBOARD_MAX_ENTRIES,
  type RankedLeaderboardEntry,
  type StoredLeaderboardEntry,
} from "./core";
import type {
  LeaderboardStore,
  LeaderboardStoreWindow,
  SubmitBestResult,
} from "./store";

type RedisResponse = { result?: unknown; error?: string };

const SUBMIT_SCRIPT = `
local oldMember = redis.call("HGET", KEYS[2], ARGV[1])
if oldMember then
  local oldJson = redis.call("HGET", KEYS[3], oldMember)
  if oldJson then
    local old = cjson.decode(oldJson)
    if tonumber(old.result.score) >= tonumber(ARGV[2]) then
      return cjson.encode({ status = "retained", entry = oldJson })
    end
  end
else
  if tonumber(redis.call("ZCARD", KEYS[1])) >= tonumber(ARGV[5]) then
    return cjson.encode({ status = "full" })
  end
end
if oldMember then
  redis.call("ZREM", KEYS[1], oldMember)
  redis.call("HDEL", KEYS[3], oldMember)
end
redis.call("ZADD", KEYS[1], ARGV[2], ARGV[3])
redis.call("HSET", KEYS[2], ARGV[1], ARGV[3])
redis.call("HSET", KEYS[3], ARGV[3], ARGV[4])
return cjson.encode({ status = oldMember and "improved" or "inserted", entry = ARGV[4] })
`;

const WINDOW_SCRIPT = `
local members = redis.call("ZREVRANGE", KEYS[1], 0, 9)
local ownMember = redis.call("HGET", KEYS[2], ARGV[1])
if ownMember then
  local ownRank = redis.call("ZREVRANK", KEYS[1], ownMember)
  if ownRank then
    local nearby = redis.call("ZREVRANGE", KEYS[1], math.max(0, ownRank - 2), ownRank + 2)
    for _, member in ipairs(nearby) do table.insert(members, member) end
  end
end
local seen = {}
local rows = {}
for _, member in ipairs(members) do
  if not seen[member] then
    seen[member] = true
    local entryJson = redis.call("HGET", KEYS[3], member)
    if entryJson then
      local entry = cjson.decode(entryJson)
      local score = tonumber(entry.result.score)
      local position = tonumber(redis.call("ZCOUNT", KEYS[1], "(" .. tostring(score), "+inf")) + 1
      table.insert(rows, { position = position, rank = redis.call("ZREVRANK", KEYS[1], member), entry = entryJson })
    end
  end
end
table.sort(rows, function(a, b) return a.rank < b.rank end)
-- Lua cjson encodes an empty table as {}, while the API requires rows: [].
if #rows == 0 then
  return '{"totalEntries":' .. tostring(redis.call("ZCARD", KEYS[1])) .. ',"rows":[]}'
end
return cjson.encode({ totalEntries = redis.call("ZCARD", KEYS[1]), rows = rows })
`;

const RATE_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
return count
`;

export function isValidLeaderboardNamespace(namespace: string | undefined): boolean {
  return !namespace || (namespace.length <= 32 && !/[^a-zA-Z0-9_-]/.test(namespace));
}

export class RedisRestLeaderboardStore implements LeaderboardStore {
  private readonly url: string;
  private readonly token: string;
  private readonly fetcher: typeof fetch;
  private readonly maxEntries: number;
  private readonly keyPrefix: string;

  constructor(options: {
    url: string;
    token: string;
    fetcher?: typeof fetch;
    maxEntries?: number;
    namespace?: string;
  }) {
    if (!isValidLeaderboardNamespace(options.namespace)) {
      throw new Error("Leaderboard namespace must contain 1–32 letters, numbers, hyphens or underscores.");
    }
    this.url = options.url.replace(/\/+$/, "");
    this.token = options.token;
    this.fetcher = options.fetcher ?? fetch;
    this.maxEntries = options.maxEntries ?? LEADERBOARD_MAX_ENTRIES;
    this.keyPrefix = options.namespace ? `dw:lb:ns:${options.namespace}` : "dw:lb";
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
    if (!response.ok || text.length > 4_000_000) throw new Error("Leaderboard storage request failed.");
    let payload: RedisResponse;
    try { payload = JSON.parse(text) as RedisResponse; } catch { throw new Error("Leaderboard storage returned invalid JSON."); }
    if (payload.error || !("result" in payload)) throw new Error("Leaderboard storage rejected the operation.");
    return payload.result;
  }

  private keys(board: string): [string, string, string] {
    return [`${this.keyPrefix}:${board}:scores`, `${this.keyPrefix}:${board}:guests`, `${this.keyPrefix}:${board}:entries`];
  }

  async submitBest(
    board: string,
    guestId: string,
    entry: StoredLeaderboardEntry
  ): Promise<SubmitBestResult> {
    const keys = this.keys(board);
    const result = await this.command([
      "EVAL",
      SUBMIT_SCRIPT,
      3,
      ...keys,
      guestId,
      entry.result.score,
      entry.memberId,
      JSON.stringify(entry),
      this.maxEntries,
    ]);
    if (typeof result !== "string") throw new Error("Leaderboard storage returned an invalid update.");
    const parsed = JSON.parse(result) as { status?: SubmitBestResult["status"]; entry?: string };
    if (!parsed.status || !["inserted", "improved", "retained", "full"].includes(parsed.status)) {
      throw new Error("Leaderboard storage returned an unknown update status.");
    }
    return {
      status: parsed.status,
      entry: parsed.entry ? JSON.parse(parsed.entry) as StoredLeaderboardEntry : null,
    };
  }

  async getWindow(board: string, guestId: string): Promise<LeaderboardStoreWindow> {
    const result = await this.command(["EVAL", WINDOW_SCRIPT, 3, ...this.keys(board), guestId]);
    if (typeof result !== "string") throw new Error("Leaderboard storage returned an invalid window.");
    const parsed = JSON.parse(result) as {
      totalEntries?: number;
      rows?: Array<{ position?: number; entry?: string }>;
    };
    if (!Number.isSafeInteger(parsed.totalEntries) || !Array.isArray(parsed.rows)) {
      throw new Error("Leaderboard storage returned an invalid window schema.");
    }
    const entries: RankedLeaderboardEntry[] = parsed.rows.map(row => {
      if (!Number.isSafeInteger(row.position) || typeof row.entry !== "string") {
        throw new Error("Leaderboard storage returned an invalid row.");
      }
      return { position: row.position!, entry: JSON.parse(row.entry) as StoredLeaderboardEntry };
    });
    return { totalEntries: parsed.totalEntries!, entries };
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const result = await this.command(["EVAL", RATE_SCRIPT, 1, `${this.keyPrefix}:rate:${key}`, windowSeconds]);
    return typeof result === "number" && result <= limit;
  }
}

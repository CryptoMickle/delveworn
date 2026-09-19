import { createHmac, randomBytes } from "node:crypto";
import { isValidLeaderboardNamespace, RedisRestLeaderboardStore } from "../leaderboard/redis-store";
import { MemoryLeaderboardStore, type LeaderboardStore } from "../leaderboard/store";

const RATE_LIMIT_NAMESPACE_BASE = "living_ai_v1";
const ADDRESS_LIMIT = 6;
const ADDRESS_WINDOW_SECONDS = 60;
const GLOBAL_LIMIT = 300;
const GLOBAL_WINDOW_SECONDS = 60 * 60;

type AiRateLimitEnvironment = Readonly<Record<string, string | undefined>>;

type AiRateLimitOptions = Readonly<{
  store?: LeaderboardStore;
  secret?: string;
  fetcher?: typeof fetch;
  addressLimit?: number;
  addressWindowSeconds?: number;
  globalLimit?: number;
  globalWindowSeconds?: number;
}>;

export type AiProviderAuthorization = "allowed" | "limited" | "unavailable";
export type AiProviderAuthorizer = (request: Request) => Promise<AiProviderAuthorization>;

let developmentStore: MemoryLeaderboardStore | null = null;
let developmentSecret: string | null = null;
let configuredAuthorizer: AiProviderAuthorizer | null = null;

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && value! > 0 ? value! : fallback;
}

function requesterAddress(request: Request): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim()
    ?? request.headers.get("x-real-ip")?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return (forwarded || "unknown").slice(0, 80);
}

function requesterKey(request: Request, secret: string): string {
  return createHmac("sha256", secret)
    .update(`living-dungeon-ai:${requesterAddress(request)}`)
    .digest("hex")
    .slice(0, 24);
}

function defaultDevelopmentStore(): MemoryLeaderboardStore {
  developmentStore ??= new MemoryLeaderboardStore();
  return developmentStore;
}

function defaultDevelopmentSecret(): string {
  developmentSecret ??= randomBytes(32).toString("hex");
  return developmentSecret;
}

function namespaceForEnvironment(environment: AiRateLimitEnvironment): string | null {
  const explicit = environment.LIVING_DUNGEON_AI_RATE_NAMESPACE?.trim();
  if (explicit !== undefined && explicit.length > 0) {
    return isValidLeaderboardNamespace(explicit) ? explicit : null;
  }
  const vercelEnvironment = environment.VERCEL_ENV?.trim().toLowerCase();
  const scope = vercelEnvironment && ["production", "preview", "development"].includes(vercelEnvironment)
    ? vercelEnvironment
    : environment.NODE_ENV === "production" ? "production" : "local";
  return `${RATE_LIMIT_NAMESPACE_BASE}_${scope}`;
}

export function createLivingDungeonAiAuthorizer(
  environment: AiRateLimitEnvironment,
  options: AiRateLimitOptions = {},
): AiProviderAuthorizer {
  const production = environment.NODE_ENV === "production";
  const namespace = namespaceForEnvironment(environment);
  const configuredSecret = options.secret
    ?? environment.LIVING_DUNGEON_AI_RATE_SECRET
    ?? environment.DELVEWORN_LEADERBOARD_COOKIE_SECRET;
  const secret = configuredSecret && configuredSecret.length >= 32
    ? configuredSecret
    : production ? null : defaultDevelopmentSecret();

  let store = options.store;
  if (!store) {
    const redisUrl = environment.KV_REST_API_URL ?? environment.UPSTASH_REDIS_REST_URL;
    const redisToken = environment.KV_REST_API_TOKEN ?? environment.UPSTASH_REDIS_REST_TOKEN;
    if (redisUrl && redisToken) {
      store = new RedisRestLeaderboardStore({
        url: redisUrl,
        token: redisToken,
        fetcher: options.fetcher,
        namespace: namespace ?? undefined,
      });
    } else if (!production) {
      store = defaultDevelopmentStore();
    }
  }

  if (!secret || !store || !namespace) return async () => "unavailable";

  const addressLimit = positiveInteger(options.addressLimit, ADDRESS_LIMIT);
  const addressWindowSeconds = positiveInteger(options.addressWindowSeconds, ADDRESS_WINDOW_SECONDS);
  const globalLimit = positiveInteger(options.globalLimit, GLOBAL_LIMIT);
  const globalWindowSeconds = positiveInteger(options.globalWindowSeconds, GLOBAL_WINDOW_SECONDS);

  return async (request: Request): Promise<AiProviderAuthorization> => {
    try {
      const addressAllowed = await store.consumeRateLimit(
        `address:${requesterKey(request, secret)}`,
        addressLimit,
        addressWindowSeconds,
      );
      // Do not let one already-blocked address exhaust the shared allowance.
      if (!addressAllowed) return "limited";
      const globalAllowed = await store.consumeRateLimit("global", globalLimit, globalWindowSeconds);
      return globalAllowed ? "allowed" : "limited";
    } catch {
      return "unavailable";
    }
  };
}

export function getLivingDungeonAiAuthorizer(): AiProviderAuthorizer {
  configuredAuthorizer ??= createLivingDungeonAiAuthorizer(process.env);
  return configuredAuthorizer;
}

export const livingDungeonAiRateLimitInternals = {
  requesterKey,
  namespaceForEnvironment,
};

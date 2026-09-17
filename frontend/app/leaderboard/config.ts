import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFileLeaderboardStore } from "./local-store";
import { isValidLeaderboardNamespace, RedisRestLeaderboardStore } from "./redis-store";
import type { LeaderboardStore } from "./store";

export type LeaderboardBackendStatus = {
  enabled: boolean;
  mode: "redis" | "local" | "disabled";
  reason: "ready" | "disabled_by_config" | "missing_storage" | "missing_cookie_secret" | "invalid_namespace";
};

export type LeaderboardBackend = {
  status: LeaderboardBackendStatus;
  store: LeaderboardStore | null;
  cookieSecret: string | null;
};

type LeaderboardEnvironment = Record<string, string | undefined>;

let developmentCookieSecret: string | null = null;
let backend: LeaderboardBackend | null = null;

function localCookieSecret(): string {
  developmentCookieSecret ??= randomBytes(32).toString("hex");
  return developmentCookieSecret;
}

export function createLeaderboardBackend(
  environment: LeaderboardEnvironment,
  options: { fetcher?: typeof fetch } = {}
): LeaderboardBackend {
  if (environment.DELVEWORN_LEADERBOARD_ENABLED?.trim().toLowerCase() === "false") {
    return {
      status: { enabled: false, mode: "disabled", reason: "disabled_by_config" },
      store: null,
      cookieSecret: null,
    };
  }

  const redisUrl = environment.KV_REST_API_URL ?? environment.UPSTASH_REDIS_REST_URL;
  const redisToken = environment.KV_REST_API_TOKEN ?? environment.UPSTASH_REDIS_REST_TOKEN;
  const configuredSecret = environment.DELVEWORN_LEADERBOARD_COOKIE_SECRET;
  const production = environment.NODE_ENV === "production";

  if (redisUrl && redisToken && configuredSecret && configuredSecret.length >= 32) {
    const namespace = environment.DELVEWORN_LEADERBOARD_NAMESPACE;
    if (!isValidLeaderboardNamespace(namespace)) {
      return {
        status: { enabled: false, mode: "disabled", reason: "invalid_namespace" },
        store: null,
        cookieSecret: null,
      };
    }
    return {
      status: { enabled: true, mode: "redis", reason: "ready" },
      store: new RedisRestLeaderboardStore({
        url: redisUrl,
        token: redisToken,
        fetcher: options.fetcher,
        namespace,
      }),
      cookieSecret: configuredSecret,
    };
  }

  if (production) {
    const storageReady = Boolean(redisUrl && redisToken);
    return {
      status: {
        enabled: false,
        mode: "disabled",
        reason: storageReady ? "missing_cookie_secret" : "missing_storage",
      },
      store: null,
      cookieSecret: null,
    };
  }

  const filePath = environment.DELVEWORN_LEADERBOARD_LOCAL_FILE
    ?? join(tmpdir(), "delveworn-weekly-leaderboard.json");
  return {
    status: { enabled: true, mode: "local", reason: "ready" },
    store: new LocalFileLeaderboardStore(filePath),
    cookieSecret: configuredSecret && configuredSecret.length >= 32
      ? configuredSecret
      : localCookieSecret(),
  };
}

export function getLeaderboardBackend(): LeaderboardBackend {
  backend ??= createLeaderboardBackend(process.env);
  return backend;
}

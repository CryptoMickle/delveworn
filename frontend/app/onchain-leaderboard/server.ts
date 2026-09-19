import { isAddress } from "viem";
import { createOnchainLeaderboardCache } from "./cache";
import {
  onchainLeaderboardWindow,
  type OnchainLeaderboardSnapshot,
} from "./core";
import {
  createOnchainLeaderboardSourceConfig,
  fetchOnchainLeaderboardSnapshot,
  type OnchainLeaderboardSourceConfig,
} from "./source";

type SnapshotBuilder = () => Promise<OnchainLeaderboardSnapshot>;

let memorySnapshot: OnchainLeaderboardSnapshot | null = null;
let memoryExpiresAt = 0;
let inFlight: Promise<OnchainLeaderboardSnapshot> | null = null;

function boardId(config: OnchainLeaderboardSourceConfig): string {
  return `somnia-shannon:${config.contractAddress.toLowerCase()}:v1`;
}

export async function getOnchainLeaderboardSnapshot(options: {
  config?: OnchainLeaderboardSourceConfig;
  build?: SnapshotBuilder;
  now?: () => number;
} = {}): Promise<OnchainLeaderboardSnapshot> {
  const config = options.config ?? createOnchainLeaderboardSourceConfig();
  if (!config) throw new Error("Onchain leaderboard is unavailable for this deployment.");
  const now = options.now?.() ?? Date.now();
  if (memorySnapshot?.boardId === boardId(config) && now < memoryExpiresAt) return memorySnapshot;

  const cache = createOnchainLeaderboardCache();
  if (cache) {
    try {
      const cached = await cache.get(boardId(config), "fresh");
      if (cached) {
        memorySnapshot = cached;
        memoryExpiresAt = now + 15_000;
        return cached;
      }
    } catch {
      // The canonical chain source remains available if cache reads fail.
    }
  }

  if (!inFlight) {
    const build = options.build ?? (() => fetchOnchainLeaderboardSnapshot({ config }));
    inFlight = build().then(async snapshot => {
      memorySnapshot = snapshot;
      memoryExpiresAt = (options.now?.() ?? Date.now()) + 15_000;
      if (cache) {
        try {
          await cache.set(snapshot);
        } catch {
          // Serving a verified snapshot does not depend on the optional cache.
        }
      }
      return snapshot;
    }).finally(() => {
      inFlight = null;
    });
  }

  try {
    return await inFlight;
  } catch (error) {
    if (memorySnapshot?.boardId === boardId(config)) {
      return { ...memorySnapshot, stale: true };
    }
    if (cache) {
      try {
        const stale = await cache.get(boardId(config), "stale");
        if (stale) return { ...stale, stale: true };
      } catch {
        // Preserve the source failure below.
      }
    }
    throw error;
  }
}

export function onchainLeaderboardReply(
  snapshot: OnchainLeaderboardSnapshot,
  requestedPlayer: string | null,
) {
  const player = requestedPlayer && isAddress(requestedPlayer)
    ? requestedPlayer.toLowerCase()
    : null;
  return {
    ...snapshot,
    rows: onchainLeaderboardWindow(snapshot.rows, player).map(row => ({
      ...row,
      own: player !== null && row.player.toLowerCase() === player,
    })),
    requestedPlayer: player,
  };
}

export function resetOnchainLeaderboardMemoryForTests(): void {
  memorySnapshot = null;
  memoryExpiresAt = 0;
  inFlight = null;
}

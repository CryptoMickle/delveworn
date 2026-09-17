import {
  LEADERBOARD_MAX_ENTRIES,
  leaderboardWindow,
  type RankedLeaderboardEntry,
  type StoredLeaderboardEntry,
} from "./core";

export type SubmitBestResult = {
  status: "inserted" | "improved" | "retained" | "full";
  entry: StoredLeaderboardEntry | null;
};

export type LeaderboardStoreWindow = {
  totalEntries: number;
  entries: RankedLeaderboardEntry[];
};

export interface LeaderboardStore {
  submitBest(
    board: string,
    guestId: string,
    entry: StoredLeaderboardEntry
  ): Promise<SubmitBestResult>;
  getWindow(board: string, guestId: string): Promise<LeaderboardStoreWindow>;
  consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

type RateWindow = { count: number; expiresAt: number };

/** In-memory implementation is intended for unit tests, not production. */
export class MemoryLeaderboardStore implements LeaderboardStore {
  readonly boards = new Map<string, Map<string, StoredLeaderboardEntry>>();
  readonly rates = new Map<string, RateWindow>();
  private readonly maxEntries: number;
  private now: () => number;

  constructor(options: { maxEntries?: number; now?: () => number } = {}) {
    this.maxEntries = options.maxEntries ?? LEADERBOARD_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  async submitBest(
    board: string,
    guestId: string,
    entry: StoredLeaderboardEntry
  ): Promise<SubmitBestResult> {
    const entries = this.boards.get(board) ?? new Map<string, StoredLeaderboardEntry>();
    this.boards.set(board, entries);
    const current = entries.get(guestId);
    if (current && current.result.score >= entry.result.score) {
      return { status: "retained", entry: current };
    }
    if (!current && entries.size >= this.maxEntries) return { status: "full", entry: null };
    entries.set(guestId, entry);
    return { status: current ? "improved" : "inserted", entry };
  }

  async getWindow(board: string, guestId: string): Promise<LeaderboardStoreWindow> {
    const entries = [...(this.boards.get(board)?.values() ?? [])];
    return leaderboardWindow(entries, guestId);
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = this.now();
    const current = this.rates.get(key);
    const next = !current || current.expiresAt <= now
      ? { count: 1, expiresAt: now + windowSeconds * 1_000 }
      : { count: current.count + 1, expiresAt: current.expiresAt };
    this.rates.set(key, next);
    return next.count <= limit;
  }
}

import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  LEADERBOARD_MAX_ENTRIES,
  leaderboardWindow,
  type StoredLeaderboardEntry,
} from "./core";
import type {
  LeaderboardStore,
  LeaderboardStoreWindow,
  SubmitBestResult,
} from "./store";

type LocalLeaderboardData = {
  boards: Record<string, StoredLeaderboardEntry[]>;
  rates: Record<string, { count: number; expiresAt: number }>;
};

const EMPTY_DATA = (): LocalLeaderboardData => ({ boards: {}, rates: {} });

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export class LocalFileLeaderboardStore implements LeaderboardStore {
  private readonly filePath: string;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(filePath: string, options: { maxEntries?: number; now?: () => number } = {}) {
    this.filePath = filePath;
    this.maxEntries = options.maxEntries ?? LEADERBOARD_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  private async read(): Promise<LocalLeaderboardData> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid local leaderboard data.");
      const value = parsed as Partial<LocalLeaderboardData>;
      if (!value.boards || typeof value.boards !== "object" || !value.rates || typeof value.rates !== "object") {
        throw new Error("Invalid local leaderboard schema.");
      }
      return value as LocalLeaderboardData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_DATA();
      throw error;
    }
  }

  private async write(data: LocalLeaderboardData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data), { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  private async withLock<T>(work: (data: LocalLeaderboardData) => Promise<T> | T): Promise<T> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const lockPath = `${this.filePath}.lock`;
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        handle = await open(lockPath, "wx", 0o600);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try {
          const info = await stat(lockPath);
          if (this.now() - info.mtimeMs > 30_000) await unlink(lockPath);
        } catch (statError) {
          if ((statError as NodeJS.ErrnoException).code !== "ENOENT") throw statError;
        }
        await delay(10);
      }
    }
    if (!handle) throw new Error("The local leaderboard is busy.");
    try {
      const data = await this.read();
      const result = await work(data);
      await this.write(data);
      return result;
    } finally {
      await handle.close();
      await unlink(lockPath).catch(() => undefined);
    }
  }

  async submitBest(
    board: string,
    guestId: string,
    entry: StoredLeaderboardEntry
  ): Promise<SubmitBestResult> {
    return this.withLock(data => {
      const entries = data.boards[board] ?? [];
      data.boards[board] = entries;
      const index = entries.findIndex(candidate => candidate.guestId === guestId);
      const current = index >= 0 ? entries[index] : null;
      if (current && current.result.score >= entry.result.score) {
        return { status: "retained", entry: current };
      }
      if (!current && entries.length >= this.maxEntries) return { status: "full", entry: null };
      if (index >= 0) entries[index] = entry;
      else entries.push(entry);
      return { status: current ? "improved" : "inserted", entry };
    });
  }

  async getWindow(board: string, guestId: string): Promise<LeaderboardStoreWindow> {
    const data = await this.read();
    return leaderboardWindow(data.boards[board] ?? [], guestId);
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    return this.withLock(data => {
      const now = this.now();
      for (const [rateKey, window] of Object.entries(data.rates)) {
        if (window.expiresAt <= now) delete data.rates[rateKey];
      }
      const current = data.rates[key];
      const next = !current
        ? { count: 1, expiresAt: now + windowSeconds * 1_000 }
        : { count: current.count + 1, expiresAt: current.expiresAt };
      data.rates[key] = next;
      return next.count <= limit;
    });
  }
}

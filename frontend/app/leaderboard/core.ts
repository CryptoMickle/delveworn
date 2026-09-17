import type { WeeklyDescentResult } from "../descent/weekly";

export const LEADERBOARD_RULES_VERSION = 2 as const;
export const LEADERBOARD_TOP_SIZE = 10;
export const LEADERBOARD_NEIGHBOR_RADIUS = 2;
export const LEADERBOARD_MAX_ENTRIES = 10_000;
export const LEADERBOARD_MAX_REQUEST_BYTES = 4_096;
export const LEADERBOARD_SUBMIT_LIMIT = 20;
export const LEADERBOARD_SUBMIT_WINDOW_SECONDS = 60;

export type StoredLeaderboardEntry = {
  guestId: string;
  memberId: string;
  entryId: string;
  nickname: string | null;
  nicknameHidden: boolean;
  achievedAt: string;
  result: WeeklyDescentResult;
};

export type RankedLeaderboardEntry = {
  position: number;
  entry: StoredLeaderboardEntry;
};

export type LeaderboardRow = {
  position: number;
  entryId: string;
  nickname: string | null;
  nicknameHidden: boolean;
  achievedAt: string;
  own: boolean;
  result: WeeklyDescentResult;
};

export type LeaderboardSnapshot = {
  status: "ready";
  challengeId: string;
  rulesVersion: typeof LEADERBOARD_RULES_VERSION;
  archived: boolean;
  developmentOnly: boolean;
  totalEntries: number;
  rows: LeaderboardRow[];
};

export class LeaderboardInputError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LeaderboardInputError";
    this.code = code;
  }
}

const HIDDEN_NICKNAME_TERMS = [
  "admin",
  "delveworn",
  "moderator",
  "fuck",
  "shit",
] as const;

export function normalizeLeaderboardNickname(value: unknown): {
  nickname: string | null;
  nicknameHidden: boolean;
} {
  if (value === undefined || value === null || value === "") {
    return { nickname: null, nicknameHidden: false };
  }
  if (typeof value !== "string") {
    throw new LeaderboardInputError("invalid_nickname", "The nickname must be text.");
  }
  const nickname = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (nickname.length < 2 || nickname.length > 20 || !/^[\p{L}\p{N}_ -]+$/u.test(nickname)) {
    throw new LeaderboardInputError(
      "invalid_nickname",
      "Use 2–20 letters, numbers, spaces, underscores, or hyphens for the nickname."
    );
  }
  const folded = nickname.toLocaleLowerCase("en-US").replace(/[ _-]/g, "");
  if (HIDDEN_NICKNAME_TERMS.some((term) => folded.includes(term))) {
    return { nickname: null, nicknameHidden: true };
  }
  return { nickname, nicknameHidden: false };
}

export function weeklyLeaderboardKey(challengeId: string): string {
  return `weekly:${challengeId}:v${LEADERBOARD_RULES_VERSION}`;
}

export function leaderboardMemberId(
  achievedAt: string,
  entryId: string,
  guestId: string
): string {
  const milliseconds = Date.parse(achievedAt);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new LeaderboardInputError("invalid_time", "The leaderboard timestamp is invalid.");
  }
  const inverseTime = String(9_999_999_999_999 - milliseconds).padStart(13, "0");
  return `${inverseTime}:${entryId}:${guestId}`;
}

function compareEntries(left: StoredLeaderboardEntry, right: StoredLeaderboardEntry): number {
  return right.result.score - left.result.score
    || left.achievedAt.localeCompare(right.achievedAt)
    || left.entryId.localeCompare(right.entryId)
    || left.guestId.localeCompare(right.guestId);
}

export function rankLeaderboardEntries(
  entries: readonly StoredLeaderboardEntry[]
): RankedLeaderboardEntry[] {
  const sorted = [...entries].sort(compareEntries);
  let previousScore: number | null = null;
  let position = 0;
  return sorted.map((entry, index) => {
    if (entry.result.score !== previousScore) position = index + 1;
    previousScore = entry.result.score;
    return { position, entry };
  });
}

export function leaderboardWindow(
  entries: readonly StoredLeaderboardEntry[],
  guestId: string
): { totalEntries: number; entries: RankedLeaderboardEntry[] } {
  const ranked = rankLeaderboardEntries(entries);
  const selected = new Set<number>();
  for (let index = 0; index < Math.min(LEADERBOARD_TOP_SIZE, ranked.length); index += 1) {
    selected.add(index);
  }
  const ownIndex = ranked.findIndex(({ entry }) => entry.guestId === guestId);
  if (ownIndex >= 0) {
    const start = Math.max(0, ownIndex - LEADERBOARD_NEIGHBOR_RADIUS);
    const end = Math.min(ranked.length - 1, ownIndex + LEADERBOARD_NEIGHBOR_RADIUS);
    for (let index = start; index <= end; index += 1) selected.add(index);
  }
  return {
    totalEntries: ranked.length,
    entries: [...selected].sort((left, right) => left - right).map(index => ranked[index]),
  };
}

export function publicLeaderboardRows(
  ranked: readonly RankedLeaderboardEntry[],
  guestId: string
): LeaderboardRow[] {
  return ranked.map(({ position, entry }) => ({
    position,
    entryId: entry.entryId,
    nickname: entry.nickname,
    nicknameHidden: entry.nicknameHidden,
    achievedAt: entry.achievedAt,
    own: entry.guestId === guestId,
    result: entry.result,
  }));
}

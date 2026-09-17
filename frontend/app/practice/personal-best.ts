import type { PracticeGame } from "./engine";
import { isStoredPracticeGame } from "./storage";

export const PRACTICE_PERSONAL_BEST_KEY = "delveworn_practice_personal_best_v1";

type PersonalBestStorage = Pick<Storage, "getItem" | "setItem">;

export type PracticePersonalBestLoad =
  | { status: "restored"; roomsCleared: number }
  | { status: "empty" | "invalid" | "unavailable" };

export type PracticePersonalBestUpdate =
  | { status: "recorded" | "kept"; roomsCleared: number }
  | { status: "invalid" | "unavailable" };

function validRooms(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000;
}

export function loadPracticePersonalBest(storage: PersonalBestStorage): PracticePersonalBestLoad {
  try {
    const raw = storage.getItem(PRACTICE_PERSONAL_BEST_KEY);
    if (raw === null) return { status: "empty" };
    if (raw.length > 128) return { status: "invalid" };
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return { status: "invalid" }; }
    if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "invalid" };
    const stored = value as Record<string, unknown>;
    if (Object.keys(stored).sort().join(",") !== "roomsCleared,version"
      || stored.version !== 1 || !validRooms(stored.roomsCleared)) return { status: "invalid" };
    return { status: "restored", roomsCleared: stored.roomsCleared };
  } catch {
    return { status: "unavailable" };
  }
}

/** Local Practice has no proof log, so this record is always self-reported. */
export function recordPracticePersonalBest(
  storage: PersonalBestStorage,
  game: PracticeGame,
): PracticePersonalBestUpdate {
  if (!isStoredPracticeGame(game) || !game.hasStarted || game.active) return { status: "invalid" };
  const current = loadPracticePersonalBest(storage);
  if (current.status === "unavailable") return { status: "unavailable" };
  if (current.status === "invalid") return { status: "invalid" };
  if (current.status === "restored" && current.roomsCleared >= game.roomsCleared) {
    return { status: "kept", roomsCleared: current.roomsCleared };
  }
  try {
    storage.setItem(PRACTICE_PERSONAL_BEST_KEY, JSON.stringify({ version: 1, roomsCleared: game.roomsCleared }));
    const confirmed = loadPracticePersonalBest(storage);
    return confirmed.status === "restored" && confirmed.roomsCleared >= game.roomsCleared
      ? { status: "recorded", roomsCleared: confirmed.roomsCleared }
      : { status: confirmed.status === "unavailable" ? "unavailable" : "invalid" };
  } catch {
    return { status: "unavailable" };
  }
}

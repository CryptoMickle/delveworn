import { isStoredPracticeGame } from "../practice/storage";
import { BUILDS, DESCENT_RULES, ROOMS, roomNumber, type Descent } from "./model";

export const DESCENT_SAVE_KEY = "delveworn_first_descent_v1";
type StorageSource = () => Pick<Storage, "getItem" | "setItem">;
export type LoadResult = { status: "restored"; run: Descent } | { status: "empty" | "invalid" | "unavailable" };
const integer = (value: unknown, max: number) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max;

export function isDescent(value: unknown): value is Descent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Descent;
  if (v.rules !== DESCENT_RULES || typeof v.runId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(v.runId)
    || !BUILDS.some(b => b.id === v.build) || typeof v.engaged !== "boolean" || !isStoredPracticeGame(v.game)
    || !integer(v.seed, 0xffffffff) || !integer(v.rngState, 0xffffffff) || v.rngState === 0
    || ![v.revision, v.roomTurns, v.turns, v.damageDealt, v.damageTaken, v.potionsUsed].every(n => integer(n, 1_000_000))) return false;
  const g = v.game, room = roomNumber(v);
  return g.hasStarted && g.roomsCleared <= 10 && room > 0 && g.monsterType === ROOMS[room-1].enemy
    && (g.roomsCleared < 10 || g.monsterHp === 0)
    && g.equippedRelic === BUILDS.find(b => b.id === v.build)!.relic
    && v.turns >= v.roomTurns && v.revision >= v.turns && v.potionsUsed <= v.revision
    && !(v.engaged && (g.monsterHp === 0 || !g.active))
    && (v.engaged || g.monsterHp === 0 || !g.active || v.roomTurns === 0);
}

export function loadDescent(source: StorageSource): LoadResult {
  try {
    const raw = source().getItem(DESCENT_SAVE_KEY);
    if (raw === null) return { status: "empty" };
    if (raw.length > 40_000) return { status: "invalid" };
    let value: unknown; try { value = JSON.parse(raw); } catch { return { status: "invalid" }; }
    return isDescent(value) ? { status: "restored", run: value } : { status: "invalid" };
  } catch { return { status: "unavailable" }; }
}

/** Compare-before-write stops stale tabs; unknown saves are never auto-overwritten. */
export function saveDescent(source: StorageSource, next: Descent, previous: Descent | null, replace = false): "saved" | "conflict" | "unavailable" {
  if (!isDescent(next)) return "conflict";
  const stored = loadDescent(source);
  if (stored.status === "unavailable") return "unavailable";
  if (!replace && (stored.status === "invalid" || (stored.status === "restored"
    && (stored.run.runId !== previous?.runId || stored.run.revision !== previous?.revision)))) return "conflict";
  if (!replace && stored.status === "empty" && previous !== null) return "conflict";
  try { source().setItem(DESCENT_SAVE_KEY, JSON.stringify(next)); return "saved"; }
  catch { return "unavailable"; }
}

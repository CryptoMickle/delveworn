import { isStoredPracticeGame } from "../practice/storage";
import { DESCENT_RULES, ROOMS, roomNumber, type Descent, type PendingLoot } from "./model";

export const DESCENT_SAVE_KEY = "delveworn_first_descent_v2";
export const LEGACY_DESCENT_SAVE_KEY = "delveworn_first_descent_v1";
type StorageSource = () => Pick<Storage, "getItem" | "setItem">;
export type LoadResult =
  | { status: "restored"; run: Descent }
  | { status: "empty" | "legacy" | "invalid" | "unavailable" };
const integer = (value: unknown, max: number) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max;

function isPendingLoot(value: unknown): value is PendingLoot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const loot = value as PendingLoot;
  if (!integer(loot.gold, 1_000_000_000) || !integer(loot.potions, 1)
    || !integer(loot.weapon, 1) || !integer(loot.armor, 1)) return false;
  return loot.gold > 0 && loot.potions + loot.weapon + loot.armor <= 1;
}

function pendingMatchesGame(run: Descent): boolean {
  const loot = run.pendingLoot;
  if (loot === null) return true;
  const g = run.game;
  if (!g.active || g.monsterHp !== 0 || g.roomsCleared < 1 || g.potions + loot.potions > 5) return false;
  const baseByMonster = [5, 8, 12, 30] as const;
  const base = baseByMonster[g.monsterType];
  const baseGold = base + Math.floor((base * (g.roomsCleared - 1)) / 20);
  if (g.lastLootType === 1) return g.lastLootAmount === 1 && loot.gold === baseGold && loot.potions === 1 && loot.weapon === 0 && loot.armor === 0;
  if (g.lastLootType === 2) return g.lastLootAmount > 0 && loot.gold === baseGold + g.lastLootAmount && loot.potions === 0 && loot.weapon === 0 && loot.armor === 0;
  if (g.lastLootType === 3) return g.lastLootAmount === 1 && loot.gold === baseGold && loot.potions === 0 && loot.weapon === 1 && loot.armor === 0;
  return g.lastLootType === 4 && g.lastLootAmount === 1 && loot.gold === baseGold && loot.potions === 0 && loot.weapon === 0 && loot.armor === 1;
}

function relicStateMatchesProgress(run: Descent): boolean {
  const g = run.game;
  const noRelic = g.equippedRelic === 0 && g.ownedRelics.length === 0 && g.relicCounts.every(count => count === 0);
  if (g.roomsCleared < 10 || g.relicOfferAvailable) return noRelic;
  if (g.ownedRelics.length !== 1) return false;
  const relic = g.ownedRelics[0];
  return g.relicCounts[relic] === 1
    && g.relicCounts.every((count, id) => id === relic ? count === 1 : count === 0)
    && (g.equippedRelic === 0 || g.equippedRelic === relic);
}

export function isDescent(value: unknown): value is Descent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Descent;
  if (v.rules !== DESCENT_RULES || typeof v.runId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(v.runId)
    || typeof v.engaged !== "boolean" || !isStoredPracticeGame(v.game)
    || (v.pendingLoot !== null && !isPendingLoot(v.pendingLoot))
    || !integer(v.seed, 0xffffffff) || !integer(v.rngState, 0xffffffff) || v.rngState === 0
    || ![v.revision, v.roomTurns, v.turns, v.damageDealt, v.damageTaken, v.potionsUsed].every(n => integer(n, 1_000_000))) return false;
  const g = v.game, room = roomNumber(v);
  return g.hasStarted && g.roomsCleared <= 10 && room > 0 && g.monsterType === ROOMS[room - 1].enemy
    && (g.roomsCleared < 10 || g.monsterHp === 0)
    && v.turns >= v.roomTurns && v.revision >= v.turns && v.potionsUsed <= v.revision
    && !(v.engaged && (g.monsterHp === 0 || !g.active))
    && (v.engaged || g.monsterHp === 0 || !g.active || v.roomTurns === 0)
    && pendingMatchesGame(v) && relicStateMatchesProgress(v);
}

export function loadDescent(source: StorageSource): LoadResult {
  try {
    const storage = source();
    const raw = storage.getItem(DESCENT_SAVE_KEY);
    if (raw === null) {
      return storage.getItem(LEGACY_DESCENT_SAVE_KEY) === null ? { status: "empty" } : { status: "legacy" };
    }
    if (raw.length > 40_000) return { status: "invalid" };
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return { status: "invalid" }; }
    return isDescent(value) ? { status: "restored", run: value } : { status: "invalid" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Compare-before-write stops stale tabs; unknown saves are never auto-overwritten. */
export function saveDescent(source: StorageSource, next: Descent, previous: Descent | null, replace = false): "saved" | "conflict" | "unavailable" {
  if (!isDescent(next)) return "conflict";
  const stored = loadDescent(source);
  if (stored.status === "unavailable") return "unavailable";
  if (!replace && (stored.status === "invalid" || (stored.status === "restored"
    && (stored.run.runId !== previous?.runId || stored.run.revision !== previous?.revision)))) return "conflict";
  if (!replace && (stored.status === "empty" || stored.status === "legacy") && previous !== null) return "conflict";
  try {
    source().setItem(DESCENT_SAVE_KEY, JSON.stringify(next));
    return "saved";
  } catch {
    return "unavailable";
  }
}

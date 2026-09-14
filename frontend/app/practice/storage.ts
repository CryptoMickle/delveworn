import { getMaxHpForRelic } from "../relics";
import type { PracticeGame } from "./engine";

export const PRACTICE_RUN_STORAGE_KEY = "delveworn_practice_run_v1";
const PRACTICE_RUN_STORAGE_VERSION = 1;
const MAX_SAVE_LENGTH = 40_000;

export type PracticeRunStorage = Pick<Storage, "getItem" | "setItem">;
// A getter is intentional: accessing window.localStorage can itself throw.
type StorageSource = PracticeRunStorage | (() => PracticeRunStorage);
export type PracticeRunLoad =
  | { status: "empty" }
  | { status: "restored"; game: PracticeGame }
  | { status: "invalid"; reason: "format" | "version" }
  | { status: "unavailable" };
export type PracticeRunSave = "saved" | "invalid" | "unavailable";

const NUMBER_BOUNDS: ReadonlyArray<readonly [keyof PracticeGame, number, number]> = [
  ["hp", 0, 150], ["maxHp", 20, 150], ["baseMaxHp", 20, 100],
  ["monsterHp", 0, 10_000_000], ["monsterMaxHp", 0, 10_000_000],
  // Practice is endless. These are safety bounds, not Market Dungeon's 40-room limit.
  ["roomsCleared", 0, 1_000_000], ["gold", 0, 1_000_000_000_000],
  ["potions", 0, 5], ["weaponLevel", 0, 1_000_000], ["armorLevel", 0, 1_000_000],
  ["monsterType", 0, 3], ["lastLootType", 0, 4], ["lastLootAmount", 0, 1_000_000_000],
  ["equippedRelic", 0, 15], ["relicOfferRarity", 0, 5], ["relicOfferId", 0, 15],
  ["lastPlayerDamage", 0, 10_000_000], ["lastMonsterDamage", 0, 10_000_000],
  ["combatPotionsUsed", 0, 3], ["campPotionsBought", 0, 2], ["supplyPotionsBought", 0, 2],
];

const BOOLEAN_FIELDS = [
  "hasStarted", "active", "relicOfferAvailable", "relicReviveUsed", "lastCritical",
  "campRestUsed", "supplyBandageUsed",
] as const satisfies readonly (keyof PracticeGame)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

export function isStoredPracticeGame(value: unknown): value is PracticeGame {
  if (!isRecord(value)) return false;
  if (!NUMBER_BOUNDS.every(([field, min, max]) => integer(value[field], min, max))) return false;
  if (BOOLEAN_FIELDS.some((field) => typeof value[field] !== "boolean")) return false;
  if (!Array.isArray(value.ownedRelics) || value.ownedRelics.length > 15
    || !value.ownedRelics.every((id) => integer(id, 1, 15))
    || new Set(value.ownedRelics).size !== value.ownedRelics.length) return false;
  if (!Array.isArray(value.relicCounts) || value.relicCounts.length !== 16
    || !value.relicCounts.every((count) => integer(count, 0, 1_000_000))
    || value.relicCounts[0] !== 0) return false;
  if (!Array.isArray(value.log) || value.log.length > 12
    || value.log.some((entry) => typeof entry !== "string" || entry.length > 1_000)) return false;

  const game = value as unknown as PracticeGame;
  if (game.hp > game.maxHp || game.monsterHp > game.monsterMaxHp) return false;
  if (game.maxHp !== getMaxHpForRelic(game.baseMaxHp, game.equippedRelic)) return false;
  if (game.equippedRelic !== 0 && !game.ownedRelics.includes(game.equippedRelic)) return false;
  if (game.relicCounts.some((count, id) => id > 0 && (count > 0) !== game.ownedRelics.includes(id))) return false;
  if (game.combatPotionsUsed > (game.monsterType === 3 ? 3 : 2)) return false;
  if (game.active && (!game.hasStarted || game.hp === 0)) return false;
  if (game.hasStarted && game.active !== (game.hp > 0)) return false;
  if (!game.hasStarted && (game.active || game.roomsCleared !== 0 || game.monsterMaxHp !== 0 || game.relicOfferAvailable)) return false;
  if (game.hasStarted && game.monsterMaxHp === 0) return false;
  if (game.hasStarted && game.monsterHp === 0 && game.roomsCleared === 0) return false;
  if (game.hasStarted) {
    const encounterRoom = game.monsterHp > 0 ? game.roomsCleared + 1 : game.roomsCleared;
    if ((game.monsterType === 3) !== (encounterRoom % 10 === 0)) return false;
  }
  if (game.relicOfferAvailable) {
    if (!game.active || game.monsterHp !== 0 || game.monsterType !== 3 || game.roomsCleared % 10 !== 0
      || game.relicOfferId === 0 || Math.floor((game.relicOfferId - 1) / 3) + 1 !== game.relicOfferRarity) return false;
  } else if (game.relicOfferId !== 0 || game.relicOfferRarity !== 0) return false;
  return true;
}

export function inspectPracticeRun(source: StorageSource): PracticeRunLoad {
  try {
    const storage = typeof source === "function" ? source() : source;
    const serialized = storage.getItem(PRACTICE_RUN_STORAGE_KEY);
    if (serialized === null) return { status: "empty" };
    if (serialized.length > MAX_SAVE_LENGTH) return { status: "invalid", reason: "format" };
    let stored: unknown;
    try { stored = JSON.parse(serialized); } catch { return { status: "invalid", reason: "format" }; }
    if (!isRecord(stored)) return { status: "invalid", reason: "format" };
    if (stored.version !== PRACTICE_RUN_STORAGE_VERSION) return { status: "invalid", reason: "version" };
    if (!isStoredPracticeGame(stored.game)) return { status: "invalid", reason: "format" };
    return { status: "restored", game: stored.game };
  } catch {
    return { status: "unavailable" };
  }
}

export function loadPracticeRun(source: StorageSource): PracticeGame | null {
  const loaded = inspectPracticeRun(source);
  return loaded.status === "restored" ? loaded.game : null;
}

export function savePracticeRun(source: StorageSource, game: PracticeGame): PracticeRunSave {
  if (!isStoredPracticeGame(game)) return "invalid";
  try {
    const storage = typeof source === "function" ? source() : source;
    storage.setItem(PRACTICE_RUN_STORAGE_KEY, JSON.stringify({ version: PRACTICE_RUN_STORAGE_VERSION, game }));
    return "saved";
  } catch {
    return "unavailable";
  }
}

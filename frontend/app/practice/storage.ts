import type { PracticeGame } from "./engine";

const PRACTICE_RUN_STORAGE_KEY = "delveworn_practice_run_v1";
const PRACTICE_RUN_STORAGE_VERSION = 1;

type PracticeRunStorage = Pick<Storage, "getItem" | "setItem">;

type StoredPracticeRun = {
  version: typeof PRACTICE_RUN_STORAGE_VERSION;
  game: PracticeGame;
};

const NUMBER_FIELDS = [
  "hp",
  "maxHp",
  "baseMaxHp",
  "monsterHp",
  "monsterMaxHp",
  "roomsCleared",
  "gold",
  "potions",
  "weaponLevel",
  "armorLevel",
  "monsterType",
  "lastLootType",
  "lastLootAmount",
  "equippedRelic",
  "relicOfferRarity",
  "relicOfferId",
  "lastPlayerDamage",
  "lastMonsterDamage",
  "combatPotionsUsed",
  "campPotionsBought",
  "supplyPotionsBought",
] as const satisfies readonly (keyof PracticeGame)[];

const BOOLEAN_FIELDS = [
  "hasStarted",
  "active",
  "relicOfferAvailable",
  "relicReviveUsed",
  "lastCritical",
  "campRestUsed",
  "supplyBandageUsed",
] as const satisfies readonly (keyof PracticeGame)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isStoredPracticeGame(value: unknown): value is PracticeGame {
  if (!isRecord(value)) return false;

  if (NUMBER_FIELDS.some((field) => !Number.isFinite(value[field]))) {
    return false;
  }

  if (BOOLEAN_FIELDS.some((field) => typeof value[field] !== "boolean")) {
    return false;
  }

  if (
    !Array.isArray(value.ownedRelics) ||
    value.ownedRelics.some(
      (relicId) =>
        !Number.isInteger(relicId) ||
        relicId < 1 ||
        relicId > 15
    ) ||
    new Set(value.ownedRelics).size !== value.ownedRelics.length
  ) {
    return false;
  }

  if (
    !Array.isArray(value.relicCounts) ||
    value.relicCounts.length !== 16 ||
    value.relicCounts.some(
      (count) => !Number.isInteger(count) || count < 0
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(value.log) ||
    value.log.some((entry) => typeof entry !== "string")
  ) {
    return false;
  }

  return (
    isIntegerInRange(value.monsterType, 0, 3) &&
    isIntegerInRange(value.lastLootType, 0, 4) &&
    isIntegerInRange(value.relicOfferRarity, 0, 5) &&
    isIntegerInRange(value.equippedRelic, 0, 15) &&
    isIntegerInRange(value.relicOfferId, 0, 15)
  );
}

export function loadPracticeRun(
  storage: PracticeRunStorage
): PracticeGame | null {
  try {
    const serialized = storage.getItem(PRACTICE_RUN_STORAGE_KEY);
    if (!serialized) return null;

    const stored: unknown = JSON.parse(serialized);
    if (
      !isRecord(stored) ||
      stored.version !== PRACTICE_RUN_STORAGE_VERSION ||
      !isStoredPracticeGame(stored.game)
    ) {
      return null;
    }

    return stored.game;
  } catch {
    return null;
  }
}

export function savePracticeRun(
  storage: PracticeRunStorage,
  game: PracticeGame
): void {
  try {
    const stored: StoredPracticeRun = {
      version: PRACTICE_RUN_STORAGE_VERSION,
      game,
    };

    storage.setItem(PRACTICE_RUN_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Practice Mode remains playable when browser storage is unavailable.
  }
}

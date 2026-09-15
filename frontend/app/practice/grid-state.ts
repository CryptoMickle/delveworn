import type { PracticeGame } from "./engine";

export const PRACTICE_GRID_VERSION = 1 as const;

export type PendingPracticeLoot = Readonly<{
  gold: number;
  potions: number;
  weapon: number;
  armor: number;
}>;

export type PracticeGridState = Readonly<{
  version: typeof PRACTICE_GRID_VERSION;
  seed: number;
  engaged: boolean;
  pendingLoot: PendingPracticeLoot | null;
  roomTurns: number;
}>;

export type PracticeGridPhase =
  | "explore"
  | "combat"
  | "loot"
  | "recovery"
  | "reward"
  | "lost";

const UINT32_MAX = 0xffff_ffff;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

export function isPendingPracticeLoot(value: unknown): value is PendingPracticeLoot {
  if (!isRecord(value)) return false;
  return integer(value.gold, 0, 1_000_000_000)
    && integer(value.potions, 0, 1)
    && integer(value.weapon, 0, 1)
    && integer(value.armor, 0, 1)
    && (value.gold > 0 || value.potions > 0 || value.weapon > 0 || value.armor > 0);
}

export function isPracticeGridState(value: unknown): value is PracticeGridState {
  if (!isRecord(value)) return false;
  return value.version === PRACTICE_GRID_VERSION
    && integer(value.seed, 0, UINT32_MAX)
    && typeof value.engaged === "boolean"
    && (value.pendingLoot === null || isPendingPracticeLoot(value.pendingLoot))
    && integer(value.roomTurns, 0, 1_000_000);
}

export function isPracticeGridCompatible(game: PracticeGame, grid: PracticeGridState): boolean {
  if (grid.engaged && (!game.hasStarted || !game.active || game.monsterHp === 0)) return false;
  if (!game.hasStarted && grid.roomTurns !== 0) return false;
  if (grid.pendingLoot === null) return true;
  const loot = grid.pendingLoot;
  if (!game.hasStarted || !game.active || game.monsterHp !== 0 || game.roomsCleared === 0 || grid.engaged) return false;
  if (game.gold + loot.gold > 1_000_000_000_000 || game.potions + loot.potions > 5
    || game.weaponLevel + loot.weapon > 1_000_000 || game.armorLevel + loot.armor > 1_000_000) return false;
  if (game.lastLootType === 1) return loot.potions === 1 && loot.weapon === 0 && loot.armor === 0;
  if (game.lastLootType === 3) return loot.potions === 0 && loot.weapon === 1 && loot.armor === 0;
  if (game.lastLootType === 4) return loot.potions === 0 && loot.weapon === 0 && loot.armor === 1;
  return loot.potions === 0 && loot.weapon === 0 && loot.armor === 0;
}

/**
 * Saves made before the room grid already credited their most recent loot.
 * Restore them directly in their previous phase so that no reward is held or
 * granted a second time. A living encounter resumes ready for combat.
 */
export function legacyPracticeGrid(game: PracticeGame): PracticeGridState {
  return {
    version: PRACTICE_GRID_VERSION,
    seed: 0,
    engaged: game.hasStarted && game.active && game.monsterHp > 0,
    pendingLoot: null,
    roomTurns: 0,
  };
}

export function createPracticeGrid(seed: number): PracticeGridState {
  if (!integer(seed, 0, UINT32_MAX)) throw new RangeError("Invalid practice layout seed");
  return {
    version: PRACTICE_GRID_VERSION,
    seed,
    engaged: false,
    pendingLoot: null,
    roomTurns: 0,
  };
}

export function practiceGridPhase(game: PracticeGame, grid: PracticeGridState): PracticeGridPhase {
  if (!game.active) return "lost";
  if (grid.pendingLoot !== null) return "loot";
  if (game.relicOfferAvailable) return "reward";
  if (game.monsterHp === 0) return "recovery";
  return grid.engaged ? "combat" : "explore";
}

export function engagePracticeGrid(grid: PracticeGridState): PracticeGridState {
  return grid.engaged ? grid : { ...grid, engaged: true };
}

/**
 * The combat engine resolves randomness exactly once. This adapter removes
 * only the resource delta from that completed result and records it beside the
 * game in the same save envelope until the player reaches the drop.
 */
export function holdPracticeLoot(
  before: PracticeGame,
  after: PracticeGame,
  grid: PracticeGridState,
): { game: PracticeGame; grid: PracticeGridState } {
  if (!before.active || before.monsterHp <= 0 || !after.active || after.monsterHp !== 0) {
    return { game: after, grid };
  }

  const pendingLoot: PendingPracticeLoot = {
    gold: after.gold - before.gold,
    potions: after.potions - before.potions,
    weapon: after.weaponLevel - before.weaponLevel,
    armor: after.armorLevel - before.armorLevel,
  };
  if (!isPendingPracticeLoot(pendingLoot)) return { game: after, grid };

  return {
    game: {
      ...after,
      gold: after.gold - pendingLoot.gold,
      potions: after.potions - pendingLoot.potions,
      weaponLevel: after.weaponLevel - pendingLoot.weapon,
      armorLevel: after.armorLevel - pendingLoot.armor,
    },
    grid: { ...grid, engaged: false, pendingLoot },
  };
}

export function collectPracticeLoot(
  game: PracticeGame,
  grid: PracticeGridState,
): { game: PracticeGame; grid: PracticeGridState } {
  if (grid.pendingLoot === null) return { game, grid };
  const loot = grid.pendingLoot;
  return {
    game: {
      ...game,
      gold: game.gold + loot.gold,
      potions: game.potions + loot.potions,
      weaponLevel: game.weaponLevel + loot.weapon,
      armorLevel: game.armorLevel + loot.armor,
    },
    grid: { ...grid, pendingLoot: null },
  };
}

export function skipPracticeLoot(grid: PracticeGridState): PracticeGridState {
  return grid.pendingLoot === null ? grid : { ...grid, pendingLoot: null };
}

export function enterPracticeRoom(grid: PracticeGridState): PracticeGridState {
  return { ...grid, engaged: false, pendingLoot: null, roomTurns: 0 };
}

export type PracticeLootDoorResult = Readonly<{
  game: PracticeGame;
  grid: PracticeGridState;
  discarded: PendingPracticeLoot;
  entered: boolean;
}>;

/**
 * Resolves a completed walk to the exit while regular loot is still on the
 * floor. The caller commits this result once, so a failed encounter roll
 * leaves both the game and the held loot untouched.
 */
export function passPracticeLootAtDoor(
  game: PracticeGame,
  grid: PracticeGridState,
  enter: (current: PracticeGame) => PracticeGame,
): PracticeLootDoorResult | null {
  if (!game.hasStarted || !game.active || game.monsterHp !== 0 || grid.pendingLoot === null) return null;
  const discarded = grid.pendingLoot;
  const withoutLoot = skipPracticeLoot(grid);

  // A boss relic is a separate decision and never belongs to regular floor
  // loot. Reaching the exit reveals that choice before another room can spawn.
  if (game.relicOfferAvailable) {
    return { game, grid: withoutLoot, discarded, entered: false };
  }

  const nextGame = enter(game);
  return {
    game: nextGame,
    grid: enterPracticeRoom(withoutLoot),
    discarded,
    entered: true,
  };
}

export function countPracticeTurn(grid: PracticeGridState): PracticeGridState {
  return { ...grid, roomTurns: grid.roomTurns + 1 };
}

export function practiceLootSummary(loot: PendingPracticeLoot): string {
  return [
    loot.gold > 0 ? `${loot.gold} gold` : "",
    loot.potions > 0 ? `${loot.potions} potion` : "",
    loot.weapon > 0 ? "weapon +1" : "",
    loot.armor > 0 ? "armor +1" : "",
  ].filter(Boolean).join(" · ");
}

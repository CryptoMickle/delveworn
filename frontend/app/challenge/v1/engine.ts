import type { V1RandomInt } from "./random";

/**
 * Frozen Weekly Challenge V1 rules.
 *
 * This intentionally owns the complete V1 combat/resource state machine and
 * RNG draw order used by proof replay. It must not import the evolving Practice
 * engine. Presentation text is compact, but every historical score field and
 * entropy draw remains versioned here. Rule changes require a new version.
 */

export type MonsterType = 0 | 1 | 2 | 3;
export type LootType = 0 | 1 | 2 | 3 | 4;
export type RelicRarityId = 0 | 1 | 2 | 3 | 4 | 5;

export type PracticeGame = {
  hp: number;
  maxHp: number;
  baseMaxHp: number;
  monsterHp: number;
  monsterMaxHp: number;
  roomsCleared: number;
  gold: number;
  potions: number;
  weaponLevel: number;
  armorLevel: number;
  monsterType: MonsterType;
  lastLootType: LootType;
  lastLootAmount: number;
  hasStarted: boolean;
  active: boolean;
  equippedRelic: number;
  ownedRelics: number[];
  relicCounts: number[];
  relicOfferAvailable: boolean;
  relicOfferRarity: RelicRarityId;
  relicOfferId: number;
  relicReviveUsed: boolean;
  lastPlayerDamage: number;
  lastMonsterDamage: number;
  lastCritical: boolean;
  combatPotionsUsed: number;
  campRestUsed: boolean;
  campPotionsBought: number;
  supplyBandageUsed: boolean;
  supplyPotionsBought: number;
  log: string[];
};

export type ShopAction =
  | "supply-bandage"
  | "supply-potion"
  | "camp-rest"
  | "camp-potion"
  | "camp-weapon"
  | "camp-armor";

const MAX_POTIONS = 5;
const BASE_CRITICAL_CHANCE = 15;
const MONSTER_BASE_HP = [30, 40, 60, 90] as const;
const MONSTER_BASE_DAMAGE = [5, 7, 9, 12] as const;
const MONSTER_BASE_GOLD = [5, 8, 12, 30] as const;

const EMPTY_GAME: PracticeGame = {
  hp: 100,
  maxHp: 100,
  baseMaxHp: 100,
  monsterHp: 0,
  monsterMaxHp: 0,
  roomsCleared: 0,
  gold: 0,
  potions: 3,
  weaponLevel: 0,
  armorLevel: 0,
  monsterType: 0,
  lastLootType: 0,
  lastLootAmount: 0,
  hasStarted: false,
  active: false,
  equippedRelic: 0,
  ownedRelics: [],
  relicCounts: Array(16).fill(0),
  relicOfferAvailable: false,
  relicOfferRarity: 0,
  relicOfferId: 0,
  relicReviveUsed: false,
  lastPlayerDamage: 0,
  lastMonsterDamage: 0,
  lastCritical: false,
  combatPotionsUsed: 0,
  campRestUsed: false,
  campPotionsBought: 0,
  supplyBandageUsed: false,
  supplyPotionsBought: 0,
  log: [],
};

function withLog(state: PracticeGame, ...messages: string[]): PracticeGame {
  return { ...state, log: [...[...messages].reverse(), ...state.log].slice(0, 12) };
}

function burnCopyChoice(randomInt: V1RandomInt): void {
  randomInt(1);
}

function monsterHp(type: MonsterType, room: number): number {
  const base = MONSTER_BASE_HP[type];
  return base + Math.floor((base * (room - 1)) / 25);
}

function monsterDamage(type: MonsterType, room: number): number {
  return MONSTER_BASE_DAMAGE[type] + Math.floor((room - 1) / 8);
}

function monsterGold(type: MonsterType, room: number): number {
  const base = MONSTER_BASE_GOLD[type];
  return base + Math.floor((base * (room - 1)) / 20);
}

function applyArmor(armorLevel: number, damage: number): number {
  const flatReduced = damage <= armorLevel ? 1 : damage - armorLevel;
  return Math.max(flatReduced, Math.floor((damage + 1) / 2));
}

function rollMonsterDamage(state: PracticeGame, randomInt: V1RandomInt): number {
  const room = state.roomsCleared + 1;
  const raw = monsterDamage(state.monsterType, room) - 1 + randomInt(3);
  return applyArmor(state.armorLevel, raw);
}

function rollRarity(entropy: number): RelicRarityId {
  const roll = entropy % 10_000;
  if (roll < 5_500) return 1;
  if (roll < 8_000) return 2;
  if (roll < 9_200) return 3;
  if (roll < 9_800) return 4;
  return 5;
}

function spawnMonster(state: PracticeGame, randomInt: V1RandomInt): PracticeGame {
  const room = state.roomsCleared + 1;
  let monsterType: MonsterType;
  if (room % 10 === 0) monsterType = 3;
  else {
    const roll = randomInt(100);
    monsterType = roll < 45 ? 0 : roll < 80 ? 1 : 2;
  }
  burnCopyChoice(randomInt);
  const hp = monsterHp(monsterType, room);
  return withLog({
    ...state,
    monsterType,
    monsterHp: hp,
    monsterMaxHp: hp,
    combatPotionsUsed: 0,
    lastPlayerDamage: 0,
    lastMonsterDamage: 0,
    lastCritical: false,
  }, `🚪 Weekly V1 room ${room} begins.`);
}

function takeDamage(state: PracticeGame, damage: number): PracticeGame {
  return state.hp > damage
    ? { ...state, hp: state.hp - damage }
    : { ...state, hp: 0, active: false };
}

function grantLoot(state: PracticeGame, lootRoll: number, amountRoll: number): PracticeGame {
  if (lootRoll < 30) {
    if (state.potions >= MAX_POTIONS) {
      return { ...state, gold: state.gold + 10, lastLootType: 2, lastLootAmount: 10 };
    }
    return { ...state, potions: state.potions + 1, lastLootType: 1, lastLootAmount: 1 };
  }
  if (lootRoll < 80) {
    const bonus = 5 + (amountRoll % 16) + Math.floor(state.roomsCleared / 5);
    return { ...state, gold: state.gold + bonus, lastLootType: 2, lastLootAmount: bonus };
  }
  if (lootRoll < 90) {
    return { ...state, weaponLevel: state.weaponLevel + 1, lastLootType: 3, lastLootAmount: 1 };
  }
  return { ...state, armorLevel: state.armorLevel + 1, lastLootType: 4, lastLootAmount: 1 };
}

function defeatMonster(
  state: PracticeGame,
  lootRoll: number,
  amountRoll: number,
  randomInt: V1RandomInt
): PracticeGame {
  const room = state.roomsCleared + 1;
  let next = grantLoot({
    ...state,
    monsterHp: 0,
    gold: state.gold + monsterGold(state.monsterType, room),
    roomsCleared: state.roomsCleared + 1,
  }, lootRoll, amountRoll);

  if (state.monsterType === 3) {
    const rarity = rollRarity(amountRoll);
    const relicOfferId = (rarity - 1) * 3 + randomInt(3) + 1;
    next = {
      ...next,
      relicOfferAvailable: true,
      relicOfferRarity: rarity,
      relicOfferId,
    };
  }
  if (next.roomsCleared % 5 === 0) {
    next = { ...next, supplyBandageUsed: false, supplyPotionsBought: 0 };
  }
  if (next.roomsCleared % 10 === 9) {
    next = {
      ...next,
      hp: Math.min(next.maxHp, next.hp + 15),
      campRestUsed: false,
      campPotionsBought: 0,
    };
  }
  burnCopyChoice(randomInt);
  return withLog(next, `☠️ Weekly V1 room ${room} cleared.`);
}

export function startRun(randomInt: V1RandomInt): PracticeGame {
  return spawnMonster({
    ...EMPTY_GAME,
    hasStarted: true,
    active: true,
    log: ["🏰 Weekly Challenge V1 begins."],
  }, randomInt);
}

export function attack(state: PracticeGame, randomInt: V1RandomInt): PracticeGame {
  const base = 10 + state.weaponLevel * 2;
  let rolled = base - 2 + randomInt(5);
  const critical = randomInt(100) < BASE_CRITICAL_CHANCE;
  if (critical) rolled *= 2;
  const actual = Math.min(rolled, state.monsterHp);
  burnCopyChoice(randomInt);
  let next = { ...state, lastPlayerDamage: actual, lastCritical: critical };
  if (rolled >= state.monsterHp) {
    return defeatMonster(
      { ...next, lastMonsterDamage: 0 },
      randomInt(100),
      randomInt(10_000),
      randomInt
    );
  }
  next = { ...next, monsterHp: state.monsterHp - rolled };
  const incoming = rollMonsterDamage(next, randomInt);
  next = takeDamage({ ...next, lastMonsterDamage: incoming }, incoming);
  burnCopyChoice(randomInt);
  if (!next.active) burnCopyChoice(randomInt);
  return withLog(next, `⚔️ Attack deals ${actual}.`, `💔 Reply deals ${incoming}.`);
}

export function stormAttack(state: PracticeGame, randomInt: V1RandomInt): PracticeGame {
  const max = (10 + state.weaponLevel * 2) * 2;
  const rolled = randomInt(max + 1);
  const actual = Math.min(rolled, state.monsterHp);
  let next = { ...state, lastPlayerDamage: actual, lastCritical: false };
  if (rolled >= state.monsterHp) {
    return defeatMonster(
      { ...next, lastMonsterDamage: 0 },
      randomInt(100),
      randomInt(10_000),
      randomInt
    );
  }
  next = { ...next, monsterHp: state.monsterHp - rolled };
  const incoming = rollMonsterDamage(next, randomInt);
  next = takeDamage({ ...next, lastMonsterDamage: incoming }, incoming);
  burnCopyChoice(randomInt);
  burnCopyChoice(randomInt);
  if (!next.active) burnCopyChoice(randomInt);
  return withLog(next, `⚡ Storm deals ${actual}.`, `💔 Reply deals ${incoming}.`);
}

export function usePotion(state: PracticeGame, randomInt: V1RandomInt): PracticeGame {
  if (state.monsterHp === 0) {
    const hp = Math.min(state.maxHp, state.hp + 25);
    return withLog({
      ...state,
      hp,
      potions: state.potions - 1,
      lastPlayerDamage: 0,
      lastMonsterDamage: 0,
      lastCritical: false,
    }, `🧪 Potion restores ${hp - state.hp}.`);
  }
  const incoming = Math.floor((rollMonsterDamage(state, randomInt) + 1) / 2);
  const hp = Math.min(state.maxHp, Math.max(0, state.hp + 25 - incoming));
  const next = {
    ...state,
    hp,
    active: hp > 0,
    potions: state.potions - 1,
    combatPotionsUsed: state.combatPotionsUsed + 1,
    lastPlayerDamage: 0,
    lastMonsterDamage: incoming,
    lastCritical: false,
  };
  if (!next.active) burnCopyChoice(randomInt);
  return withLog(next, `🧪 Potion exchange changes HP by ${next.hp - state.hp}.`);
}

export function enterNextRoom(state: PracticeGame, randomInt: V1RandomInt): PracticeGame {
  return spawnMonster(state, randomInt);
}

export function supplyAvailable(state: PracticeGame): boolean {
  return state.active && state.monsterHp === 0 && state.roomsCleared >= 5 && state.roomsCleared % 5 === 0;
}

export function campAvailable(state: PracticeGame): boolean {
  return state.active && state.monsterHp === 0 && state.roomsCleared > 0 && state.roomsCleared % 10 === 9;
}

export function supplyPrices(state: PracticeGame): { bandage: number; potion: number } {
  const tier = Math.floor((state.roomsCleared - 5) / 10);
  return { bandage: 20 + tier * 5, potion: 25 + tier * 5 };
}

export function campPrices(state: PracticeGame): {
  rest: number;
  potion: number;
  weapon: number;
  armor: number;
} {
  const tier = Math.floor((state.roomsCleared + 1) / 10) - 1;
  return {
    rest: 25 + tier * 5,
    potion: 20 + tier * 5,
    weapon: 60 + tier * 20,
    armor: 60 + tier * 20,
  };
}

export function buy(state: PracticeGame, action: ShopAction): PracticeGame {
  const supply = supplyPrices(state), camp = campPrices(state);
  const cost = action === "supply-bandage" ? supply.bandage
    : action === "supply-potion" ? supply.potion
      : action === "camp-rest" ? camp.rest
        : action === "camp-potion" ? camp.potion
          : action === "camp-weapon" ? camp.weapon
            : camp.armor;
  if (action === "supply-bandage") {
    const hp = Math.min(state.maxHp, state.hp + 25);
    return withLog({ ...state, gold: state.gold - cost, hp, supplyBandageUsed: true }, "🩹 Supply bandage used.");
  }
  if (action === "supply-potion") {
    return withLog({
      ...state,
      gold: state.gold - cost,
      potions: state.potions + 1,
      supplyPotionsBought: state.supplyPotionsBought + 1,
    }, "🧪 Supply potion purchased.");
  }
  if (action === "camp-rest") {
    return withLog({
      ...state,
      gold: state.gold - cost,
      hp: Math.min(state.maxHp, state.hp + 30),
      campRestUsed: true,
    }, "🔥 Camp rest purchased.");
  }
  if (action === "camp-potion") {
    return withLog({
      ...state,
      gold: state.gold - cost,
      potions: state.potions + 1,
      campPotionsBought: state.campPotionsBought + 1,
    }, "🧪 Camp potion purchased.");
  }
  if (action === "camp-weapon") {
    return withLog({ ...state, gold: state.gold - cost, weaponLevel: state.weaponLevel + 1 }, "⚔️ Camp weapon upgraded.");
  }
  return withLog({ ...state, gold: state.gold - cost, armorLevel: state.armorLevel + 1 }, "🛡️ Camp armor upgraded.");
}

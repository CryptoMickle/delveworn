import {
  getMaxHpForRelic,
  getOfferedRelics,
  getRelicDefinition,
  getRelicMaxHpModifier,
  RELIC_MIN_MAX_HP,
} from "../relics";
import {
  getAttackLogLine,
  getBossDialogue,
  getCriticalLogLine,
  getDeathLogLine,
  getMonsterLogPersona,
  getStormLogLine,
  pickFreshLogLine,
  pickLogLine,
} from "./log-copy";

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

export const MONSTER_NAMES = [
  "Zombie",
  "Goblin",
  "Orc",
  "Dungeon Lord",
] as const;

export const LOOT_NAMES = [
  "Nothing",
  "Potion",
  "Bonus gold",
  "Weapon upgrade",
  "Armor upgrade",
] as const;

const BASE_MAX_HP = 100;
const MAX_POTIONS = 5;
const BASE_CRITICAL_CHANCE = 15;

const MONSTER_BASE_HP = [30, 40, 60, 90] as const;
const MONSTER_BASE_DAMAGE = [5, 7, 9, 12] as const;
const MONSTER_BASE_GOLD = [5, 8, 12, 30] as const;

export const EMPTY_GAME: PracticeGame = {
  hp: BASE_MAX_HP,
  maxHp: BASE_MAX_HP,
  baseMaxHp: BASE_MAX_HP,
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

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value = range;

  while (value >= limit) {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0];
  }

  return value % maxExclusive;
}

function withLog(state: PracticeGame, ...messages: string[]): PracticeGame {
  return {
    ...state,
    log: [...[...messages].reverse(), ...state.log].slice(0, 12),
  };
}

function outgoingPercent(relic: number, storm: boolean): number {
  if (relic === 1) return 110;
  if (relic === 2) return 95;
  if (relic === 3) return storm ? 80 : 100;
  if (relic === 4) return 120;
  if (relic === 5) return 100;
  if (relic === 6) return storm ? 130 : 95;
  if (relic === 7 || relic === 8) return 95;
  if (relic === 9) return storm ? 145 : 95;
  if (relic === 10) return 95;
  if (relic === 11) return storm ? 100 : 85;
  if (relic === 12) return 105;
  if (relic === 13) return 135;
  if (relic === 15) return 130;
  return 100;
}

function scaleOutgoing(relic: number, damage: number, storm: boolean): number {
  const percent = outgoingPercent(relic, storm);
  return percent >= 100
    ? Math.floor((damage * percent) / 100)
    : Math.floor((damage * percent + 99) / 100);
}

function scaleIncoming(relic: number, damage: number): number {
  const percent = relic === 15 ? 115 : 100;
  return Math.floor((damage * percent + 99) / 100);
}

function scaleGold(relic: number, gold: number): number {
  const bonus = relic === 7 ? 75 : 0;
  return Math.floor((gold * (100 + bonus)) / 100);
}

function criticalChance(relic: number): number {
  if (relic === 3) return BASE_CRITICAL_CHANCE + 5;
  if (relic === 11) return BASE_CRITICAL_CHANCE + 15;
  if (relic === 15) return BASE_CRITICAL_CHANCE + 10;
  return BASE_CRITICAL_CHANCE;
}

function criticalMultiplier(relic: number): number {
  return relic === 11 ? 3 : 2;
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
  const minimumDamage = Math.floor((damage + 1) / 2);
  return Math.max(flatReduced, minimumDamage);
}

function rollMonsterDamage(state: PracticeGame): number {
  const room = state.roomsCleared + 1;
  const raw = monsterDamage(state.monsterType, room) - 1 + randomInt(3);
  return scaleIncoming(
    state.equippedRelic,
    applyArmor(state.armorLevel, raw)
  );
}

function rollRarity(entropy: number): RelicRarityId {
  const roll = entropy % 10_000;
  if (roll < 5_500) return 1;
  if (roll < 8_000) return 2;
  if (roll < 9_200) return 3;
  if (roll < 9_800) return 4;
  return 5;
}

function rollRarityAfterTierFour(entropy: number): RelicRarityId {
  const roll = entropy % 10_000;
  if (roll < 5_000) return 1;
  if (roll < 7_500) return 2;
  if (roll < 8_900) return 3;
  if (roll < 9_700) return 4;
  return 5;
}

function equipRelic(
  state: PracticeGame,
  relic: number,
  healPositiveModifier: boolean
): PracticeGame {
  const maxHp = getMaxHpForRelic(state.baseMaxHp, relic);
  const bonusHealing = healPositiveModifier
    ? Math.max(0, getRelicMaxHpModifier(relic))
    : 0;

  return {
    ...state,
    equippedRelic: relic,
    maxHp,
    hp: Math.min(maxHp, state.hp + bonusHealing),
  };
}

function rollRelicOffer(rarity: RelicRarityId): number {
  const relics = getOfferedRelics(rarity);
  if (relics.length === 0) return 0;
  return relics[randomInt(relics.length)].id;
}

function spawnMonster(state: PracticeGame): PracticeGame {
  const room = state.roomsCleared + 1;
  let type: MonsterType;

  if (room % 10 === 0) {
    type = 3;
  } else {
    const roll = randomInt(100);
    type = roll < 45 ? 0 : roll < 80 ? 1 : 2;
  }

  const hp = monsterHp(type, room);
  const persona = getMonsterLogPersona(type, room);
  const encounterMessages = type === 3
    ? [
        `🚪 You enter Room ${room}. Management has been notified.`,
        `👑 ${persona.name}: ${pickLogLine(persona.encounters)}`,
        getBossDialogue(room),
      ]
    : [
        `🚪 You enter Room ${room}. The safety inspection remains theoretical.`,
        `👁️ ${persona.name}: ${pickLogLine(persona.encounters)}`,
      ];

  return withLog(
    {
      ...state,
      monsterType: type,
      monsterHp: hp,
      monsterMaxHp: hp,
      combatPotionsUsed: 0,
      lastPlayerDamage: 0,
      lastMonsterDamage: 0,
      lastCritical: false,
    },
    ...encounterMessages
  );
}

function takeDamage(state: PracticeGame, damage: number): PracticeGame {
  if (state.hp > damage) {
    return { ...state, hp: state.hp - damage };
  }

  const revivePercent =
    state.equippedRelic === 8 ? 35 : state.equippedRelic === 14 ? 50 : 0;

  if (revivePercent > 0 && !state.relicReviveUsed) {
    const restored = Math.max(1, Math.floor((state.maxHp * revivePercent) / 100));
    return {
      ...state,
      hp: restored,
      active: true,
      relicReviveUsed: true,
    };
  }

  return { ...state, hp: 0, active: false };
}

function grantLoot(
  state: PracticeGame,
  lootRoll: number,
  amountRoll: number
): PracticeGame {
  if (lootRoll < 30) {
    if (state.potions >= MAX_POTIONS) {
      const converted = scaleGold(state.equippedRelic, 10);
      return {
        ...state,
        gold: state.gold + converted,
        lastLootType: 2,
        lastLootAmount: converted,
      };
    }
    return {
      ...state,
      potions: state.potions + 1,
      lastLootType: 1,
      lastLootAmount: 1,
    };
  }

  if (lootRoll < 80) {
    const bonus = scaleGold(
      state.equippedRelic,
      5 + (amountRoll % 16) + Math.floor(state.roomsCleared / 5)
    );
    return {
      ...state,
      gold: state.gold + bonus,
      lastLootType: 2,
      lastLootAmount: bonus,
    };
  }

  if (lootRoll < 90) {
    return {
      ...state,
      weaponLevel: state.weaponLevel + 1,
      lastLootType: 3,
      lastLootAmount: 1,
    };
  }

  return {
    ...state,
    armorLevel: state.armorLevel + 1,
    lastLootType: 4,
    lastLootAmount: 1,
  };
}

function lootLogMessage(state: PracticeGame): string {
  if (state.lastLootType === 1) {
    return `🧪 Potion acquired. Smells illegal. Inventory ${state.potions}/${MAX_POTIONS}.`;
  }
  if (state.lastLootType === 2) {
    return `🪙 Bonus gold +${state.lastLootAmount}. You find money. No questions are asked.`;
  }
  if (state.lastLootType === 3) {
    return `⚔️ Weapon upgraded to level ${state.weaponLevel}. Finally, a weapon with standards.`;
  }
  if (state.lastLootType === 4) {
    return `🛡️ Armor upgraded to level ${state.armorLevel}. Fashion has been sacrificed for survival.`;
  }
  return "📦 No loot. The dungeon cites budget constraints.";
}

function defeatMonster(
  state: PracticeGame,
  lootRoll: number,
  amountRoll: number,
  finisherMessage: string
): PracticeGame {
  const room = state.roomsCleared + 1;
  const persona = getMonsterLogPersona(state.monsterType, room);
  const reward = scaleGold(
    state.equippedRelic,
    monsterGold(state.monsterType, room)
  );

  let next: PracticeGame = {
    ...state,
    monsterHp: 0,
    gold: state.gold + reward,
    roomsCleared: state.roomsCleared + 1,
  };

  next = grantLoot(next, lootRoll, amountRoll);

  let killHealing = 0;
  const killHeal = next.equippedRelic === 5 ? 4 : next.equippedRelic === 12 ? 5 : 0;
  if (killHeal > 0 && next.hp > 0) {
    const before = next.hp;
    next = { ...next, hp: Math.min(next.maxHp, next.hp + killHeal) };
    killHealing = next.hp - before;
  }

  if (state.monsterType === 3) {
    const bossTier = Math.ceil(room / 10);
    const relicOfferRarity = bossTier > 4
      ? rollRarityAfterTierFour(amountRoll)
      : rollRarity(amountRoll);
    const relicOfferId = rollRelicOffer(relicOfferRarity);
    next = {
      ...next,
      relicOfferAvailable: relicOfferId !== 0,
      relicOfferRarity,
      relicOfferId,
    };
  }

  if (next.roomsCleared % 5 === 0) {
    next = {
      ...next,
      supplyBandageUsed: false,
      supplyPotionsBought: 0,
    };
  }

  let campHealing = 0;
  if (next.roomsCleared % 10 === 9) {
    const before = next.hp;
    next = {
      ...next,
      hp: Math.min(next.maxHp, next.hp + 15),
      campRestUsed: false,
      campPotionsBought: 0,
    };
    campHealing = next.hp - before;
  }

  const messages = [
    finisherMessage,
    `☠️ ${pickLogLine(persona.killLines)}`,
    `🪙 Base reward: ${reward} gold. The dungeon reluctantly honors payroll.`,
    lootLogMessage(next),
  ];
  if (killHealing > 0) messages.push(`🩸 Your relic restores ${killHealing} HP. Apparently violence is healthcare now.`);
  if (state.monsterType === 3) messages.push("👑 MANAGEMENT DEFEATED. The org chart develops a vacancy.");
  if (next.roomsCleared % 5 === 0) messages.push("🧰 Quartermaster Kevin has appeared. Consumer protection has not.");
  if (campHealing > 0) messages.push(`⛺ Camp arrival restores ${campHealing} HP. Management calls this an unscheduled break.`);
  if (next.relicOfferAvailable) messages.push("◆ The boss drops one random relic. Ownership is mandatory; equipping it is still your problem.");

  return withLog(next, ...messages);
}

export function startRun(): PracticeGame {
  return spawnMonster({
    ...EMPTY_GAME,
    hasStarted: true,
    active: true,
    log: [
      "🏰 A new practice run begins. The dungeon has lowered its standards.",
      `🧪 Starting supplies: ${EMPTY_GAME.potions} potions of disputed origin.`,
      "📝 No wallet. No VRF. No witnesses.",
    ],
  });
}

export function attack(state: PracticeGame): PracticeGame {
  if (!state.active || state.monsterHp <= 0) return withLog(state, "There is nothing to attack.");

  const base = 10 + state.weaponLevel * 2;
  let rolled = base - 2 + randomInt(5);
  const critical = randomInt(100) < criticalChance(state.equippedRelic);
  if (critical) rolled *= criticalMultiplier(state.equippedRelic);
  rolled = scaleOutgoing(state.equippedRelic, rolled, false);

  const actual = Math.min(rolled, state.monsterHp);
  const persona = getMonsterLogPersona(
    state.monsterType,
    state.roomsCleared + 1
  );
  const attackMessage = critical
    ? getCriticalLogLine(actual, state.log)
    : getAttackLogLine(persona.name, actual, state.log);
  let next = {
    ...state,
    lastPlayerDamage: actual,
    lastCritical: critical,
  };

  if (rolled >= state.monsterHp) {
    next = { ...next, lastMonsterDamage: 0 };
    return defeatMonster(
      next,
      randomInt(100),
      randomInt(10_000),
      attackMessage
    );
  }

  next = { ...next, monsterHp: state.monsterHp - rolled };
  const incoming = rollMonsterDamage(next);
  next = takeDamage({ ...next, lastMonsterDamage: incoming }, incoming);
  const revived = !state.relicReviveUsed && next.relicReviveUsed;
  next = withLog(
    next,
    attackMessage,
    `💔 ${persona.name} hits you for ${incoming} DAMAGE. ${pickFreshLogLine(persona.hitLines, state.log)}`
  );
  if (revived) {
    const relicName = getRelicDefinition(next.equippedRelic).name;
    next = withLog(next, `🔥 ${relicName} revives you with ${next.hp} HP. Death has been asked to reschedule.`);
  }
  return next.active ? next : withLog(next, getDeathLogLine());
}

export function stormAttack(state: PracticeGame): PracticeGame {
  if (!state.active || state.monsterHp <= 0) return withLog(state, "There is nothing to attack.");

  const max = (10 + state.weaponLevel * 2) * 2;
  const rolled = scaleOutgoing(
    state.equippedRelic,
    randomInt(max + 1),
    true
  );
  const actual = Math.min(rolled, state.monsterHp);
  const stormMax = scaleOutgoing(
    state.equippedRelic,
    max,
    true
  );
  const persona = getMonsterLogPersona(
    state.monsterType,
    state.roomsCleared + 1
  );
  let next = {
    ...state,
    lastPlayerDamage: actual,
    lastCritical: false,
  };

  if (rolled >= state.monsterHp) {
    next = { ...next, lastMonsterDamage: 0 };
    return defeatMonster(
      next,
      randomInt(100),
      randomInt(10_000),
      `⚡ Storm deals ${actual} DAMAGE and finishes ${persona.name}. The weather department accepts full credit.`
    );
  }

  next = { ...next, monsterHp: state.monsterHp - rolled };
  const incoming = rollMonsterDamage(next);
  next = takeDamage({ ...next, lastMonsterDamage: incoming }, incoming);
  const revived = !state.relicReviveUsed && next.relicReviveUsed;
  next = withLog(
    next,
    getStormLogLine(actual, stormMax, state.log),
    `💔 ${persona.name} retaliates for ${incoming} DAMAGE. ${pickFreshLogLine(persona.hitLines, state.log)}`
  );
  if (revived) {
    const relicName = getRelicDefinition(next.equippedRelic).name;
    next = withLog(next, `🔥 ${relicName} revives you with ${next.hp} HP. Death has been asked to reschedule.`);
  }
  return next.active ? next : withLog(next, getDeathLogLine(true));
}

export function usePotion(state: PracticeGame): PracticeGame {
  if (!state.active) return withLog(state, "The run is over.");
  if (state.potions <= 0) return withLog(state, "No potions left.");
  if (state.hp >= state.maxHp) return withLog(state, "HP is already full.");

  if (state.monsterHp === 0) {
    const healed = Math.min(state.maxHp, state.hp + 25);
    return withLog(
      {
        ...state,
        hp: healed,
        potions: state.potions - 1,
        lastPlayerDamage: 0,
        lastMonsterDamage: 0,
        lastCritical: false,
      },
      `🧪 Potion restores ${healed - state.hp} HP. It still smells illegal.`
    );
  }

  const limit = state.monsterType === 3 ? 3 : 2;
  if (state.combatPotionsUsed >= limit) return withLog(state, "Combat potion limit reached.");

  const incoming = Math.floor((rollMonsterDamage(state) + 1) / 2);
  let hp = state.hp + 25;
  hp = hp > incoming ? hp - incoming : 0;
  hp = Math.min(state.maxHp, hp);

  let next: PracticeGame = {
    ...state,
    hp,
    potions: state.potions - 1,
    combatPotionsUsed: state.combatPotionsUsed + 1,
    lastPlayerDamage: 0,
    lastMonsterDamage: incoming,
    lastCritical: false,
  };

  if (hp === 0) next = takeDamage(next, 0);
  const revived = !state.relicReviveUsed && next.relicReviveUsed;
  const netHealing = next.hp - state.hp;
  const persona = getMonsterLogPersona(
    state.monsterType,
    state.roomsCleared + 1
  );
  next = withLog(
    next,
    `🧪 Potion used. Net HP ${netHealing >= 0 ? "+" : ""}${netHealing}. Medical science remains inconclusive.`,
    `💔 ${persona.name} objects with ${incoming} DAMAGE. Healthcare remains adversarial.`
  );
  if (revived) {
    const relicName = getRelicDefinition(next.equippedRelic).name;
    next = withLog(next, `🔥 ${relicName} revives you with ${next.hp} HP. Death has been asked to reschedule.`);
  }
  return next.active ? next : withLog(next, getDeathLogLine());
}

export function enterNextRoom(state: PracticeGame): PracticeGame {
  if (!state.active) return withLog(state, "The run is over.");
  if (state.monsterHp > 0) return withLog(state, "Defeat the monster first.");

  let next = state;
  if (state.equippedRelic === 1 && state.baseMaxHp > RELIC_MIN_MAX_HP) {
    const baseMaxHp = Math.max(RELIC_MIN_MAX_HP, state.baseMaxHp - 2);
    const maxHp = getMaxHpForRelic(baseMaxHp, state.equippedRelic);
    next = {
      ...state,
      baseMaxHp,
      maxHp,
      hp: Math.min(state.hp, maxHp),
    };
    next = withLog(
      next,
      `◆ Blood Price collects 2 max HP. The name was not metaphorical. Maximum HP: ${maxHp}.`
    );
  }

  return spawnMonster(next);
}

export function claimRelic(state: PracticeGame, equip: boolean): PracticeGame {
  if (!state.relicOfferAvailable || state.monsterHp > 0) {
    return withLog(state, "No boss relic can be claimed right now.");
  }

  const relic = state.relicOfferId;
  const expectedRarity = Math.floor((relic - 1) / 3) + 1;
  if (relic === 0 || expectedRarity !== state.relicOfferRarity) {
    return withLog(state, "The boss relic paperwork is invalid. Kevin denies involvement.");
  }
  const alreadyOwned = state.ownedRelics.includes(relic);
  const previousCount = state.relicCounts[relic] ?? (alreadyOwned ? 1 : 0);
  const relicCounts = [...state.relicCounts];
  relicCounts[relic] = previousCount + 1;

  const acquired: PracticeGame = {
    ...state,
    ownedRelics: alreadyOwned ? state.ownedRelics : [...state.ownedRelics, relic],
    relicCounts,
    relicOfferAvailable: false,
    relicOfferRarity: 0,
    relicOfferId: 0,
  };
  const relicName = getRelicDefinition(relic).name;

  if (!equip) {
    return withLog(
      acquired,
      `◆ ${relicName} copy ×${previousCount + 1} added to your collection. Your current relic keeps the job, pending another performance review.`
    );
  }

  const next = equipRelic(acquired, relic, !alreadyOwned);
  return withLog(
    next,
    `◆ ${relicName} copy ×${previousCount + 1} acquired and equipped. Maximum HP: ${next.maxHp}. Duplicate effects do not stack; the paperwork does.`
  );
}

export function equipOwnedRelic(state: PracticeGame, relic: number): PracticeGame {
  if (!state.active) return withLog(state, "The run is over.");
  if (state.monsterHp > 0) return withLog(state, "Relics can only be changed between rooms.");
  if (relic !== 0 && !state.ownedRelics.includes(relic)) {
    return withLog(state, "You do not own that relic.");
  }
  if (relic === state.equippedRelic) return state;

  const next = equipRelic(state, relic, false);
  const relicName = getRelicDefinition(relic).name;
  return withLog(
    next,
    relic === 0
      ? "◆ Relic unequipped. Its permanent costs have unionized and refuse to leave."
      : `◆ ${relicName} is now active. Maximum HP: ${next.maxHp}. The previous relic has been moved to consulting.`
  );
}

export function supplyAvailable(state: PracticeGame): boolean {
  return state.active && state.monsterHp === 0 && state.roomsCleared >= 5 && state.roomsCleared % 5 === 0;
}

export function campAvailable(state: PracticeGame): boolean {
  return state.active && state.monsterHp === 0 && state.roomsCleared > 0 && state.roomsCleared % 10 === 9;
}

export type MerchantVisit = "supply" | "camp";

export function getMerchantVisit(state: PracticeGame): MerchantVisit | null {
  if (campAvailable(state)) return "camp";
  if (supplyAvailable(state)) return "supply";
  return null;
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
  const bossRoom = state.roomsCleared + 1;
  const tier = Math.floor(bossRoom / 10) - 1;
  return {
    rest: 25 + tier * 5,
    potion: 20 + tier * 5,
    weapon: 60 + tier * 20,
    armor: 60 + tier * 20,
  };
}

export type ShopAction =
  | "supply-bandage"
  | "supply-potion"
  | "camp-rest"
  | "camp-potion"
  | "camp-weapon"
  | "camp-armor";

export function buy(state: PracticeGame, action: ShopAction): PracticeGame {
  if (action.startsWith("supply") && !supplyAvailable(state)) return withLog(state, "Supply stop unavailable.");
  if (action.startsWith("camp") && !campAvailable(state)) return withLog(state, "Camp unavailable.");

  const supply = supplyPrices(state);
  const camp = campPrices(state);
  const costs: Record<ShopAction, number> = {
    "supply-bandage": supply.bandage,
    "supply-potion": supply.potion,
    "camp-rest": camp.rest,
    "camp-potion": camp.potion,
    "camp-weapon": camp.weapon,
    "camp-armor": camp.armor,
  };
  const cost = costs[action];
  if (state.gold < cost) return withLog(state, "Not enough gold.");

  if (action === "supply-bandage") {
    if (state.supplyBandageUsed) return withLog(state, "Bandage already used.");
    if (state.hp >= state.maxHp) return withLog(state, "HP is already full.");
    const hp = Math.min(state.maxHp, state.hp + 25);
    return withLog(
      { ...state, gold: state.gold - cost, hp, supplyBandageUsed: true },
      `🩹 Kevin applies a bandage. +${hp - state.hp} HP. Medical licensing remains unconfirmed.`
    );
  }
  if (action === "supply-potion") {
    if (state.supplyPotionsBought >= 2) return withLog(state, "Supply potion stock empty.");
    if (state.potions >= MAX_POTIONS) return withLog(state, "Potion inventory full.");
    return withLog(
      { ...state, gold: state.gold - cost, potions: state.potions + 1, supplyPotionsBought: state.supplyPotionsBought + 1 },
      `🧪 Potion purchased for ${cost} gold. Kevin declines to list the ingredients.`
    );
  }
  if (action === "camp-rest") {
    if (state.campRestUsed) return withLog(state, "Rest already used.");
    if (state.hp >= state.maxHp) return withLog(state, "HP is already full.");
    const hp = Math.min(state.maxHp, state.hp + 30);
    return withLog(
      { ...state, gold: state.gold - cost, hp, campRestUsed: true },
      `🔥 You rest at camp for ${cost} gold and recover ${hp - state.hp} HP. Management calls this a productivity concern.`
    );
  }
  if (action === "camp-potion") {
    if (state.campPotionsBought >= 2) return withLog(state, "Camp potion stock empty.");
    if (state.potions >= MAX_POTIONS) return withLog(state, "Potion inventory full.");
    return withLog(
      { ...state, gold: state.gold - cost, potions: state.potions + 1, campPotionsBought: state.campPotionsBought + 1 },
      `🧪 Camp potion purchased for ${cost} gold. The label has been removed for legal reasons.`
    );
  }
  if (action === "camp-weapon") {
    const weaponLevel = state.weaponLevel + 1;
    return withLog(
      { ...state, gold: state.gold - cost, weaponLevel },
      `⚔️ Weapon upgraded to level ${weaponLevel} for ${cost} gold. Finally, a weapon with standards.`
    );
  }
  const armorLevel = state.armorLevel + 1;
  return withLog(
    { ...state, gold: state.gold - cost, armorLevel },
    `🛡️ Armor upgraded to level ${armorLevel} for ${cost} gold. Fashion has filed a formal objection.`
  );
}

export function attackRange(state: PracticeGame): [number, number] {
  const base = 10 + state.weaponLevel * 2;
  return [
    scaleOutgoing(state.equippedRelic, base - 2, false),
    scaleOutgoing(state.equippedRelic, base + 2, false),
  ];
}

export function stormRange(state: PracticeGame): [number, number] {
  const base = 10 + state.weaponLevel * 2;
  return [0, scaleOutgoing(state.equippedRelic, base * 2, true)];
}

export function incomingRange(state: PracticeGame): [number, number] {
  const base = monsterDamage(state.monsterType, state.roomsCleared + 1);
  return [
    scaleIncoming(state.equippedRelic, applyArmor(state.armorLevel, base - 1)),
    scaleIncoming(state.equippedRelic, applyArmor(state.armorLevel, base + 1)),
  ];
}

export function currentCriticalChance(state: PracticeGame): number {
  return criticalChance(state.equippedRelic);
}

export function combatRelicSummary(state: PracticeGame, storm: boolean): string | null {
  const effects: string[] = [];
  const damagePercent = outgoingPercent(state.equippedRelic, storm);

  if (damagePercent !== 100) {
    const change = damagePercent - 100;
    effects.push((change > 0 ? "+" : "") + change + "% DAMAGE");
  }

  if (!storm) {
    const criticalBonus = criticalChance(state.equippedRelic) - BASE_CRITICAL_CHANCE;
    if (criticalBonus > 0) effects.push("+" + criticalBonus + " PP CRITICAL");

    const multiplier = criticalMultiplier(state.equippedRelic);
    if (multiplier > 2) effects.push(multiplier + "× CRITICAL HITS");
  }

  return effects.length > 0 ? effects.join(" · ") : null;
}

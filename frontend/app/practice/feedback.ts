import { getRelicDefinition } from "../relics";
import { siteUrl } from "../site-origin";
import type { PracticeGame } from "./engine";

export type PracticeActionKind = "attack" | "storm" | "potion" | "encounter" | "shop" | "relic";
export type PracticeFeedback = { title: string; detail: string; tone: "neutral" | "good" | "danger"; };

export function practiceRoom(game: PracticeGame): number {
  return Math.max(1, game.roomsCleared + (game.monsterHp > 0 ? 1 : 0));
}

export function practiceLoot(game: PracticeGame): string {
  if (game.lastLootType === 1) return "+1 potion";
  if (game.lastLootType === 2) return `+${game.lastLootAmount} bonus gold`;
  if (game.lastLootType === 3) return `Weapon level ${game.weaponLevel} · +2 base damage`;
  if (game.lastLootType === 4) return `Armor level ${game.armorLevel} · stronger protection`;
  return "No extra loot. The dungeon cites budget constraints.";
}

function signed(amount: number): string { return amount >= 0 ? `+${amount}` : String(amount); }

export function describePracticeAction(before: PracticeGame, after: PracticeGame, kind: PracticeActionKind): PracticeFeedback {
  const hpChange = after.hp - before.hp;
  const hp = `HP ${before.hp} → ${after.hp} (${signed(hpChange)})`;
  const cleared = after.roomsCleared > before.roomsCleared;
  const revived = !before.relicReviveUsed && after.relicReviveUsed;
  const ending = !after.active ? " · Run ended" : revived ? " · Relic revived you" : "";
  if (kind === "attack" || kind === "storm") {
    const title = `${kind === "storm" ? "Storm" : after.lastCritical ? "Critical attack" : "Attack"} · ${after.lastPlayerDamage} damage${ending}`;
    const detail = cleared
      ? `${before.monsterType === 3 ? "Boss defeated" : `Room ${after.roomsCleared} cleared`} · +${after.gold - before.gold} gold · ${practiceLoot(after)}${hpChange ? ` · ${hp}` : ""}`
      : `${after.lastMonsterDamage} retaliation · ${hp}${kind === "storm" && after.lastPlayerDamage === 0 ? " · Storm can miss entirely" : ""}`;
    return { title, detail, tone: !after.active ? "danger" : cleared || after.lastCritical ? "good" : "neutral" };
  }
  if (kind === "potion") {
    return { title: `Potion · ${hp}${ending}`, detail: before.monsterHp > 0
      ? `1 potion used · ${after.lastMonsterDamage} retaliation at half damage · ${after.potions}/5 potions left`
      : `1 potion used · no retaliation between rooms · ${after.potions}/5 potions left`, tone: after.active ? "good" : "danger" };
  }
  if (kind === "encounter") {
    return { title: `Room ${after.roomsCleared + 1} · ${after.monsterType === 3 ? "Management is expecting you" : "A new problem awaits"}`, detail: hpChange || before.maxHp !== after.maxHp
      ? `${hp} · Maximum HP ${before.maxHp} → ${after.maxHp}. Your relic's cost applies when you enter.`
      : "Defeat the monster to collect gold and loot. A killing blow prevents retaliation.", tone: "neutral" };
  }
  if (kind === "relic") {
    return { title: after.equippedRelic !== before.equippedRelic ? `${getRelicDefinition(after.equippedRelic).name} equipped` : "Relic added to your collection", detail: `${hp} · Maximum HP ${before.maxHp} → ${after.maxHp}. Relic copies do not stack.`, tone: "good" };
  }
  const changes = [
    hpChange ? hp : "",
    after.potions !== before.potions ? `${signed(after.potions - before.potions)} potion · ${after.potions}/5 carried` : "",
    after.weaponLevel !== before.weaponLevel ? `Weapon level ${after.weaponLevel} · +2 base damage` : "",
    after.armorLevel !== before.armorLevel ? `Armor level ${after.armorLevel} · stronger protection` : "",
  ].filter(Boolean);
  return { title: `Kevin's receipt · ${before.gold - after.gold} gold spent`, detail: changes.join(" · ") || after.log[0], tone: "good" };
}

export function practiceShareText(game: PracticeGame): string {
  const bosses = Math.floor(game.roomsCleared / 10);
  return `Delveworn · Local Practice Mode\n${game.roomsCleared} rooms cleared · ${bosses} ${bosses === 1 ? "boss" : "bosses"} defeated · ${game.gold} gold remaining\nWeapon ${game.weaponLevel} · Armor ${game.armorLevel} · ${game.ownedRelics.length} unique relics\nEquipped: ${getRelicDefinition(game.equippedRelic).name}\n${game.active ? "Run in progress." : "The dungeon has filed my exit paperwork."}\nBrowser-only simulation. Self-reported result; no onchain record or rewards.\nCan you survive longer? Play Practice Mode: ${siteUrl("/practice")}`;
}

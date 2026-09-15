import { phase, type Descent, type DescentAction } from "../../app/descent/model";

/** A transparent test-player policy, not a solver or a production autoplay API. */
export function informedPolicy(run: Descent): DescentAction {
  const g=run.game,p=phase(run);
  if (p === "explore") return "engage";
  if (p === "loot") return "collect";
  if (p === "reward") return "claim";
  if (p === "recovery") {
    if (g.roomsCleared === 5 && !g.supplyBandageUsed && g.hp <= g.maxHp-25 && g.gold >= 20) return "supply-bandage";
    if (g.roomsCleared === 9) {
      if (!g.campRestUsed && g.hp <= g.maxHp-30 && g.gold >= 25) return "camp-rest";
      if (g.gold >= 60 && g.weaponLevel < 2) return "camp-weapon";
      if (g.gold >= 60 && g.armorLevel < 2) return "camp-armor";
      if (g.gold >= 20 && g.potions < 3 && g.campPotionsBought < 2) return "camp-potion";
    }
    if (g.hp <= g.maxHp-25 && g.potions > 0) return "potion";
    return "enter";
  }
  if (g.potions > 0 && g.combatPotionsUsed < (g.monsterType === 3 ? 3 : 2)
    && g.hp < 35) return "potion";
  return "attack";
}

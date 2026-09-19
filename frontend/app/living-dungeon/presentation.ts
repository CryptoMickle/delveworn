import type { BossPreparationId, DungeonClaimId } from "./beliefs";
import type { LivingDungeon } from "./model";
import type { ActivePact } from "./pact-schema";

export type PlayerPactAction = "attack" | "storm" | "potion" | "purchase";

const PROMISE_LABELS: Record<ActivePact["terms"]["restrictionId"], string> = {
  NO_STORM: "NO STORM",
  NO_VOLUNTARY_HEALING: "NO VOLUNTARY HEALING",
  NO_CAMP_PURCHASE: "BUY NOTHING AT CAMP",
};

const BOON_LABELS: Record<ActivePact["terms"]["boonId"], string> = {
  BOSS_OPENING_WARD: "FIRST BOSS REPLY −50%",
  BOSS_OPENING_FURY: "FIRST TWO BOSS HITS +15%",
  BOSS_ENTRY_RESTORE: "+20 HP AT THE BOSS",
};

export function activePromiseSummary(pact: ActivePact | null): string | null {
  if (!pact) return null;
  if (pact.status === "BREACHED") return "PROMISE BROKEN · BOON LOST · BOSS +20 HP";
  if (pact.status === "COMPLETED") return "PROMISE KEPT";
  return `${PROMISE_LABELS[pact.terms.restrictionId]} → ${BOON_LABELS[pact.terms.boonId]}`;
}

export function pactActionWarning(pact: ActivePact | null, action: PlayerPactAction): string | null {
  if (!pact || pact.status !== "ACTIVE") return null;
  const breaks = (pact.terms.restrictionId === "NO_STORM" && action === "storm")
    || (pact.terms.restrictionId === "NO_VOLUNTARY_HEALING" && action === "potion")
    || (pact.terms.restrictionId === "NO_CAMP_PURCHASE" && action === "purchase");
  return breaks ? "BREAKS YOUR PROMISE" : null;
}

function preparationFromBelief(claimId: DungeonClaimId): string {
  if (claimId === "PLAYER_RELIES_ON_STORM") return "The Keeper built an anti-Storm ward.";
  if (claimId === "PLAYER_GUARDS_LIFE") return "The Keeper prepared to punish healing.";
  return "The Keeper reinforced itself against your blade.";
}

function observationFromBelief(claimId: DungeonClaimId): string {
  if (claimId === "PLAYER_RELIES_ON_STORM") return "saw you use Storm";
  if (claimId === "PLAYER_GUARDS_LIFE") return "saw you protect your life with a potion";
  return "saw you fight without Storm";
}

export function bossPreparationExplanation(
  run: Pick<LivingDungeon, "beliefs" | "bossPreparation">,
): string {
  const belief = run.beliefs[0];
  if (!belief || run.bossPreparation === "NONE") {
    return "No witness reached the Keeper, so it prepared without a report about you.";
  }
  return `The Scrivener ${observationFromBelief(belief.claimId)} and carried that impression forward. ${preparationFromBelief(belief.claimId)}`;
}

export function bossPreparationLabel(preparation: BossPreparationId): string {
  if (preparation === "ANTI_STORM_WARD") return "Anti-Storm ward";
  if (preparation === "PHYSICAL_BULWARK") return "Physical bulwark";
  if (preparation === "HEALING_PRESSURE") return "Healing pressure";
  return "No specialised preparation";
}

export function witnessBeliefSummary(claimId: DungeonClaimId): string {
  if (claimId === "PLAYER_RELIES_ON_STORM") return "The Scrivener thinks you rely on Storm.";
  if (claimId === "PLAYER_GUARDS_LIFE") return "The Scrivener thinks you will protect your life when pressured.";
  return "The Scrivener thinks you avoid Storm.";
}

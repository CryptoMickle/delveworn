import {
  PACT_DESIRED_BOONS,
  PACT_SACRIFICES,
  type PactBoonId,
  type PactDesiredBoon,
  type PactEligibilitySnapshot,
  type PactRestrictionId,
  type PactSacrifice,
} from "./pact-schema";

export const PACT_CATALOGUE_HASH = "pact-v0-20260919-b" as const;
export const PACT_DURATION_ID = "UNTIL_BOSS_DEFEATED" as const;
export const PACT_BREACH_ID = "FORFEIT_BOON_EMPOWER_BOSS" as const;

export type PactRestrictionDefinition = Readonly<{
  id: PactRestrictionId;
  title: string;
  rule: string;
  breachExample: string;
}>;

export type PactBoonDefinition = Readonly<{
  id: PactBoonId;
  desiredBoon: PactDesiredBoon;
  title: string;
  rule: string;
  initialUses: number;
}>;

export const PACT_RESTRICTIONS: Readonly<Record<PactRestrictionId, PactRestrictionDefinition>> = {
  NO_STORM: {
    id: "NO_STORM",
    title: "Still the storm",
    rule: "Do not use Storm before the boss is defeated.",
    breachExample: "Choosing Storm in a pressure fight or against the boss breaks this promise.",
  },
  NO_VOLUNTARY_HEALING: {
    id: "NO_VOLUNTARY_HEALING",
    title: "Carry every wound",
    rule: "Do not drink a Potion, use a Bandage or choose another healing action before the boss is defeated.",
    breachExample: "Choosing Potion breaks this promise; automatic healing does not.",
  },
  NO_CAMP_PURCHASE: {
    id: "NO_CAMP_PURCHASE",
    title: "Pass the open hand",
    rule: "Buy nothing at the next camp.",
    breachExample: "Buying a Bandage or Potion at the camp breaks this promise.",
  },
};

export const PACT_BOONS: Readonly<Record<PactBoonId, PactBoonDefinition>> = {
  BOSS_OPENING_WARD: {
    id: "BOSS_OPENING_WARD",
    desiredBoon: "DEFENSE",
    title: "First-blow ward",
    rule: "Take 50% less damage from the boss's first retaliation.",
    initialUses: 1,
  },
  BOSS_OPENING_FURY: {
    id: "BOSS_OPENING_FURY",
    desiredBoon: "DAMAGE",
    title: "Opening fury",
    rule: "Deal 15% more damage with your first two damaging actions against the boss.",
    initialUses: 2,
  },
  BOSS_ENTRY_RESTORE: {
    id: "BOSS_ENTRY_RESTORE",
    desiredBoon: "ENTRY_HEAL",
    title: "Threshold mercy",
    rule: "Restore 20 HP when you enter the boss room.",
    initialUses: 1,
  },
};

export const BOON_BY_INTENT: Readonly<Record<PactDesiredBoon, PactBoonId>> = {
  DEFENSE: "BOSS_OPENING_WARD",
  DAMAGE: "BOSS_OPENING_FURY",
  ENTRY_HEAL: "BOSS_ENTRY_RESTORE",
};

/** Explicit rather than inferred so later catalogue revisions cannot silently widen it. */
export const PACT_COMPATIBILITY: Readonly<Record<PactSacrifice, readonly PactDesiredBoon[]>> = {
  NO_STORM: PACT_DESIRED_BOONS,
  NO_VOLUNTARY_HEALING: PACT_DESIRED_BOONS,
  NO_CAMP_PURCHASE: PACT_DESIRED_BOONS,
};

export function isCompatiblePact(sacrifice: PactSacrifice, boon: PactDesiredBoon): boolean {
  return PACT_COMPATIBILITY[sacrifice].includes(boon);
}

export type SacrificeEligibility = Readonly<{ eligible: boolean; reason: string | null }>;

export function sacrificeEligibility(
  sacrifice: PactSacrifice,
  state: PactEligibilitySnapshot,
): SacrificeEligibility {
  if (sacrifice === "NO_STORM") {
    return state.stormAvailable && state.damagingRoomsBeforeBoss > 0
      ? { eligible: true, reason: null }
      : { eligible: false, reason: "Storm must be available in at least one remaining fight." };
  }
  if (sacrifice === "NO_VOLUNTARY_HEALING") {
    return state.potions > 0 && state.voluntaryHealingOpportunities > 0
      ? { eligible: true, reason: null }
      : { eligible: false, reason: "A healing resource and a remaining healing opportunity are required." };
  }
  return state.campAhead && state.gold >= state.campMinimumPrice
    ? { eligible: true, reason: null }
    : { eligible: false, reason: "The next camp must be reachable with enough held gold for a purchase." };
}

export function eligibleSacrifices(state: PactEligibilitySnapshot): readonly PactSacrifice[] {
  return PACT_SACRIFICES.filter((id) => sacrificeEligibility(id, state).eligible);
}

export type PactRuleCard = Readonly<{
  title: string;
  benefit: string;
  restriction: string;
  duration: string;
  breach: string;
  example: string;
}>;

export function pactRuleCard(restrictionId: PactRestrictionId, boonId: PactBoonId): PactRuleCard {
  const restriction = PACT_RESTRICTIONS[restrictionId];
  const boon = PACT_BOONS[boonId];
  return {
    title: `${boon.title} for ${restriction.title.toLocaleLowerCase("en")}`,
    benefit: boon.rule,
    restriction: restriction.rule,
    duration: "Until the boss is defeated.",
    breach: "The action still happens, the promised boon is permanently forfeited, and the boss gains 20 current and maximum HP.",
    example: restriction.breachExample,
  };
}

import {
  BOON_BY_INTENT,
  PACT_BOONS,
  PACT_BREACH_ID,
  PACT_CATALOGUE_HASH,
  PACT_DURATION_ID,
  eligibleSacrifices,
  isCompatiblePact,
  pactRuleCard,
  sacrificeEligibility,
  type PactRuleCard,
} from "./pact-catalogue";
import {
  type ActivePact,
  type PactAction,
  type PactDesiredBoon,
  type PactEligibilitySnapshot,
  type PactIntent,
  type PactOffer,
  type PactSacrifice,
  isPactIntent,
} from "./pact-schema";

export type PactOfferBuildResult =
  | Readonly<{ status: "offered"; offer: PactOffer; countered: boolean }>
  | Readonly<{ status: "clarification"; reason: string }>
  | Readonly<{ status: "unavailable"; reason: string }>;

export type PactActionCheck = Readonly<{
  allowed: true;
  requiresBreachConfirmation: boolean;
  reason: string | null;
}>;

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function pactEligibilityDigest(snapshot: PactEligibilitySnapshot): string {
  return fnv1a([
    snapshot.runId,
    snapshot.revision,
    Number(snapshot.stormAvailable),
    snapshot.potions,
    snapshot.voluntaryHealingOpportunities,
    snapshot.gold,
    Number(snapshot.campAhead),
    snapshot.campMinimumPrice,
    snapshot.damagingRoomsBeforeBoss,
  ].join("|"));
}

function rotated<T>(values: readonly T[], seed: number): readonly T[] {
  if (values.length === 0) return values;
  const offset = (seed >>> 0) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function makeOffer(
  desiredBoon: PactDesiredBoon,
  sacrifice: PactSacrifice,
  snapshot: PactEligibilitySnapshot,
  offerSeed: number,
): PactOffer {
  const boonId = BOON_BY_INTENT[desiredBoon];
  const digest = pactEligibilityDigest(snapshot);
  const pactHash = fnv1a([
    PACT_CATALOGUE_HASH,
    snapshot.runId,
    snapshot.revision,
    offerSeed >>> 0,
    sacrifice,
    boonId,
    digest,
  ].join("|"));
  return Object.freeze({
    terms: Object.freeze({
      pactId: `pact-${pactHash}`,
      templateId: `${sacrifice}:${boonId}`,
      rulesVersion: "living-dungeon-v0",
      catalogueHash: PACT_CATALOGUE_HASH,
      offerSeed: offerSeed >>> 0,
      restrictionId: sacrifice,
      boonId,
      durationId: PACT_DURATION_ID,
      breachId: PACT_BREACH_ID,
    }),
    boundRunId: snapshot.runId,
    boundRevision: snapshot.revision,
    eligibilityDigest: digest,
  });
}

/** Converts semantic slots into catalogue terms. It never trusts model-authored numbers or rules. */
export function buildPactOffer(
  intent: PactIntent,
  snapshot: PactEligibilitySnapshot,
  offerSeed: number,
): PactOfferBuildResult {
  if (!isPactIntent(intent)) {
    return { status: "unavailable", reason: "The interpreted pact intent is invalid." };
  }
  if (intent.needsClarification) {
    return { status: "clarification", reason: "The requested exchange needs one clarification before it can become a rule." };
  }
  if (!Number.isSafeInteger(offerSeed) || offerSeed < 0 || offerSeed > 0xffffffff) {
    return { status: "unavailable", reason: "The offer seed is invalid." };
  }

  const requested = sacrificeEligibility(intent.offeredSacrifice, snapshot);
  if (requested.eligible && isCompatiblePact(intent.offeredSacrifice, intent.desiredBoon)) {
    return { status: "offered", offer: makeOffer(intent.desiredBoon, intent.offeredSacrifice, snapshot, offerSeed), countered: false };
  }
  const alternative = rotated(eligibleSacrifices(snapshot), offerSeed)
    .find((sacrifice) => isCompatiblePact(sacrifice, intent.desiredBoon));
  if (!alternative) {
    return { status: "unavailable", reason: requested.reason ?? "No meaningful sacrifice is available in this run state." };
  }
  return { status: "offered", offer: makeOffer(intent.desiredBoon, alternative, snapshot, offerSeed), countered: true };
}

/** Three authored-menu entries backed by the exact same builder as interpreted proposals. */
export function standardPactOffers(
  snapshot: PactEligibilitySnapshot,
  offerSeed: number,
): readonly PactOffer[] {
  const eligible = rotated(eligibleSacrifices(snapshot), offerSeed);
  if (eligible.length === 0) return [];
  const boons: readonly PactDesiredBoon[] = ["DEFENSE", "DAMAGE", "ENTRY_HEAL"];
  return boons.map((desiredBoon, index) => makeOffer(
    desiredBoon,
    eligible[index % eligible.length],
    snapshot,
    (offerSeed + index) >>> 0,
  ));
}

export function acceptPactOffer(
  offer: PactOffer,
  runId: string,
  revision: number,
  currentSnapshot: PactEligibilitySnapshot,
  acceptedAtRevision = revision,
): ActivePact | null {
  if (offer.boundRunId !== runId || offer.boundRevision !== revision
    || offer.eligibilityDigest !== pactEligibilityDigest(currentSnapshot)
    || offer.terms.rulesVersion !== "living-dungeon-v0"
    || offer.terms.catalogueHash !== PACT_CATALOGUE_HASH
    || offer.terms.durationId !== PACT_DURATION_ID
    || offer.terms.breachId !== PACT_BREACH_ID
    || !sacrificeEligibility(offer.terms.restrictionId, currentSnapshot).eligible) return null;
  const boon = PACT_BOONS[offer.terms.boonId];
  if (!boon || !isCompatiblePact(offer.terms.restrictionId, boon.desiredBoon)) return null;
  const expected = makeOffer(boon.desiredBoon, offer.terms.restrictionId, currentSnapshot, offer.terms.offerSeed);
  if (JSON.stringify(offer) !== JSON.stringify(expected)
    || !Number.isSafeInteger(acceptedAtRevision) || acceptedAtRevision < revision) return null;
  return Object.freeze({
    terms: offer.terms,
    status: "ACTIVE",
    acceptedAtRevision,
    boonUsesRemaining: boon.initialUses,
    entryBoonApplied: false,
    breachedAtRevision: null,
    breachActionId: null,
    completedAtRevision: null,
  });
}

export function checkPactAction(pact: ActivePact | null, action: PactAction): PactActionCheck {
  if (!pact || pact.status !== "ACTIVE" || action.source !== "PLAYER") {
    return { allowed: true, requiresBreachConfirmation: false, reason: null };
  }
  const breaks = (pact.terms.restrictionId === "NO_STORM" && action.tag === "STORM")
    || (pact.terms.restrictionId === "NO_VOLUNTARY_HEALING" && action.tag === "VOLUNTARY_HEALING")
    || (pact.terms.restrictionId === "NO_CAMP_PURCHASE" && action.tag === "PURCHASE");
  return breaks
    ? { allowed: true, requiresBreachConfirmation: true, reason: pactRuleCard(pact.terms.restrictionId, pact.terms.boonId).breach }
    : { allowed: true, requiresBreachConfirmation: false, reason: null };
}

/** Idempotent: the first confirmed triggering action permanently fixes the breach record. */
export function confirmPactBreach(pact: ActivePact, action: PactAction, revision: number): ActivePact {
  if (pact.status === "BREACHED" && pact.breachActionId === action.actionId) return pact;
  if (pact.status !== "ACTIVE" || !checkPactAction(pact, action).requiresBreachConfirmation) return pact;
  return Object.freeze({
    ...pact,
    status: "BREACHED",
    boonUsesRemaining: 0,
    breachedAtRevision: revision,
    breachActionId: action.actionId,
  });
}

export function completePact(pact: ActivePact | null, revision: number): ActivePact | null {
  if (!pact || pact.status !== "ACTIVE") return pact;
  return Object.freeze({ ...pact, status: "COMPLETED", completedAtRevision: revision });
}

export function applyBossEntryBoon(
  pact: ActivePact | null,
  hp: number,
  maxHp: number,
): Readonly<{ pact: ActivePact | null; hp: number; healed: number }> {
  if (!pact || pact.status !== "ACTIVE" || pact.terms.boonId !== "BOSS_ENTRY_RESTORE"
    || pact.entryBoonApplied || pact.boonUsesRemaining < 1) return { pact, hp, healed: 0 };
  const nextHp = Math.min(maxHp, hp + 20);
  return {
    hp: nextHp,
    healed: nextHp - hp,
    pact: Object.freeze({ ...pact, entryBoonApplied: true, boonUsesRemaining: 0 }),
  };
}

export function applyBossDamageBoon(
  pact: ActivePact | null,
  damage: number,
): Readonly<{ pact: ActivePact | null; damage: number }> {
  if (!pact || pact.status !== "ACTIVE" || pact.terms.boonId !== "BOSS_OPENING_FURY" || pact.boonUsesRemaining < 1) {
    return { pact, damage };
  }
  // The rule card promises the first two damaging actions. A zero-damage
  // Storm is still an action, but it has dealt nothing and must not spend a use.
  if (damage <= 0) return { pact, damage };
  return {
    damage: Math.floor(damage * 115 / 100),
    pact: Object.freeze({ ...pact, boonUsesRemaining: pact.boonUsesRemaining - 1 }),
  };
}

export function applyBossRetaliationBoon(
  pact: ActivePact | null,
  damage: number,
): Readonly<{ pact: ActivePact | null; damage: number }> {
  if (!pact || pact.status !== "ACTIVE" || pact.terms.boonId !== "BOSS_OPENING_WARD" || pact.boonUsesRemaining < 1) {
    return { pact, damage };
  }
  return {
    damage: Math.floor(damage * 50 / 100),
    pact: Object.freeze({ ...pact, boonUsesRemaining: pact.boonUsesRemaining - 1 }),
  };
}

export function explainPact(offerOrPact: PactOffer | ActivePact): PactRuleCard {
  const terms = "terms" in offerOrPact ? offerOrPact.terms : offerOrPact;
  return pactRuleCard(terms.restrictionId, terms.boonId);
}

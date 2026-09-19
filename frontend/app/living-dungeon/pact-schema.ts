export const PACT_DESIRED_BOONS = ["DEFENSE", "DAMAGE", "ENTRY_HEAL"] as const;
export const PACT_SACRIFICES = ["NO_STORM", "NO_VOLUNTARY_HEALING", "NO_CAMP_PURCHASE"] as const;
export const PACT_DURATION_PREFERENCES = ["UNTIL_BOSS"] as const;
export const PACT_BREACH_TOLERANCES = ["LOW", "MEDIUM", "HIGH"] as const;

export type PactDesiredBoon = (typeof PACT_DESIRED_BOONS)[number];
export type PactSacrifice = (typeof PACT_SACRIFICES)[number];
export type PactDurationPreference = (typeof PACT_DURATION_PREFERENCES)[number];
export type PactBreachTolerance = (typeof PACT_BREACH_TOLERANCES)[number];

/** The only shape an untrusted language-model response may contribute. */
export type PactIntent = Readonly<{
  desiredBoon: PactDesiredBoon;
  offeredSacrifice: PactSacrifice;
  durationPreference: PactDurationPreference;
  breachTolerance: PactBreachTolerance;
  needsClarification: boolean;
}>;

export const PACT_ACTION_TAGS = [
  "ATTACK",
  "STORM",
  "VOLUNTARY_HEALING",
  "AUTOMATIC_HEALING",
  "PURCHASE",
  "INTERACTION",
  "MERCY",
  "INFORMATION_REVEAL",
  "RESOURCE_SPEND",
] as const;
export type PactActionTag = (typeof PACT_ACTION_TAGS)[number];

export const PACT_BOON_IDS = ["BOSS_OPENING_WARD", "BOSS_OPENING_FURY", "BOSS_ENTRY_RESTORE"] as const;
export const PACT_RESTRICTION_IDS = PACT_SACRIFICES;
export const PACT_DURATION_IDS = ["UNTIL_BOSS_DEFEATED"] as const;
export const PACT_BREACH_IDS = ["FORFEIT_BOON_EMPOWER_BOSS"] as const;

export type PactBoonId = (typeof PACT_BOON_IDS)[number];
export type PactRestrictionId = (typeof PACT_RESTRICTION_IDS)[number];
export type PactDurationId = (typeof PACT_DURATION_IDS)[number];
export type PactBreachId = (typeof PACT_BREACH_IDS)[number];
export type PactStatus = "ACTIVE" | "BREACHED" | "COMPLETED";

export type PactTerms = Readonly<{
  pactId: string;
  templateId: string;
  rulesVersion: string;
  catalogueHash: string;
  offerSeed: number;
  restrictionId: PactRestrictionId;
  boonId: PactBoonId;
  durationId: PactDurationId;
  breachId: PactBreachId;
}>;

export type PactOffer = Readonly<{
  terms: PactTerms;
  boundRunId: string;
  boundRevision: number;
  eligibilityDigest: string;
}>;

export type ActivePact = Readonly<{
  terms: PactTerms;
  status: PactStatus;
  acceptedAtRevision: number;
  boonUsesRemaining: number;
  entryBoonApplied: boolean;
  breachedAtRevision: number | null;
  breachActionId: string | null;
  completedAtRevision: number | null;
}>;

export type PactAction = Readonly<{
  actionId: string;
  tag: PactActionTag;
  source: "PLAYER" | "SYSTEM";
  roomId: string;
}>;

export type PactEligibilitySnapshot = Readonly<{
  runId: string;
  revision: number;
  stormAvailable: boolean;
  potions: number;
  voluntaryHealingOpportunities: number;
  gold: number;
  campAhead: boolean;
  campMinimumPrice: number;
  damagingRoomsBeforeBoss: number;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function member<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

export function isPactIntent(value: unknown): value is PactIntent {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = ["breachTolerance", "desiredBoon", "durationPreference", "needsClarification", "offeredSacrifice"].sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index])
    && member(PACT_DESIRED_BOONS, value.desiredBoon)
    && member(PACT_SACRIFICES, value.offeredSacrifice)
    && member(PACT_DURATION_PREFERENCES, value.durationPreference)
    && member(PACT_BREACH_TOLERANCES, value.breachTolerance)
    && typeof value.needsClarification === "boolean";
}

function uint(value: unknown, maximum = 1_000_000): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

export function isPactTerms(value: unknown): value is PactTerms {
  if (!isRecord(value)) return false;
  return typeof value.pactId === "string" && /^pact-[a-f0-9]{8}$/.test(value.pactId)
    && typeof value.templateId === "string" && value.templateId.length >= 1 && value.templateId.length <= 120
    && value.rulesVersion === "living-dungeon-v0"
    && typeof value.catalogueHash === "string" && value.catalogueHash.length >= 1 && value.catalogueHash.length <= 80
    && uint(value.offerSeed, 0xffffffff)
    && member(PACT_RESTRICTION_IDS, value.restrictionId)
    && member(PACT_BOON_IDS, value.boonId)
    && member(PACT_DURATION_IDS, value.durationId)
    && member(PACT_BREACH_IDS, value.breachId);
}

export function isPactOffer(value: unknown): value is PactOffer {
  if (!isRecord(value)) return false;
  return isPactTerms(value.terms)
    && typeof value.boundRunId === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value.boundRunId)
    && uint(value.boundRevision)
    && typeof value.eligibilityDigest === "string" && /^[a-f0-9]{8}$/.test(value.eligibilityDigest);
}

export function isActivePact(value: unknown): value is ActivePact {
  if (!isRecord(value) || !isPactTerms(value.terms)) return false;
  return ["ACTIVE", "BREACHED", "COMPLETED"].includes(String(value.status))
    && uint(value.acceptedAtRevision)
    && uint(value.boonUsesRemaining, 2)
    && typeof value.entryBoonApplied === "boolean"
    && (value.breachedAtRevision === null || uint(value.breachedAtRevision))
    && (value.breachActionId === null || (typeof value.breachActionId === "string" && value.breachActionId.length <= 180))
    && (value.completedAtRevision === null || uint(value.completedAtRevision))
    && (value.status !== "ACTIVE" || (value.breachedAtRevision === null && value.breachActionId === null && value.completedAtRevision === null))
    && (value.status !== "BREACHED" || (value.breachedAtRevision !== null && value.breachActionId !== null && value.completedAtRevision === null && value.boonUsesRemaining === 0))
    && (value.status !== "COMPLETED" || (value.completedAtRevision !== null && value.breachedAtRevision === null && value.breachActionId === null));
}

export function isPactAction(value: unknown): value is PactAction {
  if (!isRecord(value)) return false;
  return typeof value.actionId === "string" && value.actionId.length >= 1 && value.actionId.length <= 180
    && member(PACT_ACTION_TAGS, value.tag)
    && (value.source === "PLAYER" || value.source === "SYSTEM")
    && typeof value.roomId === "string" && value.roomId.length >= 1 && value.roomId.length <= 80;
}

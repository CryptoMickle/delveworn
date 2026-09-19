import {
  PACT_BREACH_TOLERANCES,
  PACT_DESIRED_BOONS,
  PACT_SACRIFICES,
  type PactDesiredBoon,
  type PactIntent,
  type PactSacrifice,
} from "./pact-schema";

export const LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS = 320;
export const LIVING_DUNGEON_INTERPRET_MAX_REQUEST_BYTES = 4_096;
export const LIVING_DUNGEON_OFFER_SEED_MAX = 0xffff_ffff;

export type PactIntentEligibility = Readonly<{
  desiredBoons: readonly PactDesiredBoon[];
  sacrifices: readonly PactSacrifice[];
}>;

export type InterpretPactIntentRequest = Readonly<{
  proposal: string;
  eligibility: PactIntentEligibility;
  runRevision: number;
  stateDigest: string;
  offerSeed: number;
}>;

export type PactIntentBinding = Readonly<{
  runRevision: number;
  stateDigest: string;
  offerSeed: number;
}>;

export const INTERPRET_FALLBACK_REASONS = [
  "disabled",
  "not_configured",
  "timed_out",
  "rate_limited",
  "provider_unavailable",
  "invalid_provider_response",
] as const;

export type InterpretFallbackReason = (typeof INTERPRET_FALLBACK_REASONS)[number];

export type InterpretPactIntentReply =
  | Readonly<{
    status: "interpreted";
    source: "ai";
    intent: PactIntent;
    binding: PactIntentBinding;
  }>
  | Readonly<{
    status: "fallback";
    source: "menu_fallback";
    reason: InterpretFallbackReason;
    binding: PactIntentBinding;
  }>;

export type InterpretPactIntentErrorReply = Readonly<{
  status: "invalid_request";
  code: "content_type" | "origin" | "request_too_large" | "request_timeout" | "malformed_json" | "invalid_body";
  message: string;
}>;

export class PactIntentRequestError extends Error {
  readonly code: InterpretPactIntentErrorReply["code"];

  constructor(code: InterpretPactIntentErrorReply["code"], message: string) {
    super(message);
    this.name = "PactIntentRequestError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function uniqueMembers<T extends string>(
  value: unknown,
  allowed: readonly T[],
): readonly T[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > allowed.length) return null;
  if (!value.every((entry): entry is T => typeof entry === "string" && allowed.includes(entry as T))) {
    return null;
  }
  return new Set(value).size === value.length ? value : null;
}

function normalizeProposal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const characters = Array.from(normalized);
  if (characters.length < 1 || characters.length > LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS) return null;
  return normalized;
}

export function parseInterpretPactIntentRequest(value: unknown): InterpretPactIntentRequest {
  if (!isRecord(value) || !hasExactKeys(value, [
    "proposal",
    "eligibility",
    "runRevision",
    "stateDigest",
    "offerSeed",
  ])) {
    throw new PactIntentRequestError("invalid_body", "The pact request has an invalid shape.");
  }

  const proposal = normalizeProposal(value.proposal);
  if (!proposal) {
    throw new PactIntentRequestError(
      "invalid_body",
      `Proposal must contain 1–${LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS} characters.`,
    );
  }

  if (!isRecord(value.eligibility)
    || !hasExactKeys(value.eligibility, ["desiredBoons", "sacrifices"])) {
    throw new PactIntentRequestError("invalid_body", "Eligibility has an invalid shape.");
  }
  const desiredBoons = uniqueMembers(value.eligibility.desiredBoons, PACT_DESIRED_BOONS);
  const sacrifices = uniqueMembers(value.eligibility.sacrifices, PACT_SACRIFICES);
  if (!desiredBoons || !sacrifices) {
    throw new PactIntentRequestError("invalid_body", "Eligibility contains unsupported or duplicate choices.");
  }

  if (!Number.isSafeInteger(value.runRevision) || (value.runRevision as number) < 0) {
    throw new PactIntentRequestError("invalid_body", "Run revision must be a non-negative integer.");
  }
  if (typeof value.stateDigest !== "string"
    || !/^[A-Za-z0-9:_-]{8,128}$/.test(value.stateDigest)) {
    throw new PactIntentRequestError("invalid_body", "State digest has an invalid format.");
  }
  if (!Number.isInteger(value.offerSeed)
    || (value.offerSeed as number) < 0
    || (value.offerSeed as number) > LIVING_DUNGEON_OFFER_SEED_MAX) {
    throw new PactIntentRequestError("invalid_body", "Offer seed must be an unsigned 32-bit integer.");
  }

  return {
    proposal,
    eligibility: { desiredBoons, sacrifices },
    runRevision: value.runRevision as number,
    stateDigest: value.stateDigest,
    offerSeed: value.offerSeed as number,
  };
}

export function pactIntentBinding(request: InterpretPactIntentRequest): PactIntentBinding {
  return {
    runRevision: request.runRevision,
    stateDigest: request.stateDigest,
    offerSeed: request.offerSeed,
  };
}

export function pactIntentOutputSchema(eligibility: PactIntentEligibility): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      desiredBoon: { type: "string", enum: [...eligibility.desiredBoons] },
      offeredSacrifice: { type: "string", enum: [...eligibility.sacrifices] },
      durationPreference: { type: "string", enum: ["UNTIL_BOSS"] },
      breachTolerance: { type: "string", enum: [...PACT_BREACH_TOLERANCES] },
      needsClarification: { type: "boolean" },
    },
    required: [
      "desiredBoon",
      "offeredSacrifice",
      "durationPreference",
      "breachTolerance",
      "needsClarification",
    ],
    additionalProperties: false,
  };
}

import { fnv1a, stableStringify } from "./improvisation/digest";
import { WITNESS_GATE_MANOEUVRES } from "./improvisation/catalogue";
import {
  IMPROVISATION_BOUNDARY_IDS,
  WITNESS_GATE_MANOEUVRE_IDS,
  WITNESS_GATE_PREMISE_IDS,
} from "./improvisation/schema";

export const LIVING_DUNGEON_SHAPE_OBJECTIVES = [
  "RESCUE",
  "ACQUIRE",
  "DISCOVER",
] as const;

export const LIVING_DUNGEON_SHAPE_METHODS = [
  "CUNNING",
  "MERCY",
  "FORCE",
  "RISK",
] as const;

export const LIVING_DUNGEON_SHAPE_BOUNDARIES = [
  "NO_KILLING",
  "NO_STORM",
  "NO_GOLD",
  "NO_LYING",
  "NONE",
] as const;

export type LivingDungeonShapeObjective = (typeof LIVING_DUNGEON_SHAPE_OBJECTIVES)[number];
export type LivingDungeonShapeMethod = (typeof LIVING_DUNGEON_SHAPE_METHODS)[number];
export type LivingDungeonShapeBoundary = (typeof LIVING_DUNGEON_SHAPE_BOUNDARIES)[number];

export type LivingDungeonWorldShape = Readonly<{
  objective: LivingDungeonShapeObjective;
  method: LivingDungeonShapeMethod;
  boundary: LivingDungeonShapeBoundary;
  needsClarification: boolean;
}>;

export const LIVING_DUNGEON_SHAPE_STATEMENT_MAX_CHARACTERS = 480;
export const LIVING_DUNGEON_PLAN_TEXT_MAX_CHARACTERS = 720;
export const LIVING_DUNGEON_PREMISE_MAX_CHARACTERS = 720;
export const LIVING_DUNGEON_SEMANTIC_LABEL_MAX_CHARACTERS = 180;
export const LIVING_DUNGEON_SEMANTIC_OPTIONS_MAX = 12;
export const LIVING_DUNGEON_SHAPE_MAX_REQUEST_BYTES = 4_096;
export const LIVING_DUNGEON_PLAN_MAX_REQUEST_BYTES = 16_384;

export type ImprovisationBinding = Readonly<{
  runRevision: number;
  stateDigest: string;
  requestDigest: string;
}>;

export type ShapeWorldRequest = Readonly<{
  statement: string;
  runRevision: number;
  stateDigest: string;
}>;

export const IMPROVISATION_FALLBACK_REASONS = [
  "disabled",
  "not_configured",
  "timed_out",
  "rate_limited",
  "provider_unavailable",
  "invalid_provider_response",
] as const;

export type ImprovisationFallbackReason = (typeof IMPROVISATION_FALLBACK_REASONS)[number];

export type ShapeWorldReply =
  | Readonly<{
    status: "interpreted";
    source: "ai";
    shape: LivingDungeonWorldShape;
    binding: ImprovisationBinding;
  }>
  | Readonly<{
    status: "fallback";
    source: "authored_fallback";
    reason: ImprovisationFallbackReason;
    shape: LivingDungeonWorldShape;
    binding: ImprovisationBinding;
  }>;

export type SemanticOption = Readonly<{
  id: string;
  description: string;
}>;

export type PlanManoeuvreOption = Readonly<{
  id: string;
  goalId: string;
  methodId: string;
  targetId: string;
  objectId: string;
  boundaryId: string;
  description: string;
}>;

export type PlanContext = Readonly<{
  manoeuvres: readonly PlanManoeuvreOption[];
}>;

export type PlanImprovisationRequest = Readonly<{
  premise: SemanticOption;
  context: PlanContext;
  playerPlan: string;
  runRevision: number;
  stateDigest: string;
}>;

export type BoundedImprovisationPlan = Readonly<{
  manoeuvreId: string;
  needsClarification: boolean;
}>;

export type PlanImprovisationReply =
  | Readonly<{
    status: "interpreted";
    source: "ai";
    plan: BoundedImprovisationPlan;
    binding: ImprovisationBinding;
  }>
  | Readonly<{
    status: "fallback";
    source: "authored_fallback";
    reason: ImprovisationFallbackReason;
    plan: BoundedImprovisationPlan;
    binding: ImprovisationBinding;
  }>;

export type ImprovisationRequestErrorReply = Readonly<{
  status: "invalid_request";
  code: "content_type" | "origin" | "request_too_large" | "request_timeout" | "malformed_json" | "invalid_body";
  message: string;
}>;

export class ImprovisationRequestError extends Error {
  readonly code: ImprovisationRequestErrorReply["code"];

  constructor(code: ImprovisationRequestErrorReply["code"], message: string) {
    super(message);
    this.name = "ImprovisationRequestError";
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

function normalizedText(value: unknown, maximumCharacters: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const characters = Array.from(normalized);
  return characters.length >= 1 && characters.length <= maximumCharacters ? normalized : null;
}

function parseBinding(
  value: Record<string, unknown>,
): Pick<ImprovisationBinding, "runRevision" | "stateDigest"> {
  if (!Number.isSafeInteger(value.runRevision) || (value.runRevision as number) < 0) {
    throw new ImprovisationRequestError("invalid_body", "Run revision must be a non-negative integer.");
  }
  if (typeof value.stateDigest !== "string"
    || !/^[A-Za-z0-9:_-]{8,128}$/.test(value.stateDigest)) {
    throw new ImprovisationRequestError("invalid_body", "State digest has an invalid format.");
  }
  return { runRevision: value.runRevision as number, stateDigest: value.stateDigest };
}

function semanticOption(value: unknown): SemanticOption | null {
  if (!isRecord(value) || !hasExactKeys(value, ["id", "description"])) return null;
  if (typeof value.id !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{0,63}$/.test(value.id)) return null;
  const description = normalizedText(value.description, LIVING_DUNGEON_SEMANTIC_LABEL_MAX_CHARACTERS);
  return description ? { id: value.id, description } : null;
}

function planManoeuvreOption(value: unknown): PlanManoeuvreOption | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "id",
    "goalId",
    "methodId",
    "targetId",
    "objectId",
    "boundaryId",
    "description",
  ])) return null;
  const identifiers = [
    value.id,
    value.goalId,
    value.methodId,
    value.targetId,
    value.objectId,
    value.boundaryId,
  ];
  if (!identifiers.every((identifier) => (
    typeof identifier === "string" && /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/.test(identifier)
  ))) return null;
  const description = normalizedText(value.description, LIVING_DUNGEON_SEMANTIC_LABEL_MAX_CHARACTERS);
  if (!description) return null;
  return {
    id: value.id as string,
    goalId: value.goalId as string,
    methodId: value.methodId as string,
    targetId: value.targetId as string,
    objectId: value.objectId as string,
    boundaryId: value.boundaryId as string,
    description,
  };
}

function planManoeuvreOptions(value: unknown): readonly PlanManoeuvreOption[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > LIVING_DUNGEON_SEMANTIC_OPTIONS_MAX) {
    return null;
  }
  const options = value.map(planManoeuvreOption);
  if (options.some((option) => option === null)) return null;
  const parsed = options as PlanManoeuvreOption[];
  return new Set(parsed.map((option) => option.id)).size === parsed.length ? parsed : null;
}

export function parseShapeWorldRequest(value: unknown): ShapeWorldRequest {
  if (!isRecord(value) || !hasExactKeys(value, ["statement", "runRevision", "stateDigest"])) {
    throw new ImprovisationRequestError("invalid_body", "The world-shaping request has an invalid shape.");
  }
  const statement = normalizedText(value.statement, LIVING_DUNGEON_SHAPE_STATEMENT_MAX_CHARACTERS);
  if (!statement) {
    throw new ImprovisationRequestError(
      "invalid_body",
      `Statement must contain 1–${LIVING_DUNGEON_SHAPE_STATEMENT_MAX_CHARACTERS} characters.`,
    );
  }
  return { statement, ...parseBinding(value) };
}

export function parsePlanImprovisationRequest(value: unknown): PlanImprovisationRequest {
  if (!isRecord(value) || !hasExactKeys(value, [
    "premise",
    "context",
    "playerPlan",
    "runRevision",
    "stateDigest",
  ])) {
    throw new ImprovisationRequestError("invalid_body", "The improvisation request has an invalid shape.");
  }
  const premise = semanticOption(value.premise);
  const playerPlan = normalizedText(value.playerPlan, LIVING_DUNGEON_PLAN_TEXT_MAX_CHARACTERS);
  if (!premise
    || !WITNESS_GATE_PREMISE_IDS.includes(premise.id as (typeof WITNESS_GATE_PREMISE_IDS)[number])
    || !playerPlan) {
    throw new ImprovisationRequestError("invalid_body", "Premise and player plan must contain bounded text.");
  }
  if (!isRecord(value.context) || !hasExactKeys(value.context, ["manoeuvres"])) {
    throw new ImprovisationRequestError("invalid_body", "The authored plan context has an invalid shape.");
  }
  const manoeuvres = planManoeuvreOptions(value.context.manoeuvres);
  const exactAuthoredManoeuvres = manoeuvres?.every((option) => {
    if (!WITNESS_GATE_MANOEUVRE_IDS.includes(option.id as (typeof WITNESS_GATE_MANOEUVRE_IDS)[number])) {
      return false;
    }
    if (!IMPROVISATION_BOUNDARY_IDS.includes(option.boundaryId as (typeof IMPROVISATION_BOUNDARY_IDS)[number])) {
      return false;
    }
    const authored = WITNESS_GATE_MANOEUVRES[option.id as keyof typeof WITNESS_GATE_MANOEUVRES];
    return authored.premiseId === premise.id
      && authored.goalId === option.goalId
      && authored.methodId === option.methodId
      && authored.targetId === option.targetId
      && authored.objectId === option.objectId;
  });
  const oneBoundary = manoeuvres && new Set(manoeuvres.map(({ boundaryId }) => boundaryId)).size === 1;
  if (!manoeuvres || !exactAuthoredManoeuvres || !oneBoundary) {
    throw new ImprovisationRequestError(
      "invalid_body",
      "Plan context must contain unique, bounded authored manoeuvres.",
    );
  }
  return {
    premise,
    context: { manoeuvres },
    playerPlan,
    ...parseBinding(value),
  };
}

export function improvisationBinding(
  request: ShapeWorldRequest | PlanImprovisationRequest,
): ImprovisationBinding {
  return {
    runRevision: request.runRevision,
    stateDigest: request.stateDigest,
    requestDigest: improvisationRequestDigest(request),
  };
}

export function improvisationRequestDigest(
  request: ShapeWorldRequest | PlanImprovisationRequest,
): string {
  return `improvisation-${fnv1a(stableStringify(request))}`;
}

export function worldShapeOutputSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      objective: { type: "string", enum: [...LIVING_DUNGEON_SHAPE_OBJECTIVES] },
      method: { type: "string", enum: [...LIVING_DUNGEON_SHAPE_METHODS] },
      boundary: { type: "string", enum: [...LIVING_DUNGEON_SHAPE_BOUNDARIES] },
      needsClarification: { type: "boolean" },
    },
    required: ["objective", "method", "boundary", "needsClarification"],
    additionalProperties: false,
  };
}

export function improvisationPlanOutputSchema(
  context: PlanContext,
): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      manoeuvreId: { type: "string", enum: context.manoeuvres.map(({ id }) => id) },
      needsClarification: { type: "boolean" },
    },
    required: ["manoeuvreId", "needsClarification"],
    additionalProperties: false,
  };
}

export function isLivingDungeonWorldShape(value: unknown): value is LivingDungeonWorldShape {
  return isRecord(value)
    && hasExactKeys(value, ["objective", "method", "boundary", "needsClarification"])
    && typeof value.objective === "string"
    && LIVING_DUNGEON_SHAPE_OBJECTIVES.includes(value.objective as LivingDungeonShapeObjective)
    && typeof value.method === "string"
    && LIVING_DUNGEON_SHAPE_METHODS.includes(value.method as LivingDungeonShapeMethod)
    && typeof value.boundary === "string"
    && LIVING_DUNGEON_SHAPE_BOUNDARIES.includes(value.boundary as LivingDungeonShapeBoundary)
    && typeof value.needsClarification === "boolean";
}

export function isBoundedImprovisationPlan(
  value: unknown,
  request: Pick<PlanImprovisationRequest, "context">,
): value is BoundedImprovisationPlan {
  if (!isRecord(value)
    || !hasExactKeys(value, ["manoeuvreId", "needsClarification"])) {
    return false;
  }
  return typeof value.manoeuvreId === "string"
    && request.context.manoeuvres.some(({ id }) => id === value.manoeuvreId)
    && typeof value.needsClarification === "boolean";
}

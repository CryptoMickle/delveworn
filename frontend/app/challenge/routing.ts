import { weeklyDescentIdForDate } from "../descent/weekly";

export type ChallengeSearchParams = {
  v?: string | string[];
  r?: string | string[];
  ref?: string | string[];
};

export type ChallengeRoute = {
  version: 1 | 2;
  resultProof: string | null;
  referral: string | null;
};

function optionalSingle(value: string | string[] | undefined): string | null | undefined {
  if (value === undefined) return null;
  if (typeof value !== "string") return undefined;
  return value;
}

export function parseChallengeRoute(query: ChallengeSearchParams): ChallengeRoute | null {
  const version = optionalSingle(query.v);
  const resultProof = optionalSingle(query.r);
  const referral = optionalSingle(query.ref);
  if (version === undefined || resultProof === undefined || referral === undefined) return null;
  if (version !== null && version !== "2") return null;
  if (resultProof === "" || referral === "") return null;
  return {
    version: version === "2" ? 2 : 1,
    resultProof,
    referral,
  };
}

export function currentWeeklyChallengeHref(date = new Date()): string {
  return `/challenge/${weeklyDescentIdForDate(date)}?v=2`;
}

export function parsePlayRoute(legacy: string | string[] | undefined): "weekly" | "legacy" | null {
  if (legacy === undefined) return "weekly";
  if (legacy === "1") return "legacy";
  return null;
}

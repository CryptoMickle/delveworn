import { verifyWeeklyDescentProof, type VerifiedWeeklyDescentResult } from "./weekly";

type Store = () => Pick<Storage,"getItem" | "setItem">;
export const weeklyBestKey = (id: string) => `delveworn_weekly_v2_best:${id}`;
export const weeklyTargetKey = (id: string) => `delveworn_weekly_v2_target:${id}`;

/** Store proofs, never editable claimed scores. An unreadable target/best is
 * ignored but preserved, and cannot prevent ordinary local play. */
export async function loadWeeklyProgress(source: Store, id: string, kind: "best" | "target") {
  try {
    const proof=source().getItem(kind === "best" ? weeklyBestKey(id) : weeklyTargetKey(id));
    return proof ? await verifyWeeklyDescentProof(id,proof) : null;
  } catch { return null; }
}

export function loadWeeklyReferral(source: Store, verified: VerifiedWeeklyDescentResult | null): string | null {
  if (!verified) return null;
  try { return source().getItem(`${weeklyTargetKey(verified.result.challengeId)}:ref`) === verified.runId ? verified.runId : null; }
  catch { return null; }
}

export function saveWeeklyTarget(source: Store, verified: VerifiedWeeklyDescentResult, referral: string | null = null) {
  try {
    source().setItem(weeklyTargetKey(verified.result.challengeId),verified.proof);
    source().setItem(`${weeklyTargetKey(verified.result.challengeId)}:ref`,referral === verified.runId ? referral : "");
    return true;
  }
  catch { return false; }
}

export async function saveWeeklyBest(source: Store, verified: VerifiedWeeklyDescentResult) {
  const id=verified.result.challengeId, key=weeklyBestKey(id);
  try {
    // Verification yields to other tabs. Re-read before writing; a result that
    // arrived in the meantime must be compared before it can be replaced.
    for (let attempt=0;attempt<3;attempt++) {
      const previous=source().getItem(key);
      let best: VerifiedWeeklyDescentResult | null=null;
      if (previous) { try { best=await verifyWeeklyDescentProof(id,previous); } catch { /* Invalid local proof is not a score. */ } }
      if (source().getItem(key) !== previous) continue;
      if (best && best.result.score >= verified.result.score) return best;
      source().setItem(key,verified.proof);
      return verified;
    }
  } catch { /* Sharing and the verified result remain usable without storage. */ }
  return verified;
}

export function weeklyComparison(score: number, target: number) {
  return score > target ? `${(score-target).toLocaleString("en-US")} points ahead of your friend's result.`
    : score === target ? "You matched your friend's result."
      : `${(target-score).toLocaleString("en-US")} points to match your friend's result.`;
}

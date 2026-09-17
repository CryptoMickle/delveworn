import { phase, roomNumber } from "./model";
import { loadDescent } from "./storage";
import { loadWeeklyDescent } from "./weekly-storage";

export type DescentError = Error & { digest?: string };

export function redactDescentFailureMessage(error: DescentError): string {
  // Error text can contain the current URL. Keep diagnostics useful without
  // copying result proofs, referral codes or preview-access tokens.
  return `${error.name}: ${error.message}`.replace(
    /([?&])(r|ref|proof|_vercel_share)=[^&\s)]+/g,
    "$1$2=[removed]"
  );
}

function failureReport(error: DescentError, scope: string, progress: string, message = redactDescentFailureMessage(error)): string {
  return [scope, progress, message, error.digest ? `Error code: ${error.digest}` : ""]
    .filter(Boolean)
    .join("\n");
}

export function descentFailureReport(error: DescentError, source: Parameters<typeof loadDescent>[0]): string {
  const saved = loadDescent(source);
  const progress = saved.status === "restored"
    ? `Saved state: room ${roomNumber(saved.run)}, ${phase(saved.run)}, revision ${saved.run.revision}`
    : `Saved state: ${saved.status}`;
  // No run ID, seed, inventory, browsing history or automatic reporting.
  return failureReport(error, "Delveworn /play · loot-recovery-1", progress);
}

export function weeklyDescentFailureReport(
  error: DescentError,
  source: Parameters<typeof loadWeeklyDescent>[0],
  challengeId: string
): string {
  const saved = loadWeeklyDescent(source, challengeId);
  const progress = saved.status === "restored"
    ? `Saved state: ${phase(saved.run)}, revision ${saved.run.revision}`
    : `Saved state: ${saved.status}`;
  // The replay trace, run ID, seed, log, proof and URL query stay out of this report.
  const message = redactDescentFailureMessage(error).replace(/\?[^\s)]*/g, "?[query removed]");
  return failureReport(error, `Delveworn weekly challenge · ${challengeId || "unknown"} · recovery-2`, progress, message);
}

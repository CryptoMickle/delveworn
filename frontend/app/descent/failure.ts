import { phase, roomNumber } from "./model";
import { loadDescent } from "./storage";

export function descentFailureReport(error: Error & { digest?: string }, source: Parameters<typeof loadDescent>[0]): string {
  const saved = loadDescent(source);
  const progress = saved.status === "restored"
    ? `Saved state: room ${roomNumber(saved.run)}, ${phase(saved.run)}, revision ${saved.run.revision}`
    : `Saved state: ${saved.status}`;
  // No run ID, seed, inventory, browsing history or automatic reporting.
  // Strip the preview access token if a browser includes it in an error URL.
  const message = `${error.name}: ${error.message}`.replace(/([?&])_vercel_share=[^&\s)]+/g,"$1_vercel_share=[removed]");
  return ["Delveworn /play · loot-recovery-1",progress,message,error.digest ? `Error code: ${error.digest}` : ""].filter(Boolean).join("\n");
}

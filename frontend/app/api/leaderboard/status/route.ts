import { getLeaderboardBackend } from "../../../leaderboard/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  const { status } = getLeaderboardBackend();
  return Response.json({
    status: status.enabled ? "ready" : "unavailable",
    mode: status.mode,
    reason: status.reason,
  }, {
    status: status.enabled ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}

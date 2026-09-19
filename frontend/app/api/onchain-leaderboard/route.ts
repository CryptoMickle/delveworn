import {
  getOnchainLeaderboardSnapshot,
  onchainLeaderboardReply,
} from "../../onchain-leaderboard/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const snapshot = await getOnchainLeaderboardSnapshot();
    const requestedPlayer = new URL(request.url).searchParams.get("player");
    return Response.json(onchainLeaderboardReply(snapshot, requestedPlayer), {
      headers: { "cache-control": "public, max-age=10, s-maxage=20, stale-while-revalidate=120" },
    });
  } catch {
    return Response.json({
      code: "source_unavailable",
      message: "Somnia standings are temporarily unavailable. Your onchain run is unaffected.",
    }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}

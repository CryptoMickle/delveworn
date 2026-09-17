import { getLeaderboardBackend } from "../../../leaderboard/config";
import { handleLeaderboardGet, handleLeaderboardPost } from "../../../leaderboard/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ challengeId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const { challengeId } = await context.params;
  return handleLeaderboardGet(request, challengeId, getLeaderboardBackend());
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const { challengeId } = await context.params;
  return handleLeaderboardPost(request, challengeId, getLeaderboardBackend());
}

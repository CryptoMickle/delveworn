import { handleShapeWorld } from "./handler.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleShapeWorld(request);
}

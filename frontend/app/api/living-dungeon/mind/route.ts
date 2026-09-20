import { handleMind } from "../../../living-dungeon/mind/ai.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> { return handleMind(request); }

import {
  LIVING_DUNGEON_SHAPE_MAX_REQUEST_BYTES,
  parseShapeWorldRequest,
} from "../../../living-dungeon/improvisation-ai-contract";
import {
  interpretWorldShape,
  type ImprovisationAiOptions,
} from "../../../living-dungeon/improvisation-ai-interpreter.server";
import { getLivingDungeonAiAuthorizer } from "../../../living-dungeon/ai-rate-limit.server";
import { handleImprovisationHttpRequest } from "./http.server";

export type ShapeWorldHandlerOptions = ImprovisationAiOptions & Readonly<{
  requestBodyTimeoutMs?: number;
}>;

export async function handleShapeWorld(
  request: Request,
  options: ShapeWorldHandlerOptions = {},
): Promise<Response> {
  return handleImprovisationHttpRequest(request, {
    maximumBytes: LIVING_DUNGEON_SHAPE_MAX_REQUEST_BYTES,
    parse: parseShapeWorldRequest,
    requestBodyTimeoutMs: options.requestBodyTimeoutMs,
    execute: (parsed) => interpretWorldShape(parsed, {
      env: options.env,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      authorizeProviderCall: options.authorizeProviderCall
        ?? (() => getLivingDungeonAiAuthorizer()(request)),
    }),
  });
}

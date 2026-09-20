import {
  LIVING_DUNGEON_PLAN_MAX_REQUEST_BYTES,
  parsePlanImprovisationRequest,
} from "../../../living-dungeon/improvisation-ai-contract";
import {
  interpretImprovisationPlan,
  type ImprovisationAiOptions,
} from "../../../living-dungeon/improvisation-ai-interpreter.server";
import { getLivingDungeonAiAuthorizer } from "../../../living-dungeon/ai-rate-limit.server";
import { handleImprovisationHttpRequest } from "../shape/http.server";

export type PlanImprovisationHandlerOptions = ImprovisationAiOptions & Readonly<{
  requestBodyTimeoutMs?: number;
}>;

export async function handleImprovisationPlan(
  request: Request,
  options: PlanImprovisationHandlerOptions = {},
): Promise<Response> {
  return handleImprovisationHttpRequest(request, {
    maximumBytes: LIVING_DUNGEON_PLAN_MAX_REQUEST_BYTES,
    parse: parsePlanImprovisationRequest,
    requestBodyTimeoutMs: options.requestBodyTimeoutMs,
    execute: (parsed) => interpretImprovisationPlan(parsed, {
      env: options.env,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      authorizeProviderCall: options.authorizeProviderCall
        ?? (() => getLivingDungeonAiAuthorizer()(request)),
    }),
  });
}

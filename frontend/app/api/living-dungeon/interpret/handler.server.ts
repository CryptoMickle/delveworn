import {
  LIVING_DUNGEON_INTERPRET_MAX_REQUEST_BYTES,
  PactIntentRequestError,
  parseInterpretPactIntentRequest,
  type InterpretPactIntentErrorReply,
} from "../../../living-dungeon/ai-contract";
import {
  interpretPactIntent,
  type InterpretPactIntentOptions,
} from "../../../living-dungeon/ai-interpreter.server";
import { getLivingDungeonAiAuthorizer } from "../../../living-dungeon/ai-rate-limit.server";

const REQUEST_BODY_TIMEOUT_MS = 1_000;

type InterpretHandlerOptions = InterpretPactIntentOptions & Readonly<{
  requestBodyTimeoutMs?: number;
}>;

type BoundedBodyResult =
  | Readonly<{ status: "ok"; text: string }>
  | Readonly<{ status: "too_large" | "timeout" | "unreadable" }>;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function invalid(
  code: InterpretPactIntentErrorReply["code"],
  message: string,
  status: number,
): Response {
  return json({ status: "invalid_request", code, message } satisfies InterpretPactIntentErrorReply, status);
}

function originForHost(protocol: string, host: string | null): string | null {
  if (!host || (protocol !== "http:" && protocol !== "https:")) return null;
  try {
    const parsed = new URL(`${protocol}//${host}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/"
      || parsed.search || parsed.hash || parsed.host !== host) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host")?.trim() ?? null;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")
    ?.split(",", 1)[0]?.trim().toLowerCase();
  const accepted = new Set<string>([requestUrl.origin]);
  const hostOrigin = originForHost(requestUrl.protocol, host);
  if (hostOrigin) accepted.add(hostOrigin);
  const forwardedOrigin = originForHost(`${forwardedProtocol}:`, host);
  if (forwardedOrigin) accepted.add(forwardedOrigin);
  return accepted.has(origin);
}

async function readBoundedBody(
  request: Request,
  timeoutMs: number,
): Promise<BoundedBodyResult> {
  if (!request.body) return { status: "ok", text: "" };
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return { status: "unreadable" };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<BoundedBodyResult>((resolve) => {
    timeout = setTimeout(() => {
      void reader.cancel().catch(() => undefined);
      resolve({ status: "timeout" });
    }, Math.max(1, Math.min(REQUEST_BODY_TIMEOUT_MS, Math.trunc(timeoutMs))));
  });
  const read = (async (): Promise<BoundedBodyResult> => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > LIVING_DUNGEON_INTERPRET_MAX_REQUEST_BYTES) {
          void reader.cancel().catch(() => undefined);
          return { status: "too_large" };
        }
        chunks.push(value);
      }
      const body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { status: "ok", text: new TextDecoder().decode(body) };
    } catch {
      return { status: "unreadable" };
    }
  })();
  try {
    return await Promise.race([read, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function handleLivingDungeonInterpret(
  request: Request,
  options: InterpretHandlerOptions = {},
): Promise<Response> {
  if (!sameOrigin(request)) {
    return invalid("origin", "The pact request must come from this Delveworn site.", 403);
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return invalid("content_type", "The pact request must use application/json.", 415);
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength)
    && Number(declaredLength) > LIVING_DUNGEON_INTERPRET_MAX_REQUEST_BYTES) {
    return invalid("request_too_large", "The pact request is too large.", 413);
  }

  const bodyResult = await readBoundedBody(
    request,
    options.requestBodyTimeoutMs ?? REQUEST_BODY_TIMEOUT_MS,
  );
  if (bodyResult.status !== "ok") {
    if (bodyResult.status === "too_large") {
      return invalid("request_too_large", "The pact request is too large.", 413);
    }
    if (bodyResult.status === "timeout") {
      return invalid("request_timeout", "The pact request did not finish in time.", 408);
    }
    return invalid("malformed_json", "The pact request could not be read.", 400);
  }
  const bodyText = bodyResult.text;

  let body: unknown;
  try {
    body = JSON.parse(bodyText) as unknown;
  } catch {
    return invalid("malformed_json", "The pact request must contain valid JSON.", 400);
  }

  let parsed;
  try {
    parsed = parseInterpretPactIntentRequest(body);
  } catch (error) {
    if (error instanceof PactIntentRequestError) return invalid(error.code, error.message, 400);
    return invalid("invalid_body", "The pact request could not be processed.", 400);
  }
  return json(await interpretPactIntent(parsed, {
    env: options.env,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    authorizeProviderCall: options.authorizeProviderCall
      ?? (() => getLivingDungeonAiAuthorizer()(request)),
  }));
}

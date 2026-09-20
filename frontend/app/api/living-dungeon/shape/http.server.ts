import {
  ImprovisationRequestError,
  type ImprovisationRequestErrorReply,
} from "../../../living-dungeon/improvisation-ai-contract";

const REQUEST_BODY_TIMEOUT_MS = 1_000;

type BoundedBodyResult =
  | Readonly<{ status: "ok"; text: string }>
  | Readonly<{ status: "too_large" | "timeout" | "unreadable" }>;

export type ImprovisationHttpOptions<TRequest, TReply> = Readonly<{
  maximumBytes: number;
  parse: (body: unknown) => TRequest;
  execute: (request: TRequest) => Promise<TReply>;
  requestBodyTimeoutMs?: number;
}>;

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
  code: ImprovisationRequestErrorReply["code"],
  message: string,
  status: number,
): Response {
  return json({ status: "invalid_request", code, message } satisfies ImprovisationRequestErrorReply, status);
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
  maximumBytes: number,
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
        if (total > maximumBytes) {
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

export async function handleImprovisationHttpRequest<TRequest, TReply>(
  request: Request,
  options: ImprovisationHttpOptions<TRequest, TReply>,
): Promise<Response> {
  if (!sameOrigin(request)) {
    return invalid("origin", "The request must come from this Delveworn site.", 403);
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return invalid("content_type", "The request must use application/json.", 415);
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > options.maximumBytes) {
    return invalid("request_too_large", "The request is too large.", 413);
  }

  const bodyResult = await readBoundedBody(
    request,
    options.maximumBytes,
    options.requestBodyTimeoutMs ?? REQUEST_BODY_TIMEOUT_MS,
  );
  if (bodyResult.status !== "ok") {
    if (bodyResult.status === "too_large") {
      return invalid("request_too_large", "The request is too large.", 413);
    }
    if (bodyResult.status === "timeout") {
      return invalid("request_timeout", "The request did not finish in time.", 408);
    }
    return invalid("malformed_json", "The request could not be read.", 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyResult.text) as unknown;
  } catch {
    return invalid("malformed_json", "The request must contain valid JSON.", 400);
  }
  let parsed: TRequest;
  try {
    parsed = options.parse(body);
  } catch (error) {
    if (error instanceof ImprovisationRequestError) return invalid(error.code, error.message, 400);
    return invalid("invalid_body", "The request could not be processed.", 400);
  }
  return json(await options.execute(parsed));
}

export const improvisationHttpInternals = { sameOrigin };

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  WEEKLY_DESCENT_MAX_PROOF_LENGTH,
  getWeeklyDescentDefinition,
  verifyWeeklyDescentProof,
  weeklyDescentIdForDate,
} from "../descent/weekly";
import {
  LEADERBOARD_MAX_REQUEST_BYTES,
  LEADERBOARD_SUBMIT_LIMIT,
  LEADERBOARD_SUBMIT_WINDOW_SECONDS,
  LeaderboardInputError,
  leaderboardMemberId,
  normalizeLeaderboardNickname,
  publicLeaderboardRows,
  weeklyLeaderboardKey,
  type LeaderboardSnapshot,
  type StoredLeaderboardEntry,
} from "./core";
import type { LeaderboardBackend } from "./config";

export const LEADERBOARD_GUEST_COOKIE = "dw_weekly_guest_v1";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type HandlerOptions = {
  now?: () => Date;
};

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...Object.fromEntries(new Headers(headers).entries()),
    },
  });
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

function signatureFor(guestId: string, secret: string): string {
  return createHmac("sha256", secret).update(`delveworn-leaderboard:${guestId}`).digest("hex");
}

function validSignature(actual: string, expected: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function leaderboardGuest(request: Request, secret: string): {
  guestId: string;
  setCookie: string | null;
} {
  const supplied = cookieValue(request, LEADERBOARD_GUEST_COOKIE);
  if (supplied) {
    const [guestId, signature, extra] = supplied.split(".");
    if (!extra && /^[0-9a-f]{32}$/.test(guestId ?? "")
      && validSignature(signature ?? "", signatureFor(guestId, secret))) {
      return { guestId, setCookie: null };
    }
  }
  const guestId = randomBytes(16).toString("hex");
  const value = `${guestId}.${signatureFor(guestId, secret)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    guestId,
    setCookie: `${LEADERBOARD_GUEST_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Strict${secure}`,
  };
}

function backendUnavailable(backend: LeaderboardBackend): Response {
  return json({
    status: "unavailable",
    reason: backend.status.reason,
  }, 503);
}

function withGuestCookie(response: Response, setCookie: string | null): Response {
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
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

function publicEntryId(challengeId: string, guestId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`delveworn-leaderboard-entry:v2:${challengeId}:${guestId}`)
    .digest("hex")
    .slice(0, 24);
}

function currentWindow(challengeId: string, now: Date): "current" | "past" | "future" | "invalid" {
  const definition = getWeeklyDescentDefinition(challengeId);
  if (!definition) return "invalid";
  if (challengeId === weeklyDescentIdForDate(now)
    && now.getTime() >= Date.parse(definition.startsAt)
    && now.getTime() < Date.parse(definition.endsAt)) return "current";
  return now.getTime() >= Date.parse(definition.endsAt) ? "past" : "future";
}

async function snapshot(
  backend: LeaderboardBackend,
  challengeId: string,
  guestId: string,
  archived: boolean
): Promise<LeaderboardSnapshot> {
  if (!backend.store) throw new Error("Leaderboard storage is unavailable.");
  const window = await backend.store.getWindow(weeklyLeaderboardKey(challengeId), guestId);
  return {
    status: "ready",
    challengeId,
    rulesVersion: 2,
    archived,
    developmentOnly: backend.status.mode === "local",
    totalEntries: window.totalEntries,
    rows: publicLeaderboardRows(window.entries, guestId),
  };
}

export async function handleLeaderboardGet(
  request: Request,
  challengeId: string,
  backend: LeaderboardBackend,
  options: HandlerOptions = {}
): Promise<Response> {
  if (!backend.status.enabled || !backend.store || !backend.cookieSecret) return backendUnavailable(backend);
  const now = (options.now ?? (() => new Date()))();
  const window = currentWindow(challengeId, now);
  if (window === "invalid") return json({ status: "error", code: "invalid_challenge" }, 404);
  if (window === "future") return json({ status: "error", code: "future_challenge" }, 404);
  const guest = leaderboardGuest(request, backend.cookieSecret);
  try {
    return withGuestCookie(
      json(await snapshot(backend, challengeId, guest.guestId, window === "past")),
      guest.setCookie
    );
  } catch {
    return withGuestCookie(json({ status: "unavailable", reason: "storage_error" }, 503), guest.setCookie);
  }
}

function requesterKey(request: Request, secret: string): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = (forwarded || "unknown").slice(0, 80);
  return createHmac("sha256", secret).update(address).digest("hex").slice(0, 24);
}

async function parseSubmission(request: Request): Promise<{ proof: string; nickname: unknown }> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new LeaderboardInputError("content_type", "The submission must use JSON.");
  }
  const announcedLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(announcedLength) && announcedLength > LEADERBOARD_MAX_REQUEST_BYTES) {
    throw new LeaderboardInputError("request_size", "The submission is too large.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > LEADERBOARD_MAX_REQUEST_BYTES) {
    throw new LeaderboardInputError("request_size", "The submission is too large.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new LeaderboardInputError("invalid_json", "The submission is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new LeaderboardInputError("invalid_schema", "The submission has an invalid schema.");
  }
  const record = parsed as Record<string, unknown>;
  if (!Object.keys(record).every(key => key === "proof" || key === "nickname")
    || typeof record.proof !== "string"
    || record.proof.length === 0
    || record.proof.length > WEEKLY_DESCENT_MAX_PROOF_LENGTH) {
    throw new LeaderboardInputError("invalid_schema", "The submission has an invalid schema.");
  }
  return { proof: record.proof, nickname: record.nickname };
}

export async function handleLeaderboardPost(
  request: Request,
  challengeId: string,
  backend: LeaderboardBackend,
  options: HandlerOptions = {}
): Promise<Response> {
  if (!backend.status.enabled || !backend.store || !backend.cookieSecret) return backendUnavailable(backend);
  if (!sameOrigin(request)) return json({ status: "error", code: "origin" }, 403);
  const now = (options.now ?? (() => new Date()))();
  if (currentWindow(challengeId, now) !== "current") {
    return json({ status: "error", code: "archive_read_only" }, 409);
  }
  const guest = leaderboardGuest(request, backend.cookieSecret);
  if (guest.setCookie) {
    return withGuestCookie(json({ status: "error", code: "guest_cookie_required" }, 428), guest.setCookie);
  }
  try {
    const [guestAllowed, addressAllowed] = await Promise.all([
      backend.store.consumeRateLimit(
        `guest:${guest.guestId}`,
        LEADERBOARD_SUBMIT_LIMIT,
        LEADERBOARD_SUBMIT_WINDOW_SECONDS
      ),
      backend.store.consumeRateLimit(
        `address:${requesterKey(request, backend.cookieSecret)}`,
        LEADERBOARD_SUBMIT_LIMIT * 5,
        LEADERBOARD_SUBMIT_WINDOW_SECONDS
      ),
    ]);
    if (!guestAllowed || !addressAllowed) {
      return withGuestCookie(json({ status: "error", code: "rate_limit" }, 429, {
        "retry-after": String(LEADERBOARD_SUBMIT_WINDOW_SECONDS),
      }), guest.setCookie);
    }

    const submission = await parseSubmission(request);
    const nickname = normalizeLeaderboardNickname(submission.nickname);
    const verified = await verifyWeeklyDescentProof(challengeId, submission.proof);
    const achievedAt = now.toISOString();
    const entryId = publicEntryId(challengeId, guest.guestId, backend.cookieSecret);
    const entry: StoredLeaderboardEntry = {
      guestId: guest.guestId,
      memberId: leaderboardMemberId(achievedAt, entryId, guest.guestId),
      entryId,
      nickname: nickname.nickname,
      nicknameHidden: nickname.nicknameHidden,
      achievedAt,
      result: verified.result,
      proof: verified.proof,
    };
    const update = await backend.store.submitBest(weeklyLeaderboardKey(challengeId), guest.guestId, entry);
    if (update.status === "full") {
      return withGuestCookie(json({ status: "unavailable", reason: "capacity" }, 503), guest.setCookie);
    }
    const board = await snapshot(backend, challengeId, guest.guestId, false);
    return withGuestCookie(json({
      ...board,
      submission: {
        status: update.status,
        entryId: update.entry?.entryId ?? entryId,
        score: update.entry?.result.score ?? verified.result.score,
      },
    }), guest.setCookie);
  } catch (error) {
    if (error instanceof LeaderboardInputError) {
      return withGuestCookie(json(
        { status: "error", code: error.code, message: error.message },
        error.code === "request_size" ? 413 : 400
      ), guest.setCookie);
    }
    if (error instanceof Error && error.name === "WeeklyDescentProofError") {
      return withGuestCookie(json({ status: "error", code: "invalid_proof" }, 400), guest.setCookie);
    }
    return withGuestCookie(json({ status: "unavailable", reason: "storage_error" }, 503), guest.setCookie);
  }
}

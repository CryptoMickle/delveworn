"use client";

import { track } from "@vercel/analytics/react";
import { CHALLENGE_RULES_VERSION } from "./core";

export type ChallengeAnalyticsEvent =
  | "challenge_started"
  | "challenge_completed"
  | "challenge_shared"
  | "challenge_referral_visit"
  | "challenge_referral_completed"
  | "challenge_return_visit"
  | "challenge_abandoned"
  | "challenge_error";

type StorageReaderWriter = Pick<Storage, "getItem" | "setItem">;

const LAST_CHALLENGE_KEY = "delveworn_weekly_last_challenge_v1";
const STARTED_PREFIX = "delveworn_weekly_started_v1:";
const COMPLETED_PREFIX = "delveworn_weekly_completed_v1:";

export function registerChallengeStart(
  storage: StorageReaderWriter,
  challengeId: string
): { uniqueStart: boolean; returnVisit: boolean } {
  try {
    const previous = storage.getItem(LAST_CHALLENGE_KEY);
    const startKey = `${STARTED_PREFIX}${challengeId}`;
    const uniqueStart = storage.getItem(startKey) !== "1";
    if (uniqueStart) storage.setItem(startKey, "1");
    storage.setItem(LAST_CHALLENGE_KEY, challengeId);
    return {
      uniqueStart,
      returnVisit: Boolean(previous && previous !== challengeId),
    };
  } catch {
    return { uniqueStart: true, returnVisit: false };
  }
}

export function registerChallengeCompletion(
  storage: StorageReaderWriter,
  challengeId: string,
  runId: string
): boolean {
  try {
    const completionKey = `${COMPLETED_PREFIX}${challengeId}:${runId}`;
    if (storage.getItem(completionKey) === "1") return false;
    storage.setItem(completionKey, "1");
    return true;
  } catch {
    return true;
  }
}

export function trackChallenge(
  event: ChallengeAnalyticsEvent,
  challengeId: string,
  properties: Record<string, string | number | boolean | null> = {}
): void {
  try {
    track(event, {
      challenge_id: challengeId,
      rules_version: CHALLENGE_RULES_VERSION,
      ...properties,
    });
  } catch {
    // Measurement is optional and never blocks the game.
  }
}

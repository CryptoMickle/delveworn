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
  | "challenge_error"
  | "challenge_retry"
  | "challenge_resumed"
  | "challenge_practice_continued"
  | "challenge_home_started";

type StorageReaderWriter = Pick<Storage, "getItem" | "setItem">;

export type ChallengeAnalyticsNamespace = "v1" | "v2";

const MARKER_KEYS: Record<ChallengeAnalyticsNamespace, {
  lastChallenge: string;
  startedPrefix: string;
  completedPrefix: string;
}> = {
  v1: {
    lastChallenge: "delveworn_weekly_last_challenge_v1",
    startedPrefix: "delveworn_weekly_started_v1:",
    completedPrefix: "delveworn_weekly_completed_v1:",
  },
  v2: {
    lastChallenge: "delveworn_weekly_last_challenge_v2",
    startedPrefix: "delveworn_weekly_started_v2:",
    completedPrefix: "delveworn_weekly_completed_v2:",
  },
};

export function registerChallengeStart(
  storage: StorageReaderWriter,
  challengeId: string,
  namespace: ChallengeAnalyticsNamespace = "v1"
): { uniqueStart: boolean; returnVisit: boolean } {
  try {
    const keys = MARKER_KEYS[namespace];
    const previous = storage.getItem(keys.lastChallenge);
    const startKey = `${keys.startedPrefix}${challengeId}`;
    const uniqueStart = storage.getItem(startKey) !== "1";
    if (uniqueStart) storage.setItem(startKey, "1");
    storage.setItem(keys.lastChallenge, challengeId);
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
  runId: string,
  namespace: ChallengeAnalyticsNamespace = "v1"
): boolean {
  try {
    const completionKey = `${MARKER_KEYS[namespace].completedPrefix}${challengeId}:${runId}`;
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

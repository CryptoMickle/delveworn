"use client";

import { registerChallengeCompletion, registerChallengeStart, trackChallenge } from "../challenge/analytics";

export function recordWeeklyStart(id: string) {
  try {
    // V2 attempts must not consume or collide with the archived V1 markers.
    const registered = registerChallengeStart(window.localStorage,id,"v2");
    if (registered.uniqueStart) trackChallenge("challenge_started",id,{rules_version:2});
    if (registered.returnVisit) trackChallenge("challenge_return_visit",id,{rules_version:2});
  } catch { /* Optional measurement never gates a run. */ }
}

export function recordWeeklyCompletion(id: string, runId: string, outcome: string, rooms: number, referral: string | null) {
  try {
    if (registerChallengeCompletion(window.localStorage,id,runId,"v2")) {
      trackChallenge("challenge_completed",id,{rules_version:2,outcome,rooms});
      if (referral) trackChallenge("challenge_referral_completed",id,{rules_version:2,outcome,rooms});
    }
  } catch { /* Storage may be blocked; the result still belongs to the player. */ }
}

export function recordWeeklyPracticeContinuation(id: string) {
  try {
    trackChallenge("challenge_practice_continued",id,{rules_version:2});
  } catch { /* Optional measurement never gates the Practice import. */ }
}

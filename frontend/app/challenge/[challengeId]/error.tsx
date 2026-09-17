"use client";

import { DescentFailureBoundary } from "../../descent/failure-boundary";
import { weeklyDescentFailureReport } from "../../descent/failure";

function currentChallengeId(): string {
  const match = /^\/challenge\/(\d{4}-W\d{2})\/?$/.exec(window.location.pathname);
  return match?.[1] ?? "";
}

export default function ChallengeError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <DescentFailureBoundary
    error={error}
    retry={retry}
    createReport={caught => weeklyDescentFailureReport(caught,() => window.localStorage,currentChallengeId())}
    title="The weekly dungeon was interrupted."
  />;
}

"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import type { Descent } from "./model";
import { createPracticeHandoff, savePracticeHandoff } from "./practice-handoff";

export function PracticeContinuation({ run }: { run: Descent }) {
  const handoff = createPracticeHandoff(run);
  const [status, setStatus] = useState<"idle" | "saving" | "unavailable" | "conflict">("idle");

  if (!handoff) return null;

  const href = `/practice?continue=${encodeURIComponent(handoff.id)}`;
  const continueToPractice = (event: MouseEvent<HTMLAnchorElement>) => {
    if (status === "saving") {
      event.preventDefault();
      return;
    }
    setStatus("saving");
    let saved: ReturnType<typeof savePracticeHandoff>;
    try {
      saved = savePracticeHandoff(window.localStorage, handoff);
    } catch {
      event.preventDefault();
      setStatus("unavailable");
      return;
    }
    if (saved === "saved" || saved === "exists") {
      return;
    }
    event.preventDefault();
    setStatus(saved === "unavailable" ? "unavailable" : "conflict");
  };

  return (
    <section className="descent-result" aria-label="Continue in Endless Practice">
      <p className="descent-kicker">YOUR RELIC CONTINUES</p>
      <h2>Room 11 is waiting.</h2>
      <p>
        Carry this run&apos;s HP, supplies, equipment and relic into Endless Practice.
        Your completed First Descent stays here.
      </p>
      <div className="descent-result-actions" data-keyboard-actions>
        <Link
          href={href}
          onClick={continueToPractice}
          aria-disabled={status === "saving"}
          data-keyboard-default="true"
          className="descent-practice-continuation-link"
        >
          {status === "saving" ? "Preparing Practice…" : "Continue to Room 11 in Practice"}
        </Link>
      </div>
      <p className="descent-subtle">
        If you already have a Practice run, you can review it before choosing whether to replace it.
      </p>
      {status === "unavailable" && (
        <p role="alert">Browser storage is unavailable, so this continuation could not be saved. Your completed descent is unchanged.</p>
      )}
      {status === "conflict" && (
        <p role="alert">A different continuation record already uses this run ID. Nothing was replaced.</p>
      )}
    </section>
  );
}

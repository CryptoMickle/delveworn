"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DesktopNavigation } from "../desktop-navigation";
import { GameLogo } from "../game-logo";
import { trackChallenge } from "../challenge/analytics";
import DescentGame from "./game";
import { verifyWeeklyDescentProof, type VerifiedWeeklyDescentResult, type WeeklyDescentDefinition } from "./weekly";
import { loadWeeklyProgress, loadWeeklyReferral, saveWeeklyTarget } from "./weekly-progress";
import { WeeklyResultCard } from "./weekly-result";
import "./weekly.css";

export default function WeeklyDescentClient({ definition, resultProof, referral, onchainNetwork }: {
  definition: WeeklyDescentDefinition;
  resultProof: string | null;
  referral: string | null;
  onchainNetwork: string | null;
}) {
  const [target,setTarget]=useState<VerifiedWeeklyDescentResult | null>(null);
  const [verifiedReferral,setVerifiedReferral]=useState<string | null>(null);
  const [invalid,setInvalid]=useState(false);
  const [dismissed,setDismissed]=useState(false);
  useEffect(() => {
    let cancelled=false;
    void (async () => {
      const checked=resultProof !== null ? await verifyWeeklyDescentProof(definition.id,resultProof)
        : await loadWeeklyProgress(() => window.localStorage,definition.id,"target");
      if (cancelled) return;
      setTarget(checked);
      setVerifiedReferral(resultProof !== null ? (checked && referral === checked.runId ? referral : null) : loadWeeklyReferral(() => window.localStorage,checked));
      if (resultProof !== null && checked && referral === checked.runId) {
        trackChallenge("challenge_referral_visit",definition.id,{rules_version:2});
      }
    })().catch(() => { if (!cancelled) setInvalid(true); });
    return () => { cancelled=true; };
  },[definition.id,resultProof,referral]);

  function playSharedChallenge() {
    if (!target) return;
    saveWeeklyTarget(() => window.localStorage,target,verifiedReferral);
    // Preserve a prior run. The game's resume/start-again choices own that save.
    window.history.replaceState(null,"",`/challenge/${definition.id}?v=2`);
    setDismissed(true);
  }

  if (resultProof !== null && !dismissed) return <main className="descent-shell weekly-shared-page">
    <header className="descent-header"><DesktopNavigation /><GameLogo /><span className="descent-edition">WEEKLY CHALLENGE</span></header>
    <section className="descent-result weekly-shared-result" data-keyboard-action-scope>
      {invalid ? <><h1>This result could not be verified.</h1><p>The link is incomplete, changed, or belongs to different rules. No score has been accepted.</p><Link href={`/challenge/${definition.id}?v=2`}>Play this challenge</Link></>
        : target ? <WeeklyResultCard verified={target} incoming onPlay={playSharedChallenge} />
          : <p role="status">Checking the shared result…</p>}
    </section>
  </main>;
  return <DescentGame weeklyDefinition={definition} referral={verifiedReferral} friendScore={target?.result.score} onchainNetwork={onchainNetwork} />;
}

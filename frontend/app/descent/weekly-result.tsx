"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createWeeklyDescentProof, weeklyDescentShareUrl, type WeeklyDescent, type VerifiedWeeklyDescentResult } from "./weekly";
import { loadWeeklyProgress, saveWeeklyBest, weeklyComparison } from "./weekly-progress";
import { recordWeeklyCompletion } from "./weekly-analytics";
import { WeeklyLeaderboard } from "../leaderboard/weekly-leaderboard";
import { PracticeContinuation } from "./practice-continuation";
import { trackChallenge } from "../challenge/analytics";

export function WeeklyResultCard({ verified, incoming = false, onPlay, onchainNetwork = null, best, target }: {
  verified: VerifiedWeeklyDescentResult;
  incoming?: boolean;
  onPlay: () => void;
  onchainNetwork?: string | null;
  best?: number;
  target?: number;
}) {
  const [notice,setNotice]=useState("");
  const [fallback,setFallback]=useState("");
  const [sharing,setSharing]=useState(false);
  const result=verified.result;
  async function share(copyOnly = false) {
    if (sharing) return;
    setSharing(true); setNotice("");
    const url=weeklyDescentShareUrl(window.location.origin,verified);
    // Keep a selectable link available even if a native sheet or clipboard
    // permission prompt stays open. Sharing must not hold the result hostage.
    setFallback(url);
    const text=`I scored ${result.score.toLocaleString("en-US")} in Delveworn ${result.challengeId}. Try to beat this in Weekly Challenge: The First Descent!`;
    try {
      const native=!copyOnly && typeof navigator.share === "function";
      if (native) await navigator.share({title:"Delveworn Weekly Challenge",text,url});
      else await navigator.clipboard.writeText(`${text}\n${url}`);
      setNotice(native ? "Result shared." : "Challenge link copied.");
      trackChallenge("challenge_shared",result.challengeId,{rules_version:2,channel:native ? "native" : "clipboard",outcome:result.outcome});
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFallback(url); setNotice("Copy this link to share your result.");
      }
    } finally { setSharing(false); }
  }
  return <div className="weekly-result" aria-label="Verified weekly result">
    <p className="descent-kicker">{incoming ? "YOUR FRIEND'S RESULT" : "YOUR WEEKLY RESULT"} · {result.challengeId}</p>
    <h2>{result.score.toLocaleString("en-US")} points</h2>
    <p className="weekly-verified">✓ Verified by replay</p>
    <p>{result.outcome === "cleared" ? "Ten rooms cleared. Management has been replaced." : `${result.roomsCleared} / 10 rooms cleared. The dungeon is hiring again.`}</p>
    {best !== undefined && <p>Personal best: <strong>{best.toLocaleString("en-US")}</strong></p>}
    {target !== undefined && <p>{weeklyComparison(result.score,target)}</p>}
    <dl><div><dt>Rooms cleared</dt><dd>{result.roomsCleared} / 10</dd></div><div><dt>HP left</dt><dd>{result.hp}</dd></div><div><dt>Gold</dt><dd>{result.gold}</dd></div><div><dt>Potions</dt><dd>{result.potions}</dd></div></dl>
    <div className="descent-result-actions" data-keyboard-actions>
      <button data-keyboard-default="true" onClick={incoming ? onPlay : () => void share()} disabled={!incoming && sharing}>{incoming ? "Try to beat this" : sharing ? "Sharing… · link below" : "Share verified result"}</button>
      <button onClick={incoming ? () => void share() : onPlay} disabled={incoming && sharing}>{incoming ? "Share this result" : "Try the same challenge again"}</button>
      <button className="weekly-copy-button" onClick={() => void share(true)} disabled={sharing}>Copy result link</button>
    </div>
    {notice && <p role="status">{notice}</p>}
    {fallback && <textarea className="weekly-share-link" aria-label="Verified result link" readOnly value={fallback} onFocus={event => event.currentTarget.select()} />}
    <details className="weekly-proof-details"><summary>Rules and result check</summary>
      <p>Rules v2 · {result.challengeId}. Every player starts with the same seed and kit. The result is rebuilt from {result.actionCount} legal actions, including loot collection and bypass.</p>
      <p>Rooms × 10,000; clearing all ten +5,000; HP × 20; gold × 5; potions × 100; equipment levels × 250; combat turns −10 each. Walking and reading take no points.</p>
      <p>Replay checks the game rules. It does not prove a unique human player or prevent someone copying a shared strategy. No prizes.</p>
    </details>
    {!incoming && onchainNetwork && <Link href="/onchain">Play on {onchainNetwork} →</Link>}
  </div>;
}

export function WeeklyRunResult({ run, onPlay, onchainNetwork, referral }: {
  run: WeeklyDescent; onPlay: () => void; onchainNetwork: string | null; referral: string | null;
}) {
  const [checked,setChecked]=useState<{revision:number;verified:VerifiedWeeklyDescentResult;best:number;target?:number} | null>(null);
  const [error,setError]=useState(false);
  useEffect(() => {
    let cancelled=false;
    void (async () => {
      const verified=await createWeeklyDescentProof(run);
      const [best,target]=await Promise.all([saveWeeklyBest(() => window.localStorage,verified),loadWeeklyProgress(() => window.localStorage,run.weekly.challengeId,"target")]);
      if (cancelled) return;
      setChecked({revision:run.revision,verified,best:best.result.score,target:target?.result.score});
      recordWeeklyCompletion(verified.result.challengeId,verified.runId,verified.result.outcome,verified.result.roomsCleared,referral);
    })().catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled=true; };
  },[run,referral]);
  if (error) return <p role="alert">The result could not be verified. Your saved run is preserved. Reload to retry.</p>;
  if (!checked || checked.revision !== run.revision) return <p role="status">Checking your result…</p>;
  return <>
    <WeeklyResultCard verified={checked.verified} onPlay={onPlay} onchainNetwork={onchainNetwork} best={checked.best} target={checked.target} />
    <PracticeContinuation run={run} />
    <WeeklyLeaderboard challengeId={run.weekly.challengeId} proof={checked.verified.proof} personalBest={checked.best} friendScore={checked.target} />
  </>;
}

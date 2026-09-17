"use client";

import Link from "next/link";
import { useState } from "react";
import { redactDescentFailureMessage, type DescentError } from "./failure";
import "./game.css";

export function DescentFailureBoundary({
  error,
  retry,
  createReport,
  title = "The dungeon was interrupted.",
}: {
  error: DescentError;
  retry: () => void;
  createReport: (error: DescentError) => string;
  title?: string;
}) {
  const [report,setReport] = useState("");
  const [copyState,setCopyState] = useState<"idle" | "copied" | "fallback">("idle");

  async function copyReport() {
    const text=createReport(error);
    setReport(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("fallback");
    }
  }

  return <main className="descent-shell"><section className="descent-entrance" style={{maxWidth:560}}>
    <p className="descent-kicker">DELVEWORN</p>
    <h1>{title}</h1>
    <p>Try resuming from your last save. Resuming does not start a new run or replace saved progress.</p>
    <div className="descent-result-actions">
      <button onClick={retry} style={{minHeight:48,padding:12,background:"#f97316",color:"#241006",borderRadius:8}}>Resume saved run</button>
      <button onClick={() => void copyReport()} style={{minHeight:48,padding:12,background:"#25192d",color:"#f1ddfa",borderRadius:8}}>{copyState === "copied" ? "Error report copied" : "Copy error report"}</button>
    </div>
    <details open={copyState === "fallback"} style={{marginTop:20}}><summary>Error details</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{report || redactDescentFailureMessage(error)}</pre></details>
    {copyState === "fallback" && <textarea aria-label="Error report to copy" readOnly value={report} onFocus={event => event.currentTarget.select()} style={{width:"100%",minHeight:140,marginTop:12,padding:10,background:"#17121e",color:"#f1ddfa",border:"1px solid #725b7d"}} />}
    <p className="descent-subtle">The report stays on this device unless you choose to share it.</p>
    <Link href="/practice">Endless Practice</Link>
  </section></main>;
}

"use client";

import { useState } from "react";
import { descentFailureReport } from "../descent/failure";
import "../descent/game.css";

export default function PlayError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [report,setReport] = useState("");
  const [copied,setCopied] = useState(false);
  async function copyReport() {
    const text=descentFailureReport(error,() => window.localStorage);
    setReport(text);
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setCopied(false); }
  }
  return <main className="descent-shell"><section className="descent-entrance" style={{maxWidth:560}}>
    <p className="descent-kicker">DELVEWORN</p>
    <h1>The dungeon was interrupted.</h1>
    <p>Try resuming from your last save. Resuming does not start a new run or replace saved progress.</p>
    <div className="descent-result-actions">
      <button onClick={retry} style={{minHeight:48,padding:12,background:"#f97316",color:"#241006",borderRadius:8}}>Resume saved run</button>
      <button onClick={() => void copyReport()} style={{minHeight:48,padding:12,background:"#25192d",color:"#f1ddfa",borderRadius:8}}>{copied ? "Error report copied" : "Copy error report"}</button>
    </div>
    <details style={{marginTop:20}}><summary>Error details</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{report || `${error.name}: ${error.message}`}</pre></details>
    <p className="descent-subtle">The report stays on this device unless you choose to share it.</p>
    <a href="/practice">Classic Practice</a>
  </section></main>;
}

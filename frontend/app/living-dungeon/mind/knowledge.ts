import { THEORY_COPY } from "./catalogue";
import { witnessName } from "./identities";
import type { Fact, Hypothesis, Run, Signature } from "./types";
import { canSee, entity } from "./world";

type FactDraft = Omit<Fact, "id" | "tick" | "room">;
/** Internal mutable transaction helper. Public engine entry points clone first. */
export function record(run: Run, draft: FactDraft, witnessedBefore?: string[]): Fact {
  const fact: Fact = { ...structuredClone(draft), at: { x: draft.at.x, y: draft.at.y }, id: `${run.runId}:f${run.facts.length}`, tick: run.tick, room: run.room.index };
  run.facts.push(fact);
  if (fact.private || !fact.signature || fact.actor !== "player" && fact.actor !== "relic") return fact;
  const hidden = fact.actor === "player" && run.player.hiddenUntil >= run.tick;
  for (const witness of run.room.entities.filter(e => ["guardian", "observer", "captive", "echo"].includes(e.role))) {
    if (witnessedBefore ? !witnessedBefore.includes(witness.id) : !canSee(run.room, witness, fact.at, hidden)) continue;
    const id = `${run.runId}:o${run.observations.length}`;
    const observation = { id, factId: fact.id, observer: `${run.room.index}:${witness.id}`, tick: run.tick, room: run.room.index, confidence: witness.credibility, signature: fact.signature, cost: fact.cost, evidence: [fact.id], knownBy: ["player", "relic", `${run.room.index}:${witness.id}`] };
    run.observations.push(observation);
    run.beliefs.push({ id: `${run.runId}:b${run.beliefs.length}`, holder: observation.observer, claim: fact.signature, confidence: witness.credibility * 0.7, sources: [id], tick: run.tick, evidence: [fact.id], knownBy: [...observation.knownBy] });
    if (witness.role === "observer") witness.intent = "report";
  }
  return fact;
}

export function prepareReport(run: Run, witnessId: string): boolean {
  const witness = entity(run.room, witnessId), relay = entity(run.room, "relay");
  if (!witness?.active || witness.hp <= 0 || !relay?.active || !["observer", "guardian", "echo"].includes(witness.role)) return false;
  const holder = `${run.room.index}:${witness.id}`;
  const alreadyReported = new Set(run.reports.filter(r => !r.intercepted).flatMap(r => r.observations));
  const observations = run.observations.filter(o => o.observer === holder && !alreadyReported.has(o.id));
  if (!observations.length) return false;
  const signatures = [...new Set(observations.map(o => o.signature))];
  for (const claim of signatures) {
    const sources = observations.filter(o => o.signature === claim);
    run.reports.push({ id: `${run.runId}:r${run.reports.length}`, originator: holder, relay: "relay", observations: sources.map(o => o.id), claim, created: run.tick, delivered: null, intercepted: false, reliability: witness.credibility, cost: sources.reduce((sum, o) => sum + o.cost, 0), route: [holder, `${run.room.index}:relay`, "mind"], room: run.room.index, forged: sources.every(o => run.facts.find(f => f.id === o.factId)?.operation?.verb === "PLANT_EVIDENCE" && o.cost === 0) });
  }
  return true;
}

export function deliverReports(run: Run, witnessId: string): void {
  const holder = `${run.room.index}:${witnessId}`;
  for (const report of run.reports.filter(r => r.originator === holder && !r.intercepted && r.delivered === null)) {
    report.delivered = run.tick;
    const fact = record(run, { actor: witnessId, kind: "report", at: entity(run.room, "relay")!, signature: report.claim, cost: 0, value: 0, private: false, sources: [report.id], text: `The report arrived: “${THEORY_COPY[report.claim]}”` });
    run.notice = fact.text;
    run.beliefs.push({ id: `${run.runId}:b${run.beliefs.length}`, holder: "mind", claim: report.claim, confidence: report.reliability, sources: [report.id], tick: run.tick, evidence: [...report.observations], knownBy: ["mind"] });
  }
  run.hypotheses = inferHypotheses(run);
}

/** This function intentionally consumes delivered reports ONLY. */
export function inferHypotheses(run: Pick<Run, "reports" | "tick">): Hypothesis[] {
  const delivered = run.reports.filter(r => r.delivered !== null && !r.intercepted);
  const latestRoom = Math.max(0, ...delivered.map(r => r.room));
  const claims: Signature[] = ["mercy", "storm", "force", "cunning", "self-preservation"];
  return claims.flatMap(claim => {
    const matching = delivered.filter(r => r.claim === claim), rooms = [...new Set(matching.map(r => r.room))];
    if (!matching.length) return [];
    // One witness repeating a story cannot manufacture independent corroboration.
    const perRoom = rooms.map(room => Math.min(3, matching.filter(r => r.room === room).reduce((n, r) => n + (r.forged ? 0.18 : r.reliability * Math.min(2, r.cost / 3)), 0)) * Math.pow(0.86, Math.max(0, latestRoom - room - 3)));
    const support = perRoom.reduce((a, b) => a + b, 0);
    const contradictions = delivered.filter(r => r.claim !== claim && r.cost > 0 && rooms.includes(r.room)).length;
    const diversity = new Set(delivered.map(r => r.claim)).size;
    const noise = Math.max(0, diversity - 2) + contradictions / Math.max(1, rooms.length);
    const confidence = Math.min(0.95, support / (support + 2 + noise * 1.4));
    return [{ claim, confidence, support, contradictions, sources: matching.map(r => r.id), rooms, noise, updated: run.tick }];
  }).sort((a, b) => b.confidence - a.confidence);
}

/** Safe projection for the antagonist and its director; no player intent or teaching. */
export function dungeonKnowledge(run: Run) {
  return { theories: run.hypotheses.map(h => ({ ...h })), reports: run.reports.filter(r => r.delivered !== null && !r.intercepted).map(r => ({ id: r.id, claim: r.claim, room: r.room, reliability: r.reliability, cost: r.cost, sources: r.observations })) };
}

export function traceSources(run: Run, ids: string[], seen = new Set<string>()): string[] {
  const lines: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const fact = run.facts.find(f => f.id === id);
    if (fact) { lines.push(`Chamber ${fact.room + 1}, turn ${fact.tick}: ${fact.text}`); lines.push(...traceSources(run, fact.sources, seen)); continue; }
    const observation = run.observations.find(o => o.id === id);
    if (observation) { lines.push(`Someone observed: ${witnessName(run, observation.room, observation.observer.split(":").slice(1).join(":"))}.`); lines.push(...traceSources(run, [observation.factId], seen)); continue; }
    const report = run.reports.find(r => r.id === id);
    if (report) { lines.push(`Report from chamber ${report.room + 1}, ${report.delivered === null ? "not delivered" : `delivered on turn ${report.delivered}`}.`); lines.push(...traceSources(run, report.observations, seen)); }
  }
  return lines;
}

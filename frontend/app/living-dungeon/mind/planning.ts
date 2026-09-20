import { operationError, transition } from "./engine";
import { bind, hash } from "./protocol";
import type { Maneuver, Operation, Plan, Point, Preview, Role, Run, Verb } from "./types";
import { canSee, distance, entity, lineOfSight, passable, playerEntity } from "./world";

export const VERB_COPY: Record<Verb, string> = { MOVE: "Flytt", ATTACK: "Attack", STORM: "Storm", POTION: "Potion", PROTECT: "Beskytt", DISTRACT: "Avled", HIDE: "Skjul deg", OBSERVE: "Undersøk", CREATE_NOISE: "Lag lyd", EXTINGUISH_LIGHT: "Slukk lyset", RELEASE: "Frigjør", TRANSFER_ITEM: "Gi helsedrikk", REVEAL_EVIDENCE: "Vis bevis", PLANT_EVIDENCE: "Legg et falskt spor", REPORT: "La vitnet rapportere", INTERRUPT_REPORT: "Stans rapporten", RETREAT: "Trekk deg ut", WAIT: "Vent én tur" };
export function describeOperation(run: Run, op: Operation): string {
  const target = entity(run.room, op.target);
  if (op.verb === "MOVE") return `Gå til ${op.at?.x}, ${op.at?.y}`;
  return `${VERB_COPY[op.verb]}${target ? ` · ${target.name}` : ""}`;
}
const rangeFor = (verb: Verb) => ["OBSERVE", "REPORT", "HIDE", "WAIT", "POTION", "RETREAT"].includes(verb) ? 99 : verb === "STORM" ? 6 : ["DISTRACT", "CREATE_NOISE", "INTERRUPT_REPORT"].includes(verb) ? 3 : 1;
/** A path to a legal interaction cell, with predictable tie-breaking. */
function approach(run: Run, target: Point, range: number): Point[] {
  const from = playerEntity(run.room), queue = [{ at: { x: from.x, y: from.y }, path: [] as Point[] }], seen = new Set<string>();
  while (queue.length) {
    const step = queue.shift()!, key = `${step.at.x},${step.at.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (distance(step.at, target) <= range && lineOfSight(run.room, step.at, target)) return step.path;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const at = { x: step.at.x + dx, y: step.at.y + dy };
      if (passable(run.room, at)) queue.push({ at, path: [...step.path, at] });
    }
  }
  return [];
}
export function compilePlan(run: Run, desired: Operation[], options: { name?: string; boundary?: Maneuver["boundary"]; maneuverId?: string } = {}): Plan {
  let simulated = run;
  const steps: Operation[] = [];
  const add = (operation: Operation) => {
    if (steps.length >= 48) return;
    steps.push(operation);
    simulated = transition(simulated, { type: "act", operation }, simulated.revision, false);
  };
  for (const wanted of desired.slice(0, 16)) {
    if (wanted.verb === "MOVE" && wanted.at) {
      for (const at of approach(simulated, wanted.at, 0)) add({ verb: "MOVE", at });
      continue;
    }
    const target = entity(simulated.room, wanted.target);
    if (target && rangeFor(wanted.verb) !== 99) {
      for (const at of approach(simulated, target, rangeFor(wanted.verb))) add({ verb: "MOVE", at });
    }
    add(wanted);
  }
  return { id: `plan-${hash([run.revision, steps])}`, binding: bind(run), name: (options.name ?? "En mulig framtid").slice(0, 60), boundary: options.boundary ?? "none", steps, ...(options.maneuverId ? { maneuverId: options.maneuverId } : {}) };
}
export function previewPlan(run: Run, plan: Plan): Preview {
  let simulated = run;
  const result: Preview = { legal: true, reason: null, steps: [], healthCost: 0, energyCost: 0, potionCost: 0, complications: [], observations: [], outcome: "Stegene er mulige med det du vet nå." };
  if (!plan.steps.length) return { ...result, legal: false, reason: "Velg minst én forbindelse i rommet." };
  if (plan.boundary === "no-harm" && plan.steps.some(s => ["ATTACK", "STORM"].includes(s.verb))) return { ...result, legal: false, reason: "Denne planen bryter grensen om å la vokteren leve." };
  for (const operation of plan.steps) {
    const from = { ...playerEntity(simulated.room) }, error = operationError(simulated, operation);
    const witnesses = simulated.room.entities.filter(e => canSee(simulated.room, e, operation.at ?? from, simulated.player.hiddenUntil >= simulated.tick)).map(e => e.name);
    if (!error) simulated = transition(simulated, { type: "act", operation }, simulated.revision, false);
    const to = playerEntity(simulated.room);
    result.steps.push({ operation, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, witnesses, hp: simulated.player.hp, energy: simulated.relic.energy, description: describeOperation(run, operation), interruption: error });
    if (error) {
      const changedTarget = operation.target && entity(run.room, operation.target)?.active && !entity(simulated.room, operation.target)?.active;
      if (changedTarget && result.steps.length > 1) {
        result.complications.push(`Planen kan bli avbrutt: ${error}`);
        result.outcome = "Åpningen kan forsøkes. Et nødvendig objekt kan forsvinne underveis.";
      } else { result.legal = false; result.reason = error; }
      break;
    }
  }
  result.healthCost = run.player.hp - simulated.player.hp;
  result.energyCost = run.relic.energy - simulated.relic.energy;
  result.potionCost = run.player.potions - simulated.player.potions;
  result.observations = [...new Set(simulated.observations.slice(run.observations.length).map(o => entity(run.room, o.observer.split(":").slice(1).join(":"))?.name ?? "Et vitne"))];
  if (run.room.entities.some(e => e.role === "observer" && e.active)) result.complications.push("Skriveren flytter seg mot rapportåren mens du handler.");
  if (run.room.alert >= 2) result.complications.push("Vokteren kan komme i veien eller ødelegge en avledning.");
  if (run.room.captiveDeadline) result.complications.push(`Den fangede er i fare etter tur ${run.room.captiveDeadline}.`);
  if (simulated.status === "fallen") { result.legal = false; result.reason = "Du vil falle før planen er ferdig."; }
  if (simulated.room.solved) result.outcome = simulated.room.family === "echo" ? "Ekkoet bryter sammen." : "Den fangede kommer fri. Historien er ennå din å forme.";
  if (plan.boundary === "free-target" && !entity(simulated.room, "captive")?.freed) { result.legal = false; result.reason = "Personen blir ikke fri med disse stegene."; }
  return result;
}

export function generalizeManeuver(run: Run, maneuver: Maneuver): Plan {
  const desired: Operation[] = [];
  for (const step of maneuver.steps) {
    if (step.verb === "EXTINGUISH_LIGHT" && !run.room.light) continue;
    // Roles are rebound by affordance, not by the previous object's ID or name.
    const candidates = run.room.entities.filter(e => e.active && (e.role === step.role || step.role === "guardian" && e.role === "echo"));
    const target = candidates.find(e => e.id === "resonator" && run.room.components.some(c => c.id === "echo-snare")) ?? candidates[0];
    if (step.role && !target) continue;
    if (step.verb === "HIDE" && run.room.light && !desired.some(s => s.verb === "EXTINGUISH_LIGHT")) {
      const light = entity(run.room, "light");
      if (light?.active) desired.push({ verb: "EXTINGUISH_LIGHT", target: light.id });
    }
    desired.push({ verb: step.verb, ...(target ? { target: target.id } : {}), ...(step.signature ? { signature: step.signature } : {}) });
  }
  if (maneuver.boundary !== "none" && !desired.some(s => s.verb === "RELEASE")) desired.push({ verb: "RELEASE", target: "captive" });
  return compilePlan(run, desired, { name: maneuver.name, boundary: maneuver.boundary, maneuverId: maneuver.id });
}

export function verbsForRole(role: Role): Verb[] {
  const values: Record<Role, Verb[]> = { player: ["HIDE", "POTION", "WAIT"], guardian: ["ATTACK", "STORM", "OBSERVE", "REPORT"], echo: ["ATTACK", "STORM", "OBSERVE"], captive: ["RELEASE", "PROTECT", "TRANSFER_ITEM", "OBSERVE"], distraction: ["DISTRACT", "CREATE_NOISE", "OBSERVE"], light: ["EXTINGUISH_LIGHT", "OBSERVE"], relay: ["INTERRUPT_REPORT", "OBSERVE"], observer: ["REPORT", "INTERRUPT_REPORT", "OBSERVE"], exit: ["RETREAT", "OBSERVE"], evidence: ["PLANT_EVIDENCE", "REVEAL_EVIDENCE", "OBSERVE"], cover: ["HIDE", "OBSERVE"] };
  return values[role];
}
/** Three contextual starting points; the composer can make arbitrary certified sequences. */
export function suggestions(run: Run): { label: string; detail: string; operations: Operation[]; boundary: Maneuver["boundary"] }[] {
  const boss = run.room.family === "echo";
  if (!run.room.solved && run.room.index >= 12 && run.room.goal === "evidence") return [
    { label: "Hent det utelatte minnet", detail: "Gå til vitneseglet og avslør det dungeonen skjulte.", operations: [{ verb: "REVEAL_EVIDENCE", target: "evidence" }], boundary: "none" },
    { label: "Gi noen friheten først", detail: "Minnet er målet. Personen kan likevel bli ditt ansvar.", operations: [...(run.room.light ? [{ verb: "EXTINGUISH_LIGHT" as const, target: "light" }] : []), { verb: "RELEASE", target: "captive" }], boundary: "free-target" },
    { label: "Steng rapportveien", detail: "Hent kunnskapen uten å gi den tilbake til dypet.", operations: [{ verb: "INTERRUPT_REPORT", target: "relay" }], boundary: "none" },
  ];
  if (run.room.goal === "story" || run.room.goal === "escort" && entity(run.room, "captive")?.freed) return [
    { label: "Stans historien", detail: "Bryt den fysiske rapportveien.", operations: [{ verb: "INTERRUPT_REPORT", target: "relay" }], boundary: "none" },
    { label: "La dem fortelle", detail: "La et troverdig vitne bære det som ble sett.", operations: [{ verb: "REPORT", target: "observer" }, { verb: "WAIT" }, { verb: "WAIT" }], boundary: "none" },
    { label: "Følg personen ut", detail: "Hvert skritt kjøper tid til å nå trappen.", operations: [{ verb: "MOVE", at: { x: 8, y: 7 } }], boundary: "none" },
  ];
  if (run.room.solved) return [
    { label: "Stans historien", detail: "Nå rapportåren før vitnet.", operations: [{ verb: "INTERRUPT_REPORT", target: "relay" }], boundary: "none" },
    { label: "La dem fortelle", detail: "En dyr, synlig handling kan styrke rollen din.", operations: [{ verb: "REPORT", target: entity(run.room, "observer")?.active ? "observer" : "guardian" }], boundary: "none" },
    { label: "Finn trappen", detail: "Gå videre med det dere har lært.", operations: [{ verb: "MOVE", at: { x: 8, y: 7 } }], boundary: "none" },
  ];
  return [
    { label: "Skap en skjult åpning", detail: "Slukk lyset, avled vokteren, få personen fri.", operations: [...(run.room.light ? [{ verb: "EXTINGUISH_LIGHT" as const, target: "light" }] : []), { verb: "DISTRACT", target: boss && run.room.components.some(c => c.id === "echo-snare") ? "resonator" : "distraction" }, { verb: "HIDE" }, { verb: "RELEASE", target: "captive" }], boundary: "no-harm" },
    { label: "La dem se Storm", detail: "Bruk 4 energi på et synlig mønster. Bevar en annen vei.", operations: [{ verb: "STORM", target: "guardian" }], boundary: "none" },
    { label: boss ? "Bryt den blinde siden" : "Beskytt før du angriper", detail: boss ? "Skjul deg. Angrip det vernet overser." : "Gå til den fangede og gi vern.", operations: boss ? [{ verb: "EXTINGUISH_LIGHT", target: "light" }, { verb: "HIDE" }, { verb: "ATTACK", target: "guardian" }] : [{ verb: "PROTECT", target: "captive" }, { verb: "RELEASE", target: "captive" }], boundary: boss ? "none" : "free-target" },
  ];
}

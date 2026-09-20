import { operationError, transition } from "./engine";
import { bind, hash } from "./protocol";
import type { Maneuver, Operation, Plan, Point, Preview, Role, Run, Verb } from "./types";
import { canSee, distance, entity, lineOfSight, passable, playerEntity } from "./world";

export const VERB_COPY: Record<Verb, string> = { MOVE: "Move", ATTACK: "Attack", STORM: "Storm", POTION: "Potion", PROTECT: "Protect", DISTRACT: "Distract", HIDE: "Hide", OBSERVE: "Examine", CREATE_NOISE: "Make noise", EXTINGUISH_LIGHT: "Extinguish the light", RELEASE: "Release", TRANSFER_ITEM: "Give a potion", REVEAL_EVIDENCE: "Reveal evidence", PLANT_EVIDENCE: "Plant evidence", REPORT: "Let the witness report", INTERRUPT_REPORT: "Interrupt the report", RETREAT: "Retreat", WAIT: "Wait one turn" };
export function describeOperation(run: Run, op: Operation): string {
  const target = entity(run.room, op.target);
  if (op.verb === "MOVE") return `Move to ${op.at?.x}, ${op.at?.y}`;
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
  return { id: `plan-${hash([run.revision, steps])}`, binding: bind(run), name: (options.name ?? "A Possible Future").slice(0, 60), boundary: options.boundary ?? "none", steps, ...(options.maneuverId ? { maneuverId: options.maneuverId } : {}) };
}
export function previewPlan(run: Run, plan: Plan): Preview {
  let simulated = run;
  const result: Preview = { legal: true, reason: null, steps: [], healthCost: 0, energyCost: 0, potionCost: 0, complications: [], observations: [], outcome: "These steps are possible with what you know now." };
  if (!plan.steps.length) return { ...result, legal: false, reason: "Choose at least one connection in the room." };
  if (plan.boundary === "no-harm" && plan.steps.some(s => ["ATTACK", "STORM"].includes(s.verb))) return { ...result, legal: false, reason: "This plan breaks your promise to let the guard live." };
  for (const operation of plan.steps) {
    const from = { ...playerEntity(simulated.room) }, error = operationError(simulated, operation);
    const witnesses = simulated.room.entities.filter(e => canSee(simulated.room, e, operation.at ?? from, simulated.player.hiddenUntil >= simulated.tick)).map(e => e.name);
    if (!error) simulated = transition(simulated, { type: "act", operation }, simulated.revision, false);
    const to = playerEntity(simulated.room);
    result.steps.push({ operation, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, witnesses, hp: simulated.player.hp, energy: simulated.relic.energy, description: describeOperation(run, operation), interruption: error });
    if (error) {
      const changedTarget = operation.target && entity(run.room, operation.target)?.active && !entity(simulated.room, operation.target)?.active;
      if (changedTarget && result.steps.length > 1) {
        result.complications.push(`The plan may be interrupted: ${error}`);
        result.outcome = "You can attempt this opening. An object you need may disappear along the way.";
      } else { result.legal = false; result.reason = error; }
      break;
    }
  }
  result.healthCost = run.player.hp - simulated.player.hp;
  result.energyCost = run.relic.energy - simulated.relic.energy;
  result.potionCost = run.player.potions - simulated.player.potions;
  result.observations = [...new Set(simulated.observations.slice(run.observations.length).map(o => entity(run.room, o.observer.split(":").slice(1).join(":"))?.name ?? "A witness"))];
  if (run.room.entities.some(e => e.role === "observer" && e.active)) result.complications.push("The scribe moves towards the conduit while you act.");
  if (run.room.alert >= 2) result.complications.push("The guard may get in the way or destroy a distraction.");
  if (run.room.captiveDeadline) result.complications.push(`The captive is in danger after turn ${run.room.captiveDeadline}.`);
  if (simulated.status === "fallen") { result.legal = false; result.reason = "You will fall before the plan is finished."; }
  if (simulated.room.solved) result.outcome = simulated.room.family === "echo" ? "The Echo collapses." : "The captive goes free. The story is still yours to shape.";
  if (plan.boundary === "free-target" && !entity(simulated.room, "captive")?.freed) { result.legal = false; result.reason = "These steps do not free the captive."; }
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
    { label: "Recover the missing memory", detail: "Reach the witness seal and reveal what the dungeon hid.", operations: [{ verb: "REVEAL_EVIDENCE", target: "evidence" }], boundary: "none" },
    { label: "Free someone first", detail: "The memory is the goal. The captive can still become your responsibility.", operations: [...(run.room.light ? [{ verb: "EXTINGUISH_LIGHT" as const, target: "light" }] : []), { verb: "RELEASE", target: "captive" }], boundary: "free-target" },
    { label: "Close the report route", detail: "Recover the knowledge without returning it to the depths.", operations: [{ verb: "INTERRUPT_REPORT", target: "relay" }], boundary: "none" },
  ];
  if (run.room.goal === "story" || run.room.goal === "escort" && entity(run.room, "captive")?.freed) return [
    { label: "Stop the story", detail: "Break the physical report route.", operations: [{ verb: "INTERRUPT_REPORT", target: "relay" }], boundary: "none" },
    { label: "Let them tell it", detail: "Let a credible witness carry what was seen.", operations: [{ verb: "REPORT", target: "observer" }, { verb: "WAIT" }, { verb: "WAIT" }], boundary: "none" },
    { label: "Escort them out", detail: "Every step buys time to reach the stairs.", operations: [{ verb: "MOVE", at: { x: 8, y: 7 } }], boundary: "none" },
  ];
  if (run.room.solved) return [
    { label: "Stop the story", detail: "Reach the conduit before the witness.", operations: [{ verb: "INTERRUPT_REPORT", target: "relay" }], boundary: "none" },
    { label: "Let them tell it", detail: "A costly, visible action can strengthen your role.", operations: [{ verb: "REPORT", target: entity(run.room, "observer")?.active ? "observer" : "guardian" }], boundary: "none" },
    { label: "Find the stairs", detail: "Move on with what you have learned.", operations: [{ verb: "MOVE", at: { x: 8, y: 7 } }], boundary: "none" },
  ];
  return [
    { label: "Create a hidden opening", detail: "Extinguish the light, distract the guard, free the captive.", operations: [...(run.room.light ? [{ verb: "EXTINGUISH_LIGHT" as const, target: "light" }] : []), { verb: "DISTRACT", target: boss && run.room.components.some(c => c.id === "echo-snare") ? "resonator" : "distraction" }, { verb: "HIDE" }, { verb: "RELEASE", target: "captive" }], boundary: "no-harm" },
    { label: "Let them see Storm", detail: "Spend 4 energy on a visible pattern. Keep another way hidden.", operations: [{ verb: "STORM", target: "guardian" }], boundary: "none" },
    { label: boss ? "Strike the blind side" : "Protect before you attack", detail: boss ? "Hide. Attack what the ward overlooks." : "Reach the captive and protect them.", operations: boss ? [{ verb: "EXTINGUISH_LIGHT", target: "light" }, { verb: "HIDE" }, { verb: "ATTACK", target: "guardian" }] : [{ verb: "PROTECT", target: "captive" }, { verb: "RELEASE", target: "captive" }], boundary: boss ? "none" : "free-target" },
  ];
}

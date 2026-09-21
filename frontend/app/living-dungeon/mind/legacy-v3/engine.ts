import { COMPONENTS, PRINCIPLES } from "./catalogue";
import { deliverReports, prepareReport, record } from "./knowledge";
import { currentBinding, isOperation } from "./protocol";
import type { Command, Fact, Maneuver, Operation, PrincipleId, Run, Scope, Signature } from "./types";
import { buildRoom, byRole, canSee, distance, entity, equalPoint, lineOfSight, passable, pathTo, playerEntity } from "./world";

const clone = <T,>(value: T): T => structuredClone(value);
export function createRun(seed: number, runId: string): Run {
  const room = buildRoom(seed, 0, [], []);
  const run: Run = { version: 3, rules: "mind-beneath-2", runId, seed: seed >>> 0, rng: seed >>> 0 || 1, revision: 0, tick: 0, room, player: { hp: 40, maxHp: 40, potions: 3, hiddenUntil: -1 }, relic: { stage: 0, energy: 16, trust: 5, principles: [], maneuvers: [], line: "I know the weight of your hand. Not why it trembles. What should I remember first?", misunderstanding: false, pendingChoice: null, lastChoice: null }, facts: [], observations: [], beliefs: [], reports: [], hypotheses: [], relationships: [], scars: [], history: [room.family], journal: [], activePlan: null, lastSequence: null, recentSteps: [], recentFacts: [], status: "playing", echoes: 0, chills: { understood: null, mistaken: null, divergence: null }, director: null, notice: "Teach the relic one principle. The words stay between you." };
  roomFact(run);
  return run;
}
function roomFact(run: Run) {
  record(run, { actor: "world", kind: "room", at: playerEntity(run.room), cost: 0, value: run.room.index, private: false, sources: [], text: `Entered ${run.room.title}.` });
  if (run.room.adaptation) record(run, { actor: "mind", kind: "countermeasure", at: { x: 7, y: 3 }, cost: 0, value: 0, private: false, sources: run.room.adaptationSources, text: `The room was built around ${run.room.adaptation}.` });
  for (const component of run.room.components) record(run, { actor: "mind", kind: "countermeasure", at: { x: 7, y: 4 }, cost: component.cost, value: 0, private: false, sources: component.sources, text: `${COMPONENTS[component.id].name}: ${COMPONENTS[component.id].effect}` });
}
function random(run: Run): number {
  let n = run.rng; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; run.rng = n >>> 0;
  return run.rng / 4294967296;
}
export function operationError(run: Run, op: Operation): string | null {
  if (!isOperation(op)) return "That action is not available in this room.";
  if (run.status !== "playing") return "The expedition needs a resting place.";
  if (!run.relic.principles.length && op.verb !== "OBSERVE") return "Teach the relic one principle first.";
  const p = playerEntity(run.room), target = entity(run.room, op.target);
  if (op.verb === "MOVE") return !op.at || distance(p, op.at) !== 1 || !passable(run.room, op.at) ? "Choose an open tile beside you." : null;
  if (["WAIT", "POTION", "HIDE", "RETREAT"].includes(op.verb)) {
    if (op.verb === "POTION" && run.player.potions < 1) return "No potions left.";
    if (op.verb === "POTION" && run.player.hp === run.player.maxHp) return "Your health is already full.";
    if (op.verb === "HIDE" && run.room.light && !run.room.shadows.some(s => distance(p, s) <= 1)) return "Find a shadow or extinguish the light first.";
    if (op.verb === "RETREAT" && distance(p, entity(run.room, "exit")!) > 1) return "Reach the stairs first.";
    return null;
  }
  if (!target?.active || target.hp <= 0) return "The target is no longer available.";
  if (op.verb === "OBSERVE") return null;
  if (op.verb === "STORM") {
    if (!["guardian", "echo"].includes(target.role)) return "Aim the lightning at an enemy.";
    if (run.relic.energy < 4) return "Storm needs 4 relic energy.";
    return distance(p, target) > 6 || !lineOfSight(run.room, p, target) ? "The target is beyond lightning range or behind a wall." : null;
  }
  if (["DISTRACT", "CREATE_NOISE"].includes(op.verb)) {
    if (target.role !== "distraction") return "This cannot create a distraction.";
    if (run.relic.energy < 2) return "A distraction needs 2 energy.";
    return distance(p, target) > 3 || !lineOfSight(run.room, p, target) ? "Move closer to the distraction." : null;
  }
  if (op.verb === "INTERRUPT_REPORT") return distance(p, target) > 3 || !["relay", "observer"].includes(target.role) ? "Get within three tiles of a conduit or scribe." : run.relic.energy < 2 ? "Interrupting a report needs 2 energy." : null;
  if (op.verb === "REPORT") return !["observer", "guardian"].includes(target.role) ? "Choose a witness who can pass the story on." : null;
  if (distance(p, target) > 1) return "Move beside the target first.";
  if (op.verb === "ATTACK" && !["guardian", "echo"].includes(target.role)) return "Choose an enemy.";
  if (op.verb === "RELEASE" && (target.role !== "captive" || target.freed)) return "There is no bound captive to free here.";
  if (op.verb === "PROTECT" && target.role !== "captive") return "Choose someone who needs protection.";
  if (op.verb === "PROTECT" && run.relic.energy < 2) return "Protection needs 2 energy.";
  if (op.verb === "TRANSFER_ITEM" && (target.role !== "captive" || run.player.potions < 1)) return "You need a potion and someone to give it to.";
  if (op.verb === "EXTINGUISH_LIGHT" && (target.role !== "light" || !run.room.light)) return "The light is already out.";
  if (["REVEAL_EVIDENCE", "PLANT_EVIDENCE"].includes(op.verb) && target.role !== "evidence") return "You need the witness seal.";
  if (op.verb === "PLANT_EVIDENCE" && run.relic.energy < 3) return "Planting evidence needs 3 energy.";
  return null;
}

function actionFact(run: Run, op: Operation, text: string, cost: number, signature?: Signature, value = 0, sources: string[] = [], witnessedBefore?: string[]): Fact {
  return record(run, { actor: "player", kind: op.verb === "RELEASE" ? "release" : "action", operation: clone(op), target: op.target, at: { x: playerEntity(run.room).x, y: playerEntity(run.room).y }, cost, value, signature, private: false, sources, text }, witnessedBefore);
}
function learnFrom(run: Run, fact: Fact) {
  for (const principle of run.relic.principles) {
    const supported = fact.signature === "mercy" && ["protect", "promise", "last-potion", "no-harm"].includes(principle.id)
      || fact.operation?.verb === "OBSERVE" && principle.id === "investigate"
      || fact.signature === "self-preservation" && principle.id === "survive"
      || fact.operation?.verb === "RELEASE" && principle.id === "no-harm";
    if (supported && !principle.examples.includes(fact.id)) { principle.examples.push(fact.id); principle.confidence = Math.min(0.96, principle.confidence + 0.08); }
    if (fact.signature === "force" && principle.id === "no-harm") { principle.counterexamples.push(fact.id); principle.confidence = Math.max(0.2, principle.confidence - 0.05); }
  }
}
function freeCaptive(run: Run, fact: Fact) {
  const captive = entity(run.room, "captive")!;
  captive.freed = true; captive.protected = 99; captive.intent = "flee";
  const key = run.room.index === 0 || run.room.family === "echo" ? "ilyr" : run.room.family;
  let relation = run.relationships.find(r => r.id === key);
  if (!relation) { relation = { id: key, name: captive.name, trust: 0, debt: 0, rescued: 0, witnessed: [] }; run.relationships.push(relation); }
  relation.trust += 1; relation.debt += 1; relation.rescued += 1; relation.witnessed.push(fact.id);
  if (run.room.goal === "rescue") run.room.solved = true;
  else if (run.room.goal === "echo") {
    const echo = entity(run.room, "guardian")!;
    const thread = run.room.components.some(c => c.id === "hostage-thread");
    if (thread) echo.hp = Math.max(0, echo.hp - 12);
    if (thread) record(run, { actor: "world", kind: "echo-break", at: echo, cost: 0, value: 12, private: false, sources: [fact.id, ...run.room.components.filter(c => c.id === "hostage-thread").flatMap(c => c.sources)], text: "The freed captive tears the hostage thread out of the Echo. Its shield collapses." });
  }
}
function execute(run: Run, op: Operation): Fact {
  const p = playerEntity(run.room), target = entity(run.room, op.target);
  let fact: Fact;
  const hidden = run.player.hiddenUntil >= run.tick;
  const witnesses = run.room.entities.filter(e => canSee(run.room, e, p, hidden)).map(e => e.id);
  const observedFact = (run: Run, op: Operation, text: string, cost: number, signature?: Signature, value = 0, sources: string[] = []) => actionFact(run, op, text, cost, signature, value, sources, witnesses);
  switch (op.verb) {
    case "MOVE": p.x = op.at!.x; p.y = op.at!.y; fact = observedFact(run, op, "Moved one tile.", 0); break;
    case "OBSERVE":
      if (!run.room.inspected.includes(target!.id)) run.room.inspected.push(target!.id);
      fact = observedFact(run, op, `Examined ${target!.name}.`, 0);
      break;
    case "ATTACK": case "STORM": {
      const storm = op.verb === "STORM", ward = run.room.disruptionUntil <= run.tick && run.room.components.some(c => c.id === (storm ? "storm-ward" : "iron-mirror"));
      const rawDamage = storm ? ward ? 2 : 8 : ward && !hidden ? 2 : hidden ? 9 : 5 + Math.floor(random(run) * 2);
      const damage = target!.protected > 0 ? Math.max(1, rawDamage - 3) : rawDamage;
      if (storm) run.relic.energy -= 4;
      target!.hp = Math.max(0, target!.hp - damage);
      run.room.alert = 3;
      fact = observedFact(run, op, `${storm ? "Storm" : hidden ? "An unseen attack" : "A sword strike"} hit ${target!.name} for ${damage}.`, storm ? 4 : 2, storm ? "storm" : "force", damage);
      if (!storm && hidden && run.room.components.some(c => c.id === "storm-ward") && run.hypotheses.some(h => h.claim === "storm" && h.confidence >= 0.48)) {
        run.chills.mistaken = fact.id;
        run.relic.line = "Every ward faces the lightning. You taught me to look for the other way.";
      }
      run.player.hiddenUntil = -1;
      if (target!.hp === 0) target!.active = false;
      break;
    }
    case "POTION":
      run.player.potions--; run.player.hp = Math.min(run.player.maxHp, run.player.hp + 16);
      fact = observedFact(run, op, "Drank a potion. It is gone for good.", 5, "self-preservation", 16);
      if (run.room.components.some(c => c.id === "thirst-trap")) run.room.hazards.push({ x: p.x, y: p.y });
      break;
    case "PROTECT":
      target!.protected = 5; run.relic.energy -= 2;
      fact = observedFact(run, op, `Stood between danger and ${target!.name}.`, 3, "mercy"); break;
    case "DISTRACT": case "CREATE_NOISE": {
      run.relic.energy -= 2;
      const guardian = entity(run.room, "guardian");
      if (guardian?.active) { guardian.distracted = 6; guardian.goal = { x: target!.x, y: target!.y }; }
      fact = observedFact(run, op, `${target!.name} drew the guard's attention.`, 2, "cunning");
      if (run.room.components.some(c => c.id === "echo-snare") && target!.id === "distraction") {
        run.player.hp = Math.max(0, run.player.hp - 6); run.room.alert = 3;
        run.notice = "The Echo recognised the visible distraction. The trap cost 6 health.";
      }
      break;
    }
    case "HIDE": run.player.hiddenUntil = run.tick + 6; fact = observedFact(run, op, "Slipped into shadow. Nearby witnesses can still see you.", 0); break;
    case "EXTINGUISH_LIGHT": run.room.light = false; fact = observedFact(run, op, `Extinguished ${target!.name}. Sightlines shrank.`, 1, "cunning"); break;
    case "RELEASE":
      fact = observedFact(run, op, `Freed ${target!.name}.`, 3, "mercy"); freeCaptive(run, fact); break;
    case "TRANSFER_ITEM":
      run.player.potions--; target!.hp = target!.maxHp; target!.protected = 5;
      fact = observedFact(run, op, `Gave an irreplaceable potion to ${target!.name}.`, 6, "mercy"); break;
    case "INTERRUPT_REPORT": {
      run.relic.energy -= 2;
      for (const report of run.reports.filter(r => r.room === run.room.index && r.delivered === null && (target!.role === "relay" || r.originator.endsWith(`:${target!.id}`)))) report.intercepted = true;
      if (target!.role === "relay") target!.active = false;
      else { target!.distracted = 5; target!.intent = "watch"; }
      fact = observedFact(run, op, target!.role === "relay" ? "Broke the report conduit. This route to the dungeon is closed." : "Stopped the scribe. It still remembers what it saw.", 2, "cunning"); break;
    }
    case "REPORT":
      prepareReport(run, target!.id); target!.intent = "report";
      fact = observedFact(run, op, `Let ${target!.name} carry its version onward.`, 0); break;
    case "PLANT_EVIDENCE": {
      run.relic.energy -= 3;
      const observed = run.room.entities.some(e => canSee(run.room, e, p, hidden));
      target!.suspicious = observed;
      fact = observedFact(run, op, observed ? "A witness saw you forge the seal. The evidence lost credibility." : "Planted a false witness seal in shadow. A witness needs to discover it.", 3, op.signature ?? "storm");
      // A forged trace is distinct from the observed act of forging it.
      target!.goal = { x: observed ? 1 : 0, y: ["storm", "mercy", "force", "cunning", "self-preservation"].indexOf(op.signature ?? "storm") };
      break;
    }
    case "REVEAL_EVIDENCE":
      fact = observedFact(run, op, "Revealed the witness seal. One claim does not make a certain story.", 0);
      if (run.room.goal === "evidence") {
        run.room.solved = true;
        run.relic.energy = Math.min(20, run.relic.energy + 3);
        run.relic.line = "It removed the memory because it did not fit the explanation. We are taking it with us.";
      }
      for (const witness of run.room.entities.filter(e => ["guardian", "observer"].includes(e.role) && canSee(run.room, e, p))) {
        const claim = (["storm", "mercy", "force", "cunning", "self-preservation"] as Signature[])[target!.goal?.y ?? 0];
        const source = run.facts.filter(f => f.room === run.room.index && f.operation?.verb === "PLANT_EVIDENCE").at(-1);
        if (!source) continue;
        const id = `${run.runId}:o${run.observations.length}`;
        run.observations.push({ id, factId: source.id, observer: `${run.room.index}:${witness.id}`, tick: run.tick, room: run.room.index, confidence: target!.suspicious ? 0.1 : 0.4, signature: claim, cost: 0, evidence: [source.id], knownBy: ["player", "relic", witness.id] });
        witness.intent = "report";
      }
      break;
    case "RETREAT":
      run.room.escaped = true; run.room.solved = true;
      fact = observedFact(run, op, "Chose the stairs. Those left behind have their own story.", 3, "self-preservation"); break;
    default: fact = observedFact(run, op, "Let a moment pass.", 0);
  }
  learnFrom(run, fact);
  run.notice = fact.text;
  return fact;
}

function autonomousChoice(run: Run) {
  const choice = run.relic.pendingChoice;
  if (!choice) return;
  run.relic.pendingChoice = null;
  const captive = entity(run.room, "captive")!, p = playerEntity(run.room);
  if (choice.protect && captive.active && !captive.freed) {
    captive.protected = 7; run.relic.energy = Math.max(0, run.relic.energy - 3);
    run.player.hp = Math.max(1, run.player.hp - 4);
    const fact = record(run, { actor: "relic", kind: "choice", at: captive, target: captive.id, signature: "mercy", cost: 7, value: 4, private: false, sources: choice.sources, text: "The relic flew to the captive and caught the blow in its light. You lost 4 health; it spent 3 energy." });
    run.relic.lastChoice = fact.id; run.relic.line = "I knew what you would ask. I went to the other one anyway.";
  } else {
    p.protected = 6;
    const fact = record(run, { actor: "relic", kind: "choice", at: p, cost: 2, value: 0, private: true, sources: choice.sources, text: "The relic chose to shield you. The captive had to wait." });
    run.relic.energy = Math.max(0, run.relic.energy - 2); run.relic.lastChoice = fact.id;
    run.relic.line = "I chose you. I do not know if I can call that right.";
  }
  run.relic.stage = 3;
}

function autonomousGeneralization(run: Run) {
  if (run.room.family !== "echo" || run.room.turn < 2 || run.facts.some(f => f.room === run.room.index && f.actor === "relic" && f.operation?.target === "resonator") || run.relic.energy < 4) return;
  const maneuver = run.relic.maneuvers.find(m => m.boundary !== "none" && m.steps.some(s => s.verb === "RELEASE") && m.steps.some(s => s.verb === "DISTRACT" || s.verb === "CREATE_NOISE") && m.corrections.length > 0);
  const principle = run.relic.principles.find(p => ["protect", "no-harm", "promise"].includes(p.id) && p.examples.length);
  const resonator = entity(run.room, "resonator"), guardian = entity(run.room, "guardian"), captive = entity(run.room, "captive");
  if (!maneuver || !principle || !resonator || !guardian?.active || !captive || captive.freed) return;
  // The relic carries the learned distraction to a NEW object. It cannot conjure damage or a reward.
  run.relic.energy -= 4; guardian.distracted = 8; guardian.goal = { x: resonator.x, y: resonator.y }; run.room.light = false;
  const sources = [...maneuver.examples, ...maneuver.corrections, ...principle.examples.slice(-1)];
  const fact = record(run, { actor: "relic", kind: "learning", at: resonator, operation: { verb: "DISTRACT", target: resonator.id }, target: resonator.id, cost: 4, value: 8, private: false, sources, text: `The relic used the principle behind “${maneuver.name}” on the shadow resonator. The Echo turned away. Eight turns are yours.` });
  run.chills.understood = fact.id; maneuver.contexts.push("echo"); maneuver.uses++;
  run.relic.line = "It was never the bell. It was who you wanted to free.";
  if (run.room.components.length) {
    run.chills.mistaken = fact.id;
    const divergence = record(run, { actor: "world", kind: "echo-break", at: guardian, cost: 0, value: 8, private: false, sources: [fact.id, ...run.room.components.flatMap(c => c.sources)], text: "The Echo guards your public strategy. The relic opened the hidden way. The ward fades as the Echo turns." });
    run.chills.divergence = divergence.id;
    run.room.disruptionUntil = run.tick + 8;
  }
}

function environmentTurn(run: Run) {
  run.tick++; run.room.turn++;
  autonomousChoice(run);
  autonomousGeneralization(run);
  const p = playerEntity(run.room), guardian = entity(run.room, "guardian"), captive = entity(run.room, "captive"), relay = entity(run.room, "relay");
  for (const e of run.room.entities) if (e.protected > 0 && !e.freed) e.protected--;
  if (guardian?.active && guardian.hp > 0) {
    if (guardian.distracted > 0) {
      guardian.distracted--;
      if (guardian.goal) { const next = pathTo(run.room, guardian, guardian.goal, true)[0]; if (next) Object.assign(guardian, next); }
    } else if (run.room.alert >= 2 && !run.room.solved) {
      const visible = canSee(run.room, guardian, p, run.player.hiddenUntil >= run.tick);
      if (visible && distance(guardian, p) <= 1) {
        const damage = p.protected > 0 ? 1 : 3;
        run.player.hp = Math.max(0, run.player.hp - damage);
        record(run, { actor: guardian.id, kind: "harm", at: p, target: "player", cost: 0, value: damage, private: false, sources: [], text: `${guardian.name} struck back. You lost ${damage} health.` });
      } else if (visible) { const next = pathTo(run.room, guardian, p, true)[0]; if (next) Object.assign(guardian, next); }
      if (run.room.index > 2 && run.room.turn % 7 === 0) {
        const object = byRole(run.room, "distraction");
        if (object && distance(guardian, object) <= 1) {
          object.active = false; run.notice = `${guardian.name} destroyed ${object.name}. The plan must change.`;
          record(run, { actor: guardian.id, kind: "action", operation: { verb: "ATTACK", target: object.id }, target: object.id, at: object, cost: 0, value: 1, private: false, sources: [], text: run.notice });
        }
      }
    }
  }
  for (const witness of run.room.entities.filter(e => e.active && e.hp > 0 && (e.role === "observer" || e.intent === "report"))) {
    if (witness.distracted > 0) { witness.distracted--; continue; }
    if (witness.intent !== "report" || run.room.turn < run.room.reportDelay || !relay?.active) continue;
    prepareReport(run, witness.id);
    if (distance(witness, relay) <= 1) deliverReports(run, witness.id);
    else { const next = pathTo(run.room, witness, relay, true)[0]; if (next) Object.assign(witness, next); }
  }
  if (captive?.active && !captive.freed && run.room.captiveDeadline > 0 && run.room.turn >= run.room.captiveDeadline && captive.protected <= 0) {
    captive.hp = Math.max(0, captive.hp - 1);
    if (captive.hp === 0) {
      captive.active = false; run.room.solved = run.room.family !== "echo";
      const fact = record(run, { actor: "world", kind: "scar", at: captive, cost: 0, value: 1, private: false, sources: run.relic.lastChoice ? [run.relic.lastChoice] : [], text: `${captive.name} did not survive the wait.` });
      run.scars.push(fact.id); run.relic.line = "I counted the turns. I should have counted who they belonged to.";
    }
  }
  if (captive?.freed) { const next = pathTo(run.room, captive, entity(run.room, "exit")!, true)[0]; if (next) Object.assign(captive, next); }
  if (run.room.goal === "escort" && captive?.freed && distance(captive, entity(run.room, "exit")!) <= 1) run.room.solved = true;
  if (run.room.goal === "story" && (!relay?.active || run.reports.some(r => r.room === run.room.index && r.delivered !== null))) run.room.solved = true;
  if (run.room.hazards.some(h => equalPoint(h, p))) run.player.hp = Math.max(0, run.player.hp - 2);
  if (run.room.family === "echo" && guardian && guardian.hp <= 0 && !run.room.solved) {
    run.room.solved = true; run.echoes++;
    run.relic.line = "It had an explanation for you. We had a way forward.";
    run.notice = "The Echo broke. The stairs continue beneath the conclusion.";
  }
  if (run.player.hp <= 0) { run.status = "fallen"; run.notice = "The relic keeps your memory warm. You can return with a scar."; }
}

function teach(run: Run, id: PrincipleId, scope: Scope, correction: boolean): boolean {
  if (!Object.hasOwn(PRINCIPLES, id) || !["always", "innocent-at-risk", "no-one-else-hurt", "suspicious-offer"].includes(scope)) return false;
  const existing = run.relic.principles.find(p => p.id === id);
  if (correction && !existing) return false;
  if (!correction && existing) return false;
  const fact = record(run, { actor: "player", kind: correction ? "correction" : "teaching", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: existing?.examples.slice(-1) ?? [], text: `${correction ? "Corrected" : "Learned"}: ${PRINCIPLES[id].title}. Applies: ${scope}.` });
  if (existing) {
    existing.scope = scope; existing.interpretation = PRINCIPLES[id].interpretation; existing.corrections.push(fact.id); existing.confidence = Math.min(0.96, existing.confidence + 0.12);
    existing.counterexamples.push(...existing.examples.slice(-1));
    run.relic.misunderstanding = false;
    run.relic.line = "I made one moment into a rule. That is how it learns. I do not want to become it.";
  } else {
    run.relic.principles.push({ id, scope, interpretation: PRINCIPLES[id].interpretation, confidence: 0.55, examples: [fact.id], counterexamples: [], corrections: [], conflicts: [], priority: run.relic.principles.length === 0 ? 2 : 1 });
    run.relic.line = PRINCIPLES[id].interpretation;
  }
  run.notice = correction ? "The relic learned a narrower, more precise rule." : "The relic learned. The dungeon heard nothing.";
  return true;
}

export function chooseRelicPriority(run: Run) {
  const captive = entity(run.room, "captive"), atRisk = !!captive?.active && !captive.freed;
  return [...run.relic.principles].filter(p => p.scope === "always"
    || p.scope === "innocent-at-risk" && atRisk
    || p.scope === "no-one-else-hurt" && !atRisk
    || p.scope === "suspicious-offer" && run.room.inspected.includes("evidence"))
    .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)[0];
}

function saveManeuver(run: Run, name: string, boundary: Maneuver["boundary"]): boolean {
  const seq = run.lastSequence;
  if (!seq?.success || seq.steps.length < 2 || run.relic.maneuvers.length >= 24 || !["no-harm", "free-target", "none"].includes(boundary)) return false;
  if (boundary === "no-harm" && seq.steps.some(s => ["ATTACK", "STORM"].includes(s.verb))) return false;
  if (boundary === "free-target" && !seq.steps.some(s => s.verb === "RELEASE")) return false;
  const steps = seq.steps.filter(s => !["MOVE", "WAIT", "OBSERVE", "REPORT"].includes(s.verb)).map(s => ({ verb: s.verb, role: entity(run.room, s.target)?.role, signature: s.signature }));
  if (!steps.length) return false;
  const safeName = name.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 42) || "My First Opening";
  const id = `${run.runId}:m${run.relic.maneuvers.length}`;
  run.relic.maneuvers.push({ id, name: safeName, intent: steps.some(s => s.verb === "RELEASE") ? "rescue" : steps.some(s => s.verb === "HIDE") ? "conceal" : "overcome", steps, boundary, examples: [...seq.facts], counterexamples: [], corrections: [], contexts: [run.room.family], cost: seq.cost, risks: ["An object may be destroyed.", "A new witness may see the opening."], signature: steps.some(s => s.verb === "STORM") ? "storm" : steps.some(s => s.verb === "DISTRACT") ? "cunning" : "mercy", confidence: 0.6, uses: 1 });
  record(run, { actor: "relic", kind: "learning", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: seq.facts, text: `Remembered the personal maneuver “${safeName}”.` });
  run.relic.stage = Math.max(1, run.relic.stage) as 1 | 2 | 3;
  run.relic.line = "I want to remember why it worked. Help me if I remember wrong.";
  run.lastSequence = null;
  return true;
}

function descend(run: Run): boolean {
  if (!run.room.solved || distance(playerEntity(run.room), entity(run.room, "exit")!) > 1) return false;
  // Surviving witnesses still have agency while the player leaves; only an open physical route transmits.
  const relay = entity(run.room, "relay");
  if (relay?.active && run.room.index >= 4) for (const w of run.room.entities.filter(e => e.active && e.hp > 0 && ["guardian", "observer"].includes(e.role))) {
    if (pathTo(run.room, w, relay, true).length || distance(w, relay) <= 1) { prepareReport(run, w.id); deliverReports(run, w.id); }
  }
  const index = run.room.index + 1;
  run.room = buildRoom(run.seed, index, run.hypotheses, run.history, run.director);
  run.director = null; run.history.push(run.room.family); run.player.hiddenUntil = -1;
  run.player.hp = Math.min(run.player.maxHp, run.player.hp + 6);
  run.relic.energy = Math.min(20, run.relic.energy + 8);
  if (index % 3 === 0) run.player.potions = Math.min(4, run.player.potions + 1);
  run.activePlan = null; run.lastSequence = null; run.recentSteps = []; run.recentFacts = [];
  if (index === 2) {
    run.relic.stage = 1; run.relic.misunderstanding = true;
    const lesson = run.relic.principles[0];
    if (lesson) { lesson.scope = "always"; lesson.interpretation = "If no one dies, we have helped enough. We can leave the captive waiting."; }
    run.relic.line = "No one died last time. I thought that meant we had done enough.";
    // A real wrong generalization: the relic initially shields the guardian instead of helping the captive.
    const guardian = entity(run.room, "guardian")!; guardian.protected = 4;
    record(run, { actor: "relic", kind: "choice", at: guardian, cost: 0, value: 4, private: false, sources: lesson?.examples.slice(-1) ?? [], text: "The relic shielded the guard and left the captive waiting." });
  } else if (index === 4) { run.relic.stage = 2; run.relic.line = "It only writes down what it sees. We need not show it everything."; }
  else if (index === 6) run.relic.line = run.room.adaptation ? "Someone built an expectation into the stone. Look at what they left open." : "It knows too little yet. We can choose what it sees.";
  else if (index === 8 || index === 9) {
    const priority = chooseRelicPriority(run);
    const principle = priority && ["protect", "no-harm", "promise", "last-potion"].includes(priority.id) ? priority : undefined;
    if (!run.relic.principles.some(p => p.id === "survive")) {
      const previousHarm = run.facts.filter(f => f.kind === "harm").slice(-1).map(f => f.id);
      const learned = record(run, { actor: "relic", kind: "learning", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: previousHarm, text: "The journey taught the relic that your survival is its responsibility, too." });
      run.relic.principles.push({ id: "survive", scope: "no-one-else-hurt", interpretation: PRINCIPLES.survive.interpretation, confidence: 0.4, examples: [learned.id], counterexamples: [], corrections: [], conflicts: principle ? [principle.id] : [], priority: 0 });
    }
    const sources = principle ? [...principle.examples.slice(-1), ...principle.corrections.slice(-1)] : run.relic.principles[0]?.examples.slice(-1) ?? [];
    run.relic.pendingChoice = { protect: !!principle, sources };
    if (principle) principle.conflicts.push("survive");
    run.relic.line = "Two of your rules point in different directions. I think I know where I must go.";
  } else if (run.room.family === "echo") run.relic.line = "There is its conclusion. Let us show it what a conclusion leaves out.";
  run.notice = run.room.objective; roomFact(run);
  return true;
}

/** Deterministic transaction; rejected commands preserve object identity. */
export function transition(original: Run, command: Command, expectedRevision = original.revision, journal = true): Run {
  if (expectedRevision !== original.revision || !command || typeof command !== "object") return original;
  if (original.status === "fallen" && command.type !== "recover") return original;
  const run = clone(original);
  let accepted = true;
  switch (command.type) {
    case "teach": accepted = teach(run, command.principle, command.scope, false); break;
    case "correct":
      accepted = teach(run, command.principle, command.scope, true);
      if (accepted) { const guardian = entity(run.room, "guardian"); if (guardian) guardian.protected = 0; }
      break;
    case "commit": {
      const plan = command.plan;
      if (!plan || !currentBinding(original, plan.binding) || !Array.isArray(plan.steps) || !plan.steps.length || plan.steps.length > 48 || !plan.steps.every(isOperation)
        || !["no-harm", "free-target", "none"].includes(plan.boundary)
        || plan.boundary === "no-harm" && plan.steps.some(s => ["ATTACK", "STORM"].includes(s.verb))
        || plan.boundary === "free-target" && !plan.steps.some(s => s.verb === "RELEASE")
        || operationError(run, plan.steps[0])) return original;
      run.activePlan = { plan: clone(plan), cursor: 0, startedAt: run.tick, facts: [], interrupted: null };
      run.notice = "The plan is yours. Each step happens on the floor, one turn at a time.";
      break;
    }
    case "step": case "act": {
      const active = run.activePlan;
      if (command.type === "step" && (!active || active.interrupted || active.cursor >= active.plan.steps.length)) return original;
      const operation = command.type === "act" ? command.operation : active!.plan.steps[active!.cursor];
      const error = operationError(run, operation);
      if (error) {
        if (command.type === "act") return original;
        active!.interrupted = error;
        record(run, { actor: "world", kind: "interrupt", at: playerEntity(run.room), cost: 0, value: 0, private: false, sources: [...active!.facts], text: `The plan was interrupted: ${error}` });
        run.notice = error; break;
      }
      if (command.type === "act") run.activePlan = null;
      const beforeEnergy = run.relic.energy;
      const fact = execute(run, operation);
      run.recentSteps.push(clone(operation)); run.recentFacts.push(fact.id);
      if (command.type === "step") { active!.cursor++; active!.facts.push(fact.id); }
      if (operation.verb !== "OBSERVE") environmentTurn(run);
      if (command.type === "step" && active!.cursor === active!.plan.steps.length) {
        const success = active!.plan.boundary !== "free-target" || !!entity(run.room, "captive")?.freed;
        run.lastSequence = { steps: clone(active!.plan.steps), facts: [...active!.facts], success, cost: run.facts.filter(f => active!.facts.includes(f.id)).reduce((n, f) => n + f.cost, 0) };
        if (active!.plan.maneuverId) {
          const maneuver = run.relic.maneuvers.find(m => m.id === active!.plan.maneuverId);
          if (maneuver && success) {
            maneuver.uses++; maneuver.examples.push(...active!.facts);
            if (!maneuver.contexts.includes(run.room.family)) {
              maneuver.contexts.push(run.room.family);
              const learned = record(run, { actor: "relic", kind: "learning", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: [...maneuver.examples.slice(0, 2), ...active!.facts], text: `“${maneuver.name}” worked with new objects in ${run.room.family}.` });
              run.chills.understood = learned.id;
              run.relic.line = "Another room. The same reason. I think I understand the difference now.";
            }
          }
        }
        run.activePlan = null;
      } else if (command.type === "act" && (operation.verb === "RELEASE" || run.room.solved)) {
        run.lastSequence = { steps: clone(run.recentSteps), facts: [...run.recentFacts], success: true, cost: beforeEnergy - run.relic.energy };
      }
      break;
    }
    case "cancel": if (!run.activePlan) return original; run.activePlan = null; run.notice = "The completed steps remain. The rest of the plan is set aside."; break;
    case "save-maneuver": accepted = saveManeuver(run, command.name, command.boundary); break;
    case "correct-maneuver": {
      const maneuver = run.relic.maneuvers.find(m => m.id === command.id);
      if (!maneuver || !["no-harm", "free-target", "none"].includes(command.boundary)) return original;
      if (command.boundary === "no-harm" && maneuver.steps.some(s => ["ATTACK", "STORM"].includes(s.verb))) return original;
      const fact = record(run, { actor: "player", kind: "correction", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: maneuver.examples.slice(0, 2), text: `Corrected “${maneuver.name}”: the captive must go free, and the guard must live.` });
      maneuver.boundary = command.boundary; maneuver.corrections.push(fact.id); maneuver.confidence = Math.min(0.95, maneuver.confidence + 0.1);
      if (!maneuver.steps.some(s => s.verb === "RELEASE") && command.boundary !== "none") maneuver.steps.push({ verb: "RELEASE", role: "captive" });
      run.relic.misunderstanding = false; run.relic.line = "Not just silence. Freedom. I will remember who the silence is for.";
      break;
    }
    case "override":
      if (!run.relic.pendingChoice || run.relic.energy < 4 || run.relic.trust < 1) return original;
      record(run, { actor: "player", kind: "choice", at: playerEntity(run.room), cost: 4, value: 1, private: true, sources: run.relic.pendingChoice.sources, text: "Overruled the relic's choice. Lost 4 energy and 1 trust." });
      run.relic.pendingChoice = null; run.relic.energy -= 4; run.relic.trust--; run.relic.line = "I hear you. I am not sure I agree."; break;
    case "descend": accepted = descend(run); break;
    case "director":
      if (!["bell", "kiln", "archive", "bridge", "garden", "tribunal", "reservoir"].includes(command.family) || run.history.slice(-3).includes(command.family)) return original;
      run.director = command.family; break;
    case "favor": {
      const relationship = run.relationships.find(r => r.id === command.relationshipId);
      if (!relationship || relationship.debt < 1 || !["supplies", "silence"].includes(command.help) || run.room.index < 4
        || run.facts.some(f => f.room === run.room.index && f.actor === relationship.id && f.kind === "choice")) return original;
      if (command.help === "supplies" && run.player.potions >= 4 || command.help === "silence" && !entity(run.room, "relay")?.active) return original;
      relationship.debt--;
      if (command.help === "supplies") run.player.potions++;
      else { entity(run.room, "relay")!.active = false; for (const report of run.reports.filter(r => r.room === run.room.index && r.delivered === null)) report.intercepted = true; }
      record(run, { actor: relationship.id, kind: "choice", at: entity(run.room, command.help === "silence" ? "relay" : "player")!, cost: 1, value: 1, private: false, sources: relationship.witnessed.slice(-1), text: `${relationship.name} repaid a favour: ${command.help === "silence" ? "the report conduit was closed from the other side" : "a potion waited in the alcove"}.` });
      run.notice = "Someone remembered what you did. The room is different because of it.";
      break;
    }
    case "recover":
      if (run.status !== "fallen") return original;
      run.status = "playing"; run.player.hp = 24; run.relic.energy = 12;
      run.scars.push(record(run, { actor: "world", kind: "scar", at: playerEntity(run.room), cost: 0, value: 1, private: true, sources: [], text: "Returned with a scar. The relic and the witnesses kept their memories." }).id);
      run.room = buildRoom(run.seed, run.room.index, run.hypotheses, run.history.slice(0, -1)); run.activePlan = null; run.player.hiddenUntil = -1; break;
    default: return original;
  }
  if (!accepted) return original;
  run.revision++;
  if (journal) run.journal.push({ revision: original.revision, command: clone(command) });
  return run;
}

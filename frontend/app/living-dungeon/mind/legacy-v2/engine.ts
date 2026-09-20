import { COMPONENTS, PRINCIPLES } from "./catalogue";
import { deliverReports, prepareReport, record } from "./knowledge";
import { currentBinding, isOperation } from "./protocol";
import type { Command, Fact, Maneuver, Operation, PrincipleId, Run, Scope, Signature } from "./types";
import { buildRoom, byRole, canSee, distance, entity, equalPoint, lineOfSight, passable, pathTo, playerEntity } from "./world";

const clone = <T,>(value: T): T => structuredClone(value);
export function createRun(seed: number, runId: string): Run {
  const room = buildRoom(seed, 0, [], []);
  const run: Run = { version: 2, rules: "mind-beneath-1", runId, seed: seed >>> 0, rng: seed >>> 0 || 1, revision: 0, tick: 0, room, player: { hp: 40, maxHp: 40, potions: 3, hiddenUntil: -1 }, relic: { stage: 0, energy: 16, trust: 5, principles: [], maneuvers: [], line: "Jeg kjenner vekten av hånden din. Ikke hvorfor den skjelver. Hva skal jeg huske først?", misunderstanding: false, pendingChoice: null, lastChoice: null }, facts: [], observations: [], beliefs: [], reports: [], hypotheses: [], relationships: [], scars: [], history: [room.family], journal: [], activePlan: null, lastSequence: null, recentSteps: [], recentFacts: [], status: "playing", echoes: 0, chills: { understood: null, mistaken: null, divergence: null }, director: null, notice: "Lær relikvien ett prinsipp. Ordene blir mellom dere." };
  roomFact(run);
  return run;
}
function roomFact(run: Run) {
  record(run, { actor: "world", kind: "room", at: playerEntity(run.room), cost: 0, value: run.room.index, private: false, sources: [], text: `Gikk inn i ${run.room.title}.` });
  if (run.room.adaptation) record(run, { actor: "mind", kind: "countermeasure", at: { x: 7, y: 3 }, cost: 0, value: 0, private: false, sources: run.room.adaptationSources, text: `Rommet er bygget for ${run.room.adaptation}.` });
  for (const component of run.room.components) record(run, { actor: "mind", kind: "countermeasure", at: { x: 7, y: 4 }, cost: component.cost, value: 0, private: false, sources: component.sources, text: `${COMPONENTS[component.id].name}: ${COMPONENTS[component.id].effect}` });
}
function random(run: Run): number {
  let n = run.rng; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; run.rng = n >>> 0;
  return run.rng / 4294967296;
}
export function operationError(run: Run, op: Operation): string | null {
  if (!isOperation(op)) return "Handlingen finnes ikke i dette rommet.";
  if (run.status !== "playing") return "Ekspedisjonen trenger et hvilested.";
  if (!run.relic.principles.length && op.verb !== "OBSERVE") return "Lær relikvien ett prinsipp først.";
  const p = playerEntity(run.room), target = entity(run.room, op.target);
  if (op.verb === "MOVE") return !op.at || distance(p, op.at) !== 1 || !passable(run.room, op.at) ? "Velg en ledig rute ved siden av deg." : null;
  if (["WAIT", "POTION", "HIDE", "RETREAT"].includes(op.verb)) {
    if (op.verb === "POTION" && run.player.potions < 1) return "Ingen helsedrikker igjen.";
    if (op.verb === "POTION" && run.player.hp === run.player.maxHp) return "Du er allerede hel.";
    if (op.verb === "HIDE" && run.room.light && !run.room.shadows.some(s => distance(p, s) <= 1)) return "Gå til en skygge eller slukk lyset først.";
    if (op.verb === "RETREAT" && distance(p, entity(run.room, "exit")!) > 1) return "Du må nå trappen først.";
    return null;
  }
  if (!target?.active || target.hp <= 0) return "Målet er ikke lenger tilgjengelig.";
  if (op.verb === "OBSERVE") return null;
  if (op.verb === "STORM") {
    if (!["guardian", "echo"].includes(target.role)) return "Lynet må rettes mot en motstander.";
    if (run.relic.energy < 4) return "Storm krever 4 relikvieenergi.";
    return distance(p, target) > 6 || !lineOfSight(run.room, p, target) ? "Målet er utenfor lynets rekkevidde eller bak en vegg." : null;
  }
  if (["DISTRACT", "CREATE_NOISE"].includes(op.verb)) {
    if (target.role !== "distraction") return "Dette kan ikke lage en avledning.";
    if (run.relic.energy < 2) return "Avledningen krever 2 energi.";
    return distance(p, target) > 3 || !lineOfSight(run.room, p, target) ? "Kom nærmere avledningen." : null;
  }
  if (op.verb === "INTERRUPT_REPORT") return distance(p, target) > 3 || !["relay", "observer"].includes(target.role) ? "Nå en rapportåre eller skriver innen tre ruter." : run.relic.energy < 2 ? "Å bryte rapporten krever 2 energi." : null;
  if (op.verb === "REPORT") return !["observer", "guardian"].includes(target.role) ? "Velg et vitne som kan fortelle videre." : null;
  if (distance(p, target) > 1) return "Gå inntil målet først.";
  if (op.verb === "ATTACK" && !["guardian", "echo"].includes(target.role)) return "Velg en motstander.";
  if (op.verb === "RELEASE" && (target.role !== "captive" || target.freed)) return "Ingen bundet person å befri her.";
  if (op.verb === "PROTECT" && target.role !== "captive") return "Velg den som trenger vern.";
  if (op.verb === "PROTECT" && run.relic.energy < 2) return "Vern krever 2 energi.";
  if (op.verb === "TRANSFER_ITEM" && (target.role !== "captive" || run.player.potions < 1)) return "Du trenger en helsedrikk og noen å gi den til.";
  if (op.verb === "EXTINGUISH_LIGHT" && (target.role !== "light" || !run.room.light)) return "Lyset er allerede slukket.";
  if (["REVEAL_EVIDENCE", "PLANT_EVIDENCE"].includes(op.verb) && target.role !== "evidence") return "Du trenger vitneseglet.";
  if (op.verb === "PLANT_EVIDENCE" && run.relic.energy < 3) return "Et falskt spor krever 3 energi.";
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
    if (thread) record(run, { actor: "world", kind: "echo-break", at: echo, cost: 0, value: 12, private: false, sources: [fact.id, ...run.room.components.filter(c => c.id === "hostage-thread").flatMap(c => c.sources)], text: "Den frie fangen river gisseltråden ut av ekkoet. Skjoldet kollapser fysisk." });
  }
}
function execute(run: Run, op: Operation): Fact {
  const p = playerEntity(run.room), target = entity(run.room, op.target);
  let fact: Fact;
  const hidden = run.player.hiddenUntil >= run.tick;
  const witnesses = run.room.entities.filter(e => canSee(run.room, e, p, hidden)).map(e => e.id);
  const observedFact = (run: Run, op: Operation, text: string, cost: number, signature?: Signature, value = 0, sources: string[] = []) => actionFact(run, op, text, cost, signature, value, sources, witnesses);
  switch (op.verb) {
    case "MOVE": p.x = op.at!.x; p.y = op.at!.y; fact = observedFact(run, op, "Flyttet én rute.", 0); break;
    case "OBSERVE":
      if (!run.room.inspected.includes(target!.id)) run.room.inspected.push(target!.id);
      fact = observedFact(run, op, `Undersøkte ${target!.name}.`, 0);
      break;
    case "ATTACK": case "STORM": {
      const storm = op.verb === "STORM", ward = run.room.disruptionUntil <= run.tick && run.room.components.some(c => c.id === (storm ? "storm-ward" : "iron-mirror"));
      const rawDamage = storm ? ward ? 2 : 8 : ward && !hidden ? 2 : hidden ? 9 : 5 + Math.floor(random(run) * 2);
      const damage = target!.protected > 0 ? Math.max(1, rawDamage - 3) : rawDamage;
      if (storm) run.relic.energy -= 4;
      target!.hp = Math.max(0, target!.hp - damage);
      run.room.alert = 3;
      fact = observedFact(run, op, `${storm ? "Storm" : hidden ? "Et skjult angrep" : "Et sverdslag"} traff ${target!.name} for ${damage}.`, storm ? 4 : 2, storm ? "storm" : "force", damage);
      if (!storm && hidden && run.room.components.some(c => c.id === "storm-ward") && run.hypotheses.some(h => h.claim === "storm" && h.confidence >= 0.48)) {
        run.chills.mistaken = fact.id;
        run.relic.line = "Alt vernet peker mot lynet. Du lærte meg å se etter den andre veien.";
      }
      run.player.hiddenUntil = -1;
      if (target!.hp === 0) target!.active = false;
      break;
    }
    case "POTION":
      run.player.potions--; run.player.hp = Math.min(run.player.maxHp, run.player.hp + 16);
      fact = observedFact(run, op, "Drakk en helsedrikk. Den er borte for godt.", 5, "self-preservation", 16);
      if (run.room.components.some(c => c.id === "thirst-trap")) run.room.hazards.push({ x: p.x, y: p.y });
      break;
    case "PROTECT":
      target!.protected = 5; run.relic.energy -= 2;
      fact = observedFact(run, op, `Stilte deg mellom faren og ${target!.name}.`, 3, "mercy"); break;
    case "DISTRACT": case "CREATE_NOISE": {
      run.relic.energy -= 2;
      const guardian = entity(run.room, "guardian");
      if (guardian?.active) { guardian.distracted = 6; guardian.goal = { x: target!.x, y: target!.y }; }
      fact = observedFact(run, op, `${target!.name} trakk vokterens oppmerksomhet.`, 2, "cunning");
      if (run.room.components.some(c => c.id === "echo-snare") && target!.id === "distraction") {
        run.player.hp = Math.max(0, run.player.hp - 6); run.room.alert = 3;
        run.notice = "Ekkoet kjente igjen den synlige avledningen. Fellen kostet 6 liv.";
      }
      break;
    }
    case "HIDE": run.player.hiddenUntil = run.tick + 6; fact = observedFact(run, op, "Forsvant i skyggen. Nære vitner kan fortsatt se deg.", 0); break;
    case "EXTINGUISH_LIGHT": run.room.light = false; fact = observedFact(run, op, `Slukket ${target!.name}. Synsfeltene krympet.`, 1, "cunning"); break;
    case "RELEASE":
      fact = observedFact(run, op, `Frigjorde ${target!.name}.`, 3, "mercy"); freeCaptive(run, fact); break;
    case "TRANSFER_ITEM":
      run.player.potions--; target!.hp = target!.maxHp; target!.protected = 5;
      fact = observedFact(run, op, `Ga en uerstattelig helsedrikk til ${target!.name}.`, 6, "mercy"); break;
    case "INTERRUPT_REPORT": {
      run.relic.energy -= 2;
      for (const report of run.reports.filter(r => r.room === run.room.index && r.delivered === null && (target!.role === "relay" || r.originator.endsWith(`:${target!.id}`)))) report.intercepted = true;
      if (target!.role === "relay") target!.active = false;
      else { target!.distracted = 5; target!.intent = "watch"; }
      fact = observedFact(run, op, target!.role === "relay" ? "Brøt rapportåren. Denne veien til dungeonen er stengt." : "Stanset skriveren. Den husker fortsatt det den så.", 2, "cunning"); break;
    }
    case "REPORT":
      prepareReport(run, target!.id); target!.intent = "report";
      fact = observedFact(run, op, `Lot ${target!.name} bære sin versjon videre.`, 0); break;
    case "PLANT_EVIDENCE": {
      run.relic.energy -= 3;
      const observed = run.room.entities.some(e => canSee(run.room, e, p, hidden));
      target!.suspicious = observed;
      fact = observedFact(run, op, observed ? "Et vitne så deg forfalske seglet. Sporet mistet troverdighet." : "La et falskt vitnesegl i skyggen. Det trenger et vitne som finner det.", 3, op.signature ?? "storm");
      // A forged trace is distinct from the observed act of forging it.
      target!.goal = { x: observed ? 1 : 0, y: ["storm", "mercy", "force", "cunning", "self-preservation"].indexOf(op.signature ?? "storm") };
      break;
    }
    case "REVEAL_EVIDENCE":
      fact = observedFact(run, op, "Viste vitneseglet. En påstand er ennå ikke en sikker historie.", 0);
      if (run.room.goal === "evidence") {
        run.room.solved = true;
        run.relic.energy = Math.min(20, run.relic.energy + 3);
        run.relic.line = "Det fjernet minnet fordi det ikke passet med forklaringen. Vi tar det med.";
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
      fact = observedFact(run, op, "Valgte trappen. De som ble igjen, får sin egen historie.", 3, "self-preservation"); break;
    default: fact = observedFact(run, op, "Lot et øyeblikk gå.", 0);
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
    const fact = record(run, { actor: "relic", kind: "choice", at: captive, target: captive.id, signature: "mercy", cost: 7, value: 4, private: false, sources: choice.sources, text: "Relikvien fløy til den fangede og tok slaget med sitt lys. Du mistet 4 liv; den brukte 3 energi." });
    run.relic.lastChoice = fact.id; run.relic.line = "Jeg visste hva du ville be meg om. Jeg gikk til den andre likevel.";
  } else {
    p.protected = 6;
    const fact = record(run, { actor: "relic", kind: "choice", at: p, cost: 2, value: 0, private: true, sources: choice.sources, text: "Relikvien valgte å skjerme deg. Den fangede måtte vente." });
    run.relic.energy = Math.max(0, run.relic.energy - 2); run.relic.lastChoice = fact.id;
    run.relic.line = "Jeg valgte deg. Jeg vet ikke om jeg får kalle det riktig.";
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
  const fact = record(run, { actor: "relic", kind: "learning", at: resonator, operation: { verb: "DISTRACT", target: resonator.id }, target: resonator.id, cost: 4, value: 8, private: false, sources, text: `Relikvien brukte prinsippet i «${maneuver.name}» på skyggens resonator. Ekkoet vendte seg bort. Åtte turer er dine.` });
  run.chills.understood = fact.id; maneuver.contexts.push("echo"); maneuver.uses++;
  run.relic.line = "Det var aldri klokken. Det var hvem du ville få fri.";
  if (run.room.components.length) {
    run.chills.mistaken = fact.id;
    const divergence = record(run, { actor: "world", kind: "echo-break", at: guardian, cost: 0, value: 8, private: false, sources: [fact.id, ...run.room.components.flatMap(c => c.sources)], text: "Ekkoet vokter den offentlige strategien. Relikvien åpnet den skjulte veien. Vernet slukner mens ekkoet snur seg." });
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
        record(run, { actor: guardian.id, kind: "harm", at: p, target: "player", cost: 0, value: damage, private: false, sources: [], text: `${guardian.name} svarte. Du mistet ${damage} liv.` });
      } else if (visible) { const next = pathTo(run.room, guardian, p, true)[0]; if (next) Object.assign(guardian, next); }
      if (run.room.index > 2 && run.room.turn % 7 === 0) {
        const object = byRole(run.room, "distraction");
        if (object && distance(guardian, object) <= 1) {
          object.active = false; run.notice = `${guardian.name} ødela ${object.name}. Planen må endres.`;
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
      const fact = record(run, { actor: "world", kind: "scar", at: captive, cost: 0, value: 1, private: false, sources: run.relic.lastChoice ? [run.relic.lastChoice] : [], text: `${captive.name} overlevde ikke ventingen.` });
      run.scars.push(fact.id); run.relic.line = "Jeg telte turene. Jeg skulle ha telt hvem de tilhørte.";
    }
  }
  if (captive?.freed) { const next = pathTo(run.room, captive, entity(run.room, "exit")!, true)[0]; if (next) Object.assign(captive, next); }
  if (run.room.goal === "escort" && captive?.freed && distance(captive, entity(run.room, "exit")!) <= 1) run.room.solved = true;
  if (run.room.goal === "story" && (!relay?.active || run.reports.some(r => r.room === run.room.index && r.delivered !== null))) run.room.solved = true;
  if (run.room.hazards.some(h => equalPoint(h, p))) run.player.hp = Math.max(0, run.player.hp - 2);
  if (run.room.family === "echo" && guardian && guardian.hp <= 0 && !run.room.solved) {
    run.room.solved = true; run.echoes++;
    run.relic.line = "Det hadde en forklaring på deg. Vi hadde en vei videre.";
    run.notice = "Ekkoet brast. Trappen fortsetter under konklusjonen.";
  }
  if (run.player.hp <= 0) { run.status = "fallen"; run.notice = "Relikvien holder minnet ditt varmt. Du kan vende tilbake med et arr."; }
}

function teach(run: Run, id: PrincipleId, scope: Scope, correction: boolean): boolean {
  if (!Object.hasOwn(PRINCIPLES, id) || !["always", "innocent-at-risk", "no-one-else-hurt", "suspicious-offer"].includes(scope)) return false;
  const existing = run.relic.principles.find(p => p.id === id);
  if (correction && !existing) return false;
  if (!correction && existing) return false;
  const fact = record(run, { actor: "player", kind: correction ? "correction" : "teaching", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: existing?.examples.slice(-1) ?? [], text: `${correction ? "Korrigerte" : "Lærte"}: ${PRINCIPLES[id].title}. Omfang: ${scope}.` });
  if (existing) {
    existing.scope = scope; existing.interpretation = PRINCIPLES[id].interpretation; existing.corrections.push(fact.id); existing.confidence = Math.min(0.96, existing.confidence + 0.12);
    existing.counterexamples.push(...existing.examples.slice(-1));
    run.relic.misunderstanding = false;
    run.relic.line = "Jeg gjorde ett øyeblikk til en regel. Det er slik den lærer. Jeg vil ikke bli den.";
  } else {
    run.relic.principles.push({ id, scope, interpretation: PRINCIPLES[id].interpretation, confidence: 0.55, examples: [fact.id], counterexamples: [], corrections: [], conflicts: [], priority: run.relic.principles.length === 0 ? 2 : 1 });
    run.relic.line = PRINCIPLES[id].interpretation;
  }
  run.notice = correction ? "Relikvien lærte en smalere, mer presis regel." : "Relikvien lærte. Dungeonen hørte ingenting.";
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
  const safeName = name.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 42) || "Min første åpning";
  const id = `${run.runId}:m${run.relic.maneuvers.length}`;
  run.relic.maneuvers.push({ id, name: safeName, intent: steps.some(s => s.verb === "RELEASE") ? "rescue" : steps.some(s => s.verb === "HIDE") ? "conceal" : "overcome", steps, boundary, examples: [...seq.facts], counterexamples: [], corrections: [], contexts: [run.room.family], cost: seq.cost, risks: ["Et objekt kan bli ødelagt.", "Et nytt vitne kan se åpningen."], signature: steps.some(s => s.verb === "STORM") ? "storm" : steps.some(s => s.verb === "DISTRACT") ? "cunning" : "mercy", confidence: 0.6, uses: 1 });
  record(run, { actor: "relic", kind: "learning", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: seq.facts, text: `Bevarte den personlige manøveren «${safeName}».` });
  run.relic.stage = Math.max(1, run.relic.stage) as 1 | 2 | 3;
  run.relic.line = "Jeg vil huske hvorfor det virket. Hjelp meg hvis jeg husker feil.";
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
    if (lesson) { lesson.scope = "always"; lesson.interpretation = "Hvis ingen dør, har vi hjulpet nok. Vi kan la den fangede vente."; }
    run.relic.line = "Ingen døde sist. Jeg trodde det betydde at vi hadde gjort nok.";
    // A real wrong generalization: the relic initially shields the guardian instead of helping the captive.
    const guardian = entity(run.room, "guardian")!; guardian.protected = 4;
    record(run, { actor: "relic", kind: "choice", at: guardian, cost: 0, value: 4, private: false, sources: lesson?.examples.slice(-1) ?? [], text: "Relikvien la vernet rundt vokteren og lot den fangede vente." });
  } else if (index === 4) { run.relic.stage = 2; run.relic.line = "Den skriver bare ned det den ser. Vi trenger ikke vise den alt."; }
  else if (index === 6) run.relic.line = run.room.adaptation ? "Noen har bygget en forventning inn i steinen. Se hva de lot stå åpent." : "Den vet for lite ennå. Vi kan velge hva den får se.";
  else if (index === 8 || index === 9) {
    const priority = chooseRelicPriority(run);
    const principle = priority && ["protect", "no-harm", "promise", "last-potion"].includes(priority.id) ? priority : undefined;
    if (!run.relic.principles.some(p => p.id === "survive")) {
      const previousHarm = run.facts.filter(f => f.kind === "harm").slice(-1).map(f => f.id);
      const learned = record(run, { actor: "relic", kind: "learning", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: previousHarm, text: "Relikvien lærte fra reisen at din overlevelse også er dens ansvar." });
      run.relic.principles.push({ id: "survive", scope: "no-one-else-hurt", interpretation: PRINCIPLES.survive.interpretation, confidence: 0.4, examples: [learned.id], counterexamples: [], corrections: [], conflicts: principle ? [principle.id] : [], priority: 0 });
    }
    const sources = principle ? [...principle.examples.slice(-1), ...principle.corrections.slice(-1)] : run.relic.principles[0]?.examples.slice(-1) ?? [];
    run.relic.pendingChoice = { protect: !!principle, sources };
    if (principle) principle.conflicts.push("survive");
    run.relic.line = "To av reglene dine peker hver sin vei. Jeg tror jeg vet hvor jeg må gå.";
  } else if (run.room.family === "echo") run.relic.line = "Der er konklusjonen. La oss vise den hva en konklusjon mangler.";
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
      run.notice = "Planen er din. Hvert steg skjer på gulvet, én tur av gangen.";
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
        record(run, { actor: "world", kind: "interrupt", at: playerEntity(run.room), cost: 0, value: 0, private: false, sources: [...active!.facts], text: `Planen ble avbrutt: ${error}` });
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
              const learned = record(run, { actor: "relic", kind: "learning", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: [...maneuver.examples.slice(0, 2), ...active!.facts], text: `«${maneuver.name}» virket med nye objekter i ${run.room.family}.` });
              run.chills.understood = learned.id;
              run.relic.line = "Et annet rom. Den samme grunnen. Jeg tror jeg forstår forskjellen nå.";
            }
          }
        }
        run.activePlan = null;
      } else if (command.type === "act" && (operation.verb === "RELEASE" || run.room.solved)) {
        run.lastSequence = { steps: clone(run.recentSteps), facts: [...run.recentFacts], success: true, cost: beforeEnergy - run.relic.energy };
      }
      break;
    }
    case "cancel": if (!run.activePlan) return original; run.activePlan = null; run.notice = "De utførte stegene står. Resten av planen er lagt bort."; break;
    case "save-maneuver": accepted = saveManeuver(run, command.name, command.boundary); break;
    case "correct-maneuver": {
      const maneuver = run.relic.maneuvers.find(m => m.id === command.id);
      if (!maneuver || !["no-harm", "free-target", "none"].includes(command.boundary)) return original;
      if (command.boundary === "no-harm" && maneuver.steps.some(s => ["ATTACK", "STORM"].includes(s.verb))) return original;
      const fact = record(run, { actor: "player", kind: "correction", at: playerEntity(run.room), cost: 0, value: 0, private: true, sources: maneuver.examples.slice(0, 2), text: `Korrigerte «${maneuver.name}»: personen skal fri, og vokteren skal leve.` });
      maneuver.boundary = command.boundary; maneuver.corrections.push(fact.id); maneuver.confidence = Math.min(0.95, maneuver.confidence + 0.1);
      if (!maneuver.steps.some(s => s.verb === "RELEASE") && command.boundary !== "none") maneuver.steps.push({ verb: "RELEASE", role: "captive" });
      run.relic.misunderstanding = false; run.relic.line = "Ikke bare stillhet. Frihet. Jeg skal huske hvem stillheten er til for.";
      break;
    }
    case "override":
      if (!run.relic.pendingChoice || run.relic.energy < 4 || run.relic.trust < 1) return original;
      record(run, { actor: "player", kind: "choice", at: playerEntity(run.room), cost: 4, value: 1, private: true, sources: run.relic.pendingChoice.sources, text: "Overstyrte relikviens valg. Mistet 4 energi og 1 tillit." });
      run.relic.pendingChoice = null; run.relic.energy -= 4; run.relic.trust--; run.relic.line = "Jeg hører deg. Jeg er ikke sikker på at jeg er enig."; break;
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
      record(run, { actor: relationship.id, kind: "choice", at: entity(run.room, command.help === "silence" ? "relay" : "player")!, cost: 1, value: 1, private: false, sources: relationship.witnessed.slice(-1), text: `${relationship.name} betalte tilbake en tjeneste: ${command.help === "silence" ? "rapportåren ble stengt fra den andre siden" : "en helsedrikk ventet i nisjen"}.` });
      run.notice = "Noen husket det du gjorde. Rommet er annerledes på grunn av det.";
      break;
    }
    case "recover":
      if (run.status !== "fallen") return original;
      run.status = "playing"; run.player.hp = 24; run.relic.energy = 12;
      run.scars.push(record(run, { actor: "world", kind: "scar", at: playerEntity(run.room), cost: 0, value: 1, private: true, sources: [], text: "Vendte tilbake med et arr. Relikvien og vitnene beholdt minnene." }).id);
      run.room = buildRoom(run.seed, run.room.index, run.hypotheses, run.history.slice(0, -1)); run.activePlan = null; run.player.hiddenUntil = -1; break;
    default: return original;
  }
  if (!accepted) return original;
  run.revision++;
  if (journal) run.journal.push({ revision: original.revision, command: clone(command) });
  return run;
}

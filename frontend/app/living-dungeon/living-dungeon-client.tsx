"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DesktopNavigation, KeyboardHint } from "../desktop-navigation";
import { exclusiveSave } from "../descent/save-lock";
import { DungeonScene, type RoomView, type SceneCue } from "../dungeon/scene";
import { MonsterFieldNotes } from "../dungeon/room-parchments";
import { GameLogo } from "../game-logo";
import { CombatActionDock, GameHud } from "../game-ui";
import { useGameAudio } from "../use-game-audio";
import {
  availableLivingDungeonActions,
  bossPreparationClue,
  createLivingDungeon,
  LIVING_DUNGEON_MAX_POTIONS,
  livingDungeonCombatPreview,
  livingDungeonPactEligibility,
  transitionLivingDungeon,
} from "./engine";
import {
  LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS,
  type InterpretPactIntentReply,
  type InterpretPactIntentRequest,
} from "./ai-contract";
import { PACT_RESTRICTIONS } from "./pact-catalogue";
import { eligibleSacrifices } from "./pact-catalogue";
import { explainPact, pactEligibilityDigest } from "./pact-engine";
import {
  PACT_DESIRED_BOONS,
  type PactDesiredBoon,
  type PactIntent,
  type PactSacrifice,
} from "./pact-schema";
import {
  LIVING_DUNGEON_ROOMS,
  currentLivingDungeonRoom,
  type LivingDungeon,
  type LivingDungeonCommand,
  type LivingDungeonEnemyId,
} from "./model";
import {
  LIVING_DUNGEON_SAVE_KEY,
  loadLivingDungeon,
  saveLivingDungeon,
} from "./storage";

const ENEMY_PRESENTATION: Record<LivingDungeonEnemyId, {
  type: 0 | 1 | 2 | 3;
  role: string;
  description: string;
}> = {
  "grave-attendant": {
    type: 0,
    role: "Undead usher",
    description: "It has waited years to ask whether you have an appointment.",
  },
  "oath-hound": {
    type: 2,
    role: "Pact enforcer",
    description: "It can smell a broken promise. It can also smell fear, but considers that less binding.",
  },
  "dungeon-scrivener": {
    type: 1,
    role: "Witness",
    description: "It records what you do, then improves the account for management.",
  },
  "keeper-of-conclusions": {
    type: 3,
    role: "Final authority",
    description: "It has already reached a conclusion about you. Accuracy was never required.",
  },
};

const BOON_LABELS: Record<PactDesiredBoon, string> = {
  DEFENSE: "Protection from the boss's first reply",
  DAMAGE: "More damage at the start of the boss fight",
  ENTRY_HEAL: "Healing when the boss room opens",
};

const STANDARD_INTENTS: readonly { title: string; detail: string; intent: PactIntent }[] = [
  {
    title: "A ward for a silent storm",
    detail: "Give up Storm until the boss in exchange for protection from its first retaliation.",
    intent: { desiredBoon: "DEFENSE", offeredSacrifice: "NO_STORM", durationPreference: "UNTIL_BOSS", breachTolerance: "HIGH", needsClarification: false },
  },
  {
    title: "Power carried through pain",
    detail: "Give up voluntary healing in exchange for a stronger opening against the boss.",
    intent: { desiredBoon: "DAMAGE", offeredSacrifice: "NO_VOLUNTARY_HEALING", durationPreference: "UNTIL_BOSS", breachTolerance: "HIGH", needsClarification: false },
  },
  {
    title: "Mercy beyond the empty stall",
    detail: "Buy nothing at camp in exchange for healing when you enter the boss room.",
    intent: { desiredBoon: "ENTRY_HEAL", offeredSacrifice: "NO_CAMP_PURCHASE", durationPreference: "UNTIL_BOSS", breachTolerance: "HIGH", needsClarification: false },
  },
];

type StorageNotice = "restored" | "session" | "invalid" | "unavailable" | "busy" | "conflict" | null;
type LastExchange = { dealt: number; taken: number; critical: boolean };

function storageNoticeCopy(notice: StorageNotice): string {
  if (notice === "restored") return "This expedition was restored from this browser.";
  if (notice === "invalid") return "The saved expedition could not be read and was left untouched. This run is session-only until you start a new expedition.";
  if (notice === "unavailable") return "Browser storage is unavailable. This expedition lasts for the current session.";
  if (notice === "busy") return "Another tab is saving. The last action was not applied; try it again.";
  if (notice === "conflict") return "Another tab changed this expedition. Saving has stopped to protect that newer state.";
  return "Experimental progress is stored separately in this browser.";
}

function newRunIdentity(): { seed: number; runId: string } {
  const values = new Uint32Array(2);
  window.crypto.getRandomValues(values);
  const seed = values[0] >>> 0;
  const runId = window.crypto.randomUUID?.() ?? `living-${Date.now().toString(36)}-${values[1].toString(36)}`;
  return { seed, runId };
}

function offerSeed(run: LivingDungeon, offset = 0): number {
  return (run.seed ^ Math.imul(run.revision + 1 + offset, 0x45d9f3b)) >>> 0;
}

function actionCopy(run: LivingDungeon): { title: string; detail: string } {
  if (run.phase === "explore") return { title: currentLivingDungeonRoom(run).title, detail: "Walk toward the figure to begin. The floor remains yours while you decide." };
  if (run.phase === "pact") return { title: "The room offers terms", detail: "State the exchange you want, choose written terms or leave without a pact." };
  if (run.phase === "camp") return { title: "A convenient temptation", detail: "Spend your gold, or keep your promise and walk away." };
  if (run.phase === "room-cleared") {
    if (run.roomId === "witness" && run.witness.outcome === "SPARED") return { title: "The witness leaves", detail: "It carries only what it saw. Whether it understood is another matter." };
    return { title: "Room secured", detail: "Catch your breath, then walk to the north door." };
  }
  if (run.phase === "won") return { title: "The dungeon heard you", detail: "Your result follows from the promise you made, the actions witnessed and the choice you made at the end." };
  if (run.phase === "lost") return { title: "The dungeon keeps the record", detail: "The expedition ends here, but its cause remains legible." };
  if (run.lastAction === "breach-cancelled") return { title: "The promise holds", detail: "You stepped back before the action became a breach." };
  if (run.pendingBreach) return { title: "This action breaks your pact", detail: "Nothing happens until you confirm the known consequence." };
  if (run.lastAction === "spare-witness") return { title: "Mercy, with an audience", detail: "The Scrivener leaves alive and carrying an opinion." };
  if (run.lastAction === "potion") return { title: "Potion used", detail: "You recover first. The surviving enemy answers according to the active room rules." };
  if (run.lastAction === "storm") return { title: "Storm", detail: "The lightning has made its argument. The dungeon may have taken notes." };
  if (run.lastAction === "attack") return { title: "Attack", detail: "A reliable answer, delivered with steel." };
  return { title: "Your turn", detail: "Attack is steady. Storm can miss. A surviving enemy retaliates." };
}

function factCopy(type: string, valueId: string | null): string {
  const value = valueId?.replaceAll("_", " ").toLocaleLowerCase("en") ?? "";
  if (type === "ROOM_ENTERED") return `Entered ${value || "a new room"}.`;
  if (type === "PACT_ACCEPTED") return "Accepted a pact with explicit terms.";
  if (type === "PACT_DECLINED") return "Walked away from the Pact Room.";
  if (type === "PACT_BREACHED") return "Broke the pact, forfeited its boon and strengthened the boss by 20 HP.";
  if (type === "PACT_COMPLETED") return "Defeated the boss with the pact intact.";
  if (type === "WITNESS_SPARED") return "Spared the Dungeon Scrivener.";
  if (type === "WITNESS_DEFEATED") return "Defeated the Dungeon Scrivener before it could report.";
  if (type === "BOSS_PREPARED") return `The boss prepared: ${value}.`;
  if (type === "CLUE_REVEALED") return "Found a clue to the boss's preparation.";
  if (type === "ENEMY_DEFEATED") return `Defeated ${value || "an enemy"}.`;
  if (type === "CAMP_PURCHASED") return `Bought ${value || "supplies"} at camp.`;
  return type === "PLAYER_ACTION" || type === "ACTION_OBSERVED" ? "" : `${type.replaceAll("_", " ").toLocaleLowerCase("en")}.`;
}

function Progress({ run }: { run: LivingDungeon }) {
  return <ol className="living-dungeon-progress" aria-label={`Expedition progress: scene ${run.stageIndex + 1} of ${LIVING_DUNGEON_ROOMS.length}`}>
    {LIVING_DUNGEON_ROOMS.map((room, index) => <li key={room.id} data-complete={index < run.stageIndex || run.phase === "won" ? "true" : undefined} aria-current={index === run.stageIndex ? "step" : undefined}>
      <strong>{index + 1}. {room.title}</strong>
    </li>)}
  </ol>;
}

function MobileHud({ run, sound, onLog }: {
  run: LivingDungeon;
  sound: ReturnType<typeof useGameAudio>;
  onLog: () => void;
}) {
  const room = currentLivingDungeonRoom(run);
  const pact = run.pact ? explainPact(run.pact) : null;
  const pactStatusLabel = run.pact?.status === "BREACHED"
    ? "Broken pact"
    : run.pact?.status === "COMPLETED"
      ? "Fulfilled pact"
      : "Active pact";
  const soundLabel = !sound.available ? "Sound unavailable" : sound.enabled ? "Mute sound" : "Enable sound";
  return <div className="living-mobile-hud">
    <div className="living-mobile-top">
      <button type="button" onClick={onLog} aria-label="Open expedition record">☰<span className="sr-only">Record</span></button>
      <div className="living-mobile-title"><strong>{room.title}</strong><span>THE LIVING DUNGEON · {run.stageIndex + 1}/6</span></div>
      <button type="button" onClick={sound.toggleSound} disabled={!sound.available} aria-label={soundLabel} aria-pressed={sound.enabled}>{sound.enabled ? "♫" : "♪"}</button>
    </div>
    <div className="living-mobile-vitals">
      <span>HEALTH<strong>❤️ {run.player.hp}/{run.player.maxHp}</strong></span>
      <span>POTIONS<strong>🧪 {run.player.potions}/{LIVING_DUNGEON_MAX_POTIONS}</strong></span>
      <span>GOLD<strong>● {run.player.gold}</strong></span>
      <span>SCENE<strong>{run.stageIndex + 1}/6</strong></span>
    </div>
    <div className="living-mobile-pact">{pact ? `${pactStatusLabel}: ${pact.restriction}` : "No active pact"}</div>
    {run.roomId === "boss" && <div className="living-mobile-clue"><strong>CLUE</strong> {bossPreparationClue(run.bossPreparation)}</div>}
  </div>;
}

function EnemyStatus({ run, retaliation }: { run: LivingDungeon; retaliation: readonly [number, number] }) {
  const enemy = run.encounter;
  if (!enemy) return null;
  const percent = enemy.maxHp > 0 ? Math.max(0, Math.min(100, enemy.hp / enemy.maxHp * 100)) : 0;
  return <section className="living-card living-enemy-status" aria-label="Enemy status">
    <p className="living-card-kicker">{run.roomId === "boss" ? "BOSS" : run.roomId === "witness" ? "WITNESS" : "ENEMY"}</p>
    <header><h2>{enemy.name}</h2><strong>HP {enemy.hp}/{enemy.maxHp}</strong></header>
    <div className="living-health-track" role="progressbar" aria-label={`${enemy.name} health`} aria-valuemin={0} aria-valuemax={enemy.maxHp} aria-valuenow={enemy.hp}><span style={{ width: `${percent}%` }} /></div>
    <p><span>NEXT RETALIATION</span><strong>{retaliation[0]}–{retaliation[1]} DAMAGE</strong></p>
  </section>;
}

function PactStatus({ run }: { run: LivingDungeon }) {
  if (!run.pact) return <section className="living-card living-pact-status"><p className="living-card-kicker">PACT</p><h3>No terms accepted</h3><p className="living-card-copy">The dungeon currently has only the usual ways to disappoint you.</p></section>;
  const card = explainPact(run.pact);
  return <section className="living-card living-pact-status" data-state={run.pact.status.toLocaleLowerCase("en")}>
    <p className="living-card-kicker">{run.pact.status === "ACTIVE" ? "ACTIVE PACT" : run.pact.status === "BREACHED" ? "BROKEN PACT" : "PACT FULFILLED"}</p>
    <h3>{card.title}</h3>
    <dl><dt>Promise</dt><dd>{card.restriction}</dd><dt>Boon</dt><dd>{run.pact.status === "BREACHED" ? "Forfeited." : card.benefit}</dd>{run.pact.status === "BREACHED" && <><dt>Debt</dt><dd>The boss gained 20 current and maximum HP.</dd></>}</dl>
  </section>;
}

function RuleCard({ run, children }: { run: LivingDungeon; children?: ReactNode }) {
  const offer = run.pendingOffer;
  if (!offer) return <section className="living-offer-card" aria-label="Pact terms preview">
    <p className="living-card-kicker">RULE CARD</p><h3>No offer drafted yet</h3>
    <div className="living-rule-list"><div><span>Authority</span><p>Your words can request an exchange. The rules engine writes the actual terms.</p></div><div><span>Before acceptance</span><p>You will see the exact benefit, restriction, duration and breach consequence here.</p></div></div>
  </section>;
  const card = explainPact(offer);
  return <section className="living-offer-card" aria-label="Pact terms preview">
    <p className="living-card-kicker">PROPOSED TERMS</p><h3>{card.title}</h3>
    <div className="living-rule-list">
      <div><span>Benefit</span><p>{card.benefit}</p></div>
      <div><span>Restriction</span><p>{card.restriction}</p></div>
      <div><span>Duration</span><p>{card.duration}</p></div>
      <div><span>If you break it</span><p>{card.breach}</p></div>
      <div><span>Example</span><p>{card.example}</p></div>
    </div>
    {children}
  </section>;
}

function PactRoom({ run, onCommand }: { run: LivingDungeon; onCommand: (command: LivingDungeonCommand) => Promise<boolean> }) {
  const [method, setMethod] = useState<"ai" | "menu">(run.pactInterpretationAttempts >= 2 ? "menu" : "ai");
  const [proposal, setProposal] = useState("");
  const [boon, setBoon] = useState<PactDesiredBoon>("DEFENSE");
  const [sacrifice, setSacrifice] = useState<PactSacrifice>("NO_STORM");
  const [interpreting, setInterpreting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "neutral" | "danger" } | null>(null);
  const latestRun = useRef(run);
  useEffect(() => { latestRun.current = run; }, [run]);
  const snapshot = livingDungeonPactEligibility(run);
  const sacrifices = eligibleSacrifices(snapshot);
  const canPrepare = run.pactOfferAttempts < 2;
  const aiAvailable = canPrepare && run.pactInterpretationAttempts < 2;

  const prepare = async (intent: PactIntent, seed = offerSeed(run)) => {
    if (!canPrepare) { setNotice({ text: "You have already revised these terms once. Accept them or leave the room.", tone: "danger" }); return; }
    const changed = await onCommand({ type: "prepare-pact", intent, offerSeed: seed });
    setNotice(changed
      ? { text: run.pendingOffer ? "The revised terms are shown on the rule card." : "The dungeon has translated your request into exact terms.", tone: "neutral" }
      : { text: "Those terms could not be formed from the current rules. Choose another exchange.", tone: "danger" });
  };

  const interpret = async () => {
    const text = proposal.trim();
    if (!text || interpreting || !aiAvailable) return;
    if (sacrifices.length === 0) { setMethod("menu"); setNotice({ text: "No meaningful sacrifice is currently available.", tone: "danger" }); return; }
    setInterpreting(true);
    const beforeAttempt = latestRun.current;
    const attemptCommand = { type: "record-pact-interpretation" } as const;
    const captured = transitionLivingDungeon(beforeAttempt, attemptCommand, beforeAttempt.revision);
    const attemptRecorded = captured !== beforeAttempt && await onCommand(attemptCommand);
    if (!attemptRecorded) {
      setMethod("menu");
      setNotice({ text: "The interpretation limit has been reached. Choose the exact terms below.", tone: "neutral" });
      setInterpreting(false);
      return;
    }
    latestRun.current = captured;
    const capturedSnapshot = livingDungeonPactEligibility(captured);
    const seed = offerSeed(captured, captured.pactOfferAttempts);
    const body: InterpretPactIntentRequest = {
      proposal: text,
      eligibility: { desiredBoons: PACT_DESIRED_BOONS, sacrifices },
      runRevision: captured.revision,
      stateDigest: pactEligibilityDigest(capturedSnapshot),
      offerSeed: seed,
    };
    setNotice({ text: "The dungeon is considering what you meant…", tone: "neutral" });
    try {
      const response = await fetch("/api/living-dungeon/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("interpretation rejected");
      const reply = await response.json() as InterpretPactIntentReply;
      const current = latestRun.current;
      if (current.revision !== reply.binding.runRevision
        || pactEligibilityDigest(livingDungeonPactEligibility(current)) !== reply.binding.stateDigest) {
        setNotice({ text: "The room changed before the answer returned. Try once more with the current state.", tone: "danger" });
        return;
      }
      if (reply.status === "fallback") {
        setMethod("menu");
        setNotice({ text: "Interpretation is unavailable, so every legal written option is ready below.", tone: "neutral" });
        return;
      }
      if (reply.intent.needsClarification) {
        if (current.pactClarificationAttempts >= 1) {
          setMethod("menu");
          setNotice({ text: "The request is still ambiguous. Choose the exact terms below.", tone: "neutral" });
        } else {
          const recorded = await onCommand({ type: "record-pact-clarification" });
          setNotice(recorded
            ? { text: "Name both the power you want and what you are willing to give up. You may clarify once.", tone: "neutral" }
            : { text: "The room could not record that clarification. Choose the exact terms below.", tone: "danger" });
          if (!recorded) setMethod("menu");
        }
        return;
      }
      await prepare(reply.intent, reply.binding.offerSeed);
    } catch {
      setMethod("menu");
      setNotice({ text: "Interpretation could not finish. The complete written terms remain available.", tone: "neutral" });
    } finally {
      setInterpreting(false);
    }
  };

  return <section className="living-scene-panel" aria-labelledby="living-pact-title">
    <header><div><p>SCENE 2 · THE PACT ROOM</p><h2 id="living-pact-title">Shape the rule you must survive</h2></div><span>The language can be yours. The numbers and consequences remain fixed, visible rules.</span></header>
    <div className="living-pact-workbench">
      <div className="living-pact-input">
        <div className="living-pact-tabs" role="group" aria-label="Choose how to form the pact">
          <button type="button" aria-pressed={method === "ai"} disabled={!aiAvailable} onClick={() => setMethod("ai")}>Describe a bargain</button>
          <button type="button" aria-pressed={method === "menu"} onClick={() => setMethod("menu")}>Choose clear terms</button>
        </div>
        {method === "ai" ? <>
          <label htmlFor="living-pact-proposal">What power do you want, and what will you give up?</label>
          <textarea id="living-pact-proposal" maxLength={LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS} value={proposal} disabled={interpreting || !aiAvailable} onChange={event => setProposal(event.target.value)} placeholder="I will leave Storm untouched if you protect me from the boss's first blow." />
          <p className="living-character-count"><span>One or two short sentences</span><span>{Array.from(proposal).length}/{LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS}</span></p>
          <div className="living-suggestions" aria-label="Suggested intentions">
            <button type="button" disabled={!aiAvailable} onClick={() => setProposal("I will give up Storm if you protect me from the boss's first retaliation.")}>More protection</button>
            <button type="button" disabled={!aiAvailable} onClick={() => setProposal("I will carry my wounds without healing if I can strike the boss harder at the start.")}>More damage</button>
            <button type="button" disabled={!aiAvailable} onClick={() => setProposal("I will buy nothing at camp if you restore me when I enter the boss room.")}>Protect my potions</button>
          </div>
          <div className="living-actions" data-keyboard-actions><button type="button" className="living-primary" data-keyboard-default="true" onClick={() => void interpret()} disabled={interpreting || !proposal.trim() || !aiAvailable}>{interpreting ? "INTERPRETING…" : run.pendingOffer ? "REVISE TERMS" : "PROPOSE PACT"}</button></div>
        </> : <>
          <p className="living-card-copy">Choose an authored offer, or combine any currently legal benefit and promise.</p>
          <div className="living-standard-offers" data-keyboard-actions>{STANDARD_INTENTS.map(entry => <button key={entry.title} type="button" onClick={() => void prepare(entry.intent)} disabled={!canPrepare || !sacrifices.includes(entry.intent.offeredSacrifice)}><strong>{entry.title}</strong><span>{entry.detail}</span></button>)}</div>
          <div className="living-menu-grid" style={{ marginTop: 12 }}>
            <label>Benefit<select value={boon} onChange={event => setBoon(event.target.value as PactDesiredBoon)}>{PACT_DESIRED_BOONS.map(id => <option key={id} value={id}>{BOON_LABELS[id]}</option>)}</select></label>
            <label>Promise<select value={sacrifice} onChange={event => setSacrifice(event.target.value as PactSacrifice)}>{sacrifices.map(id => <option key={id} value={id}>{PACT_RESTRICTIONS[id].rule}</option>)}</select></label>
          </div>
          <div className="living-actions" data-keyboard-actions><button type="button" className="living-secondary" data-keyboard-default="true" disabled={!canPrepare || sacrifices.length === 0} onClick={() => void prepare({ desiredBoon: boon, offeredSacrifice: sacrifice, durationPreference: "UNTIL_BOSS", breachTolerance: "HIGH", needsClarification: false })}>{run.pendingOffer ? "REVISE CUSTOM TERMS" : "PREVIEW CUSTOM TERMS"}</button></div>
        </>}
        {notice && <p className="living-ai-status" role="status" data-tone={notice.tone}>{notice.text}</p>}
        <div className="living-actions" data-keyboard-actions><button type="button" className="living-secondary" onClick={() => onCommand({ type: "decline-pact" })}>LEAVE WITHOUT A PACT</button></div>
      </div>
      <RuleCard run={run}>{run.pendingOffer && <div className="living-actions" data-keyboard-actions>
        <button type="button" className="living-primary" data-keyboard-default="true" onClick={() => onCommand({ type: "accept-pact", pactId: run.pendingOffer!.terms.pactId })}>ACCEPT THESE TERMS</button>
      </div>}</RuleCard>
    </div>
  </section>;
}

function CampRoom({ run, onCommand }: { run: LivingDungeon; onCommand: (command: LivingDungeonCommand) => void }) {
  const purchased = run.facts.some(fact => fact.type === "CAMP_PURCHASED");
  return <section className="living-scene-panel" aria-labelledby="living-camp-title">
    <header><div><p>SCENE 5 · A CONVENIENT TEMPTATION</p><h2 id="living-camp-title">The stall is open. So is the loophole.</h2></div><span>Purchases are ordinary actions. If your pact forbids one, the exact consequence appears before anything is spent.</span></header>
    <div className="living-camp-grid" data-keyboard-actions>
      <article className="living-camp-card"><p className="living-card-kicker">BANDAGE · 20 GOLD</p><h3>Recover up to 25 HP</h3><p>One purchase at this camp. It counts as voluntary healing and a purchase.</p><button type="button" className="living-primary" disabled={purchased || run.player.gold < 20 || run.player.hp >= run.player.maxHp} onClick={() => onCommand({ type: "camp-buy", item: "BANDAGE" })}>BUY BANDAGE</button></article>
      <article className="living-camp-card"><p className="living-card-kicker">POTION · 25 GOLD</p><h3>Add one potion</h3><p>One purchase at this camp. The potion itself can still be used in a later fight.</p><button type="button" className="living-primary" disabled={purchased || run.player.gold < 25 || run.player.potions >= LIVING_DUNGEON_MAX_POTIONS} onClick={() => onCommand({ type: "camp-buy", item: "POTION" })}>BUY POTION</button></article>
    </div>
    <div className="living-actions" data-keyboard-actions><button type="button" className="living-secondary" data-keyboard-default="true" onClick={() => onCommand({ type: "camp-skip" })}>{purchased ? "LEAVE CAMP" : "BUY NOTHING · CONTINUE"}</button></div>
  </section>;
}

function BreachDialog({ run, onCommand }: { run: LivingDungeon; onCommand: (command: LivingDungeonCommand) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = run.pendingBreach;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (pending && !element.open) element.showModal();
    if (!pending && element.open) element.close();
  }, [pending]);
  if (!pending || !run.pact) return null;
  const card = explainPact(run.pact);
  const action = pending.action.type === "camp-buy" ? `buy the ${pending.action.item.toLocaleLowerCase("en")}` : `use ${pending.action.type}`;
  return <dialog ref={dialog} className="living-breach-overlay" aria-labelledby="living-breach-title" onCancel={event => { event.preventDefault(); onCommand({ type: "cancel-breach" }); }}>
    <section className="living-breach-dialog"><p className="living-card-kicker">PACT WARNING</p><h2 id="living-breach-title">This breaks your promise</h2>
      <p>You are about to <strong>{action}</strong>. {card.breach}</p>
      <p>No other penalty will be added.</p>
      <div className="living-actions" data-keyboard-actions><button type="button" className="living-secondary" data-keyboard-default="true" autoFocus onClick={() => onCommand({ type: "cancel-breach" })}>KEEP THE PACT</button><button type="button" className="living-danger" onClick={() => onCommand({ type: "confirm-breach" })}>BREAK IT &amp; CONTINUE</button></div>
    </section>
  </dialog>;
}

function RunEnd({ run, onRestart }: { run: LivingDungeon; onRestart: () => void }) {
  const kept = run.pact?.status === "COMPLETED";
  const belief = run.beliefs[0];
  return <section className="living-scene-panel living-run-end" aria-labelledby="living-run-end-title">
    <p className="living-card-kicker">EXPERIMENTAL EXPEDITION COMPLETE</p>
    <h2 id="living-run-end-title">{run.phase === "won" ? "The dungeon heard you." : "The dungeon keeps the record."}</h2>
    <p>{run.phase === "won" ? kept ? "You reached the end without breaking the promise you chose." : run.pact?.status === "BREACHED" ? "You broke your promise knowingly and survived the consequence you saw in advance." : "You refused the pact and survived on your own terms." : "Your choices remain clear, even though the Keeper had the final word."}</p>
    <p>{belief ? `The surviving witness convinced the boss that you ${belief.claimId === "PLAYER_RELIES_ON_STORM" ? "relied on Storm" : belief.claimId === "PLAYER_GUARDS_LIFE" ? "would protect your life" : "avoided Storm"}.` : "No surviving witness carried a useful belief to the boss."}</p>
    <div className="living-actions" data-keyboard-actions><button type="button" className="living-primary" data-keyboard-default="true" onClick={onRestart}>START A NEW EXPEDITION</button><Link className="living-secondary" href="/">ALL MODES</Link></div>
  </section>;
}

function ExpeditionRecord({ run, storageNotice, onClose, onRestart }: { run: LivingDungeon; storageNotice: StorageNotice; onClose: () => void; onRestart: () => void }) {
  const readableFacts = run.facts.map(fact => factCopy(fact.type, fact.valueId)).filter(Boolean);
  return <>
    <header><h2>Expedition record</h2><button type="button" autoFocus onClick={onClose}>Close</button></header>
    <section><p><strong>The Living Dungeon · scene {run.stageIndex + 1}/6</strong></p><ol>{readableFacts.map((fact, index) => <li key={`${index}:${fact}`}>{fact}</li>)}</ol>
      {run.beliefs.length > 0 && <p className="living-card-copy">The witness holds {run.beliefs.length} bounded belief{run.beliefs.length === 1 ? "" : "s"}. Beliefs can influence preparation; they cannot rewrite the record above.</p>}
      <div className="living-actions" data-keyboard-actions><button type="button" className="living-danger" onClick={onRestart}>NEW EXPEDITION</button><Link className="living-secondary" href="/">ALL MODES</Link></div>
      <p className="living-storage-note">{storageNoticeCopy(storageNotice)}</p>
    </section>
  </>;
}

export default function LivingDungeonClient() {
  const [run, setRun] = useState<LivingDungeon | null>(null);
  const [storageNotice, setStorageNotice] = useState<StorageNotice>(null);
  const [cue, setCue] = useState<SceneCue>(null);
  const [cueId, setCueId] = useState(0);
  const [exchange, setExchange] = useState<LastExchange | undefined>();
  const runRef = useRef<LivingDungeon | null>(null);
  const canSaveRef = useRef(false);
  const saveBlockedRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const logDialog = useRef<HTMLDialogElement>(null);
  const audio = useGameAudio({ bossActive: run?.roomId === "boss" && run.phase === "combat", encounter: run?.encounter?.name, encounterKey: run?.roomId });

  const commit = useCallback(async (next: LivingDungeon, previous: LivingDungeon | null, replace = false): Promise<boolean> => {
    if (saveBlockedRef.current && !replace) return false;
    if (saveInFlightRef.current) { setStorageNotice("busy"); return false; }
    saveInFlightRef.current = true;
    try {
      if (canSaveRef.current || replace) {
        const result = await exclusiveSave(
          () => saveLivingDungeon(() => window.localStorage, next, previous, replace),
          undefined,
          LIVING_DUNGEON_SAVE_KEY,
        );
        if (result === "busy") { setStorageNotice("busy"); return false; }
        if (result === "conflict") {
          canSaveRef.current = false;
          saveBlockedRef.current = true;
          setStorageNotice("conflict");
          return false;
        }
        if (result === "unavailable") {
          canSaveRef.current = false;
          setStorageNotice("unavailable");
        } else {
          canSaveRef.current = true;
          saveBlockedRef.current = false;
          setStorageNotice(null);
        }
      }
      runRef.current = next;
      setRun(next);
      return true;
    } finally {
      saveInFlightRef.current = false;
    }
  }, []);

  const createNew = useCallback(async (replace = true) => {
    try {
      const identity = newRunIdentity();
      const next = createLivingDungeon(identity.seed, identity.runId, "ai");
      const committed = await commit(next, runRef.current, replace);
      if (!committed) return;
      setCue(null); setCueId(0); setExchange(undefined);
      logDialog.current?.close();
      audio.playAction("click");
    } catch {
      setStorageNotice("unavailable");
    }
  }, [audio, commit]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void (async () => {
      const loaded = loadLivingDungeon(() => window.localStorage);
      if (loaded.status === "restored") {
        runRef.current = loaded.run; setRun(loaded.run); canSaveRef.current = true; setStorageNotice("restored"); return;
      }
      let next: LivingDungeon;
      try { const identity = newRunIdentity(); next = createLivingDungeon(identity.seed, identity.runId, "ai"); }
      catch { setStorageNotice("unavailable"); return; }
      runRef.current = next; setRun(next);
      if (loaded.status === "empty") {
        const saved = await exclusiveSave(
          () => saveLivingDungeon(() => window.localStorage, next, null, false),
          undefined,
          LIVING_DUNGEON_SAVE_KEY,
        );
        canSaveRef.current = saved === "saved" || saved === "busy";
        saveBlockedRef.current = saved === "conflict";
        setStorageNotice(saved === "saved" ? null : saved === "busy" ? "busy" : saved);
      } else {
        canSaveRef.current = false; setStorageNotice(loaded.status);
      }
    })(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== null && event.key !== LIVING_DUNGEON_SAVE_KEY) return;
      canSaveRef.current = false;
      saveBlockedRef.current = true;
      setStorageNotice("conflict");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);

  const command = useCallback(async (nextCommand: LivingDungeonCommand): Promise<boolean> => {
    const before = runRef.current;
    if (!before) return false;
    audio.playAction("click");
    const breachAction = nextCommand.type === "confirm-breach" ? before.pendingBreach?.action.type : null;
    const next = transitionLivingDungeon(before, nextCommand, before.revision);
    if (next === before) return false;
    const committed = await commit(next, before);
    if (!committed) return false;
    const combatKind = breachAction ?? nextCommand.type;
    if ((combatKind === "attack" || combatKind === "storm" || combatKind === "potion")
      && next.stats.combatTurns > before.stats.combatTurns && next.lastCombatOutcome) {
      const outcome = next.lastCombatOutcome;
      setExchange({ dealt: outcome.damageDealt, taken: outcome.damageTaken, critical: outcome.critical });
      setCue(outcome.critical ? "critical" : outcome.action);
      setCueId(id => id + 1);
    } else {
      setCue(null);
      setExchange(undefined);
    }
    return true;
  }, [audio, commit]);

  const playSceneCueAudio = useCallback((nextCue: Exclude<SceneCue, null>) => {
    audio.playSceneAction(nextCue === "critical" || nextCue === "revive" ? "attack" : nextCue);
    if ((nextCue === "attack" || nextCue === "storm" || nextCue === "critical") && (exchange?.dealt ?? 0) > 0) {
      audio.playOutcome(exchange?.critical ? "critical" : "hit");
    }
  }, [audio, exchange]);

  if (!run) return <main className="descent-shell living-dungeon"><DesktopNavigation /><header className="descent-header"><GameLogo /><span className="descent-edition">THE LIVING DUNGEON</span><Link href="/">All modes</Link></header><section className="living-scene-panel living-run-end" role="status"><p className="living-card-kicker">OPENING THE EXPEDITION</p><h2>The dungeon is remembering where it put the door.</h2></section></main>;

  const room = currentLivingDungeonRoom(run);
  const enemyPresentation = run.encounter ? ENEMY_PRESENTATION[run.encounter.id] : null;
  const roomType = enemyPresentation?.type ?? (run.roomId === "pact-room" ? 3 : 2);
  const scenePhase: RoomView["phase"] = run.phase === "explore" ? "explore" : run.phase === "combat" || run.phase === "pact" || run.phase === "camp" ? "combat" : run.phase === "room-cleared" ? "recovery" : run.phase;
  const roomView: RoomView = {
    room: run.stageIndex + 1,
    seed: run.seed,
    enemy: roomType,
    enemyName: run.encounter?.name ?? "The Living Dungeon",
    enemyHp: run.encounter?.hp ?? 0,
    hp: run.player.hp,
    relic: 0,
    weapon: run.player.weaponLevel,
    armor: run.player.armorLevel,
    phase: scenePhase,
    pending: false,
    cue,
    cueId,
    damage: exchange?.dealt ?? 0,
    incoming: exchange?.taken ?? 0,
  };
  const actions = availableLivingDungeonActions(run);
  const preview = livingDungeonCombatPreview(run);
  const special = run.phase === "pact" || run.phase === "camp" || run.phase === "won" || run.phase === "lost";
  const report = actionCopy(run);
  const mobileHud = <MobileHud run={run} sound={audio} onLog={() => logDialog.current?.showModal()} />;
  const combatDock = run.phase === "combat" && run.encounter ? <div data-keyboard-action-scope>
    <CombatActionDock busy={false} hp={run.player.hp} maxHp={run.player.maxHp} enemyHp={run.encounter.hp} enemyMaxHp={run.encounter.maxHp}
      lastExchange={exchange} retaliation={`${preview.retaliation[0]}–${preview.retaliation[1]}`} stormDamage={`${preview.storm[0]}–${preview.storm[1]}`}
      attackDamage={`${preview.attack[0]}–${preview.attack[1]}`} criticalChance={preview.criticalChance} potionLabel={`🧪 POTION · ${run.player.potions}/${LIVING_DUNGEON_MAX_POTIONS}`}
      potionDetail={`Heal ${preview.potionHeal} HP · enemy retaliates at ${preview.flags.potionRetaliationMode === "FULL" ? "full" : "half"} damage`}
      potionHeal={preview.potionHeal} potionRetaliation={`${preview.potionRetaliation[0]}–${preview.potionRetaliation[1]}`}
      potionRetaliationMode={preview.flags.potionRetaliationMode === "FULL" ? "full" : "half"}
      potionUsage={<>{run.stats.potionsUsed}<span className="block text-[9px] font-normal opacity-70">used this run</span></>}
      potionDisabled={!actions.includes("potion")} potionDisabledReason={run.player.potions === 0 ? "No potions left" : run.player.hp >= run.player.maxHp ? "HP is full" : null}
      onStorm={() => command({ type: "storm" })} onPotion={() => command({ type: "potion" })} onAttack={() => command({ type: "attack" })} />
    {actions.includes("spare-witness") && <div className="living-actions" data-keyboard-actions><button type="button" className="living-secondary" onClick={() => command({ type: "spare-witness" })}>LET THE SCRIVENER LEAVE · IT MAY REPORT WHAT IT SAW</button></div>}
  </div> : undefined;
  const roomNotes = enemyPresentation && run.encounter && run.encounter.hp > 0 ? <MonsterFieldNotes className="room-parchment-monster" monster={{ name: run.encounter.name, role: enemyPresentation.role, description: enemyPresentation.description }} />
    : run.roomId === "boss" ? <MonsterFieldNotes className="room-parchment-monster" monster={{ name: "Observed preparations", role: "Dungeon intelligence", description: bossPreparationClue(run.bossPreparation) }} /> : undefined;

  return <main className="descent-shell living-dungeon" data-descent-phase={!special ? scenePhase : undefined} data-living-special={special ? "true" : undefined} data-run-revision={run.revision} data-player-hp={run.player.hp}>
    <DesktopNavigation />
    <header className="descent-header"><GameLogo /><span className="descent-edition">THE LIVING DUNGEON · EXPERIMENTAL</span><div className="living-dungeon-header-actions"><Link href="/">All modes</Link><button type="button" onClick={audio.toggleSound} disabled={!audio.available}>{audio.enabled ? "♫" : "♪"}<span>{audio.enabled ? "On" : "Off"}</span></button></div></header>
    {special && <div className="living-special-mobile-header">{mobileHud}</div>}
    <div className="dungeon-desktop-status"><GameHud hp={run.player.hp} maxHp={run.player.maxHp} potions={run.player.potions} maxPotions={LIVING_DUNGEON_MAX_POTIONS} gold={run.player.gold} weaponLevel={run.player.weaponLevel} weaponBonus={run.player.weaponLevel * 2} armorLevel={run.player.armorLevel} armorAbsorption={run.player.armorLevel} armorReductionPercent={50} room={run.stageIndex + 1} /></div>
    {(storageNotice === "busy" || storageNotice === "conflict" || storageNotice === "unavailable" || storageNotice === "invalid") && <p className="living-save-notice" role="status">{storageNoticeCopy(storageNotice)}</p>}
    <div className="living-dungeon-heading"><div><p>EXPERIMENTAL STORY RUN · SCENE {run.stageIndex + 1} OF 6</p><h1>{room.title}</h1></div><span>Forge a pact. Leave witnesses. Face what the dungeon thinks it knows.</span></div>
    <Progress run={run} />
    <div className="descent-layout"><div className="descent-world">
      <DungeonScene key={`${run.runId}:${run.roomId}`} view={roomView} actions={{ approach: () => command({ type: "engage" }), enter: () => command({ type: "continue" }) }}
        allowPendingCombatMovement onCueStart={playSceneCueAudio} topOverlay={!special ? mobileHud : undefined} roomNotes={roomNotes}>
        {combatDock ?? (run.phase === "pact" || run.phase === "camp" || run.phase === "won" || run.phase === "lost" ? <span hidden /> : undefined)}
      </DungeonScene>
      {!special && <div className="living-dungeon-report" role="status" aria-live="polite"><strong>{report.title}</strong><p>{report.detail}</p><button type="button" onClick={() => logDialog.current?.showModal()}>Record ›</button></div>}
      {run.phase === "pact" && <PactRoom run={run} onCommand={command} />}
      {run.phase === "camp" && <CampRoom run={run} onCommand={command} />}
      {(run.phase === "won" || run.phase === "lost") && <RunEnd run={run} onRestart={() => createNew(true)} />}
    </div><aside className="descent-sidebar living-dungeon-sidebar"><EnemyStatus run={run} retaliation={preview.retaliation} /><PactStatus run={run} />
      {run.roomId === "boss" && <section className="living-card living-clue"><p className="living-card-kicker">WHAT YOU NOTICE</p><h3>The preparation has a source</h3><blockquote>{bossPreparationClue(run.bossPreparation)}</blockquote></section>}
      <section className="living-card"><p className="living-card-kicker">THE RECORD</p><h3>Facts remain facts</h3><p className="living-card-copy">{run.facts.length} canonical events · {run.beliefs.length} bounded belief{run.beliefs.length === 1 ? "" : "s"}</p><div className="living-actions"><button type="button" className="living-secondary" onClick={() => logDialog.current?.showModal()}>VIEW EXPEDITION RECORD</button></div><KeyboardHint /></section>
    </aside></div>
    <dialog ref={logDialog} className="living-log-dialog" aria-label="Expedition record" onCancel={() => logDialog.current?.close()}><ExpeditionRecord run={run} storageNotice={storageNotice} onClose={() => logDialog.current?.close()} onRestart={() => createNew(true)} /></dialog>
    <BreachDialog run={run} onCommand={command} />
  </main>;
}

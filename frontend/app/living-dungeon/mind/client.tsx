"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exclusiveSave } from "../../descent/save-lock";
import { ACTS, COMPONENTS, PRINCIPLES, THEORY_COPY } from "./catalogue";
import { createRun, operationError, transition } from "./engine";
import { traceSources } from "./knowledge";
import { compilePlan, describeOperation, generalizeManeuver, previewPlan, suggestions, VERB_COPY, availableVerbs, canSaveManeuver, suggestedBoundary } from "./planning";
import { bind } from "./protocol";
import { decodeSave, envelope, legacyNotice, persist, SAVE_KEY } from "./storage";
import { AI_TEXT_LIMIT, validReply, type MindReply, type MindRequest } from "./ai-contract";
import { distance, entity, playerEntity } from "./world";
import { MindBoard } from "./board";
import { ActionArtwork, EntityPortrait, RelicPortrait } from "./art";
import { MerchantSprite } from "../../dungeon/merchant-art";
import { displayName, entityName, favorAvailability, isKevin, KEVIN_NAME, KEVIN_RELATIONSHIP, worldText } from "./identities";
import { PlayGuide, PlayHelp } from "./play-guide";
import { createMindAudio } from "./audio";
import type { Command, Maneuver, Operation, Plan, PrincipleId, Relationship, Run, Scope, Verb } from "./types";
import styles from "./mind.module.css";

const STAGES = ["An obedient tool", "An uncertain student", "An understanding partner", "A will of its own"];
const SCOPE_COPY: Record<Scope, string> = { always: "Every time", "innocent-at-risk": "When an innocent is in danger", "no-one-else-hurt": "When no one else is harmed", "suspicious-offer": "When an offer seems too easy" };
const meaningful = (run: Run) => run.facts.filter(f => !f.operation || !["MOVE", "WAIT", "OBSERVE"].includes(f.operation.verb));

export default function MindBeneathClient() {
  const [run, setRun] = useState<Run | null>(null), runRef = useRef<Run | null>(null);
  const [selected, setSelected] = useState<string | null>("captive"), [lens, setLens] = useState(false);
  const [tab, setTab] = useState<"room" | "relic" | "memory">("room");
  const [plan, setPlan] = useState<Plan | null>(null), [connections, setConnections] = useState<Operation[]>([]);
  const [auto, setAuto] = useState(false), [notice, setNotice] = useState("");
  const [pendingTeaching, setPendingTeaching] = useState<{ principle: PrincipleId; scope: Scope } | null>(null);
  const [text, setText] = useState(""), [aiBusy, setAiBusy] = useState(false), [aiLine, setAiLine] = useState("");
  const [maneuverName, setManeuverName] = useState("Quiet Mercy"), [sound, setSound] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading your memory …"), [rawLessons, setRawLessons] = useState(false);
  const boardAnchor = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const busy = useRef(false), savedRevision = useRef<number | null>(null), persistent = useRef(true);
  const requestRef = useRef<{ controller: AbortController; generation: string } | null>(null);
  const preparedRoom = useRef(-1);
  const audio = useRef<ReturnType<typeof createMindAudio> | null>(null);
  const [callCount, setCallCount] = useState(0);
  const calls = useRef(0), lastKey = useRef(0), mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    Promise.resolve().then(() => {
      let restored: Run | null = null, message = "Saved on this device";
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) { restored = decodeSave(raw); if (!restored) { persistent.current = false; message = "Your old memory is preserved. This journey will last for this session."; } }
        else if (legacyNotice(localStorage)) message = "Your earlier expedition is preserved. This is a new chapter.";
      } catch { persistent.current = false; message = "Saving is unavailable. This journey will last for this session."; }
      if (!mounted.current) return;
      const next = restored ?? createRun(crypto.getRandomValues(new Uint32Array(1))[0], crypto.randomUUID());
      runRef.current = next; savedRevision.current = restored?.revision ?? null; setRun(next); setSaveStatus(message);
      audio.current = createMindAudio();
    });
    return () => { mounted.current = false; requestRef.current?.controller.abort(); void audio.current?.close(); };
  }, []);

  const focusBoard = useCallback(() => {
    requestAnimationFrame(() => boardAnchor.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }));
  }, []);

  const cancelAi = useCallback(() => {
    requestRef.current?.controller.abort(); requestRef.current = null;
    setAiBusy(false); setAiLine("");
  }, []);

  const dispatch = useCallback(async (command: Command) => {
    const current = runRef.current;
    if (!current || busy.current) return;
    const next = transition(current, command);
    if (next === current) { if (command.type === "act") setNotice(operationError(current, command.operation) ?? "That action could not be performed."); return; }
    cancelAi();
    busy.current = true;
    try {
      if (persistent.current) {
        const result = await exclusiveSave(() => {
          const result = persist(localStorage, next, savedRevision.current);
          if (result === "limit") { persistent.current = false; return "unavailable"; }
          return result;
        }, undefined, SAVE_KEY);
        if (result === "busy" || result === "conflict") { setAuto(false); setSaveStatus(result === "conflict" ? "Another tab has changed the journey. Reload to continue." : "Another tab is saving. Try that action again."); return; }
        if (result === "saved") { savedRevision.current = next.revision; setSaveStatus("Saved on this device"); }
        else { persistent.current = false; setSaveStatus("Saving is unavailable. The journey continues for this session."); }
      }
      runRef.current = next; setRun(next); setPlan(null); setNotice("");
      if (next.chills.understood !== current.chills.understood) audio.current?.motif("understand");
      else if (next.reports.filter(r => r.delivered !== null).length > current.reports.filter(r => r.delivered !== null).length) audio.current?.motif("learn");
      else if (next.echoes > current.echoes) audio.current?.motif("echo");
      else if (command.type === "step" || command.type === "act") audio.current?.motif("step");
      if (command.type === "descend") { setConnections([]); setSelected("captive"); setTab("room"); setAiLine(""); setAuto(false); }
      if (command.type === "teach" || command.type === "correct") { setPendingTeaching(null); setLens(true); }
      if (["teach", "descend"].includes(command.type)) focusBoard();
    } finally { busy.current = false; }
  }, [focusBoard, cancelAi]);

  useEffect(() => {
    if (!auto || !run?.activePlan || run.activePlan.interrupted || run.status !== "playing") return;
    const timer = setTimeout(() => { if (!document.hidden) void dispatch({ type: "step" }); else setAuto(false); }, 360);
    return () => clearTimeout(timer);
  }, [auto, run, dispatch]);

  const choosePlan = useCallback((operations: Operation[], boundary: Maneuver["boundary"] = "none", name?: string) => {
    const current = runRef.current; if (!current) return;
    cancelAi(); setAuto(false); setLens(true); setTab("room"); setConnections(operations);
    setPlan(compilePlan(current, operations, { boundary, name }));
    focusBoard();
  }, [focusBoard, cancelAi]);
  const direct = useCallback((operation: Operation) => {
    const current = runRef.current; if (!current) return;
    setAuto(false);
    if (!operationError(current, operation)) void dispatch({ type: "act", operation });
    else choosePlan([operation]);
  }, [dispatch, choosePlan]);

  const handleKey = useCallback((event: React.KeyboardEvent | KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable || target.closest("#mind-how-to")) return;
    const delta: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
    const current = runRef.current; if (!current) return;
    if (delta[event.key]) {
      event.preventDefault(); if (event.repeat && Date.now() - lastKey.current < 140) return; lastKey.current = Date.now(); setAuto(false);
      const p = playerEntity(current.room), [dx, dy] = delta[event.key];
      void dispatch({ type: "act", operation: { verb: "MOVE", at: { x: p.x + dx, y: p.y + dy } } });
    } else if (event.key === "Enter" && target.tagName.toLowerCase() === "svg" && selected) { event.preventDefault(); direct({ verb: "OBSERVE", target: selected }); }
    else if (event.key.toLowerCase() === "l") { event.preventDefault(); setLens(v => !v); }
    else if (event.key === "Escape") { cancelAi(); setPlan(null); setConnections([]); setAuto(false); }
  }, [dispatch, direct, selected, cancelAi]);
  useEffect(() => { window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [handleKey]);

  const askRelic = async (task: MindRequest["task"]) => {
    const current = runRef.current;
    if (!current || current.status !== "playing" || aiBusy || calls.current >= 40 || !text.trim() && task !== "director") return;
    calls.current++; setCallCount(calls.current); requestRef.current?.controller.abort();
    const controller = new AbortController(), generation = crypto.randomUUID(), binding = bind(current, crypto.randomUUID(), generation);
    requestRef.current = { controller, generation }; setAiBusy(true); setAiLine("");
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("/api/living-dungeon/mind", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ task, text: text.trim(), binding, save: envelope(current) } satisfies MindRequest) });
      if (!response.ok) throw new Error("unavailable");
      const reply = await response.json() as MindReply;
      if (requestRef.current?.generation !== generation) return;
      if (!runRef.current || !validReply(runRef.current, reply, binding)) { setAiLine("The room changed while I was thinking. Choose a new opening."); return; }
      setAiLine(reply.source === "fallback" ? "I cannot make sense of the words just now. Try one of the openings in the room." : reply.line);
      if (reply.teaching) setPendingTeaching(reply.teaching);
      if (reply.plan && reply.source !== "fallback") { setPlan(reply.plan); setConnections(reply.plan.steps.filter(s => s.verb !== "MOVE")); setLens(true); setTab("room"); }
      if (reply.family) await dispatch({ type: "director", family: reply.family });
      setText("");
    } catch { if (mounted.current && requestRef.current?.generation === generation) setAiLine("The words cannot reach me just now. The room and its visible possibilities still work."); }
    finally { clearTimeout(timeout); if (mounted.current && requestRef.current?.generation === generation) { requestRef.current = null; setAiBusy(false); } }
  };

  useEffect(() => {
    if (!run || run.room.index < 11 || !run.room.solved || preparedRoom.current === run.room.index || calls.current >= 40) return;
    const current = run, controller = new AbortController(), binding = bind(current, crypto.randomUUID(), crypto.randomUUID());
    let accepted = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Wait for a short reading pause; movement restarts preparation without consuming a call.
    const timer = setTimeout(() => {
      preparedRoom.current = current.room.index;
      calls.current++; setCallCount(calls.current);
      timeout = setTimeout(() => controller.abort(), 8000);
      void fetch("/api/living-dungeon/mind", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ task: "director", text: "", binding, save: envelope(current) } satisfies MindRequest) })
        .then(async response => {
          if (!response.ok) return;
          const reply = await response.json() as MindReply;
          if (runRef.current && validReply(runRef.current, reply, binding) && reply.family) {
            accepted = true; await dispatch({ type: "director", family: reply.family });
          }
        }).catch(() => undefined).finally(() => clearTimeout(timeout));
    }, 700);
    return () => {
      clearTimeout(timer); clearTimeout(timeout); controller.abort();
      if (!accepted && preparedRoom.current === current.room.index) preparedRoom.current = -1;
    };
  }, [run, dispatch]);

  const activePlan = run?.activePlan;
  const shownPlan = useMemo(() => plan ?? (activePlan ? { ...activePlan.plan, steps: activePlan.plan.steps.slice(activePlan.cursor) } : null), [plan, activePlan]);
  const preview = useMemo(() => run && shownPlan ? previewPlan(run, shownPlan) : null, [run, shownPlan]);
  const reusablePlan = useMemo(() => {
    if (!run || plan || run.activePlan || run.room.solved || entity(run.room, "captive")?.freed || !["rescue", "echo"].includes(run.room.goal) || !run.relic.maneuvers.length) return null;
    const next = generalizeManeuver(run, run.relic.maneuvers[0]);
    return previewPlan(run, next).legal ? next : null;
  }, [run, plan]);
  const choices = useMemo(() => run ? suggestions(run) : [], [run]);
  if (!run) return <main className={styles.root} lang="en"><div className={styles.loading}><Rune /><p>The stone holds its breath.</p></div></main>;
  const selectedEntity = entity(run.room, selected ?? undefined), guardian = entity(run.room, "guardian"), atExit = distance(playerEntity(run.room), entity(run.room, "exit")!) <= 1;
  const lastEvents = meaningful(run).slice(-5).reverse(), latestTheory = run.hypotheses[0];
  const pendingReports = run.reports.filter(r => r.room === run.room.index && !r.intercepted && r.delivered === null);
  const canSave = canSaveManeuver(run);
  const kevin = run.relationships.find(r => r.id === KEVIN_RELATIONSHIP);
  const canRemember = canSave && !!run.lastSequence?.steps.some(s => s.verb === "RELEASE");
  const canReuse = !!reusablePlan;
  const showLearnedPlan = (next: Plan) => { cancelAi(); setAuto(false); setPlan(next); setConnections(next.steps.filter(s => s.verb !== "MOVE")); setLens(true); setTab("room"); focusBoard(); };
  const nextAction = !run.relic.principles.length ? "Teach the relic who you are." : run.activePlan?.interrupted ? "The plan has broken. Find a new opening." : run.room.solved ? "Decide which story you let travel onward." : run.room.objective;

  return <main className={`${styles.root} ${!run.relic.principles.length ? styles.onboarding : ""}`} lang="en" data-testid="mind-game" data-revision={run.revision} data-room={run.room.index} data-status={run.status} data-hp={run.player.hp}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="DELVEWORN"><Image src="/assets/delveworn-logo-v1.png" alt="DELVEWORN" width={180} height={60} sizes="(max-width: 480px) 135px, 180px" /></Link>
      <div className={styles.headerCenter}><span>THE LIVING DUNGEON</span><i />{run.room.index < 12 ? "CHAPTER I" : `DEPTH ${Math.floor(run.room.index / 6)}`}</div>
      <div className={styles.headerActions}><button aria-expanded={helpOpen} aria-controls="mind-how-to" onClick={() => { setAuto(false); setHelpOpen(true); requestAnimationFrame(() => { const help = document.getElementById("mind-how-to"); help?.scrollIntoView({ block: "start" }); help?.querySelector("summary")?.focus(); }); }}>How to play</button><button onClick={() => { void audio.current?.toggle().then(setSound); }} aria-label={sound ? "Mute sound" : "Enable sound"}>{sound ? "♪ Sound on" : "♪ Sound off"}</button><Link href="/">All modes ↗</Link></div>
    </header>
    <section className={styles.masthead}>
      <div><p className={styles.eyebrow}>AN INTELLIGENCE WAITS BENEATH YOU</p><h1>The Mind Beneath<span>.</span></h1><p className={styles.tagline}>Teach the relic who you are. <em>Convince the dungeon you are someone else.</em></p></div>
      <div className={styles.resources} aria-label="Your resources"><Resource label="HEALTH" value={`${run.player.hp}/${run.player.maxHp}`} ratio={run.player.hp / run.player.maxHp} /><Resource label="RELIC" value={`${run.relic.energy}`} ratio={run.relic.energy / 20} /><Resource label="POTIONS" value={`${run.player.potions}`} /><Resource label="TRUST" value={`${run.relic.trust}`} /></div>
    </section>
    <nav className={styles.acts} aria-label="The expedition's six acts">{ACTS.map((act, i) => <div key={act} className={Math.min(run.room.act, 5) === i ? styles.currentAct : run.room.act > i ? styles.pastAct : ""}><span>{String(i + 1).padStart(2, "0")}</span><b>{act}</b></div>)}</nav>
    <PlayHelp open={helpOpen} onToggle={open => { setHelpOpen(open); if (open) setAuto(false); }} />
    <div className={styles.layout}>
      <section className={styles.worldColumn} aria-label="The room">
        <div className={styles.roomHeading}><div><p className={styles.eyebrow}>{run.room.index < 12 ? `ACT ${run.room.act + 1} · ${ACTS[run.room.act]}` : "BENEATH THE FIRST CONCLUSION"}</p><h2>{run.room.title}</h2></div><button className={`${styles.lensButton} ${lens ? styles.lensActive : ""}`} aria-pressed={lens} onClick={() => setLens(v => !v)}><span>◈</span>  Possibility Lens <kbd>L</kbd></button></div>
        <p className={styles.objective}>{nextAction}</p><p className={styles.roomLore}>{run.room.subtitle}</p>
        <div ref={boardAnchor} className={styles.boardAnchor}>
        <PlayGuide run={run} plan={plan} preview={preview} auto={auto} canRemember={canRemember} canReuse={canReuse} atExit={atExit} onAction={action => {
          if (action === "preview") { if (run.room.goal === "echo" && entity(run.room, "captive")?.freed) choosePlan([...(run.room.light ? [{ verb: "EXTINGUISH_LIGHT" as const, target: "light" }] : []), { verb: "HIDE" }, { verb: "ATTACK", target: "guardian" }], "none", "Attack from hiding"); else if (canReuse && reusablePlan) showLearnedPlan(reusablePlan); else if (choices[0]) choosePlan(choices[0].operations, choices[0].boundary, choices[0].label); }
          else if (action === "remember") void dispatch({ type: "save-maneuver", name: "Quiet Mercy", boundary: suggestedBoundary(run) });
          else if (action === "exit") { if (atExit && run.room.solved) void dispatch({ type: "descend" }); else if (atExit) choosePlan([{ verb: "WAIT" }], "none", "Wait at the stairs"); else choosePlan([{ verb: "MOVE", at: { x: 8, y: 7 } }], "none", "To the stairs"); }
          else if (action === "retreat") { if (atExit) direct({ verb: "RETREAT" }); else choosePlan([{ verb: "MOVE", at: { x: 8, y: 7 } }], "none", "The way out"); }
          else if (action === "retry") { setAuto(false); void dispatch({ type: "cancel" }); }
          else if (action === "correct") {
            const principle = run.relic.principles[0];
            void (async () => {
              await dispatch({ type: "correct", principle: principle.id, scope: PRINCIPLES[principle.id].scope });
              const maneuver = run.relic.maneuvers.find(m => m.steps.some(step => step.verb === "RELEASE") && !m.steps.some(step => ["ATTACK", "STORM"].includes(step.verb)));
              if (maneuver) await dispatch({ type: "correct-maneuver", id: maneuver.id, boundary: "no-harm" });
            })();
          }
        }}>
          {!run.relic.principles.length && <section className={styles.teaching} aria-label="Teach the relic"><p className={styles.eyebrow}>FIRST LESSON</p><h3>What should I remember first?</h3><p>Choose a rule you want the relic to understand.</p>{(["protect", "no-harm", "survive"] as PrincipleId[]).map(id => <button className={`${styles.lessonOption} ${pendingTeaching?.principle === id ? styles.chosen : ""}`} key={id} onClick={() => setPendingTeaching({ principle: id, scope: PRINCIPLES[id].scope })}><span>◇</span>{PRINCIPLES[id].title}</button>)}{pendingTeaching && <TeachingConfirmation teaching={pendingTeaching} onConfirm={() => void dispatch({ type: "teach", ...pendingTeaching })} onScope={scope => setPendingTeaching({ ...pendingTeaching, scope })} />}</section>}
        </PlayGuide>

        {plan && preview && <div className={styles.boardPlan}><div><span className={styles.eyebrow}>PREVIEW · NOTHING HAS HAPPENED YET</span><b>{plan.steps.length}  steps · {preview.energyCost}  energy{preview.healthCost > 0 ? ` · ${preview.healthCost} health` : ""}</b></div><button className={styles.primary} disabled={!preview.legal} onClick={() => { void dispatch({ type: "commit", plan }); setAuto(true); focusBoard(); }}>Execute the plan →</button></div>}
        {run.activePlan && <div className={styles.boardPlan}><div><span className={styles.eyebrow}>{run.activePlan.interrupted ? "INTERRUPTED" : "PLAN IN MOTION"}</span><b>{run.activePlan.interrupted ? worldText(run.activePlan.interrupted) : `Step ${run.activePlan.cursor + 1} of ${run.activePlan.plan.steps.length}`}</b></div><button onClick={() => { if (run.activePlan?.interrupted) { void dispatch({ type: "cancel" }); } else setAuto(v => !v); }}>{run.activePlan.interrupted ? "Improvise" : auto ? "Pause here" : "Continue here"}</button></div>}
        <MindBoard run={run} lens={lens} selected={selected} plan={shownPlan} preview={preview} onSelect={id => { setSelected(id); setTab("room"); }} onTile={at => {
          const p = playerEntity(run.room); if (distance(p, at) === 1) direct({ verb: "MOVE", at }); else choosePlan([{ verb: "MOVE", at }]);
        }} onKey={handleKey} onConnect={(from, to) => {
          const operations = [from, to].flatMap(id => {
            const object = entity(run.room, id); if (!object) return [];
            const verb = object.role === "distraction" ? "DISTRACT" : object.role === "captive" ? "RELEASE" : object.role === "light" ? "EXTINGUISH_LIGHT" : object.role === "relay" ? "INTERRUPT_REPORT" : object.role === "evidence" ? "REVEAL_EVIDENCE" : null;
            return verb ? [{ verb, target: id } as Operation] : [];
          });
          choosePlan([...connections, ...operations]);
        }} />
        </div>
        <div className={styles.actionDock} aria-label="Direct actions">
          {([ ["ATTACK", "Attack", "╱"], ["STORM", "Storm", "ϟ"], ["POTION", "Potion", "♧"], ["PROTECT", "Protect", "◇"], ["HIDE", "Hide", "◐"], ["OBSERVE", "Examine", "◎"] ] as [Verb, string, string][]).map(([verb, label, icon]) => <button key={verb} disabled={!run.relic.principles.length || run.status !== "playing" || verb === "POTION" && (run.player.potions === 0 || run.player.hp === run.player.maxHp) || verb === "STORM" && run.relic.energy < 4 || ["ATTACK", "STORM"].includes(verb) && !guardian?.active || verb === "PROTECT" && (run.relic.energy < 2 || !entity(run.room, "captive")?.active)} onClick={() => direct({ verb, ...(["ATTACK", "STORM"].includes(verb) ? { target: "guardian" } : verb === "PROTECT" ? { target: "captive" } : verb === "OBSERVE" ? { target: selected ?? "captive" } : {}) })}><span className={styles.actionIcon}><span className={styles.srOnly}>{icon}</span><ActionArtwork verb={verb} /></span>{label}<small>{verb === "STORM" ? "4 energy" : verb === "PROTECT" ? "2 energy" : verb === "POTION" ? "+16 health" : verb === "OBSERVE" ? "Free action" : "1 turn"}</small></button>)}
        </div>
        <div className={styles.worldNotice} role="status" aria-live="polite"><span>WHAT HAPPENED</span><p>{worldText(notice || run.notice)}</p></div>
        {run.room.solved && run.status === "playing" && <div className={styles.exitCard}><div><span className={styles.eyebrow}>{run.room.escaped ? "YOU RETREATED" : run.room.family === "echo" ? "THE ECHO BROKE" : "A WAY FORWARD"}</span><h3>{run.room.escaped ? "The unfinished story follows you." : run.room.family === "echo" ? "It was certain. You were not finished." : "Who gets to tell the story?"}</h3><p>{entity(run.room, "relay")?.active && run.room.index >= 4 ? "Surviving witnesses can report when you leave the room." : "The report route is quiet. What you learned goes with you."}</p></div><button className={styles.primary} onClick={() => atExit ? void dispatch({ type: "descend" }) : choosePlan([{ verb: "MOVE", at: { x: 8, y: 7 } }])}>{atExit ? "Go deeper ↓" : "Go to the stairs →"}</button></div>}
        {run.status === "fallen" && <div className={styles.exitCard}><div><h3>A scar. Your story remains.</h3><p>The relic and the witnesses keep what they know. Return to this chamber with 24 health.</p></div><button className={styles.primary} onClick={() => void dispatch({ type: "recover" })}>Return</button></div>}
        <div className={styles.identityStrip}><div><span className={styles.eyebrow}>THE RELIC LEARNED <i className={styles.tealDot} /></span><p>{run.relic.principles[0] ? PRINCIPLES[run.relic.principles[0].id].title : "Your reasons are still your own."}</p><small>Private between you</small></div><div><span className={styles.eyebrow}>THE DUNGEON SUSPECTS <i className={styles.goldDot} /></span><p>{latestTheory && (run.room.index >= 6 || run.room.inspected.includes("relay")) ? THEORY_COPY[latestTheory.claim] : run.reports.some(r => r.delivered !== null) ? "A story has reached the depths. The signs will follow." : "No story has reached it yet."}</p><small>{latestTheory && run.room.index >= 6 ? latestTheory.confidence >= .65 ? "It seems certain" : "It is testing a theory" : "Only what reaches it"}</small></div></div>
      </section>
      <aside className={styles.sideColumn}>
        <div className={styles.relicCard} key={`${run.relic.stage}-${run.chills.understood ?? ""}`}><div className={styles.relicTop}><RelicPortrait /><div><span className={styles.eyebrow}>THE RELIC</span><span className={styles.relicStage}>{STAGES[run.relic.stage]}</span></div><span className={styles.privateBadge}>PRIVATE</span></div><blockquote>“{worldText(run.relic.line)}”</blockquote>
          {run.relic.pendingChoice && <div className={styles.choice}><p>The rune turns towards {run.relic.pendingChoice.protect ? "the captive" : "you"}. It will act on the next turn.</p><small>{run.relic.energy < 2 ? "The relic has too little energy to act." : run.relic.pendingChoice.protect && run.relic.energy >= 3 ? `You lose ${Math.min(4, run.player.hp)} health. The relic spends 3 energy protecting the captive.${run.player.hp <= 4 ? " This will make you fall." : ""}` : "The relic spends 2 energy shielding you."}</small><button disabled={run.relic.energy < 4 || run.relic.trust < 1} onClick={() => void dispatch({ type: "override" })}>Override · 4 energy + 1 trust</button><Why run={run} sources={run.relic.pendingChoice.sources} /></div>}
        </div>
        {run.relic.principles.length > 0 && <>
          <div className={styles.tabs} role="tablist" aria-label="Knowledge"><button role="tab" aria-selected={tab === "room"} onClick={() => setTab("room")}>Possibilities</button><button role="tab" aria-selected={tab === "relic"} onClick={() => setTab("relic")}>The relic</button><button role="tab" aria-selected={tab === "memory"} onClick={() => setTab("memory")}>Traces</button></div>
          {tab === "room" && <section className={styles.panel}>
            {run.activePlan ? <div className={styles.activePlan}><p className={styles.eyebrow}>YOUR SEQUENCE</p><h3>{run.activePlan.plan.name}</h3><p>{run.activePlan.interrupted ? worldText(run.activePlan.interrupted) : `Step ${run.activePlan.cursor + 1} of ${run.activePlan.plan.steps.length}`}</p><div className={styles.buttonRow}><button className={styles.primary} disabled={!!run.activePlan.interrupted} onClick={() => { setAuto(false); void dispatch({ type: "step" }); }}>Next step →</button><button onClick={() => setAuto(v => !v)} disabled={!!run.activePlan.interrupted}>{auto ? "Pause" : "Let the plan run"}</button></div><button className={styles.textButton} onClick={() => { setAuto(false); void dispatch({ type: "cancel" }); }}>Stop and improvise</button></div>
              : plan && preview ? <div className={styles.planCard}><p className={styles.eyebrow}>A POSSIBLE FUTURE</p><h3>{plan.name}</h3><div className={styles.costs}><span>{plan.steps.filter(s => s.verb !== "OBSERVE").length}  turns</span><span>{preview.energyCost}  energy</span><span>{preview.healthCost > 0 ? `−${preview.healthCost}` : preview.healthCost < 0 ? `+${-preview.healthCost}` : "0"}  health</span></div><ol className={styles.planSteps}>{plan.steps.map((step, i) => step.verb === "MOVE" ? null : <li key={i}><span>{describeOperation(run, step)}</span><button aria-label={`Remove step ${i + 1}`} onClick={() => { const steps = plan.steps.filter((_, j) => i !== j); setPlan({ ...plan, steps }); }}>×</button></li>)}</ol><details className={styles.why}><summary>Show movement · {plan.steps.filter(s => s.verb === "MOVE").length}  tiles</summary><ol>{plan.steps.map((step, i) => <li key={i}>{describeOperation(run, step)}</li>)}</ol></details><p className={preview.legal ? styles.consequence : styles.warning}>{worldText(preview.legal ? preview.outcome : preview.reason ?? "")}</p><p className={styles.audience}><span>SOMEONE MAY OBSERVE</span>{preview.observations.length ? preview.observations.join(", ") : "No one sees the decisive actions."}</p>{preview.complications.length > 0 && <details className={styles.why}><summary>Possible consequence</summary>{preview.complications.map(c => <p key={c}>{worldText(c)}</p>)}</details>}<div className={styles.buttonRow}><button className={styles.primary} disabled={!preview.legal} onClick={() => { void dispatch({ type: "commit", plan }); setAuto(true); }}>Execute from details</button><button onClick={() => { setPlan(null); setConnections([]); }}>Change</button></div></div>
              : <><div className={styles.panelTitle}><span className={styles.eyebrow}>READ THE ROOM</span><span>{pendingReports.length ? `${pendingReports.length} report on its way` : "Select something to examine it"}</span></div>
                <div className={styles.objectList}>{run.room.entities.filter(e => e.active && !["player"].includes(e.role)).map(e => <button key={e.id} className={selected === e.id ? styles.objectSelected : ""} onClick={() => setSelected(e.id)} title={entityName(run.room, e)}>{e.role === "captive" ? "◇" : e.role === "guardian" || e.role === "echo" ? "†" : e.role === "observer" ? "◉" : e.role === "relay" ? "⋈" : "·"}<span>{entityName(run.room, e)}</span></button>)}</div>
                {selectedEntity && <div className={styles.inspection}><div className={styles.inspectionHeading}><EntityPortrait entity={selectedEntity} room={run.room} /><h3>{entityName(run.room, selectedEntity)}</h3></div><p>{objectCopy(run, selectedEntity.id)}</p><div className={styles.contextActions}>{availableVerbs(run, selectedEntity.id).map(verb => <button key={verb} onClick={() => {
                  const operation: Operation = { verb, ...(!["WAIT", "POTION", "RETREAT"].includes(verb) ? { target: selectedEntity.id } : {}) };
                  if (verb === "OBSERVE") direct(operation); else { const ops = [...connections, operation]; setConnections(ops); choosePlan(ops); }
                }}>{VERB_COPY[verb]}{verb !== "OBSERVE" ? " ＋" : ""}</button>)}</div></div>}
                <div className={styles.suggestions}><p className={styles.eyebrow}>CHOOSE A PLAN</p>{choices.map((choice, i) => <button key={choice.label} onClick={() => choosePlan(choice.operations, choice.boundary, choice.label)}><span>0{i + 1}</span><div><b>{choice.label}</b><small>{choice.detail}</small></div><span>↗</span></button>)}</div></>}
            {kevin && !plan && !run.activePlan && <KevinHelp run={run} relationship={kevin} onFavor={help => void dispatch({ type: "favor", relationshipId: kevin.id, help })} />}
            {plan && !run.activePlan && <div className={styles.extendPlan}><label htmlFor="add-object">Connect another object</label><select id="add-object" value="" onChange={event => { const id = event.target.value; setSelected(id); setPlan(null); }}><option value="">Choose the next connection …</option>{run.room.entities.filter(e => e.active && e.role !== "player").map(e => <option key={e.id} value={e.id}>{entityName(run.room, e)}</option>)}</select></div>}
            {!run.activePlan && <details className={styles.intentInput}><summary>Describe your own plan <span>Optional</span></summary><label htmlFor="mind-intent">What are you trying to do?</label><textarea id="mind-intent" rows={2} maxLength={AI_TEXT_LIMIT} value={text} onChange={e => setText(e.target.value)} placeholder="Free the captive without the scribe seeing how." /><p>Your text is sent to OpenAI when you request a possible future. It is not stored in analytics.</p><button disabled={!text.trim() || aiBusy || callCount >= 40} onClick={() => void askRelic("plan")}>{aiBusy ? "The relic is thinking. You can still move." : "Show a possible future ↗"}</button>{aiLine && <p role="status">{worldText(aiLine)}</p>}</details>}
          </section>}
          {tab === "relic" && <section className={styles.panel}><p className={styles.eyebrow}>WHAT ONLY YOU TWO KNOW</p><h3>What did you learn?</h3>{run.relic.principles.map(p => <div className={styles.lesson} key={p.id}><h4>{PRINCIPLES[p.id].title}</h4><p>{p.interpretation}</p><small>{p.confidence >= .75 ? "More certain of this lesson" : "Still uncertain"} · {SCOPE_COPY[p.scope]}</small><Why run={run} sources={[...p.examples.slice(-1), ...p.corrections.slice(-1)]} /><label>When should this apply?<select aria-label={`Correct ${PRINCIPLES[p.id].title}`} value={p.scope} onChange={e => void dispatch({ type: "correct", principle: p.id, scope: e.target.value as Scope })}>{Object.entries(SCOPE_COPY).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>{run.relic.misunderstanding && <button onClick={() => void dispatch({ type: "correct", principle: p.id, scope: PRINCIPLES[p.id].scope })}>No. The captive must actually go free.</button>}<details className={styles.why}><summary>What are you unsure of?</summary><p>{p.conflicts.length ? "Two rules want the same moment. Someone has to wait." : PRINCIPLES[p.id].question}</p></details></div>)}
            <button className={styles.textButton} onClick={() => setRawLessons(v => !v)}>Teach another principle ＋</button>{rawLessons && <div className={styles.moreLessons}>{(Object.keys(PRINCIPLES) as PrincipleId[]).filter(id => !run.relic.principles.some(p => p.id === id)).map(id => <button key={id} onClick={() => setPendingTeaching({ principle: id, scope: PRINCIPLES[id].scope })}>{PRINCIPLES[id].title}</button>)}<label htmlFor="teach-text">Or explain the principle briefly</label><textarea id="teach-text" value={text} maxLength={AI_TEXT_LIMIT} onChange={e => setText(e.target.value)} /><small>Sent to OpenAI when you choose “Interpret the lesson”.</small><button disabled={!text.trim() || aiBusy} onClick={() => void askRelic("teach")}>Interpret the lesson</button>{aiLine && <p>{worldText(aiLine)}</p>}</div>}{pendingTeaching && <TeachingConfirmation teaching={pendingTeaching} onConfirm={() => void dispatch({ type: run.relic.principles.some(p => p.id === pendingTeaching.principle) ? "correct" : "teach", ...pendingTeaching })} onScope={scope => setPendingTeaching({ ...pendingTeaching, scope })} />}
            <h3 className={styles.sectionTitle}>Personal maneuvers</h3>{canSave && <div className={styles.saveManeuver}><p>This opening worked. What should the relic carry forward?</p><label htmlFor="maneuver-name">Name your maneuver</label><input id="maneuver-name" maxLength={42} value={maneuverName} onChange={e => setManeuverName(e.target.value)} /><button className={styles.primary} onClick={() => void dispatch({ type: "save-maneuver", name: maneuverName, boundary: suggestedBoundary(run) })}>Remember the maneuver</button></div>}
            {!run.relic.maneuvers.length && !canSave && <p className={styles.muted}>An opening you create and make work can become something you carry forward.</p>}{run.relic.maneuvers.map(m => <div className={styles.maneuver} key={m.id}><span className={styles.eyebrow}>{m.uses}  USES · {m.contexts.length}  ROOM TYPES</span><h4>{m.name}</h4><p>{m.steps.map(s => VERB_COPY[s.verb]).join(" → ")}</p><small>{m.boundary === "no-harm" ? m.intent === "rescue" ? "The captive goes free. The guard stays alive." : "The guard must not be harmed." : m.boundary === "free-target" ? "The captive must go free." : "No firm boundary yet."}</small><button onClick={() => { showLearnedPlan(generalizeManeuver(run, m)); }}>Use in this room ↗</button>{!m.steps.some(s => ["ATTACK", "STORM"].includes(s.verb)) && <button className={styles.textButton} onClick={() => void dispatch({ type: "correct-maneuver", id: m.id, boundary: "no-harm" })}>{m.intent === "rescue" ? "Correct: Freedom, without harming the guard" : "Correct: No harm to the guard"}</button>}{m.corrections.length > 0 && <p className={styles.consequence}>The relic learned this boundary.</p>}<Why run={run} sources={[...m.examples.slice(0, 2), ...m.corrections.slice(-1)]} /></div>)}</section>}
          {tab === "memory" && <section className={styles.panel}><p className={styles.eyebrow}>THE STORY HAS MANY OWNERS</p><h3>Traces that matter</h3>{run.room.index >= 6 && run.hypotheses.map(h => <div className={styles.theory} key={h.claim}><span>THE DUNGEON SUSPECTS</span><p>{THEORY_COPY[h.claim]}</p><small>{h.confidence > .65 ? "Certain" : "Tentative"} · {h.rooms.length}  chambers · {h.noise > 2 ? "Conflicting traces" : "Consistent traces"}</small><Why run={run} sources={h.sources} /></div>)}
            {run.room.components.map(c => <div className={styles.theory} key={c.id}><h4>{COMPONENTS[c.id].name}</h4><p>{COMPONENTS[c.id].effect}</p><Why run={run} sources={c.sources} /></div>)}
            {lastEvents.map(f => <div className={styles.event} key={f.id}><span>{f.private ? "PRIVATE" : "WHAT HAPPENED"}  · CHAMBER {f.room + 1}</span><p>{worldText(f.text)}</p>{f.sources.length > 0 && <Why run={run} sources={f.sources} />}</div>)}
            {run.relationships.length > 0 && <><h3 className={styles.sectionTitle}>Those who remember you</h3>{run.relationships.map(r => r.id === KEVIN_RELATIONSHIP ? <KevinHelp key={r.id} run={run} relationship={r} onFavor={help => void dispatch({ type: "favor", relationshipId: r.id, help })} /> : <div key={r.id} className={styles.relationship}>◇ {displayName(r.name)}<small>{r.rescued}  times freed · owes you {r.debt}  favours</small><FavorActions run={run} relationship={r} onFavor={help => void dispatch({ type: "favor", relationshipId: r.id, help })} /></div>)}</>}
            {run.echoes > 0 && <div className={styles.reconstruction}><h3>Why the Echo broke</h3>{([ ["The relic understood", run.chills.understood], ["The dungeon was wrong", run.chills.mistaken], ["The difference decided it", run.chills.divergence] ] as const).map(([label, id]) => <div key={label}><h4>{label}</h4><p>{id ? worldText(run.facts.find(f => f.id === id)?.text ?? "") : "This path did not open during your expedition."}</p>{id && <Why run={run} sources={[id]} />}</div>)}</div>}
          </section>}
        </>}
        {canSave && tab !== "relic" && <button className={styles.saveNudge} onClick={() => setTab("relic")}>◇ This opening can become yours. <span>Remember a personal maneuver →</span></button>}
        {run.relic.misunderstanding && tab !== "relic" && <button className={styles.correctNudge} onClick={() => setTab("relic")}>The relic learned too much from one moment.<span>Correct it →</span></button>}
      </aside>
    </div>
    <footer className={styles.footer}><span><i className={styles.tealDot} />{saveStatus}</span><span>No wallet needed · Your memory stays in this browser</span><span>{guardian?.active && run.room.alert >= 2 ? "COMBAT AND EXPLORATION · ONE WORLD" : "Every witness sees only part of you."}</span><small>After the first Echo, your shared experiences may be sent to OpenAI to prepare the next room. Direct actions always happen immediately.</small></footer>
  </main>;
}

function FavorActions({ run, relationship, onFavor }: { run: Run; relationship: Relationship; onFavor: (help: "supplies" | "silence") => void }) {
  const available = favorAvailability(run, relationship);
  if (available.reason) return <p className={styles.favorNote} role="status">{available.reason}</p>;
  return <div className={styles.contextActions}>
    <button disabled={!available.supplies} onClick={() => onFavor("supplies")}>{available.supplies ? "Ask for a potion · 1 favour" : "Potion bag full · 4/4"}</button>
    <button disabled={!available.silence} onClick={() => onFavor("silence")}>{available.silence ? "Close the report route · 1 favour" : "Report route already closed"}</button>
  </div>;
}
function KevinHelp({ run, relationship, onFavor }: { run: Run; relationship: Relationship; onFavor: (help: "supplies" | "silence") => void }) {
  const helped = run.facts.findLast(f => f.room === run.room.index && f.actor === relationship.id && f.kind === "choice");
  return <section className={styles.kevinHelp} aria-label="Kevin's supply routes">
    <div className={styles.kevinHeading}><MerchantSprite /><div><span className={styles.eyebrow}>SOMEONE REMEMBERED</span><h3>{KEVIN_NAME}</h3><small>{relationship.debt} {relationship.debt === 1 ? "favour" : "favours"} owed · earned by freeing him</small></div></div>
    <p>{helped ? worldText(helped.text) : "His supply routes reach ahead of you. Call in a favour for a potion, or have him close a reporting conduit from the other side."}</p>
    <FavorActions run={run} relationship={relationship} onFavor={onFavor} />
    <Why run={run} sources={helped ? [helped.id] : relationship.witnessed.slice(-1)} />
  </section>;
}
function Resource({ label, value, ratio }: { label: string; value: string; ratio?: number }) { return <div className={styles.resource}><span>{label}</span><b>{value}</b>{ratio !== undefined && <div className={styles.meter}><i style={{ width: `${Math.min(1, ratio) * 100}%` }} /></div>}</div>; }
function Rune() { return <svg className={styles.rune} viewBox="0 0 48 58" aria-hidden="true"><path d="M24 3 43 26 24 55 5 26Z" fill="#8dc7ac12" stroke="#a1d7bb" /><path d="M24 11V45M13 23 24 32 35 23M16 18 24 11 32 18" fill="none" stroke="#bee7cf" strokeWidth="1.5" /><circle cx="24" cy="32" r="3" fill="#d2f9db" /></svg>; }
function Why({ run, sources }: { run: Run; sources: string[] }) { return <details className={styles.why}><summary>Why?</summary>{traceSources(run, sources).slice(0, 10).map((line, i) => <p key={i}>{worldText(line)}</p>)}</details>; }
function TeachingConfirmation({ teaching, onConfirm, onScope }: { teaching: { principle: PrincipleId; scope: Scope }; onConfirm: () => void; onScope: (scope: Scope) => void }) { return <div className={styles.confirmTeaching}><span className={styles.eyebrow}>THIS IS HOW I UNDERSTAND IT</span><p>“{PRINCIPLES[teaching.principle].interpretation}”</p><label>Applies when<select value={teaching.scope} onChange={e => onScope(e.target.value as Scope)}>{Object.entries(SCOPE_COPY).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><button className={styles.primary} onClick={onConfirm}>Yes. Remember it that way →</button></div>; }
function objectCopy(run: Run, id: string): string {
  const e = entity(run.room, id)!;
  if (isKevin(run.room, e)) return e.freed ? "Free. Kevin remembers the rescue. From chamber 5, call in a favour for a potion or a quiet supply route." : "Quartermaster Kevin was caught moving supplies through the kiln. Free him to earn a favour: a potion or help closing a report route, from chamber 5.";
  if (e.role === "captive") return e.freed ? "Free. Heading for the stairs. They remember who opened the way." : run.room.captiveDeadline ? `In danger after turn ${run.room.captiveDeadline}. Protection and potions buy time.` : "Bound. Someone needs to get close and open the chain.";
  if (e.role === "guardian" || e.role === "echo") return `${e.hp}/${e.maxHp} health. ${e.distracted ? `Distracted for ${e.distracted} turns.` : "Sees what happens within its sightlines."} ${e.protected ? "The relic's misguided protection reduces damage." : ""}`;
  if (e.role === "observer") return e.intent === "report" ? "Carrying a story towards the conduit. You can interrupt it, but cannot erase its memories." : "A credible witness. It sees your actions, not your reasons.";
  if (e.role === "relay") return "A physical route to The Mind Beneath. Break it, or let a useful misconception through.";
  if (e.role === "distraction") return "Can draw the guard away for six turns. New witnesses may still be watching.";
  if (e.role === "light") return "In darkness, witnesses see only two tiles. A nearby observer can still see you.";
  if (e.role === "evidence") return "A seal can support a story. One false trace will not convince anyone on its own.";
  if (e.role === "cover") return "You can hide your opening here. What goes unseen does not automatically become known.";
  if (e.role === "exit") return run.room.solved ? "The way onward is open. Surviving witnesses have time to send reports." : "You can retreat, but the captive stays behind.";
  return "You and the relic know the whole intention. The others see only what you show.";
}

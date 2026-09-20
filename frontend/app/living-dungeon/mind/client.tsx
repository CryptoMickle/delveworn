"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exclusiveSave } from "../../descent/save-lock";
import { ACTS, COMPONENTS, PRINCIPLES, THEORY_COPY } from "./catalogue";
import { createRun, operationError, transition } from "./engine";
import { traceSources } from "./knowledge";
import { compilePlan, describeOperation, generalizeManeuver, previewPlan, suggestions, VERB_COPY, verbsForRole } from "./planning";
import { bind } from "./protocol";
import { decodeSave, envelope, legacyNotice, persist, SAVE_KEY } from "./storage";
import { AI_TEXT_LIMIT, validReply, type MindReply, type MindRequest } from "./ai-contract";
import { distance, entity, playerEntity } from "./world";
import { MindBoard } from "./board";
import { PlayGuide, PlayHelp } from "./play-guide";
import { createMindAudio } from "./audio";
import type { Command, Maneuver, Operation, Plan, PrincipleId, Run, Scope, Verb } from "./types";
import styles from "./mind.module.css";

const STAGES = ["Et lydig verktøy", "En usikker elev", "En fortolkende partner", "En egen vilje"];
const SCOPE_COPY: Record<Scope, string> = { always: "Hver gang", "innocent-at-risk": "Når en uskyldig er i fare", "no-one-else-hurt": "Når ingen andre rammes", "suspicious-offer": "Når et tilbud virker for enkelt" };
const meaningful = (run: Run) => run.facts.filter(f => !f.operation || !["MOVE", "WAIT", "OBSERVE"].includes(f.operation.verb));

export default function MindBeneathClient() {
  const [run, setRun] = useState<Run | null>(null), runRef = useRef<Run | null>(null);
  const [selected, setSelected] = useState<string | null>("captive"), [lens, setLens] = useState(false);
  const [tab, setTab] = useState<"room" | "relic" | "memory">("room");
  const [plan, setPlan] = useState<Plan | null>(null), [connections, setConnections] = useState<Operation[]>([]);
  const [auto, setAuto] = useState(false), [notice, setNotice] = useState("");
  const [pendingTeaching, setPendingTeaching] = useState<{ principle: PrincipleId; scope: Scope } | null>(null);
  const [text, setText] = useState(""), [aiBusy, setAiBusy] = useState(false), [aiLine, setAiLine] = useState("");
  const [maneuverName, setManeuverName] = useState("Stille nåde"), [sound, setSound] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Laster minnet …"), [rawLessons, setRawLessons] = useState(false);
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
      let restored: Run | null = null, message = "Lagres på denne enheten";
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) { restored = decodeSave(raw); if (!restored) { persistent.current = false; message = "Det gamle minnet er bevart. Denne reisen varer i denne økten."; } }
        else if (legacyNotice(localStorage)) message = "Den tidligere ekspedisjonen er bevart. Dette er et nytt kapittel.";
      } catch { persistent.current = false; message = "Lagring er utilgjengelig. Reisen varer i denne økten."; }
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

  const dispatch = useCallback(async (command: Command) => {
    const current = runRef.current;
    if (!current || busy.current) return;
    const next = transition(current, command);
    if (next === current) { if (command.type === "act") setNotice(operationError(current, command.operation) ?? "Handlingen kunne ikke utføres."); return; }
    busy.current = true;
    try {
      if (persistent.current) {
        const result = await exclusiveSave(() => {
          const result = persist(localStorage, next, savedRevision.current);
          if (result === "limit") { persistent.current = false; return "unavailable"; }
          return result;
        }, undefined, SAVE_KEY);
        if (result === "busy" || result === "conflict") { setAuto(false); setSaveStatus(result === "conflict" ? "En annen fane har endret reisen. Last siden på nytt for å fortsette." : "En annen fane lagrer. Prøv handlingen igjen."); return; }
        if (result === "saved") { savedRevision.current = next.revision; setSaveStatus("Lagret på denne enheten"); }
        else { persistent.current = false; setSaveStatus("Lagring er utilgjengelig. Reisen fortsetter i denne økten."); }
      }
      runRef.current = next; setRun(next); setPlan(null); setNotice("");
      if (next.chills.understood !== current.chills.understood) audio.current?.motif("understand");
      else if (next.reports.filter(r => r.delivered !== null).length > current.reports.filter(r => r.delivered !== null).length) audio.current?.motif("learn");
      else if (next.echoes > current.echoes) audio.current?.motif("echo");
      else if (command.type === "step" || command.type === "act") audio.current?.motif("step");
      if (command.type === "descend") { setConnections([]); setSelected("captive"); setTab("room"); setAiLine(""); setAuto(false); }
      if (command.type === "teach") { setPendingTeaching(null); setLens(true); }
      if (["teach", "save-maneuver", "descend"].includes(command.type)) focusBoard();
    } finally { busy.current = false; }
  }, [focusBoard]);

  useEffect(() => {
    if (!auto || !run?.activePlan || run.activePlan.interrupted || run.status !== "playing") return;
    const timer = setTimeout(() => { if (!document.hidden) void dispatch({ type: "step" }); else setAuto(false); }, 360);
    return () => clearTimeout(timer);
  }, [auto, run, dispatch]);

  const choosePlan = useCallback((operations: Operation[], boundary: Maneuver["boundary"] = "none", name?: string) => {
    const current = runRef.current; if (!current) return;
    setAuto(false); setLens(true); setTab("room"); setConnections(operations);
    setPlan(compilePlan(current, operations, { boundary, name }));
    focusBoard();
  }, [focusBoard]);
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
    else if (event.key === "Escape") { setPlan(null); setConnections([]); setAuto(false); }
  }, [dispatch, direct, selected]);
  useEffect(() => { window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [handleKey]);

  const askRelic = async (task: MindRequest["task"]) => {
    const current = runRef.current;
    if (!current || aiBusy || calls.current >= 40 || !text.trim() && task !== "director") return;
    calls.current++; setCallCount(calls.current); requestRef.current?.controller.abort();
    const controller = new AbortController(), generation = crypto.randomUUID(), binding = bind(current, crypto.randomUUID(), generation);
    requestRef.current = { controller, generation }; setAiBusy(true); setAiLine("");
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("/api/living-dungeon/mind", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ task, text: text.trim(), binding, save: envelope(current) } satisfies MindRequest) });
      if (!response.ok) throw new Error("unavailable");
      const reply = await response.json() as MindReply;
      if (!runRef.current || requestRef.current?.generation !== generation || !validReply(runRef.current, reply, binding)) { setAiLine("Rommet endret seg mens jeg tenkte. Velg en ny åpning."); return; }
      setAiLine(reply.source === "fallback" ? "Jeg kan ikke tolke ordene nå. Bruk en av mulighetene i rommet." : reply.line);
      if (reply.teaching) setPendingTeaching(reply.teaching);
      if (reply.plan && reply.source !== "fallback") { setPlan(reply.plan); setConnections(reply.plan.steps.filter(s => s.verb !== "MOVE")); setLens(true); setTab("room"); }
      if (reply.family) await dispatch({ type: "director", family: reply.family });
      setText("");
    } catch { if (mounted.current) setAiLine("Ordene når ikke fram akkurat nå. Rommet og de synlige mulighetene virker fortsatt."); }
    finally { clearTimeout(timeout); if (mounted.current) setAiBusy(false); }
  };

  useEffect(() => {
    if (!run || run.room.index < 11 || !run.room.solved || preparedRoom.current === run.room.index || calls.current >= 40) return;
    preparedRoom.current = run.room.index;
    const current = run, controller = new AbortController(), binding = bind(current, crypto.randomUUID(), crypto.randomUUID());
    const timer = setTimeout(() => controller.abort(), 8000);
    calls.current++;
    // Prepare the next room while the player can continue moving; outdated context is discarded.
    void fetch("/api/living-dungeon/mind", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ task: "director", text: "", binding, save: envelope(current) } satisfies MindRequest) })
      .then(async response => { if (!response.ok) return; const reply = await response.json() as MindReply; if (runRef.current && validReply(runRef.current, reply, binding) && reply.family) await dispatch({ type: "director", family: reply.family }); })
      .catch(() => undefined).finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, [run, dispatch]);

  const activePlan = run?.activePlan;
  const shownPlan = useMemo(() => plan ?? (activePlan ? { ...activePlan.plan, steps: activePlan.plan.steps.slice(activePlan.cursor) } : null), [plan, activePlan]);
  const preview = useMemo(() => run && shownPlan ? previewPlan(run, shownPlan) : null, [run, shownPlan]);
  const reusablePlan = useMemo(() => {
    if (!run || plan || run.activePlan || run.room.solved || entity(run.room, "captive")?.freed || !["rescue", "echo"].includes(run.room.goal) || !run.relic.maneuvers.length) return null;
    const next = generalizeManeuver(run, run.relic.maneuvers[0]);
    return previewPlan(run, next).legal ? next : null;
  }, [run, plan]);
  if (!run) return <main className={styles.root} lang="nb"><div className={styles.loading}><Rune /><p>Steinen holder pusten.</p></div></main>;
  const selectedEntity = entity(run.room, selected ?? undefined), guardian = entity(run.room, "guardian"), atExit = distance(playerEntity(run.room), entity(run.room, "exit")!) <= 1;
  const lastEvents = meaningful(run).slice(-5).reverse(), latestTheory = run.hypotheses[0];
  const choices = suggestions(run), pendingReports = run.reports.filter(r => r.room === run.room.index && !r.intercepted && r.delivered === null);
  const canSave = !!run.lastSequence?.success && run.lastSequence.steps.length > 1;
  const canRemember = canSave && !!run.lastSequence?.steps.some(s => s.verb === "RELEASE");
  const canReuse = !!reusablePlan;
  const showLearnedPlan = (next: Plan) => { setAuto(false); setPlan(next); setConnections(next.steps.filter(s => s.verb !== "MOVE")); setLens(true); setTab("room"); focusBoard(); };
  const nextAction = !run.relic.principles.length ? "Lær relikvien hvem du er." : run.activePlan?.interrupted ? "Planen er brutt. Finn en ny åpning." : run.room.solved ? "Bestem hvilken historie du lar gå videre." : run.room.objective;

  return <main className={`${styles.root} ${!run.relic.principles.length ? styles.onboarding : ""}`} lang="nb" data-testid="mind-game" data-revision={run.revision} data-room={run.room.index} data-status={run.status} data-hp={run.player.hp}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>D<span>ELVEWORN</span></Link>
      <div className={styles.headerCenter}><span>THE LIVING DUNGEON</span><i />{run.room.index < 12 ? "KAPITTEL I" : `DYBDE ${Math.floor(run.room.index / 6)}`}</div>
      <div className={styles.headerActions}><button aria-expanded={helpOpen} aria-controls="mind-how-to" onClick={() => { setAuto(false); setHelpOpen(true); requestAnimationFrame(() => { const help = document.getElementById("mind-how-to"); help?.scrollIntoView({ block: "start" }); help?.querySelector("summary")?.focus(); }); }}>Slik spiller du</button><button onClick={() => { void audio.current?.toggle().then(setSound); }} aria-label={sound ? "Slå av lyd" : "Slå på lyd"}>{sound ? "♪ Lyd på" : "♪ Lyd av"}</button><Link href="/">Alle moduser ↗</Link></div>
    </header>
    <section className={styles.masthead}>
      <div><p className={styles.eyebrow}>EN INTELLIGENS VENTER UNDER DEG</p><h1>The Mind Beneath<span>.</span></h1><p className={styles.tagline}>Lær relikvien hvem du er. <em>Overbevis dungeonen om at du er en annen.</em></p></div>
      <div className={styles.resources} aria-label="Dine ressurser"><Resource label="LIV" value={`${run.player.hp}/${run.player.maxHp}`} ratio={run.player.hp / run.player.maxHp} /><Resource label="RELIKVIE" value={`${run.relic.energy}`} ratio={run.relic.energy / 20} /><Resource label="DRIKKER" value={`${run.player.potions}`} /><Resource label="TILLIT" value={`${run.relic.trust}`} /></div>
    </section>
    <nav className={styles.acts} aria-label="Ekspedisjonens seks akter">{ACTS.map((act, i) => <div key={act} className={Math.min(run.room.act, 5) === i ? styles.currentAct : run.room.act > i ? styles.pastAct : ""}><span>{String(i + 1).padStart(2, "0")}</span><b>{act}</b></div>)}</nav>
    <PlayHelp open={helpOpen} onToggle={open => { setHelpOpen(open); if (open) setAuto(false); }} />
    <div className={styles.layout}>
      <section className={styles.worldColumn} aria-label="Rommet">
        <div className={styles.roomHeading}><div><p className={styles.eyebrow}>{run.room.index < 12 ? `AKT ${run.room.act + 1} · ${ACTS[run.room.act]}` : "UNDER DEN FØRSTE KONKLUSJONEN"}</p><h2>{run.room.title}</h2></div><button className={`${styles.lensButton} ${lens ? styles.lensActive : ""}`} aria-pressed={lens} onClick={() => setLens(v => !v)}><span>◈</span> Mulighetslinsen <kbd>L</kbd></button></div>
        <p className={styles.objective}>{nextAction}</p><p className={styles.roomLore}>{run.room.subtitle}</p>
        <div ref={boardAnchor} className={styles.boardAnchor}>
        <PlayGuide run={run} plan={plan} preview={preview} auto={auto} canRemember={canRemember} canReuse={canReuse} atExit={atExit} onAction={action => {
          if (action === "preview") { if (run.room.goal === "echo" && entity(run.room, "captive")?.freed) choosePlan([...(run.room.light ? [{ verb: "EXTINGUISH_LIGHT" as const, target: "light" }] : []), { verb: "HIDE" }, { verb: "ATTACK", target: "guardian" }], "none", "Angrip fra skjul"); else if (canReuse && reusablePlan) showLearnedPlan(reusablePlan); else choosePlan(choices[0].operations, choices[0].boundary, choices[0].label); }
          else if (action === "remember") void dispatch({ type: "save-maneuver", name: "Stille nåde", boundary: run.lastSequence?.steps.some(s => ["ATTACK", "STORM"].includes(s.verb)) ? "free-target" : "no-harm" });
          else if (action === "exit") { if (atExit && run.room.solved) void dispatch({ type: "descend" }); else if (atExit) choosePlan([{ verb: "WAIT" }], "none", "Vent ved trappen"); else choosePlan([{ verb: "MOVE", at: { x: 8, y: 7 } }], "none", "Til trappen"); }
          else if (action === "retreat") { if (atExit) direct({ verb: "RETREAT" }); else choosePlan([{ verb: "MOVE", at: { x: 8, y: 7 } }], "none", "Veien ut"); }
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
          {!run.relic.principles.length && <section className={styles.teaching} aria-label="Lær relikvien"><p className={styles.eyebrow}>FØRSTE LÆRDOM</p><h3>Hva skal jeg huske først?</h3><p>Velg en regel du vil at relikvien skal forstå.</p>{(["protect", "no-harm", "survive"] as PrincipleId[]).map(id => <button className={`${styles.lessonOption} ${pendingTeaching?.principle === id ? styles.chosen : ""}`} key={id} onClick={() => setPendingTeaching({ principle: id, scope: PRINCIPLES[id].scope })}><span>◇</span>{PRINCIPLES[id].title}</button>)}{pendingTeaching && <TeachingConfirmation teaching={pendingTeaching} onConfirm={() => void dispatch({ type: "teach", ...pendingTeaching })} onScope={scope => setPendingTeaching({ ...pendingTeaching, scope })} />}</section>}
        </PlayGuide>

        {plan && preview && <div className={styles.boardPlan}><div><span className={styles.eyebrow}>FORHÅNDSVISNING · INGENTING HAR SKJEDD ENNÅ</span><b>{plan.steps.length} steg · {preview.energyCost} energi{preview.healthCost > 0 ? ` · ${preview.healthCost} liv` : ""}</b></div><button className={styles.primary} disabled={!preview.legal} onClick={() => { void dispatch({ type: "commit", plan }); setAuto(true); focusBoard(); }}>Utfør planen →</button></div>}
        {run.activePlan && <div className={styles.boardPlan}><div><span className={styles.eyebrow}>{run.activePlan.interrupted ? "AVBRUTT" : "PLANEN SKJER"}</span><b>{run.activePlan.interrupted ?? `Steg ${run.activePlan.cursor + 1} av ${run.activePlan.plan.steps.length}`}</b></div><button onClick={() => { if (run.activePlan?.interrupted) { void dispatch({ type: "cancel" }); } else setAuto(v => !v); }}>{run.activePlan.interrupted ? "Improviser" : auto ? "Pause ved brettet" : "Fortsett ved brettet"}</button></div>}
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
        <div className={styles.actionDock} aria-label="Direkte handlinger">
          {([ ["ATTACK", "Attack", "╱"], ["STORM", "Storm", "ϟ"], ["POTION", "Potion", "♧"], ["PROTECT", "Beskytt", "◇"], ["HIDE", "Skjul", "◐"], ["OBSERVE", "Undersøk", "◎"] ] as [Verb, string, string][]).map(([verb, label, icon]) => <button key={verb} disabled={!run.relic.principles.length || run.status !== "playing" || verb === "POTION" && (run.player.potions === 0 || run.player.hp === run.player.maxHp) || verb === "STORM" && run.relic.energy < 4} onClick={() => direct({ verb, ...(["ATTACK", "STORM"].includes(verb) ? { target: "guardian" } : verb === "PROTECT" ? { target: "captive" } : verb === "OBSERVE" ? { target: selected ?? "captive" } : {}) })}><span>{icon}</span>{label}<small>{verb === "STORM" ? "4 energi" : verb === "PROTECT" ? "2 energi" : verb === "POTION" ? "+16 liv" : verb === "OBSERVE" ? "Fri handling" : "1 tur"}</small></button>)}
        </div>
        <div className={styles.worldNotice} role="status" aria-live="polite"><span>DETTE SKJEDDE</span><p>{notice || run.notice}</p></div>
        {run.room.solved && <div className={styles.exitCard}><div><span className={styles.eyebrow}>{run.room.family === "echo" ? "EKKOET BRAST" : "EN VEI VIDERE"}</span><h3>{run.room.family === "echo" ? "Den var sikker. Du var ikke ferdig." : "Hvem får fortelle historien?"}</h3><p>{entity(run.room, "relay")?.active && run.room.index >= 4 ? "Overlevende vitner kan rapportere når du forlater rommet." : "Rapportveien er stille. Det dere lærte, følger med."}</p></div><button className={styles.primary} onClick={() => atExit ? void dispatch({ type: "descend" }) : choosePlan([{ verb: "MOVE", at: { x: 8, y: 7 } }])}>{atExit ? "Gå dypere ↓" : "Gå til trappen →"}</button></div>}
        {run.status === "fallen" && <div className={styles.exitCard}><div><h3>Et arr. Ikke en sletting.</h3><p>Relikvien og vitnene beholder det de vet. Du vender tilbake til dette kammeret med 24 liv.</p></div><button className={styles.primary} onClick={() => void dispatch({ type: "recover" })}>Vend tilbake</button></div>}
        <div className={styles.identityStrip}><div><span className={styles.eyebrow}>RELIKVIEN LÆRTE <i className={styles.tealDot} /></span><p>{run.relic.principles[0] ? PRINCIPLES[run.relic.principles[0].id].title : "Dine grunner er ennå dine egne."}</p><small>Privat mellom dere</small></div><div><span className={styles.eyebrow}>DUNGEONEN MISTENKER <i className={styles.goldDot} /></span><p>{latestTheory && (run.room.index >= 6 || run.room.inspected.includes("relay")) ? THEORY_COPY[latestTheory.claim] : run.reports.some(r => r.delivered !== null) ? "En historie har nådd dypet. Tegnene kommer senere." : "Den har ennå ingen levert historie."}</p><small>{latestTheory && run.room.index >= 6 ? latestTheory.confidence >= .65 ? "Den virker sikker" : "Den prøver en teori" : "Bare det som når fram"}</small></div></div>
      </section>
      <aside className={styles.sideColumn}>
        <div className={styles.relicCard} key={`${run.relic.stage}-${run.chills.understood ?? ""}`}><div className={styles.relicTop}><Rune /><div><span className={styles.eyebrow}>RELIKVIEN</span><span className={styles.relicStage}>{STAGES[run.relic.stage]}</span></div><span className={styles.privateBadge}>PRIVAT</span></div><blockquote>«{run.relic.line}»</blockquote>
          {run.relic.pendingChoice && <div className={styles.choice}><p>Runen vender seg mot {run.relic.pendingChoice.protect ? "den fangede" : "deg"}. Den handler ved neste tur.</p><small>{run.relic.pendingChoice.protect ? "Du mister 4 liv. Relikvien bruker 3 energi og beskytter den fangede." : "Relikvien bruker 2 energi på å skjerme deg."}</small><button disabled={run.relic.energy < 4 || run.relic.trust < 1} onClick={() => void dispatch({ type: "override" })}>Overstyr · 4 energi + 1 tillit</button><Why run={run} sources={run.relic.pendingChoice.sources} /></div>}
        </div>
        {run.relic.principles.length > 0 && <>
          <div className={styles.tabs} role="tablist" aria-label="Kunnskap"><button role="tab" aria-selected={tab === "room"} onClick={() => setTab("room")}>Muligheter</button><button role="tab" aria-selected={tab === "relic"} onClick={() => setTab("relic")}>Relikvien</button><button role="tab" aria-selected={tab === "memory"} onClick={() => setTab("memory")}>Spor</button></div>
          {tab === "room" && <section className={styles.panel}>
            {run.activePlan ? <div className={styles.activePlan}><p className={styles.eyebrow}>DIN HANDLINGSREKKE</p><h3>{run.activePlan.plan.name}</h3><p>{run.activePlan.interrupted ?? `Steg ${run.activePlan.cursor + 1} av ${run.activePlan.plan.steps.length}`}</p><div className={styles.buttonRow}><button className={styles.primary} disabled={!!run.activePlan.interrupted} onClick={() => { setAuto(false); void dispatch({ type: "step" }); }}>Neste steg →</button><button onClick={() => setAuto(v => !v)} disabled={!!run.activePlan.interrupted}>{auto ? "Pause" : "La planen gå"}</button></div><button className={styles.textButton} onClick={() => { setAuto(false); void dispatch({ type: "cancel" }); }}>Bryt av og improviser</button></div>
              : plan && preview ? <div className={styles.planCard}><p className={styles.eyebrow}>EN MULIG FRAMTID</p><h3>{plan.name}</h3><div className={styles.costs}><span>{plan.steps.length} turer</span><span>{preview.energyCost} energi</span><span>{preview.healthCost > 0 ? `−${preview.healthCost}` : preview.healthCost < 0 ? `+${-preview.healthCost}` : "0"} liv</span></div><ol className={styles.planSteps}>{plan.steps.map((step, i) => step.verb === "MOVE" ? null : <li key={i}><span>{describeOperation(run, step)}</span><button aria-label={`Fjern steg ${i + 1}`} onClick={() => { const steps = plan.steps.filter((_, j) => i !== j); setPlan({ ...plan, steps }); }}>×</button></li>)}</ol><details className={styles.why}><summary>Vis bevegelsene · {plan.steps.filter(s => s.verb === "MOVE").length} ruter</summary><ol>{plan.steps.map((step, i) => <li key={i}>{describeOperation(run, step)}</li>)}</ol></details><p className={preview.legal ? styles.consequence : styles.warning}>{preview.legal ? preview.outcome : preview.reason}</p><p className={styles.audience}><span>NOEN KAN OBSERVERE</span>{preview.observations.length ? preview.observations.join(", ") : "Ingen ser de avgjørende handlingene."}</p>{preview.complications.length > 0 && <details className={styles.why}><summary>Mulig konsekvens</summary>{preview.complications.map(c => <p key={c}>{c}</p>)}</details>}<div className={styles.buttonRow}><button className={styles.primary} disabled={!preview.legal} onClick={() => { void dispatch({ type: "commit", plan }); setAuto(true); }}>Utfør fra detaljvisningen</button><button onClick={() => { setPlan(null); setConnections([]); }}>Endre</button></div></div>
              : <><div className={styles.panelTitle}><span className={styles.eyebrow}>LES ROMMET</span><span>{pendingReports.length ? `${pendingReports.length} rapport på vei` : "Trykk på noe for å undersøke"}</span></div>
                <div className={styles.objectList}>{run.room.entities.filter(e => e.active && !["player"].includes(e.role)).map(e => <button key={e.id} className={selected === e.id ? styles.objectSelected : ""} onClick={() => setSelected(e.id)} title={e.name}>{e.role === "captive" ? "◇" : e.role === "guardian" || e.role === "echo" ? "†" : e.role === "observer" ? "◉" : e.role === "relay" ? "⋈" : "·"}<span>{e.name}</span></button>)}</div>
                {selectedEntity && <div className={styles.inspection}><h3>{selectedEntity.name}</h3><p>{objectCopy(run, selectedEntity.id)}</p><div className={styles.contextActions}>{verbsForRole(selectedEntity.role).map(verb => <button key={verb} onClick={() => {
                  const operation: Operation = { verb, ...(!["HIDE", "WAIT", "POTION", "RETREAT"].includes(verb) ? { target: selectedEntity.id } : {}) };
                  if (verb === "OBSERVE") direct(operation); else { const ops = [...connections, operation]; setConnections(ops); choosePlan(ops); }
                }}>{VERB_COPY[verb]}{verb !== "OBSERVE" ? " ＋" : ""}</button>)}</div></div>}
                <div className={styles.suggestions}><p className={styles.eyebrow}>VELG ET PLANFORSLAG</p>{choices.map((choice, i) => <button key={choice.label} onClick={() => choosePlan(choice.operations, choice.boundary, choice.label)}><span>0{i + 1}</span><div><b>{choice.label}</b><small>{choice.detail}</small></div><span>↗</span></button>)}</div></>}
            {plan && !run.activePlan && <div className={styles.extendPlan}><label htmlFor="add-object">Knytt til et nytt objekt</label><select id="add-object" value="" onChange={event => { const id = event.target.value; setSelected(id); setPlan(null); }}><option value="">Velg neste forbindelse …</option>{run.room.entities.filter(e => e.active && e.role !== "player").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
            {!run.activePlan && <details className={styles.intentInput}><summary>Beskriv en egen plan <span>Valgfritt</span></summary><label htmlFor="mind-intent">Hva prøver du å få til?</label><textarea id="mind-intent" rows={2} maxLength={AI_TEXT_LIMIT} value={text} onChange={e => setText(e.target.value)} placeholder="Få personen fri uten at skriveren ser hvordan." /><p>Teksten sendes til OpenAI når du ber om en mulig framtid. Den lagres ikke i statistikk.</p><button disabled={!text.trim() || aiBusy || callCount >= 40} onClick={() => void askRelic("plan")}>{aiBusy ? "Relikvien tenker. Du kan fortsatt gå." : "Vis en mulig framtid ↗"}</button>{aiLine && <p role="status">{aiLine}</p>}</details>}
          </section>}
          {tab === "relic" && <section className={styles.panel}><p className={styles.eyebrow}>DET BARE DERE VET</p><h3>Hva lærte du?</h3>{run.relic.principles.map(p => <div className={styles.lesson} key={p.id}><h4>{PRINCIPLES[p.id].title}</h4><p>{p.interpretation}</p><small>{p.confidence >= .75 ? "Tryggere på denne lærdommen" : "Fortsatt usikker"} · {SCOPE_COPY[p.scope]}</small><Why run={run} sources={[...p.examples.slice(-1), ...p.corrections.slice(-1)]} /><label>Når skal dette gjelde?<select aria-label={`Korriger ${PRINCIPLES[p.id].title}`} value={p.scope} onChange={e => void dispatch({ type: "correct", principle: p.id, scope: e.target.value as Scope })}>{Object.entries(SCOPE_COPY).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>{run.relic.misunderstanding && <button onClick={() => void dispatch({ type: "correct", principle: p.id, scope: PRINCIPLES[p.id].scope })}>Nei. Personen må faktisk komme fri.</button>}<details className={styles.why}><summary>Hva er du usikker på?</summary><p>{p.conflicts.length ? "To regler vil ha det samme øyeblikket. Noen må vente." : PRINCIPLES[p.id].question}</p></details></div>)}
            <button className={styles.textButton} onClick={() => setRawLessons(v => !v)}>Lær et nytt prinsipp ＋</button>{rawLessons && <div className={styles.moreLessons}>{(Object.keys(PRINCIPLES) as PrincipleId[]).filter(id => !run.relic.principles.some(p => p.id === id)).map(id => <button key={id} onClick={() => setPendingTeaching({ principle: id, scope: PRINCIPLES[id].scope })}>{PRINCIPLES[id].title}</button>)}<label htmlFor="teach-text">Eller forklar prinsippet kort</label><textarea id="teach-text" value={text} maxLength={AI_TEXT_LIMIT} onChange={e => setText(e.target.value)} /><small>Sendes til OpenAI for tolkning når du velger «Tolk lærdommen».</small><button disabled={!text.trim() || aiBusy} onClick={() => void askRelic("teach")}>Tolk lærdommen</button>{aiLine && <p>{aiLine}</p>}</div>}{pendingTeaching && <TeachingConfirmation teaching={pendingTeaching} onConfirm={() => void dispatch({ type: run.relic.principles.some(p => p.id === pendingTeaching.principle) ? "correct" : "teach", ...pendingTeaching })} onScope={scope => setPendingTeaching({ ...pendingTeaching, scope })} />}
            <h3 className={styles.sectionTitle}>Personlige manøvrer</h3>{canSave && <div className={styles.saveManeuver}><p>Denne åpningen virket. Hva skal relikvien ta med videre?</p><label htmlFor="maneuver-name">Gi manøveren et navn</label><input id="maneuver-name" maxLength={42} value={maneuverName} onChange={e => setManeuverName(e.target.value)} /><button className={styles.primary} onClick={() => void dispatch({ type: "save-maneuver", name: maneuverName, boundary: run.lastSequence?.steps.some(s => ["ATTACK", "STORM"].includes(s.verb)) ? "free-target" : "no-harm" })}>Bevar manøveren</button></div>}
            {!run.relic.maneuvers.length && !canSave && <p className={styles.muted}>En åpning du skaper og lykkes med, kan bli noe dere tar med videre.</p>}{run.relic.maneuvers.map(m => <div className={styles.maneuver} key={m.id}><span className={styles.eyebrow}>{m.uses} BRUK · {m.contexts.length} SLAGS ROM</span><h4>{m.name}</h4><p>{m.steps.map(s => VERB_COPY[s.verb]).join(" → ")}</p><small>{m.boundary === "no-harm" ? "Personen skal fri. Vokteren skal leve." : m.boundary === "free-target" ? "Personen må komme fri." : "Ingen fast grense ennå."}</small><button onClick={() => { showLearnedPlan(generalizeManeuver(run, m)); }}>Bruk i dette rommet ↗</button><button className={styles.textButton} onClick={() => void dispatch({ type: "correct-maneuver", id: m.id, boundary: "no-harm" })}>Korriger: Frihet, uten å skade vokteren</button><Why run={run} sources={m.examples.slice(0, 3)} /></div>)}</section>}
          {tab === "memory" && <section className={styles.panel}><p className={styles.eyebrow}>HISTORIEN HAR FLERE EIERE</p><h3>Spor som betyr noe</h3>{run.room.index >= 6 && run.hypotheses.map(h => <div className={styles.theory} key={h.claim}><span>DUNGEONEN MISTENKER</span><p>{THEORY_COPY[h.claim]}</p><small>{h.confidence > .65 ? "Sikker" : "Prøvende"} · {h.rooms.length} kamre · {h.noise > 2 ? "Motstridende spor" : "Sammenhengende spor"}</small><Why run={run} sources={h.sources} /></div>)}
            {run.room.components.map(c => <div className={styles.theory} key={c.id}><h4>{COMPONENTS[c.id].name}</h4><p>{COMPONENTS[c.id].effect}</p><Why run={run} sources={c.sources} /></div>)}
            {lastEvents.map(f => <div className={styles.event} key={f.id}><span>{f.private ? "PRIVAT" : "DETTE SKJEDDE"} · KAMMER {f.room + 1}</span><p>{f.text}</p>{f.sources.length > 0 && <Why run={run} sources={f.sources} />}</div>)}
            {run.relationships.length > 0 && <><h3 className={styles.sectionTitle}>De som husker deg</h3>{run.relationships.map(r => <div key={r.id} className={styles.relationship}>◇ {r.name}<small>{r.rescued} ganger fri · skylder deg {r.debt} tjenester</small>{run.room.index >= 4 && r.debt > 0 && <div className={styles.contextActions}><button disabled={run.player.potions >= 4} onClick={() => void dispatch({ type: "favor", relationshipId: r.id, help: "supplies" })}>Be om en helsedrikk · 1 tjeneste</button><button disabled={!entity(run.room, "relay")?.active} onClick={() => void dispatch({ type: "favor", relationshipId: r.id, help: "silence" })}>Steng rapportveien · 1 tjeneste</button></div>}</div>)}</>}
            {run.echoes > 0 && <div className={styles.reconstruction}><h3>Hvorfor ekkoet brast</h3>{([ ["Relikvien forsto", run.chills.understood], ["Dungeonen tok feil", run.chills.mistaken], ["Forskjellen avgjorde", run.chills.divergence] ] as const).map(([label, id]) => <div key={label}><h4>{label}</h4><p>{id ? run.facts.find(f => f.id === id)?.text : "Denne veien ble ikke åpnet i ekspedisjonen din."}</p>{id && <Why run={run} sources={[id]} />}</div>)}</div>}
          </section>}
        </>}
        {canSave && tab !== "relic" && <button className={styles.saveNudge} onClick={() => setTab("relic")}>◇ Denne åpningen kan bli din. <span>Bevar en personlig manøver →</span></button>}
        {run.relic.misunderstanding && tab !== "relic" && <button className={styles.correctNudge} onClick={() => setTab("relic")}>Relikvien lærte for mye av ett øyeblikk.<span>Korriger den →</span></button>}
      </aside>
    </div>
    <footer className={styles.footer}><span><i className={styles.tealDot} />{saveStatus}</span><span>Ingen wallet · Minnet følger denne nettleseren</span><span>{guardian?.active && run.room.alert >= 2 ? "KAMP OG UTFORSKNING · SAMME VERDEN" : "Hvert vitne ser bare en del av deg."}</span><small>Etter første ekko kan erfaringene deres sendes til OpenAI for å forberede neste rom. Direkte handlinger skjer alltid med en gang.</small></footer>
  </main>;
}

function Resource({ label, value, ratio }: { label: string; value: string; ratio?: number }) { return <div className={styles.resource}><span>{label}</span><b>{value}</b>{ratio !== undefined && <div className={styles.meter}><i style={{ width: `${Math.min(1, ratio) * 100}%` }} /></div>}</div>; }
function Rune() { return <svg className={styles.rune} viewBox="0 0 48 58" aria-hidden="true"><path d="M24 3 43 26 24 55 5 26Z" fill="#8dc7ac12" stroke="#a1d7bb" /><path d="M24 11V45M13 23 24 32 35 23M16 18 24 11 32 18" fill="none" stroke="#bee7cf" strokeWidth="1.5" /><circle cx="24" cy="32" r="3" fill="#d2f9db" /></svg>; }
function Why({ run, sources }: { run: Run; sources: string[] }) { return <details className={styles.why}><summary>Hvorfor?</summary>{traceSources(run, sources).slice(0, 10).map((line, i) => <p key={i}>{line}</p>)}</details>; }
function TeachingConfirmation({ teaching, onConfirm, onScope }: { teaching: { principle: PrincipleId; scope: Scope }; onConfirm: () => void; onScope: (scope: Scope) => void }) { return <div className={styles.confirmTeaching}><span className={styles.eyebrow}>SLIK FORSTÅR JEG DET</span><p>«{PRINCIPLES[teaching.principle].interpretation}»</p><label>Gjelder når<select value={teaching.scope} onChange={e => onScope(e.target.value as Scope)}>{Object.entries(SCOPE_COPY).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><button className={styles.primary} onClick={onConfirm}>Ja. Husk det slik →</button></div>; }
function objectCopy(run: Run, id: string): string {
  const e = entity(run.room, id)!;
  if (e.role === "captive") return e.freed ? "Fri. På vei mot trappen. Personen husker hvem som åpnet veien." : run.room.captiveDeadline ? `I fare etter tur ${run.room.captiveDeadline}. Vern og helsedrikker kjøper tid.` : "Bundet. Trenger noen som går helt fram og åpner lenken.";
  if (e.role === "guardian" || e.role === "echo") return `${e.hp}/${e.maxHp} liv. ${e.distracted ? `Avledet i ${e.distracted} turer.` : "Ser det som skjer innenfor synsfeltet."} ${e.protected ? "Relikviens feilslåtte vern demper skade." : ""}`;
  if (e.role === "observer") return e.intent === "report" ? "Bærer en historie mot rapportåren. Den kan avbrytes, men ikke få minnene slettet." : "Et troverdig vitne. Det ser handlingene, ikke grunnene dine.";
  if (e.role === "relay") return "En fysisk vei til The Mind Beneath. Stans den, eller la en nyttig feiloppfatning passere.";
  if (e.role === "distraction") return "Kan trekke vokteren bort i seks turer. Nye vitner kan fortsatt følge med.";
  if (e.role === "light") return "Når lyset slukner, ser vitnene bare to ruter. En nær observatør kan fortsatt se deg.";
  if (e.role === "evidence") return "Et segl kan støtte en historie. Et enslig falskt spor overbeviser ingen alene.";
  if (e.role === "cover") return "Her kan du skjule åpningen din. Det som ikke blir sett, blir ikke automatisk kjent.";
  if (e.role === "exit") return run.room.solved ? "Veien videre er åpen. Overlevende vitner får tid til å sende rapporter." : "Du kan trekke deg tilbake, men den fangede blir igjen.";
  return "Du og relikvien kjenner hele hensikten. De andre ser bare det du viser.";
}

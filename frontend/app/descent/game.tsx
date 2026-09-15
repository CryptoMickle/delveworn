"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { attackRange, combatRelicSummary, currentCriticalChance, incomingRange, stormRange, type ShopAction } from "../practice/engine";
import { describePracticeAction, practiceLoot, type PracticeFeedback } from "../practice/feedback";
import { cryptoRandomInt } from "../practice/random";
import { getRelicDefinition } from "../relics";
import { useGameAudio } from "../use-game-audio";
import { GameLogo } from "../game-logo";
import { DungeonScene, ENEMY_ART, type SceneCue } from "../dungeon/scene";
import { BUILDS, ROOMS, createDescent, enemyIntent, phase, roomNumber, transition, type BuildId, type Descent, type DescentAction } from "./model";
import { DESCENT_SAVE_KEY, loadDescent, saveDescent } from "./storage";
import "./game.css";
import "../dungeon/scene.css";

function Meter({ label, value, max, enemy = false }: { label: string; value: number; max: number; enemy?: boolean }) {
  return <div className={`descent-meter ${enemy ? "enemy" : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{width:`${value/max*100}%`}} /></div>;
}
const storage = () => window.localStorage;
const range = ([min,max]: [number,number]) => min === max ? String(min) : `${min}–${max}`;
async function exclusiveSave(write: () => "saved" | "conflict" | "unavailable") {
  try { return navigator.locks ? await navigator.locks.request(DESCENT_SAVE_KEY,write) : write(); }
  catch { return "unavailable" as const; }
}

export default function DescentGame() {
  const [run,setRun] = useState<Descent | null>(null);
  const current = useRef<Descent | null>(null);
  const [loaded,setLoaded] = useState(false);
  const [saveNotice,setSaveNotice] = useState("");
  const [invalidSave,setInvalidSave] = useState(false);
  const [saveBlocked,setSaveBlocked] = useState(false);
  const sessionOnly = useRef(false);
  const [busy,setBusy] = useState(false), lock = useRef(false);
  const [cue,setCue] = useState<SceneCue>(null);
  const [feedback,setFeedback] = useState<PracticeFeedback | null>(null);
  const [confirmRestart,setConfirmRestart] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneArea = useRef<HTMLDivElement>(null), merchantArea = useRef<HTMLElement>(null);
  const p = run ? phase(run) : null;
  const audio = useGameAudio({ bossActive: p === "combat" && run?.game.monsterType === 3, exploring:p === "explore" || p === "recovery", encounter: p === "combat" && run ? ENEMY_ART[run.game.monsterType].name : undefined, encounterKey: run ? roomNumber(run) : undefined });

  useEffect(() => {
    const restore = () => {
      const result = loadDescent(storage);
      if (result.status === "restored") { current.current = result.run; setRun(result.run); setInvalidSave(false); }
      if (result.status === "invalid") { setInvalidSave(true); setSaveNotice("This saved descent cannot be read. It is preserved until you choose to replace it."); }
      if (result.status === "unavailable") { sessionOnly.current = true; setSaveNotice("Saving is unavailable. You can play, but this run will end when you leave."); }
      setLoaded(true);
    };
    restore();
    const changed = (event: StorageEvent) => {
      if (event.key !== DESCENT_SAVE_KEY || sessionOnly.current) return;
      if (timer.current) clearTimeout(timer.current);
      lock.current = false; setBusy(false); setCue(null);
      const result = loadDescent(storage);
      if (result.status === "restored") { current.current=result.run; setRun(result.run); setSaveNotice("Updated to the run saved in your other tab."); }
      else { setSaveNotice("The save changed in another tab. Reload before continuing."); setSaveBlocked(true); lock.current=true; }
    };
    window.addEventListener("storage",changed);
    return () => { if (timer.current) clearTimeout(timer.current); window.removeEventListener("storage",changed); };
  },[]);

  async function start(build: BuildId, replace = false) {
    if (lock.current) return;
    lock.current = true;
    let next: Descent;
    try {
      const seed=cryptoRandomInt(0x1_0000_0000);
      const id=globalThis.crypto.randomUUID?.() ?? `descent-${seed.toString(36)}-${cryptoRandomInt(0x1_0000_0000).toString(36)}`;
      next = createDescent(build,seed,id);
    } catch { setSaveNotice("This browser could not create a random run. Try reloading the page."); lock.current=false; return; }
    audio.playAction("click");
    const write = () => sessionOnly.current ? "unavailable" : saveDescent(storage,next,current.current,replace);
    const saved = await exclusiveSave(write);
    if (saved === "conflict") { setSaveNotice("A newer run exists. Reload to resume it before starting another."); setSaveBlocked(true); lock.current=false; return; }
    if (saved === "unavailable") { sessionOnly.current=true; setSaveNotice("Saving is unavailable. This run lasts for this visit only."); }
    else setSaveNotice("");
    current.current = next; setRun(next); setInvalidSave(false); setConfirmRestart(false); setFeedback(null); setCue(null); lock.current=false;
    requestAnimationFrame(() => sceneArea.current?.querySelector<SVGSVGElement>("svg[tabindex]")?.focus({preventScroll:true}));
  }

  async function act(action: DescentAction) {
    const before = current.current;
    if (!before || lock.current) return;
    lock.current=true; setBusy(true);
    const next = transition(before,action,before.revision);
    if (next === before) { lock.current=false; setBusy(false); return; }
    const combat = action === "attack" || action === "storm" || action === "potion";
    // Unlock/acknowledge in the actual gesture, before waiting on a save lock.
    // Door/approach timers already received their gesture at the floor control.
    if (combat) audio.playAction(action);
    else if (action !== "engage" && action !== "enter") audio.playAction("click");
    const write = () => sessionOnly.current ? "unavailable" : saveDescent(storage,next,before);
    const saved = await exclusiveSave(write);
    if (saved === "conflict") { setSaveNotice("A newer or unreadable save was found. Reload to continue safely."); setSaveBlocked(true); setBusy(false); return; }
    if (saved === "unavailable") { sessionOnly.current=true; setSaveNotice("Saving is unavailable. This run lasts for this visit only."); }
    current.current=next; setRun(next);
    if (combat) {
      setCue(next.game.relicReviveUsed && !before.game.relicReviveUsed ? "revive" : next.game.lastCritical ? "critical" : action);
      setFeedback(describePracticeAction(before.game,next.game,action));
      if (!next.game.active) audio.playOutcome("death");
      else if (next.game.roomsCleared === 10) audio.playOutcome("victory");
      else if (next.game.monsterHp === 0) audio.playOutcome("loot");
      else if (next.game.lastPlayerDamage > 0) audio.playOutcome(next.game.lastCritical ? "critical" : "hit");
    } else {
      setCue(null);
      if (action === "enter") setFeedback(null);
      else if (action === "engage") setFeedback({title:"Your turn.",detail:"Read the intention. A killing blow prevents retaliation.",tone:"neutral"});
      else setFeedback(describePracticeAction(before.game,next.game,action === "claim" ? "relic" : "shop"));
      if (action === "claim") audio.playOutcome("relic");
    }
    timer.current=setTimeout(() => { lock.current=false; setBusy(false); setCue(null); timer.current=null; },combat ? 580 : 160);
  }

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement) return;
    const action = {"1":"attack","2":"storm","3":"potion"}[event.key] as DescentAction | undefined;
    if (action) { event.preventDefault(); void act(action); }
  }

  const soundLabel = !audio.available ? "Sound unavailable" : audio.paused && audio.enabled ? "Resume sound" : audio.enabled ? "Mute sound" : "Enable sound";
  const header = <header className="descent-header"><GameLogo /><span className="descent-edition">THE FIRST DESCENT</span><button onClick={audio.toggleSound} disabled={!audio.available} aria-label={soundLabel} aria-pressed={audio.enabled}>{audio.enabled ? "♫" : "♪"} <span>{audio.paused && audio.enabled ? "Resume" : audio.enabled ? "Sound on" : "Sound off"}</span></button></header>;
  if (!loaded) return <main className="descent-shell">{header}<p className="descent-loading" role="status">Opening the dungeon…</p></main>;
  if (!run || confirmRestart) return <main className="descent-shell">{header}<section className="descent-entrance">
    <div className="descent-entrance-intro"><p className="descent-kicker">TEN ROOMS · NO WALLET NEEDED</p><h1>Management<br />is expecting you.</h1><p>Walk into the dungeon. Read your enemy. Make one good decision at a time.</p><p className="descent-subtle">Choose a training relic. It changes your strengths — and travels beside you.</p></div>
    {(saveNotice || confirmRestart) && <p className="descent-notice" role="status">{confirmRestart ? "Starting again replaces your current First Descent. Your other modes are kept." : saveNotice}{saveBlocked && <button onClick={() => window.location.reload()}>Resume saved run</button>}</p>}
    <div className="descent-builds">{BUILDS.map(build => { const relic=getRelicDefinition(build.relic); return <button key={build.id} onClick={() => void start(build.id,invalidSave || confirmRestart)} className={`descent-build ${build.id}`}>
      <Image src={relic.imageSrc!} alt="" width={100} height={100} /><span className="descent-kicker">{relic.rarity} · {relic.name}</span><h2>{build.name}</h2><strong>{build.style}</strong><p>{build.hint}</p><span className="descent-build-enter">{invalidSave ? "Replace save & enter" : "Enter as "+build.name} ↗</span>
    </button>; })}</div>
    <p className="descent-subtle">Saved in this browser when available. No payment, account or onchain rewards.</p>
    <div className="descent-entrance-links">{confirmRestart && <button onClick={() => setConfirmRestart(false)}>Keep playing</button>}<Link href="/practice">Classic endless Practice</Link><Link href="/">All modes</Link></div>
  </section></main>;

  const g=run.game, room=roomNumber(run), roomInfo=ROOMS[room-1], art=ENEMY_ART[g.monsterType], intent=enemyIntent(g.monsterType,run.roomTurns);
  const relic=getRelicDefinition(g.equippedRelic), attackDamage=attackRange(g,intent), stormDamage=stormRange(g), reply=incomingRange(g,intent);
  const combat=p === "combat", recovery=p === "recovery", terminal=p === "won" || p === "lost";
  const hasMerchant=recovery && (room === 5 || room === 9);
  const potionDisabled=busy || (!combat && !recovery) || g.potions === 0 || g.hp >= g.maxHp || (combat && g.combatPotionsUsed >= (g.monsterType === 3 ? 3 : 2));
  const potionReply=reply.map(n => Math.ceil(n/2)) as [number,number];
  const shop: { action: ShopAction; title: string; cost: number; detail: string; disabled: boolean }[] = room === 5 ? [
    {action:"supply-bandage",title:"Bandage",cost:20,detail:"Recover 25 HP · once",disabled:g.supplyBandageUsed || g.hp === g.maxHp},
    {action:"supply-potion",title:"Potion",cost:25,detail:`Take it with you · ${2-g.supplyPotionsBought} left`,disabled:g.supplyPotionsBought >= 2 || g.potions >= 5},
  ] : [
    {action:"camp-rest",title:"Rest",cost:25,detail:"Recover 30 HP · once",disabled:g.campRestUsed || g.hp === g.maxHp},
    {action:"camp-potion",title:"Potion",cost:20,detail:`Take it with you · ${2-g.campPotionsBought} left`,disabled:g.campPotionsBought >= 2 || g.potions >= 5},
    {action:"camp-weapon",title:"Weapon +1",cost:60,detail:"+2 base damage",disabled:false},
    {action:"camp-armor",title:"Armor +1",cost:60,detail:"Reduce every reply · up to 50%",disabled:false},
  ];
  return <main className="descent-shell" onKeyDown={keyboard} data-descent-phase={p} data-descent-revision={run.revision}>{header}
    <div className="descent-hud"><div className="descent-vitality"><span>VITALITY <strong>{g.hp} / {g.maxHp}</strong></span><Meter label="Your health" value={g.hp} max={g.maxHp} /></div><div><span>GOLD</span><strong>{g.gold}</strong></div><div><span>WEAPON</span><strong>{g.weaponLevel}</strong></div><div><span>ARMOR</span><strong>{g.armorLevel}</strong></div><div><span>POTIONS</span><strong>{g.potions} / 5</strong></div></div>
    {saveNotice && <p className="descent-notice" role="status">{saveNotice}{saveBlocked && <button onClick={() => window.location.reload()}>Resume saved run</button>}</p>}
    <div className="descent-room-heading"><div><p className="descent-kicker">ROOM {room} / 10 · {p === "lost" ? "FALLEN" : g.monsterHp === 0 ? "CLEARED" : "PRACTICE"}</p><h1>{roomInfo.title}</h1></div>
      <ol className="descent-map" aria-label="Dungeon progress">{ROOMS.map((r,i) => <li key={r.title} className={i < g.roomsCleared ? "cleared" : i+1 === room ? "current" : "unseen"} aria-label={`Room ${i+1}: ${i < g.roomsCleared ? "cleared" : i+1 === room ? "current" : "unexplored"}`} aria-current={i+1 === room ? "step" : undefined}><span>{i < g.roomsCleared ? "✓" : i+1 === room ? i+1 : "·"}</span></li>)}</ol>
    </div>
    <div className="descent-layout"><div className="descent-world" ref={sceneArea}>
      <div className="descent-mobile-enemy"><strong>{art.name}</strong><span>{g.monsterHp} / {g.monsterMaxHp} HP</span></div>
      <DungeonScene key={`${run.runId}:${room}`} view={{room,enemy:g.monsterType,enemyName:art.name,enemyHp:g.monsterHp,hp:g.hp,relic:g.equippedRelic,weapon:g.weaponLevel,armor:g.armorLevel,phase:p!,pending:busy,cue,cueId:run.revision,damage:g.lastPlayerDamage,incoming:g.lastMonsterDamage}}
        actions={{approach:() => void act("engage"),enter:() => void act("enter"),interact:() => audio.playAction("click"),merchant:hasMerchant ? () => { merchantArea.current?.scrollIntoView({behavior:"auto",block:"nearest"}); merchantArea.current?.focus({preventScroll:true}); } : undefined}} />
      {combat && <div className="descent-mobile-intent"><strong>{intent.name} · {range(reply)} reply</strong><p>{intent.hint}</p></div>}
      <div className="descent-report" role="status" aria-live="polite" aria-atomic="true" data-tone={feedback?.tone}><strong>{feedback?.title ?? roomInfo.note}</strong><p>{feedback?.detail ?? (p === "explore" ? "Tap the floor or use the arrow keys to walk. Approach the enemy to begin." : "Your run has resumed. All health, items and enemy intentions are restored.")}</p></div>
      <div className="descent-actions" role="group" aria-label="Combat actions" aria-busy={busy}>
        <button disabled={!combat || busy} onClick={() => void act("attack")}><span className="descent-action-symbol">⚔</span><strong>Attack <kbd>1</kbd></strong><span>{range(attackDamage)} damage</span><small>{currentCriticalChance(g)}% critical chance</small></button>
        <button className="storm" disabled={!combat || busy} onClick={() => void act("storm")}><span className="descent-action-symbol">ϟ</span><strong>Storm <kbd>2</kbd></strong><span>{range(stormDamage)} damage</span><small>Bypasses guard · can roll 0</small></button>
        <button className="potion" disabled={potionDisabled} onClick={() => void act("potion")}><Image className="descent-action-icon" src="/assets/loot/potion-v1.webp" alt="" width={31} height={31} /><strong>Potion <kbd>3</kbd></strong><span>Heal 25 · {g.potions} left</span><small>{combat ? `${range(potionReply)} reply · ${g.combatPotionsUsed}/${g.monsterType === 3 ? 3 : 2} used` : "No reply between rooms"}</small></button>
      </div>
    </div><aside className="descent-sidebar">
      {!terminal && p !== "reward" && <section className="descent-enemy-card" aria-label="Enemy intention"><Image src={art.src} alt={art.name} width={art.width} height={art.height} sizes="(max-width:760px) 100vw, 330px" className="descent-portrait" priority />
        <div><p className="descent-kicker">{art.role}</p><h2>{art.name} <span>{g.monsterHp} / {g.monsterMaxHp}</span></h2><Meter label="Enemy health" value={g.monsterHp} max={g.monsterMaxHp} enemy />
          {g.monsterHp > 0 ? <div className={`descent-intent ${intent.kind}`}><strong>{intent.name} · {range(reply)} damage</strong><p>{intent.hint}</p><small>Only if the enemy survives. Turn {run.roomTurns+1}.</small></div> : <div className="descent-intent"><strong>Room secured</strong><p>{practiceLoot(g)}</p><small>{room === 9 ? "Camp arrival restored up to 15 HP." : "Heal safely, then walk through the north door."}</small></div>}
        </div></section>}
      <section className={`descent-relic-card ${run.build}`} aria-label="Equipped relic"><Image src={relic.imageSrc!} alt="" width={86} height={86} /><div><p className="descent-kicker">{relic.rarity} · EQUIPPED</p><h2>{relic.name}</h2><p>{relic.effect}</p><p className="descent-relic-cost">{relic.tradeoff}</p></div><details><summary>How this relic changes your turn</summary><p>{combatRelicSummary(g,false)} on Attack.</p><p>{combatRelicSummary(g,true) ?? "Normal damage"} on Storm. Shown damage ranges include the relic and current guard.</p><p>The floating relic beside your shoulder is your active training loadout.</p></details></section>
      {hasMerchant && <section className="descent-merchant" ref={merchantArea} tabIndex={-1} aria-label="Kevin's shop"><Image className="descent-kevin" src="/characters/merchant-quartermaster-kevin.webp" alt="Quartermaster Kevin" width={400} height={240} /><p className="descent-kicker">{room === 9 ? "LAST CAMP BEFORE MANAGEMENT" : "SUPPLY ALCOVE"}</p><h2>Kevin has receipts.</h2><p>{room === 9 ? "Rest, stock up, or invest in the boss fight." : "Recovery now, or gold for later?"}</p><div>{shop.map(item => <button key={item.action} disabled={busy || item.disabled || g.gold < item.cost} onClick={() => void act(item.action)}><strong>{item.title}<span>{item.cost} gold</span></strong><small>{item.detail}</small></button>)}</div></section>}
      {p === "reward" && <section className="descent-result"><p className="descent-kicker">MANAGEMENT DEFEATED</p><h2>The org chart has a vacancy.</h2><Image src={getRelicDefinition(g.relicOfferId).imageSrc!} alt="" width={105} height={105} /><h3>{getRelicDefinition(g.relicOfferId).name}</h3><p>{getRelicDefinition(g.relicOfferId).effect}</p><p className="descent-subtle">A local boss reward for this completed descent.</p><button disabled={busy} onClick={() => void act("claim")}>Collect relic & finish</button></section>}
      {terminal && <section className="descent-result"><p className="descent-kicker">{p === "won" ? "DESCENT COMPLETE" : "EXIT INTERVIEW"}</p><h2>{p === "won" ? "You survived management." : "A short career. A useful lesson."}</h2><dl><div><dt>Rooms cleared</dt><dd>{g.roomsCleared} / 10</dd></div><div><dt>Turns</dt><dd>{run.turns}</dd></div><div><dt>Damage dealt</dt><dd>{run.damageDealt}</dd></div><div><dt>Potions used</dt><dd>{run.potionsUsed}</dd></div></dl><p>{p === "lost" ? `Your last reply cost ${g.lastMonsterDamage} HP. Read heavy intentions and time a potion for half retaliation.` : "Try a different relic. Same rooms, a fresh set of rolls."}</p><button onClick={() => setConfirmRestart(true)}>Try another build</button><Link href="/">Explore other modes</Link></section>}
    </aside></div>
    <details className="descent-journal"><summary>Dungeon journal · {run.turns} turns</summary>{g.log.map((line,i) => <p key={i}>{line}</p>)}</details>
    <footer className="descent-footer"><span>Local Practice · Training rules · Progress saved in this browser</span><button onClick={() => setConfirmRestart(true)} disabled={busy}>Start again</button><Link href="/">All modes</Link></footer>
  </main>;
}

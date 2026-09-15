"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { combatRelicSummary, incomingRange, type ShopAction } from "../practice/engine";
import { describePracticeAction, practiceLoot, type PracticeFeedback } from "../practice/feedback";
import { cryptoRandomInt } from "../practice/random";
import { getRelicDefinition } from "../relics";
import { useGameAudio } from "../use-game-audio";
import { GameLogo } from "../game-logo";
import { GameHud } from "../game-ui";
import { DungeonScene, ENEMY_ART, type SceneCue } from "../dungeon/scene";
import { ROOMS, createDescent, enemyIntent, phase, roomNumber, transition, type Descent, type DescentAction, type PendingLoot } from "./model";
import { DESCENT_SAVE_KEY, loadDescent, saveDescent } from "./storage";
import { exclusiveSave } from "./save-lock";
import { DescentCombatPanel, DescentEnemyStatus } from "./combat-panel";
import { MonsterReveal } from "./monster-reveal";
import { ShopKeeper, ShopVitals } from "../dungeon/shop-vitals";
import { InventoryPotions } from "../dungeon/inventory-potions";
import "./game.css";
import "./combat-panel.css";
import "./monster-reveal.css";
import "../dungeon/scene.css";

function Meter({ label, value, max, enemy = false }: { label: string; value: number; max: number; enemy?: boolean }) {
  return <div className={`descent-meter ${enemy ? "enemy" : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{width:`${value/max*100}%`}} /></div>;
}
const storage = () => window.localStorage;
const range = ([min,max]: [number,number]) => min === max ? String(min) : `${min}–${max}`;
function lootSummary(loot: PendingLoot) {
  return [loot.gold ? `${loot.gold} gold` : "",loot.potions ? `${loot.potions} potion` : "",loot.weapon ? "weapon +1" : "",loot.armor ? "armor +1" : ""].filter(Boolean).join(" · ");
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
  const [runtimeError,setRuntimeError] = useState<Error | null>(null);
  const [confirmRestart,setConfirmRestart] = useState(false);
  const [shopOpen,setShopOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneArea = useRef<HTMLDivElement>(null), merchantArea = useRef<HTMLElement>(null), shopDialog = useRef<HTMLDialogElement>(null), logDialog = useRef<HTMLDialogElement>(null);
  const p = run ? phase(run) : null;
  const audio = useGameAudio({ bossActive: p === "combat" && run?.game.monsterType === 3, encounter: p === "combat" && run ? ENEMY_ART[run.game.monsterType].name : undefined, encounterKey: run ? roomNumber(run) : undefined });

  useEffect(() => {
    const restore = () => {
      const result = loadDescent(storage);
      if (result.status === "restored") { current.current = result.run; setRun(result.run); setInvalidSave(false); setSaveBlocked(false); }
      if (result.status === "invalid") { setInvalidSave(true); setSaveNotice("This saved descent cannot be read. It is preserved until you choose to replace it."); }
      if (result.status === "legacy") { setInvalidSave(false); setSaveNotice("Your earlier First Descent save is preserved. Start a new run when you are ready to use the restored rules."); }
      if (result.status === "unavailable") { sessionOnly.current = true; setSaveNotice("Saving is unavailable. You can play, but this run will end when you leave."); }
      setLoaded(true);
    };
    restore();
    const changed = (event: StorageEvent) => {
      if (event.key !== DESCENT_SAVE_KEY || sessionOnly.current) return;
      if (timer.current) clearTimeout(timer.current);
      lock.current = false; setBusy(false); setCue(null);
      const result = loadDescent(storage);
      if (result.status === "restored") { current.current=result.run; setRun(result.run); setInvalidSave(false); setSaveNotice("Updated to the run saved in your other tab."); setSaveBlocked(false); }
      else { setSaveNotice("The save changed in another tab. Reload before continuing."); setSaveBlocked(true); setBusy(true); lock.current=true; }
    };
    window.addEventListener("storage",changed);
    return () => { if (timer.current) clearTimeout(timer.current); window.removeEventListener("storage",changed); };
  },[]);

  useEffect(() => {
    const dialog=shopDialog.current;
    if (!dialog) return;
    if (shopOpen && !dialog.open) dialog.showModal();
    if (!shopOpen && dialog.open) dialog.close();
  },[shopOpen,run]);

  async function start(replace = false) {
    if (lock.current) return;
    lock.current = true;
    let next: Descent;
    try {
      const seed=cryptoRandomInt(0x1_0000_0000);
      const id=globalThis.crypto.randomUUID?.() ?? `descent-${seed.toString(36)}-${cryptoRandomInt(0x1_0000_0000).toString(36)}`;
      next = createDescent(seed,id);
    } catch { setSaveNotice("This browser could not create a random run. Try reloading the page."); lock.current=false; return; }
    audio.playAction("click");
    const write = () => sessionOnly.current ? "unavailable" : saveDescent(storage,next,current.current,replace);
    const saved = await exclusiveSave(write);
    if (saved === "busy") { setSaveNotice("Another tab is saving. Try starting again."); setSaveBlocked(false); lock.current=false; return; }
    if (saved === "conflict") { setSaveNotice("A newer run exists. Reload to resume it before starting another."); setSaveBlocked(true); lock.current=false; return; }
    setSaveBlocked(false);
    if (saved === "unavailable") { sessionOnly.current=true; setSaveNotice("Saving is unavailable. This run lasts for this visit only."); }
    else setSaveNotice("");
    current.current = next; setRun(next); setInvalidSave(false); setConfirmRestart(false); setFeedback(null); setCue(null); lock.current=false;
    requestAnimationFrame(() => sceneArea.current?.querySelector<SVGSVGElement>("svg[tabindex]")?.focus({preventScroll:true}));
  }

  async function act(action: DescentAction) {
    const before = current.current;
    if (!before || lock.current) return;
    lock.current=true; setBusy(true);
    try {
    const next = transition(before,action,before.revision);
    if (next === before) { lock.current=false; setBusy(false); return; }
    const combatAction = action === "attack" || action === "storm" || (action === "potion" && phase(before) === "combat");
    const playerAction = combatAction || action === "potion";
    // Unlock/acknowledge in the actual gesture, before waiting on a save lock.
    // Door/approach timers already received their gesture at the floor control.
    if (playerAction) audio.playAction(action);
    else if (action !== "engage" && action !== "enter") audio.playAction("click");
    const write = () => sessionOnly.current ? "unavailable" : saveDescent(storage,next,before);
    const saved = await exclusiveSave(write);
    if (saved === "busy") { setSaveNotice("Another tab is saving. Try that action again."); setSaveBlocked(false); lock.current=false; setBusy(false); return; }
    if (saved === "conflict") { setSaveNotice("A newer or unreadable save was found. Reload to continue safely."); setSaveBlocked(true); setBusy(true); return; }
    setSaveBlocked(false);
    if (saved === "unavailable") { sessionOnly.current=true; setSaveNotice("Saving is unavailable. This run lasts for this visit only."); }
    else setSaveNotice("");
    current.current=next; setRun(next);
    if (combatAction) {
      setCue(next.game.relicReviveUsed && !before.game.relicReviveUsed ? "revive" : next.game.lastCritical ? "critical" : action);
      setFeedback(next.pendingLoot
        ? {title:`${action === "storm" ? "Storm" : next.game.lastCritical ? "Critical attack" : "Attack"} · ${next.game.lastPlayerDamage} damage`,detail:`Room ${next.game.roomsCleared} cleared. Tap the loot to collect it, or tap the door to leave it.${next.game.hp !== before.game.hp ? ` HP ${before.game.hp} → ${next.game.hp}.` : ""}`,tone:"good"}
        : describePracticeAction(before.game,next.game,action));
      if (!next.game.active) audio.playOutcome("death");
      else if (next.game.lastPlayerDamage > 0) audio.playOutcome(next.game.lastCritical ? "critical" : "hit");
    } else {
      setCue(null);
      if (action === "enter") setFeedback(null);
      else if (action === "engage") setFeedback({title:"Your turn.",detail:"A killing blow prevents the enemy's reply.",tone:"neutral"});
      else if (action === "skip-loot") setFeedback({title:"Loot left behind.",detail:phase(next) === "reward" ? "The floor supplies were not added. Choose what to do with your boss relic." : "The floor reward was not added. Heal, visit Kevin, or walk to the next room.",tone:"neutral"});
      else if (action === "collect" && before.pendingLoot) setFeedback({title:"Loot collected.",detail:lootSummary(before.pendingLoot),tone:"good"});
      else setFeedback(describePracticeAction(before.game,next.game,action === "potion" ? "potion" : action === "claim" || action === "claim-equip" ? "relic" : "shop"));
      if (action === "collect") audio.playOutcome(next.game.roomsCleared === 10 ? "victory" : "loot");
      if (action === "claim" || action === "claim-equip") audio.playOutcome("relic");
    }
    timer.current=setTimeout(() => { lock.current=false; setBusy(false); setCue(null); timer.current=null; },combatAction ? 280 : 160);
    } catch (error) {
      // Route error boundaries do not catch rejected event-handler promises.
      // Surface the failure on render; resuming reads the last committed save
      // instead of automatically replaying an action or crediting loot twice.
      lock.current=false; setBusy(false);
      setRuntimeError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.repeat || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target=event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable], [role='textbox']"))) return;
    if (document.querySelector("dialog[open], [role='dialog'][aria-modal='true']:not([hidden]), .descent-mobile-menu[open]")) return;
    const key=event.key.toLowerCase();
    const aliases:Record<string,DescentAction>={"1":"attack","2":"storm","3":"potion",p:"potion"};
    if (p === "combat") { aliases.a="attack"; aliases.s="storm"; }
    const action=aliases[key];
    if (action) { event.preventDefault(); void act(action); }
  }

  const soundLabel = !audio.available ? "Sound unavailable" : audio.paused && audio.enabled ? "Resume sound" : audio.enabled ? "Mute sound" : "Enable sound";
  if (runtimeError) throw runtimeError;
  const header = <header className="descent-header"><GameLogo /><span className="descent-edition">THE FIRST DESCENT</span><button onClick={audio.toggleSound} disabled={!audio.available} aria-label={soundLabel} aria-pressed={audio.enabled}>{audio.enabled ? "♫" : "♪"} <span>{audio.paused && audio.enabled ? "Resume" : audio.enabled ? "Sound on" : "Sound off"}</span></button></header>;
  if (!loaded) return <main className="descent-shell">{header}<p className="descent-loading" role="status">Opening the dungeon…</p></main>;
  if (!run || confirmRestart) return <main className="descent-shell">{header}<section className="descent-entrance">
    <div className="descent-entrance-intro"><p className="descent-kicker">TEN ROOMS · NO WALLET NEEDED</p><h1>Management<br />is expecting you.</h1><p>Walk into the dungeon. Attack for a reliable hit, risk a Storm, or use a potion when you need it.</p></div>
    {(saveNotice || confirmRestart) && <p className="descent-notice" role="status">{confirmRestart ? "Starting again replaces your current First Descent. Your other modes are kept." : saveNotice}{saveBlocked && <button onClick={() => window.location.reload()}>Resume saved run</button>}</p>}
    <div className="descent-start-card"><div><p className="descent-kicker">YOUR STARTING KIT</p><h2>100 HP · 3 potions · no relic</h2><p>Gold and upgrades stay on the floor until you walk over and pick them up.</p></div><button disabled={saveBlocked} onClick={() => void start(invalidSave || confirmRestart)}>{invalidSave ? "Replace saved run & start" : confirmRestart ? "Start a new run" : "Start run"} <span>↗</span></button></div>
    <p className="descent-subtle">Saved in this browser when available. No payment, account or onchain rewards.</p>
    <div className="descent-entrance-links">{confirmRestart && <button onClick={() => setConfirmRestart(false)}>Keep playing</button>}<Link href="/practice">Endless Practice</Link><Link href="/">All modes</Link></div>
  </section></main>;

  const g=run.game, room=roomNumber(run), roomInfo=ROOMS[room-1], art=ENEMY_ART[g.monsterType], intent=enemyIntent(g.monsterType,run.roomTurns);
  const relic=g.equippedRelic > 0 ? getRelicDefinition(g.equippedRelic) : null;
  const rewardRelic=p === "reward" && g.relicOfferId > 0 ? getRelicDefinition(g.relicOfferId) : null;
  const reply=incomingRange(g);
  const combat=p === "combat", recovery=p === "recovery", terminal=p === "won" || p === "lost";
  const hasMerchant=recovery && (room === 5 || room === 9);
  const potionDisabled=busy || (!combat && !recovery) || g.potions === 0 || g.hp >= g.maxHp || (combat && g.combatPotionsUsed >= (g.monsterType === 3 ? 3 : 2));
  const safePotionPhase=p === "loot" || recovery;
  const safePotionDisabledReason=busy ? "Another action is in progress."
    : g.potions === 0 ? "No potions left."
    : g.hp >= g.maxHp ? "HP is already full."
    : null;
  const safePotionControl=safePotionPhase ? <InventoryPotions potions={g.potions}
    onUse={() => void act("potion")} disabledReason={safePotionDisabledReason} /> : null;
  const actualGameHud=<GameHud hp={g.hp} maxHp={g.maxHp} potions={g.potions} maxPotions={5}
    gold={g.gold} weaponLevel={g.weaponLevel} weaponBonus={g.weaponLevel*2}
    armorLevel={g.armorLevel} armorAbsorption={g.armorLevel} armorReductionPercent={50}
    room={room} combatPotions={combat ? {used:g.combatPotionsUsed,limit:g.monsterType === 3 ? 3 : 2} : undefined} />;
  const shop: { action: ShopAction; title: string; cost: number; detail: string; disabled: boolean }[] = room === 5 ? [
    {action:"supply-bandage",title:"Bandage",cost:20,detail:"Recover 25 HP · once",disabled:g.supplyBandageUsed || g.hp === g.maxHp},
    {action:"supply-potion",title:"Potion",cost:25,detail:`Take it with you · ${2-g.supplyPotionsBought} left`,disabled:g.supplyPotionsBought >= 2 || g.potions >= 5},
  ] : [
    {action:"camp-rest",title:"Rest",cost:25,detail:"Recover 30 HP · once",disabled:g.campRestUsed || g.hp === g.maxHp},
    {action:"camp-potion",title:"Potion",cost:20,detail:`Take it with you · ${2-g.campPotionsBought} left`,disabled:g.campPotionsBought >= 2 || g.potions >= 5},
    {action:"camp-weapon",title:"Weapon +1",cost:60,detail:"+2 base damage",disabled:false},
    {action:"camp-armor",title:"Armor +1",cost:60,detail:"Reduce every reply · up to 50%",disabled:false},
  ];
  const roomStatus=p === "lost" ? "FALLEN" : p === "loot" ? "LOOT DROPPED" : g.monsterHp === 0 ? "CLEARED" : combat ? "COMBAT" : "ENTERING";
  const sceneLoot=p === "loot" && run.pendingLoot ? {type:g.lastLootType,amount:g.lastLootAmount,gold:run.pendingLoot.gold,relicId:0} : undefined;
  const combatDock=combat ? <DescentCombatPanel run={run} busy={busy} onAction={action => void act(action)} /> : null;
  const feedbackTitle=feedback?.title ?? (p === "loot" ? "Loot is waiting." : roomInfo.note);
  const feedbackDetail=feedback?.detail ?? (p === "explore" ? "Tap the floor or use the arrow keys to walk. Approach the enemy to begin." : p === "loot" ? "Tap the loot to collect it, or tap the door to continue without it." : "Your health, inventory and room progress have been restored.");
  const renderReport=(mobile=false) => <div className={`descent-report ${mobile ? "descent-mobile-report" : ""}`} role="status" aria-live="polite" aria-atomic="true" data-tone={feedback?.tone} data-phase={p}><strong>{feedbackTitle}</strong><p>{feedbackDetail}</p>{p !== "loot" && <button className="descent-report-log" onClick={() => logDialog.current?.showModal()} aria-label="Open dungeon log">Log ›</button>}</div>;
  const renderSaveRecovery=() => saveNotice ? <p className="descent-notice" role="status">{saveNotice}{saveBlocked && <button onClick={() => window.location.reload()}>Resume saved run</button>}</p> : null;
  const renderMerchant=(mobile=false) => hasMerchant ? <section className={`descent-merchant ${mobile ? "descent-mobile-sheet-card" : ""}`} ref={mobile ? undefined : merchantArea} tabIndex={-1} aria-label="Kevin's shop">
    {mobile && <header className="dungeon-shop-title"><h2>Kevin&apos;s shop</h2><button onClick={() => setShopOpen(false)} aria-label="Close Kevin's shop">Close</button></header>}
    {mobile && renderSaveRecovery()}
    <ShopVitals hp={g.hp} maxHp={g.maxHp} gold={g.gold} potions={g.potions} weapon={g.weaponLevel} armor={g.armorLevel} /><ShopKeeper camp={room === 9} /><div>{shop.map(item => <button key={item.action} disabled={busy || item.disabled || g.gold < item.cost} onClick={() => void act(item.action)}><strong>{item.title}<span>{item.cost} gold</span></strong><small>{item.detail}</small></button>)}</div>
  </section> : null;
  const renderReward=(mobile=false) => rewardRelic?.imageSrc ? <section className={`descent-result ${mobile ? "descent-mobile-sheet-card" : ""}`} aria-label="Boss relic reward"><p className="descent-kicker">MANAGEMENT DEFEATED</p><h2>The org chart has a vacancy.</h2>{mobile && renderSaveRecovery()}<Image src={rewardRelic.imageSrc} alt="" width={105} height={105} /><h3>{rewardRelic.name}</h3><p>{rewardRelic.effect}</p><p className="descent-subtle">The relic is yours. Choose whether to equip it.</p><div className={`descent-result-actions ${mobile ? "descent-mobile-result-actions" : ""}`}><button disabled={busy} onClick={() => void act("claim")}>Keep relic</button><button disabled={busy} onClick={() => void act("claim-equip")}>Equip relic & finish</button></div></section> : null;
  const renderTerminal=(mobile=false) => terminal ? <section className={`descent-result ${mobile ? "descent-mobile-sheet-card" : ""}`}><p className="descent-kicker">{p === "won" ? "DESCENT COMPLETE" : "EXIT INTERVIEW"}</p><h2>{p === "won" ? "You survived management." : "A short career. A useful lesson."}</h2>{mobile && renderSaveRecovery()}{mobile && <div className="descent-result-actions descent-mobile-result-actions"><button onClick={() => setConfirmRestart(true)}>Start another run</button><Link href="/">Explore other modes</Link></div>}<dl><div><dt>Rooms cleared</dt><dd>{g.roomsCleared} / 10</dd></div><div><dt>Turns</dt><dd>{run.turns}</dd></div><div><dt>Damage dealt</dt><dd>{run.damageDealt}</dd></div><div><dt>Potions used</dt><dd>{run.potionsUsed}</dd></div></dl><p>{p === "lost" ? `Your last reply cost ${g.lastMonsterDamage} HP. Watch your remaining HP and use potions before the next exchange.` : "The next run starts at 100 HP with three potions and no relic."}</p>{!mobile && <><button onClick={() => setConfirmRestart(true)}>Start another run</button><Link href="/">Explore other modes</Link></>}</section> : null;
  const recoveryPotion=recovery ? <button disabled={potionDisabled} onClick={() => void act("potion")} aria-label={`Potion, heal 25 HP safely, ${g.potions} remaining`}>Use potion · +25 HP · {g.potions} left</button> : null;
  const mobileTopOverlay=<div className="descent-mobile-top">
    <div className="descent-mobile-topbar">
      <details className="descent-mobile-menu"><summary aria-label="Open game menu">☰ <span>Menu</span></summary><div className="descent-mobile-menu-panel">
        <p className="descent-kicker">THE FIRST DESCENT</p><h2>Dungeon menu</h2>
        <details><summary>How to play</summary><p>Tap the floor to walk. Approach an enemy, then choose Attack, Storm, or Potion. After a victory, tap the loot to collect it, or tap the door to leave it behind and continue.</p></details>
        {p !== "loot" && <details><summary>Dungeon journal · {run.turns} turns</summary><div className="descent-mobile-journal">{g.log.map((line,i) => <p key={i}>{line}</p>)}</div></details>}
        {recoveryPotion}
        <button onClick={() => setConfirmRestart(true)} disabled={busy}>Start again</button><Link href="/practice">Endless Practice</Link><Link href="/">All modes</Link>
      </div></details>
      <div className="descent-mobile-room"><strong>Room {room} / 10</strong><span>{roomInfo.title} · {roomStatus}</span></div>
      <button className="descent-mobile-sound" onClick={audio.toggleSound} disabled={!audio.available} aria-label={soundLabel} aria-pressed={audio.enabled}>{audio.enabled ? "♫" : "♪"}<span>{audio.paused && audio.enabled ? "Resume" : audio.enabled ? "On" : "Off"}</span></button>
    </div>
    <div className="descent-mobile-progress" role="progressbar" aria-label={`Dungeon progress, room ${room} of 10`} aria-valuemin={1} aria-valuemax={10} aria-valuenow={room}><span style={{width:`${room*10}%`}} /></div>
    <div className="dungeon-original-hud">{actualGameHud}</div>
    {!terminal && p !== "reward" && <DescentEnemyStatus name={art.name} hp={g.monsterHp} maxHp={g.monsterMaxHp} incoming={range(reply)} isBoss={g.monsterType === 3} />}
    {saveNotice && <div className="descent-mobile-notice" role="status"><span>{saveNotice}</span>{saveBlocked && <button onClick={() => window.location.reload()}>Resume saved run</button>}</div>}
    {hasMerchant && <dialog ref={shopDialog} className="descent-mobile-shop" onClose={() => setShopOpen(false)} onCancel={() => setShopOpen(false)}>{renderMerchant(true)}</dialog>}
    {p === "reward" && <div className="descent-mobile-phase-sheet">{renderReward(true)}</div>}
    {terminal && <div className="descent-mobile-phase-sheet">{renderTerminal(true)}</div>}
  </div>;
  const mobileFooter=<div className="descent-mobile-footer">
    {renderReport(true)}
    {safePotionControl && <div className="recovery-heal dungeon-recovery-controls">{safePotionControl}</div>}
  </div>;
  return <main className="descent-shell" onKeyDown={keyboard} data-descent-phase={p} data-descent-revision={run.revision}>{header}
    <div className="dungeon-desktop-status dungeon-original-hud">{actualGameHud}</div>
    {saveNotice && <p className="descent-notice" role="status">{saveNotice}{saveBlocked && <button onClick={() => window.location.reload()}>Resume saved run</button>}</p>}
    <div className="descent-room-heading"><div><p className="descent-kicker">ROOM {room} / 10 · {roomStatus}</p><h1>{roomInfo.title}</h1></div>
      <ol className="descent-map" aria-label="Dungeon progress">{ROOMS.map((r,i) => <li key={r.title} className={i < g.roomsCleared ? "cleared" : i+1 === room ? "current" : "unseen"} aria-label={`Room ${i+1}: ${i < g.roomsCleared ? "cleared" : i+1 === room ? "current" : "unexplored"}`} aria-current={i+1 === room ? "step" : undefined}><span>{i < g.roomsCleared ? "✓" : i+1 === room ? i+1 : "·"}</span></li>)}</ol>
    </div>
    <div className="descent-layout"><div className="descent-world" ref={sceneArea}>
      <DungeonScene key={`${run.runId}:${room}`} view={{room,seed:run.seed,enemy:g.monsterType,enemyName:art.name,enemyHp:g.monsterHp,hp:g.hp,relic:g.equippedRelic,weapon:g.weaponLevel,armor:g.armorLevel,phase:p!,loot:sceneLoot,pending:busy,cue,cueId:run.revision,damage:g.lastPlayerDamage,incoming:g.lastMonsterDamage}}
        actions={{approach:() => void act("engage"),enter:() => void act("enter"),collect:() => void act("collect"),skipLoot:() => void act("skip-loot"),interact:() => audio.playAction("click"),merchant:hasMerchant ? () => { if (window.matchMedia("(max-width: 760px)").matches) setShopOpen(true); else { merchantArea.current?.scrollIntoView({behavior:"auto",block:"nearest"}); merchantArea.current?.focus({preventScroll:true}); } } : undefined}}
        topOverlay={mobileTopOverlay} footer={mobileFooter}
        presentationOverlay={p !== "explore" ? <MonsterReveal enemy={g.monsterType} name={art.name} role={art.role} hp={g.monsterHp} maxHp={g.monsterMaxHp} phase={p!} roomTurns={run.roomTurns} cueId={run.revision} pending={busy} /> : undefined}>
        {combatDock}
      </DungeonScene>

      {renderReport()}
    </div><aside className="descent-sidebar">
      {!terminal && p !== "reward" && <section className="descent-enemy-card" aria-label="Enemy intention"><Image src={art.src} alt={art.name} width={art.width} height={art.height} sizes="(max-width:760px) 100vw, 330px" className="descent-portrait" priority />
        <div><p className="descent-kicker">{art.role}</p><h2>{art.name} <span>{g.monsterHp} / {g.monsterMaxHp}</span></h2><Meter label="Enemy health" value={g.monsterHp} max={g.monsterMaxHp} enemy />
          {g.monsterHp > 0 ? <div className="descent-intent"><strong>{intent.name} · {range(reply)} damage</strong><p>{intent.hint}</p><small>Only if the enemy survives your action.</small></div> : p === "loot" ? <div className="descent-intent"><strong>Loot dropped</strong><p>Walk to the drop to add it to your inventory.</p><small>Tap the loot to pick it up, or tap the door to leave it behind.</small></div> : <div className="descent-intent"><strong>Room secured</strong><p>{practiceLoot(g)}</p><small>{room === 9 ? "Camp arrival restored up to 15 HP." : "Heal safely, then enter the next room."}</small></div>}
        </div></section>}
      {relic && relic.imageSrc && <section className="descent-relic-card" aria-label="Equipped relic"><Image src={relic.imageSrc} alt="" width={86} height={86} /><div><p className="descent-kicker">{relic.rarity} · EQUIPPED</p><h2>{relic.name}</h2><p>{relic.effect}</p><p className="descent-relic-cost">{relic.tradeoff}</p></div><details><summary>How this relic changes your turn</summary><p>{combatRelicSummary(g,false)} on Attack.</p><p>{combatRelicSummary(g,true) ?? "Normal damage"} on Storm. Shown damage ranges include the relic.</p></details></section>}
      {safePotionControl && <div className="recovery-heal dungeon-recovery-controls">{safePotionControl}</div>}
      {renderMerchant()}
      {renderReward()}
      {renderTerminal()}
    </aside></div>
    {p !== "loot" && <details className="descent-journal"><summary>Dungeon journal · {run.turns} turns</summary>{g.log.map((line,i) => <p key={i}>{line}</p>)}</details>}
    <dialog ref={logDialog} className="descent-log-dialog" aria-label="Dungeon log"><header><h2>Dungeon log</h2><button autoFocus onClick={() => logDialog.current?.close()} aria-label="Close dungeon log">Close</button></header><p><strong>{feedbackTitle}</strong><br />{feedbackDetail}</p>{p !== "loot" && g.log.map((line,i) => <p key={i}>{line}</p>)}</dialog>
    <footer className="descent-footer"><span>Local run · Original combat rules · Progress saved in this browser</span><button onClick={() => setConfirmRestart(true)} disabled={busy}>Start again</button><Link href="/">All modes</Link></footer>
  </main>;
}

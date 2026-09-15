"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameLogo } from "../game-logo";
import { GameHud } from "../game-ui";
import { DescentEnemyStatus } from "../descent/combat-panel";
import { MonsterReveal } from "../descent/monster-reveal";
import { DungeonScene, getEnemyArt, type RoomActions, type RoomView } from "./scene";
import { ShopKeeper, ShopVitals } from "./shop-vitals";
import { InventoryPotions, type SafePotionAction } from "./inventory-potions";
import "../descent/game.css";
import "../descent/combat-panel.css";
import "../descent/monster-reveal.css";
import "./scene.css";
import "./endless-room.css";

export type EndlessRoomProps = {
  mode: "practice" | "onchain";
  view: RoomView;
  actions: RoomActions;
  enemyMaxHp: number;
  maxHp: number;
  gold: number;
  potions: number;
  roomTurns: number;
  incoming: string;
  combatActions: ReactNode;
  combatPotions?: { used: number; limit: number };
  healAction?: ReactNode;
  safePotion?: SafePotionAction;
  shop?: ReactNode;
  relics?: ReactNode;
  reward?: ReactNode;
  notices?: ReactNode;
  menu?: ReactNode;
  feedback?: { title: string; detail: string };
  log: string[];
  sound: { enabled: boolean; available: boolean; paused: boolean; toggleSound: () => void };
};

/** Only presentation and local walking. Every gameplay action belongs to its caller. */
export function EndlessRoom({ mode, view, actions, enemyMaxHp, maxHp, gold, potions, roomTurns,
  incoming, combatActions, combatPotions, healAction, safePotion, shop, relics, reward, notices, menu, feedback, log, sound }: EndlessRoomProps) {
  const [panel, setPanel] = useState<{ room: number; kind: "menu" | "shop" | "relics" | "log" | "status" } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), rewardDialog = useRef<HTMLDialogElement>(null);
  const art = getEnemyArt(view.enemy, view.room);
  const combat = view.phase === "combat", recovery = view.phase === "recovery";
  const safeHealing = view.enemyHp === 0 && (view.phase === "loot" || recovery);
  const recoveryPotion = safeHealing && safePotion ? <div className="recovery-heal dungeon-recovery-controls"><InventoryPotions potions={potions} {...safePotion}
    disabledReason={view.pending ? "Finish the current action first." : safePotion.disabledReason ?? (view.hp >= maxHp ? "HP is already full." : null)} /></div> : null;
  const activePanel = panel?.room === view.room && (panel.kind !== "shop" || recovery) ? panel.kind : null;
  const open = (kind: NonNullable<typeof panel>["kind"]) => setPanel({ room: view.room, kind });
  const relicButton = recovery && relics
    ? <button type="button" className="dungeon-relic-menu" onClick={() => open("relics")} aria-label="Open relic collection">◆ Relics</button>
    : null;
  const originalHud = <GameHud hp={view.hp} maxHp={maxHp} potions={potions} maxPotions={5} gold={gold}
    weaponLevel={view.weapon} weaponBonus={view.weapon * 2} armorLevel={view.armor}
    armorAbsorption={view.armor} armorReductionPercent={50} room={view.room}
    combatPotions={combat ? combatPotions : undefined} />;
  const soundLabel = !sound.available ? "Sound unavailable" : sound.paused && sound.enabled ? "Resume sound" : sound.enabled ? "Mute sound" : "Enable sound";
  const title = view.phase === "explore" ? `Approach ${view.enemyName}` : view.phase === "loot" ? "Loot on the floor" : recovery ? "Room secured" : view.phase === "reward" ? "Boss defeated" : "Your turn";
  const detail = view.phase === "explore" ? "Tap the floor to walk. Reach the monster to begin combat."
    : view.phase === "loot" ? mode === "onchain" ? "Rewards are already credited onchain. Tap the loot, or tap the door to continue." : "Tap the loot to collect it, or tap the door to leave it behind."
    : recovery ? "Use Potion below to heal, open Relics above, or walk to the next room." : "Attack is steady. Storm can miss. Potions heal before a reduced reply.";
  const report = feedback ?? { title, detail };
  const tier = Math.ceil(view.room / 10), inTier = (view.room - 1) % 10 + 1;
  const health = <div className="descent-meter" role="progressbar" aria-label="Your health" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={view.hp}><span style={{ width: `${Math.max(0, Math.min(100, view.hp / maxHp * 100))}%` }} /></div>;
  const soundButton = <button className="descent-mobile-sound" onClick={sound.toggleSound} disabled={!sound.available} aria-label={soundLabel} aria-pressed={sound.enabled}>{sound.enabled ? "♫" : "♪"}<span>{sound.paused && sound.enabled ? "Resume" : sound.enabled ? "On" : "Off"}</span></button>;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (activePanel && !element.open) element.showModal();
    if (!activePanel && element.open) element.close();
  }, [activePanel]);
  useEffect(() => {
    const element = rewardDialog.current;
    if (!element) return;
    if (view.phase === "reward" && !element.open) element.showModal();
    if (view.phase !== "reward" && element.open) element.close();
  }, [view.phase]);

  const renderReport = (mobile = false) => <div className={`descent-report ${mobile ? "descent-mobile-report" : ""}`} role="status" aria-live="polite">
    <strong>{report.title}</strong><p>{report.detail}</p><button className="descent-report-log" onClick={() => open("log")} aria-label="Open dungeon log">Log ›</button>
  </div>;
  const top = <div className="descent-mobile-top">
    <div className="descent-mobile-topbar"><button className="endless-room-menu-button" onClick={() => open("menu")} aria-label="Open game menu">☰ Menu</button><div className="descent-mobile-room"><strong>Room {view.room}</strong><span>Tier {tier} · {view.phase === "loot" ? "LOOT DROPPED" : view.enemyHp === 0 ? "CLEARED" : view.enemyName}</span></div><div className="dungeon-header-actions">{relicButton}{soundButton}</div></div>
    <div className="descent-mobile-progress" role="progressbar" aria-label={`Progress to boss room ${tier * 10}`} aria-valuemin={0} aria-valuemax={10} aria-valuenow={inTier}><span style={{ width: `${inTier * 10}%` }} /></div>
    <div className="dungeon-original-hud">{originalHud}</div><DescentEnemyStatus name={view.enemyName} hp={view.enemyHp} maxHp={enemyMaxHp} incoming={incoming} isBoss={view.enemy === 3} />
    {notices && <button className="endless-room-status" onClick={() => open("status")}>Run status · view details</button>}
  </div>;
  const footer = <div className="descent-mobile-footer">
    {renderReport(true)}
    {recoveryPotion}
  </div>;
  const titleByPanel = { menu: "Dungeon menu", shop: "Kevin's shop", relics: "Your relics", log: "Dungeon log", status: "Run status" };

  return <section className="descent-shell endless-room" data-descent-phase={view.phase} data-game-mode={mode} data-room={view.room}>
    <header className="descent-header"><GameLogo /><span className="descent-edition">{mode === "practice" ? "ENDLESS PRACTICE" : "ONCHAIN DUNGEON"}</span><button onClick={() => open("menu")}>Menu</button>{relicButton}{soundButton}</header>
    <div className="dungeon-desktop-status dungeon-original-hud">{originalHud}</div>
    <div className="descent-room-heading"><div><p className="descent-kicker">{mode === "practice" ? "PRACTICE" : "ONCHAIN"} · TIER {tier}</p><h1>Room {view.room} · {view.enemyName}</h1></div><span>Next boss: room {tier * 10}</span></div>
    <div className="descent-layout"><div className="descent-world">
      <DungeonScene key={`${view.seed ?? 0}:${view.room}`} view={view}
        actions={{ ...actions, merchant: recovery && shop ? () => open("shop") : undefined }} topOverlay={top} footer={footer}
        presentationOverlay={view.phase !== "explore" ? <MonsterReveal enemy={view.enemy} room={view.room} name={view.enemyName} role={art.role} hp={view.enemyHp} maxHp={enemyMaxHp} phase={view.phase} roomTurns={roomTurns} cueId={view.cueId} pending={view.pending} /> : undefined}>
        {combat && <div className="descent-actions descent-practice-controls" data-keyboard-action-scope aria-busy={view.pending}>{health}{combatActions}</div>}
      </DungeonScene>
      {renderReport()}
    </div><aside className="descent-sidebar">
      <section className="descent-enemy-card"><Image src={art.src} alt={view.enemyName} width={art.width} height={art.height} unoptimized className="descent-portrait" /><div><DescentEnemyStatus name={view.enemyName} hp={view.enemyHp} maxHp={enemyMaxHp} incoming={incoming} isBoss={view.enemy === 3} /><p className="descent-subtle">{detail}</p></div></section>
      {notices && <section className="descent-notice">{notices}</section>}
      {recovery && shop && <section className="descent-merchant"><h2>Kevin is here.</h2><p>Walk over to his side of the room to trade.</p></section>}
      {recoveryPotion}
      {!recovery && relics && <button className="endless-room-relic-button" onClick={() => open("relics")}>View relic collection</button>}
    </aside></div>
    <dialog ref={dialog} className="descent-log-dialog endless-room-dialog" aria-label={activePanel ? titleByPanel[activePanel] : "Dungeon panel"} onClose={() => setPanel(null)} onCancel={() => setPanel(null)}>
      <header><h2>{activePanel ? titleByPanel[activePanel] : "Dungeon panel"}</h2><button autoFocus onClick={() => setPanel(null)} aria-label={activePanel ? `Close ${titleByPanel[activePanel]}` : "Close panel"}>Close</button></header>
      {activePanel === "menu" && <div><p>{mode === "practice" ? "Endless Practice" : "Onchain dungeon"} · Room {view.room}</p><p>Tap the floor or use arrows to walk. Approach the monster, then use Attack, Storm or Potion. Between rooms, Potion heals safely and Relics opens your collection. Tap loot to collect it, or tap the door to leave it behind and continue.</p>{safeHealing && healAction && <div className="dungeon-menu-heal">{healAction}</div>}{menu}{notices}<Link href="/">All modes</Link></div>}
      {activePanel === "shop" && <div><ShopVitals hp={view.hp} maxHp={maxHp} gold={gold} potions={potions} weapon={view.weapon} armor={view.armor} /><ShopKeeper camp={view.room % 10 === 9} />{notices}{shop}</div>}
      {activePanel === "relics" && <div>{notices}{relics}</div>}
      {activePanel === "status" && notices}
      {activePanel === "log" && <div><p><strong>{report.title}</strong><br />{report.detail}</p>{log.map((line, index) => <p key={`${index}:${line}`}>{line}</p>)}</div>}
    </dialog>
    <dialog ref={rewardDialog} className="endless-room-reward descent-log-dialog" aria-label="Boss relic reward" onCancel={event => event.preventDefault()}>{view.phase === "reward" && <>{notices}{reward}</>}</dialog>
  </section>;
}

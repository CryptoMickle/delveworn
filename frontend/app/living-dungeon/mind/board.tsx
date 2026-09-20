"use client";

import { useRef } from "react";
import type { Plan, Point, Preview, Run } from "./types";
import { canSee, pathTo, playerEntity } from "./world";
import { EntityArtwork, roomArtwork } from "./art";
import styles from "./mind.module.css";

export function MindBoard({ run, lens, selected, plan, preview, onSelect, onTile, onKey, onConnect }: { run: Run; lens: boolean; selected: string | null; plan: Plan | null; preview: Preview | null; onSelect: (id: string) => void; onTile: (at: Point) => void; onKey: (event: React.KeyboardEvent) => void; onConnect: (from: string, to: string) => void }) {
  const dragFrom = useRef<string | null>(null);
  const room = run.room, player = playerEntity(room), ghosts = preview?.steps ?? [];
  const witnesses = room.entities.filter(e => ["guardian", "observer", "echo"].includes(e.role) && e.active);
  const selectedEntity = room.entities.find(e => e.id === selected);
  const moves = run.facts.filter(f => f.room === room.index && f.actor === "player" && f.operation?.verb === "MOVE").slice(-2);
  const orientation = moves.length && moves.at(-1)!.at.y > (moves.length > 1 ? moves[0].at.y : 6) ? "south" : "north";
  const lastAction = run.facts.filter(f => f.room === room.index && f.tick >= run.tick - 1 && f.operation && ["ATTACK", "STORM", "RELEASE", "PROTECT", "DISTRACT", "INTERRUPT_REPORT"].includes(f.operation.verb)).at(-1);
  const actionTarget = lastAction && room.entities.find(e => e.id === lastAction.operation?.target);
  const light = room.entities.find(e => e.role === "light");
  const boss = room.entities.find(e => e.role === "echo");
  const toScreen = (p: Point) => `${p.x * 60 + 30},${p.y * 60 + 30}`;
  return <div className={`${styles.boardFrame} ${room.family === "echo" ? styles.echoFrame : ""}`} data-testid="mind-board" data-room={room.index} data-turn={room.turn} data-art-version="painted-1" data-family={room.family}>
    <div className={styles.boardTop}><span>▱ CHAMBER {room.index + 1}</span><span>{room.light ? "LIGHT" : "DARK"}  · TURN {room.turn}</span></div>
    <svg className={`${styles.board} ${lens ? styles.lensBoard : ""}`} viewBox="0 0 660 500" role="group" aria-label="Dungeon floor. Use WASD or arrow keys to move. Enter examines the selected object." tabIndex={0} onKeyDown={onKey} onPointerUp={event => {
      const target = (event.target as Element).closest('[data-entity]')?.getAttribute('data-entity');
      if (lens && dragFrom.current && target && dragFrom.current !== target) onConnect(dragFrom.current, target);
      dragFrom.current = null;
    }} onPointerCancel={() => { dragFrom.current = null; }}>
      <defs>
        <radialGradient id="lampGlow"><stop stopColor="#e7aa54" stopOpacity=".28" /><stop offset="1" stopColor="#e7aa54" stopOpacity="0" /></radialGradient>
        <radialGradient id="roomVignette"><stop offset=".35" stopColor="#050b13" stopOpacity="0" /><stop offset="1" stopColor="#050b13" stopOpacity=".65" /></radialGradient>
        <linearGradient id="stoneEdge" x2="0" y2="1"><stop stopColor="#b4a081" stopOpacity=".48" /><stop offset="1" stopColor="#131519" stopOpacity=".75" /></linearGradient>
        <pattern id="masonry" width="120" height="60" patternUnits="userSpaceOnUse"><image href="/dungeon/stone-room.webp" x="-150" y="-10" width="900" height="600" /></pattern>
        <pattern id="mindTile" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M0 60V0H60" fill="none" stroke="#e8d3a5" strokeOpacity={lens ? ".28" : ".1"} /><path d="M2 59H59V2" fill="none" stroke="#080d12" strokeOpacity=".3" /></pattern>
      </defs>
      <rect width="660" height="540" fill="#11191b" />
      <image href={roomArtwork(room.family)} width="660" height="540" preserveAspectRatio="none" className={styles.roomPainting} data-room-art={room.family} />
      <rect width="660" height="540" fill={room.light ? "#101925" : "#071a2c"} opacity={room.light ? ".12" : ".46"} className={styles.roomShade} pointerEvents="none" />
      <rect width="660" height="540" fill="url(#roomVignette)" pointerEvents="none" />
      {/* One transform for cells, figures, effects, hit targets and plans. */}
      <g transform="translate(0 30) scale(1 .9)">
      <rect x="60" y="60" width="540" height="420" fill="url(#mindTile)" pointerEvents="none" />
      {light && room.light && <circle cx={light.x * 60 + 30} cy={light.y * 60 + 30} r="130" fill="url(#lampGlow)" pointerEvents="none" />}
      {Array.from({ length: room.height - 2 }, (_, row) => Array.from({ length: room.width - 2 }, (_, col) => {
        const x = col + 1, y = row + 1;
        if (room.walls.some(w => w.x === x && w.y === y)) return <g key={`${x}-${y}`} data-wall={`${x},${y}`} pointerEvents="none">
          <path d={`M${x * 60 - 2} ${y * 60 + 7}h63v57l-5 6h-52l-6-6Z`} fill="#060c11" opacity=".8" />
          <path d={`M${x * 60 + 1} ${y * 60 - 4}h58v51l-6 10h-46l-6-10Z`} fill="url(#masonry)" stroke="#151a1b" strokeWidth="3" />
          <path d={`M${x * 60 + 2} ${y * 60 - 3}h56v47l-6 10h-44l-6-10Z`} fill="url(#stoneEdge)" stroke="#c1a46e" strokeOpacity=".4" />
          <path d={`M${x * 60 + 9} ${y * 60 + 5}h40m-40 15h39m-39 16h40m-22-30v14m9 1v15`} stroke="#211c1a" strokeWidth="2" opacity=".8" />
          <path d={`M${x * 60 + 8} ${y * 60 + 2}h41`} stroke="#d3b97e" strokeOpacity=".5" />
        </g>;
        const seen = lens && witnesses.some(w => canSee(room, w, { x, y }));
        const shadow = room.shadows.some(s => s.x === x && s.y === y);
        return <g key={`${x}-${y}`} onClick={() => onTile({ x, y })} className={styles.floorCell} data-cell={`${x},${y}`}>
          <rect x={x * 60 + 1} y={y * 60 + 1} width="58" height="58" fill={seen ? "#e5a85848" : shadow ? "#062b4560" : "transparent"} stroke={seen ? "#ffd88e40" : "none"} />
          {seen && <path d={`M${x * 60 + 22} ${y * 60 + 30}q8-9 16 0-8 9-16 0m-8-2v4`} fill="none" stroke="#ffda9e" strokeOpacity=".55" />}
          {shadow && lens && <path d={`M${x * 60 + 25} ${y * 60 + 24}a8 8 0 1 0 10 12 10 10 0 0 1-10-12`} fill="#9dd9e0" opacity=".45" />}
        </g>;
      }))}
      {room.hazards.map((h, i) => <g key={`h${i}`} transform={`translate(${h.x * 60 + 30} ${h.y * 60 + 30})`}><path d="M0-22 22 0 0 22 -22 0Z" fill="#9c60452b" stroke="#ac7558" /><path d="M2-14 -5 0H4L-2 15" stroke="#d3a677" fill="none" strokeWidth="2" /></g>)}
      {boss?.active && <g opacity=".6" fill="none" stroke="#d69d99" pointerEvents="none"><ellipse cx={boss.x * 60 + 30} cy={boss.y * 60 + 42} rx="76" ry="48" strokeWidth="2" strokeDasharray="3 7" /><ellipse cx={boss.x * 60 + 30} cy={boss.y * 60 + 42} rx="64" ry="40" />{room.components.map((c, i) => <path key={c.id} transform={`translate(${boss.x * 60 + 30} ${boss.y * 60 + 42}) rotate(${i * 120})`} d="M0-57 7-47 0-37-7-47Z" fill="#e0b99a" data-boss-component={c.id} />)}</g>}
      {lens && room.entities.filter(e => e.role === "observer" && e.active).map(w => {
        const relay = room.entities.find(e => e.id === "relay")!;
        return relay.active ? <polyline key={w.id} points={[w, ...pathTo(room, w, relay, true), relay].map(toScreen).join(" ")} fill="none" stroke="#e6afed" strokeWidth="3" strokeDasharray="4 7" opacity=".9" pointerEvents="none" /> : null;
      })}
      {plan && ghosts.length > 0 && <polyline points={[player, ...ghosts.map(s => s.to)].map(toScreen).join(" ")} fill="none" stroke="#c4ffe0" strokeWidth="4" strokeDasharray="5 6" pointerEvents="none" />}
      {room.entities.filter(e => e.active && (e.role !== "light" || room.light)).sort((a, b) => a.y - b.y).map(e => <g key={e.id} transform={`translate(${e.x * 60 + 30} ${e.y * 60 + 30})`} onPointerDown={() => { dragFrom.current = e.id; }} onClick={() => onSelect(e.id)} className={`${styles.figure} ${selected === e.id ? styles.selectedFigure : ""}`}>
        <rect role="button" tabIndex={-1} aria-label={`${e.name}${e.freed ? ", free" : ""}`} data-entity={e.id} x="-28" y="-42" width="56" height="77" rx="8" fill="transparent" pointerEvents="all" />
        {selected === e.id && <ellipse cy="19" rx="28" ry="14" fill="#e4c78625" stroke="#f2d399" strokeWidth="2" pointerEvents="none" />}
        {e.role === "player" && run.player.hiddenUntil >= run.tick && <circle r="28" fill="#66accb22" stroke="#8acbd1" strokeDasharray="3 5" pointerEvents="none" />}
        <EntityArtwork entity={e} room={room} orientation={orientation} />
        {(lens || e.role === "player") && <text y="45" textAnchor="middle" fill={e.role === "player" ? "#d1ffe8" : e.role === "observer" ? "#f4c8f0" : "#f2e6c8"} stroke="#0c151c" strokeWidth="3" paintOrder="stroke" fontSize="14" fontWeight="600" letterSpacing=".2" pointerEvents="none">{e.role === "player" ? "YOU" : e.role === "captive" ? e.freed ? "FREE" : "BOUND" : e.role === "observer" ? "WITNESS" : e.role === "relay" ? "RELAY" : e.role === "exit" ? "EXIT" : e.role === "cover" ? "COVER" : e.role === "guardian" ? "GUARD" : e.role === "echo" ? "ECHO" : e.role === "light" ? "LIGHT" : e.role === "distraction" ? "SOUND" : "SEAL"}</text>}
      </g>)}
      {ghosts.filter(s => s.operation.verb !== "MOVE").map((step, i) => <g key={i} transform={`translate(${step.to.x * 60 + 47} ${step.to.y * 60 + 9})`} pointerEvents="none"><circle r="10" fill="#b6e8cd" stroke="#182e2c" strokeWidth="2" /><text y="4" textAnchor="middle" fill="#163b32" fontSize="11" fontWeight="700">{i + 1}</text></g>)}
      {lastAction && actionTarget && <g key={lastAction.id} className={styles.actionEffect} transform={`translate(${actionTarget.x * 60 + 30} ${actionTarget.y * 60 + 20})`} pointerEvents="none" data-effect={lastAction.operation!.verb}>
        {lastAction.operation!.verb === "STORM" ? <><path d="M-9-58 10-24-4-15 12 20" fill="none" stroke="#b7e5ff" strokeWidth="6" /><path d="M-9-58 10-24-4-15 12 20" fill="none" stroke="#fff5dc" strokeWidth="2" /><ellipse cy="18" rx="32" ry="16" fill="#b6e6ff3b" stroke="#d2f3ff" /></> : lastAction.operation!.verb === "ATTACK" ? <path d="M-32 15Q-15-31 31-24Q5-21-16 22" fill="#ffe0bda0" stroke="#fff1cf" strokeWidth="2" /> : <><ellipse cy="10" rx="31" ry="23" fill="none" stroke="#b5f6d8" strokeWidth="3" /><path d="M0-32V-20M-25-21-18-13M25-21 18-13" stroke="#dfebaf" strokeWidth="2" /></>}
      </g>}
      {run.facts.filter(f => f.room === room.index && f.actor === "relic" && ["choice", "learning"].includes(f.kind) && run.tick - f.tick <= 3 && !f.private).slice(-1).map(f => <g key={f.id} transform={`translate(${f.at.x * 60 + 30} ${f.at.y * 60 + 30})`} pointerEvents="none"><circle r="35" fill="#9cf4c723" stroke="#c9f6d8" strokeWidth="2" /><path d="M0-33 12-16 0 1 -12-16Z" fill="#7ddbaa" stroke="#e1ffe9" strokeWidth="2" /><path d="M0-28V-5M-6-18 0-12 6-18" stroke="#123e31" strokeWidth="2" fill="none" /></g>)}
      </g>
      {/* Seal the painting's south stair: the actual exit is the marked world entity. */}
      <path d="M0 488H660V540H0Z" fill="url(#masonry)" pointerEvents="none" /><path d="M0 488H660M0 511H660M60 488V511M180 488V511M300 488V511M420 488V511M540 488V511M120 511V540M240 511V540M360 511V540M480 511V540M600 511V540" stroke="#090f14" strokeWidth="4" pointerEvents="none" /><path d="M0 486H660" stroke="#baa47a" strokeOpacity=".45" strokeWidth="2" pointerEvents="none" />
    </svg>
    {lens && <div className={styles.boardLegend} aria-label="Map key"><span><i className={styles.sightKey} />Amber: someone can see you</span>{plan && <span><i className={styles.pathKey} />Dashed: your planned route</span>}{room.entities.some(e => e.role === "observer" && e.active) && <span><i className={styles.reportKey} />Violet: the witness&apos;s report route</span>}</div>}
    <div className={styles.boardBottom}><span><i className={styles.tealDot} />{selectedEntity?.name ?? "Select something in the room"}</span><span>{lens ? "◉ Sightlines are visible" : "WASD / arrow keys"}</span></div>
    {run.room.adaptation && <div className={styles.arenaRule}><span>THE DUNGEON SUSPECTS</span>{room.family === "echo" ? room.components.map(c => COMPONENT_LABELS[c.id]).join(" · ") || "It is still looking for a pattern." : room.adaptation === "storm" ? "The stone conducts lightning. The dark side passage is open." : room.adaptation === "mercy" ? "The captive stands where it expects you to go." : "The room has moved resistance into your usual path."}</div>}
  </div>;
}
const COMPONENT_LABELS: Record<string, string> = { "storm-ward": "Storm Ward", "hostage-thread": "Hostage Thread", "echo-snare": "Distraction Trap", "iron-mirror": "Iron Mirror", "thirst-trap": "Circle of Thirst" };

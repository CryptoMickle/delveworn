"use client";

import { useRef } from "react";
import type { Entity, Plan, Point, Preview, Run } from "./types";
import { canSee, pathTo, playerEntity } from "./world";
import styles from "./mind.module.css";

function Figure({ entity: e }: { entity: Entity }) {
  if (["player", "guardian", "echo", "observer", "captive"].includes(e.role)) {
    const player = e.role === "player", captive = e.role === "captive", observer = e.role === "observer", boss = e.role === "echo";
    const cloth = player ? "#72b9b2" : captive ? "#c6bb9d" : observer ? "#986e9f" : boss ? "#b77a65" : "#88755b";
    return <g>
      <ellipse cy="17" rx={boss ? 22 : 16} ry="7" fill="#000" opacity=".6" />
      {e.protected > 0 && <circle r="23" fill="none" stroke="#92e9ce" strokeWidth="2" strokeDasharray="5 4" />}
      <path d={boss ? "M-18 17 -23-5 -11-17 11-17 23-5 18 17Z" : "M-14 18 -12-1 -7-10 7-10 12-1 14 18Z"} fill={cloth} stroke="#171c1a" strokeWidth="2" />
      <path d="M0-8 -5 16 8 18 4-8" fill="#101c20" opacity=".55" />
      <ellipse cy="-11" rx="8" ry="9" fill={player || captive ? "#cbbb94" : "#342f2d"} stroke={cloth} strokeWidth="3" />
      {!captive && <path d="M-5-11H5" stroke={player ? "#243b39" : "#e9bd76"} strokeWidth="2" />}
      {player && <><path d="M14-5 17 17M12 1H20" stroke="#bfc4ad" strokeWidth="3" /><path d="M-21-17 -17-24 -13-17 -17-9Z" fill="#8effd7" stroke="#c1ffed" /><path d="M-17-27V-30M-26-17H-29" stroke="#8effd7" /></>}
      {boss && <path d="M-8-17 -18-28 -16-7M8-17 18-28 16-7" stroke="#cfa87a" strokeWidth="3" fill="none" />}
      {observer && <><path d="M4 0H21V15H4Z" fill="#ceb785" /><path d="M8 4H18M8 8H16M8 12H19" stroke="#665343" /></>}
      {captive && !e.freed && <path d="M-17 13Q0 26 17 13M-19 11V18M19 11V18" stroke="#9d9c85" strokeWidth="3" fill="none" />}
      {e.distracted > 0 && <text y="-29" textAnchor="middle" fill="#e4ca87" fontSize="17">?</text>}
      {e.maxHp > 1 && e.hp < e.maxHp && <><rect x="-17" y="26" width="34" height="3" rx="1" fill="#292824" /><rect x="-17" y="26" width={34 * e.hp / e.maxHp} height="3" rx="1" fill={player ? "#8acfbb" : "#d38c73"} /></>}
    </g>;
  }
  if (e.role === "distraction") return <g><ellipse cy="16" rx="18" ry="5" fill="#000" opacity=".5" /><path d="M-16 10 -12-8Q0-23 12-8L16 10Z" fill="#877244" stroke="#c6a967" strokeWidth="2" /><path d="M-19 12H19M0 13V19M-10-5Q0-10 10-5" fill="none" stroke="#dabf80" strokeWidth="2" /><circle cy="-19" r="3" fill="#c6a967" /></g>;
  if (e.role === "light") return <g><circle r="30" fill="url(#lampGlow)" /><path d="M-13 9H13L8 18H-8Z" fill="#615342" stroke="#bfa678" /><path d="M-9 8Q-15-5-1-20 -3-6 6-13 15 3 6 8Z" fill="#e8ba68" /><path d="M-4 8Q-8-3 2-9 0 1 7 8" fill="#fff1b9" /></g>;
  if (e.role === "relay") return <g><path d="M-15 20V-15L0-25 15-15V20Z" fill="#332f38" stroke="#866c8c" strokeWidth="2" /><path d="M0-17 8-6 0 5 -8-6Z M0 5V17" stroke="#d0a0d3" strokeWidth="2" fill="none" /><circle cy="-6" r="3" fill="#efd3ff" /></g>;
  if (e.role === "exit") return <g><path d="M-25 23V-19Q0-39 25-19V23Z" fill="#0a1416" stroke="#71684f" strokeWidth="5" /><path d="M-20 20H20M-16 12H16M-12 4H12M-8-4H8" stroke="#7c826a" strokeWidth="3" /><path d="M0-12V-22M-4-18 0-22 4-18" stroke="#a5d9bd" strokeWidth="2" fill="none" /></g>;
  if (e.role === "evidence") return <g><path d="M-15-12 11-16 17 13 -10 17Z" fill="#baa982" stroke="#5f5542" strokeWidth="2" /><circle cy="2" r="6" fill="#845044" /><path d="M0-2V6M-4 2H4" stroke="#d5a47b" /></g>;
  return <g><path d="M-24 18V-20H24V18H13V-9H-13V18Z" fill="#293435" stroke="#55615b" strokeWidth="2" /><path d="M-13 18V-9H13V18" fill="#081418" /></g>;
}

export function MindBoard({ run, lens, selected, plan, preview, onSelect, onTile, onKey, onConnect }: { run: Run; lens: boolean; selected: string | null; plan: Plan | null; preview: Preview | null; onSelect: (id: string) => void; onTile: (at: Point) => void; onKey: (event: React.KeyboardEvent) => void; onConnect: (from: string, to: string) => void }) {
  const dragFrom = useRef<string | null>(null);
  const room = run.room, player = playerEntity(room), ghosts = preview?.steps ?? [];
  const witnesses = room.entities.filter(e => ["guardian", "observer", "echo"].includes(e.role) && e.active);
  const selectedEntity = room.entities.find(e => e.id === selected);
  const toScreen = (p: Point) => `${p.x * 60 + 30},${p.y * 60 + 30}`;
  return <div className={`${styles.boardFrame} ${room.family === "echo" ? styles.echoFrame : ""}`} data-testid="mind-board" data-room={room.index} data-turn={room.turn}>
    <div className={styles.boardTop}><span>▱ KAMMER {room.index + 1}</span><span>{room.light ? "LYS" : "MØRKE"} · TUR {room.turn}</span></div>
    <svg className={styles.board} viewBox="0 0 660 540" role="group" aria-label="Dungeonens gulv. Bruk WASD eller piltaster for å gå. Enter undersøker valgt objekt." tabIndex={0} onKeyDown={onKey} onPointerUp={event => {
      const target = (event.target as Element).closest('[data-entity]')?.getAttribute('data-entity');
      if (lens && dragFrom.current && target && dragFrom.current !== target) onConnect(dragFrom.current, target);
      dragFrom.current = null;
    }} onPointerCancel={() => { dragFrom.current = null; }}>
      <defs>
        <radialGradient id="lampGlow"><stop stopColor="#e7aa54" stopOpacity=".28" /><stop offset="1" stopColor="#e7aa54" stopOpacity="0" /></radialGradient>
        <radialGradient id="floorGlow"><stop stopColor={room.family === "echo" ? "#394244" : "#35453f"} /><stop offset="1" stopColor="#152321" /></radialGradient>
        <pattern id="mindTile" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="none" /><path d="M1 59V1H59" fill="none" stroke="#778277" strokeOpacity=".1" /><path d="M3 57H57V3" fill="none" stroke="#000" strokeOpacity=".3" /><path d="M6 8 20 6M46 49 53 47" stroke="#758278" strokeOpacity=".1" /></pattern>
        <filter id="mindGlow"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <rect width="660" height="540" fill="#0b1516" />
      <rect x="60" y="60" width="540" height="420" fill="url(#floorGlow)" />
      <rect x="60" y="60" width="540" height="420" fill="url(#mindTile)" />
      {Array.from({ length: room.height }, (_, y) => Array.from({ length: room.width }, (_, x) => {
        const wall = x === 0 || y === 0 || x === 10 || y === 8 || room.walls.some(w => w.x === x && w.y === y);
        if (wall) return <g key={`${x}-${y}`}><rect x={x * 60 + 2} y={y * 60 + 7} width="57" height="54" rx="3" fill="#080f11" /><path d={`M${x * 60 + 2} ${y * 60 + 3}h56v42l-6 8h-44l-6-8Z`} fill={(x + y) % 3 === 0 ? "#3b423b" : "#303c37"} stroke="#546050" strokeOpacity=".4" /><path d={`M${x * 60 + 9} ${y * 60 + 10}h39m-31 32h27`} stroke="#64715c" strokeOpacity=".3" /></g>;
        const seen = lens && witnesses.some(w => canSee(room, w, { x, y }));
        const shadow = room.shadows.some(s => s.x === x && s.y === y);
        return <g key={`${x}-${y}`} onClick={() => onTile({ x, y })} className={styles.floorCell}>
          <rect x={x * 60} y={y * 60} width="60" height="60" fill={seen ? "#cb8d6340" : shadow ? "#091a2666" : "transparent"} />
          {seen && <path d={`M${x * 60 + 24} ${y * 60 + 30}q6-7 12 0-6 7-12 0`} fill="none" stroke="#dcb188" strokeOpacity=".3" />}
          {shadow && lens && <path d={`M${x * 60 + 25} ${y * 60 + 25}l10 10m0-10-10 10`} stroke="#7badc1" strokeOpacity=".5" />}
        </g>;
      }))}
      {room.hazards.map((h, i) => <g key={`h${i}`} transform={`translate(${h.x * 60 + 30} ${h.y * 60 + 30})`}><path d="M0-22 22 0 0 22 -22 0Z" fill="#9c60452b" stroke="#ac7558" /><path d="M2-14 -5 0H4L-2 15" stroke="#d3a677" fill="none" strokeWidth="2" /></g>)}
      {room.family === "echo" && <g opacity=".23" fill="none" stroke="#be9578"><circle cx="420" cy="240" r="111" /><circle cx="420" cy="240" r="98" /><path d="M310 240H530M420 130V350M342 162 498 318M342 318 498 162" /></g>}
      {lens && room.entities.filter(e => e.role === "observer" && e.active).map(w => {
        const relay = room.entities.find(e => e.id === "relay")!;
        return relay.active ? <polyline key={w.id} points={[w, ...pathTo(room, w, relay, true), relay].map(toScreen).join(" ")} fill="none" stroke="#c48dbd" strokeWidth="2" strokeDasharray="4 7" opacity=".7" pointerEvents="none" /> : null;
      })}
      {plan && ghosts.length > 0 && <polyline points={[player, ...ghosts.map(s => s.to)].map(toScreen).join(" ")} fill="none" stroke="#9deac9" strokeWidth="3" strokeDasharray="5 6" pointerEvents="none" />}
      {room.entities.filter(e => e.active && (e.role !== "light" || room.light)).sort((a, b) => a.y - b.y).map(e => <g key={e.id} transform={`translate(${e.x * 60 + 30} ${e.y * 60 + 30})`} role="button" tabIndex={-1} aria-label={`${e.name}${e.freed ? ", fri" : ""}`} onPointerDown={() => { dragFrom.current = e.id; }} onClick={() => onSelect(e.id)} className={`${styles.figure} ${selected === e.id ? styles.selectedFigure : ""}`} data-entity={e.id}>
        {selected === e.id && <ellipse cy="12" rx="26" ry="17" fill="#c8b97c16" stroke="#d5c183" strokeWidth="2" />}
        {e.role === "player" && run.player.hiddenUntil >= run.tick && <circle r="28" fill="#66accb22" stroke="#8acbd1" strokeDasharray="3 5" />}
        <Figure entity={e} />
        {(lens || e.role === "player") && <text y="41" textAnchor="middle" fill={e.role === "player" ? "#b6f0da" : "#c7cbb5"} fontSize="10" letterSpacing="1">{e.role === "player" ? "DU" : e.role === "captive" ? e.freed ? "FRI" : "FANGET" : e.role === "observer" ? "VITNE" : e.role === "relay" ? "RAPPORT" : e.role === "exit" ? "UT" : e.role === "cover" ? "SKJUL" : e.role === "guardian" ? "VOKTER" : e.role === "echo" ? "EKKOET" : "MULIGHET"}</text>}
      </g>)}
      {ghosts.filter(s => s.operation.verb !== "MOVE").map((step, i) => <g key={i} transform={`translate(${step.to.x * 60 + 47} ${step.to.y * 60 + 9})`} pointerEvents="none"><circle r="10" fill="#b6e8cd" stroke="#182e2c" strokeWidth="2" /><text y="4" textAnchor="middle" fill="#163b32" fontSize="11" fontWeight="700">{i + 1}</text></g>)}
      {run.facts.filter(f => f.room === room.index && f.actor === "relic" && ["choice", "learning"].includes(f.kind) && run.tick - f.tick <= 3 && !f.private).slice(-1).map(f => <g key={f.id} transform={`translate(${f.at.x * 60 + 30} ${f.at.y * 60 + 30})`} pointerEvents="none"><circle r="35" fill="#9cf4c723" stroke="#c9f6d8" strokeWidth="2" /><path d="M0-33 12-16 0 1 -12-16Z" fill="#7ddbaa" stroke="#e1ffe9" strokeWidth="2" /><path d="M0-28V-5M-6-18 0-12 6-18" stroke="#123e31" strokeWidth="2" fill="none" /></g>)}
    </svg>
    {lens && <div className={styles.boardLegend} aria-label="Tegnforklaring"><span><i className={styles.sightKey} />Ravfarget: noen kan se deg</span>{plan && <span><i className={styles.pathKey} />Stiplet: din planlagte vei</span>}{room.entities.some(e => e.role === "observer" && e.active) && <span><i className={styles.reportKey} />Lilla: vitnets rapportvei</span>}</div>}
    <div className={styles.boardBottom}><span><i className={styles.tealDot} />{selectedEntity?.name ?? "Velg noe i rommet"}</span><span>{lens ? "◉ Synsfelt er synlige" : "WASD / piltaster"}</span></div>
    {run.room.adaptation && <div className={styles.arenaRule}><span>DUNGEONEN MISTENKER</span>{room.family === "echo" ? room.components.map(c => COMPONENT_LABELS[c.id]).join(" · ") || "Den leter fortsatt etter et mønster." : room.adaptation === "storm" ? "Steinen leder lyn. Den mørke sidegangen er åpen." : room.adaptation === "mercy" ? "Fangen står der den forventer at du vil gå." : "Rommet har flyttet motstanden til din vanlige vei."}</div>}
  </div>;
}
const COMPONENT_LABELS: Record<string, string> = { "storm-ward": "Storm Ward", "hostage-thread": "Gisseltråd", "echo-snare": "Avledningsfelle", "iron-mirror": "Jernspeil", "thirst-trap": "Tørstens sirkel" };

"use client";

import { memo, useId } from "react";
import Image from "next/image";
import { AvatarSprite } from "../../dungeon/avatar-art";
import { EnemySprite } from "../../dungeon/scene";
import { MerchantSprite } from "../../dungeon/merchant-art";
import { guardianCast, isKevin } from "./identities";
import type { Entity, Family, Room, Verb } from "./types";
import styles from "./mind.module.css";

export const MIND_ATLAS = "/living-dungeon/mind-atlas-v1.webp";
export const RELIC_ART = "/assets/relics/echo-lens.webp";

/** Shared Delveworn paintings. Presentation never selects or changes a scenario. */
const ROOM_ART: Record<Family, string> = {
  bell: "/dungeon/stone-room.webp",
  kiln: "/dungeon/rooms/original/orc-2-brutus.webp",
  archive: "/dungeon/rooms/original/boss-2-senior-dungeon-lord.webp",
  bridge: "/dungeon/rooms/original/orc-1-thud.webp",
  garden: "/dungeon/rooms/original/zombie-3-velvet-rot.webp",
  tribunal: "/dungeon/rooms/original/boss-1-dungeon-lord.webp",
  reservoir: "/dungeon/rooms/original/zombie-2-miss-morgue.webp",
  echo: "/dungeon/rooms/original/boss-4-chairman-below.webp",
};
export const roomArtwork = (family: Family) => ROOM_ART[family];

type AtlasPart = "cartographer" | "scribe" | "bell" | "brazier" | "relay" | "cover" | "exit";
const CROPS: Record<AtlasPart, string> = {
  cartographer: "474 50 247 475", scribe: "797 54 283 471", bell: "1157 76 359 437",
  brazier: "76 565 254 379", relay: "429 526 293 435", cover: "763 535 368 424", exit: "1140 554 379 404",
};

/** Same black-key technique as the existing adventurer. The sheet is fetched once. */
export const AtlasSprite = memo(function AtlasSprite({ part, className }: { part: AtlasPart; className?: string }) {
  const id = useId();
  return <svg viewBox={CROPS[part]} className={className} aria-hidden="true" focusable="false" data-art={part}>
    <defs><filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  20 20 20 0 -0.15" result="key" />
      <feComposite in="SourceGraphic" in2="key" operator="in" />
    </filter></defs>
    <image href={MIND_ATLAS} width="1536" height="1024" filter={`url(#${id})`} />
  </svg>;
});

function Mechanism({ family }: { family: Family }) {
  const id = useId();
  return <svg viewBox="-34 -52 68 80" aria-hidden="true" focusable="false">
    <defs><linearGradient id={id}><stop stopColor="#3b2e20" /><stop offset=".35" stopColor="#c3a06a" /><stop offset=".55" stopColor="#6d5235" /><stop offset=".8" stopColor="#aa8350" /><stop offset="1" stopColor="#30281f" /></linearGradient></defs>
    <path d="M-24 25-18 15V-26H18V15L25 25Z" fill="#302c26" stroke="#9b825a" />
    {family === "archive" ? <>
      {[-18, -9, 0, 9, 18].map((x, i) => <g key={x}><rect x={x - 3} y={-47 + Math.abs(2 - i) * 5} width="7" height={57 - Math.abs(2 - i) * 5} rx="2" fill={`url(#${id})`} stroke="#d0ab70" strokeWidth=".5" /><path d={`M${x - 1} 5v-5`} stroke="#151715" strokeWidth="3" /></g>)}
      <path d="M-26 12H26V24H-26Z" fill={`url(#${id})`} stroke="#b89565" />
    </> : <>
      <circle cy="-8" r="27" fill="#202625" stroke="#453829" strokeWidth="8" /><circle cy="-8" r="25" fill="none" stroke={`url(#${id})`} strokeWidth="5" />
      {[0, 60, 120].map(angle => <path key={angle} d="M-23-8H23" transform={`rotate(${angle} 0 -8)`} stroke={`url(#${id})`} strokeWidth="5" />)}
      <circle cy="-8" r="7" fill="#ac8652" stroke="#dec28d" /><circle cy="-8" r="3" fill="#443627" />
      <path d="M-16 19H16M-21 25H21" stroke="#b09465" strokeWidth="2" />
    </>}
  </svg>;
}

/** Painted silhouettes share the same coordinates and hit targets as the simulation. */
export function EntityArtwork({ entity: e, room, orientation = "north" }: { entity: Entity; room: Room; orientation?: "north" | "south" }) {
  const boss = e.role === "echo", actor = ["player", "guardian", "captive", "observer", "echo"].includes(e.role);
  const size = boss ? { x: -43, y: -68, w: 86, h: 94 } : actor ? { x: -32, y: -49, w: 64, h: 73 } : { x: -29, y: -39, w: 58, h: 65 };
  let artwork;
  if (e.role === "player" || boss) artwork = <AvatarSprite orientation={boss ? "south" : orientation} />;
  else if (e.role === "guardian") { const cast = guardianCast(room.family)!; artwork = <EnemySprite type={cast.type} room={cast.room} />; }
  else if (isKevin(room, e)) artwork = <MerchantSprite />;
  else if (e.role === "distraction" && !["bell", "tribunal", "echo"].includes(room.family)) artwork = <Mechanism family={room.family} />;
  else if (e.role === "evidence") artwork = <svg viewBox="-30 -34 60 65" aria-hidden="true"><path d="M-21-26 16-30 24 18 -16 26Z" fill="#d0b788" stroke="#695337" strokeWidth="2" /><path d="M-13-18 10-21M-11-12 12-15M-10-6 5-8" stroke="#725c41" strokeWidth="2" /><circle cx="5" cy="10" r="9" fill="#863b45" stroke="#d39a77" /><path d="M5 4 9 10 5 16 1 10Z" fill="none" stroke="#e7b889" /></svg>;
  else artwork = <AtlasSprite part={e.role === "captive" ? "cartographer" : e.role === "observer" ? "scribe" : e.role === "distraction" ? "bell" : e.role === "light" ? "brazier" : e.role as "relay" | "cover" | "exit"} />;
  return <g pointerEvents="none">
    <ellipse cy="19" rx={boss ? 28 : actor ? 20 : 24} ry="8" fill="#000" opacity=".65" />
    {e.role === "player" && <ellipse cy="19" rx="24" ry="11" fill="#8ce0c32a" stroke="#9ce9cb" strokeWidth="1.6" />}
    {boss && <ellipse cy="19" rx="34" ry="15" fill="#bb546733" stroke="#e29a9f" />}
    <svg x={size.x} y={size.y} width={size.w} height={size.h} className={`${styles.spriteFrame} ${boss ? styles.echoSprite : ""}`} data-sprite-role={e.role}>{artwork}</svg>
    {e.role === "player" && <g transform="translate(-25 -33)"><circle r="10" fill="#66ffbb19" /><path d="M0-8 5 0 0 8 -5 0Z" fill="#9eebc6" stroke="#edffdb" /><path d="M0-5V4" stroke="#335852" /></g>}
    {e.role === "captive" && !e.freed && <path d="M-16 13Q0 29 16 13M-17 11V18M17 11V18" stroke="#d8bc86" strokeWidth="2" fill="none" />}
    {e.protected > 0 && <ellipse cy="6" rx="26" ry="30" fill="#b4ffdb0a" stroke="#a7f4d2" strokeWidth="1.7" strokeDasharray="5 4" />}
    {e.distracted > 0 && <text y="-53" textAnchor="middle" fill="#ffe0a0" stroke="#241b15" strokeWidth="3" paintOrder="stroke" fontSize="20">?</text>}
    {e.maxHp > 1 && e.hp < e.maxHp && <><rect x="-20" y="29" width="40" height="4" rx="2" fill="#151410" stroke="#0c0f11" strokeWidth="2" /><rect x="-20" y="29" width={40 * e.hp / e.maxHp} height="4" rx="2" fill={e.role === "player" ? "#9ae6c2" : "#e39b85"} /></>}
  </g>;
}

export function EntityPortrait({ entity, room }: { entity: Entity; room: Room }) {
  return <svg viewBox="-43 -67 86 109" className={styles.entityPortrait} aria-hidden="true"><EntityArtwork entity={entity} room={room} orientation="south" /></svg>;
}

export function RelicPortrait() {
  return <div className={styles.relicPortrait}><Image src={RELIC_ART} width={116} height={100} alt="" sizes="88px" /><span aria-hidden="true">◇</span></div>;
}

const ACTION_ART: Partial<Record<Verb, string>> = { ATTACK: "/assets/loot/weapon-v1.webp", STORM: "/assets/relics/stormheart.webp", POTION: "/assets/loot/potion-v1.webp", PROTECT: "/assets/relics/iron-shell.webp", HIDE: "/assets/relics/black-mirror.webp", OBSERVE: RELIC_ART };
export function ActionArtwork({ verb }: { verb: Verb }) {
  const source = ACTION_ART[verb];
  return source ? <Image src={source} width={44} height={38} alt="" sizes="36px" className={styles.actionArtwork} /> : null;
}

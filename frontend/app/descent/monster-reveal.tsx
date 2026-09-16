"use client";

import Image from "next/image";
import { useEffect, useReducer } from "react";
import { MonsterFieldNotes } from "../dungeon/room-parchments";
import { getEnemyArt, type RoomView } from "../dungeon/scene";
import type { MonsterType } from "../practice/engine";

export const MONSTER_REVEAL_DURATION_MS = 2_000;

export type MonsterRevealProps = {
  enemy: MonsterType;
  room?: number;
  name: string;
  role: string;
  description: string;
  hp: number;
  maxHp: number;
  phase: RoomView["phase"];
  roomTurns: number;
  cueId: number;
  pending: boolean;
};

export function shouldAutoRevealMonster(phase: RoomView["phase"], roomTurns: number, hp: number) {
  return phase === "combat" && roomTurns === 0 && hp > 0;
}

export function isMonsterRevealVisible(phase: RoomView["phase"], hp: number, state: MonsterRevealState) {
  return state.automatic || (state.manual && phase === "combat" && hp > 0);
}

export type MonsterRevealState = { automatic: boolean; manual: boolean; artReady: boolean };
export type MonsterRevealEvent = { type: "view" | "dismiss" | "art-ready" };
type MonsterRevealTimers = { setTimeout: (callback: () => void, delay: number) => number; clearTimeout: (timer: number) => void };

export function monsterRevealReducer(state: MonsterRevealState, event: MonsterRevealEvent): MonsterRevealState {
  if (event.type === "art-ready") return state.artReady ? state : { ...state, artReady: true };
  if (event.type === "view") return { ...state, manual: true };
  return { ...state, automatic: false, manual: false };
}

export function shouldScheduleMonsterRevealDismiss(visible: boolean, manual: boolean, artReady: boolean) {
  return visible && !manual && artReady;
}

export function scheduleMonsterRevealDismiss(onDismiss: () => void, timers: MonsterRevealTimers) {
  const timer = timers.setTimeout(onDismiss, MONSTER_REVEAL_DURATION_MS);
  return () => timers.clearTimeout(timer);
}

export function MonsterReveal({ enemy, room = 1, name, role, description, hp, maxHp, phase, roomTurns }: MonsterRevealProps) {
  const [state, dispatch] = useReducer(monsterRevealReducer, {
    automatic: shouldAutoRevealMonster(phase, roomTurns, hp),
    manual: false,
    artReady: false,
  });
  const art = getEnemyArt(enemy,room);
  const active = phase === "combat" && hp > 0;
  const visible = isMonsterRevealVisible(phase, hp, state);

  useEffect(() => {
    // Combat revisions, HP and pending transactions never reset this clock.
    if (!shouldScheduleMonsterRevealDismiss(state.automatic, state.manual, state.artReady)) return;
    return scheduleMonsterRevealDismiss(() => dispatch({ type: "dismiss" }), window);
  }, [state.automatic, state.artReady, state.manual]);

  if (!active && !visible) return null;

  if (!visible) return <div className="descent-monster-reveal is-collapsed">
    <button className="descent-monster-reveal-trigger" type="button" title="View monster and field notes" onClick={() => dispatch({ type: "view" })} aria-label={`View ${name} monster close-up, ${hp} of ${maxHp} health`}>
      <span className="descent-monster-reveal-thumb"><Image src={art.src} alt="" fill sizes="48px" unoptimized /></span>
      <span className="descent-monster-reveal-mobile-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 5.5h15v13h-15zM7 15l3.2-3.4 2.4 2.5 1.8-1.8 2.6 2.7M16.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" /></svg>
      </span>
      <span><strong>View monster</strong><small>{name} · {hp} / {maxHp} HP</small></span>
    </button>
  </div>;

  return <div className="descent-monster-reveal is-open">
    <section className="descent-monster-reveal-card" aria-label={`${name} monster close-up`}>
      <div className="descent-monster-reveal-art">
        <Image src={art.src} alt={`${name}, ${role}`} fill sizes="(max-width: 760px) 100vw, 900px" unoptimized onLoad={() => dispatch({ type: "art-ready" })} onError={() => dispatch({ type: "art-ready" })} />
      </div>
      <MonsterFieldNotes monster={{name,role,description}} className="descent-monster-reveal-notes">
        <div className="descent-monster-reveal-health" role="progressbar" aria-label={`${name} health`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
          <span style={{ width: `${Math.max(0, Math.min(100, hp / maxHp * 100))}%` }} />
        </div>
        <small>{hp} / {maxHp} HP</small>
      </MonsterFieldNotes>
      <button className="descent-monster-reveal-close" type="button" onClick={() => dispatch({ type: "dismiss" })} aria-label={`Close ${name} close-up`}>Close artwork <span aria-hidden="true">×</span></button>
    </section>
  </div>;
}

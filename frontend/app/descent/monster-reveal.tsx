"use client";

import Image from "next/image";
import { useEffect, useReducer } from "react";
import { ENEMY_ART, type RoomView } from "../dungeon/scene";
import type { MonsterType } from "../practice/engine";

export const MONSTER_REVEAL_DURATION_MS = 2_000;

export type MonsterRevealProps = {
  enemy: MonsterType;
  name: string;
  role: string;
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

export function isMonsterRevealVisible({ phase, roomTurns, hp, cueId, dismissedAt, manualAt }: Pick<MonsterRevealProps, "phase" | "roomTurns" | "hp" | "cueId"> & { dismissedAt: number | null; manualAt: number | null }) {
  const active = phase === "combat" && hp > 0;
  return active && (manualAt === cueId || (roomTurns === 0 && dismissedAt !== cueId));
}

export type MonsterRevealState = { dismissedAt: number | null; manualAt: number | null; artReady: boolean };
export type MonsterRevealEvent = { type: "view"; cueId: number } | { type: "dismiss"; cueId: number } | { type: "art-ready" };
type MonsterRevealTimers = { setTimeout: (callback: () => void, delay: number) => number; clearTimeout: (timer: number) => void };

export function monsterRevealReducer(state: MonsterRevealState, event: MonsterRevealEvent): MonsterRevealState {
  if (event.type === "art-ready") return state.artReady ? state : { ...state, artReady: true };
  if (event.type === "view") return { ...state, manualAt: event.cueId };
  return { ...state, dismissedAt: event.cueId, manualAt: null };
}

export function shouldScheduleMonsterRevealDismiss(visible: boolean, manual: boolean, artReady: boolean) {
  return visible && !manual && artReady;
}

export function scheduleMonsterRevealDismiss(onDismiss: () => void, timers: MonsterRevealTimers) {
  const timer = timers.setTimeout(onDismiss, MONSTER_REVEAL_DURATION_MS);
  return () => timers.clearTimeout(timer);
}

export function MonsterReveal({ enemy, name, role, hp, maxHp, phase, roomTurns, cueId, pending }: MonsterRevealProps) {
  const [state, dispatch] = useReducer(monsterRevealReducer, {
    dismissedAt: shouldAutoRevealMonster(phase, roomTurns, hp) ? null : cueId,
    manualAt: null,
    artReady: false,
  });
  const art = ENEMY_ART[enemy];
  const active = phase === "combat" && hp > 0;
  const visible = !pending && isMonsterRevealVisible({ phase, roomTurns, hp, cueId, ...state });

  useEffect(() => {
    if (!shouldScheduleMonsterRevealDismiss(visible, state.manualAt === cueId, state.artReady)) return;
    return scheduleMonsterRevealDismiss(() => dispatch({ type: "dismiss", cueId }), window);
  }, [cueId, state.artReady, state.manualAt, visible]);

  if (!active || pending) return null;

  if (!visible) return <div className="descent-monster-reveal is-collapsed">
    <button className="descent-monster-reveal-trigger" type="button" onClick={() => dispatch({ type: "view", cueId })} aria-label={`View ${name} monster close-up, ${hp} of ${maxHp} health`}>
      <span className="descent-monster-reveal-thumb"><Image src={art.src} alt="" fill sizes="48px" unoptimized /></span>
      <span><strong>View monster</strong><small>{name} · {hp} / {maxHp} HP</small></span>
    </button>
  </div>;

  return <div className="descent-monster-reveal is-open">
    <section className="descent-monster-reveal-card" aria-label={`${name} monster close-up`}>
      <div className="descent-monster-reveal-art">
        <Image src={art.src} alt={`${name}, ${role}`} fill sizes="(max-width: 760px) 100vw, 900px" unoptimized onLoad={() => dispatch({ type: "art-ready" })} onError={() => dispatch({ type: "art-ready" })} />
      </div>
      <div className="descent-monster-reveal-caption">
        <p>{role}</p>
        <h2>{name}</h2>
        <div className="descent-monster-reveal-health" role="progressbar" aria-label={`${name} health`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
          <span style={{ width: `${Math.max(0, Math.min(100, hp / maxHp * 100))}%` }} />
        </div>
        <small>{hp} / {maxHp} HP</small>
      </div>
      <button className="descent-monster-reveal-close" type="button" onClick={() => dispatch({ type: "dismiss", cueId })} aria-label={`Close ${name} close-up`}>Continue fight <span aria-hidden="true">×</span></button>
    </section>
  </div>;
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FAMILY_REACTIONS, MONSTER_OPENINGS, type SpeechStage } from "./monster-dialogue";

export const MONSTER_SPEECH_LIFETIME_MS = 4200;

export type MonsterSpeechContext = {
  name: string;
  monsterType: 0 | 1 | 2 | 3;
  room: number;
  phase: "explore" | "combat" | "loot" | "recovery" | "reward" | "won" | "lost";
  cue: "attack" | "storm" | "potion" | "critical" | "revive" | null;
  cueId: number;
  roomTurns: number;
  hp: number;
  maxHp: number;
  damage: number;
};

type Speech = { line: string; stage: SpeechStage };
type SpeechSnapshot = Speech & { id: string };

function personaKey(name: string) { return name.toLowerCase().replace(/^the\s+/, "").trim(); }
function active(context: MonsterSpeechContext) { return context.phase === "combat" && context.hp > 0; }
function speechEvent(context: MonsterSpeechContext) {
  return [context.room,context.name,context.cueId,context.roomTurns].join(":");
}

function speechPool(context: MonsterSpeechContext) {
  if (!active(context)) return null;
  let stage: SpeechStage;
  if (!context.cue) {
    // Clearing an animation cue is not a fresh greeting or a dialogue event.
    if (context.roomTurns > 0) return null;
    stage="opening";
  } else if (context.cue === "potion" || context.cue === "revive") stage=context.cue;
  else if (context.cue === "storm" && context.damage === 0) stage="miss";
  else if (context.cue === "critical") stage="critical";
  else if (context.maxHp > 0 && context.hp / context.maxHp <= .3) stage="wounded";
  else stage=context.cue === "storm" ? "storm" : "hit";
  const persona=personaKey(context.name);
  const opening=stage === "opening" ? MONSTER_OPENINGS[persona] : undefined;
  return { stage, key:opening ? "persona:"+persona : "family:"+context.monsterType+":"+stage,
    lines:opening ?? FAMILY_REACTIONS[context.monsterType][stage] };
}

/** Cosmetic mixing only: it never reads or advances the gameplay RNG. */
function dialogueHash(value: string) {
  let hash=2166136261;
  for (const char of value) hash=Math.imul(hash ^ char.charCodeAt(0),16777619);
  return hash >>> 0;
}

/** Pure context preview without consuming the browser's dialogue history. */
export function monsterSpeech(context: MonsterSpeechContext): Speech | null {
  const pool=speechPool(context);
  return pool ? {stage:pool.stage,line:pool.lines[dialogueHash(pool.key+":"+speechEvent(context))%pool.lines.length]} : null;
}

/** One bounded in-memory deck per persona opening or family/reaction. Every
 * line is used before the deck repeats, including across rooms and new runs. */
export function createMonsterSpeechRotation() {
  const decks=new Map<string,{used:Set<string>;last:string;cycle:number}>();
  return {
    pick(context: MonsterSpeechContext): Speech | null {
      const pool=speechPool(context);
      if (!pool) return null;
      const deck=decks.get(pool.key) ?? {used:new Set<string>(),last:"",cycle:0};
      if (deck.used.size >= pool.lines.length) { deck.used.clear(); deck.cycle++; }
      let available=pool.lines.filter(line => !deck.used.has(line) && line !== deck.last);
      if (!available.length) available=pool.lines.filter(line => !deck.used.has(line));
      const line=available[dialogueHash(pool.key+":"+speechEvent(context)+":"+deck.cycle)%available.length];
      deck.used.add(line); deck.last=line; decks.set(pool.key,deck);
      return {line,stage:pool.stage};
    },
  };
}

/** Observe committed events once. Transient effects/HP refreshes cannot draw
 * a new line or reset its lifetime. The store has no background work or timer. */
export function createMonsterSpeechSession(rotation=createMonsterSpeechRotation()) {
  let snapshot: SpeechSnapshot | null=null;
  let lastEvent: string | null=null;
  const listeners=new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => null,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    observe(context: MonsterSpeechContext) {
      if (!active(context)) {
        if (snapshot) { snapshot=null; listeners.forEach(listener => listener()); }
        return;
      }
      if (!speechPool(context)) return;
      const id=speechEvent(context);
      if (id === lastEvent) return;
      lastEvent=id;
      const next=rotation.pick(context);
      snapshot=next ? {...next,id} : null;
      listeners.forEach(listener => listener());
    },
  };
}

// Consumed only from effects after commit, never during SSR or render. It
// survives room changes within this page visit without storage or tracking.
const visitRotation=createMonsterSpeechRotation();

function TimedMonsterSpeech({ name, speech }: { name: string; speech: Speech }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), MONSTER_SPEECH_LIFETIME_MS);
    return () => window.clearTimeout(timeout);
  }, []);
  if (!visible) return null;
  return <blockquote className="monster-speech" data-speech-stage={speech.stage} aria-label={name+" says"}>
    <strong className="monster-speech-speaker">{name}</strong>
    <p>“{speech.line}”</p>
  </blockquote>;
}

export function MonsterSpeech(context: MonsterSpeechContext) {
  // Wait for the committed deck draw: an unconsumed SSR greeting could flash
  // before the real line and undermine both rotation and its display time.
  const [session]=useState(() => createMonsterSpeechSession(visitRotation));
  const speech=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getServerSnapshot);
  const {name,monsterType,room,phase,cue,cueId,roomTurns,hp,maxHp,damage}=context;
  useEffect(() => {
    session.observe({name,monsterType,room,phase,cue,cueId,roomTurns,hp,maxHp,damage});
  },[session,name,monsterType,room,phase,cue,cueId,roomTurns,hp,maxHp,damage]);
  if (!active(context) || !speech) return null;
  return <TimedMonsterSpeech key={speech.id} name={name} speech={speech} />;
}

"use client";

import { useEffect, useState } from "react";

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

type SpeechStage = "opening" | "hit" | "storm" | "miss" | "critical" | "potion" | "revive" | "wounded";
type Speech = { line: string; stage: SpeechStage };

const OPENING_LINES: Readonly<Record<string, string>> = {
  "grave belle": "Do come closer. I dressed for dinner.",
  "miss morgue": "Compliments first. Brains second.",
  "velvet rot": "You look better in candlelight. Barely.",
  "lady decomposition": "Try not to wrinkle my floor.",
  "gary": "I have a plan! Probably!",
  "gribnob the unqualified": "I learned this job this morning.",
  "gribble": "I have armor now. Fear progress!",
  "gary's supervisor": "I approved Gary, and I approve this fight.",
  "thud": "I am Thud. That is also the plan.",
  "brutus": "I hit harder. Strategy complete.",
  "gronk": "I tried diplomacy once. Boring.",
  "meatwall": "I am load-bearing. You are not.",
  "dungeon lord": "Your appointment is regrettably confirmed.",
  "senior dungeon lord": "I scheduled your defeat for now.",
  "executive overlord": "Your survival lacks executive approval.",
  "chairman below": "The board voted to crush you.",
};

const REACTIONS: ReadonlyArray<Readonly<Record<Exclude<SpeechStage, "opening">, readonly [string, string]>>> = [
  {
    hit: ["You'll need a sharper opinion.", "I have lost worse pieces."],
    storm: ["Static? My hair was already dead.", "Lightning only adds atmosphere."],
    miss: ["Even the weather avoids me.", "Your thunder forgot the bite."],
    critical: ["That was my better side!", "I felt that. How inconvenient."],
    potion: ["Marinating yourself? Thoughtful.", "Drink up. I prefer fresh."],
    revive: ["A second life? Greedy.", "Stay down next time."],
    wounded: ["I am still mostly assembled.", "I only need the biting parts."],
  },
  {
    hit: ["Hey! I was using that bit.", "That was outside the plan."],
    storm: ["Nobody said there'd be weather!", "The sky is cheating!"],
    miss: ["Ha! Your cloud needs training.", "I dodged that on purpose!"],
    critical: ["I demand a smaller sword!", "That is not regulation damage!"],
    potion: ["Stop improving the merchandise!", "No healing during my victory!"],
    revive: ["That is absolutely cheating!", "You already had a turn at living!"],
    wounded: ["I remain mostly qualified!", "This is still going on my résumé."],
  },
  {
    hit: ["Good. Now hit harder.", "That almost counted."],
    storm: ["Tiny sky hammer! Again!", "The ceiling fights dirty."],
    miss: ["Your thunder is weak!", "Cloud missed. Orc did not."],
    critical: ["Now that was a hit!", "Finally, proper violence!"],
    potion: ["No drinking during punching!", "Put down tiny health soup!"],
    revive: ["Good. More fighting.", "Again? Excellent."],
    wounded: ["I have plenty of orc left.", "Still standing. Still punching."],
  },
  {
    hit: ["Your complaint remains denied.", "This changes nothing on the agenda."],
    storm: ["Weather is outside your remit.", "I did not authorize lightning."],
    miss: ["Forecast: disappointing performance.", "Your storm missed its quarterly target."],
    critical: ["That will require a meeting.", "This exceeds your authority."],
    potion: ["Unauthorized wellness break.", "Your benefits do not cover that."],
    revive: ["Your extension is denied.", "Who approved another life?"],
    wounded: ["My position remains secure.", "The board still backs me."],
  },
] as const;

function personaKey(name: string) {
  return name.toLowerCase().replace(/^the\s+/, "").trim();
}

function pick(lines: readonly [string, string], context: MonsterSpeechContext) {
  return lines[Math.abs(context.room + context.roomTurns + context.cueId) % lines.length];
}

/** Presentation-only copy selected from confirmed combat state; no random draw. */
export function monsterSpeech(context: MonsterSpeechContext): Speech | null {
  if (context.phase !== "combat" || context.hp <= 0) return null;
  if (!context.cue) return {
    line: OPENING_LINES[personaKey(context.name)]
      ?? (context.monsterType === 3 ? "I have reviewed your file." : "Come closer. I insist."),
    stage: "opening",
  };
  const reactions = REACTIONS[context.monsterType];
  if (context.cue === "potion") return { line: pick(reactions.potion, context), stage: "potion" };
  if (context.cue === "revive") return { line: pick(reactions.revive, context), stage: "revive" };
  if (context.cue === "storm" && context.damage === 0) return { line: pick(reactions.miss, context), stage: "miss" };
  if (context.cue === "critical") return { line: pick(reactions.critical, context), stage: "critical" };
  if (context.maxHp > 0 && context.hp / context.maxHp <= .3) return { line: pick(reactions.wounded, context), stage: "wounded" };
  const stage = context.cue === "storm" ? "storm" : "hit";
  return { line: pick(reactions[stage], context), stage };
}

function TimedMonsterSpeech({ name, speech }: { name: string; speech: Speech }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), MONSTER_SPEECH_LIFETIME_MS);
    return () => window.clearTimeout(timeout);
  }, []);
  if (!visible) return null;
  return <blockquote className="monster-speech" data-speech-stage={speech.stage} aria-label={`${name} says`}>
    <p>“{speech.line}”</p>
  </blockquote>;
}

export function MonsterSpeech(context: MonsterSpeechContext) {
  const speech = monsterSpeech(context);
  if (!speech) return null;
  const identity = `${context.room}:${context.name}:${context.cueId}:${speech.stage}:${speech.line}`;
  return <TimedMonsterSpeech key={identity} name={context.name} speech={speech} />;
}

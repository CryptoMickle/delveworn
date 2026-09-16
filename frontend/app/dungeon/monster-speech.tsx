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

type SpeechStage = "opening" | "hit" | "storm" | "miss" | "critical" | "potion" | "revive" | "wounded" | "defeat";
type Speech = { line: string; stage: SpeechStage };

const PERSONA: Readonly<Record<string, { opening: string; defeat: string }>> = {
  "grave belle": { opening: "Do come closer. I dressed for dinner.", defeat: "Rude. I was still decomposing." },
  "miss morgue": { opening: "Compliments first. Brains second.", defeat: "Keep the compliment, then." },
  "velvet rot": { opening: "You look better in candlelight. Barely.", defeat: "Well. This date is dead." },
  "lady decomposition": { opening: "Try not to wrinkle my floor.", defeat: "Beauty remains undefeated." },
  "gary": { opening: "I have a plan! Probably!", defeat: "Tell them the plan was excellent." },
  "gribnob the unqualified": { opening: "I learned this job this morning.", defeat: "I knew training was important." },
  "gribble": { opening: "I have armor now. Fear progress!", defeat: "Please return my equipment." },
  "gary's supervisor": { opening: "I approved Gary, and I approve this fight.", defeat: "Delete my performance review." },
  "thud": { opening: "I am Thud. That is also the plan.", defeat: "Plan needs... second word." },
  "brutus": { opening: "I hit harder. Strategy complete.", defeat: "Maybe... hit slightly smarter." },
  "gronk": { opening: "I tried diplomacy once. Boring.", defeat: "Reopen... negotiations." },
  "meatwall": { opening: "I am load-bearing. You are not.", defeat: "Building permit... revoked." },
  "dungeon lord": { opening: "Your appointment is regrettably confirmed.", defeat: "This meeting is adjourned." },
  "senior dungeon lord": { opening: "I scheduled your defeat for now.", defeat: "Escalate this to someone alive." },
  "executive overlord": { opening: "Your survival lacks executive approval.", defeat: "My succession plan was theoretical." },
  "chairman below": { opening: "The board voted to crush you.", defeat: "The motion... fails." },
};

const REACTIONS: ReadonlyArray<Readonly<Record<Exclude<SpeechStage, "opening" | "defeat">, readonly [string, string]>>> = [
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
  const persona = PERSONA[personaKey(context.name)] ?? {
    opening: context.monsterType === 3 ? "I have reviewed your file." : "Come closer. I insist.",
    defeat: context.monsterType === 3 ? "Consider this meeting concluded." : "I object to this outcome.",
  };
  const killingBlow = context.hp <= 0 && (context.cue === "attack" || context.cue === "storm" || context.cue === "critical");
  if (killingBlow) return { line: persona.defeat, stage: "defeat" };
  if (context.phase !== "combat" || context.hp <= 0) return null;
  if (!context.cue) return { line: persona.opening, stage: "opening" };
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
    <cite>{name}</cite>
    <p>“{speech.line}”</p>
  </blockquote>;
}

export function MonsterSpeech(context: MonsterSpeechContext) {
  const speech = monsterSpeech(context);
  if (!speech) return null;
  // Loot collection can change phase/revision while the killing line is still
  // visible. Keep that final utterance on its original timer.
  const identity = speech.stage === "defeat" ? `${context.room}:${context.name}:defeat`
    : `${context.room}:${context.name}:${context.phase}:${context.cueId}:${speech.stage}:${speech.line}`;
  return <TimedMonsterSpeech key={identity} name={context.name} speech={speech} />;
}

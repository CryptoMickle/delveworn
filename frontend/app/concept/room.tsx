"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { EMPTY_GAME, attack, attackRange, currentCriticalChance, incomingRange, stormAttack, stormRange, usePotion, type PracticeGame } from "../practice/engine";
import { createSeededRandom } from "../practice/random";
import { getRelicDefinition } from "../relics";
import { useGameAudio } from "../use-game-audio";
import { ConceptScene, type Cue, type Point } from "./scene";
import "./room.css";

const START: Point = { x: 345, y: 431 };
const ENGAGE: Point = { x: 463, y: 356 };
const PREVIEW_SEED = 0xdecaf;

function conceptFixture(): PracticeGame {
  const relicCounts = Array<number>(16).fill(0);
  relicCounts[6] = 1;
  return {
    ...EMPTY_GAME, hp: 76, monsterHp: 40, monsterMaxHp: 40, monsterType: 1,
    gold: 18, weaponLevel: 1, hasStarted: true, active: true,
    equippedRelic: 6, ownedRelics: [6], relicCounts, log: [],
  };
}

const movement: Record<string, Point> = {
  ArrowLeft: { x: -24, y: 0 }, a: { x: -24, y: 0 },
  ArrowRight: { x: 24, y: 0 }, d: { x: 24, y: 0 },
  ArrowUp: { x: 0, y: -24 }, w: { x: 0, y: -24 },
  ArrowDown: { x: 0, y: 24 }, s: { x: 0, y: 24 },
};

function Meter({ label, value, max, enemy = false }: { label: string; value: number; max: number; enemy?: boolean }) {
  return <div className={`concept-meter${enemy ? " concept-meter-enemy" : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
    <span style={{ width: `${Math.max(0, Math.min(100, value/max*100))}%` }} />
  </div>;
}

export default function ConceptRoom() {
  const [game, setGame] = useState(conceptFixture);
  const gameRef = useRef(game);
  const random = useRef(createSeededRandom(PREVIEW_SEED));
  const [position, setPosition] = useState(START);
  const positionRef = useRef(START);
  const [walking, setWalking] = useState(false);
  const [inCombat, setInCombat] = useState(false);
  const [atDoor, setAtDoor] = useState(false);
  const [cue, setCue] = useState<Cue>(null);
  const [turn, setTurn] = useState(0);
  const [healed, setHealed] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerStart = useRef<Point | null>(null);
  const [report, setReport] = useState("Gary has no plan. He is extremely committed to it.");
  const audio = useGameAudio();
  const relic = getRelicDefinition(game.equippedRelic);
  const cleared = game.monsterHp === 0;
  const ended = !game.active;
  const attackDamage = attackRange(game);
  const stormDamage = stormRange(game);
  const reply = incomingRange(game);

  useEffect(() => () => {
    if (moveTimer.current) clearTimeout(moveTimer.current);
    if (actionTimer.current) clearTimeout(actionTimer.current);
  }, []);

  function moveTo(point: Point) {
    if (busyRef.current || inCombat || !gameRef.current.active || atDoor) return;
    const clear = gameRef.current.monsterHp === 0;
    const doorLane = clear && point.y < 195 && Math.abs(point.x - 450) < 60;
    const next = { x: Math.max(204, Math.min(697, point.x)), y: Math.max(doorLane ? 143 : 213, Math.min(495, point.y)) };
    if (moveTimer.current) clearTimeout(moveTimer.current);
    positionRef.current = next;
    setPosition(next);
    setWalking(true);
    moveTimer.current = setTimeout(() => {
      setWalking(false);
      if (!clear && Math.hypot(next.x-585, next.y-315) < 151) {
        positionRef.current = ENGAGE;
        setPosition(ENGAGE);
        setInCombat(true);
        setReport("Your turn. Gary retaliates only if he survives your action.");
        svgRef.current?.focus({ preventScroll: true });
      }
      if (doorLane) {
        setAtDoor(true);
        setReport("Room cleared. This concept ends at the doorway; restart to try another approach.");
      }
    }, 360);
  }

  function floorPointer(event: PointerEvent<SVGSVGElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || Math.hypot(event.clientX-start.x, event.clientY-start.y) > 14) return;
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    svg.focus({ preventScroll: true });
    // Enemy taps approach a safe combat anchor, never move through the enemy.
    moveTo(!cleared && Math.hypot(local.x-585, local.y-265) < 92 ? ENGAGE : local);
  }

  function act(action: Exclude<Cue, null>) {
    const before = gameRef.current;
    if (busyRef.current || !inCombat || !before.active || before.monsterHp === 0) return;
    if (action === "potion" && (before.potions === 0 || before.hp >= before.maxHp || before.combatPotionsUsed >= 2)) return;
    busyRef.current = true;
    setBusy(true);
    audio.playAction(action);
    // Reuse authoritative Practice transitions. Visual effects consume no rolls.
    const next = (action === "attack" ? attack : action === "storm" ? stormAttack : usePotion)(before, random.current.nextInt);
    gameRef.current = next;
    setGame(next);
    setCue(action);
    setTurn(value => value + 1);
    setHealed(action === "potion" ? next.hp - before.hp : 0);
    if (action === "potion") {
      setReport(`Potion: heal 25, Gary replies for ${next.lastMonsterDamage}. Net HP +${next.hp-before.hp}. ${next.combatPotionsUsed}/2 combat potions used.`);
    } else if (next.monsterHp === 0) {
      setReport(`${next.lastPlayerDamage} damage finishes Gary. No retaliation. +${next.gold-before.gold} gold. The door is open.`);
      setInCombat(false);
      audio.playOutcome("loot");
    } else if (!next.active) {
      setReport(`${next.lastPlayerDamage} damage dealt. Gary replies for ${next.lastMonsterDamage}. You fall. Try a potion earlier.`);
      setInCombat(false);
      audio.playOutcome("death");
    } else {
      setReport(`${action === "storm" ? "Stormglass boosts Storm by 30%. " : next.lastCritical ? "Critical hit! " : "Attack. "}${next.lastPlayerDamage} damage; Gary replies for ${next.lastMonsterDamage}.`);
      audio.playOutcome(next.lastCritical ? "critical" : "hit");
    }
    actionTimer.current = setTimeout(() => {
      busyRef.current = false;
      setBusy(false);
      setCue(null);
    }, 620);
  }

  function keys(event: KeyboardEvent<SVGSVGElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const delta = movement[event.key] ?? movement[event.key.toLowerCase()];
    if (delta && !inCombat) {
      event.preventDefault();
      moveTo({ x: positionRef.current.x+delta.x, y: positionRef.current.y+delta.y });
    }
    const action = ({ "1": "attack", "2": "storm", "3": "potion" } as const)[event.key as "1"|"2"|"3"];
    if (action && !event.repeat) { event.preventDefault(); act(action); }
  }

  function reset() {
    if (moveTimer.current) clearTimeout(moveTimer.current);
    if (actionTimer.current) clearTimeout(actionTimer.current);
    const next = conceptFixture();
    gameRef.current = next;
    random.current = createSeededRandom(PREVIEW_SEED);
    positionRef.current = START;
    busyRef.current = false;
    setGame(next); setPosition(START); setWalking(false); setInCombat(false);
    setAtDoor(false); setCue(null); setTurn(0); setBusy(false); setHealed(0);
    setReport("Gary has no plan. He is extremely committed to it.");
  }

  return <main className="concept-root">
    <header className="concept-header">
      <Link href="/" aria-label="Delveworn home"><Image src="/assets/delveworn-logo-v1.png" alt="Delveworn" width={220} height={65} unoptimized priority /></Link>
      <div className="concept-edition"><span />THE FIRST DESCENT <small>ROOM CONCEPT</small></div>
      <button className="concept-quiet" onClick={audio.toggleSound} aria-label={audio.enabled ? "Mute sound" : "Enable sound"} aria-pressed={audio.enabled}>{audio.enabled ? "♪ Sound on" : "♪ Sound off"}</button>
    </header>

    <section className="concept-topline" aria-label="Player status">
      <div className="concept-identity"><span className="concept-emblem">D</span><div><small>THE STORMCALLER</small><strong>One relic. Bad intentions.</strong></div></div>
      <div className="concept-health"><div><span>VITALITY</span><b>{game.hp}<small> / {game.maxHp}</small></b></div><Meter label="Player health" value={game.hp} max={game.maxHp} /></div>
      <div className="concept-resources"><span><i>◈</i><b>{game.gold}</b><small>GOLD</small></span><span><i>♜</i><b>{game.weaponLevel}</b><small>WEAPON</small></span><span><i>◇</i><b>{game.armorLevel}</b><small>ARMOR</small></span></div>
    </section>

    <div className="concept-body">
      <section className="concept-world" aria-label="The dungeon">
        <div className="concept-room-title"><div><p>THE LOWER HALLS <span> / 01</span></p><h1>The Unwelcome Committee</h1></div><span className="concept-mode">PRACTICE</span></div>
        <div className="concept-map" aria-label="Descent preview: room 1 of 10; remaining rooms are outside this concept">
          {Array.from({length:10},(_,index)=><span key={index} data-current={index===0} data-done={index===0 && cleared}>{index===0 ? cleared ? "✓" : "1" : index===9 ? "♛" : "·"}</span>)}
        </div>
        <div className="concept-stage" onPointerDown={event => { pointerStart.current={x:event.clientX,y:event.clientY}; }}>
          <ConceptScene position={position} walking={walking} inCombat={inCombat} cleared={cleared} ended={ended} atDoor={atDoor} cue={cue} turn={turn} damage={game.lastPlayerDamage} incoming={cue === "potion" ? 0 : game.lastMonsterDamage} critical={game.lastCritical} healed={healed} onFloor={floorPointer} onKeys={keys} svgRef={svgRef} />
          <div className="concept-stage-caption"><span className="concept-compass">N ↑</span><span>{ended ? "THE DUNGEON WINS" : cleared ? "PATH UNSEALED" : inCombat ? "TURN-BASED COMBAT" : "EXPLORE THE ROOM"}</span><span>01 <em>/ 10</em></span></div>
        </div>
        <div className="concept-controls" id="concept-controls"><span><kbd>W A S D</kbd> / arrows to walk</span><span>Tap the floor or an enemy</span></div>
        <div className="concept-mobile-intent"><span>{cleared ? "Gary defeated" : `Gary ${game.monsterHp}/${game.monsterMaxHp} · Reply ${reply.join("–")} if alive`}</span><span>◆ Stormglass · +30% Storm</span></div>
        <div className="concept-feedback" role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true">{cleared ? "✧" : cue === "storm" ? "ϟ" : "›"}</span><p>{report}</p></div>
        <div className="concept-dock" aria-label="Combat actions" aria-busy={busy}>
          {inCombat ? <>
            <button className="concept-action concept-attack" disabled={busy} onClick={() => act("attack")}><span className="concept-action-name"><i>⚔</i> Attack <kbd>1</kbd></span><b>{attackDamage.join("–")} damage</b><small>{currentCriticalChance(game)}% critical chance</small></button>
            <button className="concept-action concept-storm" disabled={busy} onClick={() => act("storm")}><span className="concept-action-name"><i>ϟ</i> Storm <kbd>2</kbd></span><b>{stormDamage.join("–")} damage</b><small>+30% from Stormglass</small></button>
            <button className="concept-action concept-potion" disabled={busy || game.potions===0 || game.hp>=game.maxHp || game.combatPotionsUsed>=2} onClick={() => act("potion")}><span className="concept-action-name"><i>♧</i> Potion <kbd>3</kbd></span><b>Heal 25 · {game.potions} left</b><small>Half retaliation · {game.combatPotionsUsed}/2 used</small></button>
          </> : <button className="concept-continue" disabled={busy || walking || atDoor} onClick={() => { if (ended) reset(); else moveTo(cleared ? {x:450,y:145} : ENGAGE); }}><span>{ended ? "TRY THE ROOM AGAIN" : atDoor ? "CONCEPT COMPLETE" : cleared ? "WALK TO THE OPEN DOOR" : "APPROACH GARY"}</span><b>↗</b></button>}
        </div>
      </section>

      <aside className="concept-sidebar" aria-label="Encounter and relic">
        <section className="concept-enemy-card">
          <p className="concept-kicker">{cleared ? "DEFEATED" : "YOUR OPPONENT"}<span>01</span></p>
          <div className="concept-enemy-heading"><h2>Gary</h2><span>GOBLIN</span></div>
          <p className="concept-flavor">“Nobody asked Gary to guard this room. He just started.”</p>
          <div className="concept-health-label"><span>ENEMY VITALITY</span><b>{game.monsterHp}<small> / {game.monsterMaxHp}</small></b></div>
          <Meter label="Enemy health" value={game.monsterHp} max={game.monsterMaxHp} enemy />
          <div className="concept-intent"><span className="concept-intent-icon">⚔</span><div><small>{cleared ? "THE WAY IS CLEAR" : "NEXT RESPONSE"}</small><strong>{cleared ? "No retaliation" : `Retaliate · ${reply.join("–")} damage`}</strong><p>{cleared ? "You can explore and leave the room." : "If he survives. Potions halve this hit."}</p></div></div>
        </section>

        <section className="concept-relic-card" data-active={cue === "storm"}>
          <p className="concept-kicker">EQUIPPED RELIC<span>◆</span></p>
          <div className="concept-relic-heading"><Image src={relic.imageSrc!} alt="Stormglass relic" width={72} height={72} unoptimized /><div><h2>{relic.name}</h2><span>{relic.rarity}</span></div></div>
          <p className="concept-relic-benefit">+30% Storm damage</p><p className="concept-relic-cost">−5% normal attack damage</p>
          <div className="concept-relic-note"><span />Orbiting your adventurer. Watch it arc when you cast Storm.</div>
        </section>

        <section className="concept-notes"><p className="concept-kicker">A BETTER KIND OF BAD IDEA</p><h3>Read the room.<br />Choose your risk.</h3><p>Attack is steady. Storm can roll zero. A potion uses your turn, but softens the reply.</p><p className="concept-small-note">Training loadout · one-room preview.<br />Progress resets when you reload.</p><button className="concept-reset" onClick={reset}>↻ Restart the concept</button></section>
      </aside>
    </div>
    <footer className="concept-footer"><span>DELVEWORN <b> / </b> VISUAL STUDY 01</span><span>Local concept · proposed art direction · no wallet needed</span></footer>
  </main>;
}

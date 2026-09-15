"use client";

import { useEffect, useRef, useState } from "react";
import {
  BossRelicReward,
  CombatActionDock,
  DungeonEntry,
  DungeonBattle,
  DungeonLog,
  GameHeader,
  GameHud,
  RelicArtwork,
  RelicCollection,
  RoomProgressLine,
} from "../game-ui";
import {
  EMPTY_GAME,
  attack,
  attackRange,
  buy,
  campAvailable,
  campPrices,
  claimRelic,
  combatRelicSummary,
  currentCriticalChance,
  enterNextRoom,
  equipOwnedRelic,
  getMerchantVisit,
  incomingRange,
  startRun,
  stormAttack,
  stormRange,
  supplyAvailable,
  supplyPrices,
  usePotion,
  type MonsterType,
  type PracticeGame,
  type ShopAction,
} from "./engine";
import {
  describeRelicEquipImpact,
  getRelicDefinition,
} from "../relics";
import { inspectPracticeRun, savePracticeRun } from "./storage";
import { describePracticeAction, practiceLoot, practiceRoom, practiceShareText, type PracticeActionKind, type PracticeFeedback } from "./feedback";
import { useGameAudio } from "../use-game-audio";
import { DungeonRecovery } from "../between-rooms";
import { DungeonRunEnd } from "../run-end";
import { GameAutoScroll } from "../game-auto-scroll";
import { cryptoRandomInt } from "./random";
import {
  canRunPracticeLocalAction,
  collectPracticeLoot,
  countPracticeTurn,
  createPracticeGrid,
  engagePracticeGrid,
  enterPracticeRoom,
  holdPracticeLoot,
  legacyPracticeGrid,
  passPracticeLootAtDoor,
  practiceGridPhase,
  practiceLootSummary,
  skipPracticeLoot,
  type PracticeLocalAction,
  type PracticeGridState,
} from "./grid-state";
import { EndlessRoom } from "../dungeon/endless-room";
import type { SceneCue } from "../dungeon/scene";

const MAX_POTIONS = 5;
const SHOP_POTION_STOCK = 2;
const MERCHANT_NAME = "Quartermaster Kevin";
const MERCHANT_IMAGE = "/characters/merchant-quartermaster-kevin.webp?v=merchant-20260825-v3";

type MonsterPersona = {
  name: string;
  species: string;
  rank?: string;
  image: string;
  flavor: string;
  chance: string;
};

const MONSTER_PERSONAS: Record<MonsterType, readonly MonsterPersona[]> = {
  0: [
    { name: "Grave Belle", species: "Zombie", image: "/monsters/zombie-1-grave-belle.webp?v=art-20260825-v2", flavor: "Technically deceased. Socially still very active.", chance: "45%" },
    { name: "Miss Morgue", species: "Zombie", image: "/monsters/zombie-2-miss-morgue.webp?v=art-20260825-v2", flavor: "She wants brains, compliments, and preferably both.", chance: "45%" },
    { name: "Velvet Rot", species: "Zombie", image: "/monsters/zombie-3-velvet-rot.webp?v=art-20260825-v2", flavor: "Somewhere between a nightmare and a questionable dating decision.", chance: "45%" },
    { name: "Lady Decomposition", species: "Zombie", image: "/monsters/zombie-4-lady-decomposition.webp?v=art-20260825-v2", flavor: "Beauty fades. Apparently attitude does not.", chance: "45%" },
  ],
  1: [
    { name: "Gary", species: "Goblin", image: "/monsters/goblin-1-gary.webp?v=art-20260825-v2", flavor: "Gary has no plan, but he is extremely committed to it.", chance: "35%" },
    { name: "Kevin the Unqualified", species: "Goblin", image: "/monsters/goblin-2-kevin-the-unqualified.webp?v=art-20260825-v2", flavor: "Nobody knows who hired Kevin. Kevin included.", chance: "35%" },
    { name: "Gribble", species: "Goblin", image: "/monsters/goblin-3-gribble.webp?v=art-20260825-v2", flavor: "Gribble has discovered armor. Civilization may never recover.", chance: "35%" },
    { name: "Gary's Supervisor", species: "Goblin", image: "/monsters/goblin-4-garys-supervisor.webp?v=art-20260825-v2", flavor: "You finally found the person responsible for Gary.", chance: "35%" },
  ],
  2: [
    { name: "Thud", species: "Orc", image: "/monsters/orc-1-thud.webp?v=art-20260825-v2", flavor: "Thud hits first, thinks never.", chance: "20%" },
    { name: "Brutus", species: "Orc", image: "/monsters/orc-2-brutus.webp?v=art-20260825-v2", flavor: "His tactical doctrine contains one word: harder.", chance: "20%" },
    { name: "Gronk", species: "Orc", image: "/monsters/orc-3-gronk.webp?v=art-20260825-v2", flavor: "Gronk briefly considered diplomacy. He did not enjoy it.", chance: "20%" },
    { name: "Meatwall", species: "Orc", image: "/monsters/orc-4-meatwall.webp?v=art-20260825-v2", flavor: "Less of an opponent. More of an architectural problem.", chance: "20%" },
  ],
  3: [
    { name: "The Dungeon Lord", species: "Boss", rank: "Dungeon Management", image: "/monsters/boss-1-dungeon-lord.webp?v=art-20260825-v2", flavor: "Runs the dungeon with absolute authority and questionable administrative competence.", chance: "BOSS" },
    { name: "The Senior Dungeon Lord", species: "Boss", rank: "Senior Management", image: "/monsters/boss-2-senior-dungeon-lord.webp?v=art-20260825-v2", flavor: "More authority, more paperwork, exactly the same leadership skills.", chance: "BOSS" },
    { name: "The Executive Overlord", species: "Boss", rank: "Executive Management", image: "/monsters/boss-3-executive-overlord.webp?v=art-20260825-v2", flavor: "Promoted beyond competence. Unfortunately, also beyond mortality.", chance: "BOSS" },
    { name: "The Chairman Below", species: "Boss", rank: "Board Level", image: "/monsters/boss-4-chairman-below.webp?v=art-20260825-v2", flavor: "The final authority. There is no escalation path above him.", chance: "BOSS" },
  ],
};

function getRegularTier(room: number): number {
  if (room <= 9) return 0;
  if (room <= 19) return 1;
  if (room <= 29) return 2;
  return 3;
}

function getBossTier(room: number): number {
  if (room <= 10) return 0;
  if (room <= 20) return 1;
  if (room <= 30) return 2;
  return 3;
}

function getMonsterPersona(game: PracticeGame): MonsterPersona {
  const room = game.monsterHp > 0 ? game.roomsCleared + 1 : Math.max(1, game.roomsCleared);
  const variants = MONSTER_PERSONAS[game.monsterType];
  const tier = game.monsterType === 3
    ? getBossTier(room)
    : getRegularTier(room);
  return variants[tier];
}

function ShopButton({
  label,
  detail,
  cost,
  onClick,
  disabledReason,
}: {
  label: string;
  detail: string;
  cost: number;
  onClick: () => void;
  disabledReason: string | null;
}) {
  const disabled = disabledReason !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-left transition hover:border-orange-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:opacity-70"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-black">{label}</span>
        <span className={disabled ? "text-xs font-bold text-zinc-600" : "text-xs font-bold text-orange-400"}>{cost} GOLD</span>
      </div>
      <p className={disabled ? "mt-1 text-[10px] font-bold text-red-400" : "mt-1 text-[10px] text-zinc-500"}>
        {disabledReason ?? detail}
      </p>
    </button>
  );
}

export default function PracticePage() {
  const [game, setGame] = useState<PracticeGame>(EMPTY_GAME);
  const [grid, setGrid] = useState<PracticeGridState>(() => legacyPracticeGrid(EMPTY_GAME));
  const [practiceStorageReady, setPracticeStorageReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState<"restored" | "invalid" | "unavailable" | "conflict" | null>(null);
  const [restartRequested, setRestartRequested] = useState(false);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [shareFallback, setShareFallback] = useState(false);
  const [mobileLogOpen, setMobileLogOpen] = useState(false);
  const [cue, setCue] = useState<SceneCue>(null);
  const [cueId, setCueId] = useState(0);
  const gameRef = useRef<PracticeGame>(EMPTY_GAME);
  const gridRef = useRef<PracticeGridState>(legacyPracticeGrid(EMPTY_GAME));
  const actionBusyRef = useRef(false);
  const canSaveRef = useRef(false);
  const savedGameRef = useRef<string | null>(null);
  const bossRewardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => { actionBusyRef.current = false; };
  }, []);

  useEffect(() => {
    const changedElsewhere = (event: StorageEvent) => {
      if (event.key !== null && event.key !== "delveworn_practice_run_v1") return;
      canSaveRef.current = false;
      setStorageNotice("conflict");
    };
    window.addEventListener("storage", changedElsewhere);
    return () => window.removeEventListener("storage", changedElsewhere);
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const restored = inspectPracticeRun(() => window.localStorage);
      canSaveRef.current = restored.status === "restored" || restored.status === "empty";
      if (restored.status === "restored") {
        savedGameRef.current = JSON.stringify({ game: restored.game, grid: restored.grid });
        gameRef.current = restored.game;
        gridRef.current = restored.grid;
        setGame(restored.game);
        setGrid(restored.grid);
        if (restored.game.hasStarted) setStorageNotice("restored");
      } else if (restored.status !== "empty") {
        setStorageNotice(restored.status);
      }
      setPracticeStorageReady(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  const busy = !practiceStorageReady || restartRequested;
  const room = game.roomsCleared + 1;
  const phase = practiceGridPhase(game, grid);
  const roomCleared = game.hasStarted && game.monsterHp === 0;
  const isBoss = game.monsterType === 3 && game.monsterHp > 0;
  const persona = getMonsterPersona(game);
  const audio = useGameAudio({
    bossActive: phase === "combat" && isBoss,
    encounter: phase === "combat" ? persona.name : undefined,
    encounterKey: room,
  });
  const relic = getRelicDefinition(game.equippedRelic);
  const attackDamage = attackRange(game);
  const stormDamage = stormRange(game);
  const attackRelicSummary = combatRelicSummary(game, false);
  const stormRelicSummary = combatRelicSummary(game, true);
  const incoming = incomingRange(game);
  const supplies = supplyPrices(game);
  const camp = campPrices(game);
  const combatPotionLimit = isBoss ? 3 : 2;
  const merchantVisit = getMerchantVisit(game);
  const awardedRelic = getRelicDefinition(game.relicOfferId);
  const awardedRelicCount = game.relicCounts[game.relicOfferId] ?? 0;
  const totalRelicDrops = game.relicCounts.reduce((total, count) => total + count, 0);
  const bossRewardActive = phase === "reward";
  const recoveryActive = phase === "recovery";
  const endedActive = game.hasStarted && !game.active;
  const relicEquipPreview = describeRelicEquipImpact({
    currentMaxHp: game.maxHp,
    baseMaxHp: game.baseMaxHp,
    relicId: awardedRelic.id,
  });

  const canChangeRelic = game.active && roomCleared && !busy;
  const roomHealDisabledReason = busy
    ? "Finish the current choice first."
    : game.potions === 0
      ? "No potions available."
      : game.hp >= game.maxHp
        ? "HP is already full."
        : null;
  const supplyBandageDisabledReason = busy
    ? "Finish the current choice first."
    : game.supplyBandageUsed
      ? "Already used at this stop."
      : game.hp >= game.maxHp
        ? "HP is already full."
        : game.gold < supplies.bandage
          ? "Not enough gold."
          : null;
  const supplyPotionDisabledReason = busy
    ? "Finish the current choice first."
    : game.supplyPotionsBought >= SHOP_POTION_STOCK
      ? "Sold out at this stop."
      : game.potions >= MAX_POTIONS
        ? "Potion inventory is full."
        : game.gold < supplies.potion
          ? "Not enough gold."
          : null;
  const campRestDisabledReason = busy
    ? "Finish the current choice first."
    : game.campRestUsed
      ? "Already used at this camp."
      : game.hp >= game.maxHp
        ? "HP is already full."
        : game.gold < camp.rest
          ? "Not enough gold."
          : null;
  const campPotionDisabledReason = busy
    ? "Finish the current choice first."
    : game.campPotionsBought >= SHOP_POTION_STOCK
      ? "Sold out at this camp."
      : game.potions >= MAX_POTIONS
        ? "Potion inventory is full."
        : game.gold < camp.potion
          ? "Not enough gold."
          : null;
  const campWeaponDisabledReason = busy
    ? "Finish the current choice first."
    : game.gold < camp.weapon
      ? "Not enough gold."
      : null;
  const campArmorDisabledReason = busy
    ? "Finish the current choice first."
    : game.gold < camp.armor
      ? "Not enough gold."
      : null;


  let subtitle = "Enter the dungeon";
  if (game.hasStarted && !game.active) subtitle = "Your run has ended";
  else if (bossRewardActive) subtitle = "Boss defeated · relic awarded";
  else if (roomCleared) subtitle = "Room " + game.roomsCleared + " cleared";
  else if (isBoss) subtitle = "Room " + room + " · BOSS";
  else if (game.hasStarted) subtitle = "Room " + room;

  const persist = (nextGame: PracticeGame, nextGrid: PracticeGridState) => {
    if (!canSaveRef.current) return;
    const result = savePracticeRun(() => window.localStorage, nextGame, nextGrid);
    if (result !== "saved") {
      canSaveRef.current = false;
      setStorageNotice(result === "invalid" ? "invalid" : "unavailable");
    } else {
      savedGameRef.current = JSON.stringify({ game: nextGame, grid: nextGrid });
    }
  };

  const commit = (nextGame: PracticeGame, nextGrid = gridRef.current) => {
    gameRef.current = nextGame;
    gridRef.current = nextGrid;
    setGame(nextGame);
    setGrid(nextGrid);
    persist(nextGame, nextGrid);
  };

  const restart = (replaceSave = false) => {
    if (!practiceStorageReady || actionBusyRef.current) return;
    actionBusyRef.current = true;
    setRestartRequested(false);
    setShareNotice("");
    setShareFallback(false);
    if (replaceSave) canSaveRef.current = true;
    if (canSaveRef.current) setStorageNotice(null);
    try {
      const next = startRun();
      const nextGrid = createPracticeGrid(cryptoRandomInt(0x1_0000_0000));
      commit(next, nextGrid);
      setCue(null);
      setCueId(0);
      setFeedback({ title: "Enter the room", detail: "Walk toward the enemy to begin combat.", tone: "neutral" });
      audio.playAction("click");
    } catch {
      setFeedback({ title: "The dungeon could not open", detail: "Local randomness is unavailable. Your previous run is unchanged. Try reloading the page.", tone: "danger" });
    } finally {
      queueMicrotask(() => { actionBusyRef.current = false; });
    }
  };

  const settleAction = (
    before: PracticeGame,
    next: PracticeGame,
    kind: PracticeActionKind,
    beforeGrid = gridRef.current,
  ) => {
    let nextGame = next;
    let nextGrid = beforeGrid;
    const combatTurn = before.monsterHp > 0 && (kind === "attack" || kind === "storm" || kind === "potion");
    if (combatTurn) nextGrid = countPracticeTurn(nextGrid);
    const held = holdPracticeLoot(before, nextGame, nextGrid);
    nextGame = held.game;
    nextGrid = held.grid;
    if (!nextGame.active) nextGrid = { ...nextGrid, engaged: false };
    if (kind === "encounter") nextGrid = enterPracticeRoom(nextGrid);
    commit(nextGame, nextGrid);
    setStorageNotice((notice) => notice === "restored" ? null : notice);
    setCue(combatTurn ? (nextGame.relicReviveUsed && !before.relicReviveUsed ? "revive" : nextGame.lastCritical ? "critical" : kind === "storm" ? "storm" : kind === "potion" ? "potion" : "attack") : null);
    setCueId((id) => id + 1);
    setFeedback(nextGrid.pendingLoot && beforeGrid.pendingLoot === null
      ? {
          title: `${kind === "storm" ? "Storm" : nextGame.lastCritical ? "Critical attack" : "Attack"} · ${nextGame.lastPlayerDamage} damage`,
          detail: `Room ${nextGame.roomsCleared} cleared. Tap the loot to collect it, or tap the door to leave it behind.`,
          tone: "good",
        }
      : describePracticeAction(before, nextGame, kind));
    if (!nextGame.active) audio.playOutcome("death");
    else if (nextGrid.pendingLoot) audio.playOutcome(nextGame.lastCritical ? "critical" : "hit");
    else if (kind === "relic") audio.playOutcome("relic");
    else if ((kind === "attack" || kind === "storm") && nextGame.lastPlayerDamage > 0) audio.playOutcome(nextGame.lastCritical ? "critical" : "hit");
  };

  const actionFailed = () => {
    setFeedback({ title: "Action interrupted", detail: "Your run is unchanged. Try the action again when this page is ready.", tone: "danger" });
  };

  const resolveLocalAction = (
    kind: PracticeActionKind,
    action: (current: PracticeGame) => PracticeGame,
  ) => {
    if (busy || actionBusyRef.current) return;
    // Resolve immediately. Only duplicate dispatches in this call stack are
    // locked; the next user gesture never waits for a timer or loading screen.
    actionBusyRef.current = true;
    const before = gameRef.current;
    try {
      if (kind !== "relic") audio.playAction(kind === "encounter" || kind === "shop" ? "click" : kind);
      // Randomness runs once, outside a React updater that Strict Mode can replay.
      settleAction(before, action(before), kind);
    } catch {
      actionFailed();
    } finally {
      queueMicrotask(() => { actionBusyRef.current = false; });
    }
  };

  const runLocalAction = (
    kind: PracticeLocalAction,
    action: (current: PracticeGame) => PracticeGame,
  ) => {
    const before = gameRef.current;
    if (!canRunPracticeLocalAction(before, gridRef.current, kind)) return;
    resolveLocalAction(kind, action);
  };

  const runShopAction = (action: ShopAction) => {
    resolveLocalAction("shop", current => buy(current, action));
  };

  const runRelicAction = (action: (current: PracticeGame) => PracticeGame) => {
    resolveLocalAction("relic", action);
  };

  const approach = () => {
    if (busy || actionBusyRef.current || phase !== "explore") return;
    const nextGrid = engagePracticeGrid(gridRef.current);
    commit(gameRef.current, nextGrid);
    setFeedback({ title: "Your turn", detail: "A killing blow prevents the enemy's reply.", tone: "neutral" });
    audio.playAction("click");
  };

  const collectLoot = () => {
    if (busy || actionBusyRef.current || gridRef.current.pendingLoot === null) return;
    const before = gridRef.current.pendingLoot;
    const next = collectPracticeLoot(gameRef.current, gridRef.current);
    commit(next.game, next.grid);
    setCue(null);
    setFeedback({ title: "Loot collected", detail: practiceLootSummary(before), tone: "good" });
    audio.playOutcome(gameRef.current.monsterType === 3 ? "victory" : "loot");
  };

  const leaveLoot = () => {
    if (busy || actionBusyRef.current || gridRef.current.pendingLoot === null) return;
    const discarded = gridRef.current.pendingLoot;
    commit(gameRef.current, skipPracticeLoot(gridRef.current));
    setCue(null);
    setFeedback({ title: "Loot left behind", detail: `${practiceLootSummary(discarded)} discarded.`, tone: "neutral" });
    if (gameRef.current.monsterType === 3) audio.playOutcome("victory");
    else audio.playAction("click");
  };

  const enterRoom = (leaveFloorLoot = false) => {
    if (!leaveFloorLoot) {
      runLocalAction("encounter", enterNextRoom);
      return;
    }

    const before = gameRef.current;
    const beforeGrid = gridRef.current;
    if (busy || actionBusyRef.current || !before.active || before.monsterHp !== 0
      || beforeGrid.pendingLoot === null) return;
    actionBusyRef.current = true;
    try {
      const result = passPracticeLootAtDoor(before, beforeGrid, enterNextRoom);
      if (result === null) return;
      commit(result.game, result.grid);
      setStorageNotice((notice) => notice === "restored" ? null : notice);
      setCue(null);
      setCueId((id) => id + 1);
      setFeedback(result.entered
        ? {
            title: `Room ${practiceRoom(result.game)}`,
            detail: `${practiceLootSummary(result.discarded)} left behind. Walk toward the next enemy when ready.`,
            tone: "neutral",
          }
        : {
            title: "Loot left behind",
            detail: `${practiceLootSummary(result.discarded)} discarded. Choose what to do with the boss relic.`,
            tone: "neutral",
          });
      audio.playAction("click");
    } catch {
      actionFailed();
    } finally {
      queueMicrotask(() => { actionBusyRef.current = false; });
    }
  };

  const retryStorage = () => {
    const restored = inspectPracticeRun(() => window.localStorage);
    if (gameRef.current.hasStarted) {
      if (restored.status === "invalid" || restored.status === "unavailable") {
        setStorageNotice(restored.status);
        return;
      }
      // A session-only run must not silently replace another saved run.
      if (!canSaveRef.current && restored.status === "restored" && restored.game.hasStarted
        && JSON.stringify({ game: restored.game, grid: restored.grid }) !== savedGameRef.current) {
        setStorageNotice("conflict");
        return;
      }
      canSaveRef.current = true;
      setStorageNotice(null);
      persist(gameRef.current, gridRef.current);
    } else if (restored.status === "restored" || restored.status === "empty") {
      canSaveRef.current = true;
      if (restored.status === "restored") {
        savedGameRef.current = JSON.stringify({ game: restored.game, grid: restored.grid });
        gameRef.current = restored.game;
        gridRef.current = restored.grid;
        setGame(restored.game);
        setGrid(restored.grid);
      }
      setStorageNotice(restored.status === "restored" && restored.game.hasStarted ? "restored" : null);
    } else {
      setStorageNotice(restored.status);
    }
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(practiceShareText(gameRef.current));
      setShareNotice("Local result copied. Share it wherever you like.");
    } catch {
      setShareFallback(true);
      setShareNotice("Select and copy the result below. Clipboard access is unavailable.");
    }
  };

  const combatActions = (
<CombatActionDock
              busy={busy}
              hp={game.hp}
              maxHp={game.maxHp}
              enemyHp={game.monsterHp}
              enemyMaxHp={game.monsterMaxHp}
              lastExchange={game.lastPlayerDamage || game.lastMonsterDamage || game.lastCritical ? { dealt: game.lastPlayerDamage, taken: game.lastMonsterDamage, critical: game.lastCritical } : undefined}
              retaliation={`${incoming[0]}–${incoming[1]}`}
              stormDamage={`${stormDamage[0]}–${stormDamage[1]}`}
              attackDamage={`${attackDamage[0]}–${attackDamage[1]}`}
              criticalChance={currentCriticalChance(game)}
              potionLabel={`🧪 POTION · ${game.potions}/${MAX_POTIONS}`}
              potionDetail="Heal 25 HP · monster retaliates at half damage"
              potionUsage={<>{game.combatPotionsUsed}/{combatPotionLimit}<span className="block text-[9px] font-normal opacity-70">used</span></>}
              potionDisabled={busy || game.potions === 0 || game.hp >= game.maxHp || game.combatPotionsUsed >= combatPotionLimit}
              potionDisabledReason={game.potions === 0 ? "No potions left · restock at Kevin's" : null}
              potionLimitReached={game.combatPotionsUsed >= combatPotionLimit}
              relicName={relic.name}
              stormRelicSummary={stormRelicSummary}
              attackRelicSummary={attackRelicSummary}
              onStorm={() => runLocalAction("storm", stormAttack)}
              onPotion={() => runLocalAction("potion", usePotion)}
              onAttack={() => runLocalAction("attack", attack)}
            />
  );

  const clearedPersona = getMonsterPersona(game);
  const recoveryEnterAction = (
    <button type="button" data-keyboard-default="true" onClick={() => runLocalAction("encounter", enterNextRoom)} disabled={busy}>
      {room % 10 === 0 ? `ENTER BOSS ROOM ${room}` : `ENTER ROOM ${room}`}
    </button>
  );
  const recoveryHealAction = (
    <button type="button" onClick={() => runLocalAction("potion", usePotion)} disabled={roomHealDisabledReason !== null} title="Restore up to 25 HP. No enemy retaliation between rooms.">
      <span>USE OWN POTION SAFELY · {game.potions}/{MAX_POTIONS}</span>
      {roomHealDisabledReason && <small>{roomHealDisabledReason}</small>}
    </button>
  );
  const safePotion = phase === "loot" || phase === "recovery" ? {
    onUse: () => runLocalAction("potion", usePotion),
    disabledReason: roomHealDisabledReason,
    healAmount: 25,
  } : undefined;
  const recoveryShop = (
    <>
        {supplyAvailable(game) && !bossRewardActive && (
          <section data-keyboard-actions className="practice-kevin-shop mt-4 rounded-2xl border border-cyan-900 bg-gradient-to-b from-cyan-950/30 to-zinc-950 p-4">
            <p className="text-[10px] tracking-[0.25em] text-cyan-400">SUPPLY STOP · ROOM {game.roomsCleared}</p>
            <h2 className="mt-1 text-xl font-black">RESTOCK</h2>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <ShopButton
                label={"🩹 BANDAGE · " + (game.supplyBandageUsed ? "USED" : "1/1 LEFT")}
                detail="Restore 25 HP · one per stop"
                cost={supplies.bandage}
                onClick={() => runShopAction("supply-bandage")}
                disabledReason={supplyBandageDisabledReason}
              />
              <ShopButton
                label={"🧪 POTION · " + (SHOP_POTION_STOCK - game.supplyPotionsBought) + "/" + SHOP_POTION_STOCK + " LEFT"}
                detail="Add one potion"
                cost={supplies.potion}
                onClick={() => runShopAction("supply-potion")}
                disabledReason={supplyPotionDisabledReason}
              />
            </div>
          </section>
        )}

        {campAvailable(game) && !bossRewardActive && (
          <section data-keyboard-actions className="practice-kevin-shop mt-4 rounded-2xl border border-amber-800 bg-gradient-to-b from-amber-950/30 to-zinc-950 p-4">
            <p className="text-[10px] tracking-[0.25em] text-amber-400">CAMP BEFORE ROOM {room}</p>
            <h2 className="mt-1 text-xl font-black">PREPARE FOR MANAGEMENT</h2>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <ShopButton
                label={"🔥 REST · " + (game.campRestUsed ? "USED" : "1/1 LEFT")}
                detail="Restore 30 HP · once per camp"
                cost={camp.rest}
                onClick={() => runShopAction("camp-rest")}
                disabledReason={campRestDisabledReason}
              />
              <ShopButton
                label={"🧪 POTION · " + (SHOP_POTION_STOCK - game.campPotionsBought) + "/" + SHOP_POTION_STOCK + " LEFT"}
                detail="Add one potion"
                cost={camp.potion}
                onClick={() => runShopAction("camp-potion")}
                disabledReason={campPotionDisabledReason}
              />
              <ShopButton
                label="⚔️ WEAPON"
                detail="Permanent damage upgrade for this run"
                cost={camp.weapon}
                onClick={() => runShopAction("camp-weapon")}
                disabledReason={campWeaponDisabledReason}
              />
              <ShopButton
                label="🛡️ ARMOR"
                detail="Permanent damage reduction for this run"
                cost={camp.armor}
                onClick={() => runShopAction("camp-armor")}
                disabledReason={campArmorDisabledReason}
              />
            </div>
          </section>
        )}

    </>
  );
  const relicPanels = (
    <>
        {game.equippedRelic !== 0 && !bossRewardActive && (
          <section className={"mt-4 rounded-2xl border p-4 " + relic.borderClass + " " + relic.backgroundClass}>
            <div className="flex items-center gap-3">
              <RelicArtwork imageSrc={relic.imageSrc} name={relic.name} className="h-16 w-16" />
              <div>
                <p className={"text-[10px] font-black tracking-[0.22em] " + relic.accentClass}>
                  {relic.rarity.toUpperCase()} RELIC EQUIPPED
                </p>
                <h2 className={"mt-1 text-xl font-black " + relic.accentClass}>{relic.name}</h2>
              </div>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                <p className="text-[9px] font-black tracking-[0.18em] text-emerald-400">EFFECT</p>
                <p className="mt-1 text-xs text-zinc-200">{relic.effect}</p>
              </div>
              <div className="rounded-xl border border-red-900/70 bg-red-950/30 p-3">
                <p className="text-[9px] font-black tracking-[0.18em] text-red-400">COST / TRADEOFF</p>
                <p className="mt-1 text-xs font-bold text-red-200">{relic.tradeoff}</p>
              </div>
            </div>
          </section>
        )}

        {game.hasStarted && !bossRewardActive && (
          <RelicCollection
            idPrefix="practice"
            ownedRelics={game.ownedRelics}
            relicCounts={game.relicCounts}
            equippedRelic={game.equippedRelic}
            canChangeRelic={canChangeRelic}
            lockedLabel={game.active ? "BETWEEN ROOMS" : "RUN ENDED"}
            onSelectRelic={(relicId) => runRelicAction((current) => equipOwnedRelic(current, relicId))}
            className="mt-4"
          />
        )}

    </>
  );

  if (game.hasStarted && game.active) {
    const pendingLoot = grid.pendingLoot;
    const sceneLoot = pendingLoot ? {
      type: game.lastLootType,
      amount: game.lastLootAmount,
      gold: pendingLoot.gold,
      // The boss relic is a separate keep/equip decision after regular loot.
      relicId: 0,
    } : undefined;
    const notices = (
      <>
        {storageNotice && (
          <div className={`practice-storage-banner${storageNotice === "restored" ? " practice-restored-notice" : ""}`} role="status">
            {storageNotice === "restored" ? (
              <div className="flex items-center justify-between gap-2">
                <p>Local run restored · Room {practiceRoom(game)}</p>
                <button type="button" onClick={() => setStorageNotice(null)} aria-label="Dismiss restore notice" className="min-h-11 min-w-11 text-lg">×</button>
              </div>
            ) : (
              <>
                <p className="font-bold">{storageNotice === "unavailable" ? "Browser saving is unavailable" : "Saved run kept unchanged"}</p>
                <p>{storageNotice === "unavailable"
                  ? "You can keep playing this visit. Progress may be lost when you close or reload the page."
                  : storageNotice === "conflict"
                    ? "Another saved run may have changed in a different tab. Saving is paused to protect it. This visit can continue without saving."
                    : "The saved run could not be safely restored. Play without saving, retry, or explicitly replace the saved run."}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" onClick={retryStorage} disabled={busy} className="min-h-11 underline">Retry saving / restore</button>
                  {storageNotice !== "unavailable" && <button type="button" disabled={busy} onClick={() => setRestartRequested(true)} className="min-h-11 underline">Replace save & start new run</button>}
                </div>
              </>
            )}
          </div>
        )}
        {restartRequested && (
          <div className="practice-storage-banner" role="group" aria-label="Start a new run">
            <p className="font-bold">Start over? Your current local run will end.</p>
            <p>{storageNotice === "invalid" || storageNotice === "conflict" ? "This will also replace the saved run on this browser." : "Your new run starts in Room 1."}</p>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => setRestartRequested(false)} className="min-h-11 rounded-lg border border-zinc-600 px-4">Keep playing</button>
              <button type="button" onClick={() => restart(storageNotice === "invalid" || storageNotice === "conflict")} className="min-h-11 rounded-lg bg-orange-500 px-4 font-bold text-black">End run & restart</button>
            </div>
          </div>
        )}
      </>
    );
    const reward = bossRewardActive ? (
      <BossRelicReward
        idPrefix="practice"
        room={game.roomsCleared}
        hp={game.hp}
        maxHp={game.maxHp}
        gold={game.gold}
        ownedRelicCount={game.ownedRelics.length}
        totalRelicDrops={totalRelicDrops}
        awardedRelic={awardedRelic}
        awardedRelicCount={awardedRelicCount}
        currentRelic={game.equippedRelic === 0 ? null : relic}
        equipPreview={relicEquipPreview}
        busy={busy}
        onKeep={() => runRelicAction((current) => claimRelic(current, false))}
        onEquip={() => runRelicAction((current) => claimRelic(current, true))}
        containerRef={bossRewardRef}
        className="practice-boss-reward mx-auto max-w-5xl"
      />
    ) : undefined;

    return (
      <EndlessRoom
        key={grid.seed}
        mode="practice"
        view={{
          room: practiceRoom(game),
          seed: grid.seed,
          enemy: game.monsterType,
          enemyName: persona.name,
          enemyHp: game.monsterHp,
          hp: game.hp,
          relic: game.equippedRelic,
          weapon: game.weaponLevel,
          armor: game.armorLevel,
          phase,
          loot: sceneLoot,
          pending: busy,
          cue,
          cueId,
          damage: game.lastPlayerDamage,
          incoming: game.lastMonsterDamage,
        }}
        actions={{
          approach,
          enter: enterRoom,
          collect: collectLoot,
          skipLoot: leaveLoot,
          interact: () => audio.playAction("click"),
        }}
        enemyMaxHp={game.monsterMaxHp}
        maxHp={game.maxHp}
        gold={game.gold}
        potions={game.potions}
        roomTurns={grid.roomTurns}
        incoming={`${incoming[0]}–${incoming[1]}`}
        combatActions={combatActions}
        combatPotions={{ used: game.combatPotionsUsed, limit: combatPotionLimit }}
        healAction={phase === "loot" || phase === "recovery" ? recoveryHealAction : undefined}
        safePotion={safePotion}
        shop={merchantVisit && recoveryActive ? recoveryShop : undefined}
        relics={recoveryActive ? relicPanels : undefined}
        reward={reward}
        notices={storageNotice || restartRequested ? notices : undefined}
        menu={<button type="button" onClick={() => setRestartRequested(true)} disabled={busy}>Start a new run</button>}
        feedback={feedback ? { title: feedback.title, detail: feedback.detail } : undefined}
        log={game.log}
        sound={{ enabled: audio.enabled, available: audio.available, paused: audio.paused, toggleSound: audio.toggleSound }}
      />
    );
  }

  return (
    <main className={"practice-shell delveworn-practice-mode min-h-screen bg-[#090909] px-4 py-6 text-white lg:px-8 lg:py-8" + (game.hasStarted ? " practice-in-run" : "") + (bossRewardActive ? " practice-boss-focus" : "")}>
      <div className="practice-column mx-auto w-full max-w-md lg:max-w-6xl">
        <GameHeader mode="practice" eyebrow="LOCAL SANDBOX" subtitle={subtitle} meta="BROWSER-ONLY SIMULATION · NO WALLET · NO VRF · NO TRANSACTIONS">
          {game.hasStarted && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <button type="button" onClick={() => game.active ? setRestartRequested(true) : restart()} disabled={busy} className="text-[10px] text-zinc-500 underline transition hover:text-zinc-300 disabled:opacity-50">
                new run
              </button>
            </div>
          )}
        </GameHeader>

        {storageNotice && (
          <div className={`practice-storage-banner${storageNotice === "restored" ? " practice-restored-notice" : ""}`} role="status">
            {storageNotice === "restored" ? (
              <div className="flex items-center justify-between gap-2">
                <p>Local run restored · Room {practiceRoom(game)}</p>
                <button type="button" onClick={() => setStorageNotice(null)} aria-label="Dismiss restore notice" className="min-h-11 min-w-11 text-lg">×</button>
              </div>
            ) : (
              <>
                <p className="font-bold">{storageNotice === "unavailable" ? "Browser saving is unavailable" : "Saved run kept unchanged"}</p>
                <p>{storageNotice === "unavailable"
                  ? "You can keep playing this visit. Progress may be lost when you close or reload the page."
                  : storageNotice === "conflict"
                    ? "Another saved run may have changed in a different tab. Saving is paused to protect it. This visit can continue without saving."
                    : "The saved run could not be safely restored. Play without saving, retry, or explicitly replace the saved run."}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" onClick={retryStorage} disabled={busy} className="min-h-11 underline">Retry saving / restore</button>
                  {storageNotice !== "unavailable" && <button type="button" disabled={busy} onClick={() => game.hasStarted ? setRestartRequested(true) : restart(true)} className="min-h-11 underline">Replace save & start new run</button>}
                </div>
              </>
            )}
          </div>
        )}
        {restartRequested && (
          <div className="practice-storage-banner" role="group" aria-label="Start a new run">
            <p className="font-bold">Start over? Your current local run will end.</p>
            <p>{storageNotice === "invalid" || storageNotice === "conflict" ? "This will also replace the saved run on this browser." : "Your new run starts in Room 1."}</p>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => setRestartRequested(false)} className="min-h-11 rounded-lg border border-zinc-600 px-4">Keep playing</button>
              <button type="button" onClick={() => restart(storageNotice === "invalid" || storageNotice === "conflict")} className="min-h-11 rounded-lg bg-orange-500 px-4 font-bold text-black">End run & restart</button>
            </div>
          </div>
        )}

        <GameAutoScroll encounter={game.hasStarted && !bossRewardActive
          ? `${game.roomsCleared}:${endedActive ? "ended" : game.monsterHp > 0 ? "combat" : merchantVisit ?? "recovery"}`
          : null} />

        {game.hasStarted && (
          <GameHud
            hp={game.hp}
            maxHp={game.maxHp}
            potions={game.potions}
            maxPotions={MAX_POTIONS}
            gold={game.gold}
            weaponLevel={game.weaponLevel}
            weaponBonus={game.weaponLevel * 2}
            armorLevel={game.armorLevel}
            armorAbsorption={game.armorLevel}
            armorReductionPercent={50}
            room={practiceRoom(game)}
            roomAction={<button type="button" disabled={busy} onClick={() => game.active ? setRestartRequested(true) : restart()} aria-label="Start a new practice run" title="New run">↻</button>}
            combatPotions={game.active && game.monsterHp > 0 ? { used: game.combatPotionsUsed, limit: combatPotionLimit } : undefined}
          />
        )}

        <section tabIndex={-1} aria-label="Practice dungeon encounter" className={"practice-main-card relative mb-4 overflow-hidden rounded-2xl border " + (isBoss || bossRewardActive ? "border-purple-700 bg-gradient-to-b from-purple-950/50 to-zinc-950" : "border-zinc-800 bg-zinc-900")}>
          {game.hasStarted && <RoomProgressLine room={practiceRoom(game)} roomsCleared={game.roomsCleared} isBoss={isBoss} phase={!game.active ? "Run ended" : bossRewardActive ? "Boss defeated · relic reward" : merchantVisit ? merchantVisit === "camp" ? "Camp · prepare for the boss" : "Kevin's supply stop" : roomCleared ? "Loot collected" : "Combat"} />}
          {!game.hasStarted ? (
            <DungeonEntry
              mode="practice"
              eyebrow="PRACTICE MODE"
              description="Learn the dungeon, test builds and make terrible decisions instantly. This run never touches a chain."
            >
              <div className="practice-onboarding mt-5 grid gap-2 text-left text-sm">
                <p><strong>⚔️ Attack:</strong> steady damage, with a chance to hit critically.</p>
                <p><strong>⚡ Storm:</strong> a bigger gamble. It can deal zero damage.</p>
                <p><strong>🧪 Potion:</strong> heal 25 HP; a living enemy retaliates at half damage. Between rooms, healing is safe.</p>
              </div>
              <button type="button" data-keyboard-default="true" onClick={() => restart()} disabled={!practiceStorageReady} className="delveworn-primary-cta mt-7 w-full rounded-xl py-4 text-lg font-black transition disabled:opacity-50">
                {storageNotice === "invalid" || storageNotice === "conflict" ? "⚔️ START WITHOUT SAVING" : "⚔️ START LOCAL RUN"}
              </button>
              <p className="mt-4 text-xs text-zinc-400">Gold buys preparation. Every 10th room brings a boss and a relic with a tradeoff.</p>
            </DungeonEntry>
          ) : !game.active ? (
            <DungeonRunEnd
              data={{
                mode: "practice",
                roomsCleared: game.roomsCleared,
                gold: game.gold,
                weaponLevel: game.weaponLevel,
                armorLevel: game.armorLevel,
                bossesDefeated: Math.floor(game.roomsCleared / 10),
                relicName: relic.name,
                uniqueRelics: game.ownedRelics.length,
                totalRelicDrops,
              }}
              restartAction={<button type="button" data-keyboard-default="true" onClick={() => restart()}>BEGIN NEW RUN</button>}
              copyAction={<div className="run-result-share">
                <button type="button" onClick={() => void copyResult()}>COPY LOCAL RESULT</button>
                {shareNotice && <p className="mt-2 text-xs text-amber-200" role="status">{shareNotice}</p>}
                {shareFallback && <textarea aria-label="Local practice result to copy" readOnly value={practiceShareText(game)} onFocus={(event) => event.currentTarget.select()} className="mt-3 min-h-40 w-full rounded-lg border border-zinc-600 bg-black p-3 text-left text-xs" />}
              </div>}
              log={game.log}
              feedback={feedback ? `${feedback.title} · ${feedback.detail}` : undefined}
            />
          ) : bossRewardActive ? (
            <BossRelicReward
              idPrefix="practice"
              room={game.roomsCleared}
              hp={game.hp}
              maxHp={game.maxHp}
              gold={game.gold}
              ownedRelicCount={game.ownedRelics.length}
              totalRelicDrops={totalRelicDrops}
              awardedRelic={awardedRelic}
              awardedRelicCount={awardedRelicCount}
              currentRelic={game.equippedRelic === 0 ? null : relic}
              equipPreview={relicEquipPreview}
              busy={busy}
              onKeep={() => runRelicAction((current) => claimRelic(current, false))}
              onEquip={() => runRelicAction((current) => claimRelic(current, true))}
              containerRef={bossRewardRef}
              className="practice-boss-reward mx-auto max-w-5xl"
            />
          ) : recoveryActive ? (
            <DungeonRecovery
              room={game.roomsCleared}
              lootType={game.lastLootType}
              lootAmount={game.lastLootAmount}
              flavor={game.log.find(entry => entry.startsWith("☠️"))?.replace(/^☠️\s*/, "")}
              hp={game.hp}
              maxHp={game.maxHp}
              potions={game.potions}
              merchant={merchantVisit ? { name: MERCHANT_NAME, imageSrc: MERCHANT_IMAGE, kind: merchantVisit } : undefined}
              fallbackArt={{ imageSrc: clearedPersona.image, name: clearedPersona.name }}
              enterAction={recoveryEnterAction}
              healAction={recoveryHealAction}
              shop={merchantVisit ? recoveryShop : undefined}
              relics={relicPanels}
              activeRelic={relic.name}
              ownedRelicCount={game.ownedRelics.length}
              log={game.log}
              feedback={feedback?.title ?? "Gameplay action applied"}
            />
          ) : (
            <DungeonBattle
              enemy={{ name: persona.name, image: persona.image, hp: game.monsterHp, maxHp: game.monsterMaxHp, incoming: `${incoming[0]}–${incoming[1]}`, flavor: persona.flavor, isBoss }}
              log={game.log}
              logPreview={feedback ? `${feedback.title} · ${feedback.detail}` : undefined}
              actions={combatActions}
            />
          )}

        </section>

        {(game.hasStarted || feedback) && !recoveryActive && !endedActive && !(game.active && game.monsterHp > 0) && (
          <div className="practice-action-feedback" role="status" aria-live="polite" aria-atomic="true" data-tone={feedback?.tone ?? "neutral"}>
            <p className="font-bold">{feedback?.title ?? (roomCleared ? "Safe between rooms" : "Choose your next move")}</p>
            <p className="mt-1 text-xs">{feedback?.detail ?? (roomCleared ? `Loot collected · ${practiceLoot(game)}. Heal or adjust relics before you enter.` : "Attack is steady. Storm may roll zero. Potions reduce retaliation to half.")}</p>
          </div>
        )}

        {!recoveryActive && !endedActive && relicPanels}

        {game.hasStarted && !recoveryActive && !endedActive && !(game.active && game.monsterHp > 0) && (
          <DungeonLog
            entries={game.log}
            mobileOpen={mobileLogOpen}
            onToggle={() => setMobileLogOpen((open) => !open)}
          />
        )}

        {!recoveryActive && !endedActive && <div className="practice-run-summary mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-[10px] text-zinc-500">ROOMS</p>
            <p className="text-xl font-black">{game.roomsCleared}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-[10px] text-zinc-500">RELIC</p>
            <p className={"mt-1 text-sm font-black " + relic.accentClass}>{relic.name}</p>
          </div>
        </div>}

        <footer className="practice-footer pb-24 pt-6 text-center">
          <p className="text-[10px] text-zinc-700">PRACTICE · LOCAL WEB CRYPTO · NO WALLET · NO VRF</p>
          <p className="mt-1 text-[10px] text-zinc-800">Practice progress stays on this device and has no onchain value</p>
        </footer>
      </div>
    </main>
  );
}

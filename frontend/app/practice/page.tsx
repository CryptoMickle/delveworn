"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  BossRelicReward,
  CombatActionDock,
  DungeonEntry,
  DungeonLog,
  GameHeader,
  GameHud,
  GoldAmount,
  RelicArtwork,
  RelicCollection,
  RoomProgressLine,
  SmallStat,
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
import { loadPracticeRun, savePracticeRun } from "./storage";

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

type LocalAction = "attack" | "storm" | "potion" | "encounter";

const LOCAL_ACTION_COPY: Record<LocalAction, { icon: string; title: string; text: string }> = {
  attack: { icon: "⚔️", title: "ROLLING ATTACK", text: "Resolving DAMAGE, critical chance and retaliation locally..." },
  storm: { icon: "⚡", title: "UNLEASHING STORM", text: "Rolling high-variance DAMAGE locally..." },
  potion: { icon: "🧪", title: "DRINKING SUSPICIOUS LIQUID", text: "Resolving healing and retaliation locally..." },
  encounter: { icon: "🚪", title: "ROLLING ENCOUNTER", text: "Selecting your next problem locally..." },
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
  const room = game.roomsCleared + 1;
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
  const [practiceStorageReady, setPracticeStorageReady] = useState(false);
  const [rolling, setRolling] = useState<LocalAction | null>(null);
  const [mobileLogOpen, setMobileLogOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const bossRewardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const restored = loadPracticeRun(window.localStorage);
      if (restored) setGame(restored);
      setPracticeStorageReady(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!practiceStorageReady) return;
    savePracticeRun(window.localStorage, game);
  }, [game, practiceStorageReady]);

  const busy = rolling !== null;
  const room = game.roomsCleared + 1;
  const roomCleared = game.hasStarted && game.monsterHp === 0;
  const isBoss = game.monsterType === 3 && game.monsterHp > 0;
  const persona = getMonsterPersona(game);
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
  const bossRewardActive = roomCleared && game.relicOfferAvailable;
  const relicEquipPreview = describeRelicEquipImpact({
    currentMaxHp: game.maxHp,
    baseMaxHp: game.baseMaxHp,
    relicId: awardedRelic.id,
  });

  useEffect(() => {
    if (!bossRewardActive) return;

    const frame = window.requestAnimationFrame(() => {
      bossRewardRef.current?.focus({ preventScroll: true });
      bossRewardRef.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [bossRewardActive]);

  const canChangeRelic = game.active && roomCleared && !busy;
  const roomHealDisabledReason = busy
    ? "Another action is resolving."
    : game.potions === 0
      ? "No potions available."
      : game.hp >= game.maxHp
        ? "HP is already full."
        : null;
  const supplyBandageDisabledReason = busy
    ? "Another action is resolving."
    : game.supplyBandageUsed
      ? "Already used at this stop."
      : game.hp >= game.maxHp
        ? "HP is already full."
        : game.gold < supplies.bandage
          ? "Not enough gold."
          : null;
  const supplyPotionDisabledReason = busy
    ? "Another action is resolving."
    : game.supplyPotionsBought >= SHOP_POTION_STOCK
      ? "Sold out at this stop."
      : game.potions >= MAX_POTIONS
        ? "Potion inventory is full."
        : game.gold < supplies.potion
          ? "Not enough gold."
          : null;
  const campRestDisabledReason = busy
    ? "Another action is resolving."
    : game.campRestUsed
      ? "Already used at this camp."
      : game.hp >= game.maxHp
        ? "HP is already full."
        : game.gold < camp.rest
          ? "Not enough gold."
          : null;
  const campPotionDisabledReason = busy
    ? "Another action is resolving."
    : game.campPotionsBought >= SHOP_POTION_STOCK
      ? "Sold out at this camp."
      : game.potions >= MAX_POTIONS
        ? "Potion inventory is full."
        : game.gold < camp.potion
          ? "Not enough gold."
          : null;
  const campWeaponDisabledReason = busy
    ? "Another action is resolving."
    : game.gold < camp.weapon
      ? "Not enough gold."
      : null;
  const campArmorDisabledReason = busy
    ? "Another action is resolving."
    : game.gold < camp.armor
      ? "Not enough gold."
      : null;
  const monsterHpPercent = game.monsterMaxHp > 0
    ? Math.max(0, Math.min(100, (game.monsterHp / game.monsterMaxHp) * 100))
    : 0;

  let subtitle = "Enter the dungeon";
  if (game.hasStarted && !game.active) subtitle = "Your run has ended";
  else if (bossRewardActive) subtitle = "Boss defeated · relic awarded";
  else if (roomCleared) subtitle = "Room " + game.roomsCleared + " cleared";
  else if (isBoss) subtitle = "Room " + room + " · BOSS";
  else if (game.hasStarted) subtitle = "Room " + room;

  const restart = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setRolling(null);
    setMobileLogOpen(false);
    setGame(startRun());
  };

  const runLocalAction = (
    kind: LocalAction,
    action: (current: PracticeGame) => PracticeGame
  ) => {
    if (busy) return;
    setRolling(kind);
    timerRef.current = window.setTimeout(() => {
      setGame(action);
      setRolling(null);
      timerRef.current = null;
    }, 280);
  };

  const runShopAction = (action: ShopAction) => {
    if (busy) return;
    setGame((current) => buy(current, action));
  };

  const rollingCopy = rolling ? LOCAL_ACTION_COPY[rolling] : null;

  return (
    <main className={"practice-shell delveworn-practice-mode min-h-screen bg-[#090909] px-4 py-6 text-white lg:px-8 lg:py-8" + (game.hasStarted ? " practice-in-run" : "") + (bossRewardActive ? " practice-boss-focus" : "")}>
      <div className="practice-column mx-auto w-full max-w-md lg:max-w-6xl">
        <GameHeader mode="practice" eyebrow="LOCAL SANDBOX" subtitle={subtitle} meta="BROWSER-ONLY SIMULATION · NO WALLET · NO VRF · NO TRANSACTIONS">
          {game.hasStarted && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <button type="button" onClick={restart} className="text-[10px] text-zinc-500 underline transition hover:text-zinc-300">
                new run
              </button>
            </div>
          )}
        </GameHeader>

        {game.hasStarted && game.active && (
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
            room={bossRewardActive ? game.roomsCleared : room}
            roomAction={<button type="button" onClick={restart} aria-label="Start a new practice run" title="New run">↻</button>}
            combatPotions={game.monsterHp > 0 ? { used: game.combatPotionsUsed, limit: combatPotionLimit } : undefined}
          />
        )}

        <section className={"practice-main-card relative mb-4 overflow-hidden rounded-2xl border " + (isBoss || bossRewardActive ? "border-purple-700 bg-gradient-to-b from-purple-950/50 to-zinc-950" : "border-zinc-800 bg-zinc-900")}>
          {!game.hasStarted ? (
            <DungeonEntry
              mode="practice"
              eyebrow="PRACTICE MODE"
              description="Learn the dungeon, test builds and make terrible decisions instantly. This run never touches a chain."
            >
              <button type="button" onClick={restart} className="delveworn-primary-cta mt-7 w-full rounded-xl py-4 text-lg font-black transition">
                ⚔️ START LOCAL RUN
              </button>
              <p className="mt-4 text-[10px] text-zinc-600">Instant local actions · no signature · no transaction</p>
            </DungeonEntry>
          ) : !game.active ? (
            <div className="practice-result-view mx-auto flex min-h-[430px] w-full max-w-xl flex-col items-center justify-center p-7 text-center">
              <div className="text-7xl">💀</div>
              <h2 className="mt-5 text-3xl font-black">RUN ENDED</h2>
              <p className="mt-3 text-zinc-400">The dungeon claims you after {game.roomsCleared} cleared rooms.</p>
              <button type="button" onClick={restart} className="mt-7 w-full rounded-xl bg-orange-500 py-4 text-lg font-black text-black transition hover:bg-orange-400">
                TRY AGAIN
              </button>
            </div>
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
              onKeep={() => setGame((current) => claimRelic(current, false))}
              onEquip={() => setGame((current) => claimRelic(current, true))}
              containerRef={bossRewardRef}
              className="practice-boss-reward mx-auto max-w-5xl"
            />
          ) : merchantVisit ? (
            <div className="practice-merchant-card min-h-[540px] lg:grid lg:min-h-[440px] lg:grid-cols-[3fr_2fr]">
              <div className="practice-merchant-stage relative h-[300px] w-full min-w-0 overflow-hidden bg-gradient-to-b from-amber-950/10 to-black lg:h-full lg:min-h-[440px] lg:border-r lg:border-zinc-800">
                <Image
                  src={MERCHANT_IMAGE}
                  alt={MERCHANT_NAME}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 640px, 448px"
                  className="object-contain drop-shadow-2xl"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent" />
              </div>
              <div className="practice-merchant-info min-w-0 p-6 pt-1 text-center lg:flex lg:flex-col lg:justify-center lg:p-8 lg:text-left">
                <p className={(merchantVisit === "camp" ? "text-xs tracking-[0.25em] text-amber-400" : "text-xs tracking-[0.25em] text-cyan-400") + " practice-merchant-kicker"}>
                  {merchantVisit === "camp" ? "⛺ BOSS CAMP" : "🧰 SUPPLY STOP"}
                </p>
                <h2 className="practice-merchant-title mt-2 text-3xl font-black">{MERCHANT_NAME}</h2>
                <p className="practice-merchant-role mt-1 text-xs text-zinc-500">
                  Traveling Merchant{merchantVisit === "camp" ? " · Questionable Procurement" : ""}
                </p>
                <p className="practice-merchant-flavor mt-3 italic text-zinc-300">
                  {merchantVisit === "camp"
                    ? "“Management upstairs is furious. Can I interest you in armor?”"
                    : "“You look terrible. Fortunately, I accept gold.”"}
                </p>
                <div className="practice-merchant-stats mt-6 grid grid-cols-2 gap-3">
                  <SmallStat label="HEALTH" value={"❤️ " + game.hp + "/" + game.maxHp} />
                  <SmallStat label="GOLD" value={<GoldAmount amount={game.gold} />} />
                  <SmallStat label="POTIONS" value={"🧪 " + game.potions + "/" + MAX_POTIONS} />
                  <SmallStat
                    label="POTION STOCK"
                    value={"📦 " + (SHOP_POTION_STOCK - (merchantVisit === "camp" ? game.campPotionsBought : game.supplyPotionsBought)) + "/" + SHOP_POTION_STOCK}
                  />
                </div>
              </div>
            </div>
          ) : roomCleared ? (
            <div className="practice-result-view mx-auto flex min-h-[390px] w-full max-w-xl flex-col items-center justify-center p-7 text-center">
              <div className="text-7xl">{game.roomsCleared % 10 === 0 ? "👑" : "🏆"}</div>
              <p className="mt-4 text-xs tracking-[0.25em] text-orange-400">ROOM {game.roomsCleared}</p>
              <h2 className="mt-2 text-3xl font-black">{game.roomsCleared % 10 === 0 ? "MANAGEMENT DEFEATED" : "ROOM CLEARED"}</h2>
              <p className="mt-3 text-zinc-400">Against all available evidence, you remain alive.</p>
              <div className="mt-6 w-full rounded-xl border border-zinc-800 bg-black/40 p-4">
                <p className="text-[10px] text-zinc-500">NEXT</p>
                <p className="mt-1 font-bold">🎲 Room {room}</p>
              </div>
            </div>
          ) : (
            <div>
              <RoomProgressLine room={room} isBoss={isBoss} />
              <div className="practice-combat-card min-h-[610px] lg:grid lg:min-h-[480px] lg:grid-cols-[3fr_2fr]">
              <div className="practice-monster-stage relative h-[355px] w-full min-w-0 overflow-hidden bg-gradient-to-b from-black/20 to-black/70 lg:h-full lg:min-h-[480px] lg:border-r lg:border-zinc-800">
                <Image
                  src={persona.image}
                  alt={persona.name}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 640px, 448px"
                  className={isBoss ? "object-contain scale-105 drop-shadow-2xl" : "object-contain drop-shadow-2xl"}
                  priority
                />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-zinc-950 to-transparent" />
              </div>
              <div className="practice-monster-info min-w-0 p-5 pt-1 lg:flex lg:flex-col lg:justify-center lg:p-8">
                {isBoss && <p className="text-xs font-bold tracking-[0.3em] text-purple-400">👑 BOSS ENCOUNTER</p>}
                <div className="practice-monster-heading mt-2 flex items-start justify-between gap-4">
                  <div>
                    <h2 className={isBoss ? "text-3xl font-black text-purple-200" : "text-3xl font-black"}>{persona.name}</h2>
                    <p className={isBoss ? "mt-1 text-xs font-bold uppercase tracking-wider text-purple-400" : "mt-1 text-xs text-zinc-500"}>
                      {isBoss ? persona.rank : persona.species}
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-700 bg-black/50 px-2 py-1 text-[10px] text-zinc-400">{persona.chance}</span>
                </div>
                <p className="practice-monster-flavor mt-3 text-sm italic text-zinc-400">“{persona.flavor}”</p>
                <div className="practice-enemy-hp-label mb-2 mt-5 flex justify-between">
                  <span className="text-xs text-zinc-500">ENEMY HP</span>
                  <span className="font-black">{game.monsterHp} / {game.monsterMaxHp}</span>
                </div>
                <div className="practice-enemy-bar h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className={isBoss ? "h-3 rounded-full bg-purple-500 transition-all duration-150" : "h-3 rounded-full bg-red-500 transition-all duration-150"} style={{ width: monsterHpPercent + "%" }} />
                </div>
                <div className="practice-enemy-stats mt-4 grid grid-cols-2 gap-3">
                  <SmallStat label="ENEMY DAMAGE" value={"💥 " + incoming[0] + "–" + incoming[1]} />
                  <SmallStat label="CRITICAL CHANCE" value={"⚔️ " + currentCriticalChance(game) + "%"} />
                </div>
              </div>
              </div>
            </div>
          )}

          {rollingCopy && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
              <div className="max-w-xs text-center">
                <div className="animate-pulse text-7xl">{rollingCopy.icon}</div>
                <p className="mt-5 text-[10px] tracking-[0.35em] text-orange-400">LOCAL ROLL · NO VRF</p>
                <h2 className="mt-2 text-2xl font-black">{rollingCopy.title}</h2>
                <p className="mt-3 text-sm text-zinc-400">{rollingCopy.text}</p>
                <div className="mt-5 flex justify-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400 [animation-delay:100ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400 [animation-delay:200ms]" />
                </div>
              </div>
            </div>
          )}
        </section>

        {game.active && !bossRewardActive && (
          roomCleared ? (
            <div className="practice-action-dock practice-between-actions lg:grid lg:grid-cols-2 lg:gap-3">
              <button
                type="button"
                onClick={() => runLocalAction("potion", usePotion)}
                disabled={roomHealDisabledReason !== null}
                className="mb-3 w-full rounded-xl border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50 to-emerald-200 p-3 text-center text-emerald-950 transition hover:from-white hover:to-emerald-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-none disabled:bg-zinc-950 disabled:text-zinc-600 disabled:opacity-70 lg:mb-0"
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="font-black">🧪 HEAL +25 HP</span>
                  <span className="text-xs font-bold">{game.potions}/{MAX_POTIONS}</span>
                </div>
                <p className={roomHealDisabledReason ? "mt-1 text-[10px] font-bold text-red-400" : "mt-1 text-[10px] text-emerald-800"}>
                  {roomHealDisabledReason ?? "Use one potion outside combat."}
                </p>
              </button>
              <button type="button" onClick={() => runLocalAction("encounter", enterNextRoom)} disabled={busy} className="w-full rounded-xl bg-orange-500 py-4 text-lg font-black text-black transition hover:bg-orange-400 disabled:opacity-50">
                🎲 NEXT ROOM
              </button>
            </div>
          ) : (
            <CombatActionDock
              busy={busy}
              stormDamage={`${stormDamage[0]}–${stormDamage[1]}`}
              attackDamage={`${attackDamage[0]}–${attackDamage[1]}`}
              criticalChance={currentCriticalChance(game)}
              potionLabel={`🧪 POTION · ${game.potions}/${MAX_POTIONS}`}
              potionDetail="Heal 25 HP · monster retaliates at half damage"
              potionUsage={<>{game.combatPotionsUsed}/{combatPotionLimit}<span className="block text-[9px] font-normal opacity-70">used</span></>}
              potionDisabled={busy || game.potions === 0 || game.hp >= game.maxHp || game.combatPotionsUsed >= combatPotionLimit}
              potionLimitReached={game.combatPotionsUsed >= combatPotionLimit}
              relicName={relic.name}
              stormRelicSummary={stormRelicSummary}
              attackRelicSummary={attackRelicSummary}
              onStorm={() => runLocalAction("storm", stormAttack)}
              onPotion={() => runLocalAction("potion", usePotion)}
              onAttack={() => runLocalAction("attack", attack)}
            />
          )
        )}

        {supplyAvailable(game) && !bossRewardActive && (
          <section className="practice-kevin-shop mt-4 rounded-2xl border border-cyan-900 bg-gradient-to-b from-cyan-950/30 to-zinc-950 p-4">
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
          <section className="practice-kevin-shop mt-4 rounded-2xl border border-amber-800 bg-gradient-to-b from-amber-950/30 to-zinc-950 p-4">
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
            onSelectRelic={(relicId) =>
              setGame((current) => equipOwnedRelic(current, relicId))
            }
            className="mt-4"
          />
        )}

        {game.hasStarted && (
          <DungeonLog
            entries={game.log}
            mobileOpen={mobileLogOpen}
            onToggle={() => setMobileLogOpen((open) => !open)}
          />
        )}

        <div className="practice-run-summary mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-[10px] text-zinc-500">ROOMS</p>
            <p className="text-xl font-black">{game.roomsCleared}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-[10px] text-zinc-500">RELIC</p>
            <p className={"mt-1 text-sm font-black " + relic.accentClass}>{relic.name}</p>
          </div>
        </div>

        <footer className="practice-footer pb-24 pt-6 text-center">
          <p className="text-[10px] text-zinc-700">PRACTICE · LOCAL WEB CRYPTO · NO WALLET · NO VRF</p>
          <p className="mt-1 text-[10px] text-zinc-800">Practice progress stays on this device and has no onchain value</p>
        </footer>
      </div>
    </main>
  );
}

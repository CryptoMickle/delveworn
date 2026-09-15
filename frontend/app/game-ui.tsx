"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { getRelicDefinition, type RelicDefinition } from "./relics";
import { useGameAudio } from "./use-game-audio";
import { GameLogo } from "./game-logo";
import { DesktopNavigation, KeyboardHint } from "./desktop-navigation";

export type DelvewornMode = "practice" | "challenge" | "onchain";

export function SmallStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="practice-small-stat rounded-xl border border-zinc-800 bg-black/40 p-3 text-center">
      <p className="text-[10px] tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

export function GoldIcon() {
  return <span className="gold-icon" aria-hidden="true" />;
}

export function GoldAmount({
  amount,
  className = "",
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span className={`gold-amount inline-flex items-center gap-1.5 ${className}`}>
      <GoldIcon />
      <span>{amount}</span>
    </span>
  );
}

export function RoomProgressLine({
  room,
  isBoss = false,
  roomsCleared = room - 1,
  phase,
}: {
  room: number;
  isBoss?: boolean;
  roomsCleared?: number;
  phase?: string;
}) {
  const safeRoom = Math.max(1, Math.floor(room));
  const roomInBossCycle = ((safeRoom - 1) % 10) + 1;
  const cycleStart = safeRoom - roomInBossCycle;
  const roomIsCleared = safeRoom <= roomsCleared;

  return (
    <div className="practice-room-progress border-b border-zinc-800 bg-[#101012] px-3 py-3">
      <div className="practice-room-caption">
        <strong>ROOM {safeRoom}{roomIsCleared ? " · CLEARED" : isBoss ? " · BOSS" : ""}</strong>
        <span title={phase}>{phase ?? (roomIsCleared ? "Catch your breath" : `Boss in room ${cycleStart + 10}`)}</span>
      </div>
      <ol
        className="practice-room-map flex w-full items-center justify-between gap-1.5 rounded-full border border-zinc-600/70 bg-zinc-950 p-1.5"
        aria-label={`Dungeon progress: room ${safeRoom}${roomIsCleared ? ", cleared" : ""}, boss in room ${cycleStart + 10}`}
      >
        {Array.from({ length: 10 }, (_, index) => {
          const step = index + 1;
          const absoluteRoom = cycleStart + step;
          const isDone = absoluteRoom <= roomsCleared;
          const isActive = step === roomInBossCycle && !isDone;
          const stateClass = isDone
            ? "bg-emerald-800 text-emerald-100"
            : isActive
              ? isBoss
                ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.6)]"
                : "bg-orange-500 text-zinc-950 shadow-[0_0_14px_rgba(249,115,22,0.55)]"
              : "bg-zinc-800 text-zinc-500";

          return (
            <li
              key={step}
              aria-current={isActive ? "step" : undefined}
              aria-label={`${step === 10 ? "Boss room" : "Room"} ${absoluteRoom}${isDone ? ", cleared" : isActive ? ", current" : ""}`}
              className={`practice-room-node grid h-6 w-6 place-items-center rounded-full text-[8px] font-black ${stateClass}`}
            >
              <span aria-hidden="true">{step === 10 ? "◆" : step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RelicArtwork({
  imageSrc,
  name,
  className = "h-16 w-16",
}: {
  imageSrc: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/45 shadow-lg ${className}`}>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={`${name} relic`}
          fill
          sizes="144px"
          className="object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-2xl text-zinc-600" aria-hidden="true">◇</div>
      )}
    </div>
  );
}

export function RelicCollection({
  idPrefix,
  ownedRelics,
  relicCounts,
  equippedRelic,
  canChangeRelic,
  dataAvailable = true,
  lockedLabel = "BETWEEN ROOMS",
  onSelectRelic,
  className = "",
}: {
  idPrefix: string;
  ownedRelics: readonly number[];
  relicCounts: readonly number[];
  equippedRelic: number;
  canChangeRelic: boolean;
  dataAvailable?: boolean;
  lockedLabel?: string;
  onSelectRelic: (relicId: number) => void;
  className?: string;
}) {
  const titleId = `${idPrefix}-relic-collection-title`;
  const totalRelicDrops = relicCounts.reduce(
    (total, count) => total + count,
    0
  );

  return (
    <section
      data-keyboard-actions
      aria-labelledby={titleId}
      className={`relic-collection rounded-2xl border border-zinc-700 bg-zinc-950 p-4 ${className}`}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.25em] text-orange-400">
            RELIC INVENTORY · {ownedRelics.length}/15 UNIQUE · {totalRelicDrops}{" "}
            {totalRelicDrops === 1 ? "DROP" : "DROPS"}
          </p>
          <h2 id={titleId} className="mt-1 text-xl font-black">
            RELIC LOADOUT
          </h2>
        </div>
        <p className="max-w-52 text-right text-[10px] text-zinc-500">
          Switch or unequip between rooms.
        </p>
      </div>

      {!dataAvailable && (
        <div className="mt-3 rounded-xl border border-amber-800/70 bg-amber-950/25 px-3 py-2 text-left">
          <p className="text-[10px] font-bold text-amber-200">
            Collection data is temporarily unavailable. Onchain state will retry automatically on the next sync.
          </p>
        </div>
      )}

      {ownedRelics.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-700 bg-black/25 p-4 text-center">
          <p className="text-sm font-black text-zinc-300">
            {dataAvailable ? "NO RELICS COLLECTED" : "RELIC INVENTORY SYNCING"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {dataAvailable
              ? "Defeat the boss in Room 10 to add the first relic to this run."
              : "No collection data is shown until the next successful V3 snapshot."}
          </p>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {[0, ...ownedRelics].map((relicId) => {
            const ownedRelic = getRelicDefinition(relicId);
            const activeRelic = relicId === equippedRelic;
            const actionLabel = activeRelic
              ? "ACTIVE"
              : canChangeRelic
                ? relicId === 0
                  ? "UNEQUIP"
                  : "EQUIP"
                : dataAvailable
                  ? lockedLabel
                  : "SYNCING";

            return (
              <button
                key={relicId}
                type="button"
                onClick={() => onSelectRelic(relicId)}
                disabled={!dataAvailable || !canChangeRelic || activeRelic}
                aria-pressed={activeRelic}
                className={`rounded-xl border p-3 text-left transition hover:brightness-125 disabled:cursor-not-allowed ${ownedRelic.borderClass} ${ownedRelic.backgroundClass}${activeRelic ? " ring-2 ring-orange-400" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <RelicArtwork
                    imageSrc={ownedRelic.imageSrc}
                    name={ownedRelic.name}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={`font-black ${ownedRelic.accentClass}`}>
                        {ownedRelic.name}
                        {relicId !== 0 && (
                          <span className="ml-1 text-xs text-zinc-400">
                            ×{relicCounts[relicId] ?? 1}
                          </span>
                        )}
                      </p>
                      <span
                        className={
                          activeRelic
                            ? "text-[9px] font-black text-orange-400"
                            : "text-[9px] font-bold text-zinc-500"
                        }
                      >
                        {actionLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-400">
                      {ownedRelic.effect}
                    </p>
                    {relicId !== 0 && (
                      <p className="mt-2 text-[10px] font-bold text-red-300">
                        Tradeoff: {ownedRelic.tradeoff}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[10px] text-zinc-600">
        Duplicate effects do not stack. Revive use and permanent max-HP costs remain spent for the full run.
      </p>
    </section>
  );
}

function BossRelicCard({
  relic,
  label,
  badge,
  equipPreview,
}: {
  relic: RelicDefinition;
  label: string;
  badge: string;
  equipPreview?: string;
}) {
  return (
    <div className={`boss-relic-card rounded-2xl border p-5 text-center ${relic.borderClass} ${relic.backgroundClass}`}>
      <RelicArtwork
        imageSrc={relic.imageSrc}
        name={relic.name}
        className="boss-relic-artwork mx-auto mb-4 h-28 w-28 sm:h-32 sm:w-32"
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className={`rounded-full border border-current/30 bg-black/35 px-3 py-1 text-[9px] font-black tracking-[0.18em] ${relic.accentClass}`}>
          {relic.rarity.toUpperCase()}
        </span>
        <span className="rounded-full border border-zinc-700 bg-black/35 px-3 py-1 text-[9px] font-black tracking-[0.14em] text-zinc-300">
          {badge}
        </span>
      </div>
      <p className="mt-3 text-[9px] font-black tracking-[0.2em] text-zinc-500">{label}</p>
      <h3 className={`mt-1 text-2xl font-black ${relic.accentClass}`}>{relic.name}</h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-200">{relic.effect}</p>
      <div className="mt-4 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2.5 text-center">
        <p className="text-[9px] font-black tracking-[0.18em] text-red-400">COST / TRADEOFF</p>
        <p className="mt-1 text-xs font-bold text-red-200">{relic.tradeoff}</p>
      </div>
      {equipPreview && (
        <div className="mt-3 rounded-lg border border-violet-700/60 bg-violet-950/30 px-3 py-2.5 text-center">
          <p className="text-[9px] font-black tracking-[0.18em] text-violet-400">EQUIP PREVIEW</p>
          <p className="mt-1 text-xs font-bold text-violet-100">{equipPreview}</p>
        </div>
      )}
    </div>
  );
}

export function BossRelicReward({
  idPrefix,
  room,
  hp,
  maxHp,
  gold,
  ownedRelicCount,
  totalRelicDrops,
  awardedRelic,
  awardedRelicCount,
  currentRelic,
  equipPreview,
  busy,
  onKeep,
  onEquip,
  containerRef,
  className = "",
}: {
  idPrefix: string;
  room: number;
  hp: number;
  maxHp: number;
  gold: number;
  ownedRelicCount: number;
  totalRelicDrops: number;
  awardedRelic: RelicDefinition;
  awardedRelicCount: number;
  currentRelic?: RelicDefinition | null;
  equipPreview: string;
  busy: boolean;
  onKeep: () => void;
  onEquip: () => void;
  containerRef?: Ref<HTMLDivElement>;
  className?: string;
}) {
  const titleId = `${idPrefix}-boss-reward-title`;
  const hasCurrentRelic = Boolean(currentRelic && currentRelic.id !== 0);
  const projectedUniqueRelics = ownedRelicCount + (awardedRelicCount === 0 ? 1 : 0);
  const projectedTotalDrops = totalRelicDrops + 1;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      data-keyboard-action-scope
      className={`boss-reward-view flex min-h-[520px] w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(126,34,206,0.28),transparent_48%)] p-5 text-center outline-none lg:p-8 ${className}`}
    >
      <div className="practice-boss-reward-status grid grid-cols-3 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/75 backdrop-blur-xl">
        <div>
          <span>HEALTH</span>
          <strong>❤️ {hp}/{maxHp}</strong>
        </div>
        <div>
          <span>GOLD</span>
          <strong><GoldAmount amount={gold} /></strong>
        </div>
        <div>
          <span>RELICS</span>
          <strong>{projectedUniqueRelics}/15 · ×{projectedTotalDrops}</strong>
        </div>
      </div>

      <div className="practice-boss-reward-icon mt-6 text-6xl" aria-hidden="true">👑</div>
      <p className="mt-3 text-[10px] font-black tracking-[0.28em] text-violet-400">
        BOSS DEFEATED · ROOM {room}
      </p>
      <h2 id={titleId} className="boss-reward-title mt-2 text-3xl font-black text-violet-100">
        MANAGEMENT DEFEATED
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">
        The boss dropped one random {awardedRelic.rarity.toLowerCase()} relic. Duplicates increase its counter, but effects never stack.
      </p>

      <div className={`boss-relic-comparison mt-5 grid w-full gap-4 ${hasCurrentRelic ? "max-w-4xl lg:grid-cols-2" : "max-w-2xl"}`}>
        {hasCurrentRelic && currentRelic && (
          <BossRelicCard
            relic={currentRelic}
            label="CURRENTLY EQUIPPED"
            badge="ACTIVE"
          />
        )}
        <BossRelicCard
          relic={awardedRelic}
          label="RANDOM BOSS DROP"
          badge={awardedRelicCount > 0 ? `DUPLICATE ×${awardedRelicCount + 1}` : "NEW RELIC"}
          equipPreview={equipPreview}
        />
      </div>

      <div data-keyboard-actions data-keyboard-vertical="edges" className="practice-boss-relic-actions mt-4 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onKeep}
          data-keyboard-default="true"
          disabled={busy}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-40"
        >
          {hasCurrentRelic ? "KEEP CURRENT RELIC" : "KEEP NO RELIC"}
        </button>
        <button
          type="button"
          onClick={onEquip}
          disabled={busy}
          className="rounded-xl border border-violet-400 bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          EQUIP {awardedRelic.name.toUpperCase()}
        </button>
      </div>
      <p className="mt-3 text-[10px] text-zinc-500">
        The relic joins your collection after either choice. Only one relic effect can be active at a time.
      </p>
    </div>
  );
}

export function GameHeader({
  mode,
  eyebrow,
  title,
  subtitle,
  meta,
  children,
}: {
  mode: DelvewornMode;
  eyebrow: string;
  title?: string;
  subtitle: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  const audio = useGameAudio();
  const soundLabel = !audio.available ? "Sound unavailable" : audio.enabled && audio.paused ? "Resume sound" : audio.enabled ? "Mute sound" : "Enable sound";

  return (
    <header className={`practice-header delveworn-mode-${mode} mb-5 text-center lg:mb-7`}>
      <DesktopNavigation />
      <div className="delveworn-navigation">
        <nav aria-label="Game modes" className="delveworn-modes">
          <Link href="/practice" aria-current={mode === "practice" ? "page" : undefined}>Practice</Link>
          <Link href="/challenge" aria-current={mode === "challenge" ? "page" : undefined}>Weekly</Link>
          <Link href="/onchain" aria-current={mode === "onchain" ? "page" : undefined}>Onchain</Link>
        </nav>
        <GameLogo compact />
        <button type="button" className="delveworn-sound" onClick={audio.toggleSound} aria-pressed={audio.enabled} aria-label={soundLabel} disabled={!audio.available}>
          {!audio.available ? "Sound unavailable" : audio.enabled && audio.paused ? "Resume sound" : audio.enabled ? "Sound on" : "Sound off"}
        </button>
      </div>
      <p className="practice-header-eyebrow mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.24em]">
        <span className="delveworn-mode-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
        {eyebrow}
      </p>
      <h1 className="practice-header-title text-4xl font-black tracking-tight lg:text-5xl">
        {title ?? (mode === "practice" ? "Practice Dungeon" : mode === "challenge" ? "Weekly Challenge" : "Onchain Dungeon")}
      </h1>
      <p className="practice-header-subtitle mt-2 text-zinc-400">{subtitle}</p>
      {meta && <p className="practice-header-meta mt-2 text-[10px] text-zinc-600">{meta}</p>}
      {children}
    </header>
  );
}

export function DungeonEntry({
  mode,
  eyebrow,
  description,
  proofFooter,
  children,
}: {
  mode: DelvewornMode;
  eyebrow: string;
  description: ReactNode;
  proofFooter?: ReactNode;
  children: ReactNode;
}) {
  const isPractice = mode === "practice";
  const isChallenge = mode === "challenge";
  const proofItems = isChallenge
    ? [
        "The challenge ID fixes one seed for every player this week.",
        "A shared result contains only the action trace and an integrity digest.",
        "The verifier replays every action locally before showing the score.",
      ]
    : isPractice
      ? [
        "Web Crypto generates every roll in this browser.",
        "No wallet, signature, RPC, VRF request or transaction.",
        "Run progress is local and has no onchain value.",
      ]
    : [
        "Wallet or temporary session authorization.",
        "The configured VRF provider supplies verifiable randomness.",
        "Game state and rewards are stored by the Delveworn contract.",
      ];

  return (
    <div className={`practice-entry-view delveworn-mode-${mode} overflow-hidden lg:grid lg:min-h-[520px] lg:grid-cols-[3fr_2fr]`}>
      <div className="practice-entry-hero relative h-[230px] overflow-hidden bg-black sm:h-[300px] lg:h-full lg:min-h-[520px] lg:border-r lg:border-zinc-800">
        <Image
          src="/assets/delveworn-tier2-party-hero.webp"
          alt="Miss Morgue, Kevin the Unqualified and Brutus assembled in the dungeon"
          fill
          unoptimized
          sizes="(min-width: 1024px) 700px, 100vw"
          className="object-cover object-center"
          priority
        />
        <div className="practice-entry-hero-fade absolute inset-0" />
        <div className="practice-entry-mode-stamp absolute left-4 top-4 rounded-full border px-3 py-1.5 text-[9px] font-black tracking-[0.18em] backdrop-blur-md">
          {isChallenge ? "REPLAY VERIFIED" : isPractice ? "LOCAL SIMULATION" : "LIVE TESTNET"}
        </div>
      </div>
      <div data-keyboard-actions={mode !== "onchain" ? "" : undefined} className="practice-entry-copy flex flex-col items-center justify-center p-6 text-center lg:items-start lg:p-10 lg:text-left">
        <p className="practice-entry-eyebrow text-[10px] font-black tracking-[0.25em]">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-black lg:text-4xl">The Dungeon Awaits</h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">{description}</p>
        <details className="practice-mode-proof mt-5 w-full rounded-xl border bg-black/30 p-3 text-left">
          <summary className="practice-proof-summary">
            <span className="practice-mode-proof-label">
              {isChallenge ? "Deterministic run · verified by replay" : isPractice ? "Local simulation · saved in this browser" : "Contract state · verifiable randomness"}
            </span>
            <span className="practice-proof-boundary">{mode !== "onchain" ? "No wallet · no onchain value" : "Wallet authorization · live testnet"}</span>
            <span className="practice-proof-disclosure" aria-hidden="true">Details +</span>
          </summary>
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            {proofItems.map((item) => (
              <p key={item} className="flex gap-2 text-[11px] leading-relaxed text-zinc-300">
                <span className="practice-mode-proof-marker" aria-hidden="true">◆</span>
                <span>{item}</span>
              </p>
            ))}
          </div>
        </details>
        {proofFooter && <div className="practice-mode-proof-footer mt-3 text-[10px]">{proofFooter}</div>}
        {children}
      </div>
    </div>
  );
}

export function GameHud({
  hp,
  maxHp,
  potions,
  maxPotions,
  gold,
  weaponLevel,
  weaponBonus,
  armorLevel,
  armorAbsorption,
  armorReductionPercent,
  room,
  roomAction,
  combatPotions,
}: {
  hp: number;
  maxHp: number;
  potions: number;
  maxPotions: number;
  gold: number;
  weaponLevel: number;
  weaponBonus: number;
  armorLevel: number;
  armorAbsorption: number;
  armorReductionPercent: number;
  room: number;
  roomAction?: ReactNode;
  combatPotions?: { used: number; limit: number };
}) {
  const gearDialog = useRef<HTMLDialogElement>(null);
  const healthPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const healthColor = healthPercent <= 25 ? "bg-red-500" : healthPercent <= 55 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <section aria-label="Player status and equipment" data-keyboard-scroll-header className="practice-hud sticky top-2 z-40 mb-4 rounded-2xl border border-zinc-700 bg-zinc-950/95 shadow-2xl backdrop-blur-xl lg:top-4">
      <div className="practice-hud-primary grid grid-cols-3 divide-x divide-zinc-800">
        <div className="p-3 text-center">
          <p className="practice-hud-label text-[10px] text-zinc-500">HEALTH</p>
          <p className="practice-hud-value mt-1 flex items-center justify-center gap-1.5 text-sm font-black">
            <span aria-hidden="true">❤️</span>
            <span>{hp}/{maxHp}</span>
          </p>
          <div
            className="practice-player-health-bar mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-label="Player health"
            aria-valuemin={0}
            aria-valuemax={maxHp}
            aria-valuenow={Math.max(0, Math.min(maxHp, hp))}
          >
            <div className={`h-full rounded-full transition-[width] duration-200 ${healthColor}`} style={{ width: `${healthPercent}%` }} />
          </div>
        </div>
        <div className="p-3 text-center">
          <p className="practice-hud-label text-[10px] text-zinc-500">POTIONS</p>
          <p className="practice-hud-value mt-1 flex items-center justify-center gap-1.5 text-sm font-black">
            <span aria-hidden="true">🧪</span>
            <span>{potions}/{maxPotions}</span>
          </p>
        </div>
        <div className="p-3 text-center">
          <p className="practice-hud-label text-[10px] text-zinc-500">GOLD</p>
          <p className="practice-hud-value mt-1 flex items-center justify-center gap-1.5 text-sm font-black">
            <GoldIcon />
            <span>{gold}</span>
          </p>
        </div>
      </div>
      <div className="practice-hud-desktop-loadout grid grid-cols-2 divide-x divide-zinc-800 border-t border-zinc-800">
        <div className="px-3 py-2 text-center">
          <p className="practice-hud-label text-[10px] text-zinc-500">WEAPON</p>
          <p className="practice-loadout-value mt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold sm:text-xs">
            <span aria-hidden="true">⚔️</span>
            <span>Lv {weaponLevel} · +{weaponBonus} damage</span>
          </p>
        </div>
        <div className="px-3 py-2 text-center">
          <p className="practice-hud-label text-[10px] text-zinc-500">ARMOR</p>
          <p className="practice-loadout-value mt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold sm:text-xs">
            <span aria-hidden="true">🛡️</span>
            <span>Lv {armorLevel} · blocks up to {armorAbsorption}</span>
          </p>
          <p className="practice-loadout-note mt-1 text-[9px] text-sky-300">Max {armorReductionPercent}% reduction</p>
        </div>
      </div>
      <div className="practice-mobile-gear">
        <button type="button" onClick={() => gearDialog.current?.showModal()} aria-label={`Gear details: weapon ${weaponLevel}, armor ${armorLevel}`} data-keyboard-actions>
          <span>GEAR ›</span><strong>⚔️ {weaponLevel} · 🛡️ {armorLevel}</strong>
        </button>
      </div>
      <div className="practice-mobile-room">
        <span>ROOM</span><div><strong>{room}</strong>{roomAction}</div>
      </div>
      <div className="practice-combat-potion-status flex items-center justify-between gap-2 border-t border-zinc-800 px-3 py-2 text-center">
        <div className="practice-room-status"><span>ROOM {room}</span>{roomAction}</div>
        <div>
          {combatPotions ? (
            <span className={combatPotions.used >= combatPotions.limit ? "text-red-300" : "text-emerald-300"}>
              Combat potions: {combatPotions.used}/{combatPotions.limit} used
            </span>
          ) : <span>Supplies & equipment</span>}
        </div>
      </div>
      <dialog ref={gearDialog} className="delveworn-battle-dialog" aria-label="Gear details">
        <div><h2>Equipment</h2><button type="button" autoFocus onClick={() => gearDialog.current?.close()} aria-label="Close gear details">✕</button></div>
        <p>⚔️ Weapon level {weaponLevel}: +{weaponBonus} damage.</p>
        <p>🛡️ Armor level {armorLevel}: absorbs up to {armorAbsorption} damage, capped at {armorReductionPercent}% of the incoming hit.</p>
      </dialog>
    </section>
  );
}

/** Shared presentation adapted from Market Dungeon's battle grid.
 * Each game supplies its own confirmed state and action callbacks. */
export function DungeonBattle({
  enemy,
  log,
  logPreview,
  actions,
  dialogue,
}: {
  enemy: { name: string; image: string; hp: number; maxHp: number; incoming: string; flavor: string; isBoss: boolean };
  log: readonly string[];
  logPreview?: ReactNode;
  actions: ReactNode;
  dialogue?: string;
}) {
  const logDialog = useRef<HTMLDialogElement>(null);
  const enemyPercent = enemy.maxHp > 0 ? Math.max(0, Math.min(100, enemy.hp / enemy.maxHp * 100)) : 0;

  return (
    <div className="delveworn-battle" aria-label="Dungeon battle" data-keyboard-action-scope>
      <div className="delveworn-battle-enemy" data-boss={enemy.isBoss}>
        <div className="practice-monster-heading">
          <h2>{enemy.name}</h2>
          <strong className="practice-enemy-hp-label">{enemy.hp}/{enemy.maxHp}</strong>
        </div>
        <div className="delveworn-enemy-track" role="progressbar" aria-label="Enemy health" aria-valuemin={0} aria-valuemax={enemy.maxHp} aria-valuenow={Math.max(0, Math.min(enemy.maxHp, enemy.hp))}>
          <span style={{ width: `${enemyPercent}%` }} />
        </div>
        <p><span>{enemy.isBoss ? "BOSS HP" : "ENEMY HP"}</span><span>💥 RETALIATION {enemy.incoming}</span></p>
      </div>
      <div className="delveworn-battle-art practice-monster-stage">
        <Image src={enemy.image} alt={enemy.name} fill unoptimized priority sizes="(max-width: 800px) 100vw, 55vw" />
      </div>
      <blockquote className="delveworn-battle-flavor">“{enemy.flavor}”{dialogue && <span>Management says: “{dialogue}”</span>}</blockquote>
      <div className="delveworn-battle-bottom">
        <button type="button" className="delveworn-battle-log" onClick={() => logDialog.current?.showModal()} aria-label="Open dungeon log">
          <span>READ DUNGEON LOG <b>READ MORE ›</b></span>
          <span className="practice-action-feedback" aria-live="polite" aria-atomic="true">{logPreview ?? log[0] ?? "The dungeon is quiet. This is almost certainly temporary."}</span>
        </button>
        {actions}
      </div>
      <dialog ref={logDialog} className="delveworn-battle-dialog" aria-label="Dungeon log">
        <div><h2>Dungeon log</h2><button type="button" autoFocus onClick={() => logDialog.current?.close()} aria-label="Close dungeon log">✕</button></div>
        {log.length ? log.map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>) : <p>No resolved actions yet.</p>}
      </dialog>
    </div>
  );
}

export function CombatActionDock({
  busy,
  stormDamage,
  attackDamage,
  criticalChance,
  potionLabel,
  potionDetail,
  potionUsage,
  potionDisabled,
  potionDisabledReason,
  potionLimitReached = false,
  relicName,
  stormRelicSummary,
  attackRelicSummary,
  hp,
  maxHp,
  retaliation,
  enemyHp,
  enemyMaxHp,
  lastExchange,
  keyboardEnabled = true,
  onStorm,
  onPotion,
  onAttack,
}: {
  busy: boolean;
  stormDamage: string;
  attackDamage: string;
  criticalChance: number;
  potionLabel: string;
  potionDetail: ReactNode;
  potionUsage: ReactNode;
  potionDisabled: boolean;
  potionDisabledReason?: string | null;
  potionLimitReached?: boolean;
  relicName?: string;
  stormRelicSummary?: string | null;
  attackRelicSummary?: string | null;
  hp?: number;
  maxHp?: number;
  retaliation?: string;
  enemyHp?: number;
  enemyMaxHp?: number;
  lastExchange?: { dealt: number; taken: number; critical: boolean };
  keyboardEnabled?: boolean;
  onStorm: () => void;
  onPotion: () => void;
  onAttack: () => void;
}) {
  const potionUnavailable = potionLimitReached ? "Combat limit reached" : potionDisabledReason ?? (hp !== undefined && maxHp !== undefined && hp >= maxHp ? "HP is full · save it for later" : null);
  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable], [role='textbox']"))) return;
      if (document.querySelector("dialog[open], [role='dialog'][aria-modal='true']:not([hidden])")) return;
      const key = event.key.toLowerCase();
      if (!["a", "1", "s", "2", "p", "3"].includes(key)) return;
      event.preventDefault();
      if (busy) return;
      if (key === "a" || key === "1") onAttack();
      else if (key === "s" || key === "2") onStorm();
      else if (!potionDisabled) onPotion();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, keyboardEnabled, onAttack, onPotion, onStorm, potionDisabled]);

  return (
    <div aria-label="Combat actions" aria-busy={busy} className="practice-action-dock practice-combat-dock sticky bottom-2 z-40 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl">
      <div className="practice-combat-vitals">
        <span>{hp !== undefined && maxHp !== undefined ? <>YOUR HP <strong data-health={hp <= maxHp * .25 ? "danger" : hp <= maxHp * .55 ? "warning" : "healthy"}>{hp}/{maxHp}</strong></> : "YOUR TURN"}</span>
        <span>{busy ? "Resolving action…" : enemyHp !== undefined && enemyMaxHp !== undefined ? <>ENEMY HP <strong>{enemyHp}/{enemyMaxHp}</strong></> : retaliation ? <>Enemy reply <strong>{retaliation}</strong></> : "Surviving enemies retaliate"}</span>
      </div>
      <div className="delveworn-combat-exchange" role="status" aria-label="Last combat exchange">
        <span>TOOK <b>{lastExchange ? `${lastExchange.taken} HP` : "—"}</b></span>
        <span data-critical={lastExchange?.critical || undefined}>{lastExchange?.critical ? "🔥 CRITICAL!" : "DEALT"} <b>{lastExchange ? `${lastExchange.dealt} HP` : "—"}</b></span>
      </div>
      <div className="practice-combat-actions grid grid-cols-2 gap-2" data-keyboard-actions>
        <button type="button" onClick={onStorm} disabled={busy} aria-label={`⚡ STORM${keyboardEnabled ? " S" : ""} · DAMAGE ${stormDamage} · unpredictable, no critical`} aria-keyshortcuts={keyboardEnabled ? "s 2" : undefined} className="practice-storm-action order-1 rounded-xl bg-violet-700 p-3 text-white transition hover:bg-violet-600 disabled:opacity-40">
          <p className="font-black">⚡ STORM {keyboardEnabled && <kbd>S</kbd>}</p>
          <p className="mt-1 text-sm font-black">DAMAGE {stormDamage}</p>
          <p className="practice-action-description mt-1 text-[10px] text-violet-200">Unpredictable · no critical</p>
          {stormRelicSummary && (
            <p className="practice-action-relic mt-2 rounded-md border border-violet-300/30 bg-black/20 px-2 py-1 text-[9px] font-black leading-tight text-violet-100">
              ◆ {relicName}: {stormRelicSummary}
            </p>
          )}
        </button>
        <button type="button" onClick={onAttack} disabled={busy} aria-label={`⚔️ ATTACK${keyboardEnabled ? " A" : ""} · DAMAGE ${attackDamage} · reliable, ${criticalChance}% critical`} aria-keyshortcuts={keyboardEnabled ? "a 1" : undefined} data-keyboard-default="true" className="practice-attack-action order-2 rounded-xl bg-orange-500 p-3 text-black transition hover:bg-orange-400 disabled:opacity-40">
          <p className="font-black">⚔️ ATTACK {keyboardEnabled && <kbd>A</kbd>}</p>
          <p className="mt-1 text-sm font-black">DAMAGE {attackDamage}</p>
          <p className="practice-action-description mt-1 text-[10px] opacity-70">Reliable · {criticalChance}% critical</p>
          {attackRelicSummary && (
            <p className="practice-action-relic mt-2 rounded-md border border-black/20 bg-black/20 px-2 py-1 text-[9px] font-black leading-tight">
              ◆ {relicName}: {attackRelicSummary}
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={onPotion}
          disabled={busy || potionDisabled}
          aria-keyshortcuts={keyboardEnabled ? "p 3" : undefined}
          className={busy || potionDisabled
            ? "practice-potion-action order-3 col-span-2 w-full cursor-not-allowed rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-zinc-400 opacity-70 lg:order-3 lg:col-span-1 lg:p-5"
            : "practice-potion-action order-3 col-span-2 w-full rounded-xl border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50 to-emerald-200 p-3 text-emerald-950 shadow-[0_8px_24px_rgba(52,211,153,0.12)] transition hover:from-white hover:to-emerald-100 lg:order-3 lg:col-span-1 lg:p-5"}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-black">{potionLabel} {keyboardEnabled && <kbd>P</kbd>}</p>
            <p className={potionLimitReached ? "practice-potion-description mt-1 text-[10px] text-red-300" : potionDisabled ? "practice-potion-description mt-1 text-[10px] text-zinc-400" : "practice-potion-description mt-1 text-[10px] text-emerald-800"}>
              {potionUnavailable ?? potionDetail}
            </p>
            <p className="practice-potion-compact">{potionUnavailable ?? "Heal 25 HP · half retaliation"}</p>
            <div className="mt-2 text-center text-xs font-bold">{potionUsage}</div>
          </div>
        </button>

      </div>
      <p className="practice-potion-consequence">Potion uses your turn: heal, then take half retaliation.</p>
      <KeyboardHint />
    </div>
  );
}

export function DungeonLog({
  entries,
  mobileOpen,
  onToggle,
}: {
  entries: string[];
  mobileOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <section className={`practice-dungeon-log mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4${mobileOpen ? " mobile-open" : ""}`}>
      <div className="practice-log-heading">
        <p className="practice-log-label mb-3 text-[10px] tracking-wider text-zinc-500">DUNGEON LOG</p>
        <p className="practice-log-summary hidden">{entries[0] ?? "No resolved actions yet."}</p>
        <button type="button" onClick={onToggle} aria-expanded={mobileOpen} className="practice-log-toggle hidden">
          {mobileOpen ? "HIDE" : "SHOW"}
        </button>
      </div>
      <div className="practice-log-entries space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-600">No resolved actions yet.</p>
        ) : (
          entries.map((entry, index) => (
            <p
              key={`${index}-${entry}`}
              className={index === 0 ? "text-sm text-white" : index < 4 ? "text-sm text-zinc-300" : "text-sm text-zinc-500"}
            >
              {entry}
            </p>
          ))
        )}
      </div>
    </section>
  );
}

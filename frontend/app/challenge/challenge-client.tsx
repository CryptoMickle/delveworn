"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CombatActionDock,
  DungeonBattle,
  DungeonEntry,
  GameHeader,
  GameHud,
  RoomProgressLine,
} from "../game-ui";
import {
  attackRange,
  campAvailable,
  campPrices,
  currentCriticalChance,
  incomingRange,
  stormRange,
  supplyAvailable,
  supplyPrices,
  type MonsterType,
  type PracticeGame,
} from "../practice/engine";
import { practiceRoom } from "../practice/feedback";
import { DungeonRecovery } from "../between-rooms";
import {
  applyChallengeAction,
  challengeShareUrl,
  createChallengeProof,
  isChallengeComplete,
  startChallengeRun,
  verifyChallengeProof,
  type ChallengeAction,
  type ChallengeDefinition,
  type ChallengeResult,
  type ChallengeRun,
  type VerifiedChallengeResult,
} from "./core";
import { registerChallengeCompletion, registerChallengeStart, trackChallenge } from "./analytics";
import { clearChallengeRun, loadChallengeRun, saveChallengeRun } from "./storage";

const MAX_POTIONS = 5;
const SHOP_POTION_STOCK = 2;
const MERCHANT_NAME = "Quartermaster Kevin";
const MERCHANT_IMAGE = "/characters/merchant-quartermaster-kevin.webp?v=merchant-20260825-v3";

const CHALLENGE_MONSTERS: Record<MonsterType, { name: string; image: string; flavor: string }> = {
  0: { name: "Grave Belle", image: "/monsters/zombie-1-grave-belle.webp?v=art-20260825-v2", flavor: "Technically deceased. Socially still very active." },
  1: { name: "Gary", image: "/monsters/goblin-1-gary.webp?v=art-20260825-v2", flavor: "Gary has no plan, but he is extremely committed to it." },
  2: { name: "Thud", image: "/monsters/orc-1-thud.webp?v=art-20260825-v2", flavor: "Thud hits first, thinks never." },
  3: { name: "The Dungeon Lord", image: "/monsters/boss-1-dungeon-lord.webp?v=art-20260825-v2", flavor: "Runs the dungeon with absolute authority and questionable competence." },
};

function validReferral(value: string | null): string | null {
  return value && /^[0-9a-f]{12}$/.test(value) ? value : null;
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function resultText(result: ChallengeResult, url: string): string {
  const outcome = result.outcome === "cleared" ? "cleared all 10 rooms" : `cleared ${result.roomsCleared}/10 rooms`;
  return `I scored ${result.score.toLocaleString("en-US")} in Delveworn ${result.challengeId} and ${outcome}. Replay-verified result: ${url}`;
}

function ResultPanel({
  verified,
  incoming,
  onPlay,
  onShare,
  shareNotice,
  onchainNetwork,
}: {
  verified: VerifiedChallengeResult;
  incoming: boolean;
  onPlay: () => void;
  onShare: () => void;
  shareNotice: string;
  onchainNetwork: string | null;
}) {
  const { result } = verified;
  return (
    <section className="challenge-result" aria-label="Verified challenge result">
      <p className="challenge-verified-badge">✓ VERIFIED BY DETERMINISTIC REPLAY</p>
      <p className="challenge-result-kicker">{result.challengeId} · RULES V{result.rulesVersion}</p>
      <h2>{result.score.toLocaleString("en-US")} points</h2>
      <p className="challenge-result-outcome">
        {result.outcome === "cleared" ? "The Dungeon Lord fell. Challenge cleared." : `The dungeon ended the run after ${result.roomsCleared} rooms.`}
      </p>
      <div className="challenge-result-grid">
        <div><span>ROOMS</span><strong>{result.roomsCleared}/10</strong></div>
        <div><span>HP</span><strong>{result.hp}</strong></div>
        <div><span>GOLD</span><strong>{result.gold}</strong></div>
        <div><span>ACTIONS</span><strong>{result.actionCount}</strong></div>
        <div><span>WEAPON</span><strong>Lv {result.weaponLevel}</strong></div>
        <div><span>ARMOR</span><strong>Lv {result.armorLevel}</strong></div>
      </div>
      <details className="challenge-proof-details">
        <summary>How this result was checked</summary>
        <p>The challenge ID fixes seed 0x{result.seed.toString(16).padStart(8, "0")}. The verifier checked the SHA-256 integrity code, replayed all {result.actionCount} legal actions and recalculated the score.</p>
        <p>Run ID: <code>{verified.runId}</code>. This is a local replay proof, not an onchain attestation.</p>
      </details>
      <div className="challenge-result-actions" data-keyboard-actions>
        <button type="button" onClick={incoming ? onPlay : onShare} data-keyboard-default="true">
          {incoming ? "PLAY THIS CHALLENGE" : "SHARE VERIFIED RESULT"}
        </button>
        {incoming ? (
          <button type="button" onClick={onShare}>SHARE THIS RESULT</button>
        ) : (
          <button type="button" onClick={onPlay}>TRY THE SAME SEED AGAIN</button>
        )}
      </div>
      {shareNotice && <p className="challenge-share-notice" role="status">{shareNotice}</p>}
      {!incoming && onchainNetwork && (
        <div className="challenge-onchain-next">
          <p>Want a contract-backed run after the game has earned it?</p>
          <Link href="/onchain">Optional Somnia onchain mode →</Link>
        </div>
      )}
    </section>
  );
}

function ChallengeShopButton({
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

function ChallengeRecovery({
  game,
  busy,
  dispatch,
}: {
  game: PracticeGame;
  busy: boolean;
  dispatch: (action: ChallengeAction) => void;
}) {
  const supplies = supplyPrices(game);
  const camp = campPrices(game);
  const supply = supplyAvailable(game);
  const atCamp = campAvailable(game);
  const nextRoom = game.roomsCleared + 1;
  const merchantKind = supply ? "supply" : atCamp ? "camp" : null;
  const clearedMonster = CHALLENGE_MONSTERS[game.monsterType];
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
  const shop = (
    <>
      {supply && (
        <section data-keyboard-actions className="practice-kevin-shop mt-4 rounded-2xl border border-cyan-900 bg-gradient-to-b from-cyan-950/30 to-zinc-950 p-4">
          <p className="text-[10px] tracking-[0.25em] text-cyan-400">SUPPLY STOP · ROOM {game.roomsCleared}</p>
          <h2 className="mt-1 text-xl font-black">RESTOCK</h2>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <ChallengeShopButton
              label={`🩹 BANDAGE · ${game.supplyBandageUsed ? "USED" : "1/1 LEFT"}`}
              detail="Restore 25 HP · one per stop"
              cost={supplies.bandage}
              onClick={() => dispatch("supply-bandage")}
              disabledReason={supplyBandageDisabledReason}
            />
            <ChallengeShopButton
              label={`🧪 POTION · ${SHOP_POTION_STOCK - game.supplyPotionsBought}/${SHOP_POTION_STOCK} LEFT`}
              detail="Add one potion"
              cost={supplies.potion}
              onClick={() => dispatch("supply-potion")}
              disabledReason={supplyPotionDisabledReason}
            />
          </div>
        </section>
      )}
      {atCamp && (
        <section data-keyboard-actions className="practice-kevin-shop mt-4 rounded-2xl border border-amber-800 bg-gradient-to-b from-amber-950/30 to-zinc-950 p-4">
          <p className="text-[10px] tracking-[0.25em] text-amber-400">CAMP BEFORE ROOM {nextRoom}</p>
          <h2 className="mt-1 text-xl font-black">PREPARE FOR MANAGEMENT</h2>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <ChallengeShopButton
              label={`🔥 REST · ${game.campRestUsed ? "USED" : "1/1 LEFT"}`}
              detail="Restore 30 HP · once per camp"
              cost={camp.rest}
              onClick={() => dispatch("camp-rest")}
              disabledReason={campRestDisabledReason}
            />
            <ChallengeShopButton
              label={`🧪 POTION · ${SHOP_POTION_STOCK - game.campPotionsBought}/${SHOP_POTION_STOCK} LEFT`}
              detail="Add one potion"
              cost={camp.potion}
              onClick={() => dispatch("camp-potion")}
              disabledReason={campPotionDisabledReason}
            />
            <ChallengeShopButton label="⚔️ WEAPON" detail="Permanent damage upgrade for this run" cost={camp.weapon} onClick={() => dispatch("camp-weapon")} disabledReason={campWeaponDisabledReason} />
            <ChallengeShopButton label="🛡️ ARMOR" detail="Permanent damage reduction for this run" cost={camp.armor} onClick={() => dispatch("camp-armor")} disabledReason={campArmorDisabledReason} />
          </div>
        </section>
      )}
    </>
  );

  return (
    <DungeonRecovery
      room={game.roomsCleared}
      lootType={game.lastLootType}
      lootAmount={game.lastLootAmount}
      flavor={game.log.find((entry) => entry.startsWith("☠️"))?.replace(/^☠️\s*/, "")}
      hp={game.hp}
      maxHp={game.maxHp}
      potions={game.potions}
      merchant={merchantKind ? { name: MERCHANT_NAME, imageSrc: MERCHANT_IMAGE, kind: merchantKind } : undefined}
      fallbackArt={{ imageSrc: clearedMonster.image, name: clearedMonster.name }}
      enterAction={(
        <button type="button" data-keyboard-default="true" disabled={busy} onClick={() => dispatch("next-room")}>
          {nextRoom === 10 ? `ENTER BOSS ROOM ${nextRoom}` : `ENTER ROOM ${nextRoom}`}
        </button>
      )}
      healAction={(
        <button type="button" disabled={roomHealDisabledReason !== null} onClick={() => dispatch("potion")} title="Restore up to 25 HP. No enemy retaliation between rooms.">
          <span>USE OWN POTION SAFELY · {game.potions}/{MAX_POTIONS}</span>
          {roomHealDisabledReason && <small>{roomHealDisabledReason}</small>}
        </button>
      )}
      shop={merchantKind ? shop : undefined}
      relics={null}
      activeRelic="No Relic"
      ownedRelicCount={0}
      log={game.log}
      feedback="Verified challenge action applied"
    />
  );
}

export default function ChallengeClient({
  definition,
  resultProof,
  referral,
  onchainNetwork,
}: {
  definition: ChallengeDefinition;
  resultProof: string | null;
  referral: string | null;
  onchainNetwork: string | null;
}) {
  const [run, setRun] = useState<ChallengeRun | null>(null);
  const [sharedResult, setSharedResult] = useState<VerifiedChallengeResult | null>(null);
  const [ownResult, setOwnResult] = useState<VerifiedChallengeResult | null>(null);
  const [proofStatus, setProofStatus] = useState<"checking" | "invalid" | null>(resultProof ? "checking" : null);
  const [notice, setNotice] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const runRef = useRef<ChallengeRun | null>(null);
  const busyRef = useRef(false);
  const abandonedRef = useRef(false);
  const completionKeys = useRef(new Set<string>());
  const activeReferral = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (resultProof) {
        try {
          const verified = await verifyChallengeProof(definition.id, resultProof);
          if (cancelled) return;
          setSharedResult(verified);
          setProofStatus(null);
          if (validReferral(referral) === verified.runId) {
            activeReferral.current = verified.runId;
            trackChallenge("challenge_referral_visit", definition.id, { source: "shared_result" });
          } else {
            activeReferral.current = null;
          }
        } catch (error) {
          if (cancelled) return;
          setProofStatus("invalid");
          const code = error instanceof Error && "code" in error ? String(error.code) : "invalid_proof";
          trackChallenge("challenge_error", definition.id, { error_code: code });
        }
      } else {
        const restored = loadChallengeRun(window.localStorage, definition.id);
        if (restored) {
          runRef.current = restored.run;
          activeReferral.current = restored.referral;
          setRun(restored.run);
        }
      }
      if (!cancelled) setStorageReady(true);
    };
    void restore();
    return () => { cancelled = true; };
  }, [definition, referral, resultProof]);

  useEffect(() => {
    const pageHidden = () => {
      const current = runRef.current;
      if (!current || isChallengeComplete(current) || current.actions.length === 0 || abandonedRef.current) return;
      abandonedRef.current = true;
      trackChallenge("challenge_abandoned", definition.id, {
        actions: current.actions.length,
        rooms: current.game.roomsCleared,
      });
    };
    window.addEventListener("pagehide", pageHidden);
    return () => window.removeEventListener("pagehide", pageHidden);
  }, [definition.id]);

  useEffect(() => {
    if (!run || !isChallengeComplete(run)) return;
    const actionKey = run.actions.join("");
    let cancelled = false;
    void createChallengeProof(run).then((verified) => {
      if (cancelled || runRef.current?.actions.join("") !== actionKey) return;
      setOwnResult(verified);
      if (!completionKeys.current.has(verified.runId)) {
        completionKeys.current.add(verified.runId);
        if (registerChallengeCompletion(window.localStorage, definition.id, verified.runId)) {
          trackChallenge("challenge_completed", definition.id, {
            outcome: verified.result.outcome,
            rooms: verified.result.roomsCleared,
            referred: Boolean(activeReferral.current),
          });
          if (activeReferral.current) {
            trackChallenge("challenge_referral_completed", definition.id, {
              outcome: verified.result.outcome,
            });
          }
        }
      }
    }).catch((error) => {
      const code = error instanceof Error && "code" in error ? String(error.code) : "proof_creation";
      trackChallenge("challenge_error", definition.id, { error_code: code });
      setNotice("The result is complete, but its share link could not be created. Reload to retry.");
    });
    return () => { cancelled = true; };
  }, [definition.id, run]);

  const begin = () => {
    const next = startChallengeRun(definition);
    runRef.current = next;
    busyRef.current = false;
    abandonedRef.current = false;
    setSharedResult(null);
    setProofStatus(null);
    setOwnResult(null);
    setNotice("");
    setRun(next);
    clearChallengeRun(window.localStorage, definition.id);
    saveChallengeRun(window.localStorage, next, activeReferral.current);
    const marker = registerChallengeStart(window.localStorage, definition.id);
    if (marker.uniqueStart) {
      trackChallenge("challenge_started", definition.id, { referred: Boolean(activeReferral.current) });
    }
    if (marker.returnVisit) trackChallenge("challenge_return_visit", definition.id);
    const url = new URL(window.location.href);
    url.searchParams.delete("r");
    if (activeReferral.current) url.searchParams.set("ref", activeReferral.current);
    else url.searchParams.delete("ref");
    window.history.replaceState(null, "", url);
  };

  const dispatch = (action: ChallengeAction) => {
    const current = runRef.current;
    if (!current || busyRef.current || isChallengeComplete(current)) return;
    busyRef.current = true;
    try {
      const next = applyChallengeAction(current, action);
      runRef.current = next;
      abandonedRef.current = false;
      setRun(next);
      saveChallengeRun(window.localStorage, next, activeReferral.current);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "action_failed";
      trackChallenge("challenge_error", definition.id, { error_code: code });
      setNotice("That action could not be verified, so the run was left unchanged.");
    } finally {
      queueMicrotask(() => { busyRef.current = false; });
    }
  };

  const share = async (verified: VerifiedChallengeResult) => {
    const url = challengeShareUrl(window.location.origin, verified);
    const text = resultText(verified.result, url);
    const nativeShare = (navigator as Omit<Navigator, "share"> & {
      share?: (data?: ShareData) => Promise<void>;
    }).share;
    const usesNativeShare = typeof nativeShare === "function";
    try {
      if (nativeShare) {
        await nativeShare.call(navigator, { title: `Delveworn ${definition.id}`, text, url });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setNotice(usesNativeShare ? "Share sheet opened with the verified challenge link." : "Verified result copied with its challenge link.");
      trackChallenge("challenge_shared", definition.id, {
        channel: usesNativeShare ? "native" : "clipboard",
        outcome: verified.result.outcome,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(`Copy this verified link: ${url}`);
    }
  };

  const currentVerified = ownResult ?? sharedResult;
  const complete = run ? isChallengeComplete(run) : false;
  const game = run?.game ?? null;
  const monster = game ? CHALLENGE_MONSTERS[game.monsterType] : null;
  const incoming = game ? incomingRange(game) : [0, 0];
  const attackDamage = game ? attackRange(game) : [0, 0];
  const stormDamage = game ? stormRange(game) : [0, 0];
  const subtitle = proofStatus === "checking" ? "Checking the shared result"
    : currentVerified ? `${currentVerified.result.score.toLocaleString("en-US")} points · ${currentVerified.result.roomsCleared}/10 rooms`
      : game ? `Room ${practiceRoom(game)} of 10 · ${run?.actions.length ?? 0} actions`
        : `${shortDate(definition.startsAt)}–${shortDate(definition.endsAt)} UTC`;

  return (
    <main className={`practice-shell challenge-shell delveworn-challenge-mode min-h-screen bg-[#090909] px-4 py-6 text-white lg:px-8 lg:py-8${game ? " practice-in-run" : ""}`}>
      <div className="practice-column mx-auto w-full max-w-md lg:max-w-6xl">
        <GameHeader
          mode="challenge"
          eyebrow="WEEKLY VERIFIED CHALLENGE"
          subtitle={subtitle}
          meta={`${definition.id} · SEED 0x${definition.seed.toString(16).padStart(8, "0")} · RULES V${definition.rulesVersion}`}
        />

        {proofStatus === "invalid" && (
          <div className="challenge-error" role="alert">
            <strong>RESULT REJECTED</strong>
            <p>The shared payload is invalid, changed or belongs to another challenge. No score was accepted.</p>
            <button type="button" onClick={begin}>PLAY THE VALID {definition.id} CHALLENGE</button>
          </div>
        )}

        {proofStatus === "checking" && (
          <div className="challenge-checking" role="status">Checking integrity, replaying actions and recalculating the score…</div>
        )}

        {game && complete && !currentVerified && (
          <div className="challenge-checking" role="status">Run complete. Creating the replay proof and calculating the final score…</div>
        )}

        {currentVerified && (
          <ResultPanel
            verified={currentVerified}
            incoming={Boolean(sharedResult && !ownResult)}
            onPlay={begin}
            onShare={() => void share(currentVerified)}
            shareNotice={notice}
            onchainNetwork={onchainNetwork}
          />
        )}

        {!currentVerified && !proofStatus && !game && (
          <section className="practice-main-card overflow-hidden rounded-2xl border border-violet-800 bg-zinc-900">
            <DungeonEntry
              mode="challenge"
              eyebrow={`${definition.id} · 10-ROOM SPRINT`}
              description="Everyone receives the same encounter and combat rolls. Your choices create the difference, and every shared score is rebuilt from its action trace."
            >
              <div className="challenge-rules">
                <p><strong>Goal</strong><span>Clear Room 10 before the dungeon ends your run.</span></p>
                <p><strong>Score</strong><span>Rooms first, then clear bonus, remaining resources, upgrades and action efficiency.</span></p>
                <p><strong>Proof</strong><span>Rules version, seed and legal actions are replayed locally. No personal data enters the proof.</span></p>
              </div>
              <button type="button" data-keyboard-default="true" onClick={begin} disabled={!storageReady} className="delveworn-primary-cta mt-7 w-full rounded-xl py-4 text-lg font-black transition disabled:opacity-50">
                ⚔️ START {definition.id}
              </button>
              <p className="mt-4 text-xs text-zinc-400">No wallet · no transaction · one controlled weekly seed</p>
            </DungeonEntry>
          </section>
        )}

        {game && !complete && (
          <>
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
              combatPotions={game.monsterHp > 0 ? { used: game.combatPotionsUsed, limit: game.monsterType === 3 ? 3 : 2 } : undefined}
            />
            <section className={`practice-main-card relative mb-4 overflow-hidden rounded-2xl border ${game.monsterType === 3 ? "border-purple-700 bg-purple-950/30" : "border-zinc-800 bg-zinc-900"}`}>
              <RoomProgressLine room={practiceRoom(game)} roomsCleared={game.roomsCleared} isBoss={game.monsterType === 3} phase={game.monsterHp > 0 ? "Weekly combat" : "Room cleared"} />
              {game.monsterHp > 0 && monster ? (
                <DungeonBattle
                  enemy={{
                    name: monster.name,
                    image: monster.image,
                    hp: game.monsterHp,
                    maxHp: game.monsterMaxHp,
                    incoming: `${incoming[0]}–${incoming[1]}`,
                    flavor: monster.flavor,
                    isBoss: game.monsterType === 3,
                  }}
                  log={game.log}
                  actions={(
                    <CombatActionDock
                      busy={false}
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
                      potionUsage={<>{game.combatPotionsUsed}/{game.monsterType === 3 ? 3 : 2}<span className="block text-[9px] font-normal opacity-70">used</span></>}
                      potionDisabled={game.potions === 0 || game.hp >= game.maxHp || game.combatPotionsUsed >= (game.monsterType === 3 ? 3 : 2)}
                      potionDisabledReason={game.potions === 0 ? "No potions left" : null}
                      potionLimitReached={game.combatPotionsUsed >= (game.monsterType === 3 ? 3 : 2)}
                      onStorm={() => dispatch("storm")}
                      onPotion={() => dispatch("potion")}
                      onAttack={() => dispatch("attack")}
                    />
                  )}
                />
              ) : (
                <ChallengeRecovery game={game} busy={false} dispatch={dispatch} />
              )}
            </section>
            <div className="challenge-run-meta">
              <span>{run?.actions.length ?? 0} / 320 actions</span>
              <span>Room score {(game.roomsCleared * 10_000).toLocaleString("en-US")}</span>
            </div>
            {notice && <p className="challenge-share-notice" role="status">{notice}</p>}
          </>
        )}
      </div>
    </main>
  );
}

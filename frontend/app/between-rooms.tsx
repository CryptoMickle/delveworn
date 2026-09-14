import Image from "next/image";
import type { ReactNode } from "react";

const LOOT_ART: Record<number, { imageSrc: string; label: string }> = {
  1: { imageSrc: "/assets/loot/potion-v1.webp", label: "Potion" },
  2: { imageSrc: "/assets/delveworn-gold-coin.webp", label: "bonus gold" },
  3: { imageSrc: "/assets/loot/weapon-v1.webp", label: "Weapon +1" },
  4: { imageSrc: "/assets/loot/armor-v1.webp", label: "Armor +1" },
};

/** Presentation only: every action and value comes from its mode's game state. */
export function DungeonRecovery({
  room, lootType, lootAmount, lootDetail, flavor, hp, maxHp, potions, maxPotions = 5,
  merchant, fallbackArt, enterAction, healAction, shop, relics, activeRelic,
  ownedRelicCount, relicsAvailable = true, log, feedback,
}: {
  room: number;
  lootType: number;
  lootAmount: number;
  lootDetail?: string;
  flavor?: string;
  hp: number;
  maxHp: number;
  potions: number;
  maxPotions?: number;
  merchant?: { name: string; imageSrc: string; kind: "camp" | "supply" };
  fallbackArt?: { name: string; imageSrc: string };
  enterAction: ReactNode;
  healAction: ReactNode;
  shop?: ReactNode;
  relics: ReactNode;
  activeRelic: string;
  ownedRelicCount: number;
  relicsAvailable?: boolean;
  log: string[];
  feedback?: ReactNode;
}) {
  const loot = LOOT_ART[lootType];
  const lootLabel = lootType === 2 ? `${lootAmount} bonus gold` : loot?.label;
  const art = merchant ?? (loot ? { imageSrc: loot.imageSrc, name: `Loot: ${lootLabel}` } : fallbackArt)
    ?? { imageSrc: "/assets/delveworn-tier2-party-hero.webp", name: "The dungeon awaits" };
  const healthPercent = maxHp > 0 ? Math.max(0, Math.min(100, hp / maxHp * 100)) : 0;
  const healthColor = healthPercent > 50 ? "#34d399" : healthPercent > 25 ? "#fbbf24" : "#fb7185";

  return (
    <div className="dungeon-recovery" data-keyboard-action-scope aria-label="Between rooms">
      <div className="recovery-art" data-loot={lootType} data-merchant={Boolean(merchant)}>
        <Image src={art.imageSrc} alt={art.name} width={800} height={800} unoptimized sizes="(max-width: 800px) 1px, 55vw" />
      </div>
      <div className="recovery-details">
        <section className="recovery-panel" data-keyboard-actions data-keyboard-vertical="edges" aria-label={`Room ${room} cleared`}>
          <div className="recovery-heading" data-loot={Boolean(loot)} data-merchant={Boolean(merchant)}>
            {loot && <div className="recovery-thumbnail"><Image src={loot.imageSrc} alt={`Loot: ${lootLabel}`} width={80} height={80} unoptimized /></div>}
            <p className="recovery-kicker">ROOM {room} CLEARED</p>
            <h2>{loot ? `Loot secured: ${lootLabel}` : "The path ahead is open."}</h2>
            {flavor && <blockquote>{flavor}</blockquote>}
            {lootDetail && <p className="recovery-loot-detail">{lootDetail}</p>}
          </div>
          <div className="recovery-resources" role="group" aria-label="Recovery supplies">
            <div><span>YOUR HP</span><strong>❤️ {hp}/{maxHp}</strong></div>
            <div><span>POTIONS</span><strong>🧪 {potions}/{maxPotions}</strong></div>
            <div className="recovery-health-track" role="progressbar" aria-label="Recovery health" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={maxHp}>
              <span style={{ width: `${healthPercent}%`, background: healthColor }} />
            </div>
          </div>
          {merchant && <div className="recovery-merchant">
            <Image src={merchant.imageSrc} alt={merchant.name} width={96} height={64} unoptimized />
            <div><p>{merchant.kind === "camp" ? "BOSS CAMP" : "SUPPLY STOP"}</p><h3>{merchant.name}</h3></div>
          </div>}
          {shop && <div className="recovery-shop">{shop}</div>}
          <div className="recovery-heal">{healAction}</div>
          {(ownedRelicCount > 0 || !relicsAvailable) && <details className="recovery-relics">
            <summary><b>CHANGE / UNEQUIP RELIC</b><span>Active: {activeRelic} · {ownedRelicCount} owned</span></summary>
            <div>{relics}</div>
          </details>}
          <div className="recovery-next">{enterAction}</div>
        </section>
        <section className="recovery-log" aria-label="Dungeon log">
          <header><h3>DUNGEON LOG</h3>{feedback && <div className="recovery-feedback practice-action-feedback" role="status" aria-live="polite" aria-atomic="true">{feedback}</div>}</header>
          <div>{log.length ? log.slice(0, 4).map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>) : <p>No resolved actions yet.</p>}</div>
          {log.length > 4 && <details className="recovery-log-history"><summary>Earlier entries</summary>{log.slice(4).map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)}</details>}
        </section>
      </div>
    </div>
  );
}

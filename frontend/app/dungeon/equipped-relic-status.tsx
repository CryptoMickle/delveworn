import { RelicArtwork } from "../game-ui";
import { getRelicDefinition } from "../relics";

/** Read the active loadout; inspecting it never equips or changes a relic. */
export function EquippedRelicStatus({
  equippedRelic,
  ownedRelicCount,
  onOpen,
}: {
  equippedRelic: number;
  ownedRelicCount: number;
  onOpen: () => void;
}) {
  if (equippedRelic === 0 && ownedRelicCount === 0) return null;
  const relic = getRelicDefinition(equippedRelic);
  const equipped = equippedRelic !== 0;

  return <button type="button" className="endless-room-equipped-relic" onClick={onOpen}
    aria-label={equipped
      ? `Equipped relic: ${relic.name}. Open relic collection`
      : `No relic equipped. ${ownedRelicCount} collected. Open relic collection`}>
    {equipped
      ? <RelicArtwork imageSrc={relic.imageSrc} name={relic.name} className="endless-room-equipped-art" />
      : <span className="endless-room-equipped-empty" aria-hidden="true">◆</span>}
    <span className="endless-room-equipped-copy">
      <span className="endless-room-equipped-label">{equipped ? `${relic.rarity} · Equipped` : "Relic collection"}</span>
      <strong className={equipped ? relic.accentClass : undefined}>{equipped ? relic.name : "None equipped"}</strong>
    </span>
    <span className="endless-room-equipped-link">{equipped ? "Details" : `${ownedRelicCount} collected`} ›</span>
  </button>;
}

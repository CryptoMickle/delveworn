export type SafePotionAction = {
  onUse: () => void;
  disabledReason: string | null;
  healAmount?: number;
};

/** Reuses the inventory slot; combat retains its own potion control. */
export function InventoryPotions({ potions, maxPotions = 5, onUse, disabledReason = null, healAmount = 25 }: {
  potions: number;
  maxPotions?: number;
  onUse?: () => void;
  disabledReason?: string | null;
  healAmount?: number;
}) {
  if (!onUse) return <span className="dungeon-inventory-potions"><small>Potions</small><strong>{potions} / {maxPotions}</strong></span>;
  const reason = disabledReason ?? (potions <= 0 ? "No potions available." : null);
  const description = reason ?? `Restore up to ${healAmount} HP. No enemy retaliation.`;
  return <button type="button" className="dungeon-inventory-potions" disabled={reason !== null}
    aria-label={`Use potion · ${potions} left · ${description}`} title={description}
    onClick={() => { if (reason === null) onUse(); }}>
    <small>Potion +{healAmount} HP</small><strong>{potions} / {maxPotions}</strong>
  </button>;
}

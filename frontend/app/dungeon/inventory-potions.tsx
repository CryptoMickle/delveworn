export type SafePotionAction = {
  onUse: () => void;
  disabledReason: string | null;
  healAmount?: number;
};

/** Compact stock display or safe-healing control; combat keeps its own control. */
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
    data-keyboard-actions aria-label={`Use potion · ${potions} left · ${description}`} title={description}
    onClick={() => { if (reason === null) onUse(); }}>
    <span>🧪 POTION · {potions}/{maxPotions}</span>
    <small>{reason ?? `+${healAmount} HP · No enemy retaliation`}</small>
  </button>;
}

# Relics V2

Relics are run-only and occupy one slot. The room-5 relic offer rolls exactly one rarity tier from the killing action's existing VRF output, so no additional randomness request or chain-specific dependency is introduced. The player is then offered all three relics in the rolled tier.

## Rarity odds

| Rarity | Chance |
| --- | ---: |
| Common | 55% |
| Uncommon | 25% |
| Rare | 12% |
| Epic | 6% |
| Legendary | 2% |

## Catalog

| Rarity | Relic | Effect |
| --- | --- | --- |
| Common | Blood Price | +10% outgoing damage; entering each new room costs 2 max HP, minimum 20 |
| Common | Iron Shell | +20 max HP; -5% outgoing damage |
| Common | Echo Lens | +5 percentage points normal-attack crit; -20% Storm damage |
| Uncommon | Glass Edge | +20% outgoing damage; -20 max HP |
| Uncommon | Ashen Fang | Heal 4 HP after each kill; -10 max HP |
| Uncommon | Stormglass | +30% Storm damage; -5% normal outgoing damage |
| Rare | Gilded Hunger | +60% gold gained; -10% outgoing damage |
| Rare | Grave Pact | First lethal hit revives at 25% max HP; -10% outgoing damage |
| Rare | Stormheart | +45% Storm damage; -10% normal outgoing damage |
| Epic | Titan Bone | +50 max HP; -10% outgoing damage |
| Epic | Black Mirror | +15 percentage points crit and 3x crits; -15% normal outgoing damage |
| Epic | Blood Engine | +10% outgoing damage and heal 8 HP after each kill; -15 max HP |
| Legendary | Crown of Ruin | +35% outgoing damage; -40 max HP |
| Legendary | Undying Flame | First lethal hit revives at 50% max HP; -15 max HP |
| Legendary | Worldbreaker | +25% outgoing damage and +10 percentage points crit; +25% incoming damage |

The Common tier preserves the calibrated Relics V1 balance. Higher rarities are intentionally more run-defining, but each keeps an explicit cost or specialization rather than becoming a universally correct choice.

## Balance testing

The legacy Common telemetry suite remains a Common-only comparison. Its test-only Delveworn subclass pins the room-5 offer to Common after the genuine VRF callback, preserving the original combat and loot randomness while production offers remain strictly rarity-locked.

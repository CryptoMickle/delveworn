# Worldbreaker balance review

No balance values were changed during the relic-visibility and Supervisor-art repair.

## Finding

Worldbreaker gives +30% outgoing damage and raises normal Attack critical chance from 15% to 25% (double damage). Before integer rounding, expected normal damage increases by `1.30 × 1.25 / 1.15 = 1.413`. Storm does not crit. The +15% incoming cost is applied after armor, rounded up. A killing blow prevents retaliation, so higher damage also reduces the number of enemy replies. Duplicate relics do not stack.

For the reported Room 92 Orc (278 HP), weapon 18 and armor 14, using only normal Attack and no healing:

| Relic | Expected damage per Attack | Expected attacks to defeat | Expected HP loss | Max HP |
| --- | ---: | ---: | ---: | ---: |
| None | 52.90 | 5.89 | 50.6 | 100 |
| Glass Edge | 63.08 | 5.13 | 42.7 | 80 |
| Black Mirror | 63.06 | 5.11 | 42.5 | 100 |
| Crown of Ruin | 70.90 | 4.46 | 35.8 | 60 |
| Worldbreaker | 74.35 | 4.16 | 39.0 | 100 |

Thus Worldbreaker gives about 40.5% more damage and 23% less total incoming damage than no relic in this example. Individual fights vary. This is not a survival-rate estimate or a complete run simulation.

The damage distributions were checked against the actual Practice engine for all 500 combinations of normal-damage roll and critical roll, for the compared relics in rooms 11 and 92. Full-fight expectations were computed by dynamic programming over remaining enemy HP, including the absence of retaliation on the final hit.

## Candidate for a later versioned balance change

- +25% outgoing damage.
- +5 percentage points critical chance (20% total).
- +20% incoming damage.

The same example then gives 68.72 expected damage, 4.32 attacks and 42.0 expected HP loss. This retains a strong Legendary while restoring Crown of Ruin's normal-Attack advantage.

Before adoption, compare deeper runs through rooms 100–200, including Storm, healing and boss encounters. Existing `test/RelicsV2Balance.t.sol` coverage only measures 32 runs through room 30.

## Compatibility

The Practice engine is also used for deterministic Weekly replay. Do not change its existing rules in place: preserve validation of old Weekly results and introduce an explicit new rule version. Maintain frontend/contract parity (`src/RelicRules.sol`) and account for existing deployed contracts and saved runs.

Sources: `frontend/app/practice/engine.ts` (damage modifiers and Attack order), `frontend/app/relics.ts` (relic descriptions), `src/RelicRules.sol` (contract rules), `test/RelicsV2Balance.t.sol` (current balance coverage).

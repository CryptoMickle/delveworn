# Delveworn pre-relic balance baseline

This document records a deterministic control baseline for Delveworn **before relics are introduced**.

The purpose is not to predict human behavior. It is to give us a repeatable reference strategy that can be run against future balance/relic versions so power creep and survival drift are measurable rather than subjective.

## Harness

Test:

```bash
forge test --match-contract BalanceBaselineTest -vvv
```

Configuration:

- 32 deterministic runs
- 30-room cap
- `DevRandomnessAdapter`
- normal `ATTACK` as the default combat action
- combat potion used at 35 HP or below when available and within the per-fight limit
- between-room potion used at 35 HP or below while retaining at least one potion
- supply bandage bought at 70 HP or below when affordable
- supply/camp potions replenish toward 3 carried potions when affordable
- camp rest bought at 70 HP or below when affordable
- one weapon upgrade bought at camp when affordable
- one armor upgrade bought afterwards if enough gold remains

The strategy intentionally prefers reliability over Storm variance. Separate strategy cohorts can be added later, but this cohort should remain stable as the control used for Relics V1 comparisons.

## Recorded baseline

Recorded in CI on 2026-08-24 against the pre-relic core.

| Metric | Result |
| --- | ---: |
| Runs | 32 |
| Room cap | 30 |
| Average rooms cleared | 18.59 |
| Reached room 5 | 100.00% |
| Reached room 10 | 87.50% |
| Reached room 20 | 37.50% |
| Reached room 30 | 18.75% |
| Total bosses cleared | 46 |
| Average bosses cleared/run | 1.44 |
| Average final gold | 103.25 |
| Average final potions | 0.28 |
| Average final weapon level | 2.46 |
| Average final armor level | 1.68 |
| Attack actions | 2,768 |
| Combat potion actions | 424 |
| Between-room potion uses | 7 |
| Supply bandages bought | 97 |
| Supply potions bought | 123 |
| Camp rests bought | 46 |
| Camp potions bought | 49 |
| Camp weapons bought | 17 |
| Camp armor bought | 0 |
| Potion loot drops | 172 |
| Gold loot drops | 307 |
| Weapon loot drops | 62 |
| Armor loot drops | 54 |

## Initial observations

### 1. Room 10 is reachable; the second ten-room segment is the main attrition zone

87.5% of the control runs clear the first boss threshold, while only 37.5% reach room 20. That makes the room 10-20 segment an important reference region when relic power is introduced.

A relic system that pushes room-20 reach dramatically above this level without compensating pressure is likely creating substantial power creep.

### 2. Potions are a tight survival resource

Across the cohort, players finish with only 0.28 potions on average despite:

- 3 starting potions per run
- 172 potion loot drops
- 123 supply potion purchases
- 49 camp potion purchases

The control strategy consumes 424 combat potions and 7 between-room potions. Relics that improve healing, reduce incoming damage or generate potions can therefore have a disproportionately large effect on survival and must be valued accordingly.

### 3. Weapon progression currently wins the camp spending competition

The strategy purchased 17 camp weapon upgrades and **zero** camp armor upgrades. Final armor levels came from armor loot in this cohort, while weapon progression combined loot and camp purchases.

This is partly a strategy-order effect, not proof that armor is intrinsically underpowered. Still, it is a useful signal: relics that alter gold economy or shop costs can change upgrade composition as well as raw player power.

### 4. Gold remaining at death/cap is not the same as spendable power

Average final gold is 103.25, but purchases are only available at specific supply/camp checkpoints. A high final balance can therefore coexist with survival pressure. Relic balance should not treat final gold as if it were continuously convertible into combat strength.

## Relics V1 comparison rules

When Relics V1 is introduced, rerun this exact cohort before changing the control strategy.

At minimum compare:

- average rooms cleared
- room 10/20/30 reach rates
- bosses cleared per run
- potion consumption and final inventory
- final weapon/armor levels
- shop purchase composition

The first Relics V1 target should be **interesting build variance**, not simply a large upward shift in every survival metric.

Rare high-synergy runs are allowed to become exceptionally strong. The median/control experience should remain demanding enough that relic choice and risk still matter.

## Interpretation warning

This simulation is deterministic and strategy-specific. It should be combined with real playtest telemetry before making final balance decisions. Its value is reproducibility: if the same strategy moves from 18.59 average rooms to, for example, 27 rooms after relics, we know the system introduced a large measurable power increase even before subjective playtesting.

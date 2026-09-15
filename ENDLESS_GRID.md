# Shared dungeon room — Practice and Somnia

The approved room presentation is shared by `/play`, `/practice`, and active
`/onchain` runs. `/play` remains the ten-room introduction. Practice and onchain
retain their existing endless progression, enemy selection, combat, shops,
boss cadence, relic rules and respective randomness authorities.

## Playing

- `/practice`: start without a wallet, account or payment. Walk toward the monster
  and use Approach, then Attack, Storm or Potion. The original starting kit is
  100 HP, three potions and no relic choice.
- After victory, tap the loot in the grid for automatic pickup on arrival, or
  **tap the north doorway directly** to walk past the loot and continue.
  There is no separate pickup/bypass button. E/Enter on the floor uses the door;
  arrows can still walk onto loot for automatic collection.
  In `/play` and new Practice runs, leaving loot forfeits the held gold, potion,
  weapon or armor reward. Pickup or leaving advances no combat turn or RNG.
  The existing boss relic keep/equip decision remains separate. Loot is left only
  on door arrival; canceling/retargeting the walk preserves it. Failed room entry
  preserves the previous state and pending loot for retry.
- **Enter room** walks to the north doorway and advances only on arrival.
- After a kill, **Potion +25 HP** is below the room report on mobile (in the
  recovery sidebar on desktop), replacing the former Relics control. It works
  before or after collecting loot. **Relics** moves to the top inventory/HUD
  slot during recovery and opens the existing collection. Full HP, empty stock
  and pending actions disable healing; floor loot and room turns are preserved.
  **Menu** also retains recovery healing. Combat controls keep their positions.
- There is no sustained exploration drone. Short action/character/outcome
  effects and the boss score retain their existing sound controls.
- Practice and onchain continue through rooms 11, 21, 31, 41 and beyond. The
  original four sets of monster artwork follow the ten-room tier cadence;
  the fourth artwork set continues in deeper tiers. Difficulty continues to
  follow the existing engine/contract; art selection creates no room cap.
- Kevin appears at the existing supply/camp stops, at the left outer visible
  floor edge for supplies and the right edge for camps, facing inward. Walk to
  him or use **Visit Kevin**. His shop shows the full clipped character and
  current HP, gold, potion count, weapon and armor above the purchase controls.
- The original monster illustration opens at fresh combat for two seconds after
  image load/error. Attacks, pending transactions, damage, and even a killing
  blow neither shorten nor restart that timer. **Close artwork** closes it
  explicitly; **View monster** reopens a manual view. Controls remain usable.

## Reused components and authority

`app/dungeon/scene.tsx` owns floor navigation, sprites and proximity interactions.
`app/dungeon/endless-room.tsx` supplies the shared responsive HUD, dialogs,
portrait, reports and slots for the existing controls. It neither calculates
combat nor imports a wallet/RPC. Existing Practice/Onchain combat docks, shop
buttons, relic collection, boss decisions, wallet entry and results are reused.

`app/practice/engine.ts` remains the Practice authority. `grid-state.ts` holds
only presentation/proximity state and deferred local reward deltas. Each killing
engine action runs once; collection applies that recorded delta once and leaving
it clears the delta without credit. Camp/relic healing and room-clear effects
retain their original timing. The engine's randomness and damage rules are not
reimplemented by the renderer.

The onchain frontend consumes confirmed snapshots and uses the existing wallet,
transaction, VRF and canonical synchronization paths. The contract already grants
gold and rolled loot when it resolves a kill. Floor pickup acknowledges the display
without a transaction. Tapping the door skips the display and uses the existing
room-entry transaction once, retaining the loot display on a failed entry. Both
preserve the confirmed reward balance. The UI states rewards are already credited.
Boss relic decisions still use the existing contract-required operation.

Somnia is the intended onchain deployment. The preserved legacy network build
remains a compatibility check. This change does not configure VRF, call
`setConsumer`, alter any contract, or resolve the previously reported adapter
mismatch. No live onchain playthrough is claimed by the local tests.

## Saving and compatibility

Practice writes the game and optional validated `grid` metadata together in its
existing v1 save envelope. Existing saves without grid metadata restore their
already-credited rewards and combat readiness; they never re-hold old loot.
New saves preserve uncollected drops and the selected approach phase through
reload. Invalid metadata preserves the save for explicit recovery/replacement.
Existing conflict and session-only handling remain in place. Other modes keep
separate save keys.

Onchain walking and pending floor loot are presentation state. Reload resumes
canonical chain state rather than recreating a reward from stale `lastLoot`.
Wallet/player identity scopes presentation separately from gameplay authority.

## Verification and first phone check

Exact automated results and the current preview are recorded in
`docs/phase-1-evidence/verification.md`. Approved Browser interaction is blocked
by its mandatory admin-policy check; Node/component tests and static art exports
are not substitutes for mobile browser verification.

First test on the phone:

1. Start `/practice`, walk freely, approach, attack during the artwork display.
2. Defeat the enemy and tap the doorway directly while loot is still visible.
   The avatar walks to the door and enters without collecting. Repeat by tapping
   the loot itself; it is collected automatically on arrival. Retarget a door
   walk to the floor and confirm loot is still available. Reload around both choices.
3. Visit Kevin after room 5. Check his face, HP, gold, potion count, weapon and
   armor; buy a supply and confirm the displayed values update.
4. Continue past the first boss and its relic decision into room 11. Confirm the
   next tier's original monster artwork appears and the run continues.

This remains a preview pending actual browser/phone checks and a separately
approved, working Somnia environment for live onchain verification.

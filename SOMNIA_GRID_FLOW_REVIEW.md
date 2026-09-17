# Somnia grid flow and contract authority review

Date: 2026-09-17

Historical baseline: this review describes commit `cfff2eb` and the legacy
contract behavior. The subsequent [local V4 implementation](./SOMNIA_PENDING_LOOT_V4.md)
adds authoritative pending loot; it has not been deployed. The later
[read-only preflight](./SOMNIA_READONLY_PREFLIGHT_2026-09-17.md) verifies live
core/adapter wiring while leaving historical pending requests unresolved.
Line references and verification counts below belong to the original review.

## Decision

The live onchain route already renders the shared walking grid for every loaded
player whose run is both started and active. No Somnia feature flag controls
that branch. Visual parity is therefore largely present.

End-to-end gameplay equality is blocked by the current contract. In particular,
the contract grants the complete room reward in the monster-defeating VRF
callback. The floor object is only a browser presentation, and walking through
the door cannot forfeit that reward. Exact pickup, forfeiture, reload, and
pre-pickup spending rules need a new contract state transition and a new Somnia
deployment.

No onchain transaction, deployment, live RPC read, or contract edit was made as
part of this review.

## Confirmed local behavior

### Which UI is active

- Active runs return the shared `EndlessRoom` unconditionally from
  `frontend/app/onchain-game.tsx:9962-10024`.
- `EndlessRoom` mounts `DungeonScene` keyed by room at
  `frontend/app/dungeon/endless-room.tsx:125-136`. This is the same floor,
  movement, proximity, loot, door, merchant, HUD, and dialog implementation
  used by Practice.
- The older card layout below the active-run return is unreachable while a
  player is active. It remains reachable for wallet entry, a player who has not
  started, and a finished run. There is also an intentional legacy relic-picker
  inside the grid when the selected contract does not support the V3 relic
  snapshot (`frontend/app/onchain-game.tsx:9889-9940`).

### Movement and approach

Movement and Approach are local presentation actions. Walking never spends a
turn or requests randomness. `DungeonScene` owns WASD, floor clicks, enemy
proximity, loot proximity, door arrival, and Kevin proximity in
`frontend/app/dungeon/scene.tsx:291-320` and
`frontend/app/dungeon/scene.tsx:371-459`.

A newly confirmed `startGame` or `enterNextRoom` result creates an unengaged
encounter, so the player must approach before combat
(`frontend/app/onchain-presentation.ts:65-79`). Combat submission is blocked
until that local approach has happened
(`frontend/app/onchain-game.tsx:7383-7437`).

This presentation state is not durable. A reload during a living encounter
resumes directly in combat, as explicitly tested at
`frontend/tests/onchain-presentation.test.ts:124-134`. Requiring Approach again
after reload can be implemented entirely in the frontend because Approach has
no gameplay authority. Persisting the exact pre-reload presentation phase would
also be frontend work, scoped by chain, wallet view, player, run, and room.

### Floor loot and door bypass

The source contract grants rewards inside the kill callback:

- `_defeatMonster` adds base gold, increments `roomsCleared`, and calls
  `_grantLoot` at `src/Delveworn.sol:1155-1166`.
- `_grantLoot` immediately changes gold, potions, weapon level, or armor level
  at `src/Delveworn.sol:1248-1281`.

The frontend calculates a floor display from the already-confirmed balance
delta (`frontend/app/onchain-presentation.ts:95-112`). Reaching the item only
clears that local display (`frontend/app/onchain-game.tsx:8849-8870`). Reaching
the ordinary door submits the existing room-entry transaction; it does not
remove the credited reward (`frontend/app/onchain-presentation.ts:170-190`).
The current copy states this directly at
`frontend/app/onchain-game.tsx:9942-9946`.

The focused test deliberately verifies that acknowledgment leaves the credited
snapshot unchanged (`frontend/tests/onchain-presentation.test.ts:28-40`). On a
reload after a kill, the local floor record is gone and canonical contract state
maps directly to recovery or the relic reward. It cannot recreate an unclaimed
drop.

Therefore the current Somnia behavior is not equal to Practice's physical
pickup rules. A door bypass only skips the picture. It does not forfeit gold,
potion, weapon, or armor, and already-credited gold can fund Kevin purchases
before the player reaches the floor item.

### Kevin and trade timing

The shared room can show Kevin while local floor loot is still visible.
`EndlessRoom` enables the merchant in both loot and recovery phases at
`frontend/app/dungeon/endless-room.tsx:55-60`, and the scene waits for his
arrival before opening the shop.

Contract authority is:

- Supply stops are available after every cleared multiple of five, except while
  a relic offer is open (`src/Delveworn.sol:1197-1209`).
- The pre-boss camp opens after rooms 9, 19, and so on, and grants its arrival
  heal immediately (`src/Delveworn.sol:1218-1239`).
- Bandage, potion, rest, weapon, and armor purchases are direct transactions
  without VRF (`src/Delveworn.sol:558-674`).
- A room-10 boss resets the supply stop, but its shop remains unavailable until
  the relic offer is claimed.

The appearance and trade order fit the shared room. Spend authority does not:
the current contract has already included floor gold in `player.gold`.

### Potions

Combat potions are contract and VRF actions. They heal, apply a reduced enemy
reply, and observe the normal/boss limits of two/three uses
(`src/Delveworn.sol:484-511`, `src/Delveworn.sol:1108-1146`, and
`src/Delveworn.sol:1469-1475`).

When `monsterHp == 0`, `usePotion` instead consumes one potion and heals up to
25 HP immediately, without VRF (`src/Delveworn.sol:492-505`). The grid exposes
that safe action both before floor-loot acknowledgment and afterward in
recovery (`frontend/app/onchain-game.tsx:8819-8834` and
`frontend/app/onchain-game.tsx:8913-8935`). The presentation adapter preserves
the floor object across that confirmed heal, covered at
`frontend/tests/onchain-presentation.test.ts:43-69`.

A safe potion still waits for wallet/session submission, inclusion, and a
canonical state read. It does not wait for a VRF callback.

### Boss relic and tier continuation

A boss kill immediately rolls one authoritative relic offer at
`src/Delveworn.sol:1168-1179`. The grid shows regular floor loot first. A door
pass over boss loot clears the local floor display and reveals the relic choice,
without entering another room (`frontend/app/onchain-presentation.ts:174-190`).

`claimRelic(bool)` owns the keep/equip decision. `enterNextRoom` rejects while
the offer is open (`src/Delveworn.sol:429-449` and
`src/Delveworn.sol:514-523`). After the room-10 claim, the room-10 supply stop is
available; after recovery, walking to the door submits room entry and VRF for
room 11. The same cadence repeats every ten rooms and the boss tier contributes
to the relic rarity roll.

This state survives reload because it is in the contract. The preceding floor
presentation does not survive reload.

### Confirmation boundaries

- Free movement and Approach are immediate local actions.
- Floor pickup and floor bypass are currently immediate local acknowledgments,
  except that an ordinary door then submits `enterNextRoom`.
- Attack, Storm, combat Potion, start, and room entry wait for transaction
  submission/inclusion, a VRF callback, and canonical readiness.
- Safe Potion, Kevin purchases, and relic claim/equip wait for transaction
  submission/inclusion and a canonical read, without VRF.
- `busy` combines wallet transitions, transaction state, pending randomness,
  and the canonical-ready lock at `frontend/app/onchain-game.tsx:8761-8775`.

Adding authoritative physical pickup necessarily adds a confirmed contract
operation for pickup, unless it is combined with another room transition.

## Minimum contract and frontend change

Movement and Approach should remain local. The minimum authority change is a
per-player pending room reward that exists in contract state.

1. On a kill, calculate the base-gold and rolled-loot result once, but store it
   as pending rather than changing spendable gold, potion stock, weapon level,
   or armor level.
2. Store enough data to restore and validate it: availability, cleared room,
   total pending gold, rolled loot type, and rolled amount. Emit a rolled/pending
   event rather than claiming that the loot was granted.
3. Add an idempotent one-shot collection operation that applies the pending
   deltas and clears them.
4. Let an ordinary door transition atomically clear pending loot without credit
   and request the next encounter, so bypass remains one player transaction.
5. Add a boss-safe discard operation, or a single explicit settlement function
   with `collect` and `enter` intent, because the relic gate correctly prevents
   entering before the boss relic decision.
6. Require floor loot to be settled before claiming the boss relic. Keep safe
   Potion and eligible Kevin trades available while loot is pending.
7. Define potion-cap behavior when a potion lies on the floor and Kevin can sell
   another potion before collection. Reserving the pending potion against the
   cap preserves a maximum inventory of five.
8. Add pending reward fields to a new frontend snapshot, update the hand-written
   ABI and session-key selector allowlist, and derive the floor object from that
   snapshot. This makes reload and wallet restoration deterministic.
9. Keep the existing confirmed-snapshot, pending-action, VRF, canonical-sync,
   wallet-view, and retry guards. Do not optimistically apply a pickup or bypass.

This change should be implemented and tested locally before any deployment:

- Solidity unit tests for exactly-once collection, ordinary bypass, boss
  discard then relic claim, reload-readable pending state, shop spending, safe
  Potion before pickup, potion-cap reservation, failed entry preservation, and
  every ten-room tier boundary.
- Frontend adapter tests for confirmed collection/bypass, failed/rejected sends,
  reload, boss sequencing, session/EOA scope changes, and pending controls.
- Shared room tests for Approach, loot proximity, direct door targeting, Kevin
  arrival, safe Potion, reward dialog, and room 10 to room 11 continuation.

## Deployment boundary

The local default and documentation point to Somnia Shannon contract
`0x07c5D071132ae95C3708031790b3feC740F4c292`
(`frontend/app/chain-config.ts:223-269` and `README.md:264-275`). That address is
environment-overridable. The repository does not contain a deployment receipt,
verified explorer ABI, or deployed bytecode proof tying that address to the
current `src/Delveworn.sol`.

The frontend uses a hand-maintained ABI and deliberately falls back from
`frontendSnapshotV3` to older snapshots at
`frontend/app/onchain-game.tsx:1943-2087`. Local source compatibility therefore
does not prove that the selected live address supports the same surface.

The core is a direct deployment, not an upgradeable proxy, and its coordinator
is immutable (`src/Delveworn.sol:223` and constructor at line 314). The Somnia
adapter also binds its consumer only once
(`src/adapters/SomniaNativeVRFAdapter.sol:51-58`). A contract-authority change
therefore requires both a new Delveworn core and a fresh Somnia VRF adapter,
followed by an explicit frontend address cutover. Existing player state does not
move automatically.

Before authorizing any future chain write, use read-only checks to establish:

- the production environment's exact selected address and chain;
- deployed bytecode/source/ABI correspondence;
- the adapter's coordinator, callback settings, owner, and bound consumer;
- whether the old core or adapter has pending VRF requests and which player runs
  are active;
- new core/adapter callback behavior on Shannon;
- the product decision for preserving or retiring active players at the old
  address.

No prior VRF request is assumed resolved. A frontend cutover must not silently
strand an in-flight action or present old credited rewards as pending loot.

## Verification performed

The following local, network-free focused suite passed 25 of 25 tests:

```text
node --import tsx --test \
  tests/onchain-presentation.test.ts \
  tests/dungeon-movement.test.ts \
  tests/inventory-potions.test.tsx
```

These tests confirm the current adapter and grid behavior. They do not verify
the deployed Somnia bytecode, live RPC state, VRF fulfillment, wallet UX, or a
physical device.

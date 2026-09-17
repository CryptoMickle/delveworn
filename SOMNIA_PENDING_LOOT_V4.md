# Somnia pending loot V4

Date: 2026-09-17

Status: local implementation and tests complete; no live deployment or address change

## Behavior

Room rewards are authoritative contract state. A killing combat callback rolls
the base gold and one loot result, records them as pending, and leaves gold,
potions, weapon level, and armor level unchanged until settlement.

- `collectLoot()` applies the pending reward once and is safely repeatable
  between rooms.
- `discardLoot()` clears it without credit and is safely repeatable between
  rooms.
- Ordinary `enterNextRoom()` discards pending loot in the same transaction
  before requesting the next monster. A reverted request preserves the reward.
- Boss loot must be collected or discarded before the relic can be claimed.
- Safe potion use and otherwise eligible camp or supply purchases remain
  available while loot is pending.
- A pending potion reserves inventory capacity against the five-potion cap.
- `startGame()` clears any stale pending reward.

Random-number consumption, combat rolls, reward formulas, and legacy snapshot
field order are unchanged.

## Contract API

```solidity
struct PendingRoomLoot {
    bool available;
    uint256 room;
    uint256 gold;
    LootType lootType;
    uint256 lootAmount;
}

struct FrontendSnapshotV4 {
    FrontendSnapshotV3 base;
    PendingRoomLoot pendingLoot;
}
```

The new public surface is:

- `pendingRoomLoot(address)`
- `frontendSnapshotV4(address)`
- `collectLoot()`
- `discardLoot()`
- `LootRolled(address indexed player, uint256 indexed room)`
- `LootCollected(address indexed player, uint256 indexed room)`
- `LootDiscarded(address indexed player, uint256 indexed room)`

The complete reward is read from `pendingRoomLoot` or
`frontendSnapshotV4`; the compact events identify the transition. The legacy
`LootGranted` event remains declared for ABI continuity but is no longer
emitted. Pending-flow reverts use `BossLootPending()`,
`LootActionUnavailable()`, `GameNotActive()`, and `RandomnessPending()` custom
errors. Other low-level validation paths also use typed custom errors from the
contract ABI.

## Local verification

The reproducible build profile is pinned in `foundry.toml`:

```text
Solidity 0.8.35
EVM Prague
optimizer enabled, 200 runs
via IR enabled
```

Results at this profile:

- full Forge suite: 152 passed, 0 failed;
- `Delveworn` runtime: 24,255 bytes;
- EIP-170 runtime margin: 321 bytes;
- `Delveworn` initcode: 24,437 bytes.

CI checks production sizes separately from test-only subclasses, then compiles
all Solidity and runs the complete suite. This preserves the production
EIP-170 guard without treating added test harness methods as deployable cores.

## Migration prerequisites and limitations

The existing Somnia Shannon addresses are unchanged. This work performed no
deployment, RPC write, `setConsumer` call, contract-address cutover, or player
state migration.

A future cutover requires a new core and a fresh Somnia VRF adapter because the
core coordinator is immutable and the adapter consumer can only be bound once.
Before any write, the migration owner must:

1. reconcile old adapter request and fulfillment history, including abandoned
   retries;
2. reproduce source and deployed bytecode for the selected old and new core and
   adapter pair;
3. validate the new callback path and configuration on Shannon;
4. choose how active runs at the old address are preserved or retired; and
5. make an explicit frontend address cutover only after the new pair is ready.

The deployed adapter has no aggregate or enumerable pending-request getter, so
historical pending state remains unresolved by getter-only checks. See the
[Somnia Shannon read-only readiness preflight](./SOMNIA_READONLY_PREFLIGHT_2026-09-17.md)
for the pinned live topology evidence and its exact limits. The original
[grid-flow authority review](./SOMNIA_GRID_FLOW_REVIEW.md) explains why this
contract transition is required.

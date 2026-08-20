# RISE Dungeon

RISE Dungeon is an experimental fully onchain dungeon crawler built in Solidity for **RISE Chain**.

The game uses verifiable randomness (VRF) for gameplay actions such as monster generation, combat and special attacks.

The repository also includes a minimal `VRFProbe` contract for measuring VRF request-to-fulfillment latency independently of the game logic.

> **Status:** Work in progress. The contracts have not been audited and are not production-ready.

## Project overview

RISE Dungeon currently includes:

* Fully onchain player state
* Procedurally selected enemies
* Zombie, Goblin, Orc and Dungeon Lord encounters
* Normal attacks
* Storm attacks
* Critical hits
* Potions
* Gold and loot
* Weapon upgrades
* Armor upgrades
* Supply stops
* Camps
* Boss encounters
* Scaling enemy stats
* VRF-backed gameplay resolution

## Contracts

### `RiseDungeon.sol`

The main game contract.

Randomness is used for several types of gameplay actions:

* Monster generation
* Normal attacks
* Storm attacks
* Potion-related combat outcomes

Only one VRF request may be pending for a player at a time.

### `VRFProbe.sol`

A minimal VRF consumer created specifically for testing RISE VRF latency without the additional game logic.

The probe:

* requests one random number;
* records when the request was made;
* records when fulfillment arrives;
* stores the returned random number;
* emits events for both request and fulfillment.

This allows request-to-fulfillment latency to be measured directly.

### `MockVRFCoordinator.sol`

A local mock VRF coordinator used by the Foundry test suite.

It allows randomness requests and callbacks to be tested deterministically without relying on a live network.

## VRF latency investigation

RISE Dungeon is designed around frequent randomness-dependent interactions.

For this type of game, VRF latency directly affects gameplay because an action cannot be resolved until the randomness callback arrives.

During manual live-network testing, some VRF requests have taken approximately:

**60–120+ seconds**

The request transaction itself is accepted normally. The observed delay occurs while waiting for VRF fulfillment.

To make the issue easier to isolate, this repository includes `VRFProbe.sol`.

The probe is intended to help distinguish between latency caused by:

* the game contract;
* frontend or RPC polling;
* or the VRF coordinator / fulfillment process.

## Timeout and retry

The game currently uses a VRF timeout of:

```solidity
uint256 public constant VRF_TIMEOUT = 30 seconds;
```

If fulfillment has not arrived after the timeout, the player can call:

```solidity
retryRandomness()
```

The old request is invalidated and a replacement request is submitted.

A late callback from the old request cannot resolve the action after the retry has replaced it.

This retry system is primarily a resilience mechanism while VRF latency is being investigated.

## Testing

The project uses Foundry.

Run the full test suite with:

```bash
forge test
```

Current status:

**64 tests passed, 0 failed.**

The tests cover both gameplay and VRF-related behavior, including:

* normal randomness fulfillment;
* coordinator access control;
* invalid request handling;
* incorrect random-number counts;
* VRF timeout handling;
* retry after timeout;
* prevention of premature retry;
* rejection of late callbacks from superseded requests;
* combat;
* critical hits;
* Storm attacks;
* armor;
* weapons;
* potions;
* loot;
* supply stops;
* camps;
* boss progression.

## Local development

Clone the repository including the Foundry submodule:

```bash
git clone --recurse-submodules https://github.com/CryptoMickle/rise-dungeon.git
cd rise-dungeon
```

Build:

```bash
forge build
```

Test:

```bash
forge test
```

Format:

```bash
forge fmt
```

## Repository structure

```text
.
├── .github/
│   └── workflows/
│       └── test.yml
├── lib/
│   └── forge-std/
├── src/
│   ├── MockVRFCoordinator.sol
│   ├── RiseDungeon.sol
│   └── VRFProbe.sol
├── test/
│   └── RiseDungeon.t.sol
├── foundry.toml
└── README.md
```

## Current development focus

Current priorities include:

* measuring live RISE VRF latency;
* identifying the source of delayed fulfillment;
* testing repeated VRF requests under gameplay conditions;
* improving UX while randomness is pending;
* continuing contract testing;
* developing the frontend.

## Security

This project is experimental.

Do not use the contracts with funds or assets of material value without appropriate review and auditing.

Never commit private keys, seed phrases, `.env` files or other signing credentials.

## Feedback

Technical feedback is welcome, particularly regarding:

* RISE Chain VRF integration;
* VRF fulfillment latency;
* Solidity architecture;
* gas optimization;
* fully onchain game design.

For VRF debugging, `VRFProbe.sol` provides the smallest relevant reproduction in this repository.

# Delveworn

Delveworn is an experimental fully onchain dungeon crawler built in Solidity.

The game core is chain-agnostic. Gameplay, balance, player state and progression live in a single core contract, while chain/provider-specific randomness is isolated behind adapters.

The game uses verifiable randomness for gameplay actions such as monster generation, combat and special attacks.

> **Status:** Work in progress. The contracts have not been audited and are not production-ready.

## Project overview

Delveworn currently includes:

- Fully onchain player state
- Procedurally selected enemies
- Zombie, Goblin, Orc and Dungeon Lord encounters
- Normal attacks and Storm attacks
- Critical hits
- Potions
- Gold and loot
- Weapon and armor upgrades
- Supply stops and camps
- Boss encounters
- Scaling enemy stats
- Randomness-backed gameplay resolution

## Architecture

```text
Delveworn -> randomness adapter -> provider
          <- randomness adapter <- provider callback
```

`Delveworn.sol` contains the game domain. Provider-specific configuration belongs in adapters and deployment configuration, not in combat logic.

Current adapter implementations include:

- `LegacyVRFAdapter.sol`
- `ChainlinkV25DirectFundingAdapter.sol`

See `docs/CHAIN_AGNOSTIC_ARCHITECTURE.md` for the architecture rules.

## Main contracts

### `Delveworn.sol`

The main game contract. Only one randomness request may be pending for a player at a time.

Randomness is used for:

- Monster generation
- Normal attacks
- Storm attacks
- Potion-related combat outcomes

### `VRFProbe.sol`

A minimal randomness consumer for measuring request-to-fulfillment latency independently of game logic.

### `MockVRFCoordinator.sol`

A deterministic local mock used by the Foundry test suite.

## Timeout and retry

The core currently uses:

```solidity
uint256 public constant VRF_TIMEOUT = 30 seconds;
```

If fulfillment has not arrived after the timeout, the player can call `retryRandomness()`. The superseded request is invalidated, so a late callback from the old request cannot resolve the action.

## Testing

The project uses Foundry:

```bash
forge fmt --check
forge build --sizes
forge test -vvv
```

The suite covers gameplay, progression, randomness fulfillment, timeout/retry behavior and rejection of superseded callbacks.

## Local development

The GitHub repository still uses its original repository slug while the product/code naming is being migrated:

```bash
git clone --recurse-submodules https://github.com/CryptoMickle/rise-dungeon.git
cd rise-dungeon
forge build
forge test
```

## Repository structure

```text
.
├── .github/workflows/test.yml
├── docs/CHAIN_AGNOSTIC_ARCHITECTURE.md
├── lib/forge-std/
├── script/DeploySomniaShannon.s.sol
├── src/
│   ├── adapters/
│   ├── interfaces/
│   ├── Delveworn.sol
│   ├── MockVRFCoordinator.sol
│   └── VRFProbe.sol
├── test/
│   ├── ChainlinkV25DirectFundingAdapter.t.sol
│   ├── Delveworn.t.sol
│   └── LegacyVRFAdapter.t.sol
└── foundry.toml
```

## Deployment philosophy

A new chain deployment should normally require only:

1. Selecting or implementing the appropriate randomness adapter.
2. Deploying that adapter with chain/provider configuration.
3. Deploying the same `Delveworn` core against the adapter.
4. Configuring the frontend deployment registry.

The game core should not be forked per chain.

## Security

This project is experimental. Do not use the contracts with funds or assets of material value without appropriate review and auditing.

Never commit private keys, seed phrases, `.env` files or other signing credentials.

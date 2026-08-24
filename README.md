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
- `DevRandomnessAdapter.sol` — deterministic and **DEV/TEST ONLY**

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

### `DevRandomnessAdapter.sol`

A deterministic development adapter that preserves the production-like two-transaction request/callback lifecycle without depending on an external VRF service. It can derive repeatable words from stored request data or accept explicit words for exact scenario reproduction.

This adapter is operator-controlled and must never be used as a production or competitive randomness source.

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

The deterministic pre-relic balance control can be rerun with:

```bash
forge test --match-contract BalanceBaselineTest -vvv
```

See `docs/BALANCE_BASELINE.md` for the strategy definition, recorded baseline and interpretation rules.

## Local development without external VRF

External testnet VRF availability should not block combat, relic or balance development.

Deploy a local development stack against Anvil:

```bash
anvil
```

In another terminal, use a local Anvil key as `DEV_PRIVATE_KEY` and deploy:

```bash
forge script script/DeployDev.s.sol:DeployDev \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key "$DEV_PRIVATE_KEY"
```

Copy the deployed `DevRandomnessAdapter` address and start the auto-fulfiller:

```bash
DEV_RANDOMNESS_ADAPTER=0x... \
DEV_PRIVATE_KEY="$DEV_PRIVATE_KEY" \
bash scripts/dev-autofulfill.sh
```

The watcher polls the local adapter and fulfills pending requests in separate transactions. This keeps Delveworn's asynchronous request/callback semantics while removing the external provider dependency.

`DEV_OWNER_ADDRESS` can be used instead of `DEV_PRIVATE_KEY` when the local RPC exposes an unlocked adapter-owner account.

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
├── docs/
│   ├── BALANCE_BASELINE.md
│   └── CHAIN_AGNOSTIC_ARCHITECTURE.md
├── lib/forge-std/
├── script/
│   ├── DeployDev.s.sol
│   └── DeploySomniaShannon.s.sol
├── scripts/
│   └── dev-autofulfill.sh
├── src/
│   ├── adapters/
│   ├── interfaces/
│   ├── Delveworn.sol
│   ├── MockVRFCoordinator.sol
│   └── VRFProbe.sol
├── test/
│   ├── BalanceBaseline.t.sol
│   ├── ChainlinkV25DirectFundingAdapter.t.sol
│   ├── Delveworn.t.sol
│   ├── DevRandomnessAdapter.t.sol
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

# Delveworn

Delveworn is an experimental dungeon crawler with a Solidity/Foundry game core and a Next.js frontend in one monorepo.

The onchain game keeps gameplay, balance, player state and progression in the `Delveworn` contract. Chain- and provider-specific randomness is isolated behind adapters. The frontend also includes a separate local Practice Mode for learning the game without a wallet or transactions.

> **Status:** Public testnet beta. The contracts have not been audited and are not production-ready.

## Repository structure

```text
.
├── .github/workflows/
│   ├── frontend.yml
│   └── test.yml
├── docs/
├── frontend/              # Next.js application
├── lib/                   # Foundry dependencies
├── script/                # Deployment scripts
├── scripts/               # Contract development utilities
├── src/                   # Solidity contracts and adapters
├── test/                  # Foundry test suite
├── foundry.toml
└── README.md
```

The Foundry project remains at the repository root. All frontend commands run from `frontend/`.

## Game modes and trust boundaries

### Practice Mode

Practice Mode runs locally in the browser and requires no wallet, RPC calls, transactions or VRF. Its randomness and game state are client-side simulations intended for learning encounters, testing builds and previewing the gameplay loop.

Practice Mode is not onchain, does not persist authoritative state and does not provide verifiable randomness.

### Onchain Mode

Onchain Mode connects a wallet to a configured deployment. Player state and game actions are handled by the deployed `Delveworn` contract, and randomness-backed actions resolve through the configured provider and callback adapter.

Onchain Mode depends on the selected network, RPC availability, wallet confirmations and the deployed contract address. The current public deployment targets RISE Testnet.

## Project overview

Delveworn currently includes:

- Fully onchain player state
- Procedurally selected enemies
- Zombie, Goblin, Orc and Dungeon Lord encounters
- Normal and Storm attacks
- Critical hits, potions, gold and loot
- Weapon and armor upgrades
- Supply stops and camps
- Boss encounters
- One random relic drop after every boss
- Relic collection, duplicate counters and between-room relic switching
- Scaling enemy stats
- Randomness-backed gameplay resolution

## Contract architecture

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

The frontend uses `frontendSnapshotV3()`, `claimRelic(bool)` and `equipOwnedRelic(Relic)` for full relic parity. Older deployments remain readable through a compatibility fallback but do not provide the complete relic progression.

## Requirements

- Foundry
- Node.js 22
- npm

Clone the repository with its Foundry dependencies:

```bash
git clone --recurse-submodules https://github.com/CryptoMickle/rise-dungeon.git
cd rise-dungeon
```

The repository keeps its original GitHub slug while the monorepo migration and product rename are reviewed.

## Contract development

Run the contract checks from the repository root:

```bash
forge fmt --check
forge build --sizes
forge test -vvv
```

The suite covers gameplay, progression, randomness fulfillment, timeout/retry behavior, relic rules and rejection of superseded callbacks.

The deterministic pre-relic balance control can be rerun with:

```bash
forge test --match-contract BalanceBaselineTest -vvv
```

See `docs/BALANCE_BASELINE.md` for the recorded baseline and interpretation rules.

## Frontend development

Install the locked dependencies:

```bash
cd frontend
npm ci
```

Create `frontend/.env.local` from the committed template and set the deployed contract address:

```bash
cp .env.example .env.local
```

The preferred deployment-specific key is:

```text
NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS=0x...
```

`NEXT_PUBLIC_DUNGEON_ADDRESS` remains supported as a legacy fallback.

Start the development server or run the production checks:

```bash
npm run dev
npm run lint
npm run build
```

## Local contract development without external VRF

External testnet VRF availability should not block contract, relic or balance development. Start Anvil:

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

Then start the deterministic auto-fulfiller with the deployed adapter address:

```bash
DEV_RANDOMNESS_ADAPTER=0x... \
DEV_PRIVATE_KEY="$DEV_PRIVATE_KEY" \
bash scripts/dev-autofulfill.sh
```

The development adapter preserves the two-transaction request/callback lifecycle. It is operator-controlled and must never be used as a production or competitive randomness source.

## Deployment

The existing Vercel project should use this repository with `frontend` as its Root Directory. Configure the production deployment variables in Vercel rather than committing `.env.local`.

At minimum, the selected public deployment needs its contract address. RISE Testnet uses:

```text
NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS
```

Changes must pass the path-filtered contract and frontend workflows before production configuration is changed.

## Security

This project is experimental. Do not use the contracts with funds or assets of material value without appropriate review and auditing.

Never commit private keys, seed phrases, `.env` files or other signing credentials. Only documented `.env.example`, `.env.sample` and `.env.template` files belong in Git.

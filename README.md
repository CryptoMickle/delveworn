# Delveworn

Delveworn is an experimental onchain dungeon crawler with a Solidity/Foundry game core and a Next.js frontend in one public monorepo.

The onchain game keeps gameplay, balance, player state and progression in the `Delveworn` contract. Chain- and provider-specific randomness is isolated behind adapters. The frontend also includes a separate local Practice Mode for learning the game without a wallet or transactions.

> **Status:** Public testnet beta. The contracts have not been audited and are not production-ready.

## Try Delveworn

| Experience | Link | What it demonstrates |
| --- | --- | --- |
| Practice Mode | [Play without a wallet](https://delveworn.vercel.app/practice) | The complete local learning and combat loop with simulated state and randomness. |
| Onchain beta | [Open the RISE Testnet game](https://delveworn.vercel.app/onchain) | Wallet-connected gameplay against the public testnet deployment. |

The production frontend is currently configured for RISE Testnet contract [`0xf5d7Da409545E74bD9d4fEaD8365AF0158c43DbA`](https://explorer.testnet.riselabs.xyz/address/0xf5d7Da409545E74bD9d4fEaD8365AF0158c43DbA).

Practice Mode is the fastest way to review the complete gameplay loop. Onchain Mode demonstrates the contract-backed state, wallet flow and randomness lifecycle, but depends on testnet and wallet availability.

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
- `SomniaNativeVRFAdapter.sol` — Somnia Reactivity-native, drand-mixed VRF
- `DevRandomnessAdapter.sol` — deterministic and **DEV/TEST ONLY**

See `docs/CHAIN_AGNOSTIC_ARCHITECTURE.md` for the architecture rules.

The frontend uses `frontendSnapshotV3()`, `claimRelic(bool)` and `equipOwnedRelic(Relic)` for full relic parity. Older deployments remain readable through a compatibility fallback but do not provide the complete relic progression.

## Supported and tested environments

| Environment | Status | Scope |
| --- | --- | --- |
| RISE Testnet | Public beta | Current wallet-connected deployment and frontend integration. |
| Somnia Shannon Testnet | Adapter and deployment path test-covered | Native verifiable VRF requests use Somnia's coordinator-funded Reactivity/drand flow. No public Delveworn deployment is advertised until its address and live fulfillment are verified. |
| Local Anvil | Development only | Deterministic contract, relic, balance and request/callback testing through `DevRandomnessAdapter`. |
| Chainlink VRF v2.5 adapter | Implemented and test-covered | Adapter support exists, but no public deployment is presented as production-ready. |
| Other EVM networks | Architecture target | The core is designed for adapter-based deployments; these networks are not yet advertised as supported public deployments. |

## Requirements

- Foundry
- Node.js 22
- npm

Clone the repository with its Foundry dependencies:

```bash
git clone --recurse-submodules https://github.com/CryptoMickle/delveworn.git
cd delveworn
```

The former standalone frontend repository is archived as rollback history. Current contract and frontend development happens in this monorepo.

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

## Somnia Shannon deployment

`SomniaNativeVRFAdapter` translates Delveworn's provider-neutral request and callback interface to Somnia's native `requestRandomWords` / `rawFulfillRandomWords` ABI. Requests always set `useVerifiableEntropy: true`. The default Shannon coordinator is `0x0834459256bbb8d2efee23dc6c3f1722266182dd`.

Deploy the adapter and a fresh Delveworn core with the native coordinator:

```bash
forge script script/DeploySomniaShannon.s.sol:DeploySomniaShannon \
  --rpc-url https://dream-rpc.somnia.network \
  --gas-limit 150000000 \
  --broadcast \
  --private-key "$SOMNIA_DEPLOYER_PRIVATE_KEY"
```

The high transaction gas limit accommodates Shannon's deployment gas accounting; unused gas is not charged. The script deliberately defaults to Somnia's maximum `2_500_000` callback gas and minimum `16`-block commit delay. Override them only within Somnia's documented bounds with `SOMNIA_VRF_CALLBACK_GAS_LIMIT` and `SOMNIA_VRF_COMMIT_DELAY_BLOCKS`. The native coordinator pays entropy-delivery costs; the adapter requires no subscription or prefunding.

## Deployment

Vercel is connected to this repository with `frontend` as its Root Directory. Changes merged to `main` trigger the production deployment. Configure deployment variables in Vercel rather than committing `.env.local`.

At minimum, the selected public deployment needs its contract address. RISE Testnet uses:

```text
NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS
```

Changes must pass the path-filtered contract and frontend workflows before they are merged to `main`.

## Roadmap

1. **Public beta hardening:** continue gameplay QA, deployment documentation and frontend reliability work.
2. **Audit readiness:** expand security review, invariants and operational documentation before any production-value deployment.
3. **Deployment registry:** move chain IDs, RPCs, explorers, contract addresses and wallet capabilities into a shared deployment configuration.
4. **Additional networks and randomness providers:** deploy the same game core with network-appropriate adapters rather than forking combat logic.
5. **Production readiness:** consider a mainnet release only after independent review, an audit and explicit asset-risk controls.

This roadmap describes technical direction, not committed dates or a claim of production readiness.

## Related project: Market Dungeon

[Market Dungeon](https://github.com/CryptoMickle/market-dungeon) is a separate read-only hackathon experiment that turns live dreamDEX Event Contracts on Somnia into a roguelite prediction mechanic. It shares some visual language with Delveworn, but it is a separate repository, deployment and trust model; it is not a Delveworn package or onchain integration.

- [Play Market Dungeon](https://market-dungeon.vercel.app)
- [Review its judge flow and onchain verification](https://github.com/CryptoMickle/market-dungeon#two-minute-judge-demo)

## Security

This project is experimental. Do not use the contracts with funds or assets of material value without appropriate review and auditing.

Never commit private keys, seed phrases, `.env` files or other signing credentials. Only documented `.env.example`, `.env.sample` and `.env.template` files belong in Git.


## License

The source code in this repository is available under the [MIT License](LICENSE).

The Delveworn name and logos are not licensed for trademark use. Original artwork and other visual assets are excluded from the MIT grant unless an asset is explicitly marked otherwise; rights remain with their respective owners.

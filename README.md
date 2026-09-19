# Delveworn

Delveworn is an experimental onchain dungeon crawler with a Solidity/Foundry game core and a Next.js frontend in one public monorepo.

The onchain game keeps gameplay, balance, player state and progression in the `Delveworn` contract. Chain- and provider-specific randomness is isolated behind adapters. The frontend also includes a separate local Practice Mode for learning the game without a wallet or transactions.

> **Status:** Public testnet beta. The contracts have not been audited and are not production-ready.

## Try Delveworn

The new **First Descent** vertical slice is available locally at `/play`: ten
connected 2D rooms, three training relic builds, enemy intentions, supplies,
camp and a boss. It starts without a wallet. This working-branch feature is
not yet published or fully browser-verified. See [First Descent](FIRST_DESCENT.md)
for controls, recovery, test commands and the blind-test gate.

| Experience | Link | What it demonstrates |
| --- | --- | --- |
| Weekly Verified Challenge | [Play the current weekly seed](https://delveworn.app/challenge) | A wallet-free 10-room sprint with deterministic replay verification and challenge links. |
| Practice Mode | [Play without a wallet](https://delveworn.app/practice) | The complete local learning and combat loop with simulated state and randomness. |
| The Living Dungeon | `/living-dungeon` (local working branch) | An experimental six-scene story run with player-shaped pacts, bounded enemy beliefs and deterministic consequences. |
| Onchain beta | [Open the Somnia Testnet game](https://delveworn.app/onchain) | Wallet-connected gameplay against the public testnet deployment. |
| Previous version | [Open the original frontend](https://delveworn.vercel.app) | Preserved separately from the upgraded experience. |
| Somnia Verified Run | [Open the canonical Somnia game](https://delveworn-somnia.vercel.app/onchain) | Contract-backed state, popup-free sponsored actions and Somnia-native verifiable randomness. |

The upgraded frontend at `delveworn.app` uses Somnia Shannon Testnet (chain `50312`) and the existing contract [`0x07c5…c292`](https://shannon-explorer.somnia.network/address/0x07c5D071132ae95C3708031790b3feC740F4c292), with Thirdweb session keys for Popup-free Play and standard MetaMask transactions as an alternative. The original `delveworn.vercel.app` remains on RISE Testnet contract [`0xf5d7…3DbA`](https://explorer.testnet.riselabs.xyz/address/0xf5d7Da409545E74bD9d4fEaD8365AF0158c43DbA). The separate `delveworn-somnia.vercel.app` configuration is unchanged.

Practice Mode is the fastest way to review the complete gameplay loop. Onchain Mode demonstrates the contract-backed state, wallet flow and randomness lifecycle, but depends on testnet and wallet availability.

For a concise presentation sequence, use the [Somnia Verified Run 90-second demo](docs/SOMNIA_VERIFIED_RUN_DEMO.md).

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

The frontend source now serves a neutral mode-selection home at `/`, the current wallet-free challenge at `/challenge`, local Practice at `/practice`, the experimental Living Dungeon at `/living-dungeon`, and the configured wallet game at `/onchain`. The historical `/rise-testnet-demo` alias still resolves to the onchain route. The wallet implementation lives in `frontend/app/onchain-game.tsx`; importing the home, challenge, Practice or Living Dungeon route does not initialize the wallet bridge. See [The Living Dungeon](THE_LIVING_DUNGEON.md) for its Pact V0 rules and AI boundary, [The Living Dungeon V2](THE_LIVING_DUNGEON_V2_PLAN.md) for the conversation-first delivery roadmap and [The Living Dungeon Master Plan](THE_LIVING_DUNGEON_MASTER_PLAN.md) for the long-term product direction.

For local frontend checks, run `npm test`, `npm run lint`, and `npm run build`. `npm run test:e2e` runs the interaction suite on desktop Chromium, Android-sized Chromium and small iPhone-sized WebKit; install its browsers with `npx playwright install chromium webkit`. The browser suite seeds explicitly local Practice states and does not submit onchain actions. Emulation is not a physical-device or live-wallet test.

## Game modes and trust boundaries

### Practice Mode

Practice Mode runs locally in the browser and requires no wallet, RPC calls, transactions or VRF. Its randomness and game state are client-side simulations intended for learning encounters, testing builds and previewing the gameplay loop.

Practice Mode is not onchain, does not persist authoritative state and does not provide verifiable randomness.

Local saves are validated before restoration. Unavailable storage leaves the run playable, while malformed or newer-format saves stay untouched until the player explicitly replaces them. Cross-tab changes pause saving to protect the other run. Shared results label Practice progress as self-reported local simulation.

### Weekly Verified Challenge

Weekly Challenge runs the same local game rules with a controlled seed derived from an ISO week ID. The 10-room run requires no wallet. Shared URLs contain a compact action trace and integrity digest; the recipient sees a score only after the trace is validated and replayed against the same seed. Combat and between-room screens reuse the same Delveworn components as Practice and Onchain Mode. A completed result offers Somnia Onchain Mode only when the frontend is configured for Somnia. See [Weekly Verified Challenge V1](WEEKLY_VERIFIED_CHALLENGE.md) for the schedule, score, proof format, analytics events and limits.

### The Living Dungeon

The Living Dungeon is a separate local experiment in player-shaped rules and visible consequences. A bounded AI interpreter can map a short bargain into approved semantic slots, while the deterministic engine constructs, validates and executes every pact. The same complete flow works through authored menu choices when AI is disabled or unavailable. A surviving witness may form a sourced belief from what it observed, and the boss can prepare from that belief without rewriting the factual run record. The mode has no wallet, RPC, VRF, leaderboard or onchain reward.

### Onchain Mode

Onchain Mode connects a wallet to a configured deployment. Player state and game actions are handled by the deployed `Delveworn` contract, and randomness-backed actions resolve through the configured provider and callback adapter.

Onchain Mode depends on the selected network, RPC availability, wallet confirmations and the deployed contract address. The active Delveworn frontend and the default local configuration select Somnia Shannon Testnet. The previous RISE experience remains available only through its explicit legacy deployment configuration.

## Project overview

Delveworn currently includes:

- A wallet-free weekly challenge with deterministic replay verification
- Result links that open the same challenge and preserve referral attribution
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
| RISE Testnet | Preserved previous version | Available only through the explicit `riseTestnet` deployment configuration and the previous frontend. |
| Somnia Shannon Testnet | Active public testnet beta | Delveworn [`0x07c5…c292`](https://shannon-explorer.somnia.network/address/0x07c5D071132ae95C3708031790b3feC740F4c292) uses a native VRF adapter and Somnia's coordinator-funded Reactivity/drand flow. The active frontend is [`delveworn.app`](https://delveworn.app/onchain); the separate [`delveworn-somnia.vercel.app`](https://delveworn-somnia.vercel.app/onchain) frontend remains available. Standard MetaMask play and feature-flagged Thirdweb ERC-4337 Popup-free Play are supported. Popup-free Play removes repeated wallet approvals but still waits for bundling, block inclusion and verified randomness. |
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
npm test
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

Deploy the adapter first:

```bash
forge create src/adapters/SomniaNativeVRFAdapter.sol:SomniaNativeVRFAdapter \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key "$SOMNIA_DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --gas-limit 20000000 \
  --constructor-args \
    0x0834459256bbb8d2efee23dc6c3f1722266182dd \
    2500000 \
    16
```

Set the returned adapter address, deploy a fresh Delveworn core, then bind the adapter to that core exactly once:

```bash
export SOMNIA_VRF_ADAPTER=0x...

forge create src/Delveworn.sol:Delveworn \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key "$SOMNIA_DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --gas-limit 150000000 \
  --constructor-args "$SOMNIA_VRF_ADAPTER"

export SOMNIA_DUNGEON=0x...

cast send "$SOMNIA_VRF_ADAPTER" "setConsumer(address)" "$SOMNIA_DUNGEON" \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key "$SOMNIA_DEPLOYER_PRIVATE_KEY" \
  --gas-limit 5000000
```

The high Delveworn deployment gas limit accommodates Shannon's deployment gas accounting; unused gas is not charged. The adapter uses Somnia's maximum `2_500_000` callback gas and minimum `16`-block commit delay. The native coordinator pays entropy-delivery costs; the adapter requires no subscription or prefunding. `script/DeploySomniaShannon.s.sol` contains the equivalent atomic deployment configuration for RPC environments that support Foundry script simulation.

## Deployment

The upgraded Somnia Testnet frontend uses the `delveworn-app` Vercel project and `https://delveworn.app`, with `frontend` as its Root Directory and `upgrade/market-dungeon-experience` as its production branch. Push approved updates to that branch to update the new site.

The original `delveworn` project keeps `https://delveworn.vercel.app` and its existing `main` production branch. The separate `delveworn-somnia` project is unchanged. Keep the upgraded branch separate from `main` to preserve those deployments. Configure deployment variables in Vercel rather than committing `.env.local`.

The `delveworn-app` project uses the following public configuration:

```text
NEXT_PUBLIC_DEPLOYMENT=somniaShannon
NEXT_PUBLIC_SITE_URL=https://delveworn.app
NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS=0x07c5D071132ae95C3708031790b3feC740F4c292
NEXT_PUBLIC_SOMNIA_SHANNON_RPC_URL=https://api.infra.testnet.somnia.network/
NEXT_PUBLIC_SOMNIA_SHANNON_WS_URL=wss://api.infra.testnet.somnia.network/ws
NEXT_PUBLIC_SOMNIA_SHANNON_EXPLORER_URL=https://shannon-explorer.somnia.network/
NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED=true
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=<public client ID configured for delveworn.app>
```

Somnia Popup-free Play requires:

```text
NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED=true
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=<public Thirdweb client ID>
```

Enable the feature flag only when the Thirdweb client is restricted to the
intended canonical domain and has a Shannon sponsored-gas policy. The `delveworn.app` and canonical
Somnia deployments satisfy those requirements. Other deployments should keep
the flag disabled until their domain and sponsorship policy are configured. MetaMask remains the
owner/admin wallet. The temporary session key expires after eight hours and is
limited onchain to zero-value calls against the configured Delveworn contract.
Because the ERC-4337 smart account has its own address, it has separate player
state from the owner's MetaMask EOA.

Keep the original `delveworn` project on RISE Testnet: its URL is referenced by existing grant applications. The network switch applies only to `delveworn-app`; it does not migrate player state between chains.

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

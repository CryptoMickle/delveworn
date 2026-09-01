# Delveworn

Delveworn is a fully onchain dungeon crawler. The public frontend remains on RISE Testnet and supports RISE Wallet session keys for fast, popup-free gameplay, plus MetaMask standard transactions. A separately selectable Somnia Shannon configuration uses MetaMask and Somnia Native VRF without changing the public RISE experience. Somnia ERC-4337 Instant Play is implemented behind an explicit, disabled-by-default feature flag.

## Status

Public testnet beta. The game is deployed through Vercel from the `main` branch of this repository.

## Stack

- Next.js 16
- React 19
- TypeScript
- RISE Wallet
- MetaMask
- Thirdweb ERC-4337 smart accounts
- viem + wagmi
- shreds
- TanStack Query

## Local development

Install dependencies:

```bash
npm install
```

Create `.env.local` and point the frontend at the deployed Delveworn contract:

```bash
NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS=0x...
```

To run the separately verified Somnia Shannon deployment instead:

```bash
NEXT_PUBLIC_DEPLOYMENT=somniaShannon
NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS=0x07c5D071132ae95C3708031790b3feC740F4c292
```

Standard MetaMask play remains the Somnia default. To test the separate
ERC-4337 Instant Play path, create a public Thirdweb client for Shannon,
configure its allowed development domain and sponsored-gas policy, then add:

```bash
NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED=true
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_public_client_id
```

Instant Play uses MetaMask as the smart account owner. It creates a local
8-hour session key whose onchain permissions allow only zero-value calls to the
configured Delveworn contract. The key is stored in browser local storage and
is never sent to Delveworn or the repository. The ERC-4337 smart account is a
different onchain player address from the MetaMask EOA, so existing EOA game
progress does not transfer between the two modes.

`NEXT_PUBLIC_DUNGEON_ADDRESS` remains supported as a legacy fallback.

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
```

## Deployment

Vercel is connected to this GitHub repository with `frontend` as its Root Directory. Changes merged to `main` trigger a production deployment automatically.

The preferred production variable for the current RISE Testnet deployment is:

```text
NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS
```

The legacy `NEXT_PUBLIC_DUNGEON_ADDRESS` variable is retained for deployment compatibility.

The current UI expects the contract's `frontendSnapshotV3()`,
`claimRelic(bool)` and `equipOwnedRelic(Relic)` functions for full Practice
Mode parity. It falls back to older snapshots so an existing deployment still
loads, but random boss relics, duplicate counters and collection switching are
enabled only after the selected deployment address points to the upgraded
Delveworn contract.

## VRF diagnostics

The repository includes `scripts/vrf-latency-monitor.mjs` for measuring request/fulfillment latency during testnet debugging. Generated `vrf-latency-*.csv` files are intentionally ignored by Git.

## Network

The public frontend targets RISE Testnet. Somnia Shannon is available as an opt-in build configuration using chain ID `50312`, the official Dream RPC and Somnia Native VRF. Its Thirdweb ERC-4337 smart-account/session-key path is feature-flagged and must be explicitly configured and tested before public activation; MetaMask standard transactions remain available independently. Product naming remains chain-independent; contract addresses and network configuration must be selected per deployment before any mainnet release.

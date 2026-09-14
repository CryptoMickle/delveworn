# Delveworn

Delveworn is a fully onchain dungeon crawler. The upgraded frontend at `delveworn.app` uses Somnia Shannon Testnet, MetaMask standard transactions and Somnia Native VRF. The original `delveworn.vercel.app` keeps its RISE Testnet configuration. Somnia ERC-4337 Instant Play remains an optional feature and is disabled on `delveworn.app`.

## Status

Public testnet beta. The upgraded game is deployed at `https://delveworn.app`. The previous version remains at `https://delveworn.vercel.app`.

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

Copy `.env.example` to `.env.local` to use the same Somnia testnet configuration as `delveworn.app`:

```bash
NEXT_PUBLIC_DEPLOYMENT=somniaShannon
NEXT_PUBLIC_SITE_URL=https://delveworn.app
NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS=0x07c5D071132ae95C3708031790b3feC740F4c292
NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED=false
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

The `delveworn-app` Vercel project connects this repository's `upgrade/market-dungeon-experience` branch to `https://delveworn.app`, with `frontend` as its Root Directory. Approved pushes to that branch trigger production updates.

The original `delveworn` project and its `main` production branch continue serving the previous version at `https://delveworn.vercel.app`. The Somnia project remains separate. Do not merge the upgraded branch into `main` when preserving those versions.

Set `NEXT_PUBLIC_DEPLOYMENT=somniaShannon`, `NEXT_PUBLIC_SITE_URL=https://delveworn.app` and `NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS` in the new project. Use the public HTTPS/WSS/explorer values from `.env.example`. RISE deployments continue using `NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS` in their own projects.

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

The upgraded public frontend targets Somnia Shannon Testnet using chain ID `50312`, the official testnet RPC and Somnia Native VRF. The previous frontend stays on RISE Testnet. Somnia's Thirdweb ERC-4337 smart-account/session-key path is feature-flagged and must be explicitly configured and tested before public activation; MetaMask standard transactions remain available independently. Product naming remains chain-independent; contract addresses and network configuration must be selected per deployment before any mainnet release.

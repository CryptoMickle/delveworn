# Delveworn

Delveworn is a fully onchain dungeon crawler. The current public frontend deployment targets RISE Testnet and supports RISE Wallet session keys for fast, popup-free gameplay, plus MetaMask standard transactions.

## Status

Public testnet beta. The game is deployed through Vercel from the `main` branch of this repository.

## Stack

- Next.js 16
- React 19
- TypeScript
- RISE Wallet
- MetaMask
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
NEXT_PUBLIC_DUNGEON_ADDRESS=0x...
```

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

Vercel is connected to this GitHub repository. Changes merged to `main` trigger a production deployment automatically.

The Vercel project must have this environment variable configured:

```text
NEXT_PUBLIC_DUNGEON_ADDRESS
```

The environment-variable name is retained for deployment compatibility even though the product and core contract are now named Delveworn.

The current UI expects the contract's `frontendSnapshotV3()`,
`claimRelic(bool)` and `equipOwnedRelic(Relic)` functions for full Practice
Mode parity. It falls back to older snapshots so an existing deployment still
loads, but random boss relics, duplicate counters and collection switching are
enabled only after `NEXT_PUBLIC_DUNGEON_ADDRESS` points to the upgraded
Delveworn contract.

## VRF diagnostics

The repository includes `scripts/vrf-latency-monitor.mjs` for measuring request/fulfillment latency during testnet debugging. Generated `vrf-latency-*.csv` files are intentionally ignored by Git.

## Network

The current frontend targets RISE Testnet. Product naming is chain-independent; contract addresses and network configuration should be selected per deployment before any mainnet release.

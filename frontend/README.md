# Delveworn

Delveworn is a chain-agnostic dungeon crawler with wallet-free First Descent,
Endless Practice and Weekly Challenge modes. Its optional onchain mode targets
Somnia Shannon Testnet. Wallet, RPC and VRF are never required for the local
game modes. The original `delveworn.vercel.app` keeps its separate RISE Testnet
configuration.

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

Copy `.env.example` to `.env.local` for Somnia testnet development. Local session keys default to disabled until the development domain is configured:

```bash
NEXT_PUBLIC_DEPLOYMENT=somniaShannon
NEXT_PUBLIC_SITE_URL=https://delveworn.app
NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS=0x07c5D071132ae95C3708031790b3feC740F4c292
NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED=false
```

To test ERC-4337 Popup-free Play locally, use a public Thirdweb client for Shannon,
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

## Weekly Verified Challenge

Open `/challenge` for the current ISO week or `/challenge/2026-W38` for a stable challenge ID. The mode uses the shared Practice engine with a deterministic seed, records only legal action codes and reconstructs each shared result before displaying its score. It requires no wallet or network call.

The challenge reuses the same combat and between-room components as Practice and Onchain Mode. After a completed run, an optional onchain link is shown only on the Somnia deployment.

The full V1 contract for challenge IDs, scoring, proof validation, sharing, privacy and exclusions is documented in [`../WEEKLY_VERIFIED_CHALLENGE.md`](../WEEKLY_VERIFIED_CHALLENGE.md).

## Production build

```bash
npm test
npm run lint
npm run build
```

## Deployment

The `delveworn-app` Vercel project connects this repository's `upgrade/market-dungeon-experience` branch to `https://delveworn.app`, with `frontend` as its Root Directory. Approved pushes to that branch trigger production updates.

The original `delveworn` project and its `main` production branch continue serving the previous version at `https://delveworn.vercel.app`. The Somnia project remains separate. Do not merge the upgraded branch into `main` when preserving those versions.

Set `NEXT_PUBLIC_DEPLOYMENT=somniaShannon`, `NEXT_PUBLIC_SITE_URL=https://delveworn.app` and `NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS` in the new project. Use the public HTTPS/WSS/explorer values from `.env.example`. Enable `NEXT_PUBLIC_SOMNIA_SESSION_KEYS_ENABLED=true` with the public `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` whose domain allowlist includes `delveworn.app` and whose sponsorship policy allows Shannon. RISE deployments continue using `NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS` in their own projects.

If `NEXT_PUBLIC_DEPLOYMENT` is omitted, the frontend now defaults to `somniaShannon`. Use `riseTestnet` only for the preserved legacy deployment.

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

## Shared room presentation

`/practice` now uses the approved walking grid with the existing endless engine;
active `/onchain` runs use the same room with confirmed contract snapshots.
`/play` remains the ten-room introduction. Floor loot is optional, higher tiers
reuse their original artwork, and Kevin’s shop keeps player stats visible.
See [`ENDLESS_GRID.md`](../ENDLESS_GRID.md) for reward authority, saves, testing
and the unresolved live Somnia verification boundary.

## Current controls and regression route

- Hold WASD to walk freely. Use the arrow keys to select visible actions and
  Enter to activate the selected action. J, K and M are not action shortcuts.
- New runs begin with 100 HP, three potions and no relic. The first relic is
  earned after the room 10 boss.
- Loot is collected automatically when the player reaches it. Walking directly
  to the open door leaves ordinary loot behind. Kevin enters from the door and
  parks with his wagon at the upper-left side of eligible rooms.
- In combat, a potion adds 25 HP, applies the reduced enemy retaliation, and
  then caps the result at maximum HP. Between rooms, potion healing is safe.

Before a preview is marked ready, verify this route without a wallet:

1. Start First Descent and walk to the room 1 monster.
2. Complete a fight using Attack, Storm and Potion with arrow/Enter controls.
3. Collect one loot drop and bypass another through the door.
4. Visit Kevin in rooms 5 and 9, make a purchase and leave without purchasing.
5. Defeat the room 10 boss, keep or equip the relic, and finish the run.
6. Reload during combat, while loot is waiting and after a completed transition.
7. Confirm that an existing Practice save and an old Weekly proof still restore
   without being rewritten.

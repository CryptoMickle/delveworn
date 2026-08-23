# Chain-agnostic architecture

Delveworn treats the blockchain as infrastructure, not as part of the game domain.

## Rules

1. Gameplay, balance, player state and progression stay in the Delveworn core.
2. Chain/provider-specific randomness lives behind adapters.
3. A deployment selects an adapter; the game core must not be forked per chain.
4. RPC URLs, chain IDs, explorers, wallet integrations and contract addresses belong in deployment/frontend configuration.
5. New chains should be integrated by adding configuration and an adapter, not by editing combat logic.

## Randomness boundary

```text
Delveworn -> chain adapter -> randomness provider
          <- chain adapter <- provider callback
```

`Delveworn` talks only to the generic core-facing request/callback boundary. Provider-specific subscription IDs, wrapper addresses, key hashes, fees, confirmations and callback formats belong inside the adapter or deployment configuration.

Current adapters include:

- `LegacyVRFAdapter` for compatibility with the original VRF-style request/callback interface.
- `ChainlinkV25DirectFundingAdapter` for Chainlink VRF v2.5 wrapper direct funding with the chain's native token.

## Deployment strategy

Each supported network should deploy the same `Delveworn` core against the adapter appropriate for that network.

Provider/chain benchmarking can therefore happen without changing gameplay code. A chain-specific failure or provider migration should normally require a new adapter deployment, not a fork of the core game.

## Frontend boundary

The frontend should converge on a deployment registry containing at minimum:

- chain ID
- chain definition
- HTTP RPC
- WebSocket RPC when available
- block explorer
- Delveworn contract address
- wallet/account-abstraction capabilities
- randomness UX timing values
- chain-specific feature flags

UI/game components should consume the active deployment rather than import a specific chain directly.

## Naming

`RiseDungeon` / `RISE Dungeon` is legacy project naming. New source files, contract types, tests, deployment scripts and user-facing metadata should use `Delveworn`.

Historical deployments remain valid on-chain and do not need to be renamed; the naming migration applies to source and future deployments.

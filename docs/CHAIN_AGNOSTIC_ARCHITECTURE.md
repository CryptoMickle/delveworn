# Chain-agnostic architecture

Rise Dungeon treats the blockchain as infrastructure, not as part of the game domain.

## Rules

1. Gameplay, balance, player state and progression stay in the game core.
2. Chain/provider-specific randomness lives behind adapters.
3. A deployment selects an adapter; the game core must not be forked per chain.
4. RPC URLs, chain IDs, explorers, wallet integrations and contract addresses belong in deployment/frontend configuration.
5. New chains should be integrated by adding configuration and an adapter, not by editing combat logic.

## Randomness boundary

Current production-compatible path:

```text
RiseDungeon -> chain adapter -> randomness provider
            <- chain adapter <- provider callback
```

`LegacyVRFAdapter` is the first compatibility adapter. It lets the existing RiseDungeon ABI remain unchanged while moving the provider callback boundary out of the game contract.

A Chainlink/Supra/native-randomness integration should implement the same core-facing request/callback behavior inside its own adapter. Provider-specific subscription IDs, key hashes, fees, confirmations and callback formats must remain inside that adapter.

## Migration strategy

During the transition the existing direct coordinator deployment remains valid. New deployments should point `RiseDungeon` at an adapter instead of directly at a provider coordinator.

This allows provider/chain benchmarking without changing gameplay. Once all supported deployments use adapters, the remaining legacy VRF naming in the core can be renamed to a generic randomness interface in a separately tested ABI migration.

## Frontend boundary

The frontend should converge on a deployment registry containing at minimum:

- chain ID
- chain definition
- HTTP RPC
- WebSocket RPC when available
- block explorer
- RiseDungeon contract address
- wallet/account-abstraction capabilities
- randomness UX timing values
- chain-specific feature flags

UI/game components should consume the active deployment rather than import a specific chain directly.

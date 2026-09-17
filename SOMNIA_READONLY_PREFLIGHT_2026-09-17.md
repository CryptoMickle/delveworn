# Somnia Shannon read-only readiness preflight

Date: 2026-09-17

Scope: existing public Somnia Shannon deployment only

Result: **topology and static configuration pass; historical pending-request state remains unproven**

## Safety boundary

This preflight was deliberately read-only. It made no transaction, simulation
of a transaction, deployment, `setConsumer` call, faucet request, account or
wallet action, private-key access, environment-secret read, or address/config
change.

The chain checks used only `eth_chainId`, `eth_blockNumber`,
`eth_getBlockByNumber`, `eth_getCode`, and `eth_call`. The public-site checks
read the HTML and JavaScript served by `https://delveworn.app/onchain`; the
repository checks read public GitHub files. No explorer page or third-party ABI
was treated as proof.

The local worktree was being changed concurrently. Static source comparison in
this report therefore uses the committed snapshot
`cfff2ebcbe7596fcf92c07f0e5bb81965740a643` and does not make any claim about
the uncommitted Delveworn implementation.

## Public configuration resolved

The exact configured public core is:

```text
0x07c5D071132ae95C3708031790b3feC740F4c292
```

Three independent public configuration surfaces agree:

1. `frontend/app/chain-config.ts` in the local committed snapshot uses chain ID
   `50312` and that address as the Somnia Shannon fallback.
2. The public production branch documented by the repository is
   `upgrade/market-dungeon-experience`. Its GitHub head was
   `1a7119a31ac0c951374800282dffa1902c925da9` during this check. Its README
   declares:

   ```text
   NEXT_PUBLIC_DEPLOYMENT=somniaShannon
   NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS=0x07c5D071132ae95C3708031790b3feC740F4c292
   NEXT_PUBLIC_SOMNIA_SHANNON_RPC_URL=https://api.infra.testnet.somnia.network/
   ```

3. The live `https://delveworn.app/onchain` HTML identified Vercel deployment
   `dpl_axJLVQiqNUCRkN71ZhGyQn75WnJk`. Its served client bundle
   `/_next/static/immutable/chunks/1xx9qtgy-pq4q.js` contains the active
   `somnia-shannon` object with chain ID `50312`, the exact core address above,
   HTTP RPC `https://api.infra.testnet.somnia.network/`, and WebSocket RPC
   `wss://api.infra.testnet.somnia.network/ws`.

The repository fallback `https://dream-rpc.somnia.network/` also remains in the
source bundle, but it is not the active `rpcUrl` in that Vercel build.

## Pinned chain observation

All contract reads below used one explicit block tag against the public RPC:

| Field | Exact observation |
| --- | --- |
| RPC endpoint | `https://api.infra.testnet.somnia.network/` |
| `eth_chainId` | `0xc488` = `50312` |
| Block number | `0x1d3e29ab` = `490613163` |
| Block hash | `0x837931d602cf4fdf32af9bef0fd83294dfd496810f6c37e15f02cfcbc2f2e16b` |
| Block timestamp | `0x6aaba897` = `1789634711` = `2026-09-17T08:45:11Z` |

This proves what the endpoint returned at the pinned block. It does not prove
the endpoint's operator, consensus correctness, or finality independently.

## Runtime code existence

The sizes and hashes below are calculated from the exact runtime bytes returned
by `eth_getCode` at block `0x1d3e29ab`.

| Role | Address | Runtime bytes | Keccak-256 of runtime code |
| --- | --- | ---: | --- |
| Configured Delveworn core | `0x07c5D071132ae95C3708031790b3feC740F4c292` | 24,178 | `0x6c5bc2e9f62278730a414a4087f5f61be3277c4e3205aed8b0273786468e4791` |
| Core-reported adapter | `0x4d57f5129b492edb48386e01a2c9dd2f4cc8e0a9` | 1,959 | `0x43e565d7b79008e2d153637382401deb92aea5b3086f3ea66d79b8ab1643f32c` |
| Adapter-reported native coordinator | `0x0834459256bbb8d2efee23dc6c3f1722266182dd` | 8,749 | `0xfc17b13c23ad92cdbacb6352e7f82fcbc3f4eb5ef1a7b0ecfd34cc766f5327df` |

All three returned non-empty runtime code.

## Core and adapter getters

Every value in this table came from `eth_call` at the pinned block.

| Contract | Getter | Selector | Decoded value |
| --- | --- | --- | --- |
| Core | `coordinator()` | `0x0a009097` | `0x4d57f5129b492edb48386e01a2c9dd2f4cc8e0a9` |
| Adapter | `owner()` | `0x8da5cb5b` | `0x32af12c2be521d67a3a4ec0b168171cf335186d2` |
| Adapter | `consumer()` | `0xb4fd7296` | `0x07c5D071132ae95C3708031790b3feC740F4c292` |
| Adapter | `coordinator()` | `0x0a009097` | `0x0834459256bbb8d2efee23dc6c3f1722266182dd` |
| Adapter | `callbackGasLimit()` | `0x24f74697` | `2,500,000` (`0x2625a0`) |
| Adapter | `commitDelayBlocks()` | `0x9d8196d9` | `16` (`0x10`) |
| Adapter | `MAX_CALLBACK_GAS_LIMIT()` | `0x39c33215` | `2,500,000` (`0x2625a0`) |
| Adapter | `MIN_COMMIT_DELAY_BLOCKS()` | `0x147a660e` | `16` (`0x10`) |
| Adapter | `MAX_COMMIT_DELAY_BLOCKS()` | `0x615135a5` | `200` (`0xc8`) |
| Adapter | `MAX_NUM_WORDS()` | `0x40d6bb82` | `500` (`0x1f4`) |
| Adapter | `pendingRequests(0)` | `0x3c652a9a…0000` | `false` |

The important reciprocal binding is present at the pinned block:

```text
public core  -> adapter 0x4d57...e0a9
adapter      -> consumer/public core 0x07c5...c292
adapter      -> native coordinator 0x0834...82dd
```

The configured callback gas and commit delay equal the deployment script's
defaults and remain within the adapter's exposed bounds.

## Pending-request evidence and the historical concern

The deployed adapter's selector surface contains
`pendingRequests(uint256) -> bool`, but it contains no enumerable request list
and no aggregate pending counter. Read-only probes for the plausible aggregate
getters `pendingRequestCount()`, `pendingCount()`, and `requestCount()` all
reverted with empty data, consistent with those getters being absent.

`pendingRequests(0) == false` is only a zero-key sanity check. It is **not**
evidence that all real request IDs are clear.

The committed local source has a known historical edge in its retry model:
`test/SomniaNativeVRFAdapter.t.sol:227-255` deliberately shows an abandoned
request remaining `true` in the adapter after a successful retry and after a
stale fulfillment attempt fails. Because the live adapter cannot enumerate or
count pending IDs, this bounded preflight cannot establish whether that history
ever occurred on the live adapter. It also cannot establish that it did occur.
The correct status is therefore **unresolved / unknown**, not zero and not
incident-confirmed.

Clearing that uncertainty requires evidence outside the allowed getter-only
scope, such as a complete request/fulfillment event reconciliation from the
adapter's creation block plus per-ID getter confirmation at a pinned block. No
such history was assumed or fabricated here.

## Comparison with committed source

At the ABI and configuration-surface level, the observation is consistent with
the committed design:

- `Delveworn.coordinator()` returns an adapter address.
- The adapter exposes `owner`, `consumer`, native `coordinator`, callback gas,
  commit delay, constants, and a per-ID `pendingRequests` mapping.
- The adapter's `consumer` is the configured core and the core's coordinator is
  that adapter.
- The native coordinator matches the documented Shannon default.
- The callback gas and commit delay match `DeploySomniaShannon.s.sol`.

This is not deployed-bytecode equivalence or source verification. Matching
selectors, values, code presence, and topology do not prove function-body
identity. Runtime bytecode also embeds constructor immutables and compiler
metadata. This report did not compile the mutable worktree, strip/link
immutables, compare creation transactions or constructor arguments, obtain a
verified explorer artifact, or reproduce the runtime hashes from a pinned
compiler/toolchain. The uncommitted implementation under development is not
claimed to match any deployed address.

## Readiness conclusion

The existing public Somnia configuration passes the basic read-only wiring
preflight at block `490613163`: correct chain ID, non-empty core/adapter/native
coordinator code, reciprocal core/adapter binding, documented native
coordinator, and expected callback configuration.

This does **not** clear an address cutover, deployment, consumer binding, or
other chain write. Two material proofs remain outside this preflight:

1. complete historic request reconciliation for adapter
   `0x4d57f5129b492edb48386e01a2c9dd2f4cc8e0a9`, including the abandoned-retry
   case; and
2. reproducible deployed-bytecode/source correspondence for whichever old and
   new core/adapter pair would be used in a future migration.

Until those are supplied, the live deployment is **topologically coherent but
not fully migration-ready**. No prior VRF request should be described as
resolved merely because the current core/adapter getters are correctly wired.

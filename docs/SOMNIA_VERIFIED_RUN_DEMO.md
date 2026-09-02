# Somnia Verified Run demo

Use this sequence when demonstrating Delveworn to reviewers, developers or the Somnia community.

## Canonical links

- Practice Mode: <https://delveworn.vercel.app/practice>
- Somnia Verified Run: <https://delveworn-somnia.vercel.app/onchain>
- Somnia contract: <https://shannon-explorer.somnia.network/address/0x07c5D071132ae95C3708031790b3feC740F4c292>
- Source: <https://github.com/CryptoMickle/delveworn>

> [!IMPORTANT]
> Use the canonical Somnia hostname for wallet testing and public demos. Unique Vercel preview hostnames change between builds and may receive an independent wallet-security classification. A warning on a preview hostname is not evidence about the canonical production hostname.

## 90-second presentation

### 0:00–0:15 — Start with the game

1. Open Practice Mode.
2. Make one combat choice: Attack, Storm or Potion.
3. Explain that Practice Mode is the complete local gameplay loop and responds immediately.

Suggested narration:

> Delveworn is a dungeon crawler first. Practice Mode lets anyone experience the complete loop instantly, without a wallet or testnet dependency.

### 0:15–0:35 — Show the verified route

1. Select **Verified Run**.
2. Show the onchain proof panel and the linked Somnia contract.
3. Explain that the player's authoritative run state and rewards are stored by the deployed contract.

Suggested narration:

> Verified Run is the proof layer: the game uses contract-backed state on Somnia Shannon Testnet and native verifiable randomness for combat outcomes.

### 0:35–0:55 — Explain Popup-free Play

1. Select the MetaMask Popup-free Play option.
2. Point out the displayed restrictions before approving:
   - Delveworn contract only
   - zero-value contract calls only
   - no token transfers
   - expires after eight hours
3. Approve the temporary session once.

Suggested narration:

> One restricted session approval replaces repeated wallet popups. Gameplay actions remain onchain and sponsored, while the permission cannot transfer tokens or call arbitrary contracts.

### 0:55–1:20 — Play one verified action

1. Start a run.
2. Use Attack, Storm or Potion once.
3. Let the result resolve before continuing.

Suggested narration:

> The action is submitted through an ERC-4337 smart account. Somnia includes it, then the native VRF callback supplies the verified result. This route deliberately prioritizes verifiability over instant local response.

### 1:20–1:30 — Optional technical proof

Open **Technical details** only if the audience asks about latency. The timing panel separates preparation, sponsorship, bundler submission, block inclusion and VRF so the testnet cost is visible rather than hidden.

## Claims that are safe to make

- The full gameplay loop is available immediately in local Practice Mode.
- Somnia Verified Run uses the deployed Delveworn contract for authoritative state.
- Combat randomness is supplied through Somnia's configured native VRF flow.
- Popup-free Play uses a restricted, expiring session and sponsored ERC-4337 actions.
- Onchain actions still wait for testnet inclusion and randomness; they are not presented as instant.

## Claims to avoid

- Do not describe Practice Mode as onchain or cryptographically verifiable.
- Do not describe the Somnia route as production mainnet software.
- Do not promise a fixed transaction or VRF time on a public testnet.
- Do not imply that a warning on a unique preview hostname applies to the canonical production hostname.
- Do not claim that the session key controls the user's MetaMask account; the smart account is a separate onchain player.

## Recovery during a live demo

- If Somnia or the wallet is slow, return to Practice Mode and finish the gameplay demonstration there.
- If Popup-free Play cannot be enabled, use standard MetaMask play or continue in Practice Mode.
- If a wallet warning appears, confirm that the hostname is exactly `delveworn-somnia.vercel.app`. Do not bypass warnings on a preview hostname.
- Never ask an audience member to acknowledge a wallet warning for the sake of the demo.

## Community post draft

Delveworn is now live on Somnia Shannon Testnet as a Verified Run. The full dungeon crawler remains instantly playable in local Practice Mode, while the Somnia route demonstrates contract-backed player state, sponsored popup-free actions and native verifiable randomness for combat.

We also split the timing into bundler, inclusion and VRF phases so the onchain path is transparent rather than pretending to be instant.

- Play: <https://delveworn-somnia.vercel.app/onchain>
- Contract: <https://shannon-explorer.somnia.network/address/0x07c5D071132ae95C3708031790b3feC740F4c292>
- Source: <https://github.com/CryptoMickle/delveworn>

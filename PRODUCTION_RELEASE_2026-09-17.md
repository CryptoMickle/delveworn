# delveworn.app production release — 17 September 2026

The user authorized production publication, leaderboard activation and checking Popup-free Play. They explicitly declined migration of the local Practice save from Preview.

## Published

- Code: `6b23ffbe73ceea6eb2b15ce1ba1a6c1a445c741f`.
- Production deployment: `dpl_ByMqdwSJxcZRgbW3PwwXyni7Tu8L`.
- Deployment URL: `https://delveworn-lcoisj8ha-crypto-mickle.vercel.app`.
- Canonical address: `https://delveworn.app`; `www.delveworn.app` redirects with HTTP 308.
- Previous production / rollback reference: `dpl_axJLVQiqNUCRkN71ZhGyQn75WnJk`.

The release was built from a clean archive of the committed source with Production settings, held with `--skip-domain`, verified, and then promoted. Production was not pointed at a Preview build. Development continues on `feat/phase-1-dungeon-slice`; the existing production Git branch was not changed. Future production updates therefore still require an intentional promotion.

## Leaderboard

The existing approved free Upstash resource `store_g9zwhkHsqaGyrwEK` is connected to `delveworn-app` Preview and Production. No plan upgrade was made. Production uses `DELVEWORN_LEADERBOARD_NAMESPACE=production` and a separately generated private cookie-signing secret. Preview's keys and signing secret remain unchanged. Namespaces share the resource quota but isolate standings and rate limits.

Before promotion, hosted checks passed for readiness, empty/current/archive reads, first verified submission, equal-score retention, higher-score replacement, durable reread, private-proof/guest-ID omission, archive-write rejection, invalid-proof rejection and wrong-origin rejection. A dedicated **Release QA** entry was removed by a guarded operation targeting only its own guest/member; the public production board finished empty. The release guest was absent from Preview's data.

After promotion, unauthenticated HTTP requests returned 200 for `/`, `/practice`, `/onchain`, `/challenge/2026-W38/leaderboard`, `/api/leaderboard/status` and `/api/leaderboard/2026-W38`. The status endpoint reported `ready / redis`; the standings response reported `developmentOnly: false` with zero entries. Browser checks confirmed the new three-mode home page and the public standings page.

## Popup-free Play: confirmed domain issue

Read-only Thirdweb requests using the production public client ID returned:

| Request | delveworn.app origin | Preview origin |
| --- | --- | --- |
| Supported entry points | HTTP 200; v0.6/v0.7 supported | HTTP 401 `ORIGIN_UNAUTHORIZED` |
| User-operation gas prices | HTTP 200 | HTTP 401 `ORIGIN_UNAUTHORIZED` |
| Browser preflight | HTTP 200; SDK headers permitted | Not required for diagnosis |

The configured Somnia RPC returned chain ID 50312. The production domain is authorized; the Preview domain is not. No wallet connection, signature, sponsored transaction or session creation was performed by this release check. Full signed session activation still requires the user's MetaMask approval. The previous generic UI error concealed the specific domain rejection.

## Validation and limits

- 276 frontend tests passed; lint: zero errors and 13 existing warnings.
- Six real Redis integration tests passed, including namespace isolation.
- [Frontend CI](https://github.com/CryptoMickle/delveworn/actions/runs/35211574891): all four jobs passed, covering Redis, RISE and both Somnia configurations.
- Vercel production build and promotion succeeded.
- No contract deployment or address switch, game balance change, Practice-save transfer, or external user testing was performed.
- The initial public-page checks did not exercise connected player loading. The compatibility bug discovered immediately after release is described below. Fully authoritative optional loot pickup still requires the separately planned Somnia V4 deployment.

## Follow-up: connected Somnia player loading

The user reported `Could not read Delveworn from Somnia Shannon Testnet.` The frontend probed `frontendSnapshotV4` on the existing pre-V4 contract. Somnia correctly returned `{code: 3, message: "execution reverted", data: "0x"}`. viem exposed that generic provider message as `ContractFunctionRevertedError.reason`; the absence classifier only accepted an empty reason, so it stopped before checking bytecode and reading the working V3 snapshot.

Commit `eee40c40dab531511f3d67f6798cfac98748e4f0` recognizes that exact generic empty-revert response. Legacy fallback still requires proof that the deployed bytecode lacks the V4 selector. Specific revert reasons, custom errors, nonempty revert data, transport failures and previously proven V4 support retain their existing failure behavior.

Validation: 278 frontend tests pass, including regressions built with the installed viem error classes; TypeScript passes; lint has zero errors and the same 13 warnings. Read-only live calls with the exact application ABI reproduce the old failure and successfully decode V3 for both a fresh address and an existing active player after the fix. No wallet signature or chain write was required.

Both the production RPC (`https://api.infra.testnet.somnia.network/`) and the repository fallback (`https://dream-rpc.somnia.network/`) returned the same evidence. All four [Frontend CI jobs](https://github.com/CryptoMickle/delveworn/actions/runs/35213015079) passed.

The fix was built as Production deployment `dpl_EC6xBnqcXVfEDTQaTnYp8A7QwRgt` (`https://delveworn-kpfyfo6s7-crypto-mickle.vercel.app`), checked before promotion, and promoted to `delveworn.app`. Post-promotion HTTP checks confirmed the fixed classifier in the public JavaScript bundle, a working Onchain entry page and `ready / redis` leaderboard status. The preceding deployment `dpl_ByMqdwSJxcZRgbW3PwwXyni7Tu8L` is the immediate rollback reference. Signed wallet activation remains outside these read-only checks.
